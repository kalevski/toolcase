import React from 'react'
import { CalloutQuote, RichPageHeader, RichPageHeaderChip, SectionCard } from '@toolcase/react-components'

const CalloutQuoteDemo: React.FC = () => (
	<div className="container py-4">
		<div className="row">
			<div className="col-12">
				<RichPageHeader
					chips={<RichPageHeaderChip>Footer & Misc</RichPageHeaderChip>}
					title="CalloutQuote"
					description="Editorial pull-quote with attribution."
				/>
				<div className="d-flex flex-column gap-3 mt-4">
					<SectionCard title="Pull quote">
						<CalloutQuote
							quote="The simplest framework I've used for production-grade Node.js services."
							attribution="DHH"
							source="HN comment"
							sourceHref="#"
						/>
					</SectionCard>
				</div>
			</div>
		</div>
	</div>
)

export default CalloutQuoteDemo
