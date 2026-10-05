"""pytest glue: fixtures and the plugin that turns test outcomes into the harness' @@RESULT lines."""
import os
import re
import sys

import pytest

import bvh

_STATUS = {"passed": "PASS", "failed": "FAIL", "skipped": "SKIP"}


def _case_id(nodeid):
    # test_objects.py::test_put_get[param]  ->  objects/put_get[param]
    mod, _, rest = nodeid.partition("::")
    mod = re.sub(r"^test_", "", os.path.basename(mod)[:-3] if mod.endswith(".py") else mod)
    rest = rest.replace("::", ".")
    rest = re.sub(r"(^|\.)test_", r"\1", rest)
    return "%s/%s" % (mod, rest)


def _detail(report):
    if report.skipped:
        lr = report.longrepr
        if isinstance(lr, tuple) and len(lr) == 3:
            return str(lr[2]).replace("Skipped: ", "")
        return str(lr)
    lr = report.longrepr
    crash = getattr(lr, "reprcrash", None)
    msg = crash.message if crash else str(lr)
    return " ".join(msg.split())[:600]


def pytest_runtest_logreport(report):
    # one result per test: the call phase, or setup/teardown when they fail or skip
    if report.when == "call" or (report.when == "setup" and not report.passed) or (report.when == "teardown" and report.failed):
        status = _STATUS.get(report.outcome, "FAIL")
        detail = _detail(report) if status != "PASS" else ""
        sys.stdout.write("\n@@RESULT\t%s\t%s\t%s\n" % (status, _case_id(report.nodeid), detail.replace("\t", " ").replace("\n", " ")))
        sys.stdout.flush()


def pytest_collection_modifyitems(config, items):
    # stable, readable order: by file name, then definition order (pytest's default within a file)
    items.sort(key=lambda it: it.fspath.basename)


# --------------------------------------------------------------------------------------------
# fixtures

@pytest.fixture(scope="session")
def admin():
    return bvh.ADMIN


@pytest.fixture(scope="session")
def plain():
    return bvh.suite_bucket("plain")


@pytest.fixture(scope="session")
def versioned():
    return bvh.suite_bucket("versioned")


@pytest.fixture(scope="session")
def public():
    return bvh.suite_bucket("public")


@pytest.fixture(scope="session")
def quota():
    return bvh.suite_bucket("quota")


@pytest.fixture(scope="session")
def ctype():
    return bvh.suite_bucket("ctype")


@pytest.fixture
def bk():
    """A brand-new plain bucket, isolated from every other test."""
    return bvh.fresh_bucket("t")


@pytest.fixture
def vbk():
    """A brand-new bucket with versioning enabled."""
    return bvh.fresh_bucket("v", versioning="enabled")


@pytest.fixture
def ebk():
    """A brand-new bucket with SSE-S3 default encryption."""
    return bvh.fresh_bucket("e", encryption="sse-s3")
