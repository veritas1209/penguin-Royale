#!/usr/bin/env python3
"""Copy the import closure of the actual combat engine for offline simulation."""
from pathlib import Path
import hashlib
import json
import shutil
import sys

HERE = Path(__file__).resolve().parent
SOURCE = Path(sys.argv[1]).resolve() if len(sys.argv)>1 else HERE.parent
RUNTIME = HERE / "runtime"
ENTRYPOINTS = [SOURCE / "server/game.js", SOURCE / "server/enemyCombat.js", SOURCE / "shared/catalog.ts"]
pending = ENTRYPOINTS[:]
seen = set()
external = set()

while pending:
    path = pending.pop().resolve()
    if path in seen:
        continue
    if not path.is_file() or SOURCE not in path.parents:
        raise RuntimeError(f"Invalid local import: {path}")
    seen.add(path)
    text = path.read_text(encoding="utf-8")
    specs = []
    for quote in ("'", '"'):
        specs.extend(part.split(quote, 1)[0] for part in text.split("from " + quote)[1:])
        specs.extend(part.split(quote, 1)[0] for part in text.split("import " + quote)[1:])
    for spec in specs:
        if spec.startswith("."):
            pending.append((path.parent / spec).resolve())
        else:
            external.add(spec)

if external - {"node:crypto"}:
    raise RuntimeError(f"Unexpected package dependencies: {sorted(external)}")

manifest = {}
for source in sorted(seen):
    relative = source.relative_to(SOURCE)
    destination = RUNTIME / relative
    destination.parent.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(source, destination)
    manifest[str(relative).replace("\\", "/")] = hashlib.sha256(destination.read_bytes()).hexdigest()

(RUNTIME / "package.json").write_text('{"type":"module"}\n', encoding="utf-8")
(HERE / "runtime-manifest.json").write_text(
    json.dumps({"files": manifest, "external": sorted(external)}, indent=2) + "\n",
    encoding="utf-8",
)
print(f"Copied {len(manifest)} original game modules; no network or database dependency.")
