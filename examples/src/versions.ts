// Single source of truth for the package versions shown on the site.
// Imported straight from each workspace's package.json so the pages can
// never drift from what is actually published.
import { version as baseVersion } from '../../base/package.json'
import { version as loggingVersion } from '../../logging/package.json'
import { version as serializerVersion } from '../../serializer/package.json'
import { version as reactComponentsVersion } from '../../react-components/package.json'
import { version as gameComponentsVersion } from '../../game-components/package.json'
import { version as phaserPlusVersion } from '../../phaser-plus/package.json'
import { version as nodeVersion } from '../../node/package.json'

export const versions = {
    base: baseVersion,
    logging: loggingVersion,
    serializer: serializerVersion,
    'react-components': reactComponentsVersion,
    'game-components': gameComponentsVersion,
    'phaser-plus': phaserPlusVersion,
    node: nodeVersion,
} as const
