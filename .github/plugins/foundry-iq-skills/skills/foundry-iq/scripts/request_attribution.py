"""Build request labels from the loaded skill metadata, independent of routing."""

from __future__ import annotations

import argparse
from pathlib import Path
import re


SKILL_ROOT = Path(__file__).resolve().parents[1]
VERSION_PREFIX = "foundry-iq-skill-v"
CONTEXT_PREFIXES = (
    VERSION_PREFIX,
    "foundry-iq-build/",
    "foundry-iq-workflow/",
    "foundry-iq-scenario/",
    "foundry-iq-operation/",
)
TEST_MARKER = "foundry-iq-test/v1"
LIVE_MARKER = "foundry-iq-skill-live-v1"
VERSION = re.compile(
    r"(?:0|[1-9][0-9]*)\.(?:0|[1-9][0-9]*)\.(?:0|[1-9][0-9]*)"
    r"(?:-[0-9A-Za-z]+(?:[.-][0-9A-Za-z]+)*)?"
    r"(?:\+[0-9A-Za-z]+(?:[.-][0-9A-Za-z]+)*)?"
)


class AttributionError(ValueError):
    """Request labels could not be resolved safely."""


def loaded_version(skill_root: Path) -> str:
    text = (skill_root / "SKILL.md").read_text(encoding="utf-8-sig")
    frontmatter = re.match(r"\A---\n(.*?)\n---(?:\n|$)", text, re.DOTALL)
    if frontmatter is None:
        raise AttributionError("The loaded skill needs YAML frontmatter.")
    metadata = re.findall(
        r"^metadata: *\n((?: +[^\n]*(?:\n|$)|\n)+)",
        frontmatter.group(1),
        re.MULTILINE,
    )
    if len(metadata) != 1:
        raise AttributionError("Resolve the version from one loaded metadata block.")
    versions = re.findall(r"^  version: *(.+?) *$", metadata[0], re.MULTILINE)
    if len(versions) != 1:
        raise AttributionError("Resolve one metadata.version from the loaded skill.")
    value = versions[0]
    if value.startswith(("'", '"')):
        if len(value) < 2 or value[-1] != value[0]:
            raise AttributionError("The loaded skill version has invalid quoting.")
        value = value[1:-1]
    if len(value) > 64 or VERSION.fullmatch(value) is None:
        raise AttributionError("The loaded skill version is not a supported version token.")
    return value


def build_user_agent(
    *,
    existing: str = "",
    test: bool = False,
    disabled: bool = False,
    skill_root: Path = SKILL_ROOT,
) -> str:
    if any(ord(char) < 32 or ord(char) > 126 for char in existing):
        raise AttributionError("The existing User-Agent must contain printable ASCII only.")
    previous = existing.split()
    identity = [
        token for token in previous
        if not token.startswith(CONTEXT_PREFIXES)
        and token not in (TEST_MARKER, LIVE_MARKER)
    ]
    if disabled:
        return " ".join(identity)

    version = loaded_version(skill_root)
    labels = [
        VERSION_PREFIX + version,
        "foundry-iq-build/" + ("source" if version == "0.0.0-placeholder" else "stamped"),
    ]
    if test or TEST_MARKER in previous:
        labels.append(TEST_MARKER)
    if LIVE_MARKER in previous:
        labels.append(LIVE_MARKER)
    return " ".join(identity + labels)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--existing-user-agent", default="", help="Preserve the HTTP client's identity.")
    parser.add_argument("--test", action="store_true", help="Mark an explicitly known test run.")
    parser.add_argument("--disabled", action="store_true", help="Remove skill labels and add none.")
    args = parser.parse_args()
    try:
        result = build_user_agent(
            existing=args.existing_user_agent,
            test=args.test,
            disabled=args.disabled,
        )
    except (OSError, UnicodeError, ValueError, KeyError, TypeError):
        parser.exit(2, "Request labels unavailable; omit them rather than guessing private or invalid values.\n")
    print(result)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
