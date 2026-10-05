"""Prometheus text exposition helpers: fetch /_metrics and parse it strictly (a malformed line is an AssertionError)."""
import re
import urllib.request

import bvh

IDENT = r"[a-zA-Z_:][a-zA-Z0-9_:]*"
SAMPLE = re.compile(r"^(%s)(?:\{(.*)\})?[ \t]+(\S+)(?:[ \t]+(-?[0-9]+))?$" % IDENT)
PAIR = re.compile(r'([a-zA-Z_][a-zA-Z0-9_]*)="((?:[^"\\]|\\.)*)"(,|$)')
SUFFIXES = ("_bucket", "_sum", "_count")


def _unescape(v):
    return re.sub(r"\\(.)", lambda m: "\n" if m.group(1) == "n" else m.group(1), v)


def parse_labels(raw, lineno):
    labels, pos = {}, 0
    raw = raw.strip()
    while pos < len(raw):
        m = PAIR.match(raw, pos)
        assert m, "line %d: bad label syntax at %r" % (lineno, raw[pos:pos + 40])
        assert m.group(1) not in labels, "line %d: label %s repeated" % (lineno, m.group(1))
        labels[m.group(1)] = _unescape(m.group(2))
        pos = m.end()
        while pos < len(raw) and raw[pos] == " ":
            pos += 1
    return labels


class Scrape:
    """A parsed exposition: .types {family: type}, .helps {family: text}, .samples [(name, labels, value)]."""

    def __init__(self, text):
        self.text = text
        self.types, self.helps, self.samples = {}, {}, []
        for no, line in enumerate(text.split("\n"), 1):
            if not line.strip():
                continue
            if line.startswith("#"):
                parts = line.split(" ", 3)
                if len(parts) >= 3 and parts[1] == "TYPE":
                    assert len(parts) == 4, "line %d: TYPE needs a type: %r" % (no, line)
                    assert parts[2] not in self.types, "line %d: TYPE of %s repeated" % (no, parts[2])
                    assert parts[3] in ("counter", "gauge", "histogram", "summary", "untyped"), "line %d: unknown type %r" % (no, parts[3])
                    self.types[parts[2]] = parts[3]
                elif len(parts) >= 3 and parts[1] == "HELP":
                    self.helps[parts[2]] = parts[3] if len(parts) == 4 else ""
                continue
            m = SAMPLE.match(line)
            assert m, "line %d is not a sample: %r" % (no, line[:120])
            name, rawlabels, value = m.group(1), m.group(2), m.group(3)
            try:
                v = float(value)
            except ValueError:
                raise AssertionError("line %d: %r is not a number" % (no, value))
            self.samples.append((name, parse_labels(rawlabels, no) if rawlabels else {}, v))

    def family(self, name):
        """The declared family a sample name belongs to (histogram samples carry _bucket/_sum/_count)."""
        if name in self.types:
            return name
        for suffix in SUFFIXES:
            if name.endswith(suffix) and self.types.get(name[:-len(suffix)]) in ("histogram", "summary"):
                return name[:-len(suffix)]
        return None

    def series(self, name, **labels):
        return [(l, v) for n, l, v in self.samples if n == name and all(l.get(k) == str(x) for k, x in labels.items())]

    def total(self, name, **labels):
        return sum(v for _, v in self.series(name, **labels))

    def has(self, name):
        return any(n == name for n, _, _ in self.samples)

    def label_values(self, name, label):
        return sorted({l[label] for n, l, _ in self.samples if n == name and label in l})


def fetch(admin_url, token, path="/_metrics", headers=None):
    req = urllib.request.Request(admin_url + path, headers=dict({"Authorization": "Bearer " + token}, **(headers or {})))
    with urllib.request.urlopen(req, timeout=30) as r:
        return r.status, r.headers, r.read().decode("utf-8")


def scrape(admin_url=bvh.ADMIN_URL, token=bvh.ADMIN_TOKEN):
    status, _, text = fetch(admin_url, token)
    assert status == 200
    return Scrape(text)


def scrape_node(node):
    return scrape(node.admin.url, node.token)
