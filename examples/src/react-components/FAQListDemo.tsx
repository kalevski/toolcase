import React from 'react'
import { FAQList, RichPageHeader, RichPageHeaderChip, SectionCard } from '@toolcase/react-components'

const FAQListDemo: React.FC = () => (
	<div className="container py-4">
		<div className="row">
			<div className="col-12">
				<RichPageHeader
					chips={<RichPageHeaderChip>Footer & Misc</RichPageHeaderChip>}
					title="FAQList"
					description="Accordion-based Q&A with optional schema.org JSON-LD for SEO."
				/>
				<div className="d-flex flex-column gap-3 mt-4">
					<SectionCard title="Common questions">
						<FAQList
							defaultOpen={[0]}
							items={[
								{ question: 'Is this production ready?', answer: 'Yes — we run it in production on multiple high-traffic services.' },
								{ question: 'What Node.js versions are supported?', answer: 'Active LTS and Current. Older versions may work but are not tested.' },
								{ question: 'Can I use it with TypeScript?', answer: 'Yes. The package ships with full type definitions.' },
								{ question: 'Where do I report bugs?', answer: 'Open a GitHub issue on the repository.' },
							]}
						/>
					</SectionCard>
				</div>
			</div>
		</div>
	</div>
)

export default FAQListDemo
