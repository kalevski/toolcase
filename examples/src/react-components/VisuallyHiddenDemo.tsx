import React from 'react'
import {
	RichPageHeader,
	RichPageHeaderChip,
	SectionCard,
	VisuallyHidden
} from '@toolcase/react-components'

const VisuallyHiddenDemo: React.FC = () => (
	<div className="container py-4">
		<div className="row">
			<div className="col-12">
				<RichPageHeader
				chips={<RichPageHeaderChip>Typography</RichPageHeaderChip>}
				title="VisuallyHidden"
				description="Hides content visually while keeping it accessible to screen readers. Use the browser dev tools or a screen reader to confirm the hidden text is in the DOM."
			/>
				<div className="d-flex flex-column gap-4 mt-4">
		<SectionCard title="Hidden Label for Icon Button">
			<button className="btn btn-outline-secondary">
				<i className="bi bi-heart-fill" />
				<VisuallyHidden>Add to favorites</VisuallyHidden>
			</button>
		</SectionCard>

		<SectionCard title="Skip Link">
			<VisuallyHidden as="div">
				Skip to main content
			</VisuallyHidden>
			<p>The hidden text &quot;Skip to main content&quot; exists in the DOM above this paragraph—inspect to verify.</p>
		</SectionCard>
	</div>
		
			</div>
		</div>
	</div>
)

export default VisuallyHiddenDemo
