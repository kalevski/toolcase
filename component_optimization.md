# Component optimization — reuse opportunities

Audit of `react-components/src/*.tsx` for places where an advanced component
reimplements markup that a primitive already provides. Folder-based subsystems
(`DashboardLayout/`, `modal/`, `Chart/`, etc.) are out of scope.

## Summary

| Component | Line(s) | Primitive | Issue | Confidence |
|---|---|---|---|---|
| `ToggleCard.tsx` | 74–76 | `Switch` | Custom `__switch` + `__knob` markup duplicates `Switch`'s track/knob | **high** |
| `CodeSnippet.tsx` | 68 | `Icon` | `<i className={`bi ${copied ? 'bi-check-lg' : 'bi-clipboard'}`} />` | **high** |
| `JSONSchemaDef.tsx` | 238, 250 | `Icon` | `<i className="bi bi-x-lg" />`, `<i className="bi bi-plus-lg" />` | **high** |
| `PhoneInput.tsx` | 138 | `Icon` | `<i className="bi bi-chevron-down ..." aria-hidden="true" />` | **high** |
| `TagInput.tsx` | 160 | `Icon` | `<i className="bi bi-x" />` inside tag remove button | **high** |
| `Rating.tsx` | 133, 136 | `Icon` | `<i className="bi bi-star-half" />`, `<i className={`bi bi-${name}`} />` | **high** |
| `MarkdownEditor.tsx` | 162 | `Icon` | `<i className={`bi bi-${action.icon}`} aria-hidden="true" />` | **high** |
| `Banner.tsx` | 85–93 | `IconButton` | `<button className="__dismiss"><Icon name="x" /></button>` dismiss button | **high** |
| `CommandPalette.tsx` | 170–178 | `IconButton` | `<button className="__clear"><Icon name="x" /></button>` clear-search button | **high** |
| `CommandPalette.tsx` | 248–250 | `Kbd` | Raw `<kbd>↑</kbd><kbd>↓</kbd>` etc. in footer hint | **high** |
| `FormWizard.tsx` | 88 | `Spacer` | `<div className="__footer-spacer" />` used as `flex: 1` pusher | **medium** |

## Details

### 1. `ToggleCard` → use `Switch`

**File:** `react-components/src/ToggleCard.tsx:74-76`

```tsx
<span className="component-toggle-card__switch">
    <span className="component-toggle-card__knob" />
</span>
```

`Switch.tsx` already renders `<span __track><span __knob /></span>` and handles
the `checked` / `disabled` / `size` states. `ToggleCard` could render a
`<Switch checked={checked} disabled={disabled} />` inside the card label and
drop the `.component-toggle-card__switch` / `__knob` SCSS partials.

**Caveat:** the card currently owns the click behaviour (`onClick` on the
`<label>`). Wiring the switch through requires picking one of:
  - pass `checked` + `onChange` to `<Switch />` and drop the outer click handler,
    **or**
  - keep the card click and render `<Switch />` as a visual-only indicator
    (the label click will still toggle the embedded `<input type="checkbox">`).

### 2–7. Raw `<i className="bi bi-...">` → use `Icon`

All seven sites render a Bootstrap-icon `<i>` inline. `Icon.tsx` is the
canonical wrapper. Each swap is a one-line change:

```tsx
// Before
<i className="bi bi-x-lg" />
// After
<Icon name="x-lg" />
```

Site-by-site:

| File:line | Replacement |
|---|---|
| `CodeSnippet.tsx:68` | `<Icon name={copied ? 'check-lg' : 'clipboard'} />` |
| `JSONSchemaDef.tsx:238` | `<Icon name="x-lg" />` |
| `JSONSchemaDef.tsx:250` | `<Icon name="plus-lg" />` |
| `PhoneInput.tsx:138` | `<Icon name="chevron-down" className="component-phone-input__chevron" />` |
| `TagInput.tsx:160` | `<Icon name="x" />` |
| `Rating.tsx:133` | `<Icon name="star-half" />` |
| `Rating.tsx:136` | `<Icon name={starIconName} />` |
| `MarkdownEditor.tsx:162` | `<Icon name={action.icon} />` |

`aria-hidden="true"` on decorative icons is already the `Icon` default when no
`aria-label` is passed — it can be dropped from the call sites.

### 8. `Banner` dismiss button → use `IconButton`

**File:** `react-components/src/Banner.tsx:85-93`

```tsx
<button
    type="button"
    className="component-banner__dismiss"
    aria-label="Dismiss notification"
    onClick={handleDismiss}
>
    <Icon name="x" />
</button>
```

`IconButton.tsx` already wraps `<button><Icon /></button>` with `aria-label`
defaulting from the icon name. Replace with:

```tsx
<IconButton
    icon="x"
    label="Dismiss notification"
    className="component-banner__dismiss"
    onClick={handleDismiss}
/>
```

**Caveat:** `IconButton` injects `component component-icon-button` plus
`--{size}` / `--{variant}` modifier classes onto the root. The existing
`__dismiss` SCSS targets the bare class — confirm those styles still apply
(they will, since `className` is appended), but the button will also pick up
default `IconButton` chrome (border, padding) unless overridden. May need a
`variant="secondary" outline` tweak or a small SCSS reset.

### 9. `CommandPalette` clear button → use `IconButton`

**File:** `react-components/src/CommandPalette.tsx:170-178`

Same shape as Banner: a `<button>` with one `<Icon name="x" />` child and an
`aria-label`. Same swap, same caveat about default `IconButton` chrome
overlapping with the existing `.component-command-palette__clear` styles.

### 10. `CommandPalette` footer hints → use `Kbd`

**File:** `react-components/src/CommandPalette.tsx:248-250`

```tsx
<span><kbd>↑</kbd><kbd>↓</kbd> navigate</span>
<span><kbd>↵</kbd> select</span>
<span><kbd>Esc</kbd> close</span>
```

`Kbd.tsx` wraps `<kbd>` with `component component-kbd` styling and supports a
`keys={['↑', '↓']}` form that auto-inserts a separator. Two equivalent
rewrites:

```tsx
<span><Kbd>↑</Kbd><Kbd>↓</Kbd> navigate</span>
// or, with the keys API (note: inserts a "+" separator by default)
<span><Kbd keys={['↑', '↓']} /> navigate</span>
```

**Caveat:** the `keys` form inserts `+` between items, which is wrong for
arrow-key pairs. Stick with two adjacent `<Kbd>` elements for the arrows.

### 11. `FormWizard` footer spacer → use `Spacer`

**File:** `react-components/src/FormWizard.tsx:88`

```tsx
<div className="component-form-wizard__footer-spacer" />
```

`Spacer.tsx` with no `size` prop renders `<div style={{ flex: '1 1 auto' }} />`
— exactly what this BEM class presumably does. Swap to:

```tsx
<Spacer className="component-form-wizard__footer-spacer" />
```

**Caveat:** lower confidence (medium) because the swap depends on what the
existing `__footer-spacer` SCSS actually declares. If the partial just sets
`flex: 1`, the inline style from `Spacer` makes it redundant and the class
can be dropped. If it adds responsive overrides, keep the class — `Spacer`
appends `className` to its root.

## Already composing primitives correctly

(Spot-checked, confirmed no action needed.)

- `CheckboxGroup`, `RadioGroup` — use `<Checkbox />` / `<Radio />`
- `FormWizard`, `Alert`, `Accordion` — use `<Button />`, `<Icon />`, `<Skeleton />`
- `Dropdown`, `ContextMenu`, `Toast`, `Pagination` — use `<Icon />`
- `MultiCardSelect` — uses `<Icon />` for selection checkmarks
- `DangerZoneActions`, `StatCard`, `UserPanel` — use the right primitives

## Deliberately excluded

- **`NumberInput` +/− buttons** (lines 127, 176): visually fused with the input
  row; swapping to `<Button />` fights the existing BEM styling for a
  structural element that is not really a "button" in the design-system sense.
- **`CardOptions` card buttons** (line 39): `<button>` used structurally as a
  selectable card, not as a Button primitive — no reuse here.
- **Bootstrap badge classes in `FileTags`**: uses `.badge` directly, but the
  `Badge` component also just wraps that class — no meaningful reuse.
- **`Rating` star fills**: the half-fill overlay technique is component-specific;
  only the `<i>` → `<Icon>` swap applies, not the surrounding logic.
