
const ProjectWizardDemo = () => {
	return (
		<div className="container py-4">
		<div className="row">
			<div className="col-12">
				<RichPageHeader
				chips={<RichPageHeaderChip>Dashboard & Admin</RichPageHeaderChip>}
				title="ProjectWizard"
				description="A multi-step wizard for creating a new project (requires external dependency — demo unavailable)."
			/>
				<div className="d-flex flex-column gap-4 mt-4">
			<SectionCard title="Unavailable">
				<p>This demo requires the <code>ProjectWizard</code> component from an external package that is not available in this workspace.</p>
			</SectionCard>
		</div>
		
			</div>
		</div>
	</div>
	)
}

export default ProjectWizardDemo
