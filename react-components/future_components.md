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
- [x] implemented
**What it does:** Auto-dismissing notification messages stacked in a corner of the screen.  
**Key behaviors:** Global imperative API (`toast.success('...')`, `toast.error('...')`), configurable position (top-right, bottom-center, etc.), progress bar countdown, dismiss on click, queue management (max visible), pause on hover, accessible `role="alert"`.  
**Priority:** P1

---

### Popover
- [x] implemented
**What it does:** A positioned overlay panel with an optional arrow that anchors to a trigger element.  
**Key behaviors:** Floating positioning (using Floating UI or similar), 12-position placement (`top-start`, `bottom`, `right`, etc.), auto-flip when near viewport edge, click-outside close, delay on open/close, distinct from Tooltip (can contain interactive content).  
**Priority:** P1

---

### ContextMenu
- [x] implemented
**What it does:** A right-click menu with nested submenu support.  
**Key behaviors:** Triggers on `contextmenu` event (and optionally long-press on touch), keyboard navigation, submenu expand on hover/focus, disabling items, icons per item, dividers.  
**Priority:** P1

---

### CommandPalette
- [x] implemented
**What it does:** A Cmd+K / Ctrl+K overlay for searching actions, pages, and records across the application.  
**Key behaviors:** Global keyboard shortcut listener, fuzzy search, grouped results, keyboard-only navigation, recent/pinned items, pluggable data source, animated modal entrance.  
**Priority:** P1

---

### Accordion
- [x] implemented
**What it does:** Vertically stacked collapsible sections.  
**Key behaviors:** Single vs. multiple open mode, animated height transition, controlled/uncontrolled, chevron rotation, optional always-open first item, border and borderless variants.  
**Priority:** P1

---

### Breadcrumb
- [x] implemented
**What it does:** A horizontal trail of navigation links showing the current page location.  
**Key behaviors:** Accepts `items: { label, href }[]`, custom separator, collapse long paths with `...` ellipsis and popover for hidden items, last item non-linked (current page), `aria-label="breadcrumb"` and `aria-current="page"` on last item.  
**Priority:** P1

---

### Stepper
- [x] implemented
**What it does:** A visual step-progress indicator for multi-step flows.  
**Key behaviors:** Horizontal and vertical orientation, step states (`completed`, `active`, `error`, `pending`), optional step descriptions, clickable steps for non-linear navigation, accessible with `aria-current="step"`.  
**Priority:** P1

---

### NumberInput
- [x] implemented
**What it does:** A numeric input with increment/decrement buttons and configurable step/min/max.  
**Key behaviors:** Up/down arrow key support, mouse wheel scroll, `step`, `min`, `max` props, precision (decimal places), format display (currency, percentage), disabled state, error state.  
**Priority:** P1

---

### Slider
- [x] implemented
**What it does:** A single-handle range slider for selecting a value within a range.  
**Key behaviors:** Controlled value, `min`/`max`/`step`, keyboard increment (arrow keys, Page Up/Down), visible tick marks option, value tooltip on drag, formatted display label.  
**Priority:** P1

---

### RangeSlider
- [x] implemented
**What it does:** A dual-handle slider for selecting a min/max range.  
**Key behaviors:** Two draggable handles that cannot cross each other, `value: [min, max]`, `onChange: ([min, max]) => void`, all the same behaviors as Slider.  
**Priority:** P2

---

### Rating
- [x] implemented
**What it does:** A star (or icon) rating input.  
**Key behaviors:** Controlled value, half-star support, read-only display mode, hover preview, custom icon (star, heart, etc.), accessible with `role="radiogroup"` and individual `role="radio"` stars.  
**Priority:** P2

---

### OTPInput / PinInput
- [x] implemented
**What it does:** A row of single-character inputs for entering verification codes (OTP, PIN, 2FA).  
**Key behaviors:** Auto-focus next field on input, backspace moves focus to previous, paste fills all fields, digit-only or alphanumeric mode, configurable length, masked mode.  
**Priority:** P2

---

### PhoneInput
- [x] implemented
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

### TransferList
- [ ] implemented
**What it does:** Two side-by-side lists with move-between functionality (left-available, right-selected).  
**Key behaviors:** Multi-select within each list, move-all / move-selected buttons, search filter in each list, drag-and-drop reordering.  
**Priority:** P3

---

### TreeView
- [x] implemented
**What it does:** A hierarchical collapsible tree of nodes.  
**Key behaviors:** Expand/collapse nodes, multi-select with shift-click, checkbox mode, async child loading, drag-and-drop reorder, icons per node, keyboard navigation (arrows, Enter, Space).  
**Priority:** P2

---

### ScrollArea
- [x] implemented
**What it does:** A container with a custom, consistently-styled scrollbar.  
**Key behaviors:** Replaces native scrollbar with a styled overlay bar, auto-hides when not scrolling, works on both axes, accessible (mouse wheel, keyboard, touch still function normally).  
**Priority:** P2

---

### ResizablePanel
- [x] implemented
**What it does:** Two or more panels with a draggable divider between them.  
**Key behaviors:** Horizontal and vertical orientation, configurable min/max per panel, double-click divider to reset, persist sizes in localStorage, keyboard resizing (focus divider + arrows).  
**Priority:** P2

---

### InfiniteScroll
- [x] implemented
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
- [x] implemented
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
- [x] implemented
**What it does:** A split-pane editor with raw Markdown input on the left and a live preview on the right.  
**Key behaviors:** Syntax highlighting in the edit pane, preview using a sanitized Markdown renderer, toolbar for common shortcuts, fullscreen mode, drag-and-drop image paste.  
**Priority:** P2

---

### Carousel
- [x] implemented
**What it does:** A horizontally scrolling container showing one or more items at a time.  
**Key behaviors:** Auto-play with pause-on-hover, prev/next controls, dot pagination, touch/swipe support, configurable items-visible per breakpoint, `aria-roledescription="carousel"`.  
**Priority:** P2

---

### ImageCrop
- [x] implemented
**What it does:** An interactive image cropper for user avatar/cover photo upload flows.  
**Key behaviors:** Drag to reposition, pinch/scroll to zoom, aspect ratio lock, output as a `Blob` or base64 string, circular mask variant for avatars.  
**Priority:** P2

---

### Lightbox / ImageGallery
- [x] implemented
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

### KanbanBoard
- [ ] implemented
**What it does:** A drag-and-drop board of columns (swim lanes) with cards.  
**Key behaviors:** DnD between columns and within a column, add/remove columns, add/remove cards, card ordering, column WIP limit indicator, card detail modal on click, mobile swipe to change column.  
**Priority:** P2

---

## Part 3 — SaaS & Admin Platforms

---

### APIKeyCard
- [ ] implemented
**What it does:** A card displaying an API key with reveal/hide, copy, and revoke actions.  
**Key behaviors:** Masked by default (show last 4 chars), reveal on hover or click with confirmation, copy-to-clipboard with success feedback, revoke button with confirmation dialog, key metadata (created date, last used).  
**Priority:** P1

---

### PermissionMatrix
- [ ] implemented
**What it does:** A role vs. permission table with toggle cells.  
**Key behaviors:** Rows = permissions, columns = roles, checkbox/toggle per cell, read-only and editable modes, save/reset actions, group permissions by category.  
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

### ChangelogEntry
- [ ] implemented
**What it does:** A single changelog item with version, date, category tags, and description.  
**Note:** Extends or replaces the existing `Changelog` domain component with a more generic, reusable version.  
**Priority:** P2

---

## Part 4 — Developer Tools & DevOps

---

### Terminal
- [ ] implemented
**What it does:** A read-only terminal/console output display.  
**Key behaviors:** ANSI color code rendering, auto-scroll-to-bottom, scroll-lock toggle, copy-to-clipboard, line numbers, wrap/no-wrap toggle, max line buffer limit (prevent memory bloat).  
**Priority:** P1

---

### EnvVarEditor
- [ ] implemented
**What it does:** A key-value editor for environment variables.  
**Key behaviors:** Add/remove/edit rows, mask sensitive values (toggle reveal), bulk paste from `.env` format, duplicate key warning, export as `.env` file.  
**Priority:** P2

---

## Part 5 — Finance & Fintech

---

### CurrencyInput
- [ ] implemented
**What it does:** A numeric input formatted as a currency amount.  
**Key behaviors:** Auto-formats with thousands separators and decimal places on blur, currency symbol prefix, currency selector dropdown, positive-only or allows negative, locale-aware.  
**Priority:** P1

---

## Part 6 — Project & Task Management

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
