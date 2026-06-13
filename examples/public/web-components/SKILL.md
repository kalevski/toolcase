---
name: web-components
description: Use when building UI with @toolcase/web-components — framework-free HTML5 Web Components (`tc-*` custom elements) with from-scratch toolcase styling and a Bootstrap-compatible class API. Covers layout (BasicLayout, DashboardContent, Container, Row, Col, Spacer), content (ActionHeader, ActionItems, ActionRowList, Alert, AssetRow, AssetRowList, Avatar, Badge, BadgeRow, Brand, BriefCard, BundleBar, CalloutQuote, ChartContainer, Sparkline, TrendIndicator, CodeLabelCell, CodeWithOutput, CommunityLinks, ConfigPreview, ContributorWall, CookbookGrid, CoolButton, ActivityCard, BasicCard, Button, ButtonGroup, Card, Carousel, CloseButton, Collapse, Divider, Dropdown, DownloadStats, EmptyState, GoodFirstIssues, HeroStatsBar, Heading, Kbd, ListCard, ListGroup, Placeholder, Progress, PulseIndicator, SectionFlag, Skeleton, Spinner, Stamp, StatusCard, StatusDot, Tag, Text, VisuallyHidden), navigation (Breadcrumb, Nav, Navbar, Pagination, Scrollspy, SocialLinks), overlays & feedback (Modal, Offcanvas, Popover, Toast, Tooltip), and forms (Check, FloatingLabel, Form, HelperText, Input, InputGroup, InputGroupText, Label, Option, Radio, Range, Select, Switch, Textarea). Consumable from any stack — React, Vue, Svelte, or plain HTML.
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
  - [tc-basic-layout](#tc-basic-layout)
  - [tc-dashboard-content](#tc-dashboard-content)
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
  - [tc-section-flag](#tc-section-flag)
  - [tc-skeleton](#tc-skeleton)
  - [tc-spinner](#tc-spinner)
  - [tc-stamp](#tc-stamp)
  - [tc-status-dot](#tc-status-dot)
  - [tc-tag](#tc-tag)
  - [tc-asset-row](#tc-asset-row)
  - [tc-asset-row-list](#tc-asset-row-list)
  - [tc-brief-card](#tc-brief-card)
  - [tc-bundle-bar](#tc-bundle-bar)
  - [tc-callout-quote](#tc-callout-quote)
  - [tc-chart-container](#tc-chart-container)
  - [tc-sparkline](#tc-sparkline)
  - [tc-trend-indicator](#tc-trend-indicator)
  - [tc-code-label-cell](#tc-code-label-cell)
  - [tc-code-with-output](#tc-code-with-output)
  - [tc-community-links](#tc-community-links)
  - [tc-config-preview](#tc-config-preview)
  - [tc-contributor-wall](#tc-contributor-wall)
  - [tc-cookbook-grid](#tc-cookbook-grid)
  - [tc-cool-button](#tc-cool-button)
  - [tc-activity-card](#tc-activity-card)
  - [tc-basic-card](#tc-basic-card)
  - [tc-colored-card](#tc-colored-card)
  - [tc-difference-card](#tc-difference-card)
  - [tc-list-card](#tc-list-card)
  - [tc-status-card](#tc-status-card)
  - [tc-download-stats](#tc-download-stats)
  - [tc-empty-state](#tc-empty-state)
  - [tc-entity-cell](#tc-entity-cell)
  - [tc-feature-card](#tc-feature-card)
  - [tc-good-first-issues](#tc-good-first-issues)
  - [tc-hero-stats-bar](#tc-hero-stats-bar)
  - [tc-text](#tc-text)
  - [tc-visually-hidden](#tc-visually-hidden)
- [Navigation](#navigation)
  - [tc-breadcrumb](#tc-breadcrumb)
  - [tc-nav](#tc-nav)
  - [tc-navbar](#tc-navbar)
  - [tc-pagination](#tc-pagination)
  - [tc-scrollspy](#tc-scrollspy)
  - [tc-social-links](#tc-social-links)
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

### tc-basic-layout

Two-section page layout: an optional brand header region followed by a full-height main content area. Flat structural surface — no shadows, no border-radius, slate neutrals only.

**Tag:** `tc-basic-layout`

**Attributes**

| Attribute | Type | Default | Description |
|-----------|------|---------|-------------|
| `brand` | string | — | Text content for the brand header. When set, renders a `<header>` with the attribute value. When omitted and no `slot="brand"` children are present, the header is hidden entirely. |

**JS Properties**

| Property | Type | Description |
|----------|------|-------------|
| `brand` | `string \| null` | Reflects the `brand` attribute. |

**Events**

None. `tc-basic-layout` is a purely presentational layout element.

**Slots**

| Slot | Description |
|------|-------------|
| *(default)* | Main page content. Rendered inside `<main class="tc-basic-layout-main">`. |
| `brand` | Rich brand header content (logos, nav, custom markup). Used when the `brand` attribute is absent. Rendered inside `<header class="tc-basic-layout-brand">`. |

**CSS Custom Properties**

| Property | Default | Description |
|----------|---------|-------------|
| `--bs-basic-layout-brand-bg` | `var(--tc-surface)` | Brand header background. |
| `--bs-basic-layout-brand-color` | `var(--tc-text)` | Brand header text color. |
| `--bs-basic-layout-brand-border` | `var(--tc-border)` | Color of the 1px hairline beneath the brand header. |
| `--bs-basic-layout-main-bg` | `transparent` | Main content area background. |
| `--bs-basic-layout-main-color` | `var(--tc-text)` | Main content area text color. |

```html
<!-- Brand via attribute -->
<tc-basic-layout brand="My App">
    <p>Page content here.</p>
</tc-basic-layout>

<!-- Rich brand via slot -->
<tc-basic-layout>
    <div slot="brand">
        <img src="logo.svg" alt="My App" />
    </div>
    <p>Page content here.</p>
</tc-basic-layout>

<!-- No header -->
<tc-basic-layout>
    <p>Full-height main area, no brand header.</p>
</tc-basic-layout>
```

---

### tc-dashboard-content

Scrollable main content area for the dashboard layout. A pure layout wrapper — no chrome, no elevation. Provides comfortable padding and `overflow-y: auto` for hosting cards, rows, and section headers inside a dashboard shell.

**Tag:** `tc-dashboard-content`

**Attributes**

None. `tc-dashboard-content` is a purely structural layout element with no configurable attributes.

**JS Properties**

None.

**Events**

None. `tc-dashboard-content` is a purely presentational layout element.

**Slots**

| Slot | Description |
|------|-------------|
| *(default)* | Main dashboard content (cards, rows, headers). Rendered inside `<div class="tc-dashboard-content-inner">` which sits inside `<main class="tc-dashboard-content">`. |

**CSS Custom Properties**

| Property | Default | Description |
|----------|---------|-------------|
| `--bs-dashboard-content-bg` | `var(--tc-surface)` | Background of the scroll region. |
| `--bs-dashboard-content-color` | `var(--tc-text)` | Text color of the content area. |
| `--bs-dashboard-content-padding` | `1.5rem` | Inner padding applied to the content container. |
| `--bs-dashboard-content-max-width` | `none` | Optional max-width cap for the inner container. |

```html
<!-- Basic usage -->
<tc-dashboard-content>
    <h2>Overview</h2>
    <tc-basic-card title="Revenue" value="$12,400"></tc-basic-card>
</tc-dashboard-content>

<!-- Constrained width -->
<tc-dashboard-content style="--bs-dashboard-content-max-width: 960px">
    <p>Content centred within 960px.</p>
</tc-dashboard-content>
```

---

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

### tc-section-flag

Section header with a slate-ink accent marker bar, a title (rendered as an `<h2>` heading), and an optional subtitle. Supports left (default) and center alignment. All cosmetics are overridable via `--bs-section-flag-*` custom properties.

**Tag:** `tc-section-flag`

**Attributes**

| Attribute | Type | Default | Description |
|-----------|------|---------|-------------|
| `title` | string | `''` | Section heading text (HTML-escaped, rendered as `<h2>`) |
| `subtitle` | string | — | Optional secondary line below the title. Omitted when absent |
| `align` | `left\|center` | `left` | Text alignment; `center` repositions the marker as a horizontal bar above the text |

**JS Properties**

All three attributes are reflected as JS properties with the same names (`title`, `subtitle`, `align`).

**Events**

None. `tc-section-flag` is a purely presentational element.

**Slots**

None. Title and subtitle come from attributes only.

**CSS custom properties (theming)**

| Property | Default | Description |
|----------|---------|-------------|
| `--bs-section-flag-marker-color` | `var(--tc-app-accent)` | Accent bar color (slate-ink) |
| `--bs-section-flag-marker-width` | `3px` | Thickness of the accent bar |
| `--bs-section-flag-marker-height` | `1.25rem` | Length of the accent bar |
| `--bs-section-flag-gap` | `0.625rem` | Gap between marker and text block |
| `--bs-section-flag-title-size` | `1.1rem` | Title font size |
| `--bs-section-flag-title-weight` | `600` | Title font weight |
| `--bs-section-flag-title-color` | `var(--tc-text)` | Title text color |
| `--bs-section-flag-subtitle-size` | `0.875rem` | Subtitle font size |
| `--bs-section-flag-subtitle-color` | `var(--tc-text-muted)` | Subtitle text color |

```html
<!-- Left aligned (default) with subtitle -->
<tc-section-flag title="The Hall — ranked" subtitle="Top of the rolling 90-day board."></tc-section-flag>

<!-- Left aligned — title only -->
<tc-section-flag title="Points · continuous · never paused"></tc-section-flag>

<!-- Center aligned with subtitle -->
<tc-section-flag align="center" title="3 Briefs · rolled for Sprint 047" subtitle="Seeded RNG drew one easy + one medium + one hard from the master pool."></tc-section-flag>

<!-- Center aligned — title only -->
<tc-section-flag align="center" title="Season 4 — Leaderboard"></tc-section-flag>
```

---

### tc-skeleton

Loading-state placeholder with a slate shimmer animation and configurable shape. Three variants: `text` (1em-tall line rows), `circle` (equal width/height, 50% radius), and `rect` (sharp rectangle). `count` repeats the placeholder bar. The last text line in a multi-line group is automatically narrowed to 80% to mimic a paragraph end. Respects `prefers-reduced-motion` — the shimmer freezes to a static slate fill rather than vanishing.

**Tag:** `tc-skeleton`

**Attributes**

| Attribute | Type | Default | Description |
|-----------|------|---------|-------------|
| `variant` | `text\|circle\|rect` | `text` | Shape of the placeholder. `text` = 1em block line; `circle` = equal dimensions with 50% radius; `rect` = sharp rectangle |
| `width` | string \| number | `100%` (text/rect), `height ?? 40px` (circle) | Width of each placeholder. Bare number is treated as px; any CSS length string passes through unchanged |
| `height` | string \| number | `1em` (text), `width ?? 40px` (circle), `80px` (rect) | Height of each placeholder. Same px/CSS-string resolution as `width` |
| `count` | number | `1` | Number of placeholder bars to render. When > 1 bars are wrapped in a column flex group |

**JS Properties**

All four attributes are reflected as JS properties with the same names (`variant`, `width`, `height`, `count`).

**Events**

None. `tc-skeleton` is a purely presentational loading indicator.

**Slots**

None. All content is generated from attributes.

**Accessibility**

The host carries `role="status"` and `aria-label="Loading..."`. Individual placeholder spans are marked `aria-hidden="true"`.

**CSS custom properties (theming)**

| Property | Default | Description |
|----------|---------|-------------|
| `--bs-skeleton-base-color` | `var(--tc-surface-muted)` | Base fill color (slate-100) |
| `--bs-skeleton-shine-color` | `var(--tc-surface-hover)` | Leading shimmer highlight (slate-50) |
| `--bs-skeleton-shade-color` | `var(--tc-border)` | Trailing shimmer shade (slate-200) |
| `--bs-skeleton-animation-duration` | `1.5s` | Shimmer sweep duration |
| `--bs-skeleton-group-gap` | `0.5em` | Gap between bars when `count > 1` |

```html
<!-- Single text line -->
<tc-skeleton variant="text"></tc-skeleton>

<!-- Multiple text lines (last line is 80% wide) -->
<tc-skeleton variant="text" count="4"></tc-skeleton>

<!-- Circle avatar placeholder -->
<tc-skeleton variant="circle" width="48" height="48"></tc-skeleton>

<!-- Rect image placeholder -->
<tc-skeleton variant="rect" width="100%" height="160"></tc-skeleton>

<!-- Composed card skeleton -->
<tc-skeleton variant="rect" width="100%" height="160"></tc-skeleton>
<tc-skeleton variant="text" count="3"></tc-skeleton>
```

---

### tc-sparkline

Compact inline SVG micro-chart for quick trend display. Renders as a `<svg>` with `display: inline-block`, suitable for embedding within metric rows, prose, or dashboard cards. Supports line (polyline + endpoint dot) and bar (column) types. Purely presentational — no tooltips or interaction.

**Tag:** `tc-sparkline`

**Attributes**

| Attribute | Type | Default | Description |
|-----------|------|---------|-------------|
| `data` | string | — | Comma-separated number list (e.g. `"10,25,18,42"`). Parsed to an array of numbers. Ignored once the JS `data` property has been set. |
| `type` | `'line' \| 'bar'` | `'line'` | Chart type. `line` renders a polyline with an endpoint dot; `bar` renders evenly-spaced rect columns. |
| `color` | string | — | CSS color (any valid value, e.g. `"#6366f1"`, `"var(--tc-success)"`). When absent, defaults to `--tc-app-accent` via the SCSS token. |
| `height` | number | `32` | SVG height in px. |
| `width` | number | `120` | SVG width in px. |

**JS Properties**

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `data` | `number[]` | `[]` | Array of numbers to plot. Setting this takes precedence over the `data` attribute and triggers a re-render. |

**Events**

None. `tc-sparkline` is purely presentational.

**Slots**

None. All content is generated as inline SVG.

**Accessibility**

The inner `<svg>` carries `role="img"` and an `aria-label` summarising the trend direction (e.g. `"Trend from 10 to 75, upward"`). For decorative usage inside a labelled metric, add `aria-hidden="true"` directly to the element.

**CSS custom properties (theming)**

| Property | Default | Description |
|----------|---------|-------------|
| `--bs-sparkline-color` | `var(--tc-app-accent)` | Stroke/fill color for the chart. Overridden by the `color` attribute via inline style. |

```html
<!-- Line chart via data attribute -->
<tc-sparkline data="10,25,18,42,30,55" width="120" height="32"></tc-sparkline>

<!-- Bar chart via JS property -->
<tc-sparkline id="bar" type="bar" width="120" height="32"></tc-sparkline>
<script>
    document.getElementById('bar').data = [12, 40, 28, 55, 38, 70, 45]
</script>

<!-- Custom color -->
<tc-sparkline data="5,30,20,60,45" color="var(--tc-success)" width="120" height="32"></tc-sparkline>

<!-- Inline within a metric sentence -->
<p>
    Revenue <strong>$42,180</strong>
    <tc-sparkline data="30,38,35,44,40,50,47,55" height="24" width="80"></tc-sparkline>
    <span style="color:var(--tc-success)">+12.4%</span>
</p>
```

---

### tc-cool-button

Grouped button with variants, sizes, loading state, and an optional addon region separated by a 1px internal divider. The addon sits in its own muted fill segment on either side of the label. Dispatches a `tc-click` event on activation.

**Tag:** `tc-cool-button`

**Attributes**

| Attribute | Type | Default | Description |
|-----------|------|---------|-------------|
| `variant` | `'primary' \| 'secondary' \| 'success' \| 'danger' \| 'warning' \| 'info'` | `'primary'` | Visual color variant. Maps to Bootstrap `.btn-{variant}` (or `.btn-outline-{variant}` when `outline` is set). |
| `size` | `'small' \| 'default' \| 'large'` | `'default'` | Button size. Maps to `btn-sm` / (none) / `btn-lg`. |
| `outline` | boolean | `false` | Renders as an outline variant instead of a filled solid. |
| `loading` | boolean | `false` | Shows a spinner and disables the button. |
| `disabled` | boolean | `false` | Disables the button. |
| `label` | string | — | Text label for the button. Used when no default slot children are present. |
| `addon` | string | — | Text content for the addon region. Used when no `slot="addon"` children are present. |
| `addon-position` | `'left' \| 'right'` | `'right'` | Which side the addon sits on. |

**JS Properties**

| Property | Type | Description |
|----------|------|-------------|
| `variant` | `CoolButtonVariant` | Reflects the `variant` attribute. |
| `size` | `CoolButtonSize` | Reflects the `size` attribute. |
| `outline` | `boolean` | Reflects the `outline` attribute. |
| `loading` | `boolean` | Reflects the `loading` attribute. |
| `disabled` | `boolean` | Reflects the `disabled` attribute. |
| `label` | `string \| null` | Reflects the `label` attribute. |
| `addon` | `string \| null` | Reflects the `addon` attribute. |
| `addonPosition` | `CoolButtonAddonPosition` | Reflects the `addon-position` attribute. |
| `onClick` | `(() => void) \| null` | Optional callback fired on activation (alongside the `tc-click` event). |

**Events**

| Event | Detail | Description |
|-------|--------|-------------|
| `tc-click` | `{}` | Fired when the button is activated (clicked). Not fired when `disabled` or `loading`. Bubbles and composed. |

**Slots**

| Slot | Description |
|------|-------------|
| *(default)* | Main button label content. Preserved across re-renders inside `.tc-cool-button-content`. Takes precedence over the `label` attribute. |
| `addon` | Content for the addon region. Preserved across re-renders inside `.tc-cool-button-addon`. Takes precedence over the `addon` attribute. |

**CSS Custom Properties**

| Property | Default | Description |
|----------|---------|-------------|
| `--bs-cool-button-divider-color` | `rgba(255,255,255,0.28)` for solid; `var(--tc-border-strong)` for outline | Color of the 1px internal separator. |
| `--bs-cool-button-addon-bg` | `var(--tc-surface-muted)` | Addon region background fill. |
| `--bs-cool-button-addon-color` | `var(--tc-text)` | Addon region text color. |

```html
<!-- label attribute -->
<tc-cool-button variant="primary" label="Deploy"></tc-cool-button>

<!-- addon on the right (default) -->
<tc-cool-button variant="primary" label="Deploy" addon="▶"></tc-cool-button>

<!-- addon on the left -->
<tc-cool-button variant="primary" label="Download" addon="↓" addon-position="left"></tc-cool-button>

<!-- outline + loading -->
<tc-cool-button variant="success" outline loading label="Saving…"></tc-cool-button>

<!-- slot children + addon slot -->
<tc-cool-button variant="primary">
    Publish
    <span slot="addon" style="font-size:0.75rem;font-weight:700">v2</span>
</tc-cool-button>

<!-- tc-click event -->
<tc-cool-button id="btn1" variant="primary" label="Save"></tc-cool-button>
<script>
    document.getElementById('btn1').addEventListener('tc-click', () => console.log('saved'))
</script>
```

---

### tc-activity-card

Dashboard card showing a vertical timeline of activity items with icons, descriptions, and timestamps. Purely presentational; no events.

**Tag:** `tc-activity-card`

**Attributes**

| Attribute | Type | Default | Description |
|-----------|------|---------|-------------|
| `title` | `string` | — | Optional card heading rendered in the header. When absent, no header is rendered. |
| `loading` | `boolean` | `false` | When present, renders skeleton placeholder rows instead of real activity items. |
| `loading-count` | `number` | `3` | Number of skeleton rows shown while `loading` is set. |

**JS Properties**

| Property | Type | Description |
|----------|------|-------------|
| `activities` | `ActivityItem[]` | Array of activity items to render as the timeline. Set via JS property. Default: `[]`. Re-renders on assignment. |
| `title` | `string \| null` | Reflects the `title` attribute. |
| `loading` | `boolean` | Reflects the `loading` attribute. |
| `loadingCount` | `number` | Reflects the `loading-count` attribute. |

`ActivityItem` shape:
```ts
interface ActivityItem {
    id?: string          // optional unique key (not rendered)
    icon?: string        // Lucide icon name in PascalCase (e.g. "GitCommit", "CheckCircle"). Falls back to "Circle".
    title: string        // primary activity label (required)
    description?: string // optional secondary line below the title
    timestamp?: string   // optional right-aligned mono timestamp string (e.g. "2m ago", "12:04")
}
```

**Events**

None. `tc-activity-card` is purely presentational.

**Slots**

None. Content is driven entirely by the `activities` JS property and HTML attributes.

**Accessibility**

- The timeline list uses `<ul role="list">` with each item as `role="listitem"`.
- The card heading uses a real `<h3>` element.
- Icon chips and the rail carry `aria-hidden="true"` — no color-only meaning.
- The loading region sets `aria-busy="true"` on the list and includes a visually-hidden `role="status"` announcement.
- Skeleton shimmer animation honours `prefers-reduced-motion` (freezes to a static fill; never removed entirely so the loading region remains visible).

**CSS Custom Properties**

| Property | Default | Description |
|----------|---------|-------------|
| `--bs-activity-card-bg` | `var(--tc-surface)` | Card background. |
| `--bs-activity-card-border-color` | `var(--tc-border)` | Card 1px hairline border color. |
| `--bs-activity-card-shadow` | `var(--tc-shadow-sm)` | Card resting shadow. |
| `--bs-activity-card-header-bg` | ink gradient | Faint ink-gradient header background. |
| `--bs-activity-card-header-border-color` | `var(--tc-border)` | Header bottom hairline color. |
| `--bs-activity-card-title-color` | `var(--tc-text)` | Card heading text color. |
| `--bs-activity-card-icon-chip-size` | `1.75rem` | Width and height of the icon chip. |
| `--bs-activity-card-icon-chip-bg` | `var(--tc-surface-muted)` | Icon chip background. |
| `--bs-activity-card-icon-chip-color` | `var(--tc-text-muted)` | Icon glyph color. |
| `--bs-activity-card-rail-color` | `var(--tc-border)` | Color of the vertical rail connecting timeline items. |
| `--bs-activity-card-item-title-color` | `var(--tc-text)` | Activity title text color. |
| `--bs-activity-card-item-desc-color` | `var(--tc-text-muted)` | Activity description text color. |
| `--bs-activity-card-time-color` | `var(--tc-text-muted)` | Timestamp text color. |
| `--bs-activity-card-skeleton-bg` | `var(--tc-surface-muted)` | Skeleton row fill. |
| `--bs-activity-card-skeleton-shimmer` | `rgba(255,255,255,0.6)` | Shimmer highlight. |

```html
<!-- Basic usage — set activities via JS property -->
<tc-activity-card id="feed" title="Recent Activity"></tc-activity-card>
<script>
    document.getElementById('feed').activities = [
        {
            icon: 'GitCommit',
            title: 'Pushed 3 commits to main',
            description: 'feat: add activity card component',
            timestamp: '2m ago',
        },
        {
            icon: 'CheckCircle',
            title: 'CI pipeline passed',
            timestamp: '4m ago',
        },
        {
            icon: 'MessageSquare',
            title: 'New comment on PR #84',
            description: 'Looks good, approving',
            timestamp: '12m ago',
        },
    ]
</script>

<!-- Loading state -->
<tc-activity-card title="Recent Activity" loading></tc-activity-card>

<!-- Loading state with custom row count -->
<tc-activity-card title="Activity Feed" loading loading-count="5"></tc-activity-card>

<!-- No title -->
<tc-activity-card id="feed2"></tc-activity-card>
```

---

### tc-basic-card

Small dashboard card with an optional leading icon chip and a two-line text block. Purely presentational; no events.

**Tag:** `tc-basic-card`

**Attributes**

| Attribute | Type | Default | Description |
|-----------|------|---------|-------------|
| `text-a` | `string` | `""` | Primary text line (headline / value). Required. |
| `text-b` | `string` | `""` | Secondary / supporting text line. Required. |
| `icon` | `string` | — | Lucide icon name in PascalCase (e.g. `"BarChart2"`, `"Users"`). When absent, no icon chip is rendered. |
| `loading` | `boolean` | `false` | When present, renders a shimmer skeleton placeholder in place of the icon and text. |

**JS Properties**

| Property | Type | Description |
|----------|------|-------------|
| `textA` | `string` | Reflects the `text-a` attribute. |
| `textB` | `string` | Reflects the `text-b` attribute. |
| `icon` | `string \| null` | Reflects the `icon` attribute. |
| `loading` | `boolean` | Reflects the `loading` attribute. |

**Events**

None. `tc-basic-card` is purely presentational.

**Slots**

None. Content is driven entirely by HTML attributes.

**Accessibility**

- The icon chip carries `aria-hidden="true"` — it is decorative; no color-only meaning.
- The loading state sets `aria-busy="true"` on the host and includes a visually-hidden `role="status"` announcement.
- Skeleton shimmer animation honours `prefers-reduced-motion` (freezes to a static fill; the region remains visible).
- Primary and secondary text are plain text nodes — readable by assistive technology without relying on color.

**CSS Custom Properties**

| Property | Default | Description |
|----------|---------|-------------|
| `--bs-basic-card-bg` | `var(--tc-surface)` | Card background color. |
| `--bs-basic-card-border-color` | `var(--tc-border)` | Card 1px hairline border color. |
| `--bs-basic-card-shadow` | `var(--tc-shadow-sm)` | Card resting shadow. |
| `--bs-basic-card-padding-y` | `1rem` | Vertical card body padding. |
| `--bs-basic-card-padding-x` | `1.25rem` | Horizontal card body padding. |
| `--bs-basic-card-gap` | `0.875rem` | Gap between icon chip and text block. |
| `--bs-basic-card-icon-size` | `2.5rem` | Width and height of the icon chip. |
| `--bs-basic-card-icon-bg` | `var(--tc-surface-muted)` | Icon chip background (slate muted; not a colored badge). |
| `--bs-basic-card-icon-color` | `var(--tc-text-muted)` | Icon glyph stroke color. |
| `--bs-basic-card-icon-svg-size` | `1.125rem` | Icon SVG width/height inside the chip. |
| `--bs-basic-card-primary-color` | `var(--tc-text)` | Primary text color. |
| `--bs-basic-card-primary-font-size` | `1.0625rem` | Primary text font size. |
| `--bs-basic-card-secondary-color` | `var(--tc-text-muted)` | Secondary text color. |
| `--bs-basic-card-secondary-font-size` | `0.8125rem` | Secondary text font size. |
| `--bs-basic-card-skeleton-bg` | `var(--tc-surface-muted)` | Skeleton placeholder fill color. |
| `--bs-basic-card-skeleton-shimmer` | `rgba(255,255,255,0.6)` | Shimmer highlight color. |

```html
<!-- With icon -->
<tc-basic-card icon="BarChart2" text-a="$24,500" text-b="Total revenue this month"></tc-basic-card>

<!-- Without icon -->
<tc-basic-card text-a="1,284" text-b="Active users"></tc-basic-card>

<!-- Loading state -->
<tc-basic-card loading text-a="placeholder" text-b="placeholder"></tc-basic-card>
```

---

### tc-colored-card

Dashboard card with a caller-supplied color tinting the icon chip and a two-line metric display. Purely presentational; no events.

**Tag:** `tc-colored-card`

**Attributes**

| Attribute | Type | Default | Description |
|-----------|------|---------|-------------|
| `text` | `string` | `""` | Metric label (muted, shown below the value). Required. |
| `value` | `string \| number` | `""` | Metric value (prominent, shown above the label). Required. |
| `icon` | `string` | — | Lucide icon name in PascalCase (e.g. `"TrendingUp"`, `"Users"`). When absent, no icon chip is rendered. |
| `color` | `string` | — | Any CSS color (`"#22c55e"`, `"rgb(…)"`, `"var(--tc-success)"`). Tints the icon chip background (soft 12% tint) and sets the icon glyph color. Required for the colored effect; falls back to slate muted when absent. |
| `loading` | `boolean` | `false` | When present, renders a shimmer skeleton placeholder in place of content. |

**JS Properties**

| Property | Type | Description |
|----------|------|-------------|
| `text` | `string` | Reflects the `text` attribute. |
| `value` | `string \| number` | Reflects the `value` attribute (setter converts to string). |
| `icon` | `string \| null` | Reflects the `icon` attribute. |
| `color` | `string \| null` | Reflects the `color` attribute. |
| `loading` | `boolean` | Reflects the `loading` attribute. |

**Events**

None. `tc-colored-card` is purely presentational.

**Slots**

None. Content is driven entirely by HTML attributes.

**Accessibility**

- The icon chip carries `aria-hidden="true"` — it is decorative; color is not the only carrier of information (value and label remain plain text).
- The loading state sets `aria-busy="true"` on the host and includes a visually-hidden `role="status"` announcement.
- Skeleton shimmer animation honours `prefers-reduced-motion` (freezes to a static fill; the region remains visible).
- The colored chip uses a 12% tint background, ensuring adequate contrast between the full-color glyph and the soft tint.

**CSS Custom Properties**

| Property | Default | Description |
|----------|---------|-------------|
| `--bs-colored-card-accent` | `var(--tc-text-muted)` | Accent color applied to the icon glyph and chip tint background. Set via the `color` attribute. |
| `--bs-colored-card-bg` | `var(--tc-surface)` | Card background color. |
| `--bs-colored-card-border-color` | `var(--tc-border)` | Card 1px hairline border color. |
| `--bs-colored-card-shadow` | `var(--tc-shadow-sm)` | Card resting shadow. |
| `--bs-colored-card-padding-y` | `1rem` | Vertical card body padding. |
| `--bs-colored-card-padding-x` | `1.25rem` | Horizontal card body padding. |
| `--bs-colored-card-gap` | `0.875rem` | Gap between icon chip and text block. |
| `--bs-colored-card-icon-size` | `2.75rem` | Width and height of the icon chip. |
| `--bs-colored-card-icon-svg-size` | `1.25rem` | Icon SVG width/height inside the chip. |
| `--bs-colored-card-value-color` | `var(--tc-text)` | Metric value text color. |
| `--bs-colored-card-value-font-size` | `1.375rem` | Metric value font size. |
| `--bs-colored-card-text-color` | `var(--tc-text-muted)` | Metric label text color. |
| `--bs-colored-card-text-font-size` | `0.8125rem` | Metric label font size. |
| `--bs-colored-card-skeleton-bg` | `var(--tc-surface-muted)` | Skeleton placeholder fill color. |
| `--bs-colored-card-skeleton-shimmer` | `rgba(255,255,255,0.6)` | Shimmer highlight color. |

```html
<!-- Revenue metric (green) -->
<tc-colored-card icon="TrendingUp" value="$48,200" text="Total revenue" color="#22c55e"></tc-colored-card>

<!-- Active users metric (blue) -->
<tc-colored-card icon="Users" value="3,821" text="Active users this week" color="#3b82f6"></tc-colored-card>

<!-- Loading state -->
<tc-colored-card loading icon="BarChart2" value="—" text="placeholder" color="#6366f1"></tc-colored-card>
```

---

### tc-difference-card

Dashboard metric card showing a prominent value with a directional percentage-delta chip (vs the previous period). Purely presentational; no events.

**Tag:** `tc-difference-card`

**Attributes**

| Attribute | Type | Default | Description |
|-----------|------|---------|-------------|
| `title` | `string` | `""` | Metric name label (muted, shown above the value). Required. |
| `value` | `number` | `0` | Current metric value. Required. |
| `previous-value` | `number` | `0` | Prior-period value used to compute the percentage delta. Required. When `0`, the delta chip shows `—` (no valid baseline). |
| `period` | `string` | — | Optional caption rendered below the metric row (e.g. `"vs last month"`). |
| `loading` | `boolean` | `false` | When present, renders a shimmer skeleton placeholder in place of content. |

**JS Properties**

| Property | Type | Description |
|----------|------|-------------|
| `title` | `string` | Reflects the `title` attribute. |
| `value` | `number` | Reflects the `value` attribute (parsed as float). |
| `previousValue` | `number` | Reflects the `previous-value` attribute (parsed as float). |
| `period` | `string \| null` | Reflects the `period` attribute. |
| `loading` | `boolean` | Reflects the `loading` attribute. |
| `formatValue` | `((v: number) => string) \| null` | Optional formatter function applied to the displayed `value`. Default format: ≥1 000 000 → `"1.2M"`, ≥1 000 → `"1.2K"`, else `toLocaleString()`. Set via JS property — not an attribute. Re-renders on assignment. |

**Events**

None. `tc-difference-card` is purely presentational.

**Slots**

None. Content is driven entirely by HTML attributes and the `formatValue` JS property.

**Accessibility**

- The directional delta icon carries `aria-hidden="true"` — direction is conveyed by the icon **and** the `+`/`-` sign prefix in the text, not color alone.
- The loading state sets `aria-busy="true"` on the host and includes a visually-hidden `role="status"` announcement.
- Skeleton shimmer animation honours `prefers-reduced-motion` (freezes to a static fill).

**CSS Custom Properties**

| Property | Default | Description |
|----------|---------|-------------|
| `--bs-difference-card-bg` | `var(--tc-surface)` | Card background color. |
| `--bs-difference-card-border-color` | `var(--tc-border)` | Card 1px hairline border color. |
| `--bs-difference-card-shadow` | `var(--tc-shadow-sm)` | Card resting shadow. |
| `--bs-difference-card-padding-y` | `1rem` | Vertical card body padding. |
| `--bs-difference-card-padding-x` | `1.25rem` | Horizontal card body padding. |
| `--bs-difference-card-title-color` | `var(--tc-text-muted)` | Metric name label color. |
| `--bs-difference-card-value-color` | `var(--tc-text)` | Prominent value text color. |
| `--bs-difference-card-value-font-size` | `1.5rem` | Prominent value font size. |
| `--bs-difference-card-period-color` | `var(--tc-text-muted)` | Period caption text color. |
| `--bs-difference-card-delta-gap` | `0.25rem` | Gap between the icon and text inside the delta chip. |
| `--bs-difference-card-delta-icon-size` | `0.875rem` | Width/height of the directional icon inside the delta chip. |
| `--bs-difference-card-delta-font-size` | `0.75rem` | Font size of the percentage text in the delta chip. |
| `--bs-difference-card-skeleton-bg` | `var(--tc-surface-muted)` | Skeleton placeholder fill color. |
| `--bs-difference-card-skeleton-shimmer` | `rgba(255,255,255,0.6)` | Shimmer highlight color. |

```html
<!-- Positive delta (up) -->
<tc-difference-card title="Monthly Revenue" value="12500" previous-value="10000" period="vs last month"></tc-difference-card>

<!-- Negative delta (down) -->
<tc-difference-card title="Active Users" value="8200" previous-value="10000" period="vs last week"></tc-difference-card>

<!-- Flat / no change -->
<tc-difference-card title="Error Rate" value="10000" previous-value="10000" period="vs yesterday"></tc-difference-card>

<!-- Custom formatValue via JS property -->
<tc-difference-card id="sales" title="Total Sales" value="1250000" previous-value="1000000" period="vs Q1"></tc-difference-card>
<script>
    document.getElementById('sales').formatValue =
        v => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(v)
</script>

<!-- Loading skeleton -->
<tc-difference-card title="Placeholder" value="0" previous-value="0" loading></tc-difference-card>
```

---

### tc-list-card

Dashboard card rendering a list of items with optional ranking numbers, leading icons, and trailing values. Purely presentational; no events.

**Tag:** `tc-list-card`

**Attributes**

| Attribute | Type | Default | Description |
|-----------|------|---------|-------------|
| `title` | `string` | — | Optional card heading rendered in the header. When absent, no header is rendered. |
| `ordered` | `boolean` | `false` | When present, shows a rank number (1, 2, 3…) per row instead of the item icon. |
| `loading` | `boolean` | `false` | When present, renders skeleton placeholder rows instead of real items. |
| `loading-count` | `number` | `4` | Number of skeleton rows shown while `loading` is set. |

**JS Properties**

| Property | Type | Description |
|----------|------|-------------|
| `items` | `ListItem[]` | Array of list items to render. Set via JS property. Default: `[]`. Re-renders on assignment. |
| `title` | `string \| null` | Reflects the `title` attribute. |
| `ordered` | `boolean` | Reflects the `ordered` attribute. |
| `loading` | `boolean` | Reflects the `loading` attribute. |
| `loadingCount` | `number` | Reflects the `loading-count` attribute. |

`ListItem` shape:
```ts
interface ListItem {
    id?: string              // optional unique key (not rendered)
    icon?: string            // Lucide icon name in PascalCase (e.g. "Github", "Star"). Shown when ordered=false.
    label: string            // primary row label (required)
    value?: string | number  // optional right-aligned mono value
}
```

**Events**

None. `tc-list-card` is purely presentational.

**Slots**

None. Content is driven entirely by the `items` JS property and HTML attributes.

**Accessibility**

- Uses `<ol>` when `ordered` is set (real ordered list semantics), otherwise `<ul>`.
- The card heading uses a real `<h3>` element.
- Lead icons and rank chips carry `aria-hidden="true"` — no color-only meaning.
- The loading region sets `aria-busy="true"` on the list and includes a visually-hidden `role="status"` announcement.
- Skeleton shimmer animation honours `prefers-reduced-motion` (freezes to a static fill).

**CSS Custom Properties**

| Property | Default | Description |
|----------|---------|-------------|
| `--bs-list-card-bg` | `var(--tc-surface)` | Card background. |
| `--bs-list-card-border-color` | `var(--tc-border)` | Card 1px hairline border color. |
| `--bs-list-card-shadow` | `var(--tc-shadow-sm)` | Card resting shadow. |
| `--bs-list-card-header-bg` | ink gradient | Faint ink-gradient header background. |
| `--bs-list-card-header-border-color` | `var(--tc-border)` | Header bottom hairline color. |
| `--bs-list-card-title-color` | `var(--tc-text)` | Card heading text color. |
| `--bs-list-card-row-separator-color` | fainter slate-100 | Inner row separator (fainter than outer frame). |
| `--bs-list-card-lead-size` | `1.5rem` | Width/height of the lead cell (rank chip or icon area). |
| `--bs-list-card-rank-bg` | `var(--tc-surface-muted)` | Rank chip background. |
| `--bs-list-card-rank-color` | `var(--tc-text-muted)` | Rank numeral color. |
| `--bs-list-card-label-color` | `var(--tc-text)` | Item label text color. |
| `--bs-list-card-value-color` | `var(--tc-text-muted)` | Trailing value text color. |
| `--bs-list-card-icon-color` | `var(--tc-text-muted)` | Icon stroke color. |
| `--bs-list-card-skeleton-bg` | `var(--tc-surface-muted)` | Skeleton row fill. |
| `--bs-list-card-skeleton-shimmer` | `rgba(255,255,255,0.6)` | Shimmer highlight. |

```html
<!-- Ordered ranked list — set items via JS property -->
<tc-list-card id="ranking" title="Top Frameworks" ordered></tc-list-card>
<script>
    document.getElementById('ranking').items = [
        { label: 'React',   value: '42,300' },
        { label: 'Vue',     value: '18,100' },
        { label: 'Angular', value: '11,500' },
        { label: 'Svelte',  value: '7,200' },
    ]
</script>

<!-- Icon list -->
<tc-list-card id="channels" title="Social Channels"></tc-list-card>
<script>
    document.getElementById('channels').items = [
        { icon: 'Github',   label: 'GitHub',   value: '12.4k' },
        { icon: 'Twitter',  label: 'Twitter',  value: '8.9k' },
        { icon: 'Linkedin', label: 'LinkedIn', value: '5.1k' },
    ]
</script>

<!-- Loading state -->
<tc-list-card title="Top Frameworks" loading></tc-list-card>

<!-- Loading state with custom row count -->
<tc-list-card title="Leaderboard" loading ordered loading-count="5"></tc-list-card>
```

---

### tc-status-card

Dashboard card showing a list of status indicator rows. Each row has a colored circle indicator (with an inline icon for non-color accessibility), a label, and an optional right-aligned detail. Purely presentational; no events.

**Tag:** `tc-status-card`

**Attributes**

| Attribute | Type | Default | Description |
|-----------|------|---------|-------------|
| `title` | `string` | — | Optional card heading rendered in the header. When absent, no header is rendered. |
| `loading` | `boolean` | `false` | When present, renders skeleton placeholder rows instead of real items. |
| `loading-count` | `number` | `4` | Number of skeleton rows shown while `loading` is set. |

**JS Properties**

| Property | Type | Description |
|----------|------|-------------|
| `items` | `StatusItem[]` | Array of status items to render. Set via JS property. Default: `[]`. Re-renders on assignment. |
| `title` | `string \| null` | Reflects the `title` attribute. |
| `loading` | `boolean` | Reflects the `loading` attribute. |
| `loadingCount` | `number` | Reflects the `loading-count` attribute. |

`StatusItem` shape:
```ts
interface StatusItem {
    id?: string                                 // optional unique key (not rendered)
    label: string                               // row label (required)
    status: 'ok' | 'warning' | 'error' | 'inactive'  // drives indicator color + icon
    detail?: string                             // optional right-aligned mono detail text
}
```

Status → indicator mapping:

| Status | Color token | Lucide icon | Meaning |
|--------|-------------|-------------|---------|
| `ok` | `--tc-success` | Check | Healthy / passing |
| `warning` | `--tc-warning` | AlertTriangle | Degraded / attention needed |
| `error` | `--tc-danger` | X | Failed / unreachable |
| `inactive` | `--tc-text-faint` | Minus | Paused / disabled |

**Events**

None. `tc-status-card` is purely presentational.

**Slots**

None. Content is driven entirely by the `items` JS property and HTML attributes.

**Accessibility**

- Each status indicator circle carries `role="img"` and `aria-label` set to the status name (`"ok"`, `"warning"`, `"error"`, `"inactive"`), so meaning is conveyed by text, not color alone.
- The inline Lucide icon provides a second non-color signal (shape/glyph).
- The list uses `<ul role="list">` with `role="listitem"` on each row.
- The card heading uses a real `<h3>` element.
- The loading region sets `aria-busy="true"` on the list and includes a visually-hidden `role="status"` announcement ("Loading status…").
- Skeleton shimmer animation honours `prefers-reduced-motion` (freezes to a static fill).

**CSS Custom Properties**

| Property | Default | Description |
|----------|---------|-------------|
| `--bs-status-card-bg` | `var(--tc-surface)` | Card background. |
| `--bs-status-card-border-color` | `var(--tc-border)` | Card 1px hairline border color. |
| `--bs-status-card-shadow` | `var(--tc-shadow-sm)` | Card resting shadow. |
| `--bs-status-card-header-bg` | ink gradient | Faint ink-gradient header background. |
| `--bs-status-card-header-border-color` | `var(--tc-border)` | Header bottom hairline color. |
| `--bs-status-card-title-color` | `var(--tc-text)` | Card heading text color. |
| `--bs-status-card-item-padding-y` | `0.625rem` | Vertical padding per row. |
| `--bs-status-card-item-padding-x` | `1.25rem` | Horizontal padding per row. |
| `--bs-status-card-item-gap` | `0.625rem` | Gap between indicator, label, and detail. |
| `--bs-status-card-item-separator-color` | slate-100 | Hairline between rows (fainter than outer border). |
| `--bs-status-card-indicator-size` | `1.375rem` | Diameter of the status indicator circle. |
| `--bs-status-card-indicator-icon-size` | `0.8125rem` | Size of the inline SVG icon inside the circle. |
| `--bs-status-card-label-color` | `var(--tc-text)` | Row label text color. |
| `--bs-status-card-detail-color` | `var(--tc-text-muted)` | Detail text color (mono, right-aligned). |
| `--bs-status-card-skeleton-bg` | `var(--tc-surface-muted)` | Skeleton row fill. |
| `--bs-status-card-skeleton-shimmer` | `rgba(255,255,255,0.6)` | Shimmer highlight color. |

```html
<!-- Status card with title — set items via JS property -->
<tc-status-card id="health" title="System Health"></tc-status-card>
<script>
    document.getElementById('health').items = [
        { id: '1', label: 'API Gateway',      status: 'ok',       detail: 'Healthy' },
        { id: '2', label: 'Database Cluster', status: 'warning',  detail: 'High CPU' },
        { id: '3', label: 'Email Service',    status: 'error',    detail: 'Unreachable' },
        { id: '4', label: 'Analytics Worker', status: 'inactive', detail: 'Paused' },
    ]
</script>

<!-- No title, optional detail -->
<tc-status-card id="svc"></tc-status-card>
<script>
    document.getElementById('svc').items = [
        { label: 'Auth Service', status: 'ok' },
        { label: 'Job Queue',    status: 'warning', detail: 'Backlog growing' },
        { label: 'CDN Edge',     status: 'ok' },
    ]
</script>

<!-- Loading state -->
<tc-status-card title="System Health" loading></tc-status-card>

<!-- Loading state with custom row count -->
<tc-status-card title="Services" loading loading-count="6"></tc-status-card>
```

---

### tc-download-stats

Package download statistics card showing formatted weekly, monthly, and total download counts with an optional sparkline trend chart. Supports npm, PyPI, and crates.io registries. All numbers are formatted with compact notation (`1.2M`, `12.3K`). The sparkline is set via a JS property, not an attribute.

**Tag:** `tc-download-stats`

**Attributes**

| Attribute | Type | Default | Description |
|-----------|------|---------|-------------|
| `package-name` | string | `''` | Package name shown as a mono micro-label in the card header. |
| `weekly` | number | — | Weekly download count. Rendered only when present. |
| `monthly` | number | — | Monthly download count. Rendered only when present. |
| `total` | number | — | Total (all-time) download count. Rendered only when present. |
| `registry` | `'npm' \| 'pypi' \| 'crates'` | `'npm'` | Registry context shown as an icon in the header. Falls back to `'npm'` on unknown values. |

**JS Properties**

| Property | Type | Description |
|----------|------|-------------|
| `packageName` | `string` | Reflects the `package-name` attribute. |
| `weekly` | `number \| null` | Reflects the `weekly` attribute (numeric). |
| `monthly` | `number \| null` | Reflects the `monthly` attribute (numeric). |
| `total` | `number \| null` | Reflects the `total` attribute (numeric). |
| `registry` | `DownloadStatsRegistry` | Reflects the `registry` attribute. |
| `sparkline` | `number[]` | **JS property only — not an attribute.** Array of download counts to render as an inline SVG line chart below the stat cells. Set via `el.sparkline = [...]`. Triggers a re-render on assignment. |

**Events**

None. `tc-download-stats` is purely presentational.

**Slots**

None. All content is driven by attributes and the `sparkline` JS property.

**Accessibility**

- Package name and stat numbers are real text, not images.
- The sparkline SVG carries `role="img"` with an `aria-label` summarising the trend direction (e.g. `"Download trend from 12 to 55, upward"`). Add `aria-hidden="true"` on the element when it is inside an already-labelled region.
- `prefers-reduced-motion` is honoured — sparkline transitions are disabled.

**CSS Custom Properties**

| Property | Default | Description |
|----------|---------|-------------|
| `--bs-download-stats-bg` | `var(--tc-surface)` | Card background color. |
| `--bs-download-stats-border-color` | `var(--tc-border)` | Card frame and header bottom hairline. |
| `--bs-download-stats-shadow` | `var(--tc-shadow-sm)` | Card resting shadow. |
| `--bs-download-stats-padding-y` | `1rem` | Vertical padding for header and stat cells. |
| `--bs-download-stats-padding-x` | `1.25rem` | Horizontal padding for header, cells, and sparkline. |
| `--bs-download-stats-icon-size` | `1rem` | Registry icon size. |
| `--bs-download-stats-icon-color` | `var(--tc-text-muted)` | Registry icon stroke color. |
| `--bs-download-stats-package-color` | `var(--tc-text-muted)` | Package name text color. |
| `--bs-download-stats-package-font-size` | `0.8125rem` | Package name font size. |
| `--bs-download-stats-number-color` | `var(--tc-text)` | Stat number text color. |
| `--bs-download-stats-number-font-size` | `1.375rem` | Stat number font size. |
| `--bs-download-stats-period-color` | `var(--tc-text-muted)` | Period label (Weekly / Monthly / Total) text color. |
| `--bs-download-stats-period-font-size` | `0.6875rem` | Period label font size. |
| `--bs-download-stats-cell-separator-color` | `var(--tc-slate-100)` | Inner hairline between stat cells (fainter than the outer frame). |
| `--bs-download-stats-sparkline-color` | `var(--tc-text-muted)` | Sparkline stroke and dot fill color. |
| `--bs-download-stats-sparkline-height` | `36px` | Sparkline SVG rendered height. |

```html
<!-- npm package with all three counts and a sparkline -->
<tc-download-stats
    id="ds1"
    package-name="@toolcase/web-components"
    weekly="148320"
    monthly="612000"
    total="4800000"
    registry="npm"
></tc-download-stats>
<script>
    document.getElementById('ds1').sparkline = [12, 18, 15, 24, 20, 32, 28, 40, 35, 48]
</script>

<!-- PyPI package, weekly + total only -->
<tc-download-stats
    package-name="toolcase-sdk"
    weekly="9200"
    total="390000"
    registry="pypi"
></tc-download-stats>

<!-- crates.io package, monthly + total only -->
<tc-download-stats
    package-name="toolcase"
    monthly="4100"
    total="52000"
    registry="crates"
></tc-download-stats>
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

### tc-social-links

Horizontal row of social-media icon-button links. Each link is a square icon button with sharp corners, slate neutrals, and accessible labels. Two visual variants (`ghost` / `filled`) and three sizes (`sm` / `md` / `lg`). The `links` array is set via a JS property — not an attribute.

**Tag:** `tc-social-links`

**Attributes**

| Attribute | Type | Default | Description |
|-----------|------|---------|-------------|
| `size` | `sm\|md\|lg` | `md` | Button size. `sm` = 32px, `md` = 40px, `lg` = 48px (all expand to 44px minimum on coarse pointers) |
| `variant` | `ghost\|filled` | `ghost` | Visual style. `ghost` = transparent at rest, slate well on hover. `filled` = slate-100 surface at rest, slate-200 + 1px lift on hover |

**JS Properties**

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `links` | `SocialLink[]` | `[]` | Array of link objects. Setting this property triggers a re-render |

**`SocialLink` shape**

```ts
interface SocialLink {
    kind: SocialKind   // which social network
    href: string       // destination URL
    label?: string     // accessible name; defaults to the kind string when absent
}
```

**`SocialKind` values**

`'github' | 'x' | 'linkedin' | 'mastodon' | 'youtube' | 'rss' | 'discord' | 'instagram' | 'tiktok'`

**Events**

None. Links navigate natively via the rendered `<a>` elements.

**Slots**

None. All content is generated from the `links` property.

**Accessibility**

- Each link is a real `<a>` element with `aria-label` (from `label` or `kind`), `target="_blank"`, and `rel="noopener noreferrer"`.
- Icons are decorative (`aria-hidden="true"`).
- The host carries `role="list"`; each `<a>` carries `role="listitem"`.
- Focus ring visible via `:focus-visible` (2px `--tc-app-accent` outline, offset 2px).
- 44px touch targets enforced at all sizes on coarse pointers.
- `prefers-reduced-motion` suppresses the hover lift; color/background transitions are preserved.

**CSS custom properties (theming)**

| Property | Default | Description |
|----------|---------|-------------|
| `--bs-social-links-btn-size` | `40px` | Square button dimension (overridden by size modifier) |
| `--bs-social-links-icon-size` | `1.25rem` | SVG icon width and height (overridden by size modifier) |
| `--bs-social-links-gap` | `0.25rem` | Gap between link buttons |
| `--bs-social-links-color` | `var(--tc-text-muted)` | Glyph color at rest |
| `--bs-social-links-bg` | `transparent` | Button background at rest |
| `--bs-social-links-border` | `transparent` | Button border color at rest |
| `--bs-social-links-hover-color` | `var(--tc-text)` | Glyph color on hover |
| `--bs-social-links-hover-bg` | `var(--tc-surface-muted)` | Button background on hover |
| `--bs-social-links-hover-border` | `transparent` | Button border color on hover |
| `--bs-social-links-hover-shadow` | `none` | Box shadow on hover |
| `--bs-social-links-hover-translate` | `0` | Vertical lift on hover (filled: `-1px`) |

```html
<!-- Ghost (default) — transparent, slate text -->
<tc-social-links id="social"></tc-social-links>
<script>
document.getElementById('social').links = [
    { kind: 'github', href: 'https://github.com/example' },
    { kind: 'x', href: 'https://x.com/example', label: 'X (Twitter)' },
    { kind: 'linkedin', href: 'https://linkedin.com/in/example' },
]
</script>

<!-- Filled, large -->
<tc-social-links id="social2" variant="filled" size="lg"></tc-social-links>
<script>
document.getElementById('social2').links = [
    { kind: 'github', href: '#' },
    { kind: 'rss', href: '#', label: 'RSS Feed' },
    { kind: 'youtube', href: '#' },
]
</script>

<!-- All kinds -->
<tc-social-links id="all" variant="filled"></tc-social-links>
<script>
document.getElementById('all').links = [
    { kind: 'github', href: '#' },
    { kind: 'x', href: '#' },
    { kind: 'linkedin', href: '#' },
    { kind: 'mastodon', href: '#' },
    { kind: 'youtube', href: '#' },
    { kind: 'rss', href: '#' },
    { kind: 'discord', href: '#' },
    { kind: 'instagram', href: '#' },
    { kind: 'tiktok', href: '#' },
]
</script>
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

---

### tc-stamp

Decorative stamp badge pinned to a corner of a relatively-positioned ancestor element. Uses the status tint palette (soft background + dark emphasis text). Sharp rectangular corners; mono uppercase micro-label type. Non-interactive — no hover/active states or events.

**Tag:** `tc-stamp`

**Attributes**

| Attribute | Type | Default | Description |
|-----------|------|---------|-------------|
| `label` | string | — | Stamp text. When present, renders as escaped text inside `.tc-stamp-content`. When absent, slotted children are used instead |
| `color` | `primary\|secondary\|success\|danger\|warning\|info` | `primary` | Color variant. Drives the soft bg tint and dark emphasis text from the status palette |
| `position` | `top-left\|top-right\|bottom-left\|bottom-right` | `top-right` | Corner of the nearest relatively-positioned ancestor to pin the stamp to |

**JS Properties**

All three attributes are reflected as JS properties with the same names (`label`, `color`, `position`).

**Slots**

| Slot | Description |
|------|-------------|
| _(default)_ | Stamp content when the `label` attribute is absent. Preserved across re-renders inside `.tc-stamp-content` |

**Events**

None. `tc-stamp` is a purely presentational decorative element.

**CSS custom properties (theming)**

| Property | Default | Description |
|----------|---------|-------------|
| `--bs-stamp-padding-x` | `0.4rem` | Horizontal padding |
| `--bs-stamp-padding-y` | `0.25rem` | Vertical padding |
| `--bs-stamp-font-size` | `0.6875rem` | Label font size (11px) |
| `--bs-stamp-font-weight` | `600` | Label font weight |
| `--bs-stamp-letter-spacing` | `0.08em` | Uppercase micro-label letter spacing |
| `--bs-stamp-border-width` | `1px` | Hairline border width |
| `--bs-stamp-corner-offset` | `0.75rem` | Distance from the anchor corner |
| `--bs-stamp-color` | _(set per color variant)_ | Text and border color |
| `--bs-stamp-bg` | _(set per color variant)_ | Background fill color |

```html
<!-- Status colors (position defaults to top-right) -->
<div style="position: relative; padding: 2rem;">
    Card content
    <tc-stamp color="success" label="New"></tc-stamp>
</div>

<div style="position: relative; padding: 2rem;">
    <tc-stamp color="danger" label="Sale"></tc-stamp>
</div>

<div style="position: relative; padding: 2rem;">
    <tc-stamp color="warning" label="Beta"></tc-stamp>
</div>

<!-- Corner positions -->
<div style="position: relative; padding: 2rem;">
    <tc-stamp color="info" position="top-left" label="New"></tc-stamp>
</div>

<div style="position: relative; padding: 2rem;">
    <tc-stamp color="success" position="bottom-right" label="Verified"></tc-stamp>
</div>

<!-- Slotted children (label attribute absent) -->
<div style="position: relative; padding: 2rem;">
    <tc-stamp color="danger" position="top-right"><strong>Sale</strong></tc-stamp>
</div>
```

---

### tc-status-dot

Colour-coded status indicator dot with an optional text label and an optional pulsing ring animation. Uses semantic status colours (`online` → success green, `busy` → danger red, `away` → warning amber, `offline` → slate/neutral). Respects `prefers-reduced-motion` — the pulse ring is disabled, but the static dot remains visible.

**Tag:** `tc-status-dot`

**Attributes**

| Attribute | Type | Default | Description |
|-----------|------|---------|-------------|
| `status` | `online\|offline\|busy\|away` | `offline` | Status value. Controls the marker colour and the accessible label when no visible `label` is present |
| `size` | `small\|default\|large` | `default` | Marker diameter: 6 px / 8 px / 10 px, with proportional label font size |
| `label` | string | — | Optional visible label shown to the right of the dot. When present, the marker uses `aria-labelledby` pointing at the label span instead of its own `aria-label` |
| `pulse` | boolean | false | When present, adds an expanding-and-fading ring animation around the marker. Disabled under `prefers-reduced-motion` |

**JS Properties**

All four attributes are reflected as same-named JS properties (`status`, `size`, `label`, `pulse`).

**Events**

None. `tc-status-dot` is a purely presentational element.

**Slots**

None.

**CSS custom properties (theming)**

| Property | Default | Description |
|----------|---------|-------------|
| `--bs-status-dot-marker-size` | `8px` | Diameter of the status dot. Overridden per size modifier |
| `--bs-status-dot-gap` | `6px` | Gap between the marker and the label |
| `--bs-status-dot-label-size` | `13px` | Label font size. Overridden per size modifier |
| `--bs-status-dot-label-color` | `var(--tc-text-muted)` | Label text colour |
| `--bs-status-dot-animation-speed` | `1.6s` | Pulse ring animation duration |
| `--bs-status-dot-color` | _(set per status)_ | Marker fill and pulse ring border colour. Set automatically from the `status` attribute |

```html
<!-- Dot only (no label) -->
<tc-status-dot status="online"></tc-status-dot>
<tc-status-dot status="busy"></tc-status-dot>
<tc-status-dot status="away"></tc-status-dot>
<tc-status-dot status="offline"></tc-status-dot>

<!-- With labels -->
<tc-status-dot status="online" label="Online"></tc-status-dot>
<tc-status-dot status="busy" label="Busy"></tc-status-dot>
<tc-status-dot status="away" label="Away"></tc-status-dot>
<tc-status-dot status="offline" label="Offline"></tc-status-dot>

<!-- Sizes -->
<tc-status-dot status="online" size="small" label="Small"></tc-status-dot>
<tc-status-dot status="online" size="default" label="Default"></tc-status-dot>
<tc-status-dot status="online" size="large" label="Large"></tc-status-dot>

<!-- Pulse animation -->
<tc-status-dot status="online" label="Online" pulse></tc-status-dot>
<tc-status-dot status="busy" label="Busy" pulse></tc-status-dot>
```

---

### tc-tag

Badge-like rectangular tag with color variants and an optional remove button. Sharp corners (`border-radius: 0`). Default `secondary` uses the slate tint palette; colored variants use the soft tint background, dark emphasis text, and a hairline in the variant color. The remove button dispatches `tc-remove` and does **not** remove the element from the DOM — the host controls removal (controlled pattern).

**Tag:** `tc-tag`

**Attributes**

| Attribute | Type | Default | Description |
|-----------|------|---------|-------------|
| `variant` | `primary\|secondary\|info\|success\|warning\|danger` | `secondary` | Color variant |
| `removable` | boolean | false | When set, renders a trailing remove (×) button |

**JS Properties**

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `onremove` | `() => void \| null` | `null` | Optional callback invoked in addition to the `tc-remove` event when the remove button is activated |

**Events**

| Event | Detail | Description |
|-------|--------|-------------|
| `tc-remove` | — | Fired (bubbles, composed) when the remove button is clicked or activated via keyboard. The element is **not** removed automatically. |

**Slots**

| Slot | Description |
|------|-------------|
| _(default)_ | Tag label text or markup. Preserved across re-renders inside `.tc-tag-content`. |

**CSS custom properties (theming)**

| Property | Default | Description |
|----------|---------|-------------|
| `--bs-tag-padding-x` | `0.5rem` | Horizontal padding |
| `--bs-tag-padding-y` | `0.25rem` | Vertical padding |
| `--bs-tag-font-size` | `0.8125rem` | Tag label font size (13px) |
| `--bs-tag-font-weight` | `500` | Label font weight |
| `--bs-tag-border-width` | `1px` | Hairline border width |
| `--bs-tag-bg` | `var(--tc-surface-muted)` | Background fill (overridden per variant) |
| `--bs-tag-color` | `var(--tc-text)` | Text and icon color (overridden per variant) |
| `--bs-tag-border-color` | `var(--tc-border)` | Border color (overridden per variant) |
| `--bs-tag-remove-icon-size` | `0.75rem` | Size of the × icon inside the remove button |

```html
<!-- Static variants -->
<tc-tag>Default (secondary)</tc-tag>
<tc-tag variant="primary">Primary</tc-tag>
<tc-tag variant="success">Success</tc-tag>
<tc-tag variant="danger">Danger</tc-tag>
<tc-tag variant="warning">Warning</tc-tag>
<tc-tag variant="info">Info</tc-tag>

<!-- Removable — listen for tc-remove to hide/delete the element -->
<tc-tag variant="success" removable id="my-tag">Deployed</tc-tag>

<script>
    document.getElementById('my-tag').addEventListener('tc-remove', e => {
        e.target.hidden = true
    })
</script>

<!-- onremove callback property -->
<tc-tag variant="info" removable id="tag2">Beta</tc-tag>
<script>
    const el = document.getElementById('tag2')
    el.onremove = () => el.remove()
</script>

### tc-asset-row

Single row displaying an asset with a leading icon, primary name label, optional tag chips, and a trailing size. Non-interactive; dispatches no events. Sharp corners (`border-radius: 0`); slate neutrals throughout — `--tc-text` for the name, `--tc-text-muted` for the size and icon, 1px `--tc-border` bottom hairline for row separation, hover to `--tc-surface-hover`. Size and tags rendered in mono.

**Tag:** `tc-asset-row`

**Attributes**

| Attribute | Type | Default | Description |
|-----------|------|---------|-------------|
| `icon` | string | — | Lucide icon name (e.g. `"FileText"`). When present, renders the glyph inline. When absent, `slot="icon"` child is used |
| `name` | string | — | Asset name text. When present, rendered as escaped text. When absent, `slot="name"` child is used |
| `size` | string | — | Trailing size / meta text (e.g. `"4.2 KB"`). When present, rendered in mono. When absent, `slot="size"` child is used |
| `class` | string | — | Extra CSS classes on the host element (pass-through) |

**JS Properties**

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `tags` | `string[]` | `[]` | Array of tag strings rendered as neutral slate chips beside the name. Set via JS: `el.tags = ['v1.0', 'stable']` |

**Events**

None. `tc-asset-row` is a purely presentational element.

**Slots**

| Slot | Description |
|------|-------------|
| `icon` | Optional leading icon node. Used when the `icon` attribute is absent |
| `name` | Primary label content. Used when the `name` attribute is absent |
| `size` | Trailing size/meta content. Used when the `size` attribute is absent |

**CSS custom properties (theming)**

| Property | Default | Description |
|----------|---------|-------------|
| `--bs-asset-row-padding-x` | `0.8125rem` | Horizontal padding |
| `--bs-asset-row-padding-y` | `0.625rem` | Vertical padding |
| `--bs-asset-row-gap` | `0.625rem` | Gap between row children |
| `--bs-asset-row-name-color` | `var(--tc-text)` | Name text color |
| `--bs-asset-row-size-color` | `var(--tc-text-muted)` | Size text color |
| `--bs-asset-row-tag-bg` | `var(--tc-surface-muted)` | Tag chip background |
| `--bs-asset-row-tag-color` | `var(--tc-text)` | Tag chip text color |
| `--bs-asset-row-tag-border-color` | `var(--tc-border)` | Tag chip hairline |
| `--bs-asset-row-tag-font-size` | `0.72rem` | Tag chip font size |
| `--bs-asset-row-separator-color` | `var(--tc-border)` | Bottom hairline color between consecutive rows |
| `--bs-asset-row-hover-bg` | `var(--tc-surface-hover)` | Row hover background |
| `--bs-asset-row-icon-size` | `1rem` | Leading icon size |

```html
<!-- Attribute-driven row -->
<tc-asset-row icon="FileText" name="README.md" size="4.2 KB"></tc-asset-row>

<!-- With tags (set via JS property) -->
<tc-asset-row id="row1" icon="Package" name="@toolcase/base" size="12 KB"></tc-asset-row>
<script>
    document.getElementById('row1').tags = ['v1.2.0', 'stable']
</script>

<!-- Slotted name and icon -->
<tc-asset-row size="8 KB">
    <img slot="icon" src="custom-icon.svg" width="16" height="16" alt="" />
    <strong slot="name">custom-name.json</strong>
</tc-asset-row>

<!-- Consecutive rows with hairline separators -->
<div style="border: 1px solid var(--tc-border)">
    <tc-asset-row icon="FileText" name="index.ts" size="2.1 KB"></tc-asset-row>
    <tc-asset-row icon="Image" name="logo.png" size="18 KB"></tc-asset-row>
    <tc-asset-row icon="Music" name="track.mp3" size="3.8 MB"></tc-asset-row>
</div>
```
```

---

### tc-asset-row-list

Bordered container for a sequence of `tc-asset-row` elements. Provides a single 1px `--tc-border` outer frame; inner row separators are owned by each child `tc-asset-row` (hairline border-bottom, removed on `:last-child` to avoid double-borders). Flat white surface — no decorative color or shadow. Non-interactive; dispatches no events.

**Tag:** `tc-asset-row-list`

**Attributes**

| Attribute | Type | Default | Description |
|-----------|------|---------|-------------|
| `class` / `className` | string | — | Extra CSS classes applied directly to the host element (pass-through; not managed by the component) |

**JS Properties**

None.

**Events**

None. `tc-asset-row-list` is a purely presentational container.

**Slots**

| Slot | Description |
|------|-------------|
| *(default)* | One or more `tc-asset-row` elements. Children survive re-renders and are re-projected into the inner `.tc-asset-row-list-body` |

**CSS custom properties (theming)**

| Property | Default | Description |
|----------|---------|-------------|
| `--bs-asset-row-list-border-color` | `var(--tc-border)` | Outer frame hairline colour |
| `--bs-asset-row-list-bg` | `var(--tc-surface)` | Background of the list container |

```html
<!-- Basic file list -->
<tc-asset-row-list>
    <tc-asset-row icon="FileText" name="README.md" size="4.2 KB"></tc-asset-row>
    <tc-asset-row icon="Image" name="logo.png" size="18 KB"></tc-asset-row>
    <tc-asset-row icon="FileCode" name="index.ts" size="2.1 KB"></tc-asset-row>
</tc-asset-row-list>

<!-- With tags set via JS property -->
<tc-asset-row-list>
    <tc-asset-row id="pkg1" icon="Package" name="@toolcase/base" size="12 KB"></tc-asset-row>
    <tc-asset-row id="pkg2" icon="Box" name="bundle.min.js" size="48 KB"></tc-asset-row>
</tc-asset-row-list>
<script>
    document.getElementById('pkg1').tags = ['v2.1.0', 'stable']
    document.getElementById('pkg2').tags = ['ts', 'esm', 'minified']
</script>
```

---

### tc-brief-card

A card displaying a task/brief with a difficulty indicator, optional icon, body copy, and a two-column meta footer. Dispatches `tc-click` when activated.

**Tag:** `tc-brief-card`

**Attributes**

| Attribute | Type | Default | Description |
|-----------|------|---------|-------------|
| `brief-id` | string | — | Identifier for the brief. Included in the `tc-click` event detail as `id`. Avoids clobbering the native `id` attribute. |
| `difficulty` | `'easy' \| 'medium' \| 'hard'` | `'easy'` | Controls the difficulty indicator badge: easy=success, medium=warning, hard=danger. |
| `title` | string | — | Card title text. Takes precedence over `slot="title"` children. Used as the button's `aria-label` when interactive. |
| `body` | string | — | Body copy text. Takes precedence over `slot="body"` children. |
| `meta-left` | string | — | Left-side meta text in the footer row. Monospace, muted. |
| `meta-right` | string | — | Right-side meta text in the footer row. Monospace, muted, right-aligned. |
| `icon` | string | — | Lucide icon name in PascalCase (e.g. `"FileText"`, `"Shield"`). Renders as inline SVG in the header. |
| `clickable` | boolean | `false` | Enables interactive affordance (hover lift, pointer cursor) when listening via `addEventListener('tc-click', …)` without setting `onClick`. |

**JS Properties**

| Property | Type | Description |
|----------|------|-------------|
| `briefId` | `string \| null` | Reflects the `brief-id` attribute. |
| `difficulty` | `BriefCardDifficulty` | Reflects the `difficulty` attribute. |
| `title` | `string \| null` | Reflects the `title` attribute. |
| `body` | `string \| null` | Reflects the `body` attribute. |
| `metaLeft` | `string \| null` | Reflects the `meta-left` attribute. |
| `metaRight` | `string \| null` | Reflects the `meta-right` attribute. |
| `icon` | `string \| null` | Reflects the `icon` attribute. |
| `clickable` | `boolean` | Reflects the `clickable` attribute. |
| `onClick` | `(() => void) \| null` | Optional callback fired on activation. Setting a non-null value enables the interactive visual affordance. |

**Events**

| Event | Detail | Description |
|-------|--------|-------------|
| `tc-click` | `{ id: string \| null }` | Fired when the card is clicked or activated via keyboard (Enter/Space). `id` is the value of `brief-id`. |

**Slots**

| Slot | Description |
|------|-------------|
| `icon` | Rich icon content for the header. Used when the `icon` attribute is absent. |
| `title` | Rich title content. Used when the `title` attribute is absent. |
| `body` | Rich body content. Used when the `body` attribute is absent. |
| `meta-left` | Rich left-side meta content. Used when the `meta-left` attribute is absent. |
| `meta-right` | Rich right-side meta content. Used when the `meta-right` attribute is absent. |

**CSS custom properties (theming)**

| Property | Default | Description |
|----------|---------|-------------|
| `--bs-brief-card-bg` | `var(--tc-surface)` | Card background |
| `--bs-brief-card-border-color` | `var(--tc-border)` | 1px hairline border colour |
| `--bs-brief-card-shadow` | `var(--tc-shadow-sm)` | Resting shadow |
| `--bs-brief-card-shadow-hover` | `var(--tc-shadow-hover)` | Hover lift shadow |
| `--bs-brief-card-title-color` | `var(--tc-text)` | Title text colour |
| `--bs-brief-card-body-color` | `var(--tc-text-muted)` | Body and meta text colour |
| `--bs-brief-card-id-color` | `var(--tc-text-faint)` | ID micro-label colour |

```html
<!-- Static difficulty variants -->
<tc-brief-card
    brief-id="TASK-001"
    difficulty="easy"
    title="Write docs"
    body="Document the new API surface."
    meta-left="2 pts"
    meta-right="Docs"
></tc-brief-card>

<tc-brief-card
    brief-id="TASK-042"
    difficulty="medium"
    icon="Shield"
    title="Add rate limiting"
    body="Protect public endpoints with a sliding-window rate limiter."
    meta-left="5 pts"
    meta-right="Security"
></tc-brief-card>

<tc-brief-card
    brief-id="TASK-099"
    difficulty="hard"
    title="Database sharding"
    body="Design the migration strategy for sharding the users table."
    meta-left="21 pts"
    meta-right="Infra"
></tc-brief-card>

<!-- Clickable card via event listener + clickable attribute -->
<tc-brief-card
    id="my-card"
    brief-id="TASK-012"
    difficulty="medium"
    icon="Zap"
    clickable
    title="Enable SSR"
    body="Add SSR support to improve first-contentful-paint."
    meta-left="8 pts"
    meta-right="Performance"
></tc-brief-card>
<script>
    document.getElementById('my-card').addEventListener('tc-click', e => {
        console.log('clicked brief id:', e.detail.id)
    })
</script>

<!-- Clickable card via onClick property -->
<tc-brief-card id="js-card" brief-id="TASK-013" difficulty="hard" title="Optimise queries"></tc-brief-card>
<script>
    document.getElementById('js-card').onClick = () => console.log('card clicked')
</script>

<!-- Slotted content -->
<tc-brief-card brief-id="TASK-055" difficulty="hard" meta-left="21 pts" meta-right="Infra">
    <span slot="icon"><!-- your SVG --></span>
    <strong slot="title">Custom rich title</strong>
    <em slot="body">Body with <a href="#">markup</a>.</em>
</tc-brief-card>
```

---

### tc-bundle-bar

Segmented progress bar for build / bundle visualisation. Renders a discrete row of cells where the first N are filled, with an optional header row (name + meta) and an optional row of chip labels.

**Tag:** `tc-bundle-bar`

**Attributes**

| Attribute | Type | Default | Description |
|-----------|------|---------|-------------|
| `segments` | number | `10` | Total number of discrete segment cells in the track. |
| `filled-segments` | number | `0` | Number of cells that are filled (clamped to `[0, segments]`). |
| `name` | string | — | Label displayed on the left side of the header row. When omitted, the `slot="name"` region is used. |
| `meta` | string | — | Monospace text displayed on the right side of the header row (e.g. `"4 / 10"`, `"65%"`). When omitted, the `slot="meta"` region is used. |

**JS Properties**

| Property | Type | Description |
|----------|------|-------------|
| `segments` | `number` | Reflects the `segments` attribute. |
| `filledSegments` | `number` | Reflects the `filled-segments` attribute. |
| `name` | `string \| null` | Reflects the `name` attribute. |
| `meta` | `string \| null` | Reflects the `meta` attribute. |
| `chips` | `BundleBarChip[]` | Array of chip descriptors rendered below the track. Each chip has `label: string`, optional `value?: string \| number`, and optional `color?: string` (CSS color applied as the chip accent). Setting this property triggers a re-render. |

**Events**

None. `tc-bundle-bar` is a purely presentational element.

**Slots**

| Slot | Description |
|------|-------------|
| `name` | Rich content for the header name region. Used when the `name` attribute is absent. |
| `meta` | Rich content for the header meta region. Used when the `meta` attribute is absent. |

**Accessibility**

The segment track carries `role="progressbar"` with `aria-valuenow` (filled count), `aria-valuemin="0"`, `aria-valuemax` (total segments), and `aria-label` derived from the `name` attribute when present.

**CSS custom properties (theming)**

| Property | Default | Description |
|----------|---------|-------------|
| `--bs-bundle-bar-segment-bg` | `var(--tc-surface-muted)` | Background of unfilled segment cells. |
| `--bs-bundle-bar-segment-filled-bg` | `var(--tc-app-accent)` | Background of filled segment cells. |
| `--bs-bundle-bar-segment-height` | `0.5rem` | Height of the track. |
| `--bs-bundle-bar-segment-gap` | `1px` | Hairline gap between segment cells. |
| `--bs-bundle-bar-name-color` | `var(--tc-text)` | Header name text colour. |
| `--bs-bundle-bar-meta-color` | `var(--tc-text-muted)` | Header meta text colour. |
| `--bs-bundle-bar-chip-bg` | `var(--tc-surface-muted)` | Chip label background. |
| `--bs-bundle-bar-chip-border-color` | `var(--tc-border)` | Chip hairline border and default value-area background. |
| `--bs-bundle-bar-chip-text-color` | `var(--tc-text)` | Chip label text colour. |
| `--bs-bundle-bar-chip-font-size` | `0.72rem` | Chip font size. |

```html
<!-- Simple fill ratio with name and meta -->
<tc-bundle-bar segments="10" filled-segments="4" name="Build progress" meta="4 / 10"></tc-bundle-bar>

<!-- Track only (no header) -->
<tc-bundle-bar segments="12" filled-segments="9"></tc-bundle-bar>

<!-- chips property set via JavaScript -->
<tc-bundle-bar id="bar" segments="10" filled-segments="7" name="dist/app" meta="3.8 MB"></tc-bundle-bar>
<script>
    document.getElementById('bar').chips = [
        { label: 'main',   value: '2.4 MB' },
        { label: 'vendor', value: '1.1 MB' },
        { label: 'lazy',   value: '320 KB' },
    ]
</script>

<!-- Chips with color accents (e.g. test results) -->
<tc-bundle-bar id="tests" segments="15" filled-segments="14" name="Test suite" meta="142 / 153"></tc-bundle-bar>
<script>
    document.getElementById('tests').chips = [
        { label: 'passed',  value: '142', color: '#16a34a' },
        { label: 'failed',  value: '3',   color: '#dc2626' },
        { label: 'skipped', value: '8' },
    ]
</script>

<!-- Named slots -->
<tc-bundle-bar segments="8" filled-segments="5">
    <strong slot="name">Custom name</strong>
    <em slot="meta">slot meta</em>
</tc-bundle-bar>
```

---

### tc-callout-quote

Blockquote with a decorative quote-mark icon, optional attribution, and an optional source link. The quote body is supplied either via the `quote` attribute (plain text) or via default slotted children (rich content). Renders as a semantic `<figure>/<blockquote>/<figcaption>` structure with a 4 px slate left border.

**Tag:** `tc-callout-quote`

**Attributes**

| Attribute | Type | Default | Description |
|-----------|------|---------|-------------|
| `quote` | string | — | Quote body rendered as escaped text inside `<blockquote>`. When absent, slotted children are used instead. |
| `attribution` | string | — | Name of the person being quoted, rendered as `<cite>` inside `<figcaption>`. |
| `source` | string | — | Source name (book, article, etc.) rendered after the attribution. Displayed as plain text unless `source-href` is also set. |
| `source-href` | string | — | URL for the source. When present, the source renders as an `<a>` with `target="_blank" rel="noopener noreferrer"`. |

**JS Properties**

| Property | Type | Description |
|----------|------|-------------|
| `quote` | `string \| null` | Reflects the `quote` attribute. |
| `attribution` | `string \| null` | Reflects the `attribution` attribute. |
| `source` | `string \| null` | Reflects the `source` attribute. |
| `sourceHref` | `string \| null` | Reflects the `source-href` attribute. |

**Events**

None. `tc-callout-quote` is a purely presentational element.

**Slots**

| Slot | Description |
|------|-------------|
| _(default)_ | Quote body content when the `quote` attribute is absent. Preserved across re-renders inside `.tc-callout-quote-content`. |

**Accessibility**

Uses semantic `<figure>`, `<blockquote>`, and `<figcaption>` elements. The quote-mark icon is `aria-hidden`. Attribution uses `<cite>`. A linked source is a real `<a>` with `rel="noopener noreferrer"` and visible focus ring. Respects `prefers-reduced-motion`.

**CSS custom properties (theming)**

| Property | Default | Description |
|----------|---------|-------------|
| `--bs-callout-quote-border-color` | `var(--tc-border)` | Left border colour. |
| `--bs-callout-quote-mark-color` | `var(--tc-text-faint)` | Colour of the decorative quote-mark icon. |
| `--bs-callout-quote-mark-size` | `2rem` | Size of the decorative quote-mark icon. |
| `--bs-callout-quote-text-color` | `var(--tc-text)` | Quote body text colour. |
| `--bs-callout-quote-text-size` | `1.1rem` | Quote body font size. |
| `--bs-callout-quote-caption-color` | `var(--tc-text-muted)` | Caption / attribution area text colour. |
| `--bs-callout-quote-author-color` | `var(--tc-text)` | Attribution `<cite>` text colour. |
| `--bs-callout-quote-source-color` | `var(--tc-text-muted)` | Source text colour (linked or plain). |
| `--bs-callout-quote-source-hover-color` | `var(--tc-app-accent)` | Source link hover colour. |
| `--bs-callout-quote-padding-y` | `1.25rem` | Vertical padding of the figure. |
| `--bs-callout-quote-padding-x` | `1.5rem` | Horizontal padding of the figure. |

```html
<!-- Quote via attribute -->
<tc-callout-quote quote="The best way to predict the future is to invent it."></tc-callout-quote>

<!-- Quote via default slot (rich content) -->
<tc-callout-quote>
    The best way to predict the future is to <strong>invent it</strong>.
</tc-callout-quote>

<!-- With attribution -->
<tc-callout-quote
    quote="Any sufficiently advanced technology is indistinguishable from magic."
    attribution="Arthur C. Clarke"
></tc-callout-quote>

<!-- With attribution and linked source -->
<tc-callout-quote
    quote="Programs must be written for people to read, and only incidentally for machines to execute."
    attribution="Harold Abelson"
    source="SICP"
    source-href="https://mitpress.mit.edu/sites/default/files/sicp/index.html"
></tc-callout-quote>

<!-- With attribution and plain source (no link) -->
<tc-callout-quote
    quote="An idea that is not dangerous is unworthy of being called an idea at all."
    attribution="Oscar Wilde"
    source="The Critic as Artist"
></tc-callout-quote>
```

---

### tc-chart-container

Chart wrapper with an optional header (title + subtitle on the left, actions on the right), a slotted chart body, a legend footer region, and loading/empty states. Renders as a `card`-styled surface with a subtle ink-gradient header cap, hairline border, and low shadow. Sharp corners throughout.

**Tag:** `tc-chart-container`

**Attributes**

| Attribute | Type | Default | Description |
|-----------|------|---------|-------------|
| `title` | string | — | Card header title text (Inter weight 600). When absent (along with `subtitle` and `actions`), the header is hidden entirely. |
| `subtitle` | string | — | Muted subtitle text rendered below the title (12.5 px, `--tc-text-muted`). |
| `loading` | boolean | `false` | When present, replaces the body with a shimmer skeleton placeholder and hides the legend. Takes precedence over `empty`. |
| `empty` | boolean | `false` | When present (and `loading` is absent), replaces the body with the `emptySlot` content or a default "No data available" placeholder. |

**JS Properties**

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `legend` | `string \| Node \| null` | `null` | HTML string or DOM Node rendered into the `.tc-chart-container-legend` footer. Hidden when `loading` is true or when empty. |
| `actions` | `string \| Node \| null` | `null` | HTML string or DOM Node rendered into the `.tc-chart-container-actions` region on the right side of the header. |
| `emptySlot` | `string \| Node \| null` | `null` | HTML string or DOM Node rendered inside the body when `empty` is true. Falls back to a default "No data available" text when not provided. |

**Events**

None. `tc-chart-container` is a purely presentational wrapper.

**Slots**

| Slot | Description |
|------|-------------|
| _(default)_ | Chart body content (the chart itself, a canvas, an SVG, etc.). Preserved across re-renders inside `.tc-chart-container-body`. Hidden when `loading` or `empty` is true. |

**Accessibility**

The inner root div carries `role="group"` and `aria-label` tied to the `title` attribute when present. The loading skeleton carries `aria-busy="true"` and a visually-labelled status role. The empty placeholder uses descriptive text. Interactive controls placed in `actions` inherit the visible focus ring from the reset layer. Skeleton shimmer honours `prefers-reduced-motion`.

**CSS custom properties (theming)**

| Property | Default | Description |
|----------|---------|-------------|
| `--bs-chart-container-bg` | `var(--tc-surface)` | Card background colour. |
| `--bs-chart-container-border-color` | `var(--tc-border)` | Hairline border colour. |
| `--bs-chart-container-shadow` | `var(--tc-shadow-sm)` | Box shadow at rest. |
| `--bs-chart-container-header-bg` | ink gradient | Subtle gradient cap applied to the header. |
| `--bs-chart-container-header-border-color` | `var(--tc-border)` | Separator hairline below the header. |
| `--bs-chart-container-header-padding-y` | `0.75rem` | Header vertical padding. |
| `--bs-chart-container-header-padding-x` | `1.25rem` | Header horizontal padding. |
| `--bs-chart-container-body-padding-y` | `1.25rem` | Body vertical padding. |
| `--bs-chart-container-body-padding-x` | `1.25rem` | Body horizontal padding. |
| `--bs-chart-container-legend-padding-y` | `0.625rem` | Legend footer vertical padding. |
| `--bs-chart-container-legend-padding-x` | `1.25rem` | Legend footer horizontal padding. |
| `--bs-chart-container-title-color` | `var(--tc-text)` | Title text colour. |
| `--bs-chart-container-subtitle-color` | `var(--tc-text-muted)` | Subtitle and legend text colour. |
| `--bs-chart-container-skeleton-bg` | `var(--tc-surface-muted)` | Skeleton placeholder background. |
| `--bs-chart-container-empty-color` | `var(--tc-text-faint)` | Empty state text colour. |

```html
<!-- Basic: title + subtitle + slotted chart body -->
<tc-chart-container title="Monthly Revenue" subtitle="Jan – Jun 2025">
    <canvas id="my-chart" height="200"></canvas>
</tc-chart-container>

<!-- Loading state -->
<tc-chart-container title="Monthly Revenue" loading></tc-chart-container>

<!-- Empty state (default placeholder) -->
<tc-chart-container title="Monthly Revenue" empty></tc-chart-container>

<!-- JS properties: legend and actions -->
<tc-chart-container id="chart" title="Portfolio" subtitle="Last 12 months">
    <canvas id="portfolio-chart" height="200"></canvas>
</tc-chart-container>
<script>
    const el = document.getElementById('chart')
    el.legend = '<span style="font-size:0.75rem;color:var(--tc-text-muted)">&#9679; Series A &nbsp; &#9675; Series B</span>'
    el.actions = '<button type="button">Export</button>'
</script>

<!-- Custom empty slot -->
<tc-chart-container id="chart-empty" title="Revenue" empty></tc-chart-container>
<script>
    document.getElementById('chart-empty').emptySlot = '<span>No records for the selected date range.</span>'
</script>
```

---

### tc-trend-indicator

Trend badge with a directional arrow icon and formatted value. Direction is determined by the explicit `direction` attribute or inferred from the numeric sign of `value`. Three sizes scale icon and text together. Purely presentational — no interaction, no events.

**Tag:** `tc-trend-indicator`

**Attributes**

| Attribute | Type | Default | Description |
|-----------|------|---------|-------------|
| `value` | string | `""` | The displayed value text (e.g. `"+12%"`, `"-8.3"`, `"0"`). When `direction` is absent and the value parses to a number, direction is inferred from its sign. |
| `direction` | `'up' \| 'down' \| 'neutral'` | inferred | Explicit direction. Overrides sign inference. When absent, positive numbers → `up`, negative → `down`, zero or non-numeric → `neutral`. |
| `size` | `'small' \| 'default' \| 'large'` | `'default'` | Scale variant — adjusts icon size, font size, and gap together. |

**JS Properties**

| Property | Type | Description |
|----------|------|-------------|
| `value` | `string \| null` | Reflects the `value` attribute. |
| `direction` | `TrendDirection \| null` | Reflects the `direction` attribute. `null` when the attribute is absent (direction is then inferred at render time). |
| `size` | `TrendSize` | Reflects the `size` attribute. Defaults to `'default'` when the attribute is absent or invalid. |

**Events**

None. `tc-trend-indicator` is purely presentational.

**Slots**

None. All content is generated from attributes.

**Accessibility**

The host element receives an auto-generated `aria-label` combining direction and value (e.g. `"trending up +12%"`). The icon SVG carries `aria-hidden="true"` — the label text conveys meaning without relying on color alone.

**CSS custom properties (theming)**

| Property | Default | Description |
|----------|---------|-------------|
| `--bs-trend-indicator-color` | direction-mapped | Text and icon color. `up` → `--tc-success`, `down` → `--tc-danger`, `neutral` → `--tc-text-muted`. |
| `--bs-trend-indicator-icon-size` | `1rem` | Icon width and height (scales with size variant). |
| `--bs-trend-indicator-font-size` | `0.8125rem` | Value text font size (scales with size variant). |
| `--bs-trend-indicator-gap` | `0.25rem` | Gap between icon and value text. |

```html
<!-- Explicit direction -->
<tc-trend-indicator value="+12%" direction="up"></tc-trend-indicator>
<tc-trend-indicator value="-8%" direction="down"></tc-trend-indicator>
<tc-trend-indicator value="0%" direction="neutral"></tc-trend-indicator>

<!-- Sign-inferred direction (no direction attribute) -->
<tc-trend-indicator value="42"></tc-trend-indicator>
<tc-trend-indicator value="-17"></tc-trend-indicator>
<tc-trend-indicator value="0"></tc-trend-indicator>

<!-- Three sizes -->
<tc-trend-indicator value="+5%" direction="up" size="small"></tc-trend-indicator>
<tc-trend-indicator value="+5%" direction="up" size="default"></tc-trend-indicator>
<tc-trend-indicator value="+5%" direction="up" size="large"></tc-trend-indicator>

<!-- Inline within a metric row -->
<p>
    Revenue <strong>$42,180</strong>
    <tc-trend-indicator value="+12.4%" direction="up" size="small"></tc-trend-indicator>
</p>
```

---

### tc-code-label-cell

**Tag:** `tc-code-label-cell`

Machine-facing code chip alongside a human-readable display name. Purely presentational — designed to drop into table or list cells.

**Attributes**

| Attribute | Type | Default | Description |
|-----------|------|---------|-------------|
| `code` | string | `""` | The machine-facing identifier (rendered in a mono chip). |
| `name` | string | `""` | The human-readable display name rendered beside the code chip. |

**JS Properties**

| Property | Type | Description |
|----------|------|-------------|
| `code` | `string` | Reflects the `code` attribute. |
| `name` | `string` | Reflects the `name` attribute. |

**Events**

None. `tc-code-label-cell` is purely presentational.

**Slots**

None. All content is generated from attributes.

**Accessibility**

The `<code>` element semantically marks the machine identifier. Both values are escaped before injection so user-supplied strings cannot inject markup.

**CSS custom properties (theming)**

| Property | Default | Description |
|----------|---------|-------------|
| `--bs-code-label-cell-gap` | `0.5rem` | Gap between the code chip and the name. |
| `--bs-code-label-cell-code-padding-x` | `0.375rem` | Horizontal padding of the code chip. |
| `--bs-code-label-cell-code-padding-y` | `0.125rem` | Vertical padding of the code chip. |
| `--bs-code-label-cell-code-font-size` | `0.75rem` | Font size of the code chip text. |
| `--bs-code-label-cell-code-font-weight` | `500` | Font weight of the code chip text. |
| `--bs-code-label-cell-code-color` | `var(--tc-text)` | Text color of the code chip. |
| `--bs-code-label-cell-code-bg` | `var(--tc-surface-muted)` | Background color of the code chip. |
| `--bs-code-label-cell-code-border` | `1px solid var(--tc-border)` | Border of the code chip. |
| `--bs-code-label-cell-name-font-size` | `0.875rem` | Font size of the name text. |
| `--bs-code-label-cell-name-color` | `var(--tc-text-muted)` | Color of the name text. |

```html
<!-- Basic usage -->
<tc-code-label-cell code="USR_001" name="Alice Johnson"></tc-code-label-cell>
<tc-code-label-cell code="PRD_42" name="Premium Widget"></tc-code-label-cell>

<!-- Inside a table cell -->
<table>
    <tr>
        <td>
            <tc-code-label-cell code="INV-0001" name="Monthly subscription"></tc-code-label-cell>
        </td>
        <td>Paid</td>
        <td>$49.00</td>
    </tr>
</table>
```

---

### tc-code-with-output

**Tag:** `tc-code-with-output`

Code snippet and its output displayed side-by-side (`split`) or stacked (`stacked`), with separate panes. The output pane switches to a danger-styled error state when the `error` property or `slot="error"` content is provided. Purely presentational — no callbacks or events.

**Attributes**

| Attribute | Type | Default | Description |
|-----------|------|---------|-------------|
| `code` | string | `""` | The source code to display (HTML-escaped before insertion). |
| `language` | `javascript \| typescript \| bash` | `"javascript"` | Language identifier; rendered as an uppercase mono micro-label in the code pane header. |
| `layout` | `split \| stacked` | `"split"` | `split` places the code and output panes side by side; `stacked` places the code pane above the output pane. |
| `title` | string | — | Optional plain-text header rendered above both panes. Use `slot="title"` for rich content. |

**JS Properties**

| Property | Type | Description |
|----------|------|-------------|
| `code` | `string` | Reflects the `code` attribute. |
| `language` | `CodeWithOutputLanguage` | Reflects the `language` attribute. |
| `layout` | `CodeWithOutputLayout` | Reflects the `layout` attribute. |
| `title` | `string \| null` | Reflects the `title` attribute. |
| `output` | `string` | HTML (or plain text) to render in the output pane. Set via JS property; complements the `slot="output"` slot. |
| `error` | `string` | HTML (or plain text) to render in the output pane when in error state. When non-empty, switches the pane to danger styling. Complements the `slot="error"` slot. |

**Events**

None. `tc-code-with-output` is purely presentational.

**Slots**

| Slot | Description |
|------|-------------|
| `title` | Rich content for the optional title header. Used when the `title` attribute is absent. |
| `output` | Rich output content for the output pane (normal state). Alternative to the `output` JS property. |
| `error` | Rich error content for the output pane (error state). When present, triggers danger styling. Alternative to the `error` JS property. |

**Accessibility**

The `<pre>` block is readable text with no extra role. The output pane gains `role="alert"` automatically when in error state. Focus is never removed. `prefers-reduced-motion` suppresses all transitions.

**CSS custom properties (theming)**

| Property | Default | Description |
|----------|---------|-------------|
| `--bs-cwo-border` | `1px solid var(--tc-border)` | Hairline border around the component and between panes. |
| `--bs-cwo-title-bg` | `var(--tc-surface-muted)` | Title header background. |
| `--bs-cwo-title-color` | `var(--tc-text)` | Title header text color. |
| `--bs-cwo-title-padding` | `0.5rem 0.75rem` | Title header padding. |
| `--bs-cwo-title-font-size` | `0.875rem` | Title header font size. |
| `--bs-cwo-title-font-weight` | `500` | Title header font weight. |
| `--bs-cwo-code-bg` | `var(--tc-ink)` | Code pane background (dark surface). |
| `--bs-cwo-code-header-bg` | `var(--tc-ink-2)` | Code pane header strip background. |
| `--bs-cwo-code-header-padding` | `0.375rem 0.75rem` | Code pane header padding. |
| `--bs-cwo-lang-color` | `var(--tc-text-muted)` | Language micro-label color. |
| `--bs-cwo-lang-font-size` | `0.7rem` | Language micro-label font size. |
| `--bs-cwo-lang-letter-spacing` | `0.08em` | Language micro-label letter spacing. |
| `--bs-cwo-code-color` | `var(--tc-text-inverse)` | Code text color (on dark surface). |
| `--bs-cwo-code-font-size` | `0.85rem` | Code block font size. |
| `--bs-cwo-code-padding` | `0.875rem 0.75rem` | Code block inner padding. |
| `--bs-cwo-code-line-height` | `1.6` | Code block line height. |
| `--bs-cwo-output-bg` | `var(--tc-surface)` | Output pane background. |
| `--bs-cwo-output-color` | `var(--tc-text)` | Output pane text color. |
| `--bs-cwo-output-padding` | `0.75rem` | Output pane inner padding. |
| `--bs-cwo-output-font-size` | `0.875rem` | Output pane font size. |
| `--bs-cwo-error-bg` | `var(--tc-danger-bg)` | Output pane background in error state. |
| `--bs-cwo-error-color` | `var(--tc-danger)` | Output pane text color in error state. |

```html
<!-- Split layout with JS property output -->
<tc-code-with-output
    code="console.log('hello');"
    language="javascript"
    title="Quick example"
    id="my-cwo"
></tc-code-with-output>
<script>
    document.getElementById('my-cwo').output = 'hello'
</script>

<!-- Stacked layout -->
<tc-code-with-output
    code="const x = 1 + 2;\nconsole.log(x);"
    language="javascript"
    layout="stacked"
    id="stacked-cwo"
></tc-code-with-output>
<script>
    document.getElementById('stacked-cwo').output = '3'
</script>

<!-- Error state -->
<tc-code-with-output
    code="undefinedFn();"
    language="javascript"
    id="error-cwo"
></tc-code-with-output>
<script>
    document.getElementById('error-cwo').error = 'ReferenceError: undefinedFn is not defined'
</script>

<!-- Slotted content -->
<tc-code-with-output code="Math.PI" language="javascript">
    <span slot="title">Slotted title</span>
    <span slot="output">3.141592653589793</span>
</tc-code-with-output>
```

---

### tc-community-links

Grid of community platform links (GitHub, Discord, X, YouTube, etc.) with icons, labels, optional descriptions, and optional counts. Purely presentational — no callbacks or events.

**Tag:** `tc-community-links`

**Attributes**

| Attribute | Type | Default | Description |
|-----------|------|---------|-------------|
| `title` | string | — | Optional plain-text heading rendered above the grid. Use `slot="title"` for rich content. When both are absent, no header is rendered. |

**JS Properties**

| Property | Type | Description |
|----------|------|-------------|
| `title` | `string` | Reflects the `title` attribute. |
| `links` | `CommunityLink[]` | Array of link entries to render. Set via JS property. Default: `[]`. Re-renders on assignment. |

`CommunityLink` shape:
```ts
interface CommunityLink {
    label: string           // visible name; used in aria-label
    href: string            // anchor href
    icon?: string           // platform key (e.g. "github", "discord", "twitter") or PascalCase lucide icon name
    count?: number | string // optional metric (stars, members, etc.) shown as mono micro-label
    description?: string    // optional secondary line below the label
}
```

Common `icon` values: `github`, `discord`, `twitter`, `x`, `linkedin`, `youtube`, `mastodon`, `instagram`, `rss`, `slack`, `twitch`, `facebook`, `reddit`, `forum`, `chat`, `community`, `docs`, `blog`, `website`, `link`. Unknown keys fall back to a generic link icon.

**Events**

None. `tc-community-links` is purely presentational.

**Slots**

| Slot | Description |
|------|-------------|
| `title` | Rich heading content rendered above the grid. Used when the `title` attribute is absent. |

**Accessibility**

Each card is a real `<a>` with an `aria-label` that includes both the label and the count (if present). The icon SVG is `aria-hidden`. Focus ring is always visible (cyan, `--tc-app-accent`). `prefers-reduced-motion` suppresses the 1 px lift on hover.

**CSS custom properties (theming)**

| Property | Default | Description |
|----------|---------|-------------|
| `--bs-community-links-bg` | `var(--tc-surface)` | Card background color. |
| `--bs-community-links-border` | `var(--tc-border)` | Hairline color used as the 1px gap between cards. |
| `--bs-community-links-gap` | `1px` | Gap between cards (also acts as the hairline separator). |
| `--bs-community-links-color` | `var(--tc-text)` | Label and body text color. |
| `--bs-community-links-muted` | `var(--tc-text-muted)` | Description and count text color. |
| `--bs-community-links-icon-size` | `1.375rem` | Platform icon size. |
| `--bs-community-links-icon-color` | `var(--tc-text-muted)` | Platform icon color. |
| `--bs-community-links-hover-bg` | `var(--tc-surface-muted)` | Card background on hover. |
| `--bs-community-links-hover-shadow` | `0 1px 4px rgba(0,0,0,0.07)` | Shadow on hover. |
| `--bs-community-links-hover-translate` | `-1px` | Vertical lift on hover (`translateY`). |
| `--bs-community-links-title-color` | `var(--tc-text)` | Heading text color. |
| `--bs-community-links-count-color` | `var(--tc-text-muted)` | Count micro-label color. |
| `--bs-community-links-count-size` | `0.6875rem` | Count micro-label font size. |
| `--bs-community-links-count-spacing` | `0.08em` | Count micro-label letter-spacing. |
| `--bs-community-links-card-padding-y` | `0.875rem` | Card vertical padding. |
| `--bs-community-links-card-padding-x` | `1rem` | Card horizontal padding. |
| `--bs-community-links-columns` | `2` | Grid column count (overridden to 3 at ≥768px, 4 at ≥992px). |

```html
<!-- Minimal: links via JS property -->
<tc-community-links id="cl" title="Community"></tc-community-links>
<script>
    document.getElementById('cl').links = [
        { label: 'GitHub', href: 'https://github.com/org/repo', icon: 'github', count: '12.4k' },
        { label: 'Discord', href: 'https://discord.gg/invite', icon: 'discord', count: '8.2k' },
        { label: 'Twitter', href: 'https://twitter.com/org', icon: 'twitter', count: '5.1k' },
    ]
</script>

<!-- With descriptions -->
<tc-community-links id="cl2" title="Community & resources"></tc-community-links>
<script>
    document.getElementById('cl2').links = [
        { label: 'GitHub', href: '#', icon: 'github', count: '12.4k', description: 'Source & issues' },
        { label: 'Discord', href: '#', icon: 'discord', count: '8.2k', description: 'Live support' },
    ]
</script>

<!-- Slotted heading -->
<tc-community-links id="cl3">
    <span slot="title"><strong>Our channels</strong></span>
</tc-community-links>
```

---

### tc-config-preview

**Tag:** `tc-config-preview`

JSON-like configuration preview with syntax-highlighted key-value pairs rendered on a dark code surface. Purely presentational — no callbacks or events.

**Attributes**

| Attribute | Type | Default | Description |
|-----------|------|---------|-------------|
| `live-label` | string | — | Text for the "live" status badge shown in the header strip. When absent and no `slot="live-label"` children are provided, the header strip is hidden. |

**JS Properties**

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `liveLabel` | `string \| null` | `null` | Reflects the `live-label` attribute. |
| `entries` | `ConfigPreviewEntry[]` | `[]` | Array of key-value entries to render as syntax-highlighted lines. Each entry: `{ key: string; value: string \| number \| boolean \| null; comment?: string }`. Setting this property triggers a re-render. |

**Events**

None. `tc-config-preview` is purely presentational.

**Slots**

| Slot | Description |
|------|-------------|
| _(default)_ | Custom body content. When present, it is rendered inside the preview body alongside (or instead of) the auto-generated `entries` lines. Preserved across re-renders. |
| `live-label` | Rich content for the live badge label. Used when the `live-label` attribute is absent. A named-slot child with `slot="live-label"` goes into the badge label area and causes the header strip to appear. |

**Accessibility**

`<pre>` content is readable text. The live-badge label text (from attribute or slot) provides the accessible label for the badge; the decorative dot is `aria-hidden="true"`. Focus is never suppressed. `prefers-reduced-motion` freezes the live-dot pulse animation while retaining the static dot color.

**CSS custom properties (theming)**

| Property | Default | Description |
|----------|---------|-------------|
| `--bs-config-preview-bg` | `var(--tc-ink)` | Panel background (dark code surface). |
| `--bs-config-preview-border` | `1px solid var(--tc-border)` | Outer 1px hairline frame. |
| `--bs-config-preview-font-size` | `0.85rem` | Mono body font size. |
| `--bs-config-preview-line-height` | `1.6` | Body line height. |
| `--bs-config-preview-padding-y` | `0.875rem` | Vertical padding of the code body. |
| `--bs-config-preview-padding-x` | `1rem` | Horizontal padding of the code body. |
| `--bs-config-preview-header-bg` | `var(--tc-ink-2)` | Header strip background (slightly lighter ink). |
| `--bs-config-preview-header-border` | `1px solid var(--tc-border)` | Header bottom hairline. |
| `--bs-config-preview-header-padding` | `0.375rem 0.75rem` | Header strip padding. |
| `--bs-config-preview-text-color` | `var(--tc-text-inverse)` | Default code text color. |
| `--bs-config-preview-key-color` | `oklch(0.75 0.06 220)` | Syntax token color for keys (muted slate-blue). |
| `--bs-config-preview-string-color` | `oklch(0.78 0.1 150)` | Syntax token color for string values (muted green). |
| `--bs-config-preview-number-color` | `oklch(0.80 0.1 75)` | Syntax token color for number values (muted amber). |
| `--bs-config-preview-boolean-color` | `oklch(0.75 0.1 300)` | Syntax token color for boolean values (muted purple). |
| `--bs-config-preview-null-color` | `oklch(0.68 0.08 30)` | Syntax token color for null values (muted red-orange). |
| `--bs-config-preview-comment-color` | `oklch(0.55 0.01 250)` | Syntax token color for inline comments (muted slate gray). |
| `--bs-config-preview-live-badge-bg` | `var(--tc-accent-soft)` | Live badge pill background. |
| `--bs-config-preview-live-badge-color` | `var(--tc-accent-fg)` | Live badge text color. |
| `--bs-config-preview-live-badge-border` | `1px solid var(--tc-accent)` | Live badge pill border. |
| `--bs-config-preview-live-dot-color` | `var(--tc-accent)` | Live status dot color (cyan). |
| `--bs-config-preview-live-dot-size` | `6px` | Live status dot diameter. |

```html
<!-- Basic entries (string, number, boolean, null) -->
<tc-config-preview id="cp1"></tc-config-preview>
<script>
    document.getElementById('cp1').entries = [
        { key: 'host', value: 'db.internal', comment: 'primary host' },
        { key: 'port', value: 5432 },
        { key: 'ssl', value: true },
        { key: 'timeout', value: null },
    ]
</script>

<!-- With live-label attribute -->
<tc-config-preview id="cp2" live-label="Live"></tc-config-preview>
<script>
    document.getElementById('cp2').entries = [
        { key: 'region', value: 'us-east-1' },
        { key: 'workers', value: 4 },
    ]
</script>

<!-- live-label via slot -->
<tc-config-preview id="cp3">
    <span slot="live-label">Connected</span>
</tc-config-preview>
<script>
    document.getElementById('cp3').entries = [
        { key: 'status', value: 'healthy' },
    ]
</script>

<!-- Children-based body (custom content, no entries) -->
<tc-config-preview live-label="Custom">
    <span style="font-family: var(--tc-font-mono); color: var(--tc-text-inverse)">
        region: us-east-1
    </span>
</tc-config-preview>
```

---

### tc-contributor-wall

Grid of contributor avatar tiles with optional overflow counter and profile links. Avatars are sanctioned circles; initials tiles shown when no `avatarUrl` is provided. Purely presentational — no callbacks or events.

**Tag:** `tc-contributor-wall`

**Attributes**

| Attribute | Type | Default | Description |
|-----------|------|---------|-------------|
| `max-visible` | number | — | Maximum number of avatars to display. When contributors exceed this limit, a `+N` overflow chip is shown after the last visible avatar. |
| `title` | string | — | Optional plain-text heading rendered above the grid. Use `slot="title"` for rich content. When both are absent, no header is rendered. |

**JS Properties**

| Property | Type | Description |
|----------|------|-------------|
| `contributors` | `Contributor[]` | Array of contributor entries to render. Set via JS property. Default: `[]`. Re-renders on assignment. |
| `maxVisible` | `number \| null` | Reflects the `max-visible` attribute. `null` when absent. |
| `title` | `string` | Reflects the `title` attribute. |

`Contributor` shape:
```ts
interface Contributor {
    name: string              // display name; used for initials and aria-label
    avatarUrl?: string        // avatar image URL; initials tile shown when absent
    profileUrl?: string       // when set, avatar is rendered as an <a> linking to the profile
    contributions?: number    // optional count included in the accessible label
}
```

**Events**

None. `tc-contributor-wall` is purely presentational.

**Slots**

| Slot | Description |
|------|-------------|
| `title` | Rich heading content rendered above the grid. Used when the `title` attribute is absent. |

**Accessibility**

Linked avatars are real `<a>` elements with an `aria-label` that includes the contributor name and, when present, the contribution count (e.g. "Alice Martin — 142 contributions"). Non-linked avatars use `role="img"` with the same `aria-label`. The overflow chip carries `aria-label="N more contributors"`. Images use `alt=""` (decorative) since the accessible name is on the ancestor element. Focus ring is always visible. `prefers-reduced-motion` suppresses the 1 px hover lift while keeping the ring transition.

**CSS Custom Properties**

| Property | Default | Description |
|----------|---------|-------------|
| `--bs-contributor-wall-avatar-size` | `2.5rem` | Width and height of each avatar circle. |
| `--bs-contributor-wall-avatar-bg` | `var(--tc-surface-muted)` | Background for initials tiles. |
| `--bs-contributor-wall-avatar-color` | `var(--tc-text)` | Initials text color. |
| `--bs-contributor-wall-avatar-ring-color` | `var(--tc-surface)` | Color of the outer ring around each avatar (white by default — use to create an overlapping-avatar effect with negative gap). |
| `--bs-contributor-wall-avatar-ring-size` | `2px` | Thickness of the ring around each avatar. |
| `--bs-contributor-wall-hover-translate` | `-1px` | Vertical lift on hover (`translateY`). |
| `--bs-contributor-wall-hover-ring-color` | `var(--tc-app-accent)` | Ring color on hover/focus. |
| `--bs-contributor-wall-more-bg` | `var(--tc-surface-muted)` | Overflow chip background. |
| `--bs-contributor-wall-more-color` | `var(--tc-text-muted)` | Overflow chip text color. |
| `--bs-contributor-wall-title-color` | `var(--tc-text)` | Heading text color. |
| `--bs-contributor-wall-initials-font-size` | `0.8125rem` | Font size for initials and overflow chip text. |
| `--bs-contributor-wall-gap` | `0.375rem` | Gap between avatar tiles. |

```html
<!-- Basic — all avatars with profile links -->
<tc-contributor-wall id="cw1" title="Top Contributors"></tc-contributor-wall>
<script>
    document.getElementById('cw1').contributors = [
        { name: 'Alice Martin', avatarUrl: 'https://example.com/alice.jpg', profileUrl: 'https://github.com/alice', contributions: 142 },
        { name: 'Bob Chen', profileUrl: 'https://github.com/bob', contributions: 98 },
        { name: 'Chloe Dupont', avatarUrl: 'https://example.com/chloe.jpg', profileUrl: 'https://github.com/chloe', contributions: 74 },
    ]
</script>

<!-- With overflow chip (max-visible=5) -->
<tc-contributor-wall id="cw2" title="Contributors" max-visible="5"></tc-contributor-wall>
<script>
    document.getElementById('cw2').contributors = [
        { name: 'Alice Martin', avatarUrl: 'https://example.com/alice.jpg', profileUrl: '#', contributions: 142 },
        { name: 'Bob Chen', profileUrl: '#', contributions: 98 },
        { name: 'Chloe Dupont', avatarUrl: 'https://example.com/chloe.jpg', profileUrl: '#', contributions: 74 },
        { name: 'David Osei', profileUrl: '#', contributions: 61 },
        { name: 'Eva Rossi', profileUrl: '#', contributions: 43 },
        { name: 'Frank Müller', profileUrl: '#', contributions: 38 },
        { name: 'Grace Kim', profileUrl: '#', contributions: 29 },
    ]
</script>

<!-- Rich title via slot -->
<tc-contributor-wall id="cw3">
    <span slot="title"><strong>Project team</strong></span>
</tc-contributor-wall>
```

---

### tc-cookbook-grid

Multi-column grid of code-recipe cards with title, description, code snippet, and optional tags. Linked cards animate with a 1 px lift on hover. Purely presentational — no callbacks or events.

**Tag:** `tc-cookbook-grid`

**Attributes**

| Attribute | Type | Default | Description |
|-----------|------|---------|-------------|
| `columns` | `2\|3` | `2` | Number of grid columns. Collapses to a single column on narrow viewports. |
| `title` | string | — | Optional plain-text section heading rendered above the grid. Use `slot="title"` for rich content. When both are absent, no header is rendered. |

**JS Properties**

| Property | Type | Description |
|----------|------|-------------|
| `recipes` | `Recipe[]` | Array of recipe entries to render. Set via JS property. Default: `[]`. Re-renders on assignment. |
| `columns` | `CookbookGridColumns` | Reflects the `columns` attribute. |
| `title` | `string` | Reflects the `title` attribute. |

`Recipe` shape:
```ts
interface Recipe {
    title: string          // card heading; used as aria-label on linked cards
    description?: string   // optional muted subtext beneath the title
    code: string           // code snippet to display (HTML-escaped automatically)
    language?: string      // optional language micro-label shown above the code block
    tags?: string[]        // optional tag chips shown below the code block
    href?: string          // when set, the card is rendered as an <a> with this href
}
```

**Events**

None. `tc-cookbook-grid` is purely presentational. Recipe cards link via `href`.

**Slots**

| Slot | Description |
|------|-------------|
| `title` | Rich heading content rendered above the grid. Used when the `title` attribute is absent. |

**Accessibility**

- Linked cards are real `<a>` elements with `aria-label` set to the recipe title.
- Non-linked cards use `<article>` elements.
- Code is rendered in a readable `<pre><code>` block.
- Tags are plain text spans.
- Focus ring is always visible (`outline: 2px solid var(--tc-app-accent)`).
- `prefers-reduced-motion` suppresses the 1 px hover lift while keeping the shadow transition.
- Linked cards have a minimum touch target of `2.75rem` under coarse pointers.

**CSS Custom Properties**

| Property | Default | Description |
|----------|---------|-------------|
| `--bs-cookbook-grid-gap` | `1rem` | Gap between cards. |
| `--bs-cookbook-grid-card-bg` | `var(--tc-surface)` | Card background color. |
| `--bs-cookbook-grid-card-border` | `var(--tc-border)` | Card hairline border color. |
| `--bs-cookbook-grid-card-shadow` | `var(--tc-shadow-sm)` | Card resting shadow. |
| `--bs-cookbook-grid-card-shadow-hover` | `var(--tc-shadow-hover)` | Card shadow on hover (linked cards only). |
| `--bs-cookbook-grid-card-padding` | `1.25rem` | Inner padding of each card. |
| `--bs-cookbook-grid-section-title-color` | `var(--tc-text)` | Section heading color. |
| `--bs-cookbook-grid-title-color` | `var(--tc-text)` | Recipe title text color. |
| `--bs-cookbook-grid-title-font-size` | `0.9375rem` | Recipe title font size. |
| `--bs-cookbook-grid-title-font-weight` | `600` | Recipe title font weight. |
| `--bs-cookbook-grid-desc-color` | `var(--tc-text-muted)` | Description text color. |
| `--bs-cookbook-grid-desc-font-size` | `0.8125rem` | Description font size. |
| `--bs-cookbook-grid-code-bg` | `var(--tc-ink)` | Code block dark background. |
| `--bs-cookbook-grid-code-color` | `var(--tc-text-inverse)` | Code text color. |
| `--bs-cookbook-grid-code-font-size` | `0.75rem` | Code block font size. |
| `--bs-cookbook-grid-code-padding` | `0.75rem` | Code block padding. |
| `--bs-cookbook-grid-lang-color` | `var(--tc-slate-400)` | Language micro-label color. |
| `--bs-cookbook-grid-lang-font-size` | `0.625rem` | Language micro-label font size. |
| `--bs-cookbook-grid-tag-bg` | `var(--tc-surface-muted)` | Tag chip background. |
| `--bs-cookbook-grid-tag-color` | `var(--tc-text-muted)` | Tag chip text color. |
| `--bs-cookbook-grid-tag-font-size` | `0.6875rem` | Tag chip font size. |
| `--bs-cookbook-grid-hover-translate` | `-1px` | Vertical lift on hover for linked cards. |

```html
<!-- 2-column grid with title attribute -->
<tc-cookbook-grid id="cg1" columns="2" title="JS Recipes"></tc-cookbook-grid>
<script>
    document.getElementById('cg1').recipes = [
        {
            title: 'Debounce a function',
            description: 'Delay execution until after a quiet period.',
            code: 'function debounce(fn, delay) {\n  let id\n  return (...args) => {\n    clearTimeout(id)\n    id = setTimeout(() => fn(...args), delay)\n  }\n}',
            language: 'javascript',
            tags: ['utility', 'async'],
            href: '/recipes/debounce',
        },
        {
            title: 'Deep clone an object',
            code: 'const clone = obj => JSON.parse(JSON.stringify(obj))',
            language: 'javascript',
            tags: ['utility'],
        },
    ]
</script>

<!-- 3-column grid -->
<tc-cookbook-grid id="cg2" columns="3" title="Snippets"></tc-cookbook-grid>

<!-- Rich title via slot -->
<tc-cookbook-grid id="cg3" columns="2">
    <span slot="title"><strong>Advanced Recipes</strong></span>
</tc-cookbook-grid>
```
```

---

### tc-empty-state

Centered placeholder shown when data is unavailable. Displays an optional lucide icon in a sharp slate tile, followed by slotted body content (message text, optional action button).

**Tag:** `tc-empty-state`

**Attributes**

| Attribute | Type | Default | Description |
|-----------|------|---------|-------------|
| `icon` | string | — | Lucide icon name in PascalCase (e.g. `"Inbox"`, `"FolderOpen"`). When set, renders the icon as an inline SVG inside a muted tile above the body. When omitted, no icon is shown. |

**JS Properties**

| Property | Type | Description |
|----------|------|-------------|
| `icon` | `string \| null` | Reflects the `icon` attribute. |

**Events**

None. `tc-empty-state` is purely presentational.

**Slots**

| Slot | Description |
|------|-------------|
| *(default)* | Message text, headings, and optional action buttons. Rendered inside `.tc-empty-state__body`. Preserved across re-renders when the `icon` attribute changes. |

**Accessibility**

- The icon SVG carries `aria-hidden="true"` — it is decorative; the message text is the readable content.
- Any slotted `tc-button` or `<button>` remains keyboard-reachable with a visible focus ring.
- `prefers-reduced-motion` is honoured globally via the reset; no transitions are defined by default.

**CSS Custom Properties**

| Property | Default | Description |
|----------|---------|-------------|
| `--bs-empty-state-padding-y` | `3rem` | Vertical padding of the centered container. |
| `--bs-empty-state-padding-x` | `1.5rem` | Horizontal padding of the centered container. |
| `--bs-empty-state-gap` | `1rem` | Gap between the icon tile and the body. |
| `--bs-empty-state-color` | `var(--tc-text-muted)` | Default text color for body content. |
| `--bs-empty-state-icon-size` | `1.25rem` | Width and height of the icon SVG. |
| `--bs-empty-state-icon-color` | `var(--tc-text-faint)` | Icon stroke color. |
| `--bs-empty-state-icon-bg` | `var(--tc-surface-muted)` | Background of the icon tile. |
| `--bs-empty-state-icon-padding` | `0.75rem` | Padding inside the icon tile. |

```html
<!-- Icon + message -->
<tc-empty-state icon="Inbox">No messages yet</tc-empty-state>

<!-- Icon + message + action button -->
<tc-empty-state icon="FolderOpen">
    No files found
    <tc-button variant="secondary">Upload a file</tc-button>
</tc-empty-state>

<!-- Message only, no icon -->
<tc-empty-state>Nothing to show here yet.</tc-empty-state>
```

---

### tc-entity-cell

Entity card showing a sharp initials tile, a primary name, and an optional sublabel. Tile colour can be tinted per entity for identity purposes. Supports an optional click handler that dispatches `tc-click`.

**Tag:** `tc-entity-cell`

**Attributes**

| Attribute | Type | Default | Description |
|-----------|------|---------|-------------|
| `name` | string | `""` | Primary label — the entity's display name. Also used as the accessible label on the inner container when clickable. |
| `initial` | string | `""` | Short string (1–2 characters) shown inside the initials tile. |
| `sub-label` | string | — | Optional secondary line rendered below the name in mono micro-text. When absent, the sublabel row is omitted. |
| `color` | `'slate' \| 'blue' \| 'green' \| 'red' \| 'yellow' \| 'purple' \| 'orange'` | `'slate'` | Tile tint colour. Maps to a soft background + dark emphasis text from the design palette. Unknown values fall back to `'slate'`. |
| `size` | `'sm' \| 'md' \| 'lg'` | `'md'` | Scales the initials tile and name typography. Unknown values fall back to `'md'`. |
| `clickable` | boolean | `false` | When present, renders the inner container as a `<button>` with hover/active/focus-visible states and dispatches `tc-click` on activation. |

**JS Properties**

| Property | Type | Description |
|----------|------|-------------|
| `name` | `string` | Reflects the `name` attribute. |
| `initial` | `string` | Reflects the `initial` attribute. |
| `subLabel` | `string \| null` | Reflects the `sub-label` attribute. |
| `color` | `EntityCellColor` | Reflects the `color` attribute (validated, falls back to `'slate'`). |
| `size` | `EntityCellSize` | Reflects the `size` attribute (validated, falls back to `'md'`). |
| `clickable` | `boolean` | Reflects the `clickable` boolean attribute. |
| `onClick` | `(() => void) \| null` | Optional callback fired alongside `tc-click`. Setting it makes the cell interactive even without the `clickable` attribute. |

**Events**

| Event | Detail | Description |
|-------|--------|-------------|
| `tc-click` | `{ name: string \| null }` | Fired on click (or Enter/Space via the inner `<button>`) when the cell is interactive. Bubbles and composed. |

**Slots**

None. All content is driven by attributes.

**Accessibility**

- When clickable, the inner element is a `<button type="button">` — Enter and Space activate it natively.
- `aria-label` on the button is set to the `name` attribute value.
- The initials tile carries `aria-hidden="true"` — it is decorative; the name is the readable label.
- Focus is visible via a 2px `--tc-app-accent` outline (`:focus-visible`).
- Coarse-pointer touch target is `min-height: 44px` when interactive.
- `prefers-reduced-motion` retains state transitions (background, border, color) but does not add transform animations.

**CSS Custom Properties**

| Property | Default | Description |
|----------|---------|-------------|
| `--bs-entity-cell-bg` | `var(--tc-surface)` | Cell background. |
| `--bs-entity-cell-border-color` | `var(--tc-border)` | 1px hairline border colour. |
| `--bs-entity-cell-hover-bg` | `var(--tc-surface-muted)` | Background on hover (interactive only). |
| `--bs-entity-cell-gap` | `0.625rem` | Gap between tile and text column. |
| `--bs-entity-cell-padding-y` | `0.5rem` | Vertical padding of the cell. |
| `--bs-entity-cell-padding-x` | `0.75rem` | Horizontal padding of the cell. |
| `--bs-entity-cell-name-color` | `var(--tc-text)` | Primary name text colour. |
| `--bs-entity-cell-sublabel-color` | `var(--tc-text-muted)` | Sublabel text colour. |
| `--bs-entity-cell-sublabel-font-size` | `0.75rem` | Sublabel font size. |
| `--bs-entity-cell-tile-size-sm` | `1.5rem` | Tile width and height at `sm`. |
| `--bs-entity-cell-tile-size-md` | `2rem` | Tile width and height at `md`. |
| `--bs-entity-cell-tile-size-lg` | `2.5rem` | Tile width and height at `lg`. |
| `--bs-entity-cell-name-font-size-sm` | `0.8125rem` | Name font size at `sm`. |
| `--bs-entity-cell-name-font-size-md` | `0.9375rem` | Name font size at `md`. |
| `--bs-entity-cell-name-font-size-lg` | `1.0625rem` | Name font size at `lg`. |

```html
<!-- Basic entity, default slate tile -->
<tc-entity-cell initial="AJ" name="Alice Johnson" color="slate"></tc-entity-cell>

<!-- With sublabel and blue tile -->
<tc-entity-cell initial="BK" name="Bob Karlsson" sub-label="bob@example.com" color="blue"></tc-entity-cell>

<!-- Large size, green tile -->
<tc-entity-cell initial="CA" name="Cara Andrade" color="green" size="lg"></tc-entity-cell>

<!-- Clickable — dispatches tc-click -->
<tc-entity-cell id="ec1" initial="AJ" name="Alice Johnson" color="blue" clickable></tc-entity-cell>
<script>
    document.getElementById('ec1').addEventListener('tc-click', e => {
        console.log('clicked', e.detail.name)
    })
</script>

<!-- onClick callback property -->
<tc-entity-cell id="ec2" initial="FP" name="Finn Petrov" color="purple"></tc-entity-cell>
<script>
    document.getElementById('ec2').onClick = () => console.log('entity selected')
</script>
```

### tc-feature-card

Card highlighting a product feature with optional icon chip, eyebrow micro-label, title, description text, and a visual region. Supports `default`, `wide`, and `full` size modifiers, plus an `inline` layout that places the icon beside the copy.

**Tag:** `tc-feature-card`

**Attributes**

| Attribute | Type | Default | Description |
|-----------|------|---------|-------------|
| `icon` | string | — | PascalCase Lucide icon name (e.g. `"Zap"`, `"Shield"`). Rendered as inline SVG inside the icon chip. Ignored when a `slot="icon"` child is present. |
| `eyebrow` | string | — | Short label rendered above the title in mono uppercase micro-text. Ignored when a `slot="eyebrow"` child is present. |
| `title` | string | — | Card heading text. Ignored when a `slot="title"` child is present. |
| `description` | string | — | Body description text rendered below the title. Ignored when a `slot="description"` child is present. |
| `size` | `'default' \| 'wide' \| 'full'` | `'default'` | Layout width modifier. `wide` caps at 720 px; `full` stretches to 100% of the container. Unknown values fall back to `'default'`. |
| `inline` | boolean | `false` | When present, switches to a horizontal layout — the icon chip sits beside the copy column (eyebrow + title + description). |

**JS Properties**

| Property | Type | Description |
|----------|------|-------------|
| `icon` | `string \| null` | Reflects the `icon` attribute. |
| `eyebrow` | `string \| null` | Reflects the `eyebrow` attribute. |
| `title` | `string` | Reflects the `title` attribute (overrides `HTMLElement.title`). |
| `description` | `string \| null` | Reflects the `description` attribute. |
| `size` | `FeatureCardSize` | Reflects the `size` attribute (validated; falls back to `'default'`). |
| `inline` | `boolean` | Reflects the `inline` boolean attribute. |

**Events**

None. `tc-feature-card` is purely presentational.

**Named Slots**

| Slot | Description |
|------|-------------|
| `icon` | Rich icon content (e.g. custom SVG). When present, takes priority over the `icon` attribute. Rendered inside the icon chip (`.tc-feature-card-icon`). |
| `eyebrow` | Rich eyebrow content. When present, takes priority over the `eyebrow` attribute. |
| `title` | Rich title content (e.g. `<strong>`, `<em>`). When present, takes priority over the `title` attribute. |
| `description` | Rich description content. When present, takes priority over the `description` attribute. |
| `visual` | Visual region rendered below the copy (image, diagram, chart, etc.). No attribute fallback. |

**Accessibility**

- The icon chip carries `aria-hidden="true"` — it is decorative; the title is the readable label.
- Visible focus is inherited from any focusable slotted children via the global `:focus-visible` ring.
- `prefers-reduced-motion` retains the `box-shadow` hover transition but freezes the `translateY(-1px)` lift.
- No interactive affordance is added by the component itself — for clickable cards, wrap the element or add a focusable slotted child.

**CSS Custom Properties**

| Property | Default | Description |
|----------|---------|-------------|
| `--bs-feature-card-bg` | `var(--tc-surface)` | Card background colour. |
| `--bs-feature-card-border-color` | `var(--tc-border)` | 1 px hairline border colour. |
| `--bs-feature-card-shadow` | `var(--tc-shadow-sm)` | Box shadow at rest. |
| `--bs-feature-card-shadow-hover` | `var(--tc-shadow-hover)` | Box shadow on hover. |
| `--bs-feature-card-padding-y` | `1.5rem` | Vertical padding. |
| `--bs-feature-card-padding-x` | `1.5rem` | Horizontal padding. |
| `--bs-feature-card-gap` | `1rem` | Gap between the head and visual regions. |
| `--bs-feature-card-head-gap` | `0.75rem` | Gap between icon and copy inside the head. |
| `--bs-feature-card-copy-gap` | `0.375rem` | Gap between eyebrow, title, and description. |
| `--bs-feature-card-title-color` | `var(--tc-text)` | Title text colour. |
| `--bs-feature-card-title-weight` | `600` | Title font weight. |
| `--bs-feature-card-desc-color` | `var(--tc-text-muted)` | Description text colour. |
| `--bs-feature-card-eyebrow-color` | `var(--tc-text-faint)` | Eyebrow micro-label colour. |
| `--bs-feature-card-icon-bg` | `var(--tc-surface-muted)` | Icon chip background. |
| `--bs-feature-card-icon-color` | `var(--tc-text)` | Icon glyph colour. |
| `--bs-feature-card-icon-size` | `1.125rem` | Icon SVG width/height inside the chip. |
| `--bs-feature-card-icon-tile-size` | `2.5rem` | Width and height of the icon chip square. |

```html
<!-- Icon attribute + all text attributes -->
<tc-feature-card
    icon="Zap"
    eyebrow="Performance"
    title="Lightning-fast builds"
    description="Incremental compilation cuts build times by up to 80%."
></tc-feature-card>

<!-- Wide size -->
<tc-feature-card
    size="wide"
    icon="Database"
    title="Managed distributed database"
    description="Automatic sharding and replication."
></tc-feature-card>

<!-- Full width -->
<tc-feature-card
    size="full"
    icon="BarChart2"
    title="End-to-end tracing"
    description="Distributed tracing and real-time metrics in one dashboard."
></tc-feature-card>

<!-- Inline (horizontal) layout -->
<tc-feature-card
    inline
    icon="Shield"
    eyebrow="Security"
    title="Zero-trust by default"
    description="Authenticated at the edge before reaching your services."
></tc-feature-card>

<!-- Slotted icon and visual -->
<tc-feature-card title="Custom branding" description="Your logo, your colours.">
    <svg slot="icon" aria-hidden="true" width="18" height="18" ...></svg>
    <img slot="visual" src="/feature-preview.png" alt="Feature preview" />
</tc-feature-card>
```

---

### tc-good-first-issues

Bordered list-group of GitHub good-first-issue items. Each row links to the issue URL, shows the repo slug, a row of label chips (with optional color dot), and a meta line with comment count and relative update time. Purely presentational — no open/close logic. Set items via the `issues` JS property.

**Tag:** `tc-good-first-issues`

**Attributes**

| Attribute | Type | Default | Description |
|-----------|------|---------|-------------|
| `title` | string | — | Plain-text header above the list. When omitted and no `slot="title"` children are present, the header is hidden entirely. |

**JS Properties**

| Property | Type | Description |
|----------|------|-------------|
| `title` | `string` | Reflects the `title` attribute. |
| `issues` | `GoodFirstIssue[]` | Array of issue objects to render. Setting this property triggers a re-render. |
| `onIssueClick` | `((issue: GoodFirstIssue) => void) \| null` | Optional callback fired alongside the `tc-issue-click` event when a link is activated. |

**GoodFirstIssue shape**

```ts
interface GoodFirstIssue {
    title: string
    url: string
    repo?: string
    labels?: { name: string; color?: string }[]
    comments?: number
    updatedAt?: string  // ISO 8601 date string
}
```

**Events**

| Event | Detail | Description |
|-------|--------|-------------|
| `tc-issue-click` | `{ issue: GoodFirstIssue }` | Fired (bubbles, composed) when a row title link is activated. The link still navigates normally — this event is a side-effect hook. |

**Slots**

| Slot | Description |
|------|-------------|
| `title` | Rich header content. Used when the `title` attribute is absent. Rendered inside `.tc-good-first-issues-title`. |
| `empty` | Content shown when `issues` is empty. Falls back to a default message when omitted. Rendered inside `.tc-good-first-issues-empty`. |

**CSS Custom Properties**

| Property | Default | Description |
|----------|---------|-------------|
| `--bs-good-first-issues-border` | `var(--tc-border)` | Outer frame border color. |
| `--bs-good-first-issues-bg` | `var(--tc-surface)` | Component background. |
| `--bs-good-first-issues-separator` | `var(--tc-slate-100)` | Hairline color between rows and header. |
| `--bs-good-first-issues-row-bg` | `var(--tc-surface)` | Row background at rest. |
| `--bs-good-first-issues-row-hover-bg` | `var(--tc-surface-hover)` | Row background on hover. |
| `--bs-good-first-issues-header-color` | `var(--tc-text)` | Header title text color. |
| `--bs-good-first-issues-link-color` | `var(--tc-text)` | Issue title link color at rest. |
| `--bs-good-first-issues-link-hover-color` | `var(--tc-accent)` | Issue title link color on hover (cyan accent). |
| `--bs-good-first-issues-repo-color` | `var(--tc-text-muted)` | Repo slug color. |
| `--bs-good-first-issues-meta-color` | `var(--tc-text-faint)` | Comment count + update time color. |
| `--bs-good-first-issues-chip-bg` | `var(--tc-surface-muted)` | Label chip background. |
| `--bs-good-first-issues-chip-border` | `var(--tc-border)` | Label chip border. |
| `--bs-good-first-issues-chip-color` | `var(--tc-text-muted)` | Label chip text color. |
| `--bs-good-first-issues-icon-size` | `0.8125rem` | Meta icon size (MessageSquare, Clock). |

**Examples**

```html
<!-- Basic usage -->
<tc-good-first-issues title="Open issues"></tc-good-first-issues>
<script>
document.querySelector('tc-good-first-issues').issues = [
    {
        title: 'Fix typo in README',
        url: 'https://github.com/org/repo/issues/1',
        repo: 'org/repo',
        labels: [{ name: 'good first issue', color: '#7057ff' }],
        comments: 2,
        updatedAt: '2026-06-10T12:00:00Z',
    },
]
</script>

<!-- Slotted title -->
<tc-good-first-issues>
    <span slot="title">🌱 <strong>Good first issues</strong></span>
</tc-good-first-issues>

<!-- Custom empty state -->
<tc-good-first-issues title="Contributions">
    <div slot="empty">All issues are taken — check back later.</div>
</tc-good-first-issues>

<!-- Listen for clicks -->
<tc-good-first-issues id="gfi" title="Issues"></tc-good-first-issues>
<script>
const el = document.getElementById('gfi')
el.issues = [{ title: 'My issue', url: 'https://...', repo: 'org/repo' }]
el.addEventListener('tc-issue-click', e => console.log('clicked:', e.detail.issue))
</script>
```

---

### tc-hero-stats-bar

Horizontal bar of key-value statistics with optional units and zero-state styling. Items are separated by 1px hairline dividers; each item stacks a large mono value (with optional unit suffix) above an uppercase mono micro-label. Values of `0`, `'0'`, or empty are muted via the zero-state modifier. No events emitted — purely presentational. Set stats via the JS `stats` property.

**Tag:** `tc-hero-stats-bar`

**Attributes**

| Attribute | Type | Default | Description |
|-----------|------|---------|-------------|
| `class-name` | string | — | Extra CSS class(es) merged onto the inner `.tc-hero-stats-bar` wrapper div. |

**JS Properties**

| Property | Type | Description |
|----------|------|-------------|
| `stats` | `HeroStat[]` | Array of stat objects to render. Setting this property triggers a re-render. |

**HeroStat shape**

```ts
interface HeroStat {
    label: string            // uppercase mono micro-label below the value
    value: string | number   // large mono number/text; 0/'0'/'' triggers zero-state
    unit?: string            // optional smaller mono suffix appended to the value
}
```

**Events**

None.

**Slots**

None.

**CSS Custom Properties**

| Property | Default | Description |
|----------|---------|-------------|
| `--bs-hero-stats-bar-item-padding-x` | `1.25rem` | Horizontal padding on each item. |
| `--bs-hero-stats-bar-item-padding-y` | `0.875rem` | Vertical padding on each item. |
| `--bs-hero-stats-bar-value-font-size` | `1.5rem` | Font size of the main value text. |
| `--bs-hero-stats-bar-value-font-weight` | `600` | Font weight of the main value text. |
| `--bs-hero-stats-bar-value-color` | `var(--tc-text)` | Color of the main value text. |
| `--bs-hero-stats-bar-unit-font-size` | `0.875rem` | Font size of the unit suffix. |
| `--bs-hero-stats-bar-unit-color` | `var(--tc-text-muted)` | Color of the unit suffix. |
| `--bs-hero-stats-bar-label-font-size` | `0.6875rem` | Font size of the micro-label. |
| `--bs-hero-stats-bar-label-color` | `var(--tc-text-muted)` | Color of the micro-label. |
| `--bs-hero-stats-bar-divider-color` | `var(--tc-border)` | Color of the 1px hairline dividers between items. |
| `--bs-hero-stats-bar-zero-color` | `var(--tc-text-faint)` | Value color when the stat is in the zero state. |

**Examples**

```html
<!-- Basic stats -->
<tc-hero-stats-bar id="stats"></tc-hero-stats-bar>
<script>
document.getElementById('stats').stats = [
    { label: 'Total Users', value: 12847 },
    { label: 'Active Today', value: 3201 },
    { label: 'Requests', value: '1.2M' },
    { label: 'Error Rate', value: '0.04%' },
]
</script>

<!-- With units -->
<tc-hero-stats-bar id="perf"></tc-hero-stats-bar>
<script>
document.getElementById('perf').stats = [
    { label: 'Latency (p50)', value: 42, unit: 'ms' },
    { label: 'Latency (p99)', value: 198, unit: 'ms' },
    { label: 'Uptime', value: 99.97, unit: '%' },
]
</script>

<!-- Zero-state (value 0, '0', or '' mutes the color) -->
<tc-hero-stats-bar id="zero"></tc-hero-stats-bar>
<script>
document.getElementById('zero').stats = [
    { label: 'Deployments', value: 7 },
    { label: 'Failures', value: 0 },
    { label: 'Alerts', value: '' },
]
</script>
```
