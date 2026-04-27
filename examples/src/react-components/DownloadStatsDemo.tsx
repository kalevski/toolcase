import React from 'react'
import { DownloadStats, RichPageHeader, RichPageHeaderChip, SectionCard } from '@toolcase/react-components'

const DownloadStatsDemo: React.FC = () => (
	<div className="container py-4">
		<div className="row">
			<div className="col-12">
				<RichPageHeader
					chips={<RichPageHeaderChip>Social Proof</RichPageHeaderChip>}
					title="DownloadStats"
					description="npm downloads card with weekly/monthly/total counts and a sparkline."
				/>
				<div className="d-flex flex-column gap-3 mt-4">
					<SectionCard title="Weekly with sparkline">
						<DownloadStats
							packageName="@your/package"
							weekly={24500}
							monthly={98000}
							total={1_200_000}
							sparkline={[12, 18, 14, 20, 24, 22, 28, 32, 30, 38, 41, 45]}
						/>
					</SectionCard>
				</div>
			</div>
		</div>
	</div>
)

export default DownloadStatsDemo
