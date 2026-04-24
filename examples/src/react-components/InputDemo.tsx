import React, { useState } from 'react'
import {
	Input,
	RichPageHeader,
	RichPageHeaderChip,
	SectionCard
} from '@toolcase/react-components'

const InputDemo: React.FC = () => {
	const [email, setEmail] = useState('')
	const [password, setPassword] = useState('')
	const emailError =
		email.length > 0 && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
			? 'Please enter a valid email address'
			: null

	return (
		<div className="container py-4">
		<div className="row">
			<div className="col-12">
				<RichPageHeader
				chips={<RichPageHeaderChip>Inputs</RichPageHeaderChip>}
				title="Input"
				description={
				<>
					A labeled single-line text field with built-in label, error, and helper-text wiring.
					Supports every native <code>type</code> (<code>text</code>, <code>email</code>,{' '}
					<code>password</code>, <code>url</code>, <code>number</code>, <code>date</code>,{' '}
					<code>color</code>, …). Prefer fully controlled usage (<code>value</code> +{' '}
					<code>onChange</code>).
				</>
			}
			/>
				<div className="d-flex flex-column gap-4 mt-4">
			<SectionCard title="Sign-in form">
				<div style={{display: 'grid', gap: 16, gridTemplateColumns: 'repeat(2, minmax(0, 1fr))'}}>
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
				</div>
			</SectionCard>

			<SectionCard title="Read-only and disabled">
				<div style={{display: 'grid', gap: 16, gridTemplateColumns: 'repeat(2, minmax(0, 1fr))'}}>
					<Input label="Editable" placeholder="Start typing…" defaultValue="Default value" />
					<Input label="Read-only" value="indie-raid-game" readOnly />
					<Input label="Disabled" placeholder="Locked" disabled />
					<Input label="With error" placeholder="yourname" error="That handle is already taken." />
				</div>
			</SectionCard>

			<SectionCard title="Typed inputs">
				<div style={{display: 'grid', gap: 16, gridTemplateColumns: 'repeat(3, minmax(0, 1fr))'}}>
					<Input label="Number" type="number" placeholder="0" min={0} max={100} step={1} />
					<Input label="Date" type="date" />
					<Input label="Time" type="time" />
					<Input label="URL" type="url" placeholder="https://…" />
					<Input label="Search" type="search" placeholder="Search assets…" />
					<Input label="Color" type="color" defaultValue="#6366f1" />
				</div>
			</SectionCard>
		</div>
		
			</div>
		</div>
	</div>
	)
}

export default InputDemo
