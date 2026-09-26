"""DNS Authenticator for zonewright."""

import logging
from typing import Any, Callable, Dict, Optional, Tuple
from urllib.parse import quote

import requests

from certbot import errors
from certbot.plugins import dns_common
from certbot.plugins.dns_common import CredentialsConfiguration

from certbot_dns_zonewright import __version__

logger = logging.getLogger(__name__)

DEFAULT_WAIT_TIMEOUT = 20
CHALLENGE_TTL = 60


class Authenticator(dns_common.DNSAuthenticator):
    """DNS Authenticator for zonewright.

    Publishes the DNS-01 TXT record through zonewright's HTTP API and waits
    until every zonewright server has it before certbot continues.
    """

    description = (
        "Obtain certificates using a DNS TXT record, if your domain's zone is "
        "managed by zonewright."
    )
    ttl = CHALLENGE_TTL

    def __init__(self, *args: Any, **kwargs: Any) -> None:
        super().__init__(*args, **kwargs)
        self.credentials: Optional[CredentialsConfiguration] = None
        self._client_instance: Optional["_ZonewrightClient"] = None

    @classmethod
    def add_parser_arguments(
        cls, add: Callable[..., None], default_propagation_seconds: int = 10
    ) -> None:
        super().add_parser_arguments(add, default_propagation_seconds)
        add("credentials", help="zonewright credentials INI file.")

    def more_info(self) -> str:
        return (
            "This plugin configures a DNS TXT record to respond to a dns-01 "
            "challenge using the zonewright HTTP API."
        )

    def _validate_credentials(self, credentials: CredentialsConfiguration) -> None:
        url = credentials.conf("url") or ""
        if not (url.startswith("https://") or url.startswith("http://")):
            raise errors.PluginError(
                f"{credentials.confobj.filename}: dns_zonewright_url must start "
                "with https:// (or http:// on a private network)"
            )
        timeout = credentials.conf("wait-timeout")
        if timeout:
            try:
                if int(timeout) <= 0:
                    raise ValueError
            except ValueError:
                raise errors.PluginError(
                    f"{credentials.confobj.filename}: dns_zonewright_wait_timeout "
                    "must be a positive number of seconds"
                )

    def _setup_credentials(self) -> None:
        self.credentials = self._configure_credentials(
            "credentials",
            "zonewright credentials INI file",
            {
                "url": "URL of the zonewright admin API, e.g. https://ns1.example.net:9053",
                "token": "zonewright API token (an acme-scoped token is enough)",
            },
            self._validate_credentials,
        )

    def _perform(self, domain: str, validation_name: str, validation: str) -> None:
        self._get_client().add_txt_record(validation_name, validation)

    def _cleanup(self, domain: str, validation_name: str, validation: str) -> None:
        self._get_client().del_txt_record(validation_name, validation)

    def _get_client(self) -> "_ZonewrightClient":
        if self._client_instance is None:
            if not self.credentials:  # pragma: no cover
                raise errors.Error("Plugin has not been prepared.")
            timeout = self.credentials.conf("wait-timeout")
            self._client_instance = _ZonewrightClient(
                url=self.credentials.conf("url"),
                token=self.credentials.conf("token"),
                ca_bundle=self.credentials.conf("ca-bundle") or None,
                wait_timeout=int(timeout) if timeout else DEFAULT_WAIT_TIMEOUT,
                ttl=self.ttl,
            )
        return self._client_instance


class _ZonewrightClient:
    """The few zonewright API calls a DNS-01 challenge needs."""

    def __init__(
        self,
        url: str,
        token: str,
        ca_bundle: Optional[str] = None,
        wait_timeout: int = DEFAULT_WAIT_TIMEOUT,
        ttl: int = CHALLENGE_TTL,
    ) -> None:
        self.base = url.rstrip("/")
        self.wait_timeout = wait_timeout
        self.ttl = ttl
        self.session = requests.Session()
        self.session.headers.update(
            {
                "Authorization": f"Bearer {token}",
                "User-Agent": f"certbot-dns-zonewright/{__version__}",
            }
        )
        self.session.verify = ca_bundle if ca_bundle else True
        self._zones: Dict[str, Tuple[str, str]] = {}

    def add_txt_record(self, record_name: str, record_content: str) -> None:
        zone, name = self._find_zone(record_name)
        resp = self._request(
            "POST",
            f"/zones/{quote(zone, safe='')}/records",
            params=self._wait_params(),
            json={"name": name, "type": "TXT", "value": record_content, "ttl": self.ttl},
        )
        if resp.status_code == 409:
            logger.debug("TXT record %s already holds this value", record_name)
            return
        if resp.status_code == 202:
            logger.warning(
                "zonewright stored the TXT record for %s, but not every server "
                "confirmed it within %ss (pending: %s); relying on the "
                "propagation delay",
                record_name,
                self.wait_timeout,
                ", ".join(_json(resp).get("pending_peers") or []) or "unknown",
            )
            return
        if resp.status_code not in (200, 201):
            raise errors.PluginError(
                f"Error adding TXT record {record_name}: {_describe(resp)}"
            )
        logger.debug("Added TXT record %s in zone %s", record_name, zone)

    def del_txt_record(self, record_name: str, record_content: str) -> None:
        try:
            zone, name = self._find_zone(record_name)
            resp = self._request(
                "DELETE",
                f"/zones/{quote(zone, safe='')}/records/{quote(name, safe='')}/TXT",
                params={"value": record_content, **self._wait_params()},
            )
        except errors.PluginError as exc:
            logger.warning("Could not remove TXT record %s: %s", record_name, exc)
            return
        if resp.status_code == 404:
            logger.debug("TXT record %s was already gone", record_name)
        elif resp.status_code not in (200, 202):
            logger.warning(
                "Could not remove TXT record %s: %s", record_name, _describe(resp)
            )

    def _find_zone(self, record_name: str) -> Tuple[str, str]:
        key = record_name.rstrip(".").lower()
        if key in self._zones:
            return self._zones[key]
        resp = self._request("GET", "/lookup", params={"name": key})
        if resp.status_code == 404:
            raise errors.PluginError(
                f"zonewright holds no zone for {key} that this token may change"
            )
        if resp.status_code != 200:
            raise errors.PluginError(f"Error looking up the zone for {key}: {_describe(resp)}")
        body = _json(resp)
        zone, name = body.get("zone"), body.get("name")
        if not zone or not name:
            raise errors.PluginError(f"Unexpected /lookup answer for {key}: {resp.text[:200]}")
        if body.get("writable") is False:
            raise errors.PluginError(
                f"Zone {zone} is declared in zonewright's config files (local) and "
                "cannot be changed over the API"
            )
        self._zones[key] = (zone, name)
        return zone, name

    def _wait_params(self) -> Dict[str, str]:
        return {"wait": "replicated", "timeout": f"{self.wait_timeout}s"}

    def _request(self, method: str, path: str, **kwargs: Any) -> requests.Response:
        try:
            return self.session.request(
                method, self.base + path, timeout=(10, self.wait_timeout + 30), **kwargs
            )
        except requests.RequestException as exc:
            raise errors.PluginError(f"Error contacting zonewright at {self.base}: {exc}")


def _json(resp: requests.Response) -> Dict[str, Any]:
    try:
        body = resp.json()
    except ValueError:
        return {}
    return body if isinstance(body, dict) else {}


def _describe(resp: requests.Response) -> str:
    message = _json(resp).get("error") or resp.text.strip()[:300] or resp.reason
    if resp.status_code == 401:
        return f"the token was rejected (401): {message}"
    if resp.status_code == 403:
        return f"the token is not allowed to do this (403): {message}"
    return f"HTTP {resp.status_code}: {message}"
