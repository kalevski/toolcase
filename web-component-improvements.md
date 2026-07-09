# web-components — Component API Improvement Proposals

Source: full audit of `examples/public/web-components/SKILL.md` (~300 `tc-*` components, 25.6k lines).

The library is remarkably consistent in *rendering* conventions (light DOM, `--tc-*`/`--bs-*` vars, lucide icons, a11y patterns) but the *programmatic API* — attribute names, event names, payload shapes, units, enums — has grown one component at a time and now has 8–15 competing spellings for the same concept. The proposals below are ordered by impact. Items 1–8 are cross-cutting conventions; item 9 lists component consolidations; item 10 lists individual footguns worth fixing regardless of the rest; item 11 sketches migration.

---

## 1. One event grammar: `tc-change` vs `tc-select` vs `tc-action`

**Today.** The same "user picked something" interaction is fired as `tc-change`, `tc-select`, `tc-click`, `tc-activate`, `tc-action`, `tc-action-click`, `tc-item-click`, `tc-step-click`, `tc-issue-click`, `tc-menu-click`, `tc-menu-item-click`, `tc-menu-select`, `tc-exec`, `tc-choice`, `tc-claim`, `tc-page-change`… with no rule for which applies. `tc-list` fires `tc-select` while its sibling `tc-single-card-select` fires `tc-change` for the identical single-selection gesture.

**Proposal.** Three verbs, defined by role:

| Event | Meaning | Fired by |
|---|---|---|
| `tc-change` | The control's **value** changed (form semantics) | every form control, tabs, pagination, carousels |
| `tc-select` | An **item in a collection** was activated (navigation/list semantics) | lists, menus, trees, grids, chart segments |
| `tc-action` | A named **command button** inside a composite was pressed | card actions, header actions, danger zones, dialogs |

Fold the long tail into these: `tc-exec`/`tc-action-click`/`tc-menu-click`/`tc-issue-click`/`tc-step-click` → `tc-select` or `tc-action`; `tc-page-change` → `tc-change`. Domain events that are genuinely distinct (`tc-copy`, `tc-submit`, `tc-remove`, `tc-close`, `tc-complete`) stay, but each gets exactly one meaning library-wide (`tc-complete` currently means both "wizard finished" and "all OTP cells filled").

## 2. One payload contract per event

**Today.** `tc-change` carries the new value under **five different keys** (`value`, `checked`, `on`, `key`, `id`) plus composite shapes (`{value,hasError}`, `{key:'main'|'ads',value}`, `{tags}`, `{selectedIds}`, `{manager}`). `tc-select` identifies the picked item as `detail.id`, `.key`, `.value`, `.item`, `.index`, `.label` (tc-menu-item is keyed by *display label* — unusable with duplicates), or `{}` (tc-list-row, tc-game-showcase-card — the consumer must sniff the DOM). Sibling charts disagree: `tc-point-hover` includes `index` in tc-area-chart but not tc-line-chart; `tc-bar-click` is `{item,index}` in tc-bar-chart but `{bar,index}` in tc-benchmark-chart.

**Proposal.** Fixed shapes, enforced by shared TypeScript types:

```ts
// tc-change — always. Boolean controls put the boolean in value.
detail: { value: T }                       // T = string | number | boolean | string[] | [number, number] | …

// tc-select — always. item is the full descriptor, id its identity, index its position.
detail: { id: string, item: TItem, index: number }

// tc-action — always.
detail: { action: string, id?: string }    // id = owning row/entity where applicable
```

Extra fields may be *added* (`{ value, hasError }`) but the canonical key must always be present. Kill `{ checked }`, `{ on }`, `{ key }`, `{ label }`, `{}` payloads. Document `bubbles: true, composed: true` once, globally, instead of per-component (today some components state it, some don't, so shadow-boundary behavior is unknowable from the docs).

## 3. One vocabulary for state, selection, and identity

**Today — nine names for "which one is chosen":** `value`, `checked`, `on`, `selected`, `active`, `selected-id`, `active-id`, `active-key`, `active-step`, plus `current-id`, `current-tier-id`, `current-index`, `active-channel`, `initial-section`. Item descriptors identify themselves as `id`, `key`, or `value` depending on family, and label themselves as `label`, `title`, or `text` — so a data array cannot be reused across two components (tc-card-options options are `{key,label}`, tc-single-card-select `{key,title}`, tc-multi-card-select `{value,label}` — three shapes for three siblings).

**Proposal.**

- **Form controls:** `value` (the submitted value) + `checked` (boolean controls). Delete `on` (tc-toggle is the sole user).
- **Collections:** `selected-id` attribute on the container (reflected, JS `selectedId`); per-item `selected` boolean only for slotted light-DOM children (tc-list-row, tc-menu-item, tc-option). Retire `active-id`/`active-key`/`current-*`/`active-step` → `selected-id`.
- **Item descriptor:** one canonical shape across every data-driven component:

```ts
interface TcItem { id: string; label: string; icon?: string; description?: string; disabled?: boolean; … }
```

  `id` for identity (never `key`, never `value`), `label` for display (never `title`, never `text`). Component-specific fields extend this base.
- **Collection property:** name it `items` everywhere. `options`, `entries`, `events`, `quests`, `tabs`, `sections`, `versions`, `icons`, `colors`, `players`, `members`, `perks`, `slots`, `steps`, `characters`, `recipes`… are ~30 names for the same prop; keep the old names as deprecated aliases for one major. (`slots` is the worst — it shadows the Web Components slot concept on elements that have no real slots.) Domain-specific *secondary* collections (`edges`, `columns`) may keep their names.

## 4. Fix the text-attribute chaos and native collisions

**Today.** "The primary text of this thing" is spelled `title`, `title-text`, `dialog-title`, `screen-title`, `menu-title`, `popup-title`, `list-title`, `tracker-title`, `scroll-title`, `card-title`, `season-name`, `heading`, `header`, `row-label`, `label`, `name`, `text`, `text-a`, `primary-text`… (15+ spellings). Worse, `title` collides with the native `HTMLElement.title` tooltip: ~40 components use bare `title` (unexpected browser tooltips, no JS accessor possible), while five components already renamed to avoid exactly this (`title-text`, `dialog-title`, `screen-title`) — the library knows about the problem and applies the fix inconsistently. In tc-metric-card the `title` *property* IS the native tooltip while the *attribute* is the heading — two meanings on one component. `name` is similarly overloaded: form field name (all inputs) vs display name (tc-avatar, tc-maintainer-card, tc-build).

**Proposal.**

- `heading` — the primary text of any container/panel/dialog/screen (replaces every `*-title` variant and bare `title` on non-form components). It has no native collision and reads naturally.
- `subheading` — the secondary line (replaces `subtitle`, `sub`, `summary`, `description`-as-subtitle, `hint`-as-subtitle).
- `label` — the visible label of a *control* or *small item* (replaces `row-label`, `text` on list items).
- `eyebrow` — keep, but expose it consistently (several screens hardcode the eyebrow with no attribute).
- `name` — reserved for form-field name only; display names become `label` (`tc-avatar label`, `tc-guild-panel` already does `guild-name` — normalize).
- Keep `title` working as a deprecated alias where it exists today, but stop documenting it as primary.

## 5. One value scale per axis: size, variant, color, status

**Today.**

- **size:** `sm|lg`, `sm|md`, `sm|md|lg`, `xs|sm|lg`, `small|default|large`, `xl|lg|md|sm`, raw pixel numbers, and breakpoint scales — at least six vocabularies, sometimes with the *same word meaning different px* (`large` = 56px on tc-avatar, 44px on tc-icon-button). `size` also means an enum on some components and a pixel number on others.
- **variant:** the intent axis is called `variant`, `tone`, `kind`, `theme`, or `color`; the enum drops members per component; tc-banner and tc-helper-text say `error` where everything else says `danger`; and `variant` is separately overloaded for non-color axes (`tabs|pills|underline`, `segmented|dropdown`, `ghost|filled`).
- **color tokens:** `green` vs `emerald`, `red` vs `rose`, `slate` vs `gray`, `purple` vs `violet` — a value valid on one component is invalid on its neighbor.
- **status:** "finished" is `complete`, `completed`, `done`, `shipped`, `pass`, or `past`; "not yet" is `upcoming`, `pending`, `planned`, or `future`; `warn` vs `warning`; trend `neutral` vs `flat` (tc-leaderboard-trend exists *only* because the base trend-indicator lacked `flat`).

**Proposal.** Publish four token enums in one shared module and make every component consume them:

```ts
type TcSize    = 'xs' | 'sm' | 'md' | 'lg' | 'xl'          // 'md' is the default; delete small/default/large
type TcVariant = 'primary' | 'secondary' | 'success' | 'danger' | 'warning' | 'info' | 'light' | 'dark'
type TcColor   = 'slate' | 'blue' | 'cyan' | 'green' | 'yellow' | 'orange' | 'red' | 'pink' | 'purple'
type TcStatus  = 'pending' | 'active' | 'complete' | 'failed'   // trend: 'up' | 'down' | 'flat'
```

Rules: `variant` = semantic intent only (a second axis gets its own attribute: `appearance="ghost|filled|outline"`, `shape`, `mode`); `color` = literal palette token or CSS color; pixel sizing gets its own numeric attribute (`size-px`, or keep `size` numeric only on icon-like leaves and document it). Components may *subset* an enum but never rename members.

## 6. One overlay model

**Today.** Visibility is controlled five different ways: `open` attr + `show()/hide()/toggle()` + `tc-show/tc-shown/tc-hide/tc-hidden` lifecycle (tc-modal, tc-offcanvas, tc-toast, tc-dropdown); methods only, no attribute (tc-popover, tc-tooltip); controlled `open` attribute only, host never self-closes (tc-drawer, tc-confirm-dialog, tc-command-palette, tc-lightbox, tc-invite-toast, tc-report-dialog, tc-loot-popup, tc-pause-menu); a `show` *attribute* (tc-letterbox-bars, tc-transition-wipe — colliding with the `show()` method name used elsewhere); or mount/unmount/`[hidden]` (tc-blur-overlay, tc-loading-screen). tc-radial-wheel claims the controlled pattern but self-closes anyway. Dismissal is signalled as `tc-close`, `tc-closed`, `tc-cancel`, `tc-decline`, or `tc-dismiss`. Placement is `placement="start|end|top|bottom"` (offcanvas) vs `side="left|right|top|bottom"` (drawer) vs `placement="top|right|bottom|left"` (tooltip).

**Proposal.** One contract for every overlay:

- Reflected `open` attribute is the single source of truth; `show()`, `hide()`, `toggle()` are sugar that mutate it.
- Self-closing by default via a **cancelable** `tc-close` event (`detail: { reason: 'backdrop' | 'escape' | 'close-button' | 'confirm' | 'cancel' | 'timeout' }`); `event.preventDefault()` opts into controlled behavior. This collapses the two mental models into one — uncontrolled works out of the box, controlled remains possible.
- Lifecycle events `tc-show/tc-shown/tc-hide/tc-hidden` on all of them (they exist on half today).
- One placement attribute: `placement` with logical values (`start|end|top|bottom`); drop `side`.
- Rename the `show` boolean attribute on tc-letterbox-bars/tc-transition-wipe (→ `open` or `active`).
- Semantic result events (`tc-confirm`, `tc-cancel`, `tc-accept`, `tc-decline`, `tc-submit`) stay, layered on top of `tc-close`.

## 7. One form-control contract (and actually enforce the documented one)

The Forms preamble already promises a unified contract ("every input is form-associated, fires `tc-change` with `{value}`") — the components just don't follow it.

- **Form association is three-way split:** ElementInternals, hidden `<input>`, or nothing at all. tc-number-input, tc-time-picker, tc-tag-input, tc-editable-text, tc-date-picker, tc-color-picker, tc-icon-picker, tc-slider, tc-range, tc-combo-box document no `name` — a numeric or date field can't post in a native form while an OTP field can. Standardize on **ElementInternals** for every control; every control gets `name`, `value`, `disabled`, `required`.
- **Validation is modelled two ways:** `state="valid|invalid"` + `help` (tc-input family) vs a single `error` string (tc-number-input family), plus `{value,hasError}` on tc-form-input. Pick one: **`error` (message string, presence = invalid) + `help` (neutral hint)**; drop `state`. It's the simpler and more common of the two and matches `aria-invalid`/`aria-errormessage` cleanly.
- **tc-input documents no events at all** — the flagship text control is a stub next to tc-number-input's full spec. Every control documents `tc-change` (committed value) and, for text-entry controls, `tc-input` (per-keystroke) — today live-typing is `tc-change`-per-step, a bespoke `tc-name` event, or nothing.
- **Disabled means disabled:** tc-extended-select and tc-single-card-select gate interaction through `loading` instead of `disabled`; several inputs list no `disabled` at all.
- **Retire the parallel form system.** tc-form-input re-implements 18 input types with its own validation pipeline (`validate`, `onErrorMessage`, `onChange(value,hasError)`) alongside the native controls. Fold its validator hooks into the standard controls (`validate` callback prop on each) and deprecate tc-form-input.
- **The setting-row family joins the contract.** tc-toggle-row, tc-select-row, tc-setting-slider, etc. use `row-label`, no `name`, and don't form-participate — make them thin styled wrappers over the standard controls (`label` + full contract).

## 8. Mechanical conventions

- **Boolean attributes are presence-based, period.** Replace default-true string toggles (`show-grid="false"`, `show-legend="false"`, `toolbar="false"`, `searchable="false"`, `show-copy-button="false"`, `show-summary="false"`) with inverted presence booleans: `hide-grid`, `hide-legend`, `no-toolbar`, `no-search`, `no-copy`, `no-summary`. Mixing "presence = true" with "string false" in one library is a reliable footgun (and breaks framework boolean binding).
- **Callback props are camelCase or gone.** `onchangetab`, `onrowclick`, `onclose`, `onremove`, `onstepclick`, `onexpire`, `ondone`, `onconnect`, `onchangetags`, `onactionclick` (lowercase) coexist with `onChange`, `onClose`, `onRemove`, `onComplete` (camel) — tc-drawer has `onClose` while tc-lightbox has `onclose`. Recommendation: **drop callback props entirely** (events are the API; React 19 binds custom events fine) or normalize all to camelCase with the lowercase kept as deprecated aliases.
- **Units are explicit.** Durations: milliseconds everywhere, or suffix the attribute (`timeout-seconds` already does this; tc-toast `delay` is bare ms). Progress: `value`/`max` pairs everywhere (default max 100); kill the 0–1 fractions (tc-loading-overlay, tc-loading-screen, tc-combo-counter `timer`, tc-interact-prompt `hold-progress`) or rename to `fraction`. `cooldown` currently means remaining-number, total-number, or a preformatted string in three different components — standardize on `cooldown` (total) + `remaining`.
- **Icon names: accept both casings everywhere.** Today PascalCase-only, kebab-only, and both-accepted components coexist; the wrong casing silently renders nothing. Normalize internally (`kebab → Pascal`) in one shared resolver, and warn on unknown names in dev. Also: one attribute name (`icon`, not `icon-name`/`glyph`), and remove the documented no-op `set` attribute on tc-icon.
- **Bare-number → px coercion:** one documented global rule ("length attributes accept a bare number = px or any CSS length"), applied by a shared parser, instead of the current per-component lottery. Fix tc-currency-display (`font-size` documented as px-number but defaulting to `1.75rem`).
- **Empty detail notation:** document no-payload events as `{}` uniformly (today `{}`, `—`, and `undefined` all appear).

## 9. Consolidate duplicated components

Each row is one widget shipped 2–6 times with divergent APIs. Consolidation = one base component + preset attributes/aliases (the library already uses this pattern well: tc-volume-slider, tc-health-bar, tc-game-over-screen are documented aliases).

| Keep | Fold in / alias | Notes |
|---|---|---|
| `tc-switch` | `tc-toggle`, `tc-fullscreen-toggle`, `tc-toggle-row` (as `row` appearance) | `checked` + `tc-change {value:boolean}`; delete `on` |
| `tc-slider` | `tc-range`, `tc-setting-slider` (as `row` appearance + `unit`/`with-mute`) | tc-range-slider stays (dual-handle) but adopts the same detail shape |
| `tc-card-select` (new) | `tc-card-options`, `tc-single-card-select`, `tc-multi-card-select`, `tc-toggle-card` | `multiple` attribute; one option shape `{id,label,description,icon}`; today three option shapes and a `value`-attr/`{key}`-event mismatch inside tc-card-options itself |
| `tc-select-row` | `tc-fps-cap-select` | identical; fps version is just seeded presets |
| `tc-tabs` (new) | `tc-tab-bar`, `tc-tab-sections`, `tc-vertical-item-list` | today: `tabs` vs `items`, `id` vs `key`, `active-id` vs `active-key`, `onChange` vs `onchangetab` |
| `tc-stat-card` | `tc-metric-tile`, `tc-metric-card` | one contract: `label`, `value`, `unit`, `icon`, `hint`, `delta`, optional `sparkline`; today caption = `label`/`label`/`title` and secondary = `hint`/`helper`/`subtitle` |
| `tc-marker` (new) | `tc-objective-marker`, `tc-waypoint-marker` | two-attribute delta (`icon`, `pulse`) — one component |
| `tc-node-graph` (new) | `tc-level-select`, `tc-skill-tree` | same widget; unify `completed`/`unlocked` → `complete`, `tc-confirm`/`tc-unlock` → one confirm event |
| `tc-lobby` | `tc-party-panel` | `players` vs `members`, `rank` vs `role`; one roster component with feature flags |
| `tc-chip` | `tc-tag` (already an alias) | align events (`tc-click`+`tc-remove` on both) and callback casing |
| `tc-trend-indicator` | `tc-leaderboard-trend` | exists only for the `flat` synonym; add `flat` to the base |
| `tc-list` | `tc-list-row` selection semantics | container-driven `selected-id`/`tc-select {id,item,index}`; slotted rows fire the same detail (today `{}`) |
| `tc-menu` (new) | `tc-main-menu`, `tc-pause-menu`, `tc-menu-item` | `MainMenuItem` ≡ `PauseMenuItem` (identical type, two names); tc-menu-item selects by `label` and supports `icon`/`hotkey` the containers don't |
| `tc-item-slot` family | `tc-hotbar`, `tc-inventory-grid`, `tc-equipment-doll` — keep all three, align APIs | `slots` vs `items` prop; `{item,index}` vs `{id}` select detail; unify per §2–3 |
| `tc-table` | `tc-advanced-table` | see §10 — advanced-table's `rows` as trusted HTML string must go regardless |
| `tc-skeleton` | `tc-placeholder` | overlapping loading-surface primitives |
| step-guides | `tc-quick-start`, `tc-migration-guide`, `tc-welcome-guide` share one `steps` item base shape | keep as separate components, shared `TcStep` type |

Also merge the near-identical file rows (`tc-file`, `tc-queued-file`, `tc-simple-file` — including the `size=0` renders-nothing vs renders-`—` divergence) behind one base, and align the network readouts (`tc-network-status-icon` vs `tc-ping-display` tier names `good/ok/warning/bad` vs `success/warning/danger`).

## 10. Individual footguns to fix regardless

1. **`tc-advanced-table.rows` is a trusted HTML string** while `tc-table.data` is an object array — an XSS injection footgun and a completely different data contract for the same widget. Move to `rows: object[]` + `renderCell`, or at minimum sanitize and mark the risk.
2. **`tc-cooldown-badge` inverts progress** (arc = `max − value`, `max` default **1**) while `tc-circular-progress` is direct (`max` default **100**) — two ring widgets with opposite semantics and different default scales.
3. **`tc-card-options`:** selection attribute is `value` but the change event returns `{ key }` — the attribute and the event disagree within a single component.
4. **`tc-pagination` vs `tc-advanced-table`:** same `tc-page-change` event, but `current` is 1-based page vs `offset` 0-based row, and `total` means page-count vs row-count.
5. **`tc-radial-wheel` self-closes** while documenting the controlled-overlay contract its siblings follow.
6. **`tc-menu-item` fires `tc-select {label}`** — selection keyed by display text breaks with duplicate labels and i18n.
7. **`tc-icon` documents a dead `set` attribute** ("accepted but has no effect") — remove it.
8. **`tc-time-picker` stores 24h even in `format="12h"`** — displayed value ≠ `value`; document loudly or normalize.
9. **`tc-code-with-output` example embeds a literal `\n` in an HTML attribute** — the documented example doesn't produce a newline; fix the doc (use the property or a slot).
10. **`tc-platform-icon` uses `label` as a *boolean*** while `label` is a string in ~20 other components — rename to `show-label` (which tc-network-status-icon already uses).
11. **`columns` means grid-count (number), column-config (object), or column-data (array)** depending on component — `el.columns = 3` breaks on two of them. Rename the non-numeric ones (`column-config`, `columnDefs`).
12. **tc-group `tc-toggle {collapsed}` vs tc-faq-list `tc-toggle {index, open}`** — same event, inverted boolean semantics.
13. **`tc-difference-card previous-value="0"`** silently renders `—` instead of computing a delta from zero.
14. **Setting a JS property fires events on some components** (tc-group `collapsed` setter dispatches `tc-toggle`) — programmatic mutation should never fire change events (matches native input behavior); make this a library-wide rule.

## 11. Migration strategy

All of this is breaking, so target it at a **v5 major** with a compatibility layer:

1. **Ship the conventions first** — a short `CONVENTIONS.md` (event grammar, payload shapes, token enums, item shape, overlay contract, form contract) that new components must pass review against. This stops the divergence from growing even before any renames.
2. **Shared primitives module** (`web-components/src/core/`): `TcItem`, `TcSize`/`TcVariant`/`TcColor`/`TcStatus` types, `dispatchTc(el, name, detail)` helper enforcing payload shapes, length/duration parsers, the icon-name resolver, and a `FormControlElement` base class (ElementInternals wiring, `name/value/disabled/required/error/help`).
3. **Deprecated aliases, not hard breaks:** old attribute names keep working for one major (`observedAttributes` maps `row-label → label`, `on → checked`, `active-key → selected-id`…) with a one-time `console.warn` in dev builds. Old event names dual-fire alongside the new ones.
4. **Codemod + lint:** a small regex codemod for markup (attribute renames are mechanical) and an ESLint rule for the retired event names in listeners.
5. **Regenerate SKILL.md from source.** At 25k hand-maintained lines the reference already drifts (tc-input's missing Events section, the contract list naming controls that don't implement it). Emitting the per-component tables from a custom-elements manifest (`custom-elements.json` via CEM analyzer) makes the doc and the code impossible to desynchronize, and gives editor tooling for free.
