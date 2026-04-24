import React from 'react'
import { UserPanel } from '@toolcase/react-components'
import { DemoPage, DemoSection } from './_demo'

const UserPanelDemo: React.FC = () => (
	<DemoPage
		eyebrow="Dashboard & Admin"
		title="UserPanel"
		lede={<>Designed to be used as <code>sidebarPanelComponent</code> in DashboardLayout.</>}
	>
		<DemoSection title="Default — Free Plan">
			<div style={{ maxWidth: 240, border: '1px solid #dee2e6' }}>
				<UserPanel username="Daniel Kalevski" />
			</div>
		</DemoSection>

		<DemoSection title="With Avatar Image — Pro Plan">
			<div style={{ maxWidth: 240, border: '1px solid #dee2e6' }}>
				<UserPanel
					avatarSrc="https://i.pravatar.cc/150?img=5"
					username="Jane Smith"
					plan="Pro"
				/>
			</div>
		</DemoSection>

		<DemoSection title="Enterprise Plan">
			<div style={{ maxWidth: 240, border: '1px solid #dee2e6' }}>
				<UserPanel
					avatarSrc="https://i.pravatar.cc/150?img=12"
					username="Alice Johnson"
					plan="Enterprise"
				/>
			</div>
		</DemoSection>

		<DemoSection title="Different Plans">
			<div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
				{['Free', 'Starter', 'Pro', 'Business', 'Enterprise'].map((plan) => (
					<div key={plan} style={{ width: 240, border: '1px solid #dee2e6' }}>
						<UserPanel username="Demo User" plan={plan} />
					</div>
				))}
			</div>
		</DemoSection>

		<DemoSection title="Long Username (truncated)">
			<div style={{ maxWidth: 240, border: '1px solid #dee2e6' }}>
				<UserPanel
					username="Bartholomew Christopherson III"
					plan="Pro"
				/>
			</div>
		</DemoSection>
	</DemoPage>
)

export default UserPanelDemo
