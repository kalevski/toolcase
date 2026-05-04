# `@toolcase/react-components` Conventions

Pointer to `.github/agents/components.agent.md` — the in-repo authoritative spec — plus key rules condensed for quick reference. When in doubt, open the agent file; this doc is the index.

---

## File layout

Per new component `<Name>` (PascalCase) with kebab classname `component-<kebab>`:

```
react-components/
  src/
    <Name>.tsx
    hooks/                      # if a new hook is needed (rare)
  style/
    components/
      _<kebab>.scss             # all component CSS
      index.scss                # @forward / @use the new partial
```

`src/index.ts` re-exports: `export * from './<Name>'`. Never default-export components.

---

## TypeScript patterns

**Interface — extend HTML attrs:**

```ts
export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    children?: React.ReactNode
    variant?: 'primary' | 'secondary' | 'danger'
    size?: 'small' | 'default' | 'large'
}
```

**Override an HTML attribute with a different shape:**

```ts
export interface DropdownProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'onChange'> {
    onChange?: (key: string) => void
}
```

**Component declaration:**

- `React.FC<Props>` for layout/wrapper components.
- `React.forwardRef<HTMLEl, Props>` when the root is an HTML element a caller may ref. Set `displayName`.

**ID generation — always `useId()`:**

```ts
const generatedId = useId()
const inputId = props.id ?? generatedId
const errorId = error ? `${inputId}-error` : undefined
```

**Controlled vs uncontrolled:** prefer fully controlled (`value` + `onChange`). Never mix. Use precise `onChange` types — not `React.ChangeEvent<HTMLInputElement>` when contract is `(value: string) => void`.

---

## BEM class names

Strict prefix scheme. Source: `.github/agents/components.agent.md` §3.

```
.component                              ← always present on root
.component-{name}                       ← root namespace (joint with .component)
.component-{name}__{part}              ← child element
.component-{name}--{modifier}          ← root state/variant
.component-{name}__{part}--{state}    ← child state
```

**Root always carries both classes:**

```tsx
<div className={`component component-dropdown ${className || ''}`}>
```

Never:
- camelCase class names
- Tailwind utilities in `.tsx`
- inline `style` for anything that could be a class

---

## SCSS structure

Per `.github/agents/components.agent.md` §4.

```scss
.component.component-<kebab> {
    --<abbr>-color: #1e293b;
    --<abbr>-muted: #64748b;
    --<abbr>-border: #e2e8f0;
    --<abbr>-bg: #ffffff;
    --<abbr>-hover-bg: #f8fafc;
    --<abbr>-transition: 0.15s ease;

    position: relative;
}

.component-<kebab> {

    &__{part} {
    }

    &--{modifier} {
    }
}

@media (min-width: 576px) {
    .component-<kebab> { /* tablet+ */ }
}
```

**CSS custom property prefix:** see `components.md` table for existing prefixes. New components pick a 2-4 letter abbreviation.

**Color values:**
- SCSS `$variable` from `_colors.scss` inside SCSS rules and mixins.
- Literal hex inside CSS custom properties on components (will migrate to tokens later).
- Preferred neutrals: `#1e293b` (dark text), `#64748b` (muted), `#94a3b8` (faint), `#e2e8f0` (border), `#f8fafc` (surface), `#ffffff` (white).

---

## Border radius — the rule

**No `border-radius` on rectangles.** Source: `.github/agents/components.agent.md` §4.

- No `border-radius` on containers, inputs, buttons, dropdowns, panels, tooltips, or any rectangular element.
- No `--xxx-radius` custom property on components.
- No `var(--rc-radius-*)` references.

Exceptions: `border-radius: 50%` on shape-defining elements only — spinner rings, slider thumbs, stepper indicators, carousel dots and arrow buttons, lightbox close/arrow buttons.

---

## Responsive

**Breakpoints:**

| Name | min-width | Use |
|---|---|---|
| xs | 400px | very small phones |
| sm | 576px | phones portrait |
| md | 768px | tablets |
| lg | 992px | desktop switch |
| xl | 1200px | wide desktop |

**Mobile-first** (`min-width` only). Never `max-width` overrides.

**Touch targets:** `@media (pointer: coarse) { min-width: 44px; min-height: 44px; }` on every interactive element.

**Scrollable:**
```scss
overflow-x: auto;
-webkit-overflow-scrolling: touch;
scrollbar-width: thin;
```

---

## Accessibility

Required on every component before considered done:

**Form controls:**
- `<label htmlFor>` with `useId()` connected.
- `aria-invalid={true}` + `aria-describedby={errorId}` on error.
- `aria-required={true}` on required fields, plus visual asterisk.

**Interactive:**
- All interactive elements: `:focus-visible` ring `outline: 2px solid #1e293b; outline-offset: 2px`.
- Buttons must be `<button>`, not `<div>` / `<span>`.

**Dropdowns / listboxes:**
```tsx
aria-expanded={open}
aria-haspopup="listbox"
aria-controls={listId}
aria-activedescendant={activeItemId}
```
List: `role="listbox"`. Items: `role="option"`, `aria-selected`, `aria-disabled`.

**Dialogs:**
```tsx
role="dialog"
aria-modal="true"
aria-labelledby={titleId}
tabIndex={-1}
```
On open: focus into dialog. On close: return focus to trigger.

**Sortable tables:**
```tsx
aria-sort={col.sortDir ?? 'none'}
```

**Icons:**
```tsx
<Icon name="chevron-down" aria-hidden={true} />          // decorative
<Icon name="close" aria-label="Close" />                 // standalone
```

**Live regions:**
```tsx
<div role="status" aria-live="polite">Loading…</div>
<div role="alert" aria-live="assertive">Error</div>
```

---

## State patterns

**Loading:**
- Field-level: `<Skeleton />`.
- Overlay: `<Spinner />`.

**Error:**
```tsx
{error && (
    <div id={errorId} className="invalid-feedback d-block">{error}</div>
)}
```

**Open/close:**
```tsx
const [open, setOpen] = useState(false)
useClickOutside(containerRef, () => setOpen(false))
```
Always handle Escape:
```tsx
if (e.key === 'Escape') setOpen(false)
```

---

## Animation

- Micro-interactions (color/border/opacity): `transition: <prop> 0.15s ease`.
- Layout transitions (height/width/transform): `transition: <prop> 0.2s cubic-bezier(0.4, 0, 0.2, 1)`.
- Enter animations: `@keyframes` with `animation: <name> 0.15s ease-out`.
- **Required** prefers-reduced-motion override:

```scss
@media (prefers-reduced-motion: reduce) {
    .component-{name} {
        animation: none;
        transition: none;
    }
}
```

---

## Z-index

**Don't invent layers.** Use only:

| Layer | Value | Usage |
|---|---|---|
| Tooltip | 1070 | above dropdowns |
| Dropdown list | 1060 | above modal content |
| Modal content | 1055 | inside backdrop |
| Modal backdrop | 1050 | page overlay |
| Overlay | 1000 | sidebar overlay on mobile |
| Sticky header | 1 | table/nav |

---

## Demo registration

Every new component **must** ship a demo before considered done.

**Location:** `examples/src/react-components/<Name>Demo.tsx`.

**Pattern:** Bootstrap grid (`container`, `row`, `col-lg-8`). Each variant in its own `<Card>` with `<h2 className="h5 mb-3">`. End with a `<CodeSnippet>` showing minimal usage.

**Register in** `examples/src/react-components/index.tsx`:
```tsx
import { <Name>Demo } from './<Name>Demo'

export const examples: ExampleEntry[] = [
    // ...
    { key: '<kebab>', category: '<MatchingCategory>', element: <<Name>Demo /> },
]
```

Existing categories: `Typography & Decoration`, `Inputs & Forms`, `Buttons & Actions`, `Layout / Container`, `Navigation`, `Overlays & Feedback`, `Data Display`, `Charts & Metrics`, `Media & Files`, `Identity & People`, `Marketing & Landing`, `Code & Docs`, `Game Jam / Arcade`.

---

## Checklist before marking a component done

- [ ] `.tsx` exports component + prop interface(s)
- [ ] Root has `component component-{name}` classes
- [ ] All IDs via `useId()`
- [ ] Form inputs have `<label htmlFor>`
- [ ] Interactive elements have `:focus-visible` styles
- [ ] Keyboard navigation works (Tab, Enter/Space, Escape, Arrow keys)
- [ ] ARIA roles and attributes correct
- [ ] `loading` renders `<Skeleton />`
- [ ] `error` shows message with `aria-describedby`
- [ ] Responsive at 375px, 576px, 768px, 992px
- [ ] Touch targets ≥ 44px under `@media (pointer: coarse)`
- [ ] `@media (prefers-reduced-motion: reduce)` overrides
- [ ] No `border-radius` on rectangles
- [ ] No code comments
- [ ] SCSS file added to `style/components/index.scss`
- [ ] Export added to `src/index.ts`
- [ ] `examples/public/react-components/SKILL.md` updated
- [ ] Demo at `examples/src/react-components/<Name>Demo.tsx`
- [ ] Demo registered in `examples/src/react-components/index.tsx`
- [ ] `.claude/skills/react-component/components.md` updated

---

## Style anti-patterns

- Tailwind utilities in `.tsx`.
- Inline `style` for anything class-able.
- Hardcoded hex in JSX styles (use class + custom properties).
- `border-radius` on a rectangle.
- `forwardRef` on layout/wrapper components.
- Mixed controlled + uncontrolled state.
- ARIA added as an afterthought.
- `outline: none` without an equivalent visible focus ring.
- `max-width` media-query overrides.
- Code comments in `.tsx` or `.scss`.
- Custom event types that duplicate `onClick` / `onChange` / `onFocus`.
