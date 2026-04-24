import React from 'react'
import {
	IconButton,
	RichPageHeader,
	RichPageHeaderChip,
	SectionCard
} from '@toolcase/react-components'

const IconButtonDemo: React.FC = () => (
	<div className="container py-4">
		<div className="row">
			<div className="col-12">
				<RichPageHeader
				chips={<RichPageHeaderChip>Buttons & Actions</RichPageHeaderChip>}
				title="IconButton"
				description="Square icon-only button with size, variant, and outline options."
			/>
				<div className="d-flex flex-column gap-4 mt-4">
		<SectionCard title="Variants">
			<div className="d-flex gap-2 flex-wrap align-items-center">
				<IconButton icon="pencil" variant="primary" label="Edit" />
				<IconButton icon="trash" variant="danger" label="Delete" />
				<IconButton icon="gear" variant="secondary" label="Settings" />
				<IconButton icon="info-circle" variant="info" label="Info" />
				<IconButton icon="check-circle" variant="success" label="Confirm" />
				<IconButton icon="exclamation-triangle" variant="warning" label="Warning" />
			</div>
		</SectionCard>

		<SectionCard title="Sizes">
			<div className="d-flex gap-2 align-items-center">
				<IconButton icon="star" size="small" label="Small" />
				<IconButton icon="star" size="default" label="Default" />
				<IconButton icon="star" size="large" label="Large" />
			</div>
		</SectionCard>

		<SectionCard title="Outline">
			<div className="d-flex gap-2 flex-wrap align-items-center">
				<IconButton icon="pencil" variant="primary" outline label="Edit" />
				<IconButton icon="trash" variant="danger" outline label="Delete" />
				<IconButton icon="gear" variant="secondary" outline label="Settings" />
				<IconButton icon="info-circle" variant="info" outline label="Info" />
			</div>
		</SectionCard>

		<SectionCard title="Disabled">
			<div className="d-flex gap-2 align-items-center">
				<IconButton icon="pencil" variant="primary" disabled label="Disabled" />
				<IconButton icon="trash" variant="danger" outline disabled label="Disabled" />
			</div>
		</SectionCard>
	</div>
		
			</div>
		</div>
	</div>
)

export default IconButtonDemo
