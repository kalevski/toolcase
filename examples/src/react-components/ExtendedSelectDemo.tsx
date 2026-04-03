import React, { useState } from 'react'
import { ExtendedSelect, ExtendedSelectItem, Card, CodeSnippet } from '@toolcase/react-components'

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
		<div className="container my-5">
			<div className="row mb-4">
				<div className="col-12">
					<h1 className="display-4 text-gradient-primary mb-2">ExtendedSelect</h1>
					<p className="text-muted mb-0">
						A searchable dropdown select with support for icons and labels on each option.
					</p>
				</div>
			</div>

			<div className="row mb-5">
				<div className="col-12 col-md-6">
					<Card>
						<h2 className="h5 mb-3">With Icons</h2>
						<p className="text-muted mb-3" style={{ fontSize: '0.875rem' }}>
							Options with Bootstrap Icons on the left side.
						</p>
						<ExtendedSelect
							items={iconItems}
							value={iconValue}
							onChange={setIconValue}
							placeholder="Select a page"
							searchPlaceholder="Search pages..."
						/>
					</Card>
				</div>
				<div className="col-12 col-md-6">
					<Card>
						<h2 className="h5 mb-3">With Labels</h2>
						<p className="text-muted mb-3" style={{ fontSize: '0.875rem' }}>
							Options with short text labels on the left side.
						</p>
						<ExtendedSelect
							items={labelItems}
							value={labelValue}
							onChange={setLabelValue}
							placeholder="Select a language"
							searchPlaceholder="Search languages..."
						/>
					</Card>
				</div>
			</div>

			<div className="row mb-5">
				<div className="col-12 col-md-6">
					<Card>
						<h2 className="h5 mb-3">Simple (no icons or labels)</h2>
						<p className="text-muted mb-3" style={{ fontSize: '0.875rem' }}>
							Plain text options with search filtering.
						</p>
						<ExtendedSelect
							items={simpleItems}
							value={simpleValue}
							onChange={setSimpleValue}
							placeholder="Pick a fruit"
						/>
					</Card>
				</div>
				<div className="col-12 col-md-6">
					<Card>
						<h2 className="h5 mb-3">Disabled Options</h2>
						<p className="text-muted mb-3" style={{ fontSize: '0.875rem' }}>
							Some options can be disabled and are not selectable.
						</p>
						<ExtendedSelect
							items={disabledItems}
							value={disabledValue}
							onChange={setDisabledValue}
							placeholder="Select a plan"
						/>
					</Card>
				</div>
			</div>

			<div className="row mb-5">
				<div className="col-12">
					<Card>
						<h2 className="h5 mb-3">Custom No-Results Text</h2>
						<p className="text-muted mb-3" style={{ fontSize: '0.875rem' }}>
							Type something that doesn't match any option to see the custom empty state.
						</p>
						<ExtendedSelect
							items={simpleItems}
							placeholder="Try searching for 'xyz'"
							noResultsText="Nothing here — try a different search."
						/>
					</Card>
				</div>
			</div>

			<div className="row mb-5">
				<div className="col-12">
					<Card>
						<h2 className="h5 mb-3">Usage</h2>
						<CodeSnippet
							language="typescript"
							code={`import { ExtendedSelect, ExtendedSelectItem } from '@webgame-cloud/react-components'

const items: ExtendedSelectItem[] = [
  { key: 'dashboard', name: 'Dashboard', icon: 'grid', description: 'Main overview' },
  { key: 'settings', name: 'Settings', icon: 'gear', description: 'Configure app' },
  { key: 'ts', name: 'TypeScript', label: 'TS', description: 'Typed JS' },
]

<ExtendedSelect
  items={items}
  value={selected}
  onChange={setSelected}
  placeholder="Select an option"
  searchPlaceholder="Search..."
/>`}
						/>
					</Card>
				</div>
			</div>
		</div>
	)
}

export default ExtendedSelectDemo
