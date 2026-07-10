#!/usr/bin/env python3
"""Generate the tiny synthetic sample fixtures under samples/ (spec §11).

Pure Python 3 standard library (zlib + struct) — no PIL / numpy. It only ever
writes harmless synthetic images (solid colors + deterministic noise) into the
`neutral` and `drawings` classes, so running it can never introduce real
unsafe imagery into the repository (spec §8). These fixtures exist to exercise
the eval harness plumbing end-to-end; they are not a meaningful accuracy
corpus — point `eval.py --samples` at a private labeled set for that (see
README.md).

Run from this directory:

    python3 gen.py
"""

import os
import random
import struct
import zlib

SIZE = 16  # tiny (only needs to decode + tensorize)


def _chunk(typ, data):
    return (
        struct.pack(">I", len(data))
        + typ
        + data
        + struct.pack(">I", zlib.crc32(typ + data) & 0xFFFFFFFF)
    )


def write_png(path, pixel):
    """Write a SIZE×SIZE truecolor (RGB, 8-bit) PNG. pixel(x, y) -> (r, g, b).
    Each scanline is prefixed with filter-type byte 0 (None)."""
    raw = bytearray()
    for y in range(SIZE):
        raw.append(0)  # filter: None
        for x in range(SIZE):
            r, g, b = pixel(x, y)
            raw += bytes((r & 0xFF, g & 0xFF, b & 0xFF))
    ihdr = struct.pack(">IIBBBBB", SIZE, SIZE, 8, 2, 0, 0, 0)  # RGB truecolor
    png = (
        b"\x89PNG\r\n\x1a\n"
        + _chunk(b"IHDR", ihdr)
        + _chunk(b"IDAT", zlib.compress(bytes(raw), 9))
        + _chunk(b"IEND", b"")
    )
    with open(path, "wb") as f:
        f.write(png)
    print("wrote", path)


def solid(r, g, b):
    return lambda x, y: (r, g, b)


def gradient(x, y):
    return (x * 255 // (SIZE - 1), y * 255 // (SIZE - 1), (x + y) * 255 // (2 * (SIZE - 1)))


def noise(seed):
    rng = random.Random(seed)  # fixed seed → deterministic, reproducible bytes
    grid = [[(rng.randrange(256), rng.randrange(256), rng.randrange(256))
             for _ in range(SIZE)] for _ in range(SIZE)]
    return lambda x, y: grid[y][x]


def main():
    here = os.path.dirname(os.path.abspath(__file__))
    fixtures = {
        "neutral": {
            "gray.png": solid(128, 128, 128),
            "blue.png": solid(40, 90, 200),
            "gradient.png": gradient,
        },
        "drawings": {
            "white.png": solid(245, 245, 245),
            "flat.png": solid(210, 180, 140),
            "noise.png": noise(1729),
        },
    }
    for label, files in fixtures.items():
        d = os.path.join(here, label)
        os.makedirs(d, exist_ok=True)
        for name, px in files.items():
            write_png(os.path.join(d, name), px)


if __name__ == "__main__":
    main()
