# components.agent.md — AI Guide for Generating Components

This file is the authoritative guide for any AI agent generating or modifying components in `@toolcase/react-components`. Follow every rule here exactly. If something is ambiguous, choose the most conservative option and ask.

---

## 1. Repository Layout

```
src/                    ← One .tsx file per component (PascalCase)
  ComponentName.tsx
  hooks/                ← Shared hooks (e.g. useClickOutside)
  modal/                ← Multi-file subsystem (ModalContext, ModalRender, Window, hooks, index)
style/
  _brand.scss           ← Primary gradient mixin + gradient variables
  _colors.scss          ← Full color palette ($gray-50…$gray-900, etc.)
  _reset.scss           ← Bootstrap resets (border-radius, outline)
  _z-index.scss         ← Z-index token map
  components/           ← One _component-name.scss per component
    index.scss          ← @forward / @use all component files
  layouts/              ← One _layout-name.scss per layout
    index.scss
  index.scss            ← Root entry that @use all partials
```

**Rules:**
- Every new component = one `.tsx` in `src/` + one `_component-name.scss` in `style/components/`.
- Add the SCSS file to `style/components/index.scss`.
- Add the export to `src/index.ts`.
- Never import SCSS inside `.tsx` files.
- **Final step:** Add a demo in `examples/src/react-components/{ComponentName}Demo.tsx` and register it in `examples/src/react-components/index.tsx`.

---

## 2. TypeScript Patterns

### Interface

```tsx
// ✅ Extend HTML attributes when the root element is an HTML element
export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    children?: React.ReactNode
    variant?: 'primary' | 'secondary' | 'danger'
    size?: 'small' | 'default' | 'large'
}

// ✅ Use Omit when overriding an existing HTML attribute with a different type
export interface DropdownProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'onChange'> {
    onChange?: (key: string) => void
}
```

### Component declaration

```tsx
// ✅ Use React.FC for components that don't need ref forwarding
export const Badge: React.FC<BadgeProps> = ({ ... }) => { ... }

// ✅ Use React.forwardRef when the root is an HTML element that callers may ref
export const Input = React.forwardRef<HTMLInputElement, InputProps>(({ ... }, ref) => { ... })
Input.displayName = 'Input'
```

### ID generation

```tsx
// ✅ Always use useId() — never require callers to pass IDs
const generatedId = useId()
const inputId = props.id ?? generatedId
const errorId = error ? `${inputId}-error` : undefined
```

### Controlled / uncontrolled

- Prefer fully controlled components (`value` + `onChange`).
- Never mix controlled and uncontrolled state in the same component.
- `onChange` callbacks should be typed precisely — not `React.ChangeEvent<HTMLInputElement>` when the contract is `(value: string) => void`.

---

## 3. CSS Class Naming Convention

All class names follow a strict BEM-style prefix scheme:

```
.component                          ← always present on the root element (joint class)
.component-{name}                   ← root modifier namespace (joint class with .component)
.component-{name}__{part}          ← child element
.component-{name}--{modifier}      ← state or variant modifier on root
.component-{name}__{part}--{state} ← state on a child
```

**Root element always gets two classes:**
```tsx
<div className={`component component-dropdown ${className || ''}`}>
```

**Example:**
```html
<div class="component component-dropdown component-dropdown--open">
  <button class="component-dropdown__trigger">…</button>
  <ul class="component-dropdown__list">
    <li class="component-dropdown__option component-dropdown__option--active">…</li>
    <li class="component-dropdown__option component-dropdown__option--disabled">…</li>
  </ul>
</div>
```

**Do not:**
- Use Tailwind utility classes in component `.tsx` files
- Use inline `style` props for anything that could be a CSS class
- Use camelCase class names

---

## 4. SCSS File Structure

Every component SCSS file follows this template:

```scss
// ── ComponentName ───────────────────────────────────────────────────────────

.component.component-{name} {
    // CSS custom properties (design tokens for this component)
    --cn-color: #1e293b;
    --cn-muted: #64748b;
    --cn-border: #e2e8f0;
    --cn-hover-bg: #f8fafc;
    --cn-transition: 0.15s ease;

    // Base layout for root element
    position: relative;
}

.component-{name} {
    // All child selectors nested here

    &__{part} {
        // Child element styles
    }

    // Root modifiers MUST be doubled so they outrank the double-class base
    // block above (`.component.component-{name}` is 0,2,0 — a bare
    // `.component-{name}--{modifier}` at 0,1,0 silently loses and the
    // variant never applies). Guarded by react-components/test/variant-specificity.test.ts.
    &.component-{name}--{modifier} {
        // Root modifier styles
    }
}

// Responsive overrides — mobile-first ONLY: base styles are the mobile
// layout, wider screens are the exception. Never use max-width queries.
@media (min-width: 768px) {
    .component-{name} { ... }
}
```

### CSS Custom Property naming

Prefix all custom properties with `--{abbreviated-name}-`:

| Component | Prefix |
|-----------|--------|
| Dropdown | `--rc-dropdown-` |
| AdvancedTable | `--at-` |
| Pagination | `--pg-` |
| SideNav | `--side-nav-` |
| FormInput | `--fi-` |
| ExtendedSelect | `--es-` |

Use the pattern `--{abbreviated}-{semantic}` where semantic is one of:
`color`, `muted`, `border`, `bg`, `hover-bg`, `active-color`, `active-border`, `transition`, `shadow`, `radius`.

### Shadow tokens

All elevation shadows **must** use one of the three global tokens — no inline shadow values:

| Token | Value | Use when |
|-------|-------|----------|
| `--tc-shadow-sm` | `0 1px 2px rgba(15, 23, 42, 0.04)` | Subtle lift: cards at rest, small floating elements |
| `--tc-shadow-md` | `0 2px 8px rgba(15, 23, 42, 0.06)` | Dropdown panels, popovers, hover lift |
| `--tc-shadow-lg` | `0 8px 24px rgba(15, 23, 42, 0.10)` | Modals, command palette, drawers, large floating panels |

**Exception:** `box-shadow` values with a zero x/y offset used as focus rings or selection rings (e.g. `0 0 0 3px rgba(...)`) are accessibility indicators, not elevation — keep them as-is.

### Border radius — NEVER use

**Do not add `border-radius` to any component.** All elements use sharp, square corners by design. This is a hard rule, not a preference.

- Do not add `border-radius` to containers, inputs, buttons, dropdowns, panels, tooltips, or any rectangular element.
- Do not define a `--xxx-radius` CSS custom property on components.
- Do not reference `var(--rc-radius-*)` in component files.
- **Exception:** `border-radius: 50%` is allowed only on elements whose shape is intentionally circular (spinner rings, slider thumbs, stepper step indicators, carousel dots and arrow buttons, lightbox close/arrow buttons). These are shape-defining, not decorative rounding.

### Color values (CSS-01 migration complete)

- **Never use raw hex, rgba(), or hsl() color literals in component SCSS.** All colors must reference `var(--tc-*)` tokens from `_tokens.scss`.
- Component-local CSS custom properties must default to a `var(--tc-*)` token, not a literal: `--ac-color: var(--tc-text);` not `--ac-color: #1e293b;`.
- Do NOT import or use `$gray-*`, `$red-*`, `$green-*` or other SCSS palette variables from `_colors.scss` in component files.
- Do NOT reference Bootstrap `--bs-*` CSS variables in component SCSS.
- **Exception:** `box-shadow: 0 0 0 Xpx rgba(...)` focus-ring and selection-ring values are accessibility indicators; keep them as raw rgba — do not replace with shadow tokens.
- Common token reference:

| Intent | Token |
|--------|-------|
| Primary text | `var(--tc-text)` |
| Muted text | `var(--tc-text-muted)` |
| Faint text | `var(--tc-text-faint)` |
| Text on dark bg | `var(--tc-text-inverse)` |
| Page background | `var(--tc-bg)` |
| White surface | `var(--tc-surface)` |
| Hover surface | `var(--tc-surface-hover)` |
| Muted surface | `var(--tc-surface-muted)` |
| Dark (editor) surface | `var(--tc-surface-dark)` |
| Border | `var(--tc-border)` |
| Strong border | `var(--tc-border-strong)` |
| Accent (hover) | `var(--tc-accent-hover)` |
| Violet accent | `var(--tc-violet)` |
| Cyan accent | `var(--tc-cyan)` |
| Brand gradient | `var(--tc-gradient-brand)` |
| Status (success/warning/danger/info) | `var(--tc-success)`, `var(--tc-warning)`, `var(--tc-danger)`, `var(--tc-info)` |
| Status tint bg | `var(--tc-success-tint-bg)` etc. |
| Status tint border | `var(--tc-success-tint-border)` etc. |
| Status tint text | `var(--tc-success-tint-text)` etc. |
| Code syntax | `var(--tc-code-string)`, `var(--tc-code-keyword)`, etc. |
| rgba() with opacity | `rgba(var(--tc-text-rgb), 0.1)` — use `-rgb` channel tokens |

---

## 5. Responsiveness Rules

### Breakpoints

| Name | Value | When to use |
|------|-------|-------------|
| xs | 400px | Very small phones (SE, old Androids) |
| sm | 576px | Phones in portrait |
| md | 768px | Tablets / large phones in landscape |
| lg | 992px | Desktop layout switch |
| xl | 1200px | Wide desktop |

Apply mobile-first: define the base style for mobile, override for larger screens.

```scss
// ✅ Mobile-first
.component-card {
    padding: 0.75rem;           // mobile
    @media (min-width: 576px) {
        padding: 1.25rem;       // tablet+
    }
}

// ❌ Desktop-first (don't do this)
.component-card {
    padding: 1.25rem;
    @media (max-width: 576px) {
        padding: 0.75rem;
    }
}
```

### Touch targets

On `@media (pointer: coarse)` all clickable/tappable elements must be `min-width: 44px; min-height: 44px` (WCAG 2.5.5).

### Scrollable containers

```scss
overflow-x: auto;
-webkit-overflow-scrolling: touch;
scrollbar-width: thin;
```

---

## 6. Accessibility Requirements (Non-Negotiable)

Every component must follow these rules before being considered complete:

### Form controls
- Every input must have an associated `<label>` via `htmlFor` / `useId()`.
- Error state: add `aria-invalid={true}` and `aria-describedby={errorId}` pointing to the error message element.
- Required fields: add `aria-required={true}` on the input, and visually indicate with an asterisk.

### Interactive elements
- All interactive non-button elements that act as buttons must have `role="button"` and `tabIndex={0}`.
- All buttons must be actual `<button>` elements (not `<div>` or `<span>`).
- Focus ring: every interactive element must have a visible `:focus-visible` style — use `outline: var(--tc-focus-outline); outline-offset: var(--tc-focus-offset)` (tokens defined in `_tokens.scss`; values are `2px solid var(--tc-accent)` / `2px`).
- Never remove focus ring without providing an equivalent visible alternative.

### Dropdowns / listboxes
```tsx
// Trigger button
aria-expanded={open}
aria-haspopup="listbox"
aria-controls={listId}
aria-activedescendant={activeItemId}

// List
role="listbox"
id={listId}

// Item
role="option"
aria-selected={isActive}
aria-disabled={isDisabled || undefined}
```

### Dialogs (Modal)
```tsx
role="dialog"
aria-modal="true"
aria-labelledby={titleId}   // ID of the modal's <h*> title element
tabIndex={-1}               // so it can receive programmatic focus
```
On open: move focus into the dialog (`ref.current?.focus()`).  
On close: return focus to the trigger element.

### Sortable tables
```tsx
// On the <th> button when column is sortable:
aria-sort={col.sortDir ?? 'none'}  // 'ascending' | 'descending' | 'none'
```

### Icons
```tsx
// Decorative icon (has adjacent text label)
<Icon name="chevron-down" aria-hidden={true} />

// Standalone icon (no text label)
<Icon name="close" aria-label="Close" />
```

### Live regions
```tsx
// Status messages that update dynamically
<div role="status" aria-live="polite">Loading…</div>

// Urgent error messages
<div role="alert" aria-live="assertive">Error occurred</div>
```

---

## 7. State Patterns

### Loading state

Use the `<Skeleton />` component — not spinners — for field-level loading states.  
Use `<Spinner />` for overlay/full-component loading.

```tsx
if (loading) {
    return (
        <div className={rootClassName}>
            <Skeleton />
        </div>
    )
}
```

### Error state

```tsx
{error && (
    <div id={errorId} className="invalid-feedback d-block">
        {error}
    </div>
)}
```

### Open/closed state (dropdowns, modals)

```tsx
const [open, setOpen] = useState(false)
useClickOutside(containerRef, () => setOpen(false))
```

Always handle `Escape` key to close:
```tsx
if (e.key === 'Escape') {
    setOpen(false)
}
```

---

## 8. Animation Rules

- Use `transition: {property} 0.15s ease` for micro-interactions (color, border, opacity).
- Use `transition: {property} 0.2s cubic-bezier(0.4, 0, 0.2, 1)` for layout transitions (height, width, transform).
- Use `@keyframes` with `animation: name 0.15s ease-out` for enter animations.

### Reduced motion

`style/_reduced-motion.scss` is a **global catch-all** — it sets `animation-duration: 0.01ms` and `transition-duration: 0.01ms` on every `.component *` element whenever `prefers-reduced-motion: reduce` is active. **No per-component block is required for one-shot transitions or enter animations.**

Per-component `@media (prefers-reduced-motion: reduce)` blocks are required only for **infinite/looping `@keyframes`** (e.g. spin, pulse, marquee). Use `animation: none` to stop the loop entirely — "near-instant" is not acceptable for infinite motion:

```scss
@media (prefers-reduced-motion: reduce) {
    .component-{name} {
        animation: none;
    }
}
```

The shared `%reduced-motion` placeholder in `_tokens.scss` sets `animation: none !important; transition: none !important;` and can be extended within a `@media (prefers-reduced-motion: reduce)` block after `@use '../tokens'`.

---

## 9. Z-Index Layers

Do not invent z-index values. Use these defined layers:

| Layer | Value | Usage |
|-------|-------|-------|
| Dropdown list | 1060 | Above modal (1050) |
| Modal backdrop | 1050 | Page overlay |
| Modal content | 1055 | Inside backdrop |
| Sticky header | 1 | Table/nav sticky |
| Overlay | 1000 | Sidebar overlay on mobile |
| Tooltip | 1070 | Above dropdowns |

---

## 10. Do / Don't Reference

| ✅ Do | ❌ Don't |
|-------|---------|
| `useId()` for all generated IDs | Pass IDs from outside unless forwarding HTML props |
| `React.forwardRef` when root is an HTML element | Use `forwardRef` on wrapper/layout components |
| Extend HTML attributes with `extends React.{X}HTMLAttributes<{Y}>` | Write custom `onClick`, `className`, `style` props that duplicate HTML attrs |
| Use `role`, `aria-*` attributes directly in JSX | Add accessibility as an afterthought |
| Mobile-first SCSS (`min-width` media queries) | Desktop-first (`max-width` overrides on mobile) |
| Semantic color tokens (`--cn-border`, `--cn-muted`) | Hardcode hex values in component JSX styles |
| `children` as the primary content slot | Both `label` and `children` as parallel content slots |
| One SCSS file per component | Put all styles in one global file |
| `min-height: 44px` on touch targets | Fixed `height: 36px` on interactive elements |
| `outline: 2px solid ... ` on `:focus-visible` | `outline: none` without a replacement |
| Sharp square corners everywhere | `border-radius` on any rectangular element |

---

## 11. SKILL.md Updates

When you add or modify a component, update [examples/public/SKILL.md](../../examples/public/SKILL.md):

1. Add the component to the Table of Contents under the correct category.
2. Add a `### ComponentName` section with:
   - One-line description
   - Props table: `| Prop | Type | Required | Description |`
   - Minimal usage example in a `tsx` code block
3. Use ✅ for required props, ❌ for optional.
4. Keep examples minimal — show the most common usage, not every prop.

---

## 12. Demo in @toolcase/examples (Required Final Step)

Every new component **must** have a demo before it is considered done.

### File location
```
examples/src/react-components/{ComponentName}Demo.tsx
```

### Registration
1. Import the demo in `examples/src/react-components/index.tsx` under the correct comment group (`Simple`, `Form`, `Layout / Container`, `Complex`, etc.).
2. Add an entry to the `examples` array:
```tsx
{ key: 'component-name', category: 'Layout / Container', element: <ComponentNameDemo /> },
```

### Demo structure
- Use Bootstrap grid (`container`, `row`, `col-lg-8`) — same pattern as existing demos.
- Wrap each variant group in a `<Card>` with a `<h2 className="h5 mb-3">` heading.
- Show every meaningful prop variant (e.g. all `side` values, all `size` values).
- Always include a `<CodeSnippet>` card at the bottom showing minimal usage.
- Use `useState` for any open/close or interactive state needed to trigger the component.

### Example skeleton
```tsx
import React, { useState } from 'react'
import { ComponentName, Button, Card, CodeSnippet } from '@toolcase/react-components'

export const ComponentNameDemo: React.FC = () => {
    const [open, setOpen] = useState(false)

    return (
        <div className="container my-5">
            <div className="row mb-4">
                <div className="col-12">
                    <h1 className="display-4 text-gradient-primary mb-2">ComponentName</h1>
                    <p className="text-muted mb-0">One-line description.</p>
                </div>
            </div>

            <div className="row mb-5">
                <div className="col-lg-8">
                    <Card>
                        <h2 className="h5 mb-3">Default</h2>
                        <Button variant="primary" onClick={() => setOpen(true)}>Open</Button>
                    </Card>
                </div>
            </div>

            <div className="row mb-5">
                <div className="col-12">
                    <Card>
                        <h2 className="h5 mb-3">Usage</h2>
                        <CodeSnippet language="typescript" code={`...`} />
                    </Card>
                </div>
            </div>

            <ComponentName open={open} onClose={() => setOpen(false)} />
        </div>
    )
}
```

---

## 13. Checklist Before Marking a Component Done

- [ ] `.tsx` file exports the component and its prop interface(s)
- [ ] Root element has `component component-{name}` classes
- [ ] All IDs generated with `useId()`
- [ ] All form inputs have `<label htmlFor>` connected
- [ ] All interactive elements have `:focus-visible` styles in SCSS
- [ ] Keyboard navigation works (Tab, Enter/Space, Escape, Arrow keys as appropriate)
- [ ] ARIA roles and attributes are correct
- [ ] `loading` state renders `<Skeleton />`
- [ ] `error` state shows message with `aria-describedby`
- [ ] Responsive at 375px, 576px, 768px, 992px
- [ ] Touch targets ≥ 44px on `@media (pointer: coarse)`
- [ ] `@media (prefers-reduced-motion: reduce)` overrides animations
- [ ] SCSS file added to `style/components/index.scss`
- [ ] Export added to `src/index.ts`
- [ ] examples/public/SKILL.md updated
- [ ] Demo created at `examples/src/react-components/{ComponentName}Demo.tsx`
- [ ] Demo registered in `examples/src/react-components/index.tsx`
