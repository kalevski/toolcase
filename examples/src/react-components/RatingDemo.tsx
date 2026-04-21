import React, { useState } from 'react'
import { Rating, Card, CodeSnippet } from '@toolcase/react-components'

const usageCode = `import { Rating } from '@toolcase/react-components'

const [score, setScore] = useState(0)

<Rating label="Your rating" value={score} onChange={setScore} />

// Half-star mode
<Rating allowHalf value={4.5} onChange={setScore} />

// Read-only
<Rating value={4} readOnly />`

export const RatingDemo: React.FC = () => {
	const [score, setScore]   = useState(0)
	const [half,  setHalf]    = useState(3.5)
	const [heart, setHeart]   = useState(2)

	return (
		<div className="container my-5">
			<div className="row mb-4">
				<div className="col-12">
					<h1 className="display-4 text-gradient-primary mb-2">Rating</h1>
					<p className="text-muted mb-0">Interactive star (or custom icon) rating component with half-star support.</p>
				</div>
			</div>

			<div className="row mb-5">
				<div className="col-lg-8">
					<Card>
						<h2 className="h5 mb-3">Default</h2>
						<Rating label="Your rating" value={score} onChange={setScore} />
					</Card>
				</div>
			</div>

			<div className="row mb-5">
				<div className="col-lg-8">
					<Card>
						<h2 className="h5 mb-3">Half-star</h2>
						<Rating label="Precision rating" value={half} onChange={setHalf} allowHalf />
					</Card>
				</div>
			</div>

			<div className="row mb-5">
				<div className="col-lg-8">
					<Card>
						<h2 className="h5 mb-3">Sizes</h2>
						<div className="d-flex flex-column gap-3">
							<Rating label="Small" value={3} readOnly size="small" />
							<Rating label="Default" value={4} readOnly size="default" />
							<Rating label="Large" value={5} readOnly size="large" />
						</div>
					</Card>
				</div>
			</div>

			<div className="row mb-5">
				<div className="col-lg-8">
					<Card>
						<h2 className="h5 mb-3">Heart icon</h2>
						<Rating
							label="Like it?"
							value={heart}
							onChange={setHeart}
							icon="heart-fill"
							emptyIcon="heart"
							count={5}
						/>
					</Card>
				</div>
			</div>

			<div className="row mb-5">
				<div className="col-lg-8">
					<Card>
						<h2 className="h5 mb-3">Read-only</h2>
						<Rating value={4.5} readOnly allowHalf />
					</Card>
				</div>
			</div>

			<div className="row mb-5">
				<div className="col-12">
					<Card>
						<h2 className="h5 mb-3">Usage</h2>
						<CodeSnippet language="typescript" code={usageCode} />
					</Card>
				</div>
			</div>
		</div>
	)
}
