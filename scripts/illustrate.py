"""Article illustrations in a named house style (the `ink-sketch` skill).

One manifest per article (assets-src/illustrations/<folder>/illustrations.json) drives every step:

    python scripts/illustrate.py gen     <manifest> [--only a,b] [--mode light|dark|both] [--jobs 4] [--force]
    python scripts/illustrate.py ink     <manifest> [--only a,b]   # transparent ink from the paper sources
    python scripts/illustrate.py preview <manifest> [--only a,b]   # ink over the site's pages, for review
    python scripts/illustrate.py publish <manifest> [--only a,b]   # alpha WebP pairs + sidecars in content/media
    python scripts/illustrate.py place   <manifest>                # the hero and figures in the article's JSON

The style (prompts, anchors, sizes, paper, extraction) lives in assets-src/illustrations/styles/<style>/style.json.
Generation goes through the gpt-image-2-5 skill's CLI (GPT_IMAGE_CLI overrides its path); the key never
passes through here.
"""
from __future__ import annotations

import argparse
import concurrent.futures as cf
import json
import os
import subprocess
import sys
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
CLI = Path(os.environ.get('GPT_IMAGE_CLI', Path.home() / '.copilot/skills/gpt-image-2-5/scripts/imagegen.py'))
PAGE = {'light': (251, 250, 247), 'dark': (25, 23, 20)}


def load(manifest: str):
    path = Path(manifest).resolve()
    m = json.loads(path.read_text(encoding='utf-8'))
    style = json.loads((ROOT / 'assets-src/illustrations/styles' / m['style'] / 'style.json').read_text(encoding='utf-8'))
    return path.parent, m, style


def chosen(m, only):
    names = set(only.split(',')) if only else None
    return [i for i in m['images'] if names is None or i['name'] in names]


def size_of(img, style):
    return img.get('size') or style['sizes'][img.get('format', 'figure')]


def refs(style):
    present = [ROOT / r for r in style['references'] if (ROOT / r).exists()]
    if len(present) < len(style['references']):
        print('  note: some style references are missing locally; using the anchors alone for those', file=sys.stderr)
    return present


def light_prompt(img, m, style, with_cast_anchor):
    fmt = style['formats'][img.get('format', 'figure')]
    cast_ref = ("The SECOND reference is this article's own approved picture: draw its recurring characters exactly "
                "as they appear there (same faces, proportions, clothes and props), but never repeat its scene. ") if with_cast_anchor else ''
    text = '\n\n'.join(style['prompts']['light'])
    return (text.replace('{castReference}', cast_ref).replace('{cast}', m.get('cast', 'original quirky creatures'))
            .replace('{subject}', img['subject']).replace('{format}', fmt))


def dark_prompt(img, style):
    panels = ', three panels and hand-drawn panel borders' if img.get('format') == 'comic' else ''
    return '\n\n'.join(style['prompts']['dark']).replace('{panels}', panels)


def run(args: list[str], timeout: int) -> str:
    p = subprocess.run([sys.executable, str(CLI), *args], capture_output=True, text=True, timeout=timeout, encoding='utf-8', errors='replace')
    tail = (p.stdout + p.stderr).strip().splitlines()[-2:]
    if p.returncode:
        raise RuntimeError('\n'.join(tail))
    return tail[0] if tail else ''


def gen_one(folder, img, m, style, mode, force):
    name, size, timeout = img['name'], size_of(img, style), style['model']['timeoutSeconds']
    anchor = m.get('castAnchor')
    out = []
    light = folder / f'{name}.light.png'
    if mode in ('light', 'both') and (force or not light.exists()):
        cast_light = folder / f'{anchor}.light.png' if anchor and anchor != name else None
        with_cast = bool(cast_light and cast_light.exists())
        prompt = light_prompt(img, m, style, with_cast)
        (folder / f'{name}.light.prompt.txt').write_text(prompt + '\n', encoding='utf-8', newline='\n')
        inputs = [ROOT / style['anchors']['light'], *([cast_light] if with_cast else []), *refs(style)]
        out.append(run(['edit', *sum((['-i', str(p)] for p in inputs), []), '-p', prompt, '-o', str(light),
                        '--size', size, '--quality', style['model']['quality'], '--background', 'opaque'], timeout))
    dark = folder / f'{name}.dark.png'
    if mode in ('dark', 'both') and (force or not dark.exists()):
        if not light.exists():
            raise RuntimeError(f'{name}: no light source to redraw')
        prompt = dark_prompt(img, style)
        (folder / f'{name}.dark.prompt.txt').write_text(prompt + '\n', encoding='utf-8', newline='\n')
        inputs = [light, ROOT / style['anchors']['dark'], *refs(style)]
        out.append(run(['edit', *sum((['-i', str(p)] for p in inputs), []), '-p', prompt, '-o', str(dark),
                        '--size', size, '--quality', style['model']['quality'], '--background', 'opaque'], timeout))
    return name, out


def cmd_gen(a):
    folder, m, style = load(a.manifest)
    imgs = chosen(m, a.only)
    with cf.ThreadPoolExecutor(a.jobs) as pool:
        futs = {pool.submit(gen_one, folder, i, m, style, a.mode, a.force): i['name'] for i in imgs}
        failed = 0
        for f in cf.as_completed(futs):
            try:
                name, out = f.result()
                print(f'ok    {name}', *out, sep='\n      ')
            except Exception as e:  # keep the others going; a rerun resumes
                failed += 1
                print(f'FAIL  {futs[f]}: {e}')
    sys.exit(1 if failed else 0)


def extract(src: Path, mode: str) -> Image.Image:
    a = np.asarray(Image.open(src).convert('RGB')).astype(np.float32)
    lum = 0.2126 * a[..., 0] + 0.7152 * a[..., 1] + 0.0722 * a[..., 2]
    alpha = (255 * (lum - 36) / 219) if mode == 'dark' else (255 * (248 - lum) / 248)
    out = np.zeros(a.shape[:2] + (4,), np.uint8)
    out[..., :3] = 255 if mode == 'dark' else 0
    out[..., 3] = np.clip(np.round(alpha), 0, 255)
    return Image.fromarray(out)


def cmd_ink(a):
    folder, m, _ = load(a.manifest)
    for img in chosen(m, a.only):
        for mode, src, dst in (('light', 'light.png', 'ink.png'), ('dark', 'dark.png', 'dark.ink.png')):
            s = folder / f"{img['name']}.{src}"
            if s.exists():
                ink = extract(s, mode)
                ink.save(folder / f"{img['name']}.{dst}")
                al = np.asarray(ink)[..., 3]
                print(f"{img['name']}.{dst}: transparent {np.mean(al == 0):.0%}, partial {np.mean((al > 0) & (al < 255)):.0%}")


def cmd_preview(a):
    folder, m, _ = load(a.manifest)
    (folder / '.preview').mkdir(exist_ok=True)
    for img in chosen(m, a.only):
        for mode, src in (('light', 'ink.png'), ('dark', 'dark.ink.png')):
            s = folder / f"{img['name']}.{src}"
            if not s.exists():
                continue
            ink = Image.open(s)
            page = Image.new('RGBA', ink.size, PAGE[mode] + (255,))
            page.alpha_composite(ink)
            w = 1400
            page.convert('RGB').resize((w, round(w * ink.height / ink.width)), Image.LANCZOS).save(
                folder / '.preview' / f"{img['name']}.{mode}.jpg", quality=86)
    print('previews in', folder / '.preview')


def media_dir(m):
    return ROOT / 'content/media/articles' / m['article']


def cmd_publish(a):
    folder, m, style = load(a.manifest)
    pub = style['publish']
    site = json.loads((ROOT / 'content/site.json').read_text(encoding='utf-8'))
    owner = m.get('owner', site.get('name', ''))
    out = media_dir(m)
    out.mkdir(parents=True, exist_ok=True)
    for img in chosen(m, a.only):
        if len(img['alt']) > pub['maxAlt']:
            sys.exit(f"{img['name']}: alt is {len(img['alt'])} characters, over {pub['maxAlt']}")
        for src, dst in (('ink.png', '.webp'), ('dark.ink.png', '.dark.webp')):
            ink = Image.open(folder / f"{img['name']}.{src}")
            if ink.width > pub['maxWidth']:
                ink = ink.resize((pub['maxWidth'], round(pub['maxWidth'] * ink.height / ink.width)), Image.LANCZOS)
            path = out / f"{img['name']}{dst}"
            ink.save(path, lossless=True, method=6)
            if path.stat().st_size > pub['maxBytes']:  # fall back to near-lossless colour, exact alpha
                ink.save(path, quality=92, alpha_quality=100, method=6)
            print(f'{path.relative_to(ROOT)}: {ink.size[0]}x{ink.size[1]}, {path.stat().st_size // 1024} KB')
            if path.stat().st_size > pub['maxBytes']:
                sys.exit(f'{path.name} is over the media budget')
        sidecar = {
            'kind': 'image', 'file': f"{img['name']}.webp", 'alt': img['alt'],
            'credit': pub['credit'].replace('{owner}', owner),
            'licence': {'name': pub['licence'], 'owner': owner},
            'dark': {'file': f"{img['name']}.dark.webp"}, 'visibility': 'public',
        }
        (out / f"{img['name']}.json").write_text(json.dumps(sidecar, indent=2, ensure_ascii=False) + '\n', encoding='utf-8', newline='\n')


def block_text(b):
    return b.get('markdown') or b.get('text') or ''


def cmd_place(a):
    folder, m, style = load(a.manifest)
    pub = style['publish']
    path = ROOT / 'content/articles' / f"{m['article']}.json"
    art = json.loads(path.read_text(encoding='utf-8'))
    prefix = f"articles/{m['article']}/"
    # Only this set's own figures are replaced: other pictures in the article's folder (a photo) stay put.
    ours = {prefix + img['name'] for img in m['images']}
    body = [b for b in art['body'] if not (b['type'] == 'figure' and b.get('media') in ours)]
    for img in m['images']:
        media = prefix + img['name']
        if img.get('use') == 'hero':
            art['hero'] = {'media': media, **pub['hero']}
            continue
        hits = [i for i, b in enumerate(body) if block_text(b).startswith(img['after']) or
                (b['type'] == 'heading' and ('## ' + block_text(b)).startswith(img['after']))]
        if len(hits) != 1:
            sys.exit(f"{img['name']}: 'after' matches {len(hits)} blocks")
        at = hits[0] + 1
        while at < len(body) and body[at]['type'] == 'figure':
            at += 1
        body.insert(at, {'type': 'figure', 'media': media, 'width': img.get('width', 'popout'), **pub['figure']})
    art['body'] = body
    path.write_text(json.dumps(art, indent=2, ensure_ascii=False) + '\n', encoding='utf-8', newline='\n')
    print(f"placed {len(m['images'])} pictures in {path.relative_to(ROOT)}")


def main():
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = p.add_subparsers(dest='cmd', required=True)
    for name in ('gen', 'ink', 'preview', 'publish', 'place'):
        s = sub.add_parser(name)
        s.add_argument('manifest')
        s.add_argument('--only')
        if name == 'gen':
            s.add_argument('--mode', choices=('light', 'dark', 'both'), default='both')
            s.add_argument('--jobs', type=int, default=4)
            s.add_argument('--force', action='store_true')
    a = p.parse_args()
    {'gen': cmd_gen, 'ink': cmd_ink, 'preview': cmd_preview, 'publish': cmd_publish, 'place': cmd_place}[a.cmd](a)


if __name__ == '__main__':
    main()
