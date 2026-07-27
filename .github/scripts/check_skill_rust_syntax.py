"""Validate Rust syntax across skill files and Rust fenced snippets.

This script checks:
1) Rust files under .github/plugins/*/skills and .github/skills
2) Rust code fences in SKILL.md files under those trees

Validation uses `cargo check` and only fails on parser/lexer diagnostics.
Non-syntax compile errors (for example unresolved external crates in snippets)
are ignored because the goal is syntax validation.
"""

from __future__ import annotations

import json
import re
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path


RUST_FENCE_RE = re.compile(r"```(?:rust|rs)(?:,[^\n]*)?\n(.*?)\n```", re.S)
SYNTAX_PATTERNS = [
    "expected item",
    "expected one of",
    "expected expression",
    "expected identifier",
    "unexpected token",
    "unexpected closing delimiter",
    "unclosed delimiter",
    "mismatched closing delimiter",
    "unterminated",
    "unknown start of token",
    "character literal may only contain one codepoint",
]


def _cargo_ready() -> tuple[bool, str]:
    if shutil.which("cargo") is None:
        return (
            False,
            "cargo is not available on PATH. Install Rust first.",
        )

    probe = subprocess.run(
        ["cargo", "--version"],
        capture_output=True,
        text=True,
        check=False,
    )
    if probe.returncode == 0:
        return True, ""

    details = (probe.stderr or probe.stdout or "").strip()
    if "rustup could not choose a version of cargo" in details:
        return (
            False,
            "cargo is present but no default Rust toolchain is configured.",
        )

    return False, details or "cargo is not runnable in this environment."


def _is_syntax_error_text(text: str) -> bool:
    lower = text.lower()
    return any(pattern in lower for pattern in SYNTAX_PATTERNS)


def _extract_syntax_errors(stdout: str, stderr: str) -> list[str]:
    syntax_errors: list[str] = []

    for line in stdout.splitlines():
        line = line.strip()
        if not line:
            continue

        try:
            payload = json.loads(line)
        except json.JSONDecodeError:
            continue

        if payload.get("reason") != "compiler-message":
            continue

        message = payload.get("message", {})
        if message.get("level") != "error":
            continue

        rendered = (message.get("rendered") or message.get("message") or "").strip()
        # Parser/lexer diagnostics have no error code; include them unconditionally.
        # Named errors (E0001, etc.) are filtered to only known syntax patterns.
        code = message.get("code")
        if rendered and (code is None or _is_syntax_error_text(rendered)):
            syntax_errors.append(rendered)

    if syntax_errors:
        return syntax_errors

    # Fallback in case json diagnostics are unavailable.
    combined = (stderr or "") + "\n" + (stdout or "")
    for block in combined.split("\n\n"):
        snippet = block.strip()
        if snippet.startswith("error:") and _is_syntax_error_text(snippet):
            syntax_errors.append(snippet)

    return syntax_errors


def _run_cargo_check(source: str, wrap_in_main: bool) -> tuple[bool, list[str]]:
    with tempfile.TemporaryDirectory() as td:
        tmp = Path(td)
        src_dir = tmp / "src"
        src_dir.mkdir(parents=True, exist_ok=True)

        if wrap_in_main:
            indented = "\n".join(f"    {line}" if line else "" for line in source.splitlines())
            rust_source = f"fn main() {{\n{indented}\n}}\n"
            (src_dir / "main.rs").write_text(rust_source, encoding="utf-8")
        else:
            (src_dir / "lib.rs").write_text(source, encoding="utf-8")

        cargo_toml = (
            "[package]\n"
            "name = \"skill_syntax_check\"\n"
            "version = \"0.1.0\"\n"
            "edition = \"2021\"\n"
        )
        (tmp / "Cargo.toml").write_text(cargo_toml, encoding="utf-8")

        proc = subprocess.run(
            ["cargo", "check", "--quiet", "--message-format=json"],
            cwd=tmp,
            capture_output=True,
            text=True,
            check=False,
        )

        if proc.returncode == 0:
            return True, []

        syntax_errors = _extract_syntax_errors(proc.stdout, proc.stderr)
        return False, syntax_errors


def _validate_rust_source(source: str) -> tuple[bool, str]:
    ok, syntax_errors = _run_cargo_check(source, wrap_in_main=False)
    if ok:
        return True, ""

    # If there are no syntax diagnostics, treat compile failures as non-fatal for
    # this syntax-focused check (e.g., unresolved external crates).
    if not syntax_errors:
        return True, ""

    # Many doc snippets are statement-only blocks. Retry by wrapping in main.
    wrapped_ok, wrapped_syntax_errors = _run_cargo_check(source, wrap_in_main=True)
    if wrapped_ok or not wrapped_syntax_errors:
        return True, ""

    return False, "\n".join(wrapped_syntax_errors)


def check_rust_file(path: Path, repo_root: Path, errors: list[str]) -> int:
    source = path.read_text(encoding="utf-8")
    ok, err = _validate_rust_source(source)
    if ok:
        return 1

    rel = path.relative_to(repo_root).as_posix()
    errors.append(f"{rel}: {err}")
    return 0


def check_markdown_fences(path: Path, repo_root: Path, errors: list[str]) -> int:
    text = path.read_text(encoding="utf-8")
    checked = 0

    for block_idx, match in enumerate(RUST_FENCE_RE.finditer(text), 1):
        checked += 1
        code = match.group(1)
        ok, err = _validate_rust_source(code)
        if ok:
            continue

        start_line = text[: match.start()].count("\n") + 1
        rel = path.relative_to(repo_root).as_posix()
        errors.append(f"{rel}:block {block_idx} (~L{start_line}): {err}")

    return checked


def main() -> int:
    ready, reason = _cargo_ready()
    if not ready:
        print(reason)
        print(
            "Set up Rust tooling first, for example:\n"
            "  rustup toolchain install stable\n"
            "  rustup default stable"
        )
        return 2

    repo_root = Path(__file__).resolve().parents[2]
    roots = [repo_root / ".github" / "plugins", repo_root / ".github" / "skills"]

    errors: list[str] = []
    rs_checked = 0
    fence_checked = 0

    for root in roots:
        if not root.exists():
            continue

        if root.name == "plugins":
            rs_files = root.rglob("skills/**/*.rs")
            md_files = root.rglob("skills/**/SKILL.md")
        else:
            rs_files = root.rglob("**/*.rs")
            md_files = root.rglob("**/SKILL.md")

        for rs_path in rs_files:
            rs_checked += check_rust_file(rs_path, repo_root, errors)

        for md_path in md_files:
            fence_checked += check_markdown_fences(md_path, repo_root, errors)

    print(f"Checked Rust files: {rs_checked}")
    print(f"Checked Rust code fences: {fence_checked}")

    if errors:
        print("\nRust syntax errors detected:")
        for err in errors:
            print(f"- {err}")
        return 1

    print("All checked Rust files and snippets are syntactically valid.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
