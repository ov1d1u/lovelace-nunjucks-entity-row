## [4.1.0](https://github.com/ov1d1u/lovelace-nunjucks-entity-row/compare/v4.0.0...v4.1.0) (2026-10-11)


### ⭐ New Features

* add primary and secondary text colors ([191eea7](https://github.com/ov1d1u/lovelace-nunjucks-entity-row/commit/191eea7640bee2a76cffd9b009e93ac92199dae5))

## [4.0.0](https://github.com/ov1d1u/lovelace-nunjucks-entity-row/releases/tag/v4.0.0) (2026-10-11)

## Breaking changes

This release renames the project to **lovelace-nunjucks-entity-row** and replaces Home Assistant server-side template rendering with frontend rendering through ha-nunjucks.

### Migration

- Replace the dashboard resource with `nunjucks-entity-row.js` and change row types from `custom:template-entity-row` to `custom:nunjucks-entity-row`. The old custom element is no longer registered.
- Use standard Nunjucks delimiters: `{{ expression }}`, `{% block %}`, and `{# comment #}`. `nested_templates: true` and alternate bracket delimiters are no longer supported.
- Templates receive the original `config`, `hass`, and native ha-nunjucks functions and filters. The `user`, `browser`, and `hash` shortcuts have been removed; use `hass.user.name` for the current user.
- Replace `_(translation.key)` text with `{{ hass.localize('translation.key') }}`.
- Whole-field templates producing action objects, flexible names, secondary lists, or time formats must return valid JSON. Python dictionary/list representations are not accepted. Templates can also be written inside YAML objects and lists.
- Backend-only Jinja features and server data are unavailable. See the [migration documentation](https://github.com/ov1d1u/lovelace-nunjucks-entity-row#templates-and-migration).

## Improvements

- Recursively render nested configuration values without mutating the source configuration.
- Refresh templates on Home Assistant updates and every 60 seconds while connected.
- Retain the last valid option value after a template error and retry on subsequent updates.
- Clean up refresh timers on disconnect and restore them on reconnect.
- Add frontend browser tests and CI coverage for rendering, actions, visibility, error recovery, and lifecycle behavior.

## Validation

Clean dependency installation, production build, and all five frontend browser tests passed. Home Assistant visual tests could not run because Docker was unavailable. Type checking reports existing missing `color-name` and `parse-duration` dependencies in unchanged helpers.

## Installation

Download `nunjucks-entity-row.js` from this release and register it as a JavaScript module resource, or install this repository through HACS.

### [3.0.2](https://github.com/Lint-Free-Technology/lovelace-template-entity-row/compare/v3.0.1...v3.0.2) (2026-10-06)


### ⚙️ Miscellaneous

* Migrate release workflow from semantic-release to dedicated GitHub actions ([e115fc5](https://github.com/Lint-Free-Technology/lovelace-template-entity-row/commit/e115fc59b3a2654f4f4fc0534c2cc0cb90ba4d19))

## [3.0.1](https://github.com/lint-free-technology/lovelace-template-entity-row/compare/v3.0.0...v3.0.1) (2026-10-01)

### 📦 Dependency Upgrades

* Update dependencies - js-yaml, rollup, babel, semantic-release ([1d87e10](https://github.com/lint-free-technology/lovelace-template-entity-row/commit/1d87e1072ae31779583e70e5f0a668dd757793b2))

## [3.0.0](https://github.com/lint-free-technology/lovelace-template-entity-row/compare/v2.2.1...v3.0.0) (2026-08-05)

### ⚠ BREAKING CHANGES

* Home Assistant 2026.8.0 or greater required.

### ⭐ New Features

* Add `color_inactive` config to allow for `color` to be set when `state` is inactive. Allows for compatability for coloring icon when inactive after Home Assistant 2026.8.0 ([b28f4c0](https://github.com/lint-free-technology/lovelace-template-entity-row/commit/b28f4c031c772d818dd17b0acb713695fa1a125b))
* Add `hidden` config which deprecates the poorly named `condition`. `condition` continues to work. Update to `hidden` when convenient. NOTE: `hidden` is opposite logic to `condition`. ([#55](https://github.com/lint-free-technology/lovelace-template-entity-row/issues/55)) ([e3224d0](https://github.com/lint-free-technology/lovelace-template-entity-row/commit/e3224d0d70fdacaee567e946ed63d8c26c270578))
* Allow action overrides for icon and state areas. Allow action entity override for secondary, icon and state areas. ([#49](https://github.com/lint-free-technology/lovelace-template-entity-row/issues/49)) ([d88b2a1](https://github.com/lint-free-technology/lovelace-template-entity-row/commit/d88b2a13c33de7e752e741574e8d9129baa8aefd))
* Support `secondary` info items from main `entity` or `secondary_entity` with flexible `secondary_name`. ([#54](https://github.com/lint-free-technology/lovelace-template-entity-row/issues/54)) ([dd3a547](https://github.com/lint-free-technology/lovelace-template-entity-row/commit/dd3a54741ae7232886eb4498017bfe639fa9d167)), closes [#50](https://github.com/lint-free-technology/lovelace-template-entity-row/issues/50)
* Support Home Assistant flexible naming for `name`. ([#53](https://github.com/lint-free-technology/lovelace-template-entity-row/issues/53)) ([daebfa3](https://github.com/lint-free-technology/lovelace-template-entity-row/commit/daebfa3fa9989f098943034e0b77dd7dc2dc21b5)), references [#52](https://github.com/lint-free-technology/lovelace-template-entity-row/issues/52)

### 🐞 Bug Fixes

* Correctly set `color` default to `state` when neither `state_color` or `color` is set. ([940df01](https://github.com/lint-free-technology/lovelace-template-entity-row/commit/940df01c313a4038dca6f9e0286774cc995b152f))

### 📦 Dependency Upgrades

* Update to Typescript v7, use esbuild ([8579065](https://github.com/lint-free-technology/lovelace-template-entity-row/commit/8579065546ff9f2653ba2185c7fd583571f97b68))

### ⚙️ Miscellaneous

* Allow all new config options to accept templates - `icon_*_action`, `state_*_action`, `action_entity`, `secondary_action_entity`. ([c91ba0c](https://github.com/lint-free-technology/lovelace-template-entity-row/commit/c91ba0c8d860a35b64ceb80d69fe4f21c8c7fb01))
* Allow all new config options to accept templates - `icon_action_entity`, `state_action_entity`, `color_inactive`. ([957cef1](https://github.com/lint-free-technology/lovelace-template-entity-row/commit/957cef1ef8afe2caa1a6f061d4041b9dfc6c1379))
* Migrate `state_color` to `color` for generic row config. `state_color: true` is migrated to `color: state`. `state_color: false` is migrated to `color: none`. Default is `color: state`. These changes reflect changes in Home Assistant 2026.8.0. ([5320320](https://github.com/lint-free-technology/lovelace-template-entity-row/commit/5320320799d6dbb1bec2f1979e91732de7bedefb))
* Set minimum HA Version to 2026.8.0.dev0 so HACS will allow against dev builds and greater. ([5e7dfca](https://github.com/lint-free-technology/lovelace-template-entity-row/commit/5e7dfca4640fb2ca341d343239bd3bbb1836e97d))

## [2.2.1](https://github.com/lint-free-technology/lovelace-template-entity-row/compare/v2.2.0...v2.2.1) (2026-05-18)

### ⚙️ Miscellaneous

* Update tests and doc images/animations to use ha-testcontainer visual test harness. ([#38](https://github.com/lint-free-technology/lovelace-template-entity-row/issues/38)) ([6c22868](https://github.com/lint-free-technology/lovelace-template-entity-row/commit/6c2286831028b16231356241637bb53633856abe))

## [2.2.0](https://github.com/lint-free-technology/lovelace-template-entity-row/compare/v2.1.1...v2.2.0) (2026-04-21)

### ⭐ New Features

* boolean nested_templates option for nested Jinja2 bracket syntax ([#32](https://github.com/lint-free-technology/lovelace-template-entity-row/issues/32)) ([63eac5b](https://github.com/lint-free-technology/lovelace-template-entity-row/commit/63eac5b74ed2d487a9d7340fc72f6550a741b6e1))

### 🐞 Bug Fixes

* Use`state_display` when needing to display template which may not be a valid raw `state`. ([d2a59d6](https://github.com/lint-free-technology/lovelace-template-entity-row/commit/d2a59d62945eac2fa27058663b6df1c307fad51b)), closes [#34](https://github.com/lint-free-technology/lovelace-template-entity-row/issues/34)

## [2.1.1](https://github.com/lint-free-technology/lovelace-template-entity-row/compare/v2.1.0...v2.1.1) (2026-02-12)

### ⚙️ Miscellaneous

* Hide chores for release notes ([1b6c048](https://github.com/lint-free-technology/lovelace-template-entity-row/commit/1b6c04859be946da21ad04cbc4fe0131c176b7f3))
* Update console branding to distinguish fork. ([28d017e](https://github.com/lint-free-technology/lovelace-template-entity-row/commit/28d017ec203027283aee20d5cc88ed63596d2b43))
* Update LFT console branding color to LFT red ([a14cf56](https://github.com/lint-free-technology/lovelace-template-entity-row/commit/a14cf56c03ebd187c07eb953ec8a11298d9c6972))

## [2.1.0](https://github.com/lint-free-technology/lovelace-template-entity-row/compare/v2.0.0...v2.1.0) (2026-02-10)

### ⭐ New Features

* Add button option for state display. ([e02ed75](https://github.com/lint-free-technology/lovelace-template-entity-row/commit/e02ed759466c1af0570eea97506a9dbce6ef7915))
* Allow default button config with `button: true`. ([337963c](https://github.com/lint-free-technology/lovelace-template-entity-row/commit/337963cf4c2b926d1cb74fd6722db42c97b51165))

### 🐞 Bug Fixes

* Localize state display when not overridden in config ([db87ea2](https://github.com/lint-free-technology/lovelace-template-entity-row/commit/db87ea2ff4b63e0b23b1b75d1ec9e266ca58c010))

### 📔 Documentation

* Update localization key example in README ([b79ed3b](https://github.com/lint-free-technology/lovelace-template-entity-row/commit/b79ed3bbcba041ab21a2cc79e07aef95c19b6ec0))

### ⚙️ Miscellaneous

* **ci:** Update release to manual only ([ddf40c9](https://github.com/lint-free-technology/lovelace-template-entity-row/commit/ddf40c9447bab9d8a77fd66c754b3b6227a7baa9))
* **docs:** Update CHANGELOG with recent fixes and updates ([0c4f12b](https://github.com/lint-free-technology/lovelace-template-entity-row/commit/0c4f12bc2c51dffec81855f21d4fabaa1749e22e))

## [2.0.0](https://github.com/lint-free-technology/lovelace-template-entity-row/compare/v1.4.1...v2.0.0) (2026-02-08)

### 🐞 Bug Fixes

- Update readme for state_color
- Trim entity template to be valid when contains newline.
- Force state_color: false when no valid entity state.
- Fix state display being overridden by active
- Fix active and allow state_color
- Fix double-tap and only show action pointer when an action is set
- Fix condition on first load by
- Fix conditional row gaps since 2025.11
