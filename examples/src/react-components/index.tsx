import { JSX } from 'react'

// Inputs
import CheckboxDemo from './CheckboxDemo'
import CheckboxGroupDemo from './CheckboxGroupDemo'
import ColorPickerDemo from './ColorPickerDemo'
import DatePickerDemo from './DatePickerDemo'
import ExtendedSelectDemo from './ExtendedSelectDemo'
import FormDemo from './FormDemo'
import FormInputDemo from './FormInputDemo'
import { Forms } from './Forms'
import IconPickerDemo from './IconPickerDemo'
import InputDemo from './InputDemo'
import { NumberInputDemo } from './NumberInputDemo'
import { OTPInputDemo } from './OTPInputDemo'
import { PhoneInputDemo } from './PhoneInputDemo'
import RadioDemo from './RadioDemo'
import RadioGroupDemo from './RadioGroupDemo'
import { RangeSliderDemo } from './RangeSliderDemo'
import { RatingDemo } from './RatingDemo'
import SelectDemo from './SelectDemo'
import { SliderDemo } from './SliderDemo'
import SwitchDemo from './SwitchDemo'
import TagInputDemo from './TagInputDemo'
import TextareaDemo from './TextareaDemo'
import { TimePickerDemo } from './TimePickerDemo'
import CardOptionsDemo from './CardOptionsDemo'
import MultiCardSelectDemo from './MultiCardSelectDemo'
import SingleCardSelectDemo from './SingleCardSelectDemo'
import ToggleCardDemo from './ToggleCardDemo'

// Buttons & Actions
import ActionHeaderDemo from './ActionHeaderDemo'
import ActionItemsDemo from './ActionItemsDemo'
import ButtonDemo from './ButtonDemo'
import ChipDemo from './ChipDemo'
import DropdownDemo from './DropdownDemo'
import IconButtonDemo from './IconButtonDemo'
import LinkDemo from './LinkDemo'
import TagDemo from './TagDemo'

// Feedback
import AlertDemo from './AlertDemo'
import BadgeDemo from './BadgeDemo'
import { BannerDemo } from './BannerDemo'
import EmptyStateDemo from './EmptyStateDemo'
import ProgressBarDemo from './ProgressBarDemo'
import SkeletonDemo from './SkeletonDemo'
import SpinnerDemo from './SpinnerDemo'
import StatusDotDemo from './StatusDotDemo'
import { ToastDemo } from './ToastDemo'

// Overlays
import CommandPaletteDemo from './CommandPaletteDemo'
import { ContextMenuDemo } from './ContextMenuDemo'
import { DrawerDemo } from './DrawerDemo'
import { LightboxDemo } from './LightboxDemo'
import { ModalDemo } from './ModalDemo'
import PopoverDemo from './PopoverDemo'
import TooltipDemo from './TooltipDemo'

// Navigation
import BreadcrumbDemo from './BreadcrumbDemo'
import CoolNavDemo from './CoolNavDemo'
import FormWizardDemo from './FormWizardDemo'
import PaginationDemo from './PaginationDemo'
import SideNavDemo from './SideNavDemo'
import { StepperDemo } from './StepperDemo'
import TabSectionsDemo from './TabSectionsDemo'

// Data Display
import AdvancedTableDemo from './AdvancedTableDemo'
import AvatarDemo from './AvatarDemo'
import { CarouselDemo } from './CarouselDemo'
import ChangelogDemo from './ChangelogDemo'
import { ChartDemo } from './ChartDemo'
import CodeLabelCellDemo from './CodeLabelCellDemo'
import CodeSnippetDemo from './CodeSnippetDemo'
import EntityCellDemo from './EntityCellDemo'
import EntityProfileCardDemo from './EntityProfileCardDemo'
import MetricGridDemo from './MetricGridDemo'
import StatCardDemo from './StatCardDemo'
import TableDemo from './TableDemo'
import TimelineDemo from './TimelineDemo'
import { TreeViewDemo } from './TreeViewDemo'
import VerticalItemListDemo from './VerticalItemListDemo'

// Layout & Surfaces
import { AccordionDemo } from './AccordionDemo'
import Basic from './Basic'
import BasicLayoutDemo from './BasicLayoutDemo'
import CardDemo from './CardDemo'
import DashboardCardDemo from './DashboardCardDemo'
import { DashboardLayoutExample } from './DashboardLayoutExample'
import DividerDemo from './DividerDemo'
import FeatureCardDemo from './FeatureCardDemo'
import GroupDemo from './GroupDemo'
import HeroDemo from './HeroDemo'
import { InfiniteScrollDemo } from './InfiniteScrollDemo'
import { ResizablePanelDemo } from './ResizablePanelDemo'
import RichPageHeaderDemo from './RichPageHeaderDemo'
import { ScrollAreaDemo } from './ScrollAreaDemo'
import SectionCardDemo from './SectionCardDemo'
import SpacerDemo from './SpacerDemo'
import { VirtualListDemo } from './VirtualListDemo'

// Typography
import HeadingDemo from './HeadingDemo'
import HelperTextDemo from './HelperTextDemo'
import KbdDemo from './KbdDemo'
import LabelDemo from './LabelDemo'
import TextDemo from './TextDemo'
import VisuallyHiddenDemo from './VisuallyHiddenDemo'

// Media & Files
import FileDropzoneDemo from './FileDropzoneDemo'
import FileTagsDemo from './FileTagsDemo'
import { Files } from './Files'
import IconDemo from './IconDemo'
import ImageDemo from './ImageDemo'
import { ImageCropDemo } from './ImageCropDemo'
import QueuedFileDemo from './QueuedFileDemo'
import { SimpleFileDemo } from './SimpleFileDemo'

// Editors
import AssetBundleDemo from './AssetBundleDemo'
import BitmapFontGeneratorDemo from './BitmapFontGeneratorDemo'
import BuildDemo from './BuildDemo'
import JSONEditorDemo from './JSONEditorDemo'
import JSONSchemaDefDemo from './JSONSchemaDefDemo'
import { MarkdownEditorDemo } from './MarkdownEditorDemo'
import NodeEditorDemo from './NodeEditorDemo'

// Dashboard & Admin
import ActionRowListDemo from './ActionRowListDemo'
import DangerZoneActionsDemo from './DangerZoneActionsDemo'
import LinkedProvidersCardDemo from './LinkedProvidersCardDemo'
import ProjectWizardDemo from './ProjectWizardDemo'
import UsageSummaryPanelDemo from './UsageSummaryPanelDemo'
import UserPanelDemo from './UserPanelDemo'

// Marketing
import BrandDemo from './BrandDemo'
import CoolButtonDemo from './CoolButtonDemo'
import EarlySignupFormDemo from './EarlySignupFormDemo'
import LoginDemo from './LoginDemo'
import PageFooterDemo from './PageFooterDemo'
import PinnedFeatureShowcaseDemo from './PinnedFeatureShowcaseDemo'
import PricingCardDemo from './PricingCardDemo'
import WelcomeGuideDemo from './WelcomeGuideDemo'

// Full Page Demos
import { FullAppDemo } from './FullApp'
import { FullLandingPageDemo } from './FullLandingPage'

// Themes
import NeonThemeDemo from './NeonThemeDemo'

export type ExampleCategory =
    | 'Inputs'
    | 'Buttons & Actions'
    | 'Feedback'
    | 'Overlays'
    | 'Navigation'
    | 'Data Display'
    | 'Layout & Surfaces'
    | 'Typography'
    | 'Media & Files'
    | 'Editors'
    | 'Dashboard & Admin'
    | 'Marketing'
    | 'Themes'
    | 'Full Page Demos'

export type ExampleDef = {
    key: string
    category: ExampleCategory
    element: JSX.Element
}

export const categories: ExampleCategory[] = [
    'Inputs',
    'Buttons & Actions',
    'Feedback',
    'Overlays',
    'Navigation',
    'Data Display',
    'Layout & Surfaces',
    'Typography',
    'Media & Files',
    'Editors',
    'Dashboard & Admin',
    'Marketing',
    'Themes',
    'Full Page Demos',
]

export const examples: ExampleDef[] = [
    // ── Inputs ───────────────────────────────────────────────────────────
    { key: 'card-options', category: 'Inputs', element: <CardOptionsDemo /> },
    { key: 'checkbox', category: 'Inputs', element: <CheckboxDemo /> },
    { key: 'checkbox-group', category: 'Inputs', element: <CheckboxGroupDemo /> },
    { key: 'color-picker', category: 'Inputs', element: <ColorPickerDemo /> },
    { key: 'date-picker', category: 'Inputs', element: <DatePickerDemo /> },
    { key: 'extended-select', category: 'Inputs', element: <ExtendedSelectDemo /> },
    { key: 'form', category: 'Inputs', element: <FormDemo /> },
    { key: 'form-input', category: 'Inputs', element: <FormInputDemo /> },
    { key: 'forms', category: 'Inputs', element: <Forms /> },
    { key: 'icon-picker', category: 'Inputs', element: <IconPickerDemo /> },
    { key: 'input', category: 'Inputs', element: <InputDemo /> },
    { key: 'multi-card-select', category: 'Inputs', element: <MultiCardSelectDemo /> },
    { key: 'number-input', category: 'Inputs', element: <NumberInputDemo /> },
    { key: 'otp-input', category: 'Inputs', element: <OTPInputDemo /> },
    { key: 'phone-input', category: 'Inputs', element: <PhoneInputDemo /> },
    { key: 'radio', category: 'Inputs', element: <RadioDemo /> },
    { key: 'radio-group', category: 'Inputs', element: <RadioGroupDemo /> },
    { key: 'range-slider', category: 'Inputs', element: <RangeSliderDemo /> },
    { key: 'rating', category: 'Inputs', element: <RatingDemo /> },
    { key: 'select', category: 'Inputs', element: <SelectDemo /> },
    { key: 'single-card-select', category: 'Inputs', element: <SingleCardSelectDemo /> },
    { key: 'slider', category: 'Inputs', element: <SliderDemo /> },
    { key: 'switch', category: 'Inputs', element: <SwitchDemo /> },
    { key: 'tag-input', category: 'Inputs', element: <TagInputDemo /> },
    { key: 'textarea', category: 'Inputs', element: <TextareaDemo /> },
    { key: 'time-picker', category: 'Inputs', element: <TimePickerDemo /> },
    { key: 'toggle-card', category: 'Inputs', element: <ToggleCardDemo /> },

    // ── Buttons & Actions ────────────────────────────────────────────────
    { key: 'action-header', category: 'Buttons & Actions', element: <ActionHeaderDemo /> },
    { key: 'action-items', category: 'Buttons & Actions', element: <ActionItemsDemo /> },
    { key: 'button', category: 'Buttons & Actions', element: <ButtonDemo /> },
    { key: 'chip', category: 'Buttons & Actions', element: <ChipDemo /> },
    { key: 'dropdown', category: 'Buttons & Actions', element: <DropdownDemo /> },
    { key: 'icon-button', category: 'Buttons & Actions', element: <IconButtonDemo /> },
    { key: 'link', category: 'Buttons & Actions', element: <LinkDemo /> },
    { key: 'tag', category: 'Buttons & Actions', element: <TagDemo /> },

    // ── Feedback ─────────────────────────────────────────────────────────
    { key: 'alert', category: 'Feedback', element: <AlertDemo /> },
    { key: 'badge', category: 'Feedback', element: <BadgeDemo /> },
    { key: 'banner', category: 'Feedback', element: <BannerDemo /> },
    { key: 'empty-state', category: 'Feedback', element: <EmptyStateDemo /> },
    { key: 'progress-bar', category: 'Feedback', element: <ProgressBarDemo /> },
    { key: 'skeleton', category: 'Feedback', element: <SkeletonDemo /> },
    { key: 'spinner', category: 'Feedback', element: <SpinnerDemo /> },
    { key: 'status-dot', category: 'Feedback', element: <StatusDotDemo /> },
    { key: 'toast', category: 'Feedback', element: <ToastDemo /> },

    // ── Overlays ─────────────────────────────────────────────────────────
    { key: 'command-palette', category: 'Overlays', element: <CommandPaletteDemo /> },
    { key: 'context-menu', category: 'Overlays', element: <ContextMenuDemo /> },
    { key: 'drawer', category: 'Overlays', element: <DrawerDemo /> },
    { key: 'lightbox', category: 'Overlays', element: <LightboxDemo /> },
    { key: 'modal', category: 'Overlays', element: <ModalDemo /> },
    { key: 'popover', category: 'Overlays', element: <PopoverDemo /> },
    { key: 'tooltip', category: 'Overlays', element: <TooltipDemo /> },

    // ── Navigation ───────────────────────────────────────────────────────
    { key: 'breadcrumb', category: 'Navigation', element: <BreadcrumbDemo /> },
    { key: 'cool-nav', category: 'Navigation', element: <CoolNavDemo /> },
    { key: 'form-wizard', category: 'Navigation', element: <FormWizardDemo /> },
    { key: 'pagination', category: 'Navigation', element: <PaginationDemo /> },
    { key: 'side-nav', category: 'Navigation', element: <SideNavDemo /> },
    { key: 'stepper', category: 'Navigation', element: <StepperDemo /> },
    { key: 'tab-sections', category: 'Navigation', element: <TabSectionsDemo /> },

    // ── Data Display ─────────────────────────────────────────────────────
    { key: 'advanced-table', category: 'Data Display', element: <AdvancedTableDemo /> },
    { key: 'avatar', category: 'Data Display', element: <AvatarDemo /> },
    { key: 'carousel', category: 'Data Display', element: <CarouselDemo /> },
    { key: 'changelog', category: 'Data Display', element: <ChangelogDemo /> },
    { key: 'chart', category: 'Data Display', element: <ChartDemo /> },
    { key: 'code-label-cell', category: 'Data Display', element: <CodeLabelCellDemo /> },
    { key: 'code-snippet', category: 'Data Display', element: <CodeSnippetDemo /> },
    { key: 'entity-cell', category: 'Data Display', element: <EntityCellDemo /> },
    { key: 'entity-profile-card', category: 'Data Display', element: <EntityProfileCardDemo /> },
    { key: 'metric-grid', category: 'Data Display', element: <MetricGridDemo /> },
    { key: 'stat-card', category: 'Data Display', element: <StatCardDemo /> },
    { key: 'table', category: 'Data Display', element: <TableDemo /> },
    { key: 'timeline', category: 'Data Display', element: <TimelineDemo /> },
    { key: 'tree-view', category: 'Data Display', element: <TreeViewDemo /> },
    { key: 'vertical-item-list', category: 'Data Display', element: <VerticalItemListDemo /> },

    // ── Layout & Surfaces ────────────────────────────────────────────────
    { key: 'accordion', category: 'Layout & Surfaces', element: <AccordionDemo /> },
    { key: 'basic', category: 'Layout & Surfaces', element: <Basic /> },
    { key: 'basic-layout', category: 'Layout & Surfaces', element: <BasicLayoutDemo /> },
    { key: 'card', category: 'Layout & Surfaces', element: <CardDemo /> },
    { key: 'dashboard-card', category: 'Layout & Surfaces', element: <DashboardCardDemo /> },
    { key: 'dashboard-layout', category: 'Layout & Surfaces', element: <DashboardLayoutExample /> },
    { key: 'divider', category: 'Layout & Surfaces', element: <DividerDemo /> },
    { key: 'feature-card', category: 'Layout & Surfaces', element: <FeatureCardDemo /> },
    { key: 'group', category: 'Layout & Surfaces', element: <GroupDemo /> },
    { key: 'hero', category: 'Layout & Surfaces', element: <HeroDemo /> },
    { key: 'infinite-scroll', category: 'Layout & Surfaces', element: <InfiniteScrollDemo /> },
    { key: 'resizable-panel', category: 'Layout & Surfaces', element: <ResizablePanelDemo /> },
    { key: 'rich-page-header', category: 'Layout & Surfaces', element: <RichPageHeaderDemo /> },
    { key: 'scroll-area', category: 'Layout & Surfaces', element: <ScrollAreaDemo /> },
    { key: 'section-card', category: 'Layout & Surfaces', element: <SectionCardDemo /> },
    { key: 'spacer', category: 'Layout & Surfaces', element: <SpacerDemo /> },
    { key: 'virtual-list', category: 'Layout & Surfaces', element: <VirtualListDemo /> },

    // ── Typography ───────────────────────────────────────────────────────
    { key: 'heading', category: 'Typography', element: <HeadingDemo /> },
    { key: 'helper-text', category: 'Typography', element: <HelperTextDemo /> },
    { key: 'kbd', category: 'Typography', element: <KbdDemo /> },
    { key: 'label', category: 'Typography', element: <LabelDemo /> },
    { key: 'text', category: 'Typography', element: <TextDemo /> },
    { key: 'visually-hidden', category: 'Typography', element: <VisuallyHiddenDemo /> },

    // ── Media & Files ────────────────────────────────────────────────────
    { key: 'file-dropzone', category: 'Media & Files', element: <FileDropzoneDemo /> },
    { key: 'file-tags', category: 'Media & Files', element: <FileTagsDemo /> },
    { key: 'files', category: 'Media & Files', element: <Files /> },
    { key: 'icon', category: 'Media & Files', element: <IconDemo /> },
    { key: 'image', category: 'Media & Files', element: <ImageDemo /> },
    { key: 'image-crop', category: 'Media & Files', element: <ImageCropDemo /> },
    { key: 'queued-file', category: 'Media & Files', element: <QueuedFileDemo /> },
    { key: 'simple-file', category: 'Media & Files', element: <SimpleFileDemo /> },

    // ── Editors ──────────────────────────────────────────────────────────
    { key: 'asset-bundle', category: 'Editors', element: <AssetBundleDemo /> },
    { key: 'bitmap-font-generator', category: 'Editors', element: <BitmapFontGeneratorDemo /> },
    { key: 'build', category: 'Editors', element: <BuildDemo /> },
    { key: 'json-editor', category: 'Editors', element: <JSONEditorDemo /> },
    { key: 'json-schema-def', category: 'Editors', element: <JSONSchemaDefDemo /> },
    { key: 'markdown-editor', category: 'Editors', element: <MarkdownEditorDemo /> },
    { key: 'node-editor', category: 'Editors', element: <NodeEditorDemo /> },

    // ── Dashboard & Admin ────────────────────────────────────────────────
    { key: 'action-row-list', category: 'Dashboard & Admin', element: <ActionRowListDemo /> },
    { key: 'danger-zone-actions', category: 'Dashboard & Admin', element: <DangerZoneActionsDemo /> },
    { key: 'linked-providers-card', category: 'Dashboard & Admin', element: <LinkedProvidersCardDemo /> },
    { key: 'project-wizard', category: 'Dashboard & Admin', element: <ProjectWizardDemo /> },
    { key: 'usage-summary-panel', category: 'Dashboard & Admin', element: <UsageSummaryPanelDemo /> },
    { key: 'user-panel', category: 'Dashboard & Admin', element: <UserPanelDemo /> },

    // ── Marketing ────────────────────────────────────────────────────────
    { key: 'brand', category: 'Marketing', element: <BrandDemo /> },
    { key: 'cool-button', category: 'Marketing', element: <CoolButtonDemo /> },
    { key: 'early-signup-form', category: 'Marketing', element: <EarlySignupFormDemo /> },
    { key: 'login', category: 'Marketing', element: <LoginDemo /> },
    { key: 'page-footer', category: 'Marketing', element: <PageFooterDemo /> },
    { key: 'pinned-feature-showcase', category: 'Marketing', element: <PinnedFeatureShowcaseDemo /> },
    { key: 'pricing-card', category: 'Marketing', element: <PricingCardDemo /> },
    { key: 'welcome-guide', category: 'Marketing', element: <WelcomeGuideDemo /> },

    // ── Themes ───────────────────────────────────────────────────────────
    { key: 'neon-theme', category: 'Themes', element: <NeonThemeDemo /> },

    // ── Full Page Demos ──────────────────────────────────────────────────
    { key: 'full-app', category: 'Full Page Demos', element: <FullAppDemo /> },
    { key: 'full-landing-page', category: 'Full Page Demos', element: <FullLandingPageDemo /> },
]
