import { DemoPage, DemoSection } from './_demo'

const ProjectWizardDemo = () => {
	return (
		<DemoPage
			eyebrow="Dashboard & Admin"
			title="ProjectWizard"
			lede="A multi-step wizard for creating a new project (requires external dependency — demo unavailable)."
		>
			<DemoSection title="Unavailable">
				<p>This demo requires the <code>ProjectWizard</code> component from an external package that is not available in this workspace.</p>
			</DemoSection>
		</DemoPage>
	)
}

export default ProjectWizardDemo
