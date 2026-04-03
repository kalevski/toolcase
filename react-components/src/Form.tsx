import React from 'react'
import { Card } from './Card'

export interface FormProps {
	children: React.ReactNode
	header?: React.ReactNode
	variant?: 'default' | 'primary' | 'secondary' | 'info' | 'success' | 'warning' | 'danger'
	onSubmit?: (data: Record<string, any>, event: React.FormEvent<HTMLFormElement>) => void
	className?: string
	wrapper?: boolean
}

export const Form: React.FC<FormProps> = ({ children, header, variant = 'default', onSubmit, className = '', wrapper = true }) => {
	const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
		e.preventDefault()
		const form = e.currentTarget
		const formData = new FormData(form)
		const data: Record<string, any> = {}
		formData.forEach((value, key) => {
			data[key] = value
		})
		if (onSubmit) onSubmit(data, e)
	}

	const renderForm = () => (
		<form onSubmit={handleSubmit} className={`component component-form ${className}`.trim()}>
			{children}
		</form>
	)

	return wrapper ? (
		<Card header={header} variant={variant}>{renderForm()}</Card>
	) : renderForm()
}
