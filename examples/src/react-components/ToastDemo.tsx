import React from 'react'
import {
	Button,
	RichPageHeader,
	RichPageHeaderChip,
	SectionCard,
	ToastProvider,
	toast
} from '@toolcase/react-components'
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
		<div className="container py-4">
		<div className="row">
			<div className="col-12">
				<RichPageHeader
				chips={<RichPageHeaderChip>Feedback</RichPageHeaderChip>}
				title="Toast"
				description={
				<>
					Auto-dismissing notification toasts with a global imperative API.
					Wrap your app in <code>ToastProvider</code> once, then call{' '}
					<code>toast.success()</code> from anywhere.
				</>
			}
			/>
				<div className="d-flex flex-column gap-4 mt-4">
			<SectionCard title="Variants">
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
			</SectionCard>

			<SectionCard title="With title">
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
			</SectionCard>

			<SectionCard title="Positions">
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
			</SectionCard>

			<SectionCard title="Dismiss all">
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
			</SectionCard>
		</div>
		
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
