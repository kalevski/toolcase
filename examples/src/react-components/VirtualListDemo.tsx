import React from 'react'
import { VirtualList, Card, CodeSnippet } from '@toolcase/react-components'

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

const usageCode = `import { VirtualList } from '@toolcase/react-components'

<VirtualList
  items={data}
  itemHeight={64}
  height={400}
  renderItem={(item, index) => (
    <div style={{ padding: '0.75rem 1rem', borderBottom: '1px solid #e2e8f0' }}>
      {item.title}
    </div>
  )}
/>`

export const VirtualListDemo: React.FC = () => {
	return (
		<div className="container my-5">
			<div className="row mb-4">
				<div className="col-12">
					<h1 className="display-4 text-gradient-primary mb-2">VirtualList</h1>
					<p className="text-muted mb-0">
						Renders 10,000 items — only the visible rows are in the DOM.
					</p>
				</div>
			</div>

			<div className="row mb-5">
				<div className="col-12">
					<Card>
						<h2 className="h5 mb-3">10,000 rows (fixed height)</h2>
						<VirtualList
							items={ITEMS}
							itemHeight={64}
							height={400}
							style={{ border: '1px solid #e2e8f0', borderRadius: 8 }}
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
