import React, { useState } from 'react'
import {
	Pagination,
	RichPageHeader,
	RichPageHeaderChip,
	SectionCard
} from '@toolcase/react-components'

const PaginationDemo: React.FC = () => {
	const [offset1, setOffset1] = useState(0)
	const [offset2, setOffset2] = useState(30)
	const [offset3, setOffset3] = useState(0)
	const [offset4, setOffset4] = useState(200)

	return (
		<div className="container py-4">
		<div className="row">
			<div className="col-12">
				<RichPageHeader
				chips={<RichPageHeaderChip>Navigation</RichPageHeaderChip>}
				title="Pagination"
				description="Navigate between pages with numbered buttons, prev/next arrows, and result summary."
			/>
				<div className="d-flex flex-column gap-4 mt-4">
			<SectionCard title="Basic">
				<Pagination limit={10} offset={offset1} total={50} onChange={setOffset1} />
			</SectionCard>

			<SectionCard title="With Result Summary">
				<Pagination
					limit={10}
					offset={offset2}
					total={97}
					onChange={setOffset2}
				/>
			</SectionCard>

			<SectionCard title="Many Pages (Dots Truncation)">
				<Pagination
					limit={10}
					offset={offset3}
					total={500}
					onChange={setOffset3}
				/>
				<div style={{ marginTop: 8 }}>
					<div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
						<button className="btn btn-sm btn-outline-secondary" onClick={() => setOffset3(0)}>Go to 1</button>
						<button className="btn btn-sm btn-outline-secondary" onClick={() => setOffset3(240)}>Go to 25</button>
						<button className="btn btn-sm btn-outline-secondary" onClick={() => setOffset3(490)}>Go to 50</button>
					</div>
				</div>
			</SectionCard>

			<SectionCard title="Single Page">
				<Pagination limit={10} offset={0} total={3} />
			</SectionCard>

			<SectionCard title="siblingCount Variants">
				<div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
					<div>
						<p style={{ color: '#64748b', fontSize: '0.85rem', marginBottom: 4 }}>siblingCount=0 (minimal)</p>
						<Pagination limit={10} offset={offset4} total={500} onChange={setOffset4} siblingCount={0} />
					</div>
					<div>
						<p style={{ color: '#64748b', fontSize: '0.85rem', marginBottom: 4 }}>siblingCount=1 (default)</p>
						<Pagination limit={10} offset={offset4} total={500} onChange={setOffset4} siblingCount={1} />
					</div>
					<div>
						<p style={{ color: '#64748b', fontSize: '0.85rem', marginBottom: 4 }}>siblingCount=2 (wider)</p>
						<Pagination limit={10} offset={offset4} total={500} onChange={setOffset4} siblingCount={2} />
					</div>
				</div>
			</SectionCard>
		</div>
		
			</div>
		</div>
	</div>
	)
}

export default PaginationDemo
