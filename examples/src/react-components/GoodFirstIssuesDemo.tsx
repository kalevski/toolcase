import React from 'react'
import { GoodFirstIssues, RichPageHeader, RichPageHeaderChip, SectionCard } from '@toolcase/react-components'

const GoodFirstIssuesDemo: React.FC = () => (
	<div className="container py-4">
		<div className="row">
			<div className="col-12">
				<RichPageHeader
					chips={<RichPageHeaderChip>Ecosystem & Community</RichPageHeaderChip>}
					title="GoodFirstIssues"
					description="Surfaces good-first-issue / help-wanted issues to drive contributions."
				/>
				<div className="d-flex flex-column gap-3 mt-4">
					<SectionCard title="Open issues">
						<GoodFirstIssues
							issues={[
								{ title: 'Improve error message in init command', labels: ['good first issue', 'cli'], commentCount: 3, updatedAt: '2 days ago', href: '#' },
								{ title: 'Add example for streaming responses', labels: ['help wanted', 'docs'], commentCount: 1, updatedAt: '5 days ago', href: '#' },
								{ title: 'Type narrowing for handler context', labels: ['good first issue', 'types'], commentCount: 7, updatedAt: '1 week ago', href: '#' },
							]}
						/>
					</SectionCard>
				</div>
			</div>
		</div>
	</div>
)

export default GoodFirstIssuesDemo
