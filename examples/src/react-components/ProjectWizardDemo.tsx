import { Card, CodeSnippet } from '@toolcase/react-components'

const ProjectWizardDemo = () => {
	return (
		<div className="container my-5">
			<div className="row mb-4">
				<div className="col-12">
					<h1 className="display-4 text-gradient-primary mb-2">ProjectWizard</h1>
					<p className="text-muted mb-0">A multi-step wizard for creating a new project (requires external dependency — demo unavailable).</p>
				</div>
			</div>
			<Card>
				<p>This demo requires the <code>ProjectWizard</code> component from an external package that is not available in this workspace.</p>
			</Card>
		</div>
	)
}

export default ProjectWizardDemo
