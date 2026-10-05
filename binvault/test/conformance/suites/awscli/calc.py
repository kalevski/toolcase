#!/usr/bin/env python3
"""Small helpers for the awscli suite (stdlib only, no third-party packages).

  calc.py md5hex FILE | md5b64 FILE
  calc.py crc32|crc32c|crc64nvme|sha1|sha256 FILE            base64 of the whole-object checksum
  calc.py mp-etag FILE PARTSIZE                              S3 multipart ETag: md5(md5(part1)+...)-N
  calc.py mp-checksum ALGO FILE PARTSIZE                     composite checksum: b64(algo(concat(algo(part_i))))-N
  calc.py jget PATH                                          read JSON on stdin, print the value at a.b[0].c
  calc.py jlen PATH                                          length of the list/dict at PATH
  calc.py slice FILE START END                               write bytes [START, END] (inclusive) to stdout
  calc.py png|jpeg|gif|pdf|html OUT                          write a small sample file with that magic
  calc.py jhaskey FILE                                       exit 0 when the list-objects JSON on stdin has Contents[].Key == the text in FILE
  calc.py jkeys                                              print Contents[].Key and CommonPrefixes[].Prefix of list-objects JSON on stdin, one per line
  calc.py mkparts FILE PARTSIZE OUTDIR                       split FILE into OUTDIR/part1.. (PARTSIZE bytes each)
  calc.py completejson ETAG... (one per part)                print {"Parts":[...]} for complete-multipart-upload
  calc.py selftest                                           check the CRC implementations against known vectors
"""
import base64
import hashlib
import json
import re
import struct
import sys
import zlib


def _table(poly, bits):
    t = []
    for i in range(256):
        c = i
        for _ in range(8):
            c = (c >> 1) ^ poly if c & 1 else c >> 1
        t.append(c & ((1 << bits) - 1))
    return t


_T32C = _table(0x82F63B78, 32)
_T64 = _table(0x9A6C9329AC4BC9B5, 64)  # reflected CRC-64/NVME polynomial


def crc32c(data):
    c = 0xFFFFFFFF
    for b in data:
        c = _T32C[(c ^ b) & 0xFF] ^ (c >> 8)
    return c ^ 0xFFFFFFFF


def crc64nvme(data):
    c = 0xFFFFFFFFFFFFFFFF
    for b in data:
        c = _T64[(c ^ b) & 0xFF] ^ (c >> 8)
    return c ^ 0xFFFFFFFFFFFFFFFF


def digest(algo, data):
    """Raw checksum bytes (big endian for the CRCs), as S3 base64-encodes them."""
    if algo == "crc32":
        return struct.pack(">I", zlib.crc32(data) & 0xFFFFFFFF)
    if algo == "crc32c":
        return struct.pack(">I", crc32c(data))
    if algo == "crc64nvme":
        return struct.pack(">Q", crc64nvme(data))
    if algo == "sha1":
        return hashlib.sha1(data).digest()
    if algo == "sha256":
        return hashlib.sha256(data).digest()
    raise SystemExit("unknown algorithm " + algo)


def b64(b):
    return base64.b64encode(b).decode()


def parts(path, size):
    with open(path, "rb") as f:
        while True:
            chunk = f.read(size)
            if not chunk:
                break
            yield chunk


def jget(obj, path):
    cur = obj
    for tok in re.findall(r"[^.\[\]]+|\[\d+\]", path):
        if tok.startswith("["):
            cur = cur[int(tok[1:-1])]
        else:
            cur = cur[tok]
    return cur


def main():
    a = sys.argv[1:]
    if not a:
        sys.exit(__doc__)
    cmd = a[0]
    if cmd == "md5hex":
        print(hashlib.md5(open(a[1], "rb").read()).hexdigest())
    elif cmd == "md5b64":
        print(b64(hashlib.md5(open(a[1], "rb").read()).digest()))
    elif cmd in ("crc32", "crc32c", "crc64nvme", "sha1", "sha256"):
        print(b64(digest(cmd, open(a[1], "rb").read())))
    elif cmd == "mp-etag":
        ps = [hashlib.md5(c).digest() for c in parts(a[1], int(a[2]))]
        print("%s-%d" % (hashlib.md5(b"".join(ps)).hexdigest(), len(ps)))
    elif cmd == "mp-checksum":
        algo = a[1]
        ds = [digest(algo, c) for c in parts(a[2], int(a[3]))]
        print("%s-%d" % (b64(digest(algo, b"".join(ds))), len(ds)))
    elif cmd in ("jget", "jlen"):
        try:
            v = jget(json.load(sys.stdin), a[1])
        except (KeyError, IndexError, TypeError, ValueError):
            sys.exit(3)
        if cmd == "jlen":
            print(len(v))
        elif isinstance(v, (dict, list)):
            print(json.dumps(v, sort_keys=True))
        elif isinstance(v, bool):
            print("true" if v else "false")
        else:
            print(v)
    elif cmd == "jhaskey":
        want = open(a[1], "rb").read().decode("utf-8")
        doc = json.load(sys.stdin) or {}
        sys.exit(0 if any(o.get("Key") == want for o in doc.get("Contents", []) or []) else 1)
    elif cmd == "jkeys":
        doc = json.load(sys.stdin) or {}
        for o in doc.get("Contents", []) or []:
            print(o.get("Key"))
        for p_ in doc.get("CommonPrefixes", []) or []:
            print(p_.get("Prefix"))
    elif cmd == "mkparts":
        import os
        os.makedirs(a[3], exist_ok=True)
        for i, chunk in enumerate(parts(a[1], int(a[2])), 1):
            open(os.path.join(a[3], "part%d" % i), "wb").write(chunk)
        print(i)
    elif cmd == "completejson":
        print(json.dumps({"Parts": [{"ETag": e, "PartNumber": i} for i, e in enumerate(a[1:], 1)]}))
    elif cmd == "slice":
        with open(a[1], "rb") as f:
            f.seek(int(a[2]))
            sys.stdout.buffer.write(f.read(int(a[3]) - int(a[2]) + 1))
    elif cmd == "png":
        def chunk(t, d):
            return struct.pack(">I", len(d)) + t + d + struct.pack(">I", zlib.crc32(t + d) & 0xFFFFFFFF)
        raw = b"\x00\xff\x00\x00"  # one filter byte + one RGB pixel
        data = (b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", struct.pack(">IIBBBBB", 1, 1, 8, 2, 0, 0, 0))
                + chunk(b"IDAT", zlib.compress(raw)) + chunk(b"IEND", b""))
        open(a[1], "wb").write(data)
    elif cmd == "jpeg":
        open(a[1], "wb").write(b"\xff\xd8\xff\xe0\x00\x10JFIF\x00\x01\x01\x00\x00\x01\x00\x01\x00\x00" + b"\x00" * 64 + b"\xff\xd9")
    elif cmd == "gif":
        open(a[1], "wb").write(b"GIF89a\x01\x00\x01\x00\x80\x00\x00\xff\xff\xff\x00\x00\x00!\xf9\x04\x01\x00\x00\x00\x00,\x00\x00\x00\x00\x01\x00\x01\x00\x00\x02\x02D\x01\x00;")
    elif cmd == "pdf":
        open(a[1], "wb").write(b"%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF\n")
    elif cmd == "html":
        open(a[1], "wb").write(b"<!DOCTYPE html><html><head><title>t</title></head><body>hello</body></html>\n")
    elif cmd == "selftest":
        ok = crc32c(b"123456789") == 0xE3069283 and crc64nvme(b"123456789") == 0xAE8B14860A799888
        print("ok" if ok else "bad")
        sys.exit(0 if ok else 1)
    else:
        sys.exit(__doc__)


if __name__ == "__main__":
    main()
