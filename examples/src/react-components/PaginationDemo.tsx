import React, { useState } from 'react'
import { Pagination } from '@toolcase/react-components'
import { DemoPage, DemoSection } from './_demo'

const PaginationDemo: React.FC = () => {
	const [offset1, setOffset1] = useState(0)
	const [offset2, setOffset2] = useState(30)
	const [offset3, setOffset3] = useState(0)
	const [offset4, setOffset4] = useState(200)

	return (
		<DemoPage
			eyebrow="Navigation"
			title="Pagination"
			lede="Navigate between pages with numbered buttons, prev/next arrows, and result summary."
		>
			<DemoSection title="Basic">
				<Pagination limit={10} offset={offset1} total={50} onChange={setOffset1} />
			</DemoSection>

			<DemoSection title="With Result Summary">
				<Pagination
					limit={10}
					offset={offset2}
					total={97}
					onChange={setOffset2}
				/>
			</DemoSection>

			<DemoSection title="Many Pages (Dots Truncation)">
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
			</DemoSection>

			<DemoSection title="Single Page">
				<Pagination limit={10} offset={0} total={3} />
			</DemoSection>

			<DemoSection
				title="siblingCount Variants"
				caption="Controls how many page numbers appear around the active page."
			>
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
			</DemoSection>
		</DemoPage>
	)
}

export default PaginationDemo
