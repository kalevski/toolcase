import React from 'react'
import {
	Heading,
	RichPageHeader,
	RichPageHeaderChip,
	SectionCard
} from '@toolcase/react-components'

const HeadingDemo: React.FC = () => (
	<div className="container py-4">
		<div className="row">
			<div className="col-12">
				<RichPageHeader
				chips={<RichPageHeaderChip>Typography</RichPageHeaderChip>}
				title="Heading"
				description="Semantic heading component with h1–h6 support and optional gradient styling."
			/>
				<div className="d-flex flex-column gap-4 mt-4">
		<SectionCard title="Levels">
			<div className="d-flex flex-column gap-3">
				<Heading as="h1">Heading 1</Heading>
				<Heading as="h2">Heading 2</Heading>
				<Heading as="h3">Heading 3</Heading>
				<Heading as="h4">Heading 4</Heading>
				<Heading as="h5">Heading 5</Heading>
				<Heading as="h6">Heading 6</Heading>
			</div>
		</SectionCard>

		<SectionCard title="Gradient">
			<div className="d-flex flex-column gap-3">
				<Heading as="h1" gradient>Gradient Heading 1</Heading>
				<Heading as="h2" gradient>Gradient Heading 2</Heading>
				<Heading as="h3" gradient>Gradient Heading 3</Heading>
			</div>
		</SectionCard>
	</div>
		
			</div>
		</div>
	</div>
)

export default HeadingDemo
