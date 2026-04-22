import React, { useState } from 'react'
import { Input, CodeSnippet } from '@toolcase/react-components'
import { DemoPage, DemoSection, DemoGrid } from './_demo'

const InputDemo: React.FC = () => {
	const [email, setEmail] = useState('')
	const [password, setPassword] = useState('')
	const emailError =
		email.length > 0 && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
			? 'Please enter a valid email address'
			: null

	return (
		<DemoPage
			eyebrow="Inputs"
			title="Input"
			lede={
				<>
					A labeled single-line text field with built-in label, error, and helper-text wiring.
					Supports every native <code>type</code> (<code>text</code>, <code>email</code>,{' '}
					<code>password</code>, <code>url</code>, <code>number</code>, <code>date</code>,{' '}
					<code>color</code>, …). Prefer fully controlled usage (<code>value</code> +{' '}
					<code>onChange</code>).
				</>
			}
		>
			<DemoSection
				eyebrow="Common types"
				title="Sign-in form"
				caption="The most common use case — an account form with live email validation."
			>
				<DemoGrid columns={2} minItemWidth={280}>
					<Input
						label="Email address"
						type="email"
						placeholder="you@webgame.cloud"
						value={email}
						onChange={(e) => setEmail(e.target.value)}
						autoComplete="email"
						required
						{...(emailError ? { error: emailError } : {})}
					/>
					<Input
						label="Password"
						type="password"
						placeholder="At least 12 characters"
						value={password}
						onChange={(e) => setPassword(e.target.value)}
						autoComplete="current-password"
						required
					/>
				</DemoGrid>
			</DemoSection>

			<DemoSection
				eyebrow="State"
				title="Read-only and disabled"
				caption="Disabled inputs are non-interactive AND non-focusable. Read-only inputs keep their value selectable and copyable."
			>
				<DemoGrid columns={2} minItemWidth={280}>
					<Input label="Editable" placeholder="Start typing…" defaultValue="Default value" />
					<Input label="Read-only" value="indie-raid-game" readOnly />
					<Input label="Disabled" placeholder="Locked" disabled />
					<Input label="With error" placeholder="yourname" error="That handle is already taken." />
				</DemoGrid>
			</DemoSection>

			<DemoSection
				eyebrow="Specialized types"
				title="Typed inputs"
				caption="Native HTML input types give you mobile keyboards, validation, and pickers for free."
			>
				<DemoGrid columns={3} minItemWidth={220}>
					<Input label="Number" type="number" placeholder="0" min={0} max={100} step={1} />
					<Input label="Date" type="date" />
					<Input label="Time" type="time" />
					<Input label="URL" type="url" placeholder="https://…" />
					<Input label="Search" type="search" placeholder="Search assets…" />
					<Input label="Color" type="color" defaultValue="#6366f1" />
				</DemoGrid>
			</DemoSection>

			<DemoSection eyebrow="API" title="Usage">
				<CodeSnippet
					language="typescript"
					code={`import { Input } from '@toolcase/react-components'

<Input
  label="Email address"
  type="email"
  value={email}
  onChange={(e) => setEmail(e.target.value)}
  error={emailError}
  required
/>`}
				/>
			</DemoSection>
		</DemoPage>
	)
}

export default InputDemo
