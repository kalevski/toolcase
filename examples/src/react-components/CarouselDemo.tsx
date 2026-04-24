import React from 'react'
import {
	Carousel,
	RichPageHeader,
	RichPageHeaderChip,
	SectionCard
} from '@toolcase/react-components'

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
		<div className="container py-4">
		<div className="row">
			<div className="col-12">
				<RichPageHeader
				chips={<RichPageHeaderChip>Data Display</RichPageHeaderChip>}
				title="Carousel"
				description="Slide carousel with auto-play, keyboard navigation, swipe support, dots, and arrows."
			/>
				<div className="d-flex flex-column gap-4 mt-4">
			<SectionCard title="Auto-play (3 s interval)">
				<Carousel autoPlay interval={3000} loop showArrows showDots>
					{slides.map((s) => (
						<SlideContent key={s.label} bg={s.bg} label={s.label} />
					))}
				</Carousel>
			</SectionCard>

			<SectionCard title="Manual / No dots">
				<Carousel showArrows loop>
					{slides.map((s) => (
						<SlideContent key={s.label} bg={s.bg} label={s.label} />
					))}
				</Carousel>
			</SectionCard>
		</div>
		
			</div>
		</div>
	</div>
	)
}
