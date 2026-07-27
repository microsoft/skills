"""Validate Python syntax across skill files and Python fenced snippets.

This script checks:
1) Python files under .github/plugins/*/skills and .github/skills
2) Python code fences in SKILL.md files under those trees

It exits non-zero if any syntax error is found.
"""

from __future__ import annotations

import ast
import re
import sys
from pathlib import Path


PY_FENCE_RE = re.compile(r"```(?:python|py)\n(.*?)(?:\n```|\Z)", re.S)


def check_python_file(path: Path, repo_root: Path, errors: list[str]) -> int:
    content = path.read_text(encoding="utf-8")
    if path.name == "template.py" and "{{" in content:
        return 0  # skip template files with placeholder syntax
    try:
        ast.parse(content)
        return 1
    except SyntaxError as exc:
        rel = path.relative_to(repo_root).as_posix()
        line = exc.lineno or 0
        text = (exc.text or "").strip()
        errors.append(f"{rel}:{line}: {exc.msg} :: {text}")
        return 0


def check_markdown_fences(path: Path, repo_root: Path, errors: list[str]) -> int:
    text = path.read_text(encoding="utf-8")
    checked = 0

    for block_idx, match in enumerate(PY_FENCE_RE.finditer(text), 1):
        code = match.group(1)
        checked += 1
        try:
            ast.parse(code)
        except SyntaxError as exc:
            start_line = text[: match.start()].count("\n") + 1
            line_in_block = exc.lineno or 0
            approx_file_line = start_line + line_in_block
            rel = path.relative_to(repo_root).as_posix()
            snippet = (exc.text or "").strip()
            errors.append(
                f"{rel}:block {block_idx} (~L{approx_file_line}): {exc.msg} :: {snippet}"
            )

    return checked


def main() -> int:
    repo_root = Path(__file__).resolve().parents[2]
    roots = [repo_root / ".github" / "plugins", repo_root / ".github" / "skills"]

    errors: list[str] = []
    py_checked = 0
    fence_checked = 0

    for root in roots:
        if not root.exists():
            continue

        if root.name == "plugins":
            py_files = root.rglob("skills/**/*.py")
            md_files = root.rglob("skills/**/SKILL.md")
        else:
            py_files = root.rglob("**/*.py")
            md_files = root.rglob("**/SKILL.md")

        for py_path in py_files:
            py_checked += check_python_file(py_path, repo_root, errors)

        for md_path in md_files:
            fence_checked += check_markdown_fences(md_path, repo_root, errors)

    print(f"Checked Python files: {py_checked}")
    print(f"Checked Python code fences: {fence_checked}")

    if errors:
        print("\nPython syntax errors detected:")
        for err in errors:
            print(f"- {err}")
        return 1

    print("All checked Python files and snippets are syntactically valid.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
