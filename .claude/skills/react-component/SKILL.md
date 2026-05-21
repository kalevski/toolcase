---
name: react-component
description: Scaffold a new React component in `@toolcase/react-components`. Triggers when the user asks to add/create/scaffold a new component (e.g. "add a Tag component", "implement DateRangePicker", "scaffold a SectionCard variant"). Wires up the .tsx file, SCSS partial, style index, src/index.ts export, demo registration, and the published SKILL.md update — following the BEM + accessibility + no-border-radius rules.
---

# react-component

Scaffold a single React component matching the project's Bootstrap 5 + BEM + sharp-corner conventions.

> **Visual rule (load-bearing):** No `border-radius` on rectangular elements. Square corners by design — exception only for spinner rings, slider thumbs, stepper indicators, carousel dots, and lightbox close buttons. See Hard rule #5.

## REQUIRED reading before generating any code

**You MUST read four files in this order:**

1. **`.claude/skills/react-component/components.md`** (bundled) — inventory of every existing component in `@toolcase/react-components` (props, "use when", "skip when"). **Reuse before reinvent.** Compose around or extend an existing component if it already covers >50% of your task.
2. **`.claude/skills/react-component/conventions.md`** (bundled) — BEM class naming, SCSS structure, accessibility requirements, animation/z-index/responsive rules.
3. **`.github/agents/components.agent.md`** — the in-repo authoritative spec. The conventions.md file in this skill is a condensed pointer; the full contract lives there.
4. **`examples/public/react-components/SKILL.md`** — the user-facing API reference for `@toolcase/react-components` published at `toolcase.kalevski.dev/react-components/SKILL.md`. The downstream contract — anything you add must be appended here too in the same shape.

Do not paraphrase. Open all four. Locate sections that match your component category. Copy the exact prop-table shape, BEM classnames, ARIA attributes, and CSS custom-property prefix from the matching existing component.

## REUSE rule (load-bearing)

Before adding a new component, scan `components.md`. Concrete checks:

- Need a button? Use `Button` / `IconButton` / `CoolButton` — don't build a new button base.
- Need an input? Use `Input`, `Textarea`, `NumberInput`, `OTPInput`, `PhoneInput`, `Select`, `Dropdown`, `ExtendedSelect`, `ComboBox` — pick whichever matches. Forms compose them via `FormInput` / `Form` / `FormWizard`.
- Need a layout primitive? Use `Card`, `SectionCard`, `Group`, `Drawer`, `Accordion`, `TabSections`, `ScrollArea`, `ResizablePanel`, `VirtualList`, `InfiniteScroll`.
- Need feedback? Use `Alert`, `Toast`, `Banner`, `Spinner`, `Skeleton`, `ProgressBar`, `EmptyState`, `Tooltip`, `Popover`.
- Need a dialog/overlay? Use `ConfirmDialog`, `Drawer`, `Lightbox`, `CommandPalette`, `ContextMenu`.
- Need a data display? Use `Table`, `AdvancedTable`, `MetricGrid`, `StatCard`, `EntityCell`, `EntityProfileCard`, `Timeline`.
- Need a form pattern? Use `Form`, `FormWizard`, `FormInput`, `Stepper`, `Rating`, `Slider`, `RangeSlider`.
- Need typography? Use `Heading`, `Text`, `Label`, `HelperText`, `Link`, `Kbd`, `Brand`.

If your new component would duplicate >50% of an existing one, **stop and either**:

- Add a prop variant to the existing component, or
- Compose the new component **on top of** the existing one (wrapper that renders an existing component inside).

Hand-roll only when no existing component fits, or when reuse would force a worse contract than the spec.

## When to use

Trigger on requests like:

- "add a [Tag | DateRangePicker | …] component"
- "create the [ComponentName] component"
- "scaffold [ComponentName] from the spec"
- any request mentioning `react-components/`, the `component component-*` BEM scheme, or new React UI elements

Do NOT use for:

- `gc-*` Web Components (use `gc-component`).
- Existing component edits (just edit them — rules below still apply for class naming, accessibility, demo registration, and SKILL.md updates).
- Generic React utilities unrelated to the component library.

## Hard rules

These are non-negotiable. Sourced from `.github/agents/components.agent.md` §1-§13.

1. **Tag root element with `component component-{name}`** classes (joint). Children use `component-{name}__{part}`. Modifiers `component-{name}--{state}`.
2. **All IDs via `useId()`.** Caller may override via `props.id` for HTML-attribute compatibility, but never require it.
3. **`React.forwardRef` only when root is an HTML element a caller might ref.** Use `React.FC` for wrappers/layout components.
4. **Extend HTML attributes.** `interface FooProps extends React.ButtonHTMLAttributes<HTMLButtonElement> { ... }`. Use `Omit` when overriding (e.g. `onChange` typed as `(value: string) => void`).
5. **No `border-radius` on rectangles.** Hard ban. Exception: explicit circles/diamonds (spinner rings, slider thumbs, stepper indicators, carousel dots, lightbox close/arrow buttons). No `--xxx-radius` custom properties either.
6. **Mobile-first SCSS.** Define base for mobile, override with `min-width` queries. Never `max-width` overrides.
7. **Touch targets ≥ 44px on `@media (pointer: coarse)`** for any interactive element.
8. **`:focus-visible` ring required** on every interactive element: `outline: 2px solid #1e293b; outline-offset: 2px;` (or matching CSS custom prop).
9. **Z-index uses defined layers only.** Tooltip 1070 > Dropdown 1060 > Modal content 1055 > Modal backdrop 1050 > Overlay 1000 > Sticky 1. Don't invent layers.
10. **`@media (prefers-reduced-motion: reduce)` overrides** every animation/transition.
11. **Loading state uses `<Skeleton />`** for fields. `<Spinner />` for full-component overlays.
12. **Form controls have `<label htmlFor>`.** Error state: `aria-invalid={true}` + `aria-describedby={errorId}`.
13. **No code comments** in `.tsx` or `.scss`. Self-documenting names only.
14. **No Tailwind, no inline `style` for anything that could be a class.** All styling in `style/components/_<name>.scss`.
15. **CSS custom property prefix** matches the per-component table in `.github/agents/components.agent.md`. New components pick a 2-4 letter abbreviation, e.g. `--my-component-` or `--mc-`.
16. **Update the published SKILL.md.** Append a section to `examples/public/react-components/SKILL.md` matching the existing format: one-line description, props table (`Prop | Type | Required | Description`), minimal `tsx` usage example.
17. **Update `components.md`.** Append an inventory entry following the existing pattern.
18. **Demo is mandatory.** Every new component ships with `examples/src/react-components/<Name>Demo.tsx` registered in `examples/src/react-components/index.tsx` under the matching category. Demo must exercise every prop variant — default, each variant, error/disabled/loading states. No demo = component not done.

## Files to create / modify per component

For a new component named `<Name>` (PascalCase), root class `component-<kebab>`:

1. **`react-components/src/<Name>.tsx`** — component class. `export const <Name>` (no default).
2. **`react-components/style/components/_<kebab>.scss`** — all component styles (BEM scheme + CSS custom properties).
3. **`react-components/style/components/index.scss`** — append `@use './<kebab>';` (existing file is 100% `@use`, no `@forward`).
4. **`react-components/src/index.ts`** — append `export * from './<Name>'`.
5. **`examples/src/react-components/<Name>Demo.tsx`** — demo component exercising every prop variant.
6. **`examples/src/react-components/index.tsx`** — register demo + add entry to `examples` array under correct category.
7. **`examples/public/react-components/SKILL.md`** — append API section.
8. **`.claude/skills/react-component/components.md`** — append inventory entry.

## Component template

```tsx
import React, { useId } from 'react'

export interface <Name>Props extends React.HTMLAttributes<HTMLDivElement> {
    label?: string
    variant?: 'primary' | 'secondary'
    error?: string
}

export const <Name>: React.FC<<Name>Props> = ({
    label,
    variant = 'primary',
    error,
    className,
    children,
    id: propId,
    ...rest
}) => {
    const generatedId = useId()
    const id = propId ?? generatedId
    const errorId = error ? `${id}-error` : undefined

    return (
        <div
            id={id}
            className={`component component-<kebab> component-<kebab>--${variant} ${className || ''}`.trim()}
            aria-describedby={errorId}
            aria-invalid={error ? true : undefined}
            {...rest}
        >
            {label && <span className="component-<kebab>__label">{label}</span>}
            <div className="component-<kebab>__body">{children}</div>
            {error && (
                <div id={errorId} className="invalid-feedback d-block">
                    {error}
                </div>
            )}
        </div>
    )
}
```

For interactive root (button, input wrapper, dialog), prefer `React.forwardRef`:

```tsx
export const <Name> = React.forwardRef<HTMLButtonElement, <Name>Props>(({ ... }, ref) => {
    return <button ref={ref} className="component component-<kebab>" />
})
<Name>.displayName = '<Name>'
```

## SCSS partial template (`style/components/_<kebab>.scss`)

```scss
.component.component-<kebab> {
    --<abbr>-color: #1e293b;
    --<abbr>-muted: #64748b;
    --<abbr>-border: #e2e8f0;
    --<abbr>-bg: #ffffff;
    --<abbr>-hover-bg: #f8fafc;
    --<abbr>-transition: 0.15s ease;

    position: relative;
    color: var(--<abbr>-color);
    background: var(--<abbr>-bg);
    border: 1px solid var(--<abbr>-border);
    transition: background var(--<abbr>-transition);

    &:focus-visible {
        outline: 2px solid var(--<abbr>-color);
        outline-offset: 2px;
    }
}

.component-<kebab> {

    &__label {
        font-size: 0.875rem;
        color: var(--<abbr>-muted);
    }

    &__body {
        padding: 0.75rem;
    }

    &--primary {
    }

    &--secondary {
        --<abbr>-bg: var(--<abbr>-hover-bg);
    }

    @media (min-width: 576px) {
        &__body { padding: 1.25rem; }
    }

    @media (pointer: coarse) {
        min-width: 44px;
        min-height: 44px;
    }

    @media (prefers-reduced-motion: reduce) {
        transition: none;
    }
}
```

## Demo template

```tsx
import React from 'react'
import { <Name>, Card, CodeSnippet } from '@toolcase/react-components'

export const <Name>Demo: React.FC = () => {

    return (
        <div className="container my-5">
            <div className="row mb-4">
                <div className="col-12">
                    <h1 className="display-4 text-gradient-primary mb-2"><Name></h1>
                    <p className="text-muted mb-0">One-line description.</p>
                </div>
            </div>

            <div className="row mb-5">
                <div className="col-lg-8">
                    <Card>
                        <h2 className="h5 mb-3">Default</h2>
                        <<Name> label="Hello" />
                    </Card>
                </div>
            </div>

            <div className="row mb-5">
                <div className="col-lg-8">
                    <Card>
                        <h2 className="h5 mb-3">Variants</h2>
                        <<Name> variant="primary" label="Primary" />
                        <<Name> variant="secondary" label="Secondary" />
                    </Card>
                </div>
            </div>

            <div className="row mb-5">
                <div className="col-12">
                    <Card>
                        <h2 className="h5 mb-3">Usage</h2>
                        <CodeSnippet language="typescript" code={`<<Name> label="Hello" />`} />
                    </Card>
                </div>
            </div>
        </div>
    )
}
```

Register in `examples/src/react-components/index.tsx`:

```tsx
import { <Name>Demo } from './<Name>Demo'

export const examples: ExampleDef[] = [
    // ...
    { key: '<kebab>', category: '<MatchingCategory>', element: <<Name>Demo /> },
]
```

## Workflow

1. **Read** `.claude/skills/react-component/components.md` and confirm no existing component covers ≥50% of the request. If yes, stop and reuse.
2. **Read** `.claude/skills/react-component/conventions.md` and `.github/agents/components.agent.md` for BEM, accessibility, z-index, motion rules.
3. **Read** `examples/public/react-components/SKILL.md` to find the matching category and copy the section style.
4. **Create** `react-components/src/<Name>.tsx` from the template.
5. **Create** `react-components/style/components/_<kebab>.scss` from the SCSS template.
6. **Append** `@use './<kebab>';` to `react-components/style/components/index.scss`.
7. **Append** `export * from './<Name>'` to `react-components/src/index.ts`.
8. **Create** `examples/src/react-components/<Name>Demo.tsx`.
9. **Register** demo in `examples/src/react-components/index.tsx`.
10. **Append API section** to `examples/public/react-components/SKILL.md` under the correct category.
11. **Append inventory entry** to `.claude/skills/react-component/components.md`.
12. **Verify** with `npm -w @toolcase/react-components run build` and `npm -w @toolcase/examples run dev` (visit the demo route).

## Anti-patterns

- `border-radius` on any rectangular element.
- Tailwind utilities or inline `style` for anything class-able.
- Custom event names that duplicate React's standard `onClick / onChange / onFocus`.
- Adding `forwardRef` to wrapper / layout components.
- Hardcoded hex colors in JSX (use class names + CSS custom properties).
- Mixing controlled and uncontrolled state in one component.
- `aria-` attributes added as an afterthought instead of designed in.
- Missing `<label htmlFor>` on form inputs.
- `outline: none` without an equivalent visible focus indicator.
- `max-width` media-query overrides (must be `min-width` mobile-first).
- Code comments in `.tsx` or `.scss`.
- Skipping demo, SKILL.md update, or inventory update.
