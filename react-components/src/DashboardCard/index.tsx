import React from 'react'

import { BasicCard } from './BasicCard'
import { DifferenceCard } from './DifferenceCard'
import { SlicesCard } from './SlicesCard'
import { ActivityCard } from './ActivityCard'
import { MetricCard } from './MetricCard'
import { ListCard } from './ListCard'
import { StatusCard } from './StatusCard'
import { ColoredCard } from './ColoredCard'


import type { BasicCardProps } from './BasicCard'
import type { DifferenceCardProps } from './DifferenceCard'
import type { SlicesCardProps } from './SlicesCard'
import type { ActivityCardProps } from './ActivityCard'
import type { MetricCardProps } from './MetricCard'
import type { ListCardProps } from './ListCard'
import type { StatusCardProps } from './StatusCard'
import type { ColoredCardProps } from './ColoredCard'


export type { BasicCardProps, DifferenceCardProps, SlicesCardProps, ActivityCardProps, MetricCardProps, ListCardProps, StatusCardProps, ColoredCardProps }

export type DashboardCardProps =
  | ({ type: 'basic' } & BasicCardProps)
  | ({ type: 'difference' } & DifferenceCardProps)
  | ({ type: 'slices' } & SlicesCardProps)
  | ({ type: 'activity' } & ActivityCardProps)
  | ({ type: 'metric' } & MetricCardProps)
  | ({ type: 'list' } & ListCardProps)
  | ({ type: 'status' } & StatusCardProps)
  | ({ type: 'colored' } & ColoredCardProps)

export interface DashboardCardWrapperProps {
	card: DashboardCardProps
	className?: string
	onClick?: (e: React.MouseEvent<HTMLDivElement>) => void
}

const renderCard = (card: DashboardCardProps) => {
	switch (card.type) {
		case 'basic': {
			const { type: _, ...props } = card
			return <BasicCard {...props} />
		}
		case 'difference': {
			const { type: _, ...props } = card
			return <DifferenceCard {...props} />
		}
		case 'slices': {
			const { type: _, ...props } = card
			return <SlicesCard {...props} />
		}
		case 'activity': {
			const { type: _, ...props } = card
			return <ActivityCard {...props} />
		}
		case 'metric': {
			const { type: _, ...props } = card
			return <MetricCard {...props} />
		}
		case 'list': {
			const { type: _, ...props } = card
			return <ListCard {...props} />
		}
		case 'status': {
			const { type: _, ...props } = card
			return <StatusCard {...props} />
		}
		case 'colored': {
			const { type: _, ...props } = card
			return <ColoredCard {...props} />
		}
	}
}

export const DashboardCard: React.FC<DashboardCardWrapperProps> = ({ card, className = '', onClick }) => {
	return (
		<div onClick={onClick} className={`component component-dashboard-card component-dashboard-card--${card.type}${className ? ` ${className}` : ''}`}>
			{renderCard(card)}
		</div>
	)
}
