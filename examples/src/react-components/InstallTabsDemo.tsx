import React from 'react'
import { InstallTabs, RichPageHeader, RichPageHeaderChip, SectionCard } from '@toolcase/react-components'

const InstallTabsDemo: React.FC = () => (
	<div className="container py-4">
		<div className="row">
			<div className="col-12">
				<RichPageHeader
					chips={<RichPageHeaderChip>Installation</RichPageHeaderChip>}
					title="InstallTabs"
					description="Multi-package-manager install command picker with copy."
				/>
				<div className="d-flex flex-column gap-3 mt-4">
					<SectionCard title="Standard"><InstallTabs package="@toolcase/react-components" /></SectionCard>
					<SectionCard title="Dev dependency"><InstallTabs package="vitest" dev /></SectionCard>
					<SectionCard title="Global"><InstallTabs package="@toolcase/cli" global /></SectionCard>
				</div>
			</div>
		</div>
	</div>
)

export default InstallTabsDemo
