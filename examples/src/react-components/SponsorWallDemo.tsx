import React from 'react'
import { SponsorWall, RichPageHeader, RichPageHeaderChip, SectionCard } from '@toolcase/react-components'

const placeholder = (text: string) =>
	`data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 200 60'><rect width='200' height='60' fill='%23f1f5f9'/><text x='100' y='38' font-size='18' text-anchor='middle' fill='%2364748b' font-family='sans-serif'>${encodeURIComponent(text)}</text></svg>`

const SponsorWallDemo: React.FC = () => (
	<div className="container py-4">
		<div className="row">
			<div className="col-12">
				<RichPageHeader
					chips={<RichPageHeaderChip>Social Proof</RichPageHeaderChip>}
					title="SponsorWall"
					description="Tiered sponsor logos with decreasing sizes per tier."
				/>
				<div className="d-flex flex-column gap-3 mt-4">
					<SectionCard title="Three tiers">
						<SponsorWall
							title="Sponsors"
							tiers={[
								{ name: 'platinum', label: 'Platinum', size: 'xl', logos: [{ src: placeholder('Platinum Co'), alt: 'Platinum' }] },
								{ name: 'gold', label: 'Gold', size: 'lg', logos: [{ src: placeholder('Gold A'), alt: 'A' }, { src: placeholder('Gold B'), alt: 'B' }] },
								{ name: 'silver', label: 'Silver', size: 'md', logos: [{ src: placeholder('Silver 1'), alt: '1' }, { src: placeholder('Silver 2'), alt: '2' }, { src: placeholder('Silver 3'), alt: '3' }] },
							]}
						/>
					</SectionCard>
				</div>
			</div>
		</div>
	</div>
)

export default SponsorWallDemo
