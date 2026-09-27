"""Build the game's sound effects from CC0 sources into small MP3 loops and sprites.

Every source is CC0 (Freesound previews, OpenGameArt, Kenney). The script downloads them into a
git-ignored cache, cuts and cleans the chosen parts, and writes:
  public/audio/{stream,wind,pant,steps,birds,ui,dog}.mp3, and the night set (fetched when night first falls):
  public/audio/{crickets,frogs,croaks}.mp3
  src/game/audio/audioManifest.ts   (URLs, loop points, sprite slots in seconds)
and prints a check of every output (level, loop seam, slot count, size).

Requires Python 3.10+ with numpy + scipy, and ffmpeg on PATH. Outputs are committed, so only asset
authors need it:
    python scripts/build-audio.py
"""
from __future__ import annotations

import io
import json
import re
import subprocess
import urllib.request
import zipfile
from pathlib import Path

import numpy as np
from scipy import signal

ROOT = Path(__file__).resolve().parent.parent
CACHE = ROOT / "assets-src" / "audio" / ".cache"
OUT = ROOT / "public" / "audio"
MANIFEST = ROOT / "src" / "game" / "audio" / "audioManifest.ts"
SR = 44100
UA = {"User-Agent": "Mozilla/5.0 (personal-site audio build)"}

# id: (url, cache file). All CC0 1.0 (see assets-src/CREDITS.md for titles, authors and pages).
SOURCES = {
    "brook": ("https://cdn.freesound.org/previews/818/818648_17169211-hq.mp3", "fs-818648-brook.mp3"),
    "wind": ("https://cdn.freesound.org/previews/403/403051_338690-hq.mp3", "fs-403051-wind-forest.mp3"),
    "grass": ("https://cdn.freesound.org/previews/521/521587_9395330-hq.mp3", "fs-521587-steps-grass.mp3"),
    "wood": ("https://cdn.freesound.org/previews/521/521589_9395330-hq.mp3", "fs-521589-steps-wood.mp3"),
    "splash": ("https://cdn.freesound.org/previews/861/861369_8154783-hq.mp3", "fs-861369-steps-water.mp3"),
    "vireo": ("https://cdn.freesound.org/previews/475/475043_9786444-hq.mp3", "fs-475043-vireo.mp3"),
    "tsip": ("https://cdn.freesound.org/previews/182/182507_854782-hq.mp3", "fs-182507-chirp.mp3"),
    "sparrows": ("https://opengameart.org/sites/default/files/birds-isaiah658_0.ogg", "oga-birds-isaiah658.ogg"),
    # Chopper (docs/poc-3d-navigation/chopper.md §6)
    "barks": ("https://cdn.freesound.org/previews/361/361544_6512973-hq.mp3", "fs-361544-small-dog-barks.mp3"),
    "yap": ("https://cdn.freesound.org/previews/813/813120_71257-hq.mp3", "fs-813120-tiny-dog-bark.mp3"),
    "woof": ("https://cdn.freesound.org/previews/630/630648_7228277-hq.mp3", "fs-630648-single-bark.mp3"),
    "sniffs": ("https://cdn.freesound.org/previews/353/353107_6379101-hq.mp3", "fs-353107-dog-sniffing.mp3"),
    "sniff": ("https://cdn.freesound.org/previews/721/721000_15642582-hq.mp3", "fs-721000-sniff.mp3"),
    "whistle": ("https://cdn.freesound.org/previews/551/551960_8655650-hq.mp3", "fs-551960-come-here-whistle.mp3"),
    "pant": ("https://cdn.freesound.org/previews/841/841349_71257-hq.mp3", "fs-841349-dog-panting-loop.mp3"),
    # the night (docs/poc-3d-navigation/day-night.md: crickets everywhere, frogs by the water)
    "crickets": ("https://cdn.freesound.org/previews/521/521844_129727-hq.mp3", "fs-521844-close-crickets.mp3"),
    "chorus": ("https://cdn.freesound.org/previews/750/750836_16236894-hq.mp3", "fs-750836-crickets-at-night.mp3"),
    "treefrogs": ("https://cdn.freesound.org/previews/852/852657_2520418-hq.mp3", "fs-852657-pacific-tree-frogs.mp3"),
    "greenfrog": ("https://cdn.freesound.org/previews/188/188195_1480854-hq.mp3", "fs-188195-green-frog.mp3"),
}
KENNEY = {
    "rpg": ("https://kenney.nl/media/pages/assets/rpg-audio/8e99002d76-1677590336/kenney_rpg-audio.zip", "kenney_rpg-audio.zip"),
    "interface": ("https://kenney.nl/media/pages/assets/interface-sounds/fa43c1dd4d-1677589452/kenney_interface-sounds.zip", "kenney_interface-sounds.zip"),
    "jingles": ("https://kenney.nl/media/pages/assets/music-jingles/f37e530b9e-1677590399/kenney_music-jingles.zip", "kenney_music-jingles.zip"),
}


# ---------------------------------------------------------------------------- io


def fetch(url: str, name: str) -> Path:
    CACHE.mkdir(parents=True, exist_ok=True)
    p = CACHE / name
    if not p.exists():
        data = urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=120).read()
        p.write_bytes(data)
    return p


def decode(src: Path | bytes, start: float = 0.0, dur: float | None = None) -> np.ndarray:
    cmd = ["ffmpeg", "-v", "error"]
    if start:
        cmd += ["-ss", f"{start}"]  # an input seek on a pipe (Ogg from a zip) silently drops most of the stream
    if dur:
        cmd += ["-t", f"{dur}"]
    cmd += ["-i", "pipe:0" if isinstance(src, bytes) else str(src), "-ac", "1", "-ar", str(SR), "-f", "f32le", "-"]
    out = subprocess.run(cmd, input=src if isinstance(src, bytes) else None, capture_output=True, check=True).stdout
    return np.frombuffer(out, dtype=np.float32).astype(np.float64)


def kenney(pack: str, filename: str) -> np.ndarray:
    url, name = KENNEY[pack]
    z = zipfile.ZipFile(fetch(url, name))
    member = next(n for n in z.namelist() if n.endswith("/" + filename) or n == filename)
    return decode(z.read(member))


def encode(x: np.ndarray, path: Path, kbps: int) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    pcm = np.clip(x, -1, 1).astype(np.float32).tobytes()
    subprocess.run(
        ["ffmpeg", "-v", "error", "-y", "-f", "f32le", "-ar", str(SR), "-ac", "1", "-i", "pipe:0", "-c:a", "libmp3lame", "-b:a", f"{kbps}k", str(path)],
        input=pcm,
        check=True,
    )


# ---------------------------------------------------------------------------- dsp


def db(v: float) -> float:
    return 20 * np.log10(max(v, 1e-12))


def rms(x: np.ndarray) -> float:
    return float(np.sqrt(np.mean(x**2))) if len(x) else 0.0


def highpass(x: np.ndarray, hz: float, order: int = 4) -> np.ndarray:
    sos = signal.butter(order, hz, btype="high", fs=SR, output="sos")
    return signal.sosfiltfilt(sos, x)


def lowpass(x: np.ndarray, hz: float, order: int = 4) -> np.ndarray:
    sos = signal.butter(order, hz, btype="low", fs=SR, output="sos")
    return signal.sosfiltfilt(sos, x)


def envelope_db(x: np.ndarray, hop_s: float = 0.005) -> np.ndarray:
    hop = int(hop_s * SR)
    n = max(1, len(x) // hop)
    return np.array([db(rms(x[i * hop : (i + 1) * hop])) for i in range(n)])


def denoise(x: np.ndarray, noise: np.ndarray, over: float = 1.6, floor: float = 0.06) -> np.ndarray:
    """Spectral gate: subtract `over` × the noise profile's magnitude, keep a small floor."""
    f, t, Z = signal.stft(x, SR, nperseg=1024, noverlap=768)
    _, _, N = signal.stft(noise, SR, nperseg=1024, noverlap=768)
    prof = np.mean(np.abs(N), axis=1, keepdims=True)
    mag = np.abs(Z)
    gain = np.maximum(1 - over * prof / (mag + 1e-12), floor)
    gain = signal.medfilt2d(gain, (3, 5))  # no musical-noise chirps
    _, y = signal.istft(Z * gain, SR, nperseg=1024, noverlap=768)
    return y[: len(x)]


def trim(x: np.ndarray, head_db: float = 40, tail_db: float = 48, pre: float = 0.008, fade: float = 0.04) -> np.ndarray:
    """Cut silence: from just before the sound rises within `head_db` of the peak, to where it decays below `tail_db`."""
    e = envelope_db(x)
    pk = e.max()
    hop = int(0.005 * SR)
    a = max(0, int(np.argmax(e > pk - head_db)) * hop - int(pre * SR))
    b = min(len(x), (len(e) - int(np.argmax(e[::-1] > pk - tail_db))) * hop + int(0.02 * SR))
    y = x[a:b].copy()
    n = min(int(fade * SR), len(y) // 3)
    y[-n:] *= np.cos(np.linspace(0, np.pi / 2, n)) ** 2
    m = min(int(0.003 * SR), len(y) // 4)
    y[:m] *= np.linspace(0, 1, m)
    return y


def soft_limit(x: np.ndarray, ceiling_db: float = -1.0, knee_db: float = 6.0) -> np.ndarray:
    """Transparent below the knee; rounds off the rare peaks above it so nothing clips after encoding."""
    c = 10 ** (ceiling_db / 20)
    k = c * 10 ** (-knee_db / 20)
    y = x.copy()
    m = np.abs(y) > k
    over = (np.abs(y[m]) - k) / (c - k)
    y[m] = np.sign(y[m]) * (k + (c - k) * np.tanh(over))
    return y


def peak_normalize(x: np.ndarray, peak_db: float) -> np.ndarray:
    return x * (10 ** (peak_db / 20) / (np.max(np.abs(x)) + 1e-12))


def loud_normalize(x: np.ndarray, target_db: float, peak_ceiling_db: float = -1.0) -> np.ndarray:
    """Level by the loudest 60 ms (so every step or chirp in a set sounds as loud), then keep peaks under the ceiling."""
    w = int(0.06 * SR)
    loud = max(rms(x[i : i + w]) for i in range(0, max(1, len(x) - w), w // 2))
    y = x * (10 ** (target_db / 20) / (loud + 1e-12))
    pk = np.max(np.abs(y))
    ceil = 10 ** (peak_ceiling_db / 20)
    if pk > ceil:
        y *= ceil / pk
    return y


def onsets(x: np.ndarray, min_gap: float, rise_db: float = 12, within_db: float = 26) -> list[float]:
    e = envelope_db(x)
    pk = e.max()
    out: list[float] = []
    for i in range(20, len(e)):
        if e[i] > pk - within_db and e[i] - e[i - 20 : i].min() > rise_db and (not out or i * 0.005 - out[-1] > min_gap):
            out.append(i * 0.005)
    return out


def seamless_loop(x: np.ndarray, length: float, xfade: float) -> np.ndarray:
    """A loop of `length` s: the tail beyond it is equal-power crossfaded into the head, so end→start is continuous."""
    L = int(length * SR)
    X = int(xfade * SR)
    assert len(x) >= L + X, "segment too short for the loop"
    y = x[:L].copy()
    t = np.linspace(0, np.pi / 2, X)
    y[:X] = x[L : L + X] * np.cos(t) + x[:X] * np.sin(t)
    return y


def pad_loop(y: np.ndarray, pad: float) -> tuple[np.ndarray, float, float]:
    """Wrap `pad` s of the loop round each end, so decoder delay/padding never lands inside [loopStart, loopEnd]."""
    P = int(pad * SR)
    return np.concatenate([y[-P:], y, y[:P]]), pad, pad + len(y) / SR


# ---------------------------------------------------------------------------- sprites


class Sprite:
    def __init__(self, lead: float = 0.12):
        self.parts: list[np.ndarray] = []
        self.slots: dict[str, list[list[float]]] = {}
        self.t = 0.0
        self.lead = lead

    def add(self, group: str, x: np.ndarray) -> None:
        gap = np.zeros(int(self.lead * SR))
        self.parts.append(gap)
        self.t += len(gap) / SR
        self.slots.setdefault(group, []).append([round(self.t, 4), round(len(x) / SR, 4)])
        self.parts.append(x)
        self.t += len(x) / SR

    def audio(self) -> np.ndarray:
        return np.concatenate(self.parts + [np.zeros(int(self.lead * SR))])


# ---------------------------------------------------------------------------- build


def src(name: str, start: float = 0.0, dur: float | None = None) -> np.ndarray:
    url, file = SOURCES[name]
    return decode(fetch(url, file), start, dur)


def steps_from(x: np.ndarray, count: int, length: float, hp: float, target_db: float, lp: float | None = None) -> list[np.ndarray]:
    x = highpass(x, hp)
    if lp:
        x = lowpass(x, lp)
    out = []
    for o in onsets(x, 0.3)[:count]:
        seg = x[max(0, int((o - 0.03) * SR)) : int((o + length) * SR)]
        out.append(loud_normalize(trim(seg, head_db=36, tail_db=42, fade=0.06), target_db))
    return out


def build() -> dict:
    manifest: dict = {}

    # --- ambience loops ------------------------------------------------------------------
    brook = highpass(src("brook", 8.0, 23.0), 90)
    loop = seamless_loop(brook, 20.0, 2.0)
    loop = soft_limit(loop * 10 ** (-22 / 20) / rms(loop), -2.0)
    padded, a, b = pad_loop(loop, 1.0)
    encode(padded, OUT / "stream.mp3", 64)
    manifest["stream"] = {"url": "/audio/stream.mp3", "loopStart": round(a, 4), "loopEnd": round(b, 4)}

    wind = highpass(src("wind", 20.0, 25.0), 70)
    loop = seamless_loop(wind, 22.0, 2.5)
    loop = soft_limit(loop * 10 ** (-20 / 20) / rms(loop), -2.0)
    padded, a, b = pad_loop(loop, 1.0)
    encode(padded, OUT / "wind.mp3", 64)
    manifest["wind"] = {"url": "/audio/wind.mp3", "loopStart": round(a, 4), "loopEnd": round(b, 4)}

    # --- footsteps: grass (lawn), wood (bridge), stone (plaza, paths, cobbles), water (wading)
    steps = Sprite()
    for s in steps_from(src("grass"), 6, 0.36, 140, -14):
        steps.add("grass", s)
    for s in steps_from(src("wood"), 6, 0.34, 110, -14):
        steps.add("wood", s)
    for i in range(6):
        k = kenney("rpg", f"footstep0{i}.ogg")
        steps.add("stone", loud_normalize(trim(highpass(k, 120), fade=0.05), -17))
    # the wading take is continuous, so cut whole strides between its quiet dips (onsets split a stride in two)
    splash = highpass(src("splash"), 110)
    for a0, a1 in [(0.72, 1.12), (1.27, 1.64), (2.33, 2.74), (3.42, 3.9), (5.02, 5.46), (6.15, 6.62)]:
        seg = trim(splash[int(a0 * SR) : int(a1 * SR)], head_db=30, tail_db=36, fade=0.08)
        steps.add("water", loud_normalize(seg, -15))
    encode(steps.audio(), OUT / "steps.mp3", 96)
    manifest["steps"] = {"url": "/audio/steps.mp3", "slots": steps.slots}

    # --- birds: short songs and chirps, cleaned of their backgrounds ------------------
    birds = Sprite(lead=0.15)
    vireo = src("vireo")
    vnoise = vireo[int(2.5 * SR) : int(5.8 * SR)]
    for a0, a1 in [(0.28, 1.32), (12.84, 13.80)]:
        seg = denoise(highpass(vireo[int(a0 * SR) : int(a1 * SR)], 1400), highpass(vnoise, 1400))
        birds.add("song", loud_normalize(trim(seg, head_db=34, tail_db=36, fade=0.08), -16, -2))
    tsip = src("tsip")
    seg = denoise(highpass(tsip[int(0.8 * SR) : int(3.2 * SR)], 2500), highpass(tsip[int(3.4 * SR) : int(4.6 * SR)], 2500))
    birds.add("song", loud_normalize(trim(seg, head_db=34, tail_db=36, fade=0.08), -16, -2))
    sp = src("sparrows")
    for a0, a1 in [(24.8, 26.45), (21.55, 22.16), (19.05, 20.36)]:
        seg = highpass(sp[int(a0 * SR) : int(a1 * SR)], 1500)
        birds.add("song", loud_normalize(trim(seg, head_db=36, tail_db=40, fade=0.08), -16, -2))
    encode(birds.audio(), OUT / "birds.mp3", 96)
    manifest["birds"] = {"url": "/audio/birds.mp3", "slots": birds.slots}

    # --- interaction cues ------------------------------------------------------------
    ui = Sprite()
    ui.add("chime", peak_normalize(trim(kenney("jingles", "jingles_STEEL16.ogg"), tail_db=44, fade=0.12), -3))
    ui.add("sparkle", peak_normalize(trim(kenney("interface", "maximize_006.ogg"), tail_db=44, fade=0.06), -3))
    ui.add("doorOpen", peak_normalize(trim(highpass(kenney("rpg", "doorOpen_1.ogg"), 90), tail_db=46, fade=0.1), -3))
    ui.add("doorClose", peak_normalize(trim(highpass(kenney("rpg", "doorClose_4.ogg"), 70), tail_db=46, fade=0.08), -3))
    c3 = highpass(kenney("rpg", "cloth3.ogg"), 90)
    c2 = highpass(kenney("rpg", "cloth2.ogg"), 90)
    swish = np.zeros(len(c3) + int(0.22 * SR))
    swish[: len(c3)] += c3
    swish[int(0.22 * SR) : int(0.22 * SR) + len(c2)] += 0.8 * c2[: len(swish) - int(0.22 * SR)]
    ui.add("curtain", peak_normalize(trim(swish, tail_db=44, fade=0.1), -4))
    encode(ui.audio(), OUT / "ui.mp3", 96)
    manifest["ui"] = {"url": "/audio/ui.mp3", "slots": ui.slots}

    # --- Chopper: small-dog barks, sniffs and the come-here whistle; a panting loop -----
    dog = Sprite()
    barks = highpass(src("barks"), 180)
    for a0, a1 in [(0.22, 0.86), (1.48, 2.06), (3.15, 3.98), (4.84, 5.5)]:
        dog.add("bark", loud_normalize(trim(barks[int(a0 * SR) : int(a1 * SR)], head_db=36, tail_db=40, fade=0.05), -12, -1.5))
    dog.add("bark", loud_normalize(trim(highpass(src("yap"), 180), head_db=36, tail_db=40, fade=0.03), -12, -1.5))
    dog.add("bark", loud_normalize(trim(highpass(src("woof"), 150)[int(0.66 * SR) :], head_db=36, tail_db=42, fade=0.06), -12, -1.5))
    sniffs = highpass(src("sniffs"), 350)
    for a0, a1 in [(0.55, 1.12), (1.18, 1.74), (1.52, 2.64)]:
        dog.add("sniff", loud_normalize(trim(sniffs[int(a0 * SR) : int(a1 * SR)], head_db=34, tail_db=38, fade=0.06), -20, -3))
    dog.add("sniff", loud_normalize(trim(highpass(src("sniff"), 350), head_db=34, tail_db=38, fade=0.05), -20, -3))
    whistle = highpass(src("whistle"), 600)
    for a0, a1 in [(2.35, 3.45), (8.95, 9.85)]:
        dog.add("whistle", loud_normalize(trim(whistle[int(a0 * SR) : int(a1 * SR)], head_db=40, tail_db=44, fade=0.06), -14, -2))
    encode(dog.audio(), OUT / "dog.mp3", 96)
    manifest["dog"] = {"url": "/audio/dog.mp3", "slots": dog.slots}
    pant = highpass(src("pant"), 200)
    loop = seamless_loop(pant, 1.8, 0.2)
    loop = soft_limit(loop * 10 ** (-20 / 20) / rms(loop), -2.0)
    padded, a, b = pad_loop(loop, 0.5)
    encode(padded, OUT / "pant.mp3", 64)
    manifest["pant"] = {"url": "/audio/pant.mp3", "loopStart": round(a, 4), "loopEnd": round(b, 4)}

    # --- the night: a cricket bed (a close cricket over a distant chorus), the tree frogs' chorus by the
    # water, and a green frog's single croaks; fetched only when night first falls ("lazy")
    close = highpass(src("crickets", 2.5, 17.0), 300)
    far = highpass(src("chorus", 66.5, 17.0), 1500)
    bed = close / rms(close) + 0.45 * far / rms(far)
    loop = seamless_loop(bed, 14.0, 2.0)
    loop = soft_limit(loop * 10 ** (-24 / 20) / rms(loop), -3.0)
    padded, a, b = pad_loop(loop, 1.0)
    encode(padded, OUT / "crickets.mp3", 48)
    manifest["crickets"] = {"url": "/audio/crickets.mp3", "loopStart": round(a, 4), "loopEnd": round(b, 4), "lazy": True}
    frogs = highpass(src("treefrogs", 166.0, 15.0), 500)
    loop = seamless_loop(frogs, 12.0, 2.0)
    loop = soft_limit(loop * 10 ** (-22 / 20) / rms(loop), -2.0)
    padded, a, b = pad_loop(loop, 1.0)
    encode(padded, OUT / "frogs.mp3", 40)
    manifest["frogs"] = {"url": "/audio/frogs.mp3", "loopStart": round(a, 4), "loopEnd": round(b, 4), "lazy": True}
    croaks = Sprite()
    green = highpass(src("greenfrog"), 150)
    for o in [1.155, 2.335, 4.165, 5.6, 7.39, 10.01]:
        seg = green[int((o - 0.03) * SR) : int((o + 0.4) * SR)]
        croaks.add("croak", loud_normalize(trim(seg, head_db=36, tail_db=40, fade=0.06), -16, -2))
    encode(croaks.audio(), OUT / "croaks.mp3", 64)
    manifest["croaks"] = {"url": "/audio/croaks.mp3", "slots": croaks.slots, "lazy": True}
    return manifest


def check(manifest: dict) -> None:
    """Re-decode every output and report what a listener would notice: level, clipping, loop seam, slot levels."""
    print("\nchecks:")
    for key, m in manifest.items():
        p = ROOT / "public" / m["url"].lstrip("/")
        x = decode(p)
        line = f"  {p.name:11s} {p.stat().st_size / 1024:6.1f} KB  {len(x) / SR:5.2f} s  peak {db(np.max(np.abs(x))):5.1f} dB  rms {db(rms(x)):5.1f} dB"
        if "loopStart" in m:
            a, b = int(m["loopStart"] * SR), int(m["loopEnd"] * SR)
            body = x[a:b]
            w = int(0.2 * SR)

            def cut(pre: np.ndarray, post: np.ndarray) -> tuple[float, float, float]:
                # sample step across the cut, loudness change and spectral change between the 200 ms either side
                d = abs(post[0] - pre[-1])
                lv = abs(db(rms(pre)) - db(rms(post)))
                _, P0 = signal.welch(pre, SR, nperseg=1024)
                _, P1 = signal.welch(post, SR, nperseg=1024)
                return d, lv, float(np.mean(np.abs(10 * np.log10(P0 + 1e-20) - 10 * np.log10(P1 + 1e-20))))

            seam = cut(body[-w:], body[:w])
            rng = np.random.default_rng(1)
            ref = np.array([cut(body[i - w : i], body[i : i + w]) for i in rng.integers(w, len(body) - w, 200)])
            # percentile of the seam among 200 random cut points inside the loop (50 = typical, > 95 = audible)
            pct = [int(np.mean(ref[:, k] < seam[k]) * 100) for k in range(3)]
            line += f"  seam percentile vs interior: step {pct[0]}, level {pct[1]}, spectrum {pct[2]}"
        else:
            parts = []
            for g, slots in m["slots"].items():
                lv = [db(rms(x[int(s * SR) : int((s + d) * SR)])) for s, d in slots]
                parts.append(f"{g}×{len(slots)} ({min(lv):.0f}…{max(lv):.0f} dB)")
            line += "  " + ", ".join(parts)
        print(line)


def write_manifest(manifest: dict) -> None:
    # one [start, duration] pair per line
    body = re.sub(r"\[\s+(-?[\d.]+),\s+(-?[\d.]+)\s+\]", r"[\1, \2]", json.dumps(manifest, indent=2))
    MANIFEST.parent.mkdir(parents=True, exist_ok=True)
    MANIFEST.write_text(
        "// Generated by scripts/build-audio.py — do not edit by hand.\n"
        "// Loops: play [loopStart, loopEnd] (s); the file wraps extra audio round both ends.\n"
        "// Sprites: slots are [start, duration] (s) inside the file.\n"
        f"export const AUDIO = {body} as const;\n\n"
        "export type SpriteKey = 'steps' | 'birds' | 'ui' | 'dog' | 'croaks';\n",
        encoding="utf-8",
    )


if __name__ == "__main__":
    m = build()
    write_manifest(m)
    check(m)
