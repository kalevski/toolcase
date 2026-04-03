import React from 'react'
import { TabSections, Card, CodeSnippet } from '../../src'

const TabSectionsDemo: React.FC = () => (
	<div className="container my-5">
		<div className="row mb-4">
			<div className="col-12">
				<h1 className="display-4 text-gradient-primary mb-2">TabSections</h1>
				<p className="text-muted mb-4">A tabbed content panel with keyboard-navigable tabs, default active keys, and rich content support.</p>
			</div>
		</div>

		<div className="row mb-5">
			<div className="col-lg-8">
				<Card>
					<h2 className="h5 mb-3">Basic</h2>
					<TabSections
						items={[
							{ key: 'overview', label: 'Overview', content: <div className="py-2">This is the overview panel with general project information.</div> },
							{ key: 'settings', label: 'Settings', content: <div className="py-2">Configure your project settings here.</div> },
							{ key: 'members', label: 'Members', content: <div className="py-2">Manage team members and permissions.</div> },
						]}
					/>
				</Card>
			</div>
		</div>

		<div className="row mb-5">
			<div className="col-lg-8">
				<Card>
					<h2 className="h5 mb-3">With Default Active Tab</h2>
					<TabSections
						defaultActiveKey="billing"
						items={[
							{ key: 'general', label: 'General', content: <div className="py-2">General account settings.</div> },
							{ key: 'billing', label: 'Billing', content: <div className="py-2">Manage your billing plan and invoices.</div> },
							{ key: 'notifications', label: 'Notifications', content: <div className="py-2">Choose which notifications you receive.</div> },
						]}
					/>
				</Card>
			</div>
		</div>

		<div className="row mb-5">
			<div className="col-lg-8">
				<Card>
					<h2 className="h5 mb-3">Rich Content</h2>
					<TabSections
						items={[
							{
								key: 'sprites',
								label: 'Sprites',
								content: (
									<div className="py-2 d-flex flex-column gap-2">
										<strong>Player Sprites</strong>
										<ul className="mb-0 ps-4">
											<li>Idle animation (4 frames)</li>
											<li>Walk cycle (8 frames)</li>
											<li>Jump (2 frames)</li>
										</ul>
									</div>
								),
							},
							{
								key: 'audio',
								label: 'Audio',
								content: (
									<div className="py-2 d-flex flex-column gap-2">
										<strong>Sound Effects</strong>
										<ul className="mb-0 ps-4">
											<li>Jump — jump.wav</li>
											<li>Coin — coin.wav</li>
											<li>Hit — hit.wav</li>
										</ul>
									</div>
								),
							},
							{
								key: 'data',
								label: 'Data',
								content: (
									<div className="py-2">
										<strong>Level Config</strong>
										<pre className="p-3 bg-light rounded mt-2" style={{ fontSize: '0.8rem' }}>
{JSON.stringify({ levels: [{ id: 1, name: 'Tutorial' }, { id: 2, name: 'Forest' }] }, null, 2)}
										</pre>
									</div>
								),
							},
						]}
					/>
				</Card>
			</div>
		</div>
		{/* Usage */}
		<div className="row mb-5">
			<div className="col-12">
				<Card>
					<h2 className="h5 mb-3">Usage</h2>
					<CodeSnippet
						language="typescript"
						code={`import { TabSections } from '@webgame-cloud/react-components'

<TabSections
  items={[
    { key: 'general', label: 'General', content: <GeneralSettings /> },
    { key: 'security', label: 'Security', content: <SecuritySettings /> },
  ]}
/>`}
					/>
				</Card>
			</div>
		</div>
	</div>
)

export default TabSectionsDemo
