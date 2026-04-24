import React from 'react'
import { ToastProvider, toast, Button } from '@toolcase/react-components'
import type { ToastPosition } from '@toolcase/react-components'
import { DemoPage, DemoSection } from './_demo'

const POSITIONS: ToastPosition[] = [
	'top-right',
	'top-left',
	'top-center',
	'bottom-right',
	'bottom-left',
	'bottom-center',
]

function ToastDemoInner() {
	return (
		<DemoPage
			eyebrow="Feedback"
			title="Toast"
			lede={
				<>
					Auto-dismissing notification toasts with a global imperative API.
					Wrap your app in <code>ToastProvider</code> once, then call{' '}
					<code>toast.success()</code> from anywhere.
				</>
			}
		>
			<DemoSection title="Variants">
				<div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
					<Button variant="success" onClick={() => toast.success('Profile saved successfully!')}>
						Success
					</Button>
					<Button variant="danger" onClick={() => toast.error('Something went wrong. Please try again.')}>
						Error
					</Button>
					<Button variant="warning" onClick={() => toast.warning('Your session will expire in 5 minutes.')}>
						Warning
					</Button>
					<Button variant="info" onClick={() => toast.info('A new version is available.')}>
						Info
					</Button>
				</div>
			</DemoSection>

			<DemoSection title="With title">
				<div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
					<Button
						variant="success"
						onClick={() =>
							toast.success('Your changes have been saved.', { title: 'Saved' })
						}
					>
						Success with title
					</Button>
					<Button
						variant="danger"
						onClick={() =>
							toast.error('Unable to connect to the server.', {
								title: 'Connection failed',
								duration: 0,
							})
						}
					>
						Persistent error
					</Button>
				</div>
			</DemoSection>

			<DemoSection title="Positions">
				<div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
					{POSITIONS.map((pos) => (
						<Button
							key={pos}
							variant="secondary"
							onClick={() =>
								toast.info(`Toast at ${pos}`, { position: pos, duration: 2500 })
							}
						>
							{pos}
						</Button>
					))}
				</div>
			</DemoSection>

			<DemoSection title="Dismiss all">
				<div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
					<Button
						variant="primary"
						onClick={() => {
							toast.success('Toast 1')
							toast.warning('Toast 2')
							toast.error('Toast 3')
						}}
					>
						Fire 3 toasts
					</Button>
					<Button variant="secondary" onClick={() => toast.dismissAll()}>
						Dismiss all
					</Button>
				</div>
			</DemoSection>
		</DemoPage>
	)
}

export const ToastDemo: React.FC = () => (
	<ToastProvider>
		<ToastDemoInner />
	</ToastProvider>
)
