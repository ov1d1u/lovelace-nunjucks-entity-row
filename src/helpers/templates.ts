import { renderTemplate } from "ha-nunjucks";

const OPTIONS = new Set([
  "icon", "active", "name", "secondary", "secondary_name", "state",
  "state_display", "condition", "hidden", "image", "entity", "color", "toggle",
  "button", "tap_action", "hold_action", "double_tap_action", "button_action",
  "icon_tap_action", "icon_hold_action", "icon_double_tap_action",
  "state_tap_action", "state_hold_action", "state_double_tap_action",
  "action_entity", "secondary_entity", "secondary_action_entity",
  "icon_action_entity", "state_action_entity", "color_inactive", "time_format",
  "primary_color", "secondary_color",
]);
const STRUCTURED = new Set(["name", "secondary_name", "secondary", "time_format"]);
const isTemplate = (value: unknown): value is string =>
  typeof value === "string" && /{{|{%|{#/.test(value);

function containsTemplate(value: unknown): boolean {
  if (isTemplate(value)) return true;
  return value !== null && typeof value === "object" &&
    Object.values(value).some(containsTemplate);
}

export function hasConfigurationTemplates(config: Record<string, unknown>): boolean {
  return Object.entries(config).some(([key, value]) => OPTIONS.has(key) && containsTemplate(value));
}

function renderValue(hass: any, value: any, config: object): any {
  if (isTemplate(value)) return renderTemplate(hass, value, { config }, false);
  if (Array.isArray(value)) return value.map((item) => renderValue(hass, item, config));
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, item]) =>
      [key, renderValue(hass, item, config)]));
  }
  return value;
}

function parseStructured(key: string, value: any): any {
  const action = key.endsWith("_action");
  if (!action && !STRUCTURED.has(key)) return value;
  if (typeof value === "string" && (action || /^[\[{]/.test(value.trim()))) {
    value = JSON.parse(value);
  }
  if (action && (!value || typeof value !== "object" || Array.isArray(value))) {
    throw new Error("Expected a JSON action object");
  }
  if (key === "secondary" && value !== null && typeof value === "object" && !Array.isArray(value)) {
    throw new Error("Expected a secondary list or text");
  }
  return value;
}

/** Rebuild from source, retaining only valid results from the same configuration. */
export function renderConfiguration(
  hass: any,
  source: Record<string, any>,
  previous: Record<string, any> = {},
  report: (key: string, error: unknown) => void = (key, error) =>
    console.error(`nunjucks-entity-row: failed to render ${key}`, error),
): Record<string, any> {
  const result: Record<string, any> = {};
  for (const [key, value] of Object.entries(source)) {
    try {
      const rendered = OPTIONS.has(key) ? renderValue(hass, value, source) : structuredClone(value);
      result[key] = OPTIONS.has(key) && isTemplate(value)
        ? parseStructured(key, rendered) : rendered;
    } catch (error) {
      report(key, error);
      if (previous && Object.hasOwn(previous, key)) result[key] = previous[key];
    }
  }
  return result;
}
