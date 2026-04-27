import React from 'react'
import { ContributorWall, RichPageHeader, RichPageHeaderChip, SectionCard } from '@toolcase/react-components'

const contributors = Array.from({ length: 12 }, (_, i) => ({
	login: `dev-${i + 1}`,
	avatarUrl: `https://i.pravatar.cc/120?img=${i + 1}`,
	contributions: 50 - i * 3,
	profileUrl: '#',
}))

const ContributorWallDemo: React.FC = () => (
	<div className="container py-4">
		<div className="row">
			<div className="col-12">
				<RichPageHeader
					chips={<RichPageHeaderChip>Social Proof</RichPageHeaderChip>}
					title="ContributorWall"
					description="Avatar grid of contributors with hover tooltips and overflow."
				/>
				<div className="d-flex flex-column gap-3 mt-4">
					<SectionCard title="With overflow">
						<ContributorWall title="Contributors" contributors={contributors} maxVisible={8} />
					</SectionCard>
				</div>
			</div>
		</div>
	</div>
)

export default ContributorWallDemo
