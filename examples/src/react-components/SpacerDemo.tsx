import React from 'react'
import {
	RichPageHeader,
	RichPageHeaderChip,
	SectionCard,
	Spacer
} from '@toolcase/react-components'

const SpacerDemo: React.FC = () => (
	<div className="container py-4">
		<div className="row">
			<div className="col-12">
				<RichPageHeader
				chips={<RichPageHeaderChip>Layout & Surfaces</RichPageHeaderChip>}
				title="Spacer"
				description="Flex spacer or fixed-size gap for layout spacing. Supports horizontal and vertical axis."
			/>
				<div className="d-flex flex-column gap-4 mt-4">
		<SectionCard title="Flex Spacer (horizontal)">
			<div style={{ display: 'flex', alignItems: 'center', border: '1px dashed #e2e8f0', padding: '0.75rem' }}>
				<span>Left</span>
				<Spacer axis="horizontal" />
				<span>Right</span>
			</div>
		</SectionCard>

		<SectionCard title="Fixed Size (vertical)">
			<div style={{ border: '1px dashed #e2e8f0', padding: '0.75rem' }}>
				<div style={{ background: '#eef2ff', padding: '0.5rem' }}>Top Block</div>
				<Spacer size={24} axis="vertical" />
				<div style={{ background: '#eef2ff', padding: '0.5rem' }}>Bottom Block (24px gap)</div>
				<Spacer size={48} axis="vertical" />
				<div style={{ background: '#eef2ff', padding: '0.5rem' }}>Even Further (48px gap)</div>
			</div>
		</SectionCard>

		<SectionCard title="Fixed Size (horizontal)">
			<div style={{ display: 'flex', border: '1px dashed #e2e8f0', padding: '0.75rem' }}>
				<div style={{ background: '#f0fdf4', padding: '0.5rem' }}>A</div>
				<Spacer size={32} axis="horizontal" />
				<div style={{ background: '#f0fdf4', padding: '0.5rem' }}>B (32px gap)</div>
				<Spacer size={64} axis="horizontal" />
				<div style={{ background: '#f0fdf4', padding: '0.5rem' }}>C (64px gap)</div>
			</div>
		</SectionCard>
	</div>
		
			</div>
		</div>
	</div>
)

export default SpacerDemo
