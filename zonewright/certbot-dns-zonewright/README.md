# certbot-dns-zonewright

A [certbot](https://certbot.eff.org/) DNS-01 authenticator for [zonewright](../README.md). It publishes the `_acme-challenge` TXT record through zonewright's HTTP API, waits until **every** zonewright server has it (`?wait=replicated`), lets certbot finish the challenge, then removes exactly the value it added.

Because the record is confirmed on all nameservers before certbot continues, the propagation wait defaults to **10 seconds** instead of the usual minute or two. Wildcards and apex + wildcard in one certificate (two TXT values on one name) work.

## Install

```bash
pip install ./zonewright/certbot-dns-zonewright      # from a toolcase checkout
certbot plugins | grep -A2 dns-zonewright            # check certbot sees it
```

It must be installed into the **same Python environment as certbot**. For the snap or a distro package, install certbot with pip instead, or use a venv.

## Give it a scoped token

Don't hand the plugin zonewright's admin token. Give it an `acme`-scoped token, which may only run `GET /lookup` and write `_acme-challenge` TXT records in the zones it lists ([Scoped tokens](../README.md#scoped-tokens)). Create one over the API (replicated to every server, revocable at any time):

```bash
curl -H "Authorization: Bearer $ZONEWRIGHT_TOKEN" -X POST 'https://ns1.example.net:9053/tokens?wait=replicated' \
  -d '{"name":"web-01","scope":"acme","zones":["example.com"]}'
# the "token" field (zwt_…) is shown once — put it in the credentials file below
```

…or define it in zonewright's config:

```yaml
admin:
  token_env: ZONEWRIGHT_TOKEN
  scoped_tokens:
    - name: web-01
      token_env: ZW_ACME_WEB01
      scope: acme
      zones: [example.com]
```

## Credentials file

```ini
# /etc/letsencrypt/zonewright.ini  (chmod 600)
dns_zonewright_url = https://ns1.example.net:9053
dns_zonewright_token = <the acme-scoped token>
# dns_zonewright_ca_bundle = /etc/zonewright/api-ca.pem   # self-signed API certificate
# dns_zonewright_wait_timeout = 20                        # seconds to wait for every server (default 20)
# dns_zonewright_allow_insecure_http = true               # plain http:// to a non-loopback host (trusted network only)
```

| key | required | meaning |
| --- | --- | --- |
| `dns_zonewright_url` | yes | zonewright's admin API. `https://`; `http://` is accepted only to a loopback address, or with `dns_zonewright_allow_insecure_http = true` (or `DNS_ZONEWRIGHT_ALLOW_INSECURE_HTTP=1`) |
| `dns_zonewright_token` | yes | an `acme`-scoped token (the admin token works but is far more than needed) |
| `dns_zonewright_ca_bundle` | no | a PEM CA file to verify a self-signed API certificate |
| `dns_zonewright_wait_timeout` | no | how long zonewright may wait for every server to confirm (default 20 s). If a server lags past it, the plugin logs a warning and relies on the propagation delay. |

Talk to **one** zonewright server; it replicates to the others. Any server in the cluster accepts the write.

## Use

```bash
certbot certonly \
  --authenticator dns-zonewright \
  --dns-zonewright-credentials /etc/letsencrypt/zonewright.ini \
  -d example.com -d '*.example.com'
```

| flag | default | meaning |
| --- | --- | --- |
| `--dns-zonewright-credentials` | — | the INI file above |
| `--dns-zonewright-propagation-seconds` | `10` | extra wait after publishing, for resolvers between the CA and your nameservers |

Renewals (`certbot renew`) reuse the same settings from the renewal config.

### With nginxpilot

nginxpilot drives certbot with a stored credentials file per provider. It needs a version that selects DNS plugins with `--authenticator dns-<provider>`: older versions pass the `--dns-<provider>` shortcut, which certbot only defines for its bundled plugins and rejects as ambiguous for this one (`ambiguous option: --dns-zonewright could match …`).

1. Use the published nginxpilot image, which bundles this plugin. For a local build, pass it as a build context: `docker build --build-context certbot-dns-zonewright=zonewright/certbot-dns-zonewright -t nginxpilot nginxpilot` from the toolcase root. On a host install, `pip install ./zonewright/certbot-dns-zonewright` into certbot's environment. `certbot plugins` should list `dns-zonewright`, and nginxpilot's `GET /status` shows it under `acme.dns_providers`.
2. Store the credentials: `PUT /acme/credentials/zonewright[/<account>]` with `{"credentials": "<the INI above>"}`.
3. Allow DNS-01 (`acme.challenge: dns`, or `dns` in `acme.challenges`) and issue with `{"domains": [...], "challenge": "dns", "provider": "zonewright", "account": "<account>"}` on `POST /certs`.

`nginxpilot/test/e2e-acme-challenges.sh` runs exactly this, next to an HTTP-01 certificate on the same daemon.

## How it works

1. `GET /lookup?name=_acme-challenge.www.example.com` → `{"zone": "example.com", "name": "_acme-challenge.www"}`. That is the most specific zone the token may change. A zone declared in zonewright's config files (`writable: false`) is refused with a clear error.
2. `POST /zones/example.com/records?wait=replicated&timeout=20s` with `{"name": "_acme-challenge.www", "type": "TXT", "value": "<token>", "ttl": 60}`. It adds one value and never replaces the RRset, so concurrent challenges on one name don't clobber each other. A `409` (value already there) counts as success.
3. After validation: `DELETE /zones/example.com/records/_acme-challenge.www/TXT?value=<token>`, which removes only that value. Cleanup never fails the certbot run; problems are logged as warnings.

## Tests

```bash
pip install -e '.[test]' && pytest tests          # unit tests against a fake zonewright
```
