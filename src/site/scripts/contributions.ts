import { calendarKey, columnAt, contributionScene, ISOMETRIC, readableMonths, returnOrientation, tumble, type ContributionData, type ContributionScene, type Orientation, type Point } from './contributionRules';

const started = new WeakSet<HTMLElement>();

/**
 * Canvas uses the site's resolved colour roles, including a library example's own colour scheme. Sets up one chart,
 * once: the hero's own script and a screen that swaps a chart in (edit mode's preview) may both ask.
 */
export function setupContributions(root: HTMLElement, signal: AbortSignal) {
  if (started.has(root)) return;
  started.add(root);
  const canvas = root.querySelector<HTMLCanvasElement>('[data-contribution-canvas]')!;
  const context = canvas.getContext('2d');
  const status = root.querySelector<HTMLElement>('[data-contribution-status]')!;
  if (!context) {
    status.textContent = 'The interactive calendar could not start. Open the GitHub profile beside the chart title to read daily activity.';
    status.hidden = false;
    return;
  }
  const ctx = context;
  const data: ContributionData = JSON.parse(root.querySelector<HTMLScriptElement>('[data-contribution-data]')!.textContent!);
  const tip = root.querySelector<HTMLElement>('[data-contribution-tip]')!;
  const date = tip.querySelector<HTMLTimeElement>('time')!;
  const count = tip.querySelector<HTMLElement>('strong')!;
  const selection = root.querySelector<HTMLElement>('[data-contribution-selection]')!;
  const buttons = [...root.querySelectorAll<HTMLButtonElement>('[data-contribution-mode]')];
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const theme = matchMedia('(prefers-color-scheme: dark)');
  const palette = [...root.querySelectorAll<HTMLElement>('[data-contribution-colour]')];
  const labelStyle = root.querySelector<HTMLElement>('[data-contribution-label-style]')!;
  const dateFormat = new Intl.DateTimeFormat('en', { dateStyle: 'full', timeZone: 'UTC' });
  let colours: string[] = [];
  let ink = '';
  let shade = '';
  let labelInk = '';
  let labelFont = '';
  let labelHeight = 0;
  let labelGap = 0;
  let glow = 0;
  let duration = 0;
  let width = 1, height = 1;
  let mode: '2d' | '3d' = '3d';
  let view: Orientation = { ...ISOMETRIC };
  let scene: ContributionScene = { columns: [], months: [], width, height };
  let active: number | null = null;
  let selected = data.days.length - 1;
  let drag: { id: number; at: Point; moved: boolean } | null = null;
  let animation = 0;
  let alive = true;

  const path = (points: Point[]) => {
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (const p of points.slice(1)) ctx.lineTo(p.x, p.y);
    ctx.closePath();
  };
  const draw = () => {
    scene = contributionScene(data.days, width, height, mode, view);
    ctx.clearRect(0, 0, width, height);
    for (const col of scene.columns) {
      ctx.save();
      if (col.index === active) {
        ctx.shadowColor = colours[col.level];
        ctx.shadowBlur = glow;
      }
      for (let i = 0; i < col.faces.length; i++) {
        path(col.faces[i]);
        ctx.fillStyle = colours[col.level];
        ctx.fill();
        if (i < col.faces.length - 1) {
          ctx.fillStyle = shade;
          ctx.globalAlpha = i === 0 ? 0.3 : 0.15;
          ctx.fill();
          ctx.globalAlpha = 1;
        }
        if (col.index === active) {
          ctx.strokeStyle = ink;
          ctx.lineWidth = 1.25;
          ctx.stroke();
        }
      }
      ctx.restore();
    }
    ctx.font = labelFont;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = labelInk;
    const labelWidth = Math.max(0, ...scene.months.map((m) => ctx.measureText(m.label).width));
    for (const month of readableMonths(scene.months, labelWidth, labelHeight, labelGap)) ctx.fillText(month.label, month.x, month.y);
    root.dataset.orientation = Math.abs(view.yaw - ISOMETRIC.yaw) + Math.abs(view.pitch - ISOMETRIC.pitch) < 1e-6 ? 'isometric' : 'tumbled';
  };
  const readColours = () => {
    colours = palette.map((p) => getComputedStyle(p).color);
    const style = getComputedStyle(canvas);
    ink = style.color;
    shade = getComputedStyle(root.querySelector<HTMLElement>('[data-contribution-shade]')!).color;
    const labels = getComputedStyle(labelStyle);
    labelInk = labels.color;
    labelFont = labels.font;
    labelHeight = Number.parseFloat(labels.lineHeight);
    labelGap = Number.parseFloat(labels.paddingInlineStart);
    glow = Number.parseFloat(style.getPropertyValue('--plot-glow'));
    duration = Number.parseFloat(style.getPropertyValue('--plot-return'));
    draw();
  };
  const describe = (index: number) => {
    const day = data.days[index];
    const label = `${day.count.toLocaleString('en')} ${day.count === 1 ? 'contribution' : 'contributions'}`;
    return { day, label, formatted: dateFormat.format(new Date(`${day.date}T00:00:00Z`)) };
  };
  const show = (index: number | null, point?: Point) => {
    if (index === active && !point) return;
    active = index;
    root.dataset.activeDate = index === null ? '' : data.days[index].date;
    tip.hidden = index === null;
    if (index !== null) {
      selected = index;
      const info = describe(index);
      date.textContent = info.formatted;
      date.dateTime = info.day.date;
      count.textContent = info.label;
      canvas.setAttribute('aria-label', `GitHub contribution calendar. ${info.label} on ${info.formatted}.`);
      selection.textContent = `${info.label} on ${info.formatted}`;
      const top = scene.columns.find((c) => c.index === index)?.faces.at(-1);
      const anchor = point ?? (top ? { x: top[0].x, y: top[0].y } : { x: width / 2, y: height / 2 });
      tip.style.setProperty('--tip-x', `${Math.max(0, Math.min(width - tip.offsetWidth, anchor.x + 12))}px`);
      tip.style.setProperty('--tip-y', `${Math.max(0, Math.min(height - tip.offsetHeight, anchor.y - tip.offsetHeight - 12))}px`);
    }
    draw();
  };
  const stop = () => { cancelAnimationFrame(animation); animation = 0; };
  const reset = () => {
    stop();
    if (reduced.matches || (view.yaw === ISOMETRIC.yaw && view.pitch === ISOMETRIC.pitch)) { view = { ...ISOMETRIC }; draw(); return; }
    const from = { ...view };
    const started = performance.now();
    const frame = (now: number) => {
      if (!alive) return;
      const progress = Math.min(1, (now - started) / duration);
      view = returnOrientation(from, progress);
      draw();
      if (progress < 1) animation = requestAnimationFrame(frame);
      else animation = 0;
    };
    animation = requestAnimationFrame(frame);
  };
  const position = (e: PointerEvent): Point => {
    const box = canvas.getBoundingClientRect();
    return { x: e.clientX - box.left, y: e.clientY - box.top };
  };
  canvas.addEventListener('pointerdown', (e) => {
    if (e.button !== 0 || !e.isPrimary) return;
    stop();
    drag = { id: e.pointerId, at: position(e), moved: false };
    canvas.setPointerCapture(e.pointerId);
  }, { signal });
  canvas.addEventListener('pointermove', (e) => {
    const p = position(e);
    if (drag && drag.id === e.pointerId && mode === '3d') {
      const dx = p.x - drag.at.x, dy = p.y - drag.at.y;
      drag.moved ||= Math.hypot(dx, dy) > 4;
      if (drag.moved) { show(null); view = tumble(dx, dy, width); draw(); }
    } else if (e.pointerType !== 'touch') show(columnAt(scene, p), p);
  }, { signal });
  const release = (e: PointerEvent) => {
    if (!drag || drag.id !== e.pointerId) return;
    const p = position(e);
    if (!drag.moved && e.type === 'pointerup') show(columnAt(scene, p), p);
    drag = null;
    if (canvas.hasPointerCapture(e.pointerId)) canvas.releasePointerCapture(e.pointerId);
    reset();
  };
  for (const name of ['pointerup', 'pointercancel', 'lostpointercapture'] as const) canvas.addEventListener(name, release, { signal });
  canvas.addEventListener('pointerleave', (e) => { if (e.pointerType !== 'touch' && !drag) show(null); }, { signal });
  canvas.addEventListener('focus', () => show(selected), { signal });
  canvas.addEventListener('blur', () => { if (!drag) show(null); }, { signal });
  canvas.addEventListener('keydown', (e) => {
    const next = calendarKey(selected, e.key, data.days.length);
    if (next === null) return;
    e.preventDefault();
    show(next);
  }, { signal });
  for (const button of buttons) button.addEventListener('click', () => {
    mode = button.dataset.contributionMode === '2d' ? '2d' : '3d';
    root.dataset.mode = mode;
    for (const b of buttons) b.setAttribute('aria-pressed', String(b === button));
    const captured = drag?.id;
    drag = null;
    if (captured !== undefined && canvas.hasPointerCapture(captured)) canvas.releasePointerCapture(captured);
    stop();
    view = { ...ISOMETRIC };
    show(null);
    draw();
  }, { signal });
  root.querySelector('[data-contribution-reset]')!.addEventListener('click', reset, { signal });
  const observer = new ResizeObserver(() => {
    const box = canvas.getBoundingClientRect();
    width = box.width; height = box.height;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    show(null);
    draw();
  });
  observer.observe(canvas);
  const schemes = new MutationObserver(readColours);
  schemes.observe(document.documentElement, { attributes: true, subtree: true, attributeFilter: ['data-theme', 'data-scheme'] });
  theme.addEventListener('change', readColours, { signal });
  reduced.addEventListener('change', () => { if (reduced.matches) { stop(); view = { ...ISOMETRIC }; draw(); } }, { signal });
  signal.addEventListener('abort', () => { alive = false; stop(); observer.disconnect(); schemes.disconnect(); }, { once: true });
  readColours();
  root.dataset.ready = '';
}
