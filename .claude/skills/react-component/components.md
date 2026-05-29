# Existing `@toolcase/react-components` API

Reference inventory for every component currently exported from `react-components/src/index.ts`. Use to pick the right primitive before scaffolding a new one. **Reuse before reinvent.**

Source of truth: `react-components/src/index.ts` exports + `examples/public/react-components/SKILL.md`. If something here is missing from those, treat this doc as stale and refresh as part of your task.

> Detailed prop tables live in `examples/public/react-components/SKILL.md` (≈3700 lines). This file is a category index + decision map.

---

## Inputs & Forms

| Component | Purpose | Use when | Skip when |
|---|---|---|---|
| `Checkbox` | Single boolean input | one boolean toggle inline with a label | grouping (use `CheckboxGroup`) |
| `CheckboxGroup` | Multiple checkboxes | mutually-non-exclusive multi-select | single-pick (use `RadioGroup`) |
| `ColorPicker` | Hex color input | swatch + manual hex entry | only preset palette (use `Select`) |
| `DatePicker` | Single date input | calendar pop with formatted text | range (use `DatePicker` range mode) |
| `Dropdown` | Headless dropdown trigger | custom popout content | typed select (use `Select`/`ExtendedSelect`) |
| `ExtendedSelect` | Rich select with grouping/search | searchable / grouped lists | simple list (use `Select`) |
| `FormInput` | Labeled input wrapper | composing label/error/helper around `Input` | bare input (use `Input`) |
| `FormWizard` | Multi-step form | wizards with validation per step | linear single-page form (use `Form`) |
| `IconPicker` | Icon library picker | choosing among supplied icons | arbitrary image picker (use `FileDropzone`) |
| `Input` | Native text input | any text field | needs label/error wrapper (use `FormInput`) |
| `JSONEditor` | JSON code editor | structured JSON authoring | plain text (use `Textarea`) |
| `Radio` | Single radio input | rare; always paired in a `RadioGroup` | always — prefer `RadioGroup` |
| `RadioGroup` | Mutually-exclusive choice | small enumerated options | many options (use `Select`) |
| `Select` | Native-style select | small enumerations | searchable (use `ExtendedSelect`) |
| `Switch` | Boolean toggle | settings toggles | discrete-step (use `RadioGroup`) |
| `TagInput` | Free-form tag entry | adding chips by typing | fixed enumeration (use `MultiCardSelect`) |
| `Textarea` | Multi-line text | free text | code (use `JSONEditor` / `MarkdownEditor`) |
| `NumberInput` | Numeric input with steppers | constrained numbers | unbounded number (use `Input type="number"`) |
| `Slider` / `RangeSlider` | Single / range numeric | continuous values | discrete options (use `RadioGroup`) |
| `Rating` | Star rating | feedback | numeric only (use `NumberInput`) |
| `OTPInput` | One-time-passcode boxes | 4–8 char auth codes | full-length input |
| `PhoneInput` | Country-aware phone input | E.164 phone capture | generic input |
| `TimePicker` | Time-of-day input | time-only | datetime (use `DatePicker`) |
| `MarkdownEditor` | Markdown source editor | docs / messages | code (use `JSONEditor`) |

## Display & Feedback

| Component | Purpose |
|---|---|
| `Alert` | Banner-style status block inside a card |
| `Badge` | Small colored label |
| `Chip` | Inline labeled pill (deletable) |
| `CodeSnippet` | Syntax-highlighted code block |
| `EmptyState` | "Nothing here" placeholder |
| `HelperText` | Subtle text under a control |
| `ProgressBar` | Determinate / indeterminate progress |
| `Skeleton` | Loading placeholder shape |
| `Spinner` | Loading spinner |
| `StatusDot` | Tiny colored status indicator |
| `Tag` | Read-only label chip |
| `Tooltip` | Floating helper on hover/focus |

## Layout & Structure

| Component | Purpose |
|---|---|
| `Accordion` | Collapsible sections |
| `Breadcrumb` | Navigation trail |
| `Card` | Generic container |
| `SectionCard` | Card with title + optional icon/action header |
| `Group` | Spaced inline children (chips, buttons) |
| `Divider` | Hairline separator |
| `Drawer` | Side panel overlay |
| `Popover` | Floating panel anchored to a trigger |
| `RichPageHeader` | Big page header with chips, description, breadcrumbs |
| `Spacer` | Vertical/horizontal flex grow |
| `Stepper` | Numbered/named step indicator |
| `TabSections` | Tabbed content groups |
| `Toast` | Transient notification |
| `Banner` | Page-wide announcement strip |
| `TreeView` | Hierarchical list with expansion |
| `ScrollArea` | Custom-scrollbar scroll container |
| `ResizablePanel` | Split panes with drag handle |
| `VirtualList` | Windowed list for large data |
| `InfiniteScroll` | Scroll-triggered loader |
| `Carousel` | Horizontal slide deck |
| `ImageCrop` | In-place image crop tool |
| `Lightbox` | Full-screen image viewer |
| `CommandPalette` | Cmd+K-style searchable action list |
| `ContextMenu` | Right-click menu |

## Navigation

| Component | Purpose |
|---|---|
| `CoolNav` | Marketing-style horizontal nav |
| `Pagination` | Page-number + prev/next |
| `SideNav` | Sidebar navigation |
| `VerticalItemList` | Vertical list of selectable items |

## Buttons & Actions

| Component | Purpose |
|---|---|
| `Button` | Standard button (primary/secondary/danger sizes) |
| `IconButton` | Icon-only square/round button |
| `CoolButton` | Marketing-styled CTA |
| `ActionHeader` | Header strip with title + action buttons |
| `ActionItems` | Group of action buttons aligned right |
| `DangerZoneActions` | Red-banded destructive action card |

## Data & Tables

| Component | Purpose |
|---|---|
| `Table` | Plain table |
| `AdvancedTable` | Sortable / filterable / paginated table |
| `CodeLabelCell` | Cell with code + label |
| `EntityCell` | Avatar + name + email cell |
| `EntityProfileCard` | Full profile card |
| `MetricGrid` | Grid of stat tiles |
| `StatCard` | Single stat card with trend |

## Media & Files

| Component | Purpose |
|---|---|
| `Avatar` | User avatar (initials / image / placeholder) |
| `File` | File row with icon + size |
| `FileDropzone` | Drag-and-drop upload zone (uses `dropzone` peer) |
| `FileTags` | List of tagged files |
| `Image` | Wrapped `<img>` with lazy + fallback |

## Typography & Decoration

| Component | Purpose |
|---|---|
| `Brand` | Logo + product name lockup |
| `Heading` | `h1`–`h6` styled |
| `Icon` | Bootstrap Icons wrapper |
| `Kbd` | Keyboard key glyph |
| `Label` | Form label |
| `Link` | Styled anchor |
| `Text` | Body text variants |
| `VisuallyHidden` | Screen-reader-only text |

## Complex / Domain

`ActionRowList`, `AssetBundle`, `AudioMixer`, `BitmapFontGenerator`, `Build`, `CardOptions`, `Changelog`, `Comparator`, `Hero`, `LinkedProvidersCard`, `MultiCardSelect`, `NodeEditor`, `Timeline`, `ToggleCard`.

`AudioMixer` — visual multitrack mixer editor (transport / track headers / timeline clips with canvas waveforms / loop region / inspector). Headless: `useAudioMixer({value,onChange})` owns the project-document JSON + `actions`/`selection`; the view is visual-only (transport callback-driven via `onPlay`/`onPause`/`onSeek`, no Web Audio). Use when authoring/arranging audio clips; skip for plain audio playback (use a native `<audio>` / player).
`NodeEditor` — canvas-only node-graph view (pan/zoom/touch, drag-to-connect); headless `useNodeEditor()` owns graph state + `actions`/`selection`.

## Game Jam / Arcade

`BriefCard`, `ChipGroup`, `CountdownTimer`, `CycleWheel`, `GameShowcaseCard`, `HeroStatsBar`, `Leaderboard`, `LeaderboardTrend`, `LiveFeed`, `Marquee`, `PhaseGrid`, `PulseIndicator`, `RankCell`, `ScoringRules`, `SectionFlag`, `SprintChain`, `Stamp`, `StateMachine`, `TierLadder`.

## Themes

Three palettes via wrapper class (no component changes):
- _(none)_ — default light
- `theme theme--neon` — dark navy/purple + magenta/cyan accents
- `theme theme--neon theme--neon--scanlines` — adds CRT scanline overlay

---

## CSS custom property prefix table

When adding a new component, reuse the existing prefix if extending one; pick a 2–4 letter abbreviation otherwise. Existing prefixes (from `.github/agents/components.agent.md`):

| Component | Prefix |
|---|---|
| `Dropdown` | `--rc-dropdown-` |
| `AdvancedTable` | `--at-` |
| `Pagination` | `--pg-` |
| `SideNav` | `--side-nav-` |
| `FormInput` | `--fi-` |
| `ExtendedSelect` | `--es-` |

Pick `--<abbr>-color`, `--<abbr>-muted`, `--<abbr>-border`, `--<abbr>-bg`, `--<abbr>-hover-bg`, `--<abbr>-active-color`, `--<abbr>-active-border`, `--<abbr>-transition`, `--<abbr>-shadow` (no `--<abbr>-radius` ever).

---

## Decision quick map

| Need | Reach for |
|---|---|
| Boolean input | `Checkbox` / `Switch` |
| Multi-pick | `CheckboxGroup` / `MultiCardSelect` / `TagInput` |
| Single pick from many | `Select` / `ExtendedSelect` / `Dropdown` |
| Single pick from few | `RadioGroup` / `Switch` |
| Numeric range | `RangeSlider` |
| Numeric single | `NumberInput` / `Slider` |
| Date | `DatePicker` |
| Time | `TimePicker` |
| Phone | `PhoneInput` |
| OTP | `OTPInput` |
| Free-form text | `Input` (single) / `Textarea` (multi) |
| Code | `JSONEditor` / `MarkdownEditor` |
| Form composition | `Form` + `FormInput` (single page) / `FormWizard` (multi-step) |
| Inline status | `Badge` / `Chip` / `Tag` / `StatusDot` |
| Loading | `Skeleton` (field) / `Spinner` (overlay) / `ProgressBar` (determinate) |
| Empty data | `EmptyState` |
| Tooltip | `Tooltip` |
| Floating panel | `Popover` |
| Alert | `Alert` (page) / `Toast` (transient) / `Banner` (full-width) |
| Confirm/cancel | wrap content in `ContextMenu` / `CommandPalette` / `Lightbox` |
| Side overlay | `Drawer` |
| Card | `Card` / `SectionCard` |
| Header | `RichPageHeader` / `ActionHeader` |
| Tabs | `TabSections` |
| Steps | `Stepper` |
| Page nav | `Pagination` / `Breadcrumb` |
| Side nav | `SideNav` |
| List | `VerticalItemList` / `VirtualList` (large) / `InfiniteScroll` (paginated) / `TreeView` (hierarchical) |
| Table | `Table` (plain) / `AdvancedTable` (sortable/filterable) |
| Profile cell | `EntityCell` (compact) / `EntityProfileCard` (detailed) |
| Stat | `StatCard` (single) / `MetricGrid` (group) |
| Avatar | `Avatar` |
| File picker | `FileDropzone` |
| Carousel | `Carousel` |
| Image viewer | `Lightbox` |
| Image crop | `ImageCrop` |
| Cmd+K palette | `CommandPalette` |

---

## Composition examples

These already exist — copy the pattern.

- **Form with validation:** `Form` containing `FormInput` (which composes `Input`/`Textarea`) + `Button` for submit.
- **Profile page:** `RichPageHeader` + `EntityProfileCard` + `MetricGrid` + `Tabs`.
- **Dashboard:** `SectionCard` × N containing `MetricGrid`, `AdvancedTable`, `StatCard`.
- **Onboarding wizard:** `FormWizard` driving `Stepper` + per-step `FormInput` groups.

When you compose, document under "Reuses" in your new component's entry.
