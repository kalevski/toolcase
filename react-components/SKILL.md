# @toolcase/react-components — Component Reference

A complete guide to every component in the library. Import any component from `@toolcase/react-components`.

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
  - [Card](#card)
  - [Divider](#divider)
  - [Form](#form)
  - [Group](#group)
  - [Spacer](#spacer)
  - [TabSections](#tabsections)
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
  - [AssetBundle](#assetbundle)
  - [BitmapFontGenerator](#bitmapfontgenerator)
  - [Build](#build)
  - [CardOptions](#cardoptions)
  - [Changelog](#changelog)
  - [Hero](#hero)
  - [MultiCardSelect](#multicardselect)
  - [Timeline](#timeline)
  - [ToggleCard](#togglecard)

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

### Card

A card container with an optional header and variant background coloring.

| Prop | Type | Required | Description |
|------|------|----------|-------------|
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

A Bootstrap Icons wrapper with automatic accessibility attributes.

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `name` | `string` | ✅ | Bootstrap Icon name (without `bi-` prefix) |
| `as` | `React.ElementType` | ❌ | Rendered element (default: `'i'`) |
| `size` | `number \| string` | ❌ | Font size override |
| `color` | `string` | ❌ | Color override |
| `label` | `string` | ❌ | Accessible label (makes the icon semantic) |
| `decorative` | `boolean` | ❌ | Force `aria-hidden="true"` |

```tsx
import { Icon } from '@toolcase/react-components'

// Decorative icon (aria-hidden automatically applied when no label)
<Icon name="star" size="1.5rem" color="#f59e0b" />

// Semantic icon with accessible label
<Icon name="check-circle" label="Verified" />
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

A vertical alternating timeline with status states, side placement, and skeleton loading.

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `items` | `TimelineItem[]` | ✅ | Timeline entries (see below) |
| `overlap` | `number` | ❌ | Global card overlap offset in px |
| `loading` | `boolean` | ❌ | Skeleton cards |
| `loadingCount` | `number` | ❌ | Number of skeleton cards (default: `3`) |

**`TimelineItem`:** `{ title, date, description?, side?: 'left' | 'right', subtitle?, badge?, meta?, icon?, actions?, status?: 'completed' | 'active' | 'upcoming', overlap? }`

```tsx
import { Timeline, TimelineItem } from '@toolcase/react-components'

const items: TimelineItem[] = [
  { title: 'Project created', date: '2025-01-01', status: 'completed', side: 'left' },
  { title: 'First build', date: '2025-02-15', status: 'completed', side: 'right', description: 'Initial release' },
  { title: 'Launch', date: '2026-01-01', status: 'upcoming', side: 'left', badge: 'Planned' },
]

<Timeline items={items} />
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
