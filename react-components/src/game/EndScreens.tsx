import React from 'react'

export interface ResultScreenProps {
    title: React.ReactNode
    subtitle?: React.ReactNode
    stats?: Array<{ label: React.ReactNode, value: React.ReactNode }>
    rewards?: Array<{ label: React.ReactNode, value?: React.ReactNode, icon?: React.ReactNode }>
    actions?: Array<{ id: string, label: React.ReactNode, primary?: boolean, danger?: boolean, onClick?: () => void }>
    titleColor?: string
    style?: React.CSSProperties
    className?: string
}

export const ResultScreen: React.FC<ResultScreenProps> = ({ title, subtitle, stats, rewards, actions, titleColor = '#fff', style, className }) => {
    return (
        <div className={className} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 24, color: '#e6e8ec', minHeight: 480, padding: 32, ...style }}>
            <div style={{ textAlign: 'center' }}>
                <h1 style={{ margin: 0, fontSize: 64, color: titleColor, textShadow: '0 4px 16px rgba(0,0,0,0.6)', letterSpacing: 4 }}>{title}</h1>
                {subtitle && <div style={{ fontSize: 16, opacity: 0.7, marginTop: 8 }}>{subtitle}</div>}
            </div>
            {stats && stats.length > 0 && (
                <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(stats.length, 4)}, 1fr)`, gap: 16, minWidth: 480 }}>
                    {stats.map((stat, i) => (
                        <div key={i} style={{ textAlign: 'center', padding: 12, background: 'rgba(15,18,24,0.6)', borderRadius: 4 }}>
                            <div style={{ fontSize: 11, opacity: 0.6, textTransform: 'uppercase', letterSpacing: 1 }}>{stat.label}</div>
                            <div style={{ fontSize: 24, fontWeight: 700, marginTop: 4 }}>{stat.value}</div>
                        </div>
                    ))}
                </div>
            )}
            {rewards && rewards.length > 0 && (
                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center' }}>
                    {rewards.map((reward, i) => (
                        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: 'rgba(255,211,90,0.1)', border: '1px solid rgba(255,211,90,0.4)', borderRadius: 4 }}>
                            {reward.icon}<span>{reward.label}</span>{reward.value && <strong>{reward.value}</strong>}
                        </div>
                    ))}
                </div>
            )}
            {actions && actions.length > 0 && (
                <div style={{ display: 'flex', gap: 8 }}>
                    {actions.map((action) => (
                        <button key={action.id} type="button" onClick={action.onClick} style={{ padding: '10px 18px', background: action.primary ? '#6aa9ff' : action.danger ? '#d23a3a' : 'transparent', color: action.primary || action.danger ? '#fff' : '#e6e8ec', border: action.primary || action.danger ? 'none' : '1px solid rgba(255,255,255,0.15)', borderRadius: 4, cursor: 'pointer', fontWeight: 600 }}>{action.label}</button>
                    ))}
                </div>
            )}
        </div>
    )
}

export const GameOverScreen: React.FC<Omit<ResultScreenProps, 'titleColor'>> = (props) => <ResultScreen {...props} titleColor="#d23a3a" />
export const VictoryScreen: React.FC<Omit<ResultScreenProps, 'titleColor'>> = (props) => <ResultScreen {...props} titleColor="#ffd35a" />
export const WinScreen = VictoryScreen
