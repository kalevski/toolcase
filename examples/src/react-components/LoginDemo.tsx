import React from 'react'
import { Brand, Login } from '@toolcase/react-components'
import { DemoPage, DemoSection } from './_demo'

const LoginDemo: React.FC = () => (
	<DemoPage
		eyebrow="Marketing"
		title="Login"
		lede="A branded sign-in screen with social provider buttons, title, and description."
	>
		<DemoSection title="Default — Three Providers">
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
		</DemoSection>

		<DemoSection title="Single Provider">
			<Login
				logo={<Brand primaryText="GAME" secondaryText="HUB" color="#22c55e" />}
				title="Welcome back"
				description="Sign in with your GitHub account"
				onConnect={(_, key) => alert(`Connect with ${key}`)}
				connect={[
					{ id: 'github', label: 'Sign in with GitHub', color: '#24292f', icon: 'github' },
				]}
			/>
		</DemoSection>

		<DemoSection title="Custom Branding">
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
		</DemoSection>
	</DemoPage>
)

export default LoginDemo
