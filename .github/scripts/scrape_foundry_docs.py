#!/usr/bin/env python3
"""
Scraper for Microsoft Foundry documentation to generate llms.txt

This script:
1. Fetches the TOC from Microsoft Learn
2. Extracts all documentation URLs
3. Fetches content for each page
4. Generates llms.txt and llms-full.txt files

Usage:
    python .github/scripts/scrape_foundry_docs.py
"""

import json
import asyncio
import re
from pathlib import Path
from dataclasses import dataclass, field
from typing import Optional
from urllib.parse import urljoin
from urllib.request import Request, urlopen
import time

try:
    import aiohttp
    HAS_AIOHTTP = True
except ImportError:
    HAS_AIOHTTP = False

# Base URLs
BASE_URL = "https://learn.microsoft.com/en-us/azure/foundry/"
TOC_URL = "https://learn.microsoft.com/en-us/azure/foundry/toc.json"
VIEW_PARAM = ""

# Output paths
OUTPUT_DIR = Path(__file__).parent.parent.parent / "docs"
LLMS_TXT_PATH = OUTPUT_DIR / "llms.txt"
LLMS_FULL_TXT_PATH = OUTPUT_DIR / "llms-full.txt"


@dataclass
class DocPage:
    """Represents a documentation page."""

    title: str
    href: str
    url: str
    section: str
    content: str = ""
    summary: str = ""


@dataclass
class DocSection:
    """Represents a documentation section."""

    title: str
    pages: list[DocPage] = field(default_factory=list)


def normalize_url(href: str, base_path: str = BASE_URL) -> str:
    """Convert relative href to full URL."""
    if href.startswith("http"):
        return href

    if href.startswith("/"):
        # Absolute path within learn.microsoft.com
        url = f"https://learn.microsoft.com{href}"
    elif href.startswith(".."):
        # Relative path going up
        url = urljoin(base_path, href)
    else:
        # Relative path within foundry docs
        url = f"{base_path}{href}"

    return url


def extract_pages_from_toc(
    toc_data: dict, section_name: str = "Root"
) -> list[tuple[str, str, str]]:
    """
    Recursively extract all pages from TOC structure.
    Returns list of (title, href, section) tuples.
    """
    pages = []

    items = toc_data.get("items", [])
    if not items and isinstance(toc_data, list):
        items = toc_data

    for item in items:
        title = item.get("toc_title", "Untitled")
        href = item.get("href", "")

        # Get current section name
        current_section = item.get("toc_title", section_name)

        # Add page if it has an href and is within ai-foundry docs
        if (
            href
            and not href.startswith("http")
            and not href.startswith("/azure/ai-services")
        ):
            # Skip external links and ai-services cross-references for now
            if not href.startswith("../"):
                pages.append((title, href, section_name))

        # Recursively process children
        children = item.get("children", [])
        if children:
            pages.extend(extract_pages_from_toc({"items": children}, current_section))

    return pages


def organize_into_sections(
    pages: list[tuple[str, str, str]],
) -> dict[str, list[tuple[str, str]]]:
    """Organize pages into sections based on their path prefix."""
    sections = {}

    # Define section mappings based on URL path
    section_mappings = {
        "what-is": "Overview",
        "quickstarts": "Getting Started",
        "tutorials": "Tutorials",
        "agents": "Agent Development",
        "foundry-models": "Foundry Models",
        "openai": "Azure OpenAI",
        "how-to": "How-To Guides",
        "concepts": "Concepts",
        "reference": "Reference",
        "responsible-ai": "Responsible AI",
        "observability": "Observability & Evaluation",
        "control-plane": "Control Plane",
        "guardrails": "Guardrails & Safety",
        "configuration": "Configuration",
        "fine-tuning": "Fine-tuning",
        "mcp": "Model Context Protocol",
    }

    for title, href, parent_section in pages:
        # Determine section from href path
        path_parts = href.split("/")
        section = "General"

        for prefix, sec_name in section_mappings.items():
            if href.startswith(prefix) or (
                len(path_parts) > 0 and path_parts[0] == prefix
            ):
                section = sec_name
                break

        if section not in sections:
            sections[section] = []
        sections[section].append((title, href))

    return sections


async def fetch_page_content(
    session: "aiohttp.ClientSession", url: str, semaphore: "asyncio.Semaphore"
) -> str:
    """Fetch page content from Microsoft Learn API (markdown endpoint)."""
    async with semaphore:
        try:
            # Use the regular URL and parse HTML
            headers = {"User-Agent": "Mozilla/5.0 (compatible; LLMsTxtGenerator/1.0)"}

            async with session.get(url, headers=headers, timeout=30) as response:
                if response.status == 200:
                    return await response.text()
                else:
                    print(f"  Warning: {url} returned {response.status}")
                    return ""
        except Exception as e:
            print(f"  Error fetching {url}: {e}")
            return ""


def extract_summary_from_html(html_content: str) -> str:
    """Extract a brief summary from HTML content."""
    # Try to find meta description
    meta_match = re.search(
        r'<meta\s+name="description"\s+content="([^"]+)"', html_content, re.IGNORECASE
    )
    if meta_match:
        return meta_match.group(1)

    # Try to find first paragraph
    p_match = re.search(r"<p[^>]*>([^<]+)</p>", html_content)
    if p_match:
        return (
            p_match.group(1)[:200] + "..."
            if len(p_match.group(1)) > 200
            else p_match.group(1)
        )

    return ""


def generate_llms_txt(
    sections: dict[str, list[tuple[str, str]]], include_summaries: bool = False
) -> str:
    """Generate llms.txt content following the specification."""
    lines = []

    # Header
    lines.append("# Microsoft Foundry")
    lines.append("")
    lines.append(
        "> Microsoft Foundry (formerly Azure AI Foundry) is a unified Azure platform-as-a-service for enterprise AI operations, model builders, and application development. It provides a comprehensive set of AI capabilities for building agents, deploying models, and developing generative AI applications with built-in enterprise-readiness including tracing, monitoring, evaluations, and safety controls."
    )
    lines.append("")

    # Important notes
    lines.append("Important information:")
    lines.append("")
    lines.append(
        "- Microsoft Foundry unifies agents, models, and tools under a single management grouping"
    )
    lines.append(
        "- The platform supports two portal versions: Foundry (classic) and Foundry (new)"
    )
    lines.append(
        "- Foundry projects are the recommended project type for building agents and working with models"
    )
    lines.append(
        "- The Foundry SDK is available for Python, C#, JavaScript/TypeScript, and Java"
    )
    lines.append("")

    # Define section order
    section_order = [
        "Overview",
        "Getting Started",
        "Tutorials",
        "Concepts",
        "Agent Development",
        "Foundry Models",
        "Azure OpenAI",
        "How-To Guides",
        "Observability & Evaluation",
        "Fine-tuning",
        "Model Context Protocol",
        "Control Plane",
        "Guardrails & Safety",
        "Configuration",
        "Responsible AI",
        "Reference",
        "General",
    ]

    # Add sections in order
    for section_name in section_order:
        if section_name not in sections:
            continue

        pages = sections[section_name]
        if not pages:
            continue

        lines.append(f"## {section_name}")
        lines.append("")

        for title, href in pages:
            url = normalize_url(href)
            lines.append(f"- [{title}]({url})")

        lines.append("")

    # Optional section for less critical content
    lines.append("## Optional")
    lines.append("")
    lines.append(
        "- [Azure Security Baseline](https://learn.microsoft.com/en-us/security/benchmark/azure/baselines/azure-ai-foundry-security-baseline): Security baseline guidance for Azure AI Foundry"
    )
    lines.append(
        "- [Azure Compliance](https://aka.ms/AzureCompliance): Azure compliance documentation"
    )
    lines.append(
        "- [SLA for Online Services](https://www.microsoft.com/licensing/docs/view/Service-Level-Agreements-SLA-for-Online-Services): Service Level Agreement details"
    )
    lines.append("")

    return "\n".join(lines)


def main():
    """Main function to scrape docs and generate llms.txt."""
    print("=" * 60)
    print("Microsoft Foundry Documentation Scraper")
    print("=" * 60)

    # Ensure output directory exists
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    # Fetch TOC
    print("\n[1/4] Fetching Table of Contents...")
    headers = {"User-Agent": "Mozilla/5.0 (compatible; LLMsTxtGenerator/1.0)"}
    req = Request(TOC_URL, headers=headers)
    with urlopen(req, timeout=30) as resp:
        if resp.status != 200:
            print(f"Error: Failed to fetch TOC (status {resp.status})")
            return
        toc_data = json.loads(resp.read())

    # Extract pages
    print("[2/4] Extracting page URLs...")
    pages = extract_pages_from_toc(toc_data)
    print(f"  Found {len(pages)} documentation pages")

    # Organize into sections
    print("[3/4] Organizing pages into sections...")
    sections = organize_into_sections(pages)
    for section, section_pages in sections.items():
        print(f"  - {section}: {len(section_pages)} pages")

    # Generate llms.txt
    print("[4/4] Generating llms.txt...")
    llms_content = generate_llms_txt(sections)

    # Write output
    LLMS_TXT_PATH.write_text(llms_content)
    print(f"\nGenerated: {LLMS_TXT_PATH}")
    print(f"  Total lines: {len(llms_content.splitlines())}")
    print(f"  File size: {len(llms_content):,} bytes")

    # Also generate a JSON manifest for later use
    manifest = {
        "title": "Microsoft Foundry",
        "base_url": BASE_URL,
        "sections": {
            section: [
                {"title": t, "href": h, "url": normalize_url(h)} for t, h in pages
            ]
            for section, pages in sections.items()
        },
        "total_pages": len(pages),
        "generated_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
    }

    manifest_path = OUTPUT_DIR / "foundry-docs-manifest.json"
    manifest_path.write_text(json.dumps(manifest, indent=2))
    print(f"Generated: {manifest_path}")

    print("\n" + "=" * 60)
    print("Done!")
    print("=" * 60)


if __name__ == "__main__":
    main()
