import React from 'react'
import { VideoEmbed, RichPageHeader, RichPageHeaderChip, SectionCard } from '@toolcase/react-components'

const VideoEmbedDemo: React.FC = () => (
	<div className="container py-4">
		<div className="row">
			<div className="col-12">
				<RichPageHeader
					chips={<RichPageHeaderChip>Footer & Misc</RichPageHeaderChip>}
					title="VideoEmbed"
					description="Responsive 16:9 video container with iframe/<video> auto-detection."
				/>
				<div className="d-flex flex-column gap-3 mt-4">
					<SectionCard title="YouTube embed">
						<VideoEmbed src="https://www.youtube.com/embed/dQw4w9WgXcQ" title="Demo" />
					</SectionCard>
				</div>
			</div>
		</div>
	</div>
)

export default VideoEmbedDemo
