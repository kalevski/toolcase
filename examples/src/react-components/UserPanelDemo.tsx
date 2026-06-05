import React from 'react'
import {
	RichPageHeader,
	RichPageHeaderChip,
	SectionCard,
	UserPanel
} from '@toolcase/react-components'

const UserPanelDemo: React.FC = () => (
	<div className="container py-4">
		<div className="row">
			<div className="col-12">
				<RichPageHeader
				chips={<RichPageHeaderChip>Dashboard & Admin</RichPageHeaderChip>}
				title="UserPanel"
				description={<>Designed to be used as <code>sidebarPanelComponent</code> in DashboardLayout.</>}
			/>
				<div className="d-flex flex-column gap-4 mt-4">
		<SectionCard title="Default — Free Plan">
			<div style={{ maxWidth: 240, border: '1px solid #dee2e6' }}>
				<UserPanel username="Daniel Kalevski" />
			</div>
		</SectionCard>

		<SectionCard title="With Avatar Image — Pro Plan">
			<div style={{ maxWidth: 240, border: '1px solid #dee2e6' }}>
				<UserPanel
					avatarSrc="https://i.pravatar.cc/150?img=5"
					username="Jane Smith"
					plan="Pro"
				/>
			</div>
		</SectionCard>

		<SectionCard title="Enterprise Plan">
			<div style={{ maxWidth: 240, border: '1px solid #dee2e6' }}>
				<UserPanel
					avatarSrc="https://i.pravatar.cc/150?img=12"
					username="Alice Johnson"
					plan="Enterprise"
				/>
			</div>
		</SectionCard>

		<SectionCard title="Different Plans">
			<div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
				{['Free', 'Starter', 'Pro', 'Business', 'Enterprise'].map((plan) => (
					<div key={plan} style={{ width: 240, border: '1px solid #dee2e6' }}>
						<UserPanel username="Demo User" plan={plan} />
					</div>
				))}
			</div>
		</SectionCard>

		<SectionCard title="Long Username (truncated)">
			<div style={{ maxWidth: 240, border: '1px solid #dee2e6' }}>
				<UserPanel
					username="Bartholomew Christopherson III"
					plan="Pro"
				/>
			</div>
		</SectionCard>

		<SectionCard title="With Menu (click the name — Escape / arrows work)">
			<div style={{ maxWidth: 240, border: '1px solid #dee2e6' }}>
				<UserPanel
					username="Daniel Kalevski"
					plan="Pro"
					menuItems={[
						{ key: 'profile', label: 'Profile', icon: 'person' },
						{ key: 'billing', label: 'Billing', icon: 'credit-card' },
						{ key: 'signout', label: 'Sign out', icon: 'box-arrow-right' },
					]}
					onMenuClick={(_e, key) => console.log('menu:', key)}
				/>
			</div>
		</SectionCard>
	</div>
		
			</div>
		</div>
	</div>
)

export default UserPanelDemo
