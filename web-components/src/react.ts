'use client'

// React bridge for @toolcase/web-components.
//
// Import this module once in your React app to:
//   1. Augment React.JSX.IntrinsicElements so tc-* tags compile without errors.
//   2. Access the useTc / useTcEvents hooks for wiring events and JS-only props.
//
//     import '@toolcase/web-components/react'               // JSX types only
//     import { useTc, useTcEvents } from '@toolcase/web-components/react'  // + hooks
//
// Regenerate JSX types after adding/removing a component or attribute:
//     npm -w @toolcase/web-components run gen:react-types

// Re-export generated JSX intrinsic element types. The side-effect of this
// import augments React.JSX and the global JSX namespace with the tc-* tags.
export type { TcProps, ToolcaseIntrinsicElements } from './react-types'

// Runtime hooks — wire tc-* events and JS-only instance properties.
export { useTc, useTcEvents, detailValue } from './useTc'
export type { TcEventHandler, TcEventMap } from './useTc'
