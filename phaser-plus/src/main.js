import Scene from './base/Scene'
import GameObject from './base/GameObject'
import Feature from './base/Feature'
import GameObjectPool from './base/GameObjectPool'
import Layer from './base/Layer'

import Scene2D from './perspetive2d/Scene2D'
import World from './perspetive2d/World'
import GameObject2D from './perspetive2d/GameObject2D'

import Matrix2 from './structs/Matrix2'


const Perspective2D = {
    Scene2D,
    World,
    GameObject2D
}

const Structs = {
    Matrix2
}

export {
    Perspective2D,
    Structs,

    Scene,
    GameObject,
    Feature,
    GameObjectPool,
    Layer
}
