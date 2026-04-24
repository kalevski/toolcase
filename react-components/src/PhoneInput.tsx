import React, { useId, useRef, useState } from 'react'
import { Icon } from './Icon'
import { useClickOutside } from './hooks/useClickOutside'

// ── Country data ───────────────────────────────────────────────────────────────

interface Country {
	code: string
	name: string
	dialCode: string
	flag: string
}

const COUNTRIES: Country[] = [
	{ code: 'US', name: 'United States',    dialCode: '1',    flag: '🇺🇸' },
	{ code: 'GB', name: 'United Kingdom',   dialCode: '44',   flag: '🇬🇧' },
	{ code: 'CA', name: 'Canada',           dialCode: '1',    flag: '🇨🇦' },
	{ code: 'AU', name: 'Australia',        dialCode: '61',   flag: '🇦🇺' },
	{ code: 'DE', name: 'Germany',          dialCode: '49',   flag: '🇩🇪' },
	{ code: 'FR', name: 'France',           dialCode: '33',   flag: '🇫🇷' },
	{ code: 'IN', name: 'India',            dialCode: '91',   flag: '🇮🇳' },
	{ code: 'JP', name: 'Japan',            dialCode: '81',   flag: '🇯🇵' },
	{ code: 'CN', name: 'China',            dialCode: '86',   flag: '🇨🇳' },
	{ code: 'BR', name: 'Brazil',           dialCode: '55',   flag: '🇧🇷' },
	{ code: 'MX', name: 'Mexico',           dialCode: '52',   flag: '🇲🇽' },
	{ code: 'RU', name: 'Russia',           dialCode: '7',    flag: '🇷🇺' },
	{ code: 'ES', name: 'Spain',            dialCode: '34',   flag: '🇪🇸' },
	{ code: 'IT', name: 'Italy',            dialCode: '39',   flag: '🇮🇹' },
	{ code: 'NL', name: 'Netherlands',      dialCode: '31',   flag: '🇳🇱' },
	{ code: 'SE', name: 'Sweden',           dialCode: '46',   flag: '🇸🇪' },
	{ code: 'NO', name: 'Norway',           dialCode: '47',   flag: '🇳🇴' },
	{ code: 'CH', name: 'Switzerland',      dialCode: '41',   flag: '🇨🇭' },
	{ code: 'PL', name: 'Poland',           dialCode: '48',   flag: '🇵🇱' },
	{ code: 'ZA', name: 'South Africa',     dialCode: '27',   flag: '🇿🇦' },
	{ code: 'NG', name: 'Nigeria',          dialCode: '234',  flag: '🇳🇬' },
	{ code: 'EG', name: 'Egypt',            dialCode: '20',   flag: '🇪🇬' },
	{ code: 'KR', name: 'South Korea',      dialCode: '82',   flag: '🇰🇷' },
	{ code: 'SG', name: 'Singapore',        dialCode: '65',   flag: '🇸🇬' },
	{ code: 'AE', name: 'United Arab Emirates', dialCode: '971', flag: '🇦🇪' },
	{ code: 'SA', name: 'Saudi Arabia',     dialCode: '966',  flag: '🇸🇦' },
	{ code: 'TR', name: 'Turkey',           dialCode: '90',   flag: '🇹🇷' },
	{ code: 'AR', name: 'Argentina',        dialCode: '54',   flag: '🇦🇷' },
	{ code: 'PT', name: 'Portugal',         dialCode: '351',  flag: '🇵🇹' },
	{ code: 'NZ', name: 'New Zealand',      dialCode: '64',   flag: '🇳🇿' },
]

// ── Types ──────────────────────────────────────────────────────────────────────

export interface PhoneInputProps {
	value?: string
	onChange?: (value: string) => void
	defaultCountry?: string
	label?: string
	placeholder?: string
	error?: string
	disabled?: boolean
	className?: string
}

// ── Component ──────────────────────────────────────────────────────────────────

export const PhoneInput: React.FC<PhoneInputProps> = ({
	value = '',
	onChange,
	defaultCountry = 'US',
	label,
	placeholder = 'Phone number',
	error,
	disabled = false,
	className = '',
}) => {
	const genId = useId()
	const inputId = `phone-${genId.replace(/[^a-zA-Z0-9_-]/g, '')}`
	const listId  = `${inputId}-list`
	const errorId = error ? `${inputId}-error` : undefined

	const findCountry = (code: string) => COUNTRIES.find((c) => c.code === code) ?? COUNTRIES[0]

	const [country, setCountry] = useState<Country>(findCountry(defaultCountry))
	const [open, setOpen] = useState(false)
	const [search, setSearch] = useState('')
	const containerRef = useRef<HTMLDivElement>(null)
	useClickOutside(containerRef, () => { setOpen(false); setSearch('') })

	const digits = value.startsWith(`+${country.dialCode}`)
		? value.slice(country.dialCode.length + 1).replace(/\D/g, '')
		: value.replace(/\D/g, '')

	const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		const rawDigits = e.target.value.replace(/\D/g, '')
		onChange?.(`+${country.dialCode}${rawDigits}`)
	}

	const handleCountrySelect = (c: Country) => {
		setCountry(c)
		setOpen(false)
		setSearch('')
		onChange?.(`+${c.dialCode}${digits}`)
	}

	const filtered = COUNTRIES.filter(
		(c) =>
			c.name.toLowerCase().includes(search.toLowerCase()) ||
			c.dialCode.includes(search)
	)

	const rootClass = [
		'component component-phone-input',
		error    ? 'component-phone-input--error'    : '',
		disabled ? 'component-phone-input--disabled' : '',
		className,
	].filter(Boolean).join(' ')

	return (
		<div className={rootClass} ref={containerRef}>
			{label && (
				<label htmlFor={inputId} className="form-label component-phone-input__label">
					{label}
				</label>
			)}

			<div className="component-phone-input__wrapper">
				{/* Country selector */}
				<button
					type="button"
					className={[
						'component-phone-input__country-btn',
						open ? 'component-phone-input__country-btn--open' : '',
					].filter(Boolean).join(' ')}
					aria-haspopup="listbox"
					aria-expanded={open}
					aria-controls={listId}
					disabled={disabled}
					onClick={() => setOpen((o) => !o)}
					onKeyDown={(e) => { if (e.key === 'Escape') { setOpen(false); setSearch('') } }}
				>
					<span className="component-phone-input__flag">{country.flag}</span>
					<span className="component-phone-input__dial-code">+{country.dialCode}</span>
					<Icon name="chevron-down" className="component-phone-input__chevron" />
				</button>

				{/* Phone number input */}
				<input
					id={inputId}
					type="tel"
					className={[
						'component-phone-input__input',
						error ? 'is-invalid' : '',
					].filter(Boolean).join(' ')}
					value={digits}
					onChange={handlePhoneChange}
					placeholder={placeholder}
					disabled={disabled}
					aria-invalid={error ? true : undefined}
					aria-describedby={errorId}
				/>

				{/* Dropdown */}
				{open && (
					<div className="component-phone-input__dropdown" role="listbox" id={listId}>
						<div className="component-phone-input__search-wrapper">
							<input
								type="text"
								className="component-phone-input__search"
								placeholder="Search country…"
								value={search}
								autoFocus
								onChange={(e) => setSearch(e.target.value)}
								onKeyDown={(e) => { if (e.key === 'Escape') { setOpen(false); setSearch('') } }}
							/>
						</div>
						<ul className="component-phone-input__list">
							{filtered.map((c) => (
								<li
									key={c.code}
									className={[
										'component-phone-input__option',
										c.code === country.code ? 'component-phone-input__option--selected' : '',
									].filter(Boolean).join(' ')}
									role="option"
									aria-selected={c.code === country.code}
									onClick={() => handleCountrySelect(c)}
									onKeyDown={(e) => { if (e.key === 'Enter') handleCountrySelect(c) }}
									tabIndex={0}
								>
									<span className="component-phone-input__option-flag">{c.flag}</span>
									<span className="component-phone-input__option-name">{c.name}</span>
									<span className="component-phone-input__option-dial">+{c.dialCode}</span>
								</li>
							))}
						</ul>
					</div>
				)}
			</div>

			{error && (
				<div id={errorId} className="invalid-feedback d-block">{error}</div>
			)}
		</div>
	)
}
