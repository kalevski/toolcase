#!/bin/sh
# voxscribe container entrypoint.
#
# One ggml model (the default 'small' tier) is baked into the image under
# /opt/voxscribe/seed-models. The durable model dir, however, lives on the
# bind-mounted ${WORKSPACE_DIR}/models volume, which SHADOWS anything the image
# ships there. So on every start we copy each seeded blob into the model dir
# IF it is not already present, then hand off to the app. This gives a
# transcribe-out-of-the-box image while keeping operator-downloaded models
# durable on the host volume.
set -eu

SEED_DIR=/opt/voxscribe/seed-models
# Mirror server/config.ts: VOXSCRIBE_MODEL_DIR wins, else ${WORKSPACE_DIR:-/workspace}/models.
DEST="${VOXSCRIBE_MODEL_DIR:-${WORKSPACE_DIR:-/workspace}/models}"

if [ -d "$SEED_DIR" ]; then
    mkdir -p "$DEST"
    for f in "$SEED_DIR"/*.bin; do
        [ -e "$f" ] || continue
        base=$(basename "$f")
        if [ ! -e "$DEST/$base" ]; then
            echo "voxscribe: seeding model $base -> $DEST"
            cp "$f" "$DEST/$base"
        fi
    done
fi

exec "$@"
