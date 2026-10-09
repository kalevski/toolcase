import { useId, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import type { EmailAddress } from '../../jmap/types'
import { t } from '../../i18n'
import { suggest } from '../../state/contacts'
import { parseAddress, splitAddresses } from '../../util/address'
import { formatAddress } from '../../util/format'

type Props = {
    label: string
    value: EmailAddress[]
    onChange: (next: EmailAddress[]) => void
    onError: (message: string) => void
    autoFocus?: boolean
}

/** Recipient chips with history autocomplete (ARIA combobox + listbox). */
export function AddressField({ label, value, onChange, onError, autoFocus }: Props) {
    const [text, setText] = useState('')
    const [active, setActive] = useState(-1)
    const [focused, setFocused] = useState(false)
    const inputRef = useRef<HTMLInputElement>(null)
    const id = useId()
    const listId = `${id}-list`
    const options = useMemo(
        () => (focused ? suggest(text, value.map((v) => v.email)) : []),
        [focused, text, value],
    )

    const commit = (raw: string): boolean => {
        const tokens = splitAddresses(raw)
        if (!tokens.length) return true
        const next = [...value]
        const bad: string[] = []
        for (const tok of tokens) {
            const a = parseAddress(tok)
            if (!a) bad.push(tok)
            else if (!next.some((n) => n.email.toLowerCase() === a.email.toLowerCase())) next.push(a)
        }
        onChange(next)
        if (bad.length) {
            setText(bad.join(', '))
            onError(t('compose.badAddress', { address: bad[0] }))
            return false
        }
        setText('')
        return true
    }

    const pick = (a: EmailAddress) => {
        if (!value.some((v) => v.email.toLowerCase() === a.email.toLowerCase())) onChange([...value, a])
        setText('')
        setActive(-1)
        inputRef.current?.focus()
    }

    const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'ArrowDown' && options.length) {
            e.preventDefault()
            setActive((i) => (i + 1) % options.length)
        } else if (e.key === 'ArrowUp' && options.length) {
            e.preventDefault()
            setActive((i) => (i <= 0 ? options.length - 1 : i - 1))
        } else if (e.key === 'Enter' || e.key === ',' || e.key === ';') {
            if (active >= 0 && options[active]) {
                e.preventDefault()
                pick(options[active])
            } else if (text.trim()) {
                e.preventDefault()
                commit(text)
            }
        } else if (e.key === 'Tab' && text.trim()) {
            if (active >= 0 && options[active]) pick(options[active])
            else commit(text)
        } else if (e.key === 'Backspace' && !text && value.length) {
            onChange(value.slice(0, -1))
        } else if (e.key === 'Escape' && options.length) {
            e.stopPropagation()
            setActive(-1)
            setFocused(false)
        }
    }

    return (
        <div className="wm-addr">
            <label className="wm-addr__label" htmlFor={id}>
                {label}
            </label>
            <div className="wm-addr__box" onClick={() => inputRef.current?.focus()}>
                {value.map((a) => (
                    <span key={a.email} className="wm-chip" title={formatAddress(a)}>
                        <span className="wm-chip__text">{a.name || a.email}</span>
                        <button
                            type="button"
                            className="wm-chip__remove"
                            aria-label={t('compose.removeAddress', { address: a.email })}
                            onClick={() => onChange(value.filter((v) => v !== a))}
                        >
                            <tc-icon name="x" size="13" decorative></tc-icon>
                        </button>
                    </span>
                ))}
                <input
                    ref={inputRef}
                    id={id}
                    className="wm-addr__input"
                    type="text"
                    inputMode="email"
                    autoComplete="off"
                    autoCapitalize="off"
                    spellCheck={false}
                    autoFocus={autoFocus}
                    role="combobox"
                    aria-expanded={options.length > 0}
                    aria-controls={listId}
                    aria-autocomplete="list"
                    aria-activedescendant={active >= 0 ? `${listId}-${active}` : undefined}
                    aria-describedby={`${id}-hint`}
                    value={text}
                    onChange={(e) => {
                        const v = e.target.value
                        if (/[,;\n]/.test(v)) commit(v)
                        else {
                            setText(v)
                            setActive(-1)
                        }
                    }}
                    onPaste={(e) => {
                        const pasted = e.clipboardData.getData('text')
                        if (/[,;\n]/.test(pasted)) {
                            e.preventDefault()
                            commit(text + pasted)
                        }
                    }}
                    onKeyDown={onKeyDown}
                    onFocus={() => setFocused(true)}
                    onBlur={() => {
                        window.setTimeout(() => setFocused(false), 150)
                        if (text.trim()) commit(text)
                    }}
                />
            </div>
            <span id={`${id}-hint`} className="wm-sr-only">
                {t('compose.addressHint')}
            </span>
            {options.length ? (
                <ul id={listId} className="wm-addr__list" role="listbox" aria-label={t('compose.suggestions')}>
                    {options.map((o, i) => (
                        <li
                            key={o.email}
                            id={`${listId}-${i}`}
                            role="option"
                            aria-selected={i === active}
                            className={`wm-addr__option${i === active ? ' is-active' : ''}`}
                            onMouseDown={(e) => {
                                e.preventDefault()
                                pick(o)
                            }}
                        >
                            {o.name ? <strong>{o.name}</strong> : null} <span className="wm-muted">{o.email}</span>
                        </li>
                    ))}
                </ul>
            ) : null}
        </div>
    )
}
