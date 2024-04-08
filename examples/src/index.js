import AdjMatrixExample from './AdjMatrixExample'
import RetryExample from './RetryExample'
import SerializerExample from './SerializerExample'
import StateExample from './StateExample'
import JSONSchemaExample from './JSONSchemaExample'

const examples = new Map()
const DEFAULT_EXAMPLE = 'StateExample'


examples.set('StateExample', StateExample)
examples.set('SerializerExample', SerializerExample)
examples.set('AdjMatrixExample', AdjMatrixExample)
examples.set('RetryExample', RetryExample)
examples.set('JSONSchemaExample', JSONSchemaExample)

let url = new window.URL(window.location.href)
let key = url.searchParams.get('example') || DEFAULT_EXAMPLE
if (!examples.has(key)) {
    key = DEFAULT_EXAMPLE
}
let Class = examples.get(key)
let example = new Class()
example.run()
