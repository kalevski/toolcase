import React from 'react'
import {
	Brand,
	RichPageHeader,
	RichPageHeaderChip,
	SectionCard
} from '@toolcase/react-components'

const BrandDemo: React.FC = () => (
	<div className="container py-4">
		<div className="row">
			<div className="col-12">
				<RichPageHeader
				chips={<RichPageHeaderChip>Marketing</RichPageHeaderChip>}
				title="Brand"
				description="A brand logo element with primary/secondary text, underline color, label badge, and clickable mode."
			/>
				<div className="d-flex flex-column gap-4 mt-4">
		<SectionCard title="Default">
			<div className="d-flex flex-column gap-4">
				<Brand primaryText="webgame" secondaryText=".cloud" />
				<Brand primaryText="pixel" secondaryText="forge" />
			</div>
		</SectionCard>

		<SectionCard title="With Color & Label">
			<div className="d-flex flex-column gap-4">
				<Brand primaryText="webgame" secondaryText=".cloud" color="#6366f1" label="beta" />
				<Brand primaryText="game" secondaryText="hub" color="#ef4444" label="new" />
			</div>
		</SectionCard>

		<SectionCard title="Clickable">
			<Brand
				primaryText="webgame"
				secondaryText=".cloud"
				color="#6366f1"
				onClick={() => alert('Brand clicked')}
			/>
		</SectionCard>

		<SectionCard title="XLarge">
			<Brand primaryText="webgame" secondaryText=".cloud" color="#6366f1" label="beta" xlarge />
		</SectionCard>
	</div>
		
			</div>
		</div>
	</div>
)

export default BrandDemo
