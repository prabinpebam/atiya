/**
 * Makes the gallery fixture's media (gallery plan G1 item 9): every master its sidecars in
 * tests/fixtures/gallery/content/media/articles/fixture-album/ name, drawn from shapes (no text, no fonts,
 * no photographs), and the sidecars' `facts` measured from them as the editor measures an upload; and the
 * upload fixtures in tests/fixtures/gallery/uploads/ (pictures with and without EXIF dates, and one too
 * large to keep at the standard size). Deterministic: the same sharp and ffmpeg give the same bytes, and the
 * files are committed, so builds and tests never make them.
 *
 *   node scripts/make-gallery-fixture.mjs           # write them
 *   node scripts/make-gallery-fixture.mjs --check   # fail if a sidecar's facts don't match its master
 *
 * Needs ffmpeg on the PATH for the video (H.264, 42 s, under 200 KB).
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import sharp from 'sharp';
import { edgeAverage } from '../src/site/content/edgeColour.ts';
import { takenOf } from '../src/site/editor/model/exif.ts';
import { sanitizeSvg } from '../src/site/editor/model/svgSanitize.ts';

const ROOT = join(import.meta.dirname, '..');
const ALBUM = join(ROOT, 'tests/fixtures/gallery/content/media/articles/fixture-album');
const UPLOADS = join(ROOT, 'tests/fixtures/gallery/uploads');
const CHECK = process.argv.includes('--check');
const VIDEO_MAX = 200 * 1024;

/** A small deterministic generator (mulberry32), so each picture's shapes are its own and always the same. */
function random(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const hsl = (h, s, l) => `hsl(${Math.round(h) % 360} ${Math.round(s)}% ${Math.round(l)}%)`;

/** A landscape of shapes: a sky, a sun, three rows of hills and a few trees, in colours of its own. */
function landscape(width, height, seed) {
  const r = random(seed);
  const hue = Math.floor(r() * 360);
  const hills = [0.55, 0.68, 0.8].map((at, i) => {
    const y = height * at;
    const pts = [`0,${height}`, `0,${y}`];
    for (let x = 0; x <= 8; x++) pts.push(`${Math.round((width * x) / 8)},${Math.round(y - r() * height * 0.12)}`);
    pts.push(`${width},${height}`);
    return `<polygon points="${pts.join(' ')}" fill="${hsl(hue + 90 + i * 12, 35 + i * 8, 42 - i * 9)}"/>`;
  });
  const trees = Array.from({ length: 6 }, () => {
    const x = Math.round(r() * width);
    const y = Math.round(height * (0.78 + r() * 0.15));
    const s = Math.round(height * (0.05 + r() * 0.05));
    return `<polygon points="${x},${y - s * 2} ${x - s},${y} ${x + s},${y}" fill="${hsl(hue + 120, 40, 22)}"/>`;
  });
  const sun = `<circle cx="${Math.round(width * (0.15 + r() * 0.7))}" cy="${Math.round(height * (0.15 + r() * 0.2))}" r="${Math.round(Math.min(width, height) * 0.07)}" fill="${hsl(hue + 30, 90, 80)}"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
<defs><linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${hsl(hue, 55, 62)}"/><stop offset="1" stop-color="${hsl(hue + 25, 60, 84)}"/></linearGradient></defs>
<rect width="${width}" height="${height}" fill="url(#sky)"/>${sun}${hills.join('')}${trees.join('')}</svg>`;
}

/** A floor plan: two rooms and a porch, in ink on nothing (a drawing is transparent), light or dark. */
function plan(dark) {
  const ink = dark ? '#e8e4da' : '#2b2a33';
  const wash = dark ? '#3a4a66' : '#c9d6ee';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600" viewBox="0 0 800 600">
<g fill="none" stroke="${ink}" stroke-width="6" stroke-linejoin="round">
<rect x="80" y="80" width="380" height="320"/>
<rect x="460" y="80" width="260" height="320"/>
<path d="M460 200 v80"/>
<rect x="200" y="400" width="320" height="120" stroke-dasharray="18 12"/>
</g>
<rect x="100" y="100" width="340" height="280" fill="${wash}" opacity="0.45"/>
<rect x="480" y="100" width="220" height="280" fill="${wash}" opacity="0.25"/>
<path d="M300 400 v-40 M420 400 v-40" stroke="${ink}" stroke-width="4"/>
</svg>
`;
}

/** A drawing as the sanitizer keeps it: it must take nothing out. */
function cleaned(svg) {
  const r = sanitizeSvg(svg);
  if (!r.ok || r.removed.length) throw new Error(`the fixture's drawing doesn't pass the sanitizer: ${r.ok ? r.removed.join(', ') : r.error}`);
  return r.svg;
}

/** As the editor measures a master (src/site/content/pictureFacts.ts `decodeFacts` / `measureFacts`). */
async function factsOf(bytes) {
  const m = await sharp(bytes).metadata();
  const N = 24;
  const { data } = await sharp(bytes, { failOn: 'none' }).resize(N, N, { fit: 'fill' }).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let bg = edgeAverage(data, N);
  if (!bg) {
    const { dominant } = await sharp(bytes, { failOn: 'none' }).stats();
    bg = `rgb(${dominant.r} ${dominant.g} ${dominant.b})`;
  }
  return { width: m.width, height: m.pageHeight ?? m.height, bg, bytes: bytes.length };
}

/** EXIF date-time from a sidecar's `taken` day (the hour is made up: only the day is read). */
const exifTime = (day, hour = 9) => `${day.replace(/-/g, ':')} ${String(hour).padStart(2, '0')}:30:00`;

const webp = (img) => img.webp({ quality: 62, effort: 6, smartSubsample: true });

/** A picture master from its sidecar: its size from the sidecar's facts, its EXIF date from `taken`. */
async function picture(name, sidecar, seed) {
  const { width, height } = sidecar.facts;
  let img = sharp(Buffer.from(landscape(width, height, seed)));
  if (sidecar.taken) img = img.withExif({ IFD0: { DateTime: exifTime(sidecar.taken, 18) }, IFD2: { DateTimeOriginal: exifTime(sidecar.taken) } });
  return webp(img).toBuffer();
}

/** An animated GIF: a flag that flaps, in eight frames. */
async function gif() {
  const frames = [];
  for (let f = 0; f < 8; f++) {
    const wave = Array.from({ length: 9 }, (_, i) => `${300 + i * 45},${200 + Math.round(Math.sin((i + f) * 0.8) * 30)}`).join(' ');
    const back = Array.from({ length: 9 }, (_, i) => `${300 + (8 - i) * 45},${380 + Math.round(Math.sin((8 - i + f) * 0.8) * 30)}`).join(' ');
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600"><rect width="800" height="600" fill="#5a6ea0"/><rect x="290" y="150" width="12" height="420" fill="#3b3b3b"/><polygon points="${wave} ${back}" fill="#e2b33c"/></svg>`;
    frames.push(await sharp(Buffer.from(svg)).png().toBuffer());
  }
  return sharp(frames, { join: { animated: true } }).gif({ delay: 120, loop: 0, colours: 16, effort: 10 }).toBuffer();
}

/** The video: a box that crosses a plain screen, 42 s at 10 frames a second, as H.264 in MP4. */
function video(file) {
  execFileSync('ffmpeg', [
    '-hide_banner', '-loglevel', 'error', '-y',
    '-f', 'lavfi', '-i', 'color=c=0x4a6a8a:s=1920x1080:r=10:d=42',
    '-vf', "drawbox=x='mod(t*120\\,1720)':y=440:w=200:h=200:color=0xe2b33c:t=fill",
    '-c:v', 'libx264', '-preset', 'veryslow', '-crf', '40', '-pix_fmt', 'yuv420p', '-g', '100',
    '-threads', '1', '-fflags', '+bitexact', '-flags:v', '+bitexact', '-map_metadata', '-1', '-movflags', '+faststart',
    file,
  ]);
}

/** A frame of the video, as its poster. */
function frameOf(file) {
  return execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-ss', '0', '-i', file, '-frames:v', '1', '-f', 'image2pipe', '-c:v', 'png', '-'], { maxBuffer: 64 << 20 });
}

const VTT = `WEBVTT

00:00:00.000 --> 00:00:06.000
The market opens before the sun is up.

00:00:06.000 --> 00:00:14.000
A box crosses the square, as it does every morning.

00:00:14.000 --> 00:00:30.000
Nothing else happens: this is a test.

00:00:30.000 --> 00:00:42.000
The end of the walk.
`;

const sidecarFile = (name) => join(ALBUM, `${name}.json`);
const readSidecar = (name) => JSON.parse(readFileSync(sidecarFile(name), 'utf8'));
const writeSidecar = (name, s) => writeFileSync(sidecarFile(name), JSON.stringify(s, null, 2) + '\n');

async function make() {
  const names = readdirSync(ALBUM).filter((f) => f.endsWith('.json')).map((f) => f.replace(/\.json$/, '')).sort();
  for (const [i, name] of names.entries()) {
    const s = readSidecar(name);
    if (s.kind === 'video') {
      const master = join(ALBUM, s.file);
      video(master);
      const bytes = statSync(master).size;
      if (bytes > VIDEO_MAX) throw new Error(`${s.file} is ${bytes} bytes: keep the fixture's video under ${VIDEO_MAX}`);
      if (s.poster) writeFileSync(join(ALBUM, s.poster.file), await webp(sharp(frameOf(master))).toBuffer());
      for (const c of s.captions ?? []) writeFileSync(join(ALBUM, c.file), VTT);
      continue;
    }
    if (s.kind !== 'image') continue;
    let bytes;
    if (/\.svg$/.test(s.file)) {
      // kept as an upload keeps a drawing: as the sanitizer gives it back
      bytes = Buffer.from(cleaned(plan(false)));
      if (s.dark) writeFileSync(join(ALBUM, s.dark.file), cleaned(plan(true)));
    } else if (/\.gif$/.test(s.file)) {
      bytes = await gif();
      if (s.animation?.poster) writeFileSync(join(ALBUM, s.animation.poster), await webp(sharp(bytes)).toBuffer());
    } else {
      // a poster for an embed is 1280 by 720; a picture is the size its sidecar says
      const facts = s.facts ?? { width: 1280, height: 720 };
      bytes = await picture(name, { ...s, facts }, 1000 + i);
    }
    writeFileSync(join(ALBUM, s.file), bytes);
  }
  // the facts, measured from the files as written
  for (const name of names) {
    const s = readSidecar(name);
    if (s.kind !== 'image') continue;
    s.facts = await factsOf(readFileSync(join(ALBUM, s.file)));
    if (s.dark) s.dark = { ...s.dark, facts: await factsOf(readFileSync(join(ALBUM, s.dark.file))) };
    writeSidecar(name, s);
  }
  await uploads();
}

/** Pictures to upload in the editor's tests: the EXIF date each gives, and one too large for the standard size. */
async function uploads() {
  mkdirSync(UPLOADS, { recursive: true });
  const jpeg = (w, h, seed, exif) => {
    let img = sharp(Buffer.from(landscape(w, h, seed)));
    if (exif) img = img.withExif(exif);
    return img.jpeg({ quality: 70, mozjpeg: true }).toBuffer();
  };
  const files = {
    'taken-original.jpg': await jpeg(1600, 1200, 2001, { IFD0: { DateTime: '2026:04:20 18:00:00' }, IFD2: { DateTimeOriginal: '2026:03:21 07:45:10' } }),
    'taken-modified.jpg': await jpeg(1600, 1200, 2002, { IFD0: { DateTime: '2026:04:02 12:00:00' } }),
    'undated.jpg': await jpeg(1600, 1200, 2003),
    'large.jpg': await jpeg(4032, 3024, 2004, { IFD2: { DateTimeOriginal: '2026:05:09 16:20:00' } }),
  };
  for (const [f, bytes] of Object.entries(files)) writeFileSync(join(UPLOADS, f), bytes);
}

/** What `--check` and the end of a run hold: every image's facts are its master's, dates where they should be, sizes within budget. */
async function check() {
  const problems = [];
  let total = 0;
  for (const f of readdirSync(ALBUM)) {
    const abs = join(ALBUM, f);
    total += statSync(abs).size;
    if (!f.endsWith('.json')) continue;
    const s = JSON.parse(readFileSync(abs, 'utf8'));
    const masters = [s.file, s.dark?.file, s.animation?.poster, s.poster?.file, ...(s.captions ?? []).map((c) => c.file)].filter(Boolean);
    for (const m of masters) if (!existsSync(join(ALBUM, m))) problems.push(`${f}: ${m} is missing`);
    if (s.kind !== 'image') continue;
    for (const [file, facts] of [[s.file, s.facts], ...(s.dark ? [[s.dark.file, s.dark.facts]] : [])]) {
      if (!existsSync(join(ALBUM, file))) continue;
      const bytes = readFileSync(join(ALBUM, file));
      const real = await factsOf(bytes);
      if (JSON.stringify(real) !== JSON.stringify(facts)) problems.push(`${file}: its sidecar's facts ${JSON.stringify(facts)} aren't its ${JSON.stringify(real)}`);
      if (/\.svg$/.test(file) && !sanitizeSvg(bytes).ok) problems.push(`${file}: the drawing doesn't pass the sanitizer`);
      if (s.taken && !/\.(svg|gif)$/.test(file) && takenOf(bytes) !== s.taken) problems.push(`${file}: its EXIF day is ${takenOf(bytes)}, not ${s.taken}`);
    }
  }
  const expected = { 'taken-original.jpg': '2026-03-21', 'taken-modified.jpg': '2026-04-02', 'undated.jpg': null, 'large.jpg': '2026-05-09' };
  for (const [f, day] of Object.entries(expected)) {
    const abs = join(UPLOADS, f);
    if (!existsSync(abs)) problems.push(`uploads/${f} is missing`);
    else {
      total += statSync(abs).size;
      if (takenOf(readFileSync(abs)) !== day) problems.push(`uploads/${f}: its EXIF day is ${takenOf(readFileSync(abs))}, not ${day}`);
    }
  }
  return { problems, total };
}

if (!CHECK) await make();
const { problems, total } = await check();
for (const p of problems) console.error(p);
console.log(`${problems.length ? 'problems' : 'ok'}: the fixture's media come to ${(total / 1024).toFixed(0)} KB`);
if (problems.length) process.exit(1);
