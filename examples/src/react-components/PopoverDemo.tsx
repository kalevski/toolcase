import React from 'react'
import { Popover, Button } from '@toolcase/react-components'
import { DemoPage, DemoSection } from './_demo'

export const PopoverDemo: React.FC = () => {
	return (
		<DemoPage
			eyebrow="Overlays"
			title="Popover"
			lede="Floating content panel anchored to a trigger element, with automatic viewport-edge detection."
		>
			<DemoSection title="Placements">
				<div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
					{(['top', 'top-start', 'top-end', 'bottom', 'bottom-start', 'bottom-end', 'left', 'right'] as const).map((placement) => (
						<Popover
							key={placement}
							placement={placement}
							content={
								<div style={{ minWidth: 140 }}>
									<strong>Placement: {placement}</strong>
									<p style={{ marginBottom: 0, color: '#64748b', fontSize: '0.85rem', marginTop: 4 }}>This is the popover content.</p>
								</div>
							}
						>
							<Button variant="secondary" size="small">{placement}</Button>
						</Popover>
					))}
				</div>
			</DemoSection>

			<DemoSection title="Hover trigger">
				<Popover
					trigger="hover"
					placement="right"
					content={
						<div style={{ minWidth: 180 }}>
							<strong>Hover popover</strong>
							<p style={{ marginBottom: 0, color: '#64748b', fontSize: '0.85rem', marginTop: 4 }}>Appears on mouse enter, disappears on mouse leave.</p>
						</div>
					}
				>
					<Button variant="primary">Hover me</Button>
				</Popover>
			</DemoSection>

			<DemoSection title="Rich content">
				<Popover
					placement="bottom-start"
					content={
						<div style={{ minWidth: 200 }}>
							<h6 style={{ marginBottom: 8 }}>User info</h6>
							<p style={{ color: '#64748b', fontSize: '0.85rem', marginBottom: 4 }}>Name: Jane Smith</p>
							<p style={{ color: '#64748b', fontSize: '0.85rem', marginBottom: 0 }}>Role: Administrator</p>
						</div>
					}
				>
					<Button variant="primary">View user</Button>
				</Popover>
			</DemoSection>
		</DemoPage>
	)
}

export default PopoverDemo
