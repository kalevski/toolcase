# Bootstrap Components — How They Work

Analysis of `node_modules/bootstrap/scss` (Bootstrap **5.3.8**). Explains every component layer in the import stack of `bootstrap.scss`: what it emits, which CSS custom properties it uses, and the SCSS mechanism behind it.

## Table of contents

- [Architecture overview](#architecture-overview)
- [Foundation](#foundation): [root](#root), [reboot](#reboot), [type](#type), [images](#images), [containers](#containers), [grid](#grid), [tables](#tables)
- [Forms](#forms): [form-label](#form-label--form-text), [form-control](#form-control), [form-select](#form-select), [form-check](#form-check-checkbox--radio--switch), [form-range](#form-range), [floating-labels](#floating-labels), [input-group](#input-group), [validation](#validation)
- [Buttons & interactions](#buttons--interactions): [buttons](#buttons), [button-group](#button-group), [close](#close-button), [transitions](#transitions)
- [Navigation & content](#navigation--content): [dropdown](#dropdown), [nav](#nav), [navbar](#navbar), [card](#card), [accordion](#accordion), [breadcrumb](#breadcrumb), [pagination](#pagination), [badge](#badge), [alert](#alert), [progress](#progress), [list-group](#list-group)
- [Overlays & feedback](#overlays--feedback): [toasts](#toasts), [modal](#modal), [tooltip](#tooltip), [popover](#popover), [carousel](#carousel), [spinners](#spinners), [offcanvas](#offcanvas), [placeholders](#placeholders)
- [Helpers](#helpers)
- [Utilities API](#utilities-api)
- [JS plugin dependency summary](#js-plugin-dependency-summary)

---

## Architecture overview

Every component in Bootstrap 5.3 is built on the same five mechanisms. Understanding these makes each individual component file readable.

### 1. CSS custom properties (`--bs-*`)

Each component class defines its full set of design tokens as CSS variables on the root class (e.g. `.btn` defines `--bs-btn-bg`, `--bs-btn-color`, `--bs-btn-padding-y`, …) and then consumes them via `var()`. Variants and states don't restyle properties — they **reassign the variables**. This is why `.btn-primary` is just a block of `--bs-btn-*` redefinitions and why runtime theming works without recompiling Sass. The `bs-` prefix comes from the `$prefix` variable.

### 2. Theme color maps

`_variables.scss` defines `$theme-colors` (primary, secondary, success, info, warning, danger, light, dark). `_maps.scss` derives three more maps from it:

- `$theme-colors-text` → `--bs-{color}-text-emphasis` (dark shade for text)
- `$theme-colors-bg-subtle` → `--bs-{color}-bg-subtle` (light tint for backgrounds)
- `$theme-colors-border-subtle` → `--bs-{color}-border-subtle` (medium tint for borders)

Components loop these maps with `@each` to generate variants (`.alert-success`, `.list-group-item-danger`, `.btn-primary`, `.table-warning`, …). Dark-mode counterparts (`*-dark` maps) feed the same variables under `[data-bs-theme="dark"]`.

### 3. Breakpoint loops

`$grid-breakpoints` (xs 0, sm 576px, md 768px, lg 992px, xl 1200px, xxl 1400px) drives every responsive variant. Components loop `map-keys($grid-breakpoints)`, build a class infix with `breakpoint-infix()` (empty for xs, `-sm`, `-md`, …), and wrap rules in `media-breakpoint-up()` / `media-breakpoint-down()` mixins. This generates `.col-md-6`, `.navbar-expand-lg`, `.modal-fullscreen-sm-down`, `.list-group-horizontal-xl`, `.offcanvas-md`, etc.

### 4. Dark mode

Gated by `$enable-dark-mode`. The `color-mode(dark)` mixin emits either `[data-bs-theme="dark"]` selectors or a `prefers-color-scheme: dark` media query depending on `$color-mode-type`. Components that embed colored SVGs (accordion chevron, navbar toggler, close button, form checks) swap the SVG data-URI or apply a `filter: invert(1)` in dark mode.

### 5. SVG data-URIs

All built-in icons (checkbox check, radio dot, select chevron, accordion chevron, close X, carousel arrows, validation icons, navbar hamburger) are inline SVGs embedded as `url("data:image/svg+xml,...")` background images, passed through the `escape-svg()` function. Colors are interpolated into the SVG at compile time (`fill='#{$color}'`), which is why changing icon colors at runtime requires swapping the whole variable (or using a `filter`).

Also pervasive: **RFS** (responsive font sizing via `@include font-size()`), `$enable-*` feature flags (shadows, gradients, rounded, transitions, reduced-motion), and flexbox as the layout model for nearly everything.

---

## Foundation

### Root

`_root.scss` — emits the design-token layer. No classes; it populates `:root` (and `[data-bs-theme]` scopes) with CSS variables by looping the color maps: `--bs-{color}` and `--bs-{color}-rgb` for every theme color, `--bs-gray-{100..900}`, body typography tokens (`--bs-body-font-family/size/color/bg`), link tokens, border tokens (`--bs-border-width/color/radius` + sm/lg/xl/xxl/pill radii), shadow tokens, focus-ring tokens (`--bs-focus-ring-width/opacity/color`), and form validation colors. The `-rgb` triplet variants exist so components can do `rgba(var(--bs-primary-rgb), .5)` for opacity control. Dark-mode values are emitted inside `@include color-mode(dark, true)`.

### Reboot

`_reboot.scss` — cross-browser normalization (forked from Normalize.css). Sets `box-sizing: border-box` universally, strips default margins, wires `body` to the `--bs-body-*` variables, styles bare elements (headings via a shared `%heading` placeholder, links via `rgba(var(--bs-link-color-rgb), var(--bs-link-opacity, 1))`, tables, form elements, `code`/`kbd`/`pre`). Mostly static rules — no loops. Includes webkit-specific form resets and optional smooth scrolling behind `$enable-smooth-scroll` with a `prefers-reduced-motion` guard.

### Type

`_type.scss` — typography utility classes. `.h1`–`.h6` reuse element styles via `@extend`; `.display-1`–`.display-6` are generated by looping the `$display-font-sizes` map with RFS-scaled font sizes; plus `.lead`, `.list-unstyled`, `.list-inline`/`.list-inline-item`, `.initialism`, `.blockquote`/`.blockquote-footer`.

### Images

`_images.scss` — `.img-fluid` (`max-width: 100%; height: auto` via the `img-fluid()` mixin), `.img-thumbnail` (padding + border + radius + shadow), and `.figure`/`.figure-img`/`.figure-caption`.

### Containers

`_containers.scss` — `.container`, `.container-fluid`, and `.container-{sm..xxl}`. All use the `make-container()` mixin (sets `--bs-gutter-x/y`, 100% width, horizontal padding, auto margins). The responsive containers extend `.container-fluid` and then, looping `$container-max-widths`, gain a `max-width` at their breakpoint and every breakpoint above it via `%responsive-container-*` placeholders — mobile-first: `.container-sm` is fluid below `sm`, capped from `sm` up. Gated by `$enable-container-classes`.

### Grid

`_grid.scss` — the flexbox grid. The mechanism:

- `.row` (`make-row()` mixin): flex + wrap, defines `--bs-gutter-x/y`, applies negative horizontal margins to cancel column padding at row edges.
- All direct children of `.row` get `make-col-ready()`: `width: 100%`, horizontal padding of half a gutter.
- `make-grid-columns()` loops every breakpoint and generates per-infix: `.col` (`flex: 1 1 0`), `.col-auto`, `.col-1..12` (`flex: 0 0 auto; width: percentage(i/12)`), `.row-cols-1..6`, `.offset-0..11` (`margin-left` percentage), and gutter classes `.g-*`/`.gx-*`/`.gy-*` (which just reassign `--bs-gutter-x/y` from the `$gutters` map).
- `:root` also gets `--bs-breakpoint-{name}` variables so JS can read breakpoints.
- Optional CSS Grid mode (`$enable-cssgrid`): `.grid` with `grid-template-columns: repeat(var(--bs-columns, 12), 1fr)` and `gap: var(--bs-gap)`.

Key knobs: `$grid-columns` (12), `$grid-gutter-width` (1.5rem), `$grid-breakpoints`.

### Tables

`_tables.scss` — the cleverest variable cascade in the framework. `.table` defines base tokens plus three *layers* of override variables, consumed on every cell as:

```css
color: var(--bs-table-color-state, var(--bs-table-color-type, var(--bs-table-color)));
box-shadow: inset 0 0 0 9999px var(--bs-table-bg-state, var(--bs-table-bg-type, var(--bs-table-accent-bg)));
```

- Base layer: `--bs-table-color` / `--bs-table-bg`.
- Type layer: `.table-striped` / `.table-striped-columns` set `--bs-table-*-type` on `nth-of-type` rows/columns.
- State layer (wins over everything): `.table-active` and `.table-hover tr:hover` set `--bs-table-*-state`.

Backgrounds use a huge inset `box-shadow` instead of `background-color` so they don't fight cell borders. Color variants (`.table-primary` …) come from looping `$table-variants` through the `table-variant()` mixin, which computes hover/striped/active shades with `mix()` and contrast text with `color-contrast()`. `.table-responsive{-breakpoint}` wrappers add `overflow-x: auto` below each breakpoint. Also: `.table-sm`, `.table-bordered`, `.table-borderless`, `.table-group-divider`, `.caption-top`.

---

## Forms

`_forms.scss` is just an import hub for the `forms/` directory.

### Form label & form text

`forms/_labels.scss` — `.form-label` (margin/font/color) and `.col-form-label{-sm,-lg}`, whose vertical padding is computed as `add($input-padding-y, $input-border-width)` so labels line up with adjacent inputs in grid layouts.
`forms/_form-text.scss` — `.form-text` helper text: small font, `var(--bs-secondary-color)`, top margin.

### Form control

`forms/_form-control.scss` — `.form-control` for text inputs/textareas: block-level, full width, `appearance: none`, `background-clip: padding-box`, border from `var(--bs-border-*)`. Focus swaps `border-color` to `$input-focus-border-color` (a 50% tint of primary) and adds the focus box-shadow when `$enable-shadows`. File inputs are styled through the `::file-selector-button` pseudo-element (gradient bg, hover state, its own transition). Several webkit pseudo-elements (`::-webkit-date-and-time-value`, `::-webkit-datetime-edit`) patch date/time input rendering. Variants: `.form-control-sm/-lg` (padding/font/radius), `.form-control-plaintext` (borderless read-only), `.form-control-color` (fixed 3rem color swatch, swatch borders removed per engine).

### Form select

`forms/_form-select.scss` — `.form-select` replaces the native select UI: `appearance: none`, then a chevron SVG as `background-image: var(--bs-form-select-bg-img), var(--bs-form-select-bg-icon, none)` positioned right, with `padding-right` widened (~3×) to clear it. The second background slot is reserved for the validation icon — that's how a select can show both chevron and valid/invalid icon at once. `[multiple]` / `[size]` selects drop the chevron. Dark mode swaps to a light-stroke chevron SVG. Sizes: `.form-select-sm/-lg`.

### Form check (checkbox / radio / switch)

`forms/_form-check.scss` — fully custom-drawn controls:

- `.form-check-input`: `appearance: none`, 1em square, `background-color: var(--bs-form-check-bg)`, centered `background-image`. `[type=checkbox]` gets a small radius; `[type=radio]` gets `border-radius: 50%`.
- `:checked` sets background to `$form-check-input-checked-bg-color` (component active color = primary) and swaps `--bs-form-check-bg-image` to the check SVG (checkbox) or dot SVG (radio). `:indeterminate` shows a dash SVG. Active state applies `filter: brightness(90%)`.
- `.form-switch`: widens the input to 2em and uses a circle-knob SVG as the background image; `:checked` slides it via `background-position: right center` with a `background-position .15s ease-in-out` transition — the toggle animation is purely a background-position move.
- `.btn-check`: visually hidden input (`position: absolute; clip: rect(0,0,0,0)`); the sibling selector `.btn-check:checked + .btn` is what powers toggle buttons — the button's `--bs-btn-*` active variables kick in with no JS state.
- Layout helpers: `.form-check` (padding-start reserve for the box), `.form-check-inline`, `.form-check-reverse`.

### Form range

`forms/_form-range.scss` — `.form-range` styles the native slider. Track and thumb must be styled per engine with duplicated rulesets (`::-webkit-slider-thumb`/`::-webkit-slider-runnable-track`, `::-moz-range-thumb`/`::-moz-range-track`) because browsers drop grouped selectors they don't recognize. Thumb: 1rem circle, primary background, lightens to a 70% tint while dragging (`:active`). Focus shadow goes on the thumb pseudo-elements. No JS.

### Floating labels

`forms/_floating-labels.scss` — `.form-floating` wraps an input + label. The label is absolutely positioned over the input (full-height, semi-transparent, `transform-origin: 0 0`); the input is taller than normal (3.5rem). When the input is `:focus` or `:not(:placeholder-shown)` (i.e. has a value — this is why the input needs a `placeholder` attribute), the label shrinks and lifts: `transform: scale(.85) translateY(-.5rem) translateX(.15rem)`, and the input's top padding grows to make room. `:-webkit-autofill` gets a duplicated ruleset because it invalidates grouped selectors in WebKit. Textareas add an `::after` backing rectangle so text doesn't show through the floated label.

### Input group

`forms/_input-group.scss` — `.input-group` is a stretch-aligned flex row. Controls take `flex: 1 1 auto; width: 1%`; `.input-group-text` addons are flex-centered boxes with input-matching borders. Adjacent borders are merged by `margin-left: calc(-1 * border-width)` on every non-first child, and a z-index ladder keeps the focused element's border on top: focused control/`:focus-within` = 5, buttons = 2 (5 on focus). Inner corners are squared via `nth-child` selectors — with a special selector branch for `.has-validation`, where feedback elements occupy the last child slots. `.input-group-sm/-lg` resize all children at once.

### Validation

`forms/_validation.scss` — entirely generated by looping the `$form-validation-states` map (`valid`, `invalid`) through the `form-validation-state()` mixin. Each state produces:

- `.{state}-feedback` (hidden; displayed by sibling selector when the control is in that state) and `.{state}-tooltip` (absolutely positioned colored bubble).
- Two trigger modes wired into the same selectors: client-side `.was-validated` parent + native `:valid`/`:invalid`, or server-side `.is-valid`/`.is-invalid` classes.
- Per control type: `.form-control` gets a state border color and (if `$enable-validation-icons`) a right-aligned state icon SVG with `padding-right: $input-height-inner`; `.form-select` puts the icon in its reserved second background slot; `.form-check-input` recolors border/background and label; input-group members get z-index 3 (valid) / 4 (invalid).

The map is extensible — adding a key to `$form-validation-states` produces a complete new state.

---

## Buttons & interactions

### Buttons

`_buttons.scss` — `.btn` defines ~20 `--bs-btn-*` variables (padding, font, color, bg, border, hover/active/disabled/focus variants) and consumes them for every state. States: `:hover`, `:focus-visible` (modern focus, shadow from `--bs-btn-focus-box-shadow`), `:active`/`.active`/`.show`, `:disabled`/`.disabled`/`fieldset:disabled`, plus `.btn-check:checked + .btn` for toggle buttons.

Variants are loops over `$theme-colors`:

- `.btn-{color}` → `button-variant()` mixin: computes hover/active backgrounds with `shade-color()` (light buttons) or `tint-color()` (dark buttons) at 15%/20%, contrast text via `color-contrast()`, and the focus-ring rgb by mixing button color with border color — all emitted as variable reassignments.
- `.btn-outline-{color}` → `button-outline-variant()`: transparent bg, colored border/text; hover inverts to solid.
- `.btn-link`: no bg/border, link color + underline behavior.
- `.btn-lg`/`.btn-sm` → `button-size()` mixin (padding/font-size/radius variables).

No JS for styling; JS toggles `.active`/`.show` where needed.

### Button group

`_button-group.scss` — `.btn-group`/`.btn-group-vertical` are inline-flex containers that merge child button borders with negative margins (`margin-left: calc(-1 * border-width)`; `margin-top` for vertical) and square off inner corners with `border-start/end-radius(0)` on positional selectors (nth-child logic skips hidden `.btn-check` inputs). Hover/focus/active children get `z-index: 1` so their border renders above neighbors. `.dropdown-toggle-split` halves the padding for split-button dropdowns. `.btn-toolbar` is a wrapping flex container for multiple groups. `.btn-group-sm/-lg` cascade sizing to children.

### Close button

`_close.scss` — `.btn-close` is a 1em square button whose X is an SVG data-URI background (`--bs-btn-close-bg`), with opacity-stepped states: 0.5 base → 0.75 hover → 1 focus → 0.25 disabled, plus the standard focus-ring shadow. `.btn-close-white` (and dark mode globally) applies `filter: invert(1) grayscale(100%) brightness(200%)` via `--bs-btn-close-filter` to flip the icon for dark backgrounds. The click behavior (dismissing an alert/modal/toast) comes from the parent component's JS.

### Transitions

`_transitions.scss` — three primitives the JS plugins drive:

- `.fade`: `transition: opacity .15s linear`; `:not(.show)` → `opacity: 0`.
- `.collapse`: `:not(.show)` → `display: none`.
- `.collapsing`: the in-between state — `height: 0; overflow: hidden; transition: height .35s ease`. The Collapse plugin measures target height, applies `.collapsing`, sets the pixel height, then swaps to `.collapse.show` when the transition ends. `.collapse-horizontal` does the same with `width`.

---

## Navigation & content

### Dropdown

`_dropdown.scss` — `.dropdown-menu` is `position: absolute; display: none; z-index: var(--bs-dropdown-zindex)` (1000); JS adds `.show`. Positioning is two-tier: static CSS fallbacks (`top: 100%`, margins from `--bs-dropdown-spacer`) apply via `[data-bs-popper]` selectors, but when Popper.js manages the menu it sets inline styles instead. The toggle caret is a `::after` border-triangle from the `caret()` mixin; direction wrappers `.dropup`/`.dropend`/`.dropstart`/`.dropdown-center` flip the caret and the static position. Responsive alignment classes `.dropdown-menu{-sm..-xxl}-start/end` come from the breakpoint loop. Items: `.dropdown-item` (block-width links with hover bg `var(--bs-tertiary-bg)`, active bg = component active color, disabled state), `.dropdown-divider`, `.dropdown-header`, `.dropdown-item-text`. `.dropdown-menu-dark` is a legacy variable-override block (superseded by `data-bs-theme="dark"`). **JS:** Dropdown plugin + Popper.

### Nav

`_nav.scss` — `.nav` is a wrapping flex list, fully reset; `.nav-link` carries padding/color/transition variables. Variants restyle via their own variable sets:

- `.nav-tabs`: bottom border on the container; links get transparent borders that fill in on hover; `.active` link gets solid bg + borders, and `margin-bottom: calc(-1 * var(--bs-nav-tabs-border-width))` so it overlaps the container border (the classic tab "notch" effect).
- `.nav-pills`: `.active` link gets rounded primary background (`gradient-bg()`).
- `.nav-underline`: gap-spaced links with a transparent `border-bottom` that becomes `currentcolor` when active; active text turns semibold.
- `.nav-fill` / `.nav-justified`: flex sizing of items (`flex: 1 1 auto` vs `flex-basis: 0; flex-grow: 1`).

Tab panes: `.tab-content > .tab-pane { display: none }`, `.active { display: block }`. **JS:** Tab plugin swaps `.active`.

### Navbar

`_navbar.scss` — `.navbar` is a wrap-enabled flex row with `justify-content: space-between`. Sub-parts: `.navbar-brand`, `.navbar-nav` (column by default — mobile-first; its own link color variables), `.navbar-text`, `.navbar-collapse` (`flex-basis: 100%`, paired with the Collapse plugin), `.navbar-toggler` (border + focus styles) and `.navbar-toggler-icon`, a hamburger SVG in `--bs-navbar-toggler-icon-bg`.

The core mechanism is the **expand loop**: `.navbar-expand{-breakpoint}` iterates breakpoints with `breakpoint-next()` and, inside `media-breakpoint-up($next)`, switches `.navbar-nav` to row, restores absolute dropdowns, force-shows `.navbar-collapse` (`display: flex !important`), and hides the toggler. Below the breakpoint everything stays stacked and the offcanvas integration rules apply (a nested `.offcanvas` becomes a plain inline container above the breakpoint).

Color modes: navbar reads `--bs-navbar-*` color variables; `.navbar-dark` or `[data-bs-theme=dark]` reassigns them (lighter text, alternate hamburger SVG). **JS:** Collapse (and Offcanvas if used).

### Card

`_card.scss` — `.card` is a column flex container (`min-width: 0` to avoid flexbox overflow) with `--bs-card-*` tokens for spacing, borders, caps, and colors. `.card-body` takes `flex: 1 1 auto` so footers pin to the bottom. `.card-header`/`.card-footer` use the "cap" tokens (`--bs-card-cap-bg` = a 3% body-color tint) and their corner radii are derived as `--bs-card-inner-border-radius` (outer radius minus border width) — same trick used for images: `.card-img-top`/`.card-img-bottom`/`.card-img` round only the matching corners. `.card-img-overlay` absolutely fills the card. `.card-header-tabs` pulls nav-tabs into the header with negative margins so the tab border merges with the cap border. `.card-group` (from `sm` up) flexes cards into a row and collapses adjacent borders/radii. A `.card > .list-group` gets its borders/radii reconciled with the card frame. CSS-only.

### Accordion

`_accordion.scss` — built on the Collapse plugin. `.accordion-button` is a full-width flex button; its chevron is an `::after` element whose `background-image` is `var(--bs-accordion-btn-icon)`. Expanded state is expressed as `:not(.collapsed)`: icon swaps to `--bs-accordion-btn-active-icon` and rotates via `transform: var(--bs-accordion-btn-icon-transform)` (−180°, transitioned over .2s); the button takes the active colors (`primary-bg-subtle` bg) and an inset bottom box-shadow that draws the separator line. `.accordion-item` borders collapse between items (`:not(:first-of-type) { border-top: 0 }`), with first/last radius handling that respects collapsed state. `.accordion-flush` zeroes side borders and radii for edge-to-edge lists. Dark mode swaps both chevron SVGs for light-colored versions. **JS:** Collapse.

### Breadcrumb

`_breadcrumb.scss` — `.breadcrumb` is a reset, wrapping flex list. The separator is generated content: `.breadcrumb-item + .breadcrumb-item::before` with `content: var(--bs-breadcrumb-divider, "/")` — overridable per-instance by setting that variable inline (the official customization path), with an RTL-flipped fallback baked in via rtlcss comment directives. `.active` recolors to the secondary color. CSS-only, tiny.

### Pagination

`_pagination.scss` — `.pagination` is a flex list; `.page-link` carries the full `--bs-pagination-*` variable set with hover/focus/active/disabled blocks. Like input groups, adjacent borders merge via negative `margin-left` on `.page-item:not(:first-child)`, with z-index laddering (hover 2, focus/active 3). Border-radius is applied conditionally: if `$pagination-margin-start` keeps the default border-merging value, only first/last links get rounded; if you space items out, every link gets rounded. `.pagination-lg/-sm` reassign size variables via the `pagination-size()` mixin. CSS-only.

### Badge

`_badge.scss` — smallest component: `.badge` is an inline-block label with em-based padding (scales with parent font), `font-size: .75em`, bold, `line-height: 1`, nowrap, optional gradient. `&:empty { display: none }` hides empty badges. **It sets no background color** — you pair it with `.text-bg-{color}` or `.bg-{color}` utilities. CSS-only.

### Alert

`_alert.scss` — `.alert` is a padded, bordered, relative-positioned box reading `--bs-alert-*` variables. Variants loop `$theme-colors` keys and map straight onto the subtle-color system:

```scss
.alert-#{$state} {
  --bs-alert-color: var(--bs-#{$state}-text-emphasis);
  --bs-alert-bg: var(--bs-#{$state}-bg-subtle);
  --bs-alert-border-color: var(--bs-#{$state}-border-subtle);
  --bs-alert-link-color: var(--bs-#{$state}-text-emphasis);
}
```

Because these reference root-level variables, alerts adapt to dark mode automatically with no extra CSS. `.alert-dismissible` reserves 3× padding on the right and absolutely positions the `.btn-close`. `.alert-heading` inherits color; `.alert-link` is bold. **JS:** Alert plugin handles dismissal (removes the element after fading).

### Progress

`_progress.scss` — `.progress` (and `.progress-stacked`) is a fixed-height flex track with `overflow: hidden`; `.progress-bar` is a flex column whose **width is set inline** (`style="width: 25%"`) and transitions via `width .6s ease`. `.progress-bar-striped` paints diagonal stripes with the `gradient-striped()` mixin (a 45° `linear-gradient` sized to `var(--bs-progress-height)`); `.progress-bar-animated` scrolls the stripes with a `progress-bar-stripes` keyframe animation (1s linear infinite, disabled under `prefers-reduced-motion`). Stacking: `.progress-stacked > .progress` keeps `overflow: visible` so multiple bars sit side by side. CSS-only.

### List group

`_list-group.scss` — `.list-group` is a reset flex column; `.list-group-item` is a bordered block where adjacent items drop their top border (`& + & { border-top-width: 0 }`) and first/last inherit the container radius. `.active` raises `z-index: 2` so its border shows over neighbors. Feature classes:

- `.list-group-item-action`: hover/focus bg (`--bs-list-group-action-hover-bg`), active press state — for `<a>`/`<button>` items.
- `.list-group-numbered`: CSS counters (`counter-increment: section`) with `::before { content: counters(section, ".") ". " }`.
- `.list-group-horizontal{-breakpoint}`: breakpoint loop flips direction to row and switches the border-collapse axis to left borders, with corner radius remapping.
- `.list-group-flush`: removes outer borders/radii, keeps bottom separators.
- `.list-group-item-{color}`: same subtle-color variable mapping as alerts, plus tinted active states.

JS optional (Tab plugin can drive list-group items as tabs).

---

## Overlays & feedback

### Toasts

`_toasts.scss` — `.toast` is a fixed-max-width (350px) card with translucent background, backdrop-friendly border, and shadow. Visibility is three-state, driven by the Toast plugin: `.showing` (opacity 0, transitioning in), `.show` (visible), `:not(.show)` (display none). `.toast-container` is the positioning wrapper (`position: absolute; z-index: var(--bs-toast-zindex)` (1090); `pointer-events: none` so empty space doesn't block clicks, with stacked-toast spacing via `margin-bottom` on non-last children). `.toast-header` is a flex row with its own bg/border tokens; `.toast-body` holds content. **JS:** Toast plugin.

### Modal

`_modal.scss` — layered fixed-position system:

- `.modal`: `position: fixed; inset 0; width/height 100%; z-index: var(--bs-modal-zindex)` (1055); `display: none` until JS shows it; `overflow: hidden` (the *dialog*, not the page, scrolls).
- `.modal-dialog`: the width/margin shell. The entrance animation lives here: `.modal.fade .modal-dialog { transform: translate(0, -50px) }` → `.modal.show .modal-dialog { transform: none }`, riding on the `.fade` opacity transition.
- `.modal-content`: the visible panel (bg, border, radius, shadow, column flex).
- `.modal-backdrop`: generated by JS, styled by the shared `overlay-backdrop()` mixin — fixed, full-viewport, `z-index` 1050, black at `--bs-backdrop-opacity` (.5), with fade states.
- Sections: `.modal-header` (flex, space-between, close button), `.modal-body` (`flex: 1 1 auto`), `.modal-footer` (right-aligned flex with gap).

Responsive sizing: below `sm` the dialog is full-width with small margins; from `sm` up it gets `max-width: var(--bs-modal-width)` (500px) and `margin: auto`; `.modal-sm` (300px), `.modal-lg`/`.modal-xl` (800/1140px, applied at `lg`+). `.modal-dialog-scrollable` constrains height and scrolls the body; `.modal-dialog-centered` flex-centers vertically. The fullscreen loop generates `.modal-fullscreen` plus `.modal-fullscreen-{sm..xxl}-down` variants (100vw/100% with zeroed radius) inside `media-breakpoint-down()` queries. **JS:** Modal plugin (backdrop, focus trap, scroll locking, dismiss).

### Tooltip

`_tooltip.scss` — `.tooltip` starts at `opacity: 0` (`.show` → `var(--bs-tooltip-opacity)`, .9); content lives in `.tooltip-inner` (max-width 200px, dark bg, white text). Word-wrap is enabled, body font reapplied via `reset-text()`. The arrow is the classic **CSS border triangle**: `.tooltip-arrow::before` has zero size and thick borders, with only one side colored — e.g. for top placement, `border-width: arrow-height (arrow-width/2) 0; border-top-color: var(--bs-tooltip-bg)`. Placement classes `.bs-tooltip-{top,end,bottom,start}` position the arrow on the corresponding edge (swapping the width/height for side placements); `.bs-tooltip-auto` `@extend`s them via `[data-popper-placement^="..."]` attribute selectors so Popper's runtime placement picks the right arrow. Directional blocks are wrapped in `rtl:ignore` since Popper handles RTL itself. **JS:** Tooltip plugin + Popper (required).

### Popover

`_popover.scss` — same skeleton as tooltip but a full panel: visible background, border, shadow, `.popover-header` (own bg/padding, with inner radius) and `.popover-body`. The arrow needs **two stacked triangles** because the popover has a border: `::before` draws the border-colored triangle, `::after` draws the background-colored one offset by one border-width — producing a bordered arrow. Bottom placement adds a `.popover-header::before` underline trick to seam the arrow with the header background. Placement/auto/RTL handling identical to tooltip. **JS:** Popover plugin + Popper.

### Carousel

`_carousel.scss` — slide engine without absolute positioning: every `.carousel-item` is `display: none; float: left; width: 100%; margin-right: -100%`, so any *displayed* items stack on the same spot. During a transition JS displays two items and animates `transform: translateX(±100%)`:

- incoming: `.carousel-item-next` starts at `translateX(100%)` (prev at −100%),
- outgoing: `.active.carousel-item-start` slides to `translateX(-100%)` (`-end` to +100%),
- both ride `transition: transform .6s ease-in-out`.

`.carousel-fade` swaps the mechanism to opacity: items keep `transform: none`, active gets `z-index: 1; opacity: 1`, the leaving item fades with a delayed 0s opacity snap. Controls (`.carousel-control-prev/next`) are absolute 15%-wide hit areas with SVG chevron icons (RTL-swapped via rtlcss directives); `.carousel-indicators` is a centered flex row of flat buttons (`data-bs-target`) with opacity states; `.carousel-caption` is absolutely positioned text. `.carousel-dark` flips icon filter, indicator color, caption color via variables. **JS:** Carousel plugin (timers, touch swipe, keyboard).

### Spinners

`_spinners.scss` — two pure-CSS loaders sharing a base (inline-block, round, `animation: var(--bs-spinner-animation-speed) linear infinite var(--bs-spinner-animation-name)`):

- `.spinner-border`: a `2em` circle with `border: .25em solid currentcolor; border-right-color: transparent`, rotated 360° by the `spinner-border` keyframe — the transparent quadrant creates the spinning-gap illusion.
- `.spinner-grow`: `background-color: currentcolor; opacity: 0`, keyframe scales from `scale(0)` to full size at 50% opacity 1 — a pulse.

`-sm` variants shrink via the size variables. Both honor `prefers-reduced-motion` by slowing the animation (1.5s). Color comes from `currentcolor`, so `.text-primary` etc. color the spinner. No JS required (visibility toggling is up to you).

### Offcanvas

`_offcanvas.scss` — entirely generated by a breakpoint loop producing `.offcanvas` (always-on) and `.offcanvas-{sm..xxl}` (responsive) variants:

- **Below** the breakpoint (`media-breakpoint-down`): a fixed, flex-column panel (`visibility: hidden`) translated off-screen by placement class — `.offcanvas-start` `translateX(-100%)`, `.offcanvas-end` `translateX(100%)`, `.offcanvas-top/bottom` `translateY(∓100%)` with fixed height instead of width. `.showing`/`.show` remove the transform (transition: `transform .3s ease-in-out`); `.hiding` handles exit.
- **Above** the breakpoint: the same element is neutralized into normal flow — transparent background, zero border, auto height, `.offcanvas-header` hidden, `.offcanvas-body` inlined — which is how a navbar menu can be an offcanvas drawer on mobile and a plain inline nav on desktop with one DOM.

`.offcanvas-backdrop` reuses the `overlay-backdrop()` mixin (z-index 1040 under the panel's 1045). **JS:** Offcanvas plugin.

### Placeholders

`_placeholders.scss` — skeleton loaders. `.placeholder` is an inline-block bar: `min-height: 1em; background-color: currentcolor; opacity: .5; cursor: wait` — you put it inside a sized element (often with width utilities like `.col-6`). Size variants tweak `min-height` (xs .6em, sm .8em, lg 1.2em). Two animation wrappers applied to a parent:

- `.placeholder-glow .placeholder`: keyframe pulses opacity .5 → .2 → .5 over 2s.
- `.placeholder-wave`: a 130° gradient `mask-image` sized `200% 100%`, keyframe slides `mask-position` to `-200% 0%` — a shimmer sweep done entirely with masking.

CSS-only.

---

## Helpers

`_helpers.scss` imports small single-purpose classes from `helpers/`:

| Helper | Classes | Mechanism |
|---|---|---|
| clearfix | `.clearfix` | `::after { display: block; clear: both }` mixin |
| color-bg | `.text-bg-{color}` | sets `color` (auto-contrast) + `background-color` together from theme colors |
| colored-links | `.link-{color}` | link color + matching `--bs-link-*-rgb` hover values |
| focus-ring | `.focus-ring` | replaces outline with box-shadow built from `--bs-focus-ring-x/y/blur/width/color` variables — fully runtime-tunable |
| icon-link | `.icon-link`, `.icon-link-hover` | inline-flex gap layout; hover translates the inner SVG via `--bs-icon-link-transform` |
| ratio | `.ratio`, `.ratio-{1x1,4x3,16x9,21x9}` | padding-top aspect-ratio trick: `::before { padding-top: var(--bs-aspect-ratio) }`, children absolutely fill; ratios loop the `$aspect-ratios` map |
| position | `.fixed-top/bottom`, `.sticky{-breakpoint}-top/bottom` | fixed/sticky shortcuts with `$zindex-fixed` (1030) / `$zindex-sticky` (1020); sticky variants from the breakpoint loop |
| stacks | `.hstack`, `.vstack` | flex row (center-aligned) / flex column shortcuts |
| visually-hidden | `.visually-hidden`, `.visually-hidden-focusable` | screen-reader-only clipping mixin (1px box, clip, no overflow) |
| stretched-link | `.stretched-link` | `::after` absolutely covers the nearest positioned ancestor — makes a whole card clickable from one link |
| text-truncation | `.text-truncate` | `overflow: hidden; text-overflow: ellipsis; white-space: nowrap` |
| vr | `.vr` | inline-block 1px-wide vertical rule using `currentcolor` + opacity |

---

## Utilities API

Two files generate the entire utility-class layer:

**`_utilities.scss`** declares the `$utilities` Sass map — 80+ entries, each describing one utility family:

```scss
"opacity": (
  property: opacity,
  values: (0: 0, 25: .25, 50: .5, 75: .75, 100: 1)
),
"margin": (
  responsive: true,
  property: margin,
  class: m,
  values: map-merge($spacers, (auto: auto))
),
```

Option keys: `property` (one or several CSS properties), `class` (class stem), `values` (list or map), `responsive` (emit per-breakpoint variants), `state` (emit e.g. `-hover:hover` variants), `rfs` (responsive font sizing), `print` (emit `-print` variants), `css-var`/`css-variable-name` (write a `--bs-*` variable instead of a property — used by `.text-opacity-*`, `.bg-opacity-*`, `.border-opacity-*`, `.focus-ring-*`, `.link-opacity-*`), `local-vars` (extra variables to set, e.g. `.bg-*` sets `--bs-bg-opacity: 1`), `rtl: false` (exclude from RTL builds).

This is how color utilities support opacity: `.bg-primary` is `background-color: rgba(var(--bs-primary-rgb), var(--bs-bg-opacity)) !important`, and `.bg-opacity-50` just reassigns `--bs-bg-opacity`.

**`utilities/_api.scss`** renders the map through `generate-utility()`:

1. Loops every breakpoint inside `media-breakpoint-up()`, emitting base classes at xs and `.{class}{-infix}-{value}` for entries marked `responsive: true` (e.g. `.d-md-flex`, `.mt-lg-4`).
2. A second pass applies RFS rescaling to `rfs: true` entries.
3. A `@media print` pass emits `print: true` entries as `.{class}-print-{value}`.
4. `$enable-important-utilities` (default true) appends `!important` to everything — utilities are meant to win over component styles.

The map is user-extensible: `map-merge` your own entries onto `$utilities` before importing the API and you get the full responsive/state/print treatment for custom utilities.

---

## JS plugin dependency summary

| CSS-only | JS plugin required | JS + Popper.js |
|---|---|---|
| badge, breadcrumb, card, pagination, progress, spinners, placeholders, tables, grid/containers, type/images, all forms (validation works native or server-side), button styles, helpers, utilities | alert (dismiss), collapse/accordion, navbar collapse, modal, offcanvas, toast, carousel, nav tabs | dropdown, tooltip, popover |

Toggle buttons (`.btn-check`), switches, floating labels, and accordion chevron rotation are pure CSS state — JS only flips classes (`.show`, `.active`, `.collapsed`) or attributes; all visual behavior lives in the stylesheet.

---

## Z-index scale (fixed, from `_variables.scss`)

| Layer | Value |
|---|---|
| dropdown | 1000 |
| sticky | 1020 |
| fixed | 1030 |
| offcanvas backdrop | 1040 |
| offcanvas | 1045 |
| modal backdrop | 1050 |
| modal | 1055 |
| popover | 1070 |
| tooltip | 1080 |
| toast | 1090 |
