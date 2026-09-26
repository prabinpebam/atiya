import { createContext, useContext, useEffect, useId, useRef, useState } from "react";
import {
  Background,
  BackgroundVariant,
  Handle,
  MiniMap,
  Position,
  ReactFlow,
  ReactFlowProvider,
  ViewportPortal,
  useReactFlow,
} from "@xyflow/react";

// The tree's connecting lines need anchor points. They are visually hidden and never
// interactive: this canvas is read-only and nothing is connected by hand.
function TreeHandles() {
  return (
    <>
      <Handle type="target" position={Position.Left} isConnectable={false} className="canvas-handle" />
      <Handle type="source" position={Position.Right} isConnectable={false} className="canvas-handle" />
    </>
  );
}
import {
  Check,
  ChevronDown,
  ChevronRight,
  ChevronsDownUp,
  ChevronsUpDown,
  ExternalLink,
  Focus,
  Fullscreen,
  LocateFixed,
  Map as MapIcon,
  Maximize2,
  Minus,
  Moon,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  Search,
  Sun,
  PanelsTopLeft,
  X,
  ZoomIn,
} from "lucide-react";
import { canvasPerspective, canvasPerspectives, layoutCanvas, validateCanvasDocument, validateRecordSet } from "./domain.mjs";
import "@xyflow/react/dist/style.css";
import "./canvas.css";

const nodeTypes = {
  slateGroup: GroupNode,
  slateRecord: RecordNode,
};

const THEME_ORDER = ["light", "dark", "auto"];
const HOST_ROOT = new URL("../../", window.location.href);

function IconButton({ label, children, disabled = false, pressed, onClick, shortcut }) {
  return (
    <button
      className="canvas-icon-button"
      type="button"
      aria-label={label}
      aria-pressed={pressed}
      disabled={disabled}
      onClick={onClick}
      title={shortcut ? `${label} (${shortcut})` : label}
    >
      {children}
    </button>
  );
}

function PerspectiveMenu({ items, value, onChange }) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef(null);
  const optionRefs = useRef(new Map());
  const typeaheadRef = useRef({ value: "", timer: null });
  const listboxId = useId();
  const selectedIndex = Math.max(0, items.findIndex((item) => item.id === value));
  const selectedItem = items[selectedIndex];

  function focusOption(index) {
    const nextIndex = (index + items.length) % items.length;
    optionRefs.current.get(items[nextIndex].id)?.focus();
  }

  function openMenu(index = selectedIndex) {
    setOpen(true);
    requestAnimationFrame(() => focusOption(index));
  }

  function closeMenu({ restoreFocus = false } = {}) {
    setOpen(false);
    if (restoreFocus) requestAnimationFrame(() => triggerRef.current?.focus());
  }

  function selectItem(item) {
    if (item.id !== value) onChange(item.id);
    closeMenu({ restoreFocus: true });
  }

  function handleTypeahead(key) {
    clearTimeout(typeaheadRef.current.timer);
    typeaheadRef.current.value += key.toLocaleLowerCase();
    const match = items.find((item) => item.title.toLocaleLowerCase().startsWith(typeaheadRef.current.value));
    if (match) optionRefs.current.get(match.id)?.focus();
    typeaheadRef.current.timer = setTimeout(() => { typeaheadRef.current.value = ""; }, 500);
  }

  function onTriggerKeyDown(event) {
    if (["ArrowDown", "ArrowUp", "Home", "End", "Enter", " "].includes(event.key)) event.preventDefault();
    if (event.key === "ArrowDown" || event.key === "Enter" || event.key === " ") openMenu(selectedIndex);
    else if (event.key === "ArrowUp") openMenu(selectedIndex - 1);
    else if (event.key === "Home") openMenu(0);
    else if (event.key === "End") openMenu(items.length - 1);
  }

  function onOptionKeyDown(event, index) {
    if (["ArrowDown", "ArrowUp", "Home", "End", "Enter", " ", "Escape"].includes(event.key)) event.preventDefault();
    if (event.key === "ArrowDown") focusOption(index + 1);
    else if (event.key === "ArrowUp") focusOption(index - 1);
    else if (event.key === "Home") focusOption(0);
    else if (event.key === "End") focusOption(items.length - 1);
    else if (event.key === "Enter" || event.key === " ") selectItem(items[index]);
    else if (event.key === "Escape") closeMenu({ restoreFocus: true });
    else if (event.key === "Tab") closeMenu();
    else if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) handleTypeahead(event.key);
  }

  useEffect(() => {
    if (!open) return undefined;
    function onPointerDown(event) {
      if (!event.target.closest(".canvas-perspective")) closeMenu();
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  useEffect(() => () => clearTimeout(typeaheadRef.current.timer), []);

  return (
    <div className="canvas-perspective">
      <PanelsTopLeft aria-hidden="true" />
      <span className="canvas-perspective__label">View</span>
      <button
        ref={triggerRef}
        className="canvas-perspective__trigger"
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listboxId}
        onClick={() => open ? closeMenu() : openMenu()}
        onKeyDown={onTriggerKeyDown}
      >
        <span>{selectedItem.title}</span>
        <ChevronDown aria-hidden="true" />
      </button>
      {open ? (
        <div id={listboxId} className="canvas-perspective__listbox" role="listbox" aria-label="Canvas view">
          {items.map((item, index) => (
            <button
              key={item.id}
              ref={(element) => element ? optionRefs.current.set(item.id, element) : optionRefs.current.delete(item.id)}
              className="canvas-perspective__option"
              type="button"
              role="option"
              aria-selected={item.id === value}
              onClick={() => selectItem(item)}
              onKeyDown={(event) => onOptionKeyDown(event, index)}
            >
              <span>{item.title}</span>
              {item.id === value ? <Check aria-hidden="true" /> : null}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

// Node components are rendered by the flow library, so they reach canvas actions through
// context rather than by having callbacks threaded into every node's data.
const CanvasActions = createContext({ toggleCollapse: () => {} });

function GroupNode({ id, data, selected }) {
  const { toggleCollapse } = useContext(CanvasActions);
  const hidden = [
    data.hiddenAreas ? `${data.hiddenAreas} area${data.hiddenAreas === 1 ? "" : "s"}` : null,
    data.hiddenRecords ? `${data.hiddenRecords} record${data.hiddenRecords === 1 ? "" : "s"}` : null,
  ].filter(Boolean).join(" \u00b7 ");
  return (
    <section className={`canvas-group canvas-group--depth-${data.depth} canvas-tone--${data.tone}${selected ? " is-selected" : ""}${data.collapsed ? " is-collapsed" : ""}${data.holdsRecords ? " holds-records" : ""}`}>
      <header className="canvas-group__header">
        {data.hasBranch ? (
          <button
            type="button"
            className="canvas-group__toggle nodrag nopan"
            aria-expanded={!data.collapsed}
            aria-label={`${data.collapsed ? "Expand" : "Collapse"} ${data.title}${data.collapsed && hidden ? `, ${hidden} hidden` : ""}`}
            title={data.collapsed ? `Expand \u2014 ${hidden} hidden` : "Collapse"}
            onClick={(event) => { event.stopPropagation(); toggleCollapse(id); }}
          >
            {data.collapsed ? <ChevronRight aria-hidden="true" /> : <ChevronDown aria-hidden="true" />}
          </button>
        ) : (
          <span className="canvas-group__mark" aria-hidden="true" />
        )}
        <div className="canvas-group__heading">
          <h2>{data.title}</h2>
          {data.collapsed && hidden
            ? <p className="canvas-group__hidden">{hidden} hidden</p>
            : data.description ? <p>{data.description}</p> : null}
        </div>
        <span className="canvas-group__count">{data.count}</span>
      </header>
    </section>
  );
}

function RecordNode({ data, selected }) {
  const state = selected ? " is-selected" : data.related ? " is-related" : "";
  return (
    <article className={`canvas-record canvas-tone--${data.tone}${state}`}>
      <TreeHandles />
      <div className="canvas-record__eyebrow">
        <span>{data.id}</span>
        <span>{data.kind}</span>
      </div>
      <p className="canvas-record__title">{data.title}</p>
      {data.eyebrow ? <p className="canvas-record__context">{data.eyebrow}</p> : null}
    </article>
  );
}

function resolveTheme(preference) {
  if (preference === "light" || preference === "dark") return preference;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function applyTheme(preference, persist = true) {
  if (persist) localStorage.setItem("slate-theme-pref", preference);
  const theme = resolveTheme(preference);
  document.documentElement.dataset.theme = theme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", theme === "dark" ? "#1c1d2a" : "#f7f5f0");
  return theme;
}

function normalizedCanvasPath() {
  const path = new URLSearchParams(window.location.search).get("document") || "";
  if (!path.endsWith(".canvas.json") || path.includes("\\") || path.includes("..") || /^(?:[a-z]+:|\/)/i.test(path)) {
    throw new Error("The Canvas document path is missing or unsafe.");
  }
  return path;
}

async function loadJson(url, label) {
  const response = await fetch(url, { cache: "no-cache" });
  if (!response.ok) throw new Error(`${label} could not be loaded (${response.status}).`);
  return response.json();
}

async function loadCanvas() {
  const path = normalizedCanvasPath();
  const documentUrl = new URL(path, HOST_ROOT);
  const canvasDocument = await loadJson(documentUrl, "Canvas document");
  const recordSets = new Map();
  for (const source of canvasDocument.recordSources || []) {
    const recordSet = await loadJson(new URL(source.path, documentUrl), `Record source ${source.id}`);
    const sourceErrors = validateRecordSet(recordSet);
    if (sourceErrors.length) throw new Error(`Record source ${source.id} is invalid: ${sourceErrors[0].path} ${sourceErrors[0].message}`);
    if (recordSet.id !== source.id) throw new Error(`Record source ${source.id} returned the mismatched ID ${recordSet.id}.`);
    recordSets.set(source.id, recordSet);
  }
  const documentErrors = validateCanvasDocument(canvasDocument, recordSets);
  if (documentErrors.length) throw new Error(`Canvas document is invalid: ${documentErrors[0].path} ${documentErrors[0].message}`);
  return { canvasDocument, recordSets, path };
}

function attachThemeStylesheet(config) {
  const path = config.themeStylesheet;
  if (!path || path.includes("\\") || path.includes("..") || /^(?:[a-z]+:|\/)/i.test(path)) return;
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = new URL(path, HOST_ROOT).href;
  document.head.appendChild(link);
}

function LoadingState({ error }) {
  return (
    <main className="canvas-state">
      <div className="canvas-state__mark" aria-hidden="true">{error ? <X /> : <MapIcon />}</div>
      <h1>{error ? "Canvas unavailable" : "Opening Canvas"}</h1>
      <p>{error || "Loading and validating structured information..."}</p>
      {error ? <a href={HOST_ROOT.href}>Return to documentation</a> : null}
    </main>
  );
}

function App() {
  const [loaded, setLoaded] = useState(null);
  const [error, setError] = useState("");
  const [themePreference, setThemePreference] = useState("auto");

  useEffect(() => {
    let active = true;
    async function initialize() {
      try {
        let config = {};
        try { config = await loadJson(new URL("slate.config.json", HOST_ROOT), "Slate configuration"); } catch { /* Configuration is optional. */ }
        if (!active) return;
        attachThemeStylesheet(config);
        const preference = localStorage.getItem("slate-theme-pref") || config.defaultTheme || "auto";
        setThemePreference(preference);
        applyTheme(preference, false);
        const result = await loadCanvas();
        if (!active) return;
        document.title = `${result.canvasDocument.title} - ${config.projectName || "Slate Canvas"}`;
        setLoaded(result);
      } catch (caught) {
        if (active) setError(caught instanceof Error ? caught.message : String(caught));
      }
    }
    initialize();
    return () => { active = false; };
  }, []);

  if (!loaded || error) return <LoadingState error={error} />;
  return (
    <ReactFlowProvider>
      <CanvasWorkspace loaded={loaded} themePreference={themePreference} setThemePreference={setThemePreference} />
    </ReactFlowProvider>
  );
}

function CanvasWorkspace({ loaded, themePreference, setThemePreference }) {
  const { canvasDocument, recordSets } = loaded;
  const perspectives = canvasPerspectives(canvasDocument);
  const [perspectiveId, setPerspectiveId] = useState(canvasDocument.defaultPerspectiveId || perspectives[0].id);
  const perspective = canvasPerspective(canvasDocument, perspectiveId);
  const [collapsed, setCollapsed] = useState(() => new Set());
  const [graph, setGraph] = useState(() => layoutCanvas(canvasDocument, recordSets, perspectiveId, { collapsed: [] }));
  const nodes = graph.nodes;
  const connectors = graph.connectors;
  const settleRef = useRef(0);
  const paneRef = useRef(null);
  const [settling, setSettling] = useState(false);
  function setNodes(updater) {
    setGraph((current) => ({ ...current, nodes: typeof updater === "function" ? updater(current.nodes) : updater }));
  }
  const [selection, setSelection] = useState([]);
  const [outlineOpen, setOutlineOpen] = useState(() => window.innerWidth > 700);
  const [minimapOpen, setMinimapOpen] = useState(() => window.innerWidth > 900);
  const [query, setQuery] = useState("");
  const [zoom, setZoom] = useState(1);
  const [fullscreen, setFullscreen] = useState(Boolean(document.fullscreenElement));
  const [searchOpen, setSearchOpen] = useState(false);
  const searchRef = useRef(null);
  const flow = useReactFlow();
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const duration = reducedMotion ? 0 : 450;
  const rootGroups = perspective.groups.filter((group) => !group.parentId);
  const selectedNode = selection.length === 1 ? selection[0] : null;
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const searchResults = normalizedQuery
    ? nodes.filter((node) => node.data.title?.toLocaleLowerCase().includes(normalizedQuery) || node.data.id?.toLocaleLowerCase().includes(normalizedQuery)).slice(0, 20)
    : [];

  // React Flow's own fitView needs every node to have been measured in the DOM. This canvas
  // renders read-only cards whose exact size already comes out of the layout, and it never
  // triggers that measurement pass, so fitView silently did nothing. Framing is computed
  // from the layout geometry instead. That also keeps it correct while a collapse or expand
  // is still settling, and it lets the frame avoid the navigator panel that sits over the
  // left edge of the canvas.
  function fitToNodes(targetNodes, { padding = 48, maxZoom = 1, minZoom = 0.035, source = graph.nodes } = {}) {
    const pane = paneRef.current;
    if (!pane || !targetNodes.length) return;
    const rect = pane.getBoundingClientRect();
    const inset = outlineOpen ? 296 : 0;
    const viewWidth = rect.width - inset - padding * 2;
    const viewHeight = rect.height - padding * 2;
    if (viewWidth <= 0 || viewHeight <= 0) return;

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const target of targetNodes) {
      const node = source.find((item) => item.id === target.id) ?? target;
      minX = Math.min(minX, node.position.x);
      minY = Math.min(minY, node.position.y);
      maxX = Math.max(maxX, node.position.x + (node.width ?? 0));
      maxY = Math.max(maxY, node.position.y + (node.height ?? 0));
    }
    const width = Math.max(1, maxX - minX);
    const height = Math.max(1, maxY - minY);
    const zoom = Math.min(maxZoom, Math.max(minZoom, Math.min(viewWidth / width, viewHeight / height)));

    flow.setViewport(
      {
        x: inset + padding + (viewWidth - width * zoom) / 2 - minX * zoom,
        y: padding + (viewHeight - height * zoom) / 2 - minY * zoom,
        zoom,
      },
      { duration },
    );
  }

  function focusNodes(targetNodes) {
    if (!targetNodes.length) return;
    fitToNodes(targetNodes, { padding: targetNodes.length === 1 ? 180 : 64, maxZoom: 1.35 });
  }

  // Selecting is separate from focusing. A click selects what the reader pointed at and
  // leaves the viewport alone; the outline and search also move the viewport.
  //
  // A record may be placed in more than one group when the same capability is reachable
  // from more than one place. Selecting one placement marks the others as related, so a
  // repeat is visibly a repeat rather than looking like a second capability.
  function selectNode(nodeId) {
    const node = flow.getNode(nodeId);
    if (!node) return null;
    const recordId = node.type === "slateRecord" ? node.data?.id : null;
    setNodes((current) => current.map((item) => {
      const selected = item.id === nodeId;
      const related = Boolean(recordId) && !selected && item.type === "slateRecord" && item.data?.id === recordId;
      if (item.selected === selected && Boolean(item.data?.related) === related) return item;
      return { ...item, selected, data: { ...item.data, related } };
    }));
    setSelection([node]);
    setSearchOpen(false);
    return node;
  }

  function clearSelection() {
    setNodes((current) => current.map((item) => (item.selected || item.data?.related
      ? { ...item, selected: false, data: { ...item.data, related: false } }
      : item)));
    setSelection([]);
  }

  function focusNode(nodeId) {
    const node = selectNode(nodeId);
    if (!node) return;
    focusNodes([node]);
  }

  // Collapsing and expanding move a lot of the canvas at once, so the change is animated
  // rather than snapped: surviving nodes glide to their new places, and the branch being
  // opened or closed grows out of, or folds back into, the node that was toggled.
  // Connectors are derived from live node positions, so the lines travel with them.
  // The node you toggled stays put on screen. Without this the canvas appears to jump,
  // because everything below the toggled branch shifts up or down around it.
  //
  // Motion is handled by CSS: surviving nodes glide to their new places on a transform
  // transition, new nodes fade in, and the connectors dip while the layout settles rather
  // than snapping to the new geometry a frame ahead of the cards they join.
  function applyCollapsed(nextCollapsed, anchorId, { fit = false } = {}) {
    const nextGraph = layoutCanvas(canvasDocument, recordSets, perspectiveId, { collapsed: [...nextCollapsed] });
    const before = graph.nodes.find((node) => node.id === anchorId)?.position;
    const after = nextGraph.nodes.find((node) => node.id === anchorId)?.position;
    setCollapsed(nextCollapsed);
    setGraph(nextGraph);
    if (!reducedMotion) {
      setSettling(true);
      clearTimeout(settleRef.current);
      settleRef.current = setTimeout(() => setSettling(false), 360);
    }

    // Collapsing or expanding one branch keeps that branch under the pointer, so the reader
    // does not lose their place. Collapsing or expanding everything changes the whole shape
    // of the canvas, so it reframes instead.
    if (fit) {
      fitAll(nextGraph.nodes);
      return;
    }
    if (before && after) {
      const viewport = flow.getViewport();
      flow.setViewport(
        {
          x: viewport.x - (after.x - before.x) * viewport.zoom,
          y: viewport.y - (after.y - before.y) * viewport.zoom,
          zoom: viewport.zoom,
        },
        { duration },
      );
    }
  }

  function toggleCollapse(groupId) {
    const next = new Set(collapsed);
    if (next.has(groupId)) next.delete(groupId); else next.add(groupId);
    applyCollapsed(next, groupId);
  }

  // Connector geometry comes from wherever the two nodes currently are, so the lines stay
  // attached through the collapse animation and fade out with the nodes they join.
  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  const connectorPaths = connectors.flatMap((connector) => {
    const from = nodeById.get(connector.from);
    const to = nodeById.get(connector.to);
    if (!from || !to) return [];
    const x1 = from.position.x + (from.width ?? from.style?.width ?? 0);
    const y1 = from.position.y + (from.height ?? from.style?.height ?? 0) / 2;
    const x2 = to.position.x;
    const y2 = to.position.y + (to.height ?? to.style?.height ?? 0) / 2;
    const bend = Math.max(16, (x2 - x1) * 0.5);
    return [{
      id: connector.id,
      d: `M${x1} ${y1} C${x1 + bend} ${y1}, ${x2 - bend} ${y2}, ${x2} ${y2}`,
      opacity: Math.min(from.style?.opacity ?? 1, to.style?.opacity ?? 1),
    }];
  });

  function collapseAll() {
    const branchIds = perspective.groups
      .filter((group) => perspective.groups.some((other) => other.parentId === group.id)
        || perspective.placements.some((placement) => placement.groupId === group.id))
      .map((group) => group.id);
    applyCollapsed(new Set(branchIds), branchIds[0], { fit: true });
  }

  function expandAll() {
    applyCollapsed(new Set(), [...collapsed][0], { fit: true });
  }

  function fitAll(nodeList = graph.nodes) {
    fitToNodes(nodeList, { padding: 56, source: nodeList });
  }

  function changePerspective(nextPerspectiveId) {
    const nextGraph = layoutCanvas(canvasDocument, recordSets, nextPerspectiveId);
    setPerspectiveId(nextPerspectiveId);
    setSelection([]);
    setQuery("");
    setSearchOpen(false);
    setGraph(nextGraph);
    fitAll(nextGraph.nodes);
  }

  function cycleTheme() {
    const next = THEME_ORDER[(THEME_ORDER.indexOf(themePreference) + 1) % THEME_ORDER.length];
    setThemePreference(next);
    applyTheme(next);
  }

  async function toggleFullscreen() {
    if (document.fullscreenElement) await document.exitFullscreen();
    else await document.documentElement.requestFullscreen();
  }

  // Framing runs straight from the committed layout rather than waiting for an animation
  // frame, so the canvas opens correctly framed even where frames are throttled.
  useEffect(() => {
    fitAll();
  }, []);

  useEffect(() => {
    function onFullscreen() { setFullscreen(Boolean(document.fullscreenElement)); }
    document.addEventListener("fullscreenchange", onFullscreen);
    return () => document.removeEventListener("fullscreenchange", onFullscreen);
  }, []);

  useEffect(() => {
    function onKeyDown(event) {
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return;
      if ((event.ctrlKey || event.metaKey) && event.key.toLocaleLowerCase() === "k") {
        event.preventDefault();
        searchRef.current?.focus();
      } else if (event.key === "0") fitAll();
      else if (event.key === "2" && event.shiftKey) focusNodes(selection);
      else if (event.key === "+" || event.key === "=") flow.zoomIn({ duration });
      else if (event.key === "-") flow.zoomOut({ duration });
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  });

  const themeIcon = themePreference === "light" ? <Sun /> : themePreference === "dark" ? <Moon /> : <Check />;
  const sourceHref = canvasDocument.source?.href ? new URL(`index.html#${canvasDocument.source.href}`, HOST_ROOT).href : null;

  return (
    <CanvasActions.Provider value={{ toggleCollapse }}>
    <main className="canvas-app">
      <header className="canvas-toolbar">
        <div className="canvas-toolbar__identity">
          <span className="canvas-toolbar__logo" aria-hidden="true"><MapIcon /></span>
          <div>
            <div className="canvas-toolbar__title-row">
              <h1>{canvasDocument.title}</h1>
              <span className="canvas-readonly">Read-only</span>
            </div>
            <p>{perspective.placements.length} placements in {rootGroups.length} groups</p>
          </div>
        </div>

        {perspectives.length > 1 ? (
          <PerspectiveMenu items={perspectives} value={perspectiveId} onChange={changePerspective} />
        ) : null}

        <div className="canvas-search">
          <Search aria-hidden="true" />
          <input
            ref={searchRef}
            value={query}
            onChange={(event) => { setQuery(event.target.value); setSearchOpen(true); }}
            onFocus={() => setSearchOpen(true)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && searchResults[0]) focusNode(searchResults[0].id);
              if (event.key === "Escape") { setQuery(""); setSearchOpen(false); event.currentTarget.blur(); }
            }}
            aria-label="Find a record or group"
            placeholder="Find records or groups"
          />
          {query ? <button type="button" aria-label="Clear search" onClick={() => { setQuery(""); searchRef.current?.focus(); }}><X /></button> : <kbd>Ctrl K</kbd>}
          {searchOpen && normalizedQuery ? (
            <div className="canvas-search__results" role="listbox">
              {searchResults.length ? searchResults.map((node) => (
                <button key={node.id} type="button" role="option" onClick={() => focusNode(node.id)}>
                  <span>{node.type === "slateGroup" ? "Group" : node.data.id}</span>
                  <strong>{node.data.title}</strong>
                  <ChevronRight aria-hidden="true" />
                </button>
              )) : <p>No matches</p>}
            </div>
          ) : null}
        </div>

        <div className="canvas-toolbar__actions">
          {sourceHref ? <a className="canvas-source-link" href={sourceHref} target="_blank" rel="noopener"><span>Source</span><ExternalLink /></a> : null}
          <IconButton label={`Theme: ${themePreference}`} onClick={cycleTheme}>{themeIcon}</IconButton>
          <IconButton label={fullscreen ? "Exit full screen" : "Enter full screen"} onClick={toggleFullscreen}>{fullscreen ? <Maximize2 /> : <Fullscreen />}</IconButton>
        </div>
      </header>

      <section ref={paneRef} className={settling ? "canvas-workspace is-settling" : "canvas-workspace"}>
        <ReactFlow
          nodes={nodes}
          edges={[]}
          nodeTypes={nodeTypes}
          defaultEdgeOptions={{ type: "smoothstep", pathOptions: { borderRadius: 14 }, style: { stroke: "var(--canvas-edge)", strokeWidth: 1.5 }, focusable: false, selectable: false }}
          elevateNodesOnSelect={false}
          colorMode={document.documentElement.dataset.theme === "dark" ? "dark" : "light"}
          nodesDraggable={false}
          nodesConnectable={false}
          elementsSelectable
          panOnDrag
          panOnScroll
          zoomOnScroll
          zoomOnPinch
          zoomOnDoubleClick={false}
          minZoom={0.025}
          maxZoom={2.5}
          selectionOnDrag={false}
          onMove={(_, viewport) => setZoom(viewport.zoom)}
          // No onNodesChange handler on purpose. Nodes here are positioned and sized by the
          // layout, never dragged or resized, and the connecting lines are drawn from that
          // same layout rather than from measured DOM boxes. Feeding React Flow's change
          // stream back into state made every measurement pass produce a new node array,
          // which produced another measurement pass: the canvas re-rendered continuously,
          // starving animation frames and leaving zoom and framing unable to settle.
          onSelectionChange={({ nodes: selected }) => setSelection(selected)}
          onNodeClick={(_, node) => selectNode(node.id)}
          onPaneClick={() => { setSearchOpen(false); clearSelection(); }}
          proOptions={{ hideAttribution: false }}
          aria-label={canvasDocument.title}
        >
          <Background variant={BackgroundVariant.Dots} gap={24} size={1.5} color="var(--canvas-grid)" />
          <ViewportPortal>
            <svg className="canvas-connectors" aria-hidden="true">
              {connectorPaths.map((connector) => (
                <path key={connector.id} d={connector.d} opacity={connector.opacity} />
              ))}
            </svg>
          </ViewportPortal>
          {minimapOpen ? <MiniMap className="canvas-minimap" pannable zoomable nodeStrokeWidth={2} maskColor="var(--canvas-minimap-mask)" /> : null}
        </ReactFlow>

        <aside className={`canvas-outline${outlineOpen ? " is-open" : ""}`} aria-label="Canvas groups">
          <div className="canvas-outline__head">
            <div><span>Navigator</span><strong>{perspective.title}</strong></div>
            <IconButton label="Close navigator" onClick={() => setOutlineOpen(false)}><PanelLeftClose /></IconButton>
          </div>
          <div className="canvas-outline__list">
            {rootGroups.map((group) => {
              const node = nodes.find((item) => item.id === group.id);
              return (
                <button type="button" key={group.id} onClick={() => focusNode(group.id)}>
                  <span className={`canvas-outline__tone canvas-tone-bg--${group.tone || "neutral"}`} aria-hidden="true" />
                  <span><strong>{group.title}</strong><small>{node?.data.count || 0} records</small></span>
                  <LocateFixed aria-hidden="true" />
                </button>
              );
            })}
          </div>
        </aside>

        {!outlineOpen ? (
          <div className="canvas-outline-trigger">
            <IconButton label="Open navigator" onClick={() => setOutlineOpen(true)}><PanelLeftOpen /></IconButton>
          </div>
        ) : null}

        <div className="canvas-controls" role="toolbar" aria-label="Canvas viewport controls">
          <IconButton label="Zoom in" shortcut="+" onClick={() => flow.zoomIn({ duration })}><Plus /></IconButton>
          <IconButton label="Zoom out" shortcut="-" onClick={() => flow.zoomOut({ duration })}><Minus /></IconButton>
          <span className="canvas-controls__zoom" aria-label={`Zoom ${Math.round(zoom * 100)} percent`}>{Math.round(zoom * 100)}%</span>
          <span className="canvas-controls__divider" />
          <IconButton label="Fit all" shortcut="0" onClick={() => fitAll()}><Maximize2 /></IconButton>
          <span className="canvas-controls__divider" />
          <IconButton label="Collapse all branches" onClick={collapseAll}><ChevronsDownUp /></IconButton>
          <IconButton label="Expand all branches" disabled={!collapsed.size} onClick={expandAll}><ChevronsUpDown /></IconButton>
          <IconButton label="Fit selection" shortcut="Shift 2" disabled={!selection.length} onClick={() => focusNodes(selection)}><Focus /></IconButton>
          <IconButton label="Actual size" onClick={() => flow.setViewport({ x: 80, y: 80, zoom: 1 }, { duration })}><ZoomIn /></IconButton>
          <span className="canvas-controls__divider" />
          <IconButton label={minimapOpen ? "Hide minimap" : "Show minimap"} pressed={minimapOpen} onClick={() => setMinimapOpen((current) => !current)}><MapIcon /></IconButton>
        </div>

        {selectedNode ? <DetailsPanel
          node={selectedNode}
          alsoIn={selectedNode.type === "slateRecord"
            ? nodes
              .filter((item) => item.type === "slateRecord" && item.id !== selectedNode.id && item.data?.id === selectedNode.data?.id)
              .map((item) => ({ id: item.id, title: perspective.groups.find((group) => group.id === item.parentId)?.title ?? item.parentId }))
            : []}
          onOpen={(nodeId) => focusNode(nodeId)}
          onClose={clearSelection}
        /> : null}
      </section>
    </main>
    </CanvasActions.Provider>
  );
}

function DetailsPanel({ node, onClose, alsoIn = [], onOpen }) {
  const isRecord = node.type === "slateRecord";
  const sourceHref = isRecord && node.data.source?.href ? new URL(`index.html#${node.data.source.href}`, HOST_ROOT).href : null;
  return (
    <aside className="canvas-details" aria-label="Selection details">
      <div className="canvas-details__head">
        <div><span>{isRecord ? node.data.kind : "Group"}</span><strong>{isRecord ? node.data.id : node.data.title}</strong></div>
        <IconButton label="Close details" onClick={onClose}><X /></IconButton>
      </div>
      {isRecord ? (
        <>
          <p className="canvas-details__title">{node.data.title}</p>
          {node.data.summary ? <p>{node.data.summary}</p> : null}
          {node.data.metadata?.length ? (
            <dl>{node.data.metadata.map((item) => <div key={`${item.label}-${item.value}`}><dt>{item.label}</dt><dd>{item.value}</dd></div>)}</dl>
          ) : null}
          {alsoIn.length ? (
            <div className="canvas-details__also">
              <h3>Also reached from</h3>
              <p>The same capability is placed in {alsoIn.length === 1 ? "one other group" : `${alsoIn.length} other groups`}.</p>
              <ul>{alsoIn.map((item) => <li key={item.id}><button type="button" onClick={() => onOpen?.(item.id)}>{item.title}</button></li>)}</ul>
            </div>
          ) : null}
          {sourceHref ? <a href={sourceHref} target="_blank" rel="noopener">Open source <ExternalLink /></a> : null}
        </>
      ) : (
        <>
          {node.data.description ? <p>{node.data.description}</p> : null}
          <dl>
            <div><dt>Records</dt><dd>{node.data.count}</dd></div>
            <div><dt>Level</dt><dd>{node.data.level || node.data.depth}</dd></div>
            {node.data.role ? <div><dt>Role</dt><dd>{node.data.role}</dd></div> : null}
            {node.data.route ? <div><dt>Route</dt><dd>{node.data.route}</dd></div> : null}
          </dl>
          {node.data.sections?.length ? (
            <div className="canvas-details__sections">
              <h3>Sections</h3>
              {node.data.sections.map((section) => <div key={section.id}><strong>{section.title}</strong>{section.purpose ? <p>{section.purpose}</p> : null}</div>)}
            </div>
          ) : null}
        </>
      )}
    </aside>
  );
}

export default App;