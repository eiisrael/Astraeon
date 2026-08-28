#!/usr/bin/env python3
"""Fail validation when tracked files look like they contain real secrets."""

from __future__ import annotations

from pathlib import Path
import re
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[1]

ALLOWED_ENV_FILES = {".env.example"}
TEXT_EXTENSIONS = {
    ".js", ".mjs", ".cjs", ".ts", ".tsx", ".json", ".html", ".css", ".md",
    ".txt", ".yml", ".yaml", ".toml", ".ini", ".cfg", ".conf", ".sql", ".py",
    ".sh", ".ps1", ".env", ".example"
}

PATTERNS = [
    ("Supabase secret key", re.compile(r"\bsb_secret_[A-Za-z0-9._-]{20,}\b")),
    ("GitHub token", re.compile(r"\b(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{30,}\b|\bgithub_pat_[A-Za-z0-9_]{50,}\b")),
    ("AWS access key", re.compile(r"\bAKIA[0-9A-Z]{16}\b")),
    ("Private key", re.compile(r"-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----")),
    ("Database URL with password", re.compile(r"(?i)\b(?:postgres(?:ql)?|mysql|mongodb(?:\+srv)?)://[^/\s:@]+:[^@\s/]+@")),
    ("Vercel token assignment", re.compile(r"(?i)\bVERCEL_TOKEN\s*[:=]\s*['\"]?(?!REPLACE|YOUR|EXAMPLE|<)[A-Za-z0-9._-]{20,}")),
    ("Service-role assignment", re.compile(r"(?i)\b(?:SUPABASE_)?SERVICE_ROLE(?:_KEY)?\s*[:=]\s*['\"]?(?!REPLACE|YOUR|EXAMPLE|<)[A-Za-z0-9._-]{20,}")),
    ("High-risk secret assignment", re.compile(r"(?i)\b(?:DATABASE_PASSWORD|DB_PASSWORD|JWT_SECRET|SESSION_SECRET|SECRET_KEY)\s*[:=]\s*['\"]?(?!REPLACE|YOUR|EXAMPLE|<|CHANGEME)[^\s'\"#]{12,}")),
]


def tracked_files() -> list[str]:
    try:
        result = subprocess.run(
            ["git", "ls-files", "-z"],
            cwd=ROOT,
            check=True,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
        )
        return [p for p in result.stdout.decode("utf-8").split("\0") if p]
    except Exception as exc:
        print(f"SECRET SCAN FAILED: não foi possível listar arquivos rastreados: {exc}")
        sys.exit(2)


def looks_text(path: Path) -> bool:
    if path.name in {"Dockerfile", "Procfile"}:
        return True
    if path.suffix.lower() in TEXT_EXTENSIONS:
        return True
    try:
        data = path.read_bytes()[:2048]
        return b"\0" not in data
    except OSError:
        return False


def main() -> int:
    errors: list[str] = []
    tracked = tracked_files()

    for rel in tracked:
        normalized = rel.replace("\\", "/")
        name = Path(normalized).name
        if (name == ".env" or name.startswith(".env.")) and normalized not in ALLOWED_ENV_FILES:
            errors.append(f"arquivo de ambiente real rastreado pelo Git: {normalized}")

    for rel in tracked:
        path = ROOT / rel
        if not path.is_file() or not looks_text(path):
            continue
        try:
            text = path.read_text(encoding="utf-8", errors="ignore")
        except OSError:
            continue
        for label, pattern in PATTERNS:
            match = pattern.search(text)
            if match:
                line = text.count("\n", 0, match.start()) + 1
                errors.append(f"{rel}:{line}: possível {label}")

    if errors:
        print("ASTRAEON SECRET SCAN FAILED")
        for error in sorted(set(errors)):
            print(" -", error)
        print("\nRemova/rotacione o segredo antes de fazer commit. Não basta adicioná-lo ao .gitignore depois que já foi versionado.")
        return 1

    print(f"ASTRAEON SECRET SCAN OK — {len(tracked)} arquivos rastreados verificados")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
