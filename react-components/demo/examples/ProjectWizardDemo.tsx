import { ProjectWizard, ProjectConfig } from '../../../console-web/src/components/ProjectWizard'
import { Card, CodeSnippet } from '../../src'

const ProjectWizardDemo = () => {
	const handleComplete = (config: ProjectConfig) => {
		console.log('Project created:', config)
		alert(`Project "${config.name}" created!\nEngine: ${config.engine}\nCategories: ${config.categories.map((c) => c.name).join(', ')}\nTags: ${config.tags.join(', ')}`)
	}

	return (
		<div className="container my-5">
			<div className="row mb-4">
				<div className="col-12">
					<h1 className="display-4 text-gradient-primary mb-2">ProjectWizard</h1>
					<p className="text-muted mb-0">A multi-step wizard for creating a new project with name, engine, categories, and tags.</p>
				</div>
			</div>
			<ProjectWizard onComplete={handleComplete} />

		{/* Usage */}
		<div className="row mb-5">
			<div className="col-12">
				<Card>
					<h2 className="h5 mb-3">Usage</h2>
					<CodeSnippet
						language="typescript"
						code={`import { ProjectWizard } from '@webgame-cloud/react-components'

<ProjectWizard onComplete={handleComplete} />`}
					/>
				</Card>
			</div>
		</div>
		</div>
	)
}

export default ProjectWizardDemo
