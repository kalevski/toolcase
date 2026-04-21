import React from 'react'
import { Carousel, Card, CodeSnippet } from '@toolcase/react-components'

const usageCode = `import { Carousel } from '@toolcase/react-components'

<Carousel autoPlay loop showArrows showDots>
  <img src="slide1.jpg" alt="Slide 1" />
  <img src="slide2.jpg" alt="Slide 2" />
  <img src="slide3.jpg" alt="Slide 3" />
</Carousel>`

const slides = [
	{ bg: '#dbeafe', label: 'Slide 1 — Ocean Blue' },
	{ bg: '#dcfce7', label: 'Slide 2 — Forest Green' },
	{ bg: '#fef9c3', label: 'Slide 3 — Sunny Yellow' },
	{ bg: '#fce7f3', label: 'Slide 4 — Petal Pink' },
]

const SlideContent: React.FC<{ bg: string; label: string }> = ({ bg, label }) => (
	<div
		style={{
			background: bg,
			height: 220,
			display: 'flex',
			alignItems: 'center',
			justifyContent: 'center',
			borderRadius: 8,
			fontSize: '1rem',
			fontWeight: 600,
			color: '#1e293b',
		}}
	>
		{label}
	</div>
)

export const CarouselDemo: React.FC = () => {
	return (
		<div className="container my-5">
			<div className="row mb-4">
				<div className="col-12">
					<h1 className="display-4 text-gradient-primary mb-2">Carousel</h1>
					<p className="text-muted mb-0">Slide carousel with auto-play, keyboard navigation, swipe support, dots, and arrows.</p>
				</div>
			</div>

			<div className="row mb-5">
				<div className="col-lg-8">
					<Card>
						<h2 className="h5 mb-3">Auto-play (3 s interval)</h2>
						<Carousel autoPlay interval={3000} loop showArrows showDots>
							{slides.map((s) => (
								<SlideContent key={s.label} bg={s.bg} label={s.label} />
							))}
						</Carousel>
					</Card>
				</div>
			</div>

			<div className="row mb-5">
				<div className="col-lg-8">
					<Card>
						<h2 className="h5 mb-3">Manual / No dots</h2>
						<Carousel showArrows loop>
							{slides.map((s) => (
								<SlideContent key={s.label} bg={s.bg} label={s.label} />
							))}
						</Carousel>
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
