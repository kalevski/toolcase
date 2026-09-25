import { CopyLine } from './_chrome'
import { AppIntro, CodeSection, FeatureGrid, SectionHead, SourceCard } from './_app'

const archDiagram = `HTTP API ──► zonewright ──► SQLite change log ◄──── sync (HTTPS + cluster key) ────► other zonewright servers
                 │
                 ├─ renders ──► zone_dir/<zone>.db, named.zones.conf   (atomic rename)
                 │   named-checkzone / named-checkconf gate every change
                 └─ rndc reload ──► named serves the zones on :53`

const quickStart = `docker run -d --name zonewright \\
  -p 53:53/udp -p 53:53/tcp -p 127.0.0.1:9053:9053 \\
  -e ZONEWRIGHT_TOKEN=change-me \\
  -v "$PWD/zonewright:/etc/zonewright:ro" \\
  -v zonewright-data:/var/lib/zonewright \\
  ghcr.io/kalevski/toolcase/zonewright:latest

# Create a zone, then add a record.
curl -H 'Authorization: Bearer change-me' -X POST localhost:9053/zones --data-binary @- <<'EOF'
zones:
  - name: example.com
    records:
      - {name: "@", type: A, value: 203.0.113.10}
      - {name: www, type: CNAME, value: "@"}
EOF
curl -H 'Authorization: Bearer change-me' -X POST localhost:9053/zones/example.com/records \\
  -d '{"name":"api","type":"A","value":"203.0.113.20","ttl":"5m"}'

dig @127.0.0.1 api.example.com +short`

const configExample = `# /etc/zonewright/config.yml
data_dir: /var/lib/zonewright     # zonewright.db (replicated store + node id), zone files
admin:
  listen: 127.0.0.1:9053          # "" disables the API
  token_env: ZONEWRIGHT_TOKEN     # or token_file (0600/0640)
  tls:                            # required for a non-loopback listen…
    cert_file: /etc/zonewright/api.crt
    key_file: /etc/zonewright/api.key
  # allow_insecure_http: true     # …unless explicitly opted out
bind:
  check_zone_cmd: [named-checkzone]
  check_conf_cmd: [named-checkconf]
  reload_cmd: [rndc, reload]
defaults:
  ttl: 1h
  nameservers: [ns1.example.net, ns2.example.net]
  soa: { admin_email: hostmaster@example.net, refresh: 1h, retry: 15m, expire: 2w, minimum: 5m }
  allow_transfer: []              # empty → none
include:
  - zones.d/*.yml                 # hand-written LOCAL zones — read-only over the API, never replicated`

const zoneExample = `zones:
  - name: example.com
    ttl: 30m
    nameservers: [ns1.example.com, ns2.example.com]
    records:
      - {name: "@",        type: A,     value: 203.0.113.10}
      - {name: "@",        type: AAAA,  value: "2001:db8::10"}
      - {name: www,        type: CNAME, value: "@"}
      - {name: "@",        type: MX,    value: mail, priority: 10}
      - {name: "@",        type: TXT,   value: "v=spf1 mx -all"}
      - {name: _sip._tcp,  type: SRV,   value: sip, priority: 10, weight: 5, port: 5060}
      - {name: "@",        type: CAA,   tag: issue, value: letsencrypt.org}
      - {name: "*.dev",    type: A,     value: 203.0.113.30, ttl: 5m}
      - {name: sub,        type: NS,    value: ns1.other-dns.net}   # delegation

# Types: A AAAA CNAME MX NS PTR SRV TXT CAA
# name: "@" = apex · "www" = relative · "www.example.com." = absolute
#       "www.example.com" (no trailing dot) is rejected as ambiguous`

const apiReference = `GET    /healthz                               liveness (no auth)
GET    /status                                per-zone state/serial + last apply
POST   /reload                                re-read config (same as SIGHUP)
GET    /zones                                 all zones: records, serial, state, source, etag
POST   /zones                                 create/replace one zone (YAML or JSON fragment)
GET    /zones/{zone}                          one zone + ETag
PUT    /zones/{zone}                          replace from a bare zone object
DELETE /zones/{zone}                          remove the zone everywhere
GET    /zones/{zone}/file                     rendered zone file, as named serves it
GET    /zones/{zone}/records?name=&type=      list records
POST   /zones/{zone}/records                  add one record (409 if identical exists)
PUT    /zones/{zone}/records/{name}/{type}    replace one RRset ([] empties it)
DELETE /zones/{zone}/records/{name}/{type}    delete the RRset (?value= for one value)
GET    /cluster/status                        node id, peers, lag, skew, alarms, conflicts
DELETE /cluster/peers/{id}                    retire a server removed for good

On every write:  If-Match: <etag> → 412 if stale
                 ?wait=replicated[&timeout=10s] → 200 once every peer has it, else 202
                 identical content → "unchanged", serial untouched
                 422 → BIND would reject it; nothing stored or replicated`

const recipes = `# Dynamic DNS: point home.example.com at a new IP
curl -X PUT localhost:9053/zones/example.com/records/home/A \\
  -d '{"records":[{"value":"198.51.100.7","ttl":60}]}'

# ACME DNS-01: publish on every nameserver before answering the CA, then remove
curl -X PUT 'localhost:9053/zones/example.com/records/_acme-challenge/TXT?wait=replicated' \\
  -d '{"records":[{"value":"gfj9Xq...Rg85nM","ttl":60}]}'
curl -X DELETE localhost:9053/zones/example.com/records/_acme-challenge/TXT`

const clusterExample = `# 1. One shared secret, identical everywhere (≥ 32 bytes)
openssl rand -hex 32        # → ZONEWRIGHT_CLUSTER_KEY

# 2. The SAME cluster block on every server — the URL list includes itself
cluster:
  key_env: ZONEWRIGHT_CLUSTER_KEY   # key_files: [new, old] during rotation
  listen: 0.0.0.0:9153
  tls: {cert_file: /etc/zonewright/peer.crt, key_file: /etc/zonewright/peer.key}
  # ca_file: …  or  fingerprint: sha256:…   # self-signed peer certs
  urls: [https://ns1.example.com:9153, https://ns2.example.com:9153]
  pull_interval: 5s                 # fallback; peers are nudged after every write
  max_clock_skew: 2m
  startup_fence: 30s
  retention: 30d

# 3. Register ns1/ns2 as glue records at your registrar; open 53/udp, 53/tcp, 9153.`

const replicationSnippet = `every write → a whole-RRset delta in the local SQLite op log, stamped (hlc, origin)
peers pull the deltas they haven't seen; applying one twice is a no-op

outage        → each side keeps serving and accepting writes, converges on reconnect
same RRset    → last writer wins, identically on every server
CNAME vs A    → repaired deterministically (newer wins), reported under conflicts
zone deleted  → generations keep a concurrent record write from resurrecting it
serials       → YYYYMMDDnn-based, never backwards, identical once synced
copied data dir → "clone detected" alarm, sync refused (delete it for a fresh id)

Why not Raft: with two nameservers a majority is both — one outage would freeze writes.`

const securitySnippet = `No token → loopback only; remote listen → HTTPS (or explicit allow_insecure_http)
Peers     → TLS + shared cluster key (constant-time compare); every op re-validated
Browsers  → any request with Origin / Sec-Fetch-* is 403 (CSRF); loopback Host check (rebinding)
Inputs    → strict grammars; TXT/CAA quoted + escaped; $INCLUDE / $GENERATE can't be injected
Requests  → 1 MiB body cap; header 5s / body 30s / response 3m timeouts
Container → named drops to named after :53, daemon runs as zonewright,
            rndc key regenerated on every start, authoritative-only with RRL + minimal-any`

const cliReference = `zonewright [run]              run the daemon (default)
zonewright validate           config + named-checkzone every zone in a temp dir
zonewright print-zone <zone>  rendered zone file
zonewright print-include      named.conf zone list + the include line
zonewright status [--json]    per-zone table (+ cluster view)
zonewright backup <file>      consistent online copy of zonewright.db
zonewright version

SIGHUP re-reads the config; an invalid one is rejected whole.`

const features = [
    {
        title: 'BIND stays BIND',
        body: 'zonewright writes ordinary master files and a zone {} list that named.conf includes. No dynamic updates, no journals — nothing to un-learn if you remove it.',
    },
    {
        title: 'Checked before live',
        body: 'Every write is pre-checked with named-checkzone; a change BIND would refuse is a 422 and is never stored. A zone that later fails keeps serving its previous file.',
    },
    {
        title: 'Multi-server replication',
        body: 'Run it on ns1 and ns2 and write to either. A SQLite delta log with last-writer-wins per RRset converges every server to the same records and the same serial.',
    },
    {
        title: 'Built for automation',
        body: 'ETags with If-Match, idempotent writes, RRset-level PUT/DELETE and ?wait=replicated make dynamic DNS and ACME DNS-01 one curl each.',
    },
]

export const ZoneWrightPage = () => {
    return (
        <main className="site-container">
            <AppIntro
                name="zonewright"
                eyebrow="App · Daemon · Go"
                lead="A small Go daemon that owns a set of authoritative zones for BIND 9 and manages them — and their records — over an HTTP API or YAML files. Run it on several servers and they synchronize with each other: your own ns1/ns2 nameservers. Sibling of nginxpilot, with the same last-known-good contract."
                chips={['Go', 'BIND 9', 'HTTP API', 'SQLite', 'multi-master', 'ACME DNS-01', 'Docker']}
                meta={[
                    { label: 'Language', value: 'Go 1.25' },
                    { label: 'Record types', value: '9' },
                    { label: 'Dependencies', value: '3' },
                    { label: 'License', value: 'MIT' },
                ]}
            />

            <CodeSection
                title="How it works"
                count="API → change log → named-checkzone → rndc reload"
                file="architecture"
                code={archDiagram}
            />
            <FeatureGrid features={features} />

            <CodeSection
                title="Quick start"
                count="named + daemon in one image"
                file="quickstart.sh"
                code={quickStart}
            />
            <CodeSection
                title="Configuration"
                count="YAML · strict · local vs replicated zones"
                file="config.yml"
                code={configExample}
            />
            <CodeSection
                title="Zones and records"
                count="A AAAA CNAME MX NS PTR SRV TXT CAA"
                file="zones.d/example.com.yml"
                code={zoneExample}
            />
            <CodeSection
                title="HTTP API"
                count="JSON · ETags · wait=replicated"
                file="api.txt"
                code={apiReference}
            />
            <CodeSection
                title="Recipes"
                count="dynamic DNS · ACME DNS-01"
                file="recipes.sh"
                code={recipes}
            />
            <CodeSection
                title="Running several servers"
                count="shared key · shared URL list · HTTPS peers"
                file="cluster.yml"
                code={clusterExample}
            />
            <CodeSection
                title="Replication model"
                count="delta log · last writer wins per RRset · always writable"
                file="replication.txt"
                code={replicationSnippet}
            />
            <CodeSection
                title="Security model"
                count="the API decides what a domain resolves to"
                file="security.txt"
                code={securitySnippet}
            />
            <CodeSection title="CLI" count="single binary" file="cli-reference.sh" code={cliReference} />

            <SectionHead title="Run it" count="Docker, or a host with BIND already installed" />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxWidth: 720 }}>
                <CopyLine cmd="docker pull ghcr.io/kalevski/toolcase/zonewright:latest" />
                <CopyLine cmd="zonewright validate && zonewright print-include" />
            </div>

            <SourceCard dir="zonewright" tagline="Go module, replication design, systemd unit, e2e cluster test" />
        </main>
    )
}
