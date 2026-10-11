import { test, expect } from '@playwright/test';

async function textColors(page) {
  return page.evaluate(() => {
    const root = window.row.shadowRoot;
    const color = (selector) => getComputedStyle(root.querySelector(selector)).color;
    return {
      primary: color('.info'), secondary: color('.secondary'), state: color('.state'),
      primaryOverride: root.querySelector('.info').style.color,
      secondaryOverride: root.querySelector('.secondary').style.color,
      iconColor: root.querySelector('state-badge').color,
      iconStyle: root.querySelector('state-badge').getAttribute('style'),
      secondaryDisplay: root.querySelector('state-display') ? color('state-display') : null,
    };
  });
}

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

test('text colors resolve tokens and CSS independently without changing icon or state', async ({ page }) => {
  await page.evaluate(async () => {
    const row = await window.mountRow({ entity: 'light.test', secondary: 'Details', color: 'blue' });
    row.style.cssText = 'color: rgb(10, 20, 30); --secondary-text-color: rgb(40, 50, 60); --amber-color: rgb(255, 193, 7); --accent-color: rgb(0, 128, 128)';
  });
  const defaults = await textColors(page);
  expect(defaults).toMatchObject({ primary: 'rgb(10, 20, 30)', secondary: 'rgb(40, 50, 60)', state: 'rgb(10, 20, 30)', iconColor: 'blue' });
  await page.evaluate(async () => {
    window.row.setConfig({ entity: 'light.test', secondary: 'Details', color: 'blue', primary_color: ' amber ' });
    await window.row.updateComplete;
  });
  expect(await textColors(page)).toEqual({ ...defaults, primary: 'rgb(255, 193, 7)', primaryOverride: 'var(--amber-color)' });
  await page.evaluate(async () => {
    window.row.setConfig({ entity: 'light.test', secondary: ['name'], color: 'blue', primary_color: '#123456', secondary_color: 'var(--accent-color)' });
    await window.row.updateComplete;
  });
  expect(await textColors(page)).toMatchObject({
    primary: 'rgb(18, 52, 86)', secondary: 'rgb(0, 128, 128)', secondaryDisplay: 'rgb(0, 128, 128)',
    state: defaults.state, iconColor: defaults.iconColor, iconStyle: defaults.iconStyle,
  });
  await page.evaluate(async () => {
    window.row.setConfig({ entity: 'light.test', secondary: 'Details', secondary_color: 'rgb(12, 34, 56)' });
    await window.row.updateComplete;
  });
  expect(await textColors(page)).toMatchObject({ primary: defaults.primary, primaryOverride: '', secondary: 'rgb(12, 34, 56)' });
});

test('default text color values clear previous overrides', async ({ page }) => {
  await page.evaluate(async () => {
    const row = await window.mountRow({ entity: 'light.test', secondary: 'Details' });
    row.style.cssText = 'color: rgb(10, 20, 30); --secondary-text-color: rgb(40, 50, 60)';
  });
  const defaults = await textColors(page);
  for (const value of [undefined, '', '   ', 'none']) {
    await page.evaluate(async (value) => {
      window.row.setConfig({ entity: 'light.test', secondary: 'Details', primary_color: 'pink', secondary_color: '#abcdef' });
      await window.row.updateComplete;
      window.row.setConfig({ entity: 'light.test', secondary: 'Details', primary_color: value, secondary_color: value });
      await window.row.updateComplete;
    }, value);
    expect(await textColors(page)).toEqual(defaults);
  }
});

test('color-only templates update on hass changes and minute refreshes', async ({ page }) => {
  await page.clock.install();
  await page.evaluate(async () => {
    const row = await window.mountRow({ entity: 'light.test', secondary: 'Details',
      primary_color: "{{ '#123456' if is_state(config.entity, 'off') else 'none' }}",
      secondary_color: "{{ '#abcdef' if is_state(config.entity, 'off') else '' }}" });
    row.style.cssText = 'color: rgb(10, 20, 30); --secondary-text-color: rgb(40, 50, 60)';
  });
  expect(await page.evaluate(() => window.row._refreshTimer !== undefined)).toBe(true);
  expect(await textColors(page)).toMatchObject({ primary: 'rgb(18, 52, 86)', secondary: 'rgb(171, 205, 239)' });
  await page.evaluate(async () => { window.row.hass = window.makeHass('on'); await window.row.updateComplete; });
  expect(await textColors(page)).toMatchObject({ primary: 'rgb(10, 20, 30)', secondary: 'rgb(40, 50, 60)', primaryOverride: '', secondaryOverride: '' });

  // Mutate the fixture without scheduling a Lit update; only the refresh timer can pick this up.
  await page.evaluate(() => { window.row.hass.states['light.test'].state = 'off'; });
  await page.clock.fastForward(60_000);
  expect(await textColors(page)).toMatchObject({ primary: 'rgb(18, 52, 86)', secondary: 'rgb(171, 205, 239)' });
  expect(await page.evaluate(() => ['primary_color', 'secondary_color'].every((key) =>
    window.templates.hasConfigurationTemplates({ [key]: '{{ now() }}' })))).toBe(true);
});
