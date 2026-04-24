import React from 'react'
import { HelperText, Input, Select, TagInput } from '@toolcase/react-components'
import { DemoPage, DemoSection } from './_demo'

const HelperTextDemo: React.FC = () => (
	<DemoPage
		eyebrow="Typography"
		title="HelperText"
		lede="Contextual helper messages for form fields, supporting default, success, warning, and error variants with optional icons."
	>
		<DemoSection title="Variants with Form Fields">
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
		</DemoSection>

		<DemoSection title="With Other Components">
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
		</DemoSection>

		<DemoSection title="Custom Icon & Rich Content">
			<div className="d-flex flex-column gap-3">
				<HelperText icon="bi-lightbulb" text="You can use HelperText with a custom icon prop too." />
				<HelperText variant="error">
					You can also pass <strong>rich content</strong> as children.
				</HelperText>
			</div>
		</DemoSection>
	</DemoPage>
)

export default HelperTextDemo
