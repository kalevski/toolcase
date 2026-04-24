import React, { useState } from 'react'
import {
	Rating,
	RichPageHeader,
	RichPageHeaderChip,
	SectionCard
} from '@toolcase/react-components'

export const RatingDemo: React.FC = () => {
	const [score, setScore]   = useState(0)
	const [half,  setHalf]    = useState(3.5)
	const [heart, setHeart]   = useState(2)

	return (
		<div className="container py-4">
		<div className="row">
			<div className="col-12">
				<RichPageHeader
				chips={<RichPageHeaderChip>Inputs</RichPageHeaderChip>}
				title="Rating"
				description="Interactive star (or custom icon) rating component with half-star support."
			/>
				<div className="d-flex flex-column gap-4 mt-4">
			<SectionCard title="Default">
				<Rating label="Your rating" value={score} onChange={setScore} />
			</SectionCard>

			<SectionCard title="Half-star">
				<Rating label="Precision rating" value={half} onChange={setHalf} allowHalf />
			</SectionCard>

			<SectionCard title="Sizes">
				<div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
					<Rating label="Small" value={3} readOnly size="small" />
					<Rating label="Default" value={4} readOnly size="default" />
					<Rating label="Large" value={5} readOnly size="large" />
				</div>
			</SectionCard>

			<SectionCard title="Heart icon">
				<Rating
					label="Like it?"
					value={heart}
					onChange={setHeart}
					icon="heart-fill"
					emptyIcon="heart"
					count={5}
				/>
			</SectionCard>

			<SectionCard title="Read-only">
				<Rating value={4.5} readOnly allowHalf />
			</SectionCard>
		</div>
		
			</div>
		</div>
	</div>
	)
}
