import React from 'react'
import { VisuallyHidden } from '@toolcase/react-components'
import { DemoPage, DemoSection } from './_demo'

const VisuallyHiddenDemo: React.FC = () => (
	<DemoPage
		eyebrow="Typography"
		title="VisuallyHidden"
		lede="Hides content visually while keeping it accessible to screen readers. Use the browser dev tools or a screen reader to confirm the hidden text is in the DOM."
	>
		<DemoSection
			title="Hidden Label for Icon Button"
			caption="The button below only shows an icon, but has an accessible label for screen readers."
		>
			<button className="btn btn-outline-secondary">
				<i className="bi bi-heart-fill" />
				<VisuallyHidden>Add to favorites</VisuallyHidden>
			</button>
		</DemoSection>

		<DemoSection
			title="Skip Link"
			caption="A common pattern for skip-navigation links. The text below is invisible but present in the DOM."
		>
			<VisuallyHidden as="div">
				Skip to main content
			</VisuallyHidden>
			<p>The hidden text &quot;Skip to main content&quot; exists in the DOM above this paragraph—inspect to verify.</p>
		</DemoSection>
	</DemoPage>
)

export default VisuallyHiddenDemo
