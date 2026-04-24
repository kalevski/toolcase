import React from 'react'
import {
	Button,
	Popover,
	RichPageHeader,
	RichPageHeaderChip,
	SectionCard
} from '@toolcase/react-components'

export const PopoverDemo: React.FC = () => {
	return (
		<div className="container py-4">
		<div className="row">
			<div className="col-12">
				<RichPageHeader
				chips={<RichPageHeaderChip>Overlays</RichPageHeaderChip>}
				title="Popover"
				description="Floating content panel anchored to a trigger element, with automatic viewport-edge detection."
			/>
				<div className="d-flex flex-column gap-4 mt-4">
			<SectionCard title="Placements">
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
			</SectionCard>

			<SectionCard title="Hover trigger">
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
			</SectionCard>

			<SectionCard title="Rich content">
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
			</SectionCard>
		</div>
		
			</div>
		</div>
	</div>
	)
}

export default PopoverDemo
