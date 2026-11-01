# Release guide

Distribution: `saman-api`. Import: `samanapi`. Initial version: `0.1.0`.
The package requires Python 3.10+ and a running Saman HTTP service 0.3+.
The Node service itself is not shipped inside the wheel.

## Verify locally

From the Python package directory:

```sh
python -m pip install -e . build twine pip-audit ruff mypy
python -m unittest discover -s tests -v
ruff check src --select E9,F63,F7,F82
mypy src/samanapi tests/typing_contract.py --check-untyped-defs --warn-unused-ignores
python tools/generate_async.py
python -m build
python -m twine check dist/*
```

The build produces a wheel and source archive in `dist/`. Install the wheel in
a fresh environment and run `saman-api --help`. The integration test requires
the Node source and its dependencies; install them from the repository root first.
Standalone SDK distributions skip that repository-only test, while mock transport
tests remain runnable. Audit the runtime environment with `pip-audit` before release.

Keep the version in `pyproject.toml`, `__init__.py` and the client's user-agent
aligned; regenerate the async client after editing the sync implementation.
Update CHANGELOG.md and docs/reference.md when changing public methods.
Use a new version for every PyPI release; PyPI files cannot be overwritten.

## Trusted Publishing

The repository includes `.github/workflows/publish.yml`, triggered manually from
the main branch. It tests the server and SDK, builds and checks distributions,
then publishes with PyPI's short-lived OIDC identity. No PyPI password or token
is stored in source. It does not run automatically on push.

Before the first publication, replace the GitHub owner and repository placeholders
with the repository you upload this source to. Then sign into your PyPI account, enable its required
account security and create a pending Trusted Publisher:

| Setting | Value |
| --- | --- |
| PyPI project | `saman-api` |
| GitHub owner | `DevURANIUM` |
| Repository | `saman-api` |
| Workflow filename | `publish.yml` |
| Environment | `pypi` |

Create the `pypi` GitHub environment, restrict deployment to main, and configure
required reviewers if desired. Then run the publish workflow for the reviewed
commit. Name availability is not a reservation and must be checked again at release.

For a first rehearsal, configure a separate publisher/environment on TestPyPI
and set the publish action's repository-url to `https://test.pypi.org/legacy/`.

See [PyPI's official Trusted Publishing guide](https://docs.pypi.org/trusted-publishers/using-a-publisher/).

## Contents and privacy

The wheel contains only the SDK, typing marker, package metadata and license.
The source archive additionally includes tests, examples, documentation and the
async generator. All examples use synthetic identifiers. Session directories,
bank captures, environment files, local paths, credentials and private keys must
never be added to either archive or the GitHub release.
