import React, { useState } from 'react'
import { Alert, Button, CodeSnippet } from '@toolcase/react-components'
import { DemoPage, DemoSection } from './_demo'

const AlertDemo: React.FC = () => {
	const [showInfo, setShowInfo] = useState(true)
	const [stack, setStack] = useState<number[]>([1, 2])

	const addAlert = () => setStack((s) => [...s, s.length + 1])
	const dismissAlert = (id: number) => setStack((s) => s.filter((n) => n !== id))

	return (
		<DemoPage
			eyebrow="Feedback"
			title="Alert"
			lede={
				<>
					An inline status banner for page- or section-level announcements — six semantic{' '}
					<code>variant</code>s, optional <code>title</code>, <code>icon</code>, and{' '}
					<code>dismissible</code> behavior. Use <code>role="status"</code> for info/success and{' '}
					<code>role="alert"</code> for warning/danger so screen readers announce correctly.
				</>
			}
		>
			<DemoSection
				eyebrow="Semantic meaning"
				title="Variants"
				caption="One line of copy each. Pick the variant that matches the severity of what happened."
			>
				<div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
					<Alert variant="primary">A new version of webgame.cloud is available.</Alert>
					<Alert variant="secondary">Your changes are saved to a draft automatically.</Alert>
					<Alert variant="info">Build artifacts are kept for 30 days before being purged.</Alert>
					<Alert variant="success">Bundle <code>mobile_lo.pack</code> published to production.</Alert>
					<Alert variant="warning">Storage is at 82% — consider archiving old builds.</Alert>
					<Alert variant="danger">Deployment failed: asset checksum did not match manifest.</Alert>
				</div>
			</DemoSection>

			<DemoSection
				eyebrow="Anatomy"
				title="With title"
				caption="Lead with a one-line title that captures the state. Use the body for the action or next step."
			>
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
			</DemoSection>

			<DemoSection
				eyebrow="Interaction"
				title="Dismissible"
				caption="Use dismissible when the alert is informational. For error states, prefer keeping it visible until the issue is resolved."
			>
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
			</DemoSection>

			<DemoSection
				eyebrow="State"
				title="Loading"
				caption="Attach a spinner to an alert while an async operation is in flight."
			>
				<div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
					<Alert variant="primary" loading>Uploading <code>level-03.atlas</code> — 62% of 14.3 MB.</Alert>
					<Alert variant="info" loading title="Syncing">
						Pulling the latest schema from <code>prod</code>…
					</Alert>
				</div>
			</DemoSection>

			<DemoSection
				eyebrow="Realistic usage"
				title="Notification stack"
				caption="Alerts composed as a feed. Add events and dismiss them individually."
				aside={
					<Button variant="primary" size="small" onClick={addAlert}>
						Push event
					</Button>
				}
			>
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
			</DemoSection>

			<DemoSection eyebrow="API" title="Usage">
				<CodeSnippet
					language="typescript"
					code={`import { Alert } from '@toolcase/react-components'

<Alert variant="success" title="Published" icon="check-circle-fill">
  Your build is live at indie-raid.webgame.cloud.
</Alert>

<Alert variant="info" dismissible onClose={handleClose}>
  You have 12 unread notifications.
</Alert>`}
				/>
			</DemoSection>
		</DemoPage>
	)
}

export default AlertDemo
