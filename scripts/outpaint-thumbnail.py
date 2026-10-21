"""Widen a real picture to a thumbnail shape (documentation/content/media.md §9.4) without changing it.

    python scripts/outpaint-thumbnail.py <master> <out.png> --size 2016x864 --prompt "…" [--crop x,y,w,h]

The picture (optionally cut first, to drop chrome) is scaled to the target's height and centred; only the new
margins are painted, by the gpt-image-2-5 skill's CLI with a mask, and the original pixels are pasted back
exactly afterwards, so nothing the picture shows is redrawn. The prompt is kept beside the output.
"""
from __future__ import annotations

import argparse
import os
import subprocess
import sys
import tempfile
from pathlib import Path

from PIL import Image

CLI = Path(os.environ.get('GPT_IMAGE_CLI', Path.home() / '.copilot/skills/gpt-image-2-5/scripts/imagegen.py'))
STYLE = ('Outpainting: the transparent areas of the mask are NEW canvas beside an existing picture. Continue the picture '
         'seamlessly into them with the same lighting, palette, texture, perspective and level of detail, so no seam shows. '
         'Never change, redraw or move anything in the existing picture. No text, logos, watermarks, borders or frames.')


def main():
    p = argparse.ArgumentParser()
    p.add_argument('src')
    p.add_argument('out')
    p.add_argument('--size', required=True)
    p.add_argument('--prompt', required=True)
    p.add_argument('--crop')
    a = p.parse_args()
    w, h = (int(v) for v in a.size.split('x'))
    pic = Image.open(a.src).convert('RGB')
    if a.crop:
        x, y, cw, ch = (int(v) for v in a.crop.split(','))
        pic = pic.crop((x, y, x + cw, y + ch))
    sw = round(pic.width * h / pic.height)
    if sw > w:
        sys.exit('the picture is already wider than the target: crop it instead')
    pic = pic.resize((sw, h), Image.LANCZOS)
    left = (w - sw) // 2
    # the canvas: the picture's edge columns stretched outwards (a neutral start), the mask clear there
    canvas = Image.new('RGB', (w, h))
    canvas.paste(pic.crop((0, 0, 1, h)).resize((left, h)), (0, 0))
    canvas.paste(pic.crop((sw - 1, 0, sw, h)).resize((w - left - sw, h)), (left + sw, 0))
    canvas.paste(pic, (left, 0))
    mask = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    mask.paste(Image.new('RGBA', (sw, h), (0, 0, 0, 255)), (left, 0))
    out = Path(a.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    prompt = f'{STYLE}\n\nSCENE: {a.prompt}'
    out.with_suffix('.prompt.txt').write_text(prompt + '\n', encoding='utf-8', newline='\n')
    with tempfile.TemporaryDirectory() as tmp:
        c, m, raw = Path(tmp, 'canvas.png'), Path(tmp, 'mask.png'), Path(tmp, 'raw.png')
        canvas.save(c)
        mask.save(m)
        r = subprocess.run([sys.executable, str(CLI), 'edit', '-i', str(c), '--mask', str(m), '-p', prompt, '-o', str(raw),
                            '--size', a.size, '--quality', 'high', '--background', 'opaque'],
                           capture_output=True, text=True, encoding='utf-8', errors='replace', timeout=900)
        if r.returncode:
            sys.exit((r.stdout + r.stderr).strip()[-600:])
        gen = Image.open(raw).convert('RGB').resize((w, h), Image.LANCZOS)
    # the model drifts inside the mask too: the original's pixels go back exactly
    gen.paste(pic, (left, 0))
    gen.save(out)
    print(f'{out}: {w}x{h}, picture {sw}px wide at {left}')


if __name__ == '__main__':
    main()
