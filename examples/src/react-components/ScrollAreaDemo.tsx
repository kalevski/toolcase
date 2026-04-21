import React from 'react'
import { ScrollArea, Card, CodeSnippet } from '@toolcase/react-components'

const usageCode = `import { ScrollArea } from '@toolcase/react-components'

<ScrollArea maxHeight={200}>
  {/* any content */}
</ScrollArea>`

const longContent = Array.from({ length: 30 }, (_, i) => (
	<p key={i} style={{ margin: '0.25rem 0', fontSize: '0.9rem' }}>
		Line {i + 1}: The quick brown fox jumps over the lazy dog.
	</p>
))

export const ScrollAreaDemo: React.FC = () => {
	return (
		<div className="container my-5">
			<div className="row mb-4">
				<div className="col-12">
					<h1 className="display-4 text-gradient-primary mb-2">ScrollArea</h1>
					<p className="text-muted mb-0">Styled scrollable container with custom thin scrollbar that auto-hides.</p>
				</div>
			</div>

			<div className="row mb-5">
				<div className="col-lg-8">
					<Card>
						<h2 className="h5 mb-3">Vertical scroll (maxHeight)</h2>
						<ScrollArea maxHeight={200} style={{ border: '1px solid #e2e8f0', borderRadius: 6, padding: '0.5rem' }}>
							{longContent}
						</ScrollArea>
					</Card>
				</div>
			</div>

			<div className="row mb-5">
				<div className="col-lg-8">
					<Card>
						<h2 className="h5 mb-3">Horizontal scroll</h2>
						<ScrollArea axis="x" style={{ border: '1px solid #e2e8f0', borderRadius: 6, padding: '0.5rem' }}>
							<div style={{ display: 'flex', gap: '0.5rem', width: 'max-content' }}>
								{Array.from({ length: 20 }, (_, i) => (
									<div key={i} style={{ width: 100, height: 80, background: '#f1f5f9', borderRadius: 8, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8rem' }}>
										Card {i + 1}
									</div>
								))}
							</div>
						</ScrollArea>
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
