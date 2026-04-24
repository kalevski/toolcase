import React from 'react'
import { Text } from '@toolcase/react-components'
import { DemoPage, DemoSection } from './_demo'

const TextDemo: React.FC = () => (
	<DemoPage
		eyebrow="Typography"
		title="Text"
		lede="Semantic text component with variant, size, and polymorphic tag support."
	>
		<DemoSection title="Variants">
			<div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
				<Text variant="default">Default text — standard body copy.</Text>
				<Text variant="muted">Muted text — secondary / helper content.</Text>
				<Text variant="code">const x = 42; // inline code</Text>
				<Text variant="mono">Monospace text — for IDs and hashes.</Text>
				<Text variant="truncate" style={{ maxWidth: 200 }}>
					This is a very long text that should be truncated with an ellipsis when it overflows.
				</Text>
			</div>
		</DemoSection>

		<DemoSection title="Sizes">
			<div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
				<Text size="small">Small text</Text>
				<Text size="default">Default text</Text>
				<Text size="large">Large text</Text>
			</div>
		</DemoSection>

		<DemoSection title="Polymorphic Tag">
			<div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
				<Text as="p">Rendered as &lt;p&gt;</Text>
				<Text as="span">Rendered as &lt;span&gt;</Text>
				<Text as="small">Rendered as &lt;small&gt;</Text>
				<Text as="div">Rendered as &lt;div&gt;</Text>
			</div>
		</DemoSection>
	</DemoPage>
)

export default TextDemo
