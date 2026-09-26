"""Certbot DNS-01 authenticator for zonewright.

The plugin publishes the ``_acme-challenge`` TXT record through zonewright's
HTTP API (``POST /zones/{zone}/records?wait=replicated``), so the record is on
every zonewright server before certbot asks the CA to validate, then removes
exactly the value it added. Use it with an ``acme``-scoped zonewright token.
"""

__version__ = "0.1.0"
