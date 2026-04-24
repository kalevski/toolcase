import React, { useState } from 'react'
import { DangerZoneActions, Alert } from '@toolcase/react-components'
import { DemoPage, DemoSection } from './_demo'

const DangerZoneActionsDemo: React.FC = () => {
	const [lastAction, setLastAction] = useState<string | null>(null)

	return (
		<DemoPage
			eyebrow="Dashboard & Admin"
			title="DangerZoneActions"
			lede="A settings section for destructive or irreversible actions with labels, descriptions, and danger buttons."
		>
			<DemoSection title="Project Settings">
				{lastAction && (
					<Alert variant="warning" className="mb-3">
						Action triggered: <strong>{lastAction}</strong>
					</Alert>
				)}
				<DangerZoneActions
					actions={[
						{
							key: 'transfer',
							label: 'Transfer Ownership',
							text: 'Transfer this project to another user or organization. You will lose admin access.',
							buttonText: 'Transfer',
						},
						{
							key: 'archive',
							label: 'Archive Project',
							text: 'Archive this project. It will become read-only and hidden from the dashboard.',
							buttonText: 'Archive',
						},
						{
							key: 'delete',
							label: 'Delete Project',
							text: 'Permanently delete this project and all of its data. This action cannot be undone.',
							buttonText: 'Delete',
						},
					]}
					onActionClick={setLastAction}
				/>
			</DemoSection>

			<DemoSection title="Account Settings">
				<DangerZoneActions
					actions={[
						{
							key: 'revoke-tokens',
							label: 'Revoke All Tokens',
							text: 'Invalidate all active API tokens. You will need to regenerate them.',
							buttonText: 'Revoke Tokens',
						},
						{
							key: 'delete-account',
							label: 'Delete Account',
							text: 'Permanently delete your account, all projects, and associated data.',
							buttonText: 'Delete Account',
						},
					]}
					onActionClick={setLastAction}
				/>
			</DemoSection>
		</DemoPage>
	)
}

export default DangerZoneActionsDemo
