import React from 'react'
import { ScrollArea } from '@toolcase/react-components'
import { DemoPage, DemoSection } from './_demo'

const longContent = Array.from({ length: 30 }, (_, i) => (
	<p key={i} style={{ margin: '0.25rem 0', fontSize: '0.9rem' }}>
		Line {i + 1}: The quick brown fox jumps over the lazy dog.
	</p>
))

export const ScrollAreaDemo: React.FC = () => {
	return (
		<DemoPage
			eyebrow="Layout & Surfaces"
			title="ScrollArea"
			lede="Styled scrollable container with custom thin scrollbar that auto-hides."
		>
			<DemoSection title="Vertical scroll (maxHeight)">
				<ScrollArea maxHeight={200} style={{ border: '1px solid #e2e8f0', padding: '0.5rem' }}>
					{longContent}
				</ScrollArea>
			</DemoSection>

			<DemoSection title="Horizontal scroll">
				<ScrollArea axis="x" style={{ border: '1px solid #e2e8f0', padding: '0.5rem' }}>
					<div style={{ display: 'flex', gap: '0.5rem', width: 'max-content' }}>
						{Array.from({ length: 20 }, (_, i) => (
							<div key={i} style={{ width: 100, height: 80, background: '#f1f5f9', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8rem' }}>
								Card {i + 1}
							</div>
						))}
					</div>
				</ScrollArea>
			</DemoSection>
		</DemoPage>
	)
}
