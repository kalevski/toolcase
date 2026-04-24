import React, { useState } from 'react'
import { ExtendedSelect, ExtendedSelectItem } from '@toolcase/react-components'
import { DemoPage, DemoSection } from './_demo'

const iconItems: ExtendedSelectItem[] = [
	{ key: 'dashboard', name: 'Dashboard', icon: 'grid', description: 'Main overview panel' },
	{ key: 'settings', name: 'Settings', icon: 'gear', description: 'Configure your app' },
	{ key: 'users', name: 'Users', icon: 'people', description: 'Manage team members' },
	{ key: 'files', name: 'Files', icon: 'folder', description: 'Browse project files' },
	{ key: 'analytics', name: 'Analytics', icon: 'bar-chart', description: 'View usage metrics' },
	{ key: 'notifications', name: 'Notifications', icon: 'bell', description: 'Alert preferences' },
	{ key: 'security', name: 'Security', icon: 'shield-lock', description: 'Access controls' },
	{ key: 'billing', name: 'Billing', icon: 'credit-card', description: 'Payment information' },
]

const labelItems: ExtendedSelectItem[] = [
	{ key: 'ts', name: 'TypeScript', label: 'TS', description: 'Typed JavaScript' },
	{ key: 'js', name: 'JavaScript', label: 'JS', description: 'Dynamic scripting language' },
	{ key: 'py', name: 'Python', label: 'PY', description: 'General-purpose language' },
	{ key: 'go', name: 'Go', label: 'GO', description: 'Systems programming language' },
	{ key: 'rs', name: 'Rust', label: 'RS', description: 'Memory-safe systems lang' },
	{ key: 'rb', name: 'Ruby', label: 'RB', description: 'Dynamic, object-oriented' },
]

const simpleItems: ExtendedSelectItem[] = [
	{ key: 'apple', name: 'Apple' },
	{ key: 'banana', name: 'Banana' },
	{ key: 'cherry', name: 'Cherry' },
	{ key: 'date', name: 'Date' },
	{ key: 'elderberry', name: 'Elderberry' },
	{ key: 'fig', name: 'Fig' },
	{ key: 'grape', name: 'Grape' },
]

const disabledItems: ExtendedSelectItem[] = [
	{ key: 'free', name: 'Free Plan', icon: 'box', description: 'Basic features' },
	{ key: 'pro', name: 'Pro Plan', icon: 'star', description: 'Advanced features' },
	{ key: 'enterprise', name: 'Enterprise', icon: 'building', description: 'Coming soon', disabled: true },
]

const ExtendedSelectDemo: React.FC = () => {
	const [iconValue, setIconValue] = useState<string>('')
	const [labelValue, setLabelValue] = useState<string>('')
	const [simpleValue, setSimpleValue] = useState<string>('')
	const [disabledValue, setDisabledValue] = useState<string>('free')

	return (
		<DemoPage
			eyebrow="Inputs"
			title="ExtendedSelect"
			lede="A searchable dropdown select with support for icons and labels on each option."
		>
			<DemoSection title="With Icons" caption="Options with Bootstrap Icons on the left side.">
				<ExtendedSelect
					items={iconItems}
					value={iconValue}
					onChange={setIconValue}
					placeholder="Select a page"
					searchPlaceholder="Search pages..."
				/>
			</DemoSection>

			<DemoSection title="With Labels" caption="Options with short text labels on the left side.">
				<ExtendedSelect
					items={labelItems}
					value={labelValue}
					onChange={setLabelValue}
					placeholder="Select a language"
					searchPlaceholder="Search languages..."
				/>
			</DemoSection>

			<DemoSection title="Simple (no icons or labels)" caption="Plain text options with search filtering.">
				<ExtendedSelect
					items={simpleItems}
					value={simpleValue}
					onChange={setSimpleValue}
					placeholder="Pick a fruit"
				/>
			</DemoSection>

			<DemoSection title="Disabled Options" caption="Some options can be disabled and are not selectable.">
				<ExtendedSelect
					items={disabledItems}
					value={disabledValue}
					onChange={setDisabledValue}
					placeholder="Select a plan"
				/>
			</DemoSection>

			<DemoSection
				title="Custom No-Results Text"
				caption="Type something that doesn't match any option to see the custom empty state."
			>
				<ExtendedSelect
					items={simpleItems}
					placeholder="Try searching for 'xyz'"
					noResultsText="Nothing here — try a different search."
				/>
			</DemoSection>
		</DemoPage>
	)
}

export default ExtendedSelectDemo
