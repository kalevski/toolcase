# Future Components Roadmap

Components planned for `@toolcase/react-components` to reach commercial parity with libraries like MUI, Ant Design, and Kibo UI. Organized by universal components first, then domain-specific packs.

None of these exist in the library yet unless noted.

---

## How to Read This File

Each entry shows:
- **What it does** — one-sentence description
- **Key behaviors** — what makes it non-trivial to build
- **Priority** — `P1` must-have for any app · `P2` high-value · `P3` domain-specific

---

## Part 1 — Universal / Foundation

These belong in every application regardless of domain. They are the most common gaps compared to MUI/Ant Design.

---

### Drawer
- [x] implemented
**What it does:** A panel that slides in from the left, right, top, or bottom of the viewport, overlaying content.  
**Key behaviors:** Focus trap, `Escape` to close, animated slide-in from the chosen side, backdrop overlay, controlled/uncontrolled open state, optional pinned (non-overlay) mode for desktop.  
**Priority:** P1

---

### Toast / Notification System
- [ ] implemented
**What it does:** Auto-dismissing notification messages stacked in a corner of the screen.  
**Key behaviors:** Global imperative API (`toast.success('...')`, `toast.error('...')`), configurable position (top-right, bottom-center, etc.), progress bar countdown, dismiss on click, queue management (max visible), pause on hover, accessible `role="alert"`.  
**Priority:** P1

---

### Popover
- [ ] implemented
**What it does:** A positioned overlay panel with an optional arrow that anchors to a trigger element.  
**Key behaviors:** Floating positioning (using Floating UI or similar), 12-position placement (`top-start`, `bottom`, `right`, etc.), auto-flip when near viewport edge, click-outside close, delay on open/close, distinct from Tooltip (can contain interactive content).  
**Priority:** P1

---

### ContextMenu
- [ ] implemented
**What it does:** A right-click menu with nested submenu support.  
**Key behaviors:** Triggers on `contextmenu` event (and optionally long-press on touch), keyboard navigation, submenu expand on hover/focus, disabling items, icons per item, dividers.  
**Priority:** P1

---

### CommandPalette
- [ ] implemented
**What it does:** A Cmd+K / Ctrl+K overlay for searching actions, pages, and records across the application.  
**Key behaviors:** Global keyboard shortcut listener, fuzzy search, grouped results, keyboard-only navigation, recent/pinned items, pluggable data source, animated modal entrance.  
**Priority:** P1

---

### Accordion
- [ ] implemented
**What it does:** Vertically stacked collapsible sections.  
**Key behaviors:** Single vs. multiple open mode, animated height transition, controlled/uncontrolled, chevron rotation, optional always-open first item, border and borderless variants.  
**Priority:** P1

---

### Breadcrumb
- [ ] implemented
**What it does:** A horizontal trail of navigation links showing the current page location.  
**Key behaviors:** Accepts `items: { label, href }[]`, custom separator, collapse long paths with `...` ellipsis and popover for hidden items, last item non-linked (current page), `aria-label="breadcrumb"` and `aria-current="page"` on last item.  
**Priority:** P1

---

### Stepper
- [ ] implemented
**What it does:** A visual step-progress indicator for multi-step flows.  
**Key behaviors:** Horizontal and vertical orientation, step states (`completed`, `active`, `error`, `pending`), optional step descriptions, clickable steps for non-linear navigation, accessible with `aria-current="step"`.  
**Priority:** P1

---

### NumberInput
- [ ] implemented
**What it does:** A numeric input with increment/decrement buttons and configurable step/min/max.  
**Key behaviors:** Up/down arrow key support, mouse wheel scroll, `step`, `min`, `max` props, precision (decimal places), format display (currency, percentage), disabled state, error state.  
**Priority:** P1

---

### Slider
- [ ] implemented
**What it does:** A single-handle range slider for selecting a value within a range.  
**Key behaviors:** Controlled value, `min`/`max`/`step`, keyboard increment (arrow keys, Page Up/Down), visible tick marks option, value tooltip on drag, formatted display label.  
**Priority:** P1

---

### RangeSlider
- [ ] implemented
**What it does:** A dual-handle slider for selecting a min/max range.  
**Key behaviors:** Two draggable handles that cannot cross each other, `value: [min, max]`, `onChange: ([min, max]) => void`, all the same behaviors as Slider.  
**Priority:** P2

---

### Rating
- [ ] implemented
**What it does:** A star (or icon) rating input.  
**Key behaviors:** Controlled value, half-star support, read-only display mode, hover preview, custom icon (star, heart, etc.), accessible with `role="radiogroup"` and individual `role="radio"` stars.  
**Priority:** P2

---

### OTPInput / PinInput
- [ ] implemented
**What it does:** A row of single-character inputs for entering verification codes (OTP, PIN, 2FA).  
**Key behaviors:** Auto-focus next field on input, backspace moves focus to previous, paste fills all fields, digit-only or alphanumeric mode, configurable length, masked mode.  
**Priority:** P2

---

### PhoneInput
- [ ] implemented
**What it does:** A phone number input with country-code selector and automatic formatting.  
**Key behaviors:** Country flag + dial code dropdown, format-on-type per country pattern, copy-paste normalization, `E.164` formatted output value, `libphonenumber-js` compatible.  
**Priority:** P2

---

### AutoComplete
- [ ] implemented
**What it does:** A text input with a suggestion dropdown that filters as the user types.  
**Key behaviors:** Async and sync data source, debounced fetch, highlight matching substring, keyboard navigation, `creatable` mode to add new values, distinct from `ExtendedSelect` in that the trigger is a free-text input not a button.  
**Priority:** P1

---

### MultiSelect
- [ ] implemented
**What it does:** A select input that allows selecting multiple values displayed as chips inside the input.  
**Key behaviors:** Searchable, chip removal on backspace/click, configurable max selections, `creatable` mode, keyboard navigation inside open list, `value: string[]`.  
**Priority:** P1

---

### TransferList
- [ ] implemented
**What it does:** Two side-by-side lists with move-between functionality (left-available, right-selected).  
**Key behaviors:** Multi-select within each list, move-all / move-selected buttons, search filter in each list, drag-and-drop reordering.  
**Priority:** P3

---

### TreeView
- [ ] implemented
**What it does:** A hierarchical collapsible tree of nodes.  
**Key behaviors:** Expand/collapse nodes, multi-select with shift-click, checkbox mode, async child loading, drag-and-drop reorder, icons per node, keyboard navigation (arrows, Enter, Space).  
**Priority:** P2

---

### ScrollArea
- [ ] implemented
**What it does:** A container with a custom, consistently-styled scrollbar.  
**Key behaviors:** Replaces native scrollbar with a styled overlay bar, auto-hides when not scrolling, works on both axes, accessible (mouse wheel, keyboard, touch still function normally).  
**Priority:** P2

---

### ResizablePanel
- [ ] implemented
**What it does:** Two or more panels with a draggable divider between them.  
**Key behaviors:** Horizontal and vertical orientation, configurable min/max per panel, double-click divider to reset, persist sizes in localStorage, keyboard resizing (focus divider + arrows).  
**Priority:** P2

---

### VirtualList
- [ ] implemented
**What it does:** A windowed list that only renders visible rows for performance with large datasets.  
**Key behaviors:** Fixed and variable row height, `overscan` option, `onEndReached` for infinite scroll, smooth scroll, compatible with `AdvancedTable` as a row virtualization option.  
**Priority:** P2

---

### InfiniteScroll
- [ ] implemented
**What it does:** A wrapper that calls `onLoadMore` when the user scrolls to the bottom.  
**Key behaviors:** Intersection Observer-based (not scroll event), threshold prop, loading indicator slot, hasMore guard, error retry slot.  
**Priority:** P2

---

### DateRangePicker
- [ ] implemented
**What it does:** A dual-calendar date range selector.  
**Key behaviors:** Start and end date selection, blocked dates, min/max range constraints, preset ranges (Last 7 days, This month, etc.), single-calendar mobile mode, `value: { start: string, end: string }`.  
**Priority:** P1

---

### TimePicker
- [ ] implemented
**What it does:** A time input with clock UI or scrollable hours/minutes columns.  
**Key behaviors:** 12h/24h format, minute step granularity (e.g. 15-minute intervals), keyboard input, clear button, optional seconds.  
**Priority:** P2

---

### RichTextEditor
- [ ] implemented
**What it does:** A WYSIWYG editor for formatted text content.  
**Key behaviors:** Bold/italic/underline/strikethrough, headings (H1–H4), lists (ordered/unordered), links, inline code, code blocks, blockquotes, image insert, undo/redo, HTML or markdown output mode. Built on `tiptap` or `lexical`.  
**Priority:** P1

---

### MarkdownEditor
- [ ] implemented
**What it does:** A split-pane editor with raw Markdown input on the left and a live preview on the right.  
**Key behaviors:** Syntax highlighting in the edit pane, preview using a sanitized Markdown renderer, toolbar for common shortcuts, fullscreen mode, drag-and-drop image paste.  
**Priority:** P2

---

### SignaturePad
- [ ] implemented
**What it does:** A canvas-based component for capturing a handwritten signature.  
**Key behaviors:** Draw with mouse/touch, clear button, export as PNG/SVG/base64, pen color and width, read-only display mode.  
**Priority:** P3

---

### Carousel
- [ ] implemented
**What it does:** A horizontally scrolling container showing one or more items at a time.  
**Key behaviors:** Auto-play with pause-on-hover, prev/next controls, dot pagination, touch/swipe support, configurable items-visible per breakpoint, `aria-roledescription="carousel"`.  
**Priority:** P2

---

### ImageCrop
- [ ] implemented
**What it does:** An interactive image cropper for user avatar/cover photo upload flows.  
**Key behaviors:** Drag to reposition, pinch/scroll to zoom, aspect ratio lock, output as a `Blob` or base64 string, circular mask variant for avatars.  
**Priority:** P2

---

### Lightbox / ImageGallery
- [ ] implemented
**What it does:** A fullscreen image viewer triggered from a thumbnail grid.  
**Key behaviors:** Arrow key navigation, swipe on touch, zoom on click, keyboard `Escape` close, caption display, thumbnail strip, preloading adjacent images.  
**Priority:** P2

---

### PageHeader
- [ ] implemented
**What it does:** A standardized page-level header with title, breadcrumb, description, and an actions slot.  
**Key behaviors:** Slots for `breadcrumb`, `title`, `subtitle`, `tags`, `actions` (right side); responsive stacking on mobile.  
**Priority:** P1

---

### EmptyStateCTA
- [ ] implemented
**What it does:** A richer empty state with a primary call-to-action button, illustration slot, and secondary link.  
**Note:** Extends the existing `EmptyState` with a more opinionated layout. Consider whether to extend or create a variant.  
**Priority:** P1

---

### Banner
- [ ] implemented
**What it does:** A site-wide or page-level announcement bar pinned to the top.  
**Key behaviors:** Variants (`info`, `warning`, `success`, `error`), dismissible with localStorage persistence, action button slot, icon slot.  
**Priority:** P2

---

### MasonryGrid
- [ ] implemented
**What it does:** A CSS Masonry / Pinterest-style grid layout container.  
**Key behaviors:** Column count responsive to breakpoint, gap control, children placed in shortest column, no fixed row heights.  
**Priority:** P3

---

## Part 2 — Data Visualization

Charts and data display components critical for dashboards and analytics.

---

### MetricCard
- [ ] implemented
**What it does:** A KPI card displaying a single metric with a label, trend indicator, and optional sparkline.  
**Key behaviors:** `value`, `label`, `trend` (`up` | `down` | `neutral`), `trendValue` (e.g. "+12%"), `trendPeriod` (e.g. "vs last month"), sparkline slot, loading skeleton state, variant colors per trend direction.  
**Priority:** P1

---

### TrendIndicator
- [ ] implemented
**What it does:** An inline badge/chip showing a percentage change with an arrow icon.  
**Key behaviors:** Positive (green arrow up), negative (red arrow down), neutral (gray dash), formatted value display, size variants.  
**Priority:** P1

---

### Sparkline
- [ ] implemented
**What it does:** A minimal inline chart (line or bar) without axes or labels, for use inside MetricCards or table cells.  
**Key behaviors:** `data: number[]`, `type: 'line' | 'bar'`, `color`, `height`, `width`, SVG-based for crisp rendering, no external charting dependency.  
**Priority:** P2

---

### BarChart
- [ ] implemented
**What it does:** A standard vertical or horizontal bar chart.  
**Key behaviors:** Single and grouped bars, value labels, custom colors per series, responsive sizing, animated enter, accessible data table fallback, `onClick` per bar.  
**Priority:** P1

---

### LineChart
- [ ] implemented
**What it does:** A single or multi-series line chart with area fill option.  
**Key behaviors:** Multiple series, tooltip on hover, legend, grid lines, custom x/y axis formatters, zoom/pan option, animated draw-in.  
**Priority:** P1

---

### PieChart / DonutChart
- [ ] implemented
**What it does:** A circular chart showing proportional segments.  
**Key behaviors:** Donut variant with center label slot, hover highlight, legend, percentage labels on segments, animated.  
**Priority:** P2

---

### AreaChart
- [ ] implemented
**What it does:** A stacked or overlapping area chart useful for showing cumulative trends.  
**Key behaviors:** Stacked and unstacked mode, gradient fills, same API as LineChart.  
**Priority:** P2

---

### Heatmap
- [ ] implemented
**What it does:** A grid of cells colored by intensity (like a GitHub contribution graph).  
**Key behaviors:** Custom color scale, tooltip per cell, row/column labels, configurable cell size, empty cell styling.  
**Priority:** P3

---

### FunnelChart
- [ ] implemented
**What it does:** A funnel showing conversion between sequential steps.  
**Key behaviors:** Steps with labels and values, percentage drop labels between steps, horizontal and vertical orientation, clickable steps.  
**Priority:** P3

---

### GanttChart
- [ ] implemented
**What it does:** A time-based horizontal bar chart for project/task scheduling.  
**Key behaviors:** Time-axis (days/weeks/months), draggable task bars to reschedule, dependency arrows, today marker, milestone diamonds, zoom levels, resource grouping.  
**Priority:** P3

---

### ChartContainer
- [ ] implemented
**What it does:** A standardized wrapper for any chart with a consistent title, legend, period selector, and export button.  
**Key behaviors:** Title + subtitle, time range selector slot, legend slot, export as PNG/CSV button, loading overlay, `no data` empty state.  
**Priority:** P2

---

### DataGrid
- [ ] implemented
**What it does:** A high-performance grid for large datasets with column resizing, inline editing, and virtual scrolling.  
**Key behaviors:** Virtualized rows and columns, resizable/reorderable columns, inline cell editing, row selection (single/multi), frozen columns, row grouping, aggregation footer row, Excel-like copy-paste.  
**Priority:** P1

---

### CalendarView
- [ ] implemented
**What it does:** A month/week/day calendar for displaying and creating events.  
**Key behaviors:** Month, week, and day views, event creation on click/drag, event overlap handling, drag to reschedule, recurring event support, `onEventClick`, `onSlotClick`.  
**Priority:** P2

---

### KanbanBoard
- [ ] implemented
**What it does:** A drag-and-drop board of columns (swim lanes) with cards.  
**Key behaviors:** DnD between columns and within a column, add/remove columns, add/remove cards, card ordering, column WIP limit indicator, card detail modal on click, mobile swipe to change column.  
**Priority:** P2

---

## Part 3 — SaaS & Admin Platforms

---

### PlanSelector
- [ ] implemented
**What it does:** A plan-comparison card grid with feature lists and a CTA button per plan.  
**Key behaviors:** Highlight "recommended" plan, monthly/annual billing toggle with price recalculation, feature checkmarks/crosses, current plan state, upgrade/downgrade distinction.  
**Priority:** P1

---

### UsageQuotaBar
- [ ] implemented
**What it does:** A labeled progress bar showing resource consumption against a quota limit.  
**Key behaviors:** `used`, `total`, `unit` (e.g. "GB", "requests"), warning color threshold (e.g. > 80%), upgrade CTA when over limit, compact and detailed variants.  
**Priority:** P1

---

### APIKeyCard
- [ ] implemented
**What it does:** A card displaying an API key with reveal/hide, copy, and revoke actions.  
**Key behaviors:** Masked by default (show last 4 chars), reveal on hover or click with confirmation, copy-to-clipboard with success feedback, revoke button with confirmation dialog, key metadata (created date, last used).  
**Priority:** P1

---

### TeamMemberRow
- [ ] implemented
**What it does:** A list row representing a team member with avatar, name, role badge, and action menu.  
**Key behaviors:** Role selector dropdown inline, remove/deactivate actions in kebab menu, pending invite state, you (current user) badge.  
**Priority:** P1

---

### InviteForm
- [ ] implemented
**What it does:** An email + role input for inviting new team members.  
**Key behaviors:** Multi-email entry (tag input style), role selector per invitee, bulk send, resend logic, pending invite list.  
**Priority:** P1

---

### PermissionMatrix
- [ ] implemented
**What it does:** A role vs. permission table with toggle cells.  
**Key behaviors:** Rows = permissions, columns = roles, checkbox/toggle per cell, read-only and editable modes, save/reset actions, group permissions by category.  
**Priority:** P2

---

### AuditLogRow
- [ ] implemented
**What it does:** A single row in an audit/activity log table.  
**Key behaviors:** Actor avatar + name, action verb (created, updated, deleted), target resource link, timestamp with relative time, expandable diff view.  
**Priority:** P2

---

### IntegrationCard
- [ ] implemented
**What it does:** A card for a third-party integration showing logo, name, status, and connect/disconnect action.  
**Key behaviors:** Connected/disconnected state styling, last-sync timestamp, configure button, error state, category badge.  
**Priority:** P2

---

### WebhookListItem
- [ ] implemented
**What it does:** A list item for a configured webhook endpoint.  
**Key behaviors:** URL display (truncated), event types subscribed, enabled/disabled toggle, last delivery status badge, test/delete actions.  
**Priority:** P2

---

### ActivityFeed
- [ ] implemented
**What it does:** A chronological feed of system and user events.  
**Key behaviors:** Grouped by date, avatar per event, action text with bold entity names, relative timestamp, expandable details, infinite scroll load-more, filter by event type.  
**Priority:** P2

---

### SubscriptionStatusBadge
- [ ] implemented
**What it does:** A compact badge showing the current subscription state.  
**Key behaviors:** Variants: `active`, `trial`, `past_due`, `canceled`, `paused` — each with distinct color and icon. Tooltip with expiry date.  
**Priority:** P2

---

### BillingHistoryRow
- [ ] implemented
**What it does:** A row in a billing/invoice list table.  
**Key behaviors:** Date, description, amount, status badge (paid/failed/pending), download PDF link, retry payment action for failed.  
**Priority:** P2

---

### OnboardingChecklist
- [ ] implemented
**What it does:** A step-by-step checklist to guide new users through product setup.  
**Key behaviors:** Collapsible/expandable, checked/unchecked items with auto-check on action completion, progress percentage, dismiss option, confetti on completion.  
**Priority:** P2

---

### ChangelogEntry
- [ ] implemented
**What it does:** A single changelog item with version, date, category tags, and description.  
**Note:** Extends or replaces the existing `Changelog` domain component with a more generic, reusable version.  
**Priority:** P2

---

## Part 4 — E-commerce & Retail

---

### ProductCard
- [ ] implemented
**What it does:** A card displaying a product with image, title, price, rating, and add-to-cart action.  
**Key behaviors:** Image hover zoom, sale price with strikethrough original, out-of-stock state, wishlist toggle, quick-view button, skeleton loading, badge slot (New, Sale, -20%).  
**Priority:** P1

---

### PriceDisplay
- [ ] implemented
**What it does:** A formatted price with currency, optional original price, and discount badge.  
**Key behaviors:** Currency formatting per locale, strike-through original, discount percentage auto-calculated, size variants, colorize discounted price.  
**Priority:** P1

---

### CartItem
- [ ] implemented
**What it does:** A line item inside a shopping cart.  
**Key behaviors:** Product image, name, variant description, quantity stepper (NumberInput), remove button, unit price and line total, loading state during quantity update.  
**Priority:** P1

---

### CartSummary
- [ ] implemented
**What it does:** An order summary panel showing subtotal, discounts, shipping, taxes, and total.  
**Key behaviors:** Line-by-line breakdown, promo code input with apply/remove, CTA checkout button, loading state, collapsible on mobile.  
**Priority:** P1

---

### CheckoutStepper
- [ ] implemented
**What it does:** A multi-step checkout progress indicator (Cart → Shipping → Payment → Confirmation).  
**Key behaviors:** Extends the universal `Stepper` with e-commerce step names, clickable completed steps to go back.  
**Priority:** P2

---

### ReviewCard
- [ ] implemented
**What it does:** A customer review with star rating, reviewer name, date, and verified purchase badge.  
**Key behaviors:** Truncated text with read-more, helpful vote counter, reported/flagged state, reply thread.  
**Priority:** P2

---

### ProductGallery
- [ ] implemented
**What it does:** A main image with thumbnail strip for product image sets.  
**Key behaviors:** Thumbnail click to switch main image, zoom on hover, pinch-zoom on mobile, video thumbnail support, fullscreen mode.  
**Priority:** P2

---

### ShippingMethodCard
- [ ] implemented
**What it does:** A selectable card for choosing a shipping option.  
**Key behaviors:** Radio-like selection, carrier logo, method name, delivery estimate, price, selected state.  
**Priority:** P2

---

### PaymentMethodCard
- [ ] implemented
**What it does:** A card representing a saved payment method (credit card, PayPal, etc.).  
**Key behaviors:** Masked card number (last 4), card brand icon, expiry, default badge, remove action, add-new variant.  
**Priority:** P2

---

### OrderStatusTracker
- [ ] implemented
**What it does:** A horizontal timeline showing the current order fulfillment status.  
**Key behaviors:** Steps: Placed → Confirmed → Shipped → Out for Delivery → Delivered, active step highlight, estimated date per step, error state (delayed/returned).  
**Priority:** P2

---

### StockIndicator
- [ ] implemented
**What it does:** A small label indicating product availability.  
**Key behaviors:** In stock (green), low stock (N left — orange), out of stock (red), pre-order (blue), back-in-stock notify button.  
**Priority:** P2

---

## Part 5 — Developer Tools & DevOps

---

### Terminal
- [ ] implemented
**What it does:** A read-only terminal/console output display.  
**Key behaviors:** ANSI color code rendering, auto-scroll-to-bottom, scroll-lock toggle, copy-to-clipboard, line numbers, wrap/no-wrap toggle, max line buffer limit (prevent memory bloat).  
**Priority:** P1

---

### LogViewer
- [ ] implemented
**What it does:** A live or historical log stream viewer with filtering and severity highlighting.  
**Key behaviors:** Level filter (debug/info/warn/error), text search with highlight, timestamp display, JSON log pretty-printer, pause/resume live stream, export selection.  
**Priority:** P1

---

### EndpointBadge
- [ ] implemented
**What it does:** A compact badge displaying an HTTP method and route path.  
**Key behaviors:** Color per method (GET=green, POST=blue, PUT=yellow, DELETE=red, PATCH=orange), monospace font for path, copy-on-click.  
**Priority:** P1

---

### RequestInspector
- [ ] implemented
**What it does:** A detailed view of an HTTP request and response pair.  
**Key behaviors:** Tabs for Headers, Body, Query Params, Response; syntax-highlighted JSON body; status code badge; latency display; curl command export.  
**Priority:** P2

---

### EnvVarEditor
- [ ] implemented
**What it does:** A key-value editor for environment variables.  
**Key behaviors:** Add/remove/edit rows, mask sensitive values (toggle reveal), bulk paste from `.env` format, duplicate key warning, export as `.env` file.  
**Priority:** P2

---

### DeploymentCard
- [ ] implemented
**What it does:** A card representing a single deployment with status, branch, commit, and timestamp.  
**Key behaviors:** Status badge (success/failed/building/queued), branch name, short commit SHA with copy, deployed-by avatar, duration, rollback and view-logs actions.  
**Priority:** P2

---

### PipelineStatus
- [ ] implemented
**What it does:** A horizontal strip showing CI/CD pipeline stage statuses.  
**Key behaviors:** Each stage shows name + status icon (pending/running/passed/failed/skipped), animated spinner for running stages, click stage to expand log, overall status derived from stages.  
**Priority:** P2

---

### DiffViewer
- [ ] implemented
**What it does:** A side-by-side or unified diff display for code or text changes.  
**Key behaviors:** Added (green), removed (red), unchanged lines with context collapse, file header with stats (+N/-N), syntax highlighting per language, inline comment thread slot.  
**Priority:** P2

---

### SchemaViewer
- [ ] implemented
**What it does:** A collapsible tree display of a JSON Schema or TypeScript type.  
**Key behaviors:** Property name, type, required indicator, description tooltip, nested object/array expand/collapse, search/filter.  
**Priority:** P3

---

### ConnectionStatusBar
- [ ] implemented
**What it does:** A thin bar or dot indicating real-time connection health (WebSocket, SSE).  
**Key behaviors:** Connected (green), reconnecting (yellow + animation), disconnected (red), last-connected timestamp, manual reconnect button.  
**Priority:** P2

---

## Part 6 — Content Management & Publishing

---

### ArticleCard
- [ ] implemented
**What it does:** A blog/article preview card with cover image, category, title, excerpt, author, and read-time.  
**Key behaviors:** Horizontal and vertical layout variants, image aspect ratio lock, truncated excerpt, author avatar, publish date, tag list.  
**Priority:** P1

---

### CategoryBreadcrumb
- [ ] implemented
**What it does:** A breadcrumb specifically styled for content category hierarchies.  
**Key behaviors:** Extends `Breadcrumb` with separator customization and a "back to category" mobile variant.  
**Priority:** P2

---

### MediaLibraryGrid
- [ ] implemented
**What it does:** A grid of uploaded media files (images, videos, documents) with selection.  
**Key behaviors:** Multi-select with shift-click, thumbnail preview, type icon fallback, detail panel on click, sort by date/name/size, drag-to-reorder, upload drop target overlay.  
**Priority:** P2

---

### SEOMetaEditor
- [ ] implemented
**What it does:** A structured form for editing page title, meta description, OG image, and canonical URL.  
**Key behaviors:** Character count for title (60) and description (160) with color-coded warning, live Google search preview snippet, Twitter/OG card preview toggle.  
**Priority:** P2

---

### SlugInput
- [ ] implemented
**What it does:** An input that auto-generates a URL slug from a title and lets the user edit it.  
**Key behaviors:** Auto-slugify on title change (until manually edited), manual edit mode toggle, availability check (async validation), prefix display (e.g. `/blog/`).  
**Priority:** P2

---

### TableOfContents
- [ ] implemented
**What it does:** An auto-generated list of anchor links from heading elements in a page.  
**Key behaviors:** Highlights active section as user scrolls, smooth-scroll on click, nested headings (H2/H3), collapsible on mobile.  
**Priority:** P2

---

### ContentVersionRow
- [ ] implemented
**What it does:** A single row in a content revision history list.  
**Key behaviors:** Version number, editor avatar + name, relative timestamp, change summary, restore and diff-view actions, current version badge.  
**Priority:** P3

---

## Part 7 — Finance & Fintech

---

### AccountCard
- [ ] implemented
**What it does:** A card displaying a bank account or wallet with balance, account number, and actions.  
**Key behaviors:** Masked account number (last 4), bank logo, currency, balance with color (positive/negative), primary account badge, send/receive action buttons.  
**Priority:** P1

---

### TransactionRow
- [ ] implemented
**What it does:** A single row in a transactions list.  
**Key behaviors:** Merchant name + icon, transaction date, category tag, amount with positive (green) / negative (red) coloring, pending badge, expand for receipt/notes.  
**Priority:** P1

---

### CurrencyInput
- [ ] implemented
**What it does:** A numeric input formatted as a currency amount.  
**Key behaviors:** Auto-formats with thousands separators and decimal places on blur, currency symbol prefix, currency selector dropdown, positive-only or allows negative, locale-aware.  
**Priority:** P1

---

### BalanceDisplay
- [ ] implemented
**What it does:** A large formatted balance figure with currency and optional trend.  
**Key behaviors:** Large typographic treatment, masked/revealed toggle, currency code, formatted locale number, trend badge below.  
**Priority:** P1

---

### InvoiceLineItem
- [ ] implemented
**What it does:** A row in an invoice with description, quantity, unit price, and line total.  
**Key behaviors:** Editable and read-only mode, tax indicator, discount input, auto-calculated line total, add/remove row.  
**Priority:** P2

---

### PaymentStatusBadge
- [ ] implemented
**What it does:** A badge for payment/invoice status.  
**Key behaviors:** Variants: `paid`, `pending`, `failed`, `refunded`, `partial`, `overdue` — each with distinct color and icon.  
**Priority:** P2

---

### BudgetBar
- [ ] implemented
**What it does:** A visual bar showing spending against a budget.  
**Key behaviors:** `spent`, `budget`, `unit`, over-budget turns red, category label, amount labels on both ends, compact variant for dashboard cards.  
**Priority:** P2

---

### StockTicker
- [ ] implemented
**What it does:** A real-time price display for a stock or crypto asset.  
**Key behaviors:** Symbol, current price, change ($ and %), direction arrow, sparkline, flash animation on price update.  
**Priority:** P3

---

### LoanCalculator
- [ ] implemented
**What it does:** An interactive calculator for mortgage/loan payments.  
**Key behaviors:** Principal, interest rate, term inputs; real-time monthly payment output; amortization schedule toggle; total interest display.  
**Priority:** P3

---

## Part 8 — Healthcare & Medical

---

### PatientCard
- [ ] implemented
**What it does:** A summary card for a patient record.  
**Key behaviors:** Avatar, name, age/DOB, gender, patient ID, allergy tags, primary condition tags, quick-action buttons (view, message, schedule).  
**Priority:** P1

---

### AppointmentSlot
- [ ] implemented
**What it does:** A clickable time slot for booking appointments.  
**Key behaviors:** Available/booked/blocked states, time range display, provider name, slot duration, hover preview, book confirmation flow.  
**Priority:** P1

---

### VitalSignDisplay
- [ ] implemented
**What it does:** A set of vital sign readings with status indicators.  
**Key behaviors:** Heart rate, blood pressure, temperature, SpO2, respiratory rate — each with normal-range coloring (green/yellow/red), trend arrow, last-measured timestamp.  
**Priority:** P2

---

### MedicationCard
- [ ] implemented
**What it does:** A card for a prescribed medication.  
**Key behaviors:** Drug name, dosage, frequency, start/end date, prescriber, refill-due indicator, mark-taken action, interaction warning badge.  
**Priority:** P2

---

### AllergyTag
- [ ] implemented
**What it does:** A compact tag for a patient allergy with severity color.  
**Key behaviors:** Extends `Tag` with severity variants (mild/moderate/severe), allergen name, reaction description tooltip.  
**Priority:** P2

---

### ConsentFormCheck
- [ ] implemented
**What it does:** A styled consent checkbox with a scrollable document body.  
**Key behaviors:** Long legal text in a fixed-height scroll area, checkbox only enables after scrolling to the bottom, signature slot, timestamp on sign.  
**Priority:** P3

---

### InsuranceCard
- [ ] implemented
**What it does:** A credit-card styled display of a patient's insurance information.  
**Key behaviors:** Payer name, member ID, group number, coverage dates, copy-on-click fields, front/back flip animation.  
**Priority:** P3

---

## Part 9 — Project & Task Management

---

### TaskCard
- [ ] implemented
**What it does:** A card representing a single task/issue.  
**Key behaviors:** Title, status badge, priority indicator, assignee avatar, due date with overdue coloring, label chips, story points, drag handle for Kanban, click to open detail modal.  
**Priority:** P1

---

### PriorityBadge
- [ ] implemented
**What it does:** A small badge or icon indicating task priority.  
**Key behaviors:** Variants: `critical`, `high`, `medium`, `low` — each with a distinct icon and color. Text or icon-only display mode.  
**Priority:** P1

---

### AssigneeStack
- [ ] implemented
**What it does:** A compact stack of overlapping avatars for showing multiple assignees.  
**Key behaviors:** Shows up to N avatars, overflow count (+3), click to open assignee picker popover, unassigned state, add-button.  
**Priority:** P1

---

### MilestoneCard
- [ ] implemented
**What it does:** A card representing a project milestone with progress and due date.  
**Key behaviors:** Title, due date (overdue coloring), task completion progress bar (X/Y tasks), status badge, link to filtered task list.  
**Priority:** P2

---

### SprintBadge
- [ ] implemented
**What it does:** A badge showing which sprint a task belongs to.  
**Key behaviors:** Sprint name, active/completed/upcoming states, dates tooltip.  
**Priority:** P2

---

### BurndownChart
- [ ] implemented
**What it does:** A line chart comparing ideal vs. actual work remaining in a sprint.  
**Key behaviors:** Two lines (ideal and actual), today marker, story points or task count y-axis, hover tooltip per day.  
**Priority:** P3

---

### TimeEntry
- [ ] implemented
**What it does:** A form for logging time spent on a task.  
**Key behaviors:** Duration input (hours:minutes or decimal), date, description, billable toggle, start-timer button for live tracking.  
**Priority:** P3

---

## Part 10 — Education & Learning

---

### CourseCard
- [ ] implemented
**What it does:** A card for a course with thumbnail, title, instructor, rating, price, and enrollment status.  
**Key behaviors:** Progress bar for in-progress courses, certificate badge for completed, skill tags, free/paid badge, wishlist button.  
**Priority:** P1

---

### LessonProgress
- [ ] implemented
**What it does:** A step-by-step sidebar showing module/lesson completion.  
**Key behaviors:** Modules expand to show lessons, completed/active/locked states, duration per lesson, current lesson highlight, overall progress percentage at top.  
**Priority:** P2

---

### QuizQuestion
- [ ] implemented
**What it does:** A single quiz question with multiple-choice answers.  
**Key behaviors:** Single or multiple correct answers, image in question/answer support, answer reveal (correct/incorrect feedback), explanation text on reveal, timer countdown option.  
**Priority:** P2

---

### CertificateBadge
- [ ] implemented
**What it does:** A compact badge or full-page certificate display for course completion.  
**Key behaviors:** Learner name, course name, completion date, issuer logo, unique ID, share to LinkedIn button, PDF download.  
**Priority:** P3

---

### InstructorCard
- [ ] implemented
**What it does:** A compact profile card for a course instructor.  
**Key behaviors:** Avatar, name, title, rating, student count, course count, bio excerpt, follow button.  
**Priority:** P2

---

## Part 11 — Real Estate & Property

---

### PropertyCard
- [ ] implemented
**What it does:** A card for a property listing with photo, price, key specs, and save action.  
**Key behaviors:** Cover photo with badge (New, Reduced), price, bedrooms/bathrooms/sqft icons, address, agency logo, favorite/save toggle, photo count badge.  
**Priority:** P1

---

### AmenityList
- [ ] implemented
**What it does:** A grid of amenity icons with labels (Pool, Gym, Parking, etc.).  
**Key behaviors:** Icon + label per amenity, available/unavailable states, expandable when list is long.  
**Priority:** P2

---

### MortgageCalculator
- [ ] implemented
**What it does:** An interactive mortgage estimator embedded in a property listing.  
**Key behaviors:** Price, down payment, interest rate, term — outputs monthly payment + total interest. Live update on input change.  
**Priority:** P3

---

### PriceHistoryChart
- [ ] implemented
**What it does:** A line chart showing a property's price changes over time.  
**Key behaviors:** Zoomable time axis, event markers (listed, price drop, sold), tooltip with exact date and value.  
**Priority:** P3

---

## Part 12 — Maps & Location

---

### LocationPicker
- [ ] implemented
**What it does:** An address search field that resolves to coordinates with a map preview.  
**Key behaviors:** Geocoding autocomplete (Google Maps / Mapbox / OpenStreetMap), map thumbnail showing the pin, coordinate output, reverse geocode on pin drag.  
**Priority:** P2

---

### MapPinCard
- [ ] implemented
**What it does:** A tooltip/popup card attached to a map marker.  
**Key behaviors:** Title, image, short description, action button, close button, consistent styling regardless of map provider.  
**Priority:** P2

---

### CountrySelector
- [ ] implemented
**What it does:** A dropdown for selecting a country from a standardized list.  
**Key behaviors:** Flag emoji or icon, country name, ISO code value, searchable, grouped by region option, phone dial code variant.  
**Priority:** P1

---

### RegionSelector
- [ ] implemented
**What it does:** A cascading country → state/province → city selector.  
**Key behaviors:** Each level loads its options based on the previous selection, async loading per level, reset downstream on change.  
**Priority:** P2

---

## Summary by Priority

| Priority | Count | Description |
|----------|-------|-------------|
| P1 | 38 | Must-have for any commercial app |
| P2 | 55 | High-value, covers most industry verticals |
| P3 | 20 | Domain-specific / specialized |
| **Total** | **113** | |

---

## Suggested Implementation Order

1. **Phase 1 — Foundation gaps** (P1 universal): `Toast`, `Drawer`, `Popover`, `CommandPalette`, `Breadcrumb`, `Stepper`, `AutoComplete`, `MultiSelect`, `DateRangePicker`, `RichTextEditor`, `NumberInput`, `PageHeader`, `DataGrid`
2. **Phase 2 — Data visualization**: `MetricCard`, `TrendIndicator`, `BarChart`, `LineChart`, `CalendarView`, `KanbanBoard`, `ChartContainer`
3. **Phase 3 — SaaS pack**: `PlanSelector`, `UsageQuotaBar`, `APIKeyCard`, `TeamMemberRow`, `PermissionMatrix`, `AuditLogRow`, `OnboardingChecklist`
4. **Phase 4 — Domain packs** (choose by target market): E-commerce, DevTools, CMS, Finance, Healthcare, PM
