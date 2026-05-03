import { JSX } from 'react'
import BasicLoggingDemo from './BasicLoggingDemo'
import LogLevelsDemo from './LogLevelsDemo'
import MultipleScopesDemo from './MultipleScopesDemo'
import CustomReporterDemo from './CustomReporterDemo'

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
]
