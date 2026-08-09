# Changelog — @toolcase/web-components

Entries start at `5.0.19`. Earlier versions are not covered here.

## Unreleased

Fixes found while consuming `5.0.19` from the app, plus the desktop pass below.
The `desktop` attribute is additive but new API surface, so this is now a
**minor** (5.1.0) rather than the patch the fixes alone would have been.

### Added — desktop layout for the mobile set

The 5.0.19 mobile components grown desktop-friendly, keeping the phone output
byte-identical: every new rule sits inside `up(lg)` (992px) blocks, and the
structural ones are additionally scoped to a new opt-in.

- **`tc-mobile-shell` gained a boolean `desktop` attribute.** Absent, nothing
  anywhere changes — the published centred-480px wide-viewport default stays.
  Present, from `lg` up: the frame widens to
  `--bs-mobile-shell-max-width-desktop` (1280px, still centred and
  hairline-framed); a slotted dock's strip is reserved as `padding-left`
  (`:has(> [slot='dock'])`, so dockless screens get the full width back). The
  rail width is one shell-owned token (`--bs-mobile-shell-rail-width`, 88px)
  that both the shell's reservation and the dock's rail box read, so the two
  cannot drift. Deliberately padding + an absolutely positioned rail rather
  than a grid: the header region is one or MORE children (bar + band is the
  shipped pattern), and grid auto-placement cannot span "however many header
  children exist". The flex column the phone uses survives untouched, which is
  also what keeps the pane-resolution JS and every consumer selector true.
- **`tc-tab-dock` inside `tc-mobile-shell[desktop]` renders as a left nav
  rail**: same items, icon-over-label, badges and events, rotated into a
  full-height `auto/min-content` grid with a trailing hairline instead of the
  bottom bar's top rule + lift shadow. Fine-pointer hover tint
  (`--bs-tab-dock-rail-hover-bg`) and an optional active plate
  (`--bs-tab-dock-rail-active-bg`, transparent by default). `[data-hidden]`
  (auto-hide) is neutralised in rail mode — hiding primary navigation that
  covers nothing is a usability bug, and the JS cannot see layout. Keyboard:
  the tablist now answers ArrowUp/ArrowDown alongside Left/Right,
  unconditionally — costs nothing horizontally, required vertically.
- **`tc-bottom-sheet` inside a `[desktop]` shell's overlay renders as a
  centred dialog**: all-corner radius (`--bs-bottom-sheet-desktop-radius`),
  downward shadow, `min(--bs-bottom-sheet-desktop-width, 100% − 96px)` wide
  (560px default), content height capped at `100% − 96px` — snap ratios are a
  thumb-reach contract and are ignored here. Entrance is a 24px settle + fade
  instead of the full-height slide. **Drag-to-dismiss is off in this mode**
  (`_dialogMode()` in `src/BottomSheet.ts` mirrors the CSS scope): a mouse
  selecting body text is indistinguishable from a drag, and the handle —
  now a lie — is hidden with it. Scrim tap, Escape and the sheet's own
  actions remain. When a rail is present the dialog centres in the CONTENT
  column, not the frame.
- **`tc-action-bar`** in a `[desktop]` shell centres its tracks into a
  640px column (`--bs-action-bar-desktop-max`; `100%` disables) via a
  `max()` on its own inline padding — surface, rule and elevation stay
  full-width.
- **`tc-app-bar`** in a `[desktop]` shell takes `--bs-app-bar-desktop-inline`
  (24px) as its inline gutter — one physical longhand, so every variant keeps
  its vertical recipe.
- **`tc-fab`** in a `[desktop]` shell drops `--bs-fab-offset` to 32px — the
  104px default is the phone's dock clearance and the dock is now a rail. An
  explicit `offset` attribute still wins (inline property).
- **`tc-step-pager`** caps its content column at
  `--bs-step-pager-desktop-max` (720px, `100%` disables) at `lg` by growing
  its two gutter tokens — NOT scoped to the shell, because cooking mode is a
  body-level fixed overlay in the reference consumer. The one unscoped
  desktop default in this set.
- **`tc-page-tabs`** gained a fine-pointer hover (resting tab darkens to the
  active ink, weight and underline untouched), which also cancels the reset's
  `a:hover` underline on route tabs. Unscoped: it is pointer-gated, not
  width-gated.

### Added — `tc-extended-select` items take `keywords`

- **`ExtendedSelectItem.keywords?: string[]`** — extra search terms the menu's
  search field matches (case-insensitive containment, alongside `label` and
  `description`) and never renders. Same field and same contract as
  `ComboOption.keywords`, which the combo box has always honoured; the two
  elements disagreeing was the bug: a consumer that transliterated its option
  labels into `keywords` got Latin search inside a `tc-combo-box` and nothing
  inside a `tc-extended-select`, with no signal that the field was ignored.
  Additive — items without the field filter exactly as before.

Fixes found while consuming `5.0.19` from the app. Nothing in the list below
changes an API.

### Fixed

- **`tc-macro-grid` ignored `columns="3"` written as a string** and silently
  rendered four tracks. react-dom writes a JSX prop as a **property** whenever
  one exists on the instance, so the string `'3'` reached the setter and
  `[2, 3, 4].includes('3')` was false — the `: 4` fallback then applied. The
  setter now coerces with `Number(v)`, the same handling the tri-state boolean
  setters already do. Found on JADI.mk screen `1i`, where the extra track made
  each macro cell 76px instead of 105px and wrapped „јаглехидрати" onto two
  lines. The element's own documented example uses the string form, so any
  consumer following it was affected. Additive — a caller already passing a
  number behaves identically.

- **`tc-icon` failed to resolve a kebab-case name** (`src/Icon.ts`).
- **`tc-step-pager`** geometry and behaviour fixes (`src/StepPager.ts`,
  `style/components/_step-pager.scss`).

> ⚠️ **All three fixes above exist in this local checkout only — they are NOT in
> the published `5.0.19`.** JADI.mk's closing gate (`rm -rf node_modules && npm ci`)
> resolves the registry tarball, which drops the symlink to this checkout, so the
> app must work without them — and was verified to. Anything the app genuinely
> needs from here has to be published first, not re-linked.

### Known gaps — the scope of 5.0.20

Found while consuming `5.0.19` from JADI.mk (tasks `32`, `34`, `40`). **None was
fixed**, deliberately: the app's dependency is the published version and a local
edit would not survive a clean install. Each is worked around app-side today, and
each workaround carries a comment pointing here.

| # | Gap | Consequence for the consumer | Workaround in JADI.mk |
|---|---|---|---|
| 1 | **`tc-extended-select`'s popup is sized from its trigger with a minimum**, so it renders 385px wide at a 320px viewport and hangs off the right edge. | Measured on `/admin/settings`, where two of them sit in a 304px card. | `max-width: calc(100vw - 24px)` under a `coarse-pointer` query in `app.scss`, marked as a workaround. The real fix belongs in `style/components/_extended-select.scss`. |
| 2 | **The focus ring on `tc-page-tabs`, `tc-tab-dock` and `tc-app-bar`'s back button is `--tc-app-accent`**, which sunshine maps to amber — 1.79:1 on cream. | A keyboard user cannot see where focus is on the app's three most-used chrome elements. | `_a11y.scss` re-points the ring for those three selectors. |
| 3 | **`Button.ts` never forwards `aria-label`/`title` to its inner `<button>`.** It observes only `variant/outline/size/disabled/loading/href/type/skin`, so an icon-only `tc-button` reports as unnamed. | Every icon-only `tc-button` is an unlabelled control. | A `.visually-hidden` span as the element's **single** child (two children hit gap 8 below). |
| 4 | **`tc-taxonomy-card` renders its heading as an unconditional `h3`.** | An `h1 → h3` outline skip on seven list routes; the card cannot be placed under an `h2`. | None — recorded as a known outline defect. Needs a `heading-level` attribute, which `tc-app-bar` already has. |
| 5 | **`tc-day-strip` announces the today marker twice** (visible text plus a redundant accessible name). | A screen reader reads the current day's label two times. | None. |
| 6 | **`tc-alert` hardcodes `role="alert"` in its own `render()`** and has no politeness attribute. | Every alert is assertive, so a *success* interrupts a screen reader — usually while the user is typing. React writes props before insertion, so a consumer's `role` prop is clobbered by the element's first render. | The consumer re-writes `role`/`aria-live` in an effect **after** mount. Needs a `politeness` (or `live`) attribute. |
| 7 | **`tc-alert` has no swipe-to-dismiss.** | A toast layer built on it can only be dismissed by the close button or its timer. | Accepted: a pointer-move handler in the app would compete with the shell's scroll pane. |
| 8 | **An element that re-parents its slotted children into a rendered wrapper breaks react-dom.** `tc-button` moves them into `.tc-button-content` while the React fiber still records the host as their parent, so the first time React removes ONE element child individually, `removeChild` throws `NotFoundError` and the whole route renders blank. Same shape in `tc-toast` (`.toast-body`) and `tc-alert` (`.tc-alert-content`). | Took `/shopping/:id` down completely. It only bites on an *individual* child removal — React deletes a subtree by its topmost host node, so a static single child is safe. | Five `tc-button` sites that passed element children were replaced by `tc-icon-button` (icon/label as attributes, no children). **Task `41` found two more shapes of the same gap and they are worth spelling out, because „a static single child is safe" reads narrower than the trap actually is:** (a) `{label}{n > 0 ? ` (${n})` : ''}` is TWO text children, and React treats `''` as *no child* — so the count falling to zero is an individual removal and took `/moderation` down to a blank screen the moment the last report was resolved; (b) `{cond && <p/>}` as one of several children of `tc-alert` does the same when `cond` flips (`CapacityBanner`'s waiting-queue pitch). Both were fixed app-side by interpolating into one string / wrapping every child in one stable element. The library-side fix is unchanged: stop re-parenting and order the regions with CSS, as `tc-mobile-shell` and `tc-bottom-sheet` already do. |
| 9 | **The library is one entry point and one stylesheet.** `register()` constructs all 362 elements; `style.css` is all 349 component partials plus all seven themes — 517 KB gzip of JS and 351 KB of CSS, against the app's own 151 KB and 28 KB. | JADI.mk's „total first-load JS ≤ 400 KB gzip" budget fails at 668 KB and **no app-side splitting can reach it.** It is also the residual 50 ms frame on the first sheet of a session (first-time style/layout against a 2.8 MB stylesheet). | None available. Needs per-element registration and a per-theme CSS entry (`@toolcase/web-components/themes/sunshine.css`). |
| 10 | **`tc-extended-select`'s picker sheet is titled `this.label || this.placeholder`.** In sheet mode (coarse pointer) the option list moves into a `tc-bottom-sheet` whose heading comes from those two, in that order. | A consumer that labels the field with a sibling `tc-label` — which is the documented way to label a field that sits in a grid with its own `<tc-label>` — gets a sheet headed „Изберете…" instead of „Пол". JADI.mk has ~20 of these, i.e. every select on a phone. | None. Setting `label` on the element would fix the title and render a SECOND visible label under the existing `tc-label`, so the app-side fix is a 20-call-site change; recorded instead of churned. Needs either a `sheet-title` attribute or `aria-label` participating in the fallback. Found by task `41`. |

Gaps 1–3, 6, 7 and 10 are cosmetic or additive and fit a patch. 4 and 5 change rendered
markup, so they are minor-bump candidates. 8 and 9 are structural.

## 5.0.19

Mobile-first pass: a phone application shell and the interaction primitives a
touch UI needs, plus a touch-target and viewport foundation the existing
components read from. Driven by the JADI.mk mobile rebuild, but nothing in it is
app-specific — no domain vocabulary entered the library.

### New elements (20)

**Application frame**

| Tag               | What it is                                                                                                                                                                                                                      | Not to be confused with                                 |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| `tc-mobile-shell` | The phone frame: `header` / one scrolling pane / `action` / `dock` / `overlay` slots, `100dvh`, safe-area aware, per-key scroll restoration, rAF-throttled `tc-shell-scroll` event, `--tc-keyboard-inset` from `visualViewport` | `tc-dashboard-layout` (desktop sidebar + topbar)        |
| `tc-app-bar`      | Top bar, variants `brand` / `title` / `back`                                                                                                                                                                                    | `tc-navbar` (desktop horizontal nav with a links model) |
| `tc-page-tabs`    | Horizontally **scrolling** underline tab rail; never wraps                                                                                                                                                                      | `tc-tab-bar` (desktop switcher, wraps)                  |
| `tc-tab-dock`     | 5-up bottom navigation dock, icon over label, count badges, `tc-tab-dock-reselect`                                                                                                                                              | `tc-page-tabs`, `tc-tab-bar`                            |
| `tc-action-bar`   | Sticky bottom action surface: safe-area padding, keyboard inset, dock-aware shadow. Imposes no button styling                                                                                                                   | —                                                       |
| `tc-fab`          | 56px squircle floating action button (`border-radius: 16px`, not a circle), optional `auto-hide` off the shell scroll event                                                                                                     | —                                                       |

**Overlay**

| Tag               | What it is                                                                                                                                                                                                                                                                                                                                                                             |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `tc-bottom-sheet` | Bottom sheet: grab handle, snap points, pointer-driven drag-to-dismiss (35% or a >0.5px/ms flick), nested-scroll arbitration, focus trap with return-to-trigger, scroll lock that targets the shell pane when inside one and falls back to the body technique otherwise (reported by a readonly `lockTarget`), 2-level stack cap. Ships `.tc-sheet-section` as a class, not an element |

**Paging**

| Tag              | What it is                                                                                                                                                                              |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `tc-swipe-pager` | Discrete page container built on CSS scroll-snap, so the browser owns the animation. `scrollend` with a debounced fallback; `touch-action: pan-y` so vertical scroll wins               |
| `tc-step-pager`  | Guided full-screen step surface: segmented progress, `keep-awake` via `navigator.wakeLock` (reflects the **real** lock state, re-requests on `visibilitychange`), viewport-clamped type |

**List / content**

| Tag                | What it is                                                                                                                                                           |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `tc-check-row`     | Tick-off row wrapping a real visually-hidden `<input type="checkbox">`; whole row is the hit target; `shape` square/circle, `tone` accent/success                    |
| `tc-list-section`  | Titled, bordered list group with a banded header                                                                                                                     |
| `tc-notice`        | Inline aside with a left accent bar, six tones, plus a full-width `banner` variant. **Distinct from `tc-alert`**, which is a dismissible announcement with a heading |
| `tc-taxonomy-card` | Content card whose identity comes from one accent hue: accent top border, tinted surface, floated metric box, chip and social slots                                  |
| `tc-add-slot`      | Dashed-border "add" affordance; a real `<button>`                                                                                                                    |
| `tc-load-more`     | Idle / loading / exhausted pagination control for touch lists. `tc-pagination` is now documented desktop-only                                                        |

**Numeric display**

| Tag              | What it is                                                                                                                    |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `tc-stat-tile`   | Number + label + optional hint, tonal number colour                                                                           |
| `tc-macro-grid`  | 3/4-up grid of stat tiles, `bare` and `tiled` variants                                                                        |
| `tc-quota-meter` | Track + fill + fraction label; owns the colour-on-approach rule (≥90% warning, 100% danger). Also a full-width `bar` variant  |
| `tc-trend-spark` | Sparkline: line, optional area fill and end dot. Deliberately not a chart — no axes, tooltips or legend                       |
| `tc-day-strip`   | 7-up day selector where **state and selection are orthogonal**; status is exposed in the accessible name, not by colour alone |

### Foundation

- `--tc-safe-top/-right/-bottom/-left` indirections over `env(safe-area-inset-*)`, so a consumer can override an inset (a design canvas or desktop shell can force 0). Components must read the token, never `env()` directly.
- `--tc-vh` (`100dvh`) and `--tc-vh-min` (`100svh`), with an `@supports not (height: 100dvh)` fallback to `100vh`.
- `--tc-min-touch-target` (44px) and `--tc-touch-target-dense` (40px), now read by the controls below rather than hardcoded per partial.
- Mobile spacing / radii / control-height / elevation / motion tokens, and a `sunshine` mobile layer (type scale, scrim, dock states) with per-component partials under `style/themes/sunshine/components/`.
- 16 `tc-`-prefixed utilities, including `.tc-scroll-y` (carries the load-bearing `min-height: 0`), `.tc-scroll-x`, `.tc-snap-x`, `.tc-touch-target`, `.tc-truncate-1/-2`.
- Mobile-first Sass mixins: `up()`, `coarse-pointer()`, `fine-pointer()`, `motion-ok()`, `reduced-motion()`. **No `down()` mixin** — deliberately, so components are authored at phone width and widened.
- `style/foundation/README.md` documents the above.

### Changed defaults a consumer can see

Unconditional:

| Change                                               | Old                                            | New                                                                          |
| ---------------------------------------------------- | ---------------------------------------------- | ---------------------------------------------------------------------------- |
| `:where(button, [role="button"], a, label, summary)` | —                                              | `touch-action: manipulation` (removes the 300ms tap delay; zero specificity) |
| `tc-nav-button` `aria-label` fallback                | hardcoded `'Back'` / `'Close'`                 | reads the message registry, so `configureMessages` is finally honoured       |
| `ToolcaseMessages`                                   | —                                              | gained a required `back` field                                               |
| `lib/react.d.ts`                                     | 4 components shipped without their event types | `tc-generate` (×2), `tc-continue`, `tc-step-click` now typed                 |

Only under `@media (pointer: coarse)`:

- `input` / `select` / `textarea`: `font-size: max(16px, 1em)` — below 16px iOS Safari zooms the viewport on focus and never zooms back.
- `.btn` gains a `min-width` floor; `.form-select` gains min-height and font-size floors.
- `html, body { overscroll-behavior-y: none }`, with a documented opt-out.

> **Versioning note.** This shipped as a patch. The `ToolcaseMessages` `back`
> field is the one line that can break a build: a consumer declaring a _complete_
> catalog object stops compiling until they add it. `configureMessages` takes a
> `Partial<>`, so runtime is unaffected, and no other change alters an existing
> element's behaviour outside a `pointer: coarse` query. Consumers pinning `~5.0`
> and rendering on touch will see the touch floors above.

### `tc-step-pager` — two additive features (JADI.mk task 21)

Added while building the app screen this element was written for, so they land in the same unreleased entry rather than a follow-up. Both are opt-in and neither changes an existing default.

| Addition                                      | API                                                                                                                                                                    | Why                                                                                                                                                                                                                                                                                                                                                         |
| --------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Progress degrades past a step-count threshold | `max-segments` attribute / `maxSegments` property, default **10**; host reflects `[data-progress-bar]`; new `--bs-step-pager-count-*` knobs                            | At 390px 15 segments are 20px each with 4px gaps — a dotted line whose fill boundary is unreadable, which defeats the rule. Past the threshold the region becomes one bar filled to `(index+1)/count` with a „3/15" counter beside it                                                                                                                       |
| The context title can be an action            | `heading-action` attribute / `headingAction` property, `tc-step-pager-heading` event, `onHeadingAction` callback, `--bs-step-pager-heading-icon-size` / `-heading-gap` | A guided sequence whose steps reference context the reader needs mid-way has nowhere to put it (cooking mode and the ingredient amounts). The title row is where a thumb looks. With the attribute the heading is a real `<button>` + `chevron-down` + `aria-haspopup="dialog"`; without it, still a `<div>` — a plain title must not announce as pressable |

**Internal DOM changed.** The element owns its whole subtree, so this is not a slot contract, but a consumer styling internals should know: `.tc-step-pager-progress` now wraps `.tc-step-pager-track` (the segments, or one `.tc-step-pager-bar`) plus `.tc-step-pager-count`, and `.tc-step-pager-heading` wraps its text in `.tc-step-pager-heading-text`. `.tc-step-pager-seg` and its `[data-filled]` are unchanged. No new `ToolcaseMessages` key — „3/15" is figures and a solidus, so there is no sentence to translate.

### Fixes

- **`.form-select` had no touch floor at all.** `_input.scss` declared one, but `_select.scss` is forwarded later and re-declared `min-height` at equal specificity — media queries add no specificity, so the rule lost on source order. Same cause found and fixed for `.pagination-sm .page-link`.
- **`.tc-touch-target` used `display: grid`**, stretching non-button elements to full width; now `inline-grid`.
- **`gen-react-types.mjs` never matched `new CustomEvent<Detail>(…)`**, which is why the four components above had no event types.
- **`tc-app-bar` doubled to 68px at 320px**: flex line-breaking uses an item's _hypothetical_ main size, so `flex-basis: auto` on the title block pushed the actions to a second line. Fixed with `flex: 1 1 0`.
- Theme-scoped elevation: `rgba(var(--tint), α)` composed at `:root` cannot be re-pointed by a theme, because a custom property's `var()` is substituted where it is declared. The elevation block is now emitted again at theme scope, so warm-tinted shadows stay warm.
