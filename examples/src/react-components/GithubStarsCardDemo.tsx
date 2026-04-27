import React from 'react'
import { GithubStarsCard, RichPageHeader, RichPageHeaderChip, SectionCard } from '@toolcase/react-components'

const GithubStarsCardDemo: React.FC = () => (
	<div className="container py-4">
		<div className="row">
			<div className="col-12">
				<RichPageHeader
					chips={<RichPageHeaderChip>Social Proof</RichPageHeaderChip>}
					title="GithubStarsCard"
					description="Repo stats card with stars/forks/contributors and a CTA."
				/>
				<div className="d-flex flex-column gap-3 mt-4">
					<SectionCard title="Static stats">
						<GithubStarsCard
							owner="vercel"
							repo="next.js"
							stats={{ stars: 124000, forks: 26500, contributors: 3000, version: 'v15.0.1' }}
						/>
					</SectionCard>
				</div>
			</div>
		</div>
	</div>
)

export default GithubStarsCardDemo
