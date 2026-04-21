# react-components — Improvement Tasks

Organized by priority. Each task is self-contained and can be picked up independently.

---

## 🐛 Bugs

### BUG-01 — Button renders both `label` and `children` simultaneously
**File:** [src/Button.tsx](src/Button.tsx)  
**Problem:** `{label || ''}` followed by `{children}` means if both props are passed, both render. `label` was likely intended as an alias for `children`, not a secondary slot.  
**Fix:** Use `children ?? label` so `children` takes precedence and `label` is a fallback only.

### BUG-02 — DashboardLayout sidebar uses `visibility: hidden` instead of `display: none`
**File:** [style/layouts/_dashboard-layout.scss](style/layouts/_dashboard-layout.scss:47)  
**Problem:** Hidden sidebar still occupies a 0px column in the CSS grid but can receive pointer events when the grid column expands briefly. Also, `visibility: hidden` is slower to animate than `display:none` + animation.  
**Fix:** Use `display: none` / `display: block` with a CSS transition on width, or keep `visibility` but add `pointer-events: none` to the hidden state.

### BUG-03 — Dropdown list overflows viewport on small screens
**File:** [style/components/_dropdown.scss](style/components/_dropdown.scss:72)  
**Problem:** The list is `position: absolute` with no maximum height cap adjusted for remaining viewport space. On short screens or when triggered near the bottom, the list renders off-screen.  
**Fix:** Add `max-height: min(240px, 60vh)` so it never exceeds 60% of the viewport height.

### BUG-04 — `component-dropdown` has a hard-coded `max-width: 300px`
**File:** [style/components/_dropdown.scss](style/components/_dropdown.scss:12)  
**Problem:** The wrapper has `max-width: 300px` which truncates the component when used in wider form fields or tables.  
**Fix:** Remove `max-width` from the base class. Consumers can constrain width via layout.

### BUG-05 — ExtendedSelect list has no max-height
**File:** [style/components/_extended-select.scss](style/components/_extended-select.scss)  
**Problem:** The dropdown list has no `max-height` / `overflow-y: auto`, so a large item set renders an infinitely tall list that can extend off-screen.  
**Fix:** Apply `max-height: min(260px, 60vh); overflow-y: auto;` to the list container.

### BUG-06 — `_reset.scss` removes all `outline` and `box-shadow` on focus
**File:** [style/_reset.scss](style/_reset.scss:46)  
**Problem:** `outline: none !important; box-shadow: none !important;` on all interactive elements removes the browser's default focus ring, making keyboard navigation invisible for users who rely on it. Custom `focus-visible` styles do exist on some components but not all.  
**Fix:** Remove the blanket `outline: none` reset. Replace with `:focus { outline: none }` + `:focus-visible { outline: 2px solid var(--focus-ring, #1e293b); outline-offset: 2px; }` so only mouse users lose the ring.

### BUG-07 — Modal backdrop covers the entire viewport but `overflow: visible` on the window allows children to escape the visual container
**File:** [style/components/_modal.scss](style/components/_modal.scss:36)  
**Problem:** `overflow: visible` on `.component-modals__window` is intentional (to allow dropdowns inside modals to overflow) but has no documented constraint — a child positioned outside the window renders on top of the backdrop without any clip.  
**Fix:** Document the current behavior in a comment and ensure the `.modal-body--scrollable` modifier is used for all scrollable modal content. This is a documentation/convention bug.

---

## 📱 Mobile-First & Responsiveness

### MOB-01 — Add missing `xs` breakpoint (< 400px)
**Files:** All SCSS component files  
**Problem:** The smallest breakpoint is `576px`. On small phones (iPhone SE, 375px wide) several components overflow or look cramped.  
**Fix:** Add `@media (max-width: 400px)` blocks for: `Input`, `FormInput`, `Dropdown`, `ExtendedSelect`, `Button`, `Card`, `TabSections`, `Pagination`.

### MOB-02 — Touch targets below 44px on small interactive elements
**Files:** [style/components/_icon-button.scss](style/components/_icon-button.scss), [style/components/_switch.scss](style/components/_switch.scss), [style/components/_chip.scss](style/components/_chip.scss), [style/components/_tag.scss](style/components/_tag.scss)  
**Problem:** WCAG 2.5.5 requires minimum 44×44px touch targets. `IconButton` at `sm` size and `Switch` thumb are under that threshold on mobile.  
**Fix:** On touch devices (`@media (pointer: coarse)`) ensure all interactive elements have `min-width: 44px; min-height: 44px`.

### MOB-03 — FormInput `max-width: 480px` on embedded dropdown/extended-select
**File:** [style/components/_form-input.scss](style/components/_form-input.scss:52)  
**Problem:** `.component-extended-select, .component-dropdown` inside FormInput are capped at `480px` even on small screens where the form is narrower.  
**Fix:** Change to `max-width: min(480px, 100%)` so they never exceed the parent on small screens.

### MOB-04 — TabSections tabs overflow on mobile with no scroll affordance
**File:** [style/components/_tab-sections.scss](style/components/_tab-sections.scss)  
**Problem:** When there are many tabs, they wrap or overflow without a horizontal scroll hint.  
**Fix:** Add `overflow-x: auto; -webkit-overflow-scrolling: touch; scrollbar-width: none;` to the tab bar wrapper, with a fade-out gradient on the right edge to signal more content.

### MOB-05 — DashboardLayout sidebar toggles but navbar stays full-width on mobile
**File:** [style/layouts/_dashboard-layout.scss](style/layouts/_dashboard-layout.scss)  
**Problem:** When sidebar opens on mobile, the navbar's `margin-left: 240px` logic pushes it, but the content area doesn't push — creating an inconsistent layout.  
**Fix:** On mobile (`< 992px`), sidebar should overlay (already partially done via the overlay div) and the navbar should remain at `100%` width without margin adjustment.

### MOB-06 — CoolNav mobile menu has no animation on open/close
**File:** [style/components/_cool-nav.scss](style/components/_cool-nav.scss)  
**Problem:** The Bootstrap collapse behavior is instant on mobile.  
**Fix:** Add a smooth `max-height` transition to `.navbar-collapse` (Bootstrap's `collapsing` class handles this but ensure no SASS conflicts).

### MOB-07 — Table has no row-count limit or scroll indicator on mobile
**File:** [style/components/_table.scss](style/components/_table.scss)  
**Problem:** The shadow scroll indicator only appears at edges of the wrapper, but on a narrow screen the table may still be impossible to read.  
**Fix:** On `< 576px`, add a visible "Scroll to see more →" hint or a mini-map indicator. Alternatively, allow a `stackOnMobile` prop that stacks `<td>` cells vertically using `data-label` attributes.

---

## 🎨 CSS & Visual Modernization

### CSS-01 — Migrate all hardcoded hex colors in component SCSS to CSS custom properties
**Files:** All component SCSS files (particularly `_modal.scss`, `_table.scss`, `_advanced-table.scss`, `_side-nav.scss`, `_dropdown.scss`)  
**Problem:** Colors like `#e2e8f0`, `#1e293b`, `#64748b`, `#f8fafc` are inlined across dozens of files instead of referencing the global `$gray-*` SCSS variables or CSS custom properties.  
**Fix:** Define a set of semantic CSS custom properties at `:root` level (e.g. `--rc-surface`, `--rc-border`, `--rc-text`, `--rc-text-muted`) and replace all hardcoded hex values in component stylesheets. This is also the prerequisite for dark mode.

### CSS-02 — Add dark mode support via `prefers-color-scheme` and `.dark` class
**Files:** [style/_colors.scss](style/_colors.scss), [style/components/index.scss](style/components/index.scss)  
**Problem:** The library has no dark mode. The color token system (`$gray-*`, semantic variables) is ready, but no CSS media query or class overrides exist.  
**Fix:** After CSS-01, add a `@media (prefers-color-scheme: dark)` block and a `.dark` class override that remaps the semantic custom properties to dark values.

### CSS-03 — Remove forced `border-radius: 0 !important` reset
**File:** [style/_reset.scss](style/_reset.scss:42)  
**Problem:** Every Bootstrap element has `border-radius: 0 !important` forced. This makes it impossible to add rounded corners to individual components without fighting specificity.  
**Fix:** Remove `border-radius: 0 !important`. Instead define a `--rc-radius` CSS variable (default: `0`) that each component references, so it can be overridden globally or per-component.

### CSS-04 — Introduce a consistent border-radius scale
**Files:** Global SCSS / [style/_reset.scss](style/_reset.scss)  
**Problem:** Border radii are either forced to 0 or set ad-hoc (e.g. modal header/footer have `12px`, pagination buttons have `8px`, sort icon has `3px`). No scale.  
**Fix:** Define `--rc-radius-sm: 4px`, `--rc-radius-md: 8px`, `--rc-radius-lg: 12px`, `--rc-radius-full: 9999px` and apply consistently.

### CSS-05 — Modernize Button styles
**File:** [src/Button.tsx](src/Button.tsx), Bootstrap button overrides  
**Problem:** Buttons rely entirely on Bootstrap's default classes with no custom styling layer. They look dated and have no `border-radius`, `font-weight`, `letter-spacing`, or `min-width` treatment.  
**Fix:** Add a SCSS file `_button.scss` that applies: border-radius via `--rc-radius-md`, `font-weight: 500`, `letter-spacing: 0.01em`, `min-height: 36px`, subtle `box-shadow` on primary variant, and a `loading` state with an inline spinner.

### CSS-06 — Standardize focus-visible ring across all interactive components
**Files:** All interactive component SCSS files  
**Problem:** Some components have custom `focus-visible` rings (`IconButton`, `Pagination`, `AdvancedTable` sort btn), others have none (Dropdown trigger, ExtendedSelect, TabSections, SideNav links).  
**Fix:** Define a single mixin `@mixin focus-ring { &:focus-visible { outline: 2px solid var(--rc-focus-ring, #1e293b); outline-offset: 2px; } }` and apply to all interactive elements.

### CSS-07 — Input height is hardcoded to 40px
**File:** [style/components/_input.scss](style/components/_input.scss:8)  
**Problem:** `input { height: 40px }` overrides Bootstrap's fluid height and doesn't scale with font-size changes.  
**Fix:** Use `min-height: 2.5rem` and let padding control the visual size. This also improves mobile where `font-size: 1rem` kicks in on `< 575px` (already in `_form-input.scss`).

### CSS-08 — Add subtle card elevation and hover state
**File:** [style/components/_card.scss](style/components/_card.scss)  
**Problem:** Card has `box-shadow: none` and `transform: none` on hover. The result is completely flat — cards are visually indistinguishable from their surroundings in many layouts.  
**Fix:** Add a default `box-shadow: 0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)` and an optional `--card-hover-shadow` for clickable cards.

### CSS-09 — Modernize color palette — shift from Chakra-like values to more neutral/cool tones
**File:** [style/_colors.scss](style/_colors.scss)  
**Problem:** The palette is a near-copy of Chakra UI's color system which is warm-shifted. Many modern design systems use a cooler gray (slate-based) as the primary neutral.  
**Recommendation:** Update `$gray-*` to the Tailwind CSS slate scale (`#f8fafc` → `#0f172a`) which is the same scale already used in individual component SCSS files but not reflected in the global variables.

### CSS-10 — Add smooth skeleton pulse animation
**File:** [style/components/_skeleton.scss](style/components/_skeleton.scss)  
**Problem:** The skeleton loader likely uses a static gray. Modern skeleton loaders use a shimmer / gradient animation.  
**Fix:** Apply a `@keyframes skeleton-pulse` that shifts `background-position` on a gradient from `$gray-100` → `$gray-200` → `$gray-100`.

### CSS-11 — Add `gap` utility support to Group component
**File:** [style/components/_group.scss](style/components/_group.scss)  
**Problem:** Group component spacing may rely on margins. Modern `gap`-based layout is cleaner.  
**Fix:** Ensure Group uses `display: flex; flex-wrap: wrap; gap: var(--group-gap, 0.5rem)` and expose `gap` as a CSS variable.

---

## ♿ Accessibility

### A11Y-01 — AdvancedTable sort buttons missing `aria-sort`
**File:** [src/AdvancedTable.tsx](src/AdvancedTable.tsx)  
**Fix:** Add `aria-sort="ascending" | "descending" | "none"` to column header buttons when sorting is active.

### A11Y-02 — ProgressBar missing ARIA attributes
**File:** [src/ProgressBar.tsx](src/ProgressBar.tsx)  
**Fix:** Add `role="progressbar"`, `aria-valuenow`, `aria-valuemin="0"`, `aria-valuemax="100"`, and `aria-label` or `aria-labelledby`.

### A11Y-03 — Modal missing `aria-labelledby`
**File:** [src/modal/Window.tsx](src/modal/Window.tsx)  
**Fix:** The modal wrapper has `role="dialog"` and `aria-modal="true"` but no `aria-labelledby` pointing to the modal title. Auto-generate an ID for the title and link it.

### A11Y-04 — FileDropzone not keyboard accessible
**File:** [src/FileDropzone.tsx](src/FileDropzone.tsx)  
**Fix:** Add `tabIndex={0}` and `onKeyDown` handling for `Enter` and `Space` to trigger file selection.

### A11Y-05 — Checkbox and Radio missing `useId()` fallback
**Files:** [src/Checkbox.tsx](src/Checkbox.tsx), [src/Radio.tsx](src/Radio.tsx)  
**Problem:** Unlike `Input`, `Checkbox` and `Radio` do not call `useId()` for ID generation — they rely on the caller providing an `id` prop.  
**Fix:** Add `useId()` with the same `props.id ?? generatedId` pattern already used in `Input`.

### A11Y-06 — Switch has no `aria-label` fallback when no label prop
**File:** [src/Switch.tsx](src/Switch.tsx)  
**Fix:** When no `label` prop is passed, require `aria-label` or add a console warning in development.

### A11Y-07 — Tooltip not keyboard-triggerable
**File:** [src/Tooltip.tsx](src/Tooltip.tsx)  
**Problem:** Tooltip likely triggers on `mouseenter`/`mouseleave`. Keyboard users cannot access it.  
**Fix:** Add `onFocus`/`onBlur` handlers to show/hide the tooltip when the trigger element gains/loses focus.

---

## 🛠 DX & Code Quality

### DX-01 — Create `components.agent.md` for AI-assisted component generation
Create a smart reference for AI agents that documents the exact patterns, conventions, and constraints used in this library so generated code is immediately consistent. See separate task.

### DX-02 — Button `label` prop should be deprecated in favor of `children`
**File:** [src/Button.tsx](src/Button.tsx)  
**Fix:** Mark `label` as `@deprecated` in the TypeScript type and update SKILL.md. Components consuming Button should use `children`.

### DX-03 — Textarea wraps in a React Fragment instead of a div
**File:** [src/Textarea.tsx](src/Textarea.tsx)  
**Problem:** Unlike `Input` which returns a `<div className="component component-textarea">`, `Textarea` may return a fragment, making it impossible to target the wrapper with `className`.  
**Fix:** Wrap in `<div className={`component component-textarea ${className}`}>`.

### DX-04 — `dropzone` peer dependency is a beta version
**File:** [package.json](package.json)  
**Problem:** `"dropzone": "^6.0.0-beta.2"` is a pre-release dependency.  
**Fix:** Upgrade to the latest stable Dropzone or replace with a lighter custom implementation.

### DX-05 — Export CSS custom property names as TypeScript constants
Add a `tokens.ts` export that exposes the CSS variable names (e.g. `RC_FOCUS_RING = '--rc-focus-ring'`) so host apps can override them with type safety.

---

## 📋 Summary Counts

| Category | Tasks |
|----------|-------|
| Bugs | 7 |
| Mobile / Responsiveness | 7 |
| CSS & Visual Modernization | 11 |
| Accessibility | 7 |
| DX & Code Quality | 5 |
| **Total** | **37** |
