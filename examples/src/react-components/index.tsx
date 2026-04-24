import { JSX } from 'react'

import { AccordionDemo } from './AccordionDemo'
import ActionHeaderDemo from './ActionHeaderDemo'
import ActionItemsDemo from './ActionItemsDemo'
import ActionRowListDemo from './ActionRowListDemo'
import AdvancedTableDemo from './AdvancedTableDemo'
import AlertDemo from './AlertDemo'
import AssetBundleDemo from './AssetBundleDemo'
import AssetRowDemo from './AssetRowDemo'
import AvatarDemo from './AvatarDemo'
import BadgeDemo from './BadgeDemo'
import { BannerDemo } from './BannerDemo'
import BasicLayoutDemo from './BasicLayoutDemo'
import BitmapFontGeneratorDemo from './BitmapFontGeneratorDemo'
import BrandDemo from './BrandDemo'
import BreadcrumbDemo from './BreadcrumbDemo'
import BuildDemo from './BuildDemo'
import BundleBarDemo from './BundleBarDemo'
import ButtonDemo from './ButtonDemo'
import CardDemo from './CardDemo'
import CardOptionsDemo from './CardOptionsDemo'
import { CarouselDemo } from './CarouselDemo'
import CdnMapDemo from './CdnMapDemo'
import ChangelogDemo from './ChangelogDemo'
import { ChartDemo } from './ChartDemo'
import CheckboxDemo from './CheckboxDemo'
import CheckboxGroupDemo from './CheckboxGroupDemo'
import ChipDemo from './ChipDemo'
import CodeLabelCellDemo from './CodeLabelCellDemo'
import CodeSnippetDemo from './CodeSnippetDemo'
import ColorPickerDemo from './ColorPickerDemo'
import CommandPaletteDemo from './CommandPaletteDemo'
import ConfigPreviewDemo from './ConfigPreviewDemo'
import { ContextMenuDemo } from './ContextMenuDemo'
import CoolButtonDemo from './CoolButtonDemo'
import CoolNavDemo from './CoolNavDemo'
import DangerZoneActionsDemo from './DangerZoneActionsDemo'
import DashboardCardDemo from './DashboardCardDemo'
import { DashboardLayoutExample } from './DashboardLayoutExample'
import DatePickerDemo from './DatePickerDemo'
import DividerDemo from './DividerDemo'
import { DrawerDemo } from './DrawerDemo'
import DropdownDemo from './DropdownDemo'
import EarlySignupFormDemo from './EarlySignupFormDemo'
import EmptyStateDemo from './EmptyStateDemo'
import EntityCellDemo from './EntityCellDemo'
import EntityProfileCardDemo from './EntityProfileCardDemo'
import ExtendedSelectDemo from './ExtendedSelectDemo'
import FeatureCardDemo from './FeatureCardDemo'
import FileDemo from './FileDemo'
import FileDropzoneDemo from './FileDropzoneDemo'
import FileTagsDemo from './FileTagsDemo'
import FormDemo from './FormDemo'
import FormInputDemo from './FormInputDemo'
import FormWizardDemo from './FormWizardDemo'
import GroupDemo from './GroupDemo'
import HeadingDemo from './HeadingDemo'
import HelperTextDemo from './HelperTextDemo'
import HeroDemo from './HeroDemo'
import IconButtonDemo from './IconButtonDemo'
import IconDemo from './IconDemo'
import IconPickerDemo from './IconPickerDemo'
import ImageDemo from './ImageDemo'
import { ImageCropDemo } from './ImageCropDemo'
import { InfiniteScrollDemo } from './InfiniteScrollDemo'
import InputDemo from './InputDemo'
import JSONEditorDemo from './JSONEditorDemo'
import JSONSchemaDefDemo from './JSONSchemaDefDemo'
import KbdDemo from './KbdDemo'
import LabelDemo from './LabelDemo'
import { LightboxDemo } from './LightboxDemo'
import LinkDemo from './LinkDemo'
import LinkedProvidersCardDemo from './LinkedProvidersCardDemo'
import LoginDemo from './LoginDemo'
import { MarkdownEditorDemo } from './MarkdownEditorDemo'
import MetricGridDemo from './MetricGridDemo'
import { ModalDemo } from './ModalDemo'
import MultiCardSelectDemo from './MultiCardSelectDemo'
import NodeEditorDemo from './NodeEditorDemo'
import { NumberInputDemo } from './NumberInputDemo'
import { OTPInputDemo } from './OTPInputDemo'
import PageFooterDemo from './PageFooterDemo'
import PaginationDemo from './PaginationDemo'
import { PhoneInputDemo } from './PhoneInputDemo'
import PinnedFeatureShowcaseDemo from './PinnedFeatureShowcaseDemo'
import PipelineDemo from './PipelineDemo'
import PopoverDemo from './PopoverDemo'
import PricingCardDemo from './PricingCardDemo'
import ProgressBarDemo from './ProgressBarDemo'
import QueuedFileDemo from './QueuedFileDemo'
import RadioDemo from './RadioDemo'
import RadioGroupDemo from './RadioGroupDemo'
import { RangeSliderDemo } from './RangeSliderDemo'
import { RatingDemo } from './RatingDemo'
import { ResizablePanelDemo } from './ResizablePanelDemo'
import RichPageHeaderDemo from './RichPageHeaderDemo'
import { ScrollAreaDemo } from './ScrollAreaDemo'
import SectionCardDemo from './SectionCardDemo'
import SelectDemo from './SelectDemo'
import SideNavDemo from './SideNavDemo'
import { SimpleFileDemo } from './SimpleFileDemo'
import SingleCardSelectDemo from './SingleCardSelectDemo'
import SkeletonDemo from './SkeletonDemo'
import { SliderDemo } from './SliderDemo'
import SpacerDemo from './SpacerDemo'
import SpinnerDemo from './SpinnerDemo'
import StatCardDemo from './StatCardDemo'
import StatusDotDemo from './StatusDotDemo'
import { StepperDemo } from './StepperDemo'
import SwitchDemo from './SwitchDemo'
import TabSectionsDemo from './TabSectionsDemo'
import TableDemo from './TableDemo'
import TagDemo from './TagDemo'
import TagInputDemo from './TagInputDemo'
import TeamListDemo from './TeamListDemo'
import TextDemo from './TextDemo'
import TextareaDemo from './TextareaDemo'
import { TimePickerDemo } from './TimePickerDemo'
import TimelineDemo from './TimelineDemo'
import ToolcaseIconsDemo from './ToolcaseIconsDemo'
import { ToastDemo } from './ToastDemo'
import ToggleCardDemo from './ToggleCardDemo'
import TooltipDemo from './TooltipDemo'
import { TreeViewDemo } from './TreeViewDemo'
import UsageSummaryPanelDemo from './UsageSummaryPanelDemo'
import UserPanelDemo from './UserPanelDemo'
import VerticalItemListDemo from './VerticalItemListDemo'
import { VirtualListDemo } from './VirtualListDemo'
import VisuallyHiddenDemo from './VisuallyHiddenDemo'
import WelcomeGuideDemo from './WelcomeGuideDemo'

export type ExampleCategory =
    | 'Primitives'
    | 'Basic Components'
    | 'Composite Components'
    | 'Advanced Systems'

export type ExampleDef = {
    key: string
    category: ExampleCategory
    element: JSX.Element
}

export const categories: ExampleCategory[] = [
    'Primitives',
    'Basic Components',
    'Composite Components',
    'Advanced Systems',
]

// Demos are ordered by implementation complexity (source LOC as a proxy),
// ascending within each tier so prev/next navigation flows simple → complex.
export const examples: ExampleDef[] = [
    // ── Primitives (small, stateless display) ─────────────────────────
    { key: 'code-label-cell', category: 'Primitives', element: <CodeLabelCellDemo /> },
    { key: 'visually-hidden', category: 'Primitives', element: <VisuallyHiddenDemo /> },
    { key: 'simple-file', category: 'Primitives', element: <SimpleFileDemo /> },
    { key: 'badge', category: 'Primitives', element: <BadgeDemo /> },
    { key: 'divider', category: 'Primitives', element: <DividerDemo /> },
    { key: 'empty-state', category: 'Primitives', element: <EmptyStateDemo /> },
    { key: 'spacer', category: 'Primitives', element: <SpacerDemo /> },
    { key: 'basic-layout', category: 'Primitives', element: <BasicLayoutDemo /> },
    { key: 'heading', category: 'Primitives', element: <HeadingDemo /> },
    { key: 'checkbox', category: 'Primitives', element: <CheckboxDemo /> },
    { key: 'kbd', category: 'Primitives', element: <KbdDemo /> },
    { key: 'radio', category: 'Primitives', element: <RadioDemo /> },
    { key: 'text', category: 'Primitives', element: <TextDemo /> },
    { key: 'input', category: 'Primitives', element: <InputDemo /> },
    { key: 'switch', category: 'Primitives', element: <SwitchDemo /> },
    { key: 'textarea', category: 'Primitives', element: <TextareaDemo /> },
    { key: 'card', category: 'Primitives', element: <CardDemo /> },
    { key: 'status-dot', category: 'Primitives', element: <StatusDotDemo /> },
    { key: 'helper-text', category: 'Primitives', element: <HelperTextDemo /> },
    { key: 'spinner', category: 'Primitives', element: <SpinnerDemo /> },
    { key: 'link', category: 'Primitives', element: <LinkDemo /> },

    // ── Basic Components (single-purpose, minimal state) ──────────────
    { key: 'button', category: 'Basic Components', element: <ButtonDemo /> },
    { key: 'form', category: 'Basic Components', element: <FormDemo /> },
    { key: 'label', category: 'Basic Components', element: <LabelDemo /> },
    { key: 'icon-button', category: 'Basic Components', element: <IconButtonDemo /> },
    { key: 'team-list', category: 'Basic Components', element: <TeamListDemo /> },
    { key: 'cdn-map', category: 'Basic Components', element: <CdnMapDemo /> },
    { key: 'section-card', category: 'Basic Components', element: <SectionCardDemo /> },
    { key: 'skeleton', category: 'Basic Components', element: <SkeletonDemo /> },
    { key: 'tag', category: 'Basic Components', element: <TagDemo /> },
    { key: 'danger-zone-actions', category: 'Basic Components', element: <DangerZoneActionsDemo /> },
    { key: 'select', category: 'Basic Components', element: <SelectDemo /> },
    { key: 'asset-row', category: 'Basic Components', element: <AssetRowDemo /> },
    { key: 'action-items', category: 'Basic Components', element: <ActionItemsDemo /> },
    { key: 'queued-file', category: 'Basic Components', element: <QueuedFileDemo /> },
    { key: 'action-header', category: 'Basic Components', element: <ActionHeaderDemo /> },
    { key: 'chip', category: 'Basic Components', element: <ChipDemo /> },
    { key: 'entity-cell', category: 'Basic Components', element: <EntityCellDemo /> },
    { key: 'pipeline', category: 'Basic Components', element: <PipelineDemo /> },
    { key: 'brand', category: 'Basic Components', element: <BrandDemo /> },
    { key: 'date-picker', category: 'Basic Components', element: <DatePickerDemo /> },
    { key: 'progress-bar', category: 'Basic Components', element: <ProgressBarDemo /> },
    { key: 'radio-group', category: 'Basic Components', element: <RadioGroupDemo /> },
    { key: 'scroll-area', category: 'Basic Components', element: <ScrollAreaDemo /> },
    { key: 'icon', category: 'Basic Components', element: <IconDemo /> },
    { key: 'toolcase-icons', category: 'Basic Components', element: <ToolcaseIconsDemo /> },
    { key: 'alert', category: 'Basic Components', element: <AlertDemo /> },
    { key: 'checkbox-group', category: 'Basic Components', element: <CheckboxGroupDemo /> },
    { key: 'group', category: 'Basic Components', element: <GroupDemo /> },
    { key: 'feature-card', category: 'Basic Components', element: <FeatureCardDemo /> },

    // ── Composite Components (multi-part with internal state) ─────────
    { key: 'image', category: 'Composite Components', element: <ImageDemo /> },
    { key: 'tab-sections', category: 'Composite Components', element: <TabSectionsDemo /> },
    { key: 'card-options', category: 'Composite Components', element: <CardOptionsDemo /> },
    { key: 'metric-grid', category: 'Composite Components', element: <MetricGridDemo /> },
    { key: 'rich-page-header', category: 'Composite Components', element: <RichPageHeaderDemo /> },
    { key: 'config-preview', category: 'Composite Components', element: <ConfigPreviewDemo /> },
    { key: 'avatar', category: 'Composite Components', element: <AvatarDemo /> },
    { key: 'tooltip', category: 'Composite Components', element: <TooltipDemo /> },
    { key: 'single-card-select', category: 'Composite Components', element: <SingleCardSelectDemo /> },
    { key: 'vertical-item-list', category: 'Composite Components', element: <VerticalItemListDemo /> },
    { key: 'file-dropzone', category: 'Composite Components', element: <FileDropzoneDemo /> },
    { key: 'action-row-list', category: 'Composite Components', element: <ActionRowListDemo /> },
    { key: 'bundle-bar', category: 'Composite Components', element: <BundleBarDemo /> },
    { key: 'code-snippet', category: 'Composite Components', element: <CodeSnippetDemo /> },
    { key: 'stat-card', category: 'Composite Components', element: <StatCardDemo /> },
    { key: 'infinite-scroll', category: 'Composite Components', element: <InfiniteScrollDemo /> },
    { key: 'multi-card-select', category: 'Composite Components', element: <MultiCardSelectDemo /> },
    { key: 'cool-button', category: 'Composite Components', element: <CoolButtonDemo /> },
    { key: 'changelog', category: 'Composite Components', element: <ChangelogDemo /> },
    { key: 'usage-summary-panel', category: 'Composite Components', element: <UsageSummaryPanelDemo /> },
    { key: 'file', category: 'Composite Components', element: <FileDemo /> },
    { key: 'entity-profile-card', category: 'Composite Components', element: <EntityProfileCardDemo /> },
    { key: 'banner', category: 'Composite Components', element: <BannerDemo /> },
    { key: 'welcome-guide', category: 'Composite Components', element: <WelcomeGuideDemo /> },
    { key: 'build', category: 'Composite Components', element: <BuildDemo /> },
    { key: 'linked-providers-card', category: 'Composite Components', element: <LinkedProvidersCardDemo /> },
    { key: 'login', category: 'Composite Components', element: <LoginDemo /> },
    { key: 'toggle-card', category: 'Composite Components', element: <ToggleCardDemo /> },
    { key: 'timeline', category: 'Composite Components', element: <TimelineDemo /> },
    { key: 'user-panel', category: 'Composite Components', element: <UserPanelDemo /> },
    { key: 'virtual-list', category: 'Composite Components', element: <VirtualListDemo /> },
    { key: 'breadcrumb', category: 'Composite Components', element: <BreadcrumbDemo /> },

    // ── Advanced Systems (heavy composites, layouts, editors) ─────────
    { key: 'file-tags', category: 'Advanced Systems', element: <FileTagsDemo /> },
    { key: 'pagination', category: 'Advanced Systems', element: <PaginationDemo /> },
    { key: 'form-wizard', category: 'Advanced Systems', element: <FormWizardDemo /> },
    { key: 'accordion', category: 'Advanced Systems', element: <AccordionDemo /> },
    { key: 'table', category: 'Advanced Systems', element: <TableDemo /> },
    { key: 'dashboard-layout', category: 'Advanced Systems', element: <DashboardLayoutExample /> },
    { key: 'side-nav', category: 'Advanced Systems', element: <SideNavDemo /> },
    { key: 'color-picker', category: 'Advanced Systems', element: <ColorPickerDemo /> },
    { key: 'icon-picker', category: 'Advanced Systems', element: <IconPickerDemo /> },
    { key: 'pinned-feature-showcase', category: 'Advanced Systems', element: <PinnedFeatureShowcaseDemo /> },
    { key: 'early-signup-form', category: 'Advanced Systems', element: <EarlySignupFormDemo /> },
    { key: 'otp-input', category: 'Advanced Systems', element: <OTPInputDemo /> },
    { key: 'advanced-table', category: 'Advanced Systems', element: <AdvancedTableDemo /> },
    { key: 'drawer', category: 'Advanced Systems', element: <DrawerDemo /> },
    { key: 'resizable-panel', category: 'Advanced Systems', element: <ResizablePanelDemo /> },
    { key: 'stepper', category: 'Advanced Systems', element: <StepperDemo /> },
    { key: 'rating', category: 'Advanced Systems', element: <RatingDemo /> },
    { key: 'page-footer', category: 'Advanced Systems', element: <PageFooterDemo /> },
    { key: 'carousel', category: 'Advanced Systems', element: <CarouselDemo /> },
    { key: 'pricing-card', category: 'Advanced Systems', element: <PricingCardDemo /> },
    { key: 'popover', category: 'Advanced Systems', element: <PopoverDemo /> },
    { key: 'dropdown', category: 'Advanced Systems', element: <DropdownDemo /> },
    { key: 'image-crop', category: 'Advanced Systems', element: <ImageCropDemo /> },
    { key: 'lightbox', category: 'Advanced Systems', element: <LightboxDemo /> },
    { key: 'number-input', category: 'Advanced Systems', element: <NumberInputDemo /> },
    { key: 'phone-input', category: 'Advanced Systems', element: <PhoneInputDemo /> },
    { key: 'context-menu', category: 'Advanced Systems', element: <ContextMenuDemo /> },
    { key: 'markdown-editor', category: 'Advanced Systems', element: <MarkdownEditorDemo /> },
    { key: 'cool-nav', category: 'Advanced Systems', element: <CoolNavDemo /> },
    { key: 'hero', category: 'Advanced Systems', element: <HeroDemo /> },
    { key: 'tree-view', category: 'Advanced Systems', element: <TreeViewDemo /> },
    { key: 'slider', category: 'Advanced Systems', element: <SliderDemo /> },
    { key: 'time-picker', category: 'Advanced Systems', element: <TimePickerDemo /> },
    { key: 'extended-select', category: 'Advanced Systems', element: <ExtendedSelectDemo /> },
    { key: 'tag-input', category: 'Advanced Systems', element: <TagInputDemo /> },
    { key: 'range-slider', category: 'Advanced Systems', element: <RangeSliderDemo /> },
    { key: 'json-schema-def', category: 'Advanced Systems', element: <JSONSchemaDefDemo /> },
    { key: 'command-palette', category: 'Advanced Systems', element: <CommandPaletteDemo /> },
    { key: 'asset-bundle', category: 'Advanced Systems', element: <AssetBundleDemo /> },
    { key: 'toast', category: 'Advanced Systems', element: <ToastDemo /> },
    { key: 'modal', category: 'Advanced Systems', element: <ModalDemo /> },
    { key: 'bitmap-font-generator', category: 'Advanced Systems', element: <BitmapFontGeneratorDemo /> },
    { key: 'json-editor', category: 'Advanced Systems', element: <JSONEditorDemo /> },
    { key: 'form-input', category: 'Advanced Systems', element: <FormInputDemo /> },
    { key: 'node-editor', category: 'Advanced Systems', element: <NodeEditorDemo /> },
    { key: 'dashboard-card', category: 'Advanced Systems', element: <DashboardCardDemo /> },
    { key: 'chart', category: 'Advanced Systems', element: <ChartDemo /> },
]
