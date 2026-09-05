# @toolcase/web-components

[![GitHub](https://img.shields.io/github/license/kalevski/toolcase?style=for-the-badge)](https://github.com/kalevski/toolcase/blob/main/LICENSE)
[![npm version](https://img.shields.io/npm/v/@toolcase/web-components?color=teal&label=VERSION&style=for-the-badge)](https://www.npmjs.com/package/@toolcase/web-components)

**Framework-free** HTML5 Web Components (`tc-*`) with their own from-scratch toolcase styling — no Bootstrap dependency, but a Bootstrap-compatible class and 12-column grid API. Drop them into plain HTML, React, Vue, Svelte, Angular, or any other stack — no framework required.

📖 Live demos: **[toolcase.kalevski.dev/web-components](https://toolcase.kalevski.dev/web-components)**

## Install

```bash
npm install @toolcase/web-components
```

### Peer dependencies

- `@toolcase/base 5.x`
- `react >= 18` — optional, only for the `./react` and `./react/components` entries

## Setup

```ts
import { register } from '@toolcase/web-components'
import '@toolcase/web-components/style.css'

register() // registers every tc-* element on window.customElements
```

### SSR / Next.js / server-side rendering

All `tc-*` component classes extend `HTMLElement`, which does not exist in Node.js. A top-level `import '@toolcase/web-components'` in server-rendered code will throw `ReferenceError: HTMLElement is not defined` at module evaluation time, before any idempotency guard can run.

**Node.js environments** (Next.js SSR, RSC, prerender, Vitest with `environment: 'node'`) automatically resolve the `node` export condition to a no-op stub that exports a safe `register()` — so `require`/`import` from server code will not throw.

**Client-side registration** must use a dynamic import inside `useEffect` or another client-only boundary, never a static top-level import in a component file that is also rendered on the server:

```ts
// Next.js app directory (client component) — safe pattern
'use client'
import { useEffect } from 'react'

useEffect(() => {
    void import('@toolcase/web-components').then((m) => m.register())
}, [])
```

The stylesheet import is also unsafe at the top level in RSC — put it in a client boundary or in `_app.tsx` / `layout.tsx` alongside the dynamic import.

## Usage

```html
<tc-button variant="primary">Save</tc-button>
<tc-alert variant="success" dismissible>Saved successfully.</tc-alert>
<tc-modal title="Confirm" id="confirm-modal">Are you sure?</tc-modal>
```

## React

`tc-*` tags work from plain JSX. Import the typings entry once to augment
`React.JSX.IntrinsicElements`:

```ts
import '@toolcase/web-components/react'
```

```tsx
<tc-form-input
    label="Email"
    value={email}
    error={errors.email}
    required
    disabled={saving}
    ontc-change={(e) => setEmail(e.detail.value)}
/>
```

Three things are worth knowing, because React treats custom elements unlike
anything else in JSX:

- **Event props are hyphenated: `ontc-change`, not `onTcChange`.** react-dom turns
  an unrecognised `on*` prop on a custom element into
  `addEventListener(key.slice(2), value)` with no case conversion, so only the
  hyphenated form reaches the real event name. React's own synthetic events
  (`onClick`, `onFocus`, …) are unaffected.
- **`disabled={false}` is safe** — react-dom removes the attribute for a boolean
  `false`, and the property setter does the same on an upgraded element. No
  `|| undefined` guard is needed. The exceptions are the tri-state attributes that
  default to _on_ (`dismissible`, `handle`, `blur-behind`, `autohide`), where the
  string `"false"` is meaningful; their setters coerce it.
- **Objects, arrays and callbacks must be assigned, not stringified.** `useTc`
  does that, and diffs so an unchanged value never re-triggers a render:

    ```tsx
    import { useTc } from '@toolcase/web-components/react'
    const ref = useTc<HTMLElement>({ columns, rows }, { 'tc-sort-change': onSort })
    return <tc-advanced-table ref={ref} />
    ```

### Wrapper components

`@toolcase/web-components/react/components` ships one typed component per element
— camelCase attributes and handlers, JS-only props assigned for you, and a `ref`
typed as the element's own class:

```tsx
import { TcFormInput } from '@toolcase/web-components/react/components'

;<TcFormInput
    label="Portions"
    type="number"
    value={value}
    options={options}
    onTcChange={(e) => setValue(e.detail.value)}
/>
```

They are types plus a thin factory — importing one pulls in no element
implementation, so `register()` is still what defines the elements.

## Form controls

`tc-input`, `tc-textarea`, `tc-select`, `tc-switch`, `tc-radio-group`, and `tc-checkbox-group` are **form-associated custom elements** — they participate in `<form>` submission, reset, and validation via the [ElementInternals API](https://developer.mozilla.org/en-US/docs/Web/API/ElementInternals).

```html
<form id="demo">
    <tc-input name="username" required></tc-input>
    <tc-select name="role">
        <tc-option value="admin">Admin</tc-option>
        <tc-option value="user">User</tc-option>
    </tc-select>
    <button type="submit">Submit</button>
</form>
<script>
    const form = document.getElementById('demo')
    form.addEventListener('submit', (e) => {
        e.preventDefault()
        const data = new FormData(form)
        console.log(data.get('username'), data.get('role'))
    })
    // form.reset() clears all tc-* controls back to their initial values
    // form.checkValidity() / form.reportValidity() honour tc-input[required] etc.
</script>
```

### Behaviour notes

- The `name` attribute on the outer `tc-*` element is what `FormData` uses. The inner native control intentionally carries **no** `name` to avoid double-submission.
- `form.reset()` restores each control to the value it had when first connected to the DOM (the HTML attribute value, or empty).
- Validity is mirrored from the inner control: `tc-input[required]` makes `form.checkValidity()` return `false` until a value is entered.
- `tc-checkbox-group` with multiple selections uses a `FormData` object internally, so `new FormData(form).getAll('fieldname')` returns the array of checked values.
- `tc-radio-group` inner radio buttons use an internal name for native grouping; the user-facing `name` attribute on `tc-radio-group` is forwarded to the form entry via `ElementInternals`.
- **Browser support:** `ElementInternals` / `formAssociated` requires Chrome 77+, Firefox 98+, Safari 16.4+. In older browsers these controls degrade gracefully — they render correctly but their values are not included in `FormData` and form reset/validation do not apply to them.

## License

[MIT](https://github.com/kalevski/toolcase/blob/main/LICENSE)
