"""Audit the installed SDK's active dependency closure, excluding build tools."""

from importlib.metadata import requires, version
from pathlib import Path
import subprocess
import sys
import tempfile
from packaging.requirements import Requirement

names: set[str] = set()


def visit(name: str) -> None:
    if name.lower() in names:
        return
    names.add(name.lower())
    for value in requires(name) or []:
        requirement = Requirement(value)
        if requirement.marker is None or requirement.marker.evaluate({"extra": ""}):
            visit(requirement.name)


visit("httpx")
with tempfile.TemporaryDirectory() as directory:
    requirements = Path(directory) / "runtime.txt"
    requirements.write_text(
        "".join(f"{name}=={version(name)}\n" for name in sorted(names)),
        encoding="utf-8",
    )
    sys.exit(
        subprocess.call(
            [
                sys.executable,
                "-m",
                "pip_audit",
                "--no-deps",
                "--disable-pip",
                "-r",
                str(requirements),
            ]
        )
    )
