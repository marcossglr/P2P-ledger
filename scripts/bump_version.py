#!/usr/bin/env python3
"""
Herramienta de sincronización y validación de versión unificada para P2P Ledger.
Actualiza atómicamente:
- frontend/package.json
- frontend/src-tauri/tauri.conf.json
- frontend/src-tauri/Cargo.toml
"""

import sys
import re
import json
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parent.parent
PACKAGE_JSON = ROOT_DIR / "package.json"
TAURI_CONF = ROOT_DIR / "src-tauri" / "tauri.conf.json"
CARGO_TOML = ROOT_DIR / "src-tauri" / "Cargo.toml"

SEMVER_REGEX = r"^\d+\.\d+\.\d+(-[a-zA-Z0-9.]+)?$"


def get_current_versions() -> dict:
    versions = {}

    if PACKAGE_JSON.exists():
        data = json.loads(PACKAGE_JSON.read_text(encoding="utf-8"))
        versions["package.json"] = data.get("version")

    if TAURI_CONF.exists():
        data = json.loads(TAURI_CONF.read_text(encoding="utf-8"))
        versions["tauri.conf.json"] = data.get("version") or data.get("package", {}).get("version")

    if CARGO_TOML.exists():
        content = CARGO_TOML.read_text(encoding="utf-8")
        match = re.search(r'^version\s*=\s*["\']([^"\']+)["\']', content, re.MULTILINE)
        if match:
            versions["src-tauri/Cargo.toml"] = match.group(1)

    return versions


def set_version(new_version: str):
    if not re.match(SEMVER_REGEX, new_version):
        print(f"Error: '{new_version}' no cumple con el formato SemVer (ej. 0.3.10 o 0.4.0)")
        sys.exit(1)

    print(f"Actualizando versión de proyecto a: {new_version}")

    # 1. package.json
    if PACKAGE_JSON.exists():
        data = json.loads(PACKAGE_JSON.read_text(encoding="utf-8"))
        data["version"] = new_version
        PACKAGE_JSON.write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")
        print(f" ✓ {PACKAGE_JSON.relative_to(ROOT_DIR)}")

    # 2. tauri.conf.json
    if TAURI_CONF.exists():
        data = json.loads(TAURI_CONF.read_text(encoding="utf-8"))
        if "version" in data:
            data["version"] = new_version
        elif "package" in data and isinstance(data["package"], dict):
            data["package"]["version"] = new_version
        TAURI_CONF.write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")
        print(f" ✓ {TAURI_CONF.relative_to(ROOT_DIR)}")

    # 3. Cargo.toml
    if CARGO_TOML.exists():
        content = CARGO_TOML.read_text(encoding="utf-8")
        updated = re.sub(
            r'^version\s*=\s*["\'][^"\']+["\']',
            f'version = "{new_version}"',
            content,
            count=1,
            flags=re.MULTILINE,
        )
        CARGO_TOML.write_text(updated, encoding="utf-8")
        print(f" ✓ {CARGO_TOML.relative_to(ROOT_DIR)}")

    print(f"\nSincronización completa: v{new_version}")


def main():
    if len(sys.argv) < 2:
        print("Versiones actuales detectadas:")
        for file_path, ver in get_current_versions().items():
            print(f"  • {file_path}: {ver}")
        print("\nUso: python scripts/bump_version.py <NUEVA_VERSION>")
        print("Ejemplo: python scripts/bump_version.py 0.4.0")
        return

    set_version(sys.argv[1].lstrip("v"))


if __name__ == "__main__":
    main()
