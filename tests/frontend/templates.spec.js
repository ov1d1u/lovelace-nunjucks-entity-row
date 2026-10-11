import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.evaluate(async () => {
    window.messages = [];
    window.visibility = [];
    window.makeHass = (state = 'off') => ({
      connected: true, language: 'en', locale: { language: 'en', time_format: '24', number_format: 'language' },
      config: { time_zone: 'UTC' }, user: { name: 'Tester' }, entities: {}, devices: {}, areas: {},
      states: { 'light.test': { entity_id: 'light.test', state, attributes: { friendly_name: 'Test', brightness: 128 } } },
      formatEntityState: (entity) => entity.state,
      localize: (key) => key === 'ui.card.update.installing' ? 'Installing' : key,
      connection: {
        connected: true,
        sendMessagePromise: async (message) => {
          window.messages.push(message);
          return message.type === 'repairs/list_issues' ? { issues: [] } : [];
        },
        subscribeEvents: async () => () => {},
        subscribeMessage: async (_callback, message) => {
          window.messages.push(message);
          return () => {};
        },
      },
    });
    const ha = document.createElement('home-assistant');
    ha.hass = window.makeHass();
    document.body.append(ha);
    await import('/row.js');
    window.templates = await import('/templates.js');
    window.mountRow = async (config, withHass = true) => {
      const row = document.createElement('nunjucks-entity-row');
      row.addEventListener('row-visibility-changed', (event) => window.visibility.push(event.detail.value));
      row.setConfig(config);
      if (withHass) row.hass = ha.hass;
      document.body.append(row);
      await row.updateComplete;
      window.row = row;
      return row;
    };
  });
});

test('native templates, nested YAML, JSON results, literal types and source immutability', async ({ page }) => {
  const result = await page.evaluate(() => {
    const source = {
      entity: 'light.test', name: [{ type: 'text', text: '{{ states(config.entity) }}' }],
      active: '{{ is_state(config.entity, "off") }}', state: '001.20', toggle: false,
      secondary: '["name", "{{ states(config.entity) }}"]',
      secondary_name: '{"type":"text","text":"{{ hass.user.name }}"}',
      tap_action: { action: 'perform-action', target: { entity_id: '{{ config.entity }}' }, data: { zero: 0, nil: null } },
      hold_action: '{"action":"{{ "more-info" }}"}',
      time_format: '{"type":"{{ "time" }}"}',
      button: '{{ hass.localize("ui.card.update.installing") }}',
      state_display: '{# comment only #}',
    };
    const before = JSON.stringify(source);
    const rendered = window.templates.renderConfiguration(window.makeHass(), source);
    return { rendered, unchanged: before === JSON.stringify(source), hasTemplates: window.templates.hasConfigurationTemplates(source) };
  });
  expect(result.unchanged).toBe(true);
  expect(result.hasTemplates).toBe(true);
  expect(result.rendered).toMatchObject({
    active: true, state: '001.20', toggle: false, name: [{ type: 'text', text: 'off' }],
    secondary: ['name', 'off'], secondary_name: { type: 'text', text: 'Tester' },
    tap_action: { target: { entity_id: 'light.test' }, data: { zero: 0, nil: null } },
    hold_action: { action: 'more-info' }, time_format: { type: 'time' }, button: 'Installing', state_display: '',
  });
});

test('failed fields retain previous valid values, recover and do not alter other options', async ({ page }) => {
  const result = await page.evaluate(() => {
    const errors = [];
    const render = (source, previous) => window.templates.renderConfiguration(window.makeHass(), source, previous, (key) => errors.push(key));
    const failed = render({ name: '{{ missing_function() }}', tap_action: "{{ \"{'action':'toggle'}\" }}", state: '{{ states("light.test") }}' }, { name: 'Last good' });
    const recovered = render({ name: '{{ "Recovered" }}', tap_action: `{ "action": "{{ 'toggle' }}" }` }, failed);
    return { failed, recovered, errors };
  });
  expect(result.failed).toEqual({ name: 'Last good', state: 'off' });
  expect(result.errors).toEqual(['name', 'tap_action']);
  expect(result.recovered).toEqual({ name: 'Recovered', tap_action: { action: 'toggle' } });
});

test('hass changes update visibility and nested action payloads before rendering', async ({ page }) => {
  const result = await page.evaluate(async () => {
    const row = await window.mountRow({ entity: 'light.test', name: '{{ states(config.entity) }}',
      hidden: '{{ is_state(config.entity, "on") }}', tap_action: { action: 'perform-action', data: { state: '{{ states(config.entity) }}' } } });
    const before = row.shadowRoot.querySelector('.info').textContent.trim();
    row.hass = window.makeHass('on');
    await row.updateComplete;
    let action;
    row.addEventListener('hass-action', (event) => { action = event.detail; });
    row._infoActionHandler({ detail: { action: 'tap' } });
    return { before, after: row.shadowRoot.querySelector('.info').textContent.trim(),
      hidden: row.shadowRoot.querySelector('#wrapper').classList.contains('hidden'), visibility: window.visibility,
      action, messages: window.messages, cache: 'cardMod_template_cache' in window,
      oldElement: !!customElements.get('template-entity-row') };
  });
  expect(result.before).toBe('off');
  expect(result.after).toBe('on');
  expect(result.hidden).toBe(true);
  expect(result.visibility).toEqual([true, false]);
  expect(result.action.config.tap_action.data.state).toBe('on');
  expect(result.messages.some((message) => message.type === 'render_template')).toBe(false);
  expect(result.cache).toBe(false);
  expect(result.oldElement).toBe(false);
});

test('configuration replacement clears stale values and supports hass arriving later', async ({ page }) => {
  const result = await page.evaluate(async () => {
    const row = await window.mountRow({ entity: 'light.test', name: '{{ "Old" }}' }, false);
    row.hass = window.makeHass();
    await row.updateComplete;
    const before = row.config.name;
    row.setConfig({ entity: 'light.test', name: '{{ missing_function() }}' });
    await row.updateComplete;
    let rejected = false;
    try { row.setConfig({ nested_templates: true }); } catch (error) { rejected = error.message.includes('standard Nunjucks'); }
    return { before, omitted: !Object.hasOwn(row.config, 'name'), visibility: window.visibility, rejected };
  });
  expect(result).toEqual({ before: 'Old', omitted: true, visibility: [true, true], rejected: true });
});

test('minute refresh stops on disconnect, restarts once and is absent for static rows', async ({ page }) => {
  await page.clock.install();
  await page.evaluate(async () => {
    await window.mountRow({ entity: 'light.test', name: '{{ now().strftime("%H:%M") }}' });
    window.initialName = window.row.config.name;
  });
  await page.clock.fastForward(60_000);
  expect(await page.evaluate(() => window.row.config.name !== window.initialName)).toBe(true);
  await page.evaluate(() => {
    window.row.remove();
    window.detachedConfig = window.row.config;
  });
  await page.clock.fastForward(120_000);
  expect(await page.evaluate(() => window.row.config === window.detachedConfig && window.row._refreshTimer === undefined)).toBe(true);
  await page.evaluate(async () => { document.body.append(window.row); await window.row.updateComplete; window.reconnectedName = window.row.config.name; });
  await page.clock.fastForward(60_000);
  expect(await page.evaluate(() => window.row.config.name !== window.reconnectedName && window.row._refreshTimer !== undefined)).toBe(true);
  await page.evaluate(async () => { window.row.setConfig({ name: 'Static' }); await window.row.updateComplete; });
  expect(await page.evaluate(() => window.row._refreshTimer === undefined)).toBe(true);
});
