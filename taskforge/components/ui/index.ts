// Local UI kit — the React component surface that taskforge consumes
// (Button, Modal, Table, charts, …). Plain React + CSS (no web components), so
// it SSRs cleanly under Next.js. Import styles once from app/layout.tsx via
// `import '@/components/ui/styles.css'`.

import * as Modal from './modal'

export { Modal }

export { Icon } from './Icon'
export type { IconProps } from './Icon'

export { Heading, Text, HelperText, Kbd, Divider } from './Typography'
export type { HeadingProps, TextProps, HelperTextProps, KbdProps, DividerProps } from './Typography'

export { Button, IconButton } from './Button'
export type { ButtonProps, IconButtonProps } from './Button'

export {
    Input,
    Textarea,
    Select,
    Checkbox,
    Switch,
    NumberInput,
    RadioGroup,
} from './Form'
export type {
    InputProps,
    TextareaProps,
    SelectProps,
    SelectOption,
    SelectSize,
    CheckboxProps,
    CheckboxSize,
    SwitchProps,
    NumberInputProps,
    NumberInputSize,
    RadioGroupProps,
    RadioGroupOption,
} from './Form'

export {
    Badge,
    Tag,
    StatusDot,
    Avatar,
    Spinner,
    Card,
    ProgressBar,
    Breadcrumb,
    EmptyState,
} from './Display'
export type {
    BadgeProps,
    TagProps,
    StatusDotProps,
    AvatarProps,
    SpinnerProps,
    CardProps,
    ProgressBarProps,
    BreadcrumbProps,
    BreadcrumbItem,
    EmptyStateProps,
} from './Display'

export { Banner, AnnouncementBar, Tooltip } from './Feedback'
export type {
    BannerProps,
    AnnouncementBarProps,
    AnnouncementBarVariant,
    TooltipProps,
} from './Feedback'

export {
    Table,
    TerminalWindow,
    MetricGrid,
    MetricTile,
    UsageSummaryPanel,
    ChipGroup,
    TabSections,
} from './Data'
export type {
    TableColumn,
    TableProps,
    TerminalLine,
    TerminalLineKind,
    TerminalWindowProps,
    MetricGridProps,
    MetricTileProps,
    UsageSummaryPanelProps,
    UsageConfig,
    ChipGroupItem,
    ChipGroupProps,
    TabSectionsProps,
    TabSectionItem,
} from './Data'

export { LineChart, BarChart } from './Chart'
export type {
    LineChartProps,
    LineChartSeries,
    LineChartPoint,
    BarChartProps,
    BarChartDataItem,
} from './Chart'

export { Drawer } from './Drawer'
export type { DrawerProps } from './Drawer'

export { MarkdownEditor } from './MarkdownEditor'
export type { MarkdownEditorProps } from './MarkdownEditor'

export { ToastProvider, toast } from './Toast'
export type {
    ToastProviderProps,
    ToastOptions,
    ToastItem,
    ToastVariant,
    ToastPosition,
    ToastFn,
} from './Toast'

export { DashboardLayout, Brand, SideNav, UserPanel, Login } from './Layout'
export type {
    DashboardLayoutProps,
    BrandProps,
    SideNavProps,
    SideNavItem,
    SideNavSection,
    UserPanelProps,
    UserPanelMenuItem,
    LoginProps,
    LoginConnectOption,
} from './Layout'
