import React from 'react'
import { Popover, Button, Card, CodeSnippet } from '@toolcase/react-components'

export const PopoverDemo: React.FC = () => {
	const usageCode = `import { Popover, Button } from '@toolcase/react-components'

// Click-triggered popover (default)
<Popover
  content={<p>Hello from the popover!</p>}
  placement="bottom"
>
  <Button variant="primary">Click me</Button>
</Popover>

// Hover-triggered
<Popover
  content={<p>Hover content</p>}
  trigger="hover"
  placement="top"
>
  <Button variant="secondary">Hover me</Button>
</Popover>`

	return (
		<div className="container my-5">
			<div className="row mb-4">
				<div className="col-12">
					<h1 className="display-4 text-gradient-primary mb-2">Popover</h1>
					<p className="text-muted mb-0">Floating content panel anchored to a trigger element, with automatic viewport-edge detection.</p>
				</div>
			</div>

			{/* Placements */}
			<div className="row mb-5">
				<div className="col-lg-8">
					<Card>
						<h2 className="h5 mb-3">Placements</h2>
						<div className="d-flex flex-wrap gap-2">
							{(['top', 'top-start', 'top-end', 'bottom', 'bottom-start', 'bottom-end', 'left', 'right'] as const).map((placement) => (
								<Popover
									key={placement}
									placement={placement}
									content={
										<div style={{ minWidth: 140 }}>
											<strong>Placement: {placement}</strong>
											<p className="mb-0 text-muted small mt-1">This is the popover content.</p>
										</div>
									}
								>
									<Button variant="secondary" size="small">{placement}</Button>
								</Popover>
							))}
						</div>
					</Card>
				</div>
			</div>

			{/* Hover trigger */}
			<div className="row mb-5">
				<div className="col-lg-8">
					<Card>
						<h2 className="h5 mb-3">Hover trigger</h2>
						<Popover
							trigger="hover"
							placement="right"
							content={
								<div style={{ minWidth: 180 }}>
									<strong>Hover popover</strong>
									<p className="mb-0 text-muted small mt-1">Appears on mouse enter, disappears on mouse leave.</p>
								</div>
							}
						>
							<Button variant="primary">Hover me</Button>
						</Popover>
					</Card>
				</div>
			</div>

			{/* Rich content */}
			<div className="row mb-5">
				<div className="col-lg-8">
					<Card>
						<h2 className="h5 mb-3">Rich content</h2>
						<Popover
							placement="bottom-start"
							content={
								<div style={{ minWidth: 200 }}>
									<h6 className="mb-2">User info</h6>
									<p className="text-muted small mb-1">Name: Jane Smith</p>
									<p className="text-muted small mb-0">Role: Administrator</p>
								</div>
							}
						>
							<Button variant="primary">View user</Button>
						</Popover>
					</Card>
				</div>
			</div>

			{/* Code */}
			<div className="row mb-5">
				<div className="col-12">
					<Card>
						<h2 className="h5 mb-3">Usage</h2>
						<CodeSnippet language="typescript" code={usageCode} />
					</Card>
				</div>
			</div>
		</div>
	)
}

export default PopoverDemo
