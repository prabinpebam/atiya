export interface GalleryItemSize {
  width: number;
  height: number;
}

export interface GalleryBox {
  index: number;
  left: number;
  top: number;
  width: number;
  height: number;
  crop: number;
  /** The first row the box is in. */
  row: number;
  /** How many rows it spans: 2 for a tall picture beside two rows. */
  rows: 1 | 2;
}

export interface JustifiedGallery {
  boxes: GalleryBox[];
  height: number;
  rows: number;
}

export interface JustifyOptions {
  /** Let a portrait span two rows beside two justified rows, where it fits well (documentation/content/media.md §9.2). */
  span?: boolean;
}

interface Row {
  start: number;
  end: number;
  widths: number[];
  crop: number;
  widow: boolean;
  cost: number;
}

interface Band {
  side: 'left' | 'right';
  start: number;
  end: number;
  tall: number;
  tallWidth: number;
  tallCrop: number;
  top: Row;
  bottom: Row;
  cost: number;
}

type Unit = { kind: 'row'; row: Row } | { kind: 'band'; band: Band };

const MAX_ITEMS_PER_ROW = 8;
const CROP_LIMIT = 0.25;
/** A picture is tall enough to span from 4:5 down. */
export const TALL_ASPECT = 0.8;
/** The tall cell's widest share of the gallery. */
const TALL_SHARE = 0.4;
/** The two rows beside it keep at least this share. */
const BESIDE_SHARE = 0.5;
const MAX_BESIDE = 6;

const cropForScale = (scale: number) => (scale < 1 ? 1 - scale : 1 - 1 / scale);

/** What spanning earns a portrait: more the taller it is, so a 9:16 spans before a 4:5. */
export const spanBonus = (aspect: number) => 0.06 + 0.12 * Math.min(1, Math.max(0, (TALL_ASPECT - aspect) / 0.3));

function candidate(aspects: number[], start: number, end: number, width: number, height: number, gap: number, last: boolean): Row | null {
  const count = end - start;
  const available = width - gap * (count - 1);
  if (available <= 0) return null;
  const natural = aspects.slice(start, end).map((aspect) => aspect * height);
  const naturalWidth = natural.reduce((sum, itemWidth) => sum + itemWidth, 0);
  const widow = last && naturalWidth <= available;
  if (widow) {
    const unused = (available - naturalWidth) / width;
    return { start, end, widths: natural, crop: 0, widow: true, cost: 0.02 + unused * unused * 0.08 };
  }
  const scale = available / naturalWidth;
  const crop = cropForScale(scale);
  const excess = Math.max(0, crop - CROP_LIMIT);
  return {
    start,
    end,
    widths: natural.map((itemWidth) => itemWidth * scale),
    crop,
    widow: false,
    cost: count * crop * crop + count * excess * excess * 16 + 0.002,
  };
}

/** The tall cell a portrait would take: its width (capped at its share, by cropping) and the room left beside it, or null. */
function tallCell(aspect: number, width: number, height: number, gap: number) {
  if (aspect > TALL_ASPECT) return null;
  const natural = aspect * (2 * height + gap);
  const tallWidth = Math.floor(Math.min(natural, TALL_SHARE * width));
  const tallCrop = 1 - tallWidth / natural;
  const beside = width - tallWidth - gap;
  if (tallWidth < 1 || tallCrop > CROP_LIMIT || beside < BESIDE_SHARE * width) return null;
  return { tallWidth, tallCrop, beside };
}

/** A justified row beside a tall picture: it must fill its width within the crop limit. */
function besideRow(aspects: number[], start: number, end: number, width: number, height: number, gap: number): Row | null {
  const row = candidate(aspects, start, end, width, height, gap, false);
  return row && row.crop <= CROP_LIMIT ? row : null;
}

/** Every band that can start at `start`: the tall picture first (left) or last (right), the pictures between split over two rows. */
function bands(aspects: number[], start: number, width: number, height: number, gap: number): Band[] {
  const n = aspects.length;
  const out: Band[] = [];
  const make = (side: Band['side'], tall: number, from: number, to: number) => {
    const cell = tallCell(aspects[tall]!, width, height, gap);
    if (!cell) return;
    for (let split = from + 1; split < to && split - from <= MAX_BESIDE; split++) {
      if (to - split > MAX_BESIDE) continue;
      const top = besideRow(aspects, from, split, cell.beside, height, gap);
      const bottom = top && besideRow(aspects, split, to, cell.beside, height, gap);
      if (!top || !bottom) continue;
      const end = side === 'left' ? to : to + 1;
      const cost = top.cost + bottom.cost + 2 * cell.tallCrop * cell.tallCrop - spanBonus(aspects[tall]!);
      out.push({ side, start, end, tall, tallWidth: cell.tallWidth, tallCrop: cell.tallCrop, top, bottom, cost });
    }
  };
  // the tall picture first, then the rows beside it
  for (let to = start + 3; to <= Math.min(n, start + 1 + 2 * MAX_BESIDE); to++) make('left', start, start + 1, to);
  // the rows, then the tall picture last
  for (let tall = start + 2; tall < Math.min(n, start + 2 * MAX_BESIDE + 1); tall++) make('right', tall, start, tall);
  return out;
}

/*
 * The context a unit is laid in: which side the last band took (bands alternate) and whether it was the unit
 * just before (bands never touch). 0: no band yet; 1, 2: the last was left, right, with a row since; 3, 4: the
 * last unit was a left, right band.
 */
type Context = 0 | 1 | 2 | 3 | 4;
const CONTEXTS: Context[] = [0, 1, 2, 3, 4];
const afterRow = (c: Context): Context => (c === 3 ? 1 : c === 4 ? 2 : c);
const afterBand = (side: Band['side']): Context => (side === 'left' ? 3 : 4);
const bandAllowed = (c: Context, side: Band['side']) => c < 3 && !(c === 1 && side === 'left') && !(c === 2 && side === 'right');

/**
 * Lays pictures into fixed-height justified rows without changing their order (documentation/content/media.md
 * §9.2). Every full row exactly consumes the available width after gaps. A final widow keeps natural widths; an
 * extreme panorama still fills and crops within one row. With `span`, a portrait can take two rows' height
 * beside two justified rows, where that fits within the crop limit and reads better than a row.
 */
export function justifyGallery(items: GalleryItemSize[], containerWidth: number, rowHeight: number, gap: number, options: JustifyOptions = {}): JustifiedGallery {
  if (!items.length || containerWidth <= 0 || rowHeight <= 0 || gap < 0) return { boxes: [], height: 0, rows: 0 };
  const aspects = items.map(({ width, height }) => (width > 0 && height > 0 ? width / height : 1));
  const n = aspects.length;
  const rowsFrom: Row[][] = [];
  const bandsFrom: Band[][] = [];
  for (let start = 0; start < n; start++) {
    const rows: Row[] = [];
    for (let end = start + 1; end <= Math.min(n, start + MAX_ITEMS_PER_ROW); end++) {
      const row = candidate(aspects, start, end, containerWidth, rowHeight, gap, end === n);
      if (row) rows.push(row);
    }
    rowsFrom.push(rows);
    bandsFrom.push(options.span ? bands(aspects, start, containerWidth, rowHeight, gap) : []);
  }

  // best[i][c]: the least cost of laying out items i… in context c, and the unit that starts it
  const best = Array.from({ length: n + 1 }, () => CONTEXTS.map(() => Number.POSITIVE_INFINITY));
  const choice = Array.from({ length: n }, () => CONTEXTS.map((): Unit | null => null));
  best[n] = CONTEXTS.map(() => 0);
  for (let start = n - 1; start >= 0; start--) {
    for (const c of CONTEXTS) {
      for (const row of rowsFrom[start]!) {
        const total = row.cost + best[row.end]![afterRow(c)]!;
        if (total < best[start]![c]!) {
          best[start]![c] = total;
          choice[start]![c] = { kind: 'row', row };
        }
      }
      for (const band of bandsFrom[start]!) {
        if (!bandAllowed(c, band.side)) continue;
        const total = band.cost + best[band.end]![afterBand(band.side)]!;
        if (total < best[start]![c]!) {
          best[start]![c] = total;
          choice[start]![c] = { kind: 'band', band };
        }
      }
    }
  }

  const boxes: GalleryBox[] = [];
  const topOf = (row: number) => row * (rowHeight + gap);
  const place = (row: Row, left: number, width: number, rowIndex: number) => {
    const widths = row.widths.map((value) => Math.max(1, Math.floor(value)));
    if (!row.widow) {
      const used = widths.reduce((sum, value) => sum + value, 0) + gap * (widths.length - 1);
      widths[widths.length - 1] += width - used;
    }
    let x = left;
    widths.forEach((itemWidth, offset) => {
      boxes.push({ index: row.start + offset, left: x, top: topOf(rowIndex), width: itemWidth, height: rowHeight, crop: row.crop, row: rowIndex, rows: 1 });
      x += itemWidth + gap;
    });
  };
  let start = 0;
  let rowIndex = 0;
  let context: Context = 0;
  while (start < n) {
    const unit: Unit = choice[start]![context] ?? { kind: 'row', row: candidate(aspects, start, start + 1, containerWidth, rowHeight, gap, start + 1 === n)! };
    if (unit.kind === 'row') {
      place(unit.row, 0, containerWidth, rowIndex);
      start = unit.row.end;
      rowIndex += 1;
      context = afterRow(context);
      continue;
    }
    const { band } = unit;
    const beside = containerWidth - band.tallWidth - gap;
    const tallBox: GalleryBox = { index: band.tall, left: band.side === 'left' ? 0 : beside + gap, top: topOf(rowIndex), width: band.tallWidth, height: 2 * rowHeight + gap, crop: band.tallCrop, row: rowIndex, rows: 2 };
    const besideLeft = band.side === 'left' ? band.tallWidth + gap : 0;
    if (band.side === 'left') boxes.push(tallBox);
    place(band.top, besideLeft, beside, rowIndex);
    place(band.bottom, besideLeft, beside, rowIndex + 1);
    if (band.side === 'right') boxes.push(tallBox);
    start = band.end;
    rowIndex += 2;
    context = afterBand(band.side);
  }
  return { boxes, height: rowIndex * rowHeight + Math.max(0, rowIndex - 1) * gap, rows: rowIndex };
}
