import React from 'react'
import { IconButton } from '@toolcase/react-components'
import { DemoPage, DemoSection } from './_demo'

const IconButtonDemo: React.FC = () => (
	<DemoPage
		eyebrow="Buttons & Actions"
		title="IconButton"
		lede="Square icon-only button with size, variant, and outline options."
	>
		<DemoSection title="Variants">
			<div className="d-flex gap-2 flex-wrap align-items-center">
				<IconButton icon="pencil" variant="primary" label="Edit" />
				<IconButton icon="trash" variant="danger" label="Delete" />
				<IconButton icon="gear" variant="secondary" label="Settings" />
				<IconButton icon="info-circle" variant="info" label="Info" />
				<IconButton icon="check-circle" variant="success" label="Confirm" />
				<IconButton icon="exclamation-triangle" variant="warning" label="Warning" />
			</div>
		</DemoSection>

		<DemoSection title="Sizes">
			<div className="d-flex gap-2 align-items-center">
				<IconButton icon="star" size="small" label="Small" />
				<IconButton icon="star" size="default" label="Default" />
				<IconButton icon="star" size="large" label="Large" />
			</div>
		</DemoSection>

		<DemoSection title="Outline">
			<div className="d-flex gap-2 flex-wrap align-items-center">
				<IconButton icon="pencil" variant="primary" outline label="Edit" />
				<IconButton icon="trash" variant="danger" outline label="Delete" />
				<IconButton icon="gear" variant="secondary" outline label="Settings" />
				<IconButton icon="info-circle" variant="info" outline label="Info" />
			</div>
		</DemoSection>

		<DemoSection title="Disabled">
			<div className="d-flex gap-2 align-items-center">
				<IconButton icon="pencil" variant="primary" disabled label="Disabled" />
				<IconButton icon="trash" variant="danger" outline disabled label="Disabled" />
			</div>
		</DemoSection>
	</DemoPage>
)

export default IconButtonDemo
