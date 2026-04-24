import React from 'react'
import {
	ActionRowList,
	RichPageHeader,
	RichPageHeaderChip,
	SectionCard
} from '@toolcase/react-components'

const ActionRowListDemo: React.FC = () => (
	<div className="container py-4">
		<div className="row">
			<div className="col-12">
				<RichPageHeader
				chips={<RichPageHeaderChip>Dashboard & Admin</RichPageHeaderChip>}
				title="ActionRowList"
				description={
			<>
				A vertical list of action rows. Each row has an icon, title, description, and a
				trailing call-to-action button. The workhorse pattern for <em>Account</em>,{' '}
				<em>Security</em>, and <em>Danger Zone</em> pages.
			</>
		}
			/>
				<div className="d-flex flex-column gap-4 mt-4">
		<SectionCard title="Security actions">
			<SectionCard title="Security" icon="shield-lock">
				<ActionRowList
					onActionClick={(key) => console.log('action:', key)}
					actions={[
						{
							key: 'password',
							icon: 'key',
							title: 'Change password',
							description: 'We recommend rotating your password every 90 days.',
							buttonText: 'Change',
						},
						{
							key: '2fa',
							icon: 'phone',
							title: 'Two-factor authentication',
							description: 'Add a second factor via TOTP or WebAuthn security keys.',
							buttonText: 'Enable',
							buttonVariant: 'success',
						},
						{
							key: 'sessions',
							icon: 'laptop',
							title: 'Active sessions',
							description: 'Review and sign out devices currently signed in.',
							buttonText: 'Review',
						},
					]}
				/>
			</SectionCard>
		</SectionCard>

		<SectionCard title="Solid buttons, no trailing arrow">
			<SectionCard title="Danger zone" icon="exclamation-triangle" variant="danger">
				<ActionRowList
					outline={false}
					trailingIcon={null}
					onActionClick={(key) => console.log('action:', key)}
					actions={[
						{
							key: 'suspend',
							icon: 'pause-circle',
							title: 'Suspend account',
							description: 'Temporarily disable sign-in and API access.',
							buttonText: 'Suspend',
							buttonVariant: 'warning',
						},
						{
							key: 'delete',
							icon: 'trash',
							title: 'Delete account',
							description:
								'Permanently delete this account and all of its projects. Cannot be undone.',
							buttonText: 'Delete',
							buttonVariant: 'danger',
						},
					]}
				/>
			</SectionCard>
		</SectionCard>

		<SectionCard title="Per-row disabled">
			<SectionCard title="Integrations" icon="puzzle">
				<ActionRowList
					onActionClick={(key) => console.log('action:', key)}
					actions={[
						{
							key: 'slack',
							icon: 'slack',
							title: 'Slack',
							description: 'Post deploy and incident notifications to a channel.',
							buttonText: 'Connect',
						},
						{
							key: 'pagerduty',
							icon: 'bell',
							title: 'PagerDuty',
							description: 'Requires the Enterprise plan. Upgrade to enable.',
							buttonText: 'Locked',
							disabled: true,
						},
					]}
				/>
			</SectionCard>
		</SectionCard>
	</div>
		
			</div>
		</div>
	</div>
)

export default ActionRowListDemo
