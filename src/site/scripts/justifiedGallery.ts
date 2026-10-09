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
  row: number;
}

export interface JustifiedGallery {
  boxes: GalleryBox[];
  height: number;
  rows: number;
}

interface Candidate {
  end: number;
  widths: number[];
  crop: number;
  widow: boolean;
  cost: number;
}

const MAX_ITEMS_PER_ROW = 8;
const CROP_LIMIT = 0.25;

const cropForScale = (scale: number) => (scale < 1 ? 1 - scale : 1 - 1 / scale);

function candidate(aspects: number[], start: number, end: number, width: number, height: number, gap: number, last: boolean): Candidate | null {
  const count = end - start;
  const available = width - gap * (count - 1);
  if (available <= 0) return null;
  const natural = aspects.slice(start, end).map((aspect) => aspect * height);
  const naturalWidth = natural.reduce((sum, itemWidth) => sum + itemWidth, 0);
  const widow = last && naturalWidth <= available;
  if (widow) {
    const unused = (available - naturalWidth) / width;
    return { end, widths: natural, crop: 0, widow: true, cost: 0.02 + unused * unused * 0.08 };
  }
  const scale = available / naturalWidth;
  const crop = cropForScale(scale);
  const excess = Math.max(0, crop - CROP_LIMIT);
  return {
    end,
    widths: natural.map((itemWidth) => itemWidth * scale),
    crop,
    widow: false,
    cost: count * crop * crop + count * excess * excess * 16 + 0.002,
  };
}

/**
 * Lays pictures into fixed-height justified rows without changing their order.
 * Every full row exactly consumes the available width after gaps. A final widow
 * keeps natural widths; an extreme panorama still fills and crops within one row.
 */
export function justifyGallery(items: GalleryItemSize[], containerWidth: number, rowHeight: number, gap: number): JustifiedGallery {
  if (!items.length || containerWidth <= 0 || rowHeight <= 0 || gap < 0) return { boxes: [], height: 0, rows: 0 };
  const aspects = items.map(({ width, height }) => (width > 0 && height > 0 ? width / height : 1));
  const n = aspects.length;
  const best = Array<number>(n + 1).fill(Number.POSITIVE_INFINITY);
  const choice = Array<Candidate | null>(n).fill(null);
  best[n] = 0;

  for (let start = n - 1; start >= 0; start--) {
    const limit = Math.min(n, start + MAX_ITEMS_PER_ROW);
    for (let end = start + 1; end <= limit; end++) {
      const row = candidate(aspects, start, end, containerWidth, rowHeight, gap, end === n);
      if (!row) continue;
      const total = row.cost + best[end]!;
      if (total < best[start]!) {
        best[start] = total;
        choice[start] = row;
      }
    }
  }

  const boxes: GalleryBox[] = [];
  let start = 0;
  let rowIndex = 0;
  while (start < n) {
    const row = choice[start] ?? candidate(aspects, start, Math.min(n, start + 1), containerWidth, rowHeight, gap, start + 1 === n)!;
    const widths = row.widths.map((value) => Math.max(1, Math.floor(value)));
    if (!row.widow) {
      const used = widths.reduce((sum, value) => sum + value, 0) + gap * (widths.length - 1);
      widths[widths.length - 1] += containerWidth - used;
    }
    let left = 0;
    widths.forEach((itemWidth, offset) => {
      boxes.push({ index: start + offset, left, top: rowIndex * (rowHeight + gap), width: itemWidth, height: rowHeight, crop: row.crop, row: rowIndex });
      left += itemWidth + gap;
    });
    start = row.end;
    rowIndex++;
  }
  return { boxes, height: rowIndex * rowHeight + Math.max(0, rowIndex - 1) * gap, rows: rowIndex };
}
