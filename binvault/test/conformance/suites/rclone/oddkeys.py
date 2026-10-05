#!/usr/bin/env python3
"""Expand ../../support/oddkeys.json for the bash suites.

  oddkeys.py ids              the ids, one per line
  oddkeys.py key ID           the exact key bytes (no trailing newline)
  oddkeys.py toolong          the 1025-byte key that must be refused (KeyTooLongError)
  oddkeys.py note ID          the note of an entry
  oddkeys.py hex ID           the key as hex (for logs)
"""
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
CANDIDATES = [os.path.join(HERE, "..", "..", "support", "oddkeys.json")]


def load():
    for c in CANDIDATES:
        if os.path.exists(c):
            return json.load(open(c, encoding="utf-8"))
    sys.exit("oddkeys.json not found")


def expand(e):
    if "gen" in e:
        return e["gen"]["char"] * e["gen"]["count"]
    return e["key"]


def main():
    d = load()
    cmd = sys.argv[1]
    if cmd == "ids":
        print("\n".join(e["id"] for e in d["keys"]))
    elif cmd == "toolong":
        sys.stdout.buffer.write((d["too_long"]["char"] * d["too_long"]["count"]).encode("utf-8"))
    else:
        e = next(e for e in d["keys"] if e["id"] == sys.argv[2])
        if cmd == "key":
            sys.stdout.buffer.write(expand(e).encode("utf-8"))
        elif cmd == "note":
            print(e.get("note", ""))
        elif cmd == "hex":
            print(expand(e).encode("utf-8").hex())
        else:
            sys.exit(__doc__)


if __name__ == "__main__":
    main()
