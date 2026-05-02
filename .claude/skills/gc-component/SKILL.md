---
name: gc-component
description: Scaffold a new game-components Web Component (vanilla HTML5, Shadow DOM, no libraries) under `game-components/`. Triggers when the user asks to add/create/scaffold a `gc-*` component, a fantasy game UI element, or anything from `component_specs.md`. Wires up the .ts file, SCSS partial, style index, and src/index.ts export following the project's style guidelines.
---

# gc-component

Scaffold a single game-components Web Component matching the project's vanilla + fantasy-theme conventions.

> **CSS rule (load-bearing):** All component CSS MUST live in `.scss` files under `game-components/style/components/`. The `.ts` file never contains a `<style>` block, never uses `element.style.*` for visual styling, and never embeds CSS strings. This is non-negotiable — see Hard rule #14.

## REQUIRED reading before generating any code

**You MUST read `.claude/skills/gc-component/style_guidelines.md`** (the file bundled with this skill) before writing the component. It is the authoritative visual contract — token names, exact hex values inside gradients, bevel stacks, typography, motion, accessibility. The summary tables further down in this SKILL.md only point you to the right section; the actual values you write into the component's Shadow DOM `<style>` block must come from `style_guidelines.md`.

Do not paraphrase from memory. Open the file. Copy the gradient strings, box-shadow stacks, and token names verbatim from the matching section (Panel → §3.1, Button → §6, Slot → §7, etc.). If a value is not in `style_guidelines.md`, it is not allowed in the component.

`style_guidelines.md` is authoritative for the look.

**You MUST also read `.claude/skills/gc-component/components.md`** before writing the component. It is the inventory of every existing `gc-*` primitive (tag, attrs, props, slots, events, "use when" / "skip when"). Treat those primitives as building blocks: when scaffolding a new component, compose existing ones inside the shadow DOM or recommend them in the demo rather than re-implementing layout, framing, typography, or anchoring from scratch.

Rules:
- Before authoring markup, scan `components.md` for any primitive that already covers part of the new component (layout → `gc-stack`/`gc-grid`/`gc-anchor`; framing → `gc-panel`/`gc-gilded-frame`/`gc-artboard-backdrop`; text → `gc-title`/`gc-subtitle`/`gc-eyebrow`/`gc-lore-text`/`gc-scroll-text`/`gc-key`/`gc-version-label`).
- Reuse them via the new component's shadow DOM (e.g. `<gc-panel><slot></slot></gc-panel>`) or via the host page composition shown in the demo.
- Only hand-roll markup (raw `div` + SCSS) when no existing primitive fits, or when reusing one would force a worse visual contract than the spec requires.
- If `components.md` is missing a primitive that clearly exists in `game-components/src/index.ts`, treat the doc as stale and update it as part of the task.

## When to use

Trigger on requests like:
- "add a gc-* component"
- "create the HealthBar component"
- "scaffold gc-panel" / "implement gc-stack from the specs"
- any request mentioning `game-components/`, `gc-*`, or fantasy game UI elements

Do NOT use for: react-components changes, edits to existing gc-* files (just edit), or non-component utility files.

## Hard rules

These come from `style_guidelines.md` §19 and the user's confirmed conventions. Follow without exception.

1. **Vanilla only**. Extend native `HTMLElement`. No Lit, no decorators, no third-party runtime. Only standard browser APIs (`HTMLElement`, `customElements`, Shadow DOM, `CSSStyleSheet`, `attachShadow`).
2. **Tag prefix `gc-`** (e.g. `gc-health-bar`). Filename is PascalCase matching the class (e.g. `HealthBar.ts`).
3. **Shadow DOM with `mode: 'open'`**. Encapsulate styles inside the shadow root via a `<style>` block — do not rely on global CSS reaching shadow content.
4. **Tokens only**: every color/border/shadow uses `var(--fg-*)` tokens or named gradients from `style_guidelines.md` §3-§13. Hex literals only inside gradient strings copied verbatim from the guidelines.
5. **Square by default**: no `border-radius` unless component is a circle/diamond per spec.
6. **Display caps for labels**: `var(--fg-display)` + uppercase + `letter-spacing >= 0.16em`.
7. **Mono for numerals**: `var(--fg-mono)` for any HP/qty/ping/score/hotkey/version output.
8. **Inset bevel stack** on every framed surface: outer dark inset, optional gold ring, top highlight (see §4).
9. **Custom event emit**: dispatch `CustomEvent` with the exact name/detail shape from `component_specs.md` (e.g. `emit('select', {id})` → `dispatchEvent(new CustomEvent('select', { detail: { id }, bubbles: true, composed: true }))`).
10. **Reflected boolean props** (`open`, `selected`, `on`, `show`): write back to attribute so `:host([open])` selectors work for external CSS.
11. **`:focus-visible` ring** on interactive elements: `outline: 2px solid var(--fg-gold-bright); outline-offset: 2px`.
12. **No raster, no bitmap fonts, no CSS frameworks**. Glyphs = Unicode or Bootstrap Icons.
13. **No code comments in generated code**. Do not write inline comments, block comments, JSDoc, or SCSS comments in any `.ts` or `.scss` file you generate or modify. Self-documenting names only.
14. **All CSS lives in `.scss` files only**. Never write a `<style>` block inside the shadow root, never use `el.style.*` for visual styling, never inline CSS strings in the `.ts` file. Every selector, gradient, bevel, color, spacing rule for the component goes in `game-components/style/components/_<kebab>.scss`. The `.ts` file emits markup and class names; the `.scss` partial owns the appearance. No exceptions.

## Files to create / modify per component

For a new component named `<Name>` (PascalCase), tag `gc-<kebab>`:

1. **`game-components/src/<Name>.ts`** — the component class. **NO inline `<style>` blocks in the shadow root; all CSS lives in `.scss` files only.**
2. **`game-components/style/components/_<kebab>.scss`** — all component styles (shadow DOM + light DOM). Contains the full visual contract from `style_guidelines.md`. This is the single source of truth for the component's appearance.
3. **`game-components/style/components/index.scss`** — append `@use './<kebab>';`.
4. **`game-components/src/index.ts`** — append `export * from './<Name>'`.
5. **`.claude/skills/gc-component/components.md`** — append a new section for the component following the existing entry pattern (tag/class heading, attribute/prop table with types and defaults, slot/event behavior, "use when" / "skip when"). Also add a row to the **Decision quick map** table and update the slot-only list in **Composition notes** if applicable.

**Style injection pattern**: The compiled `.scss` files flow into `lib/index.css`. Import that CSS in your host app or inject it into the shadow root via adopted stylesheets / CSS string import at component load time. Do not write CSS inside the `.ts` file.

## Component template

Use this skeleton as the starting point. Fill in props/events/render per `component_specs.md`. **CSS goes in `.scss` files only — never inline `<style>` blocks.**

```ts
const TAG_NAME = 'gc-<kebab>'

export interface <Name>EventMap {
}

export class <Name> extends HTMLElement {

    static get observedAttributes(): string[] {
        return []
    }

    private root: ShadowRoot

    constructor() {
        super()
        this.root = this.attachShadow({ mode: 'open' })
    }

    connectedCallback(): void {
        this.render()
    }

    attributeChangedCallback(): void {
        if (this.isConnected) {
            this.render()
        }
    }

    private emit<T>(name: string, detail?: T): void {
        this.dispatchEvent(new CustomEvent(name, { detail, bubbles: true, composed: true }))
    }

    private render(): void {
        this.root.innerHTML = `
            <div class="root component component-<kebab>">
                <slot></slot>
            </div>
        `
    }

    private escape(value: string): string {
        return value
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;')
    }
}

if (typeof customElements !== 'undefined' && !customElements.get(TAG_NAME)) {
    customElements.define(TAG_NAME, <Name>)
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: <Name>
    }
}
```

Notes on the template:
- Drop `escape()` if no user text is interpolated.
- For interactive components, add `tabindex="0"` on the focusable root, set `role` per `component_specs.md` (e.g. `role="switch"` for toggle, `role="checkbox"` for check, `role="dialog" aria-modal="true"` for dialogs), and listen for `click` + Space/Enter keydown.
- For overlay/dialog components with reflected `open`: register Escape keydown on `connectedCallback` and remove on `disconnectedCallback`.
- Always escape interpolated user-provided strings before assigning to `innerHTML`.
- **All visual styling (`:host`, `.root`, child selectors) goes in `style/components/_<kebab>.scss`**, not here.

## SCSS partial pattern

Each component's `.scss` file is the single source of truth for all its visual styling — shadow DOM host/children + light DOM. Structure:

```scss
.component.component-<kebab> {
}
```

This single file compiles into `lib/index.css` with all other components. The host app imports that global CSS, and shadow DOM styles are applied via CSS custom properties (`var(--fg-*)`), adopted stylesheets, or explicit CSS import at component initialization.

## Visual contract — quick map

When picking values, consult these sections of `style_guidelines.md`:

| Component kind | Primary section |
|---|---|
| Panel / framed surface | §3.1 (Panel), §3.2 (GildedFrame), §4 (bevel stack) |
| Button | §6 (sizes/variants) |
| Item slot / hotbar / inventory | §7 (slot states, rarity, cooldown) |
| Resource bar (HP/MP/stamina/XP) | §1.6 (palette), §8 (heights, label rows) |
| Toggle / check / slider | §9 (sizes, knob/handle) |
| List row / menu item / tab | §10 |
| Badge / chip / pip / buff icon | §11 |
| Portrait / medallion | §12 |
| Tooltip / dialog / modal | §13, §13.3 (z-index) |
| Layout primitive (stack/grid/anchor/safe-area/aspect) | §17 |
| Iconography | §16 (Unicode + Bootstrap Icons only) |
| Spacing | §15 (no spacing tokens — use the px scale) |
| Motion durations | §14 |

Props, events, states, and ARIA must be defined per the component's spec. Do not invent new event names.

## Workflow

1. **Read `.claude/skills/gc-component/style_guidelines.md`** and locate the matching section(s) using the quick map above. Copy gradient strings, box-shadow stacks, token names, font sizes, and letter-spacing values verbatim into the component. Do not invent values, do not paraphrase, do not skip this step.
2. Create `game-components/src/<Name>.ts` from the template; fill in observedAttributes, getters/setters, render() with all visual values pulled from step 1.
4. Create `game-components/style/components/_<kebab>.scss`.
5. Append `@use './<kebab>';` to `game-components/style/components/index.scss`.
6. Append `export * from './<Name>'` to `game-components/src/index.ts`.
7. **Update `.claude/skills/gc-component/components.md`**: append a new section for the component matching the existing entry shape — heading `### \`gc-<kebab>\` — \`<Name>\``, one-line description, attribute/prop table (cols: Attribute / Prop, Type, Default, Notes), slot/event lines, **Use when** and **Skip when** bullets. Place it under the appropriate `##` group (Layout primitives / Containers / Typography / etc., adding a new group if none fits). Also add a row to the **Decision quick map** table and, if the component has no attrs/props/events, add it to the slot-only list in **Composition notes**.
8. Cross-check the finished component against `style_guidelines.md` §19 (authoring rules) and §20 (Yes/No quick reference) before reporting done.
9. Verify with `cd game-components && npm run build` — tsup must succeed (sass step may fail in the local env; that is pre-existing and not blocking).
10. **Add a demo to the examples app** — two files, one registration:

   **`examples/src/game-components/<Name>Demo.tsx`** — React functional component that exercises all key props/states. Pattern:
   ```tsx
   import React from 'react'
   import { RichPageHeader, RichPageHeaderChip, SectionCard } from '@toolcase/react-components'
   import '@toolcase/game-components'

   const <Name>Demo: React.FC = () => (
       <div className="container py-4">
           <div className="row">
               <div className="col-12">
                   <RichPageHeader
                       chips={<RichPageHeaderChip>Game Components</RichPageHeaderChip>}
                       title="<Human name>"
                       description="<One sentence describing the component.>"
                   />
                   <div className="d-flex flex-column gap-4 mt-4">
                       <SectionCard title="Default">
                           {/* @ts-ignore */}
                           <gc-<kebab> />
                       </SectionCard>
                   </div>
               </div>
           </div>
       </div>
   )

   export default <Name>Demo
   ```
   Rules: one `SectionCard` per meaningful prop variant or interactive state. Use `{/* @ts-ignore */}` before every custom element JSX line (TypeScript does not know the tag). For props that need a React ref or dynamic update, use `useRef<HTMLElement>(null)` + `useEffect`.

   **`examples/src/game-components/index.tsx`** — append one entry to `gameComponentExamples`:
   ```tsx
   { key: '<kebab>', category: '<Category>', element: <<Name>Demo /> },
   ```
   Pick the most fitting existing category or add a new one to the `categories` array. Import the demo at the top of the file.

## Anti-patterns

- Importing `lit`, `lit-html`, `@lit/reactive-element`, decorators, or any framework.
- **Inline `<style>` blocks in the `.ts` component's shadow DOM**. All CSS belongs in `.scss` files. Period.
- `border-radius` on anything that is not a portrait circle, divider diamond, or slider handle (rotated 45°).
- Inline literal hex colors outside of gradient strings copied from `style_guidelines.md`.
- Sentence-case sans-serif on labels — must be display caps + wide tracking.
- Display-font numerals — must be `var(--fg-mono)`.
- `dispatchEvent(new Event(...))` without `bubbles: true, composed: true` — events must cross the shadow boundary.
- New event names not present in `component_specs.md`.
- Bootstrap, Tailwind, or any utility CSS framework.
- Code comments of any kind (`//`, `/* */`, `/** */`, SCSS `//`) in generated `.ts` or `.scss` files.
