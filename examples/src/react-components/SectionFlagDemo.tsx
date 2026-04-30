import React from 'react'
import {
	RichPageHeader,
	RichPageHeaderChip,
	SectionCard,
	SectionFlag,
} from '@toolcase/react-components'

const SectionFlagDemo: React.FC = () => (
	<div className="container py-4">
		<div className="row">
			<div className="col-12">
				<RichPageHeader
					chips={<RichPageHeaderChip>Game Jam / Arcade</RichPageHeaderChip>}
					title="SectionFlag"
					description="Section heading with optional sub-line. Drop-in heading for arcade sections."
				/>
				<div className="d-flex flex-column gap-4 mt-4">
					<SectionCard title="Centered with subtitle">
						<SectionFlag
							title="3 Briefs · rolled for Sprint 047"
							subtitle="Seeded RNG drew one easy + one medium + one hard from the master pool."
						/>
					</SectionCard>

					<SectionCard title="Title only">
						<SectionFlag title="Points · continuous · never paused" />
					</SectionCard>

					<SectionCard title="Left-aligned">
						<SectionFlag
							align="left"
							title="The Hall — ranked"
							subtitle="Top of the rolling 90-day board."
						/>
					</SectionCard>

					<SectionCard title="Neon theme">
						<div className="theme theme--neon" style={{ padding: 32 }}>
							<SectionFlag
								title="3 БРИФА · ROLLED FOR SPRINT 047"
								subtitle="Seeded RNG drew one easy + one medium + one hard from the master pool."
							/>
						</div>
					</SectionCard>
					<SectionCard title="Dark theme">
						<div className="theme theme--dark" style={{ padding: 32 }}>
							<SectionFlag
								title="3 БРИФА · ROLLED FOR SPRINT 047"
								subtitle="Seeded RNG drew one easy + one medium + one hard from the master pool."
							/>
						</div>
					</SectionCard>
				</div>
			</div>
		</div>
	</div>
)

export default SectionFlagDemo
