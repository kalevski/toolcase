import React, { useState } from 'react'
import {
	ExtendedSelect,
	ExtendedSelectItem,
	RichPageHeader,
	RichPageHeaderChip,
	SectionCard
} from '@toolcase/react-components'

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
		<div className="container py-4">
		<div className="row">
			<div className="col-12">
				<RichPageHeader
				chips={<RichPageHeaderChip>Inputs</RichPageHeaderChip>}
				title="ExtendedSelect"
				description="A searchable dropdown select with support for icons and labels on each option."
			/>
				<div className="d-flex flex-column gap-4 mt-4">
			<SectionCard title="With Icons">
				<ExtendedSelect
					items={iconItems}
					value={iconValue}
					onChange={setIconValue}
					placeholder="Select a page"
					searchPlaceholder="Search pages..."
				/>
			</SectionCard>

			<SectionCard title="With Labels">
				<ExtendedSelect
					items={labelItems}
					value={labelValue}
					onChange={setLabelValue}
					placeholder="Select a language"
					searchPlaceholder="Search languages..."
				/>
			</SectionCard>

			<SectionCard title="Simple (no icons or labels)">
				<ExtendedSelect
					items={simpleItems}
					value={simpleValue}
					onChange={setSimpleValue}
					placeholder="Pick a fruit"
				/>
			</SectionCard>

			<SectionCard title="Disabled Options">
				<ExtendedSelect
					items={disabledItems}
					value={disabledValue}
					onChange={setDisabledValue}
					placeholder="Select a plan"
				/>
			</SectionCard>

			<SectionCard title="Custom No-Results Text">
				<ExtendedSelect
					items={simpleItems}
					placeholder="Try searching for 'xyz'"
					noResultsText="Nothing here — try a different search."
				/>
			</SectionCard>
		</div>
		
			</div>
		</div>
	</div>
	)
}

export default ExtendedSelectDemo
