import { JSX } from 'react'
import BasicLoggingDemo from './BasicLoggingDemo'
import LogLevelsDemo from './LogLevelsDemo'
import MultipleScopesDemo from './MultipleScopesDemo'
import CustomReporterDemo from './CustomReporterDemo'
import ScopePatternDemo from './ScopePatternDemo'
import RingBufferReporterDemo from './RingBufferReporterDemo'
import ComposableReportersDemo from './ComposableReportersDemo'
import HTTPReporterDemo from './HTTPReporterDemo'
import OTLPReporterDemo from './OTLPReporterDemo'

export type LoggingExampleDef = {
    key: string
    label: string
    element: JSX.Element
}

export const loggingExamples: LoggingExampleDef[] = [
    { key: 'basic', label: 'Basic Usage', element: <BasicLoggingDemo /> },
    { key: 'levels', label: 'Log Levels', element: <LogLevelsDemo /> },
    { key: 'scopes', label: 'Multiple Scopes', element: <MultipleScopesDemo /> },
    { key: 'reporter', label: 'Custom Reporter', element: <CustomReporterDemo /> },
    { key: 'scope-pattern', label: 'Scope-pattern Levels', element: <ScopePatternDemo /> },
    { key: 'ring-buffer', label: 'RingBufferReporter', element: <RingBufferReporterDemo /> },
    { key: 'composable-reporters', label: 'Composable Reporters', element: <ComposableReportersDemo /> },
    { key: 'http-reporter', label: 'HTTPReporter', element: <HTTPReporterDemo /> },
    { key: 'otlp-reporter', label: 'OTLPReporter', element: <OTLPReporterDemo /> },
]
