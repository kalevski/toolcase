import React from 'react'
import { TestimonialCarousel, RichPageHeader, RichPageHeaderChip, SectionCard } from '@toolcase/react-components'

const TestimonialCarouselDemo: React.FC = () => (
	<div className="container py-4">
		<div className="row">
			<div className="col-12">
				<RichPageHeader
					chips={<RichPageHeaderChip>Social Proof</RichPageHeaderChip>}
					title="TestimonialCarousel"
					description="Swipeable testimonial cards with author and source."
				/>
				<div className="d-flex flex-column gap-3 mt-4">
					<SectionCard title="With autoplay">
						<TestimonialCarousel
							autoplay
							items={[
								{ quote: 'This library cut our boilerplate by 40%.', author: 'Jane Doe', role: 'Staff Engineer, Acme', avatar: 'https://i.pravatar.cc/100?img=1' },
								{ quote: 'Best DX I have had in years.', author: 'John Smith', role: 'CTO, Globex', avatar: 'https://i.pravatar.cc/100?img=2' },
								{ quote: 'Drop-in replacement that just worked.', author: 'Alex Lee', role: 'Lead, Initech', avatar: 'https://i.pravatar.cc/100?img=3' },
							]}
						/>
					</SectionCard>
				</div>
			</div>
		</div>
	</div>
)

export default TestimonialCarouselDemo
