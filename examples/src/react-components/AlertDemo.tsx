import React, { useState } from 'react'
import {
	Alert,
	Button,
	RichPageHeader,
	RichPageHeaderChip,
	SectionCard
} from '@toolcase/react-components'

const AlertDemo: React.FC = () => {
	const [showInfo, setShowInfo] = useState(true)
	const [stack, setStack] = useState<number[]>([1, 2])

	const addAlert = () => setStack((s) => [...s, s.length + 1])
	const dismissAlert = (id: number) => setStack((s) => s.filter((n) => n !== id))

	return (
		<div className="container py-4">
		<div className="row">
			<div className="col-12">
				<RichPageHeader
				chips={<RichPageHeaderChip>Feedback</RichPageHeaderChip>}
				title="Alert"
				description={
				<>
					An inline status banner for page- or section-level announcements — six semantic{' '}
					<code>variant</code>s, optional <code>title</code>, <code>icon</code>, and{' '}
					<code>dismissible</code> behavior. Use <code>role="status"</code> for info/success and{' '}
					<code>role="alert"</code> for warning/danger so screen readers announce correctly.
				</>
			}
			/>
				<div className="d-flex flex-column gap-4 mt-4">
			<SectionCard title="Variants">
				<div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
					<Alert variant="primary">A new version of webgame.cloud is available.</Alert>
					<Alert variant="secondary">Your changes are saved to a draft automatically.</Alert>
					<Alert variant="info">Build artifacts are kept for 30 days before being purged.</Alert>
					<Alert variant="success">Bundle <code>mobile_lo.pack</code> published to production.</Alert>
					<Alert variant="warning">Storage is at 82% — consider archiving old builds.</Alert>
					<Alert variant="danger">Deployment failed: asset checksum did not match manifest.</Alert>
				</div>
			</SectionCard>

			<SectionCard title="With title">
				<div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
					<Alert variant="success" title="Published" icon="check-circle-fill">
						Your build is live at <code>indie-raid.webgame.cloud</code>.
					</Alert>
					<Alert variant="warning" title="Action required" icon="exclamation-triangle-fill">
						Two team invites are still pending — resend them before the billing cycle closes.
					</Alert>
					<Alert variant="danger" title="Upload failed" icon="x-circle-fill">
						Network dropped after 2.4 MB of 8.1 MB. Retrying will resume from where it stopped.
					</Alert>
				</div>
			</SectionCard>

			<SectionCard title="Dismissible">
				{showInfo ? (
					<Alert
						variant="info"
						title="Heads up"
						icon="info-circle-fill"
						dismissible
						onClose={() => setShowInfo(false)}
					>
						You have 12 unread notifications in your project inbox.
					</Alert>
				) : (
					<Button variant="secondary" outline size="small" onClick={() => setShowInfo(true)}>
						Restore alert
					</Button>
				)}
			</SectionCard>

			<SectionCard title="Loading">
				<div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
					<Alert variant="primary" loading>Uploading <code>level-03.atlas</code> — 62% of 14.3 MB.</Alert>
					<Alert variant="info" loading title="Syncing">
						Pulling the latest schema from <code>prod</code>…
					</Alert>
				</div>
			</SectionCard>

			<SectionCard title="Notification stack" action={
					<Button variant="primary" size="small" onClick={addAlert}>
						Push event
					</Button>
				}>
				{stack.length === 0 ? (
					<p style={{ margin: 0, color: '#64748b', fontSize: '0.9rem' }}>
						All clear — no active events.
					</p>
				) : (
					<div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
						{stack.map((id) => (
							<Alert
								key={id}
								variant={id % 3 === 0 ? 'warning' : id % 2 === 0 ? 'info' : 'success'}
								dismissible
								onClose={() => dismissAlert(id)}
							>
								Event #{id} — asset pipeline updated at {new Date().toLocaleTimeString()}
							</Alert>
						))}
					</div>
				)}
			</SectionCard>
		</div>
		
			</div>
		</div>
	</div>
	)
}

export default AlertDemo
