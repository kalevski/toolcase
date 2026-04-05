# @toolcase/react-components

[![GitHub](https://img.shields.io/github/license/kalevski/toolcase?style=for-the-badge)](https://github.com/kalevski/toolcase/blob/main/LICENSE)
[![npm version](https://img.shields.io/npm/v/@toolcase/react-components?color=teal&label=VERSION&style=for-the-badge)](https://www.npmjs.com/package/@toolcase/react-components)

React component library built on top of Bootstrap and `@toolcase/base`. Provides layout primitives, form controls, data display, feedback, and advanced editor components.

## Install

```bash
npm install @toolcase/react-components
```

### Peer Dependencies

- `react` >= 18
- `react-dom` >= 18
- `@toolcase/base` 2.x

### Import Styles

```ts
import '@toolcase/react-components/style.css'
```

## Components

### Layout

| Component | Description |
|-----------|-------------|
| `BasicLayout` | Simple page shell with header, content, and footer slots |
| `DashboardLayout` | Sidebar + content layout for admin/dashboard UIs |
| `DashboardCard` | Card container for dashboard widgets |
| `SideNav` | Sidebar navigation component |
| `CoolNav` | Stylized navigation bar |
| `Spacer` | Spacing utility component |
| `Divider` | Horizontal or vertical divider |
| `Group` | Flexbox grouping container |

### Form Controls

| Component | Description |
|-----------|-------------|
| `Button` | Standard button with variants |
| `CoolButton` | Stylized button variant |
| `IconButton` | Icon-only button |
| `Input` | Text input field |
| `Textarea` | Multi-line text input |
| `Select` | Dropdown select |
| `ExtendedSelect` | Select with search and custom rendering |
| `Checkbox` | Single checkbox |
| `CheckboxGroup` | Group of checkboxes |
| `Radio` | Single radio button |
| `RadioGroup` | Group of radio buttons |
| `Switch` | Toggle switch |
| `ToggleCard` | Card-style toggle |
| `TagInput` | Input for adding/removing tags |
| `ColorPicker` | Color selection control |
| `DatePicker` | Date selection control |
| `IconPicker` | Icon selection control |
| `Form` | Form wrapper with submit handling |
| `FormInput` | Form-integrated input with validation |
| `FormWizard` | Multi-step form wizard |
| `EarlySignupForm` | Pre-built signup form |
| `Login` | Pre-built login form |

### Data Display

| Component | Description |
|-----------|-------------|
| `Table` | Data table |
| `Card` | Content card container |
| `CardOptions` | Card with selectable options |
| `MultiCardSelect` | Multi-select card grid |
| `SingleCardSelect` | Single-select card grid |
| `PricingCard` | Pre-styled pricing tier card |
| `Badge` | Status badge |
| `Avatar` | User avatar |
| `Icon` | Icon renderer |
| `Tag` | Labeled tag |
| `Chip` | Compact chip element |
| `StatusDot` | Colored status indicator |
| `ProgressBar` | Progress indicator bar |
| `Timeline` | Vertical timeline |
| `Changelog` | Changelog display |
| `UsageSummaryPanel` | Usage statistics panel |

### Text & Typography

| Component | Description |
|-----------|-------------|
| `Heading` | Section heading |
| `Text` | Body text |
| `Label` | Form label |
| `Link` | Styled anchor link |
| `Kbd` | Keyboard shortcut display |
| `CodeSnippet` | Code block with syntax display |
| `HelperText` | Hint or helper text |

### Feedback

| Component | Description |
|-----------|-------------|
| `Alert` | Alert/notification banner |
| `Spinner` | Loading spinner |
| `Skeleton` | Loading placeholder |
| `Tooltip` | Hover tooltip |
| `EmptyState` | Empty state placeholder |
| `Modal` | Modal dialog system (`Modal.Window`, `Modal.Control`, `Modal.Context`) |

### File Handling

| Component | Description |
|-----------|-------------|
| `FileDropzone` | Drag-and-drop file upload zone |
| `File` | File display component |
| `SimpleFile` | Simplified file display |
| `QueuedFile` | Queued file with progress |
| `FileTags` | File metadata tags |
| `AssetBundle` | Asset bundle display |

### Navigation & Branding

| Component | Description |
|-----------|-------------|
| `Brand` | Logo/brand display |
| `Hero` | Hero section |
| `PageFooter` | Page footer |
| `PinnedFeatureShowcase` | Feature highlight section |
| `UserPanel` | User profile panel |
| `Dropdown` | Dropdown menu |
| `TabSections` | Tabbed content sections |
| `WelcomeGuide` | Onboarding guide |

### Advanced

| Component | Description |
|-----------|-------------|
| `JSONEditor` | JSON editing widget |
| `JSONSchemaDef` | JSON Schema definition editor |
| `NodeEditor` | Node-based visual editor |
| `BitmapFontGenerator` | Bitmap font preview/generator |
| `ActionHeader` | Header with action buttons |
| `ActionItems` | Action item list |
| `Build` | Build status display |
| `DangerZoneActions` | Destructive action section |
| `VerticalItemList` | Vertical scrollable item list |
| `EditableText` | Inline editable text |
| `Image` | Image with loading states |
| `VisuallyHidden` | Screen-reader-only content |

## Styling

Styles are built with SCSS on top of Bootstrap. Import the bundled CSS:

```ts
import '@toolcase/react-components/style.css'
```

Component styles are namespaced and can be customized by overriding CSS variables or SCSS variables before importing.

## License

The project is licensed under [MIT License](https://github.com/kalevski/toolcase/blob/main/LICENSE)
