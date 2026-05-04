# @toolcase/react-components

[![GitHub](https://img.shields.io/github/license/kalevski/toolcase?style=for-the-badge)](https://github.com/kalevski/toolcase/blob/main/LICENSE)
[![npm version](https://img.shields.io/npm/v/@toolcase/react-components?color=teal&label=VERSION&style=for-the-badge)](https://www.npmjs.com/package/@toolcase/react-components)

🧩 A production-grade React component library — **layout, forms, data display, feedback, file handling, and advanced editors** — built on top of Bootstrap 5 and `@toolcase/base`. TypeScript-first, BEM-themed, accessibility-friendly, no `border-radius` clutter.

📖 Live demos & API docs: **[toolcase.kalevski.dev/react-components](https://toolcase.kalevski.dev/react-components)**

## Install

```bash
npm install @toolcase/react-components @toolcase/base
```

### Peer dependencies

- `react >= 18`
- `react-dom >= 18`
- `@toolcase/base ^3.x`

## Setup

Import the bundled stylesheet **once** (e.g. in your app entrypoint):

```ts
import '@toolcase/react-components/style.css'
```

That's it — components are tree-shaken, so you only pay for what you import.

## Quick example

```tsx
import {
    DashboardLayout, Card, Heading, Text,
    Button, Input, Form, FormInput, Alert
} from '@toolcase/react-components'

export default function App() {
    return (
        <DashboardLayout>
            <Card>
                <Heading level={2}>Welcome back</Heading>
                <Text>Sign in to continue.</Text>
                <Form onSubmit={(values) => console.log(values)}>
                    <FormInput name="email" label="Email" required />
                    <FormInput name="password" label="Password" type="password" required />
                    <Button type="submit">Sign in</Button>
                </Form>
                <Alert variant="info">First time here? Use the magic link.</Alert>
            </Card>
        </DashboardLayout>
    )
}
```

## Components

### Layout

| Component | Description |
|-----------|-------------|
| `BasicLayout` | Page shell with header / content / footer slots. |
| `DashboardLayout` | Sidebar + content layout for admin UIs. |
| `DashboardCard` | Card container for dashboard widgets. |
| `SideNav` | Sidebar navigation. |
| `CoolNav` | Stylized navigation bar. |
| `Spacer`, `Divider`, `Group` | Layout primitives. |

### Form controls

| Component | Description |
|-----------|-------------|
| `Button`, `CoolButton`, `IconButton` | Buttons with variants. |
| `Input`, `Textarea` | Text inputs. |
| `Select`, `ExtendedSelect` | Standard + searchable selects. |
| `Checkbox`, `CheckboxGroup`, `Radio`, `RadioGroup`, `Switch`, `ToggleCard` | Toggleable controls. |
| `TagInput` | Add/remove tag tokens. |
| `ColorPicker`, `DatePicker`, `IconPicker` | Specialised pickers. |
| `Form`, `FormInput`, `FormWizard` | Form wrapper + integrated, validated inputs + multi-step wizard. |
| `EarlySignupForm`, `Login` | Pre-built composite forms. |

### Data display

| Component | Description |
|-----------|-------------|
| `Table` | Data table. |
| `Card`, `CardOptions`, `MultiCardSelect`, `SingleCardSelect`, `PricingCard` | Card variants. |
| `Badge`, `Tag`, `Chip`, `StatusDot` | Compact labels and status indicators. |
| `Avatar`, `Icon` | Identity + iconography. |
| `ProgressBar`, `Timeline`, `Changelog`, `UsageSummaryPanel` | Progress + history surfaces. |

### Text & typography

`Heading`, `Text`, `Label`, `Link`, `Kbd`, `CodeSnippet`, `HelperText`.

### Feedback

| Component | Description |
|-----------|-------------|
| `Alert` | Banner-style alert. |
| `Spinner`, `Skeleton` | Loading states. |
| `Tooltip` | Hover tooltip. |
| `EmptyState` | Empty placeholder. |
| `Modal` | Modal system — `Modal.Window`, `Modal.Control`, `Modal.Context`. |

### File handling

`FileDropzone`, `File`, `SimpleFile`, `QueuedFile`, `FileTags`, `AssetBundle`.

### Navigation & branding

`Brand`, `Hero`, `PageFooter`, `PinnedFeatureShowcase`, `UserPanel`, `Dropdown`, `TabSections`, `WelcomeGuide`.

### Advanced editors / surfaces

`JSONEditor`, `JSONSchemaDef`, `NodeEditor`, `BitmapFontGenerator`, `ActionHeader`, `ActionItems`, `Build`, `DangerZoneActions`, `VerticalItemList`, `EditableText`, `Image`, `VisuallyHidden`.

## Theming

### CSS custom properties

Every component exposes a fixed set of CSS variables. Override at any DOM scope to retheme.

```css
:root {
    --rc-dropdown-bg: #1f1f1f;
    --rc-dropdown-fg: #f5f5f5;
    --at-row-hover-bg: #2a2a2a;
}
```

Per-component variable prefixes are stable (e.g. `--rc-dropdown-`, `--at-` for `AdvancedTable`). Don't invent new prefixes — it breaks future overrides.

### SCSS overrides

If you build your own bundle, override SCSS variables before importing:

```scss
$primary: #5b8def;
@import '@toolcase/react-components/style/index.scss';
```

### BEM naming

Roots carry both `component` and `component-{name}`; children use `component-{name}__{part}`; modifier classes are `--{state}`. So `.component-dropdown__menu--open` is the open menu of a dropdown — easy to target without specificity wars.

## Design constraints

- **No `border-radius`** anywhere except intentionally circular shapes (spinner rings, slider thumbs, carousel dots). Stay sharp.
- **Mobile-first** SCSS — only `min-width` media queries.
- **Touch-friendly** — 44px minimum touch target under `@media (pointer: coarse)`.
- **Z-index scale is fixed**: `Tooltip 1070 > Dropdown 1060 > Modal content 1055 > Modal backdrop 1050`. Don't add new layers.

## Browser support

Modern evergreen browsers (Chrome, Edge, Firefox, Safari). React 18+ required.

## License

[MIT](https://github.com/kalevski/toolcase/blob/main/LICENSE)
