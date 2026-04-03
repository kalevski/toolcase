import React from 'react'
import { Card } from './Card'
import { Input } from './Input'
import { Button } from './Button'
import { Icon } from './Icon'

export interface EarlySignupFormProps {
	title?: string
	subtitle?: string
	benefits: string[]
	helperText?: string
	ctaLabel?: string
	onSubmit?: (email: string, event: React.FormEvent<HTMLFormElement>) => void
	className?: string
}

export const EarlySignupForm: React.FC<EarlySignupFormProps> = ({
	title,
	subtitle,
	benefits,
	helperText,
	ctaLabel,
	onSubmit,
	className = '',
}) => {
	const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
		event.preventDefault()
		const form = event.currentTarget
		const formData = new FormData(form)
		const email = (formData.get('email') || '') as string

		if (onSubmit) {
			onSubmit(email, event)
		}
	}

	return (
		<div className={className}>
			<Card>
				<div className="row g-4 align-items-center">
					<div className="col-md-7">
						<h3 className="h4 fw-bold mb-2">{title}</h3>
						{subtitle && <p className="text-muted mb-3">{subtitle}</p>}
						<ul className="list-unstyled mb-0">
							{benefits.map((benefit, index) => (
								<li key={index} className="d-flex align-items-start mb-2">
									<span className="me-2 text-success mt-1">
										<Icon name="check2-circle" decorative />
									</span>
									<span className="text-muted">{benefit}</span>
								</li>
							))}
						</ul>
					</div>
					<div className="col-md-5">
						<form onSubmit={handleSubmit} className="d-flex flex-column gap-2">
							<Input
								type="email"
								name="email"
								id="early-signup-email"
								placeholder="you@example.com"
								required
								aria-describedby="early-signup-helper"
								label="Your email address"
							/>
							<Button type="submit" variant="primary" size="large" label={ctaLabel} />
							{helperText && (
								<p id="early-signup-helper" className="small text-muted mb-0">
									{helperText}
								</p>
							)}
						</form>
					</div>
				</div>
			</Card>
		</div>
	)
}
