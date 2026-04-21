import React from 'react'

export { TrendIndicator } from './TrendIndicator'
export type { TrendIndicatorProps } from './TrendIndicator'

export { Sparkline } from './Sparkline'
export type { SparklineProps } from './Sparkline'

export { BarChart } from './BarChart'
export type { BarChartProps, BarChartDataItem } from './BarChart'

export { LineChart } from './LineChart'
export type { LineChartProps, LineChartSeries, LineChartPoint } from './LineChart'

export { PieChart } from './PieChart'
export type { PieChartProps, PieChartSlice } from './PieChart'

export { AreaChart } from './AreaChart'
export type { AreaChartProps } from './AreaChart'

export { Heatmap } from './Heatmap'
export type { HeatmapProps, HeatmapCell } from './Heatmap'

export { FunnelChart } from './FunnelChart'
export type { FunnelChartProps, FunnelStep } from './FunnelChart'

export { GanttChart } from './GanttChart'
export type { GanttChartProps, GanttTask } from './GanttChart'

export { ChartContainer } from './ChartContainer'
export type { ChartContainerProps } from './ChartContainer'

import { TrendIndicator, TrendIndicatorProps } from './TrendIndicator'
import { Sparkline, SparklineProps } from './Sparkline'
import { BarChart, BarChartProps } from './BarChart'
import { LineChart, LineChartProps } from './LineChart'
import { PieChart, PieChartProps } from './PieChart'
import { AreaChart, AreaChartProps } from './AreaChart'
import { Heatmap, HeatmapProps } from './Heatmap'
import { FunnelChart, FunnelChartProps } from './FunnelChart'
import { GanttChart, GanttChartProps } from './GanttChart'
import { ChartContainer, ChartContainerProps } from './ChartContainer'

type TrendIndicatorChart = TrendIndicatorProps & { type: 'trend-indicator' }
type SparklineChart = Omit<SparklineProps, 'type'> & { type: 'sparkline'; sparklineType?: SparklineProps['type'] }
type BarChart2 = BarChartProps & { type: 'bar' }
type LineChart2 = LineChartProps & { type: 'line' }
type PieChart2 = PieChartProps & { type: 'pie' }
type AreaChart2 = AreaChartProps & { type: 'area' }
type HeatmapChart = HeatmapProps & { type: 'heatmap' }
type FunnelChart2 = FunnelChartProps & { type: 'funnel' }
type GanttChart2 = GanttChartProps & { type: 'gantt' }
type ChartContainerChart = ChartContainerProps & { type: 'container' }

export type ChartProps =
	| TrendIndicatorChart
	| SparklineChart
	| BarChart2
	| LineChart2
	| PieChart2
	| AreaChart2
	| HeatmapChart
	| FunnelChart2
	| GanttChart2
	| ChartContainerChart

export interface ChartWrapperProps {
	chart: ChartProps
	className?: string
	children?: React.ReactNode
}

function renderChart(chart: ChartProps, children?: React.ReactNode): React.ReactNode {
	const { type, ...rest } = chart
	switch (type) {
		case 'trend-indicator': return <TrendIndicator {...(rest as TrendIndicatorProps)} />
		case 'sparkline': {
			const { sparklineType, ...sparklineRest } = rest as Omit<SparklineProps, 'type'> & { sparklineType?: SparklineProps['type'] }
			return <Sparkline {...sparklineRest} type={sparklineType} />
		}
		case 'bar': return <BarChart {...(rest as BarChartProps)} />
		case 'line': return <LineChart {...(rest as LineChartProps)} />
		case 'pie': return <PieChart {...(rest as PieChartProps)} />
		case 'area': return <AreaChart {...(rest as AreaChartProps)} />
		case 'heatmap': return <Heatmap {...(rest as HeatmapProps)} />
		case 'funnel': return <FunnelChart {...(rest as FunnelChartProps)} />
		case 'gantt': return <GanttChart {...(rest as GanttChartProps)} />
		case 'container': return <ChartContainer {...(rest as ChartContainerProps)}>{children}</ChartContainer>
	}
}

export const Chart: React.FC<ChartWrapperProps> = ({ chart, className = '', children }) => {
	return (
		<div className={`component component-chart component-chart--${chart.type}${className ? ` ${className}` : ''}`}>
			{renderChart(chart, children)}
		</div>
	)
}
