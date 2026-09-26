#!/usr/bin/env python3
"""Validate an SVG theme JSON contract and its critical contrast pairs."""

from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path


HEX_RE = re.compile(r"^#[0-9A-Fa-f]{6}$")
REQUIRED_COLORS = {
    "canvas", "surface", "surfaceAlt", "text", "textMuted", "line", "grid",
    "accent", "accentSecondary", "accentMuted", "onAccent", "positive",
    "positiveSurface", "onPositiveSurface", "warning", "danger",
}
REQUIRED_APPEARANCE = {
    "preset", "fontFamily", "cornerRadius", "pillRadius", "strokeWidth",
    "connectorWidth", "lineCap", "lineJoin", "dash", "density", "depth",
}
PRESETS = {"casual", "formal", "sharp", "simple", "friendly", "custom"}


def rgb(hex_color: str) -> tuple[float, float, float]:
    return tuple(int(hex_color[index:index + 2], 16) / 255 for index in (1, 3, 5))  # type: ignore[return-value]


def luminance(hex_color: str) -> float:
    channels = []
    for channel in rgb(hex_color):
        channels.append(channel / 12.92 if channel <= 0.04045 else ((channel + 0.055) / 1.055) ** 2.4)
    return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2]


def contrast(first: str, second: str) -> float:
    light, dark = sorted((luminance(first), luminance(second)), reverse=True)
    return (light + 0.05) / (dark + 0.05)


def validate_theme(theme: object) -> tuple[list[str], list[str]]:
    errors: list[str] = []
    warnings: list[str] = []
    if not isinstance(theme, dict):
        return ["theme root must be an object"], warnings

    if not isinstance(theme.get("name"), str) or not theme["name"].strip():
        errors.append("name must be a non-empty string")

    appearance = theme.get("appearance")
    if not isinstance(appearance, dict):
        errors.append("appearance must be an object")
    else:
        missing = REQUIRED_APPEARANCE - set(appearance)
        if missing:
            errors.append(f"appearance missing: {', '.join(sorted(missing))}")
        preset = appearance.get("preset")
        if preset not in PRESETS:
            errors.append(f"appearance.preset must be one of: {', '.join(sorted(PRESETS))}")
        for key, minimum, maximum in (
            ("cornerRadius", 0, 32), ("pillRadius", 0, 64),
            ("strokeWidth", 0.5, 6), ("connectorWidth", 0.5, 6),
        ):
            value = appearance.get(key)
            if not isinstance(value, (int, float)) or isinstance(value, bool) or not minimum <= value <= maximum:
                errors.append(f"appearance.{key} must be between {minimum} and {maximum}")
        if appearance.get("lineCap") not in {"butt", "round", "square"}:
            errors.append("appearance.lineCap must be butt, round, or square")
        if appearance.get("lineJoin") not in {"miter", "round", "bevel"}:
            errors.append("appearance.lineJoin must be miter, round, or bevel")
        if appearance.get("density") not in {"compact", "comfortable", "spacious"}:
            errors.append("appearance.density must be compact, comfortable, or spacious")
        if appearance.get("depth") not in {"flat", "outlined", "layered", "shadowed"}:
            errors.append("appearance.depth must be flat, outlined, layered, or shadowed")
        dash = appearance.get("dash")
        if not isinstance(dash, list) or any(not isinstance(value, (int, float)) or value < 0 for value in dash):
            errors.append("appearance.dash must be an array of non-negative numbers")

    modes = theme.get("modes")
    if not isinstance(modes, dict):
        errors.append("modes must be an object")
        return errors, warnings
    for required_mode in ("light", "dark"):
        if required_mode not in modes:
            errors.append(f"modes.{required_mode} is required")

    for mode_name, mode in modes.items():
        if not isinstance(mode, dict):
            errors.append(f"modes.{mode_name} must be an object")
            continue
        missing = REQUIRED_COLORS - set(mode)
        if missing:
            errors.append(f"modes.{mode_name} missing: {', '.join(sorted(missing))}")
            continue
        for role in REQUIRED_COLORS:
            value = mode.get(role)
            if not isinstance(value, str) or not HEX_RE.fullmatch(value):
                errors.append(f"modes.{mode_name}.{role} must be #RRGGBB")
        if any(not isinstance(mode.get(role), str) or not HEX_RE.fullmatch(mode[role]) for role in REQUIRED_COLORS):
            continue

        checks = [
            ("text/canvas", "text", "canvas", 4.5),
            ("text/surface", "text", "surface", 4.5),
            ("textMuted/canvas", "textMuted", "canvas", 4.5),
            ("line/canvas", "line", "canvas", 3.0),
            ("onAccent/accent", "onAccent", "accent", 4.5),
            ("onPositiveSurface/positiveSurface", "onPositiveSurface", "positiveSurface", 4.5),
        ]
        for label, foreground, background, threshold in checks:
            ratio = contrast(mode[foreground], mode[background])
            if ratio < threshold:
                errors.append(f"modes.{mode_name} {label} contrast {ratio:.2f}:1 is below {threshold}:1")
        grid_ratio = contrast(mode["grid"], mode["canvas"])
        if grid_ratio < 3:
            warnings.append(
                f"modes.{mode_name} grid/canvas contrast is {grid_ratio:.2f}:1; use grid only for nonessential guides"
            )

    return errors, warnings


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("theme", type=Path, help="theme JSON file")
    args = parser.parse_args()
    try:
        theme = json.loads(args.theme.read_text(encoding="utf-8"))
    except (OSError, UnicodeError, json.JSONDecodeError) as exc:
        print(f"error: cannot read theme: {exc}", file=sys.stderr)
        return 1
    errors, warnings = validate_theme(theme)
    for warning in warnings:
        print(f"warning: {warning}", file=sys.stderr)
    for error in errors:
        print(f"error: {error}", file=sys.stderr)
    if errors:
        print(f"FAIL: {args.theme} ({len(errors)} errors, {len(warnings)} warnings)", file=sys.stderr)
        return 1
    print(f"PASS: {args.theme} ({len(warnings)} warnings)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())