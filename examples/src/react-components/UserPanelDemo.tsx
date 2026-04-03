import React from 'react'
import { UserPanel } from '@toolcase/react-components'
import { Card, CodeSnippet } from '@toolcase/react-components'

const UserPanelDemo: React.FC = () => (
	<div className="container my-5">
		<div className="row">
			<div className="col-12">
				<h1 className="display-4 text-gradient-primary mb-4">UserPanel Component</h1>
				<p className="text-muted mb-5">
					Designed to be used as <code>sidebarPanelComponent</code> in DashboardLayout.
				</p>
			</div>
		</div>
		<div className="row mb-4">
			<div className="col-12 col-md-6">
				<Card>
					<h2 className="h5 mb-3">Default — Free Plan</h2>
					<div style={{ maxWidth: 240, border: '1px solid #dee2e6', borderRadius: 8 }}>
						<UserPanel username="Daniel Kalevski" />
					</div>
				</Card>
			</div>
		</div>
		<div className="row mb-4">
			<div className="col-12 col-md-6">
				<Card>
					<h2 className="h5 mb-3">With Avatar Image — Pro Plan</h2>
					<div style={{ maxWidth: 240, border: '1px solid #dee2e6', borderRadius: 8 }}>
						<UserPanel
							avatarSrc="https://i.pravatar.cc/150?img=5"
							username="Jane Smith"
							plan="Pro"
						/>
					</div>
				</Card>
			</div>
		</div>
		<div className="row mb-4">
			<div className="col-12 col-md-6">
				<Card>
					<h2 className="h5 mb-3">Enterprise Plan</h2>
					<div style={{ maxWidth: 240, border: '1px solid #dee2e6', borderRadius: 8 }}>
						<UserPanel
							avatarSrc="https://i.pravatar.cc/150?img=12"
							username="Alice Johnson"
							plan="Enterprise"
						/>
					</div>
				</Card>
			</div>
		</div>
		<div className="row mb-4">
			<div className="col-12">
				<Card>
					<h2 className="h5 mb-3">Different Plans</h2>
					<div className="d-flex flex-wrap gap-3">
						{['Free', 'Starter', 'Pro', 'Business', 'Enterprise'].map((plan) => (
							<div key={plan} style={{ width: 240, border: '1px solid #dee2e6', borderRadius: 8 }}>
								<UserPanel username="Demo User" plan={plan} />
							</div>
						))}
					</div>
				</Card>
			</div>
		</div>
		<div className="row mb-4">
			<div className="col-12 col-md-6">
				<Card>
					<h2 className="h5 mb-3">Long Username (truncated)</h2>
					<div style={{ maxWidth: 240, border: '1px solid #dee2e6', borderRadius: 8 }}>
						<UserPanel
							username="Bartholomew Christopherson III"
							plan="Pro"
						/>
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
						code={`import { UserPanel } from '@webgame-cloud/react-components'

<UserPanel
  username="Jane Smith"
  avatarSrc="/avatar.jpg"
  plan="Pro"
/>`}
					/>
				</Card>
			</div>
		</div>
	</div>
)

export default UserPanelDemo
