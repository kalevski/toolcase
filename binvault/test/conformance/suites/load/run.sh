#!/usr/bin/env bash
# suite load: the load and robustness tests of test/load (1 GiB multipart, 20,000 small objects, listings, kill -9 durability).
# Not part of the default run: ./run.sh --only load. BV_LOAD_SCALE=0.1 makes it quick.
set -uo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
exec bash "$HERE/../../../load/run.sh"
