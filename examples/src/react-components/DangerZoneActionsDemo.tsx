import React, { useState } from 'react'
import { DangerZoneActions, Card, Alert, CodeSnippet } from '@toolcase/react-components'

const DangerZoneActionsDemo: React.FC = () => {
	const [lastAction, setLastAction] = useState<string | null>(null)

	return (
		<div className="container my-5">
			<div className="row mb-4">
				<div className="col-12">
					<h1 className="display-4 text-gradient-primary mb-2">DangerZoneActions</h1>
					<p className="text-muted mb-0">A settings section for destructive or irreversible actions with labels, descriptions, and danger buttons.</p>
				</div>
			</div>

			<div className="row mb-5">
				<div className="col-lg-8">
					<Card>
						<h2 className="h5 mb-3">Project Settings</h2>
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
					</Card>
				</div>
			</div>

			<div className="row mb-5">
				<div className="col-lg-8">
					<Card>
						<h2 className="h5 mb-3">Account Settings</h2>
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
							code={`import { DangerZoneActions } from '@webgame-cloud/react-components'

<DangerZoneActions
  actions={[
    { key: 'delete', label: 'Delete Project', text: 'This action cannot be undone.', buttonText: 'Delete' },
    { key: 'transfer', label: 'Transfer Ownership', text: 'Transfer to another user.', buttonText: 'Transfer' },
  ]}
  onActionClick={(key) => console.log(key)}
/>`}
						/>
					</Card>
				</div>
			</div>
		</div>
	)
}

export default DangerZoneActionsDemo
