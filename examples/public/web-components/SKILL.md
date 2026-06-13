---
name: web-components
description: Use when building UI with @toolcase/web-components — framework-free HTML5 Web Components (`tc-*` custom elements) with from-scratch toolcase styling and a Bootstrap-compatible class API. Covers layout (Container, Row, Col, Spacer), content (ActionHeader, ActionItems, ActionRowList, Alert, Avatar, Badge, BadgeRow, Brand, Button, ButtonGroup, Card, Carousel, CloseButton, Collapse, Divider, Dropdown, Heading, Kbd, ListGroup, Placeholder, Progress, PulseIndicator, Spinner, Text, VisuallyHidden), navigation (Breadcrumb, Nav, Navbar, Pagination, Scrollspy), overlays & feedback (Modal, Offcanvas, Popover, Toast, Tooltip), and forms (Check, FloatingLabel, Form, HelperText, Input, InputGroup, InputGroupText, Label, Option, Radio, Range, Select, Switch, Textarea). Consumable from any stack — React, Vue, Svelte, or plain HTML.
---

# web-components — API Reference

Framework-free HTML5 Web Components with their own from-scratch toolcase styling — no Bootstrap dependency, Bootstrap-compatible markup/class API. No React, Vue, or Angular required — drop `tc-*` tags into any stack.

```ts
import { register } from '@toolcase/web-components'
import '@toolcase/web-components/style.css'

register() // registers all tc-* elements via customElements.define
```

After `register()` you can author markup directly:

```html
<tc-button variant="primary">Save</tc-button>
<tc-modal title="Confirm">Are you sure?</tc-modal>
<tc-alert variant="success" dismissible>Saved successfully.</tc-alert>
```

---

## Table of Contents

- [Layout](#layout)
  - [tc-container](#tc-container)
  - [tc-row](#tc-row)
  - [tc-col](#tc-col)
  - [tc-spacer](#tc-spacer)
- [Content](#content)
  - [tc-action-header](#tc-action-header)
  - [tc-action-items](#tc-action-items)
  - [tc-action-row-list](#tc-action-row-list)
  - [tc-alert](#tc-alert)
  - [tc-avatar](#tc-avatar)
  - [tc-badge](#tc-badge)
  - [tc-badge-row](#tc-badge-row)
  - [tc-brand](#tc-brand)
  - [tc-button](#tc-button)
  - [tc-button-group](#tc-button-group)
  - [tc-card](#tc-card)
  - [tc-carousel](#tc-carousel)
  - [tc-close-button](#tc-close-button)
  - [tc-collapse](#tc-collapse)
  - [tc-divider](#tc-divider)
  - [tc-dropdown](#tc-dropdown)
  - [tc-heading](#tc-heading)
  - [tc-icon](#tc-icon)
  - [tc-kbd](#tc-kbd)
  - [tc-link](#tc-link)
  - [tc-list-group](#tc-list-group)
  - [tc-placeholder](#tc-placeholder)
  - [tc-progress](#tc-progress)
  - [tc-pulse-indicator](#tc-pulse-indicator)
  - [tc-spinner](#tc-spinner)
  - [tc-text](#tc-text)
  - [tc-visually-hidden](#tc-visually-hidden)
- [Navigation](#navigation)
  - [tc-breadcrumb](#tc-breadcrumb)
  - [tc-nav](#tc-nav)
  - [tc-navbar](#tc-navbar)
  - [tc-pagination](#tc-pagination)
  - [tc-scrollspy](#tc-scrollspy)
- [Overlays & Feedback](#overlays--feedback)
  - [tc-modal](#tc-modal)
  - [tc-offcanvas](#tc-offcanvas)
  - [tc-popover](#tc-popover)
  - [tc-toast](#tc-toast)
  - [tc-tooltip](#tc-tooltip)
- [Forms](#forms)
  - [tc-check](#tc-check)
  - [tc-floating-label](#tc-floating-label)
  - [tc-form](#tc-form)
  - [tc-helper-text](#tc-helper-text)
  - [tc-input](#tc-input)
  - [tc-input-group](#tc-input-group)
  - [tc-label](#tc-label)
  - [tc-radio](#tc-radio)
  - [tc-range](#tc-range)
  - [tc-select](#tc-select)
  - [tc-switch](#tc-switch)
  - [tc-textarea](#tc-textarea)

---

## Layout

### tc-container

Responsive fixed-width container.

**Attributes**

| Attribute | Type | Default | Description |
|-----------|------|---------|-------------|
| `fluid` | boolean | false | Full-width fluid container |
| `size` | `sm\|md\|lg\|xl\|xxl` | — | Max-width breakpoint |

```html
<tc-container><!-- content --></tc-container>
<tc-container fluid><!-- full-width --></tc-container>
<tc-container size="lg"><!-- max-lg width --></tc-container>
```

---

### tc-row

Grid row wrapper.

**Attributes**

| Attribute | Type | Default | Description |
|-----------|------|---------|-------------|
| `cols` | number | — | Default column count |
| `cols-sm/md/lg/xl/xxl` | number | — | Responsive column count |
| `gutter` | `0\|1\|2\|3\|4\|5` | — | Gutter size |
| `align` | `start\|center\|end\|baseline\|stretch` | — | Align items |
| `justify` | `start\|center\|end\|between\|around\|evenly` | — | Justify content |

```html
<tc-row cols="3" gutter="3">
    <tc-col>A</tc-col>
    <tc-col>B</tc-col>
    <tc-col>C</tc-col>
</tc-row>
```

---

### tc-col

Grid column.

**Attributes**

| Attribute | Type | Default | Description |
|-----------|------|---------|-------------|
| `span` | `1–12\|auto` | auto | Column span |
| `span-sm/md/lg/xl/xxl` | `1–12\|auto` | — | Responsive span |
| `offset` | `0–11` | — | Offset columns |
| `order` | `first\|last\|0–5` | — | Order |

```html
<tc-col span="6">Half width</tc-col>
<tc-col span="12" span-md="6">Full then half</tc-col>
```

---

### tc-spacer

Purely structural spacing element. Fills available space in a flex container when `size` is omitted, or provides a fixed dimension along the given axis when `size` is set. The element is `aria-hidden` and carries no visible chrome.

**Tag:** `tc-spacer`

**Attributes**

| Attribute | Type | Default | Description |
|-----------|------|---------|-------------|
| `size` | string \| number | — | Fixed size along the axis. Bare numbers are treated as `px` (e.g. `size="24"` → `24px`). Any CSS length string is accepted (`1rem`, `50%`, …). When omitted the spacer sets `flex: 1 1 auto` and expands to fill available space. |
| `axis` | `horizontal\|vertical` | `vertical` | Axis along which space is applied. `vertical` sets a fixed/flexible height; `horizontal` sets a fixed/flexible width. |

**Events**

None. `tc-spacer` is a purely presentational element.

**Slots**

None.

```html
<!-- Fixed vertical gap (32px) between two blocks -->
<tc-spacer size="32"></tc-spacer>

<!-- Fixed horizontal gap (1rem) between inline items -->
<tc-spacer size="1rem" axis="horizontal"></tc-spacer>

<!-- Flexible spacer — pushes siblings apart in a flex row -->
<div style="display:flex">
    <span>Left</span>
    <tc-spacer axis="horizontal"></tc-spacer>
    <span>Right</span>
</div>
```

---

## Content

### tc-action-header

Flex header row with slotted title content on the left and a row of action buttons on the right. Dispatches a `tc-exec` custom event when an action button is clicked.

**Attributes**

| Attribute | Type | Default | Description |
|-----------|------|---------|-------------|
| `disabled` | boolean | false | Disables all action buttons and suppresses `tc-exec` |

**Properties**

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `actions` | `ActionHeaderAction[]` | `[]` | Array of action descriptors (see below) |
| `onExec` | `(key: string) => void \| null` | `null` | Optional callback invoked in addition to the `tc-exec` event |

**ActionHeaderAction shape**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `key` | `string` | yes | Unique identifier, returned in `tc-exec` detail |
| `label` | `string` | no | Button label text |
| `icon` | `string` | no | Lucide icon name in PascalCase (e.g. `"Pencil"`, `"Trash2"`) |
| `variant` | `string` | no | Bootstrap button variant — default `"secondary"` |
| `disabled` | `boolean` | no | Disables this individual action |

**Events**

| Event | Detail | Description |
|-------|--------|-------------|
| `tc-exec` | `{ key: string }` | Fired (bubbles) when a non-disabled action button is clicked |

**Slots**

The element's light-DOM children are placed in the left content region (`.tc-action-header-content`). Use headings, text, or badges here.

```html
<tc-action-header id="hdr">
    <strong>Users</strong>
</tc-action-header>

<script>
    const el = document.getElementById('hdr')
    el.actions = [
        { key: 'add',    label: 'Add',    icon: 'Plus' },
        { key: 'export', label: 'Export', icon: 'Download' },
        { key: 'delete', label: 'Delete', variant: 'danger' },
    ]
    el.addEventListener('tc-exec', e => console.log('exec', e.detail.key))
</script>
```

---

### tc-action-items

Dropdown menu button with keyboard-accessible items positioned relative to the trigger. Fires `tc-action-click` when an item is chosen and closes the menu.

**Attributes**

| Attribute | Type | Default | Description |
|-----------|------|---------|-------------|
| `label` | string | `'Actions'` | Trigger button text |

**Properties**

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `items` | `ActionItem[]` | `[]` | Array of menu item descriptors (see below) |
| `onActionClick` | `(key: string) => void \| null` | `null` | Optional callback invoked in addition to `tc-action-click` |

**ActionItem shape**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `key` | `string` | yes | Unique identifier returned in `tc-action-click` detail |
| `label` | `string` | yes | Item label text |
| `icon` | `string` | no | Lucide icon name in PascalCase (e.g. `"Pencil"`, `"Trash2"`) |
| `disabled` | `boolean` | no | Disables this item (skipped in keyboard navigation) |
| `danger` | `boolean` | no | Renders the item in danger/destructive color |
| `divider` | `boolean` | no | Renders a horizontal separator instead of a button |

**Events**

| Event | Detail | Description |
|-------|--------|-------------|
| `tc-action-click` | `{ key: string }` | Fired (bubbles) when a non-disabled item is activated |

**Slots:** none

```html
<tc-action-items id="menu" label="Actions"></tc-action-items>

<script>
    const el = document.getElementById('menu')
    el.items = [
        { key: 'edit',   label: 'Edit',   icon: 'Pencil' },
        { key: 'share',  label: 'Share',  icon: 'Share2' },
        { key: 'div',    label: '',       divider: true },
        { key: 'delete', label: 'Delete', icon: 'Trash2', danger: true },
    ]
    el.addEventListener('tc-action-click', e => console.log('chosen', e.detail.key))
</script>
```

---

### tc-action-row-list

Vertical list of action rows, each with a title, optional description, and a CTA button on the right. Fires `tc-action-click` when a row's button is clicked. Disabled rows render at reduced opacity and are not interactive.

**Attributes**

| Attribute | Type | Default | Description |
|-----------|------|---------|-------------|
| `outline` | boolean | false | Render CTA buttons in outline style (`btn-outline-*`) |
| `trailing-icon` | string | — | Lucide icon name on CTA buttons (omit = chevron-right; `none` or empty = suppress) |

**Properties**

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `actions` | `ActionRow[]` | `[]` | Array of row descriptors (see below) |
| `onActionClick` | `(key: string) => void \| null` | `null` | Optional callback invoked in addition to `tc-action-click` |

**ActionRow shape**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `key` | `string` | yes | Unique identifier returned in `tc-action-click` detail |
| `title` | `string` | yes | Row title (Inter 500, `--tc-text`) |
| `description` | `string` | no | Secondary line below the title (`--tc-text-muted`, 12.5px) |
| `label` | `string` | no | CTA button label text |
| `icon` | `string` | no | Lucide icon name in PascalCase shown before the label (e.g. `"Download"`) |
| `variant` | `string` | no | Bootstrap button variant — default `"secondary"` |
| `disabled` | `boolean` | no | Disables the CTA; row renders at 50% opacity with `pointer-events: none` |

**Events**

| Event | Detail | Description |
|-------|--------|-------------|
| `tc-action-click` | `{ key: string }` | Fired (bubbles) when a non-disabled row's CTA button is clicked |

**Slots:** none

```html
<tc-action-row-list id="settings-list"></tc-action-row-list>

<script>
    const el = document.getElementById('settings-list')
    el.actions = [
        { key: 'profile',  title: 'Profile',  description: 'Manage your account', label: 'Edit' },
        { key: 'billing',  title: 'Billing',  description: 'Update payment info',  label: 'Manage' },
        { key: 'security', title: 'Security', description: 'Passwords and 2FA',    label: 'Configure', variant: 'danger' },
        { key: 'api',      title: 'API keys', description: 'Manage tokens',        label: 'View', disabled: true },
    ]
    el.addEventListener('tc-action-click', e => console.log('clicked', e.detail.key))
</script>

<!-- Outline buttons with a custom trailing icon -->
<tc-action-row-list id="export-list" outline trailing-icon="ArrowRight"></tc-action-row-list>

<!-- No trailing icon -->
<tc-action-row-list id="plain-list" trailing-icon="none"></tc-action-row-list>
```

---

### tc-alert

Contextual feedback message.

**Attributes**

| Attribute | Type | Default | Description |
|-----------|------|---------|-------------|
| `variant` | `primary\|secondary\|success\|danger\|warning\|info\|light\|dark` | `primary` | Color variant |
| `dismissible` | boolean | false | Show close button |

**Methods:** `close()`

**Events:** `tc-closed`

```html
<tc-alert variant="success" dismissible>Operation completed.</tc-alert>
```

---

### tc-avatar

Circular user avatar. Displays an image, 1–2 initials derived from a name, or a placeholder user glyph when neither is provided. Optionally shows a colour-coded status dot at the bottom-right corner.

**Tag:** `tc-avatar`

**Attributes**

| Attribute | Type | Default | Description |
|-----------|------|---------|-------------|
| `src` | string | — | Image URL. When present, renders an `<img>`. Falls back to initials or placeholder on load error. |
| `alt` | string | — | Image alt / accessible label override. Defaults to the `name` attribute when absent. |
| `name` | string | — | Display name. Used to derive 1–2 initials when `src` is absent. Also used as the host's `aria-label`. |
| `size` | `small\|default\|large` | `default` | Avatar diameter: 28 px / 40 px / 56 px. |
| `status` | `online\|offline\|busy\|away` | — | When set, renders a coloured dot at the bottom-right corner with an `aria-label` for the status value. |
| `variant` | `primary\|secondary\|success\|danger\|warning\|info` | `secondary` | Background tint for initials / placeholder. Soft tint + dark emphasis text. |

**JS Properties**

Each attribute is reflected as a same-named JS property (getter/setter).

**Events**

None.

**Slots**

None.

**CSS custom properties (theming)**

| Property | Default | Description |
|----------|---------|-------------|
| `--bs-avatar-size` | `40px` | Diameter of the circle. Overridden per size. |
| `--bs-avatar-font-size` | `0.875rem` | Initials font size. |
| `--bs-avatar-bg` | `var(--tc-surface-muted)` | Background colour (overridden by variant). |
| `--bs-avatar-color` | `var(--tc-text-muted)` | Initials / glyph colour (overridden by variant). |
| `--bs-avatar-status-size` | `9px` | Status dot diameter. |
| `--bs-avatar-status-ring` | `2px` | Width of the tc-surface ring around the status dot. |
| `--bs-avatar-status-offset` | `2px` | Distance from bottom/right edge to the status dot. |

```html
<!-- Image avatar -->
<tc-avatar src="https://example.com/photo.jpg" name="Alice Johnson"></tc-avatar>

<!-- Initials only -->
<tc-avatar name="Bob Smith" variant="primary"></tc-avatar>

<!-- Placeholder glyph -->
<tc-avatar variant="secondary"></tc-avatar>

<!-- With status -->
<tc-avatar name="Carol Davis" status="online" size="large"></tc-avatar>

<!-- Sizes -->
<tc-avatar name="S" size="small" variant="success"></tc-avatar>
<tc-avatar name="D" variant="info"></tc-avatar>
<tc-avatar name="L" size="large" variant="danger"></tc-avatar>
```

---

### tc-badge

Small count or label indicator.

**Attributes**

| Attribute | Type | Default | Description |
|-----------|------|---------|-------------|
| `variant` | `primary\|secondary\|success\|danger\|warning\|info\|light\|dark` | `primary` | Color variant |
| `text` | string | — | Badge text (alternative to slot) |

```html
<tc-badge variant="danger">4</tc-badge>
<tc-badge variant="success" text="New"></tc-badge>
```

---

### tc-badge-row

Horizontal row of paired key/value chips. Sharp square corners, slate neutral default, JetBrains Mono value text. Set badges exclusively via the `badges` JS property.

**Attributes**

| Attribute | Type | Default | Description |
|-----------|------|---------|-------------|
| `size` | `sm\|md` | `md` | Chip size — controls padding and font-size |

**Properties**

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `badges` | `BadgeRowItem[]` | `[]` | Array of badge descriptors (see below) |

**BadgeRowItem shape**

| Field | Type | Description |
|-------|------|-------------|
| `label` | `string` | Always-visible key text |
| `value` | `string \| number` | Optional value segment (right chip) |
| `variant` | `primary\|secondary\|success\|danger\|warning\|info\|light\|dark` | Status tint applied to the item |
| `color` | `string` | Per-item accent color (any CSS color) applied via `--bs-badge-row-color` |

**Events**

None. `tc-badge-row` is a purely presentational component.

**Slots**

None.

```html
<tc-badge-row></tc-badge-row>

<script>
const row = document.querySelector('tc-badge-row')
row.badges = [
    { label: 'env', value: 'production' },
    { label: 'status', value: 'healthy', variant: 'success' },
    { label: 'team', value: 'frontend', color: '#6366f1' },
]
</script>

<!-- sm size -->
<tc-badge-row size="sm"></tc-badge-row>
```

---

### tc-button

Button.

**Attributes**

| Attribute | Type | Default | Description |
|-----------|------|---------|-------------|
| `variant` | `primary\|secondary\|success\|danger\|warning\|info\|light\|dark` | `primary` | Color variant |
| `outline` | boolean | false | Outline style |
| `size` | `sm\|lg` | — | Button size |
| `disabled` | boolean | false | Disabled state |
| `loading` | boolean | false | Show spinner, disables button |
| `href` | string | — | Render as `<a>` link button |
| `type` | `button\|submit\|reset` | `button` | Button type |

```html
<tc-button variant="primary">Save</tc-button>
<tc-button variant="danger" outline>Delete</tc-button>
<tc-button loading>Saving…</tc-button>
```

---

### tc-button-group

Groups buttons horizontally or vertically.

**Attributes**

| Attribute | Type | Default | Description |
|-----------|------|---------|-------------|
| `vertical` | boolean | false | Vertical layout |
| `size` | `sm\|lg` | — | Size for all child buttons |

```html
<tc-button-group>
    <tc-button>A</tc-button>
    <tc-button>B</tc-button>
</tc-button-group>
```

---

### tc-card

Content container with optional header/footer.

**Attributes**

| Attribute | Type | Default | Description |
|-----------|------|---------|-------------|
| `title` | string | — | Card title in header |
| `subtitle` | string | — | Card subtitle |
| `variant` | `primary\|secondary\|success\|danger\|warning\|info\|light\|dark` | — | Background color (`text-bg-*`) |
| `img` | string | — | Image URL |
| `img-position` | `top\|bottom` | `top` | Image position |

**Slots:** default (body), `slot="header"`, `slot="footer"`

```html
<tc-card title="My Card">
    <p>Body content.</p>
    <tc-button slot="footer" variant="primary">Action</tc-button>
</tc-card>
```

---

### tc-carousel

Slideshow component with built-in slide/fade behavior.

**Attributes**

| Attribute | Type | Default | Description |
|-----------|------|---------|-------------|
| `controls` | boolean | false | Show prev/next buttons |
| `indicators` | boolean | false | Show dot indicators |
| `fade` | boolean | false | Crossfade transition |
| `ride` | `carousel\|false` | false | Autoplay on load |
| `interval` | number | 5000 | Slide interval (ms) |
| `pause` | `hover\|false` | `hover` | Pause on hover |

**Methods:** `next()`, `prev()`, `to(index)`, `cycle()`, `pause()`

**Events:** `tc-slide`, `tc-slid`

```html
<tc-carousel controls indicators ride="carousel" interval="3000">
    <div>Slide 1</div>
    <div>Slide 2</div>
    <div>Slide 3</div>
</tc-carousel>
```

---

### tc-close-button

Standalone × close button.

**Attributes**

| Attribute | Type | Default | Description |
|-----------|------|---------|-------------|
| `disabled` | boolean | false | Disabled state |
| `label` | string | `Close` | Aria label |

**Events:** `tc-click`

```html
<tc-close-button></tc-close-button>
```

---

### tc-collapse

Toggleable content panel with built-in height/width animation.

**Attributes**

| Attribute | Type | Default | Description |
|-----------|------|---------|-------------|
| `open` | boolean | false | Expanded state |
| `horizontal` | boolean | false | Horizontal collapse |

**Methods:** `show()`, `hide()`, `toggle()`

**Events:** `tc-show`, `tc-shown`, `tc-hide`, `tc-hidden`

```html
<button onclick="document.querySelector('tc-collapse').toggle()">Toggle</button>
<tc-collapse>Collapsible content</tc-collapse>
```

---

### tc-dropdown

Dropdown menu positioned by Popper.js.

**Attributes**

| Attribute | Type | Default | Description |
|-----------|------|---------|-------------|
| `label` | string | — | Toggle button label |
| `variant` | `primary\|secondary\|…` | `primary` | Button color |
| `split` | boolean | false | Split button style |
| `direction` | `down\|up\|start\|end` | `down` | Drop direction |
| `auto-close` | `true\|inside\|outside\|false` | `true` | Close behavior |

**Methods:** `show()`, `hide()`, `toggle()`

**Events:** `tc-show`, `tc-shown`, `tc-hide`, `tc-hidden`

```html
<tc-dropdown label="Options" variant="secondary">
    <tc-dropdown-item>Edit</tc-dropdown-item>
    <tc-dropdown-item>Delete</tc-dropdown-item>
</tc-dropdown>
```

#### tc-dropdown-item

Item inside `tc-dropdown`.

**Attributes:** `href`, `disabled`, `active`, `divider` (boolean, renders `<hr>`)

---

### tc-heading

Semantic heading element (h1–h6) with optional slate-ink gradient text treatment. Renders a real `<hN>` element for a correct document outline.

**Attributes**

| Attribute | Type | Default | Description |
|-----------|------|---------|-------------|
| `as` | `h1\|h2\|h3\|h4\|h5\|h6` | `h2` | Which heading level to render |
| `gradient` | boolean | false | Apply slate-ink gradient text treatment |

**Slots**

| Slot | Description |
|------|-------------|
| (default) | Heading text or inline content |

```html
<tc-heading as="h1">Page title</tc-heading>
<tc-heading as="h2" gradient>Section with gradient</tc-heading>
<tc-heading>Default h2 heading</tc-heading>
```

---

### tc-list-group

Vertical list of items.

**Attributes**

| Attribute | Type | Default | Description |
|-----------|------|---------|-------------|
| `flush` | boolean | false | Remove outer borders |
| `numbered` | boolean | false | Auto-numbered items |
| `horizontal` | `true\|sm\|md\|lg\|xl\|xxl` | — | Horizontal layout |

```html
<tc-list-group>
    <tc-list-group-item>Item A</tc-list-group-item>
    <tc-list-group-item active>Item B (active)</tc-list-group-item>
</tc-list-group>
```

#### tc-list-group-item

**Attributes:** `active`, `disabled`, `variant`, `href`, `action`

---

### tc-placeholder

Loading skeleton placeholder.

**Attributes**

| Attribute | Type | Default | Description |
|-----------|------|---------|-------------|
| `animation` | `glow\|wave` | — | Animation type |
| `variant` | `primary\|secondary\|…` | — | Color |
| `size` | `xs\|sm\|lg` | — | Height |
| `width` | string | `100%` | Width (any CSS value) |

```html
<tc-placeholder animation="glow" width="75%"></tc-placeholder>
```

---

### tc-progress

Progress bar.

**Attributes**

| Attribute | Type | Default | Description |
|-----------|------|---------|-------------|
| `value` | number | 0 | Current value |
| `min` | number | 0 | Minimum value |
| `max` | number | 100 | Maximum value |
| `variant` | `primary\|secondary\|…` | — | Bar color |
| `striped` | boolean | false | Striped style |
| `animated` | boolean | false | Animated stripe |
| `label` | boolean | false | Show percentage text |

Use `tc-progress-bar` children for stacked bars:

```html
<tc-progress value="60" variant="primary" label></tc-progress>

<!-- stacked -->
<tc-progress>
    <tc-progress-bar value="30" variant="primary"></tc-progress-bar>
    <tc-progress-bar value="40" variant="success"></tc-progress-bar>
</tc-progress>
```

#### tc-progress-bar

**Attributes:** `value` (0–100), `variant`, `striped`, `animated`, `label`

---

### tc-spinner

Animated loading indicator.

**Attributes**

| Attribute | Type | Default | Description |
|-----------|------|---------|-------------|
| `type` | `border\|grow\|dots\|bars\|pulse\|orbit` | `border` | Spinner shape |
| `variant` | `primary\|secondary\|…` | — | Color |
| `size` | `sm` | — | Small size |
| `label` | string | `Loading…` | Visually-hidden label |

Shapes: `border` (ring with colored arc), `grow` (pulsing dot), `dots` (bouncing trio), `bars` (equalizer bars), `pulse` (sonar ping), `orbit` (dashed ring with satellite dot).

```html
<tc-spinner type="border" variant="primary"></tc-spinner>
<tc-spinner type="grow" size="sm"></tc-spinner>
<tc-spinner type="dots" variant="info"></tc-spinner>
<tc-spinner type="bars"></tc-spinner>
<tc-spinner type="pulse" variant="success"></tc-spinner>
<tc-spinner type="orbit" size="sm"></tc-spinner>
```

---

### tc-pulse-indicator

Animated pulsing status dot with a text label. Defaults to `--tc-success` green (live/online indicator). The ring is a subtle `::after` expand-and-fade loop (~1.6s). The `paused` attribute freezes the ring for idle/offline states. Respects `prefers-reduced-motion` — the ring is hidden and only the static dot is shown.

**Tag:** `tc-pulse-indicator`

**Attributes**

| Attribute | Type | Default | Description |
|-----------|------|---------|-------------|
| `label` | string | — | Label text shown beside the dot. When absent, slotted children are used as the label instead |
| `color` | string | `var(--tc-success)` | Any CSS color value. Written to `--bs-pulse-indicator-color` on the host; drives both the dot fill and the ring border |
| `paused` | boolean | false | Freezes the pulse ring animation. Useful for offline or idle states |

**JS Properties**

All three attributes are reflected as JS properties with the same names (`label`, `color`, `paused`).

**Slots**

| Slot | Description |
|------|-------------|
| _(default)_ | Label content when the `label` attribute is absent. Preserved across re-renders inside `.tc-pulse-indicator-label` |

**Events**

None. `tc-pulse-indicator` is a purely presentational status element.

**CSS custom properties (theming)**

| Property | Default | Description |
|----------|---------|-------------|
| `--bs-pulse-indicator-color` | `var(--tc-success)` | Dot fill color and ring border color. Set via the `color` attribute or override in CSS |
| `--bs-pulse-indicator-dot-size` | `8px` | Diameter of the solid dot |
| `--bs-pulse-indicator-gap` | `6px` | Gap between dot and label |
| `--bs-pulse-indicator-label-size` | `12.5px` | Label font size |
| `--bs-pulse-indicator-label-color` | `var(--tc-text-muted)` | Label text color |
| `--bs-pulse-indicator-animation-speed` | `1.6s` | Pulse ring animation duration |

```html
<!-- Default (success green, live/online) -->
<tc-pulse-indicator label="Online"></tc-pulse-indicator>

<!-- Custom color -->
<tc-pulse-indicator label="Warning" color="var(--tc-warning)"></tc-pulse-indicator>
<tc-pulse-indicator label="Danger" color="var(--tc-danger)"></tc-pulse-indicator>
<tc-pulse-indicator label="Custom" color="#a855f7"></tc-pulse-indicator>

<!-- Paused (frozen ring, idle/offline) -->
<tc-pulse-indicator label="Idle" paused></tc-pulse-indicator>
<tc-pulse-indicator label="Offline" color="var(--tc-danger)" paused></tc-pulse-indicator>

<!-- Slotted label content (label attribute absent) -->
<tc-pulse-indicator><strong>Active session</strong></tc-pulse-indicator>
```

---

### tc-text

Flexible text element with semantic HTML tags and style variants. Renders as a `<p>`, `<span>`, `<small>`, or `<div>` controlled by the `as` attribute.

**Tag:** `tc-text`

**Attributes**

| Attribute | Type | Default | Description |
|-----------|------|---------|-------------|
| `variant` | `default\|muted\|code\|mono\|truncate` | `default` | Visual style: default prose, muted color, inline code chip, monospace, or single-line truncation |
| `size` | `small\|default\|large` | `default` | Type scale: small ≈ 0.8rem, default ≈ 0.925rem, large ≈ 1.0625rem |
| `as` | `p\|span\|small\|div` | `p` | Semantic HTML tag rendered as the inner element |

**Events**

None. `tc-text` is a purely presentational element.

**Slots**

| Slot | Description |
|------|-------------|
| _(default)_ | Text content — arbitrary inline markup, preserved across re-renders inside `.tc-text-content` |

```html
<tc-text>Default paragraph text.</tc-text>
<tc-text variant="muted">Secondary, muted note.</tc-text>
<tc-text variant="code">inline.code()</tc-text>
<tc-text variant="mono">mono spaced output</tc-text>
<tc-text variant="truncate" as="div" style="width:200px">Long text truncated with ellipsis.</tc-text>
<tc-text size="small" variant="muted">Small muted caption.</tc-text>
<tc-text size="large">Large body text.</tc-text>
<tc-text as="span">Inline span text.</tc-text>
```

---

### tc-brand

Branded wordmark with primary/secondary text, a customisable accent underline bar, and an optional micro-label chip. The primary wordmark renders in JetBrains Mono weight 700 (uppercase, tracked); secondary text uses the muted slate ladder; the label is a sharp-cornered mono micro-chip. The underline defaults to the toolcase signature cyan (`--tc-accent`) and is overridable via the `color` attribute.

**Tag:** `tc-brand`

**Attributes**

| Attribute | Type | Default | Description |
|-----------|------|---------|-------------|
| `primary-text` | string | — | Primary wordmark text rendered as the branded mark |
| `secondary-text` | string | — | Secondary text rendered inline after the primary mark |
| `label` | string | — | Micro-label text rendered as a small chip beside the wordmark |
| `color` | string (CSS color) | `var(--tc-accent)` | CSS color for the underline accent bar (hex, oklch, named, etc.) |
| `xlarge` | boolean | false | Scales primary and secondary text to 2rem |

**Slots**

| Slot | Description |
|------|-------------|
| `primary` | Rich content for the primary wordmark region (overrides `primary-text` attribute when both present) |
| `secondary` | Rich content for the secondary text region (overrides `secondary-text` attribute) |
| `label` | Rich content for the label chip region (overrides `label` attribute) |

**Events**

None.

```html
<!-- Primary text via attribute -->
<tc-brand primary-text="ToolCase"></tc-brand>

<!-- Primary + secondary text -->
<tc-brand primary-text="Tool" secondary-text="Case"></tc-brand>

<!-- With label chip -->
<tc-brand primary-text="ToolCase" label="beta"></tc-brand>

<!-- Custom underline color -->
<tc-brand primary-text="ToolCase" color="#e85d04"></tc-brand>

<!-- Xlarge scale -->
<tc-brand primary-text="ToolCase" xlarge></tc-brand>

<!-- Rich slotted content -->
<tc-brand>
    <strong slot="primary">ToolCase</strong>
    <span slot="secondary">Platform</span>
    <em slot="label">v2</em>
</tc-brand>
```

---

## Navigation

### tc-breadcrumb

Breadcrumb navigation trail.

**Attributes**

| Attribute | Type | Default | Description |
|-----------|------|---------|-------------|
| `divider` | string | `/` | Divider character |

```html
<tc-breadcrumb>
    <tc-breadcrumb-item href="/">Home</tc-breadcrumb-item>
    <tc-breadcrumb-item href="/docs">Docs</tc-breadcrumb-item>
    <tc-breadcrumb-item active>Web Components</tc-breadcrumb-item>
</tc-breadcrumb>
```

#### tc-breadcrumb-item

**Attributes:** `href`, `active`

---

### tc-nav

Navigation strip.

**Attributes**

| Attribute | Type | Default | Description |
|-----------|------|---------|-------------|
| `variant` | `tabs\|pills\|underline` | — | Nav style |
| `fill` | boolean | false | Fill available width |
| `justified` | boolean | false | Equal-width items |
| `vertical` | boolean | false | Vertical layout |

```html
<tc-nav variant="tabs">
    <tc-nav-item href="#a" active>Tab A</tc-nav-item>
    <tc-nav-item href="#b">Tab B</tc-nav-item>
</tc-nav>
```

#### tc-nav-item

**Attributes:** `href`, `target`, `active`, `disabled`

**Events:** `tc-show`, `tc-shown` (when variant is tabs/pills and a tab activates)

---

### tc-navbar

Responsive navigation bar with built-in collapse behavior. Styled as the toolcase app chrome: translucent glass surface (backdrop blur) on a hairline border, the brand rendered as the typographic mark (cyan square dot + mono wordmark), active links carrying a 2px accent underline. `variant="dark"` switches to the ink surface.

**Attributes**

| Attribute | Type | Default | Description |
|-----------|------|---------|-------------|
| `brand` | string | — | Brand name |
| `expand` | `sm\|md\|lg\|xl\|xxl` | `lg` | Collapse breakpoint |
| `variant` | `dark\|light` | — | Theme |
| `bg` | string | — | Background color variant |
| `fixed` | `top\|bottom` | — | Fixed position |
| `sticky` | `top\|bottom` | — | Sticky position |

```html
<tc-navbar brand="MyApp" expand="md" variant="dark" bg="dark">
    <tc-nav>
        <tc-nav-item href="/" active>Home</tc-nav-item>
        <tc-nav-item href="/docs">Docs</tc-nav-item>
    </tc-nav>
</tc-navbar>
```

---

### tc-pagination

Page navigation controls.

**Attributes**

| Attribute | Type | Default | Description |
|-----------|------|---------|-------------|
| `current` | number | 1 | Current page (1-based) |
| `total` | number | 1 | Total page count |
| `max-visible` | number | 5 | Max visible page buttons |
| `size` | `sm\|lg` | — | Control size |
| `align` | `start\|center\|end` | `start` | Alignment |

**Events:** `tc-page-change` with `{ detail: { page: number } }`

```html
<tc-pagination total="20" current="3" max-visible="7"></tc-pagination>
```

---

### tc-scrollspy

Scroll-position tracker (IntersectionObserver based).

**Attributes**

| Attribute | Type | Default | Description |
|-----------|------|---------|-------------|
| `target` | string | — | CSS selector of nav to highlight |
| `offset` | number | 0 | Offset from top (px) |
| `smooth-scroll` | boolean | false | Smooth scroll to sections |

**Events:** `tc-activate`

```html
<tc-scrollspy target="#navbar" style="height:200px; overflow-y:auto;">
    <h4 id="section-1">Section 1</h4>
    <p>...</p>
    <h4 id="section-2">Section 2</h4>
    <p>...</p>
</tc-scrollspy>
```

---

## Overlays & Feedback

### tc-modal

Modal dialog.

**Attributes**

| Attribute | Type | Default | Description |
|-----------|------|---------|-------------|
| `open` | boolean | false | Visible state |
| `title` | string | — | Modal header title |
| `size` | `sm\|lg\|xl` | — | Dialog size |
| `centered` | boolean | false | Vertically centered |
| `scrollable` | boolean | false | Scrollable body |
| `static-backdrop` | boolean | false | Prevent close on backdrop click |
| `fullscreen` | `true\|sm\|md\|lg\|xl\|xxl` | — | Fullscreen breakpoint |

**Methods:** `show()`, `hide()`, `toggle()`

**Events:** `tc-show`, `tc-shown`, `tc-hide`, `tc-hidden`

**Slots:** default (body), `slot="footer"`

```html
<button onclick="document.querySelector('#my-modal').show()">Open</button>
<tc-modal id="my-modal" title="Confirm Action" centered>
    <p>Are you sure you want to proceed?</p>
    <tc-button slot="footer" variant="primary">Confirm</tc-button>
    <tc-button slot="footer" variant="secondary">Cancel</tc-button>
</tc-modal>
```

---

### tc-offcanvas

Offcanvas panel.

**Attributes**

| Attribute | Type | Default | Description |
|-----------|------|---------|-------------|
| `open` | boolean | false | Visible state |
| `placement` | `start\|end\|top\|bottom` | `start` | Slide direction |
| `title` | string | — | Panel title |
| `backdrop` | `true\|false\|static` | `true` | Backdrop behavior |
| `scroll` | boolean | false | Allow body scroll when open |

**Methods:** `show()`, `hide()`, `toggle()`

**Events:** `tc-show`, `tc-shown`, `tc-hide`, `tc-hidden`

```html
<button onclick="document.querySelector('#sidebar').show()">Open Sidebar</button>
<tc-offcanvas id="sidebar" title="Menu" placement="start">
    <p>Sidebar content here.</p>
</tc-offcanvas>
```

---

### tc-popover

Popover positioned by Popper.js.

**Attributes**

| Attribute | Type | Default | Description |
|-----------|------|---------|-------------|
| `title` | string | — | Popover header |
| `content` | string | — | Popover body text |
| `placement` | `top\|right\|bottom\|left\|auto` | `auto` | Position |
| `trigger` | string | `click` | Trigger events |
| `html` | boolean | false | Allow HTML in content |

**Methods:** `show()`, `hide()`, `toggle()`

**Events:** `tc-show`, `tc-shown`, `tc-hide`, `tc-hidden`

```html
<tc-popover title="Info" content="Extra details here." placement="top">
    <button class="btn btn-info">ℹ Info</button>
</tc-popover>
```

---

### tc-toast

Toast notification.

**Attributes**

| Attribute | Type | Default | Description |
|-----------|------|---------|-------------|
| `open` | boolean | false | Visible state |
| `title` | string | — | Header text |
| `autohide` | boolean | true | Auto-dismiss |
| `delay` | number | 5000 | Auto-hide delay (ms) |
| `variant` | string | — | `text-bg-*` color variant |

**Methods:** `show()`, `hide()`

**Events:** `tc-show`, `tc-shown`, `tc-hide`, `tc-hidden`

```html
<tc-toast title="Saved" variant="success" open autohide delay="3000">
    Your changes have been saved.
</tc-toast>
```

---

### tc-tooltip

Tooltip positioned by Popper.js.

**Attributes**

| Attribute | Type | Default | Description |
|-----------|------|---------|-------------|
| `title` | string | — | Tooltip text |
| `placement` | `top\|right\|bottom\|left\|auto` | `auto` | Position |
| `trigger` | string | `hover focus` | Trigger events |
| `html` | boolean | false | Allow HTML in title |

**Methods:** `show()`, `hide()`, `toggle()`

**Events:** `tc-show`, `tc-shown`, `tc-hide`, `tc-hidden`

```html
<tc-tooltip title="Helpful hint" placement="top">
    <button class="btn btn-secondary">Hover me</button>
</tc-tooltip>
```

---

## Forms

### tc-check

Checkbox input.

**Attributes**

| Attribute | Type | Default | Description |
|-----------|------|---------|-------------|
| `label` | string | — | Visible label |
| `checked` | boolean | false | Checked state |
| `disabled` | boolean | false | Disabled |
| `indeterminate` | boolean | false | Indeterminate state |
| `inline` | boolean | false | Inline display |
| `reverse` | boolean | false | Label before input |
| `state` | `valid\|invalid` | — | Validation state |

**Events:** `tc-change` with `{ detail: { checked: boolean } }`

```html
<tc-check label="I agree" checked></tc-check>
<tc-check label="Disabled" disabled></tc-check>
```

---

### tc-floating-label

Floating label wrapper for text input, textarea, or select.

**Attributes**

| Attribute | Type | Default | Description |
|-----------|------|---------|-------------|
| `label` | string | — | Floating label text |
| `for` | string | — | Id of the control inside |

```html
<tc-floating-label label="Email address">
    <tc-input type="email" placeholder="name@example.com"></tc-input>
</tc-floating-label>
```

---

### tc-form

Form wrapper with HTML5 constraint validation.

**Attributes**

| Attribute | Type | Default | Description |
|-----------|------|---------|-------------|
| `validated` | boolean | false | Show validation feedback |
| `novalidate` | boolean | false | Disable native validation UI |

```html
<tc-form novalidate>
    <tc-input label="Name" required></tc-input>
    <tc-button type="submit" variant="primary">Submit</tc-button>
</tc-form>
```

---

### tc-helper-text

Contextual helper text with a leading lucide icon. Pair with form inputs via `aria-describedby`. Port of `@toolcase/react-components` `HelperText`.

**Tag:** `tc-helper-text`

**Attributes**

| Attribute | Type | Default | Description |
|-----------|------|---------|-------------|
| `text` | string | — | Text content. When set, takes precedence over slotted children |
| `variant` | `default\|success\|warning\|error` | `default` | Controls icon and color |
| `icon` | string | — | Lucide icon name in PascalCase (e.g. `HelpCircle`). Overrides the variant default |
| `class-name` | string | — | Extra CSS classes merged onto the rendered wrapper |
| `id` | string | — | Forwarded to the rendered wrapper element for `aria-describedby` pairing |

**Slots**

| Slot | Description |
|------|-------------|
| _(default)_ | Helper text content when the `text` attribute is not set. Supports rich inline markup (links, emphasis, etc.) |

**Default icons per variant**

| Variant | Icon |
|---------|------|
| `default` | `Info` |
| `success` | `CheckCircle` |
| `warning` | `AlertTriangle` |
| `error` | `AlertCircle` |

**Events**

None. `tc-helper-text` is purely presentational.

**Accessibility**

- The leading icon is marked `aria-hidden="true"` (decorative).
- Set `id` on `tc-helper-text` and `aria-describedby` on the paired input to expose the hint to assistive technology.

```html
<!-- All four variants -->
<tc-helper-text variant="default" text="We'll never share your email"></tc-helper-text>
<tc-helper-text variant="success" text="Your password is strong"></tc-helper-text>
<tc-helper-text variant="warning" text="This field will be publicly visible"></tc-helper-text>
<tc-helper-text variant="error" text="Password must be at least 8 characters"></tc-helper-text>

<!-- Slotted children (rich content) -->
<tc-helper-text variant="error">Email already in use — <a href="/login">sign in instead</a></tc-helper-text>

<!-- Custom icon -->
<tc-helper-text variant="default" icon="HelpCircle" text="Need help? See our docs"></tc-helper-text>

<!-- Paired with an input via aria-describedby -->
<input id="email" type="email" aria-describedby="email-hint" />
<tc-helper-text id="email-hint" variant="default" text="We'll never share your email"></tc-helper-text>
```

---

### tc-input

Text input field.

**Attributes**

| Attribute | Type | Default | Description |
|-----------|------|---------|-------------|
| `type` | string | `text` | Input type |
| `value` | string | — | Current value |
| `placeholder` | string | — | Placeholder text |
| `label` | string | — | Visible label |
| `size` | `sm\|lg` | — | Input size |
| `disabled` | boolean | false | Disabled |
| `readonly` | boolean | false | Read-only |
| `required` | boolean | false | Required |
| `state` | `valid\|invalid` | — | Validation state |
| `help` | string | — | Help text below input |

```html
<tc-input type="email" label="Email" placeholder="you@example.com" required></tc-input>
```

---

### tc-input-group

Input with prepended/appended addons.

```html
<tc-input-group>
    <tc-input-group-text>@</tc-input-group-text>
    <tc-input placeholder="username"></tc-input>
</tc-input-group>
```

#### tc-input-group-text

Plain text addon for `tc-input-group`.

---

### tc-radio

Radio button input.

**Attributes**

| Attribute | Type | Default | Description |
|-----------|------|---------|-------------|
| `label` | string | — | Visible label |
| `name` | string | — | Group name |
| `value` | string | — | Input value |
| `checked` | boolean | false | Selected state |
| `disabled` | boolean | false | Disabled |
| `inline` | boolean | false | Inline display |
| `reverse` | boolean | false | Label before input |

**Events:** `tc-change`

```html
<tc-radio name="size" value="sm" label="Small"></tc-radio>
<tc-radio name="size" value="lg" label="Large" checked></tc-radio>
```

---

### tc-range

Range slider input.

**Attributes**

| Attribute | Type | Default | Description |
|-----------|------|---------|-------------|
| `label` | string | — | Visible label |
| `value` | number | 0 | Current value |
| `min` | number | 0 | Minimum |
| `max` | number | 100 | Maximum |
| `step` | number | 1 | Step increment |
| `disabled` | boolean | false | Disabled |

**Events:** `tc-change` with `{ detail: { value: number } }`

```html
<tc-range label="Volume" min="0" max="100" value="50" step="5"></tc-range>
```

---

### tc-select

Select dropdown input.

**Attributes**

| Attribute | Type | Default | Description |
|-----------|------|---------|-------------|
| `label` | string | — | Visible label |
| `value` | string | — | Selected value |
| `multiple` | boolean | false | Multi-select |
| `size` | `sm\|lg` | — | Control size |
| `disabled` | boolean | false | Disabled |
| `state` | `valid\|invalid` | — | Validation state |

**Events:** `tc-change`

Populate with `tc-option` children:

```html
<tc-select label="Country">
    <tc-option value="us">United States</tc-option>
    <tc-option value="gb">United Kingdom</tc-option>
</tc-select>
```

#### tc-option

**Attributes:** `value`, `selected`, `disabled`

---

### tc-switch

Toggle switch (styled checkbox).

**Attributes**

| Attribute | Type | Default | Description |
|-----------|------|---------|-------------|
| `label` | string | — | Visible label |
| `checked` | boolean | false | On/off state |
| `disabled` | boolean | false | Disabled |
| `reverse` | boolean | false | Label before switch |

**Events:** `tc-change` with `{ detail: { checked: boolean } }`

```html
<tc-switch label="Enable notifications" checked></tc-switch>
```

---

### tc-textarea

Multi-line text input.

**Attributes**

| Attribute | Type | Default | Description |
|-----------|------|---------|-------------|
| `value` | string | — | Current value |
| `placeholder` | string | — | Placeholder text |
| `label` | string | — | Visible label |
| `rows` | number | 3 | Visible rows |
| `size` | `sm\|lg` | — | Control size |
| `disabled` | boolean | false | Disabled |
| `readonly` | boolean | false | Read-only |
| `required` | boolean | false | Required |
| `state` | `valid\|invalid` | — | Validation state |
| `help` | string | — | Help text |

```html
<tc-textarea label="Bio" rows="5" placeholder="Tell us about yourself…"></tc-textarea>
```

---

### tc-label

Semantic form label with optional required indicator and info-icon tooltip. Port of `@toolcase/react-components` `Label`.

**Tag:** `tc-label`

**Attributes**

| Attribute | Type | Default | Description |
|-----------|------|---------|-------------|
| `required` | boolean | false | Appends a red asterisk (`*`) after the label text to indicate a required field. The asterisk is `aria-hidden` |
| `tooltip` | string | — | When set, renders an info icon button after the label. The string is used as both `aria-label` and `title` on the button |
| `size` | `small\|default\|large` | `default` | Font-size scale modifier. Maps to `tc-label-sm` / no class / `tc-label-lg` |
| `for` | string | — | Passed through as `for` on the inner `<label>` element to associate the label with a form control by id |

**Slots**

| Slot | Description |
|------|-------------|
| _(default)_ | Label text/content. Rendered inside `.tc-label-content` span |

**Events**

None. `tc-label` is a presentational element.

**Accessibility**

- Renders a real `<label>` element — `for` association works natively with any form control.
- The required asterisk carries `aria-hidden="true"` so screen readers are not confused by `*`.
- The info icon button has `aria-label` set to the `tooltip` string and `title` for hover/focus display.
- Focus on the info button is visible via `:focus-visible` outline.
- `prefers-reduced-motion` is honoured globally by the stylesheet.

**CSS custom properties (theming)**

| Property | Default | Description |
|----------|---------|-------------|
| `--bs-label-font-size` | `0.8125rem` (13px) | Default label font size |
| `--bs-label-font-weight` | `500` | Label font weight |
| `--bs-label-color` | `var(--tc-text)` | Label text color |
| `--bs-label-sm-font-size` | `0.75rem` (12px) | Font size for `size="small"` |
| `--bs-label-lg-font-size` | `0.9375rem` (15px) | Font size for `size="large"` |
| `--bs-label-gap` | `0.3125rem` (5px) | Gap between content, asterisk, and info button |
| `--bs-label-required-color` | `var(--tc-danger)` | Required asterisk color |
| `--bs-label-info-color` | `var(--tc-text-muted)` | Info icon button color |
| `--bs-label-info-hover-bg` | `var(--tc-surface-muted)` | Info icon button hover background |
| `--bs-label-info-icon-size` | `0.875em` | Info icon SVG size |

```html
<!-- Plain label -->
<tc-label for="name">Full name</tc-label>
<tc-input id="name" type="text"></tc-input>

<!-- Required -->
<tc-label for="email" required>Email address</tc-label>
<tc-input id="email" type="email"></tc-input>

<!-- With tooltip -->
<tc-label for="user" tooltip="Shown publicly on your profile">Username</tc-label>
<tc-input id="user" type="text"></tc-input>

<!-- All options + size -->
<tc-label for="pwd" required tooltip="At least 8 characters" size="small">Password</tc-label>
<tc-input id="pwd" type="password"></tc-input>
```

---

## tc-divider

Horizontal or vertical 1px hairline separator, optionally with a centered mono micro-label. Port of the `@toolcase/react-components` `Divider` component.

**Tag:** `tc-divider`

**Attributes / Props**

| Attribute | Type | Default | Description |
|-----------|------|---------|-------------|
| `vertical` | boolean | false | Renders a thin full-height vertical rule instead of a horizontal one |
| `label` | string | — | Text label centered between the two flanking hairlines. When absent, slotted children are used as label content instead |

**Slots**

| Slot | Description |
|------|-------------|
| _(default)_ | Optional label content when the `label` attribute is not set. Rendered inside `.tc-divider__label` between the flanking lines |

**Events**

None. The divider is purely presentational.

**Accessibility**

- Renders `role="separator"` with the appropriate `aria-orientation` (`horizontal` or `vertical`).
- When using the `label` attribute, `aria-label` is also set on the inner wrapper so the separator name is exposed to assistive technology.
- Slotted-child labels are accessible via text content — no extra ARIA needed.
- Presentational; receives no focus.
- `prefers-reduced-motion` is honoured globally by the stylesheet.

**Vertical label note**

Labels (both `label` attribute and slotted children) are suppressed in vertical mode. Vertical dividers render as a plain hairline rule only. This is intentional — rotated label support is not implemented.

**CSS custom properties (theming)**

| Property | Default | Description |
|----------|---------|-------------|
| `--bs-divider-border-color` | `var(--tc-border)` | Hairline colour |
| `--bs-divider-label-color` | `var(--tc-text-muted)` | Label text colour |
| `--bs-divider-label-bg` | `var(--tc-surface)` | Label background |
| `--bs-divider-label-font-size` | `0.6875rem` (11px) | Label font size |
| `--bs-divider-label-font-weight` | `500` | Label font weight |
| `--bs-divider-label-letter-spacing` | `0.08em` | Label letter spacing |

```html
<!-- Plain horizontal rule -->
<tc-divider></tc-divider>

<!-- Labelled horizontal divider (attribute) -->
<tc-divider label="Section"></tc-divider>

<!-- Labelled horizontal divider (slotted children) -->
<tc-divider>or</tc-divider>

<!-- Vertical rule between inline elements -->
<div style="display:flex;align-items:center;gap:0.75rem;height:2rem">
    <span>Left</span>
    <tc-divider vertical></tc-divider>
    <span>Right</span>
</div>
```

---

## tc-icon

Inline lucide SVG icon glyph. Inherits color from surrounding text by default; accessibility attributes (`label`, `decorative`) follow WAI-ARIA pattern for icon-only controls.

**Tag:** `tc-icon`

> **Icon set note:** The `set` attribute is accepted for API parity with the `@toolcase/react-components` `Icon` component, which supports `bi` (Bootstrap Icons) and `tc` (ToolCase) sets. In `@toolcase/web-components` all names are resolved through the [lucide-static](https://www.npmjs.com/package/lucide-static) map regardless of `set` value.

**Attributes**

| Attribute | Type | Default | Description |
|-----------|------|---------|-------------|
| `name` | string | — | **Required.** Lucide icon name in PascalCase (e.g. `"Star"`, `"Trash2"`) |
| `set` | `bi\|tc` | `bi` | Icon set identifier — accepted for parity, always resolves via lucide-static |
| `as` | string | `span` | HTML tag name for the wrapper element |
| `size` | string | `1em` | SVG width and height. Plain numbers become `px` (e.g. `"24"` → `24px`); strings with units are passed through (e.g. `"1.5rem"`) |
| `color` | string | — | Icon color. Any valid CSS color value. When absent, inherits `currentColor` from the surrounding text |
| `label` | string | — | Accessible name. When set, the wrapper receives `role="img"` and `aria-label`. Ignored when `decorative` is present |
| `decorative` | boolean | false | Marks the icon as presentational: adds `aria-hidden="true"` to the wrapper and omits any `aria-label` |

**Events**

None. `tc-icon` is a purely presentational element.

**Slots**

None. The icon SVG is rendered inline; there is no slot for child content.

**Accessibility**

- When `label` is set (and `decorative` is absent): wrapper gets `role="img"` and `aria-label="{label}"`.
- When `decorative` is set: wrapper gets `aria-hidden="true"` — the icon is invisible to screen readers.
- When neither is set: no ARIA attributes are added — the icon inherits context from its surroundings.
- Color contrast is always caller-supplied; the component inherits `currentColor`.
- `prefers-reduced-motion` is honoured globally by the stylesheet.

**CSS custom properties (theming)**

| Property | Default | Description |
|----------|---------|-------------|
| `--bs-icon-size` | `1em` | Width and height of the icon box (overridden by `size` attribute) |
| `--bs-icon-color` | `currentColor` | Stroke color (overridden by `color` attribute) |

```html
<!-- Basic icon -->
<tc-icon name="Star"></tc-icon>

<!-- Sized icon -->
<tc-icon name="Heart" size="24"></tc-icon>

<!-- Colored icon -->
<tc-icon name="AlertTriangle" size="20" color="var(--tc-warning)"></tc-icon>

<!-- Accessible labelled icon -->
<tc-icon name="Bell" size="20" label="Notifications"></tc-icon>

<!-- Decorative icon (hidden from screen readers) -->
<tc-icon name="Sparkles" size="20" decorative></tc-icon>

<!-- Custom wrapper tag -->
<tc-icon name="Circle" as="div" size="32"></tc-icon>
```

---

## tc-kbd

Keyboard key cap(s) rendered as square mono hints. Supports a single slotted key or a multi-key combination via the `keys` JS property, with an optional custom separator.

**Tag:** `tc-kbd`

**Attributes**

| Attribute | Type | Default | Description |
|-----------|------|---------|-------------|
| `class-name` | string | — | Extra CSS classes merged onto the `.tc-kbd` wrapper span |
| `separator` | string | `+` | Visual joiner rendered between keys when using the `keys` property. Wrapped in `aria-hidden` span |

**JS Properties**

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `keys` | `string[]` | `[]` | Array of key label strings. When set (non-empty), renders one `<kbd>` per key interleaved with separator spans. Takes precedence over slotted children |

**Slots**

| Slot | Description |
|------|-------------|
| _(default)_ | Key label content when `keys` is not set. Rendered inside a single `<kbd class="tc-kbd-key">` |

**Events**

None. `tc-kbd` is a purely presentational element.

**CSS custom properties (theming)**

| Property | Default | Description |
|----------|---------|-------------|
| `--bs-kbd-font-family` | `var(--bs-font-monospace)` | Key cap font |
| `--bs-kbd-font-size` | `0.71875rem` (~11.5px) | Key cap font size |
| `--bs-kbd-font-weight` | `500` | Key cap font weight |
| `--bs-kbd-color` | `var(--tc-text)` | Key cap glyph color |
| `--bs-kbd-bg` | `var(--tc-surface-muted)` | Key cap background fill |
| `--bs-kbd-border-color` | `var(--tc-border-strong)` | Key cap border color |
| `--bs-kbd-border-width` | `1px` | Key cap border width |
| `--bs-kbd-padding-x` | `0.35em` | Horizontal key cap padding |
| `--bs-kbd-padding-y` | `0.18em` | Vertical key cap padding |
| `--bs-kbd-sep-color` | `var(--tc-text-faint)` | Separator color |
| `--bs-kbd-sep-margin` | `0.25em` | Horizontal margin around separator |

```html
<!-- Single slotted key -->
<tc-kbd>Enter</tc-kbd>

<!-- Key combination via JS property -->
<tc-kbd id="combo"></tc-kbd>
<script>document.getElementById('combo').keys = ['Ctrl', 'K']</script>

<!-- Custom separator -->
<tc-kbd id="seq" separator=" then "></tc-kbd>
<script>document.getElementById('seq').keys = ['Esc', 'Enter']</script>

<!-- Extra class on wrapper -->
<tc-kbd class-name="my-key">Space</tc-kbd>
```

---

## tc-link

Semantic anchor (`<a>`) with variant color, underline mode, and an optional external-link icon. Renders a real `<a>` element for correct document semantics.

**Tag:** `tc-link`

**Attributes**

| Attribute | Type | Default | Description |
|-----------|------|---------|-------------|
| `variant` | `primary\|secondary\|info\|success\|warning\|danger` | `primary` | Link color drawn from the status palette. `primary` uses the ink/app-accent tone |
| `underline` | `always\|hover\|none` | `hover` | Text-decoration mode: always underlined, underline on hover/focus, or never |
| `external` | boolean | false | Appends a lucide `external-link` icon, sets `target="_blank"` and `rel="noopener noreferrer"`, and adds a visually-hidden "(opens in new tab)" note |
| `href` | string | `#` | The anchor `href` value |

**Slots**

| Slot | Description |
|------|-------------|
| _(default)_ | Link label content. Preserved across re-renders as light-DOM children inside `.tc-link-content` |

**Events**

None. `tc-link` is a purely presentational element.

**CSS custom properties (theming)**

| Property | Default | Description |
|----------|---------|-------------|
| `--bs-link-color` | `var(--tc-app-accent)` | Link text color at rest |
| `--bs-link-hover-color` | `var(--tc-app-accent-hover)` | Link text color on hover / focus |

```html
<!-- Default (primary, hover underline) -->
<tc-link href="/docs">Read the docs</tc-link>

<!-- Status variants -->
<tc-link href="#" variant="success">Confirmed</tc-link>
<tc-link href="#" variant="danger">Delete account</tc-link>

<!-- Always underlined -->
<tc-link href="#" underline="always">Terms of service</tc-link>

<!-- Never underlined -->
<tc-link href="#" underline="none">Clean link</tc-link>

<!-- External link (new tab + icon + accessible note) -->
<tc-link href="https://example.com" external>Visit example.com</tc-link>
```

---

## tc-visually-hidden

Hides content from sighted users while keeping it in the accessibility tree. The host element uses `display: contents` so it adds no layout box; the inner wrapper receives the standard `.visually-hidden` clip. Use it to label icon-only controls, annotate status regions, or provide skip-link text.

**Tag:** `tc-visually-hidden`

**Attributes**

| Attribute | Type | Default | Description |
|-----------|------|---------|-------------|
| `as` | `span\|div` | `span` | The inner wrapper element tag. Use `span` (default) for inline contexts and `div` for block-level hidden regions (e.g. live regions, landmark descriptions). |

**JS Properties**

None beyond the reflected `as` attribute.

**Slots**

| Slot | Description |
|------|-------------|
| _(default)_ | The content to hide visually. Preserved across re-renders inside `.tc-visually-hidden-content`. Must not be `display:none` or `hidden` — it stays in the accessibility tree. |

**Events**

None. `tc-visually-hidden` is a purely presentational accessibility helper.

**CSS custom properties (theming)**

| Property | Default | Description |
|----------|---------|-------------|
| `--bs-visually-hidden-clip` | `rect(0, 0, 0, 0)` | Clip rect applied to the inner wrapper. Override to unhide temporarily (e.g. during focus). |

```html
<!-- Annotate an icon button -->
<button type="button" class="btn btn-secondary">
    <span aria-hidden="true">✕</span>
    <tc-visually-hidden>Close dialog</tc-visually-hidden>
</button>

<!-- Skip link (becomes visible on :focus via browser default) -->
<tc-visually-hidden>
    <a href="#main-content">Skip to main content</a>
</tc-visually-hidden>

<!-- Block live-region description (as="div") -->
<div role="status" aria-live="polite">
    <tc-visually-hidden as="div">3 items loaded.</tc-visually-hidden>
</div>
```
