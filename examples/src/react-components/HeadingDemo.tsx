import React from 'react'
import { Heading } from '@toolcase/react-components'
import { DemoPage, DemoSection } from './_demo'

const HeadingDemo: React.FC = () => (
	<DemoPage
		eyebrow="Typography"
		title="Heading"
		lede="Semantic heading component with h1–h6 support and optional gradient styling."
	>
		<DemoSection title="Levels">
			<div className="d-flex flex-column gap-3">
				<Heading as="h1">Heading 1</Heading>
				<Heading as="h2">Heading 2</Heading>
				<Heading as="h3">Heading 3</Heading>
				<Heading as="h4">Heading 4</Heading>
				<Heading as="h5">Heading 5</Heading>
				<Heading as="h6">Heading 6</Heading>
			</div>
		</DemoSection>

		<DemoSection title="Gradient">
			<div className="d-flex flex-column gap-3">
				<Heading as="h1" gradient>Gradient Heading 1</Heading>
				<Heading as="h2" gradient>Gradient Heading 2</Heading>
				<Heading as="h3" gradient>Gradient Heading 3</Heading>
			</div>
		</DemoSection>
	</DemoPage>
)

export default HeadingDemo
