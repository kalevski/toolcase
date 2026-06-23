import { JSX } from 'react'
import BasicDemo from './BasicDemo'
import FieldTypesDemo from './FieldTypesDemo'
import RepeatedFieldsDemo from './RepeatedFieldsDemo'
import MultipleTypesDemo from './MultipleTypesDemo'
import ErrorHandlingDemo from './ErrorHandlingDemo'
import AdvancedFieldsDemo from './AdvancedFieldsDemo'
import VersioningDemo from './VersioningDemo'

export type SerializerExampleDef = {
    key: string
    label: string
    element: JSX.Element
}

export const serializerExamples: SerializerExampleDef[] = [
    { key: 'basic', label: 'Basic', element: <BasicDemo /> },
    { key: 'field-types', label: 'Field Types', element: <FieldTypesDemo /> },
    { key: 'repeated', label: 'Repeated Fields', element: <RepeatedFieldsDemo /> },
    { key: 'multiple', label: 'Multiple Types', element: <MultipleTypesDemo /> },
    { key: 'errors', label: 'Error Handling', element: <ErrorHandlingDemo /> },
    { key: 'advanced-fields', label: 'Advanced Fields', element: <AdvancedFieldsDemo /> },
    { key: 'versioning', label: 'Versioning & Migration', element: <VersioningDemo /> },
]
