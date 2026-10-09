import { forwardRef, useEffect, useImperativeHandle, useRef, useState, type FormEvent } from 'react'
import type { EmailFilter, Mailbox } from '../jmap/types'
import { t } from '../i18n'
import { mailboxLabel, orderedMailboxes } from './FolderNav'

export type SearchQuery = {
    text: string
    field: 'text' | 'from' | 'to' | 'subject'
    mailboxId: string
    after: string
    before: string
}

export const EMPTY_SEARCH: SearchQuery = { text: '', field: 'text', mailboxId: '', after: '', before: '' }

export function searchFilter(q: SearchQuery): EmailFilter {
    const f: EmailFilter = {}
    const text = q.text.trim()
    if (text) f[q.field] = text
    if (q.mailboxId) f.inMailbox = q.mailboxId
    // Dates are local calendar days; JMAP wants UTCDate.
    if (q.after) f.after = new Date(`${q.after}T00:00:00`).toISOString()
    if (q.before) {
        const d = new Date(`${q.before}T00:00:00`)
        d.setDate(d.getDate() + 1)
        f.before = d.toISOString()
    }
    return f
}

export function isSearchActive(q: SearchQuery): boolean {
    return !!(q.text.trim() || q.after || q.before)
}

export type SearchBarHandle = { focus: () => void }

type Props = {
    mailboxes: Mailbox[]
    query: SearchQuery | null
    onSearch: (q: SearchQuery) => void
    onClear: () => void
}

/** The search box of the dashboard's bands: one framed row with the glyph, the field and its tools. */
export const SearchBar = forwardRef<SearchBarHandle, Props>(function SearchBar(
    { mailboxes, query, onSearch, onClear },
    ref,
) {
    const [q, setQ] = useState<SearchQuery>(query ?? EMPTY_SEARCH)
    const [showFilters, setShowFilters] = useState(false)
    const inputRef = useRef<HTMLInputElement>(null)

    // The parent ends a search when the reader changes folder; the box must not keep the old text.
    useEffect(() => {
        if (query === null) setQ(EMPTY_SEARCH)
    }, [query])

    useImperativeHandle(ref, () => ({
        focus: () => inputRef.current?.focus(),
    }))

    const submit = (e: FormEvent) => {
        e.preventDefault()
        setShowFilters(false)
        if (isSearchActive(q)) onSearch(q)
        else onClear()
    }

    const clear = () => {
        setQ(EMPTY_SEARCH)
        onClear()
    }

    return (
        <form className="wm-search" role="search" onSubmit={submit}>
            <div className="wm-search__box">
                <tc-icon name="search" size="16" decorative></tc-icon>
                <input
                    ref={inputRef}
                    type="search"
                    className="wm-search__input"
                    placeholder={t('search.placeholder')}
                    aria-label={t('search.placeholder')}
                    enterKeyHint="search"
                    autoComplete="off"
                    value={q.text}
                    onChange={(e) => setQ({ ...q, text: e.target.value })}
                    onKeyDown={(e) => {
                        if (e.key === 'Escape') {
                            clear()
                            inputRef.current?.blur()
                        }
                    }}
                />
                {query || q.text ? (
                    <tc-icon-button icon="X" size="small" label={t('search.clear')} ontc-click={clear}></tc-icon-button>
                ) : null}
                <tc-icon-button
                    icon="SlidersHorizontal"
                    size="small"
                    label={t('search.filters')}
                    aria-expanded={showFilters}
                    ontc-click={() => setShowFilters((s) => !s)}
                ></tc-icon-button>
            </div>
            {showFilters ? (
                <div className="wm-search__panel">
                    <tc-select
                        label={t('search.field')}
                        value={q.field}
                        ontc-change={(e) => setQ({ ...q, field: e.detail.value as SearchQuery['field'] })}
                    >
                        <tc-option value="text">{t('search.fieldAll')}</tc-option>
                        <tc-option value="from">{t('search.fieldFrom')}</tc-option>
                        <tc-option value="to">{t('search.fieldTo')}</tc-option>
                        <tc-option value="subject">{t('search.fieldSubject')}</tc-option>
                    </tc-select>
                    <tc-select
                        label={t('search.folder')}
                        value={q.mailboxId}
                        ontc-change={(e) => setQ({ ...q, mailboxId: String(e.detail.value ?? '') })}
                    >
                        <tc-option value="">{t('search.allFolders')}</tc-option>
                        {orderedMailboxes(mailboxes).map(({ mailbox: m, depth }) => (
                            <tc-option key={m.id} value={m.id}>
                                {' '.repeat(depth) + mailboxLabel(m)}
                            </tc-option>
                        ))}
                    </tc-select>
                    <tc-form-input
                        type="date"
                        label={t('search.after')}
                        value={q.after}
                        ontc-change={(e) => setQ({ ...q, after: String(e.detail.value ?? '') })}
                    ></tc-form-input>
                    <tc-form-input
                        type="date"
                        label={t('search.before')}
                        value={q.before}
                        ontc-change={(e) => setQ({ ...q, before: String(e.detail.value ?? '') })}
                    ></tc-form-input>
                    <tc-button type="submit" variant="primary" size="sm">
                        {t('search.submit')}
                    </tc-button>
                </div>
            ) : null}
        </form>
    )
})
