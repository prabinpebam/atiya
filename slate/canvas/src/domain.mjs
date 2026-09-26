const ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,159}$/;
const TONES = new Set(["aqua", "blue", "green", "gold", "coral", "rose", "lilac", "teal", "neutral"]);

function issue(path, message) {
  return { path, message };
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function validId(value) {
  return typeof value === "string" && ID_PATTERN.test(value);
}

function uniqueIds(items, path, errors) {
  const ids = new Set();
  items.forEach((item, index) => {
    if (!validId(item?.id)) errors.push(issue(`${path}[${index}].id`, "must be a stable Slate identifier"));
    else if (ids.has(item.id)) errors.push(issue(`${path}[${index}].id`, `duplicates ${item.id}`));
    else ids.add(item.id);
  });
  return ids;
}

function validateSourceLink(source, path, errors) {
  if (source == null) return;
  if (!isPlainObject(source)) {
    errors.push(issue(path, "must be an object"));
    return;
  }
  if (typeof source.label !== "string" || !source.label.trim()) errors.push(issue(`${path}.label`, "is required"));
  if (typeof source.href !== "string" || !source.href.trim() || source.href.includes("\\") || source.href.includes("..")) {
    errors.push(issue(`${path}.href`, "must be a non-empty normalized path or URL"));
  }
}

export function validateRecordSet(recordSet) {
  const errors = [];
  if (!isPlainObject(recordSet)) return [issue("$", "must be an object")];
  if (recordSet.schemaVersion !== 1) errors.push(issue("schemaVersion", "must equal 1"));
  if (!validId(recordSet.id)) errors.push(issue("id", "must be a stable Slate identifier"));
  if (typeof recordSet.revision !== "string" || !recordSet.revision.trim()) errors.push(issue("revision", "is required"));
  if (!Array.isArray(recordSet.records)) return [...errors, issue("records", "must be an array")];
  if (recordSet.records.length > 1000) errors.push(issue("records", "cannot contain more than 1000 records"));
  uniqueIds(recordSet.records, "records", errors);
  recordSet.records.forEach((record, index) => {
    const path = `records[${index}]`;
    if (!isPlainObject(record)) {
      errors.push(issue(path, "must be an object"));
      return;
    }
    if (!validId(record.kind)) errors.push(issue(`${path}.kind`, "must be a stable Slate identifier"));
    if (typeof record.title !== "string" || !record.title.trim() || record.title.length > 320) {
      errors.push(issue(`${path}.title`, "must contain 1 to 320 characters"));
    }
    if (record.summary != null && (typeof record.summary !== "string" || record.summary.length > 2000)) {
      errors.push(issue(`${path}.summary`, "cannot exceed 2000 characters"));
    }
    validateSourceLink(record.source, `${path}.source`, errors);
  });
  return errors;
}

function detectGroupCycle(groupId, groups, trail = new Set()) {
  if (trail.has(groupId)) return true;
  const parentId = groups.get(groupId)?.parentId;
  if (!parentId) return false;
  const nextTrail = new Set(trail);
  nextTrail.add(groupId);
  return detectGroupCycle(parentId, groups, nextTrail);
}

function groupDepth(groupId, groups) {
  let depth = 1;
  let parentId = groups.get(groupId)?.parentId;
  const visited = new Set([groupId]);
  while (parentId && !visited.has(parentId)) {
    visited.add(parentId);
    depth += 1;
    parentId = groups.get(parentId)?.parentId;
  }
  return depth;
}

export function canvasPerspectives(document) {
  if (Array.isArray(document?.perspectives) && document.perspectives.length) return document.perspectives;
  return [{
    id: "default",
    title: "Overview",
    description: document?.description,
    groups: document?.groups || [],
    placements: document?.placements || [],
    presentation: document?.presentation,
  }];
}

export function canvasPerspective(document, perspectiveId = document?.defaultPerspectiveId) {
  const perspectives = canvasPerspectives(document);
  return perspectives.find((perspective) => perspective.id === perspectiveId) || perspectives[0];
}

function validatePerspective(perspective, path, sourceIds, recordSets, errors) {
  if (!isPlainObject(perspective)) {
    errors.push(issue(path, "must be an object"));
    return;
  }
  if (!validId(perspective.id)) errors.push(issue(`${path}.id`, "must be a stable Slate identifier"));
  if (typeof perspective.title !== "string" || !perspective.title.trim() || perspective.title.length > 80) errors.push(issue(`${path}.title`, "must contain 1 to 80 characters"));
  if (!Array.isArray(perspective.groups) || !perspective.groups.length) {
    errors.push(issue(`${path}.groups`, "must contain at least one group"));
    return;
  }
  if (perspective.groups.length > 500) errors.push(issue(`${path}.groups`, "cannot contain more than 500 groups"));
  const groupIds = uniqueIds(perspective.groups, `${path}.groups`, errors);
  const groups = new Map(perspective.groups.filter((group) => validId(group?.id)).map((group) => [group.id, group]));
  perspective.groups.forEach((group, index) => {
    const groupPath = `${path}.groups[${index}]`;
    if (typeof group.title !== "string" || !group.title.trim() || group.title.length > 160) errors.push(issue(`${groupPath}.title`, "must contain 1 to 160 characters"));
    if (group.parentId && !groupIds.has(group.parentId)) errors.push(issue(`${groupPath}.parentId`, `does not resolve: ${group.parentId}`));
    if (group.parentId === group.id || (group.parentId && groups.has(group.parentId) && detectGroupCycle(group.id, groups))) errors.push(issue(`${groupPath}.parentId`, "creates a containment cycle"));
    if (group.tone != null && !TONES.has(group.tone)) errors.push(issue(`${groupPath}.tone`, "is not a registered Slate tone"));
    if (group.sections != null) {
      if (!Array.isArray(group.sections)) errors.push(issue(`${groupPath}.sections`, "must be an array"));
      else uniqueIds(group.sections, `${groupPath}.sections`, errors);
    }
  });
  perspective.groups.forEach((group, index) => {
    if (!detectGroupCycle(group.id, groups) && groupDepth(group.id, groups) > 4) errors.push(issue(`${path}.groups[${index}]`, "exceeds the four-level group limit"));
  });

  if (!Array.isArray(perspective.placements)) {
    errors.push(issue(`${path}.placements`, "must be an array"));
    return;
  }
  if (perspective.placements.length > 2000) errors.push(issue(`${path}.placements`, "cannot contain more than 2000 placements"));
  uniqueIds(perspective.placements, `${path}.placements`, errors);
  perspective.placements.forEach((placement, index) => {
    const placementPath = `${path}.placements[${index}]`;
    if (!groupIds.has(placement.groupId)) errors.push(issue(`${placementPath}.groupId`, `does not resolve: ${placement.groupId}`));
    const ref = placement.recordRef;
    if (!isPlainObject(ref) || !sourceIds.has(ref.sourceId)) {
      errors.push(issue(`${placementPath}.recordRef.sourceId`, "does not resolve"));
      return;
    }
    const recordSet = recordSets.get(ref.sourceId);
    if (recordSet && !recordSet.records.some((record) => record.id === ref.recordId)) errors.push(issue(`${placementPath}.recordRef.recordId`, `does not resolve: ${ref.recordId}`));
  });
}

export function validateCanvasDocument(document, recordSets = new Map()) {
  const errors = [];
  if (!isPlainObject(document)) return [issue("$", "must be an object")];
  if (document.schemaVersion !== 1) errors.push(issue("schemaVersion", "must equal 1"));
  if (!validId(document.id)) errors.push(issue("id", "must be a stable Slate identifier"));
  if (typeof document.title !== "string" || !document.title.trim() || document.title.length > 160) errors.push(issue("title", "must contain 1 to 160 characters"));
  if (document.mode !== "readonly") errors.push(issue("mode", "v1 supports readonly only"));
  validateSourceLink(document.source, "source", errors);
  const hasLegacyView = Array.isArray(document.groups) || Array.isArray(document.placements);
  const hasPerspectives = Array.isArray(document.perspectives);
  if (hasLegacyView && hasPerspectives) errors.push(issue("perspectives", "cannot be combined with top-level groups or placements"));
  if (!hasLegacyView && !hasPerspectives) errors.push(issue("perspectives", "or top-level groups and placements are required"));

  if (!Array.isArray(document.recordSources) || !document.recordSources.length) errors.push(issue("recordSources", "must contain at least one source"));
  const sourceIds = uniqueIds(document.recordSources || [], "recordSources", errors);
  (document.recordSources || []).forEach((source, index) => {
    if (typeof source.path !== "string" || !source.path.trim() || source.path.includes("\\") || source.path.includes("..") || /^(?:[a-z]+:|\/)/i.test(source.path)) {
      errors.push(issue(`recordSources[${index}].path`, "must be a normalized host-relative path"));
    }
  });

  const perspectives = canvasPerspectives(document);
  const perspectiveIds = uniqueIds(perspectives, "perspectives", errors);
  if (document.perspectives && !perspectiveIds.has(document.defaultPerspectiveId)) errors.push(issue("defaultPerspectiveId", `does not resolve: ${document.defaultPerspectiveId}`));
  perspectives.forEach((perspective, index) => validatePerspective(perspective, document.perspectives ? `perspectives[${index}]` : "defaultPerspective", sourceIds, recordSets, errors));
  return errors;
}

export function resolveCanvasRecords(document, recordSets, perspectiveId) {
  const indexes = new Map([...recordSets].map(([sourceId, recordSet]) => [sourceId, new Map(recordSet.records.map((record) => [record.id, record]))]));
  return canvasPerspective(document, perspectiveId).placements.map((placement) => ({ ...placement, record: indexes.get(placement.recordRef.sourceId)?.get(placement.recordRef.recordId) }));
}

const CARD = {
  padding: 9,
  gap: 7,
  borderX: 4,
  borderY: 2,
  minWidth: 132,
  maxWidth: 244,
  eyebrowFont: 8,
  eyebrowLine: 10,
  titleFont: 11,
  titleLine: 15,
  contextFont: 9,
  contextLine: 12,
  rowGap: 5,
};

const GROUP_BOX = {
  padding: 10,
  border: 1,
  gap: 10,
  rootGap: 26,
  headerTop: 9,
  headerBottom: 7,
  headerGap: 3,
  headerTitleLine: 18,
  headerNestedTitleLine: 16,
  headerDescriptionLine: 12,
  markWidth: 14,
  countWidth: 32,
  minWidth: 148,
};

const NARROW_CHARACTERS = new Set([..." iltfjrI.,:;'`|!()[]{}-"]);
const WIDE_CHARACTERS = new Set([..."mwMW@%&"]);

function characterWidth(character) {
  if (character === " ") return 0.27;
  if (NARROW_CHARACTERS.has(character)) return 0.34;
  if (WIDE_CHARACTERS.has(character)) return 0.92;
  if (character >= "A" && character <= "Z") return 0.67;
  if (character >= "0" && character <= "9") return 0.56;
  return 0.53;
}

// Deterministic, DOM-free estimate. Calibrated against the Slate UI font stack and
// deliberately biased high so a measured width is never narrower than the painted text.
const TEXT_SAFETY = 1.06;

function textWidth(text, fontSize) {
  let width = 0;
  for (const character of String(text ?? "")) width += characterWidth(character) * fontSize;
  return width * TEXT_SAFETY;
}

function wrappedLineCount(text, fontSize, availableWidth) {
  const words = String(text ?? "").split(/\s+/).filter(Boolean);
  if (!words.length || availableWidth <= 0) return 1;
  const spaceWidth = characterWidth(" ") * fontSize;
  let lines = 1;
  let used = 0;
  for (const word of words) {
    const width = textWidth(word, fontSize);
    if (width > availableWidth) {
      if (used > 0) lines += 1;
      lines += Math.ceil(width / availableWidth) - 1;
      used = width % availableWidth;
      continue;
    }
    const projected = used ? used + spaceWidth + width : width;
    if (projected > availableWidth) {
      lines += 1;
      used = width;
    } else {
      used = projected;
    }
  }
  return lines;
}

function measureRecordCard(record) {
  const title = record?.title || record?.id || "Record";
  const eyebrow = [record?.id, record?.kind].filter(Boolean).join("  ");
  const context = record?.eyebrow || "";
  const chrome = CARD.padding * 2 + CARD.borderX;
  const naturalTitle = textWidth(title, CARD.titleFont);
  const eyebrowWidth = textWidth(eyebrow, CARD.eyebrowFont);
  const contextWidth = context ? textWidth(context, CARD.contextFont) : 0;
  const contentCap = CARD.maxWidth - chrome;
  const contentWidth = Math.min(contentCap, Math.max(naturalTitle, eyebrowWidth, contextWidth));
  const width = Math.round(Math.max(CARD.minWidth, contentWidth + chrome));
  const titleLines = wrappedLineCount(title, CARD.titleFont, width - chrome);
  const height = Math.round(
    CARD.padding * 2
    + CARD.borderY
    + CARD.eyebrowLine
    + CARD.rowGap
    + titleLines * CARD.titleLine
    + (context ? CARD.rowGap + CARD.contextLine : 0),
  );
  return { width, height };
}

function measureGroupHeader(group, depth) {
  const titleFont = depth === 1 ? 14 : 12;
  const titleLine = depth === 1 ? GROUP_BOX.headerTitleLine : GROUP_BOX.headerNestedTitleLine;
  const width = GROUP_BOX.markWidth
    + textWidth(group?.title, titleFont)
    + GROUP_BOX.countWidth
    + GROUP_BOX.padding * 2;
  const height = GROUP_BOX.headerTop
    + titleLine
    + (group?.description ? GROUP_BOX.headerGap + GROUP_BOX.headerDescriptionLine : 0)
    + GROUP_BOX.headerBottom;
  return { width: Math.round(width), height: Math.round(height) };
}

function raiseSkyline(segments, x, width, y) {
  const end = x + width;
  const next = [];
  for (const segment of segments) {
    const segmentEnd = segment.x + segment.width;
    if (segmentEnd <= x + 0.01 || segment.x >= end - 0.01) {
      next.push(segment);
      continue;
    }
    if (segment.x < x - 0.01) next.push({ x: segment.x, width: x - segment.x, y: segment.y });
    if (segmentEnd > end + 0.01) next.push({ x: end, width: segmentEnd - end, y: segment.y });
  }
  next.push({ x, width, y });
  next.sort((left, right) => left.x - right.x);
  const merged = [];
  for (const segment of next) {
    const last = merged[merged.length - 1];
    if (last && Math.abs(last.y - segment.y) < 0.01 && Math.abs(last.x + last.width - segment.x) < 0.01) last.width += segment.width;
    else merged.push({ ...segment });
  }
  return merged;
}

function packBoxes(boxes, maxWidth, gap) {
  if (!boxes.length) return { placed: [], width: 0, height: 0 };
  const limit = Math.max(maxWidth, Math.max(...boxes.map((box) => box.width))) + gap;
  let segments = [{ x: 0, width: limit, y: 0 }];
  const placed = [];
  for (const box of boxes) {
    const width = box.width + gap;
    const height = box.height + gap;
    let best = null;
    for (let index = 0; index < segments.length; index += 1) {
      const x = segments[index].x;
      if (x + width > limit + 0.01) break;
      let y = 0;
      let remaining = width;
      let scan = index;
      while (scan < segments.length && remaining > 0.01) {
        y = Math.max(y, segments[scan].y);
        remaining -= segments[scan].width;
        scan += 1;
      }
      if (remaining > 0.01) continue;
      if (!best || y < best.y - 0.01) best = { x, y };
    }
    if (!best) best = { x: 0, y: Math.max(...segments.map((segment) => segment.y)) };
    placed.push({ ...box, x: Math.round(best.x), y: Math.round(best.y) });
    segments = raiseSkyline(segments, best.x, width, best.y + height);
  }
  return {
    placed,
    width: Math.max(...placed.map((item) => item.x + item.width)),
    height: Math.max(...placed.map((item) => item.y + item.height)),
  };
}

function packWidth(boxes, gap, columnsHint, cap) {
  if (!boxes.length) return 0;
  const widest = Math.max(...boxes.map((box) => box.width));
  if (boxes.length === 1) return widest;
  const area = boxes.reduce((sum, box) => sum + (box.width + gap) * (box.height + gap), 0);
  const balanced = Math.sqrt(area * 2.1);
  const hinted = columnsHint ? columnsHint * (widest + gap) : 0;
  return Math.max(widest, Math.min(cap, Math.max(balanced, hinted)));
}

function ordered(items) {
  return [...items].sort((left, right) => (left.order ?? Number.MAX_SAFE_INTEGER) - (right.order ?? Number.MAX_SAFE_INTEGER) || left.title?.localeCompare(right.title || "") || left.id.localeCompare(right.id));
}

// Layout is a left-to-right tree, not nested boxes. Past two levels a box inside a box
// stops being readable at a glance: the eye cannot tell containment from adjacency, and
// every extra level steals width from the content. Groups and records are drawn as
// separate cards joined by connecting lines, so the structure is carried by the lines.
//
// Spacing narrows with depth. Top-level branches sit far apart so the major divisions
// read first; deeper siblings tighten, so a subtree reads as one cluster rather than as
// more separate branches.
const TREE = {
  levelGap: [168, 128, 100, 80, 66, 56],
  siblingGap: [96, 56, 34, 22, 16, 13],
  recordColumns: 3,
  groupMinWidth: 176,
  groupMaxWidth: 300,
  // A group is the box its records sit in. There is no separate node standing for the
  // view or section: the named box is the view or section, and the records it holds are
  // drawn inside it. Child groups are boxes of their own, joined by a connecting line.
  // The left inset clears the tone border so records line up with the header text.
  recordInsetLeft: 14,
  recordInset: 12,
};

function levelGap(depth) {
  return TREE.levelGap[Math.min(Math.max(depth, 0), TREE.levelGap.length - 1)];
}

function siblingGap(depth) {
  return TREE.siblingGap[Math.min(Math.max(depth, 0), TREE.siblingGap.length - 1)];
}

// A group box is measured to hold its own header and its own records. An empty group is
// header-sized; a group holding records grows to enclose them.
function measureGroupCard(group, depth, grid) {
  const header = measureGroupHeader(group, depth);
  const headerWidth = Math.min(TREE.groupMaxWidth, Math.max(TREE.groupMinWidth, header.width));
  const recordsWidth = grid.height ? grid.width + TREE.recordInsetLeft + TREE.recordInset : 0;
  return {
    width: Math.round(Math.max(headerWidth, recordsWidth)),
    height: Math.round(header.height + (grid.height ? grid.height + TREE.recordInset : 0) + GROUP_BOX.border * 2),
    headerHeight: header.height,
  };
}

export function layoutCanvas(document, recordSets, perspectiveId, options = {}) {
  const perspective = canvasPerspective(document, perspectiveId);
  const resolvedPlacements = resolveCanvasRecords(document, recordSets, perspective.id);
  const placementsByGroup = Map.groupBy(resolvedPlacements, (placement) => placement.groupId);
  const childGroups = Map.groupBy(perspective.groups.filter((group) => group.parentId), (group) => group.parentId);
  const groupById = new Map(perspective.groups.map((group) => [group.id, group]));
  const recordColumns = perspective.presentation?.recordColumns || TREE.recordColumns;
  const collapsed = new Set(options.collapsed ?? []);
  const nodes = [];
  const connectors = [];

  // Connectors name the two nodes they join rather than carrying a finished path. The
  // renderer derives the curve from wherever those nodes currently are, so a line follows
  // its nodes through an animation instead of snapping to the final layout.
  function connect(id, from, to) {
    connectors.push({ id, from, to });
  }

  function countDescendantPlacements(groupId) {
    return (placementsByGroup.get(groupId)?.length || 0)
      + (childGroups.get(groupId) || []).reduce((sum, child) => sum + countDescendantPlacements(child.id), 0);
  }

  function countDescendantGroups(groupId) {
    return (childGroups.get(groupId) || []).reduce((sum, child) => sum + 1 + countDescendantGroups(child.id), 0);
  }

  // Tone inherits down the whole ancestor chain, not just from the immediate parent.
  // A document usually declares a tone on top-level groups only, so resolving one level
  // dropped every group at depth 2 or deeper to neutral and flattened the hierarchy.
  const resolvedTones = new Map();
  function resolveTone(groupId) {
    if (groupId == null) return "neutral";
    if (resolvedTones.has(groupId)) return resolvedTones.get(groupId);
    const group = groupById.get(groupId);
    const tone = group?.tone || resolveTone(group?.parentId ?? null) || "neutral";
    resolvedTones.set(groupId, tone);
    return tone;
  }

  function build(groupId, depth) {
    const group = groupById.get(groupId);
    const isCollapsed = collapsed.has(groupId);
    const hiddenRecords = countDescendantPlacements(groupId);
    const hiddenAreas = countDescendantGroups(groupId);
    const hasBranch = hiddenRecords > 0 || hiddenAreas > 0;
    const emptyGrid = { placed: [], width: 0, height: 0 };

    if (isCollapsed) {
      const card = measureGroupCard(group, depth, emptyGrid);
      return {
        group,
        depth,
        card,
        grid: emptyGrid,
        children: [],
        collapsed: true,
        hasBranch,
        hiddenRecords,
        hiddenAreas,
        subtreeHeight: card.height,
      };
    }

    const records = ordered(placementsByGroup.get(groupId) || []).map((placement) => ({
      placement,
      ...measureRecordCard(placement.record),
    }));
    const grid = records.length
      ? packBoxes(records, packWidth(records, CARD.gap, recordColumns, recordColumns * CARD.maxWidth), CARD.gap)
      : emptyGrid;
    const card = measureGroupCard(group, depth, grid);
    const children = ordered(childGroups.get(groupId) || []).map((child) => build(child.id, depth + 1));

    const gap = siblingGap(depth + 1);
    const branchHeight = children.length
      ? children.reduce((sum, child) => sum + child.subtreeHeight, 0) + gap * (children.length - 1)
      : 0;

    return {
      group,
      depth,
      card,
      grid,
      children,
      collapsed: false,
      hasBranch,
      hiddenRecords: 0,
      hiddenAreas: 0,
      subtreeHeight: Math.max(card.height, branchHeight),
    };
  }

  // Every depth gets one column, wide enough for the widest box in it, so boxes line up
  // and the connecting lines stay readable instead of crossing at random angles.
  function collectColumnWidths(node, widths) {
    widths[node.depth] = Math.max(widths[node.depth] ?? 0, node.card.width);
    for (const child of node.children) collectColumnWidths(child, widths);
  }

  function place(node, yTop, columnX) {
    const y = Math.round(yTop + (node.subtreeHeight - node.card.height) / 2);
    const box = { x: columnX[node.depth], y, width: node.card.width, height: node.card.height };
    const tone = node.group.tone || resolveTone(node.group.parentId ?? null) || "neutral";

    // Pushed before its own records so the box paints behind the cards it holds.
    nodes.push({
      id: node.group.id,
      type: "slateGroup",
      position: { x: box.x, y: box.y },
      selectable: true,
      draggable: false,
      width: node.card.width,
      height: node.card.height,
      style: { width: node.card.width, height: node.card.height },
      data: {
        title: node.group.title,
        description: node.group.description,
        tone,
        count: countDescendantPlacements(node.group.id),
        depth: node.depth,
        level: node.group.level,
        route: node.group.route,
        role: node.group.role,
        sections: node.group.sections,
        collapsed: node.collapsed,
        hasBranch: node.hasBranch,
        hiddenRecords: node.hiddenRecords,
        hiddenAreas: node.hiddenAreas,
        holdsRecords: node.grid.placed.length,
      },
    });

    for (const card of node.grid.placed) {
      nodes.push({
        id: card.placement.id,
        type: "slateRecord",
        position: {
          x: Math.round(box.x + TREE.recordInsetLeft + card.x),
          y: Math.round(box.y + node.card.headerHeight + card.y),
        },
        selectable: true,
        draggable: false,
        width: card.width,
        height: card.height,
        style: { width: card.width, height: card.height },
        data: { ...card.placement.record, placementId: card.placement.id, tone },
      });
    }

    const gap = siblingGap(node.depth + 1);
    let cursor = yTop;
    for (const child of node.children) {
      place(child, cursor, columnX);
      connect(`${node.group.id}--${child.group.id}`, node.group.id, child.group.id);
      cursor += child.subtreeHeight + gap;
    }

    return box;
  }

  const roots = ordered(perspective.groups.filter((group) => !group.parentId)).map((group) => build(group.id, 0));
  const widths = [];
  for (const root of roots) collectColumnWidths(root, widths);
  const columnX = [];
  let offset = 0;
  for (let depth = 0; depth < widths.length; depth += 1) {
    columnX[depth] = offset;
    offset += (widths[depth] ?? 0) + levelGap(depth);
  }

  let rootCursor = 0;
  for (const root of roots) {
    place(root, rootCursor, columnX);
    rootCursor += root.subtreeHeight + siblingGap(0);
  }

  return { nodes, connectors };
}
