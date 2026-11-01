"""Verify generated async code by AST, across Python's formatting differences."""

import ast
from pathlib import Path
import subprocess
import sys

root = Path(__file__).resolve().parents[1]
module = root / "src/samanapi/async_client.py"
original = module.read_text(encoding="utf-8")
try:
    subprocess.run([sys.executable, str(root / "tools/generate_async.py")], check=True)
    expected = ast.dump(
        ast.parse(module.read_text(encoding="utf-8")), include_attributes=False
    )
    actual = ast.dump(ast.parse(original), include_attributes=False)
    if expected != actual:
        raise SystemExit(
            "Generated async module is out of date. Run tools/generate_async.py."
        )
    print("Generated async module matches the synchronous contract.")
finally:
    module.write_text(original, encoding="utf-8")
