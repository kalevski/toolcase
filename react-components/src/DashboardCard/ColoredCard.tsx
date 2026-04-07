import React from 'react'
import { Icon } from '../Icon'
import { Skeleton } from '../Skeleton'

export interface ColoredCardProps {
  text: string
  value: string | number
  icon: string // icon name, e.g. 'cloud-upload'
  color: string // background accent color (hex or CSS color)
  loading?: boolean
}

export const ColoredCard: React.FC<ColoredCardProps> = ({ text, value, icon, color, loading = false }) => {
  if (loading) {
    return (
      <div className="component-dashboard-card__body component-dashboard-card__body--colored">
        <div className="component-dashboard-card__colored-content">
          <Skeleton width="40%" />
          <Skeleton width="30%" height="2rem" />
        </div>
      </div>
    )
  }

  return (
    <div className="component-dashboard-card__body component-dashboard-card__body--colored">
      <div
        className="component-dashboard-card__colored-icon-bg"
        style={{ color }}
      >
        <Icon name={icon} />
      </div>
      <div className="component-dashboard-card__colored-content">
        <span className="component-dashboard-card__colored-text">{text}</span>
        <span className="component-dashboard-card__colored-value">{value}</span>
        <span className="component-dashboard-card__colored-icon">
          <Icon name={icon} />
        </span>
      </div>
    </div>
  )
}
