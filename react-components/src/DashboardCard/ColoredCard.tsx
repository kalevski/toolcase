import React from 'react'
import { Icon } from '../Icon'

export interface ColoredCardProps {
  text: string
  value: string | number
  icon: string // icon name, e.g. 'cloud-upload'
  color: string // background accent color (hex or CSS color)
}

export const ColoredCard: React.FC<ColoredCardProps> = ({ text, value, icon, color }) => {
  return (
    <div className="component-dashboard-card__body component-dashboard-card__body--colored" style={{ position: 'relative', overflow: 'hidden', background: '#fff', borderRadius: 18, minHeight: 120 }}>
      <div
        className="component-dashboard-card__colored-icon-bg"
        style={{
          position: 'absolute',
          right: -18,
          bottom: -18,
          fontSize: 110,
          color: color,
          opacity: 0.3,
          transform: 'rotate(-18deg) scale(1.2)',
          pointerEvents: 'none',
        }}
      >
        <Icon name={icon} />
      </div>
      {/* Main content */}
      <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: 8, minHeight: 90, justifyContent: 'center', alignItems: 'flex-start', padding: '12px 0 0 0' }}>
        <span style={{ fontSize: 15, fontWeight: 600, color: '#334155', letterSpacing: 0.01 }}>{text}</span>
        <span style={{ fontSize: 32, fontWeight: 800, color: '#000000', lineHeight: 1 }}>{value}</span>
        <span style={{ fontSize: 22, color: '#000000', opacity: 0.7, display: 'inline-flex', alignItems: 'center', marginTop: 2 }}>
          <Icon name={icon} />
        </span>
      </div>
    </div>
  )
}
