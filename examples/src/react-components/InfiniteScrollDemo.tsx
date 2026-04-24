import React, { useState } from 'react'
import { InfiniteScroll } from '@toolcase/react-components'
import { DemoPage, DemoSection } from './_demo'

export const InfiniteScrollDemo: React.FC = () => {
	const [items, setItems] = useState<number[]>(Array.from({ length: 20 }, (_, i) => i + 1))
	const [loading, setLoading] = useState(false)
	const [hasMore, setHasMore] = useState(true)

	const loadMore = () => {
		if (loading) return
		setLoading(true)
		setTimeout(() => {
			setItems((prev) => {
				const next = Array.from({ length: 10 }, (_, i) => prev.length + i + 1)
				const all  = [...prev, ...next]
				if (all.length >= 60) setHasMore(false)
				return all
			})
			setLoading(false)
		}, 800)
	}

	return (
		<DemoPage
			eyebrow="Layout & Surfaces"
			title="InfiniteScroll"
			lede="Automatically loads more content when the user scrolls to the bottom."
		>
			<DemoSection title="Load more on scroll">
				<div style={{ maxHeight: 400, overflowY: 'auto', border: '1px solid #e2e8f0', borderRadius: 8 }}>
					<InfiniteScroll
						onLoadMore={loadMore}
						hasMore={hasMore}
						loading={loading}
						endSlot={<p className="text-center text-muted" style={{ fontSize: '0.875rem' }}>You've reached the end!</p>}
					>
						{items.map((n) => (
							<div
								key={n}
								style={{
									padding: '0.6rem 1rem',
									borderBottom: '1px solid #f1f5f9',
									fontSize: '0.9rem',
								}}
							>
								Row #{n}
							</div>
						))}
					</InfiniteScroll>
				</div>
				<p className="text-muted mt-2 mb-0" style={{ fontSize: '0.85rem' }}>
					{items.length} items loaded
				</p>
			</DemoSection>
		</DemoPage>
	)
}
