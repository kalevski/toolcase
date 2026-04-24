import React from 'react'
import { TabSections } from '@toolcase/react-components'
import { DemoPage, DemoSection } from './_demo'

const TabSectionsDemo: React.FC = () => (
	<DemoPage
		eyebrow="Navigation"
		title="TabSections"
		lede="A tabbed content panel with keyboard-navigable tabs, default active keys, and rich content support."
	>
		<DemoSection title="Basic">
			<TabSections
				items={[
					{ key: 'overview', label: 'Overview', content: <div style={{ padding: '0.5rem 0' }}>This is the overview panel with general project information.</div> },
					{ key: 'settings', label: 'Settings', content: <div style={{ padding: '0.5rem 0' }}>Configure your project settings here.</div> },
					{ key: 'members', label: 'Members', content: <div style={{ padding: '0.5rem 0' }}>Manage team members and permissions.</div> },
				]}
			/>
		</DemoSection>

		<DemoSection title="With Default Active Tab">
			<TabSections
				defaultActiveKey="billing"
				items={[
					{ key: 'general', label: 'General', content: <div style={{ padding: '0.5rem 0' }}>General account settings.</div> },
					{ key: 'billing', label: 'Billing', content: <div style={{ padding: '0.5rem 0' }}>Manage your billing plan and invoices.</div> },
					{ key: 'notifications', label: 'Notifications', content: <div style={{ padding: '0.5rem 0' }}>Choose which notifications you receive.</div> },
				]}
			/>
		</DemoSection>

		<DemoSection title="Rich Content">
			<TabSections
				items={[
					{
						key: 'sprites',
						label: 'Sprites',
						content: (
							<div style={{ padding: '0.5rem 0', display: 'flex', flexDirection: 'column', gap: 8 }}>
								<strong>Player Sprites</strong>
								<ul style={{ margin: 0, paddingLeft: '1.5rem' }}>
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
							<div style={{ padding: '0.5rem 0', display: 'flex', flexDirection: 'column', gap: 8 }}>
								<strong>Sound Effects</strong>
								<ul style={{ margin: 0, paddingLeft: '1.5rem' }}>
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
							<div style={{ padding: '0.5rem 0' }}>
								<strong>Level Config</strong>
								<pre style={{ padding: '0.75rem', background: '#f8fafc', marginTop: '0.5rem', fontSize: '0.8rem' }}>
{JSON.stringify({ levels: [{ id: 1, name: 'Tutorial' }, { id: 2, name: 'Forest' }] }, null, 2)}
								</pre>
							</div>
						),
					},
				]}
			/>
		</DemoSection>
	</DemoPage>
)

export default TabSectionsDemo
