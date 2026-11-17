"""Render a compact, dark-only 16:9 health summary SVG."""

from __future__ import annotations

import argparse
import json
from html import escape
from pathlib import Path


WIDTH = 1600
HEIGHT = 900
SERIES_COUNT = 5


def theme_css(_theme: str = "dark") -> str:
    dark = """
      --canvas: #172033;
      --panel: #25324A;
      --panel-alt: #2C3B57;
      --text: #F3F4F6;
      --muted: #CAD5E5;
      --grid: #50617D;
      --point-outline: #172033;
      --accent: #65D7E5;
      --healthy: #55D98A;
      --healthy-bg: #183D39;
      --degraded: #FF7B72;
      --degraded-bg: #4A2935;
      --warning: #FFC857;
      --warning-bg: #4B4029;
      --neutral: #8FB8FF;
      --neutral-bg: #273E65;
      --series-0: #FF7B72;
      --series-1: #65D7E5;
      --series-2: #55D98A;
      --series-3: #FFC857;
      --series-4: #AAB8D0;
    """
    return f"""
    <style>
      :root {{
        color-scheme: dark;
        {dark}
      }}
    </style>
    """


def svg_text(
    x: float,
    y: float,
    value: object,
    size: int,
    weight: int = 400,
    color: str = "var(--text)",
    anchor: str = "start",
) -> str:
    return (
        f'<text x="{x}" y="{y}" font-family="Segoe UI,Arial,sans-serif" '
        f'font-size="{size}" font-weight="{weight}" fill="{color}" '
        f'text-anchor="{anchor}">{escape(str(value))}</text>'
    )


def state_color(state: str) -> str:
    return {
        "healthy": "var(--healthy)",
        "degraded": "var(--degraded)",
        "warning": "var(--warning)",
        "neutral": "var(--neutral)",
    }.get(state, "var(--neutral)")


def state_background(state: str) -> str:
    return {
        "healthy": "var(--healthy-bg)",
        "degraded": "var(--degraded-bg)",
        "warning": "var(--warning-bg)",
        "neutral": "var(--neutral-bg)",
    }.get(state, "var(--panel)")


def chart_panel(chart: dict, x: int, y: int, width: int, height: int) -> list[str]:
    elements = [
        f'<rect x="{x}" y="{y}" width="{width}" height="{height}" rx="14" '
        'fill="var(--panel-alt)" stroke="var(--grid)" stroke-width="1"/>',
        svg_text(x + 24, y + 38, chart["title"], 21, 700),
        svg_text(
            x + 24,
            y + 64,
            chart.get("caption", ""),
            13,
            color="var(--muted)",
        ),
    ]
    series = chart.get("series", [])
    values = [
        float(point["y"]) for item in series for point in item.get("points", [])
    ]
    if not values:
        elements.append(
            svg_text(
                x + width / 2,
                y + height / 2,
                "Unavailable",
                28,
                700,
                "var(--muted)",
                "middle",
            )
        )
        return elements

    left, right = x + 62, x + width - 24
    top, bottom = y + 100, y + height - 70
    maximum = max(values) or 1
    if chart.get("maximum") is not None:
        maximum = max(maximum, float(chart["maximum"]))
    for index in range(5):
        gy = top + (bottom - top) * index / 4
        value = maximum * (4 - index) / 4
        elements.append(
            f'<line x1="{left}" y1="{gy}" x2="{right}" y2="{gy}" '
            'stroke="var(--grid)" stroke-width="1"/>'
        )
        elements.append(
            svg_text(
                left - 12,
                gy + 5,
                f"{value:.0f}",
                12,
                color="var(--muted)",
                anchor="end",
            )
        )

    points = series[0].get("points", [])
    bar_gap = 42
    bar_width = min(132, (right - left - bar_gap * (len(points) - 1)) / len(points))
    total_width = bar_width * len(points) + bar_gap * (len(points) - 1)
    start_x = left + (right - left - total_width) / 2
    for point_index, point in enumerate(points):
        px = start_x + point_index * (bar_width + bar_gap)
        value = float(point["y"])
        py = bottom - (bottom - top) * value / maximum
        color = state_color(point.get("state", "neutral"))
        elements.append(
            f'<rect x="{px:.1f}" y="{py:.1f}" width="{bar_width:.1f}" '
            f'height="{bottom - py:.1f}" rx="7" fill="{color}" opacity="0.9"/>'
        )
        elements.append(
            svg_text(
                px + bar_width / 2,
                py - 10,
                point.get("display", f"{value:g}"),
                14,
                700,
                color,
                "middle",
            )
        )
        elements.append(
            svg_text(
                px + bar_width / 2,
                bottom + 24,
                point["x"],
                12,
                600,
                "var(--muted)",
                "middle",
            )
        )

    for annotation in chart.get("annotations", []):
        ay = bottom - (bottom - top) * float(annotation["y"]) / maximum
        color = state_color(annotation.get("state", "warning"))
        elements.append(
            f'<line x1="{left}" y1="{ay:.1f}" x2="{right}" y2="{ay:.1f}" '
            f'stroke="{color}" stroke-width="2" stroke-dasharray="7 5"/>'
        )
        elements.append(
            svg_text(
                right - 4,
                ay - 8,
                annotation["label"],
                12,
                700,
                color,
                "end",
            )
        )
    return elements


def render(data: dict, theme: str) -> str:
    elements = [
        f'<svg xmlns="http://www.w3.org/2000/svg" width="{WIDTH}" height="{HEIGHT}" '
        f'viewBox="0 0 {WIDTH} {HEIGHT}">',
        theme_css(theme),
        '<rect width="1600" height="900" fill="var(--canvas)"/>',
        svg_text(48, 58, "SUPPLEMENTAL INLINE HEALTH VISUAL", 16, 700, "var(--accent)"),
        svg_text(48, 98, data["title"], 32, 700),
        svg_text(
            48,
            126,
            (
                f'{data["window"]["start"]} to {data["window"]["end"]} UTC · '
                f'{data["source_summary"]}'
            ),
            14,
            color="var(--muted)",
        ),
    ]

    cards = data.get("kpis", [])[:5]
    card_width = 286
    for index in range(5):
        x = 48 + index * 304
        card = (
            cards[index]
            if index < len(cards)
            else {
                "label": "Signal",
                "value": "Unavailable",
                "context": "No telemetry returned.",
            }
        )
        elements.extend(
            [
                f'<rect x="{x}" y="158" width="{card_width}" height="132" rx="14" '
                f'fill="{state_background(card.get("state", "neutral"))}" '
                f'stroke="{state_color(card.get("state", "neutral"))}" stroke-width="1.5"/>',
                svg_text(
                    x + 20, 188, card["label"], 15, 600, "var(--muted)"
                ),
                svg_text(
                    x + 20,
                    232,
                    card["value"],
                    28,
                    700,
                    state_color(card.get("state", "neutral")),
                ),
                svg_text(
                    x + 20,
                    266,
                    card.get("context", "")[:42],
                    12,
                    color="var(--muted)",
                ),
            ]
        )

    charts = data.get("charts", [])[:2]
    for index in range(2):
        chart = (
            charts[index]
            if index < len(charts)
            else {
                "title": "Signal unavailable",
                "caption": "No telemetry returned.",
                "series": [],
            }
        )
        elements.extend(chart_panel(chart, 48 + index * 776, 316, 752, 350))

    infrastructure = data.get("infrastructure_metrics", [])[:5]
    elements.append(svg_text(48, 706, "INFRASTRUCTURE SIGNALS", 15, 700, "var(--accent)"))
    metric_width = 286
    for index in range(5):
        x = 48 + index * 304
        metric = (
            infrastructure[index]
            if index < len(infrastructure)
            else {
                "label": "Signal",
                "value": "Unavailable",
                "context": "No telemetry returned.",
                "state": "neutral",
            }
        )
        elements.extend(
            [
                f'<rect x="{x}" y="724" width="{metric_width}" height="108" rx="12" '
                f'fill="{state_background(metric.get("state", "neutral"))}" '
                f'stroke="{state_color(metric.get("state", "neutral"))}" stroke-width="1"/>',
                svg_text(x + 18, 752, metric["label"], 13, 600, "var(--muted)"),
                svg_text(
                    x + 18,
                    788,
                    metric["value"],
                    22,
                    700,
                    state_color(metric.get("state", "neutral")),
                ),
                svg_text(
                    x + 18,
                    816,
                    metric.get("context", "")[:44],
                    11,
                    color="var(--muted)",
                ),
            ]
        )

    elements.append(
        svg_text(
            48,
            874,
            "Generated from the same verified health evidence; missing data is labeled "
            "Unavailable.",
            13,
            color="var(--muted)",
        )
    )
    elements.append("</svg>")
    return "\n".join(elements)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    parser.add_argument(
        "--theme",
        choices=("auto", "light", "dark"),
        default="dark",
        help="Deprecated compatibility option; output is always dark.",
    )
    args = parser.parse_args()
    data = json.loads(args.input.read_text(encoding="utf-8"))
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(render(data, args.theme), encoding="utf-8")
    print(
        json.dumps(
            {
                "ok": True,
                "output": str(args.output),
                "bytes": args.output.stat().st_size,
                "theme": "dark",
            }
        )
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
