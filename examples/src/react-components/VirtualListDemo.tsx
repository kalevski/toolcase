import React from 'react'
import { VirtualList } from '@toolcase/react-components'
import { DemoPage, DemoSection } from './_demo'

interface Item {
	id: number
	title: string
	description: string
}

const ITEMS: Item[] = Array.from({ length: 10000 }, (_, i) => ({
	id: i,
	title: `Item #${i + 1}`,
	description: `This is the description for item ${i + 1}. It contains some text.`,
}))

export const VirtualListDemo: React.FC = () => {
	return (
		<DemoPage
			eyebrow="Layout & Surfaces"
			title="VirtualList"
			lede="Renders 10,000 items — only the visible rows are in the DOM."
		>
			<DemoSection title="10,000 rows (fixed height)">
				<VirtualList
					items={ITEMS}
					itemHeight={64}
					height={400}
					style={{ border: '1px solid #e2e8f0' }}
					renderItem={(item) => (
						<div
							style={{
								display: 'flex',
								flexDirection: 'column',
								justifyContent: 'center',
								padding: '0 1rem',
								height: '100%',
								borderBottom: '1px solid #f1f5f9',
							}}
						>
							<strong style={{ fontSize: '0.875rem' }}>{item.title}</strong>
							<span style={{ fontSize: '0.8rem', color: '#64748b' }}>{item.description}</span>
						</div>
					)}
				/>
			</DemoSection>
		</DemoPage>
	)
}
