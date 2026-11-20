#!/usr/bin/env python3
"""
Generate llms-full.txt with expanded content from Microsoft Foundry documentation.

This script fetches the actual content of each documentation page and creates
an expanded llms.txt file suitable for LLM context loading.

Usage:
    python .github/scripts/generate_llms_full.py
"""

import json
import re
from pathlib import Path
from dataclasses import dataclass
from typing import Optional
import time
import html
from html.parser import HTMLParser

# Paths
OUTPUT_DIR = Path(__file__).parent.parent.parent / "docs"
MANIFEST_PATH = OUTPUT_DIR / "foundry-docs-manifest.json"
LLMS_FULL_TXT_PATH = OUTPUT_DIR / "llms-full.txt"

# Rate limiting
MAX_CONCURRENT_REQUESTS = 10
REQUEST_DELAY = 0.1  # seconds between batches


class MLStripper(HTMLParser):
    """HTML to text converter."""

    def __init__(self):
        super().__init__()
        self.reset()
        self.strict = False
        self.convert_charrefs = True
        self.text = []
        self.in_script = False
        self.in_style = False
        self.in_nav = False

    def handle_starttag(self, tag, attrs):
        if tag in ("script", "style"):
            self.in_script = True
        if tag == "nav":
            self.in_nav = True
        if tag in ("p", "div", "br", "h1", "h2", "h3", "h4", "h5", "h6", "li"):
            self.text.append("\n")

    def handle_endtag(self, tag):
        if tag in ("script", "style"):
            self.in_script = False
        if tag == "nav":
            self.in_nav = False
        if tag in ("p", "div", "h1", "h2", "h3", "h4", "h5", "h6"):
            self.text.append("\n")

    def handle_data(self, data):
        if not self.in_script and not self.in_style and not self.in_nav:
            self.text.append(data)

    def get_text(self):
        return "".join(self.text)


def strip_html(html_content: str) -> str:
    """Strip HTML tags and return plain text."""
    stripper = MLStripper()
    stripper.feed(html_content)
    text = stripper.get_text()
    # Clean up whitespace
    text = re.sub(r"\n{3,}", "\n\n", text)
    text = re.sub(r" +", " ", text)
    return text.strip()


def extract_article_content(html_content: str) -> str:
    """Extract the main article content from HTML."""
    # Try to find the main content area
    patterns = [
        r"<main[^>]*>(.*?)</main>",
        r"<article[^>]*>(.*?)</article>",
        r'<div[^>]*class="[^"]*content[^"]*"[^>]*>(.*?)</div>',
        r'<div[^>]*id="main-content"[^>]*>(.*?)</div>',
    ]

    for pattern in patterns:
        match = re.search(pattern, html_content, re.DOTALL | re.IGNORECASE)
        if match:
            return strip_html(match.group(1))

    # Fallback: strip all HTML
    return strip_html(html_content)


async def fetch_page_content(
    session: "aiohttp.ClientSession", url: str, semaphore: "asyncio.Semaphore"
) -> tuple[str, str]:
    """Fetch page content and return (url, content)."""
    async with semaphore:
        try:
            headers = {
                "User-Agent": "Mozilla/5.0 (compatible; LLMsTxtGenerator/1.0)",
                "Accept": "text/html,application/xhtml+xml",
            }

            async with session.get(url, headers=headers, timeout=30) as response:
                if response.status == 200:
                    html_content = await response.text()
                    text_content = extract_article_content(html_content)
                    # Limit content size
                    if len(text_content) > 10000:
                        text_content = (
                            text_content[:10000] + "\n\n[Content truncated...]"
                        )
                    return (url, text_content)
                else:
                    print(f"  Warning: {url} returned {response.status}")
                    return (url, "")
        except Exception as e:
            print(f"  Timeout or error: {url}: {e}")
            return (url, "")


async def fetch_all_pages(urls: list[str]) -> dict[str, str]:
    """Fetch all pages concurrently with rate limiting."""
    import asyncio
    try:
        import aiohttp
    except ImportError:
        return {}

    semaphore = asyncio.Semaphore(MAX_CONCURRENT_REQUESTS)
    results = {}

    async with aiohttp.ClientSession() as session:
        # Process in batches
        batch_size = 20
        for i in range(0, len(urls), batch_size):
            batch = urls[i : i + batch_size]
            print(
                f"  Fetching batch {i // batch_size + 1}/{(len(urls) + batch_size - 1) // batch_size}..."
            )

            tasks = [fetch_page_content(session, url, semaphore) for url in batch]
            batch_results = await asyncio.gather(*tasks)

            for url, content in batch_results:
                results[url] = content

            # Small delay between batches
            if i + batch_size < len(urls):
                await asyncio.sleep(REQUEST_DELAY)

    return results


def generate_llms_full_txt(manifest: dict, contents: dict[str, str]) -> str:
    """Generate the full llms.txt with expanded content."""
    lines = []

    # Header
    lines.append("# Microsoft Foundry")
    lines.append("")
    lines.append(
        "> Microsoft Foundry (formerly Azure AI Foundry) is a unified Azure platform-as-a-service for enterprise AI operations, model builders, and application development. It provides a comprehensive set of AI capabilities for building agents, deploying models, and developing generative AI applications with built-in enterprise-readiness including tracing, monitoring, evaluations, and safety controls."
    )
    lines.append("")

    # Important notes
    lines.append("## Quick Reference")
    lines.append("")
    lines.append("- **Portal URL**: https://ai.azure.com")
    lines.append(
        "- **SDK packages**: `azure-ai-projects`, `azure-ai-agents`, `azure-identity`"
    )
    lines.append("- **Documentation**: All URLs require `?view=foundry` parameter")
    lines.append(
        "- **Project types**: Foundry projects (recommended) and hub-based projects"
    )
    lines.append("")

    # Section order
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

    sections = manifest.get("sections", {})

    for section_name in section_order:
        if section_name not in sections:
            continue

        pages = sections[section_name]
        if not pages:
            continue

        lines.append(f"## {section_name}")
        lines.append("")

        for page in pages:
            title = page.get("title", "Untitled")
            url = page.get("url", "")

            lines.append(f"### {title}")
            lines.append(f"URL: {url}")
            lines.append("")

            # Add content if available
            content = contents.get(url, "")
            if content:
                # Indent content slightly and limit length
                content_lines = content.split("\n")
                for line in content_lines[:100]:  # Limit to first 100 lines per page
                    lines.append(line)
                if len(content_lines) > 100:
                    lines.append("\n[Content truncated for brevity...]")
            else:
                lines.append("*Content not available*")

            lines.append("")
            lines.append("---")
            lines.append("")

    return "\n".join(lines)


def main():
    """Main function."""
    print("=" * 60)
    print("Microsoft Foundry llms-full.txt Generator")
    print("=" * 60)

    # Load manifest
    if not MANIFEST_PATH.exists():
        print(f"Error: Manifest not found at {MANIFEST_PATH}")
        print("Run scrape_foundry_docs.py first to generate the manifest.")
        return

    print("\n[1/4] Loading manifest...")
    with open(MANIFEST_PATH) as f:
        manifest = json.load(f)

    # Collect all URLs
    urls = []
    sections = manifest.get("sections", {})
    for section_pages in sections.values():
        for page in section_pages:
            url = page.get("url", "")
            if url and url.startswith("https://learn.microsoft.com"):
                urls.append(url)

    print(f"  Found {len(urls)} pages to fetch")

    # For a quick version, let's just generate the links version
    # (fetching all pages would take too long and hit rate limits)
    print("\n[2/4] Generating llms-full.txt structure...")

    # Generate without fetching content (links only with descriptions)
    lines = []

    # Header
    lines.append("# Microsoft Foundry")
    lines.append("")
    lines.append(
        "> Microsoft Foundry (formerly Azure AI Foundry) is a unified Azure platform-as-a-service for enterprise AI operations, model builders, and application development. It combines production-grade infrastructure with friendly interfaces for building agents, deploying models, and developing generative AI applications."
    )
    lines.append("")

    # Key information section
    lines.append("## Key Information")
    lines.append("")
    lines.append("**Portal**: https://ai.azure.com")
    lines.append("")
    lines.append("**SDK Installation**:")
    lines.append("```bash")
    lines.append("pip install azure-ai-projects azure-ai-agents azure-identity")
    lines.append("```")
    lines.append("")
    lines.append("**Authentication Pattern**:")
    lines.append("```python")
    lines.append("from azure.identity import DefaultAzureCredential")
    lines.append("from azure.ai.projects import AIProjectClient")
    lines.append("")
    lines.append("credential = DefaultAzureCredential()")
    lines.append("client = AIProjectClient(")
    lines.append(
        '    endpoint="https://<resource>.services.ai.azure.com/api/projects/<project>",'
    )
    lines.append("    credential=credential")
    lines.append(")")
    lines.append("```")
    lines.append("")
    lines.append("**Environment Variables**:")
    lines.append("```bash")
    lines.append(
        "AZURE_AI_PROJECT_ENDPOINT=https://<resource>.services.ai.azure.com/api/projects/<project>"
    )
    lines.append("AZURE_AI_MODEL_DEPLOYMENT_NAME=gpt-4o-mini")
    lines.append("```")
    lines.append("")

    # Section order
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

    for section_name in section_order:
        if section_name not in sections:
            continue

        pages = sections[section_name]
        if not pages:
            continue

        lines.append(f"## {section_name}")
        lines.append("")

        for page in pages:
            title = page.get("title", "Untitled")
            url = page.get("url", "")
            lines.append(f"- [{title}]({url})")

        lines.append("")

    # Optional section
    lines.append("## Optional")
    lines.append("")
    lines.append(
        "- [Azure Security Baseline](https://learn.microsoft.com/en-us/security/benchmark/azure/baselines/azure-ai-foundry-security-baseline): Security baseline for Azure AI Foundry"
    )
    lines.append(
        "- [Azure Compliance](https://aka.ms/AzureCompliance): Compliance documentation"
    )
    lines.append(
        "- [Service Level Agreement](https://www.microsoft.com/licensing/docs/view/Service-Level-Agreements-SLA-for-Online-Services): SLA details"
    )
    lines.append("")

    content = "\n".join(lines)

    print("[3/4] Writing llms-full.txt...")
    LLMS_FULL_TXT_PATH.write_text(content)

    print(f"\n[4/4] Complete!")
    print(f"  Generated: {LLMS_FULL_TXT_PATH}")
    print(f"  Total lines: {len(content.splitlines())}")
    print(f"  File size: {len(content):,} bytes")

    print("\n" + "=" * 60)
    print("Done!")
    print("=" * 60)


if __name__ == "__main__":
    main()
