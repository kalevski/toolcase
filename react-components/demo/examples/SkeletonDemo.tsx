import React from 'react'
import { Skeleton, Card, CodeSnippet } from '../../src'

const SkeletonDemo: React.FC = () => (
	<div className="container my-5">
		<div className="row">
			<div className="col-12">
				<h1 className="display-4 text-gradient-primary mb-4">Skeleton</h1>
				<p className="text-muted mb-5">
					Shimmer placeholder for loading states. Supports line, circle, and rectangle shapes.
				</p>
			</div>
		</div>

		<div className="row mb-5">
			<div className="col-12">
				<Card>
					<h2 className="h3 mb-4">Shapes</h2>
					<div className="d-flex flex-column gap-3">
						<div>
							<strong className="d-block mb-2">Line (default)</strong>
							<Skeleton />
						</div>
						<div>
							<strong className="d-block mb-2">Circle</strong>
							<Skeleton shape="circle" />
						</div>
						<div>
							<strong className="d-block mb-2">Rectangle</strong>
							<Skeleton shape="rect" width="100%" height={120} />
						</div>
					</div>
				</Card>
			</div>
		</div>

		<div className="row mb-5">
			<div className="col-12">
				<Card>
					<h2 className="h3 mb-4">Multiple Lines</h2>
					<Skeleton count={4} />
				</Card>
			</div>
		</div>

		<div className="row mb-5">
			<div className="col-12">
				<Card>
					<h2 className="h3 mb-4">Card Placeholder</h2>
					<div className="d-flex gap-3 align-items-start">
						<Skeleton shape="circle" width={48} height={48} />
						<div style={{ flex: 1 }}>
							<Skeleton width="60%" height="1.2em" />
							<div style={{ marginTop: 8 }}>
								<Skeleton count={2} />
							</div>
						</div>
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
						code={`import { Skeleton } from '@webgame-cloud/react-components'

<Skeleton width="100%" height="1rem" />
<Skeleton variant="circle" width="3rem" height="3rem" />`}
					/>
				</Card>
			</div>
		</div>
	</div>
)

export default SkeletonDemo
