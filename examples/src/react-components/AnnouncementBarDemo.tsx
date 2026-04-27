import React from 'react'
import { AnnouncementBar, RichPageHeader, RichPageHeaderChip, SectionCard } from '@toolcase/react-components'

const AnnouncementBarDemo: React.FC = () => (
	<div className="container py-4">
		<div className="row">
			<div className="col-12">
				<RichPageHeader
					chips={<RichPageHeaderChip>Hero & Above-the-fold</RichPageHeaderChip>}
					title="AnnouncementBar"
					description="Slim dismissible top-of-page strip for launches, advisories, or events."
				/>
				<div className="d-flex flex-column gap-3 mt-4">
					<SectionCard title="Info">
						<AnnouncementBar
							iconName="megaphone-fill"
							message={<><strong>v2 is here</strong> — read the migration guide.</>}
							ctaLabel="Read more"
							ctaHref="#"
							dismissible
						/>
					</SectionCard>
					<SectionCard title="Success">
						<AnnouncementBar variant="success" iconName="check-circle-fill" message="All systems operational." />
					</SectionCard>
					<SectionCard title="Warning">
						<AnnouncementBar variant="warning" iconName="exclamation-triangle-fill" message="Scheduled maintenance Friday 8pm UTC." />
					</SectionCard>
					<SectionCard title="Announce">
						<AnnouncementBar variant="announce" iconName="stars" message="Join us at NodeConf — Oct 14." ctaLabel="Get tickets" ctaHref="#" />
					</SectionCard>
				</div>
			</div>
		</div>
	</div>
)

export default AnnouncementBarDemo
