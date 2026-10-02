import json
import os
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path


def bundle_root() -> Path:
    if hasattr(sys, "_MEIPASS"):
        return Path(sys._MEIPASS)
    return Path(__file__).resolve().parent


def validate_manifest_files(extension_dir: Path) -> None:
    manifest_path = extension_dir / "manifest.json"
    if not manifest_path.exists():
        raise SystemExit("Chrome extension manifest.json is missing.")

    manifest = json.loads(manifest_path.read_text(encoding="utf-8-sig"))
    required = []

    background = manifest.get("background") or {}
    service_worker = background.get("service_worker")
    if service_worker:
        required.append(service_worker)

    action = manifest.get("action") or {}
    default_popup = action.get("default_popup")
    if default_popup:
        required.append(default_popup)

    for item in manifest.get("content_scripts") or []:
        for script in item.get("js") or []:
            required.append(script)

    for resource in manifest.get("web_accessible_resources") or []:
        if isinstance(resource, str):
            required.append(resource)
        elif isinstance(resource, dict):
            for file_name in resource.get("resources") or []:
                required.append(file_name)

    required = [item for item in dict.fromkeys(required) if item]
    missing = [item for item in required if not (extension_dir / item).exists()]
    if missing:
        raise SystemExit(f"Manifest references missing runtime files: {', '.join(missing)}")


def main() -> int:
    if os.name != "nt":
        raise SystemExit("This installer must run on Windows.")

    bundle = bundle_root()
    target_root = Path(os.environ["LOCALAPPDATA"]) / "PenPOS" / "Luca Veri"
    target_extension = target_root / "chrome-extension"
    target_root.mkdir(parents=True, exist_ok=True)

    source_extension = bundle / "chrome-extension"
    source_install = bundle / "install.ps1"
    extraction_root = Path(tempfile.mkdtemp(prefix="PenPOSLucaInstaller-"))
    extraction_extension = extraction_root / "chrome-extension"

    try:
        if source_extension.exists():
            shutil.copytree(source_extension, extraction_extension)
            validate_manifest_files(extraction_extension)

        if source_install.exists():
            shutil.copy2(source_install, extraction_root / "install.ps1")

        install_script = extraction_root / "install.ps1"
        if not install_script.exists():
            raise SystemExit("Installer payload is missing install.ps1.")

        result = subprocess.run(
            [
                "powershell.exe",
                "-NoProfile",
                "-ExecutionPolicy",
                "Bypass",
                "-File",
                str(install_script),
            ],
            cwd=str(extraction_root),
            check=False,
        )
        return result.returncode
    finally:
        if extraction_root.exists():
            shutil.rmtree(extraction_root, ignore_errors=True)


if __name__ == "__main__":
    raise SystemExit(main())
