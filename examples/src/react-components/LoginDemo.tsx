import React from 'react'
import { Brand, Login, Card, CodeSnippet } from '@toolcase/react-components'

const LoginDemo: React.FC = () => (
	<div className="container my-5">
		<div className="row">
			<div className="col-12">
				<h1 className="display-4 text-gradient-primary mb-2">Login</h1>
				<p className="text-muted mb-4">A branded sign-in screen with social provider buttons, title, and description.</p>
			</div>
		</div>

		<div className="row mb-5">
			<div className="col-lg-6">
				<Card>
					<h2 className="h5 mb-3">Default — Three Providers</h2>
					<Login
						logo={<Brand primaryText="webgame" secondaryText=".cloud" label="beta" />}
						title="Sign in to your account"
						description="Choose a provider to continue"
						onConnect={(_, key) => alert(`Connect with ${key}`)}
						connect={[
							{ id: 'discord', label: 'Continue with Discord', color: '#5865F2', icon: 'discord' },
							{ id: 'github', label: 'Continue with GitHub', color: '#24292f', icon: 'github' },
							{ id: 'google', label: 'Continue with Google', color: 'red', icon: 'google' },
						]}
					/>
				</Card>
			</div>
			<div className="col-lg-6">
				<Card>
					<h2 className="h5 mb-3">Single Provider</h2>
					<Login
						logo={<Brand primaryText="GAME" secondaryText="HUB" color="#22c55e" />}
						title="Welcome back"
						description="Sign in with your GitHub account"
						onConnect={(_, key) => alert(`Connect with ${key}`)}
						connect={[
							{ id: 'github', label: 'Sign in with GitHub', color: '#24292f', icon: 'github' },
						]}
					/>
				</Card>
			</div>
		</div>

		<div className="row mb-5">
			<div className="col-lg-6">
				<Card>
					<h2 className="h5 mb-3">Custom Branding</h2>
					<Login
						logo={<Brand primaryText="PIXEL" secondaryText="FORGE" color="#6366f1" />}
						title="Creator Portal"
						description="Log in to manage your pixel art collections"
						onConnect={(_, key) => alert(`Connect with ${key}`)}
						connect={[
							{ id: 'discord', label: 'Continue with Discord', color: '#5865F2', icon: 'discord' },
							{ id: 'google', label: 'Continue with Google', color: '#ea4335', icon: 'google' },
						]}
					/>
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
						code={`import { Login } from '@toolcase/react-components'

<Login
  logo={<Brand primaryText="webgame" secondaryText=".cloud" />}
  title="Sign in to your account"
  connect={[
    { id: 'github', label: 'Continue with GitHub', color: '#24292f', icon: 'github' },
  ]}
  onConnect={(_, key) => console.log(key)}
/>`}
					/>
				</Card>
			</div>
		</div>
	</div>
)

export default LoginDemo
