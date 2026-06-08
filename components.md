# @toolcase/react-components — Component Reference

Documentation for every component in `react-components/src/`. Each entry lists the component **Name**, its **Props / Input**, and its **Purpose**.

> Note: `Dropzone.tsx` exports no component (empty file) and is omitted. `tokens.ts`, `tc-icons.ts`, `utils/`, and `hooks/` are non-component modules and are not listed here. Entries are ordered by source file; `Chart/`, `DashboardCard/`, `DashboardLayout/`, and `modal/` get their own grouped sections.

---

### Accordion
- **Props:** `items: AccordionItem[]`, `multiple?: boolean`, `defaultOpen?: string[]`, `open?: string[]`, `onOpenChange?: (keys: string[]) => void`, `variant?: 'bordered' | 'borderless'`, `className?: string`
- **Purpose:** Collapsible accordion that manages open/closed state of panels with single- or multiple-open support.

### ActionHeader
- **Props:** `actions: ActionHeaderAction[]`, `onExec?: (key: string) => void`, `disabled?: boolean`, `className?: string`, `children?: React.ReactNode`
- **Purpose:** Header that displays child content with a row of action buttons on the right.

### ActionItems
- **Props:** `items: ActionItem[]`, `onActionClick?: (key: string) => void`, `label?: string`
- **Purpose:** Dropdown menu button with keyboard-accessible items positioned relative to the trigger.

### ActionRowList
- **Props:** `actions: ActionRow[]`, `onActionClick: (key: string) => void`, `outline?: boolean`, `trailingIcon?: string | null`, `className?: string`
- **Purpose:** List of action rows with titles, descriptions, and clickable button CTAs.

### AdvancedTable
- **Props:** `filters?: AdvancedTableFilter[]`, `filterValues?: Record<string, any>`, `onFilterChange?: (key: string, value: any) => void`, `sortableColumns?: string[]`, `sort?: AdvancedTableSort | null`, `limit?: number`, `offset?: number`, `total?: number`, `loading?: boolean`
- **Purpose:** Data table with built-in filtering, sorting, pagination, and loading overlay.

### Alert
- **Props:** `children?: React.ReactNode`, `message?: string`, `title?: string`, `icon?: React.ReactNode`, `variant?: 'primary' | 'secondary' | 'info' | 'success' | 'warning' | 'danger'`, `dismissible?: boolean`, `onClose?: () => void`, `loading?: boolean`
- **Purpose:** Alert message box with optional icon, title, dismissible state, and loading skeleton.

### AnnouncementBar
- **Props:** `message: React.ReactNode`, `ctaLabel?: string`, `ctaHref?: string`, `dismissible?: boolean`, `variant?: 'info' | 'success' | 'warning' | 'announce'`, `persistDismissKey?: string`, `icon?: React.ReactNode`, `iconName?: string`, `onDismiss?: () => void`
- **Purpose:** Persistent announcement bar with optional CTA link and localStorage-backed dismissal.

### ApiReferenceTable
- **Props:** `groups?: ApiReferenceGroup[]`, `items?: ApiItem[]`, `title?: React.ReactNode`, `className?: string`
- **Purpose:** Documentation-style table displaying API items grouped by category with name, signature, returns, and deprecation metadata.

### AssetBundle
- **Props:** `name: string`, `target: string`, `targetIcon?: string`, `category?: string`, `includedTags?: string[]`, `excludedTags?: string[]`, `defaultBuildTag?: string`, `counts?: Record<string, number>`, `latestBuildRef?: string`, `buildTag?: string`, `advanced?: AssetBundleAdvancedOptions`, `menuItems?: ActionItem[]`, `loading?: boolean`
- **Purpose:** Asset bundle card showing target engine, tags, file counts, build references, and advanced packing options.

### AssetRow
- **Props:** `icon?: ReactNode`, `name: ReactNode`, `tags?: string[]`, `size?: ReactNode`, `className?: string`
- **Purpose:** Single row displaying an asset with icon, name, optional tags, and size.

### AssetRowList
- **Props:** `children: ReactNode`, `className?: string`
- **Purpose:** Container wrapper for multiple `AssetRow` components.

### AudioMixer
- **Props:** `doc: AudioMixerDocument`, `actions: AudioMixerActions`, `selection: AudioMixerSelectionState`, `disabled?: boolean`, `loading?: boolean`, `className?: string`, `currentMs?: number`, `onSeek?: (ms: number) => void`, `id?: string`
- **Purpose:** Full audio mixer with timeline editor, track management, clip manipulation, and effect-chain inspector.

### Avatar
- **Props:** `src?: string`, `alt?: string`, `name?: string`, `size?: 'small' | 'default' | 'large'`, `status?: 'online' | 'offline' | 'busy' | 'away'`, `variant?: 'primary' | 'secondary' | 'success' | 'danger' | 'warning' | 'info'`
- **Purpose:** User avatar displaying image, initials, or placeholder with optional status indicator.

### Badge
- **Props:** `children?: React.ReactNode`, `variant?: 'primary' | 'secondary' | 'success' | 'danger' | 'warning' | 'info'`, `pill?: boolean`, `size?: 'sm' | 'md' | 'lg'`
- **Purpose:** Compact label badge with variant, pill shape, and size.

### BadgeRow
- **Props:** `badges: BadgeRowItem[]`, `size?: 'sm' | 'md'`, `className?: string`
- **Purpose:** Horizontal row of badge items with labels, values, and optional custom colors.

### Banner
- **Props:** `variant?: 'info' | 'warning' | 'success' | 'error'`, `dismissible?: boolean`, `storageKey?: string`, `icon?: string`, `action?: React.ReactNode`, `onDismiss?: () => void`, `children: React.ReactNode`, `className?: string`
- **Purpose:** Status banner with icon, content, optional action slot, and persistent dismissal.

### BasicLayout
- **Props:** `children?: React.ReactNode`, `brand?: React.ReactNode`
- **Purpose:** Two-section layout with optional brand header and main content area.

### BenchmarkChart
- **Props:** `bars: BenchmarkBar[]`, `lowerIsBetter?: boolean`, `scale?: 'linear' | 'log'`, `title?: React.ReactNode`, `className?: string`
- **Purpose:** Horizontal bar chart comparing benchmark values with leader highlighting and linear/log scale.

### BitmapFontGenerator
- **Props:** `fontFamily?: string`, `fill?: BitmapFontFill`, `border?: BitmapFontBorder`, `borders?: BitmapFontBorder[]`, `fontSize?: number`, `dropShadow?: BitmapFontDropShadow`, `glow?: BitmapFontGlow`, `glyphs?: string`, `text?: string`, `letterSpacing?: number`, `padding?: number`, `glyphsPerRow?: number`, `lineHeight?: number`, `powerOfTwo?: boolean`, `scale?: number`, `background?: string`, `exportFormat?: 'xml' | 'json' | 'fnt'`, `onGenerate?: (output: BitmapFontOutput) => void`, `disabled?: boolean`
- **Purpose:** Canvas-based bitmap font generator with fill/stroke/shadow/glow effects, preview, and multi-format export.

### Brand
- **Props:** `primaryText?: ReactNode`, `secondaryText?: ReactNode`, `label?: ReactNode`, `color?: string`, `xlarge?: boolean`, `className?: string`
- **Purpose:** Branded text display with primary/secondary text, optional badge label, and custom underline color.

### Breadcrumb
- **Props:** `items: BreadcrumbItem[]`, `separator?: React.ReactNode`, `maxItems?: number`, `className?: string`
- **Purpose:** Navigation breadcrumb trail with optional collapsing of middle items and custom separator.

### BriefCard
- **Props:** `id: string`, `icon?: React.ReactNode`, `difficulty: 'easy' | 'medium' | 'hard'`, `title: React.ReactNode`, `body: React.ReactNode`, `metaLeft?: React.ReactNode`, `metaRight?: React.ReactNode`, `onClick?: () => void`
- **Purpose:** Card displaying a task/brief with difficulty indicator, body, optional icon, and meta info.

### Build
- **Props:** `name?: string`, `date?: string`, `size?: number`, `duration?: number`, `status?: 'pass' | 'fail' | 'running' | 'queued'`, `badge?: string`, `onClick?: () => void`, `badgeVariant?: 'primary' | 'secondary' | 'success' | 'danger' | 'warning' | 'info'`, `menuItems?: ActionItem[]`, `loading?: boolean`
- **Purpose:** Build status card showing name, date, size, duration, status icon, and action menu.

### BundleBar
- **Props:** `chips?: BundleBarChip[]`, `segments?: number`, `filledSegments?: number`, `name?: ReactNode`, `meta?: ReactNode`, `className?: string`
- **Purpose:** Progress bar with optional chip labels and metadata for bundle/build visualization.

### Button
- **Props:** `children?: React.ReactNode`, `outline?: boolean`, `size?: 'small' | 'default' | 'large'`, `variant?: 'primary' | 'secondary' | 'info' | 'success' | 'warning' | 'danger' | 'link'`, `loading?: boolean`, `fullWidth?: boolean`, `startIcon?: React.ReactNode`, `endIcon?: React.ReactNode`
- **Purpose:** Versatile button with size, variant, loading state, and icon slots.

### CalloutQuote
- **Props:** `quote: React.ReactNode`, `attribution?: string`, `source?: string`, `sourceHref?: string`, `className?: string`
- **Purpose:** Blockquote with quote-mark icon, attribution, and optional source link.

### Card
- **Props:** `children?: React.ReactNode`, `header?: React.ReactNode`, `variant?: 'default' | 'primary' | 'secondary' | 'info' | 'success' | 'warning' | 'danger'`, `className?: string`, `loading?: boolean`
- **Purpose:** Container card with optional header, variant styling, and loading skeleton.

### CardOptions
- **Props:** `options: CardOption[]`, `value?: string | null`, `onChange?: (key: string) => void`, `columns?: number`, `className?: string`
- **Purpose:** Grid of selectable card options with icons/images and a check indicator on the selected one.

### Carousel
- **Props:** `children: React.ReactNode`, `autoPlay?: boolean`, `interval?: number`, `showDots?: boolean`, `showArrows?: boolean`, `loop?: boolean`, `className?: string`
- **Purpose:** Accessible carousel with keyboard/touch navigation, auto-play, and optional dots and arrows.

### CdnMap
- **Props:** `nodes: CdnMapNode[]`, `height?: number | string`, `className?: string`
- **Purpose:** Grid background with positioned CDN nodes marked as primary or accent variants.

### Changelog
- **Props:** `entries: ChangelogEntry[]`, `maxVisible?: number`, `readMoreHref: string`, `readMoreLabel?: string`, `loading?: boolean`, `className?: string`
- **Purpose:** Timeline of changelog entries with dates, titles, descriptions, tags, and loading skeleton.

## Charts

### AreaChart
- **Props:** `series: LineChartSeries[]`, `title?: string`, `subtitle?: string`, `height?: number`, `stacked?: boolean`, `showGrid?: boolean`, `showLegend?: boolean`, `xFormatter?: (v) => string`, `yFormatter?: (v) => string`, `loading?: boolean`, `className?: string`
- **Purpose:** SVG area chart with filled regions, grid lines, tooltips, and optional legend.

### BarChart
- **Props:** `data: BarChartDataItem[]`, `title?: string`, `subtitle?: string`, `orientation?: 'vertical' | 'horizontal'`, `height?: number`, `showValues?: boolean`, `yFormatter?: (v) => string`, `onClick?: (item, index) => void`, `loading?: boolean`, `className?: string`
- **Purpose:** Bar chart in vertical or horizontal orientation with tooltips and optional value labels.

### ChartContainer
- **Props:** `title?: string`, `subtitle?: string`, `children?: React.ReactNode`, `legend?: React.ReactNode`, `actions?: React.ReactNode`, `loading?: boolean`, `empty?: boolean`, `emptySlot?: React.ReactNode`, `className?: string`
- **Purpose:** Wrapper for charts with header, body, legend, and loading/empty states.

### FunnelChart
- **Props:** `data: FunnelStep[]`, `title?: string`, `subtitle?: string`, `height?: number`, `showLabels?: boolean`, `loading?: boolean`, `onClick?: (step, index) => void`, `className?: string`
- **Purpose:** Funnel chart showing conversion flows with percentage labels and interactive hover.

### GanttChart
- **Props:** `tasks: GanttTask[]`, `title?: string`, `subtitle?: string`, `startDate?: string`, `endDate?: string`, `loading?: boolean`, `onTaskClick?: (task) => void`, `className?: string`
- **Purpose:** Gantt chart with time-based task bars, progress indicators, date markers, and horizontal scrolling.

### Heatmap
- **Props:** `data: HeatmapCell[]`, `rows: (string | number)[]`, `cols: (string | number)[]`, `title?: string`, `subtitle?: string`, `colorScale?: string[]`, `cellSize?: number`, `loading?: boolean`, `className?: string`
- **Purpose:** Heatmap grid with color-interpolated cells and hover tooltips.

### LineChart
- **Props:** `series: LineChartSeries[]`, `title?: string`, `subtitle?: string`, `height?: number`, `showGrid?: boolean`, `showLegend?: boolean`, `xFormatter?: (v) => string`, `yFormatter?: (v) => string`, `loading?: boolean`, `className?: string`
- **Purpose:** SVG line chart with multiple series, grid lines, point tooltips, and optional legend.

### PieChart
- **Props:** `data: PieChartSlice[]`, `title?: string`, `subtitle?: string`, `donut?: boolean`, `centerLabel?: string`, `showLegend?: boolean`, `height?: number`, `loading?: boolean`, `className?: string`
- **Purpose:** Pie or donut chart with percentage distribution, interactive legend, and center label.

### Sparkline
- **Props:** `data: number[]`, `type?: 'line' | 'bar'`, `color?: string`, `height?: number`, `width?: number`, `className?: string`
- **Purpose:** Compact inline line or bar chart for quick trend display.

### TrendIndicator
- **Props:** `value: number | string`, `direction?: 'up' | 'down' | 'neutral'`, `size?: 'small' | 'default' | 'large'`, `className?: string`
- **Purpose:** Trend badge with directional arrow and formatted percentage/value.

## Forms & inputs

### Checkbox
- **Props:** `label?: string`, `className?: string`, `inputClassName?: string`, `inline?: boolean`, `size?: 'small' | 'default' | 'large'` + `React.InputHTMLAttributes<HTMLInputElement>`
- **Purpose:** Styled checkbox input with optional label and size variants.

### CheckboxGroup
- **Props:** `label?: string`, `options: CheckboxGroupOption[]`, `value?: string[]`, `onChange?: (checkedValues: string[]) => void`, `inline?: boolean`, `className?: string`, `name?: string`, `id?: string`, `required?: boolean`
- **Purpose:** Group of checkboxes with coordinated selection state and accessibility attributes.

### Chip
- **Props:** `children?: React.ReactNode`, `selected?: boolean`, `variant?: 'primary' | 'secondary' | 'info' | 'success' | 'warning' | 'danger'`, `icon?: string`, `onRemove?: () => void`, `count?: number | string` + `React.ButtonHTMLAttributes<HTMLButtonElement>`
- **Purpose:** Compact chip/tag with optional icon, removal button, and count badge.

### ChipGroup
- **Props:** `title?: React.ReactNode`, `subtitle?: React.ReactNode`, `items: ChipGroupItem[]`, `onToggle?: (id: string) => void`, `border?: boolean`, `className?: string`
- **Purpose:** Grouped set of interactive chip buttons with title and optional border.

### CodeLabelCell
- **Props:** `code: string`, `name: string`, `className?: string`
- **Purpose:** Code label alongside a display name, for table/list cell rendering.

### CodeSnippet
- **Props:** `code: string`, `language?: 'javascript' | 'typescript' | 'bash'`, `onCopy?: (code: string) => void`, `showCopyButton?: boolean`, `title?: string`, `loading?: boolean`, `className?: string`
- **Purpose:** Syntax-highlighted code block with language detection, copy button, and loading skeleton.

### CodeWithOutput
- **Props:** `code: string`, `language?: CodeSnippetLanguage`, `output: React.ReactNode`, `error?: React.ReactNode`, `layout?: 'split' | 'stacked'`, `title?: React.ReactNode`, `className?: string`
- **Purpose:** Code and its output displayed side-by-side or stacked, with separate panes.

### ColorPicker
- **Props:** `label?: string`, `colors: ColorOption[] | string[]`, `value?: string`, `onChange?: (color: string) => void`, `className?: string`, `columns?: number`, `loading?: boolean`
- **Purpose:** Color picker dropdown with preset swatches, hex input, and selection management.

### CommandPalette
- **Props:** `items: CommandPaletteItem[]`, `open: boolean`, `onClose: () => void`, `onSelect: (item) => void`, `placeholder?: string`, `loading?: boolean`, `className?: string`
- **Purpose:** Modal command-search interface with fuzzy filtering, grouped results, and keyboard navigation.

### CommandReference
- **Props:** `commands: CommandItem[]`, `searchable?: boolean`, `searchPlaceholder?: string`, `title?: React.ReactNode`, `className?: string`
- **Purpose:** Searchable reference guide for commands with usage, descriptions, flags, and aliases.

### CommunityLinks
- **Props:** `links: CommunityLink[]`, `title?: React.ReactNode`, `className?: string`
- **Purpose:** Grid of community platform links (GitHub, Discord, etc.) with icons, labels, and optional counts.

### Comparator
- **Props:** `title?: string`, `description?: string`, `left: ComparatorTechnology`, `right: ComparatorTechnology`, `features: ComparatorFeature[]`, `showSummary?: boolean`, `loading?: boolean`, `loadingCount?: number`, `className?: string`
- **Purpose:** Side-by-side comparison table for two technologies with auto winner detection and summary stats.

### CompatibilityMatrix
- **Props:** `versions: string[]`, `platforms: string[]`, `support: Record<string, Record<string, CompatStatus>>`, `title?: React.ReactNode`, `className?: string`
- **Purpose:** Matrix table showing compatibility status across versions and platforms with icons and legend.

### ConfigPreview
- **Props:** `entries?: ConfigPreviewEntry[]`, `liveLabel?: React.ReactNode`, `className?: string`, `children?: React.ReactNode`
- **Purpose:** JSON-like configuration preview with syntax-highlighted key-value pairs.

### ContextMenu
- **Props:** `items: ContextMenuItem[]`, `children: React.ReactElement<React.HTMLAttributes<HTMLElement>>`, `onSelect?: (key: string) => void`
- **Purpose:** Right-click/long-press context menu with nested submenu support and keyboard navigation.

### ContributorWall
- **Props:** `contributors: Contributor[]`, `maxVisible?: number`, `title?: React.ReactNode`, `className?: string`
- **Purpose:** Grid of contributor avatars with optional overflow counter and profile links.

### CookbookGrid
- **Props:** `recipes: Recipe[]`, `columns?: 2 | 3`, `title?: React.ReactNode`, `className?: string`
- **Purpose:** Multi-column grid of code-recipe cards with title, description, code snippet, and tags.

### CoolButton
- **Props:** `children?: React.ReactNode`, `label?: React.ReactNode`, `variant?: 'primary' | 'secondary' | 'success' | 'danger' | 'warning' | 'info'`, `size?: 'small' | 'default' | 'large'`, `outline?: boolean`, `loading?: boolean`, `addon?: React.ReactNode`, `addonPosition?: 'left' | 'right'`
- **Purpose:** Button with variants, sizes, loading state, and optional addon element separated by a divider.

### CoolNav
- **Props:** `brand?: React.ReactNode`, `items?: CoolNavItem[]`, `loginLabel?: string`, `loginHref?: string`, `loginVariant?: string`, `scrollOffset?: number`, `expandBreakpoint?: string`, `theme?: 'light' | 'dark'`, `sticky?: boolean`, `rightEl?: React.ReactNode`
- **Purpose:** Responsive nav bar with collapsible menu, scroll detection, and customizable login action.

### CountdownTimer
- **Props:** `target: Date | number`, `units?: CountdownUnit[]`, `label?: React.ReactNode`, `subLabel?: React.ReactNode`, `onExpire?: () => void`, `compact?: boolean`
- **Purpose:** Countdown timer in days/hours/minutes/seconds with visibility-aware updates.

### CycleWheel
- **Props:** `phases: string[]`, `currentIndex: number`, `centerLabel?: React.ReactNode`, `centerValue: React.ReactNode`, `centerPill?: React.ReactNode`, `centerSub?: React.ReactNode`, `spinSeconds?: number`, `paused?: boolean`
- **Purpose:** Animated circular wheel with rotating text ring and center content.

### DangerZoneActions
- **Props:** `actions: DangerZoneAction[]`, `onActionClick?: (key: string) => void`, `className?: string`
- **Purpose:** List of destructive actions with warning styling and danger-colored buttons.

## Dashboard cards

### ActivityCard
- **Props:** `title?: string`, `activities: ActivityItem[]`, `loading?: boolean`, `loadingCount?: number`
- **Purpose:** Dashboard card showing a timeline of activity items with icons, descriptions, and timestamps.

### BasicCard
- **Props:** `textA: string`, `textB: string`, `icon?: string`, `loading?: boolean`
- **Purpose:** Simple dashboard card with icon, primary text, and secondary text.

### ColoredCard
- **Props:** `text: string`, `value: string | number`, `icon: string`, `color: string`, `loading?: boolean`
- **Purpose:** Dashboard card with custom-colored icon background and metric display.

### DifferenceCard
- **Props:** `title: string`, `value: number`, `previousValue: number`, `period?: string`, `formatValue?: (v: number) => string`, `loading?: boolean`
- **Purpose:** Dashboard card showing a metric with percentage change vs the previous period.

### ListCard
- **Props:** `title?: string`, `items: ListItem[]`, `ordered?: boolean`, `loading?: boolean`, `loadingCount?: number`
- **Purpose:** Dashboard card rendering a list of items with optional ranking, icons, and values.

### MetricCard
- **Props:** `title: string`, `value: string | number`, `subtitle?: string`, `icon?: string`, `trend?: number[]`, `trendColor?: string`, `loading?: boolean`
- **Purpose:** Dashboard card showing a metric with optional icon and sparkline trend.

### SlicesCard
- **Props:** `title?: string`, `slices: SliceItem[]`, `size?: number`, `strokeWidth?: number`, `loading?: boolean`
- **Purpose:** Dashboard card with donut/pie chart and an item legend.

### StatusCard
- **Props:** `title?: string`, `items: StatusItem[]`, `loading?: boolean`, `loadingCount?: number`
- **Purpose:** Dashboard card showing status indicators with ok/warning/error/inactive states.

## Dashboard layout

### Content
- **Props:** `children: React.ReactNode`
- **Purpose:** Main content-area wrapper for the dashboard layout.

### Navbar
- **Props:** `isSidebarOpen?: boolean`, `minLeftWidth?: number`, `toggleSidebar?: () => void`, `leftComponent?: React.ReactNode`, `rightComponent?: React.ReactNode`
- **Purpose:** Dashboard navbar with toggle button and left/right component slots.

### Sidebar
- **Props:** `brandComponent?: React.ReactNode`, `menuComponent?: React.ReactNode`, `panelComponent?: React.ReactNode`
- **Purpose:** Dashboard sidebar with branding, menu, and panel sections.

### DashboardLayout
- **Props:** `children: React.ReactNode`, `navbarLeftComponent?: React.ReactNode`, `navbarRightComponent?: React.ReactNode`, `brandComponent?: React.ReactNode`, `sidebarMenuComponent?: React.ReactNode`, `sidebarPanelComponent?: React.ReactNode`
- **Purpose:** Full dashboard layout composing navbar, sidebar, and main content with keyboard-aware sidebar toggle.

## More inputs & forms

### DatePicker
- **Props:** `label?: string`, `value?: string`, `onChange?: (date: string) => void`, `disabled?: boolean`, `min?: string`, `max?: string`, `className?: string`
- **Purpose:** HTML5 date input wrapper with optional label and change handler.

### DiffViewer
- **Props:** `before: string`, `after: string`, `language?: string`, `mode?: 'split' | 'unified'`, `filename?: string`, `className?: string`
- **Purpose:** Side-by-side or unified diff of two text blocks with line-level add/remove highlighting.

### Divider
- **Props:** `vertical?: boolean`, `label?: string`
- **Purpose:** Horizontal or vertical separator line, optionally with a centered label.

### DownloadStats
- **Props:** `packageName: string`, `weekly?: number`, `monthly?: number`, `total?: number`, `sparkline?: number[]`, `registry?: 'npm' | 'pypi' | 'crates'`
- **Purpose:** Package download statistics with formatted numbers, periods, and optional sparkline.

### Drawer
- **Props:** `open: boolean`, `onClose: () => void`, `side?: 'left' | 'right' | 'top' | 'bottom'`, `size?: 'small' | 'default' | 'large'`, `title?: string`, `pinned?: boolean`, `children?: React.ReactNode`
- **Purpose:** Slide-out panel with focus trap, keyboard handling, and optional pinned mode (no body scroll lock).

### Dropdown
- **Props:** `items?: DropdownItem[]`, `value?: string`, `onChange?: (key: string) => void`, `placeholder?: string`, `loading?: boolean`
- **Purpose:** Searchable single-select dropdown with keyboard navigation and mouse highlighting.

### EarlySignupForm
- **Props:** `title?: string`, `subtitle?: string`, `eyebrow?: string`, `benefits: string[]`, `helperText?: string`, `ctaLabel?: string`, `placeholder?: string`, `successTitle?: string`, `successMessage?: string`, `variant?: 'dark' | 'light'`, `onSubmit?: (email, event) => void`, `loading?: boolean`
- **Purpose:** Email signup form with benefits list, validation, and confirmation success state.

### EcosystemMap
- **Props:** `core: { name: string; label?: string }`, `rings: EcosystemRing[]`, `size?: number`, `title?: React.ReactNode`
- **Purpose:** Concentric ring diagram showing ecosystem relationships, with a list fallback.

### EditableText
- **Props:** `defaultValue?: string`, `disabled?: boolean`, `placeholder?: string`, `onChange?: (e: FocusEvent<HTMLInputElement>) => void`
- **Purpose:** Inline text input that commits on blur or Enter, reverts on Escape.

### EmptyState
- **Props:** `icon?: string`, `children?: React.ReactNode`
- **Purpose:** Placeholder showing an optional icon and content when data is unavailable.

### EntityCell
- **Props:** `name: string`, `subLabel?: string`, `initial: string`, `color: EntityCellColor`, `size?: 'sm' | 'md' | 'lg'`, `onClick?: () => void`
- **Purpose:** Card showing an entity with an initials tile, name, optional sublabel, and click handler.

### EntityProfileCard
- **Props:** `lead?: React.ReactNode`, `title: React.ReactNode`, `subtitle?: React.ReactNode`, `chips?: React.ReactNode`, `meta: MetaItem[]`, `loading?: boolean`
- **Purpose:** Profile card with a hero section (lead, title, chips) and a meta-information grid; optional loading skeleton.

### ExtendedSelect
- **Props:** `items?: ExtendedSelectItem[]`, `value?: string`, `onChange?: (key: string) => void`, `name?: string`, `placeholder?: string`, `searchPlaceholder?: string`, `noResultsText?: string`, `loading?: boolean`
- **Purpose:** Searchable dropdown with debounced search, keyboard navigation, descriptions/labels, and form-submission support.

### FAQList
- **Props:** `items: FAQItem[]`, `defaultOpen?: number[]`, `schema?: boolean`, `title?: React.ReactNode`
- **Purpose:** Collapsible FAQ section with optional JSON-LD schema generation for SEO.

### FeatureCard
- **Props:** `icon?: ReactNode`, `eyebrow?: ReactNode`, `title: ReactNode`, `description?: ReactNode`, `visual?: ReactNode`, `size?: 'default' | 'wide' | 'full'`, `inline?: boolean`
- **Purpose:** Card highlighting a feature with optional icon, eyebrow, title, description, and visual area in variable sizes.

### FeatureMatrix
- **Props:** `columns: MatrixColumn[]`, `rows: MatrixRow[]`, `title?: React.ReactNode`
- **Purpose:** Comparison table of features vs columns supporting boolean, partial, and custom values with highlight styling.

### File
- **Props:** `readonly?: boolean`, `format?: string`, `extension?: string`, `name?: string`, `items?: number`, `size?: number`, `tagIds?: string[]`, `tags?: FileTag[]`, `menuItems?: ActionItem[]`, `onNameChange?: (name: string) => void`, `onTagsChange?: (tagIds: string[]) => void`, `onMenuItemClick?: (key: string) => void`, `loading?: boolean`
- **Purpose:** File entry with editable name, format badge, size, nested item count, tags, and action menu.

### FileDropzone
- **Props:** `className?: string`, `onFiles?: (files: File[]) => void`, `supported?: DropzoneFileFormat[]`
- **Purpose:** Drag-and-drop zone with supported-format display and a file callback.

### FileTags
- **Props:** `readonly?: boolean`, `tags: FileTag[]`, `selectedIds?: string[]`, `onChange?: (selectedIds: string[]) => void`
- **Purpose:** Tag picker showing selected tags with add/remove buttons and a searchable add menu.

### Form
- **Props:** `children: React.ReactNode`, `header?: React.ReactNode`, `variant?: 'default' | 'primary' | 'secondary' | 'info' | 'success' | 'warning' | 'danger'`, `onSubmit?: (data, event) => void`, `wrapper?: boolean`
- **Purpose:** Form wrapper with optional Card wrapper, supporting native submit or JS handlers with automatic FormData parsing.

### FormInput
- **Props:** `type: FormInputType`, `label?: string`, `help?: string`, `helper?: string`, `error?: string`, `validate?: FormInputValidator | FormInputValidator[]`, `onErrorMessage?: (result) => string`, `name?: string`, `id?: string`, `placeholder?: string`, `disabled?: boolean`, `required?: boolean`, `value?: unknown`, `defaultValue?: unknown`, `onChange?: (value, hasError) => void`, `loading?: boolean`
- **Purpose:** Universal form input supporting 18 input types (text, dropdown, checkbox, date, color, etc.) with built-in validation.

### FormWizard
- **Props:** `steps: FormWizardStep[]`, `onComplete?: () => void`, `completeLabel?: React.ReactNode`, `completeIcon?: string`, `className?: string`, `loading?: boolean`
- **Purpose:** Multi-step form wizard with tab navigation, back/next buttons, and completion handling.

### GameShowcaseCard
- **Props:** `art?: React.ReactNode`, `artPlaceholder?: React.ReactNode`, `stamps?: GameStamp[]`, `metaLeft?: React.ReactNode`, `metaRight?: React.ReactNode`, `title: React.ReactNode`, `pitch: React.ReactNode`, `tags?: string[]`, `compliance?: ComplianceState[]`, `onClick?: () => void`
- **Purpose:** Game showcase card with artwork, title, pitch, tags, compliance indicators, and stamps.

### GithubStarsCard
- **Props:** `owner: string`, `repo: string`, `stats?: GithubStatsData`, `fetchLive?: boolean`, `ctaLabel?: string`
- **Purpose:** GitHub repo card showing stars, forks, contributors, version, and CTA with optional live API fetch.

### GoodFirstIssues
- **Props:** `issues: GoodFirstIssue[]`, `emptyState?: React.ReactNode`, `title?: React.ReactNode`
- **Purpose:** List of good-first-issue items with title, labels, comment count, update time, and repo link.

### Group
- **Props:** `label: string`, `badge?: string`, `defaultCollapsed?: boolean`, `children?: React.ReactNode`, `onActionClick?: () => void`, `actionLabel?: string`, `actionIcon?: string`
- **Purpose:** Collapsible group container with header label, optional badge, and action button.

### Heading
- **Props:** `children?: React.ReactNode`, `as?: 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6'`, `gradient?: boolean`
- **Purpose:** Heading supporting h1–h6 with optional gradient styling.

### HelperText
- **Props:** `children?: React.ReactNode`, `text?: string`, `variant?: 'default' | 'success' | 'warning' | 'error'`, `icon?: string`, `className?: string`, `id?: string`
- **Purpose:** Contextual helper text with variant-specific icons and styling.

### Hero
- **Props:** `eyebrow?: string`, `title: string`, `titleAs?: ElementType`, `description: string`, `primaryAction: HeroAction`, `secondaryAction?: HeroAction`, `statCards?: HeroStatCard[]`, `metrics?: HeroMetric[]`, `backgroundPatternSrc?: string`, `bgIcons?: string[]`
- **Purpose:** Large hero section with title, description, actions, and optional background patterns/icons.

### HeroStatsBar
- **Props:** `stats: HeroStat[]`, `className?: string`, `style?: CSSProperties`
- **Purpose:** Horizontal bar of key-value statistics with optional units and zero-state styling.

### Icon
- **Props:** `name: string`, `set?: 'bi' | 'tc'`, `as?: ElementType`, `size?: number | string`, `color?: string`, `label?: string`, `decorative?: boolean`
- **Purpose:** Icon component supporting Bootstrap Icons (`bi`) and ToolCase (`tc`) sets with accessibility options.

### IconButton
- **Props:** `icon: string`, `size?: 'small' | 'default' | 'large'`, `variant?: 'primary' | 'secondary' | 'info' | 'success' | 'warning' | 'danger'`, `outline?: boolean`, `label?: string`
- **Purpose:** Icon-only button with size and variant options and forwarded ref.

### IconPicker
- **Props:** `label?: string`, `icons: IconOption[]`, `value?: string`, `onChange?: (value: string) => void`, `columns?: number`, `loading?: boolean`
- **Purpose:** Searchable dropdown for selecting from a grid of icons.

### Image
- **Props:** `fallback?: React.ReactNode`, `aspectRatio?: string`, `objectFit?: 'cover' | 'contain' | 'fill' | 'none'`, `alt?: string`, `onError?: (e) => void`, `onLoad?: (e) => void`
- **Purpose:** Image wrapper with loading state, error fallback, and aspect-ratio/object-fit support.

### ImageCrop
- **Props:** `src: string`, `aspectRatio?: number`, `circular?: boolean`, `onCrop: (blob: Blob) => void`, `onError?: (error: Error) => void`
- **Purpose:** Canvas-based image cropper with drag-to-pan, scroll-to-zoom, and circular mask.

### InfiniteScroll
- **Props:** `onLoadMore: () => void`, `hasMore: boolean`, `loading?: boolean`, `loadingSlot?: React.ReactNode`, `endSlot?: React.ReactNode`, `threshold?: number`, `rootMargin?: string`
- **Purpose:** Intersection Observer wrapper that detects when to load more items.

### Input
- **Props:** `label?: string`, `className?: string`, `inputClassName?: string`, `error?: string`
- **Purpose:** Accessible text input with optional label, error display, and Bootstrap styling.

### InstallTabs
- **Props:** `package: string`, `dev?: boolean`, `global?: boolean`, `managers?: InstallManager[]`, `defaultManager?: InstallManager`
- **Purpose:** Tabbed install commands for npm/yarn/pnpm/bun with a copy button.

### JSONEditor
- **Props:** `schema: string`, `value?: Record<string, unknown>`, `defaultValue?: Record<string, unknown>`, `onChange?: (value) => void`, `disabled?: boolean`, `loading?: boolean`
- **Purpose:** Form-like editor for JSON objects with collapsible groups, array management, and schema-driven fields.

### JSONSchemaDef
- **Props:** `label?: string`, `value?: string`, `defaultValue?: string`, `refList?: SchemaRefItem[]`, `arrayRefList?: SchemaRefItem[]`, `objectRefList?: SchemaRefItem[]`, `onChange?: (value) => void`, `onLabelChange?: (label) => void`, `disabled?: boolean`, `loading?: boolean`
- **Purpose:** Visual editor for defining JSON schema properties with type selection, reordering, and duplicate validation.

### Kbd
- **Props:** `children?: React.ReactNode`, `keys?: string[]`, `className?: string`
- **Purpose:** Renders keyboard key(s) in `kbd` elements with an optional separator for combinations.

### Label
- **Props:** `children?: React.ReactNode`, `required?: boolean`, `tooltip?: string`, `size?: 'small' | 'default' | 'large'`
- **Purpose:** Semantic label with optional required indicator and info-icon tooltip.

### Leaderboard
- **Props:** `entries: LeaderboardEntry[]`, `columns?: { rank?, dev?, tier?, sprints?, trend?, points? }`
- **Purpose:** Table-based leaderboard with avatar, tier, sprints, trend, and points columns.

### LeaderboardTrend
- **Props:** `value: React.ReactNode`, `direction: 'up' | 'down' | 'flat'`, `className?: string`
- **Purpose:** Small directional trend indicator with arrow and value.

### Lightbox
- **Props:** `images: LightboxImage[]`, `open: boolean`, `initialIndex?: number`, `onClose: () => void`
- **Purpose:** Modal image gallery with keyboard/swipe navigation, thumbnails, and focus management.

### Link
- **Props:** `children?: React.ReactNode`, `variant?: 'primary' | 'secondary' | 'info' | 'success' | 'warning' | 'danger'`, `underline?: 'always' | 'hover' | 'none'`, `external?: boolean`
- **Purpose:** Semantic link with variant colors, underline options, and optional external icon.

### LinkedProvidersCard
- **Props:** `providers: LinkedProvider[]`, `title?: string`, `brandColors?: Record<string, string>`, `iconForProvider?: (key: string) => string`, `emptyLabel?: string`
- **Purpose:** Section card listing OAuth providers with custom icons and brand colors.

### LiveFeed
- **Props:** `events: FeedEvent[]`, `header?: string`, `recording?: boolean`, `maxRows?: number`, `autoScroll?: boolean`
- **Purpose:** Vertical feed of timestamped events with optional REC indicator and auto-scroll.

### Login
- **Props:** `logo?: React.ReactNode`, `title?: string`, `description?: string`, `backgroundPatternSrc?: string`, `backgroundPattern?: React.ReactNode`, `connect: LoginConnectOption[]`, `onConnect?: (e, key) => void`, `loading?: boolean`
- **Purpose:** Two-column login layout with a background pattern and a form of title plus OAuth buttons.

### LogoCloud
- **Props:** `title?: React.ReactNode`, `logos: LogoCloudLogo[]`, `grayscale?: boolean`, `columns?: number`
- **Purpose:** Grid of logos with optional title, grayscale filter, and optional links.

### MaintainerCard
- **Props:** `name: string`, `avatarUrl: string`, `role?: string`, `bio?: string`, `links?: MaintainerLink[]`, `sponsorHref?: string`, `sponsorLabel?: string`, `location?: string`
- **Purpose:** Profile card of a maintainer with avatar, social links, and sponsor button.

### MarkdownEditor
- **Props:** `value?: string`, `onChange?: (value: string) => void`, `placeholder?: string`, `height?: number | string`, `toolbar?: boolean`, `label?: string`, `disabled?: boolean`
- **Purpose:** Split-pane markdown editor with write/preview tabs and a formatting toolbar.

### Marquee
- **Props:** `items: React.ReactNode[]`, `separator?: React.ReactNode`, `speed?: number`, `direction?: 'left' | 'right'`, `pauseOnHover?: boolean`
- **Purpose:** Horizontally scrolling banner of items with customizable speed, direction, and hover behavior.

### MetricTile
- **Props:** `label: string`, `value: React.ReactNode`, `unit?: string`, `icon?: string`, `hint?: React.ReactNode`, `className?: string`
- **Purpose:** Compact card showing a single metric with label, value, optional unit and hint.

### MetricGrid
- **Props:** `items?: (MetricTileProps & { key?: string })[]`, `columns?: 2 | 3 | 4`, `className?: string`, `children?: React.ReactNode`
- **Purpose:** Grid container for `MetricTile` components with configurable column count.

### MigrationGuide
- **Props:** `from: string`, `to: string`, `steps: MigrationStep[]`, `title?: React.ReactNode`
- **Purpose:** Step-by-step migration guide with version headers and before/after code diffs.

### MultiCardSelect
- **Props:** `options: MultiCardSelectOption[]`, `value?: string[]`, `onChange?: (selected: string[]) => void`, `name?: string`, `columns?: number`, `loading?: boolean`, `loadingCount?: number`
- **Purpose:** Multi-select with card-style checkboxes and hidden form inputs for submission.

### NewsletterSignup
- **Props:** `onSubmit: (email: string) => Promise<void> | void`, `placeholder?: string`, `ctaLabel?: string`, `successMessage?: string`, `privacyHref?: string`, `title?: ReactNode`, `description?: ReactNode`
- **Purpose:** Email subscription form with status management and optional privacy-policy link.

### NodeEditor
- **Props:** `graph: GraphData`, `positions: Record<string, Pos>`, `selectedId?: string | null`, `disabled?: boolean`, `onSelect?: (id) => void`, `onMoveNode?: (id, pos) => void`, `onConnect?: (from, to) => void`, `className?: string`
- **Purpose:** Canvas-based visual node/graph editor with drag, pan, zoom, and connection creation.

### NormalMapGenerator
- **Props:** `source?: string | File | Blob`, `strength?: number`, `embossHeight?: number`, `bevelWidth?: number`, `editable?: boolean`, `tool?: EditorTool`, `previewMode?: 'normal' | 'albedo' | 'lit' | 'lit-surface'`, `disabled?: boolean`
- **Purpose:** Interactive normal-map generator with brush painting, lighting preview, and mask selection tools.

### NumberInput
- **Props:** `value?: number | ''`, `onChange?: (value: number | '') => void`, `step?: number`, `min?: number`, `max?: number`, `precision?: number`, `label?: string`, `error?: string`
- **Purpose:** Controlled numeric input with increment/decrement buttons, arrow-key support, and optional prefix/suffix.

### OTPInput
- **Props:** `length?: number`, `value?: string`, `onChange?: (value: string) => void`, `name?: string`, `mode?: 'numeric' | 'alphanumeric'`, `masked?: boolean`, `label?: string`, `error?: string`
- **Purpose:** One-time-password input with per-digit cells, paste support, and keyboard navigation.

### PageFooter
- **Props:** `brand?: ReactNode`, `tagline?: string`, `description?: string`, `menus?: PageFooterMenu[]`, `socialLinks?: PageFooterSocialLink[]`, `legalLinks?: PageFooterLink[]`, `legalText?: string`, `cta?: PageFooterCta`
- **Purpose:** Footer with brand, navigation menus, social links, and optional call-to-action.

### Pagination
- **Props:** `limit: number`, `offset: number`, `total: number`, `siblingCount?: number`, `onChange?: (offset: number) => void`
- **Purpose:** Pagination control with page summary, prev/next buttons, and configurable sibling pages.

### PhaseGrid
- **Props:** `phases: PhaseItem[]`, `columns?: number`
- **Purpose:** Grid of phase/timeline items with status indicators and optional tags/commands.

### PhoneInput
- **Props:** `value?: string`, `onChange?: (value: string) => void`, `name?: string`, `defaultCountry?: string`, `label?: string`, `placeholder?: string`, `error?: string`
- **Purpose:** International phone input with country selector dropdown and dial-code formatting.

### PhysicsEditor
- **Props:** `source?: string | File | Blob`, `shapes?: PhysicsShape[]`, `onChange?: (shapes) => void`, `tool?: 'select' | 'polygon' | 'circle' | 'box'`, `alphaThreshold?: number`, `disabled?: boolean`, `className?: string`
- **Purpose:** Physics shape editor for polygons/circles/boxes over an image background with undo/redo.

### PinnedFeatureShowcase
- **Props:** `title: string`, `description: string`, `items: PinnedFeatureShowcaseItem[]`, `eyebrow?: string`, `media?: ReactNode`, `imageSrc?: string`, `imageAlt?: string`, `ctas?: ReactNode`
- **Purpose:** Two-column showcase with a sticky/centered left panel and a right-side item list.

### Pipeline
- **Props:** `steps: PipelineStep[]`
- **Purpose:** Horizontal pipeline/steps visualization with numbered items, titles, and state (default/live/complete).

### PluginGrid
- **Props:** `items: PluginItem[]`, `columns?: 2 | 3 | 4`, `title?: ReactNode`
- **Purpose:** Grid of plugin cards with logo, description, install command, and download count.

### Popover
- **Props:** `children: ReactElement`, `content: ReactNode`, `placement?: PopoverPlacement`, `trigger?: 'click' | 'hover'`, `open?: boolean`, `onOpenChange?: (open: boolean) => void`
- **Purpose:** Portal-based popover with smart positioning, click/hover triggers, and Escape-to-close.

### PricingCard
- **Props:** `name: string`, `price: ReactNode`, `period: ReactNode`, `description: ReactNode`, `features: Array<string | PricingCardFeature>`, `highlight?: boolean`, `action: PricingCardAction`, `badgeText?: ReactNode`
- **Purpose:** Pricing tier card with feature list, action button, and optional highlight/badge.

### ProgressBar
- **Props:** `value: number`, `label?: string`, `variant?: 'primary' | 'secondary' | 'success' | 'danger' | 'warning' | 'info'`, `height?: number | string`, `indeterminate?: boolean`
- **Purpose:** Progress bar with optional label, variant styling, and indeterminate mode.

### PulseIndicator
- **Props:** `label: ReactNode`, `color?: string`, `paused?: boolean`
- **Purpose:** Animated pulsing status dot with label and optional custom color.

### QueuedFile
- **Props:** `name?: string`, `extension?: string`, `format?: string`, `size?: number`, `onDismiss?: () => void`
- **Purpose:** File-queue item with name, size, format badge, and dismiss button.

### QuickStart
- **Props:** `steps: QuickStartStep[]`, `title?: ReactNode`
- **Purpose:** Numbered step-by-step guide with optional code snippets and output sections.

### Radio
- **Props:** `label?: string`, `className?: string`, `inputClassName?: string`, `inline?: boolean`, `size?: 'small' | 'default' | 'large'`
- **Purpose:** Single radio button with optional label, sizing, and inline layout.

### RadioGroup
- **Props:** `label?: string`, `options: RadioGroupOption[]`, `value?: string`, `onChange?: (selectedValue: string) => void`, `inline?: boolean`, `name?: string`
- **Purpose:** Group of radio buttons with options, value tracking, and ARIA attributes.

### RangeSlider
- **Props:** `value?: [number, number]`, `onChange?: (value: [number, number]) => void`, `min?: number`, `max?: number`, `step?: number`, `ticks?: boolean`, `showTooltip?: boolean`, `label?: string`
- **Purpose:** Dual-handle range slider with optional ticks, tooltips, and keyboard navigation.

### RankCell
- **Props:** `rank: number`, `pad?: number`
- **Purpose:** Rank display cell with tier styling (top 1/2/3 vs rest) and zero-padded number.

### Rating
- **Props:** `value?: number`, `onChange?: (value: number) => void`, `count?: number`, `allowHalf?: boolean`, `readOnly?: boolean`, `size?: 'small' | 'default' | 'large'`, `icon?: string`
- **Purpose:** Interactive star rating with optional half-stars, keyboard navigation, and read-only mode.

### ResizablePanel
- **Props:** `children: [ReactNode, ReactNode]`, `direction?: 'horizontal' | 'vertical'`, `defaultSizes?: [number, number]`, `minSize?: number`, `storageKey?: string`
- **Purpose:** Two-pane layout with a draggable divider, localStorage persistence, and keyboard resizing.

### RichPageHeader
- **Props:** `icon?: { name: string; color?: RichPageHeaderIconColor }`, `chips?: ReactNode`, `title: ReactNode`, `sub?: ReactNode`, `description?: ReactNode`, `actions?: ReactNode`
- **Purpose:** Page header with icon, title, subtitle, description, chips, and action buttons.

### Roadmap
- **Props:** `columns: RoadmapColumn[]`, `layout?: 'kanban' | 'stacked'`, `title?: ReactNode`
- **Purpose:** Kanban/stacked roadmap with status columns (shipped/in-progress/planned/considering) and item counts.

### ScoringRules
- **Props:** `rules: ScoringRule[]`, `className?: string`
- **Purpose:** List of scoring rules with icons, titles, descriptions, point values, and optional accent colors.

### ScrollArea
- **Props:** `maxHeight?: string | number`, `maxWidth?: string | number`, `axis?: 'x' | 'y' | 'both'`, `children: React.ReactNode`, `className?: string`
- **Purpose:** Scrollable container with configurable max dimensions and scroll axis.

### SectionCard
- **Props:** `title: string`, `icon?: string`, `action?: React.ReactNode`, `variant?: 'default' | 'danger'`, `className?: string`, `children?: React.ReactNode`
- **Purpose:** Card wrapper with a header containing an optional icon, title, and action element.

### SectionFlag
- **Props:** `title: React.ReactNode`, `subtitle?: React.ReactNode`, `align?: 'left' | 'center'`, `className?: string`
- **Purpose:** Section header flag with a title and optional subtitle.

### Select
- **Props:** `label?: string`, `options: SelectOption[]`, `className?: string`, `selectClassName?: string`, `error?: string`, `size?: SelectSize`
- **Purpose:** Styled HTML `select` with optional label, error message, and size variants.

### SideNav
- **Props:** `sections?: SideNavSection[]`, `onItemClick?: (event, item) => void`, `loading?: boolean`, `loadingCount?: number`, `className?: string`
- **Purpose:** Vertical navigation menu with sections, items, badges, and loading state.

### SimpleFile
- **Props:** `name: string`, `extension: string`, `format?: 'unknown' | 'image' | 'audio' | 'binary'`
- **Purpose:** Simple file icon with filename and extension type.

### SingleCardSelect
- **Props:** `options: SingleCardSelectOption[]`, `value?: string | null`, `onChange?: (selected: string) => void`, `name?: string`, `columns?: number`, `className?: string`, `loading?: boolean`, `loadingCount?: number`
- **Purpose:** Clickable card options for single selection with optional grid layout.

### Skeleton
- **Props:** `variant?: 'text' | 'circle' | 'rect'`, `width?: string | number`, `height?: string | number`, `count?: number`, `className?: string`
- **Purpose:** Loading-state placeholder with customizable shape and dimensions.

### Slider
- **Props:** `value?: number`, `onChange?: (value: number) => void`, `min?: number`, `max?: number`, `step?: number`, `ticks?: boolean`, `showTooltip?: boolean`, `formatValue?: (value: number) => string`, `label?: string`, `error?: string`, `disabled?: boolean`, `className?: string`
- **Purpose:** Single-handle range slider with keyboard support, optional ticks, tooltip, and error handling.

### SocialLinks
- **Props:** `links: SocialLink[]`, `size?: 'sm' | 'md' | 'lg'`, `variant?: 'ghost' | 'filled'`, `className?: string`
- **Purpose:** Row of social-media icon links with size and style variants.

### Spacer
- **Props:** `size?: string | number`, `axis?: 'horizontal' | 'vertical'`, `className?: string`
- **Purpose:** Flexible spacing element that fills available space or provides fixed dimensions.

### Spinner
- **Props:** `size?: 'small' | 'default' | 'large'`, `label?: string`, `variant?: 'primary' | 'secondary' | 'info' | 'success' | 'warning' | 'danger'`, `shape?: SpinnerShape`, `className?: string`
- **Purpose:** Loading indicator with multiple shape styles, sizes, and color variants.

### SponsorWall
- **Props:** `tiers: SponsorTier[]`, `title?: React.ReactNode`, `className?: string`
- **Purpose:** Sponsor logos organized by tier with optional title and links.

### SprintChain
- **Props:** `items: SprintChainItem[]`, `currentId: string`, `columns?: number`, `header?: React.ReactNode`, `headerEnd?: React.ReactNode`, `className?: string`
- **Purpose:** Timeline/chain visualization of sprint items with past/current/future states.

### Stamp
- **Props:** `label: React.ReactNode`, `color?: StampColor`, `position?: StampPosition`, `className?: string`
- **Purpose:** Decorative stamp badge with color and corner-position options.

### StatCard
- **Props:** `icon?: string`, `label: string`, `value: React.ReactNode`, `unit?: string`, `delta?: string`, `deltaKind?: 'up' | 'down' | 'neutral'`, `helper?: React.ReactNode`, `footer?: React.ReactNode`, `loading?: boolean`, `className?: string`
- **Purpose:** Statistic card with label, value, optional icon, delta, and footer text.

### StateMachine
- **Props:** `states: StateMachineItem[]`, `compact?: boolean`, `className?: string`
- **Purpose:** State-progression display with status tracking per state.

### StatusDot
- **Props:** `status?: 'online' | 'offline' | 'busy' | 'away'`, `size?: 'small' | 'default' | 'large'`, `label?: string`, `pulse?: boolean`, `className?: string`
- **Purpose:** Status indicator dot with optional label and pulse animation.

### Stepper
- **Props:** `steps: StepItem[]`, `activeStep?: string`, `orientation?: 'horizontal' | 'vertical'`, `clickable?: boolean`, `onStepClick?: (key: string) => void`, `className?: string`
- **Purpose:** Multi-step progress indicator with completion icons and optional clickable navigation.

### Switch
- **Props:** `label?: string`, `size?: 'small' | 'default' | 'large'`, `className?: string`, `id?: string`, `disabled?: boolean`
- **Purpose:** Toggle switch input with optional label and size variants.

### TabSections
- **Props:** `items: TabSectionItem[]`, `defaultActiveKey?: string`, `activeKey?: string`, `onChange?: (key: string) => void`, `className?: string`, `loading?: boolean`
- **Purpose:** Tabbed interface with switchable content sections and loading state.

### Table
- **Props:** `columns: TableColumn<T>[]`, `data: T[]`, `rowKey: (row, index) => string | number`, `emptyMessage?: ReactNode`, `striped?: boolean`, `hoverable?: boolean`, `compact?: boolean`, `borderless?: boolean`, `stickyHeader?: boolean`, `onRowClick?: (row, index) => void`, `loading?: boolean`, `loadingRows?: number`, `className?: string`
- **Purpose:** Flexible table with sortable columns, loading states, and optional row-click handlers.

### Tag
- **Props:** `children?: React.ReactNode`, `variant?: 'primary' | 'secondary' | 'info' | 'success' | 'warning' | 'danger'`, `removable?: boolean`, `onRemove?: () => void`, `className?: string`
- **Purpose:** Badge-like tag with optional remove button and color variants.

### TagInput
- **Props:** `label?: string`, `recommendations?: string[]`, `value?: string[]`, `defaultValue?: string[]`, `onChange?: (tags: string[]) => void`, `placeholder?: string`, `disabled?: boolean`, `className?: string`, `allowCreate?: boolean`, `maxTags?: number`, `loading?: boolean`
- **Purpose:** Tag input with autocomplete recommendations and create functionality.

### TeamList
- **Props:** `members: TeamMember[]`, `className?: string`
- **Purpose:** List of team members with initials, email, role, and optional gradient avatars.

### TerminalWindow
- **Props:** `title?: string`, `prompt?: string`, `lines: TerminalLine[]`, `animateTyping?: boolean`, `speed?: number`, `className?: string`
- **Purpose:** Styled terminal/console window with optional typing animation.

### TestimonialCarousel
- **Props:** `items: Testimonial[]`, `autoplay?: boolean`, `interval?: number`, `className?: string`
- **Purpose:** Carousel of testimonials with navigation controls and autoplay.

### Text
- **Props:** `children?: React.ReactNode`, `variant?: 'default' | 'muted' | 'code' | 'mono' | 'truncate'`, `size?: 'small' | 'default' | 'large'`, `as?: 'p' | 'span' | 'small' | 'div'`, `className?: string`
- **Purpose:** Flexible text component with semantic HTML tags and style variants.

### Textarea
- **Props:** `label?: string`, `className?: string`, `textareaClassName?: string`, `error?: string`, `id?: string`, `disabled?: boolean`
- **Purpose:** Styled textarea with optional label and error message.

### TierLadder
- **Props:** `title?: React.ReactNode`, `tiers: TierItem[]`, `currentTierId?: string`, `summary?: React.ReactNode`, `className?: string`
- **Purpose:** Ranked tier ladder with color coding and a current-tier indicator.

### TimePicker
- **Props:** `value?: string`, `onChange?: (value: string) => void`, `format?: '12h' | '24h'`, `minuteStep?: number`, `showSeconds?: boolean`, `label?: string`, `placeholder?: string`, `error?: string`, `disabled?: boolean`, `clearable?: boolean`, `className?: string`
- **Purpose:** Time picker with scrollable column interface supporting 12/24-hour formats.

### Timeline
- **Props:** `items: TimelineItem[]`, `overlap?: number`, `loading?: boolean`, `loadingCount?: number`, `variant?: TimelineVariant`, `connector?: TimelineConnector`, `className?: string`
- **Purpose:** Vertical timeline of chronological events with various visual styles.

### toast
- **Props:** Imperative API — `toast(message, options?)`, `toast.success()`, `toast.error()`, `toast.warning()`, `toast.info()`, `toast.dismiss(id)`, `toast.dismissAll()`
- **Purpose:** Singleton toast-notification system with an imperative API for temporary alerts.

### ToastProvider
- **Props:** `defaultDuration?: number`, `defaultPosition?: ToastPosition`, `maxToasts?: number`, `children?: React.ReactNode`
- **Purpose:** Provider that enables the toast-notification system app-wide.

### ToggleCard
- **Props:** `checked?: boolean`, `onChange?: (checked: boolean) => void`, `name?: string`, `value?: string`, `label: string`, `hint?: string`, `icon?: string`, `badge?: React.ReactNode`, `disabled?: boolean`, `className?: string`, `loading?: boolean`
- **Purpose:** Clickable card with an integrated toggle switch for on/off states.

### Tooltip
- **Props:** `children: React.ReactElement`, `content: React.ReactNode`, `position?: 'top' | 'bottom' | 'left' | 'right'`, `className?: string`
- **Purpose:** Hover-activated tooltip that auto-flips position to avoid viewport overflow.

### TreeView
- **Props:** `nodes: TreeNode[]`, `selected?: string[]`, `onSelect?: (keys: string[]) => void`, `expanded?: string[]`, `onExpandChange?: (keys: string[]) => void`, `checkboxMode?: boolean`, `className?: string`
- **Purpose:** Hierarchical tree navigation with expand/collapse and optional multi-select.

### UsageSummaryPanel
- **Props:** `usage: Array<UsageConfig>`, `title?: string`, `loading?: boolean`, `loadingCount?: number`, `className?: string`
- **Purpose:** Usage-metrics panel with progress bars for resource consumption.

### UserPanel
- **Props:** `avatarSrc?: string`, `username: string`, `initials?: string`, `plan?: string`, `onIconClick?: (e) => void`, `icon?: string`, `iconHighlighted?: boolean`, `menuItems?: UserPanelMenuItem[]`, `onMenuClick?: (e, key) => void`, `loading?: boolean`, `className?: string`
- **Purpose:** User profile panel with avatar, name, plan, settings icon, and dropdown menu.

### VersionPicker
- **Props:** `versions: VersionOption[]`, `value: string`, `onChange: (value: string) => void`, `name?: string`, `variant?: 'segmented' | 'dropdown'`, `className?: string`
- **Purpose:** Version selector as segmented buttons or a dropdown.

### VerticalItemList
- **Props:** `items: VerticalItemListItem[]`, `activeKey?: string`, `defaultActiveKey?: string`, `onSelect?: (key: string) => void`, `children?: React.ReactNode`, `disabled?: boolean`, `className?: string`, `loading?: boolean`, `loadingCount?: number`
- **Purpose:** Vertical navigation menu with items, icons, badges, and an associated content area.

### VideoEmbed
- **Props:** `src: string`, `poster?: string`, `aspectRatio?: number`, `autoplay?: boolean`, `loop?: boolean`, `muted?: boolean`, `controls?: boolean`, `title?: string`, `className?: string`
- **Purpose:** Embedded video player supporting YouTube, Vimeo, Loom, and native video sources.

### VirtualList
- **Props:** `items: T[]`, `itemHeight: number | ((index: number) => number)`, `renderItem: (item, index) => React.ReactNode`, `height: number`, `overscan?: number`, `onEndReached?: () => void`, `endReachedThreshold?: number`, `className?: string`
- **Purpose:** Virtualized list for efficiently rendering large datasets with lazy loading.

### VisuallyHidden
- **Props:** `children: React.ReactNode`, `as?: 'span' | 'div'`, `className?: string`
- **Purpose:** Hides content visually while keeping it accessible to screen readers.

### WelcomeGuide
- **Props:** `title: string`, `messages: string[]`, `steps: WelcomeGuideStep[]`, `onStepClick?: (e, stepKey: string) => void`, `backgroundPatternSrc?: string`, `backgroundPatternAlt?: string`, `backgroundPattern?: React.ReactNode`, `className?: string`, `loading?: boolean`
- **Purpose:** Onboarding guide with progress tracking and sequential step completion.

## Modal (`Modal.*`)

### Modal.Window
- **Props:** `children: React.ReactNode`, `size: 'small' | 'medium' | 'large' | 'xlarge' | 'full'`, `className?: string`, `title?: string`
- **Purpose:** Modal dialog window with configurable size and semantic accessibility attributes.

### Modal.ModalContext
- **Props:** `children: ReactNode`
- **Purpose:** Provider component (plus `useModalControl` hook) for managing modal state app-wide.

### Modal.ModalRender
- **Props:** `children: ReactNode`, `className?: string`
- **Purpose:** Renders the active modal with backdrop, focus management, and keyboard handling (Escape, Tab trapping).
