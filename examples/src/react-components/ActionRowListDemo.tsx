import React from 'react'
import { ActionRowList, SectionCard } from '@toolcase/react-components'
import { DemoPage, DemoSection } from './_demo'

const ActionRowListDemo: React.FC = () => (
	<DemoPage
		eyebrow="Dashboard & Admin"
		title="ActionRowList"
		lede={
			<>
				A vertical list of action rows. Each row has an icon, title, description, and a
				trailing call-to-action button. The workhorse pattern for <em>Account</em>,{' '}
				<em>Security</em>, and <em>Danger Zone</em> pages.
			</>
		}
	>
		<DemoSection
			eyebrow="Default"
			title="Security actions"
			caption="Every row maps to one discrete admin operation. A single `onActionClick(key)` handler receives the row key."
		>
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
		</DemoSection>

		<DemoSection
			eyebrow="Danger zone"
			title="Solid buttons, no trailing arrow"
			caption="Opt out of the default outline/arrow treatment per section — solid buttons read with more weight for destructive operations."
		>
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
		</DemoSection>

		<DemoSection
			eyebrow="Disabled"
			title="Per-row disabled"
			caption="Any row can be disabled individually — useful when an action is gated on a separate state."
		>
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
		</DemoSection>
	</DemoPage>
)

export default ActionRowListDemo
