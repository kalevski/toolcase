import React from 'react'
import {
	PulseIndicator,
	RichPageHeader,
	RichPageHeaderChip,
	SectionCard,
} from '@toolcase/react-components'

const variants = (
	<div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
		<PulseIndicator label="Live · 142 online" />
		<PulseIndicator label="Recording" color="var(--tc-danger)" />
		<PulseIndicator label="Synced" color="var(--tc-success)" />
		<PulseIndicator label="Warming up" color="var(--tc-warning)" />
		<PulseIndicator label="Offline" paused color="var(--tc-text-faint)" />
	</div>
)

const PulseIndicatorDemo: React.FC = () => (
	<div className="container py-4">
		<div className="row">
			<div className="col-12">
				<RichPageHeader
					chips={<RichPageHeaderChip>Game Jam / Arcade</RichPageHeaderChip>}
					title="PulseIndicator"
					description="Inline blinking dot + label. Color customizable. Pause to disable the animation."
				/>
				<div className="d-flex flex-column gap-4 mt-4">
					<SectionCard title="Variants">{variants}</SectionCard>

					<SectionCard title="Inside a topbar mock">
						<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 24px', borderBottom: '1px solid var(--tc-border)' }}>
							<span style={{ fontFamily: 'var(--tc-font-family-sans)', fontWeight: 600, letterSpacing: '0.04em' }}>Sprint-047</span>
							<PulseIndicator label="Live · 142 online" />
						</div>
					</SectionCard>

					<SectionCard title="Neon theme">
						<div className="theme theme--neon" style={{ padding: 32 }}>{variants}</div>
					</SectionCard>
					<SectionCard title="Dark theme">
						<div className="theme theme--dark" style={{ padding: 32 }}>{variants}</div>
					</SectionCard>
				</div>
			</div>
		</div>
	</div>
)

export default PulseIndicatorDemo
