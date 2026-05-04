---
name: gc-component
description: Scaffold a new game-components Web Component (vanilla HTML5, Shadow DOM, no libraries) under `game-components/`. Triggers when the user asks to add/create/scaffold a `gc-*` component or a fantasy game UI element. Wires up the .ts file, SCSS partial, style index, src/index.ts export, plus the inventory and the published `examples/public/game-components/SKILL.md` downstream contract.
---

# gc-component

Scaffold a single game-components Web Component matching the project's vanilla + fantasy-theme conventions.

> **CSS rule (load-bearing):** All component CSS MUST live in `.scss` files under `game-components/style/components/`. The `.ts` file never contains a `<style>` block, never uses `element.style.*` for visual styling, and never embeds CSS strings. This is non-negotiable — see Hard rule #14.

## REQUIRED reading before generating any code

**You MUST read three files in this order before writing anything:**

1. **`.claude/skills/gc-component/style_guidelines.md`** (bundled with this skill) — the authoritative visual contract. Token names, exact hex values inside gradients, bevel stacks, typography, motion, accessibility. Copy values verbatim from the matching section (Panel → §3.1, Button → §6, Slot → §7, etc.). If a value is not there, it is not allowed.
2. **`.claude/skills/gc-component/components.md`** (bundled) — inventory of every existing `gc-*` primitive (tag, attrs, props, slots, events, "use when" / "skip when"). **Reuse before reinvent.** Compose existing primitives in the shadow DOM or in the demo before hand-rolling.
3. **`examples/public/game-components/SKILL.md`** — the user-facing API reference for `@toolcase/game-components` published at `toolcase.kalevski.dev/game-components/SKILL.md`. The downstream contract — anything you add must be appended here too in the same shape (tag/class table row, attribute table, key event names).

Do not paraphrase. Open all three. The values you write into the component's `.scss` partial must come from `style_guidelines.md`. The composition decisions (which existing `gc-*` to nest) must come from `components.md`. The published API surface that downstream apps and Claude Code skills consume comes from `examples/public/game-components/SKILL.md` — keep it in sync.

REUSE rule (load-bearing):

- Before authoring markup, scan `components.md` for any primitive that already covers part of the new component (layout → `gc-stack`/`gc-grid`/`gc-anchor`; framing → `gc-panel`/`gc-gilded-frame`/`gc-artboard-backdrop`; text → `gc-title`/`gc-subtitle`/`gc-eyebrow`/`gc-lore-text`/`gc-scroll-text`/`gc-key`/`gc-version-label`; resource → `gc-health-bar`/`gc-mana-bar`/etc.; inventory → `gc-item-slot`/`gc-hotbar`/`gc-inventory-grid`).
- Reuse via the new component's shadow DOM (e.g. `<gc-panel><slot></slot></gc-panel>`) or via the host page composition shown in the demo.
- Hand-roll markup only when no existing primitive fits, or when reuse forces a worse visual contract than the spec requires.
- If `components.md` is missing a primitive that clearly exists in `game-components/src/index.ts`, treat the doc as stale and update it as part of the task.

## When to use

Trigger on requests like:
- "add a gc-* component"
- "create the HealthBar component"
- "scaffold gc-panel" / "implement gc-stack"
- any request mentioning `game-components/`, `gc-*`, or fantasy game UI elements

Do NOT use for:
- react-components changes (use `react-component`)
- edits to existing `gc-*` files (just edit them — rules below still apply for inventory + published SKILL.md updates)
- non-component utility files
- Anything from `@toolcase/base` / `logging` / `serializer` / `phaser-plus` (use the matching `*-feature` skill).

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
9. **Custom event emit**: dispatch `CustomEvent` with `bubbles: true, composed: true` so the event crosses the shadow boundary. Reuse the existing event-name conventions documented for similar primitives in `components.md` (e.g. `select` for choosable items — see `gc-menu-item`, `gc-item-slot`, `gc-hotbar`). Don't invent new names where one already exists.
10. **Reflected boolean props** (`open`, `selected`, `on`, `show`): write back to attribute so `:host([open])` selectors work for external CSS.
11. **`:focus-visible` ring** on interactive elements: `outline: 2px solid var(--fg-gold-bright); outline-offset: 2px`.
12. **No raster, no bitmap fonts, no CSS frameworks**. Glyphs = Unicode or Bootstrap Icons.
13. **No code comments in generated code**. Do not write inline comments, block comments, JSDoc, or SCSS comments in any `.ts` or `.scss` file you generate or modify. Self-documenting names only.
14. **All CSS lives in `.scss` files only**. Never write a `<style>` block inside the shadow root, never use `el.style.*` for visual styling, never inline CSS strings in the `.ts` file. Every selector, gradient, bevel, color, spacing rule for the component goes in `game-components/style/components/_<kebab>.scss`. The `.ts` file emits markup and class names; the `.scss` partial owns the appearance. No exceptions.
15. **Demo is mandatory.** Every new component ships with a runnable demo at `examples/src/game-components/<Name>Demo.tsx` registered in `examples/src/game-components/index.tsx` (`gameComponentExamples` entry). One `SectionCard` per meaningful prop variant or interactive state. No demo = component not done.

## Files to create / modify per component

For a new component named `<Name>` (PascalCase), tag `gc-<kebab>`:

1. **`game-components/src/<Name>.ts`** — the component class. **NO inline `<style>` blocks in the shadow root; all CSS lives in `.scss` files only.**
2. **`game-components/style/components/_<kebab>.scss`** — all component styles (shadow DOM + light DOM). Contains the full visual contract from `style_guidelines.md`. This is the single source of truth for the component's appearance.
3. **`game-components/style/components/index.scss`** — append `@use './<kebab>';`.
4. **`game-components/src/index.ts`** — append `export * from './<Name>'`.
5. **`examples/public/game-components/SKILL.md`** — the published downstream contract. Append the new component in the matching category table (Layout / Surfaces & Containers / Typography / Badges, Chips, Icons / Buttons & Menus / Lists & Rows / Resource Bars / Settings Rows / Inventory & Items / HUD & Combat / Map & Markers / Compass, Nav, Indicators / Effects & Overlays / Dialogs & Inputs / Social & Multiplayer / Screens / Character & Player / Progression & Economy). Use the same row shape as the existing entries: `| <gc-tag> | <ClassName> | <attrs/notes> |`. If the component is rich enough to need a code snippet (event listener wiring, prop assignment), add a small example block under the table the way `gc-menu-item`, `gc-hotbar`, and `gc-health-bar` already do. **Without this update the toolcase.kalevski.dev skill install for `@toolcase/game-components` won't surface the new tag.**
6. **`.claude/skills/gc-component/components.md`** — append a new section for the component following the existing entry pattern (tag/class heading, attribute/prop table with types and defaults, slot/event behavior, "use when" / "skip when"). Also add a row to the **Decision quick map** table and update the slot-only list in **Composition notes** if applicable.
7. **`examples/src/game-components/<Name>Demo.tsx`** — runnable React demo (template in workflow §12 below). Required.
8. **`examples/src/game-components/index.tsx`** — register the demo in `gameComponentExamples`. Required.

**Style injection pattern**: The compiled `.scss` files flow into `lib/index.css`. Import that CSS in your host app or inject it into the shadow root via adopted stylesheets / CSS string import at component load time. Do not write CSS inside the `.ts` file.

## Component template

Use this skeleton as the starting point. Fill in props/events/render based on the matching primitive category in `components.md` and the visual contract in `style_guidelines.md`. **CSS goes in `.scss` files only — never inline `<style>` blocks.**

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
- For interactive components, add `tabindex="0"` on the focusable root, set the matching ARIA role (e.g. `role="switch"` for toggle, `role="checkbox"` for check, `role="dialog" aria-modal="true"` for dialogs, `role="menuitem"` for `gc-menu-item`-style entries, `role="listbox"` + `role="option"` for selection lists), and listen for `click` + Space/Enter keydown. Cross-check the role against equivalent primitives already documented in `components.md`.
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

Props, events, states, and ARIA must follow the conventions in `components.md` and `style_guidelines.md`. Reuse existing event names — don't invent new ones where one already exists.

## Workflow

1. **Read** `.claude/skills/gc-component/style_guidelines.md` and locate the matching section(s) using the quick map above. Copy gradient strings, box-shadow stacks, token names, font sizes, and letter-spacing values verbatim into the component's `.scss` partial. Do not invent values, do not paraphrase, do not skip.
2. **Read** `.claude/skills/gc-component/components.md` and check whether existing primitives cover ≥50% of your component. If yes, compose them inside the new component's shadow DOM or in the demo instead of re-implementing.
3. **Read** `examples/public/game-components/SKILL.md` to confirm the published category style (table row shape, attr column wording, code-snippet conventions used by `gc-menu-item`, `gc-hotbar`, `gc-health-bar`, etc.). You will mirror this when documenting your component.
4. Create `game-components/src/<Name>.ts` from the template; fill in observedAttributes, getters/setters, render(). Visual values come from step 1, composition decisions from step 2.
5. Create `game-components/style/components/_<kebab>.scss`.
6. Append `@use './<kebab>';` to `game-components/style/components/index.scss`.
7. Append `export * from './<Name>'` to `game-components/src/index.ts`.
8. **Update `examples/public/game-components/SKILL.md`** (the published downstream contract). Append the component to the matching category table; mirror the existing row shape (`| <gc-tag> | <ClassName> | <attrs/notes> |`). For components with notable events / props, add a small code snippet under the table the way the existing entries do (`gc-menu-item` event listener, `gc-hotbar` slots assignment, `gc-health-bar` attributes). This is what gets served at `toolcase.kalevski.dev/game-components/SKILL.md` and installed by Claude Code as a skill.
9. **Update `.claude/skills/gc-component/components.md`**: append a new section for the component matching the existing entry shape — heading `### \`gc-<kebab>\` — \`<Name>\``, one-line description, attribute/prop table (cols: Attribute / Prop, Type, Default, Notes), slot/event lines, **Use when** and **Skip when** bullets. Place it under the appropriate `##` group (Layout primitives / Containers / Typography / etc., adding a new group if none fits). Also add a row to the **Decision quick map** table and, if the component has no attrs/props/events, add it to the slot-only list in **Composition notes**.
10. Cross-check the finished component against `style_guidelines.md` §19 (authoring rules) and §20 (Yes/No quick reference) before reporting done.
11. Verify with `cd game-components && npm run build` — tsup must succeed (sass step may fail in the local env; that is pre-existing and not blocking).
12. **Add a demo to the examples app** — two files, one registration:

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
- New event names that duplicate an existing one in `components.md` (e.g. introducing `pick` when `select` already conveys the same intent on `gc-menu-item` / `gc-item-slot`).
- Bootstrap, Tailwind, or any utility CSS framework.
- Code comments of any kind (`//`, `/* */`, `/** */`, SCSS `//`) in generated `.ts` or `.scss` files.
- Skipping the `examples/public/game-components/SKILL.md` update — without it, the downstream Claude Code skill install won't know about the new tag.
- Skipping the `.claude/skills/gc-component/components.md` update — without it, future runs of this skill will reinvent or re-use the wrong primitive.
- Skipping the demo in `examples/src/game-components/` — without it, users have nothing to copy and the visual contract is unverified.
