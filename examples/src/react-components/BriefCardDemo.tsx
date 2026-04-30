import React from 'react'
import {
	BriefCard,
	RichPageHeader,
	RichPageHeaderChip,
	SectionCard,
} from '@toolcase/react-components'

const briefs = (
	<div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 16 }}>
		<BriefCard
			id="Brief · 047-A"
			icon="▼"
			difficulty="easy"
			title="Cooperate without speaking"
			body="Two or more players must achieve something together — but the design forbids any direct verbal or text communication."
			metaLeft="14 attests"
			metaRight="0 flags"
		/>
		<BriefCard
			id="Brief · 047-B"
			icon="◆"
			difficulty="medium"
			title="One screen · One button · One minute"
			body="A complete play loop fitting a single non-scrolling screen, controlled by a single binary input, resolving inside sixty seconds."
			metaLeft="9 attests"
			metaRight="2 flags"
		/>
		<BriefCard
			id="Brief · 047-C"
			icon="▲"
			difficulty="hard"
			title="World remembers · Player forgets"
			body="Persistence flips: state survives across runs, but the player character begins each session without prior knowledge. Memory is a level mechanic."
			metaLeft="3 attests"
			metaRight="0 flags"
		/>
	</div>
)

const BriefCardDemo: React.FC = () => (
	<div className="container py-4">
		<div className="row">
			<div className="col-12">
				<RichPageHeader
					chips={<RichPageHeaderChip>Game Jam / Arcade</RichPageHeaderChip>}
					title="BriefCard"
					description="Centered challenge card with difficulty-coded accent (easy = info, medium = warning, hard = danger)."
				/>
				<div className="d-flex flex-column gap-4 mt-4">
					<SectionCard title="All three difficulties">{briefs}</SectionCard>

					<SectionCard title="Interactive (clickable)">
						<div style={{ maxWidth: 360 }}>
							<BriefCard
								id="Brief · 048-X"
								icon="✶"
								difficulty="medium"
								title="Proc-gen music loops"
								body="Generate a 60-second loop from seed input, persist between sessions."
								onClick={() => alert('Brief opened')}
								metaLeft="Tap"
								metaRight="Open"
							/>
						</div>
					</SectionCard>

					<SectionCard title="Neon theme">
						<div className="theme theme--neon" style={{ padding: 24 }}>{briefs}</div>
					</SectionCard>
					<SectionCard title="Dark theme">
						<div className="theme theme--dark" style={{ padding: 24 }}>{briefs}</div>
					</SectionCard>
				</div>
			</div>
		</div>
	</div>
)

export default BriefCardDemo
