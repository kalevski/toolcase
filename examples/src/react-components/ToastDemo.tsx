import React from 'react'
import { ToastProvider, toast, Button, Card, CodeSnippet } from '@toolcase/react-components'
import type { ToastPosition } from '@toolcase/react-components'

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
		<div className="container my-5">
			<div className="row mb-4">
				<div className="col-12">
					<h1 className="display-4 text-gradient-primary mb-2">Toast</h1>
					<p className="text-muted mb-0">
						Auto-dismissing notification toasts with a global imperative API.
						Wrap your app in <code>ToastProvider</code> once, then call{' '}
						<code>toast.success()</code> from anywhere.
					</p>
				</div>
			</div>

			{/* Variants */}
			<div className="row mb-5">
				<div className="col-lg-8">
					<Card>
						<h2 className="h5 mb-3">Variants</h2>
						<div className="d-flex flex-wrap gap-2">
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
					</Card>
				</div>
			</div>

			{/* With title */}
			<div className="row mb-5">
				<div className="col-lg-8">
					<Card>
						<h2 className="h5 mb-3">With title</h2>
						<div className="d-flex flex-wrap gap-2">
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
					</Card>
				</div>
			</div>

			{/* Positions */}
			<div className="row mb-5">
				<div className="col-lg-8">
					<Card>
						<h2 className="h5 mb-3">Positions</h2>
						<div className="d-flex flex-wrap gap-2">
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
					</Card>
				</div>
			</div>

			{/* Dismiss controls */}
			<div className="row mb-5">
				<div className="col-lg-8">
					<Card>
						<h2 className="h5 mb-3">Dismiss all</h2>
						<div className="d-flex flex-wrap gap-2">
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
							code={`import { ToastProvider, toast } from '@toolcase/react-components'

// 1. Wrap your app once (e.g. in main.tsx or App.tsx)
<ToastProvider defaultPosition="top-right" defaultDuration={4000}>
  <App />
</ToastProvider>

// 2. Call from anywhere — no imports of context or hooks needed
toast.success('Profile saved')
toast.error('Upload failed', { title: 'Error' })
toast.warning('Low disk space', { duration: 0 }) // persistent
toast.info('New version available', { position: 'bottom-center' })

// Dismiss programmatically
const id = toast.info('Processing…', { duration: 0 })
toast.dismiss(id)
toast.dismissAll()`}
						/>
					</Card>
				</div>
			</div>
		</div>
	)
}

export const ToastDemo: React.FC = () => (
	<ToastProvider>
		<ToastDemoInner />
	</ToastProvider>
)
