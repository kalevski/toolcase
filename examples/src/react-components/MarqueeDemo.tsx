import React from 'react'
import {
	Marquee,
	RichPageHeader,
	RichPageHeaderChip,
	SectionCard,
} from '@toolcase/react-components'

const items = [
	<>The jam <b>never stops</b></>,
	'Every 14 days',
	<>Sprint 047 <b>open</b></>,
	'62 games · 18 builds',
]

const MarqueeDemo: React.FC = () => (
	<div className="container py-4">
		<div className="row">
			<div className="col-12">
				<RichPageHeader
					chips={<RichPageHeaderChip>Game Jam / Arcade</RichPageHeaderChip>}
					title="Marquee"
					description="Continuously scrolling banner. Items auto-duplicate for a seamless loop."
				/>
				<div className="d-flex flex-column gap-4 mt-4">
					<SectionCard title="Default">
						<Marquee items={items} />
					</SectionCard>

					<SectionCard title="Custom separator + slower speed">
						<Marquee
							separator="◆"
							speed={90}
							items={['Deploy nightly · 03:00 UTC', 'New briefs dropped', 'Join Discord', 'Ship something']}
						/>
					</SectionCard>

					<SectionCard title="Reverse + pause on hover">
						<Marquee
							direction="right"
							pauseOnHover
							separator="↻"
							items={['Roll', 'Build', 'Attest', 'Ship', 'Close']}
						/>
					</SectionCard>

					<SectionCard title="Neon theme">
						<div className="theme theme--neon">
							<Marquee items={items} />
						</div>
					</SectionCard>
				</div>
			</div>
		</div>
	</div>
)

export default MarqueeDemo
