---
name: web-components
description: Use when building UI with @toolcase/web-components — framework-free HTML5 Web Components (`tc-*` custom elements) with from-scratch toolcase styling and a Bootstrap-compatible class API. Covers layout (BasicLayout, DashboardLayout, DashboardContent, DashboardSidebar, Login, Container, Row, Col, Spacer), content (ActionHeader, ActionItems, ActionRowList, Alert, AnnouncementBar, ApiReferenceTable, AssetRow, AssetRowList, Avatar, Badge, BadgeRow, Banner, Brand, Build, BriefCard, BundleBar, CdnMap, CalloutQuote, Changelog, ChartContainer, Sparkline, TrendIndicator, Leaderboard, LeaderboardTrend, CodeLabelCell, CodeSnippet, CodeWithOutput, CommunityLinks, ConfigPreview, ContributorWall, CookbookGrid, CoolButton, ActivityCard, BasicCard, Button, ButtonGroup, Card, Carousel, CloseButton, Collapse, Divider, Dropdown, DownloadStats, EcosystemMap, EmptyState, GameShowcaseCard, GithubStarsCard, GoodFirstIssues, Group, Hero, HeroStatsBar, Heading, Image, InfiniteScroll, Kbd, ListCard, ListGroup, LogoCloud, MaintainerCard, Marquee, MetricTile, MetricGrid, MigrationGuide, PageFooter, PhaseGrid, Pipeline, PinnedFeatureShowcase, PluginGrid, PricingCard, File, QueuedFile, Placeholder, Progress, PulseIndicator, ScoringRules, SectionCard, SectionFlag, Skeleton, Spinner, SprintChain, Stamp, MetricCard, StatCard, StateMachine, StatusCard, StatusDot, Stepper, Tag, TeamList, TierLadder, Timeline, UsageSummaryPanel, WelcomeGuide, CommandReference, Comparator, CompatibilityMatrix, CountdownTimer, FAQList, FeatureMatrix, Text, VisuallyHidden), navigation (Breadcrumb, CoolNav, Nav, Navbar, Pagination, Scrollspy, SocialLinks, Stepper), overlays & feedback (ContextMenu, Modal, Offcanvas, Popover, Toast, Tooltip), and forms (CardOptions, Check, CheckboxGroup, Chip, ChipGroup, ColorPicker, IconPicker, DatePicker, EarlySignupForm, EditableText, FloatingLabel, Form, HelperText, Input, InputGroup, InputGroupText, Label, MultiCardSelect, NewsletterSignup, Option, Radio, Range, Select, Switch, Textarea). Consumable from any stack — React, Vue, Svelte, or plain HTML.
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
  - [tc-dashboard-layout](#tc-dashboard-layout)
  - [tc-dashboard-content](#tc-dashboard-content)
  - [tc-dashboard-sidebar](#tc-dashboard-sidebar)
  - [tc-login](#tc-login)
  - [tc-container](#tc-container)
  - [tc-row](#tc-row)
  - [tc-col](#tc-col)
  - [tc-spacer](#tc-spacer)
- [Content](#content)
  - [tc-action-header](#tc-action-header)
  - [tc-action-items](#tc-action-items)
  - [tc-action-row-list](#tc-action-row-list)
  - [tc-alert](#tc-alert)
  - [tc-announcement-bar](#tc-announcement-bar)
  - [tc-banner](#tc-banner)
  - [tc-avatar](#tc-avatar)
  - [tc-badge](#tc-badge)
  - [tc-badge-row](#tc-badge-row)
  - [tc-brand](#tc-brand)
  - [tc-build](#tc-build)
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
  - [tc-icon-button](#tc-icon-button)
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
  - [tc-cdn-map](#tc-cdn-map)
  - [tc-changelog](#tc-changelog)
  - [tc-callout-quote](#tc-callout-quote)
  - [tc-chart-container](#tc-chart-container)
  - [tc-sparkline](#tc-sparkline)
  - [tc-trend-indicator](#tc-trend-indicator)
  - [tc-code-label-cell](#tc-code-label-cell)
  - [tc-code-snippet](#tc-code-snippet)
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
  - [tc-leaderboard](#tc-leaderboard)
  - [tc-leaderboard-trend](#tc-leaderboard-trend)
  - [tc-linked-providers-card](#tc-linked-providers-card)
  - [tc-logo-cloud](#tc-logo-cloud)
  - [tc-maintainer-card](#tc-maintainer-card)
  - [tc-marquee](#tc-marquee)
  - [tc-metric-tile](#tc-metric-tile)
  - [tc-metric-grid](#tc-metric-grid)
  - [tc-migration-guide](#tc-migration-guide)
  - [tc-quick-start](#tc-quick-start)
  - [tc-page-footer](#tc-page-footer)
  - [tc-phase-grid](#tc-phase-grid)
  - [tc-pinned-feature-showcase](#tc-pinned-feature-showcase)
  - [tc-pipeline](#tc-pipeline)
  - [tc-plugin-grid](#tc-plugin-grid)
  - [tc-pricing-card](#tc-pricing-card)
  - [tc-file](#tc-file)
  - [tc-queued-file](#tc-queued-file)
  - [tc-rank-cell](#tc-rank-cell)
  - [tc-rich-page-header](#tc-rich-page-header)
  - [tc-api-reference-table](#tc-api-reference-table)
  - [tc-scoring-rules](#tc-scoring-rules)
  - [tc-section-card](#tc-section-card)
  - [tc-simple-file](#tc-simple-file)
  - [tc-sponsor-wall](#tc-sponsor-wall)
  - [tc-sprint-chain](#tc-sprint-chain)
  - [tc-stat-card](#tc-stat-card)
  - [tc-state-machine](#tc-state-machine)
  - [tc-team-list](#tc-team-list)
  - [tc-tier-ladder](#tc-tier-ladder)
  - [tc-timeline](#tc-timeline)
  - [tc-usage-summary-panel](#tc-usage-summary-panel)
  - [tc-welcome-guide](#tc-welcome-guide)
  - [tc-command-reference](#tc-command-reference)
  - [tc-comparator](#tc-comparator)
  - [tc-compatibility-matrix](#tc-compatibility-matrix)
  - [tc-countdown-timer](#tc-countdown-timer)
  - [tc-danger-zone-actions](#tc-danger-zone-actions)
  - [tc-metric-card](#tc-metric-card)
  - [tc-slices-card](#tc-slices-card)
  - [tc-diff-viewer](#tc-diff-viewer)
  - [tc-ecosystem-map](#tc-ecosystem-map)
  - [tc-entity-profile-card](#tc-entity-profile-card)
  - [tc-faq-list](#tc-faq-list)
  - [tc-feature-matrix](#tc-feature-matrix)
  - [tc-game-showcase-card](#tc-game-showcase-card)
  - [tc-github-stars-card](#tc-github-stars-card)
  - [tc-group](#tc-group)
  - [tc-hero](#tc-hero)
  - [tc-image](#tc-image)
  - [tc-infinite-scroll](#tc-infinite-scroll)
  - [tc-install-tabs](#tc-install-tabs)
  - [tc-live-feed](#tc-live-feed)
  - [tc-text](#tc-text)
  - [tc-visually-hidden](#tc-visually-hidden)
- [Navigation](#navigation)
  - [tc-breadcrumb](#tc-breadcrumb)
  - [tc-cool-nav](#tc-cool-nav)
  - [tc-nav](#tc-nav)
  - [tc-navbar](#tc-navbar)
  - [tc-pagination](#tc-pagination)
  - [tc-scrollspy](#tc-scrollspy)
  - [tc-social-links](#tc-social-links)
  - [tc-stepper](#tc-stepper)
- [Overlays & Feedback](#overlays--feedback)
  - [tc-context-menu](#tc-context-menu)
  - [tc-drawer](#tc-drawer)
  - [tc-modal](#tc-modal)
  - [tc-offcanvas](#tc-offcanvas)
  - [tc-popover](#tc-popover)
  - [tc-toast](#tc-toast)
  - [tc-tooltip](#tc-tooltip)
- [Forms](#forms)
  - [tc-card-options](#tc-card-options)
  - [tc-check](#tc-check)
  - [tc-checkbox-group](#tc-checkbox-group)
  - [tc-chip](#tc-chip)
  - [tc-chip-group](#tc-chip-group)
  - [tc-color-picker](#tc-color-picker)
  - [tc-icon-picker](#tc-icon-picker)
  - [tc-floating-label](#tc-floating-label)
  - [tc-form](#tc-form)
  - [tc-helper-text](#tc-helper-text)
  - [tc-input](#tc-input)
  - [tc-input-group](#tc-input-group)
  - [tc-label](#tc-label)
  - [tc-radio](#tc-radio)
  - [tc-date-picker](#tc-date-picker)
  - [tc-range](#tc-range)
  - [tc-select](#tc-select)
  - [tc-switch](#tc-switch)
  - [tc-textarea](#tc-textarea)
  - [tc-early-signup-form](#tc-early-signup-form)
  - [tc-editable-text](#tc-editable-text)
  - [tc-extended-select](#tc-extended-select)
  - [tc-file-dropzone](#tc-file-dropzone)
  - [tc-file-tags](#tc-file-tags)
  - [tc-form-wizard](#tc-form-wizard)
  - [tc-multi-card-select](#tc-multi-card-select)
  - [tc-newsletter-signup](#tc-newsletter-signup)
  - [tc-number-input](#tc-number-input)

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

### tc-dashboard-layout

Full-page dashboard shell composing a glass navbar, a collapsible sidebar, and a scrollable content area. Named slots cover the brand, menu, panel, and both navbar ends; unslotted children land in the main content. The sidebar opens/closes via a toggle button, Ctrl+B (Cmd+B), or the `sidebar-open` attribute. Dispatches `tc-toggle-sidebar` on every flip.

**Tag:** `tc-dashboard-layout`

**Attributes**

| Attribute | Type | Default | Description |
|-----------|------|---------|-------------|
| `sidebar-open` | boolean | `true` | When present, the sidebar is expanded. Removed to collapse. Reflected by the `sidebarOpen` JS property. |

**JS Properties**

| Property | Type | Description |
|----------|------|-------------|
| `sidebarOpen` | `boolean` | Reflected from the `sidebar-open` boolean attribute. Set `true`/`false` to expand/collapse the sidebar programmatically. |
| `onToggleSidebar` | `((open: boolean) => void) \| null` | Optional callback invoked on every toggle alongside the `tc-toggle-sidebar` CustomEvent. Default `null`. |

**Events**

| Event | Detail | Description |
|-------|--------|-------------|
| `tc-toggle-sidebar` | `{ open: boolean }` | Fired when the user toggles the sidebar via the button or keyboard shortcut. |

**Slots**

| Slot | Description |
|------|-------------|
| *(default)* | Main content — rendered inside `<main class="tc-dashboard-layout__content">`. |
| `navbar-left` | Content injected to the right of the sidebar-toggle button in the navbar. |
| `navbar-right` | Content pushed to the far right of the navbar. |
| `brand` | Logo / wordmark at the top of the sidebar, above the menu. |
| `sidebar-menu` | Scrollable menu region (middle of the sidebar). |
| `sidebar-panel` | Pinned panel at the bottom of the sidebar (user info, version badge, etc.). |

**Accessibility**

- The navbar is a `<nav role="navigation" aria-label="Application navigation">`.
- The sidebar is an `<aside role="navigation" aria-label="Sidebar navigation">`.
- The toggle `<button>` carries `aria-expanded` (updates in-place on toggle) and `aria-controls` tied to the sidebar's `id`.
- The toggle is reachable by Tab; Enter/Space activate it natively.
- Ctrl+B (Cmd+B) toggles the sidebar from anywhere on the page; the handler is removed in `disconnectedCallback`.
- Touch targets: the toggle is `44px × 44px` under `@media (pointer: coarse)`.
- `prefers-reduced-motion` disables the sidebar slide transition.

**CSS Custom Properties**

| Property | Default | Description |
|----------|---------|-------------|
| `--bs-dashboard-layout-navbar-height` | `3rem` | Height of the top navbar bar. |
| `--bs-dashboard-layout-navbar-bg` | `rgba(255,255,255,0.85)` | Navbar background (translucent glass). |
| `--bs-dashboard-layout-navbar-border` | `var(--tc-border)` | Hairline border below the navbar. |
| `--bs-dashboard-layout-navbar-color` | `var(--tc-text)` | Text/icon color in the navbar. |
| `--bs-dashboard-layout-navbar-padding-x` | `0.5rem` | Horizontal padding on the navbar. |
| `--bs-dashboard-layout-sidebar-width` | `15rem` | Expanded width of the sidebar. |
| `--bs-dashboard-layout-sidebar-bg` | `var(--tc-surface)` | Sidebar background. |
| `--bs-dashboard-layout-sidebar-border` | `var(--tc-border)` | Hairline borders on sidebar regions. |
| `--bs-dashboard-layout-sidebar-brand-padding` | `0.75rem 1rem` | Padding around the brand slot. |
| `--bs-dashboard-layout-sidebar-panel-padding` | `0.75rem 1rem` | Padding around the panel slot. |
| `--bs-dashboard-layout-content-bg` | `var(--tc-surface-hover)` | Background of the content rail. |
| `--bs-dashboard-layout-toggle-size` | `2.25rem` | Width and height of the toggle button. |
| `--bs-dashboard-layout-toggle-hover-bg` | `var(--tc-surface-muted)` | Toggle button hover background. |
| `--bs-dashboard-layout-transition` | `var(--tc-transition-base)` | Sidebar slide transition. |

```html
<!-- Full layout -->
<tc-dashboard-layout style="height: 100vh">
  <div slot="brand">MyApp</div>
  <nav slot="sidebar-menu">
    <a href="/dashboard">Dashboard</a>
    <a href="/settings">Settings</a>
  </nav>
  <div slot="sidebar-panel">user@example.com</div>
  <span slot="navbar-left">/ Dashboard</span>
  <div slot="navbar-right"><button>New</button></div>
  <!-- default content -->
  <main style="padding:1.5rem">Page content here</main>
</tc-dashboard-layout>

<!-- Start with sidebar closed -->
<tc-dashboard-layout id="dl"></tc-dashboard-layout>
<script>
  document.getElementById('dl').sidebarOpen = false
  document.getElementById('dl').onToggleSidebar = open => console.log('sidebar open:', open)
</script>

<!-- Listen to toggle events -->
<tc-dashboard-layout id="dl2" style="height:100vh">
  <div slot="brand">App</div>
  <nav slot="sidebar-menu"><a href="/">Home</a></nav>
  <p style="padding:1rem">Content</p>
</tc-dashboard-layout>
<script>
  document.getElementById('dl2').addEventListener('tc-toggle-sidebar', e => {
    console.log('sidebar is now', e.detail.open ? 'open' : 'closed')
  })
</script>
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

### tc-dashboard-sidebar

Vertical sidebar shell for dashboard layouts. Arranges three named slot regions — brand (top), menu (scrollable middle), panel (pinned bottom) — in a fixed-width column separated from the content by a 1px hairline on its trailing edge. No shadow, no border-radius; slate neutrals carry the design.

**Tag:** `tc-dashboard-sidebar`

**Attributes**

None. `tc-dashboard-sidebar` is a purely structural layout element with no configurable attributes.

**JS Properties**

None.

**Events**

None. `tc-dashboard-sidebar` is a purely presentational layout element.

**Slots**

| Slot | Description |
|------|-------------|
| `brand` | Top branding area (logo, wordmark, app name). Rendered inside `<div class="tc-dashboard-sidebar-brand">` at the top of the sidebar with a bottom hairline. |
| `menu` | Primary scrollable navigation list. Rendered inside `<nav class="tc-dashboard-sidebar-menu">` which flex-grows to fill available space with `overflow-y: auto`. |
| `panel` | Bottom panel (e.g. user account, version, footer links). Rendered inside `<div class="tc-dashboard-sidebar-panel">` pinned at the bottom with a top hairline divider. |

**CSS Custom Properties**

| Property | Default | Description |
|----------|---------|-------------|
| `--bs-dashboard-sidebar-width` | `15rem` | Fixed width of the sidebar column. |
| `--bs-dashboard-sidebar-bg` | `var(--tc-surface-hover)` | Background of the sidebar. |
| `--bs-dashboard-sidebar-color` | `var(--tc-text)` | Default text color. |
| `--bs-dashboard-sidebar-border` | `var(--tc-border)` | Color of the trailing-edge hairline and region dividers. |
| `--bs-dashboard-sidebar-brand-padding` | `1rem` | Padding inside the brand region. |
| `--bs-dashboard-sidebar-menu-padding` | `0.5rem 0` | Padding inside the menu region. |
| `--bs-dashboard-sidebar-panel-padding` | `0.75rem 1rem` | Padding inside the panel region. |
| `--bs-dashboard-sidebar-panel-border` | `var(--tc-border)` | Color of the panel's top hairline divider. |

```html
<!-- Full three-region sidebar -->
<tc-dashboard-sidebar>
    <div slot="brand">MyApp</div>
    <nav slot="menu">
        <a href="/dashboard">Dashboard</a>
        <a href="/settings">Settings</a>
    </nav>
    <div slot="panel">user@example.com</div>
</tc-dashboard-sidebar>

<!-- Custom width -->
<tc-dashboard-sidebar style="--bs-dashboard-sidebar-width: 11rem">
    <div slot="brand">Narrow</div>
    <nav slot="menu"><a href="/">Home</a></nav>
</tc-dashboard-sidebar>
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

### tc-announcement-bar

Persistent announcement bar with optional CTA link, leading icon, and localStorage-backed dismissal. Emits `tc-dismiss` when closed.

**Tag:** `tc-announcement-bar`

**Attributes**

| Attribute | Type | Default | Description |
|-----------|------|---------|-------------|
| `variant` | `info\|success\|warning\|announce` | `info` | Color/tone variant |
| `cta-label` | string | — | CTA link text. Rendered only when `cta-href` is also set. |
| `cta-href` | string | — | CTA link URL. Rendered only when `cta-label` is also set. |
| `dismissible` | boolean | false | Show a close button. Clicking it hides the bar and fires `tc-dismiss`. |
| `persist-dismiss-key` | string | — | localStorage key. On connect, if the key is already stored as `"dismissed"`, the bar hides immediately. Clicking close writes the flag so dismissal persists across reloads. |
| `icon-name` | string | — | Kebab-case lucide icon name (e.g. `"info"`, `"bell"`). Falls back to a `slot="icon"` child when both are provided. |

**JS Properties**

| Property | Type | Description |
|----------|------|-------------|
| `onDismiss` | `(() => void) \| null` | Optional callback fired alongside the `tc-dismiss` event when the bar is dismissed. |

**Events**

| Event | Detail | Description |
|-------|--------|-------------|
| `tc-dismiss` | — | Fired (bubbles, composed) when the close button is clicked. |

**Slots**

| Slot | Description |
|------|-------------|
| *(default)* | Bar message text / HTML. |
| `icon` | Optional leading icon element. Overrides `icon-name` when present. |

```html
<!-- Minimal -->
<tc-announcement-bar variant="info">New docs are available.</tc-announcement-bar>

<!-- With icon and CTA -->
<tc-announcement-bar variant="announce" icon-name="megaphone"
  cta-label="Learn more" cta-href="/changelog">
  Toolcase v3 is now open-source.
</tc-announcement-bar>

<!-- Dismissible with persistent storage -->
<tc-announcement-bar variant="warning" dismissible persist-dismiss-key="my-app-announcement">
  Maintenance window on Sunday 02:00 UTC.
</tc-announcement-bar>
```

---

### tc-banner

Status banner with a leading icon, body content, an optional action slot, and optional localStorage-backed dismissal. Emits `tc-dismiss` when closed. Uses `role="status"` (or `role="alert"` for the error variant) for screen reader announcements.

**Tag:** `tc-banner`

**Attributes**

| Attribute | Type | Default | Description |
|-----------|------|---------|-------------|
| `variant` | `info\|warning\|success\|error` | `info` | Color/tone variant. Selects the left border color, background tint, and default icon. |
| `dismissible` | boolean | false | Show a close button. Clicking it hides the banner and fires `tc-dismiss`. |
| `storage-key` | string | — | localStorage key. On connect, if the key is already stored as `"dismissed"`, the banner hides immediately. Clicking close writes the flag so dismissal persists across reloads. |
| `icon` | string | — | Kebab-case lucide icon name (e.g. `"bell"`, `"rocket"`). Overrides the per-variant default icon (`info` → `info`, `warning` → `triangle-alert`, `success` → `circle-check`, `error` → `circle-x`). |
| `class` | string | — | Extra classes applied directly to the host element. |

**JS Properties**

| Property | Type | Description |
|----------|------|-------------|
| `onDismiss` | `(() => void) \| null` | Optional callback fired alongside the `tc-dismiss` event when the banner is dismissed. |

**Events**

| Event | Detail | Description |
|-------|--------|-------------|
| `tc-dismiss` | — | Fired (bubbles, composed) when the close button is clicked. |

**Slots**

| Slot | Description |
|------|-------------|
| *(default)* | Banner body text / HTML. Rendered inside `.tc-banner-content`. |
| `action` | Optional action element (button, link). Rendered inside `.tc-banner-action` on the right side of the banner. |

**CSS Custom Properties**

| Property | Default | Description |
|----------|---------|-------------|
| `--bs-banner-padding-x` | `1rem` | Horizontal padding. |
| `--bs-banner-padding-y` | `0.85rem` | Vertical padding. |
| `--bs-banner-font-size` | `0.9rem` | Banner text size. |
| `--bs-banner-gap` | `0.75rem` | Gap between icon, content, action, and close button. |
| `--bs-banner-border-width` | `4px` | Left border width. |
| `--bs-banner-border-color` | `var(--tc-info)` | Left border and icon color (set by variant). |
| `--bs-banner-bg` | gradient | 135° tinted gradient fill (set by variant). |
| `--bs-banner-color` | emphasis | Dark emphasis text color (set by variant). |
| `--bs-banner-icon-size` | `1rem` | Width/height of the leading icon SVG. |
| `--bs-banner-close-size` | `28px` | Size of the dismiss button (44px on coarse pointer devices). |

```html
<!-- Info (default) -->
<tc-banner>New documentation is available — check it out.</tc-banner>

<!-- Error variant uses role="alert" for immediate announcement -->
<tc-banner variant="error">Failed to connect to the server.</tc-banner>

<!-- Custom icon -->
<tc-banner variant="info" icon="bell">You have 3 unread notifications.</tc-banner>

<!-- With action slot -->
<tc-banner variant="info">
  A new version is available.
  <tc-button slot="action" variant="primary" size="sm">Update now</tc-button>
</tc-banner>

<!-- Dismissible with persistent storage -->
<tc-banner variant="warning" dismissible storage-key="my-app-banner">
  Maintenance window on Sunday 02:00 UTC.
</tc-banner>
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

### tc-logo-cloud

Grid of logos with an optional section title, optional grayscale filter, and optional per-logo links. Set logos via the `logos` JS property. All logos sit flush on the page surface — no boxes, no shadows, `border-radius: 0`. Grayscale variant desaturates at rest and restores full color on hover/focus-within.

**Tag:** `tc-logo-cloud`

**Attributes**

| Attribute | Type | Default | Description |
|-----------|------|---------|-------------|
| `title` | string | — | Optional section heading rendered as an `<h2>` above the logo grid. Omit to skip the heading entirely. |
| `grayscale` | boolean | false | When present, applies `filter: grayscale(1)` and reduced opacity to all logos at rest. Color and opacity are restored on hover/focus-within per logo cell. |
| `columns` | number | `5` | Number of grid columns. Parsed as an integer; falls back to `5` on invalid values. At `≤767px` the grid snaps to 3 columns; at `≤479px` to 2 columns — regardless of this attribute. |

**JS Properties**

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `logos` | `LogoCloudLogo[]` | `[]` | Array of logo objects. Setting it re-renders the grid. Must be set via JS (`el.logos = [...]`). |
| `title` | `string` | `''` | Reflects the `title` attribute. |
| `grayscale` | `boolean` | `false` | Reflects the `grayscale` boolean attribute. |
| `columns` | `number` | `5` | Reflects the `columns` attribute as a parsed integer. |

`LogoCloudLogo` shape:

```ts
interface LogoCloudLogo {
    src: string       // URL of the logo image
    alt: string       // Meaningful alt text for the logo
    href?: string     // Optional link URL; logo cell becomes an <a target="_blank">
    width?: number    // Optional pixel width applied as an inline style
}
```

**Events**

None. `tc-logo-cloud` is purely presentational.

**Slots**

None. All content is driven by attributes and the `logos` JS property.

**Accessibility**

- Every `<img>` must have a meaningful `alt` string — pass it in the `LogoCloudLogo` object.
- Linked logos render as `<a target="_blank" rel="noopener noreferrer">` with a visually-hidden `"(opens in new tab)"` notice.
- The optional `title` is a real `<h2>` heading.
- Focus ring always visible on linked cells (`outline: 2px solid var(--tc-app-accent)`).
- Touch targets ≥ 44 px under `@media (pointer: coarse)`.
- `prefers-reduced-motion` is honoured: the grayscale-to-color transition is disabled (instant shift).

**CSS Custom Properties**

| Property | Default | Description |
|----------|---------|-------------|
| `--bs-logo-cloud-columns` | `5` | CSS grid column count (overridden by the `columns` attribute via inline style). |
| `--bs-logo-cloud-gap` | `2rem` | Gap between logo cells in the grid. |
| `--bs-logo-cloud-cell-padding-x` | `1.25rem` | Horizontal padding inside each logo cell. |
| `--bs-logo-cloud-cell-padding-y` | `1rem` | Vertical padding inside each logo cell. |
| `--bs-logo-cloud-title-color` | `var(--tc-text)` | Section title text color. |
| `--bs-logo-cloud-title-font-size` | `0.8125rem` | Section title font size. |
| `--bs-logo-cloud-title-margin-bottom` | `1.25rem` | Space between the title and the logo grid. |
| `--bs-logo-cloud-grayscale-opacity` | `0.55` | Logo opacity in grayscale-at-rest state. |
| `--bs-logo-cloud-grayscale-transition` | `filter var(--tc-transition-base), opacity var(--tc-transition-base)` | Transition applied to grayscale↔color shift. Disabled under `prefers-reduced-motion`. |

```html
<!-- Basic: 5-column grid, titled -->
<tc-logo-cloud id="lc" title="Trusted by teams using"></tc-logo-cloud>
<script>
  document.getElementById('lc').logos = [
    { src: '/logos/react.svg', alt: 'React', width: 56 },
    { src: '/logos/typescript.svg', alt: 'TypeScript', width: 56 },
    { src: '/logos/nodejs.svg', alt: 'Node.js', width: 80 },
  ]
</script>

<!-- Grayscale variant with links -->
<tc-logo-cloud id="lc2" title="Built with" grayscale></tc-logo-cloud>
<script>
  document.getElementById('lc2').logos = [
    { src: '/logos/vite.svg', alt: 'Vite', href: 'https://vitejs.dev', width: 52 },
    { src: '/logos/vue.svg', alt: 'Vue', href: 'https://vuejs.org', width: 52 },
  ]
</script>

<!-- 3-column layout, no title -->
<tc-logo-cloud id="lc3" columns="3"></tc-logo-cloud>
<script>
  document.getElementById('lc3').logos = [
    { src: '/logos/react.svg', alt: 'React', width: 56 },
    { src: '/logos/typescript.svg', alt: 'TypeScript', width: 56 },
    { src: '/logos/svelte.svg', alt: 'Svelte', width: 44 },
  ]
</script>
```

---

### tc-maintainer-card

Profile card of a maintainer with a circular avatar, name heading, optional role sub-label, optional location line, optional bio paragraph, a row of social-link icon buttons, and a sponsor button. All data is driven by attributes and the `links` JS property — no slot content.

**Tag:** `tc-maintainer-card`

**Attributes**

| Attribute | Type | Default | Description |
|-----------|------|---------|-------------|
| `name` | string | `''` | The maintainer's display name. Rendered as an `<h3>` heading and used as the avatar `alt` text. |
| `avatar-url` | string | `''` | Avatar image source URL. |
| `role` | string | — | Role / title sub-label displayed beneath the name. |
| `bio` | string | — | Short bio paragraph rendered in muted prose type. |
| `sponsor-href` | string | — | When set, renders the sponsor button as an `<a href>` pointing to this URL (opens in new tab). Without it, the button is a `<button type="button">`. |
| `sponsor-label` | string | `'Sponsor'` | Text label for the sponsor button. |
| `location` | string | — | Optional location line rendered with a lucide `map-pin` icon. |

**JS Properties**

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `links` | `MaintainerLink[]` | `[]` | Array of social link objects. Setting it re-renders the link row. |
| `avatarUrl` | `string` | `''` | Reflects the `avatar-url` attribute. |
| `sponsorHref` | `string \| null` | `null` | Reflects the `sponsor-href` attribute. |
| `sponsorLabel` | `string` | `'Sponsor'` | Reflects the `sponsor-label` attribute. |
| `bio` | `string \| null` | `null` | Reflects the `bio` attribute. |
| `location` | `string \| null` | `null` | Reflects the `location` attribute. |
| `name` | `string` | `''` | Reflects the `name` attribute. |

`MaintainerLink` shape:

```ts
interface MaintainerLink {
    key: string       // unique identifier for the link
    href: string      // link destination
    label: string     // accessible label (aria-label on the <a>)
    icon?: string     // lucide icon name in kebab-case (e.g. 'github', 'twitter', 'globe')
}
```

**Events**

None. `tc-maintainer-card` is a purely presentational component.

**Slots**

None. All content is driven by attributes and JS properties.

**Accessibility**

- Name is rendered as a real `<h3>` heading.
- Avatar `<img>` has `alt` set to the maintainer's name.
- Social link `<a>` elements carry `aria-label` (the link's `label`); lucide SVGs are `aria-hidden`.
- External links use `target="_blank" rel="noopener noreferrer"`.
- Focus ring always visible (`outline: 2px solid var(--tc-app-accent)`).
- Touch targets ≥ 44 px under `@media (pointer: coarse)`.
- `prefers-reduced-motion` is honoured: hover lift transitions are removed.

**CSS Custom Properties**

| Property | Default | Description |
|----------|---------|-------------|
| `--bs-maintainer-card-avatar-size` | `5rem` | Diameter of the circular avatar. |
| `--bs-maintainer-card-name-color` | `var(--tc-text)` | Name heading color. |
| `--bs-maintainer-card-name-size` | `1.0625rem` | Name heading font size. |
| `--bs-maintainer-card-role-color` | `var(--tc-text-muted)` | Role sub-label color. |
| `--bs-maintainer-card-role-size` | `0.8125rem` | Role sub-label font size. |
| `--bs-maintainer-card-location-color` | `var(--tc-text-muted)` | Location line color (includes icon). |
| `--bs-maintainer-card-location-size` | `0.8125rem` | Location line font size. |
| `--bs-maintainer-card-bio-color` | `var(--tc-text-muted)` | Bio paragraph color. |
| `--bs-maintainer-card-bio-size` | `0.875rem` | Bio paragraph font size. |
| `--bs-maintainer-card-link-color` | `var(--tc-text-muted)` | Social link icon color at rest. |
| `--bs-maintainer-card-link-hover-bg` | `var(--tc-surface-muted)` | Social link hover well background. |
| `--bs-maintainer-card-link-hover-color` | `var(--tc-text)` | Social link icon color on hover. |
| `--bs-maintainer-card-link-icon-size` | `1.125rem` | Social link icon SVG size. |
| `--bs-maintainer-card-sponsor-bg` | `var(--tc-danger)` | Sponsor button background color. |
| `--bs-maintainer-card-sponsor-color` | `#fff` | Sponsor button text and icon color. |
| `--bs-maintainer-card-sponsor-hover-bg` | `#b91c1c` | Sponsor button background on hover. |
| `--bs-maintainer-card-shadow` | `var(--tc-shadow-sm)` | Card resting shadow (inherited from `.card`). |
| `--bs-maintainer-card-shadow-hover` | `var(--tc-shadow-hover)` | Card shadow on hover. |
| `--bs-maintainer-card-padding` | `1.5rem` | Card body padding. |

```html
<!-- Full card -->
<tc-maintainer-card
    id="mc"
    name="Alex Chen"
    avatar-url="https://example.com/avatar.jpg"
    role="Core Maintainer"
    bio="Building open-source tools that developers love."
    location="San Francisco, CA"
    sponsor-href="https://github.com/sponsors/alexchen"
    sponsor-label="Sponsor">
</tc-maintainer-card>
<script>
  document.getElementById('mc').links = [
    { key: 'github', href: 'https://github.com/alexchen', label: 'GitHub', icon: 'github' },
    { key: 'twitter', href: 'https://twitter.com/alexchen', label: 'X (Twitter)', icon: 'twitter' },
    { key: 'web', href: 'https://alexchen.dev', label: 'Website', icon: 'globe' },
  ]
</script>

<!-- Minimal (name + avatar only) -->
<tc-maintainer-card name="Taylor Kim" avatar-url="https://example.com/taylor.jpg"></tc-maintainer-card>
```

---

### tc-pipeline

Horizontal pipeline / steps visualization with numbered markers, titles, and three states: `default`, `live`, and `complete`. The live step displays a pulsing ring animation; the complete step shows a lucide check icon. Steps are set via a JS property (not an attribute). Purely presentational — no events, no slots.

**Tag:** `tc-pipeline`

**Attributes**

None. All data is passed via the `steps` JS property.

**JS Properties**

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `steps` | `PipelineStep[]` | `[]` | Array of step descriptors. Setting this property triggers a re-render. |

**`PipelineStep` shape**

```ts
interface PipelineStep {
    title: string                              // Step label (required)
    state?: 'default' | 'live' | 'complete'   // Defaults to 'default'
    description?: string                       // Reserved; not rendered currently
    label?: string                             // Alias for title; not rendered separately
}
```

**Events**

None. `tc-pipeline` is purely presentational.

**Slots**

None.

**CSS Custom Properties**

| Property | Default | Description |
|----------|---------|-------------|
| `--bs-pipeline-marker-size` | `2.25rem` | Diameter of the circular step marker. |
| `--bs-pipeline-marker-font-size` | `0.875rem` | Font size of the step number inside the marker. |
| `--bs-pipeline-marker-font-weight` | `600` | Font weight of the step number. |
| `--bs-pipeline-connector-height` | `1px` | Height of the hairline connector between steps. |
| `--bs-pipeline-connector-color` | `var(--tc-border)` | Color of the connector hairline. |
| `--bs-pipeline-marker-bg` | `transparent` | Background of default-state markers. |
| `--bs-pipeline-marker-border` | `var(--tc-border-strong)` | Border color of default-state markers. |
| `--bs-pipeline-marker-color` | `var(--tc-text-muted)` | Number color of default-state markers. |
| `--bs-pipeline-title-font-size` | `0.8125rem` | Step title font size. |
| `--bs-pipeline-title-color` | `var(--tc-text-muted)` | Step title color (default state). |
| `--bs-pipeline-title-font-weight` | `400` | Step title font weight (default state). |
| `--bs-pipeline-complete-color` | `var(--tc-success)` | Marker fill and border for complete steps. |
| `--bs-pipeline-complete-title-color` | `var(--tc-text)` | Title color for complete steps. |
| `--bs-pipeline-live-color` | `var(--tc-app-accent)` | Marker fill, border, and pulse ring for the live step. |
| `--bs-pipeline-live-title-color` | `var(--tc-text)` | Title color for the live step. |
| `--bs-pipeline-live-title-font-weight` | `600` | Title font weight for the live step. |
| `--bs-pipeline-check-icon-size` | `1rem` | Lucide check icon size inside complete markers. |
| `--bs-pipeline-pulse-duration` | `1.6s` | Duration of the live-step pulse ring animation. |

```html
<tc-pipeline id="pipeline"></tc-pipeline>
<script>
  document.getElementById('pipeline').steps = [
    { title: 'Source',   state: 'complete' },
    { title: 'Build',    state: 'complete' },
    { title: 'Test',     state: 'live' },
    { title: 'Deploy',   state: 'default' },
  ]
</script>
```

---

### tc-plugin-grid

Responsive grid of plugin cards. Each card displays a logo (image or lucide icon), plugin name, description, monospace install command with a copy affordance, and a formatted download count. Column count is controlled by the `columns` attribute; layout collapses to fewer columns on narrow viewports. Entirely data-driven via the `items` JS property — no slot children.

**Tag:** `tc-plugin-grid`

**Attributes**

| Attribute | Type | Default | Description |
|-----------|------|---------|-------------|
| `columns` | `2 \| 3 \| 4` | `3` | Number of grid columns. Invalid values fall back to `3`. Collapses to fewer columns on narrow viewports. |
| `title-text` | `string` | — | Optional section heading rendered above the grid. Chosen over the native `title` tooltip attribute to avoid conflict. |

**JS Properties**

| Property | Type | Description |
|----------|------|-------------|
| `columns` | `PluginGridColumns` | Reflects the `columns` attribute as a number. |
| `titleText` | `string` | Reflects the `title-text` attribute. |
| `items` | `PluginItem[]` | Array of plugin data objects. Setting triggers a re-render. Default `[]`. |

**`PluginItem` shape**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | `string` | yes | Plugin name — rendered as the card heading (`<h3>`). |
| `description` | `string` | no | Short plugin description. |
| `logo` | `string` | no | Image URL for the plugin logo. Takes priority over `iconName`. |
| `iconName` | `string` | no | PascalCase lucide icon name (e.g. `"Shield"`) used when `logo` is absent. Decorative — `aria-hidden`. |
| `install` | `string` | no | Install command rendered as a monospace chip. Clicking the copy button dispatches `tc-copy`. |
| `downloads` | `number` | no | Download count formatted as `12.3k` / `1.2m`. |

**Events**

| Event | Detail | Description |
|-------|--------|-------------|
| `tc-copy` | `{ install: string }` | Dispatched (bubbles, composed) when the user clicks the copy button beside an install command. |

**Slots**

None. `tc-plugin-grid` is purely data-driven via the `items` JS property.

**CSS Custom Properties**

| Property | Default | Description |
|----------|---------|-------------|
| `--bs-plugin-grid-gap` | `1rem` | Gap between cards. |
| `--bs-plugin-grid-card-bg` | `var(--tc-surface)` | Card background. |
| `--bs-plugin-grid-card-border` | `1px solid var(--tc-border)` | Card border. |
| `--bs-plugin-grid-card-shadow` | `var(--tc-shadow-sm)` | Card resting shadow. |
| `--bs-plugin-grid-card-shadow-hover` | `var(--tc-shadow-hover)` | Card hover shadow. |
| `--bs-plugin-grid-card-padding` | `1.25rem` | Inner card padding. |
| `--bs-plugin-grid-name-color` | `var(--tc-text)` | Plugin name text color. |
| `--bs-plugin-grid-desc-color` | `var(--tc-text-muted)` | Description text color. |
| `--bs-plugin-grid-install-bg` | `var(--tc-surface-muted)` | Install command chip background. |
| `--bs-plugin-grid-install-color` | `var(--tc-text)` | Install command text color. |
| `--bs-plugin-grid-downloads-color` | `var(--tc-text-faint)` | Download count text color. |
| `--bs-plugin-grid-logo-size` | `2rem` | Logo image / icon size. |

```html
<!-- 3-column grid with title and tc-copy event -->
<tc-plugin-grid id="plugins" columns="3" title-text="Community Plugins"></tc-plugin-grid>
<script>
  const grid = document.getElementById('plugins')
  grid.items = [
    {
      name: 'tc-auth',
      description: 'Pluggable authentication middleware with JWT support.',
      iconName: 'Shield',
      install: 'npm install @toolcase/tc-auth',
      downloads: 48200,
    },
    {
      name: 'tc-logger',
      description: 'Structured logging plugin with OTLP exporter.',
      iconName: 'FileText',
      install: 'npm install @toolcase/tc-logger',
      downloads: 127000,
    },
    {
      name: 'tc-cache',
      description: 'In-process LRU cache with optional Redis fallback.',
      logo: 'https://example.com/tc-cache.png',
      install: 'npm install @toolcase/tc-cache',
      downloads: 3800,
    },
  ]
  grid.addEventListener('tc-copy', e => {
    navigator.clipboard.writeText(e.detail.install)
  })
</script>

<!-- 2-column grid -->
<tc-plugin-grid id="plugins2" columns="2"></tc-plugin-grid>

<!-- 4-column grid -->
<tc-plugin-grid id="plugins4" columns="4"></tc-plugin-grid>
```

---

### tc-team-list

List of team members with gradient avatar tiles, names, emails, and optional role chips. Members are set via the JS `members` property. Initials are derived automatically from `name` when the `initials` field is absent. Image avatars are rendered when `avatarUrl` is provided. The avatar circle is the only sanctioned `border-radius`; all other shapes are sharp.

**Tag:** `tc-team-list`

**Attributes**

None. All content is driven by the `members` JS property.

**JS Properties**

| Property | Type | Description |
|----------|------|-------------|
| `members` | `TeamMember[]` | Array of member objects. Set via `el.members = [...]`. Getter/setter; triggers re-render on assignment. |

`TeamMember` shape:

```ts
interface TeamMember {
    id: string
    name: string
    email?: string
    role?: string
    initials?: string   // derived from name (first letters of up to two words) when absent
    avatarUrl?: string  // when present, renders <img> instead of initials span
    gradient?: boolean  // defaults to true; renders slate ink gradient background on initials avatar
}
```

**Events**

None. `tc-team-list` is purely presentational.

**Slots**

None. All content is driven by the `members` JS property.

**Accessibility**

- The inner `<ul>` carries `role="list"`; each member `<li>` carries `role="listitem"`.
- Initials avatars carry `aria-hidden="true"` — the member name text is the accessible label.
- Image avatars receive `alt` set to the member's `name`.
- Row hover transitions respect `prefers-reduced-motion`.

**CSS Custom Properties**

| Property | Default | Description |
|----------|---------|-------------|
| `--bs-team-list-bg` | `var(--tc-surface)` | List background. |
| `--bs-team-list-border` | `var(--tc-border)` | Outer border color. |
| `--bs-team-list-separator` | `var(--tc-slate-100)` | Inner row separator hairline. |
| `--bs-team-list-row-hover-bg` | `var(--tc-surface-hover)` | Row background on hover. |
| `--bs-team-list-name-color` | `var(--tc-text)` | Member name text color. |
| `--bs-team-list-name-weight` | `500` | Member name font weight. |
| `--bs-team-list-email-color` | `var(--tc-text-muted)` | Email address text color. |
| `--bs-team-list-role-bg` | `var(--tc-surface-muted)` | Role chip background. |
| `--bs-team-list-role-color` | `var(--tc-text-muted)` | Role chip text color. |
| `--bs-team-list-avatar-size` | `2.25rem` | Diameter of the avatar circle. |
| `--bs-team-list-avatar-font-size` | `0.75rem` | Initials font size inside the avatar. |
| `--bs-team-list-avatar-gradient` | `linear-gradient(135deg, var(--tc-app-accent), #2b3a51)` | Gradient used on initials avatars when `gradient` is true. |
| `--bs-team-list-avatar-color` | `#fff` | Initials text color on gradient avatars. |

```html
<tc-team-list id="tl1"></tc-team-list>

<script>
document.querySelector('#tl1').members = [
    { id: '1', name: 'Alice Johnson', email: 'alice@example.com', role: 'Engineering' },
    { id: '2', name: 'Bob Smith',     email: 'bob@example.com',   role: 'Design' },
    { id: '3', name: 'Carol White',   email: 'carol@example.com', role: 'Product' },
]
</script>

<!-- Explicit initials + image avatar -->
<tc-team-list id="tl2"></tc-team-list>
<script>
document.querySelector('#tl2').members = [
    { id: '1', name: 'Dave Kumar',  initials: 'DK', email: 'dave@example.com' },
    { id: '2', name: 'Eva Müller',  avatarUrl: 'https://example.com/eva.jpg', email: 'eva@example.com', role: 'Lead' },
]
</script>
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

### tc-build

Build status card showing name, date, size, duration, a status icon, an optional badge, and an action menu (kebab). The status icon and badge are the only places colour appears — the card body uses the slate neutral ladder throughout.

**Tag:** `tc-build`

**Attributes**

| Attribute | Type | Default | Description |
|-----------|------|---------|-------------|
| `name` | `string` | — | Build name / reference (e.g. `"main / production"`). |
| `date` | `string` | — | Display date string (ISO or human-readable). |
| `size` | `number` | — | Artifact size in bytes. Formatted as B / KB / MB / GB in the rendered meta row. |
| `duration` | `number` | — | Build duration in milliseconds. Formatted as ms / s / m s / h m in the meta row. |
| `status` | `'pass' \| 'fail' \| 'running' \| 'queued'` | `'queued'` | Determines the status icon and its colour. |
| `badge` | `string` | — | Optional badge label rendered below the name. |
| `badge-variant` | `'primary' \| 'secondary' \| 'success' \| 'danger' \| 'warning' \| 'info'` | `'secondary'` | Badge colour variant. |
| `loading` | boolean | `false` | Renders a shimmer skeleton instead of content. |

**JS Properties**

| Property | Type | Description |
|----------|------|-------------|
| `menuItems` | `ActionItem[]` | Array of action items for the kebab dropdown. Each item: `{ key, label, disabled?, danger?, divider? }`. Setting re-renders the menu. |
| `onClick` | `(() => void) \| null` | Optional callback fired on card click (alongside the `tc-click` event). Setting also toggles the `tc-build--clickable` hover-lift affordance. |
| `onMenuItemClick` | `((key: string) => void) \| null` | Optional callback fired when a menu item is selected (alongside `tc-menu-select`). |

**Events**

| Event | Detail | Description |
|-------|--------|-------------|
| `tc-click` | — | Dispatched when the card body is clicked or activated via keyboard. Bubbles. Does not fire for clicks inside the menu. |
| `tc-menu-select` | `{ key: string }` | Dispatched when a menu item is selected. Bubbles. |

**Slots**

None. All content is driven by attributes and JS properties.

**Accessibility**

- Status is conveyed by icon + an accessible `aria-label` on the icon wrapper, not colour alone.
- The card div gains `role="button"` and `tabindex="0"` when `onClick` is set; Enter/Space also trigger the click.
- The menu trigger is a real `<button>` with `aria-haspopup="menu"` and `aria-expanded`.
- The open menu uses `role="menu"` / `role="menuitem"` with roving focus (Arrow keys, Home, End, Enter, Space, Escape).
- Focus returns to the trigger on menu close.
- The running spinner carries its status via the icon wrapper's `aria-label` (`"Running"`).
- `prefers-reduced-motion`: the spinner animation and card-lift transition are disabled.
- Touch targets ≥ 44px (coarse pointer).

**CSS Custom Properties**

| Property | Default | Description |
|----------|---------|-------------|
| `--bs-build-bg` | `var(--tc-surface)` | Card background. |
| `--bs-build-border-color` | `var(--tc-border)` | Card border colour. |
| `--bs-build-shadow` | `var(--tc-shadow-sm)` | Resting card shadow. |
| `--bs-build-shadow-hover` | `var(--tc-shadow-hover)` | Hover shadow (clickable only). |
| `--bs-build-padding-y` | `0.875rem` | Vertical card padding. |
| `--bs-build-padding-x` | `1rem` | Horizontal card padding. |
| `--bs-build-name-color` | `var(--tc-text)` | Build name text colour. |
| `--bs-build-meta-color` | `var(--tc-text-muted)` | Meta row (date/size/duration) colour. |
| `--bs-build-status-icon-size` | `1.25rem` | Status icon diameter. |
| `--bs-build-status-icon-pass-color` | `var(--tc-success)` | Pass icon colour. |
| `--bs-build-status-icon-fail-color` | `var(--tc-danger)` | Fail icon colour. |
| `--bs-build-status-icon-running-color` | `var(--tc-info)` | Running spinner colour. |
| `--bs-build-status-icon-queued-color` | `var(--tc-text-faint)` | Queued clock colour. |

```html
<!-- Basic status card -->
<tc-build name="main / production" date="2026-06-14" size="4194304" duration="87500" status="pass"></tc-build>

<!-- With badge -->
<tc-build name="main / production" date="2026-06-14" size="4194304" duration="87500" status="pass" badge="latest" badge-variant="success"></tc-build>

<!-- Loading skeleton -->
<tc-build loading></tc-build>

<!-- Menu items via JS property -->
<tc-build id="b1" name="main" status="pass" date="2026-06-14"></tc-build>
<script>
const el = document.getElementById('b1')
el.menuItems = [
    { key: 'retry', label: 'Retry build' },
    { key: 'logs', label: 'View logs' },
    { key: 'delete', label: 'Delete', danger: true },
]
el.addEventListener('tc-menu-select', e => console.log('selected', e.detail.key))
</script>

<!-- Clickable card -->
<tc-build id="b2" name="main" status="pass" date="2026-06-14"></tc-build>
<script>
const el = document.getElementById('b2')
el.onClick = () => console.log('card clicked')
el.addEventListener('tc-click', () => console.log('tc-click event fired'))
</script>
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

### tc-stepper

Multi-step progress indicator with completion icons and optional clickable navigation. Steps are set via the JS `steps` property; states are derived from the `active-step` attribute. Steps before the active one are `complete` (success fill + check icon), the active step is `active` (ink fill + number), and the rest are `pending` (hairline border + faint number). A connector line joins adjacent steps and inherits the colour of the preceding step's state. Clickable steps are real `<button>` elements; non-clickable steps are inert `<div>`s.

**Tag:** `tc-stepper`

**Attributes**

| Attribute | Type | Default | Description |
|-----------|------|---------|-------------|
| `active-step` | string | — | Key of the currently active step. Steps before it are `complete`, the matching step is `active`, steps after are `pending`. |
| `orientation` | `'horizontal' \| 'vertical'` | `'horizontal'` | Layout direction. Horizontal arranges steps in a row; vertical stacks them. |
| `clickable` | boolean | `false` | When present, renders steps as `<button>` elements. Clicking dispatches `tc-step-click`. |

**JS Properties**

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `steps` | `StepItem[]` | `[]` | Array of step descriptors. Setting triggers a re-render. |
| `onstepclick` | `((key: string) => void) \| null` | `null` | Optional callback invoked with the clicked step key (alongside the `tc-step-click` event). Only fires when `clickable`. |

**`StepItem` shape**

```ts
interface StepItem {
    key: string           // Unique identifier
    label: string         // Step title
    description?: string  // Optional subtitle shown below the label
    optional?: boolean    // Shows an "(optional)" hint when true
}
```

**Events**

| Event | Detail | Description |
|-------|--------|-------------|
| `tc-step-click` | `{ key: string }` | Fired (bubbles, composed) when a clickable step is activated. Only fires when the `clickable` attribute is set. |

**Slots**

None. All data is supplied via the `steps` JS property.

**CSS Custom Properties**

| Property | Default | Description |
|----------|---------|-------------|
| `--bs-stepper-marker-size` | `2rem` | Diameter of the circular step marker. |
| `--bs-stepper-marker-font-size` | `0.8125rem` | Font size of the step number inside the marker. |
| `--bs-stepper-marker-font-weight` | `600` | Font weight of the step number. |
| `--bs-stepper-connector-thickness` | `1px` | Thickness of connector lines between steps. |
| `--bs-stepper-connector-color` | `var(--tc-border)` | Colour of pending connectors. |
| `--bs-stepper-connector-complete-color` | `var(--tc-success)` | Connector colour after a complete step. |
| `--bs-stepper-connector-active-color` | `var(--tc-app-accent)` | Connector colour after the active step. |
| `--bs-stepper-pending-border` | `var(--tc-border)` | Marker ring colour for pending steps. |
| `--bs-stepper-pending-color` | `var(--tc-text-faint)` | Number colour for pending steps. |
| `--bs-stepper-active-bg` | `var(--tc-app-accent)` | Marker fill for the active step. |
| `--bs-stepper-active-color` | `#fff` | Number colour for the active step. |
| `--bs-stepper-complete-bg` | `var(--tc-success)` | Marker fill for complete steps. |
| `--bs-stepper-complete-color` | `#fff` | Icon colour for complete steps. |
| `--bs-stepper-check-icon-size` | `1rem` | Size of the lucide check icon in complete markers. |
| `--bs-stepper-label-font-size` | `0.875rem` | Font size of step labels. |
| `--bs-stepper-connector-min-cross` | `1.5rem` | Minimum height of connectors in vertical mode. |

```html
<tc-stepper id="onboard" active-step="profile"></tc-stepper>
<script>
  document.getElementById('onboard').steps = [
    { key: 'account', label: 'Account',  description: 'Create your account' },
    { key: 'profile', label: 'Profile',  description: 'Set up your profile', optional: true },
    { key: 'plan',    label: 'Plan',     description: 'Choose a plan' },
    { key: 'confirm', label: 'Confirm',  description: 'Review and confirm' },
  ]
</script>

<!-- Clickable variant -->
<tc-stepper id="wizard" active-step="plan" clickable></tc-stepper>
<script>
  const el = document.getElementById('wizard')
  el.steps = [
    { key: 'account', label: 'Account' },
    { key: 'plan',    label: 'Plan' },
    { key: 'confirm', label: 'Confirm' },
  ]
  el.addEventListener('tc-step-click', e => {
    el.setAttribute('active-step', e.detail.key)
  })
</script>

<!-- Vertical orientation -->
<tc-stepper id="vertical" active-step="plan" orientation="vertical"></tc-stepper>
<script>
  document.getElementById('vertical').steps = [
    { key: 'account', label: 'Account' },
    { key: 'plan',    label: 'Plan' },
    { key: 'confirm', label: 'Confirm' },
  ]
</script>
```

---

### tc-cool-nav

Responsive navigation bar with collapsible hamburger menu, scroll-detection condensed state, brand slot, right-side slot, and a login CTA. Toolcase motif: translucent surface, 1px hairline, sharp corners, JetBrains Mono brand wordmark with the cyan accent dot, underline-only active marker.

**Tag:** `tc-cool-nav`

**Attributes**

| Attribute | Type | Default | Description |
|-----------|------|---------|-------------|
| `brand` | string | — | Text brand/logo label. Renders a mono wordmark with the cyan dot. When absent, use `slot="brand"` instead. |
| `login-label` | string | `'Log in'` | Text for the login CTA button/link. |
| `login-href` | string | — | Href for the login CTA. Renders an `<a>` when set, a `<button>` otherwise. |
| `login-variant` | string | `'primary'` | Bootstrap button variant for the login CTA (e.g. `primary`, `secondary`, `outline-primary`). |
| `scroll-offset` | number | `10` | `window.scrollY` threshold above which the `tc-cool-nav-scrolled` class is applied to the host (condensed padding + shadow). |
| `expand-breakpoint` | string | `'lg'` | Viewport breakpoint at and above which the full menu is shown and the toggler is hidden. Values: `sm`, `md`, `lg`, `xl`, `xxl`. |
| `theme` | `'light' \| 'dark'` | `'light'` | Color theme. `dark` uses the `--tc-ink` dark surface with light text. |
| `sticky` | boolean | false | When present, the nav is `position: sticky` at the top with `z-index: var(--tc-z-sticky)`. |

**JS Properties**

| Property | Type | Description |
|----------|------|-------------|
| `items` | `CoolNavItem[]` | Array of nav-link descriptors. Each: `{ label: string; href: string; active?: boolean }`. Setting re-renders the link list. |
| `brand` | `string \| null` | Reflects the `brand` attribute. |
| `loginLabel` | `string` | Reflects `login-label`. |
| `loginHref` | `string \| null` | Reflects `login-href`. |
| `loginVariant` | `string` | Reflects `login-variant`. |
| `scrollOffset` | `number` | Reflects `scroll-offset`. |
| `expandBreakpoint` | `string` | Reflects `expand-breakpoint`. |
| `theme` | `CoolNavTheme` | Reflects `theme`. |
| `sticky` | `boolean` | Reflects the `sticky` attribute. |
| `onNavToggle` | `((open: boolean) => void) \| null` | Optional callback fired alongside `tc-nav-toggle`. |
| `onLogin` | `(() => void) \| null` | Optional callback fired alongside `tc-login`. |

**Events**

| Event | Detail | Description |
|-------|--------|-------------|
| `tc-nav-toggle` | `{ open: boolean }` | Fired when the hamburger toggler opens or closes the mobile menu. |
| `tc-login` | `{}` | Fired when the login CTA is activated (click on the button variant — not the link variant). |

**Slots**

| Slot | Description |
|------|-------------|
| `brand` | Rich brand content (logo + text, custom markup). Used when the `brand` attribute is absent. Rendered inside `.tc-cool-nav-brand-slot`. |
| `right` | Extra controls placed between the nav items and the login CTA (e.g. search, icon buttons). |

**CSS Custom Properties**

| Property | Default | Description |
|----------|---------|-------------|
| `--bs-cool-nav-bg` | `var(--tc-surface)` | Nav background (light mode). |
| `--bs-cool-nav-color` | `var(--tc-text)` | Nav text color. |
| `--bs-cool-nav-border` | `var(--tc-border)` | 1px hairline bottom border + collapse border color. |
| `--bs-cool-nav-brand-color` | `var(--tc-text)` | Brand wordmark color. |
| `--bs-cool-nav-brand-dot` | `var(--tc-accent)` | Color of the 7×7px accent square in the brand. |
| `--bs-cool-nav-link-color` | `var(--tc-text-muted)` | Nav link default color. |
| `--bs-cool-nav-link-hover-color` | `var(--tc-accent-fg)` | Nav link hover color. |
| `--bs-cool-nav-link-active-color` | `var(--tc-text)` | Active nav link text color. |
| `--bs-cool-nav-link-active-line` | `var(--tc-app-accent)` | 2px underline color on the active link (large viewports). |
| `--bs-cool-nav-toggler-color` | `var(--tc-text)` | Hamburger icon color. |
| `--bs-cool-nav-collapse-bg` | `var(--tc-surface)` | Background of the mobile dropdown. |
| `--bs-cool-nav-scrolled-shadow` | `0 1px 8px 0 rgba(0,0,0,.06)` | Shadow applied when scrolled. |
| `--bs-cool-nav-py` | `0.75rem` | Vertical padding in the normal state. |
| `--bs-cool-nav-scrolled-py` | `0.5rem` | Vertical padding in the scrolled/condensed state. |

```html
<!-- Attribute brand + login CTA -->
<tc-cool-nav
  brand="myapp"
  login-label="Get started"
  login-href="/signup"
  sticky
></tc-cool-nav>
<script>
  document.querySelector('tc-cool-nav').items = [
    { label: 'Home',    href: '/',       active: true },
    { label: 'Docs',    href: '/docs' },
    { label: 'Pricing', href: '/pricing' },
  ]
</script>

<!-- Brand slot + right slot -->
<tc-cool-nav login-label="Sign in" login-href="/login">
  <span slot="brand">
    <img src="/logo.svg" alt="MyApp" height="28" />
  </span>
  <span slot="right">
    <button class="btn btn-sm btn-ghost">Changelog</button>
  </span>
</tc-cool-nav>

<!-- Dark theme -->
<tc-cool-nav brand="myapp" theme="dark" login-label="Log in" login-href="/login"></tc-cool-nav>

<!-- Listen for events -->
<script>
  const nav = document.querySelector('tc-cool-nav')
  nav.addEventListener('tc-nav-toggle', e => console.log('open:', e.detail.open))
  nav.addEventListener('tc-login', () => console.log('login clicked'))
</script>
```

---

## Overlays & Feedback

### tc-context-menu

Right-click / long-press context menu with nested submenu support and full keyboard navigation (ArrowUp/Down/Left/Right, Enter, Space, Escape). Fires `tc-select` when a leaf item is chosen.

**Tag:** `tc-context-menu`

**Attributes**

None. All state is driven by JS properties and pointer/keyboard interaction.

**JS Properties**

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `items` | `ContextMenuItem[]` | `[]` | Menu item definitions. Setting re-renders. See `ContextMenuItem` below. |
| `onSelect` | `((key: string) => void) \| null` | `null` | Callback fired alongside `tc-select` when a leaf item is chosen. |

**`ContextMenuItem` shape**

| Field | Type | Description |
|-------|------|-------------|
| `key` | `string` | Unique identifier dispatched with `tc-select`. |
| `label` | `string` | Display text. |
| `icon?` | `string` | Lucide icon name in PascalCase (e.g. `"Trash2"`). |
| `disabled?` | `boolean` | Disables the item (opacity + pointer-events). |
| `separator?` | `boolean` | Renders a 1 px hairline divider (ignores other fields). |
| `danger?` | `boolean` | Colors the item with `--tc-danger`. |
| `children?` | `ContextMenuItem[]` | Nested submenu items (opens on hover / ArrowRight). |

**Events**

| Event | Detail | Description |
|-------|--------|-------------|
| `tc-select` | `{ key: string }` | Fired when a non-disabled, non-separator leaf item is chosen. Bubbles + composed. |

**Slots**

| Slot | Description |
|------|-------------|
| *(default)* | The trigger content. Right-click (or long-press on touch) this content to open the menu. |

**Keyboard navigation**

| Key | Action |
|-----|--------|
| `ArrowDown` / `ArrowUp` | Move focus among items (wraps, skips separators/disabled). |
| `ArrowRight` | Open submenu and focus its first item. |
| `ArrowLeft` | Close submenu and return focus to parent item. |
| `Enter` / `Space` | Select leaf item (dispatch `tc-select` + close) or open submenu. |
| `Escape` | Close innermost open submenu; if at root, close the whole menu. |

**CSS Custom Properties**

| Property | Default | Description |
|----------|---------|-------------|
| `--bs-context-menu-min-width` | `180px` | Minimum menu width. |
| `--bs-context-menu-padding-y` | `0.25rem` | Vertical padding of the menu surface. |
| `--bs-context-menu-bg` | `var(--tc-surface)` | Menu background. |
| `--bs-context-menu-border` | `1px solid var(--tc-border)` | Menu border. |
| `--bs-context-menu-shadow` | `var(--tc-shadow-lg)` | Drop shadow (overlay tier). |
| `--bs-context-menu-z-index` | `var(--tc-z-dropdown)` | Stacking order. |
| `--bs-context-menu-item-padding-x` | `0.625rem` | Horizontal item padding. |
| `--bs-context-menu-item-padding-y` | `0.4375rem` | Vertical item padding. |
| `--bs-context-menu-item-font-size` | `0.8125rem` | Item label font size (13 px). |
| `--bs-context-menu-item-color` | `var(--tc-slate-700)` | Default item text color. |
| `--bs-context-menu-item-hover-bg` | `var(--tc-surface-muted)` | Item hover / open-parent background. |
| `--bs-context-menu-item-hover-color` | `var(--tc-text)` | Item hover text color. |
| `--bs-context-menu-item-disabled-opacity` | `0.45` | Disabled item opacity. |
| `--bs-context-menu-separator-color` | `var(--tc-border)` | Separator hairline color. |
| `--bs-context-menu-danger-color` | `var(--tc-danger)` | Danger item text color. |
| `--bs-context-menu-danger-hover-bg` | `var(--tc-surface-muted)` | Danger item hover background. |

```html
<!-- Basic right-click menu -->
<tc-context-menu id="cm">
  <button type="button" class="btn btn-secondary">Right-click me</button>
</tc-context-menu>
<script>
  const el = document.getElementById('cm')
  el.items = [
    { key: 'copy',   label: 'Copy',   icon: 'Copy' },
    { key: 'cut',    label: 'Cut',    icon: 'Scissors' },
    { key: 'paste',  label: 'Paste',  icon: 'Clipboard', disabled: true },
    { key: 'sep-1',  label: '',       separator: true },
    { key: 'delete', label: 'Delete', icon: 'Trash2', danger: true },
  ]
  el.addEventListener('tc-select', e => console.log('selected', e.detail.key))
</script>

<!-- With nested submenu -->
<tc-context-menu id="cm2">
  <div style="width:200px;height:120px;border:2px dashed #ccc">Right-click</div>
</tc-context-menu>
<script>
  document.getElementById('cm2').items = [
    { key: 'open', label: 'Open', icon: 'FolderOpen' },
    {
      key: 'share', label: 'Share', icon: 'Share2',
      children: [
        { key: 'share-link',  label: 'Copy link',      icon: 'Link' },
        { key: 'share-email', label: 'Send by email',  icon: 'Mail' },
      ],
    },
    { key: 'sep',    label: '', separator: true },
    { key: 'remove', label: 'Remove', icon: 'Trash2', danger: true },
  ]
</script>
```

---

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

### tc-drawer

Slide-out panel with focus trap, keyboard handling, and optional pinned mode. Controlled component — fires `tc-close` when the user requests dismissal; the consumer sets `open` to `false` to actually close.

**Tag:** `tc-drawer`

**Attributes**

| Attribute | Type | Default | Description |
|-----------|------|---------|-------------|
| `open` | boolean | false | Visible state — add/remove to show/hide |
| `side` | `left\|right\|top\|bottom` | `right` | Edge the panel slides from |
| `size` | `small\|default\|large` | `default` | Panel width (left/right) or height (top/bottom) |
| `title` | string | — | Header title text |
| `pinned` | boolean | false | No backdrop, no body scroll lock; page stays interactive |

**JS Properties**

| Property | Type | Description |
|----------|------|-------------|
| `onClose` | `(() => void) \| null` | Callback fired when close is requested (alongside `tc-close` event) |

**Events**

| Event | Detail | Description |
|-------|--------|-------------|
| `tc-close` | `{}` | Fired when the user closes via close button, Escape, or backdrop click. The host does **not** self-close — set `open=false` in this handler. |

**Slots:** default (panel body content)

```html
<button onclick="document.querySelector('#my-drawer').setAttribute('open','')">Open</button>
<tc-drawer id="my-drawer" title="Settings" side="right">
    <p>Drawer body content here.</p>
</tc-drawer>
<script>
    document.querySelector('#my-drawer').addEventListener('tc-close', () => {
        document.querySelector('#my-drawer').removeAttribute('open')
    })
</script>
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

### tc-card-options

Grid of selectable card options (radiogroup). Options are set via the `options` JS property. Fires `tc-change` when the selection changes. Fully keyboard-accessible: Arrow keys move selection, Enter/Space confirms.

**Tag:** `tc-card-options`

**Attributes**

| Attribute | Type | Default | Description |
|-----------|------|---------|-------------|
| `value` | string | — | Key of the selected option |
| `columns` | number | `3` | Number of grid columns |
| `aria-label` | string | `"Options"` | Accessible label for the radiogroup |

**JS Properties**

| Property | Type | Description |
|----------|------|-------------|
| `options` | `CardOption[]` | Array of option objects (set via JS, not attribute) |
| `onChange` | `((key: string) => void) \| null` | Optional callback fired alongside `tc-change` |

Each `CardOption`:

| Field | Type | Description |
|-------|------|-------------|
| `key` | string | Unique identifier; becomes the selected value |
| `label` | string | Visible card title |
| `description` | string? | Optional sub-label below the title |
| `icon` | string? | Lucide icon name, PascalCase or kebab-case (e.g. `"Shield"`, `"shield-check"`) |
| `image` | string? | Image `src` URL; used when `icon` is absent |

**Events:** `tc-change` with `{ detail: { key: string } }`

**Slots:** none — the option grid is generated from the `options` property.

```html
<tc-card-options id="plan-picker" value="starter" columns="3" aria-label="Choose a plan"></tc-card-options>
<script>
const el = document.getElementById('plan-picker')
el.options = [
    { key: 'starter', label: 'Starter', icon: 'Zap', description: 'Up to 3 projects' },
    { key: 'pro',     label: 'Pro',     icon: 'Star', description: 'Unlimited projects' },
    { key: 'enterprise', label: 'Enterprise', icon: 'Shield', description: 'Custom limits' },
]
el.addEventListener('tc-change', e => console.log('selected:', e.detail.key))
</script>
```

---

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

### tc-checkbox-group

Coordinated group of checkboxes with an optional group label, inline layout, disabled per-option support, and required validation. Options are set via the `options` JS property. Fires `tc-change` when the selection changes. Works controlled (consumer sets `value`) or uncontrolled (internal state).

**Tag:** `tc-checkbox-group`

**Attributes**

| Attribute | Type | Default | Description |
|-----------|------|---------|-------------|
| `label` | string | — | Group legend text |
| `inline` | boolean | false | Lay checkboxes out horizontally |
| `name` | string | — | `name` applied to every inner checkbox input (for form grouping) |
| `id` | string | — | Standard HTML `id` on the host element |
| `required` | boolean | false | Group is invalid until at least one option is checked; sets `aria-required` and `aria-invalid` on the fieldset |

**JS Properties**

| Property | Type | Description |
|----------|------|-------------|
| `options` | `CheckboxGroupOption[]` | Array of option objects (set via JS, not attribute) |
| `value` | `string[]` | Currently checked values; setting updates the checkboxes and re-renders |
| `onChange` | `((checkedValues: string[]) => void) \| null` | Optional callback fired alongside `tc-change` |

Each `CheckboxGroupOption`:

| Field | Type | Description |
|-------|------|-------------|
| `value` | string | Option value, submitted with the form |
| `label` | string | Visible label text |
| `disabled` | boolean? | When true, the option is non-interactive |

**Events:** `tc-change` with `{ detail: { value: string[] } }` — the new set of checked values

**Slots:** none — the option list is generated from the `options` property.

```html
<tc-checkbox-group id="lang-picker" label="Preferred languages" name="languages"></tc-checkbox-group>
<script>
const el = document.getElementById('lang-picker')
el.options = [
    { value: 'js',  label: 'JavaScript' },
    { value: 'ts',  label: 'TypeScript' },
    { value: 'go',  label: 'Go', disabled: true },
]
el.value = ['js'] // pre-select
el.addEventListener('tc-change', e => console.log('selected:', e.detail.value))
</script>
```

---

### tc-chip

Compact interactive chip/tag with optional leading icon, trailing count badge, and remove button. Built as a real `<button>` so it participates in keyboard navigation. Dispatches `tc-click` when the chip body is activated and `tc-remove` when the remove button is clicked. Selection state is consumer-controlled (reflected back via the `selected` attribute after handling `tc-click`). Sharp corners (`border-radius: 0`).

**Tag:** `tc-chip`

**Attributes**

| Attribute | Type | Default | Description |
|-----------|------|---------|-------------|
| `variant` | `primary\|secondary\|info\|success\|warning\|danger` | `secondary` | Color variant. `secondary` stays fully neutral (slate). Colored variants use a soft tint background + dark emphasis text + variant hairline. |
| `selected` | boolean | false | Marks the chip as selected/active (ink fill, white text). Also exposed as `aria-pressed` on the inner button. |
| `icon` | string | — | Lucide icon name (PascalCase or kebab-case, e.g. `"Tag"`, `"arrow-up"`). When set, renders a leading inline SVG icon inside `.tc-chip-icon`. |
| `count` | string \| number | — | Count badge text rendered after the label inside `.tc-chip-count`. |
| `removable` | boolean | false | When set, renders a trailing remove (×) button. The remove affordance also appears when the `onRemove` JS property is assigned. |
| `disabled` | boolean | false | Disables the chip body button and remove button, reduces opacity, and sets `pointer-events: none` on the host. |

**JS Properties**

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `selected` | `boolean` | `false` | Reflects the `selected` attribute. |
| `variant` | `ChipVariant` | `'secondary'` | Reflects the `variant` attribute. |
| `count` | `string \| number \| null` | `null` | Reflects the `count` attribute. Setter accepts number or string. |
| `removable` | `boolean` | `false` | Reflects the `removable` attribute. |
| `disabled` | `boolean` | `false` | Reflects the `disabled` attribute. |
| `onRemove` | `(() => void) \| null` | `null` | Optional callback invoked alongside `tc-remove`. Setting this property also shows the remove button (same as the `removable` attribute). |

**Events**

| Event | Detail | Description |
|-------|--------|-------------|
| `tc-click` | — | Fired (bubbles, composed) when the chip body button is clicked. The chip does **not** toggle `selected` automatically — reflect it back via `setAttribute('selected', '')` to confirm. |
| `tc-remove` | — | Fired (bubbles, composed) when the remove button is clicked. The element is **not** removed automatically. |

**Slots**

| Slot | Description |
|------|-------------|
| *(default)* | Chip label text or markup. Preserved across re-renders inside `.tc-chip-content`. |

**Accessibility**

- The chip body is a real `<button type="button">` with its label as the accessible name.
- `selected` state is exposed via `aria-pressed="true"/"false"` on the chip button.
- The remove button carries `aria-label="Remove"`.
- All icons are `aria-hidden="true"`.
- `disabled` applies the HTML `disabled` attribute to both buttons and blocks pointer events.
- Focus outlines use `2px solid var(--tc-app-accent)`.
- Reduced-motion: transitions removed.
- 44 px minimum coarse-pointer touch target on chip body and remove button.

**CSS Custom Properties**

| Property | Default | Description |
|----------|---------|-------------|
| `--bs-chip-bg` | `var(--tc-surface)` | Default chip background |
| `--bs-chip-bg-hover` | `var(--tc-surface-muted)` | Hover background |
| `--bs-chip-color` | `var(--tc-text)` | Default text and icon color |
| `--bs-chip-border-color` | `var(--tc-border)` | Chip and remove button border |
| `--bs-chip-border-width` | `1px` | Border width |
| `--bs-chip-padding-x` | `0.625rem` | Horizontal padding |
| `--bs-chip-padding-y` | `0.3125rem` | Vertical padding |
| `--bs-chip-font-size` | `0.8125rem` | Label font size (13 px) |
| `--bs-chip-font-weight` | `500` | Label font weight |
| `--bs-chip-gap` | `0.3125rem` | Gap between icon, label, and count |
| `--bs-chip-icon-size` | `0.875rem` | Leading icon SVG size |
| `--bs-chip-count-bg` | `var(--tc-surface-muted)` | Count badge background |
| `--bs-chip-count-color` | `var(--tc-text-muted)` | Count badge text color |
| `--bs-chip-count-font-size` | `0.6875rem` | Count badge font size |
| `--bs-chip-selected-bg` | `var(--tc-app-accent)` | Selected/active chip fill |
| `--bs-chip-selected-color` | `var(--tc-app-accent-contrast)` | Selected/active chip text |
| `--bs-chip-remove-icon-size` | `0.875rem` | Remove button icon SVG size |

```html
<!-- Static variants -->
<tc-chip>Secondary (default)</tc-chip>
<tc-chip variant="primary">Primary</tc-chip>
<tc-chip variant="success">Success</tc-chip>
<tc-chip variant="danger">Danger</tc-chip>
<tc-chip variant="warning">Warning</tc-chip>
<tc-chip variant="info">Info</tc-chip>

<!-- Selected state -->
<tc-chip selected>Active chip</tc-chip>

<!-- With leading icon -->
<tc-chip icon="Tag">Label</tc-chip>
<tc-chip icon="Shield" variant="success">Verified</tc-chip>

<!-- With count badge -->
<tc-chip count="12">Messages</tc-chip>
<tc-chip icon="Bell" count="3" variant="info">Notifications</tc-chip>

<!-- Removable — handle tc-remove to hide/delete -->
<tc-chip removable id="my-chip">Deploy</tc-chip>
<script>
    document.getElementById('my-chip').addEventListener('tc-remove', e => {
        e.target.hidden = true
    })
</script>

<!-- Consumer-controlled selection via tc-click -->
<tc-chip id="toggle-chip">Toggle me</tc-chip>
<script>
    const chip = document.getElementById('toggle-chip')
    chip.addEventListener('tc-click', () => {
        chip.selected = !chip.selected
    })
</script>

<!-- onRemove callback property -->
<tc-chip removable id="chip2">Beta</tc-chip>
<script>
    const el = document.getElementById('chip2')
    el.onRemove = () => el.remove()
</script>

<!-- Disabled -->
<tc-chip disabled>Disabled</tc-chip>
<tc-chip disabled removable>Disabled removable</tc-chip>
```

---

### tc-chip-group

Grouped set of interactive chip buttons with an optional title, subtitle, and hairline border frame. Composes `tc-chip` internally — one chip per item in the `items` JS property. Selection is managed internally (uncontrolled): clicking a chip toggles its `selected` state and dispatches `tc-toggle` with the item id. Sharp corners, slate neutrals, no extra status colour at the group level.

**Tag:** `tc-chip-group`

**Attributes**

| Attribute | Type | Default | Description |
|-----------|------|---------|-------------|
| `title` | string | — | Group title text rendered in `.tc-chip-group-title`. Also settable as a JS property accepting an HTML string or DOM Node. |
| `subtitle` | string | — | Subtitle text rendered below the title in `.tc-chip-group-subtitle`. Also settable as a JS property accepting an HTML string or DOM Node. |
| `border` | boolean | false | When present, draws a 1 px `--tc-border` hairline frame with sharp corners (`border-radius: 0`) and slate padding around the group. |

**JS Properties**

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `items` | `ChipGroupItem[]` | `[]` | Array of chip descriptors. Setting this property re-renders all chips. Each item: `{ id: string, label: string, selected?: boolean, icon?: string, count?: number\|string, disabled?: boolean, variant?: string }`. |
| `title` | `string \| Node` | `''` | Group title. Pass a string to set text content; pass a DOM Node to append it directly into `.tc-chip-group-title`. Mirrors the `title` attribute for string values. |
| `subtitle` | `string \| Node` | `''` | Group subtitle. Same Node-or-string contract as `title`. Mirrors the `subtitle` attribute. |
| `onToggle` | `((id: string) => void) \| null` | `null` | Optional callback invoked alongside `tc-toggle` when a chip is toggled. |

**Events**

| Event | Detail | Description |
|-------|--------|-------------|
| `tc-toggle` | `{ id: string }` | Fired (bubbles, composed) when a non-disabled chip is activated. The group has already updated the matching item's `selected` state before the event fires. |

**Accessibility**

- The outer `.tc-chip-group` `<div>` carries `role="group"` with `aria-labelledby` pointing to the title span when a title is present.
- Each chip is a real `<button>` (via `tc-chip`) with `aria-pressed` reflecting its `selected` state.
- Disabled items have `opacity: 0.5` and `pointer-events: none` (from `tc-chip`).
- Focus moves through chips via Tab; focus rings use `2px solid var(--tc-app-accent)`.
- 44 px minimum coarse-pointer touch targets are inherited from `tc-chip`.
- Reduced-motion: chip transitions are suppressed by `_chip.scss`.

**CSS Custom Properties**

| Property | Default | Description |
|----------|---------|-------------|
| `--bs-chip-group-gap` | `0.5rem` | Vertical gap between header and chip row |
| `--bs-chip-group-item-gap` | `0.375rem` | Gap between individual chips |
| `--bs-chip-group-padding` | `0.75rem` | Padding inside the bordered frame |
| `--bs-chip-group-border-color` | `var(--tc-border)` | Hairline frame colour (when `border` is set) |
| `--bs-chip-group-title-font-size` | `0.875rem` | Title font size |
| `--bs-chip-group-title-font-weight` | `600` | Title font weight |
| `--bs-chip-group-subtitle-font-size` | `0.78125rem` | Subtitle font size (12.5 px) |
| `--bs-chip-group-subtitle-color` | `var(--tc-text-muted)` | Subtitle text colour |

```html
<!-- Basic group — items set via JS property -->
<tc-chip-group id="tags" title="Tags"></tc-chip-group>
<script>
    document.getElementById('tags').items = [
        { id: 'react', label: 'React', selected: true },
        { id: 'ts', label: 'TypeScript' },
        { id: 'rust', label: 'Rust', icon: 'Zap' },
        { id: 'gql', label: 'GraphQL', count: 12 },
        { id: 'legacy', label: 'Legacy', disabled: true },
    ]
    document.getElementById('tags').addEventListener('tc-toggle', e => {
        console.log('toggled:', e.detail.id)
    })
</script>

<!-- Bordered group with subtitle -->
<tc-chip-group title="Issue labels" subtitle="Select labels to filter by" border id="labels"></tc-chip-group>
<script>
    document.getElementById('labels').items = [
        { id: 'bug', label: 'Bug', icon: 'Bug', variant: 'danger' },
        { id: 'feature', label: 'Feature', icon: 'Star', variant: 'success' },
        { id: 'docs', label: 'Docs', icon: 'FileText' },
    ]
</script>

<!-- onToggle callback -->
<tc-chip-group id="opts" title="Options"></tc-chip-group>
<script>
    const grp = document.getElementById('opts')
    grp.items = [{ id: 'a', label: 'Alpha' }, { id: 'b', label: 'Beta', selected: true }]
    grp.onToggle = id => console.log('toggled via callback:', id)
</script>
```

---

### tc-color-picker

Color picker dropdown with a preset swatch grid, a hex text input, and selection management. Port of `@toolcase/react-components` `ColorPicker`.

**Tag:** `tc-color-picker`

**Attributes**

| Attribute | Type | Default | Description |
|-----------|------|---------|-------------|
| `label` | string | — | Optional field label rendered above the trigger button. |
| `value` | string | — | Currently selected hex color (e.g. `#0f172a`). Reflected back to the attribute on selection. |
| `columns` | number | `8` | Number of columns in the swatch grid. |
| `loading` | boolean | false | When set, renders an animated skeleton placeholder instead of swatches. |
| `disabled` | boolean | false | Disables the trigger and all interactive elements. Applies `opacity: 0.5; pointer-events: none`. |

**JS Properties**

| Property | Type | Description |
|----------|------|-------------|
| `colors` | `ColorOption[] \| string[]` | Required. Swatch list. Each entry is either a hex string or `{ value: string; label?: string }`. Both shapes are normalised internally. Set via JS — not an attribute. |
| `onChange` | `((color: string) => void) \| null` | Optional callback fired alongside the `tc-change` event on every selection. |

**Events**

| Event | Detail | Description |
|-------|--------|-------------|
| `tc-change` | `{ value: string }` | Fired (bubbles, composed) whenever the selected color changes — on swatch click, Enter on a focused swatch, or a committed hex input (Enter / blur with a valid hex). |

**Slots**

None. All content is generated from attributes and JS properties.

**Keyboard navigation**

- `Arrow keys` — move focus between swatches (left/right within a row, up/down by column count).
- `Enter` — select the focused swatch.
- `Escape` — close the panel and return focus to the trigger.
- `Tab` — close the panel without refocusing the trigger.
- In the hex input: `Enter` commits a valid hex and closes the panel; `blur` also commits if the value changed.

**Accessibility**

- Trigger has `aria-haspopup="listbox"` and `aria-expanded`.
- Panel has `role="dialog"`. Swatch grid has `role="listbox"`; each swatch has `role="option"` and `aria-selected`.
- Hex input has a visually-hidden `<label>` for accessible name.
- Focus visible throughout via `:focus-visible` outline.
- `prefers-reduced-motion` disables the skeleton pulse animation.

**CSS custom properties (theming)**

| Property | Default | Description |
|----------|---------|-------------|
| `--bs-color-picker-trigger-bg` | `var(--tc-surface)` | Trigger button background |
| `--bs-color-picker-trigger-border` | `var(--tc-border-strong)` | Trigger border color |
| `--bs-color-picker-trigger-color` | `var(--tc-text)` | Trigger text color |
| `--bs-color-picker-panel-bg` | `var(--tc-surface)` | Panel overlay background |
| `--bs-color-picker-panel-border` | `var(--tc-border)` | Panel border color |
| `--bs-color-picker-panel-shadow` | `var(--tc-shadow-lg)` | Panel drop-shadow |
| `--bs-color-picker-panel-z` | `var(--tc-z-dropdown)` | Panel z-index |
| `--bs-color-picker-panel-width` | `260px` | Panel width |
| `--bs-color-picker-panel-padding` | `0.625rem` | Panel inner padding |
| `--bs-color-picker-swatch-size` | `24px` (44px on coarse pointer) | Swatch cell size |
| `--bs-color-picker-hex-border` | `var(--tc-border-strong)` | Hex input border color |

**Examples**

```html
<!-- Hex string array (set via JS) -->
<tc-color-picker id="cp" label="Background color"></tc-color-picker>
<script>
    const cp = document.getElementById('cp')
    cp.colors = ['#0f172a', '#334155', '#dc2626', '#16a34a', '#0284c7', '#7c3aed']
    cp.value = '#334155'
    cp.addEventListener('tc-change', e => console.log('selected:', e.detail.value))
</script>

<!-- ColorOption[] with labels -->
<tc-color-picker id="cp2" label="Accent color"></tc-color-picker>
<script>
    document.getElementById('cp2').colors = [
        { value: '#dc2626', label: 'Red' },
        { value: '#16a34a', label: 'Green' },
        { value: '#0284c7', label: 'Blue' },
    ]
</script>

<!-- Custom columns -->
<tc-color-picker label="Theme color" columns="4"></tc-color-picker>

<!-- Loading skeleton -->
<tc-color-picker label="Loading…" loading></tc-color-picker>

<!-- Disabled -->
<tc-color-picker label="Locked" value="#64748b" disabled></tc-color-picker>
```

---

### tc-icon-picker

Searchable icon-grid dropdown for selecting a lucide icon by name. Port of `@toolcase/react-components` `IconPicker`.

**Tag:** `tc-icon-picker`

**Attributes**

| Attribute | Type | Default | Description |
|-----------|------|---------|-------------|
| `label` | string | — | Optional field label rendered above the trigger button. |
| `value` | string | — | Currently selected lucide icon name (kebab-case, e.g. `star`). Reflected back to the attribute on selection. |
| `columns` | number | `6` | Number of columns in the icon grid. |
| `loading` | boolean | false | When set, renders an animated skeleton placeholder grid and disables interaction. |

**JS Properties**

| Property | Type | Description |
|----------|------|-------------|
| `icons` | `IconOption[]` | Required. Array of `{ value: string; label?: string }` where `value` is a kebab-case lucide icon name. Set via JS — not an attribute. |
| `onChange` | `((value: string) => void) \| null` | Optional callback fired alongside the `tc-change` event on every selection. |

**Events**

| Event | Detail | Description |
|-------|--------|-------------|
| `tc-change` | `{ value: string }` | Fired (bubbles, composed) whenever the selected icon changes — on cell click or Enter on a highlighted cell. |

**Slots**

None. All content is generated from attributes and JS properties.

**Keyboard navigation**

- `ArrowRight` / `ArrowLeft` — move roving highlight one cell left or right.
- `ArrowDown` / `ArrowUp` — move roving highlight one row down or up (respects `columns`).
- `Enter` / `Space` — select the currently highlighted icon.
- `Escape` — close the popup and return focus to the trigger.
- `Tab` — close the popup without refocusing the trigger.
- Typing in the search field filters the grid; highlight resets to none.

**Accessibility**

- Trigger has `aria-haspopup="listbox"` and `aria-expanded`.
- Popup has `role="listbox"`. Each option has `role="option"` and `aria-selected`.
- Loading popup has `role="status"` and `aria-busy="true"` with a visually-hidden "Loading…" label.
- Search input is a native `<input type="search">`.
- Focus visible throughout via `:focus-visible`.
- `prefers-reduced-motion` disables the skeleton pulse animation.

**CSS custom properties (theming)**

| Property | Default | Description |
|----------|---------|-------------|
| `--bs-icon-picker-trigger-bg` | `var(--tc-surface)` | Trigger button background |
| `--bs-icon-picker-trigger-border` | `var(--tc-border-strong)` | Trigger border color |
| `--bs-icon-picker-trigger-color` | `var(--tc-text)` | Trigger text color |
| `--bs-icon-picker-popup-bg` | `var(--tc-surface)` | Popup overlay background |
| `--bs-icon-picker-popup-border` | `var(--tc-border)` | Popup border color |
| `--bs-icon-picker-popup-shadow` | `var(--tc-shadow-lg)` | Popup drop-shadow |
| `--bs-icon-picker-popup-z` | `var(--tc-z-dropdown)` | Popup z-index |
| `--bs-icon-picker-popup-min-width` | `200px` | Popup minimum width |
| `--bs-icon-picker-popup-padding` | `0.5rem` | Popup inner padding |
| `--bs-icon-picker-option-size` | `2rem` (44px on coarse pointer) | Option cell size |
| `--bs-icon-picker-skeleton-bg` | `var(--tc-surface-muted)` | Skeleton cell background |

**Examples**

```html
<!-- Basic usage (set icons via JS) -->
<tc-icon-picker id="ip" label="Choose an icon" value="star"></tc-icon-picker>
<script>
    const ip = document.getElementById('ip')
    ip.icons = [
        { value: 'star', label: 'Star' },
        { value: 'heart', label: 'Heart' },
        { value: 'home', label: 'Home' },
        { value: 'search', label: 'Search' },
        { value: 'settings', label: 'Settings' },
    ]
    ip.addEventListener('tc-change', e => console.log('selected:', e.detail.value))
</script>

<!-- Custom columns -->
<tc-icon-picker label="Icon" columns="4"></tc-icon-picker>

<!-- Loading skeleton -->
<tc-icon-picker label="Loading…" loading></tc-icon-picker>
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

### tc-date-picker

Native HTML5 date input wrapper with optional label, min/max constraints, and `tc-change` event.

**Tag:** `tc-date-picker`

**Attributes**

| Attribute | Type | Default | Description |
|-----------|------|---------|-------------|
| `label` | string | — | Visible label linked to the input via `for`/`id` |
| `value` | string | `""` | Current date value in ISO `YYYY-MM-DD` format |
| `min` | string | — | Minimum selectable date (`YYYY-MM-DD`) |
| `max` | string | — | Maximum selectable date (`YYYY-MM-DD`) |
| `disabled` | boolean | `false` | Disables the input and dims the component |

**JS Properties**

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `label` | `string \| null` | `null` | Reflects the `label` attribute |
| `value` | `string` | `""` | Reflects the `value` attribute; reads the live input value |
| `min` | `string \| null` | `null` | Reflects the `min` attribute |
| `max` | `string \| null` | `null` | Reflects the `max` attribute |
| `disabled` | `boolean` | `false` | Reflects the `disabled` attribute |
| `onChange` | `((value: string) => void) \| null` | `null` | Callback fired alongside `tc-change` |

**Events**

| Event | Detail | Description |
|-------|--------|-------------|
| `tc-change` | `{ value: string }` | Fired when the selected date changes. Bubbles + composed. |

**Slots:** none

```html
<tc-date-picker label="Event date" value="2026-06-14" min="2026-01-01" max="2026-12-31"></tc-date-picker>
<tc-date-picker label="Locked" value="2026-06-14" disabled></tc-date-picker>
```

```js
document.querySelector('tc-date-picker').addEventListener('tc-change', e => {
    console.log('date selected:', e.detail.value)
})
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

## tc-icon-button

Square icon-only button with variant, size, outline, and accessible label. Dispatches `tc-click` on activation.

**Tag:** `tc-icon-button`

**Attributes**

| Attribute | Type | Default | Description |
|-----------|------|---------|-------------|
| `icon` | string | — | **Required.** Lucide icon name in PascalCase (e.g. `"Trash2"`, `"Pencil"`) |
| `size` | `small\|default\|large` | `default` | Button size: 28 / 36 / 44 px |
| `variant` | `primary\|secondary\|info\|success\|warning\|danger` | `secondary` | Color variant |
| `outline` | boolean | false | Outline style — transparent background, colored border |
| `label` | string | — | **Required for a11y.** Applied as `aria-label` (visible text is absent) |
| `disabled` | boolean | false | Disables the button and prevents `tc-click` |

**Events**

| Event | Detail | Description |
|-------|--------|-------------|
| `tc-click` | `{}` | Fires when the button is clicked (not fired when disabled) |

**JS Properties**

| Property | Type | Description |
|----------|------|-------------|
| `onClick` | `(() => void) \| null` | Optional callback, called in addition to `tc-click` |

**Accessibility**

- `aria-label` is the only accessible name — the `label` attribute is effectively required.
- Focus ring: `2px solid var(--tc-app-accent)`, offset `2px`.
- Disabled: native `disabled` attribute on inner `<button>` + `pointer-events: none` on host.
- Touch target ≥ 44 px under `@media (pointer: coarse)`.
- Respects `prefers-reduced-motion` — transform lift frozen, state transitions kept.

**CSS custom properties (theming)**

| Property | Default | Description |
|----------|---------|-------------|
| `--bs-icon-button-size` | `36px` | Square size of the button (overridden by size modifier) |
| `--bs-icon-button-icon-size` | `1rem` | Width and height of the SVG icon |

```html
<!-- Default (secondary ghost) -->
<tc-icon-button icon="Pencil" label="Edit"></tc-icon-button>

<!-- Primary -->
<tc-icon-button icon="Plus" variant="primary" label="Add"></tc-icon-button>

<!-- Danger outline -->
<tc-icon-button icon="Trash2" variant="danger" outline label="Delete"></tc-icon-button>

<!-- Large success -->
<tc-icon-button icon="Check" variant="success" size="large" label="Confirm"></tc-icon-button>

<!-- Disabled -->
<tc-icon-button icon="Lock" label="Locked" disabled></tc-icon-button>
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

### tc-cdn-map

Grid-backed surface with positioned CDN node markers. Primary nodes use the slate ink accent (`--tc-app-accent`); accent nodes use the rare cyan `--tc-accent` for highlight PoPs. Supports an accessible `aria-label` summarising the node distribution and per-node `aria-label` attributes. No slot children — set nodes via the JS `nodes` property.

**Tag:** `tc-cdn-map`

**Attributes**

| Attribute | Type | Default | Description |
|-----------|------|---------|-------------|
| `height` | `number \| string` | `360` | Height of the map surface. A bare integer is treated as pixels (`360` → `360px`). Any CSS length string is used directly (`"50vh"`, `"240px"`). |

**JS Properties**

| Property | Type | Description |
|----------|------|-------------|
| `nodes` | `CdnMapNode[]` | Array of node descriptors rendered as positioned markers. Each node has `top: string`, `left: string` (percentage or CSS position values), optional `label?: string`, and optional `variant?: 'primary' \| 'accent'` (defaults to primary). Setting this property triggers a re-render. |

**`CdnMapNode` shape**

```ts
interface CdnMapNode {
  top: string        // CSS top (e.g. "30%", "80px")
  left: string       // CSS left (e.g. "55%", "120px")
  label?: string     // Optional visible label (mono micro-label) and aria-label
  variant?: 'primary' | 'accent'  // Default: 'primary'
}
```

**Events**

None. `tc-cdn-map` is a purely presentational element.

**Slots**

None. The component owns its surface and all marker rendering.

**Example**

```html
<tc-cdn-map id="map" height="240"></tc-cdn-map>
<script>
  document.getElementById('map').nodes = [
    { top: '20%', left: '15%', variant: 'primary', label: 'NYC' },
    { top: '35%', left: '55%', variant: 'accent',  label: 'AMS' },
    { top: '60%', left: '30%', variant: 'primary', label: 'LAX' },
  ]
</script>
```

---

### tc-changelog

Vertical changelog timeline. Entries are set via the JS `entries` property (array of `ChangelogEntry` objects). Supports optional truncation via `max-visible` with a configurable "read more" link, and a loading skeleton. Non-interactive — dispatches no events. Sharp corners (`border-radius: 0`) on entries and tags; the circular rail dot (`50%`) is the only sanctioned curve.

**Tag:** `tc-changelog`

**Attributes**

| Attribute | Type | Default | Description |
|-----------|------|---------|-------------|
| `max-visible` | number | — | When set, only the first N entries are rendered. A "read more" link appears when the entries array is longer than this value (requires `read-more-href`). |
| `read-more-href` | string | `''` | URL for the "read more" link rendered when entries are truncated. |
| `read-more-label` | string | `'Read more'` | Label text for the "read more" link. |
| `loading` | boolean | `false` | When set, renders a 3-row skeleton placeholder instead of entry content. |

**JS Properties**

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `entries` | `ChangelogEntry[]` | `[]` | Array of changelog entries. Setting this property re-renders the component. See the `ChangelogEntry` shape below. |
| `maxVisible` | `number \| null` | `null` | Reflects the `max-visible` attribute. |
| `readMoreHref` | `string` | `''` | Reflects the `read-more-href` attribute. |
| `readMoreLabel` | `string` | `'Read more'` | Reflects the `read-more-label` attribute. |
| `loading` | `boolean` | `false` | Reflects the `loading` attribute. |

**ChangelogEntry shape**

```ts
interface ChangelogEntry {
    date: string        // Required. Monospace date label (e.g. '2026-06-01').
    title: string       // Required. Entry heading.
    description: string // Required. Body paragraph.
    tags?: string[]     // Optional. Small monospace tag badges.
}
```

**Events**

None. `tc-changelog` is a purely presentational element.

**Slots**

None. All content is driven by the `entries` JS property.

**CSS custom properties (theming)**

| Property | Default | Description |
|----------|---------|-------------|
| `--bs-changelog-rail-color` | `var(--tc-border)` | Left rail hairline color. |
| `--bs-changelog-rail-width` | `1px` | Left rail hairline thickness. |
| `--bs-changelog-dot-size` | `0.625rem` | Diameter of the circular entry dot. |
| `--bs-changelog-dot-color` | `var(--tc-app-accent)` | Fill color of the entry dot. |
| `--bs-changelog-dot-col-width` | `1.5rem` | Width of the left column holding the dot. |
| `--bs-changelog-dot-gutter` | `0.875rem` | Gap between the dot column and the card. |
| `--bs-changelog-date-color` | `var(--tc-text-muted)` | Date label color (monospace). |
| `--bs-changelog-date-font-size` | `0.6875rem` | Date label font size. |
| `--bs-changelog-title-color` | `var(--tc-text)` | Entry title color. |
| `--bs-changelog-title-font-size` | `0.9375rem` | Entry title font size. |
| `--bs-changelog-title-font-weight` | `600` | Entry title font weight. |
| `--bs-changelog-desc-color` | `var(--tc-text-muted)` | Entry description color. |
| `--bs-changelog-desc-font-size` | `0.875rem` | Entry description font size. |
| `--bs-changelog-tag-bg` | `var(--tc-surface-muted)` | Tag background. |
| `--bs-changelog-tag-color` | `var(--tc-text)` | Tag text color. |
| `--bs-changelog-tag-border-color` | `var(--tc-border)` | Tag hairline border. |
| `--bs-changelog-tag-font-size` | `0.6875rem` | Tag font size (monospace). |
| `--bs-changelog-item-gap` | `1.75rem` | Vertical gap between consecutive entries. |
| `--bs-changelog-more-color` | `var(--tc-text-muted)` | "Read more" link default color. |
| `--bs-changelog-more-hover-color` | `var(--tc-accent)` | "Read more" link hover color. |
| `--bs-changelog-more-font-size` | `0.8125rem` | "Read more" link font size. |

```html
<!-- Basic usage — set entries via JS -->
<tc-changelog id="cl1"></tc-changelog>
<script>
document.getElementById('cl1').entries = [
    { date: '2026-06-01', title: 'v3.0.0', description: 'Major redesign.', tags: ['breaking'] },
    { date: '2026-04-15', title: 'v2.8.0', description: 'New Timeline component.', tags: ['feature'] },
]
</script>

<!-- Truncated with read-more link -->
<tc-changelog
    id="cl2"
    max-visible="2"
    read-more-href="/changelog"
    read-more-label="View full changelog →"
></tc-changelog>
<script>
document.getElementById('cl2').entries = [
    { date: '2026-06-01', title: 'v3.0.0', description: 'Major redesign.', tags: ['breaking'] },
    { date: '2026-04-15', title: 'v2.8.0', description: 'New component.', tags: ['feature'] },
    { date: '2026-03-02', title: 'v2.7.0', description: 'Form primitives.', tags: ['feature'] },
]
</script>

<!-- Loading skeleton -->
<tc-changelog loading></tc-changelog>
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

### tc-code-snippet

Syntax-highlighted code block with a copy button, language label, optional title, and loading skeleton. Dark ink surface; JetBrains Mono throughout; sharp corners everywhere.

**Tag:** `tc-code-snippet`

**Attributes**

| Attribute | Type | Default | Description |
|-----------|------|---------|-------------|
| `code` | string | `''` | Source code to display. Also settable via the JS `code` property or via text content (slotted fallback on first connect). |
| `language` | `'javascript' \| 'typescript' \| 'bash'` | `'javascript'` | Syntax-highlight language and label shown in the header. |
| `title` | string | — | Optional filename / label shown on the left of the header. When absent, the language name is shown instead. |
| `show-copy-button` | `'false'` to hide | `true` (shown by default) | Set `show-copy-button="false"` to hide the copy button. |
| `loading` | boolean (presence) | `false` | Renders a shimmer skeleton instead of the code block. |

**JS Properties**

| Property | Type | Description |
|----------|------|-------------|
| `code` | `string` | Reflects the `code` attribute. Setting this is equivalent to `setAttribute('code', value)`. |
| `language` | `CodeSnippetLanguage` | Reflects the `language` attribute. |
| `title` | `string` | Native `HTMLElement.title` — reflects the `title` attribute. |
| `showCopyButton` | `boolean` | Reflects `show-copy-button`. Set to `false` to remove `show-copy-button="false"` attribute. |
| `loading` | `boolean` | Reflects the `loading` boolean attribute. |
| `onCopy` | `((code: string) => void) \| null` | Optional callback invoked after a successful clipboard write (alongside the `tc-copy` event). |

**Events**

| Event | Detail | Description |
|-------|--------|-------------|
| `tc-copy` | `{ code: string }` | Fired (bubbles, composed) when the user successfully copies code to the clipboard. |

**Slots**

| Slot | Description |
|------|-------------|
| *(default / text content)* | When no `code` attribute is present on first connect, the element's `textContent` is captured as the initial code. Setting the `code` attribute or JS property after that takes precedence. |

**CSS Custom Properties**

| Property | Default | Description |
|----------|---------|-------------|
| `--bs-code-snippet-border` | `1px solid var(--tc-border)` | Outer border. |
| `--bs-code-snippet-header-bg` | `var(--tc-ink-2)` | Header strip background. |
| `--bs-code-snippet-header-padding` | `0.375rem 0.5rem 0.375rem 0.75rem` | Header padding. |
| `--bs-code-snippet-title-color` | `var(--tc-text-muted)` | Title/label text color. |
| `--bs-code-snippet-copy-color` | `var(--tc-text-muted)` | Copy-button icon color. |
| `--bs-code-snippet-copy-hover-bg` | `rgba(255,255,255,0.08)` | Copy-button hover fill. |
| `--bs-code-snippet-code-bg` | `var(--tc-ink)` | Code surface background. |
| `--bs-code-snippet-code-color` | `var(--tc-text-inverse)` | Code text color. |
| `--bs-code-snippet-code-font-size` | `0.875rem` | Code font size. |
| `--bs-code-snippet-tok-keyword` | `#88aacc` | Token color — keywords. |
| `--bs-code-snippet-tok-string` | `#99cc88` | Token color — strings. |
| `--bs-code-snippet-tok-comment` | `#6a7a8c` | Token color — comments. |
| `--bs-code-snippet-tok-number` | `#cc9966` | Token color — numbers. |
| `--bs-code-snippet-tok-variable` | `#cc88aa` | Token color — bash variables. |

```html
<!-- JavaScript snippet (attribute) -->
<tc-code-snippet language="javascript" code="const x = 42;"></tc-code-snippet>

<!-- TypeScript with filename title -->
<tc-code-snippet language="typescript" title="src/index.ts" code="type ID = string | number;"></tc-code-snippet>

<!-- Bash, copy button hidden -->
<tc-code-snippet language="bash" show-copy-button="false" code="npm install"></tc-code-snippet>

<!-- Slotted text content fallback -->
<tc-code-snippet language="javascript">
const answer = 42;
</tc-code-snippet>

<!-- Loading skeleton -->
<tc-code-snippet loading></tc-code-snippet>
```

```js
// JS-property usage + event listener
const el = document.querySelector('tc-code-snippet')
el.code = 'console.log("hello")'
el.onCopy = (code) => console.log('Copied:', code)
el.addEventListener('tc-copy', (e) => console.log('detail:', e.detail.code))
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

---

### tc-leaderboard

Table-based leaderboard with avatar, tier, sprints, trend, and points columns. Entries are supplied as a JS property (not an attribute). Interactive rows (entries with an `id`) dispatch a `tc-select` event and support keyboard navigation (Enter/Space).

**Tag:** `tc-leaderboard`

**Attributes**

None. All data is supplied via JS properties.

**JS Properties**

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `entries` | `LeaderboardEntry[]` | `[]` | Array of row data. Set via `el.entries = [...]`. Triggers a re-render. |
| `columns` | `LeaderboardColumns` | `{}` (all visible) | Column visibility and header overrides. Each key (`rank`, `dev`, `tier`, `sprints`, `trend`, `points`) can be `false` (hidden) or a `string` (custom header label). `undefined` shows the column with the default label. |
| `onselect` | `function \| null` | `null` | Optional callback fired when an interactive row is selected. Receives the `LeaderboardEntry` object. |

**LeaderboardEntry shape**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `rank` | `number` | ✓ | Row rank number. Ranks 1–3 get gold/silver/bronze accent. |
| `name` | `string` | ✓ | Displayed name. Used as avatar `alt` text and initials fallback. |
| `avatarUrl` | `string` | — | If set, renders an `<img>` avatar. Otherwise renders an initials circle. |
| `tier` | `string` | — | Tier label shown in the Tier column (e.g. `"Diamond"`, `"Gold"`). |
| `sprints` | `number` | — | Sprint count shown in the Sprints column. |
| `trend` | `{ value: string; direction: 'up' \| 'down' \| 'flat' }` | — | Trend data rendered via `tc-leaderboard-trend`. |
| `points` | `number` | ✓ | Points value, rendered right-aligned in JetBrains Mono. |
| `id` | `string` | — | When set, makes the row interactive (focusable, keyboard-activatable, fires `tc-select`). |

**Default column headers**

| Column key | Default label |
|------------|---------------|
| `rank` | `#` |
| `dev` | `Developer` |
| `tier` | `Tier` |
| `sprints` | `Sprints` |
| `trend` | `Trend` |
| `points` | `Points` |

**Events**

| Event | Detail | Description |
|-------|--------|-------------|
| `tc-select` | `{ id: string, entry: LeaderboardEntry }` | Fired when an interactive row (one with an `id`) is clicked or activated via Enter/Space. Bubbles and composed. |

**Slots**

None. `tc-leaderboard` is data-driven via the `entries` JS property.

**Accessibility**

Renders a semantic `<table>` with `<thead>`, `<tbody>`, and `<th scope="col">` column headers. Avatar images carry `alt` text; initials circles are `aria-hidden`. Interactive rows are focusable (`tabindex="0"`) and respond to Enter/Space. Focus ring uses `:focus-visible`. Reduced motion is honoured globally. Touch targets for interactive rows are ≥44 px on coarse-pointer devices.

**CSS Custom Properties**

| Property | Default | Description |
|----------|---------|-------------|
| `--bs-leaderboard-bg` | `var(--tc-surface)` | Table background. |
| `--bs-leaderboard-border` | `1px solid var(--tc-border)` | Outer frame border. |
| `--bs-leaderboard-row-hairline` | `1px solid var(--tc-slate-100)` | Inner row separator. |
| `--bs-leaderboard-th-font-size` | `0.6875rem` | Header label font size. |
| `--bs-leaderboard-th-color` | `var(--tc-text-muted)` | Header label color. |
| `--bs-leaderboard-td-color` | `var(--tc-text)` | Default cell text color. |
| `--bs-leaderboard-row-hover-bg` | `var(--tc-surface-hover)` | Row hover background. |
| `--bs-leaderboard-row-active-bg` | `var(--tc-surface-muted)` | Row active/pressed background. |
| `--bs-leaderboard-avatar-size` | `2rem` | Avatar diameter. |
| `--bs-leaderboard-avatar-font-size` | `0.6875rem` | Initials font size. |
| `--bs-leaderboard-points-font-size` | `0.875rem` | Points value font size. |
| `--bs-leaderboard-gold` | `#d97706` | Gold accent for rank 1. |
| `--bs-leaderboard-silver` | `#94a3b8` | Silver accent for rank 2. |
| `--bs-leaderboard-bronze` | `#b45309` | Bronze accent for rank 3. |
| `--bs-leaderboard-stripe-width` | `3px` | Left-border stripe width on top-3 rank cells. |

```html
<!-- Basic setup via JS property -->
<tc-leaderboard id="board"></tc-leaderboard>
<script>
  document.getElementById('board').entries = [
    { id: 'u1', rank: 1, name: 'Alice Chen', avatarUrl: '/avatars/alice.png', tier: 'Diamond', sprints: 24, trend: { value: '+240', direction: 'up' }, points: 9420 },
    { id: 'u2', rank: 2, name: 'Bob Müller', tier: 'Platinum', sprints: 21, trend: { value: '-130', direction: 'down' }, points: 8870 },
    { rank: 3, name: 'Carol Diaz', tier: 'Gold', points: 7100 },
  ]

  document.getElementById('board').addEventListener('tc-select', e => {
    console.log('Selected:', e.detail.id, e.detail.entry)
  })

  // Or use the callback property:
  document.getElementById('board').onselect = entry => console.log('Selected:', entry.name)
</script>
```

```html
<!-- Column-config variant: hide Tier and Sprints, override Trend header -->
<tc-leaderboard id="compact"></tc-leaderboard>
<script>
  const el = document.getElementById('compact')
  el.entries = [ /* ... */ ]
  el.columns = { tier: false, sprints: false, trend: 'Δ 7d' }
</script>
```

---

### tc-leaderboard-trend

Small directional trend indicator with a Lucide arrow icon and a value. Three directions drive the icon shape and color. Designed to sit inline within table cells, metric rows, or leaderboard entries. Purely presentational — no interaction, no events.

**Tag:** `tc-leaderboard-trend`

**Attributes**

| Attribute | Type | Default | Description |
|-----------|------|---------|-------------|
| `value` | string | — | The trend value text (e.g. `"+240"`, `"-8%"`). When set, rendered as escaped text. When omitted, slotted children are projected into the value span instead. |
| `direction` | `'up' \| 'down' \| 'flat'` | `'flat'` | Direction of the trend. Drives the arrow icon and color. `up` → `--tc-success`, `down` → `--tc-danger`, `flat` → `--tc-text-muted`. |

**JS Properties**

| Property | Type | Description |
|----------|------|-------------|
| `value` | `string \| null` | Reflects the `value` attribute. |
| `direction` | `LeaderboardTrendDirection` | Reflects the `direction` attribute. Defaults to `'flat'` when the attribute is absent or invalid. |

**Events**

None. `tc-leaderboard-trend` is purely presentational.

**Slots**

| Slot | Description |
|------|-------------|
| *(default)* | Value content when the `value` attribute is absent. Projected into the inner `.tc-leaderboard-trend-value` span. Useful for rich markup (e.g. `<strong>+5</strong> pts`). |

**Accessibility**

The arrow icon SVG carries `aria-hidden="true"` so it is decorative. Direction is conveyed by both icon shape and color — not color alone. Reduced motion is honoured globally via the `prefers-reduced-motion` reset.

**CSS Custom Properties**

| Property | Default | Description |
|----------|---------|-------------|
| `--bs-leaderboard-trend-color` | direction-mapped | Text and icon color. `up` → `--tc-success`, `down` → `--tc-danger`, `flat` → `--tc-text-muted`. |
| `--bs-leaderboard-trend-icon-size` | `0.875em` | Icon width and height (relative to the element's font size). |
| `--bs-leaderboard-trend-font-size` | `12px` | Value text font size (JetBrains Mono, weight 500). |
| `--bs-leaderboard-trend-gap` | `0.25rem` | Gap between the icon and the value text. |

```html
<!-- Attribute value with explicit direction -->
<tc-leaderboard-trend value="+12%" direction="up"></tc-leaderboard-trend>
<tc-leaderboard-trend value="-8%" direction="down"></tc-leaderboard-trend>
<tc-leaderboard-trend value="0%" direction="flat"></tc-leaderboard-trend>

<!-- Slotted value (no value attribute) -->
<tc-leaderboard-trend direction="up"><strong>+5</strong> pts</tc-leaderboard-trend>

<!-- Inline in a table cell -->
<td>
    <tc-leaderboard-trend value="+240" direction="up"></tc-leaderboard-trend>
</td>
```

---

### tc-linked-providers-card

Section card listing OAuth providers with custom icons and brand colors. A fixed header shows the card title; the body renders one row per provider with an icon tile, label, optional connected-account sub-label, and a connect/disconnect action button. Dispatches `tc-toggle` when an action button is clicked. Empty-state fallback when the `providers` array is empty.

**Tag:** `tc-linked-providers-card`

**Attributes**

| Attribute | Type | Default | Description |
|-----------|------|---------|-------------|
| `title` | string | `'Linked providers'` | Card header text rendered as an `<h3>`. |
| `empty-label` | string | `'No providers linked.'` | Text shown when `providers` is an empty array. |

**JS Properties**

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `providers` | `LinkedProvider[]` | `[]` | Array of provider objects. Setting it re-renders the list. |
| `brandColors` | `Record<string, string>` | `{}` | Maps a provider key to a CSS color string applied to that provider's icon tile. Only the tile is tinted — all other UI stays slate. |
| `iconForProvider` | `((key: string) => string) or null` | `null` | Optional function returning a lucide icon name (PascalCase) for a given provider key. Falls back to provider.icon, then to 'Link'. |
| `ontoggle` | `((key: string, connected: boolean) => void) or null` | `null` | Optional callback fired alongside the `tc-toggle` custom event. |

`LinkedProvider` shape:

```ts
interface LinkedProvider {
    key: string          // unique identifier; used in events and brandColors map
    label: string        // display name shown in the row
    connected?: boolean  // when true: shows a success dot and Unlink action button
    account?: string     // optional sub-label (email or username of connected account)
    icon?: string        // lucide PascalCase icon name; overridden by iconForProvider
}
```

**Events**

| Event | Detail | Description |
|-------|--------|-------------|
| `tc-toggle` | `{ key: string, connected: boolean }` | Fired (bubbles, composed) when the user clicks a row's action button. `key` is the provider key; `connected` is its current state before any toggle. The host does not mutate `providers` automatically — update the array in the handler. |

**Slots**

None. All content is driven by JS properties and attributes.

**Accessibility**

- Card header is a real `<h3>` heading.
- Provider list uses `<ul role="list">` / `<li role="listitem">`.
- Each action button has an `aria-label` describing the provider name and action (`"Connect GitHub"` / `"Disconnect GitHub"`).
- Icon tiles and the connected dot carry `aria-hidden="true"`.
- Focus ring always visible (`outline: 2px solid var(--tc-app-accent)`).
- Touch targets >= 44 px under `@media (pointer: coarse)`.
- `prefers-reduced-motion` is honoured: transitions retain background-color/color but no transforms.

**CSS Custom Properties**

| Property | Default | Description |
|----------|---------|-------------|
| `--bs-linked-providers-card-row-separator` | `rgba(148,163,184,0.35)` | Inner hairline between rows (fainter than the outer frame). |
| `--bs-linked-providers-card-row-hover-bg` | `var(--tc-surface-hover)` | Row background on hover. |
| `--bs-linked-providers-card-row-padding-y` | `0.75rem` | Vertical padding of each row. |
| `--bs-linked-providers-card-row-padding-x` | `1.25rem` | Horizontal padding of each row. |
| `--bs-linked-providers-card-label-color` | `var(--tc-text)` | Provider label text color. |
| `--bs-linked-providers-card-account-color` | `var(--tc-text-muted)` | Connected-account sub-label color. |
| `--bs-linked-providers-card-tile-bg` | `var(--tc-surface-muted)` | Icon tile background (slate-100). |
| `--bs-linked-providers-card-tile-size` | `2.125rem` | Square size of the icon tile. |
| `--bs-linked-providers-card-icon-size` | `1rem` | Icon SVG width/height inside the tile. |
| `--bs-linked-providers-card-icon-default-color` | `var(--tc-text-muted)` | Icon color when no brand color is set. |
| `--bs-linked-providers-card-btn-color` | `var(--tc-text-muted)` | Action button icon color at rest. |
| `--bs-linked-providers-card-btn-hover-bg` | `var(--tc-surface-muted)` | Action button hover well background. |
| `--bs-linked-providers-card-btn-size` | `2rem` | Action button hit-area size. |
| `--bs-linked-providers-card-connected-dot-color` | `var(--tc-success)` | Connected state indicator dot color. |
| `--bs-linked-providers-card-empty-color` | `var(--tc-text-faint)` | Empty state text color. |

```html
<!-- Basic usage -->
<tc-linked-providers-card id="lpc" title="Linked providers"></tc-linked-providers-card>
<script>
  const el = document.getElementById('lpc')
  el.providers = [
    { key: 'github', label: 'GitHub', connected: true, account: 'user@example.com', icon: 'Github' },
    { key: 'google', label: 'Google', connected: false, icon: 'Globe' },
  ]
  el.brandColors = { github: '#24292f', google: '#4285F4' }
  el.addEventListener('tc-toggle', e => {
    const { key, connected } = e.detail
    console.log('Toggle:', key, connected)
  })
</script>

<!-- Custom icon resolver -->
<tc-linked-providers-card id="lpc2" title="Integrations"></tc-linked-providers-card>
<script>
  const el2 = document.getElementById('lpc2')
  el2.providers = [{ key: 'zapier', label: 'Zapier', connected: false }]
  el2.iconForProvider = key => key === 'zapier' ? 'Zap' : 'Link'
  el2.brandColors = { zapier: '#ff4a00' }
</script>

<!-- Empty state with custom label -->
<tc-linked-providers-card
  title="Linked providers"
  empty-label="No integrations connected yet.">
</tc-linked-providers-card>
```

---

### tc-metric-tile

Compact presentational card showing a single metric — a mono uppercase micro-label, a large value figure, an optional unit suffix, an optional leading icon, and an optional hint line. No interactive targets; purely data-display.

**Tag:** `tc-metric-tile`

**Attributes**

| Attribute | Type | Default | Description |
|-----------|------|---------|-------------|
| `label` | string | `""` | Metric caption — rendered as an uppercase JetBrains Mono micro-label above the value. |
| `value` | string | — | Metric value as text. When set, renders as the displayed figure. When absent, default slot children are distributed into the value element instead. |
| `unit` | string | — | Optional unit suffix rendered after the value in a smaller muted tone (e.g. `"ms"`, `"%"`, `"GB"`). |
| `icon` | string | — | Optional PascalCase lucide icon name (e.g. `"Activity"`, `"Zap"`) rendered as a leading inline SVG. Decorative — `aria-hidden`. |
| `hint` | string | — | Optional sub-text line beneath the value. When absent and a `slot="hint"` child is present, that child is distributed into the hint element instead. |

**JS Properties**

| Property | Type | Description |
|----------|------|-------------|
| `label` | `string` | Reflects the `label` attribute. |
| `value` | `string \| null` | Reflects the `value` attribute. |
| `unit` | `string \| null` | Reflects the `unit` attribute. |
| `icon` | `string \| null` | Reflects the `icon` attribute. |
| `hint` | `string \| null` | Reflects the `hint` attribute. |

**Events**

None. `tc-metric-tile` is a purely presentational element.

**Slots**

| Slot | Description |
|------|-------------|
| *(default)* | Rich value content. Used when the `value` attribute is absent. Distributed into `.tc-metric-tile-value`. |
| `hint` | Rich hint content. Used when the `hint` attribute is absent. Distributed into `.tc-metric-tile-hint`. |

**CSS Custom Properties**

| Property | Default | Description |
|----------|---------|-------------|
| `--bs-metric-tile-bg` | `var(--tc-surface)` | Card background. |
| `--bs-metric-tile-border-color` | `var(--tc-border)` | 1px hairline border color. |
| `--bs-metric-tile-shadow` | `var(--tc-shadow-sm)` | Resting box shadow. |
| `--bs-metric-tile-padding-y` | `1rem` | Vertical inner padding. |
| `--bs-metric-tile-padding-x` | `1.25rem` | Horizontal inner padding. |
| `--bs-metric-tile-gap` | `0.75rem` | Gap between leading icon and body. |
| `--bs-metric-tile-icon-size` | `1.25rem` | Leading icon SVG width/height. |
| `--bs-metric-tile-icon-color` | `var(--tc-text-muted)` | Leading icon color. |
| `--bs-metric-tile-label-color` | `var(--tc-text-muted)` | Micro-label text color. |
| `--bs-metric-tile-label-font-size` | `0.6875rem` | Micro-label font size (~11px). |
| `--bs-metric-tile-label-letter-spacing` | `0.08em` | Micro-label letter spacing. |
| `--bs-metric-tile-value-color` | `var(--tc-text)` | Value figure text color. |
| `--bs-metric-tile-value-font-size` | `1.5rem` | Value figure font size. |
| `--bs-metric-tile-value-font-weight` | `600` | Value figure font weight (≤600). |
| `--bs-metric-tile-unit-color` | `var(--tc-text-muted)` | Unit suffix text color. |
| `--bs-metric-tile-unit-font-size` | `0.875rem` | Unit suffix font size. |
| `--bs-metric-tile-hint-color` | `var(--tc-text-faint, var(--tc-text-muted))` | Hint line text color. |
| `--bs-metric-tile-hint-font-size` | `0.75rem` | Hint line font size. |

```html
<!-- Label and value -->
<tc-metric-tile label="Total Users" value="12,480"></tc-metric-tile>

<!-- Value with unit -->
<tc-metric-tile label="Avg Response" value="142" unit="ms"></tc-metric-tile>

<!-- With icon -->
<tc-metric-tile label="Revenue" value="$24,500" icon="DollarSign"></tc-metric-tile>

<!-- With hint -->
<tc-metric-tile label="Error Rate" value="0.4" unit="%" hint="Down 0.1% from last week"></tc-metric-tile>

<!-- Grid of tiles -->
<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:1rem">
  <tc-metric-tile label="Requests" value="3.2M" icon="Activity" hint="Last 24 hours"></tc-metric-tile>
  <tc-metric-tile label="Uptime" value="99.97" unit="%" icon="CheckCircle"></tc-metric-tile>
  <tc-metric-tile label="Latency P99" value="320" unit="ms" icon="Zap"></tc-metric-tile>
  <tc-metric-tile label="Active Sessions" value="1,804"></tc-metric-tile>
</div>

<!-- Slotted value (rich content) -->
<tc-metric-tile label="Build Status">
  <strong style="color:var(--tc-success)">Passing</strong>
</tc-metric-tile>

<!-- Slotted hint -->
<tc-metric-tile label="Open Tickets" value="42">
  <span slot="hint" style="color:var(--tc-danger)">3 critical</span>
</tc-metric-tile>
```

---

### tc-metric-grid

CSS-grid container for metric tiles with configurable column count (2, 3, or 4). Tiles can be supplied as a JS `items` array or as light-DOM children (`tc-metric-tile` elements or equivalent markup). No interactive targets — purely presentational.

**Tag:** `tc-metric-grid`

**Attributes**

| Attribute | Type | Default | Description |
|-----------|------|---------|-------------|
| `columns` | `2 \| 3 \| 4` | `3` | Number of grid columns. Clamped to `2`, `3`, or `4`; invalid values fall back to `3`. Collapses to fewer columns on narrow viewports. |

**JS Properties**

| Property | Type | Description |
|----------|------|-------------|
| `columns` | `MetricGridColumns` | Reflects the `columns` attribute as a number. |
| `items` | `MetricGridItem[]` | Array of tile data objects. Setting re-renders the generated tiles while preserving any slotted light-DOM children. Default `[]`. |

**`MetricGridItem` shape**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `label` | `string` | yes | Tile caption — rendered as an uppercase mono micro-label. |
| `value` | `string` | yes | Metric value rendered as the large display figure. |
| `unit` | `string` | no | Optional unit suffix (e.g. `"ms"`, `"%"`). |
| `icon` | `string` | no | Optional PascalCase lucide icon name (e.g. `"Activity"`, `"DollarSign"`). Decorative — `aria-hidden`. |
| `hint` | `string` | no | Optional faint sub-text line beneath the value. |
| `key` | `string` | no | Optional React-compatible key hint (not rendered). |

**Events**

None. `tc-metric-grid` is a purely presentational container.

**Slots**

| Slot | Description |
|------|-------------|
| *(default)* | Light-DOM tile children (e.g. `<tc-metric-tile>` elements). Rendered alongside — and after — tiles generated from the `items` property. Preserved across re-renders. |

**CSS Custom Properties**

| Property | Default | Description |
|----------|---------|-------------|
| `--bs-metric-grid-border-color` | `var(--tc-border)` | Hairline gap color (shown as the 1px grid background). |
| `--bs-metric-grid-bg` | `var(--tc-surface)` | Tile surface background within the grid. |
| `--bs-metric-grid-outer-border` | `1px solid var(--bs-metric-grid-border-color)` | Outer border wrapping the entire grid. |

```html
<!-- items property (set via JS) -->
<tc-metric-grid id="metrics" columns="3"></tc-metric-grid>
<script>
  document.getElementById('metrics').items = [
    { label: 'Total Users', value: '12,480', icon: 'Users' },
    { label: 'Revenue', value: '$24,500', unit: 'USD', icon: 'DollarSign' },
    { label: 'Avg Response', value: '142', unit: 'ms', icon: 'Zap', hint: 'P50 over 24 h' },
  ]
</script>

<!-- Slotted tc-metric-tile children -->
<tc-metric-grid columns="3">
  <tc-metric-tile label="Build Status" value="Passing" icon="CheckCircle"></tc-metric-tile>
  <tc-metric-tile label="Coverage" value="94.2" unit="%" icon="Shield"></tc-metric-tile>
  <tc-metric-tile label="Open PRs" value="7" hint="2 awaiting review"></tc-metric-tile>
</tc-metric-grid>

<!-- 4-column grid -->
<tc-metric-grid columns="4"></tc-metric-grid>

<!-- 2-column grid -->
<tc-metric-grid columns="2"></tc-metric-grid>
```

---

### tc-migration-guide

Step-by-step migration guide with a version transition header (from → to version labels) and numbered steps, each with an optional description and before/after code diff panels. Purely presentational — no interactive targets, no events.

**Tag:** `tc-migration-guide`

**Attributes**

| Attribute | Type | Default | Description |
|-----------|------|---------|-------------|
| `from` | `string` | `""` | Source version label (machine-facing, rendered mono). |
| `to` | `string` | `""` | Target version label (machine-facing, rendered mono). |
| `title` | `string` | `"Migrating from {from} to {to}"` | Optional heading for the guide. Defaults to an auto-generated label from `from` and `to` when absent. |

**JS Properties**

| Property | Type | Description |
|----------|------|-------------|
| `from` | `string` | Reflects the `from` attribute. |
| `to` | `string` | Reflects the `to` attribute. |
| `title` | `string \| null` | Reflects the `title` attribute. Setting `null` removes the attribute (restores the default). |
| `steps` | `MigrationStep[]` | Array of step objects. Setting re-renders the guide. Default `[]`. |

**`MigrationStep` shape**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `title` | `string` | yes | Step heading. |
| `description` | `string` | no | Explanatory prose below the heading, rendered in `--tc-text-muted`. |
| `before` | `string` | no | Code string shown in the "before" diff panel (danger-tinted, 3 px red left stripe). HTML is escaped. |
| `after` | `string` | no | Code string shown in the "after" diff panel (success-tinted, 3 px green left stripe). HTML is escaped. |
| `language` | `string` | no | Language hint (informational only — not rendered; syntax highlighting is not applied). |

**Events**

None. `tc-migration-guide` is purely presentational.

**Slots**

None. All content is supplied via attributes and the `steps` JS property.

**CSS Custom Properties**

| Property | Default | Description |
|----------|---------|-------------|
| `--bs-migration-guide-border` | `1px solid var(--tc-border)` | Outer and internal hairlines. |
| `--bs-migration-guide-bg` | `var(--tc-surface)` | Guide wrapper background. |
| `--bs-migration-guide-header-bg` | `var(--tc-surface-muted)` | Header region background. |
| `--bs-migration-guide-header-color` | `var(--tc-text)` | Title and step-title text color. |
| `--bs-migration-guide-title-font-size` | `0.9375rem` | Guide title font size. |
| `--bs-migration-guide-title-font-weight` | `600` | Guide title font weight. |
| `--bs-migration-guide-version-font-size` | `0.6875rem` | Version label font size. |
| `--bs-migration-guide-version-color` | `var(--tc-text-muted)` | Version label text color. |
| `--bs-migration-guide-arrow-size` | `0.9rem` | Arrow icon size. |
| `--bs-migration-guide-arrow-color` | `var(--tc-text-faint)` | Arrow icon color. |
| `--bs-migration-guide-step-num-font-size` | `0.6875rem` | Step number font size. |
| `--bs-migration-guide-step-num-color` | `var(--tc-text-faint)` | Step number color. |
| `--bs-migration-guide-step-desc-color` | `var(--tc-text-muted)` | Step description text color. |
| `--bs-migration-guide-code-bg` | `var(--tc-ink)` | Code panel background (dark surface). |
| `--bs-migration-guide-code-color` | `var(--tc-text-inverse)` | Code text color (white on dark). |
| `--bs-migration-guide-code-font-size` | `0.8125rem` | Code font size. |
| `--bs-migration-guide-diff-stripe-width` | `3px` | Width of the colored left stripe on diff panels. |
| `--bs-migration-guide-diff-before-stripe` | `var(--tc-danger)` | Before-panel left stripe color. |
| `--bs-migration-guide-diff-before-bg` | `var(--tc-danger-bg)` | Before-panel soft tint background. |
| `--bs-migration-guide-diff-after-stripe` | `var(--tc-success)` | After-panel left stripe color. |
| `--bs-migration-guide-diff-after-bg` | `var(--tc-success-bg)` | After-panel soft tint background. |

```html
<!-- Minimal — header only, no steps -->
<tc-migration-guide from="v1" to="v2"></tc-migration-guide>

<!-- Custom title -->
<tc-migration-guide from="v1" to="v2" title="Upgrading to v2"></tc-migration-guide>

<!-- With steps (set via JS) -->
<tc-migration-guide id="guide" from="v1.0" to="v2.0"></tc-migration-guide>
<script>
  document.getElementById('guide').steps = [
    {
      title: 'Update the import path',
      description: 'The package has moved to a scoped name.',
      before: "import { Button } from 'toolcase'",
      after: "import { Button } from '@toolcase/react-components'",
    },
    {
      title: 'Replace className with variant',
      before: '<Button className="btn-primary">Save</Button>',
      after: '<Button variant="primary">Save</Button>',
    },
  ]
</script>
```

---

### tc-quick-start

Numbered step-by-step guide with optional code snippets and output sections. Each step has a circular numbered marker connected by a vertical rail line. Code blocks include an optional copy button that dispatches a `tc-copy` event. Purely data-driven — no slot content.

**Tag:** `tc-quick-start`

**Attributes**

| Attribute | Type | Default | Description |
|-----------|------|---------|-------------|
| `title-text` | `string` | — | Optional heading rendered above the steps as an `<h2>`. The attribute is named `title-text` (not `title`) to avoid collision with the native `HTMLElement.title` tooltip property. |

**JS Properties**

| Property | Type | Description |
|----------|------|-------------|
| `titleText` | `string \| null` | Reflects the `title-text` attribute. Setting `null` removes the attribute. |
| `steps` | `QuickStartStep[]` | Array of step objects. Setting re-renders the guide. Default `[]`. |

**`QuickStartStep` shape**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `title` | `string` | yes | Step heading rendered as `<h3>`. |
| `description` | `string` | no | Prose paragraph below the heading, rendered in `--tc-text-muted`. |
| `code` | `string` | no | Code string shown in a `<pre><code>` block. HTML is escaped. A copy button appears when this field is present. |
| `output` | `string` | no | Output string shown in a `<pre>` block below the code block. HTML is escaped. |
| `language` | `string` | no | Language hint (informational only — not rendered; syntax highlighting is not applied). |

**Events**

| Event | Bubbles | Detail | Description |
|-------|---------|--------|-------------|
| `tc-copy` | yes (composed) | `{ code: string }` | Fired when the copy button on a code block is clicked. `detail.code` is the raw (unescaped) code string for that step. |

**Slots**

None. All content is supplied via the `title-text` attribute and the `steps` JS property.

**CSS Custom Properties**

| Property | Default | Description |
|----------|---------|-------------|
| `--bs-quick-start-title-font-size` | `1.125rem` | Title heading font size. |
| `--bs-quick-start-title-font-weight` | `600` | Title heading font weight. |
| `--bs-quick-start-title-color` | `var(--tc-text)` | Title heading text color. |
| `--bs-quick-start-marker-size` | `2rem` | Diameter of the circular step-number marker. |
| `--bs-quick-start-marker-font-size` | `0.8125rem` | Font size of the number inside the marker. |
| `--bs-quick-start-marker-color` | `var(--tc-text-muted)` | Number text color inside the marker. |
| `--bs-quick-start-marker-border` | `1px solid var(--tc-border-strong)` | Ring border of the circular marker. |
| `--bs-quick-start-marker-bg` | `var(--tc-surface)` | Background fill of the circular marker. |
| `--bs-quick-start-connector-color` | `var(--tc-border)` | Color of the vertical rail line between markers. |
| `--bs-quick-start-step-title-font-size` | `0.9375rem` | Step heading font size. |
| `--bs-quick-start-step-title-font-weight` | `500` | Step heading font weight. |
| `--bs-quick-start-step-title-color` | `var(--tc-text)` | Step heading text color. |
| `--bs-quick-start-step-desc-font-size` | `0.875rem` | Step description font size. |
| `--bs-quick-start-step-desc-color` | `var(--tc-text-muted)` | Step description text color. |
| `--bs-quick-start-code-bg` | `var(--tc-surface-muted)` | Code block background (monospace surface). |
| `--bs-quick-start-code-color` | `var(--tc-text)` | Code block text color. |
| `--bs-quick-start-code-font-size` | `0.8125rem` | Code block font size. |
| `--bs-quick-start-code-border` | `1px solid var(--tc-border)` | Code block hairline border. |
| `--bs-quick-start-output-bg` | `var(--tc-surface-hover)` | Output block background (distinct from code surface). |
| `--bs-quick-start-output-color` | `var(--tc-text-muted)` | Output block text color. |
| `--bs-quick-start-output-font-size` | `0.8125rem` | Output block font size. |
| `--bs-quick-start-output-border` | `1px solid var(--tc-border)` | Output block border (top edge omitted — shares border with code block above). |
| `--bs-quick-start-copy-size` | `1.75rem` | Copy button square size. |
| `--bs-quick-start-copy-color` | `var(--tc-text-muted)` | Copy button icon color. |
| `--bs-quick-start-copy-hover-bg` | `var(--tc-surface-hover)` | Copy button hover fill. |
| `--bs-quick-start-copy-hover-color` | `var(--tc-text)` | Copy button icon color on hover. |
| `--bs-quick-start-copy-icon-size` | `0.875rem` | Copy icon size. |

```html
<!-- Steps only (no title) -->
<tc-quick-start id="qs"></tc-quick-start>
<script>
  document.getElementById('qs').steps = [
    {
      title: 'Install the package',
      description: 'Add the package to your project.',
      code: 'npm install @toolcase/web-components',
      language: 'bash',
    },
    {
      title: 'Register',
      code: "import { register } from '@toolcase/web-components'\nregister()",
      language: 'typescript',
    },
  ]
</script>

<!-- With title-text and output -->
<tc-quick-start id="qs2" title-text="Quick Setup"></tc-quick-start>
<script>
  document.getElementById('qs2').steps = [
    {
      title: 'Run the build',
      code: 'npm run build',
      language: 'bash',
      output: '✓ Built in 1.2s',
    },
  ]
</script>

<!-- Listen for tc-copy to implement clipboard write -->
<tc-quick-start id="qs3"></tc-quick-start>
<script>
  const el = document.getElementById('qs3')
  el.steps = [{ title: 'Copy this', code: 'echo hello' }]
  el.addEventListener('tc-copy', e => {
    navigator.clipboard.writeText(e.detail.code)
  })
</script>
```

---

### tc-page-footer

Full-site footer with brand column, navigation menu columns, social icon links, optional CTA block, and a legal bar. All data is supplied via attributes and JS properties — no events emitted.

**Tag:** `tc-page-footer`

**Attributes**

| Attribute | Type | Default | Description |
|-----------|------|---------|-------------|
| `brand` | `string` | — | Mono wordmark text (rendered with cyan brand-dot treatment). When absent, the `brand` slot is used instead. |
| `tagline` | `string` | — | Short tagline shown below the brand wordmark. |
| `description` | `string` | — | Longer description below the tagline. |
| `legal-text` | `string` | — | Copyright / legal copy in the bottom legal bar (rendered in mono). |

**JS Properties**

| Property | Type | Description |
|----------|------|-------------|
| `brand` | `string \| null` | Reflects the `brand` attribute. |
| `tagline` | `string \| null` | Reflects the `tagline` attribute. |
| `description` | `string \| null` | Reflects the `description` attribute. |
| `legalText` | `string \| null` | Reflects the `legal-text` attribute. |
| `menus` | `PageFooterMenu[]` | Navigation link columns. Setting re-renders. Default `[]`. |
| `socialLinks` | `PageFooterSocialLink[]` | Social icon button row. Setting re-renders. Default `[]`. |
| `legalLinks` | `PageFooterLink[]` | Links rendered in the legal bar. Setting re-renders. Default `[]`. |
| `cta` | `PageFooterCta \| null` | Optional CTA block shown above the main grid. Default `null`. |

**`PageFooterMenu` shape**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `title` | `string` | yes | Column heading (mono, uppercase, muted). Also used as the `<nav aria-label>`. |
| `links` | `{ label: string; href: string }[]` | yes | Link list rendered under the title. |

**`PageFooterSocialLink` shape**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `icon` | `string` | yes | Lucide icon name in kebab-case (e.g. `'github'`, `'twitter'`, `'linkedin'`). |
| `href` | `string` | yes | Link URL. Opens in a new tab. |
| `label` | `string` | no | Accessible label for the icon button. Defaults to the `icon` value. |

**`PageFooterLink` shape**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `label` | `string` | yes | Link text. |
| `href` | `string` | yes | Link URL. |

**`PageFooterCta` shape**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `label` | `string` | yes | CTA button text. |
| `href` | `string` | yes | CTA button link URL. |
| `heading` | `string` | no | Optional heading above the button. |
| `description` | `string` | no | Optional description below the heading. |

**Events**

None. `tc-page-footer` is purely presentational.

**Slots**

| Slot | Description |
|------|-------------|
| `brand` | Custom brand mark content distributed into the brand-word area when the `brand` attribute is absent. |

**CSS Custom Properties**

| Property | Default | Description |
|----------|---------|-------------|
| `--bs-page-footer-bg` | `var(--tc-surface)` | Footer background. |
| `--bs-page-footer-color` | `var(--tc-text)` | Footer text color. |
| `--bs-page-footer-border-color` | `var(--tc-border)` | Hairline color for top border and section separators. |
| `--bs-page-footer-padding-x` | `2rem` | Horizontal padding for all sections. |
| `--bs-page-footer-padding-y` | `3rem` | Vertical padding for the main grid section. |
| `--bs-page-footer-brand-color` | `var(--tc-text)` | Brand wordmark text color. |
| `--bs-page-footer-brand-font-size` | `0.9375rem` | Brand wordmark font size. |
| `--bs-page-footer-brand-dot-bg` | `var(--tc-accent)` | Cyan accent dot color in the brand wordmark. |
| `--bs-page-footer-tagline-color` | `var(--tc-text)` | Tagline text color. |
| `--bs-page-footer-tagline-font-size` | `0.8125rem` | Tagline font size. |
| `--bs-page-footer-description-color` | `var(--tc-text-muted)` | Description text color. |
| `--bs-page-footer-menu-title-color` | `var(--tc-text-muted)` | Menu column title color. |
| `--bs-page-footer-menu-title-font-size` | `0.6875rem` | Menu column title font size. |
| `--bs-page-footer-link-color` | `var(--tc-text-muted)` | Menu link color at rest. |
| `--bs-page-footer-link-hover-color` | `var(--tc-accent)` | Menu link color on hover/focus. |
| `--bs-page-footer-link-font-size` | `0.875rem` | Menu link font size. |
| `--bs-page-footer-social-btn-size` | `2rem` | Social icon button size (width & height). |
| `--bs-page-footer-social-icon-size` | `1rem` | Social icon SVG size. |
| `--bs-page-footer-social-color` | `var(--tc-text-muted)` | Social icon color at rest. |
| `--bs-page-footer-social-hover-color` | `var(--tc-text)` | Social icon color on hover. |
| `--bs-page-footer-social-hover-bg` | `var(--tc-surface-muted)` | Social icon button hover background. |
| `--bs-page-footer-legal-color` | `var(--tc-text-muted)` | Legal text color. |
| `--bs-page-footer-legal-font-size` | `0.75rem` | Legal text and link font size. |
| `--bs-page-footer-legal-link-color` | `var(--tc-text-muted)` | Legal link color at rest. |
| `--bs-page-footer-legal-link-hover-color` | `var(--tc-text)` | Legal link color on hover. |
| `--bs-page-footer-cta-bg` | `var(--tc-surface-muted)` | CTA block background. |
| `--bs-page-footer-cta-border-color` | `var(--tc-border)` | CTA block bottom border color. |
| `--bs-page-footer-cta-heading-color` | `var(--tc-text)` | CTA heading text color. |
| `--bs-page-footer-cta-desc-color` | `var(--tc-text-muted)` | CTA description text color. |

```html
<!-- Minimal footer with brand and legal text -->
<tc-page-footer brand="toolcase" legal-text="© 2026 Toolcase."></tc-page-footer>

<!-- Full footer (menus, social, legal, cta via JS) -->
<tc-page-footer
  id="site-footer"
  brand="toolcase"
  tagline="The open-source UI toolkit"
  description="Framework-free components for modern web applications."
  legal-text="© 2026 Toolcase. All rights reserved."
></tc-page-footer>
<script>
  const footer = document.getElementById('site-footer')
  footer.menus = [
    {
      title: 'Product',
      links: [
        { label: 'Features', href: '/features' },
        { label: 'Pricing', href: '/pricing' },
      ],
    },
    {
      title: 'Company',
      links: [
        { label: 'About', href: '/about' },
        { label: 'Blog', href: '/blog' },
      ],
    },
  ]
  footer.socialLinks = [
    { icon: 'github', href: 'https://github.com', label: 'GitHub' },
    { icon: 'twitter', href: 'https://twitter.com', label: 'Twitter' },
  ]
  footer.legalLinks = [
    { label: 'Privacy Policy', href: '/privacy' },
    { label: 'Terms of Service', href: '/terms' },
  ]
  footer.cta = {
    heading: 'Start building today',
    description: 'Join thousands of developers shipping faster with Toolcase.',
    label: 'Get started free',
    href: '/signup',
  }
</script>

<!-- Brand slot (custom logo image instead of text wordmark) -->
<tc-page-footer legal-text="© 2026 Toolcase.">
  <img slot="brand" src="/logo.svg" alt="Toolcase" height="24" />
</tc-page-footer>
```

---

### tc-phase-grid

CSS-grid of phase/timeline cards with status indicators, optional description, tag chips, and a shell-command block. Status is conveyed by icon + text label (not color alone). No events emitted — purely presentational.

**Tag:** `tc-phase-grid`

**Attributes**

| Attribute | Type | Default | Description |
|-----------|------|---------|-------------|
| `columns` | `number` | `3` | Number of grid columns. Any positive integer; falls back to `3` on invalid/absent values. Collapses to fewer columns on narrow viewports. |

**JS Properties**

| Property | Type | Description |
|----------|------|-------------|
| `columns` | `number` | Reflects the `columns` attribute as a number. |
| `phases` | `PhaseItem[]` | Array of phase data objects. Setting re-renders the entire grid. Default `[]`. |

**`PhaseItem` shape**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `title` | `string` | yes | Phase title — rendered as Inter semibold. |
| `status` | `'complete' \| 'active' \| 'upcoming' \| 'blocked'` | yes | Phase status. Drives the status icon, left stripe color, and label. |
| `description` | `string` | no | Optional muted description paragraph below the title. |
| `tags` | `string[]` | no | Optional mono micro-label chips. Rendered in a flex-wrap row. |
| `command` | `string` | no | Optional shell/CLI command rendered as a mono `<code>` block on an ink background. |

**Events**

None. `tc-phase-grid` is purely presentational.

**Slots**

None. All content is supplied via the `phases` JS property.

**CSS Custom Properties**

| Property | Default | Description |
|----------|---------|-------------|
| `--bs-phase-grid-card-bg` | `var(--tc-surface)` | Card background color. |
| `--bs-phase-grid-card-border` | `var(--tc-border)` | Hairline color (1px-gap grid + outer border). |
| `--bs-phase-grid-card-padding` | `1.25rem` | Inner card padding. |
| `--bs-phase-grid-title-color` | `var(--tc-text)` | Title text color. |
| `--bs-phase-grid-title-font-size` | `0.9375rem` | Title font size. |
| `--bs-phase-grid-title-font-weight` | `600` | Title font weight. |
| `--bs-phase-grid-desc-color` | `var(--tc-text-muted)` | Description text color. |
| `--bs-phase-grid-desc-font-size` | `0.8125rem` | Description font size. |
| `--bs-phase-grid-status-label-font-size` | `0.6875rem` | Status indicator label font size. |
| `--bs-phase-grid-status-icon-size` | `0.875rem` | Status icon size. |
| `--bs-phase-grid-complete-color` | `var(--tc-success)` | Color for `complete` status icon and left stripe. |
| `--bs-phase-grid-active-color` | `var(--tc-info)` | Color for `active` status icon and left stripe. |
| `--bs-phase-grid-upcoming-color` | `var(--tc-text-faint)` | Color for `upcoming` status icon and left stripe. |
| `--bs-phase-grid-blocked-color` | `var(--tc-danger)` | Color for `blocked` status icon and left stripe. |
| `--bs-phase-grid-stripe-width` | `3px` | Width of the colored left-border stripe on each card. |
| `--bs-phase-grid-tag-bg` | `var(--tc-surface-muted)` | Tag chip background. |
| `--bs-phase-grid-tag-color` | `var(--tc-text-muted)` | Tag chip text color. |
| `--bs-phase-grid-tag-border` | `var(--tc-border)` | Tag chip border color. |
| `--bs-phase-grid-tag-font-size` | `0.6875rem` | Tag chip font size. |
| `--bs-phase-grid-command-bg` | `var(--tc-ink)` | Command block background (dark ink surface). |
| `--bs-phase-grid-command-color` | `var(--tc-text-inverse)` | Command block text color. |
| `--bs-phase-grid-command-font-size` | `0.75rem` | Command block font size. |
| `--bs-phase-grid-active-spin-duration` | `1.5s` | Rotation period for the active status spinner icon. |
| `--bs-phase-grid-active-spin-duration-reduced` | `3s` | Reduced-motion rotation period (slows rather than stops). |

```html
<!-- Set phases via JS property -->
<tc-phase-grid id="roadmap" columns="3"></tc-phase-grid>
<script>
  document.getElementById('roadmap').phases = [
    {
      title: 'Project Setup',
      description: 'Initialise repo, CI/CD, and base tooling.',
      status: 'complete',
      tags: ['infra', 'ci'],
      command: 'npm create toolcase@latest my-app',
    },
    {
      title: 'Core Features',
      description: 'Implement the primary user-facing features.',
      status: 'active',
      tags: ['feature', 'v1'],
      command: 'npm run dev',
    },
    {
      title: 'Testing & QA',
      description: 'Full coverage for unit, integration, and E2E tests.',
      status: 'upcoming',
      tags: ['testing'],
      command: 'npm test',
    },
  ]
</script>

<!-- 2 columns -->
<tc-phase-grid id="blocked-phases" columns="2"></tc-phase-grid>
<script>
  document.getElementById('blocked-phases').phases = [
    { title: 'Database Migration', status: 'blocked', tags: ['database'] },
    { title: 'Auth Integration', status: 'upcoming', command: 'npx auth setup' },
  ]
</script>

<!-- 4 columns — compact -->
<tc-phase-grid id="compact" columns="4"></tc-phase-grid>
<script>
  document.getElementById('compact').phases = [
    { title: 'Planning', status: 'complete' },
    { title: 'Development', status: 'active' },
    { title: 'Review', status: 'upcoming' },
    { title: 'Deploy', status: 'upcoming' },
  ]
</script>
```

---

### tc-pinned-feature-showcase

Two-column showcase with a sticky/centred left panel and a scrollable right-side item list. The left panel can hold a heading group, optional media (image or slotted content), and optional CTAs. Items on the right carry an optional lucide icon, a title, and optional description text. On narrow viewports the layout collapses to a single column and sticky behaviour is disabled.

**Tag:** `tc-pinned-feature-showcase`

**Attributes**

| Attribute | Type | Required | Description |
|-----------|------|----------|-------------|
| `title` | `string` | yes | Left-panel heading (rendered as `<h2>`). Also used as the accessible name for the landmark `<section>` via `aria-labelledby`. |
| `description` | `string` | yes | Left-panel sub-text below the heading. |
| `eyebrow` | `string` | no | Small mono kicker rendered above the title — uppercase, letter-spaced. |
| `image-src` | `string` | no | URL of the left-panel media image. Rendered as `<img loading="lazy">` when no `media` slot content is present. |
| `image-alt` | `string` | no | Alt text for the image (defaults to `""`). |

**JS Properties**

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `items` | `PinnedFeatureShowcaseItem[]` | `[]` | Right-side feature list. Setting the property triggers a re-render. |
| `title` | `string` | `""` | Reflects the `title` attribute. |
| `description` | `string` | `""` | Reflects the `description` attribute. |
| `eyebrow` | `string \| null` | `null` | Reflects the `eyebrow` attribute. |
| `imageSrc` | `string \| null` | `null` | Reflects the `image-src` attribute. |
| `imageAlt` | `string` | `""` | Reflects the `image-alt` attribute. |

**`PinnedFeatureShowcaseItem` shape**

```ts
interface PinnedFeatureShowcaseItem {
  title: string        // Item heading
  description?: string // Optional body text
  icon?: string        // Optional lucide icon name (kebab-case, e.g. "package", "layers")
}
```

**Events**

None. `tc-pinned-feature-showcase` is purely presentational.

**Slots**

| Slot | Description |
|------|-------------|
| `media` | Custom left-panel media content (image, video, illustration, etc.). When present, overrides `image-src`. Rendered inside `.tc-pinned-feature-showcase-media`. |
| `ctas` | Call-to-action elements (e.g. `tc-button`) placed beneath the description in the left panel. Rendered inside `.tc-pinned-feature-showcase-ctas` (hidden when empty). |

**CSS Custom Properties**

| Property | Default | Description |
|----------|---------|-------------|
| `--bs-pinned-feature-showcase-sticky-top` | `4rem` | `top` offset for the sticky left panel. |
| `--bs-pinned-feature-showcase-gap` | `4rem` | Column gap between panel and item list (desktop). |
| `--bs-pinned-feature-showcase-panel-width` | `40%` | Width of the left panel column. |
| `--bs-pinned-feature-showcase-eyebrow-color` | `var(--tc-text-muted)` | Eyebrow text color. |
| `--bs-pinned-feature-showcase-eyebrow-font-size` | `0.6875rem` | Eyebrow font size. |
| `--bs-pinned-feature-showcase-eyebrow-letter-spacing` | `0.08em` | Eyebrow letter spacing. |
| `--bs-pinned-feature-showcase-title-color` | `var(--tc-text)` | Panel title color. |
| `--bs-pinned-feature-showcase-title-font-size` | `1.75rem` | Panel title font size. |
| `--bs-pinned-feature-showcase-title-font-weight` | `600` | Panel title font weight (≤ 600). |
| `--bs-pinned-feature-showcase-desc-color` | `var(--tc-text-muted)` | Panel description text color. |
| `--bs-pinned-feature-showcase-desc-font-size` | `1rem` | Panel description font size. |
| `--bs-pinned-feature-showcase-item-padding-y` | `1.5rem` | Vertical padding of each item row. |
| `--bs-pinned-feature-showcase-item-border` | `var(--tc-border)` | Color of the 1px hairline between items. |
| `--bs-pinned-feature-showcase-item-gap` | `1rem` | Gap between icon and item text. |
| `--bs-pinned-feature-showcase-item-title-color` | `var(--tc-text)` | Item title color. |
| `--bs-pinned-feature-showcase-item-title-font-size` | `1.0625rem` | Item title font size. |
| `--bs-pinned-feature-showcase-item-title-font-weight` | `600` | Item title font weight (≤ 600). |
| `--bs-pinned-feature-showcase-item-desc-color` | `var(--tc-text-muted)` | Item description text color. |
| `--bs-pinned-feature-showcase-item-desc-font-size` | `0.9375rem` | Item description font size. |
| `--bs-pinned-feature-showcase-item-icon-size` | `1.25rem` | Lucide icon size (width and height). |
| `--bs-pinned-feature-showcase-item-icon-color` | `var(--tc-text-muted)` | Lucide icon color (`currentColor`). |

```html
<!-- Basic usage -->
<tc-pinned-feature-showcase
  eyebrow="Framework-free"
  title="Build once, run anywhere"
  description="Drop into any stack without configuration."
  image-src="/hero.png"
  image-alt="Product screenshot"
  id="showcase"
>
  <tc-button slot="ctas" variant="primary">Get started</tc-button>
  <tc-button slot="ctas" variant="secondary">View docs</tc-button>
</tc-pinned-feature-showcase>
<script>
  document.getElementById('showcase').items = [
    { title: 'Zero dependencies', description: 'Pure ESM/CJS, no runtime overhead.', icon: 'package' },
    { title: 'Design-token driven', description: 'Override any value with a CSS custom property.', icon: 'palette' },
    { title: 'Accessible', description: 'Landmark roles, aria-labelledby, and keyboard focus out of the box.', icon: 'accessibility' },
  ]
</script>

<!-- Custom media slot (overrides image-src) -->
<tc-pinned-feature-showcase title="Custom media" description="Slot any content into the left panel.">
  <video slot="media" src="/demo.mp4" autoplay muted loop></video>
</tc-pinned-feature-showcase>
```

---

### tc-pricing-card

Pricing tier card with a feature list, action button, and optional highlight/badge. Sharp corners everywhere; the highlight variant adds a 135° slate-ink top cap and a stronger `--tc-app-accent` border. The action button reuses the primary-button motif. Feature glyphs use `--tc-success` for included items and `--tc-text-faint` for excluded ones.

**Tag:** `tc-pricing-card`

**Attributes**

| Attribute | Type | Default | Description |
|-----------|------|---------|-------------|
| `name` | string | `""` | Plan name displayed as the card heading. |
| `price` | string | `""` | Price string (e.g. `"$29"`, `"Free"`). Rendered in JetBrains Mono. |
| `period` | string | — | Billing period (e.g. `"/ month"`). Rendered in JetBrains Mono, muted. Omit for one-time or custom pricing. |
| `description` | string | — | Short description beneath the price line. |
| `badge-text` | string | — | Optional badge label (e.g. `"Most popular"`). Rendered as a rectangular mono flag at the top of the card. |
| `highlight` | boolean | `false` | When present, applies the highlight variant: `--tc-app-accent` border, 135° ink top cap, and a stronger shadow. |

**JS Properties**

| Property | Type | Description |
|----------|------|-------------|
| `name` | `string` | Reflects the `name` attribute. |
| `price` | `string` | Reflects the `price` attribute. |
| `period` | `string \| null` | Reflects the `period` attribute. |
| `description` | `string \| null` | Reflects the `description` attribute. |
| `badgeText` | `string \| null` | Reflects the `badge-text` attribute. |
| `highlight` | `boolean` | Reflects the `highlight` boolean attribute. |
| `features` | `Array<string \| PricingCardFeature>` | Feature list. A plain string means included (`true`). `PricingCardFeature: { label: string; included?: boolean }` — `included` defaults to `true` when omitted. Setting this property re-renders. |
| `action` | `PricingCardAction` | Action button descriptor. `PricingCardAction: { label: string; href?: string; onClick?: () => void; variant?: string; disabled?: boolean }`. When `href` is set (and not `disabled`), renders an `<a>`; otherwise renders a `<button>`. Setting this property re-renders. |

**Events**

| Event | Detail | Description |
|-------|--------|-------------|
| `tc-action` | `{}` | Fired (bubbles, composed) when the action button is clicked and the action is not disabled. The `action.onClick` callback is also called if provided. |

**Slots**

None. All content is driven by attributes and JS properties.

**CSS Custom Properties**

| Property | Default | Description |
|----------|---------|-------------|
| `--bs-pricing-card-bg` | `var(--tc-surface)` | Card background. |
| `--bs-pricing-card-border-color` | `var(--tc-border)` | Default 1px hairline border colour. |
| `--bs-pricing-card-shadow` | `var(--tc-shadow-sm)` | Default card shadow. |
| `--bs-pricing-card-padding-y` | `1.5rem` | Vertical card padding. |
| `--bs-pricing-card-padding-x` | `1.5rem` | Horizontal card padding. |
| `--bs-pricing-card-gap` | `1.25rem` | Gap between card sections. |
| `--bs-pricing-card-name-color` | `var(--tc-text)` | Plan name text colour. |
| `--bs-pricing-card-name-size` | `1.0625rem` | Plan name font size. |
| `--bs-pricing-card-price-color` | `var(--tc-text)` | Price text colour. |
| `--bs-pricing-card-price-size` | `1.875rem` | Price font size. |
| `--bs-pricing-card-period-color` | `var(--tc-text-muted)` | Period text colour. |
| `--bs-pricing-card-period-size` | `0.875rem` | Period font size. |
| `--bs-pricing-card-desc-color` | `var(--tc-text-muted)` | Description text colour. |
| `--bs-pricing-card-badge-bg` | `var(--tc-app-accent)` | Badge background colour. |
| `--bs-pricing-card-badge-color` | `#fff` | Badge text colour. |
| `--bs-pricing-card-feature-included-color` | `var(--tc-success)` | Colour of the check glyph for included features. |
| `--bs-pricing-card-feature-excluded-color` | `var(--tc-text-faint)` | Colour of the x/minus glyph and label for excluded features. |
| `--bs-pricing-card-feature-label-color` | `var(--tc-text)` | Feature label text colour (included items). |
| `--bs-pricing-card-feature-icon-size` | `1rem` | Feature glyph size. |
| `--bs-pricing-card-highlight-border-color` | `var(--tc-app-accent)` | Border colour for the highlight variant. |
| `--bs-pricing-card-highlight-shadow` | `0 4px 20px rgba(30,41,59,0.18)` | Shadow for the highlight variant. |
| `--bs-pricing-card-highlight-cap-bg` | `linear-gradient(135deg, var(--tc-app-accent), #2b3a51)` | Gradient for the 4px top cap on the highlight variant. |

```html
<!-- Free tier -->
<tc-pricing-card
    id="free-card"
    name="Free"
    price="$0"
    period="/ month"
    description="Everything you need to get started."
></tc-pricing-card>
<script>
    document.getElementById('free-card').features = [
        { label: '5 projects', included: true },
        { label: '1 GB storage', included: true },
        { label: 'Custom domains', included: false },
    ]
    document.getElementById('free-card').action = {
        label: 'Get started free',
        href: '/signup',
    }
</script>

<!-- Highlighted Pro tier with badge and event listener -->
<tc-pricing-card
    id="pro-card"
    name="Pro"
    price="$29"
    period="/ month"
    description="For growing teams and serious projects."
    highlight
    badge-text="Most popular"
></tc-pricing-card>
<script>
    const pro = document.getElementById('pro-card')
    pro.features = [
        'Unlimited projects',
        '50 GB storage',
        'Priority support',
        'Custom domains',
        'Advanced analytics',
    ]
    pro.action = {
        label: 'Start Pro trial',
        onClick: () => console.log('Pro plan selected'),
    }
    pro.addEventListener('tc-action', e => {
        console.log('tc-action fired', e.detail)
    })
</script>

### tc-file

Full-featured file entry row with an inline-editable name, format badge, human-formatted byte size, nested item count, tag chips, and an action menu. Sharp corners (`border-radius: 0`); slate neutrals throughout. All content is driven by attributes and JS properties — no slots.

**Tag:** `tc-file`

**Attributes**

| Attribute | Type | Default | Description |
|-----------|------|---------|-------------|
| `name` | string | — | Base filename (editable inline when not `readonly`) |
| `extension` | string | — | File extension with optional leading dot, e.g. `".pdf"` or `"pdf"`. Displayed as a mono label beside the name |
| `format` | string | — | Format label for the badge chip, e.g. `"PDF"`. Rendered uppercase in monospace |
| `size` | number (string attr) | `0` | File size in bytes — rendered human-friendly (e.g. `1.2 MB`). `0` hides the size |
| `items` | number (string attr) | `0` | Nested item count. `0` hides the items label |
| `readonly` | boolean | `false` | Disables name editing and hides the action menu |
| `loading` | boolean | `false` | Shows animated skeleton placeholder rows instead of content |

**JS Properties**

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `tags` | `FileTag[]` | `[]` | Tag definitions — each `{ id: string, label: string, color?: string }`. Used to resolve `tagIds` to visible chips |
| `tagIds` | `string[]` | `[]` | IDs of the tags to render as chips (resolved against `tags`) |
| `menuItems` | `ActionItem[]` | `[]` | Action menu items — each `{ key: string, label: string, icon?: string, disabled?: boolean }`. Empty array hides the menu button |
| `onNameChange` | `(name: string) => void \| null` | `null` | Callback invoked alongside `tc-name-change` when the user commits a rename |
| `onTagsChange` | `(tagIds: string[]) => void \| null` | `null` | Callback invoked alongside `tc-tags-change` |
| `onMenuItemClick` | `(key: string) => void \| null` | `null` | Callback invoked alongside `tc-menu-item-click` when a menu item is activated |

**Events**

| Event | Detail | Description |
|-------|--------|-------------|
| `tc-name-change` | `{ name: string }` | Fired (bubbles, composed) when the user commits a filename edit via Enter or blur. Escape cancels without firing |
| `tc-tags-change` | `{ tagIds: string[] }` | Fired (bubbles, composed) when the selected tag set changes |
| `tc-menu-item-click` | `{ key: string }` | Fired (bubbles, composed) when a menu item is clicked or activated via keyboard |

**Slots**

None. All content is driven by attributes and JS properties.

**CSS custom properties (theming)**

| Property | Default | Description |
|----------|---------|-------------|
| `--bs-file-bg` | `var(--tc-surface)` | Row background |
| `--bs-file-border-color` | `var(--tc-border)` | 1px row hairline |
| `--bs-file-padding-x` | `0.875rem` | Horizontal row padding |
| `--bs-file-padding-y` | `0.625rem` | Vertical row padding |
| `--bs-file-gap` | `0.5rem` | Gap between row children |
| `--bs-file-hover-bg` | `var(--tc-surface-hover)` | Row hover fill |
| `--bs-file-icon-size` | `1rem` | Leading file icon size |
| `--bs-file-icon-color` | `var(--tc-text-muted)` | Leading file icon color |
| `--bs-file-format-bg` | `var(--tc-surface-muted)` | Format badge fill |
| `--bs-file-format-color` | `var(--tc-text)` | Format badge text color |
| `--bs-file-format-border-color` | `var(--tc-border)` | Format badge hairline |
| `--bs-file-format-font-size` | `0.6rem` | Format badge font size |
| `--bs-file-name-color` | `var(--tc-text)` | Filename text color |
| `--bs-file-name-font-size` | `0.875rem` | Filename font size |
| `--bs-file-ext-color` | `var(--tc-text-muted)` | Extension label color |
| `--bs-file-ext-font-size` | `0.75rem` | Extension label font size |
| `--bs-file-meta-color` | `var(--tc-text-muted)` | Size/items meta text color |
| `--bs-file-meta-font-size` | `0.75rem` | Size/items meta font size |
| `--bs-file-chip-bg` | `var(--tc-surface-muted)` | Tag chip background |
| `--bs-file-chip-color` | `var(--tc-text-muted)` | Tag chip text/border color (overridden per-chip via `--tc-file-chip-color`) |
| `--bs-file-menu-size` | `2rem` | Menu trigger button square size |
| `--bs-file-menu-color` | `var(--tc-text-muted)` | Menu icon color |
| `--bs-file-menu-hover-bg` | `var(--tc-surface-muted)` | Menu trigger hover fill |
| `--bs-file-dropdown-shadow` | `var(--tc-shadow-lg)` | Dropdown overlay shadow |

```html
<!-- Editable file with format badge, size, and tags -->
<tc-file name="Q3-Report" extension=".pdf" format="PDF" size="2621440" items="12"></tc-file>
<script>
  const el = document.querySelector('tc-file')
  el.tags = [
    { id: 'design', label: 'Design', color: '#0ea5e9' },
    { id: 'review', label: 'Review', color: '#f59e0b' },
  ]
  el.tagIds = ['design', 'review']
  el.menuItems = [
    { key: 'rename', label: 'Rename', icon: 'Pencil' },
    { key: 'delete', label: 'Delete', icon: 'Trash2' },
  ]
  el.addEventListener('tc-name-change', e => console.log('rename:', e.detail.name))
  el.addEventListener('tc-menu-item-click', e => console.log('menu:', e.detail.key))
</script>

<!-- Readonly variant -->
<tc-file readonly name="hero-image" extension=".png" format="PNG" size="5242880"></tc-file>

<!-- Loading skeleton -->
<tc-file loading></tc-file>
```

---

### tc-queued-file

File-queue item row displaying a leading file icon, the file name with extension, a rectangular format badge, and a human-formatted byte size. Trailing dismiss button dispatches `tc-dismiss` and optionally invokes the `onDismiss` callback property. Sharp corners everywhere (`border-radius: 0`); slate neutrals throughout; format badge rendered in JetBrains Mono uppercase. Non-slotted — all content is attribute-driven.

**Tag:** `tc-queued-file`

**Attributes**

| Attribute | Type | Default | Description |
|-----------|------|---------|-------------|
| `name` | string | — | Base file name (without extension), e.g. `"report"` |
| `extension` | string | — | File extension including optional dot, e.g. `".pdf"` or `"pdf"`. Appended to `name` in the display label |
| `format` | string | — | Format label shown in the rectangular badge, e.g. `"pdf"`. Rendered uppercase in JetBrains Mono |
| `size` | number (string attr) | `0` | File size in bytes. Formatted as human-readable (e.g. `1.2 MB`). `0` renders `—` |

**JS Properties**

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `onDismiss` | `() => void \| null` | `null` | Optional callback invoked alongside the `tc-dismiss` event when the dismiss button is activated |

**Events**

| Event | Detail | Description |
|-------|--------|-------------|
| `tc-dismiss` | — | Fired (bubbles, composed) when the dismiss button is clicked or activated via keyboard. The element is **not** removed from the DOM automatically — the host controls removal. |

**Slots**

None. All content is driven by attributes.

**CSS custom properties (theming)**

| Property | Default | Description |
|----------|---------|-------------|
| `--bs-queued-file-bg` | `var(--tc-surface)` | Row background |
| `--bs-queued-file-border-color` | `var(--tc-border)` | 1px outer hairline |
| `--bs-queued-file-padding-x` | `0.875rem` | Horizontal row padding |
| `--bs-queued-file-padding-y` | `0.625rem` | Vertical row padding |
| `--bs-queued-file-gap` | `0.625rem` | Gap between leading icon, body, and dismiss button |
| `--bs-queued-file-icon-size` | `1.125rem` | File icon size |
| `--bs-queued-file-icon-color` | `var(--tc-text-muted)` | File icon color |
| `--bs-queued-file-name-color` | `var(--tc-text)` | File name text color |
| `--bs-queued-file-name-font-size` | `0.9rem` | File name font size |
| `--bs-queued-file-size-color` | `var(--tc-text-faint)` | Byte size text color |
| `--bs-queued-file-size-font-size` | `0.75rem` | Byte size font size |
| `--bs-queued-file-format-bg` | `var(--tc-surface-muted)` | Format badge fill |
| `--bs-queued-file-format-color` | `var(--tc-text-muted)` | Format badge text color |
| `--bs-queued-file-format-border-color` | `var(--tc-border)` | Format badge hairline |
| `--bs-queued-file-format-font-size` | `0.6875rem` | Format badge font size |
| `--bs-queued-file-dismiss-size` | `2rem` | Dismiss button square size |
| `--bs-queued-file-dismiss-color` | `var(--tc-text-muted)` | Dismiss button icon color |
| `--bs-queued-file-dismiss-hover-bg` | `var(--tc-surface-muted)` | Dismiss button hover fill |
| `--bs-queued-file-dismiss-hover-color` | `var(--tc-text)` | Dismiss button icon color on hover |
| `--bs-queued-file-dismiss-icon-size` | `0.875rem` | Dismiss (×) icon size |

```html
<!-- Basic file entry -->
<tc-queued-file name="Q3-Report" extension=".pdf" format="pdf" size="1258291"></tc-queued-file>

<!-- Listen for tc-dismiss to remove from queue -->
<tc-queued-file id="f1" name="hero-image" extension=".jpg" format="jpg" size="3407872"></tc-queued-file>
<script>
    document.getElementById('f1').addEventListener('tc-dismiss', e => {
        e.target.remove()
    })
</script>

<!-- onDismiss callback property -->
<tc-queued-file id="f2" name="dataset" extension=".csv" format="csv" size="45056"></tc-queued-file>
<script>
    const el = document.getElementById('f2')
    el.onDismiss = () => el.remove()
</script>
```

---

### tc-rank-cell

Zero-padded rank number with tier accent for top-three positions. Gold for rank 1, silver for 2, bronze for 3, neutral slate for rank 4 and above. Designed to drop into table and list cells — sharp corners, JetBrains Mono, tabular-nums alignment. Purely presentational — no interaction, no events.

**Tag:** `tc-rank-cell`

**Attributes**

| Attribute | Type | Default | Description |
|-----------|------|---------|-------------|
| `rank` | number (string attr) | `0` | The rank position to display. `1` → gold, `2` → silver, `3` → bronze, `4+` → default neutral. |
| `pad` | number (string attr) | `2` | Minimum digit width for zero-padding. `pad=2` renders `01`, `07`, `12`; `pad=3` renders `001`, `017`. |

**JS Properties**

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `rank` | `number` | `0` | Reflects the `rank` attribute as a parsed integer. |
| `pad` | `number` | `2` | Reflects the `pad` attribute as a parsed integer. Falls back to `2` when the attribute is absent or not a positive integer. |

**Events**

None. `tc-rank-cell` is purely presentational.

**Slots**

None. All content is driven by attributes.

**CSS custom properties (theming)**

| Property | Default | Description |
|----------|---------|-------------|
| `--bs-rank-cell-gold` | `#d97706` | Warm amber accent color for rank 1 (left stripe + text). |
| `--bs-rank-cell-silver` | `#94a3b8` | Slate-silver accent color for rank 2 (left stripe + text). |
| `--bs-rank-cell-bronze` | `#b45309` | Bronze-brown accent color for rank 3 (left stripe + text). |
| `--bs-rank-cell-stripe-width` | `3px` | Width of the left accent stripe. |
| `--bs-rank-cell-font-size` | `0.8125rem` | Number font size (JetBrains Mono, weight 500). |
| `--bs-rank-cell-pad-x` | `0.5rem` | Horizontal inner padding. |
| `--bs-rank-cell-pad-y` | `0.1875rem` | Vertical inner padding. |

```html
<!-- Top-three tiers -->
<tc-rank-cell rank="1" pad="2"></tc-rank-cell>
<tc-rank-cell rank="2" pad="2"></tc-rank-cell>
<tc-rank-cell rank="3" pad="2"></tc-rank-cell>

<!-- Default tier -->
<tc-rank-cell rank="4"  pad="2"></tc-rank-cell>
<tc-rank-cell rank="17" pad="2"></tc-rank-cell>

<!-- Wider pad -->
<tc-rank-cell rank="1"   pad="3"></tc-rank-cell>
<tc-rank-cell rank="100" pad="3"></tc-rank-cell>

<!-- JS property access -->
<tc-rank-cell id="r1"></tc-rank-cell>
<script>
    const el = document.getElementById('r1')
    el.rank = 1
    el.pad = 2
</script>
```
```

---

### tc-rich-page-header

Page-level hero element with an optional square icon tile, chip row, title (`<h1>`), subtitle, description, and a trailing actions area. The icon tile is decorative (`aria-hidden`) — status meaning is conveyed by visible text. Slotted actions are real interactive elements with their own focus visibility. Purely presentational — no events.

**Tag:** `tc-rich-page-header`

**Attributes**

| Attribute | Type | Default | Description |
|-----------|------|---------|-------------|
| `title-text` | `string` | `""` | The page title rendered as an `<h1>`. Uses `title-text` (not `title`) to avoid the native `HTMLElement.title` tooltip attribute. |
| `sub` | `string` | — | Optional subtitle rendered below the title in muted text. |
| `description` | `string` | — | Optional description paragraph rendered below the subtitle in faint text. |
| `icon-name` | `string` | — | Lucide icon name (PascalCase, e.g. `Database`, `ShieldCheck`). Renders an inline SVG glyph inside the icon tile. Omit to hide the tile entirely. |
| `icon-color` | `RichPageHeaderIconColor` | `"slate"` | Tint applied to the icon tile background and stroke. One of: `violet`, `cyan`, `emerald`, `amber`, `pink`, `blue`, `slate`, `rose`. Defaults to `slate` (neutral muted surface). |

**JS Properties**

| Property | Type | Reflects | Description |
|----------|------|----------|-------------|
| `titleText` | `string \| null` | `title-text` attr | Gets/sets the `title-text` attribute. |
| `sub` | `string \| null` | `sub` attr | Gets/sets the `sub` attribute. |
| `description` | `string \| null` | `description` attr | Gets/sets the `description` attribute. |
| `iconName` | `string \| null` | `icon-name` attr | Gets/sets the `icon-name` attribute. |
| `iconColor` | `RichPageHeaderIconColor` | `icon-color` attr | Gets/sets the `icon-color` attribute. Defaults to `"slate"` when the attribute is absent or invalid. |

**Events**

None. `tc-rich-page-header` is purely presentational.

**Slots**

| Slot | Description |
|------|-------------|
| `chips` | Named slot for chip/badge children rendered in a flex row above the title. Use `<… slot="chips">` on any child element. |
| `actions` | Named slot for action buttons rendered to the right of the header body (stacks below on narrow screens). Use `<… slot="actions">` on any child element. |

**CSS custom properties (theming)**

| Property | Default | Description |
|----------|---------|-------------|
| `--bs-rich-page-header-bg` | `var(--tc-surface)` | Header background color. |
| `--bs-rich-page-header-border-color` | `var(--tc-border)` | Bottom hairline border color. |
| `--bs-rich-page-header-padding-y` | `1.5rem` | Vertical padding. |
| `--bs-rich-page-header-padding-x` | `0` | Horizontal padding. |
| `--bs-rich-page-header-gap` | `1rem` | Gap between icon tile and body, and between main and actions. |
| `--bs-rich-page-header-body-gap` | `0.5rem` | Gap between chips, title, sub, and description. |
| `--bs-rich-page-header-title-color` | `var(--tc-text)` | Title text color. |
| `--bs-rich-page-header-title-font-size` | `1.25rem` | Title font size (1.5rem on md+). |
| `--bs-rich-page-header-title-weight` | `600` | Title font weight (capped at 600). |
| `--bs-rich-page-header-sub-color` | `var(--tc-text-muted)` | Subtitle text color. |
| `--bs-rich-page-header-sub-font-size` | `0.9375rem` | Subtitle font size. |
| `--bs-rich-page-header-description-color` | `var(--tc-text-faint)` | Description text color. |
| `--bs-rich-page-header-description-font-size` | `0.875rem` | Description font size. |
| `--bs-rich-page-header-icon-size` | `3rem` | Icon tile width and height (square). |
| `--bs-rich-page-header-icon-glyph-size` | `1.25rem` | SVG glyph size inside the tile. |
| `--bs-rich-page-header-icon-bg` | `var(--tc-surface-muted)` | Icon tile background (overridden per color variant). |
| `--bs-rich-page-header-icon-color` | `var(--tc-text)` | Icon tile SVG stroke color (overridden per color variant). |
| `--bs-rich-page-header-icon-border-color` | `var(--tc-border)` | Icon tile border color (overridden per color variant). |
| `--bs-rich-page-header-chips-gap` | `0.5rem` | Gap between chip children. |
| `--bs-rich-page-header-actions-gap` | `0.5rem` | Gap between action children. |

```html
<!-- Full example: icon + chips + title + sub + description + actions -->
<tc-rich-page-header
    icon-name="Database"
    icon-color="blue"
    title-text="Projects"
    sub="Manage your active projects and archives"
    description="All projects are automatically backed up every 24 hours."
>
    <tc-badge slot="chips" variant="info">Beta</tc-badge>
    <tc-button slot="actions" variant="primary">New project</tc-button>
    <tc-button slot="actions" variant="secondary">Import</tc-button>
</tc-rich-page-header>

<!-- Title only (no icon) -->
<tc-rich-page-header title-text="Settings"></tc-rich-page-header>

<!-- All icon color variants -->
<tc-rich-page-header icon-name="Star" icon-color="violet" title-text="Violet"></tc-rich-page-header>
<tc-rich-page-header icon-name="Star" icon-color="cyan"   title-text="Cyan"></tc-rich-page-header>
<tc-rich-page-header icon-name="Star" icon-color="emerald" title-text="Emerald"></tc-rich-page-header>
<tc-rich-page-header icon-name="Star" icon-color="amber"  title-text="Amber"></tc-rich-page-header>
<tc-rich-page-header icon-name="Star" icon-color="pink"   title-text="Pink"></tc-rich-page-header>
<tc-rich-page-header icon-name="Star" icon-color="blue"   title-text="Blue"></tc-rich-page-header>
<tc-rich-page-header icon-name="Star" icon-color="slate"  title-text="Slate"></tc-rich-page-header>
<tc-rich-page-header icon-name="Star" icon-color="rose"   title-text="Rose"></tc-rich-page-header>

<!-- JS property access -->
<tc-rich-page-header id="ph"></tc-rich-page-header>
<script>
    const el = document.getElementById('ph')
    el.titleText = 'Dynamic Title'
    el.iconName = 'Layers'
    el.iconColor = 'emerald'
    el.sub = 'Updated via JS'
</script>
```

---

### tc-api-reference-table

Documentation-style API reference table. Renders API items grouped by category with name, signature, returns, and description columns. Deprecated items render an inline warning badge with an optional deprecation note. Purely presentational — no events.

**Tag:** `tc-api-reference-table`

**Attributes**

| Attribute | Type | Default | Description |
|-----------|------|---------|-------------|
| `title` | `string` | — | Optional title rendered as a header cap above the table. When absent, slotted children are used as the title instead. |
| `class` | `string` | — | Extra CSS classes passed through to the host element by the author. Not managed by the component. |

**JS Properties**

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `groups` | `ApiReferenceGroup[]` | `[]` | Array of group objects. Each group renders a category heading and a table. Takes precedence over `items`. Setting re-renders. |
| `items` | `ApiItem[]` | `[]` | Flat list of API items. Rendered as a single ungrouped section when `groups` is empty. Setting re-renders. |

**ApiReferenceGroup shape**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `category` | `string` | yes | Category label rendered as a mono uppercase heading above the group's table. |
| `items` | `ApiItem[]` | yes | Items in this group. |

**ApiItem shape**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | `string` | yes | API member name. Rendered in JetBrains Mono. |
| `signature` | `string` | no | Type signature or parameter list. Rendered in muted JetBrains Mono. |
| `returns` | `string` | no | Return type. Rendered in JetBrains Mono. |
| `description` | `string` | no | Prose description in Inter. |
| `deprecated` | `boolean \| string` | no | Marks the item deprecated. `true` shows a "Deprecated" badge; a string value additionally shows the string as a deprecation note. |

**Events**

None. `tc-api-reference-table` is purely presentational.

**Slots**

| Slot | Description |
|------|-------------|
| *(default)* | Optional title content placed before the tables. Captured and projected into `.tc-api-reference-table-title`. Ignored when the `title` attribute is set. |

**Accessibility**

- Tables use proper `<table>`/`<thead>`/`<tbody>` semantics with `<th scope="col">` header cells.
- The deprecation badge uses `role="note"` and includes the text "Deprecated" — deprecation is not indicated by color alone.
- Focus and contrast are preserved for all text via `--tc-text` / `--tc-text-muted` tokens.

**CSS Custom Properties**

| Property | Default | Description |
|----------|---------|-------------|
| `--bs-api-reference-table-border` | `1px solid var(--tc-border)` | Outer frame border. |
| `--bs-api-reference-table-bg` | `var(--tc-surface)` | Table background. |
| `--bs-api-reference-table-title-bg` | `var(--tc-surface-muted)` | Title cap background. |
| `--bs-api-reference-table-title-color` | `var(--tc-text)` | Title text color. |
| `--bs-api-reference-table-title-font-size` | `0.9375rem` | Title font size. |
| `--bs-api-reference-table-title-font-weight` | `600` | Title font weight. |
| `--bs-api-reference-table-group-heading-color` | `var(--tc-text-faint)` | Category heading text color. |
| `--bs-api-reference-table-group-heading-font-size` | `0.6875rem` | Category heading font size. |
| `--bs-api-reference-table-thead-bg` | `var(--tc-slate-50)` | Column header row background. |
| `--bs-api-reference-table-thead-color` | `var(--tc-text-muted)` | Column header text color. |
| `--bs-api-reference-table-row-border` | `1px solid var(--tc-slate-100)` | Inner row separator (fainter than outer frame). |
| `--bs-api-reference-table-name-color` | `var(--tc-text)` | Name column text color. |
| `--bs-api-reference-table-sig-color` | `var(--tc-text-muted)` | Signature column text color. |
| `--bs-api-reference-table-returns-color` | `var(--tc-text)` | Returns column text color. |
| `--bs-api-reference-table-desc-color` | `var(--tc-text-muted)` | Description column text color. |
| `--bs-api-reference-table-depr-badge-bg` | `var(--tc-warning-bg)` | Deprecation badge background. |
| `--bs-api-reference-table-depr-badge-color` | `var(--tc-warning)` | Deprecation badge text and icon color. |
| `--bs-api-reference-table-depr-note-color` | `var(--tc-text-muted)` | Deprecation note text color. |

```html
<!-- Grouped API reference -->
<tc-api-reference-table id="api-table" title="My Library API"></tc-api-reference-table>

<script>
const el = document.getElementById('api-table')
el.groups = [
    {
        category: 'Lifecycle',
        items: [
            {
                name: 'connectedCallback',
                signature: '(): void',
                returns: 'void',
                description: 'Called when the element connects to the document.',
            },
            {
                name: 'render',
                signature: '(): void',
                returns: 'void',
                description: 'Writes Bootstrap-compatible classnames into innerHTML.',
                deprecated: 'Use the new update() method instead.',
            },
        ],
    },
    {
        category: 'Properties',
        items: [
            {
                name: 'items',
                signature: 'ApiItem[]',
                returns: 'ApiItem[]',
                description: 'Array of API items. Setting re-renders the table.',
            },
        ],
    },
]
</script>

<!-- Flat (ungrouped) items -->
<tc-api-reference-table id="flat-table"></tc-api-reference-table>

<script>
document.getElementById('flat-table').items = [
    { name: 'register', signature: '(): void', returns: 'void', description: 'Registers all tc-* elements.' },
    { name: 'icon', signature: '(svg: string): string', returns: 'string', description: 'Wraps a Lucide SVG string.' },
]
</script>

<!-- Slotted title (React node or arbitrary HTML) -->
<tc-api-reference-table>
    <strong>My API</strong> — v2.0 reference
</tc-api-reference-table>
```

---

### tc-scoring-rules

Presentational list of scoring rules with optional icons, titles, descriptions, point values, and optional accent color markers. Set rules exclusively via the `rules` JS property. Non-interactive — no hover state, no events.

**Tag:** `tc-scoring-rules`

**Attributes**

None. All content is supplied via the `rules` JS property.

**JS Properties**

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `rules` | `ScoringRule[]` | `[]` | Array of rule descriptors (see shape below). Re-renders the list on each set. |

**ScoringRule shape**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `icon` | `string` | no | Lucide icon name (kebab-case or PascalCase, e.g. `"star"` or `"Star"`). Rendered as inline SVG, `aria-hidden`. Omit to show no icon. |
| `title` | `string` | yes | Rule title — Inter 500, `--tc-text`. |
| `description` | `string` | yes | Secondary description line below the title — `--tc-text-muted`, smaller. |
| `points` | `string` | yes | Point value displayed in JetBrains Mono (e.g. `"+100"`). |
| `suffix` | `string` | no | Optional suffix appended after the point value in smaller muted mono text (e.g. `"pts"`). |
| `accent` | `"pink" \| "yellow" \| "cyan" \| "green" \| "red"` | no | Accent color applied as a 3px left border bar on the row and as the icon tint. |

**Events**

None. `tc-scoring-rules` is purely presentational.

**Slots**

None.

**CSS custom properties (theming)**

| Property | Default | Description |
|----------|---------|-------------|
| `--bs-scoring-rules-row-border-color` | `var(--tc-border)` | 1px hairline color between rows. |
| `--bs-scoring-rules-title-color` | `var(--tc-text)` | Rule title text color. |
| `--bs-scoring-rules-desc-color` | `var(--tc-text-muted)` | Rule description text color. |
| `--bs-scoring-rules-points-color` | `var(--tc-text)` | Points value text color. |
| `--bs-scoring-rules-icon-size` | `1.125rem` | Icon SVG width and height. |
| `--bs-scoring-rules-row-padding-y` | `0.75rem` | Vertical padding per row. |
| `--bs-scoring-rules-row-padding-x` | `1rem` | Horizontal padding per row. |
| `--bs-scoring-rules-accent-bar-width` | `3px` | Width of the left accent bar. |
| `--bs-scoring-rules-accent-pink` | `#ec4899` | Pink accent color. |
| `--bs-scoring-rules-accent-yellow` | `var(--tc-warning)` | Yellow accent color. |
| `--bs-scoring-rules-accent-cyan` | `var(--tc-accent-fg)` | Cyan accent color. |
| `--bs-scoring-rules-accent-green` | `var(--tc-success)` | Green accent color. |
| `--bs-scoring-rules-accent-red` | `var(--tc-danger)` | Red accent color. |

```html
<tc-scoring-rules id="rules"></tc-scoring-rules>

<script>
const el = document.getElementById('rules')
el.rules = [
    {
        icon: 'Star',
        title: 'First contribution',
        description: 'Submit your first accepted pull request.',
        points: '+100',
        suffix: 'pts',
    },
    {
        icon: 'GitPullRequest',
        title: 'Pull request merged',
        description: 'Earn points for each pull request that gets merged.',
        points: '+25',
        suffix: 'pts',
        accent: 'green',
    },
    {
        icon: 'Shield',
        title: 'Security fix',
        description: 'Report or patch a confirmed security vulnerability.',
        points: '+200',
        suffix: 'pts',
        accent: 'red',
    },
    {
        title: 'Daily login',
        description: 'Log in on any day to maintain your streak.',
        points: '+1',
        suffix: 'pt',
    },
]
</script>
```

---

### tc-section-card

Card wrapper with a header containing an optional icon chip, title, and a named `action` slot. Body content is distributed via the default (unnamed) slot. Supports a `danger` variant for destructive/alert sections.

**Tag:** `tc-section-card`

**Attributes**

| Attribute | Type | Default | Description |
|-----------|------|---------|-------------|
| `title` | `string` | `''` | Card heading text rendered inside the header `<h3>`. Required for a meaningful card. |
| `icon` | `string` | — | Lucide icon name in PascalCase (e.g. `"Key"`, `"Trash2"`). When present, renders an inline SVG chip beside the title. Omit to show no icon. |
| `variant` | `'default' \| 'danger'` | `'default'` | Visual variant. `danger` adds a 4 px left border in `--tc-danger`, tints the header, and colors the title in the danger emphasis shade. |

**JS Properties**

| Property | Type | Description |
|----------|------|-------------|
| `title` | `string` | Reflects the `title` attribute. |
| `icon` | `string \| null` | Reflects the `icon` attribute. |
| `variant` | `SectionCardVariant` | Reflects the `variant` attribute. |

**Events**

None. `tc-section-card` is purely presentational.

**Slots**

| Slot | Description |
|------|-------------|
| *(default)* | Card body content. Any child element without a `slot` attribute is distributed into the `.tc-section-card-body` container. |
| `action` | Action element(s) placed in the header, right-aligned beside the title. Add `slot="action"` to a child (e.g. `<tc-button slot="action">`). Omit to render no action area. |

**Accessibility**

- Card title is rendered as a real `<h3>` element for heading semantics.
- The icon chip carries `aria-hidden="true"` — it is purely decorative.
- The `danger` variant communicates state through color and a left border accent, not color alone (the heading text also changes to a dark-red emphasis color).
- Icon chip transition respects `prefers-reduced-motion`.

**CSS Custom Properties**

| Property | Default | Description |
|----------|---------|-------------|
| `--bs-section-card-bg` | `var(--tc-surface)` | Card background. |
| `--bs-section-card-border-color` | `var(--tc-border)` | Card 1 px hairline border color. |
| `--bs-section-card-shadow` | `var(--tc-shadow-sm)` | Card resting shadow. |
| `--bs-section-card-header-bg` | ink gradient | Faint ink-gradient header background. |
| `--bs-section-card-header-border-color` | `var(--tc-border)` | Header bottom hairline color. |
| `--bs-section-card-header-padding-y` | `0.75rem` | Header vertical padding. |
| `--bs-section-card-header-padding-x` | `1.25rem` | Header horizontal padding. |
| `--bs-section-card-body-padding` | `1.25rem` | Card body padding (all sides). |
| `--bs-section-card-title-color` | `var(--tc-text)` | Card heading text color. |
| `--bs-section-card-title-font-size` | `0.9375rem` | Card heading font size. |
| `--bs-section-card-icon-color` | `var(--tc-text-muted)` | Icon stroke color. |
| `--bs-section-card-icon-size` | `1rem` | Icon SVG width/height. |
| `--bs-section-card-icon-chip-size` | `1.75rem` | Icon chip width/height. |
| `--bs-section-card-icon-chip-bg` | `var(--tc-surface-hover)` | Icon chip background. |
| `--bs-section-card-icon-chip-border-color` | `var(--tc-border)` | Icon chip border color. |
| `--bs-section-card-danger-border-color` | `var(--tc-danger)` | Danger left-border accent color. |
| `--bs-section-card-danger-header-bg` | faint red gradient | Danger variant header background tint. |
| `--bs-section-card-danger-header-border-color` | `rgba(220,38,38,0.25)` | Danger header bottom hairline. |
| `--bs-section-card-danger-title-color` | `#991b1b` | Danger variant title color (dark red emphasis). |
| `--bs-section-card-danger-icon-color` | `var(--tc-danger)` | Danger icon stroke color. |
| `--bs-section-card-danger-icon-chip-bg` | `#fee2e2` | Danger icon chip background. |
| `--bs-section-card-danger-icon-chip-border-color` | `rgba(220,38,38,0.25)` | Danger icon chip border. |

```html
<!-- Default — title only -->
<tc-section-card title="General Settings">
    <p>Configure your account preferences.</p>
</tc-section-card>

<!-- With icon -->
<tc-section-card title="API Keys" icon="Key">
    <p>Manage your API keys and access tokens.</p>
</tc-section-card>

<!-- With action slot -->
<tc-section-card title="Webhooks" icon="Webhook">
    <tc-button slot="action" variant="primary" size="sm">Add Webhook</tc-button>
    <p>Configure webhook endpoints for event notifications.</p>
</tc-section-card>

<!-- Danger variant -->
<tc-section-card title="Delete Account" icon="Trash2" variant="danger">
    <tc-button slot="action" variant="danger" size="sm">Delete</tc-button>
    <p>This action cannot be undone.</p>
</tc-section-card>
```

---

### tc-simple-file

File icon tile displaying a format-specific lucide glyph alongside the file name and extension. Sharp corners (`border-radius: 0`); slate neutrals throughout; extension rendered in JetBrains Mono uppercase. Purely presentational — no interaction, no events, no slots.

**Tag:** `tc-simple-file`

**Attributes**

| Attribute | Type | Default | Description |
|-----------|------|---------|-------------|
| `name` | string | — | Base file name (without extension), e.g. `"report"` |
| `extension` | string | — | File extension, e.g. `".pdf"` or `"pdf"`. Rendered in mono uppercase below the name |
| `format` | `'unknown' \| 'image' \| 'audio' \| 'binary'` | `'unknown'` | Selects the icon glyph: `unknown` → File, `image` → Image, `audio` → Music, `binary` → Box. Also adds a subtle per-format tint to the icon box |

**JS Properties**

None.

**Events**

None.

**Slots**

None. All content is driven by attributes.

**CSS custom properties (theming)**

| Property | Default | Description |
|----------|---------|-------------|
| `--bs-simple-file-gap` | `0.5rem` | Gap between icon box and text block |
| `--bs-simple-file-icon-size` | `2rem` | Icon box width and height |
| `--bs-simple-file-icon-bg` | `var(--tc-surface-muted)` | Icon box background |
| `--bs-simple-file-icon-color` | `var(--tc-text-muted)` | Icon glyph color (overridden per-format) |
| `--bs-simple-file-icon-padding` | `0.375rem` | Inner padding inside the icon box |
| `--bs-simple-file-name-color` | `var(--tc-text)` | File name text color |
| `--bs-simple-file-name-font-size` | `0.875rem` | File name font size |
| `--bs-simple-file-ext-color` | `var(--tc-text-faint)` | Extension label color |
| `--bs-simple-file-ext-font-size` | `0.6875rem` | Extension label font size |

```html
<!-- Unknown format (default) -->
<tc-simple-file name="readme" extension=".md"></tc-simple-file>

<!-- Image -->
<tc-simple-file name="hero" extension=".jpg" format="image"></tc-simple-file>

<!-- Audio -->
<tc-simple-file name="intro" extension=".mp3" format="audio"></tc-simple-file>

<!-- Binary -->
<tc-simple-file name="firmware" extension=".bin" format="binary"></tc-simple-file>
```

---

### tc-sponsor-wall

Sponsor logos organised by tier with an optional wall title and per-logo links. Logos rest greyscale/muted and lift to full colour on hover. No shadow DOM — renders into light DOM.

**Tag:** `tc-sponsor-wall`

**Attributes**

| Attribute | Type | Default | Description |
|-----------|------|---------|-------------|
| `title` | string | — | Optional plain-text heading rendered above all tiers. |

**JS Properties**

| Property | Type | Description |
|----------|------|-------------|
| `tiers` | `SponsorTier[]` | Array of tier objects to render. Set via JS property. Default: `[]`. Re-renders on assignment. |
| `title` | `string` | Reflects the `title` attribute. |

`SponsorTier` shape:
```ts
interface SponsorTier {
    name: string           // tier identifier; used as the group aria-label when label is absent
    label?: string         // human-readable label rendered above the logo grid
    logos: SponsorLogo[]   // logos for this tier
    size?: 'xl' | 'lg' | 'md' | 'sm'  // logo box height; defaults to 'md'
}
```

`SponsorLogo` shape:
```ts
interface SponsorLogo {
    src: string      // image URL
    alt: string      // meaningful alt text for the logo
    href?: string    // when set, logo is wrapped in <a target="_blank" rel="noopener noreferrer">
}
```

**Events**

None. `tc-sponsor-wall` is purely presentational — logo links navigate natively.

**Slots**

None.

**Accessibility**

Each tier is wrapped in `role="group"` with `aria-label` set to the tier label (or name). Logo images carry meaningful `alt` text. Linked logos are real `<a>` elements with `target="_blank"` and `rel="noopener noreferrer"`. Focus ring is always visible (`:focus-visible` outline using `--tc-app-accent`, offset 2 px). `prefers-reduced-motion` suppresses the 1 px lift while keeping the opacity/filter transition.

**CSS Custom Properties**

| Property | Default | Description |
|----------|---------|-------------|
| `--bs-sponsor-wall-title-color` | `var(--tc-text-faint)` | Wall title text colour. |
| `--bs-sponsor-wall-title-font-size` | `0.6875rem` | Wall title font size. |
| `--bs-sponsor-wall-title-margin-bottom` | `1.5rem` | Space below the wall title. |
| `--bs-sponsor-wall-tier-gap` | `2rem` | Vertical gap between tiers. |
| `--bs-sponsor-wall-label-color` | `var(--tc-text-faint)` | Tier label text colour. |
| `--bs-sponsor-wall-label-font-size` | `0.6875rem` | Tier label font size. |
| `--bs-sponsor-wall-logos-gap` | `1px` | Gap between logo cells (hairline grid). |
| `--bs-sponsor-wall-cell-bg` | `var(--tc-surface)` | Logo cell background. |
| `--bs-sponsor-wall-cell-border` | `var(--tc-border)` | Hairline colour between cells. |
| `--bs-sponsor-wall-logo-grayscale` | `1` | Greyscale filter amount at rest (0–1). |
| `--bs-sponsor-wall-logo-opacity` | `0.55` | Logo opacity at rest. |
| `--bs-sponsor-wall-hover-translate` | `-1px` | Vertical lift of the logo cell on hover. |
| `--bs-sponsor-wall-size-xl` | `5rem` | Max logo height for `size="xl"` tiers. |
| `--bs-sponsor-wall-size-lg` | `3.75rem` | Max logo height for `size="lg"` tiers. |
| `--bs-sponsor-wall-size-md` | `3rem` | Max logo height for `size="md"` tiers (default). |
| `--bs-sponsor-wall-size-sm` | `2.25rem` | Max logo height for `size="sm"` tiers. |

```html
<!-- Multiple tiers with title -->
<tc-sponsor-wall id="sw1" title="Our Sponsors"></tc-sponsor-wall>
<script>
    document.getElementById('sw1').tiers = [
        {
            name: 'Platinum',
            label: 'Platinum',
            size: 'xl',
            logos: [
                { src: '/logos/acme.svg', alt: 'Acme Corp', href: 'https://acme.example' },
                { src: '/logos/globex.svg', alt: 'Globex', href: 'https://globex.example' },
            ],
        },
        {
            name: 'Gold',
            label: 'Gold',
            size: 'lg',
            logos: [
                { src: '/logos/initech.svg', alt: 'Initech', href: 'https://initech.example' },
                { src: '/logos/umbrella.svg', alt: 'Umbrella' },
            ],
        },
        {
            name: 'Community',
            size: 'sm',
            logos: [
                { src: '/logos/hooli.svg', alt: 'Hooli', href: 'https://hooli.example' },
            ],
        },
    ]
</script>
```

---

### tc-sprint-chain

Timeline/chain visualization of sprint items with past, current (now), and future states. Renders as an ordered list with circular node markers and hairline connector lines. States are derived automatically from `current-id` or supplied explicitly per item.

**Tag:** `tc-sprint-chain`

**Attributes**

| Attribute | Type | Default | Description |
|-----------|------|---------|-------------|
| `current-id` | string | `""` | The `id` of the item considered "current". Items before it are `past`, the matching item is `now`, items after are `future`. When no item matches, all items are `future`. |
| `columns` | number | items.length | Number of columns in the grid. Defaults to the total item count (single row). Set to a smaller value for multi-row layouts. |

**JS Properties**

| Property | Type | Description |
|----------|------|-------------|
| `items` | `SprintChainItem[]` | Array of sprint items to render. Set via JS property. Default: `[]`. Re-renders on assignment. |
| `currentId` | `string` | Reflects the `current-id` attribute. |
| `columns` | `number \| null` | Reflects the `columns` attribute. |

`SprintChainItem` shape:
```ts
interface SprintChainItem {
    id: string                          // unique identifier; matched against current-id
    label: string                       // text shown below the node marker
    tag?: string                        // optional monospace micro-label shown below label
    state?: SprintChainState            // explicit state override; omit to derive from current-id
}
```

`SprintChainState` type:
```ts
type SprintChainState = 'past' | 'now' | 'future'
```

State derivation (mirrors `SprintChain.tsx`):
- If `item.state` is set explicitly, it is used as-is.
- Otherwise: find the index of the item whose `id === current-id`. Items before it → `past`; the matching item → `now`; items after → `future`. If no item matches `current-id`, all items are `future`.

**Events**

None. `tc-sprint-chain` is purely presentational.

**Slots**

| Slot | Description |
|------|-------------|
| `header` | Content placed in the left side of the optional header row above the chain. |
| `header-end` | Content placed in the right side of the optional header row. |

The header row is rendered only when at least one header slot child is present.

**Accessibility**

Items are rendered as an `<ol>`/`<li>` list. The current item carries `aria-current="step"`. Node markers are decorative (`aria-hidden="true"`).

**CSS Custom Properties**

| Property | Default | Description |
|----------|---------|-------------|
| `--bs-sprint-chain-node-size` | `0.875rem` | Diameter of the circular node marker. |
| `--bs-sprint-chain-connector-color` | `var(--tc-border)` | Hairline connector colour between nodes. |
| `--bs-sprint-chain-label-font-size` | `0.8125rem` | Font size of item labels. |
| `--bs-sprint-chain-label-font-weight` | `400` | Font weight of item labels (default/future state). |
| `--bs-sprint-chain-label-color` | `var(--tc-text-muted)` | Default label colour. |
| `--bs-sprint-chain-tag-font-size` | `0.6875rem` | Font size of item tags. |
| `--bs-sprint-chain-tag-color` | `var(--tc-text-faint)` | Tag text colour. |
| `--bs-sprint-chain-past-node-bg` | `var(--tc-border-strong)` | `past` node fill. |
| `--bs-sprint-chain-past-node-border` | `var(--tc-border-strong)` | `past` node border colour. |
| `--bs-sprint-chain-past-label-color` | `var(--tc-text-faint)` | `past` label colour. |
| `--bs-sprint-chain-now-node-bg` | `var(--tc-app-accent)` | `now` node fill. |
| `--bs-sprint-chain-now-node-border` | `var(--tc-app-accent)` | `now` node border colour. |
| `--bs-sprint-chain-now-label-color` | `var(--tc-text)` | `now` label colour. |
| `--bs-sprint-chain-now-label-font-weight` | `600` | `now` label weight. |
| `--bs-sprint-chain-future-node-bg` | `var(--tc-surface)` | `future` hollow node background. |
| `--bs-sprint-chain-future-node-border` | `var(--tc-border)` | `future` node ring colour. |
| `--bs-sprint-chain-future-label-color` | `var(--tc-text-muted)` | `future` label colour. |

```html
<!-- Basic chain — states derived from current-id -->
<tc-sprint-chain id="sc1" current-id="sp3"></tc-sprint-chain>
<script>
    document.getElementById('sc1').items = [
        { id: 'sp1', label: 'Sprint 1', tag: 'v1.0.0' },
        { id: 'sp2', label: 'Sprint 2', tag: 'v1.1.0' },
        { id: 'sp3', label: 'Sprint 3', tag: 'v1.2.0' },
        { id: 'sp4', label: 'Sprint 4', tag: 'v2.0.0' },
    ]
</script>

<!-- Multi-row with columns=3 and header slots -->
<tc-sprint-chain id="sc2" current-id="q4" columns="3">
    <span slot="header">Quarterly sprints</span>
    <span slot="header-end">FY 2026</span>
</tc-sprint-chain>
<script>
    document.getElementById('sc2').items = [
        { id: 'q1', label: 'Q1 Sprint 1', tag: 'Jan' },
        { id: 'q2', label: 'Q1 Sprint 2', tag: 'Feb' },
        { id: 'q3', label: 'Q1 Sprint 3', tag: 'Mar' },
        { id: 'q4', label: 'Q2 Sprint 1', tag: 'Apr' },
        { id: 'q5', label: 'Q2 Sprint 2', tag: 'May' },
        { id: 'q6', label: 'Q2 Sprint 3', tag: 'Jun' },
    ]
</script>

<!-- Explicit per-item state override -->
<tc-sprint-chain id="sc3"></tc-sprint-chain>
<script>
    document.getElementById('sc3').items = [
        { id: 'a', label: 'Discovery', state: 'past' },
        { id: 'b', label: 'Design',    state: 'past' },
        { id: 'c', label: 'Build',     state: 'now' },
        { id: 'd', label: 'Review',    state: 'future' },
        { id: 'e', label: 'Ship',      state: 'future' },
    ]
</script>
```

---

### tc-stat-card

Statistic card with label, value, optional icon, delta indicator, helper text, and footer row. Presentational only — no events.

**Tag:** `tc-stat-card`

**Attributes**

| Attribute | Type | Default | Description |
|-----------|------|---------|-------------|
| `icon` | `string \| null` | `null` | Lucide icon name (PascalCase, e.g. `"DollarSign"`). Rendered as an inline SVG tile. |
| `label` | `string` | `''` | Small caption above the value (required-ish). |
| `value` | `string \| null` | `null` | Headline figure as a string. When absent, falls back to slotted children. |
| `unit` | `string \| null` | `null` | Short suffix rendered next to the value (e.g. `"ms"`, `"%"`). |
| `delta` | `string \| null` | `null` | Change text (e.g. `"+12%"`). |
| `delta-kind` | `'up' \| 'down' \| 'neutral'` | `'neutral'` | Governs delta colour and directional arrow icon. |
| `helper` | `string \| null` | `null` | Small helper line displayed below the delta. |
| `footer` | `string \| null` | `null` | Text in a bottom footer row, separated from the body by a hairline. |
| `loading` | boolean | `false` | When set, replaces card content with an animated skeleton placeholder. |

**JS Properties**

Each attribute has a reflected JS property of the same name (camelCase where needed):

| Property | Type |
|----------|------|
| `icon` | `string \| null` |
| `label` | `string` |
| `value` | `string \| null` |
| `unit` | `string \| null` |
| `delta` | `string \| null` |
| `deltaKind` | `StatCardDeltaKind` |
| `helper` | `string \| null` |
| `footer` | `string \| null` |
| `loading` | `boolean` |

**Events**

None. `tc-stat-card` is purely presentational.

**Slots**

| Slot | Description |
|------|-------------|
| *(default)* | Rich value content. Used when the `value` attribute is absent. Distributed into `.tc-stat-card-value`. |

**Accessibility**

- The delta badge carries an `aria-label` describing direction and value (e.g. `"trending up +12%"`).
- During loading, the host element receives `role="status"` and `aria-busy="true"`; the inner card receives `aria-hidden="true"`; a visually-hidden `Loading…` text is included for screen readers.
- `prefers-reduced-motion` freezes the skeleton shimmer to a static fill.

**CSS Custom Properties**

| Property | Default | Description |
|----------|---------|-------------|
| `--bs-stat-card-bg` | `var(--tc-surface)` | Card background. |
| `--bs-stat-card-border-color` | `var(--tc-border)` | 1px hairline border colour. |
| `--bs-stat-card-shadow` | `var(--tc-shadow-sm)` | Resting box shadow. |
| `--bs-stat-card-padding-y` | `1rem` | Vertical inner padding. |
| `--bs-stat-card-padding-x` | `1.25rem` | Horizontal inner padding. |
| `--bs-stat-card-icon-size` | `1rem` | Icon SVG width/height. |
| `--bs-stat-card-icon-color` | `var(--tc-text-muted)` | Icon colour. |
| `--bs-stat-card-icon-tile-bg` | `var(--tc-surface-muted)` | Icon tile background. |
| `--bs-stat-card-label-color` | `var(--tc-text-muted)` | Label text colour. |
| `--bs-stat-card-label-font-size` | `0.6875rem` | Label font size. |
| `--bs-stat-card-value-color` | `var(--tc-text)` | Value text colour. |
| `--bs-stat-card-value-font-size` | `1.75rem` | Value font size. |
| `--bs-stat-card-value-font-weight` | `600` | Value font weight. |
| `--bs-stat-card-unit-color` | `var(--tc-text-muted)` | Unit suffix colour. |
| `--bs-stat-card-unit-font-size` | `0.9375rem` | Unit suffix font size. |
| `--bs-stat-card-delta-font-size` | `0.75rem` | Delta badge font size. |
| `--bs-stat-card-delta-icon-size` | `0.875rem` | Delta directional icon size. |
| `--bs-stat-card-helper-color` | `var(--tc-text-muted)` | Helper text colour. |
| `--bs-stat-card-helper-font-size` | `0.75rem` | Helper text font size. |
| `--bs-stat-card-footer-bg` | `var(--tc-surface-muted)` | Footer row background. |
| `--bs-stat-card-footer-color` | `var(--tc-text-muted)` | Footer text colour. |
| `--bs-stat-card-footer-font-size` | `0.75rem` | Footer text font size. |

```html
<!-- Basic: label + value -->
<tc-stat-card label="Total Users" value="12,480"></tc-stat-card>

<!-- With unit and icon -->
<tc-stat-card label="Avg Response" value="142" unit="ms" icon="Zap"></tc-stat-card>

<!-- Delta kinds -->
<tc-stat-card label="MRR" value="$42,100" delta="+8.3%" delta-kind="up" icon="DollarSign"></tc-stat-card>
<tc-stat-card label="Churn" value="2.1%" delta="+0.3%" delta-kind="down" icon="TrendingDown"></tc-stat-card>
<tc-stat-card label="NPS" value="72" delta="0%" delta-kind="neutral"></tc-stat-card>

<!-- With helper and footer -->
<tc-stat-card label="Error Rate" value="0.4" unit="%" delta="-0.1%" delta-kind="up"
    helper="Down 0.1 pp from last week"
    footer="Compared to previous 30 days">
</tc-stat-card>

<!-- Slotted value -->
<tc-stat-card label="Build Status">
    <strong style="color: var(--tc-success); font-size: 1.75rem">Passing</strong>
</tc-stat-card>

<!-- Loading skeleton -->
<tc-stat-card loading label="Users" value="0"></tc-stat-card>
```

### tc-state-machine

Vertical state-progression display with per-state status markers. States are set via a JS property (`states`). Markers reflect status: done (check icon), active (filled dot with pulse ring), pending (hollow circle), error (alert icon). Consecutive states are joined by a 1px connector line. Sharp corners everywhere; the only curve is the circular status dot.

**Tag:** `tc-state-machine`

**Attributes**

| Attribute | Type | Default | Description |
|-----------|------|---------|-------------|
| `compact` | boolean | `false` | When present, tightens vertical spacing and hides state descriptions. |

**JS Properties**

| Property | Type | Description |
|----------|------|-------------|
| `states` | `StateMachineItem[]` | Array of state objects. Set via `el.states = [...]`. |
| `compact` | `boolean` | Reflects the `compact` attribute. |

`StateMachineItem` shape:

```ts
type StateMachineStatus = 'done' | 'active' | 'pending' | 'error'

interface StateMachineItem {
    id: string
    label: string
    description?: string
    status?: StateMachineStatus  // defaults to 'pending'
}
```

**Events**

None. `tc-state-machine` is purely presentational.

**Slots**

None. All content is driven by the `states` JS property.

**Accessibility**

- The host element carries `role="list"`; each state row carries `role="listitem"`.
- Each status marker carries an `aria-label` with the capitalised status name (e.g. `"Done"`, `"Active"`, `"Pending"`, `"Error"`).
- The pulse ring on the active marker respects `prefers-reduced-motion` (animation disabled when reduced motion is preferred).

**CSS Custom Properties**

| Property | Default | Description |
|----------|---------|-------------|
| `--bs-state-machine-marker-size` | `1.5rem` | Diameter of the circular status marker. |
| `--bs-state-machine-icon-size` | `0.875rem` | Size of the icon SVG inside the marker. |
| `--bs-state-machine-track-gap` | `0.75rem` | Horizontal gap between the track column and the body column. |
| `--bs-state-machine-connector-color` | `var(--tc-border)` | Color of the 1px vertical connector between states. |
| `--bs-state-machine-connector-min-height` | `0.75rem` | Minimum height of the connector line (reduced to `0.375rem` in compact mode). |
| `--bs-state-machine-label-color` | `var(--tc-text)` | Label text color. |
| `--bs-state-machine-label-font-size` | `0.875rem` | Label font size. |
| `--bs-state-machine-label-font-weight` | `500` | Label font weight. |
| `--bs-state-machine-description-color` | `var(--tc-text-muted)` | Description text color. |
| `--bs-state-machine-description-font-size` | `0.75rem` | Description font size (monospace). |

```html
<tc-state-machine id="pipeline"></tc-state-machine>

<script>
document.querySelector('#pipeline').states = [
    { id: 'provision', label: 'Provision', description: 'Allocate cloud resources', status: 'done' },
    { id: 'build',     label: 'Build',     description: 'Compile and bundle assets', status: 'done' },
    { id: 'deploy',    label: 'Deploy',    description: 'Roll out to cluster',       status: 'active' },
    { id: 'verify',    label: 'Verify',    description: 'Run smoke tests',           status: 'pending' },
    { id: 'notify',    label: 'Notify',    description: 'Send release summary',      status: 'pending' },
]
</script>

<!-- Compact variant -->
<tc-state-machine compact id="pipeline-compact"></tc-state-machine>
<script>
document.querySelector('#pipeline-compact').states = [
    { id: 'checkout', label: 'Checkout',  status: 'done' },
    { id: 'lint',     label: 'Lint',      status: 'error' },
    { id: 'test',     label: 'Test',      status: 'pending' },
]
</script>
```

---

### tc-tier-ladder

Ranked tier ladder with color-coded identity dots and a current-tier indicator. Tiers are set via a JS property; the current tier is highlighted with an ink-accent left marker and a check icon. Sharp corners on all rectangles; the only curve is the circular color dot. Color is identity-only on the dot, never as a full-row fill.

**Tag:** `tc-tier-ladder`

**Attributes**

| Attribute | Type | Default | Description |
|-----------|------|---------|-------------|
| `title` | `string \| null` | `null` | Optional heading rendered above the tier list. |
| `current-tier-id` | `string \| null` | `null` | The `id` of the tier to mark as current. Highlighted with a left accent marker and a check icon. |
| `summary` | `string \| null` | `null` | Optional footer line rendered below the tier list (e.g. season/scoring info). |

**JS Properties**

| Property | Type | Description |
|----------|------|-------------|
| `tiers` | `TierItem[]` | Array of tier objects. Set via `el.tiers = [...]`. Setting triggers a re-render. |
| `title` | `string` | Reflects the `title` attribute. |
| `currentTierId` | `string \| null` | Reflects the `current-tier-id` attribute (camelCase). |
| `summary` | `string \| null` | Reflects the `summary` attribute. |

`TierItem` shape:

```ts
type TierColor = 'gray' | 'cyan' | 'yellow' | 'pink' | 'red'

interface TierItem {
    id: string        // unique identifier used for current-tier-id matching
    name: string      // display name of the tier
    range: string     // score/point range shown in mono font (e.g. "1000–1499")
    color?: TierColor // dot color; defaults to 'gray'
}
```

Color mapping: `gray` → slate/muted, `cyan` → `--tc-accent`, `yellow` → `--tc-warning`, `pink` / `red` → `--tc-danger` family.

**Events**

None. `tc-tier-ladder` is purely presentational.

**Slots**

None. All content is driven by attributes and the `tiers` JS property.

**Accessibility**

- The tier list is an `<ol>` with native list semantics.
- The current tier row carries `aria-current="true"`.
- The color dot is decorative (`aria-hidden="true"`); tier meaning is carried by the tier name text alone.
- The current-tier check icon is wrapped in a `<span>` with `aria-label="Current tier"`.
- `prefers-reduced-motion` is honoured: row hover transitions are disabled.

**CSS Custom Properties**

| Property | Default | Description |
|----------|---------|-------------|
| `--bs-tier-ladder-title-color` | `var(--tc-text)` | Title text colour. |
| `--bs-tier-ladder-title-font-size` | `0.925rem` | Title font size. |
| `--bs-tier-ladder-title-font-weight` | `600` | Title font weight. |
| `--bs-tier-ladder-border` | `var(--tc-border)` | Outer 1px hairline border around the list. |
| `--bs-tier-ladder-row-separator` | `var(--tc-surface-muted)` | 1px separator between rows. |
| `--bs-tier-ladder-dot-size` | `0.625rem` | Diameter of the circular color dot. |
| `--bs-tier-ladder-dot-gray` | `var(--tc-text-faint)` | Gray dot colour (default). |
| `--bs-tier-ladder-dot-cyan` | `var(--tc-accent)` | Cyan dot colour. |
| `--bs-tier-ladder-dot-yellow` | `var(--tc-warning)` | Yellow dot colour. |
| `--bs-tier-ladder-dot-pink` | `var(--tc-danger)` | Pink dot colour. |
| `--bs-tier-ladder-dot-red` | `var(--tc-danger)` | Red dot colour. |
| `--bs-tier-ladder-name-color` | `var(--tc-text)` | Tier name text colour. |
| `--bs-tier-ladder-range-color` | `var(--tc-text-muted)` | Range mono label colour. |
| `--bs-tier-ladder-current-border` | `var(--tc-app-accent)` | Left accent marker colour for current tier. |
| `--bs-tier-ladder-current-bg` | `rgba(30,41,59,0.04)` | Subtle background tint for current tier row. |
| `--bs-tier-ladder-summary-color` | `var(--tc-text-faint)` | Summary footer text colour. |

```html
<!-- League ladder with title, current tier, and summary -->
<tc-tier-ladder id="league" title="League Standings" current-tier-id="gold"
    summary="Points reset at the start of each season.">
</tc-tier-ladder>
<script>
document.getElementById('league').tiers = [
    { id: 'diamond',  name: 'Diamond',  range: '2000–∞',    color: 'cyan'   },
    { id: 'platinum', name: 'Platinum', range: '1500–1999', color: 'gray'   },
    { id: 'gold',     name: 'Gold',     range: '1000–1499', color: 'yellow' },
    { id: 'silver',   name: 'Silver',   range: '500–999',   color: 'gray'   },
    { id: 'bronze',   name: 'Bronze',   range: '0–499',     color: 'red'    },
]
</script>

<!-- Rank ladder — no title, no summary -->
<tc-tier-ladder id="rank" current-tier-id="b"></tc-tier-ladder>
<script>
document.getElementById('rank').tiers = [
    { id: 's', name: 'S Rank', range: '95–100', color: 'pink'   },
    { id: 'a', name: 'A Rank', range: '80–94',  color: 'yellow' },
    { id: 'b', name: 'B Rank', range: '65–79',  color: 'cyan'   },
    { id: 'c', name: 'C Rank', range: '50–64',  color: 'gray'   },
    { id: 'd', name: 'D Rank', range: '0–49',   color: 'gray'   },
]
</script>

<!-- Empty state -->
<tc-tier-ladder title="No tiers yet"></tc-tier-ladder>
```

---

### tc-timeline

Vertical timeline of chronological events. Items are set via the JS `items` property (array of `TimelineItem` objects). Supports five card variants, three connector styles, per-item statuses, icons, badges, tags, progress bars, accent colors, and a loading skeleton. Non-interactive — dispatches no events. Sharp corners (`border-radius: 0`) on cards and tags; the circular node marker (`50%`) is the only sanctioned curve.

**Tag:** `tc-timeline`

**Attributes**

| Attribute | Type | Default | Description |
|-----------|------|---------|-------------|
| `variant` | `default\|glass\|outlined\|elevated\|minimal` | `default` | Card surface style. `default` = 1px border + white card. `glass` = translucent with backdrop blur. `outlined` = transparent fill. `elevated` = adds `--tc-shadow-sm`. `minimal` = no card chrome. |
| `connector` | `gradient\|solid\|dashed` | `gradient` | Style of the vertical spine line. `gradient` = ink fade at top/bottom. `solid` = 2px `--tc-border-strong`. `dashed` = 2px dashed `--tc-border`. |
| `overlap` | number | `0` | Default negative vertical margin (px) between consecutive cards to create a visual overlap. Per-item `overlap` in the items array overrides this. |
| `loading` | boolean | false | When set, renders `loading-count` skeleton placeholder rows instead of the items list. |
| `loading-count` | number | `3` | Number of skeleton rows shown during the loading state. |

**JS Properties**

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `items` | `TimelineItem[]` | `[]` | Array of timeline items. Setting this property re-renders the timeline. See the `TimelineItem` shape below. |
| `variant` | `TimelineVariant` | `'default'` | Reflects the `variant` attribute. |
| `connector` | `TimelineConnector` | `'gradient'` | Reflects the `connector` attribute. |
| `overlap` | `number` | `0` | Reflects the `overlap` attribute. |
| `loading` | `boolean` | `false` | Reflects the `loading` attribute. |
| `loadingCount` | `number` | `3` | Reflects the `loading-count` attribute. |

**TimelineItem shape**

```ts
interface TimelineItem {
    title: string           // Required. Card heading.
    date: string            // Required. Monospace date label shown in the card header.
    description?: string    // Optional body paragraph.
    side?: 'left' | 'right' // Which side of the spine. Defaults to alternating left/right.
    subtitle?: string       // Secondary line below the title.
    badge?: string          // Small rectangular label in the card header.
    meta?: string           // Monospace meta label shown alongside the date.
    icon?: string           // Lucide icon name (PascalCase or kebab-case). When provided,
                            // renders an icon chip as the node instead of a status dot.
    status?: 'completed' | 'active' | 'upcoming'
                            // Node color. Defaults to 'active' for index 0, 'upcoming' for the rest.
    overlap?: number        // Per-item negative margin override (px). Overrides the top-level overlap attribute.
    tags?: string[]         // Small rectangular pill tags rendered below the description.
    progress?: number       // 0–100. When provided, renders a progress bar inside the card.
    accentColor?: string    // CSS color string applied as --tl-item-accent on the item.
                            // Changes the node dot border/fill to a custom color.
}
```

**Events**

None. `tc-timeline` is a purely presentational element.

**Slots**

None. All content is driven by the `items` JS property.

**CSS custom properties (theming)**

| Property | Default | Description |
|----------|---------|-------------|
| `--bs-timeline-card-bg` | `var(--tc-surface)` | Card background fill. |
| `--bs-timeline-card-border-color` | `var(--tc-border)` | Card border hairline. |
| `--bs-timeline-card-padding-x` | `1.25rem` | Card horizontal padding. |
| `--bs-timeline-card-padding-y` | `0.875rem` | Card vertical padding. |
| `--bs-timeline-line-color` | `var(--tc-border)` | Spine line color (gradient and default). |
| `--bs-timeline-line-width` | `1px` | Spine line width (default connector). |
| `--bs-timeline-line-solid-color` | `var(--tc-border-strong)` | Spine color for the solid connector. |
| `--bs-timeline-line-solid-width` | `2px` | Spine width for the solid connector. |
| `--bs-timeline-node-col-width` | `2.5rem` | Width of the grid column that holds the node marker. |
| `--bs-timeline-node-size` | `0.875rem` | Diameter of the circular status dot. |
| `--bs-timeline-node-icon-size` | `2rem` | Diameter of the icon chip circle. |
| `--bs-timeline-node-gutter` | `0.875rem` | Gap between the node column and the adjacent card. |
| `--bs-timeline-completed-bg` | `var(--tc-success)` | Status dot fill for completed items. |
| `--bs-timeline-active-bg` | `var(--tc-app-accent)` | Status dot fill for active items. |
| `--bs-timeline-upcoming-bg` | `var(--tc-surface)` | Status dot fill for upcoming items. |
| `--bs-timeline-date-color` | `var(--tc-text-muted)` | Date label color (monospace). |
| `--bs-timeline-title-color` | `var(--tc-text)` | Title heading color. |
| `--bs-timeline-title-font-size` | `0.9375rem` | Title heading font size. |
| `--bs-timeline-description-color` | `var(--tc-text-muted)` | Description paragraph color. |
| `--bs-timeline-tag-bg` | `var(--tc-surface-muted)` | Tag pill background. |
| `--bs-timeline-tag-border-color` | `var(--tc-border)` | Tag pill hairline. |
| `--bs-timeline-progress-fill` | `var(--tc-app-accent)` | Progress bar fill color. |
| `--bs-timeline-item-gap` | `1.5rem` | Vertical gap between consecutive items. |
| `--bs-timeline-elevated-shadow` | `var(--tc-shadow-sm)` | Box-shadow for the elevated variant. |

```html
<!-- Basic usage — set items via JS -->
<tc-timeline id="tl1"></tc-timeline>
<script>
document.getElementById('tl1').items = [
    { title: 'Project kickoff',  date: '2026-01-10', status: 'completed', badge: 'Done' },
    { title: 'Alpha release',    date: '2026-03-01', status: 'active',    progress: 65 },
    { title: 'Public beta',      date: '2026-04-15', status: 'upcoming',  tags: ['Beta'] },
]
</script>

<!-- Variants -->
<tc-timeline id="tl2" variant="glass" connector="solid"></tc-timeline>
<tc-timeline id="tl3" variant="elevated"></tc-timeline>
<tc-timeline id="tl4" variant="minimal" connector="dashed"></tc-timeline>

<!-- Loading state -->
<tc-timeline loading loading-count="4"></tc-timeline>

<!-- Per-item icon and accent color -->
<tc-timeline id="tl5"></tc-timeline>
<script>
document.getElementById('tl5').items = [
    { title: 'Deployed', date: '2026-06-01', icon: 'Rocket',     status: 'completed' },
    { title: 'Monitoring', date: '2026-06-02', icon: 'Activity', status: 'active',
      accentColor: 'var(--tc-accent)', progress: 30 },
]
</script>
```

---

### tc-usage-summary-panel

Usage-metrics panel with labelled progress bars for resource consumption. Presentational only — no events. Data is provided via the `usage` JS property.

**Tag:** `tc-usage-summary-panel`

**Attributes**

| Attribute | Type | Default | Description |
|-----------|------|---------|-------------|
| `title` | `string \| null` | `null` | Optional panel heading. When set, renders a faint ink-gradient header cap above the rows. |
| `loading` | boolean | `false` | When set, replaces row content with animated skeleton placeholders. |
| `loading-count` | `number` | `3` | Number of skeleton rows rendered during the loading state. |

**JS Properties**

| Property | Type | Description |
|----------|------|-------------|
| `usage` | `UsageConfig[]` | Array of resource usage objects. Setting this property re-renders the panel. |
| `loading` | `boolean` | Reflects the `loading` attribute. |
| `loadingCount` | `number` | Reflects the `loading-count` attribute (default `3`). |

`UsageConfig` shape:
```ts
interface UsageConfig {
    label: string           // row heading (e.g. "Storage")
    used: number            // amount consumed
    total: number           // limit / quota
    measurementUnit: string // unit suffix (e.g. "GB", "req/day")
    warn?: boolean          // force the warning treatment
}
```

The percentage is computed as `clamp(0, round(used / total * 100), 100)`. Numbers are formatted with `Intl.NumberFormat` (max 1 fraction digit). A row is in the warn state when `warn === true` OR `used >= total`.

**Events**

None. `tc-usage-summary-panel` is purely presentational.

**Slots**

None. All content is driven by the `usage` JS property.

**Accessibility**

- Each progress bar carries `role="progressbar"` with `aria-valuenow`, `aria-valuemin`, `aria-valuemax`, and an `aria-label` (e.g. `"Storage: 24%"`).
- During loading the panel root receives `role="status"` and `aria-busy="true"`; skeleton rows carry `aria-hidden="true"`; a visually-hidden "Loading…" text is included for screen readers.
- `prefers-reduced-motion` freezes the skeleton shimmer to a static fill and disables the progress-bar width transition.

**CSS Custom Properties**

| Property | Default | Description |
|----------|---------|-------------|
| `--bs-usage-summary-panel-bg` | `var(--tc-surface)` | Panel background. |
| `--bs-usage-summary-panel-border-color` | `var(--tc-border)` | 1px hairline border colour. |
| `--bs-usage-summary-panel-shadow` | `var(--tc-shadow-sm)` | Resting box shadow. |
| `--bs-usage-summary-panel-padding-y` | `0.875rem` | Vertical inner padding. |
| `--bs-usage-summary-panel-padding-x` | `1rem` | Horizontal inner padding. |
| `--bs-usage-summary-panel-title-bg` | `linear-gradient(135deg, …)` | Header cap gradient (ink). |
| `--bs-usage-summary-panel-title-color` | `rgba(255,255,255,0.9)` | Header cap text colour. |
| `--bs-usage-summary-panel-title-font-size` | `0.6875rem` | Header cap font size. |
| `--bs-usage-summary-panel-label-color` | `var(--tc-text)` | Row label colour. |
| `--bs-usage-summary-panel-label-font-size` | `0.8125rem` | Row label font size. |
| `--bs-usage-summary-panel-value-color` | `var(--tc-text-muted)` | Row value colour. |
| `--bs-usage-summary-panel-value-font-size` | `0.75rem` | Row value font size. |
| `--bs-usage-summary-panel-row-gap` | `0.75rem` | Vertical gap between rows. |
| `--bs-usage-summary-panel-bar-bg` | `var(--tc-slate-200)` | Progress track background. |
| `--bs-usage-summary-panel-bar-fill` | `var(--tc-app-accent)` | Normal progress fill colour. |
| `--bs-usage-summary-panel-bar-height` | `0.375rem` | Progress track height. |
| `--bs-usage-summary-panel-warn-fill` | `var(--tc-warning)` | Warn state progress fill colour. |
| `--bs-usage-summary-panel-warn-value-color` | `var(--tc-warning)` | Warn state value text colour. |

```html
<!-- Basic usage — set items via JS -->
<tc-usage-summary-panel id="usp1" title="Resource Usage"></tc-usage-summary-panel>
<script>
document.getElementById('usp1').usage = [
    { label: 'Storage',   used: 12.4,  total: 50,    measurementUnit: 'GB' },
    { label: 'Bandwidth', used: 320,   total: 1000,  measurementUnit: 'MB' },
    { label: 'API Calls', used: 4800,  total: 10000, measurementUnit: 'req/day' },
]
</script>

<!-- Warn rows — near-limit flagged explicitly, over-limit auto-detected -->
<tc-usage-summary-panel id="usp2" title="Plan Limits"></tc-usage-summary-panel>
<script>
document.getElementById('usp2').usage = [
    { label: 'Storage',   used: 45.2, total: 50,  measurementUnit: 'GB', warn: true },
    { label: 'Bandwidth', used: 320,  total: 1000, measurementUnit: 'MB' },
    { label: 'Seats',     used: 10,   total: 10,   measurementUnit: 'users' },
]
</script>

<!-- Loading skeleton -->
<tc-usage-summary-panel title="Usage" loading loading-count="3"></tc-usage-summary-panel>
```

---

### tc-welcome-guide

**Tag:** `tc-welcome-guide`

Onboarding guide with progress tracking and sequential step completion. The active step is auto-derived as the first non-completed step. Locked and completed steps are inert. Clicking or pressing `Enter`/`Space` on the active step dispatches `tc-step-click`.

**Attributes**

| Attribute | Type | Default | Description |
|-----------|------|---------|-------------|
| `title` | `string` | — | Required heading text rendered above messages. |
| `background-pattern-src` | `string` | — | URL of a decorative background image (`aria-hidden`). |
| `background-pattern-alt` | `string` | `""` | Alt text for the background image (set to empty for purely decorative). |
| `loading` | boolean | `false` | Renders skeleton placeholders for title, messages, progress, and steps. |

**JS Properties**

| Property | Type | Description |
|----------|------|-------------|
| `messages` | `string[]` | Intro/body lines rendered as `<p>` elements below the title. Setting re-renders. |
| `steps` | `WelcomeGuideStep[]` | Ordered step list. Each is `{ key: string; label: string; completed: boolean }`. Setting re-renders. |
| `onstepclick` | `((e, key) => void) \| null` | Optional callback fired alongside the `tc-step-click` event. |

**Events**

| Event | Detail | Description |
|-------|--------|-------------|
| `tc-step-click` | `{ key: string }` | Dispatched when the active step is clicked or activated via keyboard. Bubbles. |

**Slots**

None. All content is driven by attributes and JS properties.

**Accessibility**

- The steps list uses `<ul role="list">` semantics; each step is a `<li>`.
- The active step has `role="button"` with a visible focus ring (`outline: 2px solid --tc-app-accent`).
- Inert (completed/locked) steps carry `aria-disabled="true"` and `tabindex="-1"`.
- The decorative background image is `aria-hidden="true"`.
- The progress bar carries `role="progressbar"` with `aria-valuenow`, `aria-valuemin`, and `aria-valuemax`.
- Step state is conveyed through label text and icon, not colour alone.
- `prefers-reduced-motion`: tick draw animation and progress bar transition are disabled.

**CSS Custom Properties**

| Property | Default | Description |
|----------|---------|-------------|
| `--bs-welcome-guide-bg` | `var(--tc-surface)` | Card background. |
| `--bs-welcome-guide-border` | `1px solid var(--tc-border)` | Card border. |
| `--bs-welcome-guide-shadow` | `var(--tc-shadow-sm)` | Card shadow. |
| `--bs-welcome-guide-padding` | `1.5rem` | Card inner padding. |
| `--bs-welcome-guide-title-font-size` | `1.125rem` | Title font size. |
| `--bs-welcome-guide-title-font-weight` | `600` | Title weight. |
| `--bs-welcome-guide-title-color` | `var(--tc-text)` | Title colour. |
| `--bs-welcome-guide-message-color` | `var(--tc-text-muted)` | Message paragraph colour. |
| `--bs-welcome-guide-progress-height` | `0.375rem` | Progress bar track height. |
| `--bs-welcome-guide-progress-bg` | `var(--tc-slate-200)` | Progress track background. |
| `--bs-welcome-guide-progress-fill` | `var(--tc-app-accent)` | Progress fill colour. |
| `--bs-welcome-guide-check-size` | `1.125rem` | Square check indicator side length. |
| `--bs-welcome-guide-check-completed-bg` | `var(--tc-success)` | Completed indicator background. |
| `--bs-welcome-guide-check-active-border` | `var(--tc-app-accent)` | Active indicator border colour. |
| `--bs-welcome-guide-pattern-opacity` | `0.08` | Decorative background image opacity. |
| `--bs-welcome-guide-tick-duration` | `0.3s` | Tick draw animation duration. |

```html
<!-- Basic usage — set steps via JS -->
<tc-welcome-guide id="wg1" title="Get started"></tc-welcome-guide>
<script>
document.getElementById('wg1').messages = [
    'Welcome! Complete these steps to get up and running.',
]
document.getElementById('wg1').steps = [
    { key: 'account', label: 'Create your account', completed: true },
    { key: 'profile', label: 'Set up your profile', completed: false },
    { key: 'team',    label: 'Invite your team',    completed: false },
]
</script>

<!-- Listen for step clicks -->
<tc-welcome-guide id="wg2" title="Onboarding"></tc-welcome-guide>
<script>
const el = document.getElementById('wg2')
el.steps = [
    { key: 'step-1', label: 'Step one', completed: false },
    { key: 'step-2', label: 'Step two', completed: false },
]
el.addEventListener('tc-step-click', e => {
    // Mark the clicked step complete and re-assign
    el.steps = el.steps.map(s =>
        s.key === e.detail.key ? { ...s, completed: true } : s
    )
})
</script>

<!-- With decorative background pattern -->
<tc-welcome-guide
    title="Welcome"
    background-pattern-src="/images/pattern.png"
    background-pattern-alt=""
></tc-welcome-guide>

<!-- Loading skeleton -->
<tc-welcome-guide title="Loading…" loading></tc-welcome-guide>
```

---

### tc-command-reference

Searchable reference guide for CLI commands with usage, descriptions, flags, and aliases. Filters results in real time by command name, description, aliases, and flag text. Port of `@toolcase/react-components` `CommandReference`.

**Tag:** `tc-command-reference`

**Attributes**

| Attribute | Type | Default | Description |
|-----------|------|---------|-------------|
| `searchable` | `string` | `true` | Show the search input. Set to `"false"` to hide it; any other value (or absent) enables search. |
| `search-placeholder` | `string` | `"Search commands…"` | Placeholder text for the search input (also used as its accessible label). |
| `title` | `string` | — | Optional heading text rendered above the search bar. When absent, use the `title` slot instead. |

**JS Properties**

| Property | Type | Description |
|----------|------|-------------|
| `commands` | `CommandItem[]` | Required. Array of command descriptors. Each item: `{ name: string; usage?: string; description?: string; flags?: { flag: string; description?: string }[]; aliases?: string[] }`. Setting re-renders. |

**Events**

| Event | Detail | Description |
|-------|--------|-------------|
| `tc-search` | `{ query: string }` | Dispatched (bubbles, composed) whenever the search query changes. |

**Slots**

| Slot | Description |
|------|-------------|
| `title` | Slotted title content (e.g. a `<span slot="title">…</span>`). Used when the `title` attribute is absent. Preserved across re-renders. |

**Accessibility**

- Search input has a visually-hidden `<label>` linked via `for`/`id`.
- Results region has `role="region"` and `aria-label="Commands"` for landmark navigation.
- Results region has `tabindex="0"` so keyboard users can scroll without a pointer.
- Focus ring visible on both the search input (via `:focus-within` on the wrapper) and the results region (`:focus-visible`).
- `prefers-reduced-motion` is honoured globally via the reset layer.

**CSS custom properties (theming)**

| Property | Default | Description |
|----------|---------|-------------|
| `--bs-command-reference-border-color` | `var(--tc-border)` | Outer frame and section divider color |
| `--bs-command-reference-bg` | `var(--tc-surface)` | Component background |
| `--bs-command-reference-title-bg` | `var(--tc-surface-muted)` | Title header cap background |
| `--bs-command-reference-title-color` | `var(--tc-text)` | Title text color |
| `--bs-command-reference-title-font-size` | `0.9375rem` | Title font size |
| `--bs-command-reference-title-font-weight` | `600` | Title font weight |
| `--bs-command-reference-search-bg` | `var(--tc-surface)` | Search bar background |
| `--bs-command-reference-search-icon-color` | `var(--tc-text-muted)` | Search icon color |
| `--bs-command-reference-search-icon-size` | `0.9rem` | Search icon size |
| `--bs-command-reference-input-color` | `var(--tc-text)` | Search input text color |
| `--bs-command-reference-input-border` | `1px solid var(--tc-border-strong)` | Search input border |
| `--bs-command-reference-input-focus-ring` | `0 0 0 2px var(--tc-focus-ring)` | Focus ring shadow |
| `--bs-command-reference-item-border` | `1px solid var(--tc-slate-100)` | Between-item hairline |
| `--bs-command-reference-name-color` | `var(--tc-text)` | Command name text color |
| `--bs-command-reference-name-font-size` | `0.875rem` | Command name font size |
| `--bs-command-reference-usage-color` | `var(--tc-text-muted)` | Usage string color |
| `--bs-command-reference-desc-color` | `var(--tc-text)` | Description text color |
| `--bs-command-reference-alias-color` | `var(--tc-text-muted)` | Alias chip text color |
| `--bs-command-reference-alias-bg` | `var(--tc-surface-muted)` | Alias chip background |
| `--bs-command-reference-flag-name-color` | `var(--tc-text)` | Flag name text color |
| `--bs-command-reference-flag-desc-color` | `var(--tc-text-muted)` | Flag description text color |
| `--bs-command-reference-empty-color` | `var(--tc-text-faint)` | Empty-state text color |

**Examples**

```html
<!-- Searchable with full command data (set via JS) -->
<tc-command-reference id="cr"></tc-command-reference>
<script>
    const cr = document.getElementById('cr')
    cr.commands = [
        {
            name: 'build',
            usage: 'build [options]',
            description: 'Compile and bundle the project for production.',
            aliases: ['b'],
            flags: [
                { flag: '--watch', description: 'Rebuild on file changes.' },
                { flag: '--minify', description: 'Enable output minification.' },
            ],
        },
        {
            name: 'dev',
            usage: 'dev [port]',
            description: 'Start the development server with HMR.',
            flags: [
                { flag: '--port <number>', description: 'Port to listen on (default: 5173).' },
            ],
        },
    ]
    cr.addEventListener('tc-search', e => console.log('query:', e.detail.query))
</script>

<!-- With title attribute -->
<tc-command-reference title="CLI Reference" search-placeholder="Filter…"></tc-command-reference>

<!-- With slotted title -->
<tc-command-reference>
    <span slot="title">my-cli — command reference</span>
</tc-command-reference>

<!-- Non-searchable -->
<tc-command-reference searchable="false"></tc-command-reference>
```

---

### tc-comparator

Side-by-side comparison table for two technologies with auto winner detection per row and optional summary stats. Purely presentational — no interactive targets, no events.

**Tag:** `tc-comparator`

**Attributes**

| Attribute | Type | Default | Description |
|-----------|------|---------|-------------|
| `title` | `string` | — | Optional heading rendered above the comparison table. |
| `description` | `string` | — | Optional sub-text rendered below the title. |
| `show-summary` | `string` | `""` (true) | Set to `"false"` to hide the summary stats row. Default is to show it. |
| `loading` | boolean | absent | When present, renders skeleton placeholder rows instead of content. |
| `loading-count` | `number` | `5` | Number of skeleton rows to render while loading. |

**JS Properties**

| Property | Type | Description |
|----------|------|-------------|
| `title` | `string \| null` | Reflects the `title` attribute. |
| `description` | `string \| null` | Reflects the `description` attribute. |
| `showSummary` | `boolean` | Set to `false` to hide summary. Default `true`. Setting re-renders. |
| `loading` | `boolean` | Reflects the `loading` attribute. |
| `loadingCount` | `number` | Reflects the `loading-count` attribute. Default `5`. |
| `left` | `ComparatorTechnology \| null` | Left technology descriptor. Setting re-renders the component. |
| `right` | `ComparatorTechnology \| null` | Right technology descriptor. Setting re-renders the component. |
| `features` | `ComparatorFeature[]` | Array of feature rows. Setting re-renders. Default `[]`. |

**`ComparatorTechnology` shape**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | `string` | yes | Technology display name (Inter font). |
| `icon` | `string` | no | Lucide icon name (kebab-case, e.g. `"layers"`, `"database"`). |
| `label` | `string` | no | Secondary mono micro-label (e.g. version, author). |

**`ComparatorFeature` shape**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `label` | `string` | yes | Feature name shown in the centre column. |
| `left` | `boolean \| string \| number` | yes | Left-side value. `true` → check icon, `false` → × icon, string/number → literal text. |
| `right` | `boolean \| string \| number` | yes | Right-side value. Same rendering rules as `left`. |
| `description` | `string` | no | Optional sub-text below the feature label. |

**Winner detection:** booleans — `true` beats `false`; numbers — higher wins; strings that parse as numbers — higher wins; everything else — no winner marked.

**Events**

None. `tc-comparator` is purely presentational.

**Slots**

None. All content is supplied via attributes and JS properties.

**CSS Custom Properties**

| Property | Default | Description |
|----------|---------|-------------|
| `--bs-comparator-border` | `1px solid var(--tc-border)` | Outer frame and major dividers. |
| `--bs-comparator-inner-border` | `1px solid var(--tc-slate-100)` | Between-row hairlines. |
| `--bs-comparator-bg` | `var(--tc-surface)` | Table background. |
| `--bs-comparator-header-bg` | `var(--tc-surface-muted)` | Optional header region background. |
| `--bs-comparator-title-font-size` | `1rem` | Title font size. |
| `--bs-comparator-title-font-weight` | `600` | Title font weight. |
| `--bs-comparator-tech-head-bg` | `var(--tc-surface-muted)` | Technology header row background. |
| `--bs-comparator-tech-name-font-size` | `0.9375rem` | Technology name font size. |
| `--bs-comparator-tech-name-font-weight` | `600` | Technology name font weight. |
| `--bs-comparator-tech-label-font-size` | `0.6875rem` | Technology sub-label font size (mono). |
| `--bs-comparator-tech-icon-size` | `1.125rem` | Technology icon size. |
| `--bs-comparator-tech-icon-color` | `var(--tc-text-muted)` | Technology icon color. |
| `--bs-comparator-feature-label-font-size` | `0.875rem` | Feature label font size. |
| `--bs-comparator-feature-desc-font-size` | `0.75rem` | Feature description font size. |
| `--bs-comparator-feature-desc-color` | `var(--tc-text-muted)` | Feature description text color. |
| `--bs-comparator-indicator-size` | `1rem` | Check/× icon size. |
| `--bs-comparator-yes-color` | `var(--tc-success)` | Check indicator color. |
| `--bs-comparator-no-color` | `var(--tc-text-faint)` | × indicator color. |
| `--bs-comparator-winner-bg` | `var(--tc-surface-muted)` | Winner-cell highlight background. |
| `--bs-comparator-summary-bg` | `var(--tc-surface-muted)` | Summary row background. |
| `--bs-comparator-tally-font-size` | `0.6875rem` | Tally count font size (mono). |
| `--bs-comparator-tally-color` | `var(--tc-text-muted)` | Tally count text color. |

```html
<!-- Basic boolean comparison -->
<tc-comparator id="cmp" title="React vs Vue"></tc-comparator>
<script>
  const el = document.getElementById('cmp')
  el.left = { name: 'React', icon: 'layers', label: 'Meta' }
  el.right = { name: 'Vue', icon: 'triangle', label: 'Evan You' }
  el.features = [
    { label: 'TypeScript support', left: true, right: true },
    { label: 'Server components', left: true, right: false },
    { label: 'Built-in state', left: false, right: true },
  ]
</script>

<!-- Numeric values (higher wins) -->
<tc-comparator id="cmp2" title="Runtime comparison"></tc-comparator>
<script>
  const el2 = document.getElementById('cmp2')
  el2.left = { name: 'Node.js', icon: 'server' }
  el2.right = { name: 'Deno', icon: 'shield' }
  el2.features = [
    { label: 'Stars', left: 105000, right: 93000 },
    { label: 'Cold start (ms)', left: 50, right: 30 },
    { label: 'TypeScript native', left: false, right: true },
  ]
</script>

<!-- Hide summary row -->
<tc-comparator show-summary="false" id="cmp3"></tc-comparator>

<!-- Loading state -->
<tc-comparator loading loading-count="6"></tc-comparator>

<!-- With title and description -->
<tc-comparator
  title="PostgreSQL vs SQLite"
  description="Choose the right database for your use case."
  id="cmp4"
></tc-comparator>
```

---

### tc-compatibility-matrix

**Tag:** `tc-compatibility-matrix`

Matrix table showing compatibility status across versions (rows) and platforms (columns) with status icons and a legend. Purely presentational — no events.

**Attributes**

| Attribute | Type | Default | Description |
|-----------|------|---------|-------------|
| `title` | string | — | Optional heading rendered above the table. |

**JS Properties**

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `title` | `string \| null` | `null` | Reflects the `title` attribute. |
| `versions` | `string[]` | `[]` | Row keys (version labels). Setting re-renders. |
| `platforms` | `string[]` | `[]` | Column keys (platform labels). Setting re-renders. |
| `support` | `Record<string, Record<string, CompatStatus>>` | `{}` | Nested map `support[version][platform] = CompatStatus`. Setting re-renders. Missing entries render as `'unknown'`. |

**`CompatStatus` values**

| Value | Icon | Color |
|-------|------|-------|
| `'yes'` | lucide `check` | `--tc-success` |
| `'no'` | lucide `x` | `--tc-danger` |
| `'partial'` | lucide `minus` | `--tc-warning` |
| `'unknown'` | lucide `help-circle` | `--tc-text-faint` (muted) |

**Events**

None. `tc-compatibility-matrix` is purely presentational.

**Slots**

| Slot | Description |
|------|-------------|
| `title` | Rich heading content when the `title` attribute is absent. Use `<span slot="title">…</span>`. |

**CSS Custom Properties**

| Property | Default | Description |
|----------|---------|-------------|
| `--bs-compatibility-matrix-border` | `1px solid var(--tc-border)` | Outer frame and major dividers. |
| `--bs-compatibility-matrix-inner-border` | `1px solid var(--tc-slate-100)` | Between-row hairlines. |
| `--bs-compatibility-matrix-bg` | `var(--tc-surface)` | Table background. |
| `--bs-compatibility-matrix-head-bg` | `var(--tc-surface-muted)` | Platform header row background. |
| `--bs-compatibility-matrix-version-bg` | `var(--tc-surface-muted)` | Sticky version column background. |
| `--bs-compatibility-matrix-indicator-size` | `1rem` | Status icon size. |
| `--bs-compatibility-matrix-yes-color` | `var(--tc-success)` | "Supported" icon color. |
| `--bs-compatibility-matrix-no-color` | `var(--tc-danger)` | "Not supported" icon color. |
| `--bs-compatibility-matrix-partial-color` | `var(--tc-warning)` | "Partial support" icon color. |
| `--bs-compatibility-matrix-unknown-color` | `var(--tc-text-faint)` | "Unknown" icon color. |
| `--bs-compatibility-matrix-legend-bg` | `var(--tc-surface-muted)` | Legend strip background. |
| `--bs-compatibility-matrix-platform-label-font-size` | `0.6875rem` | Platform header label font size. |
| `--bs-compatibility-matrix-version-label-font-size` | `0.6875rem` | Version label font size. |

```html
<!-- Basic matrix covering all four statuses -->
<tc-compatibility-matrix id="cm" title="Browser Compatibility"></tc-compatibility-matrix>
<script>
  const el = document.getElementById('cm')
  el.versions = ['v1.0', 'v2.0', 'v3.0']
  el.platforms = ['Chrome', 'Firefox', 'Safari', 'Node.js']
  el.support = {
    'v1.0': { Chrome: 'yes', Firefox: 'yes', Safari: 'partial', 'Node.js': 'no' },
    'v2.0': { Chrome: 'yes', Firefox: 'yes', Safari: 'yes',     'Node.js': 'partial' },
    'v3.0': { Chrome: 'yes', Firefox: 'yes', Safari: 'yes',     'Node.js': 'yes' },
  }
</script>

<!-- Rich title via named slot -->
<tc-compatibility-matrix>
  <span slot="title"><strong>Platform</strong> Support</span>
</tc-compatibility-matrix>
```

---

### tc-countdown-timer

Counts down to a target date/time in configurable units (days, hours, minutes, seconds). Visibility-aware: pauses ticking when the tab is hidden and immediately recomputes on resume. Fires a `tc-expire` CustomEvent once when the remaining time reaches zero.

**Tag:** `tc-countdown-timer`

**Attributes**

| Attribute | Type | Default | Description |
|-----------|------|---------|-------------|
| `target` | string | — | Deadline as a millisecond epoch integer or an ISO 8601 date string (e.g. `"2026-12-31T23:59:59Z"`). Required for any countdown to show. |
| `units` | string | `"days,hours,minutes,seconds"` | Comma-separated subset of units to display, in display order. Valid values: `days`, `hours`, `minutes`, `seconds`. Unrecognised values are ignored. |
| `label` | string | — | Optional heading shown above the unit cells (e.g. `"Launch in"`). Rendered as text — no HTML. |
| `sub-label` | string | — | Optional caption shown below the unit cells. Rendered as text — no HTML. |
| `compact` | boolean | `false` | Renders units inline separated by `:` colons with smaller values and no per-unit tile labels. |

**JS Properties**

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `target` | `Date \| number` | `0` | Deadline as a `Date` object or a millisecond epoch number. Setting re-initialises the interval. |
| `units` | `CountdownUnit[]` | `['days','hours','minutes','seconds']` | Array controlling which units are displayed and in what order. Setting re-renders. |
| `label` | `string \| null` | `null` | Reflects the `label` attribute. |
| `subLabel` | `string \| null` | `null` | Reflects the `sub-label` attribute. |
| `compact` | `boolean` | `false` | Reflects the `compact` attribute. |
| `onexpire` | `(() => void) \| null` | `null` | Optional callback fired alongside the `tc-expire` event. |

**Events**

| Event | Detail | Description |
|-------|--------|-------------|
| `tc-expire` | `{}` | Dispatched once when remaining time reaches zero. `bubbles: true`, `composed: true`. |

**Slots**

None. `tc-countdown-timer` is a purely attribute/property-driven component.

**CSS Custom Properties**

| Property | Default | Description |
|----------|---------|-------------|
| `--bs-countdown-timer-gap` | `0.5rem` | Gap between unit cells in normal mode. |
| `--bs-countdown-timer-label-color` | `var(--tc-text-muted)` | Color of the optional `label` text. |
| `--bs-countdown-timer-label-font-size` | `0.6875rem` | Font size of the label. |
| `--bs-countdown-timer-label-letter-spacing` | `0.08em` | Letter-spacing of the label. |
| `--bs-countdown-timer-unit-bg` | `var(--tc-surface)` | Background of each unit cell. |
| `--bs-countdown-timer-unit-border` | `var(--tc-border)` | 1px border color of each unit cell. |
| `--bs-countdown-timer-unit-padding-x` | `0.875rem` | Horizontal padding inside unit cells. |
| `--bs-countdown-timer-unit-padding-y` | `0.75rem` | Vertical padding inside unit cells. |
| `--bs-countdown-timer-unit-min-width` | `3.5rem` | Minimum width for each unit cell. |
| `--bs-countdown-timer-value-color` | `var(--tc-text)` | Color of the countdown digit. |
| `--bs-countdown-timer-value-font-size` | `2rem` | Font size of the countdown digit (normal mode). |
| `--bs-countdown-timer-value-font-weight` | `600` | Font weight of the countdown digit. |
| `--bs-countdown-timer-unit-label-color` | `var(--tc-text-muted)` | Color of the DAYS/HRS/MIN/SEC micro-label. |
| `--bs-countdown-timer-unit-label-font-size` | `0.625rem` | Font size of the unit micro-label. |
| `--bs-countdown-timer-unit-label-letter-spacing` | `0.1em` | Letter-spacing of the unit micro-label. |
| `--bs-countdown-timer-sub-color` | `var(--tc-text-muted)` | Color of the optional `sub-label`. |
| `--bs-countdown-timer-sub-font-size` | `0.75rem` | Font size of the `sub-label`. |
| `--bs-countdown-timer-compact-value-font-size` | `1.25rem` | Digit font size in compact mode. |
| `--bs-countdown-timer-sep-color` | `var(--tc-text-muted)` | Color of the `:` separator in compact mode. |

```html
<!-- Standard countdown with label and sub-label -->
<tc-countdown-timer
  target="2026-12-31T23:59:59Z"
  label="New year in"
  sub-label="UTC midnight"
></tc-countdown-timer>

<!-- Compact mode — inline with colon separators -->
<tc-countdown-timer
  target="2026-12-31T23:59:59Z"
  compact
  label="Expires"
></tc-countdown-timer>

<!-- Custom units via attribute (hours and minutes only) -->
<tc-countdown-timer
  target="2026-12-31T23:59:59Z"
  units="hours,minutes"
></tc-countdown-timer>

<!-- Custom units + expire event via JS -->
<tc-countdown-timer id="ct"></tc-countdown-timer>
<script>
  const el = document.getElementById('ct')
  el.units = ['hours', 'minutes', 'seconds']
  el.target = new Date(Date.now() + 3600 * 1000) // 1 hour from now
  el.addEventListener('tc-expire', () => console.log('Countdown finished!'))
</script>
```

### tc-danger-zone-actions

List of destructive actions rendered inside a danger-bordered panel. Each action row shows a title, optional description, and an `btn-outline-danger` button. Driven entirely by the `actions` JS property. Fires `tc-action-click` when a button is clicked.

**Tag:** `tc-danger-zone-actions`

**Attributes**

| Attribute | Type | Default | Description |
|-----------|------|---------|-------------|
| `class-name` | string | — | Additional CSS classes applied to the inner `.tc-danger-zone` wrapper (not the host element). |

**JS Properties**

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `actions` | `DangerZoneAction[]` | `[]` | Array of action objects. Each item must have `key`, `title`, `buttonLabel`; optional `description`, `icon` (Lucide PascalCase name), `disabled`. Setting re-renders the list. |
| `onactionclick` | `((key: string) => void) \| null` | `null` | Optional callback fired alongside the `tc-action-click` event. |

**Events**

| Event | Detail | Description |
|-------|--------|-------------|
| `tc-action-click` | `{ key: string }` | Dispatched when an action button is clicked. `bubbles: true`, `composed: true`. Not fired for disabled actions. |

**Slots**

None. `tc-danger-zone-actions` is driven entirely by the `actions` JS property.

**CSS Custom Properties**

| Property | Default | Description |
|----------|---------|-------------|
| `--bs-danger-zone-actions-border-color` | `var(--tc-danger)` | Border color of the outer danger panel (left + frame). |
| `--bs-danger-zone-actions-bg` | `var(--tc-danger-bg)` | Background tint of the panel. |
| `--bs-danger-zone-actions-separator-color` | `var(--tc-border)` | 1px hairline between action rows. |
| `--bs-danger-zone-actions-title-color` | `var(--tc-text)` | Color of the action title text. |
| `--bs-danger-zone-actions-desc-color` | `var(--tc-text-muted)` | Color of the optional description text. |
| `--bs-danger-zone-actions-padding-x` | `1rem` | Horizontal padding of each action row. |
| `--bs-danger-zone-actions-padding-y` | `0.875rem` | Vertical padding of each action row. |
| `--bs-danger-zone-actions-gap` | `0.75rem` | Gap between the text block and button in a row. |
| `--bs-danger-zone-actions-title-font-size` | `0.925rem` | Font size of the action title. |
| `--bs-danger-zone-actions-desc-font-size` | `0.8125rem` | Font size of the description. |
| `--bs-danger-zone-actions-btn-min-height` | `2rem` | Minimum height of action buttons. |

```html
<!-- Basic usage -->
<tc-danger-zone-actions id="dz"></tc-danger-zone-actions>
<script>
  const el = document.getElementById('dz')
  el.actions = [
    {
      key: 'delete-account',
      title: 'Delete account',
      description: 'Permanently remove your account and all its data.',
      buttonLabel: 'Delete account',
    },
    {
      key: 'reset-data',
      title: 'Reset all data',
      description: 'Wipe all project data. Your billing will remain active.',
      buttonLabel: 'Reset data',
    },
  ]
  el.addEventListener('tc-action-click', e => console.log('clicked:', e.detail.key))
</script>

<!-- With icons and a disabled action -->
<tc-danger-zone-actions id="dz2"></tc-danger-zone-actions>
<script>
  document.getElementById('dz2').actions = [
    { key: 'revoke', title: 'Revoke tokens', buttonLabel: 'Revoke', icon: 'KeyRound' },
    { key: 'delete', title: 'Delete workspace', buttonLabel: 'Delete', icon: 'Trash2', disabled: true },
  ]
</script>

### tc-metric-card

Dashboard card showing a prominent metric with optional icon chip, subtitle, and inline SVG sparkline. Purely presentational — no events.

**Tag:** `tc-metric-card`

**Attributes**

| Attribute | Type | Default | Description |
|-----------|------|---------|-------------|
| `title` | `string` | `''` | Metric label displayed above the value (micro-caps style). Required. |
| `value` | `string` | `''` | Prominent headline figure (the metric itself). Required. |
| `subtitle` | `string \| null` | `null` | Muted supporting line displayed below the value. |
| `icon` | `string \| null` | `null` | Lucide icon name (PascalCase, e.g. `"TrendingUp"`). Rendered as a slate icon chip. |
| `trend-color` | `string \| null` | `null` | Any CSS color applied to the sparkline stroke. Defaults to `--tc-text-muted` when absent. |
| `loading` | boolean | `false` | When set, replaces card content with an animated skeleton placeholder. |

**JS Properties**

| Property | Type | Description |
|----------|------|-------------|
| `title` | `string` | Reflected from the `title` attribute (native `HTMLElement.title`). |
| `value` | `string` | Reflected from the `value` attribute. |
| `subtitle` | `string \| null` | Reflected from the `subtitle` attribute. |
| `icon` | `string \| null` | Reflected from the `icon` attribute. |
| `trend` | `number[]` | Array of data points to plot as a sparkline. JS property only — not an attribute. Setting re-renders the sparkline. |
| `trendColor` | `string \| null` | Reflected from the `trend-color` attribute. |
| `loading` | `boolean` | Reflected from the `loading` boolean attribute. |

**Events**

None. `tc-metric-card` is purely presentational.

**Slots**

None. Driven entirely by attributes and the `trend` JS property.

**Accessibility**

- The sparkline SVG carries `aria-hidden="true"`; the metric value is conveyed by the visible text, not the chart.
- The icon chip carries `aria-hidden="true"` — decorative only.
- During loading, the host receives `role="status"` and `aria-busy="true"`; the inner card receives `aria-hidden="true"`; a visually-hidden `Loading…` span is present for screen readers.
- `prefers-reduced-motion` freezes the skeleton shimmer to a static fill.

**CSS Custom Properties**

| Property | Default | Description |
|----------|---------|-------------|
| `--bs-metric-card-bg` | `var(--tc-surface)` | Card background. |
| `--bs-metric-card-border-color` | `var(--tc-border)` | 1px hairline border colour. |
| `--bs-metric-card-shadow` | `var(--tc-shadow-sm)` | Resting box shadow. |
| `--bs-metric-card-padding-y` | `1rem` | Vertical inner padding. |
| `--bs-metric-card-padding-x` | `1.25rem` | Horizontal inner padding. |
| `--bs-metric-card-icon-chip-bg` | `var(--tc-surface-muted)` | Icon chip background (slate, not coloured). |
| `--bs-metric-card-icon-color` | `var(--tc-text-muted)` | Icon colour. |
| `--bs-metric-card-icon-size` | `1rem` | Icon SVG width/height. |
| `--bs-metric-card-title-color` | `var(--tc-text-muted)` | Title label colour. |
| `--bs-metric-card-title-font-size` | `0.6875rem` | Title label font size. |
| `--bs-metric-card-value-color` | `var(--tc-text)` | Headline value colour. |
| `--bs-metric-card-value-font-size` | `1.75rem` | Headline value font size. |
| `--bs-metric-card-value-font-weight` | `600` | Headline value font weight. |
| `--bs-metric-card-subtitle-color` | `var(--tc-text-muted)` | Subtitle colour. |
| `--bs-metric-card-subtitle-font-size` | `0.75rem` | Subtitle font size. |
| `--bs-metric-card-trend` | `var(--tc-text-muted)` | Sparkline stroke colour. Overridden by the `trend-color` attribute via inline style. |
| `--bs-metric-card-spark-height` | `2rem` | Sparkline SVG rendered height. |

```html
<!-- Basic: title + value -->
<tc-metric-card title="Monthly Revenue" value="$42,100"></tc-metric-card>

<!-- With icon and subtitle -->
<tc-metric-card title="Active Users" value="8,340" subtitle="Last 30 days" icon="Users"></tc-metric-card>

<!-- With sparkline trend (JS property) -->
<tc-metric-card id="mc" title="Weekly Sessions" value="3,640" icon="TrendingUp"></tc-metric-card>
<script>
  document.getElementById('mc').trend = [12, 28, 20, 45, 35, 60, 50, 72]
</script>

<!-- Custom trend color -->
<tc-metric-card id="mc2" title="Error Rate" value="2.4%" trend-color="var(--tc-danger)"></tc-metric-card>
<script>
  document.getElementById('mc2').trend = [80, 65, 70, 55, 60, 45, 50, 35]
</script>

<!-- Loading skeleton -->
<tc-metric-card loading title="Revenue" value="0"></tc-metric-card>
```
```

---

### tc-slices-card

Dashboard card with a donut/pie chart and a labeled legend. Driven by a JS property array of slices. Purely presentational — no events.

**Tag:** `tc-slices-card`

**Attributes**

| Attribute | Type | Default | Description |
|-----------|------|---------|-------------|
| `title` | `string \| null` | `null` | Optional card heading displayed in the card header. |
| `size` | `number` | `160` | Donut SVG diameter in pixels. |
| `stroke-width` | `number` | `24` | Donut ring thickness in pixels. |
| `loading` | boolean | `false` | When set, replaces card content with an animated skeleton placeholder. |

**JS Properties**

| Property | Type | Description |
|----------|------|-------------|
| `title` | `string \| null` | Reflected from the `title` attribute (native `HTMLElement.title`). |
| `slices` | `SliceItem[]` | Array of slice data objects. Setting re-computes and re-renders the donut and legend. |
| `size` | `number` | Reflected from the `size` attribute. |
| `strokeWidth` | `number` | Reflected from the `stroke-width` attribute. |
| `loading` | `boolean` | Reflected from the `loading` boolean attribute. |

**SliceItem interface**

```ts
interface SliceItem {
  label: string    // Legend label text
  value: number   // Numeric value — used to compute arc length and percentage
  color?: string  // Optional CSS color. Defaults to a quiet slate ramp when omitted.
}
```

**Events**

None. `tc-slices-card` is purely presentational.

**Slots**

None. Driven entirely by attributes and the `slices` JS property.

**Accessibility**

- The donut SVG carries `aria-hidden="true"`; data is conveyed by the legend list.
- The legend is a `<ul role="list">` with text labels, numeric values, and percentage — not color-only.
- During loading, the host receives `role="status"` and `aria-busy="true"`; a visually-hidden `Loading…` span is present for screen readers.
- `prefers-reduced-motion` freezes the skeleton shimmer to a static fill.

**CSS Custom Properties**

| Property | Default | Description |
|----------|---------|-------------|
| `--bs-slices-card-bg` | `var(--tc-surface)` | Card background. |
| `--bs-slices-card-border-color` | `var(--tc-border)` | 1px hairline border colour. |
| `--bs-slices-card-shadow` | `var(--tc-shadow-sm)` | Resting box shadow. |
| `--bs-slices-card-padding-y` | `1rem` | Vertical inner padding. |
| `--bs-slices-card-padding-x` | `1.25rem` | Horizontal inner padding. |
| `--bs-slices-card-title-color` | `var(--tc-text-muted)` | Card header title colour. |
| `--bs-slices-card-title-font-size` | `0.6875rem` | Card header title font size. |
| `--bs-slices-card-total-color` | `var(--tc-text)` | Center total figure colour. |
| `--bs-slices-card-total-font-size` | `1rem` | Center total figure font size. |
| `--bs-slices-card-total-font-weight` | `600` | Center total figure font weight. |
| `--bs-slices-card-swatch-size` | `0.625rem` | Legend color swatch width/height. |
| `--bs-slices-card-legend-label-color` | `var(--tc-text)` | Legend label colour. |
| `--bs-slices-card-legend-label-font-size` | `0.8125rem` | Legend label font size. |
| `--bs-slices-card-legend-value-color` | `var(--tc-text-muted)` | Legend value colour. |
| `--bs-slices-card-legend-percent-color` | `var(--tc-text-muted)` | Legend percent colour. |
| `--bs-slices-card-empty-ring-color` | `var(--tc-border)` | Stroke colour when no slices are provided. |

```html
<!-- Colored slices -->
<tc-slices-card id="sc1" title="Downloads by Language"></tc-slices-card>
<script>
  document.getElementById('sc1').slices = [
    { label: 'JavaScript', value: 4820, color: '#f59e0b' },
    { label: 'TypeScript', value: 3140, color: '#6366f1' },
    { label: 'Python',     value: 2200, color: '#22c55e' },
  ]
</script>

<!-- Uncolored — quiet slate ramp applied automatically -->
<tc-slices-card id="sc2" title="Issues by Status"></tc-slices-card>
<script>
  document.getElementById('sc2').slices = [
    { label: 'Open',        value: 142 },
    { label: 'In Progress', value: 87  },
    { label: 'Closed',      value: 218 },
  ]
</script>

<!-- Custom size -->
<tc-slices-card id="sc3" title="Large donut" size="200" stroke-width="32"></tc-slices-card>
<script>
  document.getElementById('sc3').slices = [
    { label: 'A', value: 60, color: '#6366f1' },
    { label: 'B', value: 40, color: '#22c55e' },
  ]
</script>

<!-- Loading skeleton -->
<tc-slices-card loading title="Downloads"></tc-slices-card>
```

---

### tc-diff-viewer

Side-by-side or unified line diff of two text blocks with per-line add/remove highlighting. Uses an LCS-based line diff algorithm. No syntax highlighting — the component renders plain text with semantic color cues only.

**Tag:** `tc-diff-viewer`

**Attributes**

| Attribute | Type | Default | Description |
|-----------|------|---------|-------------|
| `before` | `string` | `""` | The "before" text. May also be set via the JS property for large multi-line content. |
| `after` | `string` | `""` | The "after" text. May also be set via the JS property for large multi-line content. |
| `mode` | `"split" \| "unified"` | `"split"` | Layout mode. `split` renders two side-by-side panes; `unified` renders a single column with `+`/`-` prefixes. |
| `language` | `string \| null` | `null` | Optional language label displayed in the header (e.g. `"typescript"`). |
| `filename` | `string \| null` | `null` | Optional filename displayed in the header. |

**JS Properties**

| Property | Type | Description |
|----------|------|-------------|
| `before` | `string` | The "before" text. Setting this property re-renders immediately without touching the attribute — preferred for large multi-line strings. |
| `after` | `string` | The "after" text. Same semantics as `before`. |
| `mode` | `DiffViewerMode` | Reflected from the `mode` attribute. |
| `language` | `string \| null` | Reflected from the `language` attribute. |
| `filename` | `string \| null` | Reflected from the `filename` attribute. |

**Events**

| Event | `detail` | Description |
|-------|----------|-------------|
| `tc-render` | `{}` | Dispatched (bubbles, composed) after each diff re-render. Useful for timing measurements or post-render hooks. |

**Slots**

None. Driven entirely by attributes and JS properties.

**Accessibility**

- Each pane / the unified view renders as a `<table role="table">` so screen readers can traverse rows.
- Gutter line-number cells carry `aria-hidden="true"` — they are decorative.
- Added and removed rows carry `aria-label="Added: <line text>"` / `aria-label="Removed: <line text>"` so color is not the only cue.
- Empty counterpart rows in split mode carry `aria-hidden="true"`.
- Prefix cells (`+` / `-`) in unified mode carry `aria-hidden="true"` — the row `aria-label` is the accessible cue.
- `prefers-reduced-motion` is honoured (no transitions are used; the block ensures forward-compatibility).

**CSS Custom Properties**

| Property | Default | Description |
|----------|---------|-------------|
| `--bs-diff-viewer-bg` | `var(--tc-surface)` | Viewer background. |
| `--bs-diff-viewer-border` | `1px solid var(--tc-border)` | Outer hairline border. |
| `--bs-diff-viewer-header-bg` | `var(--tc-surface-muted)` | Header bar background. |
| `--bs-diff-viewer-header-border` | `1px solid var(--tc-border)` | Header bottom border. |
| `--bs-diff-viewer-header-filename-color` | `var(--tc-text)` | Filename text color. |
| `--bs-diff-viewer-header-language-color` | `var(--tc-text-faint)` | Language label color. |
| `--bs-diff-viewer-sep` | `1px solid var(--tc-border)` | Separator between split panes. |
| `--bs-diff-viewer-gutter-width` | `3.5rem` | Width of the line-number gutter column. |
| `--bs-diff-viewer-gutter-color` | `var(--tc-text-faint)` | Gutter number color. |
| `--bs-diff-viewer-gutter-bg` | `var(--tc-surface-muted)` | Gutter background. |
| `--bs-diff-viewer-gutter-sep` | `1px solid var(--tc-border)` | Gutter right-border separator. |
| `--bs-diff-viewer-code-font-size` | `0.8125rem` | Code cell font size. |
| `--bs-diff-viewer-code-line-height` | `1.6` | Code line height. |
| `--bs-diff-viewer-added-bg` | `var(--tc-success-bg)` | Added line row background. |
| `--bs-diff-viewer-added-gutter-bg` | `#bbf7d0` | Added line gutter background (deeper tint). |
| `--bs-diff-viewer-added-color` | `var(--tc-success)` | Added line gutter/prefix color. |
| `--bs-diff-viewer-removed-bg` | `var(--tc-danger-bg)` | Removed line row background. |
| `--bs-diff-viewer-removed-gutter-bg` | `#fecaca` | Removed line gutter background (deeper tint). |
| `--bs-diff-viewer-removed-color` | `var(--tc-danger)` | Removed line gutter/prefix color. |
| `--bs-diff-viewer-empty-bg` | `var(--tc-surface-muted)` | Empty counterpart rows in split mode. |

```html
<!-- Split mode (default) with filename and language -->
<tc-diff-viewer
  id="dv1"
  mode="split"
  filename="src/server.ts"
  language="typescript"
></tc-diff-viewer>
<script>
  const dv1 = document.getElementById('dv1')
  dv1.before = 'function hello() {\n  console.log("hi")\n}'
  dv1.after  = 'function hello(name: string): void {\n  console.log(`hi ${name}`)\n}'
</script>

<!-- Unified mode -->
<tc-diff-viewer
  id="dv2"
  mode="unified"
  filename="deploy.sh"
  language="bash"
></tc-diff-viewer>
<script>
  const dv2 = document.getElementById('dv2')
  dv2.before = '#!/bin/bash\nnpm install\nnpm run build'
  dv2.after  = '#!/bin/bash\nnpm ci\nnpm run build\nnpm test'
</script>

<!-- Attribute-set content (short strings) -->
<tc-diff-viewer
  mode="split"
  before="hello world"
  after="hello toolcase"
></tc-diff-viewer>
```

---

### tc-early-signup-form

Email signup panel with a benefits list, inline validation, and a confirmation success state. Set `benefits` via JS property. Fires `tc-submit` on valid email submission, then switches to the success state.

**Tag:** `tc-early-signup-form`

**Attributes**

| Attribute | Type | Default | Description |
|-----------|------|---------|-------------|
| `title` | string | `'Get early access'` | Panel heading. |
| `subtitle` | string | — | Optional paragraph below the heading. |
| `eyebrow` | string | — | Monospace micro-label rendered above the title. |
| `helper-text` | string | — | Small text rendered below the submit button. |
| `cta-label` | string | `'Notify me'` | Submit button label. |
| `placeholder` | string | `'you@email.com'` | Email input placeholder. |
| `success-title` | string | `"You're on the list."` | Heading shown in the success state. |
| `success-message` | string | — | Body text in the success state. Defaults to `"We'll email {email} when access opens up."` |
| `variant` | `'light' \| 'dark'` | `'light'` | Light variant on `--tc-surface`; dark variant on `--tc-ink` with white text. |
| `loading` | boolean | `false` | Disables the input and shows a spinner in the submit button. |

**JS Properties**

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `benefits` | `string[]` | `[]` | Array of benefit strings rendered as a check-icon list. Set via JS (`el.benefits = [...]`). Re-renders when changed. |
| `onSubmit` | `((email: string) => void) \| null` | `null` | Optional callback fired alongside the `tc-submit` CustomEvent. |

**Events**

| Event | `detail` | Description |
|-------|----------|-------------|
| `tc-submit` | `{ email: string }` | Dispatched (bubbles, composed) when a valid email is submitted. The component immediately transitions to the success state. |

**Slots**

None. Driven entirely by attributes and JS properties.

**Accessibility**

- Email `<input>` has an associated `<label>` (visually hidden when the panel has a title).
- Validation error is announced via `aria-live="assertive"` on a persistent error paragraph, and `aria-describedby` points the input at it.
- Submit button is a native `<button type="submit">` — keyboard submittable.
- Disabled/loading state applies the HTML `disabled` attribute (no pointer events, opacity 0.65).
- On success, focus moves to the success title (`tabindex="-1"`) so screen readers announce the confirmation.
- `prefers-reduced-motion` is honoured — all transitions and hover lifts are frozen.
- 44 px minimum touch targets on coarse-pointer devices.

**CSS Custom Properties**

| Property | Default | Description |
|----------|---------|-------------|
| `--bs-early-signup-form-bg` | `var(--tc-surface)` | Panel background (light) / `var(--tc-ink)` (dark). |
| `--bs-early-signup-form-border` | `1px solid var(--tc-border)` | Outer hairline border. |
| `--bs-early-signup-form-color` | `var(--tc-text)` | Primary text color. |
| `--bs-early-signup-form-muted-color` | `var(--tc-text-muted)` | Secondary/muted text. |
| `--bs-early-signup-form-eyebrow-color` | `var(--tc-text-faint)` | Eyebrow micro-label color. |
| `--bs-early-signup-form-input-border` | `var(--tc-border-strong)` | Email input border color. |
| `--bs-early-signup-form-input-focus-ring` | `var(--tc-focus-ring)` | Focus ring box-shadow on the input. |
| `--bs-early-signup-form-submit-bg` | `linear-gradient(135deg, var(--tc-app-accent), #2b3a51)` | Submit button background gradient. |
| `--bs-early-signup-form-check-color` | `var(--tc-success)` | Benefit check-icon color. |
| `--bs-early-signup-form-error-color` | `var(--tc-danger)` | Validation error text color. |
| `--bs-early-signup-form-success-color` | `var(--tc-success)` | Success state icon color. |
| `--bs-early-signup-form-padding` | `2rem` | Panel padding. |

```html
<!-- Light variant -->
<tc-early-signup-form
  id="signup"
  variant="light"
  title="Get early access"
  eyebrow="Early access"
  subtitle="Be first to know when we ship."
  cta-label="Join the waitlist"
  placeholder="you@example.com"
  helper-text="One email when we launch. No spam, ever."
></tc-early-signup-form>
<script>
  const el = document.getElementById('signup')
  el.benefits = [
    'Zero-config setup',
    'Framework-free: React, Vue, or plain HTML',
    'Full accessibility baked in',
  ]
  el.addEventListener('tc-submit', e => {
    console.log('signed up:', e.detail.email)
  })
</script>

<!-- Dark variant -->
<tc-early-signup-form
  variant="dark"
  title="Shape the product"
  eyebrow="Beta program"
  cta-label="Request access"
  success-title="Request received."
  success-message="We'll reach out within 48 hours."
></tc-early-signup-form>
```

---

### tc-editable-text

Inline editable label — looks like plain text at rest, reveals a form-control border on hover/focus. Commits on Enter or blur; reverts to the last committed value on Escape without firing a change event.

**Tag:** `tc-editable-text`

**Attributes**

| Attribute | Type | Default | Description |
|-----------|------|---------|-------------|
| `default-value` | string | `""` | The initial and committed value |
| `placeholder` | string | — | Placeholder text shown when empty |
| `disabled` | boolean | false | Disables editing (native `disabled` + opacity) |
| `aria-label` | string | — | Accessible name forwarded to the inner `<input>` |

**JS Properties**

| Property | Type | Description |
|----------|------|-------------|
| `value` | string (read-only) | Current committed value |
| `defaultValue` | string | Reflects `default-value` attribute |
| `disabled` | boolean | Reflects `disabled` attribute |
| `placeholder` | string | Reflects `placeholder` attribute |
| `onChange` | `((value: string) => void) \| null` | Optional callback fired on commit |

**Events**

| Event | Detail | Description |
|-------|--------|-------------|
| `tc-change` | `{ value: string }` | Fired when a new value is committed (blur or Enter), but not on Escape or when value is unchanged |

**Slots:** none

```html
<!-- Default value + event listener -->
<tc-editable-text id="proj" default-value="My Project" aria-label="Project name"></tc-editable-text>
<script>
  document.getElementById('proj').addEventListener('tc-change', e => {
    console.log('committed:', e.detail.value)
  })
</script>

<!-- Placeholder only -->
<tc-editable-text placeholder="Click to add a label…" aria-label="Add label"></tc-editable-text>

<!-- Disabled -->
<tc-editable-text default-value="Archived" aria-label="Status" disabled></tc-editable-text>
```

---

### tc-ecosystem-map

Concentric ring diagram showing ecosystem relationships, rendered as an inline SVG. Always renders a semantic list fallback (`tc-ecosystem-map__list`) alongside the diagram for accessibility and no-SVG contexts. Set `core` and `rings` via JS properties; `size` via attribute.

**Tag:** `tc-ecosystem-map`

**Attributes**

| Attribute | Type | Default | Description |
|-----------|------|---------|-------------|
| `size` | number | `480` | Diameter of the SVG diagram in pixels. Re-renders when changed. |
| `title` | string | — | Optional heading rendered above the diagram as an `<h3>`. When set, takes precedence over the `slot="title"` slot. Read via `getAttribute('title')` (native `HTMLElement.title` reflection). |

**JS Properties**

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `core` | `{ name: string; label?: string }` | `{ name: '' }` | Center node of the diagram. Set via JS (`el.core = { name: '@pkg/core', label: 'core' }`). Re-renders when changed. |
| `rings` | `EcosystemRing[]` | `[]` | Array of rings, each with an optional `label` and an `items: EcosystemNode[]` array. Each node has `name: string`, optional `href?: string` (makes the SVG node a link), and optional `accent?: string` (CSS value for `--em-node-accent`). Set via JS (`el.rings = [...]`). Re-renders when changed. |

**Events**

| Event | `detail` | Description |
|-------|----------|-------------|
| `tc-select` | `{ id: string }` | Dispatched (bubbles, composed) when a non-href node in the SVG is clicked or activated via keyboard. `id` encodes the ring index, node index, and name (`"ri-ni-name"`). |

**Slots**

| Slot | Description |
|------|-------------|
| `title` | Rich content rendered above the diagram when the `title` attribute is not set. Use for headings with markup. |

**Accessibility**

- The SVG carries `role="img"` with an `aria-label` and an inner `<title>` summarising the ecosystem (e.g. `"Ecosystem map: @core, 2 rings, 10 nodes"`).
- The list fallback (`tc-ecosystem-map__list`) is always rendered and is the primary accessible content for screen readers — it is NOT `aria-hidden`.
- Non-href nodes in the SVG are `<g role="button" tabindex="0">` — keyboard-reachable with Enter/Space to dispatch `tc-select`. Focus shows a 2px `--tc-app-accent` outline and a thickened dot stroke.
- `<a href>` nodes in the SVG are native SVG anchors — fully keyboard navigable.
- `prefers-reduced-motion` removes all CSS transitions.

**CSS Custom Properties**

| Property | Default | Description |
|----------|---------|-------------|
| `--bs-ecosystem-map-core-fill` | `var(--tc-app-accent)` | Core disc fill (slate ink). |
| `--bs-ecosystem-map-core-text` | `#fff` | Text color on the core disc. |
| `--bs-ecosystem-map-ring-stroke` | `var(--tc-border)` | Dashed ring circle stroke color. |
| `--bs-ecosystem-map-connector-stroke` | `var(--tc-border)` | Connector line stroke color. |
| `--bs-ecosystem-map-node-fill` | `var(--tc-surface)` | Node dot fill. |
| `--bs-ecosystem-map-node-stroke` | `var(--tc-border)` | Node dot border stroke. |
| `--bs-ecosystem-map-node-text` | `var(--tc-text)` | Node text color in the list fallback. |
| `--bs-ecosystem-map-node-label-color` | `var(--tc-text-muted)` | SVG node label text color. |
| `--bs-ecosystem-map-list-bg` | `var(--tc-surface)` | List node chip background. |
| `--bs-ecosystem-map-list-border` | `var(--tc-border)` | List node chip border color. |
| `--bs-ecosystem-map-list-label-color` | `var(--tc-text-faint)` | List group label color. |
| `--bs-ecosystem-map-title-color` | `var(--tc-text)` | Title `<h3>` color. |

```html
<tc-ecosystem-map id="map" title="Package ecosystem" size="480"></tc-ecosystem-map>
<script>
  const el = document.getElementById('map')
  el.core = { name: '@your/core', label: 'core' }
  el.rings = [
    {
      label: 'Official',
      items: [
        { name: '@your/auth' },
        { name: '@your/cache' },
        { name: '@your/queue' },
        { name: '@your/router' },
      ],
    },
    {
      label: 'Community',
      items: [
        { name: 'lib-x', href: 'https://example.com/lib-x' },
        { name: 'lib-y' },
        { name: 'lib-z' },
      ],
    },
  ]
  el.addEventListener('tc-select', e => {
    console.log('selected node id:', e.detail.id)
  })
</script>
```

---

### tc-entity-profile-card

Entity profile card with a hero section (lead avatar, title, subtitle, chips row) and a meta-information grid of label-value pairs. Presentational only — no events.

**Tag:** `tc-entity-profile-card`

**Attributes**

| Attribute | Type | Default | Description |
|-----------|------|---------|-------------|
| `title` | `string` | `''` | Plain text title rendered as an `<h3>` heading in the hero. Acts as a fallback when no `slot="title"` child is present. Native `HTMLElement.title` — no JS getter/setter. |
| `loading` | boolean | `false` | When set, replaces card content with an animated skeleton placeholder. |

**JS Properties**

| Property | Type | Description |
|----------|------|-------------|
| `meta` | `EntityProfileCardMetaItem[]` | Array of `{ label: string; value: string }` pairs rendered in the meta grid. Not reflected to an attribute — set via property only (use a `ref`). |
| `loading` | `boolean` | Reflected from the `loading` attribute. |

**Events**

None. `tc-entity-profile-card` is purely presentational.

**Slots**

| Slot | Description |
|------|-------------|
| `lead` | Optional lead region at the top of the hero (e.g. a `tc-avatar`). |
| `title` | Rich title content — takes priority over the `title` attribute when present. |
| `subtitle` | Optional subtitle text below the title (e.g. a role / team line). |
| `chips` | Optional row of chips below the subtitle (e.g. `tc-badge` elements for tags/skills). |

**Accessibility**

- The title is rendered inside an `<h3>` heading for a correct document outline.
- The meta grid uses `<dl>` / `<dt>` / `<dd>` semantics so label-value pairs are associated for assistive technology.
- During loading, the host receives `role="status"` and `aria-busy="true"`; the inner card receives `aria-hidden="true"`; a visually-hidden `Loading…` text is included for screen readers.
- `prefers-reduced-motion` freezes the skeleton shimmer to a static fill.
- Slotted interactive controls keep their visible focus styles — the card itself is presentational.

**CSS Custom Properties**

| Property | Default | Description |
|----------|---------|-------------|
| `--bs-entity-profile-card-bg` | `var(--tc-surface)` | Card background. |
| `--bs-entity-profile-card-border-color` | `var(--tc-border)` | 1px hairline border colour. |
| `--bs-entity-profile-card-shadow` | `var(--tc-shadow-sm)` | Resting box shadow. |
| `--bs-entity-profile-card-hero-gradient-start` | `rgba(0,0,0,0.04)` | Ink gradient start colour for the hero cap. |
| `--bs-entity-profile-card-title-color` | `var(--tc-text)` | Hero title colour. |
| `--bs-entity-profile-card-title-font-size` | `1rem` | Hero title font size. |
| `--bs-entity-profile-card-title-font-weight` | `600` | Hero title font weight. |
| `--bs-entity-profile-card-subtitle-color` | `var(--tc-text-muted)` | Subtitle colour. |
| `--bs-entity-profile-card-subtitle-font-size` | `0.8125rem` | Subtitle font size. |
| `--bs-entity-profile-card-meta-separator` | `var(--tc-border)` | Colour of the 1px separators between meta cells. |
| `--bs-entity-profile-card-meta-label-color` | `var(--tc-text-muted)` | Meta label colour. |
| `--bs-entity-profile-card-meta-label-font-size` | `0.6875rem` | Meta label font size. |
| `--bs-entity-profile-card-meta-label-letter-spacing` | `0.08em` | Meta label letter-spacing. |
| `--bs-entity-profile-card-meta-value-color` | `var(--tc-text)` | Meta value colour. |
| `--bs-entity-profile-card-meta-value-font-size` | `0.875rem` | Meta value font size. |

```html
<!-- Title attribute + meta grid via JS property -->
<tc-entity-profile-card title="Anthropic AI"></tc-entity-profile-card>
<script>
  document.querySelector('tc-entity-profile-card').meta = [
    { label: 'Location', value: 'San Francisco, CA' },
    { label: 'Language', value: 'TypeScript' },
    { label: 'Stars', value: '12.4k' },
    { label: 'Joined', value: 'Jan 2019' },
  ]
</script>

<!-- Slotted lead, title, subtitle, and chips -->
<tc-entity-profile-card>
  <tc-avatar slot="lead" name="Alice Chen" size="lg"></tc-avatar>
  <strong slot="title">Alice Chen</strong>
  <span slot="subtitle">Senior Frontend Engineer · Anthropic</span>
  <tc-badge slot="chips" variant="primary">TypeScript</tc-badge>
  <tc-badge slot="chips" variant="secondary">React</tc-badge>
</tc-entity-profile-card>

<!-- Loading skeleton -->
<tc-entity-profile-card loading></tc-entity-profile-card>
```

---

### tc-extended-select

Searchable dropdown with debounced filtering (150 ms), keyboard navigation, optional item descriptions, and native form-submission support via a hidden `<input>`. Implements the combobox/listbox ARIA pattern.

**Tag:** `tc-extended-select`

**Attributes**

| Attribute | Type | Default | Description |
|-----------|------|---------|-------------|
| `value` | string | — | Key of the currently selected item |
| `name` | string | — | Field name for native form submission (`<input type="hidden">`) |
| `placeholder` | string | `"Select…"` | Trigger label when nothing is selected |
| `search-placeholder` | string | `"Search…"` | Placeholder text in the search input |
| `no-results-text` | string | `"No results"` | Message shown when the filter returns no matches |
| `loading` | boolean | false | Disables the trigger and shows a spinner; the menu cannot be opened |

**JS Properties**

| Property | Type | Description |
|----------|------|-------------|
| `items` | `ExtendedSelectItem[]` | Options list — set via JS property, not attribute |
| `onChange` | `((value: string) => void) \| null` | Optional callback fired alongside `tc-change` |

Each `ExtendedSelectItem`:

| Field | Type | Description |
|-------|------|-------------|
| `key` | string | Unique identifier; becomes the selected `value` |
| `label` | string | Primary display text shown in trigger and option row |
| `description` | string? | Optional secondary line shown in muted text below the label |

**Events:** `tc-change` with `{ detail: { value: string } }`

**Slots:** none — the option list is generated from the `items` JS property.

**Keyboard navigation (while menu is open)**

| Key | Action |
|-----|--------|
| `ArrowDown` | Move highlight to next option (wraps) |
| `ArrowUp` | Move highlight to previous option (wraps) |
| `Home` | Jump to first option |
| `End` | Jump to last option |
| `Enter` | Select highlighted option |
| `Escape` | Close menu, return focus to trigger |

```html
<tc-extended-select
  id="fw-picker"
  placeholder="Choose a framework…"
  search-placeholder="Search…"
  name="framework"
></tc-extended-select>
<script>
const el = document.getElementById('fw-picker')
el.items = [
  { key: 'react',   label: 'React',   description: 'UI library by Meta' },
  { key: 'vue',     label: 'Vue',     description: 'Progressive framework' },
  { key: 'svelte',  label: 'Svelte',  description: 'Compile-time framework' },
  { key: 'angular', label: 'Angular', description: 'Platform by Google' },
]
el.addEventListener('tc-change', e => console.log('selected:', e.detail.value))
</script>

<!-- Preselected value -->
<tc-extended-select value="vue" name="framework"></tc-extended-select>

<!-- Loading state -->
<tc-extended-select placeholder="Fetching…" loading></tc-extended-select>
```

---

### tc-faq-list

Collapsible FAQ accordion with optional JSON-LD `FAQPage` schema generation for SEO. Items are fully independent — multiple panels may be open simultaneously. The chevron rotates with a CSS transition that honours `prefers-reduced-motion`.

**Tag:** `tc-faq-list`

**Attributes**

| Attribute | Type | Default | Description |
|-----------|------|---------|-------------|
| `schema` | boolean | false | When present, renders an inline `<script type="application/ld+json">` containing a `FAQPage` JSON-LD object built from `items` |
| `title` | string | — | Text title rendered as an `<h2>` above the list. When absent, slotted children fill the title region instead |

**JS Properties**

| Property | Type | Description |
|----------|------|-------------|
| `items` | `FAQItem[]` | FAQ entries — set via JS property (not attribute) |
| `defaultOpen` | `number[]` | Indices of items expanded on first render |
| `onToggle` | `((index: number, open: boolean) => void) \| null` | Optional callback fired alongside `tc-toggle` |

Each `FAQItem`:

| Field | Type | Description |
|-------|------|-------------|
| `question` | string | The question text shown in the collapsible header button |
| `answer` | string | The answer text shown in the collapsible panel |

**Events:** `tc-toggle` with `{ detail: { index: number, open: boolean } }`

**Slots**

| Slot | Description |
|------|-------------|
| *(default)* | Title content rendered above the FAQ list when the `title` attribute is absent. Preserved across re-renders. |

**CSS Custom Properties**

| Property | Default | Description |
|----------|---------|-------------|
| `--bs-faq-list-border` | `var(--tc-border)` | Outer border and separator colour |
| `--bs-faq-list-bg` | `var(--tc-surface)` | Background colour |
| `--bs-faq-list-question-color` | `var(--tc-text)` | Question text and chevron colour |
| `--bs-faq-list-answer-color` | `var(--tc-text-muted)` | Answer text colour |
| `--bs-faq-list-hover-bg` | `var(--tc-surface-muted)` | Question row hover fill |
| `--bs-faq-list-question-font-size` | `0.8125rem` | Question font size |
| `--bs-faq-list-answer-font-size` | `0.78125rem` | Answer font size |
| `--bs-faq-list-padding-x` | `0.875rem` | Horizontal padding |
| `--bs-faq-list-padding-y` | `0.6875rem` | Vertical padding |
| `--bs-faq-list-chevron-size` | `1rem` | Chevron icon size |

```html
<!-- Basic FAQ list with title attribute -->
<tc-faq-list id="faq" title="Frequently Asked Questions"></tc-faq-list>
<script>
  document.getElementById('faq').items = [
    { question: 'What is this?', answer: 'A collapsible FAQ component.' },
    { question: 'Is it accessible?', answer: 'Yes — aria-expanded, aria-controls, role="region", and visible focus.' },
  ]
</script>

<!-- With JSON-LD schema for SEO -->
<tc-faq-list id="faq-schema" title="FAQ" schema></tc-faq-list>
<script>
  document.getElementById('faq-schema').items = [
    { question: 'Do I need a framework?', answer: 'No — use plain HTML.' },
  ]
</script>

<!-- Default-open items and tc-toggle event -->
<tc-faq-list id="faq-open" title="FAQ"></tc-faq-list>
<script>
  const el = document.getElementById('faq-open')
  el.items = [
    { question: 'First item', answer: 'Open by default.' },
    { question: 'Second item', answer: 'Closed by default.' },
  ]
  el.defaultOpen = [0]
  el.addEventListener('tc-toggle', e => console.log(e.detail.index, e.detail.open))
</script>

<!-- Slotted title -->
<tc-faq-list id="faq-slot">
  <span>Custom <strong>slotted</strong> title</span>
</tc-faq-list>
<script>
  document.getElementById('faq-slot').items = [
    { question: 'Question', answer: 'Answer.' },
  ]
</script>
```

---

### tc-feature-matrix

Comparison table of features vs columns, supporting boolean, partial, and custom string values with optional column highlight bands. Designed for plan or capability comparison.

**Tag:** `tc-feature-matrix`

**Attributes**

| Attribute | Type | Default | Description |
|-----------|------|---------|-------------|
| `title` | string | — | Text title rendered above the table. When absent, slotted children fill the title region instead |

**JS Properties**

| Property | Type | Description |
|----------|------|-------------|
| `columns` | `MatrixColumn[]` | Column definitions — set via JS property |
| `rows` | `MatrixRow[]` | Row definitions — set via JS property |

`MatrixColumn`:

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Unique identifier used as key in `row.values` |
| `label` | string | Column header label |
| `highlight` | boolean? | When `true`, applies a slate band across the column |

`MatrixRow`:

| Field | Type | Description |
|-------|------|-------------|
| `label` | string | Feature name shown in the first column |
| `hint` | string? | Optional muted sub-text beneath the label |
| `values` | `Record<columnId, MatrixValue>` | Map from column `id` to the cell value |

`MatrixValue` semantics:

| Value | Rendered as |
|-------|-------------|
| `true` (boolean) | Check icon in `--tc-success` with `aria-label="Supported"` |
| `false` (boolean) | X icon in `--tc-text-faint` with `aria-label="Not supported"` |
| `'partial'` (string literal) | Minus icon in `--tc-warning` with `aria-label="Partial"` |
| any other string | Plain text in monospace (`--tc-font-mono`) |

**Slots**

| Slot | Description |
|------|-------------|
| `title` | Title content rendered above the table when the `title` attribute is absent. Preserved across re-renders. |

**CSS Custom Properties**

| Property | Default | Description |
|----------|---------|-------------|
| `--bs-feature-matrix-border` | `1px solid var(--tc-border)` | Outer frame border |
| `--bs-feature-matrix-inner-border` | `1px solid var(--tc-slate-100)` | Internal row separators |
| `--bs-feature-matrix-bg` | `var(--tc-surface)` | Cell background |
| `--bs-feature-matrix-header-bg` | `var(--tc-surface-muted)` | Title header background |
| `--bs-feature-matrix-head-bg` | `var(--tc-surface-muted)` | Column header row background |
| `--bs-feature-matrix-highlight-bg` | `var(--tc-surface-muted)` | Highlighted column band fill |
| `--bs-feature-matrix-row-hover-bg` | `var(--tc-surface-hover)` | Row hover fill |
| `--bs-feature-matrix-yes-color` | `var(--tc-success)` | Check icon colour |
| `--bs-feature-matrix-no-color` | `var(--tc-text-faint)` | X icon colour |
| `--bs-feature-matrix-partial-color` | `var(--tc-warning)` | Partial icon colour |
| `--bs-feature-matrix-title-color` | `var(--tc-text)` | Title text colour |
| `--bs-feature-matrix-indicator-size` | `1rem` | Icon size |

```html
<!-- Basic usage -->
<tc-feature-matrix id="matrix" title="Plan Comparison"></tc-feature-matrix>
<script>
  const el = document.getElementById('matrix')
  el.columns = [
    { id: 'free', label: 'Free' },
    { id: 'pro', label: 'Pro', highlight: true },
    { id: 'enterprise', label: 'Enterprise', highlight: true },
  ]
  el.rows = [
    { label: 'Custom domains', hint: 'Bring your own', values: { free: false, pro: true, enterprise: true } },
    { label: 'Analytics', values: { free: 'partial', pro: true, enterprise: true } },
    { label: 'SLA uptime', values: { free: '99.5%', pro: '99.9%', enterprise: '99.99%' } },
  ]
</script>

<!-- Slotted title -->
<tc-feature-matrix id="matrix2">
  <span slot="title"><strong>Open Source</strong> vs Cloud</span>
</tc-feature-matrix>
<script>
  const el2 = document.getElementById('matrix2')
  el2.columns = [
    { id: 'oss', label: 'OSS' },
    { id: 'cloud', label: 'Cloud', highlight: true },
  ]
  el2.rows = [
    { label: 'Self-hosted', values: { oss: true, cloud: false } },
    { label: 'Managed updates', values: { oss: false, cloud: true } },
  ]
</script>

### tc-file-dropzone

Drag-and-drop upload zone with optional supported-format chips. Fires a `tc-files` custom event (and calls the `onFiles` callback) with the selected `File[]` array on both drop and native file-picker selection. Sharp dashed border, neutral ink; cyan `--tc-accent` border on drag-active.

**Tag:** `tc-file-dropzone`

**Attributes**

| Attribute | Type | Default | Description |
|-----------|------|---------|-------------|
| *(none)* | — | — | No reflected attributes. Use JS properties to configure. |

**JS Properties**

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `supported` | `DropzoneFileFormat[]` | `[]` | Accepted file formats displayed as mono chips. Each entry: `{ label: string; mime?: string; extension?: string }`. Also populates the hidden input's `accept` attribute. |
| `onFiles` | `((files: File[]) => void) \| null` | `null` | Optional callback fired alongside the `tc-files` event with the selected `File[]`. |

**Events**

| Event | Detail | Description |
|-------|--------|-------------|
| `tc-files` | `{ files: File[] }` | Dispatched when files are selected via drag-and-drop or the native file picker. |

**CSS Custom Properties**

| Property | Default | Description |
|----------|---------|-------------|
| `--bs-file-dropzone-border-color` | `var(--tc-border-strong)` | Drop-area border colour |
| `--bs-file-dropzone-border-style` | `dashed` | Drop-area border style |
| `--bs-file-dropzone-border-width` | `1px` | Drop-area border width |
| `--bs-file-dropzone-bg` | `var(--tc-surface)` | Drop-area background |
| `--bs-file-dropzone-padding-y` | `2.5rem` | Vertical padding of the drop area |
| `--bs-file-dropzone-padding-x` | `1.5rem` | Horizontal padding of the drop area |
| `--bs-file-dropzone-gap` | `0.75rem` | Gap between icon, prompt, and format chips |
| `--bs-file-dropzone-icon-size` | `1.5rem` | Upload icon size |
| `--bs-file-dropzone-icon-color` | `var(--tc-text-muted)` | Upload icon colour |
| `--bs-file-dropzone-prompt-color` | `var(--tc-text-muted)` | Prompt text colour |
| `--bs-file-dropzone-prompt-size` | `0.925rem` | Prompt text size |
| `--bs-file-dropzone-chip-color` | `var(--tc-text-faint)` | Format chip text colour |
| `--bs-file-dropzone-chip-size` | `0.75rem` | Format chip font size |
| `--bs-file-dropzone-chip-border-color` | `var(--tc-border)` | Format chip border colour |
| `--bs-file-dropzone-active-bg` | `var(--tc-surface-muted)` | Drop-area background when a drag is active |
| `--bs-file-dropzone-active-border-color` | `var(--tc-accent)` | Drop-area border colour when a drag is active |

```html
<!-- With supported formats (set via JS property) -->
<tc-file-dropzone id="dz"></tc-file-dropzone>
<script>
  const dz = document.getElementById('dz')
  dz.supported = [
    { label: 'PNG', mime: 'image/png', extension: '.png' },
    { label: 'JPG', mime: 'image/jpeg', extension: '.jpg' },
    { label: 'PDF', mime: 'application/pdf', extension: '.pdf' },
  ]
  dz.addEventListener('tc-files', e => {
    console.log('dropped files:', e.detail.files)
  })
</script>

<!-- No format restriction -->
<tc-file-dropzone id="dz2"></tc-file-dropzone>
<script>
  document.getElementById('dz2').onFiles = files => {
    console.log('selected files:', files)
  }
</script>
```
```

### tc-file-tags

Tag picker that renders selected tags as removable chips with a searchable dropdown to add more. Supports readonly mode (static chips, no add/remove controls). Sharp corners, slate neutral palette; optional per-tag color accent displayed as a 2px left border stripe.

**Tag:** `tc-file-tags`

**Attributes**

| Attribute | Type | Default | Description |
|-----------|------|---------|-------------|
| `readonly` | boolean | `false` | When present, hides all add/remove controls and renders tags as static chips. |

**JS Properties**

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `tags` | `FileTag[]` | `[]` | All available tags. Each entry: `{ id: string; label: string; color?: string }`. |
| `selectedIds` | `string[]` | `[]` | IDs of currently selected tags. |
| `onChange` | `((selectedIds: string[]) => void) \| null` | `null` | Optional callback fired alongside the `tc-change` event with the updated selected IDs. |

**Events**

| Event | Detail | Description |
|-------|--------|-------------|
| `tc-change` | `{ selectedIds: string[] }` | Dispatched whenever a tag is added or removed. |

**CSS Custom Properties**

| Property | Default | Description |
|----------|---------|-------------|
| `--bs-file-tags-gap` | `0.375rem` | Gap between chips and add button |
| `--bs-file-tags-chip-bg` | `var(--tc-surface-muted)` | Chip background |
| `--bs-file-tags-chip-border-color` | `var(--tc-border)` | Chip border colour |
| `--bs-file-tags-chip-text-color` | `var(--tc-text)` | Chip label text colour |
| `--bs-file-tags-chip-color` | `transparent` (per-chip) | Left-border accent colour. Set inline per chip via `style="--bs-file-tags-chip-color:…"` when `tag.color` is provided; defaults to `transparent` (no stripe). |
| `--bs-file-tags-chip-font-size` | `0.8125rem` | Chip font size |
| `--bs-file-tags-chip-accent-width` | `2px` | Width of the left-border color stripe |
| `--bs-file-tags-add-color` | `var(--tc-text-muted)` | Add-button text colour |
| `--bs-file-tags-add-border-color` | `var(--tc-border)` | Add-button border colour |
| `--bs-file-tags-menu-bg` | `var(--tc-surface)` | Dropdown menu background |
| `--bs-file-tags-menu-shadow` | `var(--tc-shadow-lg)` | Dropdown menu shadow |
| `--bs-file-tags-menu-min-width` | `180px` | Dropdown minimum width |
| `--bs-file-tags-menu-max-height` | `200px` | Options list max height before scroll |
| `--bs-file-tags-option-active-bg` | `var(--tc-app-accent)` | Active/keyboard-focused option background |
| `--bs-file-tags-option-active-color` | `#fff` | Active/keyboard-focused option text colour |

```html
<tc-file-tags id="ft"></tc-file-tags>
<script>
  const ft = document.getElementById('ft')
  ft.tags = [
    { id: 'bug', label: 'bug', color: '#ef4444' },
    { id: 'feature', label: 'feature', color: '#3b82f6' },
    { id: 'docs', label: 'docs' },
  ]
  ft.selectedIds = ['bug']
  ft.addEventListener('tc-change', e => {
    console.log('selected:', e.detail.selectedIds)
  })
</script>

<!-- Readonly variant -->
<tc-file-tags id="ft-ro" readonly></tc-file-tags>
<script>
  const ro = document.getElementById('ft-ro')
  ro.tags = [{ id: 'bug', label: 'bug', color: '#ef4444' }, { id: 'docs', label: 'docs' }]
  ro.selectedIds = ['bug', 'docs']
</script>
```

---

### tc-form-wizard

Multi-step form wizard with a tab-strip header, scrollable content body, and Back / Next / Complete footer. Steps are set via the JS `steps` property. Step content is supplied as a string, an `HTMLElement`, a factory function, or via light-DOM children with `slot="step-<index>"` / `data-step="<index>"` attributes. Navigating to already-visited steps is allowed by clicking their header tab. Pressing Complete on the last step dispatches `tc-complete`.

**Tag:** `tc-form-wizard`

**Attributes**

| Attribute | Type | Default | Description |
|-----------|------|---------|-------------|
| `complete-label` | string | `"Complete"` | Label text shown on the final-step action button. |
| `complete-icon` | string | — | Lucide icon name (kebab-case, e.g. `"rocket"`) shown on the Complete button. |
| `loading` | boolean | `false` | When present, disables both footer buttons and shows a spinner on the action button. |

**JS Properties**

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `steps` | `FormWizardStep[]` | `[]` | Array of step descriptors. Setting triggers a re-render. |
| `onComplete` | `(() => void) \| null` | `null` | Optional callback invoked alongside the `tc-complete` event. |
| `onStepChange` | `((detail: { index: number }) => void) \| null` | `null` | Optional callback invoked alongside `tc-step-change`. |

**`FormWizardStep` shape**

```ts
interface FormWizardStep {
    id?: string                                    // Optional identifier (unused by the element itself)
    label: string                                  // Tab label shown in the header
    icon?: string                                  // Lucide icon name (kebab-case) shown in the step marker
    content?: HTMLElement | string | (() => HTMLElement)  // Step body content (alternative to slotting)
}
```

**Events**

| Event | Detail | Description |
|-------|--------|-------------|
| `tc-complete` | `{}` | Fired (bubbles, composed) when the Complete button is pressed on the last step. |
| `tc-step-change` | `{ index: number }` | Fired (bubbles, composed) whenever the active step index changes. |

**Slots**

Step content can be supplied as light-DOM children instead of (or in addition to) the `content` JS property. A child element is distributed to step N when it carries `slot="step-N"` or `data-step="N"`.

| Slot | Description |
|------|-------------|
| `step-0`, `step-1`, … | Content for the corresponding step index. |
| `data-step="0"`, `data-step="1"`, … | Alternative `data-*` form for the same slots. |

When both `step.content` and a matching slot child are present, the JS property takes precedence.

**CSS Custom Properties**

| Property | Default | Description |
|----------|---------|-------------|
| `--bs-form-wizard-marker-size` | `2rem` | Diameter of the circular step marker. |
| `--bs-form-wizard-marker-font-size` | `0.8125rem` | Font size of the step number inside the marker. |
| `--bs-form-wizard-done-bg` | `var(--tc-app-accent)` | Marker fill for completed steps. |
| `--bs-form-wizard-done-color` | `#fff` | Icon colour inside completed-step markers. |
| `--bs-form-wizard-current-bg` | `var(--tc-app-accent)` | Marker fill for the current step. |
| `--bs-form-wizard-current-color` | `#fff` | Number/icon colour inside the current-step marker. |
| `--bs-form-wizard-current-underline` | `var(--tc-app-accent)` | Colour of the 2 px underline below the current tab. |
| `--bs-form-wizard-upcoming-border` | `var(--tc-border-strong)` | Ring colour for upcoming (unvisited) step markers. |
| `--bs-form-wizard-upcoming-color` | `var(--tc-text-faint)` | Number colour for upcoming steps. |
| `--bs-form-wizard-connector-color` | `var(--tc-border)` | Hairline connector colour between tabs. |
| `--bs-form-wizard-connector-done-color` | `var(--tc-app-accent)` | Connector colour after a completed step. |
| `--bs-form-wizard-label-font-size` | `0.8125rem` | Font size of step labels below the markers. |
| `--bs-form-wizard-body-padding` | `1.5rem` | Padding inside the content body. |
| `--bs-form-wizard-body-min-height` | `8rem` | Minimum height of the content body. |
| `--bs-form-wizard-footer-padding` | `0.875rem 1.5rem` | Padding inside the footer row. |

```html
<tc-form-wizard id="wiz"></tc-form-wizard>
<script>
  const wiz = document.getElementById('wiz')
  wiz.steps = [
    { label: 'Account',  icon: 'user',        content: '<p>Create your account.</p>' },
    { label: 'Profile',  icon: 'settings',    content: '<p>Set up your profile.</p>' },
    { label: 'Plan',     icon: 'credit-card', content: '<p>Choose a plan.</p>' },
    { label: 'Confirm',  icon: 'check',       content: '<p>Review and confirm.</p>' },
  ]
  wiz.addEventListener('tc-step-change', e => console.log('step', e.detail.index))
  wiz.addEventListener('tc-complete',    () => console.log('done!'))
</script>

<!-- Custom complete label and icon -->
<tc-form-wizard id="deploy" complete-label="Launch" complete-icon="rocket"></tc-form-wizard>
<script>
  document.getElementById('deploy').steps = [
    { label: 'Setup',  content: '<p>Configure initial settings.</p>' },
    { label: 'Deploy', content: '<p>Deploy to production.</p>' },
    { label: 'Done',   content: '<p>Your app is live!</p>' },
  ]
</script>

<!-- Slotted step content -->
<tc-form-wizard id="slotted">
  <div slot="step-0"><p>Details form here.</p></div>
  <div slot="step-1"><p>Address form here.</p></div>
  <div slot="step-2"><p>Review before confirming.</p></div>
</tc-form-wizard>
<script>
  document.getElementById('slotted').steps = [
    { label: 'Details' },
    { label: 'Address' },
    { label: 'Review' },
  ]
</script>
```

### tc-game-showcase-card

Game showcase card with an artwork region, title, pitch, tag chips, compliance status indicators, and optional corner stamps. Rich-node regions are distributed via named slots; array data (stamps, tags, compliance) is set as JS properties. When `onClick` is assigned, the card becomes keyboard-activatable with `role="button"` and dispatches `tc-click` on click, Enter, or Space.

**Tag:** `tc-game-showcase-card`

**Attributes**

| Attribute | Type | Default | Description |
|-----------|------|---------|-------------|
| `title` | string | — | Card title text. Fallback when no `slot="title"` child is present. |
| `pitch` | string | — | Card pitch/description text. Fallback when no `slot="pitch"` child is present. |

**JS Properties**

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `stamps` | `GameStamp[]` | `[]` | Corner stamps/badges rendered at the top of the card body. Setting triggers a re-render. |
| `tags` | `string[]` | `[]` | Tag chip labels rendered below the pitch. Setting triggers a re-render. |
| `compliance` | `ComplianceState[]` | `[]` | Compliance status indicators rendered in a footer row. Setting triggers a re-render. |
| `pitch` | `string \| null` | `null` | Reflected as the `pitch` attribute. Settable via JS without going through `setAttribute`. |
| `onClick` | `(() => void) \| null` | `null` | Optional callback invoked alongside `tc-click`. Setting activates the interactive card state (adds `role="button"`, `tabindex="0"`, keyboard activation). |

**`GameStamp` shape**

```ts
interface GameStamp {
    label: string      // Required stamp label text
    icon?: string      // Optional lucide icon name (kebab-case), e.g. "star"
    tone?: string      // Optional tone modifier class suffix: "success" | "warning" | "danger" | "info"
}
```

**`ComplianceState` shape**

```ts
interface ComplianceState {
    label: string                              // Indicator label (e.g. "PEGI 12")
    state: 'pass' | 'warn' | 'fail' | string  // Status drives icon + color; unknown values render the icon from the icon field
    icon?: string                              // Optional lucide icon name for unknown states (kebab-case)
}
```

**Events**

| Event | Detail | Description |
|-------|--------|-------------|
| `tc-click` | `{}` | Fired (bubbles, composed) when the card is clicked, or Enter/Space is pressed while focused. Fires regardless of whether `onClick` is set. |

**Slots**

| Slot | Description |
|------|-------------|
| `art` | Artwork content (image, canvas, div). When present, the `art-placeholder` slot is hidden. |
| `art-placeholder` | Placeholder shown in the art region when no `art` slot content is provided. |
| `meta-left` | Left region of the meta row (e.g. version label). |
| `meta-right` | Right region of the meta row (e.g. studio name). |
| `title` | Card title. When present, the `title` attribute is ignored. |
| `pitch` | Card pitch/description. When present, the `pitch` attribute is ignored. |

**CSS Custom Properties**

| Property | Default | Description |
|----------|---------|-------------|
| `--bs-game-showcase-card-bg` | `var(--tc-surface)` | Card background color. |
| `--bs-game-showcase-card-border` | `1px solid var(--tc-border)` | Card border. |
| `--bs-game-showcase-card-shadow` | `var(--tc-shadow-sm)` | Resting box-shadow. |
| `--bs-game-showcase-card-shadow-hover` | `var(--tc-shadow-hover)` | Hover box-shadow. |
| `--bs-game-showcase-card-art-height` | `10rem` | Height of the artwork region. |
| `--bs-game-showcase-card-art-bg` | `var(--tc-surface-muted)` | Placeholder background when no art is provided. |
| `--bs-game-showcase-card-title-color` | `var(--tc-text)` | Title text color. |
| `--bs-game-showcase-card-title-font-size` | `1rem` | Title font size. |
| `--bs-game-showcase-card-title-weight` | `600` | Title font weight. |
| `--bs-game-showcase-card-pitch-color` | `var(--tc-text-muted)` | Pitch text color. |
| `--bs-game-showcase-card-pitch-font-size` | `0.8125rem` | Pitch font size. |
| `--bs-game-showcase-card-tag-bg` | `var(--tc-surface-muted)` | Tag chip background. |
| `--bs-game-showcase-card-tag-color` | `var(--tc-text-muted)` | Tag chip text color. |
| `--bs-game-showcase-card-pass-color` | `var(--tc-success)` | Compliance `pass` indicator color. |
| `--bs-game-showcase-card-warn-color` | `var(--tc-warning)` | Compliance `warn` indicator color. |
| `--bs-game-showcase-card-fail-color` | `var(--tc-danger)` | Compliance `fail` indicator color. |
| `--bs-game-showcase-card-stamp-bg` | `var(--tc-ink)` | Default stamp background. |

```html
<!-- Basic: title + pitch attributes -->
<tc-game-showcase-card
  title="Dragon Realm"
  pitch="An epic fantasy RPG set in a world of ancient dragons."
></tc-game-showcase-card>

<!-- With JS properties -->
<tc-game-showcase-card id="card" title="Horizon Breach" pitch="Open-world co-op action."></tc-game-showcase-card>
<script>
  const card = document.getElementById('card')
  card.stamps = [{ label: 'New', tone: 'success' }, { label: 'Featured', icon: 'star' }]
  card.tags = ['Action', 'Co-op', 'Early Access']
  card.compliance = [
    { label: 'PEGI 18', state: 'fail' },
    { label: 'Accessibility', state: 'pass' },
  ]
</script>

<!-- With art slot and meta labels -->
<tc-game-showcase-card title="Neon Streets" pitch="Cyberpunk city builder.">
  <img slot="art" src="cover.jpg" alt="Neon Streets cover" style="width:100%;height:100%;object-fit:cover" />
  <span slot="meta-left">v2.1.0</span>
  <span slot="meta-right">Studio X</span>
</tc-game-showcase-card>

<!-- Clickable card (dispatches tc-click, keyboard-activatable) -->
<tc-game-showcase-card id="clickable" title="Mind Maze" pitch="Contemplative puzzle game."></tc-game-showcase-card>
<script>
  const el = document.getElementById('clickable')
  el.onClick = () => console.log('card activated')
  el.addEventListener('tc-click', e => console.log('tc-click', e.detail))
</script>
```

### tc-github-stars-card

GitHub repository card showing stars, forks, contributors, version, and a CTA link. Pre-fetched stats are supplied via the `stats` JS property; live stats are fetched from the GitHub REST API when the `fetch-live` attribute is present. Dispatches `tc-stats` once stats resolve and `tc-cta-click` when the CTA is activated.

**Tag:** `tc-github-stars-card`

**Attributes**

| Attribute | Type | Default | Description |
|-----------|------|---------|-------------|
| `owner` | string | — | GitHub repository owner (user or org). |
| `repo` | string | — | GitHub repository name. |
| `fetch-live` | boolean | false | When present, fetches live stats from `https://api.github.com/repos/<owner>/<repo>` on connect and re-fetches when `owner`/`repo` change. Shows a skeleton while pending. |
| `cta-label` | string | `"View on GitHub"` | Label text for the CTA link. |

**JS Properties**

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `stats` | `GithubStatsData` | `{}` | Pre-fetched stats object `{ stars?, forks?, contributors?, version? }`. Used as the initial/fallback value; live fetch values are merged on top when `fetch-live` is set. |
| `onStats` | `((stats: GithubStatsData) => void) \| null` | `null` | Optional callback fired when stats resolve (same timing as the `tc-stats` event). |

**Events**

| Event | Detail | Description |
|-------|--------|-------------|
| `tc-stats` | `{ stats: GithubStatsData }` | Fired (bubbles, composed) once live stats resolve from the GitHub API. Also calls `onStats` if set. |
| `tc-cta-click` | `{ owner: string, repo: string }` | Fired (bubbles, composed) when the CTA link is activated. |

**CSS Custom Properties**

| Property | Default | Description |
|----------|---------|-------------|
| `--bs-github-stars-card-bg` | `var(--tc-surface)` | Card background color. |
| `--bs-github-stars-card-border` | `1px solid var(--tc-border)` | Card border. |
| `--bs-github-stars-card-shadow` | `var(--tc-shadow-sm)` | Resting box-shadow. |
| `--bs-github-stars-card-gh-icon-size` | `1rem` | Size of the GitHub logo icon. |
| `--bs-github-stars-card-gh-icon-color` | `var(--tc-text-muted)` | Color of the GitHub logo icon. |
| `--bs-github-stars-card-slug-color` | `var(--tc-text)` | Color of the owner/repo slug link. |
| `--bs-github-stars-card-slug-font-size` | `0.875rem` | Font size of the owner/repo slug. |
| `--bs-github-stars-card-stat-icon-size` | `0.875rem` | Size of stat glyph icons. |
| `--bs-github-stars-card-stat-icon-color` | `var(--tc-text-muted)` | Color of stat glyph icons. |
| `--bs-github-stars-card-stat-value-color` | `var(--tc-text)` | Color of the numeric stat values. |
| `--bs-github-stars-card-stat-value-font-size` | `0.9375rem` | Font size of the numeric stat values. |
| `--bs-github-stars-card-stat-label-color` | `var(--tc-text-muted)` | Color of the stat labels (stars, forks, etc.). |
| `--bs-github-stars-card-cta-bg` | `linear-gradient(135deg, var(--tc-app-accent), #2b3a51)` | CTA button background gradient. |
| `--bs-github-stars-card-cta-color` | `#fff` | CTA button text color. |
| `--bs-github-stars-card-cta-font-size` | `0.875rem` | CTA button font size. |
| `--bs-github-stars-card-error-color` | `var(--tc-danger)` | Error message text color. |

```html
<!-- Static stats via JS property -->
<tc-github-stars-card id="card" owner="toolcase" repo="toolcase" cta-label="Star on GitHub"></tc-github-stars-card>
<script>
  const card = document.getElementById('card')
  card.stats = { stars: 4800, forks: 312, contributors: 47, version: 'v3.2.1' }
</script>

<!-- Live fetch from GitHub API -->
<tc-github-stars-card
  owner="microsoft"
  repo="vscode"
  fetch-live
  cta-label="View on GitHub"
></tc-github-stars-card>

<!-- Live fetch with pre-fetched fallback and event listeners -->
<tc-github-stars-card id="hybrid" owner="kalevski" repo="toolcase" fetch-live></tc-github-stars-card>
<script>
  const el = document.getElementById('hybrid')
  el.stats = { stars: 100 }  // shown immediately while fetch resolves
  el.onStats = stats => console.log('stats resolved', stats)
  el.addEventListener('tc-stats', e => console.log('tc-stats', e.detail))
  el.addEventListener('tc-cta-click', e => console.log('tc-cta-click', e.detail))
</script>
```

### tc-group

Collapsible group container with a header label, optional badge, and optional action button. The body region holds arbitrary slotted children and is toggled hidden/visible by clicking the header. Dispatches `tc-toggle` on expand/collapse and `tc-action-click` when the action button is activated. The action does not toggle the group.

**Tag:** `tc-group`

**Attributes**

| Attribute | Type | Default | Description |
|-----------|------|---------|-------------|
| `label` | string | `""` | Header label text. |
| `badge` | string | — | Optional badge shown in the header (count or short label). |
| `default-collapsed` | boolean | false | When present, the group starts in the collapsed state. Only seeds the initial state; does not re-collapse on attribute changes. |
| `action-label` | string | — | Accessible label for the action button; also rendered as visible text when present. |
| `action-icon` | string | — | Lucide icon name in PascalCase (e.g. `"Plus"`, `"Settings"`) rendered inside the action button. |

**JS Properties**

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `collapsed` | boolean | `false` | Gets or sets the current collapsed state. Setting it patches the DOM in place and dispatches `tc-toggle`. |
| `onActionClick` | `(() => void) \| null` | `null` | Optional callback fired when the action button is clicked (same timing as `tc-action-click`). |
| `onToggle` | `((collapsed: boolean) => void) \| null` | `null` | Optional callback fired when the group is toggled (same timing as `tc-toggle`). |

**Events**

| Event | Detail | Description |
|-------|--------|-------------|
| `tc-toggle` | `{ collapsed: boolean }` | Fired (bubbles, composed) when the group expands or collapses. Also calls `onToggle` if set. |
| `tc-action-click` | `{}` | Fired (bubbles, composed) when the action button is clicked. Does not toggle the group. Also calls `onActionClick` if set. |

**Slots**

| Slot | Description |
|------|-------------|
| (default) | Body content. Any children of `<tc-group>` are preserved across re-renders and placed inside the collapsible body region (`.tc-group-body`). |

**CSS Custom Properties**

| Property | Default | Description |
|----------|---------|-------------|
| `--bs-group-bg` | `var(--tc-surface)` | Outer container background. |
| `--bs-group-border-color` | `var(--tc-border)` | Border and hairline colors. |
| `--bs-group-header-bg` | `var(--tc-surface)` | Header background at rest. |
| `--bs-group-header-hover-bg` | `var(--tc-surface-muted)` | Header background on hover. |
| `--bs-group-header-color` | `var(--tc-text)` | Header text color. |
| `--bs-group-body-bg` | `var(--tc-surface)` | Body region background. |
| `--bs-group-badge-bg` | `var(--tc-surface-muted)` | Badge chip background. |
| `--bs-group-badge-color` | `var(--tc-text)` | Badge chip text color. |
| `--bs-group-action-color` | `var(--tc-text-muted)` | Action button icon color at rest. |
| `--bs-group-action-hover-bg` | `var(--tc-surface-muted)` | Action button background on hover. |

```html
<!-- Basic -->
<tc-group label="Settings">
  <p>Body content here.</p>
</tc-group>

<!-- With badge -->
<tc-group label="Active Users" badge="42">
  <p>42 users online.</p>
</tc-group>

<!-- Default collapsed -->
<tc-group label="Advanced Options" default-collapsed>
  <p>Hidden by default.</p>
</tc-group>

<!-- With action button -->
<tc-group id="docs" label="Documents" badge="7" action-label="Add" action-icon="Plus">
  <p>List of documents.</p>
</tc-group>
<script>
  const g = document.getElementById('docs')
  g.onActionClick = () => console.log('add document')
  g.onToggle = collapsed => console.log('toggled, collapsed:', collapsed)
  g.addEventListener('tc-action-click', e => console.log('tc-action-click', e.detail))
  g.addEventListener('tc-toggle', e => console.log('tc-toggle', e.detail))
</script>

<!-- Programmatic control -->
<tc-group id="prog" label="Collapsible">
  <p>Controlled from JS.</p>
</tc-group>
<script>
  const el = document.getElementById('prog')
  el.collapsed = true  // collapse immediately
</script>

---

### tc-hero

Large hero section with an optional eyebrow label, heading, description, primary and secondary action buttons, an optional background pattern or scattered lucide icons, stat cards, and inline metrics. All content is driven by attributes and JS properties — no slot children.

**Tag:** `tc-hero`

**Attributes**

| Attribute | Type | Default | Description |
|-----------|------|---------|-------------|
| `eyebrow` | string | — | Small uppercase mono label rendered above the title. |
| `title` | string | — | Main headline text (required for meaningful output). Rendered inside the heading element specified by `title-as`. |
| `title-as` | `h1`\|`h2`\|`h3`\|`h4`\|`h5`\|`h6` | `h1` | Tag name used to render the heading. Controls semantic heading level. |
| `description` | string | — | Body copy rendered beneath the title. |
| `background-pattern-src` | string | — | URL of a background image rendered absolutely behind the hero content. |

**JS Properties**

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `primaryAction` | `{ label: string; href?: string; onClick?: () => void } \| null` | `null` | Primary action. Rendered as an `<a>` when `href` is set, else a `<button>`. Ink-gradient primary style. |
| `secondaryAction` | `{ label: string; href?: string; onClick?: () => void } \| null` | `null` | Optional secondary action. Rendered as an outline button. |
| `statCards` | `Array<{ label: string; value: string }>` | `[]` | Row of stat cards displayed below the actions. Values rendered in mono. |
| `metrics` | `Array<{ label: string; value: string }>` | `[]` | Row of inline metric pairs displayed below stat cards. |
| `bgIcons` | `string[]` | `[]` | Array of lucide icon names (PascalCase or kebab-case) scattered faintly behind the content as `aria-hidden` SVGs. |
| `onPrimaryAction` | `(() => void) \| null` | `null` | Callback invoked when the primary action is activated (alongside the `tc-action` event). |
| `onSecondaryAction` | `(() => void) \| null` | `null` | Callback invoked when the secondary action is activated (alongside the `tc-action` event). |

**Events**

| Event | Detail | Description |
|-------|--------|-------------|
| `tc-action` | `{ which: 'primary' \| 'secondary' }` | Fired (bubbles, composed) when either action button is clicked. `detail.which` identifies which button was activated. |

**CSS Custom Properties**

All cosmetic values flow through `--bs-hero-*` vars on the `tc-hero` host:

| Variable | Default | Description |
|----------|---------|-------------|
| `--bs-hero-bg` | `var(--tc-surface)` | Section background. |
| `--bs-hero-border-color` | `var(--tc-border)` | Hairline bottom border colour. |
| `--bs-hero-padding-x` | `2rem` | Horizontal body padding. |
| `--bs-hero-padding-y` | `4rem` | Vertical body padding. |
| `--bs-hero-body-max-width` | `64rem` | Maximum width of the inner body container. |
| `--bs-hero-eyebrow-color` | `var(--tc-text-muted)` | Eyebrow text colour. |
| `--bs-hero-title-color` | `var(--tc-text)` | Heading colour. |
| `--bs-hero-title-font-size` | `clamp(2rem, 4vw, 3.5rem)` | Fluid heading size. |
| `--bs-hero-title-font-weight` | `600` | Heading weight (capped at semibold). |
| `--bs-hero-description-color` | `var(--tc-text-muted)` | Description text colour. |
| `--bs-hero-bg-icon-opacity` | `0.06` | Opacity of scattered background icons. |

**Example**

```html
<tc-hero
  eyebrow="Open Source"
  title="Build faster with toolcase"
  description="Framework-free web components for modern product teams."
  id="hero"
></tc-hero>
<script>
  const hero = document.getElementById('hero')

  hero.primaryAction = { label: 'Get Started', href: '/docs' }
  hero.secondaryAction = { label: 'View on GitHub', href: 'https://github.com' }

  hero.statCards = [
    { label: 'Total Users', value: '12K+' },
    { label: 'Packages', value: '340' },
    { label: 'Uptime', value: '99.9%' },
  ]

  hero.bgIcons = ['Zap', 'Shield', 'Code', 'Globe', 'Package']

  hero.addEventListener('tc-action', e => {
    console.log('action:', e.detail.which)
  })

  hero.onPrimaryAction = () => console.log('primary clicked')
</script>
```
```

---

### tc-image

Image wrapper with a loading shimmer skeleton, aspect-ratio control, configurable `object-fit`, and an error fallback. On successful load the skeleton fades out and the image fades in. On error the skeleton hides and the fallback region appears (custom slotted content or the default broken-image icon). Changing `src` resets to the loading state. Sharp corners, slate neutrals only — no border-radius, no status color.

**Tag:** `tc-image`

**Attributes**

| Attribute | Type | Default | Description |
|-----------|------|---------|-------------|
| `src` | string | — | URL of the image, forwarded to the inner `<img>`. Changing this attribute resets the component to the loading state. |
| `alt` | string | `''` | Alt text forwarded to the inner `<img>` for accessibility. |
| `aspect-ratio` | string | — | CSS `aspect-ratio` value (e.g. `16/9`, `4/3`, `1`) applied to the inner wrapper div. Determines the height when the width is constrained. When omitted the wrapper falls back to `--bs-image-min-height`. |
| `object-fit` | `'cover' \| 'contain' \| 'fill' \| 'none'` | `'cover'` | CSS `object-fit` value applied to the inner `<img>`. Controls how the image is scaled within the box. |

**JS Properties**

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `src` | `string \| null` | `null` | Reflects the `src` attribute. |
| `alt` | `string \| null` | `null` | Reflects the `alt` attribute. |
| `aspectRatio` | `string \| null` | `null` | Reflects the `aspect-ratio` attribute. |
| `objectFit` | `'cover' \| 'contain' \| 'fill' \| 'none'` | `'cover'` | Reflects the `object-fit` attribute. |
| `onLoad` | `(() => void) \| null` | `null` | Callback invoked when the image loads successfully, alongside the `tc-load` event. |
| `onError` | `(() => void) \| null` | `null` | Callback invoked when the image fails to load, alongside the `tc-error` event. |

**Events**

| Event | Detail | Description |
|-------|--------|-------------|
| `tc-load` | `{}` | Dispatched when the inner `<img>` fires its native `load` event. |
| `tc-error` | `{}` | Dispatched when the inner `<img>` fires its native `error` event (broken URL, network failure, etc.). |

**Slots**

| Slot | Description |
|------|-------------|
| *(default)* | Custom fallback content shown when the image fails to load. Replaces the default broken-image icon. Placed inside `.tc-image-fallback`. |

**CSS Custom Properties**

| Property | Default | Description |
|----------|---------|-------------|
| `--bs-image-bg` | `var(--tc-surface-muted)` | Background fill of the wrapper while loading or on error. |
| `--bs-image-shimmer-base` | `var(--tc-surface-muted)` | Base color of the loading shimmer. |
| `--bs-image-shimmer-shine` | `var(--tc-surface-hover)` | Leading highlight of the shimmer gradient. |
| `--bs-image-shimmer-shade` | `var(--tc-border)` | Trailing shadow of the shimmer gradient. |
| `--bs-image-shimmer-duration` | `1.5s` | Duration of one shimmer sweep cycle. |
| `--bs-image-fallback-color` | `var(--tc-text-faint)` | Color of the default broken-image icon. |
| `--bs-image-fallback-icon-size` | `2rem` | Size of the default broken-image icon. |
| `--bs-image-transition-duration` | `var(--tc-transition-base, 200ms)` | Duration of the opacity fade-in on successful load. |
| `--bs-image-min-height` | `80px` | Minimum wrapper height when no `aspect-ratio` is set. |

**Example**

```html
<!-- Successful image with aspect ratio -->
<tc-image
  src="https://example.com/photo.jpg"
  alt="A scenic mountain view"
  aspect-ratio="16/9"
  object-fit="cover"
></tc-image>

<!-- Broken src — custom slotted fallback -->
<tc-image src="https://example.invalid/missing.jpg" alt="Photo unavailable" aspect-ratio="16/9">
  <div style="text-align:center;padding:1rem;color:var(--tc-text-muted)">Photo unavailable</div>
</tc-image>

<script>
  const img = document.querySelector('tc-image')
  img.addEventListener('tc-load', () => console.log('loaded'))
  img.addEventListener('tc-error', () => console.log('error'))
  img.onLoad = () => console.log('loaded (callback)')
  img.onError = () => console.log('error (callback)')
</script>
```

---

### tc-infinite-scroll

Intersection Observer wrapper that dispatches `tc-load-more` when its sentinel element enters the viewport. Compose your scrolled content as light-DOM children; use `data-slot="loading"` and `data-slot="end"` to provide custom slot content for the loading and end states. When `has-more` is absent, the sentinel stops observing and the end region appears. While `loading` is present, further `tc-load-more` dispatches are suppressed and the loading region is shown. Sharp corners; slate neutrals only.

**Tag:** `tc-infinite-scroll`

**Attributes**

| Attribute | Type | Default | Description |
|-----------|------|---------|-------------|
| `has-more` | boolean | absent | When present, the sentinel is observed and `tc-load-more` can fire. When absent, observing stops and the end region is revealed. |
| `loading` | boolean | absent | When present, `tc-load-more` dispatches are suppressed and the loading region is shown. Remove when the fetch completes to resume. |
| `threshold` | number | `0` | IntersectionObserver `threshold` — fraction of the sentinel that must be visible to trigger (0–1). |
| `root-margin` | string | `'0px'` | IntersectionObserver `rootMargin` — margin around the root for intersection calculation (e.g. `'200px'` for early loading). |

**JS Properties**

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `hasMore` | `boolean` | `false` | Reflects the `has-more` boolean attribute. |
| `loading` | `boolean` | `false` | Reflects the `loading` boolean attribute. |
| `threshold` | `number` | `0` | Reflects the `threshold` attribute. |
| `rootMargin` | `string` | `'0px'` | Reflects the `root-margin` attribute. |
| `onLoadMore` | `(() => void) \| null` | `null` | Optional callback fired alongside the `tc-load-more` event. |

**Events**

| Event | Detail | Description |
|-------|--------|-------------|
| `tc-load-more` | `{}` | Dispatched once when the sentinel enters the viewport and both `has-more` is set and `loading` is not. Resets after `loading` is removed. |

**Slots (light DOM via `data-slot`)**

| Slot | Selector | Description |
|------|----------|-------------|
| loading | `[data-slot="loading"]` | Custom content shown while the `loading` attribute is present. Falls back to a small slate spinner and a visually-hidden "Loading…" label. |
| end | `[data-slot="end"]` | Custom content shown when `has-more` is absent (all pages loaded). Falls back to an uppercase mono "End" micro-label. |
| *(default)* | any child without `data-slot` | Scrolled list items placed in the content container before the sentinel. |

**CSS Custom Properties**

| Property | Default | Description |
|----------|---------|-------------|
| `--bs-infinite-scroll-row-gap` | `0.5rem` | Gap between items inside the loading/end rows. |
| `--bs-infinite-scroll-row-padding` | `0.75rem 0` | Padding of the loading and end rows. |
| `--bs-infinite-scroll-loading-color` | `var(--tc-text-muted)` | Color of the loading row content. |
| `--bs-infinite-scroll-end-color` | `var(--tc-text-faint)` | Color of the end row content. |
| `--bs-infinite-scroll-end-font-size` | `0.6875rem` | Font size of the default "End" micro-label. |
| `--bs-infinite-scroll-spinner-size` | `1rem` | Width/height of the default loading spinner. |
| `--bs-infinite-scroll-spinner-border-width` | `2px` | Border width of the default loading spinner ring. |

**Example**

```html
<div style="max-height: 400px; overflow-y: auto;">
  <tc-infinite-scroll id="feed" has-more="">
    <div class="item">Item 1</div>
    <div class="item">Item 2</div>
    <!-- more items appended here -->
    <div data-slot="loading">Fetching…</div>
    <div data-slot="end">All caught up!</div>
  </tc-infinite-scroll>
</div>

<script>
  const feed = document.getElementById('feed')
  let page = 0

  feed.addEventListener('tc-load-more', async () => {
    feed.setAttribute('loading', '')
    const newItems = await fetchPage(++page)
    newItems.forEach(text => {
      const div = document.createElement('div')
      div.className = 'item'
      div.textContent = text
      // insert before the sentinel (first child of the content container)
      feed.querySelector('.tc-infinite-scroll-content').appendChild(div)
    })
    if (page >= 4) feed.removeAttribute('has-more')
    feed.removeAttribute('loading')
  })

  // Or use the callback property:
  feed.onLoadMore = () => console.log('load more triggered')
</script>
```

---

### tc-install-tabs

Tabbed install command block for npm, yarn, pnpm, and bun. Shows the correct install command per manager, with a copy button that briefly confirms with a check icon. Keyboard navigable via roving tabindex (ArrowLeft/Right, Home/End, Enter/Space). No shadow DOM — composable with light-DOM.

**Tag:** `tc-install-tabs`

**Attributes**

| Attribute | Type | Default | Description |
|-----------|------|---------|-------------|
| `package` | string | `''` | Package name to install (required). |
| `dev` | boolean | absent | Adds the dev-dependency flag to every command (`-D` / `--save-dev`). |
| `global` | boolean | absent | Adds the global-install flag to every command (`-g` / `global add`). |
| `default-manager` | string | first manager | Which manager tab is active on first render (`npm`, `yarn`, `pnpm`, or `bun`). |

**JS Properties**

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `managers` | `InstallManager[]` | `['npm','yarn','pnpm','bun']` | Limits and orders the visible manager tabs. Set via JS; not reflected as an attribute. |
| `onCopy` | function | `null` | Optional callback fired after a successful clipboard write — receives `{ manager, command }`. |
| `onChange` | function | `null` | Optional callback fired when the active tab changes — receives `{ manager }`. |

**Events**

| Event | Detail | Description |
|-------|--------|-------------|
| `tc-copy` | `{ manager: InstallManager, command: string }` | Fired after the copy button successfully writes to the clipboard. |
| `tc-change` | `{ manager: InstallManager }` | Fired when the active manager tab changes. |

**CSS Custom Properties**

| Property | Default | Description |
|----------|---------|-------------|
| `--bs-install-tabs-tab-row-border` | `1px solid var(--tc-border)` | Bottom hairline under the tab row. |
| `--bs-install-tabs-tab-color` | `var(--tc-text-muted)` | Inactive tab text color. |
| `--bs-install-tabs-tab-color-active` | `var(--tc-text)` | Active tab text color. |
| `--bs-install-tabs-tab-active-underline` | `2px solid var(--tc-app-accent)` | 2px ink underline on the active tab. |
| `--bs-install-tabs-panel-bg` | `var(--tc-ink)` | Code panel background. |
| `--bs-install-tabs-code-color` | `var(--tc-text-inverse)` | Command text color. |
| `--bs-install-tabs-code-font-size` | `0.875rem` | Command font size. |
| `--bs-install-tabs-copy-color` | `var(--tc-text-muted)` | Copy button icon color. |
| `--bs-install-tabs-copy-hover-bg` | `rgba(255,255,255,0.08)` | Copy button hover fill. |
| `--bs-install-tabs-copy-copied-color` | `#99cc88` | Copy button color during confirmed state. |

```html
<!-- Basic install -->
<tc-install-tabs package="@toolcase/web-components"></tc-install-tabs>

<!-- Dev dependency -->
<tc-install-tabs package="vitest" dev></tc-install-tabs>

<!-- Global install -->
<tc-install-tabs package="typescript" global></tc-install-tabs>
```

```html
<!-- Limit managers via JS property -->
<tc-install-tabs id="limited" package="@toolcase/base" default-manager="pnpm"></tc-install-tabs>
<script>
  document.getElementById('limited').managers = ['npm', 'pnpm']

  document.getElementById('limited').addEventListener('tc-copy', e => {
    console.log('Copied:', e.detail.command)
  })
  document.getElementById('limited').addEventListener('tc-change', e => {
    console.log('Active manager:', e.detail.manager)
  })
</script>

---

### tc-live-feed

Vertical feed of timestamped events with optional header bar, REC indicator, and auto-scroll. Events are set via the `events` JS property (array of `FeedEvent`). Newest events appear at the bottom. The body has `role="log"` and `aria-live="polite"`. Clicking (or pressing Enter/Space on) a row dispatches `tc-row-click`. Auto-scroll pins to the newest row but respects manual scrolling — if the user has scrolled up, new rows do not yank them down. Sharp corners; slate neutrals; JetBrains Mono timestamps.

**Tag:** `tc-live-feed`

**Attributes**

| Attribute | Type | Default | Description |
|-----------|------|---------|-------------|
| `header` | string | absent | Optional feed title shown in the header bar. |
| `recording` | boolean | absent | When present, shows a pulsing `--tc-danger` REC dot with a "REC" label in the header. |
| `max-rows` | number | `0` (unlimited) | Caps the number of displayed rows. Only the newest `max-rows` events are rendered; older entries are trimmed. |
| `auto-scroll` | boolean | absent | When present, scrolls the feed body to the newest row after each update — only when the user is already near the bottom. |

**JS Properties**

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `events` | `FeedEvent[]` | `[]` | Array of feed events. Setting this property re-renders the feed. Appending pattern: `el.events = [...el.events, newEvent]`. |
| `onrowclick` | `function or null` | `null` | Optional callback fired alongside `tc-row-click` when a row is activated. Receives `{ id?: string; event: FeedEvent }`. |

**FeedEvent shape**

```ts
interface FeedEvent {
  id?: string
  time?: string
  label: string
  level?: 'info' | 'success' | 'warning' | 'danger'
  icon?: string
}
```

**Events**

| Event | Detail | Description |
|-------|--------|-------------|
| `tc-row-click` | `{ id?: string; event: FeedEvent }` | Dispatched (bubbles) when a row is clicked or activated via Enter/Space. |

**Slots**

None. `tc-live-feed` is purely data-driven via the `events` JS property.

**CSS Custom Properties**

| Property | Default | Description |
|----------|---------|-------------|
| `--bs-live-feed-bg` | `var(--tc-surface)` | Feed background colour. |
| `--bs-live-feed-border` | `1px solid var(--tc-border)` | Outer border of the feed. |
| `--bs-live-feed-header-bg` | `var(--tc-surface-muted)` | Header bar background. |
| `--bs-live-feed-header-border` | `1px solid var(--tc-border)` | Border below the header bar. |
| `--bs-live-feed-header-color` | `var(--tc-text-muted)` | Header title text colour. |
| `--bs-live-feed-header-font-size` | `0.6875rem` | Header title font size. |
| `--bs-live-feed-body-max-height` | `400px` | Max height of the scrollable body. |
| `--bs-live-feed-row-border` | `1px solid var(--tc-slate-100)` | Hairline between rows. |
| `--bs-live-feed-row-hover-bg` | `var(--tc-surface-hover)` | Row hover background. |
| `--bs-live-feed-time-color` | `var(--tc-text-muted)` | Timestamp text colour. |
| `--bs-live-feed-time-font-size` | `11.5px` | Timestamp font size. |
| `--bs-live-feed-label-font-size` | `0.8125rem` | Row label font size. |
| `--bs-live-feed-icon-size` | `1rem` | Icon width and height. |
| `--bs-live-feed-rec-dot-color` | `var(--tc-danger)` | REC indicator dot and label colour. |
| `--bs-live-feed-rec-animation-speed` | `0.9s` | REC dot pulse cycle duration. |

**Example**

```html
<tc-live-feed id="feed" header="// SYSTEM LOG" recording auto-scroll></tc-live-feed>

<script>
  const feed = document.getElementById('feed')

  feed.events = [
    { id: 'e1', time: '10:00:01', label: 'Service started', level: 'success' },
    { id: 'e2', time: '10:00:04', label: 'Connected to database', level: 'info' },
    { id: 'e3', time: '10:00:12', label: 'Disk usage above 80%', level: 'warning' },
  ]

  setInterval(function() {
    feed.events = feed.events.concat([{
      id: 'live-' + Date.now(),
      time: new Date().toTimeString().slice(0, 8),
      label: 'Heartbeat OK',
      level: 'success',
    }])
  }, 1000)

  feed.addEventListener('tc-row-click', function(e) {
    console.log('Row clicked:', e.detail.id, e.detail.event.label)
  })
</script>
```

```html
<!-- Cap to 10 most-recent rows -->
<tc-live-feed id="capped" header="// AUDIT" max-rows="10" auto-scroll></tc-live-feed>

<script>
  var el = document.getElementById('capped')
  el.events = [
    { id: '0', time: '00:00:00', label: 'Event 0', level: 'info' },
    { id: '1', time: '00:00:01', label: 'Event 1', level: 'warning' },
    { id: '2', time: '00:00:02', label: 'Event 2', level: 'danger' },
  ]
  // Only the last 10 events render; oldest trimmed automatically
</script>
```
```

---

### tc-login

**Tag:** `tc-login`

Two-column login layout: a decorative ink aside (left, carries the background pattern) and a white form column (right, carries a logo slot, title, description, and a vertical stack of OAuth connect buttons). Collapses to single-column (form only) on narrow screens.

**Attributes**

| Attribute | Type | Default | Description |
|-----------|------|---------|-------------|
| `title` | string | `'Sign in'` | Heading text rendered as an `<h2>` in the form column. |
| `description` | string | absent | Sub-heading paragraph rendered below the title. |
| `background-pattern-src` | string | absent | URL of an image used as the aside's background. Rendered as a full-bleed `<img>` with `mix-blend-mode: luminosity`. |
| `loading` | boolean | absent | When present, replaces the form content with animated skeleton placeholders and sets `aria-busy="true"` on the host. |

**JS Properties**

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `connect` | `LoginConnectOption[]` | `[]` | Array of OAuth provider options. Each item renders one button in the form column. |
| `onconnect` | `function or null` | `null` | Optional callback fired alongside `tc-connect` when an OAuth button is clicked. Receives the provider `key` string. |

**LoginConnectOption shape**

```ts
interface LoginConnectOption {
  key: string                                                              // unique provider key — returned in tc-connect event detail
  label: string                                                            // button label text
  icon?: string                                                            // lucide icon name (kebab-case), rendered aria-hidden before the label
  variant?: 'primary' | 'secondary' | 'info' | 'success' | 'warning' | 'danger'  // button outline variant; defaults to 'primary'
}
```

**Events**

| Event | Detail | Description |
|-------|--------|-------------|
| `tc-connect` | `{ key: string }` | Dispatched (bubbles) when an OAuth button is clicked. `key` matches the clicked `LoginConnectOption.key`. |

**Slots**

| Slot | Description |
|------|-------------|
| `logo` | Brand logo or wordmark placed above the form title. Hidden when empty. |
| `pattern` | Rich decorative content placed inside the aside overlay (stacked above the `background-pattern-src` image when both are provided). |

**CSS Custom Properties**

| Property | Default | Description |
|----------|---------|-------------|
| `--bs-login-aside-width` | `42%` | Width of the decorative aside column. |
| `--bs-login-min-height` | `100vh` | Minimum height of the login component. |
| `--bs-login-column-divider` | `1px solid var(--tc-border)` | Hairline between the aside and form columns. |
| `--bs-login-aside-bg` | `var(--tc-ink)` | Aside background colour. |
| `--bs-login-form-bg` | `var(--tc-surface)` | Form column background colour. |
| `--bs-login-form-padding-x` | `3rem` | Form column horizontal padding. |
| `--bs-login-form-padding-y` | `3rem` | Form column vertical padding. |
| `--bs-login-form-max-width` | `28rem` | Max-width of the inner form content. |
| `--bs-login-title-font-size` | `1.5rem` | Title heading font size. |
| `--bs-login-title-font-weight` | `600` | Title heading font weight (≤ 600 per design rules). |
| `--bs-login-title-color` | `var(--tc-text)` | Title text colour. |
| `--bs-login-desc-color` | `var(--tc-text-muted)` | Description text colour. |
| `--bs-login-connect-gap` | `0.625rem` | Gap between connect buttons. |
| `--bs-login-connect-btn-height` | `2.75rem` | Height of each connect button. |
| `--bs-login-connect-margin-top` | `1.75rem` | Space above the connect button group. |

**Example**

```html
<tc-login id="login"
  title="Sign in"
  description="Choose a provider to continue."
  background-pattern-src="/img/pattern.svg">
  <img slot="logo" src="/img/logo.svg" alt="My App" />
</tc-login>

<script>
  const login = document.getElementById('login')

  login.connect = [
    { key: 'github',  label: 'Continue with GitHub',  icon: 'github',  variant: 'primary'   },
    { key: 'google',  label: 'Continue with Google',  icon: 'mail',    variant: 'secondary' },
    { key: 'sso',     label: 'Continue with SSO',     icon: 'shield',  variant: 'secondary' },
  ]

  login.addEventListener('tc-connect', function(e) {
    console.log('provider selected:', e.detail.key)
  })
</script>
```

```html
<!-- Loading state -->
<tc-login title="Sign in" loading></tc-login>

<script>
  // Once providers are fetched, populate and clear loading:
  const el = document.querySelector('tc-login')
  el.connect = [{ key: 'github', label: 'Continue with GitHub', variant: 'primary' }]
  el.removeAttribute('loading')
</script>
```

---

### tc-marquee

**Tag:** `tc-marquee`

Horizontally scrolling content banner. Items loop seamlessly at a configurable speed and direction. Scrolling is automatically disabled under `prefers-reduced-motion` (the element becomes a static, scrollable row instead).

**Attributes**

| Attribute | Type | Default | Description |
|-----------|------|---------|-------------|
| `separator` | string | `''` (none) | Text string rendered between items (e.g. `•`, `|`). Also appears at the junction between the two copies for seamless looping. |
| `speed` | number | `60` | Scroll speed in pixels per second. The animation duration is computed from this value and the measured content width. |
| `direction` | `'left' \| 'right'` | `'left'` | Scroll direction. `'left'` moves content toward the left; `'right'` reverses it. |
| `pause-on-hover` | boolean | absent | When present, pauses the scroll animation while the pointer hovers over the element. |
| `aria-label` | string | `'Scrolling content'` | Accessible label for the inner `role="region"` container. |

**JS Properties**

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `items` | `string[]` | `[]` | Array of strings or HTML fragments rendered as marquee items. Takes precedence over slotted children when non-empty. |
| `separator` | string | `''` | Reflected from the `separator` attribute. |
| `speed` | number | `60` | Reflected from the `speed` attribute. |
| `direction` | `'left' \| 'right'` | `'left'` | Reflected from the `direction` attribute. |
| `pauseOnHover` | boolean | `false` | Reflected from the `pause-on-hover` attribute. |

**Slots**

| Slot | Description |
|------|-------------|
| *(default)* | Each direct child element is treated as one marquee item. Used when the `items` JS property is not set. Items are preserved across re-renders as real DOM nodes. |

**Events**

None. `tc-marquee` is purely presentational.

**CSS Custom Properties**

| Property | Default | Description |
|----------|---------|-------------|
| `--bs-marquee-duration` | Computed by JS | Animation duration derived from `speed` and content width. Overriding this manually is not recommended; set `speed` instead. |
| `--bs-marquee-direction-value` | `normal` | CSS `animation-direction` value — `normal` for left, `reverse` for right. Set by JS; do not override manually. |
| `--bs-marquee-item-color` | `var(--tc-text)` | Text colour of marquee items. |
| `--bs-marquee-sep-color` | `var(--tc-text-muted)` | Colour of the separator string. |
| `--bs-marquee-sep-gap` | `0.625rem` | Inline padding on each side of the separator. |
| `--bs-marquee-padding-y` | `0.5rem` | Block padding applied to each copy container. |

**Example**

```html
<!-- Slotted children -->
<tc-marquee separator="•" aria-label="Product highlights">
  <span>Zero dependencies</span>
  <span>Framework-free</span>
  <span>Fully themeable</span>
</tc-marquee>

<!-- items JS property -->
<tc-marquee id="m" separator="—" speed="40" direction="left" pause-on-hover></tc-marquee>

<script>
  document.getElementById('m').items = [
    '🚀 v3.0 released',
    '⭐ 12k GitHub stars',
    '📦 40+ countries',
  ]
</script>
```

---

### tc-multi-card-select

Multi-select card grid (checkgroup pattern). Options are set via the `options` JS property; selected values via the `value` JS property. Fires `tc-change` when the selection changes. Fully keyboard-accessible: Arrow keys move focus between cards, Space/Enter toggles the focused card, disabled cards are skipped. When `name` is set, hidden form inputs are rendered for each selected value so the control submits inside a native form.

**Tag:** `tc-multi-card-select`

**Attributes**

| Attribute | Type | Default | Description |
|-----------|------|---------|-------------|
| `name` | string | — | When set, renders `<input type="hidden" name="{name}" value="{optionValue}">` for each selected option, enabling native form submission |
| `columns` | number | `2` | Number of grid columns |
| `loading` | boolean | false | Show animated skeleton placeholders instead of options |
| `loading-count` | number | `4` | Number of skeleton cards shown while `loading` is set |
| `aria-label` | string | `"Select options"` | Accessible label for the group (defaults to "Select options" if not provided) |

**JS Properties**

| Property | Type | Description |
|----------|------|-------------|
| `options` | `MultiCardSelectOption[]` | Array of option objects (set via JS, not attribute); setting re-renders the grid |
| `value` | `string[]` | Currently selected option values; setting updates which cards appear selected |
| `onChange` | `((value: string[]) => void) \| null` | Optional callback fired alongside `tc-change` with the new selected array |

Each `MultiCardSelectOption`:

| Field | Type | Description |
|-------|------|-------------|
| `value` | string | Unique value for this option; included in the `tc-change` detail and form submission |
| `label` | string | Visible card title |
| `description` | string? | Optional sub-label rendered below the title |
| `icon` | string? | Lucide icon name, PascalCase or kebab-case (e.g. `"Shield"`, `"shield-check"`) |
| `disabled` | boolean? | When true, the card is non-interactive and aria-disabled |

**Events:** `tc-change` with `{ detail: { value: string[] } }` — the full new selection array

**Slots:** none — the option grid is generated from the `options` property.

```html
<tc-multi-card-select id="features" columns="3" name="features" aria-label="Select features"></tc-multi-card-select>
<script>
const el = document.getElementById('features')
el.options = [
    { value: 'auth',     label: 'Authentication', icon: 'Shield',    description: 'OAuth2 + sessions' },
    { value: 'db',       label: 'Database',        icon: 'Database',  description: 'Postgres or SQLite' },
    { value: 'storage',  label: 'Storage',         icon: 'HardDrive', description: 'File uploads' },
    { value: 'email',    label: 'Email',            icon: 'Mail',      description: 'Transactional mail' },
    { value: 'legacy',   label: 'Legacy API',       icon: 'Plug',      disabled: true },
]
el.value = ['auth', 'db']
el.addEventListener('tc-change', e => console.log('selected:', e.detail.value))
</script>
```

### tc-newsletter-signup

Email subscription form with async status management. Drives its own state (`idle → submitting → success` or `error`) from the optional `onSubmit` Promise. Fires `tc-submit` on valid submission. Optionally renders a privacy-policy link below the input.

**Tag:** `tc-newsletter-signup`

**Attributes**

| Attribute | Type | Default | Description |
|-----------|------|---------|-------------|
| `title` | string | — | Optional heading rendered above the form. |
| `description` | string | — | Optional sub-text rendered below the heading (uses `--tc-text-muted`). |
| `placeholder` | string | `'you@example.com'` | Email input placeholder text. |
| `cta-label` | string | `'Subscribe'` | Submit button label. |
| `success-message` | string | `'Thanks for subscribing!'` | Message shown in the success state after the `onSubmit` Promise resolves. |
| `privacy-href` | string | — | When set, renders a small privacy-policy link below the input field. |

**JS Properties**

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `onSubmit` | `((email: string) => Promise<void> \| void) \| null` | `null` | Optional callback fired alongside `tc-submit`. If it returns a `Promise`, the component transitions to `success` on resolve or `error` on reject (with the rejection message shown inline). If it returns `void` or is not set, the component transitions to `success` immediately. |

**Events**

| Event | `detail` | Description |
|-------|----------|-------------|
| `tc-submit` | `{ email: string }` | Dispatched (bubbles, composed) when a valid email is submitted. Fired before the `onSubmit` Promise is awaited. |

**Slots**

None. Driven entirely by attributes and the `onSubmit` JS property.

**Accessibility**

- Email `<input>` is associated with a visually-hidden `<label>` via `for`/`id`.
- Validation errors set `aria-invalid="true"` and `aria-describedby` on the input; the error paragraph uses `aria-live="assertive"`.
- The submit button is a native `<button type="submit">` — keyboard submittable.
- The spinner inside the button carries `role="status"` and `aria-label="Submitting…"`.
- The success region uses `aria-live="polite"` + `aria-atomic="true"`; focus moves into it on transition.
- Disabled-while-submitting is applied via the `disabled` HTML attribute + `pointer-events: none`.
- `prefers-reduced-motion` is honoured — spinner slows (does not vanish), transitions are frozen.
- 44 px minimum touch targets on coarse-pointer devices.

**CSS Custom Properties**

| Property | Default | Description |
|----------|---------|-------------|
| `--bs-newsletter-signup-bg` | `var(--tc-surface)` | Panel background. |
| `--bs-newsletter-signup-border` | `1px solid var(--tc-border)` | Outer hairline border. |
| `--bs-newsletter-signup-color` | `var(--tc-text)` | Primary text color. |
| `--bs-newsletter-signup-muted-color` | `var(--tc-text-muted)` | Description / secondary text color. |
| `--bs-newsletter-signup-input-border` | `var(--tc-border-strong)` | Email input border color. |
| `--bs-newsletter-signup-input-focus-ring` | `var(--tc-focus-ring)` | Focus ring box-shadow on the input. |
| `--bs-newsletter-signup-submit-bg` | `linear-gradient(135deg, var(--tc-app-accent), #2b3a51)` | Submit button background gradient. |
| `--bs-newsletter-signup-error-color` | `var(--tc-danger)` | Validation / error text color. |
| `--bs-newsletter-signup-success-color` | `var(--tc-success)` | Success state icon and text color. |
| `--bs-newsletter-signup-success-bg` | `rgba(22, 163, 74, 0.07)` | Success state background tint. |
| `--bs-newsletter-signup-success-border` | `var(--tc-success)` | Success state left accent border color. |
| `--bs-newsletter-signup-padding` | `1.5rem` | Panel padding. |

```html
<tc-newsletter-signup
  id="newsletter"
  title="Stay in the loop"
  description="Get product updates and release notes — no spam."
  placeholder="you@example.com"
  cta-label="Subscribe"
  success-message="You're subscribed!"
  privacy-href="/privacy"
></tc-newsletter-signup>
<script>
  const el = document.getElementById('newsletter')
  // onSubmit may return a Promise; the component drives idle → submitting → success/error
  el.onSubmit = email => fetch('/api/subscribe', {
    method: 'POST',
    body: JSON.stringify({ email }),
    headers: { 'Content-Type': 'application/json' },
  }).then(r => { if (!r.ok) throw new Error('Subscription failed. Try again.') })
  el.addEventListener('tc-submit', e => console.log('submitted:', e.detail.email))
</script>
```

---

### tc-number-input

Controlled numeric input with increment/decrement steppers, arrow-key support, min/max clamping, precision formatting, and optional prefix/suffix addons.

**Tag:** `tc-number-input`

**Attributes**

| Attribute | Type | Default | Description |
|-----------|------|---------|-------------|
| `value` | string (`number \| ''`) | `''` | Current numeric value; empty string means no value |
| `step` | number | `1` | Increment/decrement amount (also used by ArrowUp/Down) |
| `min` | number | — | Clamp floor; disables the decrement button at this boundary |
| `max` | number | — | Clamp ceiling; disables the increment button at this boundary |
| `precision` | number | — | Decimal places to round/format the committed value |
| `label` | string | — | Visible label rendered above the field; linked via `for`/`id` |
| `error` | string | — | Error message displayed below the field; also sets error border and `aria-invalid` |
| `prefix` | string | — | Text addon rendered before the input (e.g. `$`, `https://`) |
| `suffix` | string | — | Text addon rendered after the input (e.g. `USD`, `kg`) |

**JS Properties**

| Property | Type | Description |
|----------|------|-------------|
| `value` | `number \| ''` | Get/set the current value programmatically |
| `step` | `number` | Get/set the step increment |
| `min` | `number \| null` | Get/set the minimum |
| `max` | `number \| null` | Get/set the maximum |
| `precision` | `number \| null` | Get/set decimal precision |
| `label` | `string \| null` | Get/set the label text |
| `error` | `string \| null` | Get/set the error message |
| `prefix` | `string \| null` | Get/set the prefix addon text |
| `suffix` | `string \| null` | Get/set the suffix addon text |
| `onChange` | `((value: number \| '') => void) \| null` | Optional callback fired on every committed change (same as the `tc-change` event) |

**Events**

| Event | Detail | Description |
|-------|--------|-------------|
| `tc-change` | `{ value: number \| '' }` | Fired on blur, Enter, stepper click, or arrow-key step with the committed value |

**Slots:** none

**Accessibility**

- The `<input>` carries `role="spinbutton"` with `aria-valuemin`, `aria-valuemax`, and `aria-valuenow`.
- Label is associated via `for`/`id`.
- Stepper buttons carry `aria-label="Increase"` / `aria-label="Decrease"`.
- Error links to the input via `aria-describedby` and sets `aria-invalid="true"`.
- Disabled steppers carry `aria-disabled="true"` and `pointer-events: none`.
- `prefers-reduced-motion` is honoured.

```html
<!-- Basic min/max/step -->
<tc-number-input label="Quantity" min="0" max="100" step="1" value="5"></tc-number-input>

<!-- Prefix / Suffix -->
<tc-number-input label="Budget" prefix="$" suffix="USD" min="0" step="10" precision="2" value="100"></tc-number-input>

<!-- Error state -->
<tc-number-input label="Age" min="18" max="120" value="16" error="Must be at least 18"></tc-number-input>

<script>
  const el = document.querySelector('tc-number-input')
  el.addEventListener('tc-change', e => console.log('value:', e.detail.value))
  // or via callback property:
  el.onChange = value => console.log('value:', value)
</script>
```
