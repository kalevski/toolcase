import SpatialHash from './SpatialHash'
import Quadtree from './Quadtree'

export { SpatialHash, Quadtree }

export type { SpatialPoint, SpatialRect } from './types'

const Spatial = {
    SpatialHash,
    Quadtree
}

export default Spatial
