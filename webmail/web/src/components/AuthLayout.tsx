import type { ReactNode } from 'react'
import { t } from '../i18n'

type BoardRow = { from: string; subject: string; state: string; tone: 'go' | 'warn' | 'muted'; when: string }

const BOARD: readonly BoardRow[] = [
    { from: 'boss@acme.io', subject: 'Quarterly numbers', state: 'unread', tone: 'go', when: '5 min' },
    { from: 'billing@vendor.com', subject: 'Invoice 2041 is due', state: 'starred', tone: 'warn', when: '1 h' },
    { from: 'team@acme.io', subject: 'Standup notes', state: 'read', tone: 'muted', when: 'Mon' },
]

/**
 * The sign-in frame, in the dashboard's pattern: a dark stage with the brand, a headline and a decorative board on
 * one side, the form card on the other.
 */
export function AuthLayout({
    logo,
    title,
    children,
}: {
    logo: ReactNode
    title: string
    children: ReactNode
}) {
    return (
        <main className="wm-login">
            <section className="wm-stage" aria-hidden="true">
                <header className="wm-stage__head">{logo}</header>
                <div className="wm-stage__body">
                    <p className="wm-eyebrow">{t('login.eyebrow')}</p>
                    <h2 className="wm-stage__title">{t('login.stageTitle')}</h2>
                    <p className="wm-stage__lead">{t('login.stageLead')}</p>
                    <div className="wm-board">
                        <div className="wm-board__head">
                            <span>{t('login.boardFrom')}</span>
                            <span>{t('login.boardState')}</span>
                            <span>{t('login.boardWhen')}</span>
                        </div>
                        <ul className="wm-board__rows">
                            {BOARD.map((row, index) => (
                                <li
                                    key={row.from}
                                    className={`wm-board__row wm-board__row--${row.tone}`}
                                    style={{ '--wm-delay': `${index * 70}ms` } as React.CSSProperties}
                                >
                                    <span className="wm-board__from">{row.from}</span>
                                    <span className="wm-board__state">{row.state}</span>
                                    <span className="wm-board__when">{row.when}</span>
                                    <span className="wm-board__subject">{row.subject}</span>
                                </li>
                            ))}
                        </ul>
                    </div>
                </div>
            </section>
            <section className="wm-card wm-login__panel">
                <div className="wm-card__body">
                    <h1 className="wm-card__title wm-login__title">{title}</h1>
                    {children}
                </div>
            </section>
        </main>
    )
}
