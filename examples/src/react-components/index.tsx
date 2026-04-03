import { JSX } from 'react'

// Simple
import AlertDemo from './AlertDemo'
import AvatarDemo from './AvatarDemo'
import BadgeDemo from './BadgeDemo'
import ButtonDemo from './ButtonDemo'
import CardDemo from './CardDemo'
import CodeSnippetDemo from './CodeSnippetDemo'
import DividerDemo from './DividerDemo'
import IconDemo from './IconDemo'
import LabelDemo from './LabelDemo'
import TextDemo from './TextDemo'
import HeadingDemo from './HeadingDemo'
import ProgressBarDemo from './ProgressBarDemo'
import SpinnerDemo from './SpinnerDemo'
import SkeletonDemo from './SkeletonDemo'
import TooltipDemo from './TooltipDemo'
import TagDemo from './TagDemo'
import SwitchDemo from './SwitchDemo'
import IconButtonDemo from './IconButtonDemo'
import LinkDemo from './LinkDemo'
import ChipDemo from './ChipDemo'
import SpacerDemo from './SpacerDemo'
import VisuallyHiddenDemo from './VisuallyHiddenDemo'
import KbdDemo from './KbdDemo'
import ImageDemo from './ImageDemo'
import StatusDotDemo from './StatusDotDemo'

// Form
import CheckboxDemo from './CheckboxDemo'
import CheckboxGroupDemo from './CheckboxGroupDemo'
import ColorPickerDemo from './ColorPickerDemo'
import DatePickerDemo from './DatePickerDemo'
import FileDropzoneDemo from './FileDropzoneDemo'
import FormDemo from './FormDemo'
import { Forms } from './Forms'
import IconPickerDemo from './IconPickerDemo'
import InputDemo from './InputDemo'
import RadioDemo from './RadioDemo'
import RadioGroupDemo from './RadioGroupDemo'
import SelectDemo from './SelectDemo'
import QueuedFileDemo from './QueuedFileDemo'
import { SimpleFileDemo } from './SimpleFileDemo'
import TagInputDemo from './TagInputDemo'
import TextareaDemo from './TextareaDemo'
import FileTagsDemo from './FileTagsDemo'
import ToggleCardDemo from './ToggleCardDemo'
import FormInputDemo from './FormInputDemo'

// Layout / Container
import Basic from './Basic'
import DropdownDemo from './DropdownDemo'
import EmptyStateDemo from './EmptyStateDemo'
import ExtendedSelectDemo from './ExtendedSelectDemo'
import GroupDemo from './GroupDemo'
import { ModalDemo } from './ModalDemo'
import { DashboardLayoutExample } from './DashboardLayoutExample'
import DashboardCardDemo from './DashboardCardDemo'
import BasicLayoutDemo from './BasicLayoutDemo'
import { Files } from './Files'

// Complex
import TableDemo from './TableDemo'
import FormWizardDemo from './FormWizardDemo'
import JSONEditorDemo from './JSONEditorDemo'
import JSONSchemaDefDemo from './JSONSchemaDefDemo'
import NodeEditorDemo from './NodeEditorDemo'
import TimelineDemo from './TimelineDemo'
import ChangelogDemo from './ChangelogDemo'

// Specialized
import BrandDemo from './BrandDemo'
import CoolButtonDemo from './CoolButtonDemo'
import CoolNavDemo from './CoolNavDemo'
import EarlySignupFormDemo from './EarlySignupFormDemo'
import HeroDemo from './HeroDemo'
import PageFooterDemo from './PageFooterDemo'
import PinnedFeatureShowcaseDemo from './PinnedFeatureShowcaseDemo'
import PricingCardDemo from './PricingCardDemo'
import SideNavDemo from './SideNavDemo'
import UsageSummaryPanelDemo from './UsageSummaryPanelDemo'
import UserPanelDemo from './UserPanelDemo'
import DangerZoneActionsDemo from './DangerZoneActionsDemo'

// Advanced
import BitmapFontGeneratorDemo from './BitmapFontGeneratorDemo'
import AssetBundleDemo from './AssetBundleDemo'
import BuildDemo from './BuildDemo'
import LoginDemo from './LoginDemo'
import WelcomeGuideDemo from './WelcomeGuideDemo'
import ActionHeaderDemo from './ActionHeaderDemo'
import ActionItemsDemo from './ActionItemsDemo'
import CardOptionsDemo from './CardOptionsDemo'
import MultiCardSelectDemo from './MultiCardSelectDemo'
import SingleCardSelectDemo from './SingleCardSelectDemo'
import HelperTextDemo from './HelperTextDemo'
import TabSectionsDemo from './TabSectionsDemo'
import VerticalItemListDemo from './VerticalItemListDemo'
import ProjectWizardDemo from './ProjectWizardDemo'

// Full Page Demos
import { FullAppDemo } from './FullApp'
import { FullLandingPageDemo } from './FullLandingPage'

export type ExampleCategory =
	| 'Simple'
	| 'Form'
	| 'Layout / Container'
	| 'Complex'
	| 'Specialized'
	| 'Advanced'
	| 'Full Page Demos'

export type ExampleDef = {
	key: string
	category: ExampleCategory
	element: JSX.Element
}

export const categories: ExampleCategory[] = [
	'Simple',
	'Form',
	'Layout / Container',
	'Complex',
	'Specialized',
	'Advanced',
	'Full Page Demos',
]

export const examples: ExampleDef[] = [
	// Simple — Atomic UI primitives
	{ key: 'alert', category: 'Simple', element: <AlertDemo /> },
	{ key: 'avatar', category: 'Simple', element: <AvatarDemo /> },
	{ key: 'badge', category: 'Simple', element: <BadgeDemo /> },
	{ key: 'button', category: 'Simple', element: <ButtonDemo /> },
	{ key: 'card', category: 'Simple', element: <CardDemo /> },
	{ key: 'code-snippet', category: 'Simple', element: <CodeSnippetDemo /> },
	{ key: 'divider', category: 'Simple', element: <DividerDemo /> },
	{ key: 'icon', category: 'Simple', element: <IconDemo /> },
	{ key: 'label', category: 'Simple', element: <LabelDemo /> },
	{ key: 'text', category: 'Simple', element: <TextDemo /> },
	{ key: 'heading', category: 'Simple', element: <HeadingDemo /> },
	{ key: 'progress-bar', category: 'Simple', element: <ProgressBarDemo /> },
	{ key: 'spinner', category: 'Simple', element: <SpinnerDemo /> },
	{ key: 'skeleton', category: 'Simple', element: <SkeletonDemo /> },
	{ key: 'tooltip', category: 'Simple', element: <TooltipDemo /> },
	{ key: 'tag', category: 'Simple', element: <TagDemo /> },
	{ key: 'switch', category: 'Simple', element: <SwitchDemo /> },
	{ key: 'icon-button', category: 'Simple', element: <IconButtonDemo /> },
	{ key: 'link', category: 'Simple', element: <LinkDemo /> },
	{ key: 'chip', category: 'Simple', element: <ChipDemo /> },
	{ key: 'spacer', category: 'Simple', element: <SpacerDemo /> },
	{ key: 'visually-hidden', category: 'Simple', element: <VisuallyHiddenDemo /> },
	{ key: 'kbd', category: 'Simple', element: <KbdDemo /> },
	{ key: 'image', category: 'Simple', element: <ImageDemo /> },
	{ key: 'status-dot', category: 'Simple', element: <StatusDotDemo /> },

	// Form — Input-level components
	{ key: 'checkbox', category: 'Form', element: <CheckboxDemo /> },
	{ key: 'checkbox-group', category: 'Form', element: <CheckboxGroupDemo /> },
	{ key: 'color-picker', category: 'Form', element: <ColorPickerDemo /> },
	{ key: 'date-picker', category: 'Form', element: <DatePickerDemo /> },
	{ key: 'file-dropzone', category: 'Form', element: <FileDropzoneDemo /> },
	{ key: 'form', category: 'Form', element: <FormDemo /> },
	{ key: 'forms', category: 'Form', element: <Forms /> },
	{ key: 'icon-picker', category: 'Form', element: <IconPickerDemo /> },
	{ key: 'input', category: 'Form', element: <InputDemo /> },
	{ key: 'radio', category: 'Form', element: <RadioDemo /> },
	{ key: 'radio-group', category: 'Form', element: <RadioGroupDemo /> },
	{ key: 'select', category: 'Form', element: <SelectDemo /> },
	{ key: 'queued-file', category: 'Simple', element: <QueuedFileDemo /> },
	{ key: 'simple-file', category: 'Form', element: <SimpleFileDemo /> },
	{ key: 'tag-input', category: 'Form', element: <TagInputDemo /> },
	{ key: 'textarea', category: 'Form', element: <TextareaDemo /> },
	{ key: 'file-tags', category: 'Form', element: <FileTagsDemo /> },
	{ key: 'toggle-card', category: 'Form', element: <ToggleCardDemo /> },
	{ key: 'form-input', category: 'Form', element: <FormInputDemo /> },
	{ key: 'extended-select', category: 'Form', element: <ExtendedSelectDemo /> },

	// Layout / Container — Structural wrappers
	{ key: 'basic', category: 'Layout / Container', element: <Basic /> },
	{ key: 'dropdown', category: 'Layout / Container', element: <DropdownDemo /> },
	{ key: 'group', category: 'Layout / Container', element: <GroupDemo /> },
	{ key: 'modal', category: 'Layout / Container', element: <ModalDemo /> },
	{ key: 'dashboard-layout', category: 'Layout / Container', element: <DashboardLayoutExample /> },
	{ key: 'dashboard-card', category: 'Layout / Container', element: <DashboardCardDemo /> },
	{ key: 'basic-layout', category: 'Layout / Container', element: <BasicLayoutDemo /> },
	{ key: 'files', category: 'Layout / Container', element: <Files /> },
	{ key: 'empty-state', category: 'Layout / Container', element: <EmptyStateDemo /> },

	// Complex — Multi-concern or data-driven
	{ key: 'table', category: 'Complex', element: <TableDemo /> },
	{ key: 'form-wizard', category: 'Complex', element: <FormWizardDemo /> },
	{ key: 'json-editor', category: 'Complex', element: <JSONEditorDemo /> },
	{ key: 'json-schema-def', category: 'Complex', element: <JSONSchemaDefDemo /> },
	{ key: 'node-editor', category: 'Complex', element: <NodeEditorDemo /> },
	{ key: 'timeline', category: 'Complex', element: <TimelineDemo /> },
	{ key: 'changelog', category: 'Complex', element: <ChangelogDemo /> },

	// Specialized — Domain-specific
	{ key: 'brand', category: 'Specialized', element: <BrandDemo /> },
	{ key: 'cool-button', category: 'Specialized', element: <CoolButtonDemo /> },
	{ key: 'cool-nav', category: 'Specialized', element: <CoolNavDemo /> },
	{ key: 'early-signup-form', category: 'Specialized', element: <EarlySignupFormDemo /> },
	{ key: 'hero', category: 'Specialized', element: <HeroDemo /> },
	{ key: 'page-footer', category: 'Specialized', element: <PageFooterDemo /> },
	{ key: 'pinned-feature-showcase', category: 'Specialized', element: <PinnedFeatureShowcaseDemo /> },
	{ key: 'pricing-card', category: 'Specialized', element: <PricingCardDemo /> },
	{ key: 'side-nav', category: 'Specialized', element: <SideNavDemo /> },
	{ key: 'usage-summary-panel', category: 'Specialized', element: <UsageSummaryPanelDemo /> },
	{ key: 'user-panel', category: 'Specialized', element: <UserPanelDemo /> },
	{ key: 'danger-zone-actions', category: 'Specialized', element: <DangerZoneActionsDemo /> },

	// Advanced — Feature-complete compound components
	{ key: 'asset-bundle', category: 'Advanced', element: <AssetBundleDemo /> },
	{ key: 'bitmap-font-generator', category: 'Advanced', element: <BitmapFontGeneratorDemo /> },
	{ key: 'build', category: 'Advanced', element: <BuildDemo /> },
	{ key: 'login', category: 'Advanced', element: <LoginDemo /> },
	{ key: 'welcome-guide', category: 'Advanced', element: <WelcomeGuideDemo /> },
	{ key: 'action-header', category: 'Advanced', element: <ActionHeaderDemo /> },
	{ key: 'action-items', category: 'Advanced', element: <ActionItemsDemo /> },
	{ key: 'card-options', category: 'Advanced', element: <CardOptionsDemo /> },
	{ key: 'multi-card-select', category: 'Advanced', element: <MultiCardSelectDemo /> },
	{ key: 'single-card-select', category: 'Advanced', element: <SingleCardSelectDemo /> },
	{ key: 'helper-text', category: 'Advanced', element: <HelperTextDemo /> },
	{ key: 'tab-sections', category: 'Advanced', element: <TabSectionsDemo /> },
	{ key: 'vertical-item-list', category: 'Advanced', element: <VerticalItemListDemo /> },
	{ key: 'project-wizard', category: 'Advanced', element: <ProjectWizardDemo /> },

	// Full Page Demos
	{ key: 'full-app', category: 'Full Page Demos', element: <FullAppDemo /> },
	{ key: 'full-landing-page', category: 'Full Page Demos', element: <FullLandingPageDemo /> },
]
