import React from 'react'
import { HelperText } from '@toolcase/react-components'
import { Input } from '@toolcase/react-components'
import { Select } from '@toolcase/react-components'
import { TagInput } from '@toolcase/react-components'
import { Card, CodeSnippet } from '@toolcase/react-components'

const HelperTextDemo: React.FC = () => (
	<div className="container my-5">
		<div className="row mb-4">
			<div className="col-12">
				<h1 className="display-4 text-gradient-primary mb-2">HelperText</h1>
				<p className="text-muted mb-4">Contextual helper messages for form fields, supporting default, success, warning, and error variants with optional icons.</p>
			</div>
		</div>

		<div className="row mb-5">
			<div className="col-md-6">
				<Card>
					<h2 className="h5 mb-3">Variants with Form Fields</h2>
					<div className="d-flex flex-column gap-4">
						<div>
							<Input label="Project Name" placeholder="my-awesome-game" />
							<HelperText text="Use lowercase letters, numbers, and hyphens only." />
						</div>
						<div>
							<Input label="Email" placeholder="you@example.com" />
							<HelperText variant="success" text="This email is available." />
						</div>
						<div>
							<Input label="Password" placeholder="Enter password" />
							<HelperText variant="warning" text="Your password is weak. Consider adding numbers or symbols." />
						</div>
						<div>
							<Input label="Username" placeholder="Pick a username" />
							<HelperText variant="error" text="This username is already taken." />
						</div>
					</div>
				</Card>
			</div>

			<div className="col-md-6">
				<Card>
					<h2 className="h5 mb-3">With Other Components</h2>
					<div className="d-flex flex-column gap-4">
						<div>
							<Select label="Region" options={[{ label: 'US East', value: 'us-east' }, { label: 'EU West', value: 'eu-west' }]} />
							<HelperText text="Choose the region closest to your players for best performance." />
						</div>
						<div>
							<TagInput label="Tags" recommendations={['2D', '3D', 'pixel-art', 'RPG']} allowCreate placeholder="Add tags…" />
							<HelperText text="Select from suggestions or type to create custom tags." />
						</div>
					</div>
				</Card>
			</div>
		</div>

		<div className="row mb-5">
			<div className="col-md-6">
				<Card>
					<h2 className="h5 mb-3">Custom Icon &amp; Rich Content</h2>
					<div className="d-flex flex-column gap-3">
						<HelperText icon="bi-lightbulb" text="You can use HelperText with a custom icon prop too." />
						<HelperText variant="error">
							You can also pass <strong>rich content</strong> as children.
						</HelperText>
					</div>
				</Card>
			</div>
		</div>
		{/* Usage */}
		<div className="row mb-5">
			<div className="col-12">
				<Card>
					<h2 className="h5 mb-3">Usage</h2>
					<CodeSnippet
						language="typescript"
						code={`import { HelperText } from '@webgame-cloud/react-components'

<HelperText text="This field is required." />
<HelperText variant="success" text="Looks good!" />
<HelperText variant="error" text="Invalid email address." />`}
					/>
				</Card>
			</div>
		</div>
	</div>
)

export default HelperTextDemo
