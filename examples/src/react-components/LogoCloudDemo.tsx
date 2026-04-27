import React from 'react'
import { LogoCloud, RichPageHeader, RichPageHeaderChip, SectionCard } from '@toolcase/react-components'

const placeholder = (text: string) =>
	`data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 120 40'><rect width='120' height='40' fill='%23e2e8f0'/><text x='60' y='25' font-size='12' text-anchor='middle' fill='%2364748b' font-family='sans-serif'>${encodeURIComponent(text)}</text></svg>`

const logos = [
	{ src: placeholder('Acme'), alt: 'Acme' },
	{ src: placeholder('Globex'), alt: 'Globex' },
	{ src: placeholder('Initech'), alt: 'Initech' },
	{ src: placeholder('Hooli'), alt: 'Hooli' },
	{ src: placeholder('Stark'), alt: 'Stark' },
	{ src: placeholder('Wayne'), alt: 'Wayne' },
]

const LogoCloudDemo: React.FC = () => (
	<div className="container py-4">
		<div className="row">
			<div className="col-12">
				<RichPageHeader
					chips={<RichPageHeaderChip>Social Proof</RichPageHeaderChip>}
					title="LogoCloud"
					description="Grayscale company logo strip with hover desaturation."
				/>
				<div className="d-flex flex-column gap-3 mt-4">
					<SectionCard title="Used by">
						<LogoCloud title="Trusted by teams at" logos={logos} />
					</SectionCard>
				</div>
			</div>
		</div>
	</div>
)

export default LogoCloudDemo
