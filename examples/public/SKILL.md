---
name: react-components
description: Use when building UI with @toolcase/react-components — picking the right component, looking up props, or composing landing pages, dashboards, forms, and code/docs surfaces. Covers 160+ components across typography, inputs/forms, buttons, layout, navigation, overlays, data display, charts, media, identity, marketing/landing, and code/docs.
---

# react-components — Component Reference

A complete guide to every component in the library. Import any component from `@toolcase/react-components`.

---

## Themes

Every component reads its colors from CSS custom properties. Wrap any subtree with a `theme` class to flip the palette for everything inside — components themselves stay identical.

```tsx
// Default (light) look — no wrapper needed
<Card header="Settings">Standard card.</Card>

// Neon Drift — dark navy/purple with magenta + cyan accents
<div className="theme theme--neon">
  <Card header="Settings">Same component, neon palette.</Card>
</div>

// Optional: add the scanline overlay modifier
<div className="theme theme--neon theme--neon--scanlines">
  ...
</div>
```

Available themes:

| Class | Description |
|---|---|
| _(none)_ | Default light theme (baseline) |
| `theme theme--neon` | Dark navy/purple surfaces, magenta + cyan accents, glowing focus, uppercase mono eyebrows |
| `theme theme--neon theme--neon--scanlines` | Adds a CRT scanline overlay on top of `theme--neon` |

**Font expectations for `theme--neon`:** the arcade voice loads best with `Press Start 2P` (pixel — headings, labels, buttons, numerals), `VT323` (flavor — body copy, large flavor numerals) and `DM Mono` (mono — code, table cells, timestamps). Falls back to `Orbitron` / `Ubuntu Mono` / system monospace when absent — the look degrades gracefully but loses the arcade feel. Note: `Press Start 2P` and `VT323` are latin-only; Cyrillic / non-latin scripts fall through to system monospace. `Press Start 2P` only ships at weight 400 — any `font-weight: 600/700` rule will be faked by the browser and break the pixel grid; rely on size + uppercase + letter-spacing for emphasis instead. Recommended:

```html
<link href="https://fonts.googleapis.com/css2?family=Press+Start+2P&family=VT323&family=DM+Mono:wght@300;400;500&display=swap" rel="stylesheet">
```

**Adding a new theme:** drop `style/themes/_{name}.scss` next to the others and `@use` it from `style/themes/index.scss`. Scope every rule under `.theme.theme--{name}` (or `.theme--{name}`) and override the library's CSS custom properties (`--tc-*`, per-component `--{abbr}-*`) plus Bootstrap tokens (`--bs-*`) as needed. The neon partial is a worked example.

---

## Table of Contents

- [Inputs & Forms](#inputs--forms)
  - [Checkbox](#checkbox)
  - [CheckboxGroup](#checkboxgroup)
  - [ColorPicker](#colorpicker)
  - [DatePicker](#datepicker)
  - [Dropdown](#dropdown)
  - [ExtendedSelect](#extendedselect)
  - [FormInput](#forminput)
  - [FormWizard](#formwizard)
  - [IconPicker](#iconpicker)
  - [Input](#input)
  - [JSONEditor](#jsoneditor)
  - [Radio](#radio)
  - [RadioGroup](#radiogroup)
  - [Select](#select)
  - [Switch](#switch)
  - [TagInput](#taginput)
  - [Textarea](#textarea)
- [Display & Feedback](#display--feedback)
  - [Alert](#alert)
  - [Badge](#badge)
  - [Chip](#chip)
  - [CodeSnippet](#codesnippet)
  - [EmptyState](#emptystate)
  - [HelperText](#helpertext)
  - [ProgressBar](#progressbar)
  - [Skeleton](#skeleton)
  - [Spinner](#spinner)
  - [StatusDot](#statusdot)
  - [Tag](#tag)
  - [Tooltip](#tooltip)
- [Layout & Structure](#layout--structure)
  - [Accordion](#accordion)
  - [Breadcrumb](#breadcrumb)
  - [Card](#card)
  - [CommandPalette](#commandpalette)
  - [ContextMenu](#contextmenu)
  - [Divider](#divider)
  - [Drawer](#drawer)
  - [Form](#form)
  - [Group](#group)
  - [NumberInput](#numberinput)
  - [Popover](#popover)
  - [RichPageHeader](#richpageheader)
  - [SectionCard](#sectioncard)
  - [Slider](#slider)
  - [Spacer](#spacer)
  - [Stepper](#stepper)
  - [TabSections](#tabsections)
  - [Toast](#toast)
  - [RangeSlider](#rangeslider)
  - [Rating](#rating)
  - [OTPInput](#otpinput)
  - [PhoneInput](#phoneinput)
  - [TreeView](#treeview)
  - [ScrollArea](#scrollarea)
  - [ResizablePanel](#resizablepanel)
  - [VirtualList](#virtuallist)
  - [InfiniteScroll](#infinitescroll)
  - [TimePicker](#timepicker)
  - [MarkdownEditor](#markdowneditor)
  - [Carousel](#carousel)
  - [ImageCrop](#imagecrop)
  - [Lightbox](#lightbox)
  - [Banner](#banner)
- [Navigation](#navigation)
  - [CoolNav](#coolnav)
  - [Pagination](#pagination)
  - [SideNav](#sidenav)
  - [VerticalItemList](#verticalitemlist)
- [Buttons & Actions](#buttons--actions)
  - [ActionHeader](#actionheader)
  - [ActionItems](#actionitems)
  - [Button](#button)
  - [CoolButton](#coolbutton)
  - [DangerZoneActions](#dangerzoneactions)
  - [IconButton](#iconbutton)
- [Data & Tables](#data--tables)
  - [AdvancedTable](#advancedtable)
  - [CodeLabelCell](#codelabelcell)
  - [EntityCell](#entitycell)
  - [EntityProfileCard](#entityprofilecard)
  - [MetricGrid](#metricgrid)
  - [StatCard](#statcard)
  - [Table](#table)
- [Media & Files](#media--files)
  - [Avatar](#avatar)
  - [File](#file)
  - [FileDropzone](#filedropzone)
  - [FileTags](#filetags)
  - [Image](#image)
- [Typography & Decoration](#typography--decoration)
  - [Brand](#brand)
  - [Heading](#heading)
  - [Icon](#icon)
  - [Kbd](#kbd)
  - [Label](#label)
  - [Link](#link)
  - [Text](#text)
  - [VisuallyHidden](#visuallyhidden)
- [Complex / Domain Components](#complex--domain-components)
  - [ActionRowList](#actionrowlist)
  - [AssetBundle](#assetbundle)
  - [BitmapFontGenerator](#bitmapfontgenerator)
  - [Build](#build)
  - [CardOptions](#cardoptions)
  - [Changelog](#changelog)
  - [Comparator](#comparator)
  - [Hero](#hero)
  - [LinkedProvidersCard](#linkedproviderscard)
  - [MultiCardSelect](#multicardselect)
  - [Timeline](#timeline)
  - [ToggleCard](#togglecard)
- [Game Jam / Arcade](#game-jam--arcade)
  - [BriefCard](#briefcard)
  - [ChipGroup](#chipgroup)
  - [CountdownTimer](#countdowntimer)
  - [CycleWheel](#cyclewheel)
  - [GameShowcaseCard](#gameshowcasecard)
  - [HeroStatsBar](#herostatsbar)
  - [Leaderboard](#leaderboard)
  - [LeaderboardTrend](#leaderboardtrend)
  - [LiveFeed](#livefeed)
  - [Marquee](#marquee)
  - [PhaseGrid](#phasegrid)
  - [PulseIndicator](#pulseindicator)
  - [RankCell](#rankcell)
  - [ScoringRules](#scoringrules)
  - [SectionFlag](#sectionflag)
  - [SprintChain](#sprintchain)
  - [Stamp](#stamp)
  - [StateMachine](#statemachine)
  - [TierLadder](#tierladder)

---

## Inputs & Forms

### Checkbox

A single checkbox input with an optional label.

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `label` | `string` | ❌ | Text label next to the checkbox |
| `inline` | `boolean` | ❌ | Renders inline |
| `className` | `string` | ❌ | Class on the wrapper |
| `inputClassName` | `string` | ❌ | Class on the `<input>` element |

Also accepts all `HTMLInputElement` attributes (`checked`, `onChange`, `disabled`, etc.).

```tsx
import { Checkbox } from '@toolcase/react-components'

<Checkbox
  label="I agree to the terms"
  checked={agreed}
  onChange={(e) => setAgreed(e.target.checked)}
/>
```

---

### CheckboxGroup

A managed group of checkboxes that tracks a `string[]` of selected values.

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `options` | `CheckboxGroupOption[]` | ✅ | `{ value, label, disabled? }` |
| `value` | `string[]` | ❌ | Controlled selected values |
| `onChange` | `(values: string[]) => void` | ❌ | Called when selection changes |
| `label` | `string` | ❌ | Group label |
| `inline` | `boolean` | ❌ | Renders checkboxes inline |
| `name` | `string` | ❌ | HTML `name` for all inputs |
| `className` | `string` | ❌ | Additional CSS class |

```tsx
import { CheckboxGroup } from '@toolcase/react-components'

const options = [
  { value: 'html', label: 'HTML' },
  { value: 'css', label: 'CSS' },
  { value: 'js', label: 'JavaScript' },
]

<CheckboxGroup
  label="Skills"
  options={options}
  value={selected}
  onChange={setSelected}
  inline
/>
```

---

### ColorPicker

A dropdown color swatch grid with a hex text input for direct entry.

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `colors` | `ColorOption[] \| string[]` | ✅ | Swatches — hex strings or `{ hex, label? }` |
| `value` | `string` | ❌ | Controlled hex value |
| `onChange` | `(hex: string) => void` | ❌ | Called on selection |
| `label` | `string` | ❌ | Field label |
| `columns` | `number` | ❌ | Grid columns (default: `5`) |
| `loading` | `boolean` | ❌ | Skeleton state |
| `className` | `string` | ❌ | Additional CSS class |

```tsx
import { ColorPicker, ColorOption } from '@toolcase/react-components'

const palette: ColorOption[] = [
  { hex: '#ef4444', label: 'Red' },
  { hex: '#3b82f6', label: 'Blue' },
  { hex: '#22c55e', label: 'Green' },
]

<ColorPicker
  label="Brand Color"
  colors={palette}
  value={color}
  onChange={setColor}
  columns={3}
/>
```

---

### DatePicker

A native date input with optional label and min/max range.

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `value` | `string` | ❌ | ISO date string `YYYY-MM-DD` |
| `onChange` | `(date: string) => void` | ❌ | Called when date changes |
| `label` | `string` | ❌ | Field label |
| `min` | `string` | ❌ | Minimum selectable date |
| `max` | `string` | ❌ | Maximum selectable date |
| `disabled` | `boolean` | ❌ | Disables the input |
| `className` | `string` | ❌ | Additional CSS class |

```tsx
import { DatePicker } from '@toolcase/react-components'

<DatePicker
  label="Start Date"
  value={date}
  onChange={setDate}
  min="2024-01-01"
  max="2026-12-31"
/>
```

---

### Dropdown

A fully accessible custom dropdown with keyboard navigation (arrows, Home, End, Escape), icon/description per item, and a loading state.

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `items` | `DropdownItem[]` | ❌ | `{ key, name, description?, icon?, disabled? }` |
| `value` | `string` | ❌ | Controlled selected key |
| `onChange` | `(key: string) => void` | ❌ | Called on selection |
| `placeholder` | `string` | ❌ | Placeholder text |
| `loading` | `boolean` | ❌ | Skeleton state |

```tsx
import { Dropdown, DropdownItem } from '@toolcase/react-components'

const items: DropdownItem[] = [
  { key: 'unity', name: 'Unity', description: 'Cross-platform engine', icon: 'box' },
  { key: 'godot', name: 'Godot', description: 'Open source engine', icon: 'gem' },
]

<Dropdown
  items={items}
  value={selected}
  onChange={setSelected}
  placeholder="Choose an engine..."
/>
```

---

### ExtendedSelect

A searchable dropdown with debounced filtering, icons, descriptions, keyboard navigation, and a "no results" message.

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `items` | `ExtendedSelectItem[]` | ❌ | `{ key, name, description?, icon?, label?, disabled? }` |
| `value` | `string` | ❌ | Controlled selected key |
| `onChange` | `(key: string) => void` | ❌ | Called on selection |
| `placeholder` | `string` | ❌ | Trigger placeholder |
| `searchPlaceholder` | `string` | ❌ | Search input placeholder |
| `noResultsText` | `string` | ❌ | Message when no items match |
| `loading` | `boolean` | ❌ | Skeleton state |

```tsx
import { ExtendedSelect, ExtendedSelectItem } from '@toolcase/react-components'

const items: ExtendedSelectItem[] = [
  { key: 'ts', name: 'TypeScript', description: 'Typed JavaScript', icon: 'code-slash' },
  { key: 'rust', name: 'Rust', description: 'Systems language', icon: 'gear' },
]

<ExtendedSelect
  items={items}
  value={lang}
  onChange={setLang}
  placeholder="Select a language..."
  searchPlaceholder="Search languages..."
  noResultsText="No matching languages."
/>
```

---

### FormInput

A universal form field that renders the correct control based on a single `type` prop. Supports 17 input types with consistent label, help tooltip, helper text, validation, and error display.

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `type` | `FormInputType` | ✅ | Which control to render (see below) |
| `label` | `string` | ❌ | Field label |
| `value` | `unknown` | ❌ | Controlled value |
| `onChange` | `(value, hasError) => void` | ❌ | Called when value changes |
| `placeholder` | `string` | ❌ | Input placeholder |
| `disabled` | `boolean` | ❌ | Disables the field |
| `required` | `boolean` | ❌ | Marks field as required |
| `help` | `string` | ❌ | Tooltip text on the `?` icon |
| `helper` | `string` | ❌ | Helper text below the field |
| `error` | `string` | ❌ | Static error message |
| `validate` | `FormInputValidator \| FormInputValidator[]` | ❌ | Validation function(s) |
| `onErrorMessage` | `(result) => string` | ❌ | Custom error message formatter |
| `loading` | `boolean` | ❌ | Skeleton state |
| `colors` | `ColorOption[] \| string[]` | ❌ | Swatches for `type="color"` |
| `icons` | `IconOption[]` | ❌ | Options for `type="icon"` |
| `items` | `DropdownItem[] \| ExtendedSelectItem[]` | ❌ | Options for `type="dropdown"` / `"extended-select"` |
| `options` | `CheckboxGroupOption[] \| RadioGroupOption[]` | ❌ | Options for checkbox/radio groups |
| `recommendations` | `string[]` | ❌ | Suggestions for `type="tag"` |
| `allowCreate` | `boolean` | ❌ | Allow free-form tags |
| `maxTags` | `number` | ❌ | Max tags for `type="tag"` |
| `inline` | `boolean` | ❌ | Inline layout for checkbox/radio |
| `columns` | `number` | ❌ | Grid columns for color/icon picker |
| `min` / `max` / `step` | `number \| string` | ❌ | Number/range constraints |
| `rows` | `number` | ❌ | Row count for `type="textarea"` |
| `searchPlaceholder` | `string` | ❌ | Search placeholder for `extended-select` |
| `noResultsText` | `string` | ❌ | No-results text for `extended-select` |

**`FormInputType` values:**

| Value | Renders |
|-------|---------|
| `'text'` | `<input type="text">` |
| `'email'` | `<input type="email">` |
| `'url'` | `<input type="url">` |
| `'number'` | `<input type="number">` |
| `'range'` | `<input type="range">` |
| `'textarea'` | `<Textarea>` |
| `'date'` | `<DatePicker>` |
| `'color'` | `<ColorPicker>` |
| `'icon'` | `<IconPicker>` |
| `'tag'` | `<TagInput>` |
| `'checkbox'` | `<Checkbox>` |
| `'checkbox-group'` | `<CheckboxGroup>` |
| `'radio'` | `<Radio>` |
| `'radio-group'` | `<RadioGroup>` |
| `'boolean'` | `<Switch>` |
| `'dropdown'` | `<Dropdown>` |
| `'extended-select'` | `<ExtendedSelect>` |

**Exported types:**

```ts
type FormInputType = 'text' | 'email' | 'url' | 'number' | 'range' | 'textarea' | 'date'
  | 'color' | 'icon' | 'tag' | 'checkbox' | 'checkbox-group' | 'radio' | 'radio-group'
  | 'boolean' | 'dropdown' | 'extended-select'

type ValidationResult = null | undefined | string | { code: string; message: string }
type FormInputValidator = (value: unknown) => ValidationResult
```

```tsx
import { FormInput } from '@toolcase/react-components'

// Simple text field
<FormInput
  type="text"
  label="Full Name"
  placeholder="Enter your name"
  value={name}
  onChange={(v) => setName(v as string)}
  required
/>

// Field with validation
<FormInput
  type="number"
  label="Age"
  value={age}
  onChange={(v) => setAge(v as number)}
  validate={(val) => {
    const n = Number(val)
    if (val !== '' && n < 18) return 'must-be-adult'
    return null
  }}
  onErrorMessage={(r) => r === 'must-be-adult' ? 'Must be 18 or older.' : String(r)}
/>

// Dropdown field
<FormInput
  type="dropdown"
  label="Project"
  items={dropdownItems}
  value={project}
  onChange={(v) => setProject(v as string)}
/>

// Tag input field
<FormInput
  type="tag"
  label="Technologies"
  recommendations={['react', 'typescript', 'node']}
  allowCreate
  maxTags={8}
  value={tags}
  onChange={(v) => setTags(v as string[])}
/>
```

---

### FormWizard

A multi-step wizard with tabbed step navigation and Back/Next/Complete controls.

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `steps` | `FormWizardStep[]` | ✅ | `{ key, label, content, canNext? }` |
| `onComplete` | `() => void` | ❌ | Called when the last step is completed |
| `completeLabel` | `ReactNode` | ❌ | Label on the complete button |
| `completeIcon` | `string` | ❌ | Icon on the complete button |
| `loading` | `boolean` | ❌ | Skeleton state |
| `className` | `string` | ❌ | Additional CSS class |

```tsx
import { FormWizard, FormWizardStep } from '@toolcase/react-components'

const steps: FormWizardStep[] = [
  { key: 'info', label: 'Info', content: <InfoStep />, canNext: nameValid },
  { key: 'config', label: 'Config', content: <ConfigStep /> },
  { key: 'review', label: 'Review', content: <ReviewStep /> },
]

<FormWizard
  steps={steps}
  onComplete={handleComplete}
  completeLabel="Publish"
  completeIcon="rocket-takeoff"
/>
```

---

### IconPicker

A dropdown icon grid with a search input, supporting structured `IconOption` objects or plain string names.

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `icons` | `IconOption[] \| string[]` | ✅ | Available icons |
| `value` | `string` | ❌ | Controlled selected value |
| `onChange` | `(value: string) => void` | ❌ | Called on selection |
| `label` | `string` | ❌ | Field label |
| `columns` | `number` | ❌ | Grid columns (default: `5`) |
| `triggerStyle` | `React.CSSProperties` | ❌ | Style on the trigger button |
| `triggerClassName` | `string` | ❌ | Class on the trigger button |
| `loading` | `boolean` | ❌ | Skeleton state |
| `className` | `string` | ❌ | Additional CSS class |

**`IconOption`** can be a plain string (Bootstrap Icon name) or `{ icon: string, label?: string, value: string }`.

```tsx
import { IconPicker, IconOption } from '@toolcase/react-components'

const icons: IconOption[] = [
  { icon: 'house', label: 'Home', value: 'house' },
  { icon: 'gear', label: 'Settings', value: 'gear' },
  { icon: 'star', label: 'Favorites', value: 'star' },
]

<IconPicker
  label="Project Icon"
  icons={icons}
  value={icon}
  onChange={setIcon}
  columns={4}
/>
```

---

### Input

A labeled text input with validation error display.

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `label` | `string` | ❌ | Field label |
| `error` | `string` | ❌ | Validation error message |
| `className` | `string` | ❌ | Class on the wrapper |
| `inputClassName` | `string` | ❌ | Class on the `<input>` element |

Also accepts all `HTMLInputElement` attributes.

```tsx
import { Input } from '@toolcase/react-components'

<Input
  label="Username"
  placeholder="Enter username"
  value={username}
  onChange={(e) => setUsername(e.target.value)}
  error={usernameError}
/>
```

---

### JSONEditor

A dynamic form that renders typed fields from a JSON schema, supporting strings, numbers, booleans, arrays, and nested objects.

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `schema` | `string` | ✅ | JSON string of `JSONEditorSchemaProperty[]` |
| `value` | `Record<string, unknown>` | ❌ | Controlled value |
| `defaultValue` | `Record<string, unknown>` | ❌ | Initial uncontrolled value |
| `onChange` | `(value: Record<string, unknown>) => void` | ❌ | Called on any field change |
| `disabled` | `boolean` | ❌ | Disables all fields |
| `loading` | `boolean` | ❌ | Skeleton state |
| `className` | `string` | ❌ | Additional CSS class |

```ts
type JSONEditorSchemaProperty = {
  key: string
  type: 'string' | 'number' | 'boolean' | 'array' | 'object'
  defaultValue?: unknown
  itemType?: 'string' | 'number' | 'boolean'   // for type='array'
  properties?: JSONEditorSchemaProperty[]       // for type='object'
}
```

```tsx
import { JSONEditor } from '@toolcase/react-components'

const schema = JSON.stringify([
  { key: 'name', type: 'string', defaultValue: '' },
  { key: 'level', type: 'number', defaultValue: 1 },
  { key: 'active', type: 'boolean', defaultValue: true },
])

<JSONEditor schema={schema} value={config} onChange={setConfig} />
```

---

### Radio

A single radio button input with optional label.

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `label` | `string` | ❌ | Radio label text |
| `inline` | `boolean` | ❌ | Renders inline |
| `className` | `string` | ❌ | Class on the wrapper |
| `inputClassName` | `string` | ❌ | Class on the `<input>` element |

Also accepts all `HTMLInputElement` attributes.

```tsx
import { Radio } from '@toolcase/react-components'

<Radio label="Option A" name="choice" value="a" checked={val === 'a'} onChange={() => setVal('a')} />
<Radio label="Option B" name="choice" value="b" checked={val === 'b'} onChange={() => setVal('b')} />
```

---

### RadioGroup

A group of radio buttons managing a single selected value.

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `options` | `RadioGroupOption[]` | ✅ | `{ value, label, disabled? }` |
| `value` | `string` | ❌ | Controlled selected value |
| `onChange` | `(value: string) => void` | ❌ | Called on selection |
| `label` | `string` | ❌ | Group label |
| `inline` | `boolean` | ❌ | Renders radios inline |
| `name` | `string` | ❌ | HTML `name` for all inputs |
| `className` | `string` | ❌ | Additional CSS class |

```tsx
import { RadioGroup } from '@toolcase/react-components'

<RadioGroup
  label="Size"
  options={[
    { value: 'sm', label: 'Small' },
    { value: 'md', label: 'Medium' },
    { value: 'lg', label: 'Large' },
  ]}
  value={size}
  onChange={setSize}
  inline
/>
```

---

### Select

A native `<select>` dropdown with a label and error state.

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `options` | `SelectOption[]` | ✅ | `{ value, label }` |
| `label` | `string` | ❌ | Field label |
| `error` | `string` | ❌ | Validation error message |
| `className` | `string` | ❌ | Class on the wrapper |
| `selectClassName` | `string` | ❌ | Class on the `<select>` element |

Also accepts all `HTMLSelectElement` attributes.

```tsx
import { Select, SelectOption } from '@toolcase/react-components'

const options: SelectOption[] = [
  { value: 'admin', label: 'Admin' },
  { value: 'editor', label: 'Editor' },
  { value: 'viewer', label: 'Viewer' },
]

<Select
  label="Role"
  options={options}
  value={role}
  onChange={(e) => setRole(e.target.value)}
/>
```

---

### Switch

A toggle switch (on/off) styled as a track with a sliding knob.

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `label` | `string` | ❌ | Text label next to the switch |
| `size` | `'small' \| 'default' \| 'large'` | ❌ | Switch size (default: `'default'`) |

Also accepts all `HTMLInputElement` attributes (`checked`, `onChange`, `disabled`, etc.).

```tsx
import { Switch } from '@toolcase/react-components'

<Switch
  label="Enable notifications"
  checked={enabled}
  onChange={(e) => setEnabled(e.target.checked)}
/>
```

---

### TagInput

A tag input with a recommendation dropdown, keyboard navigation (Enter to add, Backspace to remove), and optional free-form creation.

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `value` | `string[]` | ❌ | Controlled tags |
| `defaultValue` | `string[]` | ❌ | Initial tags (uncontrolled) |
| `onChange` | `(tags: string[]) => void` | ❌ | Called when tags change |
| `recommendations` | `string[]` | ❌ | Suggested values |
| `allowCreate` | `boolean` | ❌ | Allow creating new tags |
| `maxTags` | `number` | ❌ | Maximum tag count (`0` = unlimited) |
| `placeholder` | `string` | ❌ | Input placeholder |
| `disabled` | `boolean` | ❌ | Disables the input |
| `label` | `string` | ❌ | Field label |
| `loading` | `boolean` | ❌ | Skeleton state |
| `className` | `string` | ❌ | Additional CSS class |

```tsx
import { TagInput } from '@toolcase/react-components'

<TagInput
  value={tags}
  onChange={setTags}
  recommendations={['react', 'vue', 'angular', 'typescript']}
  allowCreate
  maxTags={10}
  placeholder="Add a tag..."
/>
```

---

### Textarea

A multi-line text input with a label and error state.

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `label` | `string` | ❌ | Field label |
| `error` | `string` | ❌ | Validation error message |
| `className` | `string` | ❌ | Class on the wrapper |
| `textareaClassName` | `string` | ❌ | Class on the `<textarea>` element |

Also accepts all `HTMLTextAreaElement` attributes.

```tsx
import { Textarea } from '@toolcase/react-components'

<Textarea
  label="Description"
  placeholder="Describe your project..."
  rows={4}
  value={desc}
  onChange={(e) => setDesc(e.target.value)}
/>
```

---

## Display & Feedback

### Alert

A dismissible alert banner with optional title, icon, and loading skeleton.

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `variant` | `'primary' \| 'secondary' \| 'info' \| 'success' \| 'warning' \| 'danger'` | ❌ | Color theme (default: `'primary'`) |
| `title` | `string` | ❌ | Bold heading above the message |
| `message` | `string` | ❌ | Plain-text message |
| `icon` | `string` | ❌ | Bootstrap Icon name |
| `dismissible` | `boolean` | ❌ | Shows a close (×) button |
| `onClose` | `() => void` | ❌ | Called when closed |
| `loading` | `boolean` | ❌ | Skeleton state |
| `className` | `string` | ❌ | Additional CSS class |
| `children` | `ReactNode` | ❌ | Extra content inside the alert |

```tsx
import { Alert } from '@toolcase/react-components'

<Alert variant="success" title="Saved!" icon="check-circle-fill">
  Your changes have been saved successfully.
</Alert>

<Alert variant="danger" dismissible onClose={hideAlert} loading={isLoading}>
  Something went wrong. Please try again.
</Alert>
```

---

### Badge

A small inline label with variant colors, pill shape, and size options.

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `variant` | `'primary' \| 'secondary' \| 'success' \| 'danger' \| 'warning' \| 'info'` | ❌ | Color theme (default: `'secondary'`) |
| `size` | `'sm' \| 'md' \| 'lg'` | ❌ | Badge size (default: `'md'`) |
| `pill` | `boolean` | ❌ | Fully rounded corners |
| `label` | `string` | ❌ | Text alternative to `children` |
| `children` | `ReactNode` | ❌ | Badge content |

Also accepts all `HTMLSpanElement` attributes.

```tsx
import { Badge } from '@toolcase/react-components'

<Badge variant="success">Active</Badge>
<Badge variant="danger" pill>3</Badge>
<Badge variant="info" size="sm">Beta</Badge>
```

---

### Chip

A compact interactive chip/tag with optional icon, selection state, and removable button.

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `variant` | `'primary' \| 'secondary' \| 'info' \| 'success' \| 'warning' \| 'danger'` | ❌ | Color theme (default: `'secondary'`) |
| `selected` | `boolean` | ❌ | Visually selected state |
| `icon` | `string` | ❌ | Bootstrap Icon name before label |
| `removable` | `boolean` | ❌ | Shows an × button (requires `onRemove`) |
| `onRemove` | `() => void` | ❌ | Called when × is clicked |
| `label` | `string` | ❌ | Text alternative to `children` |
| `children` | `ReactNode` | ❌ | Chip content |
| `disabled` | `boolean` | ❌ | Disables interaction |

Also accepts all `HTMLButtonElement` attributes.

```tsx
import { Chip } from '@toolcase/react-components'

// Selectable chip
<Chip variant="primary" selected={active} onClick={toggle}>React</Chip>

// Removable chip
<Chip variant="primary" removable onRemove={() => removeTag('react')}>react</Chip>

// With icon
<Chip icon="star" variant="warning" selected>Favorites</Chip>
```

---

### CodeSnippet

A styled code block with a language label, syntax highlighting class, and a one-click copy button.

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `code` | `string` | ✅ | Source code to display |
| `language` | `'javascript' \| 'typescript' \| 'bash'` | ❌ | Syntax language (default: `'javascript'`) |
| `title` | `string` | ❌ | Override the language label |
| `showCopyButton` | `boolean` | ❌ | Show/hide copy button (default: `true`) |
| `onCopy` | `(code: string) => void` | ❌ | Called when code is copied |
| `loading` | `boolean` | ❌ | Skeleton state |

```tsx
import { CodeSnippet } from '@toolcase/react-components'

<CodeSnippet
  language="typescript"
  code={`import { Button } from '@toolcase/react-components'\n\n<Button variant="primary">Click me</Button>`}
/>
```

---

### EmptyState

A centered placeholder for empty content, with an optional icon and slotted children.

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `icon` | `string` | ❌ | Bootstrap Icon name |
| `children` | `ReactNode` | ❌ | Message or action content |

Also accepts all `HTMLDivElement` attributes.

```tsx
import { EmptyState } from '@toolcase/react-components'

<EmptyState icon="inbox">
  <p>No items yet.</p>
  <Button>Create your first item</Button>
</EmptyState>
```

---

### HelperText

A small helper or validation message with an auto-selected icon based on variant.

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `text` | `string` | ❌ | Helper text string |
| `variant` | `'default' \| 'success' \| 'warning' \| 'error'` | ❌ | Style variant (default: `'default'`) |
| `icon` | `string` | ❌ | Override the auto-selected icon |
| `children` | `ReactNode` | ❌ | Content alternative to `text` |
| `className` | `string` | ❌ | Additional CSS class |

```tsx
import { HelperText } from '@toolcase/react-components'

<HelperText text="Max 100 characters." />
<HelperText variant="error" text="This field is required." />
<HelperText variant="success" text="Looks good!" />
```

---

### ProgressBar

A horizontal progress indicator with label, variant coloring, custom height, and an indeterminate animation mode.

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `value` | `number` | ✅ | Progress 0–100 |
| `variant` | `'primary' \| 'secondary' \| 'success' \| 'danger' \| 'warning' \| 'info'` | ❌ | Color theme (default: `'primary'`) |
| `label` | `string` | ❌ | Text label above the bar |
| `height` | `number \| string` | ❌ | Bar height in px (default: `8`) |
| `indeterminate` | `boolean` | ❌ | Animated indeterminate state |

```tsx
import { ProgressBar } from '@toolcase/react-components'

<ProgressBar value={75} variant="success" label="75%" />
<ProgressBar indeterminate variant="primary" label="Uploading..." />
```

---

### Skeleton

A loading placeholder with configurable shape and dimensions.

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `shape` | `'line' \| 'circle' \| 'rect'` | ❌ | Shape (default: `'line'`) |
| `width` | `string \| number` | ❌ | Width override |
| `height` | `string \| number` | ❌ | Height override |
| `count` | `number` | ❌ | Number of skeleton lines (default: `1`) |

Also accepts all `HTMLDivElement` attributes.

```tsx
import { Skeleton } from '@toolcase/react-components'

<Skeleton width="60%" />
<Skeleton shape="circle" width={40} height={40} />
<Skeleton shape="rect" height={120} />
<Skeleton count={3} />
```

---

### Spinner

A circular animated loading indicator with size, variant, and accessible label.

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `size` | `'small' \| 'default' \| 'large'` | ❌ | Spinner size (default: `'default'`) |
| `variant` | `'primary' \| 'secondary' \| 'info' \| 'success' \| 'warning' \| 'danger'` | ❌ | Color theme (default: `'primary'`) |
| `label` | `string` | ❌ | Visible label (otherwise visually hidden) |

```tsx
import { Spinner } from '@toolcase/react-components'

<Spinner />
<Spinner size="large" variant="success" label="Saving..." />
```

---

### StatusDot

A small colored dot indicating presence status, with optional pulse animation.

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `status` | `'online' \| 'offline' \| 'busy' \| 'away'` | ❌ | Status state (default: `'offline'`) |
| `size` | `'small' \| 'default' \| 'large'` | ❌ | Dot size (default: `'default'`) |
| `label` | `string` | ❌ | Accessible label (defaults to `status`) |
| `pulse` | `boolean` | ❌ | Adds pulsing animation |

```tsx
import { StatusDot } from '@toolcase/react-components'

<StatusDot status="online" pulse />
<StatusDot status="busy" size="small" />
```

---

### Tag

A colored label tag with an optional removable button.

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `variant` | `'primary' \| 'secondary' \| 'info' \| 'success' \| 'warning' \| 'danger'` | ❌ | Color theme (default: `'secondary'`) |
| `removable` | `boolean` | ❌ | Shows an × button |
| `onRemove` | `() => void` | ❌ | Called when × is clicked |
| `label` | `string` | ❌ | Text alternative to `children` |
| `children` | `ReactNode` | ❌ | Tag content |

Also accepts all `HTMLSpanElement` attributes.

```tsx
import { Tag } from '@toolcase/react-components'

<Tag variant="info">TypeScript</Tag>
<Tag variant="primary" removable onRemove={() => remove('react')}>react</Tag>
```

---

### Tooltip

A hover/focus tooltip that auto-flips position when it would overflow the viewport.

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `children` | `React.ReactElement` | ✅ | The trigger element |
| `content` | `ReactNode` | ✅ | Tooltip content |
| `position` | `'top' \| 'bottom' \| 'left' \| 'right'` | ❌ | Preferred position (default: `'top'`) |
| `className` | `string` | ❌ | Additional CSS class on the wrapper |

```tsx
import { Tooltip, IconButton } from '@toolcase/react-components'

<Tooltip content="Delete this item" position="bottom">
  <IconButton icon="trash" variant="danger" />
</Tooltip>
```

---

## Layout & Structure

### Drawer

A panel that slides in from the left, right, top, or bottom of the viewport, overlaying content. Supports focus trap, Escape to close, and an optional pinned (non-overlay) mode.

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `open` | `boolean` | ✅ | Whether the drawer is visible |
| `onClose` | `() => void` | ✅ | Called when backdrop or close button is clicked, or Escape is pressed |
| `side` | `'left' \| 'right' \| 'top' \| 'bottom'` | ❌ | Which edge the panel slides in from (default: `'right'`) |
| `size` | `'small' \| 'default' \| 'large'` | ❌ | Panel width (left/right) or height (top/bottom) (default: `'default'`) |
| `title` | `string` | ❌ | Header title text; renders a header bar with a close button |
| `pinned` | `boolean` | ❌ | Non-overlay mode: no backdrop, body scroll not locked (default: `false`) |
| `children` | `ReactNode` | ❌ | Panel content |
| `className` | `string` | ❌ | Additional class on the panel element |

```tsx
import { Drawer } from '@toolcase/react-components'

const [open, setOpen] = useState(false)

<Drawer open={open} onClose={() => setOpen(false)} title="Settings" side="right">
  <p>Drawer content here.</p>
</Drawer>
```

---

### Toast

Auto-dismissing notification toasts rendered in a fixed screen corner via a global imperative API. Wrap your app once in `<ToastProvider>`, then call `toast.success(...)` etc. from anywhere.

#### `ToastProvider` props

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `defaultDuration` | `number` | ❌ | Auto-dismiss delay in ms. `0` = persistent. Default: `4000`. |
| `defaultPosition` | `ToastPosition` | ❌ | Default corner for toasts (default: `'top-right'`). |
| `maxToasts` | `number` | ❌ | Max visible toasts per position group (default: `5`). |
| `children` | `ReactNode` | ❌ | Your application tree. |

#### `toast` imperative API

| Call | Description |
|------|-------------|
| `toast.success(message, options?)` | Green success toast |
| `toast.error(message, options?)` | Red error toast |
| `toast.warning(message, options?)` | Yellow warning toast |
| `toast.info(message, options?)` | Blue info toast |
| `toast(message, { variant, ...options })` | Generic call |
| `toast.dismiss(id)` | Dismiss by ID |
| `toast.dismissAll()` | Dismiss all toasts |

#### `ToastOptions`

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `id` | `string` | ❌ | Deduplication ID |
| `title` | `string` | ❌ | Bold heading above the message |
| `duration` | `number` | ❌ | Override duration for this toast |
| `position` | `ToastPosition` | ❌ | Override position for this toast |

`ToastPosition`: `'top-right' | 'top-left' | 'top-center' | 'bottom-right' | 'bottom-left' | 'bottom-center'`

```tsx
import { ToastProvider, toast } from '@toolcase/react-components'

// Wrap app once
<ToastProvider defaultPosition="top-right" defaultDuration={4000}>
  <App />
</ToastProvider>

// Call from anywhere
toast.success('Profile saved')
toast.error('Something went wrong', { title: 'Error', duration: 0 })
toast.warning('Your session is expiring soon')
toast.info('New version available', { position: 'bottom-center' })
```

---

### Accordion

Collapsible content panels with animated chevrons. Supports single-open and multi-open modes, controlled and uncontrolled, and a borderless variant.

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `items` | `AccordionItem[]` | ✅ | Array of `{ key, title, content, disabled? }` |
| `multiple` | `boolean` | ❌ | Allow multiple panels open simultaneously (default: `false`) |
| `defaultOpen` | `string[]` | ❌ | Keys open by default (uncontrolled) |
| `open` | `string[]` | ❌ | Controlled open keys |
| `onOpenChange` | `(keys: string[]) => void` | ❌ | Called when open state changes |
| `variant` | `'bordered' \| 'borderless'` | ❌ | Visual style (default: `'bordered'`) |
| `className` | `string` | ❌ | Additional CSS class |

```tsx
import { Accordion } from '@toolcase/react-components'

const items = [
  { key: 'a', title: 'Section A', content: <p>Content A</p> },
  { key: 'b', title: 'Section B', content: <p>Content B</p> },
]

<Accordion items={items} defaultOpen={['a']} />
```

---

### Breadcrumb

Navigation trail showing hierarchy path. Supports custom separators, `href`/`onClick` items, and automatic collapse via `maxItems`.

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `items` | `BreadcrumbItem[]` | ✅ | Array of `{ label, href?, onClick? }` |
| `separator` | `ReactNode` | ❌ | Separator between crumbs (default: `'/'`) |
| `maxItems` | `number` | ❌ | Collapse middle crumbs when exceeded; ellipsis expands (default: `0`) |
| `className` | `string` | ❌ | Additional CSS class |

```tsx
import { Breadcrumb } from '@toolcase/react-components'

<Breadcrumb
  items={[
    { label: 'Home', href: '/' },
    { label: 'Products', href: '/products' },
    { label: 'Running Shoes' },
  ]}
  maxItems={3}
/>
```

---

### CommandPalette

Keyboard-first search overlay with grouped results, fuzzy word matching, highlight, keyboard navigation, and focus trap.

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `items` | `CommandPaletteItem[]` | ✅ | Array of `{ key, label, description?, icon?, group?, keywords? }` |
| `open` | `boolean` | ✅ | Whether the palette is visible |
| `onClose` | `() => void` | ✅ | Called when Esc or backdrop is clicked |
| `onSelect` | `(item: CommandPaletteItem) => void` | ✅ | Called when an item is selected |
| `placeholder` | `string` | ❌ | Input placeholder (default: `'Search…'`) |
| `loading` | `boolean` | ❌ | Shows skeleton rows |
| `className` | `string` | ❌ | Additional CSS class |

```tsx
import { CommandPalette } from '@toolcase/react-components'

const [open, setOpen] = useState(false)

<CommandPalette
  items={items}
  open={open}
  onClose={() => setOpen(false)}
  onSelect={(item) => console.log(item.key)}
/>
```

---

### ContextMenu

Right-click context menu rendered via portal at cursor position. Supports submenus, disabled items, danger items, dividers, and full keyboard nav.

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `items` | `ContextMenuItem[]` | ✅ | Array of `{ key, label, icon?, disabled?, danger?, divider?, items?, onClick? }` |
| `children` | `ReactElement` | ✅ | Target element that receives the `contextmenu` event |
| `onSelect` | `(key: string) => void` | ❌ | Called when a leaf item is selected |

```tsx
import { ContextMenu } from '@toolcase/react-components'

<ContextMenu
  items={[
    { key: 'copy',   label: 'Copy',   icon: 'copy' },
    { key: 'delete', label: 'Delete', icon: 'trash', danger: true },
  ]}
  onSelect={(key) => console.log(key)}
>
  <div>Right-click me</div>
</ContextMenu>
```

---

### Popover

Floating panel anchored to a trigger element with 12-way placement, viewport clamping, and click-outside / Escape dismiss.

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `children` | `ReactElement` | ✅ | Trigger element (must accept `ref`, `onClick`/mouse props, `aria-*`) |
| `content` | `ReactNode` | ✅ | Content rendered inside the panel |
| `placement` | `PopoverPlacement` | ❌ | One of 12 positions (default: `'bottom'`) |
| `trigger` | `'click' \| 'hover'` | ❌ | How the popover opens (default: `'click'`) |
| `open` | `boolean` | ❌ | Controlled open state |
| `onOpenChange` | `(open: boolean) => void` | ❌ | Called when open state should change |
| `className` | `string` | ❌ | Additional CSS class on the panel |

`PopoverPlacement`: `'top' | 'top-start' | 'top-end' | 'bottom' | 'bottom-start' | 'bottom-end' | 'left' | 'left-start' | 'left-end' | 'right' | 'right-start' | 'right-end'`

```tsx
import { Popover, Button } from '@toolcase/react-components'

<Popover content={<p>Hello!</p>} placement="bottom-start">
  <Button variant="primary">Click me</Button>
</Popover>
```
| `header` | `ReactNode` | ❌ | Card header content |
| `variant` | `'default' \| 'primary' \| 'secondary' \| 'info' \| 'success' \| 'warning' \| 'danger'` | ❌ | Color theme (default: `'default'`) |
| `loading` | `boolean` | ❌ | Skeleton state |
| `className` | `string` | ❌ | Additional CSS class |
| `children` | `ReactNode` | ❌ | Card body content |

```tsx
import { Card } from '@toolcase/react-components'

<Card header={<h2>Settings</h2>}>
  <p>Manage your account settings.</p>
</Card>
```

---

### Divider

A horizontal or vertical visual separator with an optional centered label.

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `vertical` | `boolean` | ❌ | Renders as a vertical divider |
| `label` | `string` | ❌ | Centered label text |

Also accepts all `HTMLDivElement` attributes.

```tsx
import { Divider } from '@toolcase/react-components'

<Divider />
<Divider label="or" />
<Divider vertical />
```

---

### Form

A form container that collects `FormData` on submit, optionally wrapping content in a `Card`.

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `children` | `ReactNode` | ✅ | Form fields |
| `onSubmit` | `(data: Record<string, any>, event) => void` | ❌ | Called with parsed form data |
| `header` | `ReactNode` | ❌ | Card header (when `wrapper=true`) |
| `variant` | `'default' \| ...` | ❌ | Card variant (default: `'default'`) |
| `wrapper` | `boolean` | ❌ | Wrap in a Card (default: `true`) |
| `className` | `string` | ❌ | Additional CSS class on `<form>` |

```tsx
import { Form, Input, Button } from '@toolcase/react-components'

<Form onSubmit={(data) => console.log(data)} header="Contact Us">
  <Input name="name" label="Name" placeholder="Your name" />
  <Button type="submit">Send</Button>
</Form>
```

---

### Group

A collapsible section with a label, optional badge count, and an add action button.

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `label` | `string` | ✅ | Group label |
| `badge` | `string` | ❌ | Count or label badge |
| `defaultCollapsed` | `boolean` | ❌ | Initial collapsed state |
| `onActionClick` | `() => void` | ❌ | Callback for the add button |
| `actionLabel` | `string` | ❌ | Accessible label for the add button |
| `actionIcon` | `string` | ❌ | Icon for the add button (default: `'plus-lg'`) |
| `children` | `ReactNode` | ❌ | Group content |

```tsx
import { Group } from '@toolcase/react-components'

<Group label="Projects" badge="3" onActionClick={openNewProject} actionLabel="New project">
  <ProjectList />
</Group>
```

---

### Spacer

A flexible or fixed-size blank space element.

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `size` | `string \| number` | ❌ | Fixed size (omit for `flex: 1 1 auto`) |
| `axis` | `'horizontal' \| 'vertical'` | ❌ | Direction (default: `'vertical'`) |

```tsx
import { Spacer } from '@toolcase/react-components'

// Flexible fill (pushes adjacent items apart in flex container)
<div style={{ display: 'flex' }}>
  <Logo />
  <Spacer />
  <NavActions />
</div>

// Fixed gap
<Spacer size={24} />
```

---

### TabSections

A tabbed panel component with controlled and uncontrolled modes and disabled tab support.

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `items` | `TabSectionItem[]` | ✅ | `{ key, label, content, disabled? }` |
| `activeKey` | `string` | ❌ | Controlled active tab key |
| `defaultActiveKey` | `string` | ❌ | Initial active tab (uncontrolled) |
| `onChange` | `(key: string) => void` | ❌ | Called when active tab changes |
| `loading` | `boolean` | ❌ | Skeleton in the content area |
| `className` | `string` | ❌ | Additional CSS class |

```tsx
import { TabSections, TabSectionItem } from '@toolcase/react-components'

const tabs: TabSectionItem[] = [
  { key: 'overview', label: 'Overview', content: <Overview /> },
  { key: 'settings', label: 'Settings', content: <Settings /> },
  { key: 'logs', label: 'Logs', content: <Logs />, disabled: true },
]

<TabSections items={tabs} defaultActiveKey="overview" />
```

---

### SectionCard

A titled card for settings and detail pages. Renders an icon + title header row with an optional right-aligned action slot, and a body region filled by `children`. The `danger` variant tints the chrome red for destructive sections.

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `title` | `string` | ✅ | Section heading |
| `icon` | `string` | ❌ | Bootstrap Icon name for the header tile |
| `action` | `ReactNode` | ❌ | Right-aligned slot (typically a `Button`) |
| `variant` | `'default' \| 'danger'` | ❌ | Style variant (default: `'default'`) |
| `children` | `ReactNode` | ❌ | Body content |
| `className` | `string` | ❌ | Additional CSS class |

```tsx
import { SectionCard, Button } from '@toolcase/react-components'

<SectionCard
  title="API keys"
  icon="key"
  action={<Button size="small">New key</Button>}
>
  Active keys appear here.
</SectionCard>

<SectionCard
  title="Delete workspace"
  icon="exclamation-triangle"
  variant="danger"
  action={<Button variant="danger" outline size="small">Delete</Button>}
>
  Permanently deletes this workspace and all of its projects.
</SectionCard>
```

---

### RichPageHeader

A page-level hero header: tinted icon tile, optional chip row, title, sub, description, and a right-aligned `actions` slot. Use at the top of dashboard, settings, or detail pages. Ships `RichPageHeaderChip` for consistent chip styling.

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `title` | `ReactNode` | ✅ | Page title |
| `icon` | `{ name: string; color?: EntityColor }` | ❌ | Tinted icon tile — color drawn from the shared `EntityColor` palette |
| `chips` | `ReactNode` | ❌ | Chip row above the title (typically `RichPageHeaderChip`s) |
| `sub` | `ReactNode` | ❌ | Secondary line under the title |
| `description` | `ReactNode` | ❌ | Body paragraph below `sub` |
| `actions` | `ReactNode` | ❌ | Right-aligned actions slot (buttons, etc.) |
| `className` | `string` | ❌ | Additional CSS class |

**`RichPageHeaderChip` props:** `{ icon?: string, children: ReactNode, className?: string }`

```tsx
import { RichPageHeader, RichPageHeaderChip, Button } from '@toolcase/react-components'

<RichPageHeader
  icon={{ name: 'hdd-stack', color: 'violet' }}
  chips={
    <>
      <RichPageHeaderChip icon="check-circle">Active</RichPageHeaderChip>
      <RichPageHeaderChip icon="geo-alt">us-west-2</RichPageHeaderChip>
    </>
  }
  title="atlas-prod-cluster"
  sub="Postgres 15 · 8 vCPU · 32 GB"
  description="Primary database cluster for the Atlas production tenant."
  actions={<Button>Deploy</Button>}
/>
```

---

## Navigation

### CoolNav

A responsive sticky navbar with branding, navigation links, scroll-aware background, and configurable login button.

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `brand` | `ReactNode` | ❌ | Logo/brand element |
| `items` | `CoolNavItem[]` | ❌ | `{ label, href?, onClick?, active?, target?, key? }` |
| `loginLabel` | `string` | ❌ | Login button label |
| `loginHref` | `string` | ❌ | Login button URL |
| `onLoginClick` | `(e) => void` | ❌ | Login button click handler |
| `loginVariant` | `string` | ❌ | Login button variant (default: `'primary'`) |
| `rightEl` | `ReactNode` | ❌ | Custom element replacing the login button |
| `theme` | `'light' \| 'dark'` | ❌ | Navbar theme (default: `'light'`) |
| `sticky` | `boolean` | ❌ | Stick to top (default: `true`) |
| `scrollOffset` | `number` | ❌ | Scroll px before adding scrolled class |
| `expandBreakpoint` | `'sm' \| 'md' \| 'lg' \| 'xl' \| 'xxl'` | ❌ | Hamburger breakpoint (default: `'lg'`) |
| `containerClassName` | `string` | ❌ | Class on the inner container |
| `className` | `string` | ❌ | Additional CSS class on `<nav>` |

```tsx
import { CoolNav, CoolNavItem, Brand } from '@toolcase/react-components'

const navItems: CoolNavItem[] = [
  { label: 'Features', href: '#features' },
  { label: 'Pricing', href: '#pricing' },
  { label: 'Docs', href: '/docs', active: true },
]

<CoolNav
  brand={<Brand primaryText="MyApp" color="#6366f1" />}
  items={navItems}
  loginLabel="Get Started"
  loginHref="/signup"
/>
```

---

### Pagination

A page navigation control with ellipsis compression, prev/next buttons, and configurable sibling count.

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `limit` | `number` | ✅ | Items per page |
| `offset` | `number` | ✅ | Current offset (0-based) |
| `total` | `number` | ✅ | Total item count |
| `onChange` | `(offset: number) => void` | ❌ | Called when page changes |
| `siblingCount` | `number` | ❌ | Page buttons on each side of current (default: `1`) |

Also accepts all `HTMLDivElement` attributes.

```tsx
import { Pagination } from '@toolcase/react-components'

<Pagination
  limit={10}
  offset={offset}
  total={250}
  onChange={setOffset}
  siblingCount={1}
/>
```

---

### SideNav

A vertical navigation sidebar with grouped sections, icon items, badge indicators, active/disabled states, and skeleton loading.

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `sections` | `SideNavSection[]` | ❌ | `{ title?, items: SideNavItem[] }` |
| `onItemClick` | `(e, item: SideNavItem) => void` | ❌ | Called when a nav item is clicked |
| `loading` | `boolean` | ❌ | Skeleton state |
| `loadingCount` | `number` | ❌ | Number of skeleton items (default: `6`) |

**`SideNavItem`:** `{ key?, label, icon?, href?, active?, badge?, disabled?, target?, rel? }`

```tsx
import { SideNav, SideNavSection } from '@toolcase/react-components'

const sections: SideNavSection[] = [
  {
    title: 'Main',
    items: [
      { key: 'dashboard', label: 'Dashboard', icon: 'grid', href: '/', active: true },
      { key: 'projects', label: 'Projects', icon: 'folder', href: '/projects', badge: '5' },
      { key: 'settings', label: 'Settings', icon: 'gear', href: '/settings' },
    ],
  },
]

<SideNav sections={sections} onItemClick={(e, item) => navigate(item.href!)} />
```

---

### VerticalItemList

A vertical list with icon, text, optional badge per item, and controlled/uncontrolled active state.

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `items` | `VerticalItemListItem[]` | ✅ | `{ key, text, icon?, badge? }` |
| `activeKey` | `string` | ❌ | Controlled active key |
| `defaultActiveKey` | `string` | ❌ | Initial active key (uncontrolled) |
| `onSelect` | `(key: string) => void` | ❌ | Called when an item is selected |
| `children` | `ReactNode` | ❌ | Content panel rendered alongside the list |
| `disabled` | `boolean` | ❌ | Disables all items |
| `loading` | `boolean` | ❌ | Skeleton state |
| `loadingCount` | `number` | ❌ | Number of skeleton items (default: `5`) |
| `className` | `string` | ❌ | Additional CSS class |

```tsx
import { VerticalItemList, VerticalItemListItem } from '@toolcase/react-components'

const items: VerticalItemListItem[] = [
  { key: 'general', text: 'General', icon: 'gear' },
  { key: 'security', text: 'Security', icon: 'shield-check' },
  { key: 'billing', text: 'Billing', icon: 'credit-card', badge: '!' },
]

<VerticalItemList
  items={items}
  defaultActiveKey="general"
  onSelect={(key) => setSection(key)}
>
  <SectionContent />
</VerticalItemList>
```

---

## Buttons & Actions

### ActionHeader

A layout with content on the left and a row of icon+label action buttons on the right.

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `actions` | `ActionHeaderAction[]` | ✅ | `{ key, label, icon?, alt?, disabled? }` |
| `onExec` | `(key: string) => void` | ❌ | Called when an action is clicked |
| `disabled` | `boolean` | ❌ | Disables all actions |
| `children` | `ReactNode` | ❌ | Content on the left |
| `className` | `string` | ❌ | Additional CSS class |

```tsx
import { ActionHeader, ActionHeaderAction } from '@toolcase/react-components'

const actions: ActionHeaderAction[] = [
  { key: 'save', label: 'Save', icon: 'floppy' },
  { key: 'delete', label: 'Delete', icon: 'trash', disabled: true },
]

<ActionHeader actions={actions} onExec={(key) => handleAction(key)}>
  <h2>Project Settings</h2>
</ActionHeader>
```

---

### ActionItems

A three-dots (⋮) dropdown menu of labelled action items.

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `items` | `ActionItem[]` | ✅ | `{ key, label, icon? }` |
| `onActionClick` | `(key: string) => void` | ❌ | Called when a menu item is clicked |

```tsx
import { ActionItems, ActionItem } from '@toolcase/react-components'

const items: ActionItem[] = [
  { key: 'edit', label: 'Edit', icon: 'pencil' },
  { key: 'duplicate', label: 'Duplicate', icon: 'copy' },
  { key: 'delete', label: 'Delete', icon: 'trash' },
]

<ActionItems items={items} onActionClick={(key) => handleAction(key)} />
```

---

### Button

A styled button with variant colors, sizes, and outline mode.

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `variant` | `'primary' \| 'secondary' \| 'info' \| 'success' \| 'warning' \| 'danger'` | ❌ | Color theme (default: `'primary'`) |
| `size` | `'small' \| 'default' \| 'large'` | ❌ | Button size (default: `'default'`) |
| `outline` | `boolean` | ❌ | Outline style |
| `label` | `string` | ❌ | Text alternative to `children` |
| `children` | `ReactNode` | ❌ | Button content |

Also accepts all `HTMLButtonElement` attributes. Supports `ref` forwarding.

```tsx
import { Button } from '@toolcase/react-components'

<Button variant="primary">Save</Button>
<Button variant="danger" outline size="small">Delete</Button>
```

---

### CoolButton

An enhanced button with a left or right addon slot and optional visual separator.

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `addon` | `ReactNode` | ❌ | Element in the addon slot |
| `addonPosition` | `'left' \| 'right'` | ❌ | Addon placement (default: `'right'`) |
| `showSeparator` | `boolean` | ❌ | Show separator between label and addon |
| `separatorClassName` | `string` | ❌ | Class on the separator |
| `innerClassName` | `string` | ❌ | Class on the inner wrapper |
| `children` | `ReactNode` | ❌ | Button label content |

Also accepts all `Button` props. Supports `ref` forwarding.

```tsx
import { CoolButton } from '@toolcase/react-components'

<CoolButton
  variant="primary"
  addon={<Badge variant="danger" pill>3</Badge>}
  showSeparator
>
  Notifications
</CoolButton>
```

---

### DangerZoneActions

A list of destructive action items, each with a description and a danger-styled button.

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `actions` | `DangerZoneAction[]` | ✅ | `{ key, label, text, buttonText }` |
| `onActionClick` | `(key: string) => void` | ❌ | Called when a button is clicked |
| `className` | `string` | ❌ | Additional CSS class |

```tsx
import { DangerZoneActions, DangerZoneAction } from '@toolcase/react-components'

const actions: DangerZoneAction[] = [
  { key: 'reset', label: 'Reset Project', text: 'This will clear all data.', buttonText: 'Reset' },
  { key: 'delete', label: 'Delete Project', text: 'This action cannot be undone.', buttonText: 'Delete' },
]

<DangerZoneActions actions={actions} onActionClick={(key) => confirm(key)} />
```

---

### IconButton

A square button that displays only an icon, suitable for toolbars.

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `icon` | `string` | ✅ | Bootstrap Icon name |
| `size` | `'small' \| 'default' \| 'large'` | ❌ | Button size (default: `'default'`) |
| `variant` | `'primary' \| 'secondary' \| 'info' \| 'success' \| 'warning' \| 'danger'` | ❌ | Color theme (default: `'secondary'`) |
| `outline` | `boolean` | ❌ | Outline style |
| `label` | `string` | ❌ | Accessible `aria-label` |

Also accepts all `HTMLButtonElement` attributes. Supports `ref` forwarding.

```tsx
import { IconButton } from '@toolcase/react-components'

<IconButton icon="pencil" label="Edit" />
<IconButton icon="trash" variant="danger" outline size="small" label="Delete" />
```

---

## Data & Tables

### AdvancedTable

A data table extended with filter fields, column sorting, pagination, and a loading overlay.

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `columns` | `TableColumn<T>[]` | ✅ | Column definitions (see `Table`) |
| `data` | `T[]` | ✅ | Row data |
| `rowKey` | `(row, index) => string \| number` | ✅ | Unique key per row |
| `filters` | `AdvancedTableFilter[]` | ❌ | Filter field definitions (`FormInputProps` + `key`) |
| `filterValues` | `Record<string, any>` | ❌ | Controlled filter values |
| `onFilterChange` | `(key, value) => void` | ❌ | Called when a filter changes |
| `sortableColumns` | `string[]` | ❌ | Keys of sortable columns |
| `sort` | `AdvancedTableSort \| null` | ❌ | Active sort: `{ key, direction: 'asc' \| 'desc' }` |
| `onSortChange` | `(sort \| null) => void` | ❌ | Called when sort changes |
| `limit` | `number` | ❌ | Page size |
| `offset` | `number` | ❌ | Current page offset |
| `total` | `number` | ❌ | Total record count |
| `onOffsetChange` | `(offset: number) => void` | ❌ | Called when page changes |
| `loading` | `boolean` | ❌ | Loading overlay |
| `className` | `string` | ❌ | Additional CSS class |

Also inherits all `Table` display props (`striped`, `hoverable`, etc.).

```tsx
import { AdvancedTable, AdvancedTableFilter, AdvancedTableSort, TableColumn } from '@toolcase/react-components'

const columns: TableColumn<User>[] = [
  { key: 'name', header: 'Name', render: (row) => row.name },
  { key: 'role', header: 'Role', render: (row) => row.role },
]

const filters: AdvancedTableFilter[] = [
  { key: 'role', type: 'text', placeholder: 'Filter by role...' },
]

<AdvancedTable
  columns={columns}
  data={users}
  rowKey={(r) => r.id}
  filters={filters}
  filterValues={filterValues}
  onFilterChange={(key, val) => setFilterValues((prev) => ({ ...prev, [key]: val }))}
  sortableColumns={['name', 'role']}
  sort={sort}
  onSortChange={setSort}
  limit={10}
  offset={offset}
  total={total}
  onOffsetChange={setOffset}
  striped
  hoverable
/>
```

---

### Table

A data table with custom cell renderers, configurable styling, sticky header, and skeleton loading rows.

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `columns` | `TableColumn<T>[]` | ✅ | Column definitions |
| `data` | `T[]` | ✅ | Row data |
| `rowKey` | `(row: T, index: number) => string \| number` | ✅ | Unique key per row |
| `emptyMessage` | `ReactNode` | ❌ | Shown when `data` is empty |
| `striped` | `boolean` | ❌ | Alternating row colors |
| `hoverable` | `boolean` | ❌ | Row highlight on hover (default: `true`) |
| `compact` | `boolean` | ❌ | Reduced cell padding |
| `borderless` | `boolean` | ❌ | Removes borders |
| `stickyHeader` | `boolean` | ❌ | Sticky header row |
| `onRowClick` | `(row: T, index: number) => void` | ❌ | Called when a row is clicked |
| `loading` | `boolean` | ❌ | Skeleton rows |
| `loadingRows` | `number` | ❌ | Number of skeleton rows (default: `5`) |

**`TableColumn<T>`:** `{ key, header, render, width?, align?, headerAlign? }`

```tsx
import { Table, TableColumn } from '@toolcase/react-components'

interface User { id: string; name: string; email: string; role: string }

const columns: TableColumn<User>[] = [
  { key: 'name', header: 'Name', render: (row) => row.name },
  { key: 'email', header: 'Email', render: (row) => row.email },
  { key: 'role', header: 'Role', render: (row) => row.role, align: 'center', width: '120px' },
]

<Table
  columns={columns}
  data={users}
  rowKey={(r) => r.id}
  striped
  hoverable
  onRowClick={(row) => navigate(`/users/${row.id}`)}
  emptyMessage="No users found."
/>
```

---

### StatCard

A KPI tile: an eyebrow (icon + label), a large value with optional unit, and an optional footer row containing a delta chip, helper text, and a free-form slot. Purely presentational — formatting and data-fetching live upstream.

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `label` | `string` | ✅ | Eyebrow label (e.g. `"Active users"`) |
| `value` | `ReactNode` | ✅ | Large primary value |
| `icon` | `string` | ❌ | Bootstrap Icon name in the eyebrow |
| `unit` | `string` | ❌ | Unit suffix rendered next to the value (e.g. `"GB"`) |
| `delta` | `string` | ❌ | Delta chip text (e.g. `"+12.4%"`) |
| `deltaKind` | `'up' \| 'down' \| 'neutral'` | ❌ | Delta color + arrow icon (default: `'neutral'`) |
| `helper` | `ReactNode` | ❌ | Secondary text in the footer row |
| `footer` | `ReactNode` | ❌ | Free-form footer slot (right-aligned) |
| `loading` | `boolean` | ❌ | Skeleton in place of content |
| `className` | `string` | ❌ | Additional CSS class |

```tsx
import { StatCard } from '@toolcase/react-components'

<StatCard
  icon="graph-up-arrow"
  label="Revenue"
  value="$48.2k"
  delta="+12.4%"
  deltaKind="up"
  helper="vs. last month"
/>

<StatCard icon="hdd" label="Storage used" value="34.2" unit="GB" />
```

---

### MetricGrid

A responsive grid of lightweight read-only metric tiles. Lighter than `StatCard` — no card chrome, no trend chip. Takes either an `items` array or arbitrary children. Exports `MetricTile` for the children form.

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `items` | `(MetricTileProps & { key?: string })[]` | ❌ | Data-driven tile list |
| `columns` | `2 \| 3 \| 4` | ❌ | Hard column cap (default: `3`) |
| `children` | `ReactNode` | ❌ | Alternative to `items` — pass `MetricTile`s or custom nodes |
| `className` | `string` | ❌ | Additional CSS class |

**`MetricTileProps`:** `{ label, value, unit?, icon?, hint?, className? }`

```tsx
import { MetricGrid, MetricTile } from '@toolcase/react-components'

// Data-driven
<MetricGrid
  columns={4}
  items={[
    { icon: 'hdd', label: 'Storage', value: '34.2', unit: 'GB', hint: '74% of quota' },
    { icon: 'cloud-upload', label: 'Bundles', value: '342' },
    { icon: 'people', label: 'Seats', value: '12', unit: 'of 25' },
    { icon: 'activity', label: 'Requests', value: '1.2M' },
  ]}
/>

// Children form — mix tiles with custom content
<MetricGrid columns={3}>
  <MetricTile icon="server" label="Uptime" value="99.98" unit="%" />
  <MetricTile icon="lightning-charge" label="P95" value="142" unit="ms" />
</MetricGrid>
```

---

### CodeLabelCell

A micro-cell for tables showing a short monospace code next to a longer human-readable name (country codes, currency codes, IATA codes, plan keys, etc.). Pure display — no interactive behavior. Names truncate with ellipsis.

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `code` | `string` | ✅ | Short uppercase code (e.g. `"US"`) |
| `name` | `string` | ✅ | Full human-readable name |
| `className` | `string` | ❌ | Additional CSS class |

```tsx
import { CodeLabelCell } from '@toolcase/react-components'

<CodeLabelCell code="US" name="United States" />
<CodeLabelCell code="EUR" name="Euro" />
```

---

### EntityCell

Compact list/table cell: a colored initial tile next to a two-line label. Colors come from the shared `EntityColor` palette so cells stay visually consistent across admin tables. If `onClick` is passed the name renders as a button.

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `name` | `string` | ✅ | Primary label |
| `initial` | `string` | ✅ | 1–2 character initial rendered in the tile |
| `color` | `EntityColor` | ✅ | `'violet' \| 'cyan' \| 'emerald' \| 'amber' \| 'pink' \| 'blue' \| 'slate' \| 'rose'` |
| `subLabel` | `string` | ❌ | Secondary line under the name |
| `size` | `'sm' \| 'md' \| 'lg'` | ❌ | Tile size (default: `'md'`) |
| `onClick` | `() => void` | ❌ | Makes the name a clickable button |
| `className` | `string` | ❌ | Additional CSS class |

```tsx
import { EntityCell } from '@toolcase/react-components'

<EntityCell
  name="Atlas Platform"
  subLabel="atlas-prod"
  initial="AT"
  color="violet"
  onClick={() => navigate('/projects/atlas-prod')}
/>
```

---

### EntityProfileCard

A profile card with a hero row (lead visual + identity block) and a responsive meta grid of `{ icon, label, value, hint }` cells. Lead is a single slot — plug in an `Avatar`, an icon tile, or nothing. Meta items support a `mono` modifier for IDs.

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `title` | `ReactNode` | ✅ | Primary identity |
| `meta` | `MetaItem[]` | ✅ | Meta grid cells |
| `lead` | `ReactNode` | ❌ | Left hero slot — typically an `Avatar` |
| `subtitle` | `ReactNode` | ❌ | Secondary identity line |
| `chips` | `ReactNode` | ❌ | Chip row in the identity block |
| `loading` | `boolean` | ❌ | Skeleton for hero + meta rows |
| `className` | `string` | ❌ | Additional CSS class |

**`MetaItem`:** `{ icon?: string, label: string, value: ReactNode, hint?: ReactNode, mono?: boolean }`

Presentational — date formatting lives in the companion `formatRelative(iso)` helper exported from the same package.

```tsx
import { EntityProfileCard, Avatar, Badge, formatRelative } from '@toolcase/react-components'

<EntityProfileCard
  lead={<Avatar name="Jordan Liu" size="large" />}
  title="Jordan Liu"
  subtitle="jordan@atlas.example.com"
  chips={<Badge variant="success" pill>Active</Badge>}
  meta={[
    { icon: 'calendar-event', label: 'Joined', value: '2023-08-12' },
    { icon: 'clock-history', label: 'Last seen', value: formatRelative(user.lastSeenAt) },
    { icon: 'hash', label: 'User ID', value: 'usr_9a82c0f3e641', mono: true },
  ]}
/>
```

---

## Media & Files

### Avatar

A user avatar with image, initials fallback, optional presence status dot, and variant background.

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `src` | `string` | ❌ | Image URL |
| `name` | `string` | ❌ | User name — used to derive initials |
| `alt` | `string` | ❌ | Alt text for the image |
| `size` | `'small' \| 'default' \| 'large'` | ❌ | Avatar size (default: `'default'`) |
| `status` | `'online' \| 'offline' \| 'busy' \| 'away'` | ❌ | Presence indicator dot |
| `variant` | `'primary' \| 'secondary' \| 'success' \| 'danger' \| 'warning' \| 'info'` | ❌ | Initials background color |

```tsx
import { Avatar } from '@toolcase/react-components'

<Avatar name="Alice Johnson" status="online" />
<Avatar src="/avatars/bob.jpg" name="Bob Smith" size="large" />
<Avatar name="Carol" variant="primary" status="busy" />
```

---

### File

A file card with an editable name, tag picker, item count, formatted size, and action dropdown.

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `name` | `string` | ❌ | File name |
| `format` | `string` | ❌ | File format type (used for icon coloring) |
| `extension` | `string` | ❌ | File extension on the icon |
| `size` | `number` | ❌ | File size in bytes |
| `items` | `number` | ❌ | Sub-item count |
| `tagIds` | `string[]` | ❌ | Selected tag IDs |
| `tags` | `FileTag[]` | ❌ | All available tags `{ id, name }` |
| `menuItems` | `ActionItem[]` | ❌ | Action menu items |
| `onNameChange` | `(name: string) => void` | ❌ | Called when name is edited |
| `onTagsChange` | `(tagIds: string[]) => void` | ❌ | Called when tags change |
| `onMenuItemClick` | `(key: string) => void` | ❌ | Called when a menu item is clicked |
| `readonly` | `boolean` | ❌ | Disables editing and tag management |
| `loading` | `boolean` | ❌ | Skeleton state |

---

### FileDropzone

A Dropzone.js drag-and-drop file upload area that displays supported formats.

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `onFiles` | `(files: File[]) => void` | ❌ | Called when files are added |
| `supported` | `DropzoneFileFormat[]` | ❌ | `{ type, mimetype, extension }` |
| `className` | `string` | ❌ | Additional CSS class |

```tsx
import { FileDropzone, DropzoneFileFormat } from '@toolcase/react-components'

const formats: DropzoneFileFormat[] = [
  { type: 'Image', mimetype: 'image/png', extension: '.png' },
  { type: 'Image', mimetype: 'image/jpeg', extension: '.jpg' },
]

<FileDropzone
  supported={formats}
  onFiles={(files) => handleUpload(files)}
/>
```

---

### FileTags

An inline chip list with a search-filtered dropdown for adding or removing tags.

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `tags` | `FileTag[]` | ✅ | All available tags `{ id, name }` |
| `selectedIds` | `string[]` | ❌ | Currently selected tag IDs |
| `onChange` | `(ids: string[]) => void` | ❌ | Called when selection changes |
| `readonly` | `boolean` | ❌ | Hides add/remove controls |

---

### Image

An image with loading shimmer, error fallback, aspect ratio, and `object-fit` control.

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `fallback` | `ReactNode` | ❌ | Shown when image fails to load |
| `aspectRatio` | `string` | ❌ | CSS `aspect-ratio` (e.g. `'16/9'`) |
| `objectFit` | `'cover' \| 'contain' \| 'fill' \| 'none'` | ❌ | CSS `object-fit` (default: `'cover'`) |

Also accepts all `HTMLImageElement` attributes.

```tsx
import { Image } from '@toolcase/react-components'

<Image
  src="/hero.jpg"
  alt="Hero image"
  aspectRatio="16/9"
  objectFit="cover"
  fallback={<EmptyState icon="image">No image</EmptyState>}
/>
```

---

## Typography & Decoration

### Brand

A styled brand/logo text group with optional color underline, secondary text, and a badge.

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `primaryText` | `ReactNode` | ❌ | Main brand text |
| `secondaryText` | `ReactNode` | ❌ | Sub-brand text |
| `label` | `ReactNode` | ❌ | Badge label (e.g. version) |
| `color` | `string` | ❌ | Hex color for the underline accent |
| `xlarge` | `boolean` | ❌ | Scales up 300% |

Also accepts all `HTMLDivElement` attributes.

```tsx
import { Brand } from '@toolcase/react-components'

<Brand primaryText="Toolcase" color="#6366f1" label="Beta" />
```

---

### Heading

A semantic heading (`h1`–`h6`) with optional gradient text.

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `as` | `'h1' \| 'h2' \| 'h3' \| 'h4' \| 'h5' \| 'h6'` | ❌ | Heading level (default: `'h2'`) |
| `gradient` | `boolean` | ❌ | Applies gradient text styling |
| `children` | `ReactNode` | ❌ | Heading text |

Also accepts all `HTMLHeadingElement` attributes.

```tsx
import { Heading } from '@toolcase/react-components'

<Heading as="h1" gradient>Welcome to Toolcase</Heading>
<Heading as="h3">Component Reference</Heading>
```

---

### Icon

An icon wrapper that supports two sets: Bootstrap Icons (`bi`, default) and the in-house toolcase SVG catalog (`tc`). Accessibility attributes are applied automatically.

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `name` | `string` | ✅ | Icon slug. For `bi`: Bootstrap Icon name without `bi-` prefix. For `tc`: a key from the toolcase catalog (e.g. `action`, `rts`, `tower-defense`) |
| `set` | `'bi' \| 'tc'` | ❌ | Icon set. Default: `'bi'`. Use `'tc'` for the toolcase SVG catalog |
| `as` | `React.ElementType` | ❌ | Rendered element for the `bi` set (default: `'i'`). Ignored for `tc` — always renders `<svg>` |
| `size` | `number \| string` | ❌ | Font-size-based size (icon scales with `1em`) |
| `color` | `string` | ❌ | Color override (applied via `currentColor`) |
| `label` | `string` | ❌ | Accessible label (makes the icon semantic) |
| `decorative` | `boolean` | ❌ | Force `aria-hidden="true"` |

```tsx
import { Icon } from '@toolcase/react-components'

// Bootstrap Icons (default)
<Icon name="star" size="1.5rem" color="#f59e0b" />
<Icon name="check-circle" label="Verified" />

// Toolcase SVG catalog — opt-in via `set="tc"`
<Icon set="tc" name="action" size={32} />
<Icon set="tc" name="tower-defense" label="Tower defense" />
```

---

### Kbd

Renders keyboard shortcuts as styled `<kbd>` elements with `+` separators.

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `keys` | `string[]` | ❌ | Array of key names (shows `+` between each) |
| `children` | `ReactNode` | ❌ | Single key content |

```tsx
import { Kbd } from '@toolcase/react-components'

<Kbd keys={['Ctrl', 'S']} />       // → Ctrl + S
<Kbd keys={['Cmd', 'Shift', 'P']} /> // → Cmd + Shift + P
<Kbd>Enter</Kbd>
```

---

### Label

A styled form label with an optional required asterisk and tooltip info icon.

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `required` | `boolean` | ❌ | Appends a `*` marker |
| `tooltip` | `string` | ❌ | Tooltip text on the info icon |
| `size` | `'small' \| 'default' \| 'large'` | ❌ | Label size (default: `'default'`) |
| `children` | `ReactNode` | ❌ | Label text |

Also accepts all `HTMLLabelElement` attributes.

```tsx
import { Label } from '@toolcase/react-components'

<Label htmlFor="email" required tooltip="We'll never share your email.">
  Email Address
</Label>
```

---

### Link

A styled anchor with variant colors, underline control, and automatic external link handling.

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `variant` | `'primary' \| 'secondary' \| 'info' \| 'success' \| 'warning' \| 'danger'` | ❌ | Color theme (default: `'primary'`) |
| `underline` | `'always' \| 'hover' \| 'none'` | ❌ | Underline behavior (default: `'hover'`) |
| `external` | `boolean` | ❌ | Adds `target="_blank" rel="noopener noreferrer"` and an external icon |
| `children` | `ReactNode` | ❌ | Link content |

Also accepts all `HTMLAnchorElement` attributes.

```tsx
import { Link } from '@toolcase/react-components'

<Link href="/docs">Read the docs</Link>
<Link href="https://github.com/toolcase" external>GitHub</Link>
<Link href="/pricing" variant="success" underline="always">View pricing</Link>
```

---

### Text

A polymorphic text/paragraph element with variant styling and size control.

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `as` | `'p' \| 'span' \| 'small' \| 'div'` | ❌ | Rendered element (default: `'span'`) |
| `variant` | `'default' \| 'muted' \| 'code' \| 'mono' \| 'truncate'` | ❌ | Style variant (default: `'default'`) |
| `size` | `'small' \| 'default' \| 'large'` | ❌ | Text size (default: `'default'`) |
| `children` | `ReactNode` | ❌ | Text content |

Also accepts all `HTMLElement` attributes.

```tsx
import { Text } from '@toolcase/react-components'

<Text as="p" variant="muted">Created 3 days ago</Text>
<Text variant="mono" size="small">abc-123-xyz</Text>
<Text variant="truncate" as="div" style={{ maxWidth: 200 }}>A very long string that will be truncated.</Text>
```

---

### VisuallyHidden

An accessibility utility that renders content visible only to screen readers.

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `children` | `ReactNode` | ✅ | Hidden content |
| `as` | `'span' \| 'div'` | ❌ | Rendered element (default: `'span'`) |

```tsx
import { VisuallyHidden } from '@toolcase/react-components'

<button onClick={closeModal}>
  <Icon name="x-lg" />
  <VisuallyHidden>Close modal</VisuallyHidden>
</button>
```

---

## Complex / Domain Components

### AssetBundle

A card for a game asset bundle — displays engine target, included/excluded tags, file-type counts, build metadata, and an action menu.

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `name` | `string` | ✅ | Bundle display name |
| `target` | `string` | ✅ | Target game engine |
| `targetIcon` | `string` | ❌ | Bootstrap Icon override for the engine |
| `category` | `string` | ❌ | Selected category |
| `includedTags` | `string[]` | ❌ | Tags included in the bundle |
| `excludedTags` | `string[]` | ❌ | Tags excluded from the bundle |
| `defaultBuildTag` | `string` | ❌ | Default build tag |
| `counts` | `Record<string, number>` | ❌ | File counts by type |
| `latestBuildRef` | `string` | ❌ | Latest build hash/number |
| `buildTag` | `string` | ❌ | Build tag of the latest build |
| `advanced` | `AssetBundleAdvancedOptions` | ❌ | `{ scale?, rotationEnabled?, algorithm? }` |
| `menuItems` | `ActionItem[]` | ❌ | Action menu items |
| `onMenuItemClick` | `(key: string) => void` | ❌ | Called when menu item clicked |
| `onBuildClick` | `() => void` | ❌ | Called when build button clicked |
| `loading` | `boolean` | ❌ | Skeleton state |
| `className` | `string` | ❌ | Additional CSS class |

---

### BitmapFontGenerator

A canvas-based tool for generating bitmap font spritesheets (PNG + XML) with configurable fill, border, drop shadow, and glyph set.

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `fontFamily` | `string` | ❌ | Font family to render |
| `fontSize` | `number` | ❌ | Font size in pixels |
| `fill` | `BitmapFontFill` | ❌ | `{ type: 'solid' \| 'gradient', color?, gradientColors?, gradientAngle? }` |
| `border` | `BitmapFontBorder` | ❌ | `{ color, thickness }` |
| `dropShadow` | `BitmapFontDropShadow` | ❌ | `{ color, size }` |
| `glyphs` | `string` | ❌ | Characters to include in the atlas |
| `text` | `string` | ❌ | Preview text |
| `onGenerate` | `(output: BitmapFontOutput) => void` | ❌ | `{ png: Blob, xml: string, glyphs: BitmapFontGlyph[] }` |
| `disabled` | `boolean` | ❌ | Disables generation |
| `className` | `string` | ❌ | Additional CSS class |

---

### Build

A build record card showing status icon, name, date, size, duration, badge, and an action menu.

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `name` | `string` | ❌ | Build name |
| `date` | `string` | ❌ | Build date string |
| `size` | `number` | ❌ | Size in bytes |
| `duration` | `number` | ❌ | Duration in milliseconds |
| `status` | `'pass' \| 'fail' \| 'running' \| 'queued'` | ❌ | Build status (default: `'pass'`) |
| `badge` | `string` | ❌ | Optional label badge text |
| `badgeVariant` | `string` | ❌ | Badge color variant |
| `menuItems` | `ActionItem[]` | ❌ | Action menu items |
| `onMenuItemClick` | `(key: string) => void` | ❌ | Called when menu item clicked |
| `loading` | `boolean` | ❌ | Skeleton state |
| `className` | `string` | ❌ | Additional CSS class |

---

### CardOptions

A grid of single-select option cards, each with an icon/image, title, and description.

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `options` | `CardOption[]` | ✅ | `{ key, title, description, icon?, imgSrc? }` |
| `value` | `string \| null` | ❌ | Selected option key |
| `onChange` | `(key: string) => void` | ❌ | Called when selection changes |
| `columns` | `number` | ❌ | Grid columns |
| `className` | `string` | ❌ | Additional CSS class |

```tsx
import { CardOptions, CardOption } from '@toolcase/react-components'

const options: CardOption[] = [
  { key: 'unity', title: 'Unity', description: 'Cross-platform engine', icon: 'box' },
  { key: 'godot', title: 'Godot', description: 'Open source engine', icon: 'gem' },
]

<CardOptions options={options} value={engine} onChange={setEngine} columns={2} />
```

---

### Changelog

A scrollable list of product update entries with date, title, description, and optional tag.

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `entries` | `ChangelogEntry[]` | ✅ | `{ id?, date, title, description, tag? }` |
| `readMoreHref` | `string` | ✅ | URL for the "View full changelog" link |
| `maxVisible` | `number` | ❌ | Max entries to show (default: `5`) |
| `readMoreLabel` | `string` | ❌ | Link label (default: `'View full changelog'`) |
| `loading` | `boolean` | ❌ | Skeleton state |

```tsx
import { Changelog, ChangelogEntry } from '@toolcase/react-components'

const entries: ChangelogEntry[] = [
  { date: '2026-04-01', title: 'v2.0 released', description: 'Major improvements.', tag: 'Major' },
  { date: '2026-03-15', title: 'Bug fixes', description: 'Various stability fixes.' },
]

<Changelog entries={entries} readMoreHref="/changelog" maxVisible={3} />
```

---

### Comparator

Compact side-by-side comparison of two technologies across multiple features. Auto-detects winners from booleans (`true` > `false`) and numbers (higher wins by default; `lowerIsBetter` flips it). Winners are conveyed visually only — green tint + border on winning cells, a colored bottom-accent on the leading tech header, and a green-bordered card in the optional summary footer (no "Winner" text). Screen-reader-only "Better option" / "Leading overall" labels keep it accessible. Mobile-first: feature info stacks above the two value cells under 768px; aligns into 3-column grid above.

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `left` | `ComparatorTechnology` | ✅ | Left-side technology card |
| `right` | `ComparatorTechnology` | ✅ | Right-side technology card |
| `features` | `ComparatorFeature[]` | ✅ | Comparison rows |
| `title` | `string` | ❌ | Heading above the comparison |
| `description` | `string` | ❌ | Subheading text |
| `showSummary` | `boolean` | ❌ | Render aggregate win-count footer (default: `false`) |
| `loading` | `boolean` | ❌ | Skeleton state |
| `loadingCount` | `number` | ❌ | Skeleton row count (default: `4`) |

**`ComparatorTechnology`:** `{ name, tagline?, icon?: ReactNode, iconName?: string, accentColor?: string }`

**`ComparatorFeature`:** `{ id?, name, description?, left, right, winner?: 'left' | 'right' | 'tie', leftLabel?, rightLabel?, highlight?, lowerIsBetter? }`

`left`/`right` accept `boolean | number | string | ReactNode`. Booleans render as a check/x icon with "Yes"/"No". Use `leftLabel`/`rightLabel` to override the rendered text (handy for numeric values: `left: 44, leftLabel: '44 KB'`).

```tsx
import { Comparator, type ComparatorFeature } from '@toolcase/react-components'

const features: ComparatorFeature[] = [
  { name: 'Bundle size', left: 44, right: 34, lowerIsBetter: true, leftLabel: '44 KB', rightLabel: '34 KB' },
  { name: 'Built-in store', left: false, right: true },
  { name: 'TypeScript DX', left: true, right: true },
]

<Comparator
  title="React vs Vue"
  left={{ name: 'React', iconName: 'lightning-charge-fill', accentColor: '#61dafb' }}
  right={{ name: 'Vue', iconName: 'gem', accentColor: '#42b883' }}
  features={features}
  showSummary
/>
```

---

### Hero

A full-width landing page hero with eyebrow text, title, description, CTA buttons, stat cards, and decorative background icons.

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `title` | `string` | ✅ | Hero headline |
| `description` | `string` | ✅ | Sub-headline |
| `primaryAction` | `HeroAction` | ✅ | Primary CTA button |
| `eyebrow` | `string` | ❌ | Small label above the title |
| `secondaryAction` | `HeroAction` | ❌ | Secondary CTA button |
| `statCards` | `HeroStatCard[]` | ❌ | `{ label, value, helper? }` |
| `metrics` | `HeroMetric[]` | ❌ | Inline metrics `{ label, value, helper? }` |
| `bgIcons` | `string[]` | ❌ | Bootstrap Icon names for background decoration |
| `backgroundPatternSrc` | `string` | ❌ | Background pattern image URL |
| `backgroundPattern` | `ReactNode` | ❌ | Custom background element |

```tsx
import { Hero } from '@toolcase/react-components'

<Hero
  eyebrow="Introducing v2"
  title="Build better UIs, faster."
  description="A complete React component library for modern web apps."
  primaryAction={{ label: 'Get Started', href: '/docs', variant: 'primary' }}
  secondaryAction={{ label: 'View on GitHub', href: 'https://github.com/...', outline: true, external: true }}
  statCards={[
    { label: 'Components', value: '80+' },
    { label: 'Bundle size', value: '< 300 KB' },
  ]}
  bgIcons={['rocket-takeoff', 'code-slash', 'lightning-charge']}
/>
```

---

### MultiCardSelect

A grid of multi-selectable cards with checkbox indicators, title, and optional description.

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `options` | `MultiCardSelectOption[]` | ✅ | `{ key, title, description? }` |
| `value` | `string[]` | ❌ | Controlled selected keys |
| `onChange` | `(selected: string[]) => void` | ❌ | Called when selection changes |
| `columns` | `number` | ❌ | Grid columns |
| `loading` | `boolean` | ❌ | Skeleton cards |
| `loadingCount` | `number` | ❌ | Number of skeleton cards (default: `4`) |
| `className` | `string` | ❌ | Additional CSS class |

```tsx
import { MultiCardSelect, MultiCardSelectOption } from '@toolcase/react-components'

const features: MultiCardSelectOption[] = [
  { key: 'auth', title: 'Authentication', description: 'User login and registration' },
  { key: 'analytics', title: 'Analytics', description: 'Usage tracking and reporting' },
  { key: 'payments', title: 'Payments', description: 'Stripe integration' },
]

<MultiCardSelect
  options={features}
  value={selected}
  onChange={setSelected}
  columns={3}
/>
```

---

### Timeline

A vertical timeline with status states, card variants, animated hover/active dots, and skeleton loading. Mobile-first: single-column under 768px, alternating two-column above.

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `items` | `TimelineItem[]` | ✅ | Timeline entries (see below) |
| `variant` | `'default' \| 'glass' \| 'outlined' \| 'elevated' \| 'minimal'` | ❌ | Card style (default: `'default'`) |
| `connector` | `'gradient' \| 'solid' \| 'dashed'` | ❌ | Rail style (default: `'gradient'`) |
| `overlap` | `number` | ❌ | Global card overlap offset in px |
| `loading` | `boolean` | ❌ | Skeleton cards |
| `loadingCount` | `number` | ❌ | Number of skeleton cards (default: `3`) |

**`TimelineItem`:** `{ title, date, description?, side?: 'left' | 'right', subtitle?, badge?, meta?, icon?, actions?, status?: 'completed' | 'active' | 'upcoming', overlap?, tags?: string[], progress?: number, accentColor?: string }`

`progress` (0–100) renders a bar at the bottom of the card. `accentColor` overrides the dot/badge/icon hue per item. Active items pulse continuously; dots scale + glow on hover/focus.

```tsx
import { Timeline, TimelineItem } from '@toolcase/react-components'

const items: TimelineItem[] = [
  { title: 'Project created', date: '2025-01-01', status: 'completed', tags: ['Planning'] },
  { title: 'Beta', date: '2025-02-15', status: 'active', progress: 62, description: 'Initial release' },
  { title: 'Launch', date: '2026-01-01', status: 'upcoming', badge: 'Planned' },
]

<Timeline items={items} variant="glass" connector="dashed" />
```

---

### ToggleCard

A card-shaped toggle switch with label, hint text, icon, and badge — ideal for feature flags and settings screens.

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `label` | `string` | ✅ | Primary label |
| `checked` | `boolean` | ❌ | Toggle state |
| `onChange` | `(checked: boolean) => void` | ❌ | Called on toggle |
| `hint` | `string` | ❌ | Secondary description |
| `icon` | `string` | ❌ | Bootstrap Icon class (e.g. `'bi-rocket-takeoff'`) |
| `badge` | `ReactNode` | ❌ | Badge in the top-right corner |
| `disabled` | `boolean` | ❌ | Disables interaction |
| `loading` | `boolean` | ❌ | Skeleton state |
| `className` | `string` | ❌ | Additional CSS class |

```tsx
import { ToggleCard, Badge } from '@toolcase/react-components'

<ToggleCard
  label="Dark Mode"
  hint="Switch between light and dark themes."
  icon="bi-moon-stars"
  checked={darkMode}
  onChange={setDarkMode}
  badge={<Badge variant="info" size="sm">New</Badge>}
/>
```

---

### Stepper

Visual step-progress indicator for multi-step workflows. Supports horizontal and vertical orientations, auto-derived statuses from `activeStep`, explicit per-step statuses (pending/active/completed/error), and clickable steps.

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `steps` | `StepItem[]` | ✅ | Array of `{ key, title, description?, status?, disabled? }` |
| `activeStep` | `string` | ❌ | Key of the active step; auto-derives statuses from index position |
| `orientation` | `'horizontal' \| 'vertical'` | ❌ | Layout direction (default: `'horizontal'`) |
| `clickable` | `boolean` | ❌ | Makes completed/active steps into buttons (default: `false`) |
| `onStepClick` | `(key: string) => void` | ❌ | Called when a clickable step is pressed |
| `className` | `string` | ❌ | Additional CSS class |

`StepStatus`: `'pending' | 'active' | 'completed' | 'error'`

```tsx
import { Stepper } from '@toolcase/react-components'

const steps = [
  { key: 'account', title: 'Account', description: 'Create your account' },
  { key: 'profile', title: 'Profile', description: 'Set up your profile' },
  { key: 'confirm', title: 'Confirm', description: 'Review & submit' },
]

// Auto-derive statuses
<Stepper steps={steps} activeStep="profile" />

// Clickable + vertical
<Stepper steps={steps} activeStep={active} orientation="vertical" clickable onStepClick={setActive} />
```

---

### NumberInput

Numeric input with decrement/increment buttons, keyboard shortcuts (Arrow keys, Page Up/Down), mouse wheel support, min/max/step/precision constraints, and optional prefix/suffix slots.

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `value` | `number \| ''` | ❌ | Controlled value; `''` represents empty |
| `onChange` | `(value: number \| '') => void` | ❌ | Called on value change |
| `step` | `number` | ❌ | Increment/decrement amount (default: `1`) |
| `min` | `number` | ❌ | Minimum value |
| `max` | `number` | ❌ | Maximum value |
| `precision` | `number` | ❌ | Decimal places to round to |
| `label` | `string` | ❌ | Label rendered above the control |
| `error` | `string` | ❌ | Error message; triggers invalid state |
| `prefix` | `ReactNode` | ❌ | Content shown before the input (e.g. `'$'`) |
| `suffix` | `ReactNode` | ❌ | Content shown after the input (e.g. `'%'`) |
| `className` | `string` | ❌ | Additional CSS class on the root |

Also accepts all `HTMLInputElement` attributes except `type`, `value`, and `onChange`.

```tsx
import { NumberInput } from '@toolcase/react-components'

const [qty, setQty] = useState<number | ''>(1)

<NumberInput
  label="Quantity"
  value={qty}
  onChange={setQty}
  min={0}
  max={99}
  step={1}
/>

// With prefix/suffix
<NumberInput label="Price" value={price} onChange={setPrice} prefix="$" precision={2} min={0} />
```

---

### Slider

Range slider with custom styling, keyboard navigation, drag tooltip, and optional tick marks. Wraps a native `<input type="range">` for accessibility.

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `value` | `number` | ❌ | Controlled value |
| `onChange` | `(value: number) => void` | ❌ | Called on value change |
| `min` | `number` | ❌ | Minimum value (default: `0`) |
| `max` | `number` | ❌ | Maximum value (default: `100`) |
| `step` | `number` | ❌ | Step size (default: `1`) |
| `ticks` | `boolean` | ❌ | Show tick marks at each step (default: `false`) |
| `showTooltip` | `boolean` | ❌ | Show floating tooltip while dragging (default: `true`) |
| `formatValue` | `(v: number) => string` | ❌ | Custom formatter for display labels and tooltip |
| `label` | `string` | ❌ | Label rendered above the track with current value |
| `error` | `string` | ❌ | Error message |
| `disabled` | `boolean` | ❌ | Disables all interaction |
| `className` | `string` | ❌ | Additional CSS class |

```tsx
import { Slider } from '@toolcase/react-components'

const [volume, setVolume] = useState(60)

<Slider label="Volume" value={volume} onChange={setVolume} />

// With ticks and custom formatter
<Slider
  label="Rating"
  value={rating}
  onChange={setRating}
  min={1} max={5} step={1}
  ticks
  formatValue={(v) => `${v}★`}
/>
```


---

### RangeSlider

Dual-thumb range slider for selecting a numeric interval.

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `value` | `[number, number]` | ✅ | Current selection |
| `onChange` | `(v: [number, number]) => void` | ✅ | Called on thumb move |
| `min` | `number` | ❌ | Track minimum (default: `0`) |
| `max` | `number` | ❌ | Track maximum (default: `100`) |
| `step` | `number` | ❌ | Step size (default: `1`) |
| `ticks` | `boolean` | ❌ | Show tick marks |
| `label` | `string` | ❌ | Label above track |
| `error` | `string` | ❌ | Error message |
| `disabled` | `boolean` | ❌ | Disables interaction |

```tsx
import { RangeSlider } from '@toolcase/react-components'
const [range, setRange] = useState<[number, number]>([20, 80])
<RangeSlider label="Price" value={range} onChange={setRange} min={0} max={500} />
```

---

### Rating

Star rating with hover preview and optional half-star support.

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `value` | `number` | ✅ | Current rating |
| `onChange` | `(v: number) => void` | ❌ | Called on selection |
| `count` | `number` | ❌ | Total stars (default: `5`) |
| `allowHalf` | `boolean` | ❌ | Allow half-star values |
| `readOnly` | `boolean` | ❌ | No interaction |
| `size` | `'small' | 'default' | 'large'` | ❌ | Icon size |
| `label` | `string` | ❌ | Accessible group label |

```tsx
import { Rating } from '@toolcase/react-components'
const [stars, setStars] = useState(0)
<Rating label="Rate" value={stars} onChange={setStars} allowHalf />
```

---

### OTPInput

Per-digit OTP input with auto-focus, paste support, and masking.

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `value` | `string` | ✅ | Controlled OTP string |
| `onChange` | `(v: string) => void` | ✅ | Called on change |
| `length` | `number` | ❌ | Number of cells (default: `6`) |
| `mode` | `'numeric' | 'alphanumeric'` | ❌ | Accepted chars |
| `masked` | `boolean` | ❌ | Password-dot rendering |
| `label` | `string` | ❌ | Label |
| `error` | `string` | ❌ | Error message |
| `disabled` | `boolean` | ❌ | Disables all cells |

```tsx
import { OTPInput } from '@toolcase/react-components'
const [otp, setOtp] = useState('')
<OTPInput label="Code" length={6} value={otp} onChange={setOtp} />
```

---

### PhoneInput

Phone number field with built-in country selector (flag + dial code).

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `value` | `string` | ✅ | Controlled phone string |
| `onChange` | `(v: string) => void` | ✅ | Called on change |
| `defaultCountry` | `string` | ❌ | ISO-2 code (default: `'US'`) |
| `label` | `string` | ❌ | Label |
| `error` | `string` | ❌ | Error message |
| `disabled` | `boolean` | ❌ | Disables input |

```tsx
import { PhoneInput } from '@toolcase/react-components'
const [phone, setPhone] = useState('')
<PhoneInput label="Phone" value={phone} onChange={setPhone} defaultCountry="US" />
```

---

### TreeView

Hierarchical collapsible tree with keyboard navigation and optional checkboxes.

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `nodes` | `TreeNode[]` | ✅ | Root nodes |
| `selected` | `string[]` | ✅ | Selected keys |
| `onSelect` | `(keys: string[]) => void` | ✅ | Selection change |
| `expanded` | `string[]` | ✅ | Expanded keys |
| `onExpandChange` | `(keys: string[]) => void` | ✅ | Expand/collapse change |
| `checkboxMode` | `boolean` | ❌ | Show checkboxes |

```tsx
import { TreeView, TreeNode } from '@toolcase/react-components'
<TreeView nodes={nodes} selected={sel} onSelect={setSel} expanded={exp} onExpandChange={setExp} />
```

---

### ScrollArea

Styled scrollable container with custom thin scrollbar.

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `maxHeight` | `number | string` | ❌ | Max height before scrolling |
| `maxWidth` | `number | string` | ❌ | Max width before scrolling |
| `axis` | `'x' | 'y' | 'both'` | ❌ | Scroll axis (default: `'y'`) |
| `children` | `ReactNode` | ✅ | Content |

```tsx
import { ScrollArea } from '@toolcase/react-components'
<ScrollArea maxHeight={300}>{content}</ScrollArea>
```

---

### ResizablePanel

Split-pane container with draggable divider; double-click resets sizes.

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `children` | `[ReactNode, ReactNode]` | ✅ | Two panel contents |
| `direction` | `'horizontal' | 'vertical'` | ❌ | Split direction |
| `defaultSizes` | `[number, number]` | ❌ | Initial percentages |
| `minSize` | `number` | ❌ | Min panel % (default: `10`) |
| `storageKey` | `string` | ❌ | Persist sizes to localStorage |

```tsx
import { ResizablePanel } from '@toolcase/react-components'
<ResizablePanel defaultSizes={[40, 60]} style={{ height: 300 }}>
  <div>Left</div>
  <div>Right</div>
</ResizablePanel>
```

---

### VirtualList

Windowed list rendering — only visible rows are in the DOM.

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `items` | `T[]` | ✅ | Full data array |
| `itemHeight` | `number` | ✅ | Fixed row height in px |
| `renderItem` | `(item: T, index: number) => ReactNode` | ✅ | Row renderer |
| `height` | `number` | ✅ | Container height in px |
| `overscan` | `number` | ❌ | Extra rows above/below |
| `onEndReached` | `() => void` | ❌ | Called near end |

```tsx
import { VirtualList } from '@toolcase/react-components'
<VirtualList items={data} itemHeight={60} height={400} renderItem={(item) => <div>{item.name}</div>} />
```

---

### InfiniteScroll

Triggers load-more via IntersectionObserver when a sentinel element enters view.

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `onLoadMore` | `() => void` | ✅ | Called when more is needed |
| `hasMore` | `boolean` | ✅ | Whether more content exists |
| `loading` | `boolean` | ❌ | Shows loading indicator |
| `children` | `ReactNode` | ✅ | Current list content |
| `endSlot` | `ReactNode` | ❌ | Shown when `hasMore` is false |

```tsx
import { InfiniteScroll } from '@toolcase/react-components'
<InfiniteScroll onLoadMore={loadMore} hasMore={hasMore} loading={loading}>
  {items.map((i) => <div key={i.id}>{i.title}</div>)}
</InfiniteScroll>
```

---

### TimePicker

Dropdown time picker with 12h/24h, minute steps, optional seconds, and clear.

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `value` | `string` | ✅ | `HH:MM` or `HH:MM:SS` |
| `onChange` | `(v: string) => void` | ✅ | Called on selection |
| `format` | `'12h' | '24h'` | ❌ | Display format |
| `minuteStep` | `number` | ❌ | Minute increment |
| `showSeconds` | `boolean` | ❌ | Add seconds column |
| `clearable` | `boolean` | ❌ | Show clear button |
| `label` | `string` | ❌ | Label |
| `error` | `string` | ❌ | Error message |
| `disabled` | `boolean` | ❌ | Disables picker |

```tsx
import { TimePicker } from '@toolcase/react-components'
const [time, setTime] = useState('09:00')
<TimePicker label="Start" value={time} onChange={setTime} format="12h" minuteStep={15} clearable />
```

---

### MarkdownEditor

Write/preview Markdown editor with formatting toolbar. Preview sandboxed in iframe.

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `value` | `string` | ✅ | Controlled Markdown |
| `onChange` | `(v: string) => void` | ✅ | Called on change |
| `height` | `number` | ❌ | Editor height in px |
| `toolbar` | `boolean` | ❌ | Show formatting toolbar |
| `placeholder` | `string` | ❌ | Textarea placeholder |
| `label` | `string` | ❌ | Label |
| `disabled` | `boolean` | ❌ | Read-only mode |

```tsx
import { MarkdownEditor } from '@toolcase/react-components'
const [md, setMd] = useState('')
<MarkdownEditor label="Description" value={md} onChange={setMd} height={360} toolbar />
```

---

### Carousel

Slide carousel with auto-play, touch/pointer swipe, dots, and arrows.

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `children` | `ReactNode[]` | ✅ | Slide elements |
| `autoPlay` | `boolean` | ❌ | Auto-advance slides |
| `interval` | `number` | ❌ | Auto-play interval ms (default: `3000`) |
| `showDots` | `boolean` | ❌ | Dot indicators |
| `showArrows` | `boolean` | ❌ | Arrow buttons |
| `loop` | `boolean` | ❌ | Wrap at ends |

```tsx
import { Carousel } from '@toolcase/react-components'
<Carousel autoPlay loop showArrows showDots>
  <img src="s1.jpg" alt="Slide 1" />
  <img src="s2.jpg" alt="Slide 2" />
</Carousel>
```

---

### ImageCrop

Canvas-based image cropper with pan/zoom, aspect ratio lock, and circular mask.

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `src` | `string` | ✅ | Image URL |
| `onCrop` | `(blob: Blob) => void` | ✅ | Result blob callback |
| `aspectRatio` | `number` | ❌ | Lock aspect ratio (e.g. `16/9`) |
| `circular` | `boolean` | ❌ | Circular crop mask |

```tsx
import { ImageCrop } from '@toolcase/react-components'
<ImageCrop src="/photo.jpg" aspectRatio={1} circular onCrop={(b) => upload(b)} />
```

---

### Lightbox

Full-screen image viewer portal with keyboard navigation, thumbnails, and captions.

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `images` | `LightboxImage[]` | ✅ | Array of `{ src, alt, caption? }` |
| `open` | `boolean` | ✅ | Visibility flag |
| `onClose` | `() => void` | ✅ | Close handler |
| `initialIndex` | `number` | ❌ | Starting image index |

```tsx
import { Lightbox, LightboxImage } from '@toolcase/react-components'
<Lightbox images={images} open={open} onClose={() => setOpen(false)} />
```

---

### Banner

Page-level informational banner with variants, dismiss, action, and localStorage persistence.

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `children` | `ReactNode` | ✅ | Message content |
| `variant` | `'info' | 'warning' | 'success' | 'error'` | ❌ | Visual style |
| `dismissible` | `boolean` | ❌ | Show close button |
| `storageKey` | `string` | ❌ | localStorage key to remember dismissal |
| `action` | `ReactNode` | ❌ | Action element (e.g. a Button) |
| `onDismiss` | `() => void` | ❌ | Called on dismiss |

```tsx
import { Banner } from '@toolcase/react-components'
<Banner variant="info" dismissible storageKey="welcome">
  New version available!
</Banner>
```

---

### ActionRowList

A vertical list of action rows. Each row has an icon, title, description, and a trailing call-to-action button. The workhorse pattern for *Account*, *Security*, and *Danger Zone* pages — one row maps to one discrete admin operation. A single `onActionClick(key)` handler receives the row key.

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `actions` | `ActionRow[]` | ✅ | Row definitions |
| `onActionClick` | `(key: string) => void` | ✅ | Fires with the clicked row's `key` |
| `outline` | `boolean` | ❌ | Render buttons as outline style (default: `true`) |
| `trailingIcon` | `string \| null` | ❌ | Trailing icon name; pass `null` to omit (default: `'arrow-right'`) |
| `className` | `string` | ❌ | Additional CSS class |

**`ActionRow`:** `{ key, icon, title, description, buttonText, buttonVariant?, disabled? }`

```tsx
import { ActionRowList } from '@toolcase/react-components'

<ActionRowList
  onActionClick={(key) => console.log('action:', key)}
  actions={[
    {
      key: '2fa',
      icon: 'phone',
      title: 'Two-factor authentication',
      description: 'Add a second factor via TOTP or WebAuthn.',
      buttonText: 'Enable',
      buttonVariant: 'success',
    },
    {
      key: 'delete',
      icon: 'trash',
      title: 'Delete account',
      description: 'Permanently delete this account.',
      buttonText: 'Delete',
      buttonVariant: 'danger',
    },
  ]}
/>
```

---

### LinkedProvidersCard

Lists third-party identity providers (Google, GitHub, Discord, etc.) linked to a user, with brand-tinted circular icons. Composes `SectionCard`. Ships a built-in brand-color map — extend via `brandColors` and plug in custom icon names via `iconForProvider`.

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `providers` | `LinkedProvider[]` | ✅ | List of linked providers |
| `title` | `string` | ❌ | Section title (default: `'Providers'`) |
| `brandColors` | `Record<string, string>` | ❌ | Merged over `defaultProviderBrandColors` |
| `iconForProvider` | `(key: string) => string` | ❌ | Override the default Bootstrap-Icon name per provider |
| `emptyLabel` | `string` | ❌ | Shown when `providers` is empty (default: `'No linked providers'`) |
| `className` | `string` | ❌ | Additional CSS class |

**`LinkedProvider`:** `{ id, provider, identifier }`

Also exports `defaultProviderBrandColors` so callers can spread it when extending.

```tsx
import { LinkedProvidersCard } from '@toolcase/react-components'

<LinkedProvidersCard
  providers={[
    { id: '1', provider: 'google', identifier: 'jordan@atlas.example.com' },
    { id: '2', provider: 'github', identifier: '@jordanliu' },
  ]}
/>
```

---

## Charts

All chart components are accessed via the unified `<Chart>` wrapper using a discriminated union `chart` prop.

```tsx
import { Chart } from '@toolcase/react-components'
<Chart chart={{ type: 'bar', data: [...], title: 'Revenue' }} />
```

### Chart (wrapper)

Unified chart dispatcher. Renders `<div className="component component-chart component-chart--{type}">`.

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `chart` | `ChartProps` | ✅ | Discriminated union — set `type` to select chart variant |
| `className` | `string` | ❌ | Extra class on root wrapper |
| `children` | `ReactNode` | ❌ | Forwarded to `container` type only |

### TrendIndicator

Inline badge showing a numeric or string trend value with directional arrow.

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `value` | `number \| string` | ✅ | Display value (e.g. `12.5` or `'+ 18%'`) |
| `direction` | `'up' \| 'down' \| 'neutral'` | ❌ | Auto-detected from numeric value if omitted |
| `size` | `'small' \| 'default' \| 'large'` | ❌ | Text size |

```tsx
<Chart chart={{ type: 'trend-indicator', value: 12.5 }} />
<Chart chart={{ type: 'trend-indicator', value: '+ 18%', direction: 'up', size: 'large' }} />
```

### Sparkline

Compact inline SVG chart (line or bar) for showing a data trend.

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `data` | `number[]` | ✅ | Data points |
| `sparklineType` | `'line' \| 'bar'` | ❌ | Chart style (default `'line'`) |
| `color` | `string` | ❌ | Stroke/fill color (default `'#6366f1'`) |
| `height` | `number` | ❌ | SVG height (default `32`) |
| `width` | `number` | ❌ | SVG width (default `120`) |

```tsx
<Chart chart={{ type: 'sparkline', data: [10, 22, 35, 28, 42] }} />
```

### BarChart

Vertical or horizontal bar chart with optional hover tooltip, click handler, and loading state.

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `data` | `BarChartDataItem[]` | ✅ | `{ label, value, color? }` array |
| `title` | `string` | ❌ | Chart title |
| `subtitle` | `string` | ❌ | Chart subtitle |
| `orientation` | `'vertical' \| 'horizontal'` | ❌ | Default `'vertical'` |
| `height` | `number` | ❌ | SVG height (default `260`) |
| `showValues` | `boolean` | ❌ | Show value labels on bars |
| `yFormatter` | `(v: number) => string` | ❌ | Y-axis label formatter |
| `onClick` | `(item, idx) => void` | ❌ | Bar click callback |
| `loading` | `boolean` | ❌ | Shows skeleton |

```tsx
<Chart chart={{ type: 'bar', data: [{ label: 'Jan', value: 4200 }], title: 'Revenue' }} />
```

### LineChart

Multi-series line chart with grid, hover tooltips, and horizontal legend.

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `series` | `LineChartSeries[]` | ✅ | `{ label, data: LineChartPoint[], color? }` |
| `title` | `string` | ❌ | Chart title |
| `height` | `number` | ❌ | Default `260` |
| `showGrid` | `boolean` | ❌ | Default `true` |
| `showLegend` | `boolean` | ❌ | Default `true` |
| `xFormatter` | `(v) => string` | ❌ | X-axis label formatter |
| `yFormatter` | `(v) => string` | ❌ | Y-axis label formatter |
| `loading` | `boolean` | ❌ | Shows skeleton |

```tsx
<Chart chart={{ type: 'line', series: [{ label: 'Revenue', data: [{ x: 'Jan', y: 4200 }] }] }} />
```

### AreaChart

Same as LineChart with a translucent area fill under each series line.

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `series` | `LineChartSeries[]` | ✅ | Same as LineChart |
| `title` | `string` | ❌ | Chart title |
| `height` | `number` | ❌ | Default `260` |
| `showGrid` | `boolean` | ❌ | Default `true` |
| `showLegend` | `boolean` | ❌ | Default `true` |
| `loading` | `boolean` | ❌ | Shows skeleton |

```tsx
<Chart chart={{ type: 'area', series: [...], title: 'Trend' }} />
```

### PieChart / DonutChart

Pie chart with optional donut mode. Hover scales the active slice; legend shows percentages.

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `data` | `PieChartSlice[]` | ✅ | `{ label, value, color? }` |
| `title` | `string` | ❌ | Chart title |
| `donut` | `boolean` | ❌ | Render as donut |
| `centerLabel` | `string` | ❌ | Center text when no slice is hovered (donut only) |
| `showLegend` | `boolean` | ❌ | Default `true` |
| `height` | `number` | ❌ | Default `260` |
| `loading` | `boolean` | ❌ | Shows skeleton |

```tsx
<Chart chart={{ type: 'pie', data: [...], donut: true, centerLabel: 'Total' }} />
```

### Heatmap

Grid heatmap with color interpolation, row/col labels, and hover tooltip.

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `data` | `HeatmapCell[]` | ✅ | `{ row, col, value }` |
| `rows` | `(string\|number)[]` | ✅ | Row labels |
| `cols` | `(string\|number)[]` | ✅ | Column labels |
| `title` | `string` | ❌ | Chart title |
| `colorScale` | `string[]` | ❌ | Color stops for interpolation |
| `cellSize` | `number` | ❌ | Cell size in px (default `28`) |
| `loading` | `boolean` | ❌ | Shows skeleton |

```tsx
<Chart chart={{ type: 'heatmap', data: cells, rows: ['Mon', 'Tue'], cols: ['9am', '11am'] }} />
```

### FunnelChart

Trapezoid funnel chart. Each step narrower based on relative value.

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `data` | `FunnelStep[]` | ✅ | `{ label, value, color? }` (ordered top→bottom) |
| `title` | `string` | ❌ | Chart title |
| `height` | `number` | ❌ | Default `300` |
| `showLabels` | `boolean` | ❌ | Default `true` |
| `onClick` | `(step, idx) => void` | ❌ | Step click callback |
| `loading` | `boolean` | ❌ | Shows skeleton |

```tsx
<Chart chart={{ type: 'funnel', data: [{ label: 'Visitors', value: 12000 }, ...] }} />
```

### GanttChart

SVG-based Gantt chart with progress bars, date markers, and alternating row stripes.

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `tasks` | `GanttTask[]` | ✅ | Task objects |
| `title` | `string` | ❌ | Chart title |
| `startDate` | `string` | ❌ | ISO date — overrides auto-detected start |
| `endDate` | `string` | ❌ | ISO date — overrides auto-detected end |
| `onTaskClick` | `(task) => void` | ❌ | Task click callback |
| `loading` | `boolean` | ❌ | Shows skeleton |

`GanttTask`: `{ id, label, start (ISO), end (ISO), color?, progress? (0–100), dependencies? }`

```tsx
<Chart chart={{ type: 'gantt', tasks: [{ id: '1', label: 'Design', start: '2024-01-01', end: '2024-01-15' }] }} />
```

### ChartContainer

Layout wrapper for chart content with header, actions slot, loading spinner, and empty state.

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `title` | `string` | ❌ | Container title |
| `subtitle` | `string` | ❌ | Container subtitle |
| `children` | `ReactNode` | ❌ | Chart content |
| `actions` | `ReactNode` | ❌ | Header actions (e.g. buttons, filters) |
| `legend` | `ReactNode` | ❌ | Footer legend slot |
| `loading` | `boolean` | ❌ | Shows spinner overlay |
| `empty` | `boolean` | ❌ | Shows empty state |
| `emptySlot` | `ReactNode` | ❌ | Custom empty content |

```tsx
<Chart chart={{ type: 'container', title: 'Overview', loading: isLoading }}>
  <BarChart ... />
</Chart>
```

---

## Game Jam / Arcade

Components built for retro / arcade-style sprint hubs. Use the dark "neon" theme palette (pink / yellow / cyan / dashed borders / pixel fonts) — see `gamejam_template/styleguide.md`. Loaded fonts expected: `Press Start 2P`, `VT323`, `DM Mono`.

### BriefCard

Centered "challenge" card with icon, ID, difficulty pill, title, body, footer meta. Difficulty drives accent color across border, title, and pill.

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `id` | `string` | ✅ | Identifier label, e.g. `BRIEF · 047-A` |
| `icon` | `ReactNode` | ❌ | Decorative glyph above ID |
| `difficulty` | `'easy' \| 'medium' \| 'hard'` | ✅ | Accent palette |
| `title` | `ReactNode` | ✅ | Brief title |
| `body` | `ReactNode` | ✅ | Description |
| `metaLeft` | `ReactNode` | ❌ | Footer left text |
| `metaRight` | `ReactNode` | ❌ | Footer right text |
| `onClick` | `() => void` | ❌ | Makes the whole card a button |

```tsx
<BriefCard
    id="BRIEF · 047-A"
    icon="▼"
    difficulty="easy"
    title="COOPERATE WITHOUT SPEAKING"
    body="Two or more players must achieve something together — design forbids verbal or text communication."
    metaLeft="↳ 14 ATTESTS"
    metaRight="0 FLAGS"
/>
```

### ChipGroup

Wrapping container of toggleable chips. Each item supports `active`, `disabled`, and `count` suffix.

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `title` | `ReactNode` | ❌ | Group title |
| `subtitle` | `ReactNode` | ❌ | Group subtitle |
| `items` | `ChipGroupItem[]` | ✅ | `{ id, label, active?, disabled?, count? }` |
| `onToggle` | `(id: string) => void` | ❌ | Controlled toggle |
| `border` | `boolean` | ❌ | Wraps in dashed surface card |

```tsx
<ChipGroup
    title="ALLOWED GENRES"
    subtitle="SprintPool · 8 of 14 enabled"
    border
    items={[
        { id: 'rogue', label: 'ROGUELIKE', active: true, count: 11 },
        { id: 'puzzle', label: 'PUZZLE', active: true, count: 9 },
        { id: 'rts', label: 'RTS', disabled: true },
    ]}
    onToggle={(id) => console.log(id)}
/>
```

### CountdownTimer

DD/HH/MM/SS grid that counts down to a target Date. Pauses interval when tab hidden.

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `target` | `Date \| number` | ✅ | Target time (epoch ms or `Date`) |
| `units` | `('days'\|'hours'\|'minutes'\|'seconds')[]` | ❌ | Visible cells; default all four |
| `label` | `ReactNode` | ❌ | Top label |
| `subLabel` | `ReactNode` | ❌ | Footer line |
| `onExpire` | `() => void` | ❌ | Fires when target reached |
| `compact` | `boolean` | ❌ | Smaller variant |

```tsx
<CountdownTimer
    target={Date.now() + 11 * 86400000}
    label="« DROP DEADLINE — SPRINT 047 ENDS IN »"
    subLabel="…then sprint 048 auto-rolls."
/>
```

### CycleWheel

Rotating SVG ring with phase labels and a center "now" core. Decorative; pause-able.

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `phases` | `string[]` | ✅ | Labels around the ring |
| `currentIndex` | `number` | ✅ | Index of the active phase |
| `centerLabel` | `ReactNode` | ❌ | Top line in core |
| `centerValue` | `ReactNode` | ✅ | Big numeral / id |
| `centerPill` | `ReactNode` | ❌ | Status pill |
| `centerSub` | `ReactNode` | ❌ | Sub line below pill |
| `spinSeconds` | `number` | ❌ | Full rotation in seconds (default 60) |
| `paused` | `boolean` | ❌ | Stops rotation |

```tsx
<CycleWheel
    phases={['ROLL', 'BUILD', 'ATTEST', 'SHIP', 'CLOSE']}
    currentIndex={1}
    centerLabel="↻ NOW · СПРИНТ"
    centerValue="047"
    centerPill="OPEN"
    centerSub={<>DAY <b>03</b> / 14</>}
/>
```

### GameShowcaseCard

Game preview card with art slot, corner stamps, meta line, title, pitch, tags, and compliance dots.

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `art` | `ReactNode` | ❌ | Image / preview slot |
| `artPlaceholder` | `ReactNode` | ❌ | Placeholder when no `art` |
| `stamps` | `{ label, color? }[]` | ❌ | Top-left corner badges |
| `metaLeft` | `ReactNode` | ❌ | Top meta line left |
| `metaRight` | `ReactNode` | ❌ | Top meta line right |
| `title` | `ReactNode` | ✅ | Game title |
| `pitch` | `ReactNode` | ✅ | One-line pitch |
| `tags` | `string[]` | ❌ | Footer tags |
| `compliance` | `('yes'\|'no'\|'flag')[]` | ❌ | Compliance dots |
| `onClick` | `() => void` | ❌ | Whole card click |

```tsx
<GameShowcaseCard
    stamps={[{ label: 'FEATURED · +50', color: 'yellow' }]}
    metaLeft="VEX.KBD · #047-S12"
    metaRight="SPRINT 5/5"
    title="HUSH TOWER"
    pitch="A two-player co-op stacker where speaking aloud knocks the tower over."
    tags={['puzzle', 'silence']}
    compliance={['yes', 'yes', 'no']}
/>
```

### HeroStatsBar

Equal-width bordered cells with small uppercase key + huge VT323 value + small inline unit.

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `stats` | `HeroStat[]` | ✅ | `{ key, value, unit?, zero? }` |

```tsx
<HeroStatsBar stats={[
    { key: 'CYCLE', value: 14, unit: 'DAYS' },
    { key: 'SHIPPED', value: 46, unit: 'SPRINTS' },
    { key: 'OFF-SEASON', value: 0, unit: 'EVER', zero: true },
]} />
```

### Leaderboard

Ranked dev table: rank, avatar+handle, tier badge, sprints, 7-day trend, points. Highlight rows via `highlight: true`.

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `entries` | `LeaderboardEntry[]` | ✅ | Row data |
| `columns` | `{ rank?, dev?, tier?, sprints?, trend?, points? }` | ❌ | Header label overrides |

`LeaderboardEntry`: `{ id, rank, displayName, handle?, avatar?, tierLabel?, tierColor?, sprints?, trendValue?, trendDirection?, points, highlight? }`

```tsx
<Leaderboard entries={[
    { id: '1', rank: 1, displayName: 'vex.kbd', handle: '@vex_kbd', avatar: 'VK', tierLabel: 'ARCHITECT', tierColor: 'red', sprints: 22, trendValue: 84, trendDirection: 'up', points: '2,148' },
    { id: 'me', rank: 7, displayName: 'YOU', avatar: 'YO', tierLabel: 'JOURNEY', tierColor: 'yellow', sprints: 5, trendValue: 63, trendDirection: 'up', points: 412, highlight: true },
]} />
```

### LeaderboardTrend

Inline trend pill with up / down / flat arrow.

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `value` | `ReactNode` | ✅ | Trend value (e.g. `84`) |
| `direction` | `'up' \| 'down' \| 'flat'` | ✅ | Arrow + color |

```tsx
<LeaderboardTrend value={84} direction="up" />
```

### LiveFeed

Log-style timestamped event list. Header has optional "REC" pulsing indicator.

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `events` | `FeedEvent[]` | ✅ | `{ id, time, actor?, message, tags? }` |
| `header` | `ReactNode` | ❌ | Title (default `// LIVE FEED`) |
| `recording` | `boolean` | ❌ | Pulses REC dot |
| `maxRows` | `number` | ❌ | Cap visible rows |
| `autoScroll` | `boolean` | ❌ | Scroll to top on update |

`FeedEvent.tags`: `{ label, variant?: 'default' \| 'acid' \| 'red' \| 'cyan' }[]`

```tsx
<LiveFeed
    recording
    events={[
        { id: '1', time: '14:42', actor: 'vex.kbd', message: <>auto-featured <i>Hush Tower</i> · 27 unique reactors</>, tags: [{ label: '+50', variant: 'acid' }] },
        { id: '2', time: '14:31', actor: 'aft.fern', message: <>registered <i>Soft Static</i> in sprint 047</>, tags: [{ label: 'REGISTER' }] },
    ]}
/>
```

### Marquee

Continuously scrolling banner. Duplicates content twice for seamless loop.

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `items` | `ReactNode[]` | ✅ | Items rendered with separator between |
| `separator` | `ReactNode` | ❌ | Default `↻` |
| `speed` | `number` | ❌ | Loop seconds (default 50) |
| `direction` | `'left' \| 'right'` | ❌ | Scroll direction |
| `pauseOnHover` | `boolean` | ❌ | Pauses on hover |

```tsx
<Marquee items={[
    <>« THE JAM <span className="pink">NEVER STOPS</span> »</>,
    'EVERY 14 DAYS',
    'SPRINT 047 OPEN',
]} />
```

### PhaseGrid

Grid of phase cells with ordinal number, title, body, side tag, optional command. Status drives styling.

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `phases` | `PhaseItem[]` | ✅ | `{ num, title, body, tag?, command?, status? }` |
| `columns` | `number` | ❌ | Default 4 |

`status ∈ 'done' | 'lit' | 'upcoming' | 'continuous'`.

```tsx
<PhaseGrid phases={[
    { num: '01', title: 'SPRINT OPEN', body: 'Fresh Sprint row in state announce.', tag: 'DONE ✓', command: '/sprint open', status: 'done' },
    { num: '04', title: 'REGISTER · SUBMIT', body: 'Devs register games, submit builds.', tag: '▸ NOW', command: '/register-game', status: 'lit' },
]} />
```

### PulseIndicator

Inline blinking dot + label ("LIVE · 142 ONLINE"). Color customizable.

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `label` | `ReactNode` | ✅ | Text after dot |
| `color` | `string` | ❌ | CSS color (default pink) |
| `paused` | `boolean` | ❌ | Stops blinking |

```tsx
<PulseIndicator label="LIVE · 142 ONLINE" />
```

### RankCell

Rank numeral with top-3 color tint (top1 yellow / top2 cyan / top3 pink).

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `rank` | `number` | ✅ | 1-based rank |
| `pad` | `number` | ❌ | Zero-pad width (default 2) |

```tsx
<RankCell rank={1} />
```

### ScoringRules

Vertical stack of scoring rule rows: `icon | title + description | points`.

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `rules` | `ScoringRule[]` | ✅ | `{ icon?, title, description, points, suffix?, accent? }` |

`accent ∈ 'pink' | 'yellow' | 'cyan' | 'green' | 'red'`.

```tsx
<ScoringRules rules={[
    { icon: '¶', title: 'GENERAL MSG · ≥40 CHARS', description: 'Substantive participation.', points: '+1', suffix: 'pt' },
    { icon: '★', title: 'SHOWCASE REACTIONS', description: 'Logarithmic scaling.', points: '≤30', suffix: 'pts' },
]} />
```

### SectionFlag

Pink Press Start title wrapped in `«…»` guillemets, with optional VT323 sub-line.

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `title` | `ReactNode` | ✅ | Title text |
| `subtitle` | `ReactNode` | ❌ | Subtitle line |
| `align` | `'left' \| 'center'` | ❌ | Default center |

```tsx
<SectionFlag
    title="3 БРИФА · ROLLED FOR SPRINT 047"
    subtitle="Seeded RNG drew one easy + one medium + one hard."
/>
```

### SprintChain

Horizontal track of equal-width cells (past / now / future) with auto-derived state.

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `items` | `SprintChainItem[]` | ✅ | `{ id, label, tag?, state? }` |
| `currentId` | `string` | ✅ | Item id that is `now` |
| `columns` | `number` | ❌ | Default = items.length |
| `header` | `ReactNode` | ❌ | Header start |
| `headerEnd` | `ReactNode` | ❌ | Header end |

```tsx
<SprintChain
    currentId="047"
    header="« THE CHAIN — past · future »"
    headerEnd="EVERY 14 DAYS · ∞"
    items={[
        { id: '045', label: '045', tag: 'closed ✓' },
        { id: '046', label: '046', tag: 'closed ✓' },
        { id: '047', label: '047', tag: '▸ OPEN' },
        { id: '048', label: '048', tag: 'queued' },
    ]}
/>
```

### Stamp

Solid colored corner badge — Press Start 8px. Position-able on parent corners.

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `label` | `ReactNode` | ✅ | Stamp text |
| `color` | `'pink'\|'yellow'\|'red'\|'cyan'\|'green'` | ❌ | Default pink |
| `position` | `'tl'\|'tr'\|'bl'\|'br'` | ❌ | Absolute-positions when set |

```tsx
<Stamp label="FEATURED · +50" color="yellow" position="tl" />
```

### StateMachine

Horizontal flat row of state cells. Variants: `done` / `active` / `reserved` / `future`.

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `states` | `StateMachineItem[]` | ✅ | `{ id, label, note?, status? }` |
| `compact` | `boolean` | ❌ | Smaller padding |

```tsx
<StateMachine states={[
    { id: 'announce', label: 'announce', note: 'briefs rolled', status: 'done' },
    { id: 'open', label: 'open', note: 'accepting builds', status: 'active' },
    { id: 'voting', label: 'voting', note: 'reserved', status: 'reserved' },
]} />
```

### TierLadder

Ranked tier list — colored dot + name + range. Highlights `currentTierId` row.

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `title` | `ReactNode` | ❌ | Top label |
| `tiers` | `TierItem[]` | ✅ | `{ id, name, range, color? }` |
| `currentTierId` | `string` | ❌ | Highlights "you" row |
| `summary` | `ReactNode` | ❌ | Footer summary line |

`color ∈ 'gray' | 'cyan' | 'yellow' | 'pink' | 'red'`.

```tsx
<TierLadder
    title="TIER LADDER · 90D ROLLING"
    currentTierId="journ"
    tiers={[
        { id: 'recruit', name: 'RECRUIT', range: '0 — 99', color: 'gray' },
        { id: 'appr', name: 'APPRENTICE', range: '100 — 299', color: 'cyan' },
        { id: 'journ', name: 'JOURNEYMAN', range: '300 — 699', color: 'yellow' },
        { id: 'mason', name: 'MASON', range: '700 — 1499', color: 'pink' },
        { id: 'arch', name: 'ARCHITECT', range: '1500+', color: 'red' },
    ]}
    summary={<>▸ You: <b>412 pts</b> · 90d rolling</>}
/>
```
