#!/usr/bin/env python3
"""Local-tree helpers for the rclone and mc suites (portable replacements for stat/md5sum/find flags).

  treeutil.py manifest DIR            'size;relative/path' for every file (unsorted; callers LC_ALL=C sort)
  treeutil.py md5list DIR             'md5  relative/path'
  treeutil.py sha1list DIR            'sha1  relative/path'
  treeutil.py toplevel DIR            entries of DIR, directories with a trailing '/'
  treeutil.py count DIR               number of files
  treeutil.py bytes DIR               sum of file sizes
  treeutil.py mtime FILE              mtime as epoch seconds (float)
  treeutil.py setmtime FILE EPOCH     set atime+mtime
  treeutil.py rewrite FILE SIZE [KEEP_MTIME]   overwrite FILE with SIZE random bytes (mtime restored when KEEP_MTIME=1)
  treeutil.py mkbucket NAME [SETTINGS_JSON]    create bucket+token through the admin API; prints 'AK SK'
  treeutil.py json-get FILE.json PATH          print a field of a JSON document (dotted path, [n] indexes)
  treeutil.py png FILE [WIDTH HEIGHT]          write a small valid PNG
  treeutil.py gen DIR                 create the standard test tree under DIR (see below)
"""
import hashlib
import json
import os
import re
import sys
import urllib.error
import urllib.request


def files(root):
    for dp, dn, fn in os.walk(root):
        dn.sort()
        for f in sorted(fn):
            p = os.path.join(dp, f)
            yield os.path.relpath(p, root).replace(os.sep, "/"), p


def digest(path, algo):
    h = hashlib.new(algo)
    with open(path, "rb") as f:
        for b in iter(lambda: f.read(1 << 20), b""):
            h.update(b)
    return h.hexdigest()


def png(path, w=8, h=8):
    import struct
    import zlib

    def chunk(t, d):
        c = struct.pack(">I", len(d)) + t + d
        return c + struct.pack(">I", zlib.crc32(t + d) & 0xFFFFFFFF)

    raw = b"".join(b"\x00" + bytes((x * 31 + y * 17) % 256 for x in range(w * 3)) for y in range(h))
    data = b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", struct.pack(">IIBBBBB", w, h, 8, 2, 0, 0, 0)) + chunk(b"IDAT", zlib.compress(raw)) + chunk(b"IEND", b"")
    open(path, "wb").write(data)


def gen(root):
    """The standard tree: nested dirs, empty file, 3 MiB file, awkward names, 300 small files."""
    def w(rel, data):
        p = os.path.join(root, rel)
        os.makedirs(os.path.dirname(p), exist_ok=True)
        open(p, "wb").write(data)

    w("one.txt", b"one\n")
    w("empty.bin", b"")
    w("big.bin", os.urandom(3 * 1024 * 1024))
    w("a/b/c/deep.txt", b"deep\n")
    w("with space/file name.txt", b"space\n")
    w("plus+dir/a+b.txt", b"plus\n")
    w("pct%dir/100%.txt", b"percent\n")
    w("ключ/данные.txt", "кириллица\n".encode())
    w("日本語/テスト.txt", "日本語\n".encode())
    w(".hidden", b"dot\n")
    w("long-" + "n" * 190 + ".txt", b"long name\n")
    for i in range(300):
        w("many/f%03d.txt" % i, ("file %d\n" % i).encode())


def main(a):
    cmd = a[0]
    if cmd == "manifest":
        for rel, p in files(a[1]):
            print("%d;%s" % (os.path.getsize(p), rel))
    elif cmd == "md5list":
        for rel, p in files(a[1]):
            print("%s  %s" % (digest(p, "md5"), rel))
    elif cmd == "sha1list":
        for rel, p in files(a[1]):
            print("%s  %s" % (digest(p, "sha1"), rel))
    elif cmd == "toplevel":
        for e in sorted(os.listdir(a[1])):
            print(e + ("/" if os.path.isdir(os.path.join(a[1], e)) else ""))
    elif cmd == "count":
        print(sum(1 for _ in files(a[1])))
    elif cmd == "bytes":
        print(sum(os.path.getsize(p) for _, p in files(a[1])))
    elif cmd == "mtime":
        print("%.6f" % os.path.getmtime(a[1]))
    elif cmd == "setmtime":
        t = float(a[2])
        os.utime(a[1], (t, t))
    elif cmd == "rewrite":
        st = os.stat(a[1])
        open(a[1], "wb").write(os.urandom(int(a[2])))
        if len(a) > 3 and a[3] == "1":
            os.utime(a[1], (st.st_atime, st.st_mtime))
    elif cmd == "mkbucket":
        name = a[1]
        settings = json.loads(a[2]) if len(a) > 2 else {}
        url, tok = os.environ["BV_ADMIN_URL"], os.environ["BV_ADMIN_TOKEN"]

        def call(method, path, body):
            req = urllib.request.Request(url + "/_admin/v1" + path, data=json.dumps(body).encode(), method=method,
                                         headers={"Authorization": "Bearer " + tok, "Content-Type": "application/json"})
            try:
                with urllib.request.urlopen(req, timeout=30) as r:
                    return r.status, json.loads(r.read() or b"null")
            except urllib.error.HTTPError as e:
                return e.code, json.loads(e.read() or b"null")

        st, _ = call("POST", "/buckets", dict(settings, name=name))
        if st == 409:
            st, _ = call("PUT", "/buckets/" + name, settings)
        if st >= 300:
            sys.exit("mkbucket %s: HTTP %d" % (name, st))
        st, t = call("POST", "/buckets/%s/tokens" % name,
                     {"name": "f5", "grants": [{"actions": ["read", "write", "list", "delete", "purge", "tag"]}]})
        if st != 201:
            sys.exit("token for %s: HTTP %d %s" % (name, st, t))
        print(t["access_key_id"], t["secret_access_key"])
    elif cmd == "json-get":
        v = json.load(open(a[1]))
        for part in re.findall(r"[^.\[\]]+|\[\d+\]", a[2]):
            v = v[int(part[1:-1])] if part.startswith("[") else v[part]
        print(v if not isinstance(v, (dict, list)) else json.dumps(v))
    elif cmd == "png":
        png(a[1], *(int(x) for x in a[2:4]))
    elif cmd == "gen":
        gen(a[1])
    else:
        sys.exit(__doc__)


if __name__ == "__main__":
    main(sys.argv[1:])
