import { JSX } from 'react'
import EventEmitterDemo from './EventEmitterDemo'
import BroadcastDemo from './BroadcastDemo'
import StateDemo from './StateDemo'
import CacheDemo from './CacheDemo'
import PriorityQueueDemo from './PriorityQueueDemo'
import VectorClockDemo from './VectorClockDemo'
import AdjacencyMatrixDemo from './AdjacencyMatrixDemo'
import ObjectPoolDemo from './ObjectPoolDemo'
import LSystemDemo from './LSystemDemo'
import JSONSchemaDemo from './JSONSchemaDemo'
import RetryDemo from './RetryDemo'
import ColorDemo from './ColorDemo'
import UtilitiesDemo from './UtilitiesDemo'
import PackingDemo from './PackingDemo'
import WeightedRandomDemo from './WeightedRandomDemo'
import RandomDemo from './RandomDemo'
import DijkstraDemo from './DijkstraDemo'
import AStarDemo from './AStarDemo'
import AsyncDemo from './AsyncDemo'
import RingBufferDemo from './RingBufferDemo'
import UlidDemo from './UlidDemo'
import StackDemo from './StackDemo'
import DequeDemo from './DequeDemo'
import DisjointSetDemo from './DisjointSetDemo'
import TrieDemo from './TrieDemo'
import SpatialDemo from './SpatialDemo'
import BiMapDemo from './BiMapDemo'
import MultiMapDemo from './MultiMapDemo'
import Vec2Demo from './Vec2Demo'
import MathDemo from './MathDemo'
import EasingDemo from './EasingDemo'
import FormattingDemo from './FormattingDemo'

export type BaseCategory =
    | 'Events & State'
    | 'Data Structures'
    | 'Generation & Validation'
    | 'Utilities & Colors'
    | 'Async'

export type BaseExampleDef = {
    key: string
    label: string
    category: BaseCategory
    element: JSX.Element
}

export const baseCategories: BaseCategory[] = [
    'Events & State',
    'Data Structures',
    'Generation & Validation',
    'Utilities & Colors',
    'Async',
]

export const baseExamples: BaseExampleDef[] = [
    { key: 'event-emitter', label: 'EventEmitter', category: 'Events & State', element: <EventEmitterDemo /> },
    { key: 'broadcast', label: 'Broadcast', category: 'Events & State', element: <BroadcastDemo /> },
    { key: 'state', label: 'State', category: 'Events & State', element: <StateDemo /> },

    { key: 'cache', label: 'Cache', category: 'Data Structures', element: <CacheDemo /> },
    { key: 'priority-queue', label: 'PriorityQueue', category: 'Data Structures', element: <PriorityQueueDemo /> },
    { key: 'vector-clock', label: 'VectorClock', category: 'Data Structures', element: <VectorClockDemo /> },
    { key: 'adjacency-matrix', label: 'AdjacencyMatrix', category: 'Data Structures', element: <AdjacencyMatrixDemo /> },
    { key: 'object-pool', label: 'ObjectPool', category: 'Data Structures', element: <ObjectPoolDemo /> },
    { key: 'ring-buffer', label: 'RingBuffer', category: 'Data Structures', element: <RingBufferDemo /> },
    { key: 'stack', label: 'Stack', category: 'Data Structures', element: <StackDemo /> },
    { key: 'deque', label: 'Deque', category: 'Data Structures', element: <DequeDemo /> },
    { key: 'disjoint-set', label: 'DisjointSet', category: 'Data Structures', element: <DisjointSetDemo /> },
    { key: 'trie', label: 'Trie', category: 'Data Structures', element: <TrieDemo /> },
    { key: 'bimap', label: 'BiMap', category: 'Data Structures', element: <BiMapDemo /> },
    { key: 'multimap', label: 'MultiMap', category: 'Data Structures', element: <MultiMapDemo /> },
    { key: 'vec2', label: 'Vec2', category: 'Data Structures', element: <Vec2Demo /> },
    { key: 'spatial', label: 'Spatial', category: 'Data Structures', element: <SpatialDemo /> },
    { key: 'weighted-random', label: 'WeightedRandom', category: 'Data Structures', element: <WeightedRandomDemo /> },
    { key: 'random', label: 'Random', category: 'Data Structures', element: <RandomDemo /> },
    { key: 'dijkstra', label: 'Dijkstra', category: 'Data Structures', element: <DijkstraDemo /> },
    { key: 'astar', label: 'AStar', category: 'Data Structures', element: <AStarDemo /> },

    { key: 'lsystem', label: 'LSystem', category: 'Generation & Validation', element: <LSystemDemo /> },
    { key: 'json-schema', label: 'JSONSchema', category: 'Generation & Validation', element: <JSONSchemaDemo /> },
    { key: 'retry', label: 'retry', category: 'Generation & Validation', element: <RetryDemo /> },
    { key: 'packing', label: 'Packing', category: 'Generation & Validation', element: <PackingDemo /> },

    { key: 'ulid', label: 'ulid', category: 'Utilities & Colors', element: <UlidDemo /> },
    { key: 'utilities', label: 'Utility Functions', category: 'Utilities & Colors', element: <UtilitiesDemo /> },
    { key: 'formatting', label: 'Formatting Helpers', category: 'Utilities & Colors', element: <FormattingDemo /> },
    { key: 'math', label: 'Math Utilities', category: 'Utilities & Colors', element: <MathDemo /> },
    { key: 'easing', label: 'Easing Functions', category: 'Utilities & Colors', element: <EasingDemo /> },
    { key: 'color', label: 'Color', category: 'Utilities & Colors', element: <ColorDemo /> },

    { key: 'async', label: 'Async', category: 'Async', element: <AsyncDemo /> },
]
