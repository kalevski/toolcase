import React from 'react'
import { Brand } from '@toolcase/react-components'
import { DemoPage, DemoSection } from './_demo'

const BrandDemo: React.FC = () => (
	<DemoPage
		eyebrow="Marketing"
		title="Brand"
		lede="A brand logo element with primary/secondary text, underline color, label badge, and clickable mode."
	>
		<DemoSection title="Default">
			<div className="d-flex flex-column gap-4">
				<Brand primaryText="webgame" secondaryText=".cloud" />
				<Brand primaryText="pixel" secondaryText="forge" />
			</div>
		</DemoSection>

		<DemoSection title="With Color & Label">
			<div className="d-flex flex-column gap-4">
				<Brand primaryText="webgame" secondaryText=".cloud" color="#6366f1" label="beta" />
				<Brand primaryText="game" secondaryText="hub" color="#ef4444" label="new" />
			</div>
		</DemoSection>

		<DemoSection title="Clickable">
			<Brand
				primaryText="webgame"
				secondaryText=".cloud"
				color="#6366f1"
				onClick={() => alert('Brand clicked')}
			/>
		</DemoSection>

		<DemoSection title="XLarge">
			<Brand primaryText="webgame" secondaryText=".cloud" color="#6366f1" label="beta" xlarge />
		</DemoSection>
	</DemoPage>
)

export default BrandDemo
