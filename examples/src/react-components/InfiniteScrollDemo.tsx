import React, { useState } from 'react'
import { InfiniteScroll, Card, CodeSnippet } from '@toolcase/react-components'

const usageCode = `import { InfiniteScroll } from '@toolcase/react-components'

<InfiniteScroll
  onLoadMore={loadNextPage}
  hasMore={hasMorePages}
  loading={isLoading}
  endSlot={<p>No more items</p>}
>
  {items.map(item => <div key={item.id}>{item.title}</div>)}
</InfiniteScroll>`

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
		<div className="container my-5">
			<div className="row mb-4">
				<div className="col-12">
					<h1 className="display-4 text-gradient-primary mb-2">InfiniteScroll</h1>
					<p className="text-muted mb-0">Automatically loads more content when the user scrolls to the bottom.</p>
				</div>
			</div>

			<div className="row mb-5">
				<div className="col-lg-8">
					<Card>
						<h2 className="h5 mb-3">Load more on scroll</h2>
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
					</Card>
				</div>
			</div>

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
