import React, { useState } from 'react'
import { Rating } from '@toolcase/react-components'
import { DemoPage, DemoSection } from './_demo'

export const RatingDemo: React.FC = () => {
	const [score, setScore]   = useState(0)
	const [half,  setHalf]    = useState(3.5)
	const [heart, setHeart]   = useState(2)

	return (
		<DemoPage
			eyebrow="Inputs"
			title="Rating"
			lede="Interactive star (or custom icon) rating component with half-star support."
		>
			<DemoSection title="Default">
				<Rating label="Your rating" value={score} onChange={setScore} />
			</DemoSection>

			<DemoSection title="Half-star">
				<Rating label="Precision rating" value={half} onChange={setHalf} allowHalf />
			</DemoSection>

			<DemoSection title="Sizes">
				<div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
					<Rating label="Small" value={3} readOnly size="small" />
					<Rating label="Default" value={4} readOnly size="default" />
					<Rating label="Large" value={5} readOnly size="large" />
				</div>
			</DemoSection>

			<DemoSection title="Heart icon">
				<Rating
					label="Like it?"
					value={heart}
					onChange={setHeart}
					icon="heart-fill"
					emptyIcon="heart"
					count={5}
				/>
			</DemoSection>

			<DemoSection title="Read-only">
				<Rating value={4.5} readOnly allowHalf />
			</DemoSection>
		</DemoPage>
	)
}
