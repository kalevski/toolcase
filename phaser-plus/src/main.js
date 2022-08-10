import Scene from './Scene'
import GameObject from './GameObject'
import Feature from './Feature'

import Matrix2 from './structs/Matrix2'

import World from './perspective2d/World'
import GameObject2D from './perspective2d/GameObject2D'

import GameEvent from './flow/GameEvent'
import SensorEvent from './flow/SensorEvent'
import TimeEvent from './flow/TimeEvent'
import SensorProcessor from './flow/SensorProcessor'
import MatterJSProcessor from './flow/MatterJSProcessor'

import NavMesh from './ai/NavMesh'
import Path from './ai/Path'
import PathFinder from './ai/PathFinder'
import PathNode from './ai/PathNode'

import KeyboardInput from './features/KeyboardInput'
import SplitScreen from './features/SplitScreen'

const Features = {
    KeyboardInput,
    SplitScreen
}

const Structs = {
    Matrix2
}

const Perspective2D = {
    World,
    GameObject2D
}

const Flow = {
    GameEvent,
    SensorEvent,
    TimeEvent,
    SensorProcessor,
    MatterJSProcessor
}

const AI = {
    NavMesh,
    Path,
    PathFinder,
    PathNode
}

export {
    Scene,
    GameObject,
    Feature,
    Features,
    Structs,
    Perspective2D,
    Flow,
    AI
}
