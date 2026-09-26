#!/usr/bin/env python3
"""Validate structural, accessibility, and production-profile SVG constraints.

This is a conservative baseline linter. It does not replace browser rendering,
visual inspection, WCAG review, factual review, or target-application testing.
"""

from __future__ import annotations

import argparse
import re
import sys
import xml.etree.ElementTree as ET
from collections import Counter
from pathlib import Path
from typing import Iterable


SVG_NS = "http://www.w3.org/2000/svg"
XLINK_NS = "http://www.w3.org/1999/xlink"
URL_REF_RE = re.compile(r"url\(\s*#([^\s)]+)\s*\)")
EXTERNAL_URL_RE = re.compile(r"(?:https?:)?//", re.IGNORECASE)
CSS_ANIMATION_RE = re.compile(r"(?:@keyframes|\banimation(?:-name)?\s*:)", re.IGNORECASE)
REDUCED_MOTION_RE = re.compile(r"prefers-reduced-motion\s*:\s*reduce", re.IGNORECASE)
NON_NEGATIVE_NUMBER_RE = re.compile(r"^(?:\d+(?:\.\d*)?|\.\d+)$")
GEOMETRY_TAGS = {"circle", "ellipse", "line", "path", "polygon", "polyline", "rect"}
ICON_SOURCES = {"fluent", "font-awesome", "google-material"}
SLATE_SURFACE_FOREGROUNDS = {
    "var(--color-brand-bg)": {"var(--color-on-brand)"},
    "var(--color-status-info-bg)": {"var(--color-neutral-fg-1)", "var(--color-status-info-fg)"},
    "var(--color-status-success-bg)": {"var(--color-neutral-fg-1)", "var(--color-status-success-fg)"},
    "var(--color-status-warning-bg)": {"var(--color-neutral-fg-1)", "var(--color-status-warning-fg)"},
    "var(--color-status-danger-bg)": {"var(--color-neutral-fg-1)", "var(--color-status-danger-fg)"},
}


PROFILE_FORBIDDEN = {
    "slate-inline": {
        "script",
        "foreignObject",
        "style",
        "filter",
        "mask",
        "animate",
        "animateMotion",
        "animateTransform",
        "set",
    },
    "slate-asset": {
        "script",
        "foreignObject",
        "style",
        "animate",
        "animateMotion",
        "animateTransform",
        "set",
    },
    "slate-motion-subject": {
        "script",
        "foreignObject",
        "style",
        "filter",
        "mask",
        "animate",
        "animateMotion",
        "animateTransform",
        "set",
    },
    "slate-viewport-motion": {
        "script",
        "foreignObject",
        "style",
        "filter",
        "mask",
        "animate",
        "animateMotion",
        "animateTransform",
        "set",
    },
    "standalone": {"script", "foreignObject"},
    "office": {
        "script",
        "foreignObject",
        "style",
        "filter",
        "mask",
        "marker",
        "animate",
        "animateMotion",
        "animateTransform",
        "set",
    },
    "print": {"script", "foreignObject", "animate", "animateMotion", "animateTransform", "set"},
    "icon": {"script", "foreignObject", "text", "image", "animate", "animateMotion", "animateTransform", "set"},
}


def local_name(name: str) -> str:
    """Return an XML expanded name without its namespace."""
    return name.rsplit("}", 1)[-1]


def iter_text(element: ET.Element) -> str:
    return "".join(element.itertext()).strip()


def attr_value(element: ET.Element, name: str) -> str | None:
    return element.attrib.get(name) or element.attrib.get(f"{{{XLINK_NS}}}{name}")


def parse_viewbox(value: str | None) -> tuple[float, float, float, float] | None:
    if not value:
        return None
    parts = re.split(r"[\s,]+", value.strip())
    if len(parts) != 4:
        return None
    try:
        numbers = tuple(float(part) for part in parts)
    except ValueError:
        return None
    if numbers[2] <= 0 or numbers[3] <= 0:
        return None
    return numbers  # type: ignore[return-value]


def find_elements(root: ET.Element, tag_name: str) -> list[ET.Element]:
    return [element for element in root.iter() if local_name(element.tag) == tag_name]


def collect_references(root: ET.Element) -> tuple[set[str], list[str]]:
    internal: set[str] = set()
    external: list[str] = []

    for element in root.iter():
        for raw_name, value in element.attrib.items():
            name = local_name(raw_name)
            internal.update(URL_REF_RE.findall(value))

            if name == "href":
                if value.startswith("#"):
                    internal.add(value[1:])
                elif not value.startswith("data:"):
                    external.append(value)
            elif EXTERNAL_URL_RE.search(value):
                external.append(value)

        if local_name(element.tag) == "style":
            style_text = iter_text(element)
            internal.update(URL_REF_RE.findall(style_text))
            if EXTERNAL_URL_RE.search(style_text):
                external.append("external URL in <style>")

    return internal, external


def validate(
    path: Path,
    profile: str,
    accessibility: str,
) -> tuple[list[str], list[str]]:
    errors: list[str] = []
    warnings: list[str] = []

    try:
        source = path.read_text(encoding="utf-8")
    except (OSError, UnicodeError) as exc:
        return [f"cannot read UTF-8 SVG: {exc}"], warnings

    try:
        root = ET.fromstring(source)
    except ET.ParseError as exc:
        return [f"malformed XML: {exc}"], warnings

    if local_name(root.tag) != "svg":
        errors.append("root element must be <svg>")
        return errors, warnings

    if not root.tag.startswith(f"{{{SVG_NS}}}"):
        errors.append(f'root <svg> must declare xmlns="{SVG_NS}"')

    viewbox = parse_viewbox(root.attrib.get("viewBox"))
    if viewbox is None:
        errors.append("viewBox must contain four numbers with positive width and height")

    safe_margin = root.attrib.get("data-slate-safe-margin")
    if profile in {"slate-viewport-motion", "slate-motion-subject"} and safe_margin is None:
        warnings.append("live Slate SVG should declare data-slate-safe-margin")
    if safe_margin is not None:
        if not NON_NEGATIVE_NUMBER_RE.fullmatch(safe_margin.strip()):
            errors.append("data-slate-safe-margin must be one non-negative number")
        elif viewbox is not None:
            minimum_margin = max(24.0, 0.04 * min(viewbox[2], viewbox[3]))
            if float(safe_margin) < minimum_margin:
                errors.append(
                    f"data-slate-safe-margin must be at least {minimum_margin:g} for this viewBox"
                )

    mobile_viewbox_value = root.attrib.get("data-slate-mobile-view-box")
    mobile_safe_margin = root.attrib.get("data-slate-mobile-safe-margin")
    if bool(mobile_viewbox_value) != bool(mobile_safe_margin):
        errors.append(
            "responsive SVG requires both data-slate-mobile-view-box and data-slate-mobile-safe-margin"
        )
    mobile_viewbox = parse_viewbox(mobile_viewbox_value)
    if mobile_viewbox_value and mobile_viewbox is None:
        errors.append("data-slate-mobile-view-box must contain four numbers with positive width and height")
    if mobile_safe_margin:
        if not NON_NEGATIVE_NUMBER_RE.fullmatch(mobile_safe_margin.strip()):
            errors.append("data-slate-mobile-safe-margin must be one non-negative number")
        elif mobile_viewbox is not None:
            minimum_mobile_margin = max(24.0, 0.04 * min(mobile_viewbox[2], mobile_viewbox[3]))
            if float(mobile_safe_margin) < minimum_mobile_margin:
                errors.append(
                    "data-slate-mobile-safe-margin must be at least "
                    f"{minimum_mobile_margin:g} for the mobile viewBox"
                )

    preserve = root.attrib.get("preserveAspectRatio")
    if preserve == "none":
        warnings.append("preserveAspectRatio=none may distort the illustration")

    elements = list(root.iter())
    tag_names = [local_name(element.tag) for element in elements]
    forbidden = PROFILE_FORBIDDEN[profile]
    for tag_name in sorted(forbidden.intersection(tag_names)):
        errors.append(f"<{tag_name}> is not allowed in the {profile} profile")

    for element in elements:
        tag_name = local_name(element.tag)
        for raw_name in element.attrib:
            name = local_name(raw_name)
            if name.lower().startswith("on"):
                errors.append(f"event attribute {name!r} is not allowed on <{tag_name}>")

    ids = [element.attrib["id"] for element in elements if "id" in element.attrib]
    elements_by_id = {element.attrib["id"]: element for element in elements if "id" in element.attrib}
    duplicates = sorted(item for item, count in Counter(ids).items() if count > 1)
    for duplicate in duplicates:
        errors.append(f"duplicate id: {duplicate}")

    references, external_resources = collect_references(root)
    known_ids = set(ids)
    for missing in sorted(references - known_ids):
        errors.append(f"dangling internal reference: #{missing}")

    for resource in sorted(set(external_resources)):
        errors.append(f"external resource is not self-contained: {resource}")

    if mobile_viewbox_value:
        layout_groups = [
            element.attrib.get("data-slate-layout-group")
            for element in elements
            if element.attrib.get("data-slate-layout-group")
        ]
        if layout_groups.count("desktop") != 1 or layout_groups.count("mobile") != 1:
            errors.append("responsive SVG requires exactly one desktop and one mobile layout group")
        unknown_layouts = sorted(set(layout_groups) - {"desktop", "mobile"})
        if unknown_layouts:
            errors.append("unknown data-slate-layout-group value: " + ", ".join(unknown_layouts))

    icon_sources: set[str] = set()
    for element in elements:
        icon_source = element.attrib.get("data-slate-icon-source")
        icon_name = element.attrib.get("data-slate-icon-name")
        if icon_source is None and icon_name is None:
            continue
        if not icon_source or not icon_name:
            errors.append("icon provenance requires both data-slate-icon-source and data-slate-icon-name")
            continue
        if icon_source not in ICON_SOURCES:
            errors.append(
                "data-slate-icon-source must be one of: " + ", ".join(sorted(ICON_SOURCES))
            )
            continue
        icon_sources.add(icon_source)
    if len(icon_sources) > 1:
        errors.append("one SVG must not mix icon sources")

    if viewbox is not None:
        viewbox_x, viewbox_y, viewbox_width, viewbox_height = viewbox
        for rectangle in find_elements(root, "rect"):
            try:
                rectangle_x = float(rectangle.attrib.get("x", "0"))
                rectangle_y = float(rectangle.attrib.get("y", "0"))
                rectangle_width = float(rectangle.attrib.get("width", "nan"))
                rectangle_height = float(rectangle.attrib.get("height", "nan"))
            except ValueError:
                continue
            stroke = rectangle.attrib.get("stroke", "none").strip().lower()
            traces_viewbox = all(
                abs(actual - expected) <= 0.01
                for actual, expected in (
                    (rectangle_x, viewbox_x),
                    (rectangle_y, viewbox_y),
                    (rectangle_width, viewbox_width),
                    (rectangle_height, viewbox_height),
                )
            )
            if traces_viewbox and stroke not in {"", "none", "transparent"}:
                errors.append("decorative rectangle must not trace the SVG viewBox border")

    for element in elements:
        tag_name = local_name(element.tag)
        fit_target = element.attrib.get("data-slate-fit-target")
        if fit_target:
            if tag_name != "text":
                errors.append("data-slate-fit-target is allowed only on <text>")
            if fit_target not in known_ids:
                errors.append(f"text fit target does not exist: #{fit_target}")
            elif local_name(elements_by_id[fit_target].tag) not in GEOMETRY_TAGS:
                errors.append(f"text fit target must reference visible geometry: #{fit_target}")
            elif profile.startswith("slate-"):
                surface_fill = elements_by_id[fit_target].attrib.get("fill")
                allowed_foregrounds = SLATE_SURFACE_FOREGROUNDS.get(surface_fill)
                text_fill = element.attrib.get("fill")
                if allowed_foregrounds and text_fill not in allowed_foregrounds:
                    errors.append(
                        f"text on {surface_fill} must use an allowed on-surface role: "
                        f"{', '.join(sorted(allowed_foregrounds))}"
                    )
            if element.attrib.get("text-anchor") not in {"start", "middle", "end"}:
                errors.append("text with data-slate-fit-target requires an explicit text-anchor")
            fit_padding = element.attrib.get("data-slate-fit-padding")
            if fit_padding is not None and not NON_NEGATIVE_NUMBER_RE.fullmatch(fit_padding.strip()):
                errors.append("data-slate-fit-padding must be one non-negative number")

        connector_from = element.attrib.get("data-slate-connector-from")
        connector_to = element.attrib.get("data-slate-connector-to")
        connector_anchor = element.attrib.get("data-slate-connector-anchor")
        if connector_from is not None or connector_to is not None or connector_anchor is not None:
            if tag_name not in {"line", "path", "polyline"}:
                errors.append("connector metadata is allowed only on <line>, <path>, or <polyline>")
            if not connector_from or not connector_to:
                errors.append("connector metadata requires both data-slate-connector-from and data-slate-connector-to")
            else:
                if connector_from == connector_to:
                    errors.append("connector source and target must be different")
                for role_name, target_id in (("source", connector_from), ("target", connector_to)):
                    if target_id not in known_ids:
                        errors.append(f"connector {role_name} does not exist: #{target_id}")
                    elif local_name(elements_by_id[target_id].tag) not in GEOMETRY_TAGS:
                        errors.append(f"connector {role_name} must reference visible geometry: #{target_id}")
            if connector_anchor not in {"boundary", "port"}:
                errors.append('data-slate-connector-anchor must be "boundary" or "port"')

    title_elements = find_elements(root, "title")
    desc_elements = find_elements(root, "desc")
    title = next((iter_text(element) for element in title_elements if iter_text(element)), "")
    description = next((iter_text(element) for element in desc_elements if iter_text(element)), "")
    role = root.attrib.get("role")
    aria_hidden = root.attrib.get("aria-hidden")
    labelledby = set(root.attrib.get("aria-labelledby", "").split())

    if accessibility == "decorative":
        if aria_hidden != "true":
            errors.append('decorative inline SVG must set aria-hidden="true"')
        if role == "img":
            warnings.append("decorative SVG should not expose role=img")
    else:
        if role != "img":
            errors.append('informative inline SVG must set role="img"')
        if not title:
            errors.append("informative SVG must contain a non-empty <title>")
        if title_elements and list(root).index(title_elements[0]) > 0:
            warnings.append("<title> should be the first child of <svg>")
        if accessibility == "complex" and not description:
            errors.append("complex SVG must contain a concise non-empty <desc>")

        title_ids = {element.attrib.get("id") for element in title_elements if element.attrib.get("id")}
        desc_ids = {element.attrib.get("id") for element in desc_elements if element.attrib.get("id")}
        if labelledby and not labelledby.issubset(known_ids):
            errors.append("aria-labelledby contains an ID that does not exist")
        if title_ids and not title_ids.intersection(labelledby):
            warnings.append("aria-labelledby does not reference the titled accessible name")
        if accessibility == "complex" and desc_ids and not desc_ids.intersection(labelledby):
            warnings.append("aria-labelledby does not reference <desc>")

    style_text = "\n".join(iter_text(element) for element in find_elements(root, "style"))
    if CSS_ANIMATION_RE.search(style_text) and not REDUCED_MOTION_RE.search(style_text):
        errors.append("CSS animation requires a prefers-reduced-motion: reduce fallback")

    if profile == "icon":
        if root.attrib.get("width") or root.attrib.get("height"):
            warnings.append("icon profile usually relies on viewBox plus host-controlled dimensions")
        if accessibility != "decorative" and not title:
            warnings.append("UI icons are often decorative beside a host control label")

    if profile == "slate-motion-subject":
        semantic_ids = [
            element.attrib["id"]
            for element in elements
            if "id" in element.attrib and local_name(element.tag) not in {"title", "desc"}
        ]
        if not semantic_ids:
            errors.append("slate-motion-subject requires at least one stable semantic subject ID")

    if profile == "slate-viewport-motion":
        if root.attrib.get("data-slate-svg-motion") != "viewport":
            errors.append('slate-viewport-motion requires data-slate-svg-motion="viewport" on <svg>')
        motion_subjects = [
            element
            for element in elements
            if "data-slate-svg-step" in element.attrib
        ]
        if not motion_subjects:
            errors.append("slate-viewport-motion requires at least one data-slate-svg-step subject")
        for subject in motion_subjects:
            if not subject.attrib.get("id"):
                errors.append("every data-slate-svg-step subject requires a stable semantic ID")

    if len(elements) > 1000:
        warnings.append(f"SVG contains {len(elements)} elements; consider Canvas or geometry reuse")

    if "<metadata" in source or "inkscape:" in source or "sodipodi:" in source:
        warnings.append("editor metadata is present; remove it from the optimized delivery copy")

    return errors, warnings


def print_messages(kind: str, messages: Iterable[str]) -> None:
    for message in messages:
        print(f"{kind}: {message}", file=sys.stderr)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("svg", type=Path, help="SVG file to validate")
    parser.add_argument(
        "--profile",
        choices=sorted(PROFILE_FORBIDDEN),
        default="slate-inline",
        help="target production profile (default: slate-inline)",
    )
    parser.add_argument(
        "--accessibility",
        choices=("informative", "complex", "decorative"),
        default="informative",
        help="graphic purpose and accessible-name contract",
    )
    args = parser.parse_args()

    errors, warnings = validate(args.svg, args.profile, args.accessibility)
    print_messages("warning", warnings)
    print_messages("error", errors)

    if errors:
        print(
            f"FAIL: {args.svg} ({len(errors)} errors, {len(warnings)} warnings)",
            file=sys.stderr,
        )
        return 1

    print(f"PASS: {args.svg} ({len(warnings)} warnings)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())