import React from 'react'
import { Carousel } from '@toolcase/react-components'
import { DemoPage, DemoSection } from './_demo'

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
		<DemoPage
			eyebrow="Data Display"
			title="Carousel"
			lede="Slide carousel with auto-play, keyboard navigation, swipe support, dots, and arrows."
		>
			<DemoSection title="Auto-play (3 s interval)">
				<Carousel autoPlay interval={3000} loop showArrows showDots>
					{slides.map((s) => (
						<SlideContent key={s.label} bg={s.bg} label={s.label} />
					))}
				</Carousel>
			</DemoSection>

			<DemoSection title="Manual / No dots">
				<Carousel showArrows loop>
					{slides.map((s) => (
						<SlideContent key={s.label} bg={s.bg} label={s.label} />
					))}
				</Carousel>
			</DemoSection>
		</DemoPage>
	)
}
