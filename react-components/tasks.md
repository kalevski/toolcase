# React Components — Design & Robustness Tasks

Audit of every component in `@toolcase/react-components` with concrete tasks to make the design **more consistent, more modern, and sharper** (strict `border-radius: 0` except for intentionally circular elements), and to make each component work **robustly in any scenario** (all breakpoints, touch, keyboard, reduced motion, controlled + uncontrolled, loading/empty/error states).

The rules in `.github/agents/components.agent.md` and `CLAUDE.md` are the source of truth. This file tracks the gap between those rules and the current code.

---

## Part 0 — Design system direction

Target aesthetic (unchanged in spirit, tightened in execution):

- **Sharp corners.** `border-radius: 0` on every rectangular element. The only allowed exception is `border-radius: 50%` on intentionally circular elements (spinner rings, slider/range-slider thumbs, stepper indicators, status dots, carousel dots/arrows, lightbox close/arrow buttons, avatars, tree-view bullets, chart dots, skeleton avatars, image-crop circular-mask variant).
- **Flat, high-contrast surfaces.** White (`#ffffff`) panels on `#f8fafc` page background. Single 1px border in `#e2e8f0`. No layered soft shadows — one subtle shadow token (`0 2px 8px rgba(15, 23, 42, 0.06)`) for elevated surfaces only.
- **Monochrome neutrals + accent.** `#1e293b` text, `#64748b` muted, `#94a3b8` faint, brand accent for a single focal element per surface. No gradient decorations on new components.
- **Consistent spacing scale:** `4 · 8 · 12 · 16 · 24 · 32 · 48 · 64` px. No ad-hoc values like `10px`, `18px`, `30px`.
- **Typography scale (body root = 16px):** `0.75rem` (xs) · `0.8125rem` (sm) · `0.875rem` (md) · `1rem` (base) · `1.125rem` (lg) · `1.25rem` (xl). Line-height 1.5 for body, 1.25 for headings.
- **Motion:** micro-interactions `0.15s ease`; layout transitions `0.2s cubic-bezier(0.4, 0, 0.2, 1)`; always paired with a `prefers-reduced-motion: reduce` override.

---

## Part 1 — Global / cross-cutting tasks

These apply across the whole package. Do these first — many per-component tasks will be resolved by these sweeps.

### 1.1 Introduce a single design-token layer

- [x] Add `style/_tokens.scss` with CSS custom properties on `:root`:
  - Colors: `--tc-bg`, `--tc-surface`, `--tc-surface-muted`, `--tc-border`, `--tc-border-strong`, `--tc-text`, `--tc-text-muted`, `--tc-text-faint`, `--tc-accent`, `--tc-accent-hover`, `--tc-danger`, `--tc-success`, `--tc-warning`, `--tc-info`.
  - Spacing: `--tc-space-1` … `--tc-space-12` (4px multiples).
  - Typography: `--tc-font-xs` … `--tc-font-xl`, `--tc-font-weight-regular/medium/semibold`.
  - Motion: `--tc-transition-fast`, `--tc-transition-base`, `--tc-ease-standard`.
  - Z-index: mirror the table in `CLAUDE.md`.
  - Shadow: `--tc-shadow-sm`, `--tc-shadow-md` (only two).
- [x] Load `_tokens.scss` from `style/index.scss` before every `@use './components/...'`.
- [ ] Migrate every existing component-local custom property (`--at-*`, `--pg-*`, `--rc-*`, etc.) to read from the global tokens. Keep component-local overrides only for values that truly diverge.

### 1.2 Eliminate all non-circular `border-radius`

Every one of the following files has a non-zero `border-radius` on a rectangular element. Change each to `0`, remove the associated `--*-radius` custom property, and verify visually in the examples app.

- [x] `style/components/_build.scss` (line 14: `border-radius: 6px`) → `0`
- [x] `style/components/_group.scss` (lines 16, 29, 54, 68) → all `0`. The `__badge` at line 54 (`10px`) is currently pill-shaped; the sharp-design rule makes it rectangular.
- [x] `style/components/_popover.scss` (lines 7, 18) → drop `--pop-radius`, set `border-radius: 0`.
- [x] `style/components/_banner.scss` (lines 5, 20, 56) → drop `--bn-radius`, set `0`.
- [x] `style/components/_pagination.scss` (line 41: `8px`) → `0`.
- [x] `style/components/_file.scss` (lines 9, 37: `6px`) → `0`.
- [x] `style/components/_file-dropzone.scss` (lines 10, 53: `8px`, `6px`) → `0`.
- [x] `style/components/_drawer.scss` (line 150: `var(--rc-radius-sm, 4px)`) → `0`.
- [x] `style/components/_advanced-table.scss` (line 145: `3px`) → `0`.
- [x] `style/components/_toast.scss` (lines 75, 89, 173) → `0`; drop `--ti-radius`.
- [x] `style/components/_dashboard-card.scss` (line 7: `18px`) → `0`. This is the biggest visual change in the library — confirm before merging.
- [x] `style/components/_modal.scss` (lines 96, 97, 143, 144: `12px` on top/bottom corners) → `0`.
- [x] `style/components/_toggle-card.scss` (line 7: `--tc-radius: 8px`) → `0`.
- [x] `style/components/_color-picker.scss` (line 11: `--cp-radius: 8px`) → `0`.
- [x] `style/components/_card-options.scss` (line 11: `--co-radius: 8px`) → `0`.
- [x] `style/components/_pricing-card.scss` (line 9: `--pricing-card-radius: 20px`) → `0`. This card is currently the most "rounded" element in the library; removing the radius is a substantial redesign signal.
- [x] `style/components/_image-crop.scss` (line 17: `var(--ic-radius)` on the frame) → `0`. The circular-mask variant at line 34 stays `50%`.
- [x] `style/components/_slider.scss` (line 144: `1px` on the filled track) → `0`.
- [x] `style/components/_virtual-list.scss` (line 20: `100px` on scrollbar thumb) → `0`. Pill scrollbars are inconsistent with the rest of the package.

Sweep-verify after the above: `grep -rn "border-radius" style/components/ | grep -v ": 0" | grep -v ": 50%"` should return only the documented circular exceptions.

### 1.3 Normalize focus state

- [x] Remove every `outline: none` that isn't immediately followed by a replacement `:focus-visible` rule. Offenders (22 sites):
  - `_lightbox.scss:39`, `_color-picker.scss:84`, `_phone-input.scss:90,133`, `_carousel.scss:16`, `_markdown-editor.scss:123`, `_command-palette.scss:72,142`, `_editable-text.scss:15,18`, `_file.scss:101`, `_resizable-panel.scss:52`, `_context-menu.scss:63`, `_number-input.scss:105`, `_json-editor.scss:38,59,285`, `_extended-select.scss:117`, `_otp-input.scss:40`, `_form.scss:9`, `_json-schema-def.scss:23,57`, `_file-tags.scss:139`, `_icon-picker.scss:67`, `_tag-input.scss:89`.
- [x] Standard focus ring: `outline: 2px solid var(--tc-accent, #1e293b); outline-offset: 2px;` on `:focus-visible`. Never `box-shadow`-only focus rings on interactive elements.

### 1.4 Reduced-motion coverage

Only 27 of 103 stylesheets include a `prefers-reduced-motion` block. Any component that uses `transition:`, `animation:`, or `transform` needs one. Priority files (have motion, missing the override):

- [x] `_build.scss` (blink animation) — explicit `animation: none` override.
- [x] `_toggle-card.scss`, `_color-picker.scss`, `_stepper.scss`, `_phone-input.scss`, `_image-crop.scss`, `_breadcrumb.scss`, `_scroll-area.scss`, `_markdown-editor.scss`, `_tag.scss`, `_changelog.scss`, `_label.scss`, `_form-wizard.scss`, `_tree-view.scss` — covered by the global catch-all in `style/_reduced-motion.scss`.
- [x] Sweep the rest: added `style/_reduced-motion.scss` that reduces animation/transition-duration to 0.01ms and iteration-count to 1 for every `.component` and descendants. Explicit per-component `@media (prefers-reduced-motion)` blocks still work and take precedence.

### 1.5 Touch targets ≥ 44 × 44 px on `pointer: coarse`

Interactive elements currently under 44px (WCAG 2.5.5):

- [x] `_toggle-card.scss` — whole card now has `min-height: 44px` on coarse pointer (icon stays decorative 28px).
- [x] `_color-picker.scss` — swatch option `__option` now 44×44 on coarse pointer.
- [x] `_image-crop.scss` — `__zoom-btn` min 44×44 on coarse pointer.
- [x] `_markdown-editor.scss` — `__toolbar-btn` min 44×44 on coarse pointer.
- [x] `_json-editor.scss` — `__input`, `__select`, `__primitive-input`, `__primitive-remove` all min 44px on coarse pointer.
- [ ] `_dashboard-card.scss:287,393` — on re-check these are decorative icons/sparkline, not interactive. Leaving as-is; re-list if specific buttons show up.
- [x] `_json-schema-def.scss` — `__remove` min 44×44 on coarse pointer.
- [x] `_tag-input.scss` — `__input` min 44px on coarse pointer.
- [x] `_tree-view.scss` — row min 44px on coarse pointer.
- [ ] Broader sweep: many more stylesheets still lack explicit `pointer: coarse` rules. Left for later per-component work when each component is audited.

### 1.6 Spacing and sizing normalization

- [x] Replace ad-hoc padding/margin values with the 4px-multiple scale in priority files (`_build.scss`, `_group.scss`, `_queued-file.scss`, `_file.scss`). Broader sweep across remaining files stays open for per-component passes.
- [x] Replace `line-height: 30px` hacks in `_build.scss`, `_file.scss`, `_queued-file.scss` with normal line-heights (the parent flex container already handles vertical centering).
- [x] Replace hard-coded neutrals in those four files with the token palette (`var(--tc-surface)`, `var(--tc-surface-hover)`, `var(--tc-surface-muted)`, `var(--tc-border)`, `var(--tc-text)`, `var(--tc-text-muted)`).

### 1.7 Accessibility sweep

- [ ] Only 27 of 110 components currently call `useId()`. Every form input, every listbox trigger, every dialog, every tablist, every accordion header needs one. Audit targets (no `useId`): `Checkbox`, `CheckboxGroup`, `Radio`, `RadioGroup`, `Switch`, `Rating`, `Slider`, `RangeSlider`, `Dropdown`, `Select`, `ExtendedSelect`, `DatePicker`, `TimePicker`, `ColorDropdown`, `ColorPicker`, `IconPicker`, `TagInput`, `Textarea`, `PhoneInput`, `OTPInput`, `NumberInput`, `TreeView`, `Accordion`, `TabSections`, `Stepper`, `FormWizard`, `CommandPalette`, `Popover`, `Tooltip`, `ContextMenu`, `Drawer`, `Modal.Window`, `Lightbox`, `ImageCrop`, `Carousel`, `MarkdownEditor`, `JSONEditor`, `EditableText`, `PhoneInput`.
- [ ] Every dialog-like surface (`Drawer`, `Modal.Window`, `Lightbox`, `CommandPalette`, `ContextMenu` submenus) must set `role`, `aria-modal`, `aria-labelledby`, trap focus, return focus to the trigger on close, and close on `Escape`.
- [ ] Every listbox-like surface (`Dropdown`, `Select`, `ExtendedSelect`, `ColorDropdown`, `IconPicker`, `ContextMenu`) must implement roving `aria-activedescendant`, `role="listbox"`, `role="option"`, `aria-selected`.

### 1.8 Size variants

- [ ] Adopt a consistent `size?: 'sm' | 'md' | 'lg'` prop across inputs and buttons. Components that currently lack one: `Button`, `IconButton`, `Input`, `Textarea`, `NumberInput`, `Select`, `ExtendedSelect`, `DatePicker`, `TimePicker`, `Dropdown`, `Chip`, `Tag`, `Badge`, `Switch`, `Checkbox`, `Radio`. Heights: 32 / 40 / 48 px. 40 is the default. Below 40 swaps to the 44px touch-target rule on `pointer: coarse`.

### 1.9 Loading / empty / error / disabled parity

- [ ] Every data-display component gets: `loading?` (renders `<Skeleton />`), `error?` (renders a structured error), `empty?` (renders `<EmptyState />`), `disabled?`. Apply to: `AdvancedTable`, `Table`, `Accordion`, `TreeView`, `VirtualList`, `InfiniteScroll`, `TabSections`, `Stepper`, `FormWizard`, `Timeline`, `Changelog`, `Carousel`, `Chart/*`, `DashboardCard/*`, `UserPanel`, `UsageSummaryPanel`, `CommandPalette`, `VerticalItemList`.
- [ ] Every single input gets a consistent disabled style: `opacity: 0.6; cursor: not-allowed; pointer-events: none;` plus `aria-disabled={true}`.

### 1.10 Controlled / uncontrolled parity

- [ ] Every input-like component supports both controlled (`value` + `onChange`) and uncontrolled (`defaultValue`). Audit: `Input`, `Textarea`, `NumberInput`, `Select`, `ExtendedSelect`, `DatePicker`, `TimePicker`, `Checkbox`, `Radio`, `Switch`, `Slider`, `RangeSlider`, `Rating`, `ColorPicker`, `PhoneInput`, `OTPInput`, `TagInput`, `EditableText`, `Accordion`, `TabSections`, `Stepper`, `TreeView`.

### 1.11 Examples app parity

- [ ] Every component must have a demo in `examples/src/react-components/{Name}Demo.tsx` showing: all size variants, disabled, loading, error, empty (where applicable), small/md/desktop viewports. Components missing demos or missing variant coverage should be identified by walking `examples/src/react-components/index.tsx`.

---

## Part 2 — Component-level tasks

Grouped by category. Each entry only lists *what changes beyond the global sweeps in Part 1*.

### 2.1 Buttons, actions, triggers

- [ ] **Button** — add `size`, `loading` (renders inline spinner + disables), `iconLeading` / `iconTrailing`, `fullWidth`. Loading state must keep width fixed.
- [ ] **IconButton** — same `size` tokens as Button, enforce 32 / 40 / 48 px square. Add `tooltip?` prop that wires up a `Tooltip` wrapper and an `aria-label`.
- [ ] **CoolButton** — audit: feels like a branded/hero button; either fold into `Button` as `variant="accent"` or clearly scope it as a marketing-only component (document in `SKILL.md`).
- [ ] **Build** — sharp corners per 1.2. Replace blink animation with a single animated status chip (reduced-motion safe). Fix alignment hacks (`line-height: 30px`). Add `onClick` + `onSelect`; wire `role="button"` and keyboard `Enter/Space` to match click behavior (not just a `div` with a cursor-hover).
- [ ] **Badge** — add semantic variants (`info`, `success`, `warning`, `danger`, `neutral`) with tokenized colors; remove bespoke per-call colors.
- [ ] **Chip** — add `removable` (X icon + `onRemove`), `selected` state, `onClick` wiring. Ensure the chip itself is a `<button>` when interactive.
- [ ] **Tag** — split into display `Tag` (span) vs interactive chip (see above) to avoid ambiguity. Sharp corners.
- [ ] **StatusDot** — add `size` prop (`sm`/`md`/`lg`), `pulse?` animation with reduced-motion fallback, `label?` for screen readers.
- [ ] **Kbd** — sharp corners, tokenize font/shadow, ensure it renders inside `<p>` without breaking line-height.

### 2.2 Form controls

- [ ] **Input** — unify error/helper pattern with `FormInput`. Provide `prefix`/`suffix` slots (non-interactive). Accept `clearable`.
- [ ] **FormInput** — deduplicate with `Input`; they overlap. Either collapse them into one or make `FormInput` the labeled-wrapper composition. Document the distinction in `SKILL.md`.
- [ ] **Textarea** — add `autoResize` (`minRows`/`maxRows`), character counter with `maxLength`, `resize?: 'none'|'vertical'`.
- [ ] **NumberInput** — fix `outline: none` (1.3). Ensure wheel scroll only activates on focus. Add locale-aware formatting option, `precision`, `allowNegative`.
- [ ] **PhoneInput** — fix `outline: none` (1.3). Ship a bundled country list; currently the country dropdown search needs to reuse `ExtendedSelect` patterns (listbox a11y).
- [ ] **OTPInput** — fix `outline: none`. Ensure paste fills across boxes. Add `mask?` for passcodes. Confirm `inputMode="numeric"` + `autoComplete="one-time-code"`.
- [ ] **Select** — review listbox a11y (1.7). Add `searchable` mode that defers to `ExtendedSelect` to avoid duplication.
- [ ] **ExtendedSelect** — fix `outline: none`. Add async loader prop (`loadOptions`, `debounce`), virtualization for >200 options (reuse `VirtualList`).
- [ ] **Dropdown** — clarify distinction vs `Select`: `Dropdown` is an action menu, `Select` is a form control. Enforce this in props and docs. Ensure `Dropdown` items have `role="menuitem"`, not `role="option"`.
- [ ] **ColorDropdown** / **ColorPicker** — drop `--cp-radius`. Add `eyedropper` (EyeDropper API where supported, feature-detected). Ensure H/S/V sliders have `aria-valuetext`.
- [ ] **IconPicker** — already `--ip-radius: 0` (good). Add categorized/searchable picker, virtualization.
- [ ] **DatePicker** — add keyboard nav (arrows day, page-up/down month, shift+page year). `disabledDates` callback. `min`/`max`. `locale` prop.
- [ ] **TimePicker** — 12/24-hour format prop, `step` minutes, `seconds?` toggle. Arrow-key nudge on each column.
- [ ] **Checkbox** / **CheckboxGroup** — add indeterminate, `error` prop, `aria-invalid`.
- [ ] **Radio** / **RadioGroup** — roving tabindex; arrow keys move selection within the group (native behavior is OK but verify with custom markup).
- [ ] **Switch** — ensure it's a real `<button role="switch" aria-checked>`. Keyboard Space toggles. `loading` prop.
- [ ] **Slider** / **RangeSlider** — thumbs stay `50%`. Add `marks`, `tooltip-on-drag`, `formatLabel(value)`, `disabled`. `aria-valuenow/min/max/text` on each thumb.
- [ ] **Rating** — confirm `role="radiogroup"` + one `role="radio"` per star. Half-star mouse + keyboard support (Shift+arrow to jump half).
- [ ] **TagInput** — fix `outline: none`. Paste-split on delimiter prop. `max` prop. Validation callback.
- [ ] **EditableText** — fix `outline: none`. Auto-grow; escape reverts, enter commits; `validate` prop.
- [ ] **Form** / **FormWizard** — remove `outline: none` on the form. `FormWizard` already uses `--fw-radius: 0` (good). Add step validation hook, allow async-on-next with a spinner.

### 2.3 Overlays & popovers

- [ ] **Modal** — sharp corners (1.2). Ensure focus trap, return focus, `Escape` close, `aria-modal`. Add `size` variants (`sm`/`md`/`lg`/`fullscreen`) with mobile fullscreen at `<576px`.
- [ ] **Drawer** — sharp corners. Mobile default = full-height right drawer; add `swipe-to-close` on `pointer: coarse`.
- [ ] **Popover** — drop `--pop-radius` (1.2). Consider adopting Floating UI for collision handling (12 placements, auto-flip, auto-shift) per `future_components.md`.
- [ ] **Tooltip** — delay prop (open/close), `aria-describedby` wiring. Ensure it never blocks hover.
- [ ] **ContextMenu** — fix `outline: none`. Nested submenus with keyboard (`ArrowRight` opens, `ArrowLeft` closes). Dividers and `disabled` items.
- [ ] **CommandPalette** — fix `outline: none` (2 sites). Fuzzy search with highlighted matches, grouped results, recents, registration API so callers can add commands from feature modules.
- [ ] **Lightbox** — fix `outline: none`. Keyboard: arrows navigate, `Escape` closes, `+`/`-` zoom. Preload next/prev image.
- [ ] **Toast** — sharp corners, drop `--ti-radius`. Confirm `role="status"` (info/success) vs `role="alert"` (error/warning). Pause-on-hover and pause-on-focus, queue max.

### 2.4 Navigation

- [ ] **Breadcrumb** — already has `--bc-transition`. Collapse overflow into `…` with a popover that lists hidden items. `aria-current="page"` on the last item.
- [ ] **Pagination** — sharp corners (1.2). Compact variant for mobile (`Prev · n/total · Next`). Keyboard: left/right arrows navigate pages when container is focused.
- [ ] **TabSections** — ensure `role="tablist" / tab / tabpanel`. Arrow keys for roving focus, `Home/End` to jump ends. Horizontal-scroll overflow on narrow screens.
- [ ] **Stepper** — sharp corners on connectors; indicators stay circular. Add `vertical` orientation. `onStepClick` only when step is non-linear; otherwise read-only.
- [ ] **SideNav** — collapsed-icon-only mode; keyboard navigation across groups; `aria-current="page"` on the active item; hover-expand on collapsed state.
- [ ] **CoolNav** — same audit as `CoolButton`: decide if it's a marketing nav or a generic one. If marketing-only, document scope in `SKILL.md`.
- [ ] **Link** — ensure `external` links set `rel="noopener noreferrer"` and a visual indicator for external. Underline-on-focus-visible.
- [ ] **VerticalItemList** — ensure keyboard nav and `aria-current`. Selection state style.

### 2.5 Data display

- [ ] **Table** — add sticky header, column resize, empty state slot, `onRowClick` with keyboard (`Enter` on focused row), `rowKey` required.
- [ ] **AdvancedTable** — sharp corners (1.2). Column visibility menu, saved views (controlled), server-side sort/filter/paginate callbacks, virtualization mode for `>500` rows. Confirm `aria-sort` on sortable headers.
- [ ] **VirtualList** — sharp corners on scrollbar (1.2). Expose `overscan`, `getItemKey`, `estimateSize` props; handle dynamic row heights.
- [ ] **InfiniteScroll** — IntersectionObserver-based (not scroll listener). `hasMore`, `loader`, `endMessage`, `error + retry` slots.
- [ ] **Accordion** — animate height with `grid-template-rows: 0fr → 1fr` trick (reduced-motion safe). `allowMultiple`, `defaultOpenIndex`, `iconPosition`.
- [ ] **TreeView** — sharp corners on rows; bullets stay circular. Arrow keys: `→` expand, `←` collapse, `↑/↓` move focus. Multi-select with shift-click. Async children.
- [ ] **Timeline** — vertical + horizontal orientation, `item.state` (`completed`, `active`, `error`), responsive stacking.
- [ ] **Changelog** — fold into `Timeline` or keep as opinionated variant — document the difference in `SKILL.md`.
- [ ] **Avatar** — circular (stays `50%`). Add `status` badge (online/offline/away), `group` / stacking variant, fallback initials color from hashed name.
- [ ] **Skeleton** — add `variant: 'text' | 'rect' | 'circle'`, `lines` prop for text. Shimmer respects reduced motion.
- [ ] **Spinner** — stays `50%`. Tokenize sizes (`sm`/`md`/`lg`).
- [ ] **ProgressBar** — sharp corners, `indeterminate` mode with reduced-motion override. `aria-valuenow/min/max`.
- [ ] **Carousel** — fix `outline: none`. Arrows stay circular. Autoplay pause-on-hover / pause-on-focus. Swipe on touch. `items-per-view` per breakpoint.
- [ ] **Divider** — add `orientation: 'horizontal' | 'vertical'`, optional label slot.
- [ ] **Heading** / **Text** — enforce the typography scale from 0. `Text` gets `as`, `variant`, `muted`, `truncate`, `lines` (clamp).
- [ ] **Label** — consolidate with the label rendered by `FormInput` to avoid two label systems.
- [ ] **HelperText** — align visual style with `FormInput` error text; single source of truth for field messages.
- [ ] **Spacer** — ensure spacing prop accepts token names (`1..12`), not raw pixels.
- [ ] **VisuallyHidden** — already correct; verify it's used across the package for SR-only labels.

### 2.6 Layouts & shells

- [ ] **BasicLayout** / **DashboardLayout** — audit header/side/content slots. Ensure content area is the scroll container (not `body`). Document in `SKILL.md` which slots are required.
- [ ] **DashboardCard** / **Chart** — sharp corners on every card (1.2). Standardize header (title + subtitle + actions slot), loading overlay, empty state.
- [ ] **Hero** — responsive stacking; min-height 360 is OK but add `variant: 'compact' | 'default'`.
- [ ] **Card** — already simple. Confirm sharp corners, single shadow token, consistent padding scale.
- [ ] **CardOptions** — drop `--co-radius`. Treat as a selectable card group; wire `role="radiogroup"` if single-select, `role="group"` with checkboxes if multi.
- [ ] **ToggleCard** — drop `--tc-radius`. Interactive; must be keyboard-operable.
- [ ] **SingleCardSelect** / **MultiCardSelect** — formalize `value`/`onChange`, `required`, `error`.
- [ ] **PricingCard** — biggest redesign from sharp-corners pass (was `20px`). Compose a featured-variant via token, not a separate radius.
- [ ] **PinnedFeatureShowcase**, **EarlySignupForm**, **Login**, **WelcomeGuide**, **PageFooter**, **Brand** — marketing-leaning components. Confirm each is scoped marketing in `SKILL.md` so it's clear they're not generic primitives.

### 2.7 Files & media

- [ ] **File** / **SimpleFile** / **QueuedFile** — sharp corners (1.2). Unify list-item row height via the size scale. Ensure progress indicator respects reduced motion.
- [ ] **FileDropzone** / **Dropzone** — sharp corners. Accept `accept`, `maxSize`, `multiple`, `onReject(reason)`. Fully keyboard operable (Enter/Space opens picker).
- [ ] **FileTags** — fix `outline: none`.
- [ ] **Image** — add `aspectRatio`, `fit` (`cover`/`contain`), skeleton placeholder, `onError` fallback.
- [ ] **ImageCrop** — drop `--ic-radius` on the frame (circular-mask variant stays `50%`). Keyboard nudge (arrows), `aspectRatio` lock.
- [ ] **AssetBundle** — clarify purpose (seems domain-specific). If not generic, document scope in `SKILL.md`.
- [ ] **BitmapFontGenerator**, **NodeEditor**, **JSONEditor**, **JSONSchemaDef** — domain tools. Fix `outline: none` sweeps in each. Split from generic components in `SKILL.md` so consumers know these are heavyweight.
- [ ] **MarkdownEditor** — fix `outline: none`. Toolbar buttons need tooltips + 44px touch targets (1.5). Split editor + preview responsively.

### 2.8 Banners & callouts

- [ ] **Alert** — variants `info/success/warning/danger`, optional dismiss, `icon` override. `role="status"` vs `role="alert"` by severity.
- [ ] **Banner** — drop `--bn-radius` (1.2). Full-width, sticky top/bottom variant, dismissible with persisted state (callers manage).
- [ ] **EmptyState** — standardized layout: illustration/icon slot, title, description, primary action, secondary link. Replace ad-hoc empty states across `AdvancedTable`, `CommandPalette`, etc.
- [ ] **DangerZoneActions** — confirm it renders critical actions with two-step confirmation. Sharp corners.
- [ ] **UsageSummaryPanel** / **UserPanel** — standardize with `DashboardCard` header pattern.

### 2.9 Charts

Path: `src/Chart/`. Chart-specific CSS at `style/components/_chart.scss`.

- [ ] Single `ChartContainer` wrapper for every chart (title, period selector, legend, export, empty, error, loading). Remove per-chart bespoke headers.
- [ ] Tokenize the chart color palette from `style/_colors.scss` into `--tc-chart-1 … --tc-chart-8`.
- [ ] Confirm all dots stay `50%` (1.2). No rounded bars in `BarChart`.
- [ ] Every chart renders an accessible data-table fallback (SR-only, via `VisuallyHidden`) summarizing the data.
- [ ] Animations respect `prefers-reduced-motion`.

### 2.10 Modal subsystem

Path: `src/modal/`. Namespace exports `Modal.Window`, `Modal.Context`, `Modal.Control`, hooks.

- [ ] Sharp corners on `Modal.Window` (1.2).
- [ ] Consolidate z-index from tokens (backdrop 1050, content 1055).
- [ ] Document in `SKILL.md` the mental model: `Modal.Context` provider at the app root, `Modal.Control` registers a modal, `useModal()` opens it imperatively. Confirm this matches the implementation.

---

## Part 3 — Housekeeping

- [ ] Update `SKILL.md` after each component changes — props tables and examples must reflect new props, size variants, and the sharp-corner aesthetic.
- [ ] Update every demo in `examples/src/react-components/` to show size variants, disabled, loading, error states.
- [ ] Visual-regression pass: walk every demo at 375 / 576 / 768 / 992 / 1200 px in the dev server (`npm run dev -w @toolcase/examples`) and capture before/after screenshots for the ones touched by 1.2 (sharp corners).
- [ ] After the sharp-corner sweep, remove the `--*-radius` custom properties entirely and search for any remaining `border-radius` declarations on rectangles: `grep -rn "border-radius" style/components/ | grep -v ": 0" | grep -v ": 50%"` should return empty.
- [ ] Delete `future_components.md` entries as they ship; keep that file in sync with this one so the "what's done" table stays accurate.

---

## Part 4 — Suggested execution order

1. **Foundation** (1.1, 1.2, 1.3, 1.4, 1.5, 1.6). These are mechanical sweeps; most of the visual consistency lands here.
2. **Accessibility** (1.7, and the per-component a11y items in 2.1–2.5).
3. **Consistency props** (1.8, 1.9, 1.10). Touches many files; do as a single coordinated pass per component family (e.g., all form controls together).
4. **Demo + SKILL.md updates** (Part 3). Do each alongside the component change that caused it — don't batch at the end.
5. **Chart subsystem** (2.9). Isolated to `src/Chart/` and `_chart.scss`, safe to do in parallel.
