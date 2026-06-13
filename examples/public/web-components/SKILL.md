---
name: web-components
description: Use when building UI with @toolcase/web-components — framework-free HTML5 Web Components (`tc-*` custom elements) with from-scratch toolcase styling and a Bootstrap-compatible class API. Covers layout (Container, Row, Col), content (ActionHeader, ActionItems, ActionRowList, Alert, Badge, Button, ButtonGroup, Card, Carousel, CloseButton, Collapse, Divider, Dropdown, Heading, ListGroup, Placeholder, Progress, Spinner), navigation (Breadcrumb, Nav, Navbar, Pagination, Scrollspy), overlays & feedback (Modal, Offcanvas, Popover, Toast, Tooltip), and forms (Check, FloatingLabel, Form, Input, InputGroup, InputGroupText, Option, Radio, Range, Select, Switch, Textarea). Consumable from any stack — React, Vue, Svelte, or plain HTML.
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
- [Content](#content)
  - [tc-action-header](#tc-action-header)
  - [tc-action-items](#tc-action-items)
  - [tc-action-row-list](#tc-action-row-list)
  - [tc-alert](#tc-alert)
  - [tc-badge](#tc-badge)
  - [tc-button](#tc-button)
  - [tc-button-group](#tc-button-group)
  - [tc-card](#tc-card)
  - [tc-carousel](#tc-carousel)
  - [tc-close-button](#tc-close-button)
  - [tc-collapse](#tc-collapse)
  - [tc-divider](#tc-divider)
  - [tc-dropdown](#tc-dropdown)
  - [tc-heading](#tc-heading)
  - [tc-list-group](#tc-list-group)
  - [tc-placeholder](#tc-placeholder)
  - [tc-progress](#tc-progress)
  - [tc-spinner](#tc-spinner)
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
  - [tc-input](#tc-input)
  - [tc-input-group](#tc-input-group)
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
