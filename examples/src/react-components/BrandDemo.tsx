import React from 'react'
import { Brand, Card, CodeSnippet } from '@toolcase/react-components'

const BrandDemo: React.FC = () => (
	<div className="container my-5">
		<div className="row mb-4">
			<div className="col-12">
				<h1 className="display-4 text-gradient-primary mb-2">Brand</h1>
				<p className="text-muted mb-0">A brand logo element with primary/secondary text, underline color, label badge, and clickable mode.</p>
			</div>
		</div>

		<div className="row mb-5">
			<div className="col-lg-6">
				<Card>
					<h2 className="h5 mb-3">Default</h2>
					<div className="d-flex flex-column gap-4">
						<Brand primaryText="webgame" secondaryText=".cloud" />
						<Brand primaryText="pixel" secondaryText="forge" />
					</div>
				</Card>
			</div>
			<div className="col-lg-6">
				<Card>
					<h2 className="h5 mb-3">With Color & Label</h2>
					<div className="d-flex flex-column gap-4">
						<Brand primaryText="webgame" secondaryText=".cloud" color="#6366f1" label="beta" />
						<Brand primaryText="game" secondaryText="hub" color="#ef4444" label="new" />
					</div>
				</Card>
			</div>
		</div>

		<div className="row mb-5">
			<div className="col-lg-6">
				<Card>
					<h2 className="h5 mb-3">Clickable</h2>
					<Brand
						primaryText="webgame"
						secondaryText=".cloud"
						color="#6366f1"
						onClick={() => alert('Brand clicked')}
					/>
				</Card>
			</div>
			<div className="col-lg-6">
				<Card>
					<h2 className="h5 mb-3">XLarge</h2>
					<Brand primaryText="webgame" secondaryText=".cloud" color="#6366f1" label="beta" xlarge />
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
						code={`import { Brand } from '@webgame-cloud/react-components'

<Brand primaryText="webgame" secondaryText=".cloud" />
<Brand primaryText="webgame" secondaryText=".cloud" color="#6366f1" label="beta" xlarge />`}
					/>
				</Card>
			</div>
		</div>
	</div>
)

export default BrandDemo
