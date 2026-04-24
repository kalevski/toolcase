import React from 'react'
import {
	Brand,
	Login,
	RichPageHeader,
	RichPageHeaderChip,
	SectionCard
} from '@toolcase/react-components'

const LoginDemo: React.FC = () => (
	<div className="container py-4">
		<div className="row">
			<div className="col-12">
				<RichPageHeader
				chips={<RichPageHeaderChip>Marketing</RichPageHeaderChip>}
				title="Login"
				description="A branded sign-in screen with social provider buttons, title, and description."
			/>
				<div className="d-flex flex-column gap-4 mt-4">
		<SectionCard title="Default — Three Providers">
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
		</SectionCard>

		<SectionCard title="Single Provider">
			<Login
				logo={<Brand primaryText="GAME" secondaryText="HUB" color="#22c55e" />}
				title="Welcome back"
				description="Sign in with your GitHub account"
				onConnect={(_, key) => alert(`Connect with ${key}`)}
				connect={[
					{ id: 'github', label: 'Sign in with GitHub', color: '#24292f', icon: 'github' },
				]}
			/>
		</SectionCard>

		<SectionCard title="Custom Branding">
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
		</SectionCard>
	</div>
		
			</div>
		</div>
	</div>
)

export default LoginDemo
