import { LitElement, html, css, PropertyValues } from "lit";
import { property } from "lit/decorators.js";
import { classMap } from "lit/directives/class-map.js";
import { styleMap } from "lit/directives/style-map.js";
import { bindActionHandler, buttonAction } from "./helpers/action";
import pjson from "../package.json";
import { renderConfiguration, hasConfigurationTemplates } from "./helpers/templates";
import { stateActive } from "./helpers/common/entity/state_active";
import { computeCssColor } from "./helpers/common/entity/compute_color";

function textColor(value: unknown): string | undefined {
  const color = typeof value === "string" ? value.trim() : "";
  return color && color !== "none" ? computeCssColor(color) : undefined;
}

class NunjucksEntityRow extends LitElement {
  @property() _config;
  @property() hass;
  @property() config; // Rendered configuration of the row to display
  @property() _action;
  

  private _infoActionElement: HTMLElement;
  private _boundInfoActionListener = this._infoActionListener.bind(this);
  private _infoActionEvents = ["mousedown", "touchstart", "click", "keydown", "contextmenu"];

  private _refreshTimer?: ReturnType<typeof setInterval>;
  private _hasTemplates = false;
  private _styleObserver?: MutationObserver;

  setConfig(config) {
    if (config.nested_templates === true) {
      throw new Error("nested_templates is no longer supported. Use standard Nunjucks {{ }} and {% %} delimiters.");
    }
    if (config.toggle !== undefined && config.button !== undefined) {
      throw new Error("toggle and button options cannot be used together.");
    }
    this._config = structuredClone(config);
    this.config = undefined;
    this._hasTemplates = hasConfigurationTemplates(this._config);
    this._syncRefreshTimer();
  }

  protected willUpdate(changedProperties: PropertyValues) {
    if (this._config && this.hass) {
      const previous = this.config;
      this.config = renderConfiguration(this.hass, this._config, previous);
      // A property assigned during willUpdate does not schedule a separate update.
      changedProperties.set("config", previous);
    }
  }

  private _syncRefreshTimer() {
    clearInterval(this._refreshTimer);
    this._refreshTimer = undefined;
    if (this.isConnected && this._hasTemplates) {
      this._refreshTimer = setInterval(() => this.requestUpdate(), 60_000);
    }
  }

  _actionEntity(part?: "" | "icon" | "state" | "secondary") {
    let actionEntity;
    if (part) {
      actionEntity = this.config[`${part}_action_entity`];
      if (!actionEntity && part === "secondary") {
        actionEntity = this.config[`secondary_entity`];
      }
    }
    return actionEntity ?? this.config[`action_entity`] ?? this.config.entity;
  }

  _actionConfig(part?: "" | "icon" | "state", action: string = "tap") {
    let actionConfig;
    if (part) {
      actionConfig = this.config[`${part}_${action}_action`];
    }
    return actionConfig ?? this.config[`${action}_action`];
  }

  _hasAction(part: "" | "icon" | "state" = "") {
    const actionsEntity = this._actionEntity(part);
    const tapActionConfig = this._actionConfig(part);
    const holdActionConfig = this._actionConfig(part, "hold");
    const doubleTapActionConfig = this._actionConfig(part, "double_tap");
    return (
      (actionsEntity && String(tapActionConfig?.action).toLowerCase() != "none") ||
      (tapActionConfig && String(tapActionConfig.action).toLowerCase() != "none") ||
      (holdActionConfig && String(holdActionConfig.action).toLowerCase() != "none") ||
      (doubleTapActionConfig && String(doubleTapActionConfig.action).toLowerCase() != "none")
    );
  }

  _infoActionListener(ev) {
    this._infoActionElement = ev.target;
  }

  _unbindInfoActionHandler(element) {
    if (!element) return;
    this._infoActionEvents.forEach((event) => {
      element.removeEventListener(event, this._boundInfoActionListener, { capture: true });
    });
  }

  _bindActionHandler(element, part: "" | "icon" | "state" = "") {
    if (!element || !this._hasAction(part)) return;
    const options = {
      hasHold: this._actionConfig(part, "hold") !== undefined,
      hasDoubleClick: this._actionConfig(part, "double_tap") !== undefined,
    };
    bindActionHandler(element, options);
  }

  _infoActionHandler(ev) {
    const config = { ...this.config };
    config.tap_action = this._actionConfig();
    config.hold_action = this._actionConfig("", "hold");
    config.double_tap_action = this._actionConfig("", "double_tap");
    // A tap on the secondary area is either on `div.secondary` or `div.secondary state-display`
    if (
      this._infoActionElement?.classList.contains("secondary") || 
      this._infoActionElement?.parentElement?.classList.contains("secondary")
    ) {
      config.entity = this._actionEntity("secondary");
    } else {
      config.entity = this._actionEntity();
    }
    this.dispatchEvent(
      new CustomEvent("hass-action", { detail: { config, action: ev.detail.action }, bubbles: true, composed: true })
    );
  }

  _iconActionHandler(ev) {
    const config = { ...this.config };
    config.tap_action = this._actionConfig("icon");
    config.hold_action = this._actionConfig("icon", "hold");
    config.double_tap_action = this._actionConfig("icon", "double_tap");
    config.entity = this._actionEntity("icon");
    this.dispatchEvent(
      new CustomEvent("hass-action", { detail: { config, action: ev.detail.action }, bubbles: true, composed: true })
    );
  }

  _stateActionHandler(ev) {
    const config = { ...this.config };
    config.tap_action = this._actionConfig("state");
    config.hold_action = this._actionConfig("state", "hold");
    config.double_tap_action = this._actionConfig("state", "double_tap");
    config.entity = this._actionEntity("state");
    this.dispatchEvent(
      new CustomEvent("hass-action", { detail: { config, action: ev.detail.action }, bubbles: true, composed: true })
    );
  }

  protected firstUpdated() {
    this._observeInjectedStyles();
  }

  protected async updated(changedProperties: PropertyValues) {
    this._syncRowPadding();
    if (changedProperties.has("config") && this.config) {
      const oldCondition = changedProperties.get("config")?.condition === undefined ? true
        : String(changedProperties.get("config")?.condition).toLowerCase() === "true";
      const oldHidden = (changedProperties.get("config")?.hidden === undefined || changedProperties.get("config")?.hidden === "") ? !oldCondition
        : String(changedProperties.get("config")?.hidden).toLowerCase() === "true";
      const newCondition = this.config.condition === undefined ? true
        : String(this.config.condition).toLowerCase() === "true";
      const newHidden = (this.config.hidden === undefined || this.config.hidden === "") ? !newCondition
        : String(this.config.hidden).toLowerCase() === "true";
      if (!changedProperties.get("config") || oldHidden !== newHidden) {
        this.dispatchEvent(
          new CustomEvent("row-visibility-changed", 
            { detail: { row: this, value: !newHidden }, bubbles: true, composed: true }) 
        );
      }

      const info = this.shadowRoot.querySelector(".info");
      if (info && this.isConnected) {
        this._infoActionEvents.forEach((event) =>
          info.addEventListener(event, this._boundInfoActionListener, { capture: true }));
      }
      this._bindActionHandler(info);
      this._bindActionHandler(this.shadowRoot.querySelector("state-badge"), "icon");

      const show_toggle = this.config.toggle && this.config.entity;
      const show_button = this.config.button;
      if (!show_toggle && !show_button) {
        this._bindActionHandler(this.shadowRoot.querySelector(".state"), "state");
      }
    }
  }

  connectedCallback() {
    super.connectedCallback();
    this._syncRefreshTimer();
    this._observeInjectedStyles();
    this.requestUpdate();
  }

  // Themes (card-mod / UIX) often style rows through the `hui-generic-entity-row`
  // selector, e.g. adding vertical padding. That selector never matches this row,
  // so mirror the vertical padding a real `hui-generic-entity-row` would receive
  // in this shadow root onto our wrapper to keep the same height as native rows.
  private _syncRowPadding() {
    const probe = this.shadowRoot?.querySelector<HTMLElement>("hui-generic-entity-row.probe");
    const wrapper = this.shadowRoot?.querySelector<HTMLElement>("#wrapper");
    if (!probe || !wrapper) return;
    const style = getComputedStyle(probe);
    const top = style.paddingTop;
    const bottom = style.paddingBottom;
    if (wrapper.style.paddingTop !== top) wrapper.style.paddingTop = top;
    if (wrapper.style.paddingBottom !== bottom) wrapper.style.paddingBottom = bottom;
  }

  private _observeInjectedStyles() {
    if (!this.shadowRoot || this._styleObserver) return;
    // card-mod / UIX inject their <style> elements asynchronously
    this._styleObserver = new MutationObserver(() => this._syncRowPadding());
    this._styleObserver.observe(this.shadowRoot, { childList: true, subtree: true, characterData: true });
  }

  disconnectedCallback() {
    clearInterval(this._refreshTimer);
    this._refreshTimer = undefined;
    this._styleObserver?.disconnect();
    this._styleObserver = undefined;
    this._unbindInfoActionHandler(this.shadowRoot?.querySelector(".info"));
    super.disconnectedCallback();
  }

  render() {
    if (!this.hass || !this.config) return html``;
    const base = this.hass.states[this.config.entity?.trim()];
    const entity = (base && JSON.parse(JSON.stringify(base))) || {
      entity_id: "binary_sensor.",
      attributes: { icon: "no:icon", friendly_name: "" },
      state: "off",
    };

    const icon =
      this.config.icon !== undefined
        ? this.config.icon || "no:icon"
        : undefined;
    const image = this.config.image;


    const name =
      typeof (this.hass as any).formatEntityName === "function"
        ? (this.hass as any).formatEntityName(entity, this.config.name)
        : this.config.name ?? entity?.attributes?.friendly_name ?? entity?.entity_id;
    const secondaryEntityId = this.config.secondary_entity ?? this.config.entity;
    const secondaryEntity = secondaryEntityId ? this.hass.states[secondaryEntityId.trim()] ?? entity : entity;
    const secondaryName = typeof (this.hass as any).formatEntityName === "function"
        ? (this.hass as any).formatEntityName(secondaryEntity, this.config.secondary_name)
        : this.config.secondary_name ?? secondaryEntity?.attributes?.friendly_name ?? secondaryEntity?.entity_id;
    const secondaryIsText = typeof this.config.secondary === "string";
    // stateObj for state-badge cannot have undefined as will cause errors so we default to ""
    entity.state = this.config.state ?? base?.state ?? "";
    const stateDisplay = this.config.state_display ?? (this.config.state ? entity.state : this.hass.formatEntityState(entity));
    // Only legacy booleans control the icon; strings color the state text.
    const migratedStateColor = this.config.state_color === true ? "state" : this.config.state_color === false ? "none" : undefined;
    // if our stateObj state is "" this is no state so we use "none" for color when stateObj state is "" otherwise icon be colored
    const color = this.config.color ?? migratedStateColor ?? (entity.state !== "" ? "state" : "none");

    const active = this.config.active !== undefined ? this.config.active : undefined;
    if (active) {
      entity.attributes.brightness = 255;
      entity.state = "on";
    } else if (active === false) {
      entity.state = "off";
    }

    // Since Home Assistant 2026.8.0 setting color to a color token or CSS only applies if state is active
    // So if state is not active and color_inactive and color is set, we set `--state-icon-color` to the 
    // color value so that it is applied regardless of state
    const stateIconColorStyle = 
      ( this.config.color_inactive && 
        color 
        && color !== "state" 
        && color !== "none" 
        && !stateActive(entity)
      ) ? `--state-icon-color: ${computeCssColor(color)};` : undefined;

    const condition =
      this.config.condition === undefined ? true :
      String(this.config.condition).toLowerCase() === "true";
    const hidden =
      (this.config.hidden === undefined || this.config.hidden === "") 
        ? !condition 
        : String(this.config.hidden).toLowerCase() === "true";
    const show_toggle = this.config.toggle && this.config.entity;
    const show_button = this.config.button;
    const has_action = this._hasAction();
    const has_icon_action = this._hasAction("icon");
    const has_state_action = this._hasAction("state");

    return html`
      <hui-generic-entity-row class="probe" aria-hidden="true"></hui-generic-entity-row>
      <div id="wrapper" class="${hidden ? "hidden" : ""}">
        <state-badge
          .hass=${this.hass}
          .stateObj=${entity}
          @action=${this._iconActionHandler}
          .overrideIcon=${icon}
          .overrideImage=${image}
          .color=${color}
          style=${stateIconColorStyle !== undefined ? stateIconColorStyle : ""}
          class=${classMap({ pointer: has_icon_action })}
        ></state-badge>
        <div
          class=${classMap({ info: true, pointer: has_action })}
          style=${styleMap({ color: textColor(this.config.primary_color) })}
          @action="${this._infoActionHandler}"
        >
          ${name}
          <div class="secondary" style=${styleMap({ color: textColor(this.config.secondary_color) })}>
            ${secondaryIsText
              ? this.config.secondary
              : this.config.secondary !== undefined
                ? html`<state-display
                  .hass=${this.hass}
                  .stateObj=${secondaryEntity}
                  .name=${secondaryName}
                  .content=${this.config.secondary}
                  .timeFormat=${this.config.time_format}
                  timestamp-tooltip
                ></state-display>`
                : html`` }
          </div>
        </div>
        <div
          @action="${!show_toggle && !show_button ? this._stateActionHandler : undefined}"
          class=${classMap({ state: true, pointer: !show_toggle && !show_button && has_state_action })}
          style=${styleMap({ color: !show_toggle && !show_button ? textColor(this.config.state_color) : undefined })}
        >
          ${show_toggle
            ? html`<ha-entity-toggle .hass=${this.hass} .stateObj=${entity}>
              </ha-entity-toggle>`
            : show_button
            ? html`<ha-button 
                .hass=${this.hass} 
                @click=${() => buttonAction(this.config.button_action, this.config.entity?.trim())}
                appearance="plain"
                size="small"
                .disabled=${entity.state === "unavailable"}
              >
                ${this.config.button === true ? this.hass.localize?.("ui.card.button.press") : this.config.button}
              </ha-button>`
            : stateDisplay
          }
        </div>
      </div>
    `;
  }

  static get styles() {
    return [
      (customElements.get("hui-generic-entity-row") as any)?.styles ?? css``,
      css`
        :host {
          display: inline;
        }
        #wrapper {
          display: flex;
          align-items: center;
          flex-direction: row;
        }
        .state {
          text-align: right;
        }
        .info {
          /* Let a primary + secondary line pair use up to 4px above and below
             without growing the row, so rows keep the same height whether or
             not secondary text is shown (e.g. themes using a taller line-height). */
          margin-block: -4px;
        }
        .secondary {
          color: var(--secondary-text-color);
        }
        .state > ha-button {
          margin-right: -0.57em;
          margin-inline-end: -0.57em;
          margin-inline-start: initial;
        }
        #wrapper {
          min-height: 40px;
        }
        #wrapper.hidden {
          display: none;
        }
        hui-generic-entity-row.probe {
          display: none !important;
        }
      `,
    ];
  }
}

if (!customElements.get("nunjucks-entity-row")) {
  customElements.define("nunjucks-entity-row", NunjucksEntityRow);
  console.groupCollapsed(
    `%c💡 NUNJUCKS-ENTITY-ROW ${pjson.version} IS INSTALLED 💡`,
    'color: white; background-color: #CE3226; padding: 2px 5px; font-weight: bold; border-radius: 5px;',
  );
  console.log('Readme:', 'https://github.com/ov1d1u/lovelace-nunjucks-entity-row');
  console.groupEnd();
}
