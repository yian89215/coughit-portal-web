#!/usr/bin/env python3
"""Renders the CoughIt web video's drawn scenes (cards, cough-to-rhythm, cough-to-melody).

Look: white paper, ink #111111, pure grays, red only for a caught cough, the
same system font as the app (SF). Frames are drawn at 2x and downsampled so
thin rules and type stay crisp. Run via build.sh; needs Pillow + numpy.

  python3 render.py cards  OUT_DIR
  python3 render.py rhythm OUT_DIR
  python3 render.py melody OUT_DIR
"""
import json
import math
import os
import sys
from multiprocessing import Pool

import numpy as np
from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(HERE, "source")

W, H, FPS, SS = 1920, 1080, 30, 2  # output size, frame rate, supersample

PAPER = (255, 255, 255)
INK = (17, 17, 17)
INK2 = (68, 68, 68)
MUTED = (102, 102, 102)
HAIR = (218, 218, 218)
UNPLAYED = (189, 189, 189)
LANE = (247, 247, 247)
ALERT = (229, 48, 63)

SF = "/System/Library/Fonts/SFNS.ttf"
_font_cache = {}


def font(size, weight="Regular"):
    key = (size, weight)
    if key not in _font_cache:
        f = ImageFont.truetype(SF, int(size * SS))
        f.set_variation_by_name(weight)
        _font_cache[key] = f
    return _font_cache[key]


def new_canvas():
    img = Image.new("RGB", (W * SS, H * SS), PAPER)
    return img, ImageDraw.Draw(img)


def finish(img):
    return img.resize((W, H), Image.LANCZOS)


def S(v):
    return int(round(v * SS))


def text(d, xy, s, size, weight="Regular", fill=INK, anchor="la", spacing=1.0, tracking=0.0):
    """Draw text at 1x coordinates. tracking is in em (negative tightens)."""
    f = font(size, weight)
    x, y = xy
    if tracking == 0:
        d.text((S(x), S(y)), s, font=f, fill=fill, anchor=anchor)
        return
    # manual tracking: resolve horizontal anchoring ourselves, then draw left-anchored
    if anchor[0] == "r":
        x -= text_width(s, size, weight, tracking)
    elif anchor[0] == "m":
        x -= text_width(s, size, weight, tracking) / 2
    anchor = "l" + anchor[1]
    cx = S(x)
    for ch in s:
        d.text((cx, S(y)), ch, font=f, fill=fill, anchor=anchor)
        cx += d.textlength(ch, font=f) + tracking * size * SS
        if ch == " ":
            cx += 0.1 * size * SS  # tight tracking would otherwise glue words together


def text_width(s, size, weight="Regular", tracking=0.0):
    f = font(size, weight)
    tmp = ImageDraw.Draw(Image.new("RGB", (4, 4)))
    w = sum(tmp.textlength(ch, font=f) for ch in s) if tracking else tmp.textlength(s, font=f)
    w += tracking * size * SS * max(len(s) - 1, 0) + (0.1 * size * SS * s.count(" ") if tracking else 0)
    return w / SS


def line(d, p0, p1, w, fill=INK):
    d.line([(S(p0[0]), S(p0[1])), (S(p1[0]), S(p1[1]))], fill=fill, width=max(1, S(w)))


def rect(d, box, fill=None, outline=None, width=1, radius=0):
    b = [S(box[0]), S(box[1]), S(box[2]), S(box[3])]
    if radius:
        d.rounded_rectangle(b, radius=S(radius), fill=fill, outline=outline, width=S(width))
    else:
        d.rectangle(b, fill=fill, outline=outline, width=S(width) if outline else 0)


def ease(t):
    t = min(max(t, 0.0), 1.0)
    return t * t * (3 - 2 * t)


def mix(c0, c1, a):
    return tuple(int(round(c0[i] + (c1[i] - c0[i]) * a)) for i in range(3))


def read_wav(path):
    b = open(path, "rb").read()
    i = b.find(b"data")
    n = int.from_bytes(b[i + 4:i + 8], "little")
    return np.frombuffer(b[i + 8:i + 8 + n], dtype="<i2").astype(np.float64) / 32768.0, 16000


# ---------------------------------------------------------------- cards ----

MARGIN_X = 160


def wordmark(d):
    text(d, (MARGIN_X, 88), "CoughIt", 40, "Heavy", INK, tracking=-0.02)
    line(d, (MARGIN_X, 150), (W - MARGIN_X, 150), 1.5)


def card_title(end=False):
    img, d = new_canvas()
    wordmark(d)
    if end:
        text(d, (MARGIN_X, 330), "Transform your cough", 150, "Heavy", INK, tracking=-0.04)
        text(d, (MARGIN_X, 330 + 150 * 1.06), "into music.", 150, "Heavy", INK, tracking=-0.04)
        y = 800
        line(d, (MARGIN_X, y - 40), (W - MARGIN_X, y - 40), 1.5)
        text(d, (MARGIN_X, y), "Download on the App Store", 44, "Bold", INK)
        text(d, (MARGIN_X, y + 70), "dreamalitylab.cc/coughit-eng", 34, "Medium", MUTED)
        text(d, (W - MARGIN_X, y + 70), "© 2026 CoughIt", 34, "Medium", MUTED, anchor="ra")
    else:
        text(d, (MARGIN_X, 330), "Can a cough", 150, "Heavy", INK, tracking=-0.04)
        text(d, (MARGIN_X, 330 + 150 * 1.06), "become music?", 150, "Heavy", INK, tracking=-0.04)
    return finish(img)


def card_sep(msg):
    img, d = new_canvas()
    lines = msg.split("\n")
    lh = 96 * 1.2
    y0 = H / 2 - lh * (len(lines) - 1) / 2
    for i, ln in enumerate(lines):
        text(d, (W / 2, y0 + i * lh), ln, 96, "Heavy", INK, anchor="mm", tracking=0)
    return finish(img)


SEP_CARDS = [
    "It starts with a cough.",
    "A cough becomes a rhythm.",
    "A cough becomes a melody.",
    "Now imagine many coughs,\nplayed together.",
]


def make_cards(out):
    os.makedirs(out, exist_ok=True)
    card_title().save(os.path.join(out, "title.png"))
    card_title(end=True).save(os.path.join(out, "end.png"))
    for i, msg in enumerate(SEP_CARDS, 1):
        card_sep(msg).save(os.path.join(out, f"sep{i}.png"))


# --------------------------------------------------- cough -> music pair ----
# One cough on the left, the music the app makes from it on the right. Both are
# the web page's first examples (Crash 1 and Trio 1), so the video and the page
# show the same audio and MIDI.

DEMO = os.path.join(HERE, "..", "assets", "demo")
GAP = 0.6   # silence between the cough and its music
TAIL = 0.6  # hold after the music ends

PAIRS = {
    "rhythm": dict(
        cough=os.path.join(DEMO, "drum", "cough-15.wav"), cough_range=(0.7, 3.4),
        motif=os.path.join(DEMO, "drum", "motif-15.wav"), motif_range=(0.0, 3.8),
        midi=os.path.join(DEMO, "drum", "motif-15.json"),
        label="Rhythm", lanes=["Crash"],
    ),
    "melody": dict(
        cough=os.path.join(DEMO, "trio", "cough-3.wav"), cough_range=(0.45, 4.35),
        motif=os.path.join(DEMO, "trio", "motif-3.wav"), motif_range=(0.5, 4.6),
        midi=os.path.join(DEMO, "trio", "motif-3.json"),
        label="Melody", lanes=["Violin", "Viola", "Double bass"],
    ),
}


def pair_durations(kind):
    c = PAIRS[kind]
    da = c["cough_range"][1] - c["cough_range"][0]
    db = c["motif_range"][1] - c["motif_range"][0]
    return da, db, da + GAP + db + TAIL


PAIR_SECONDS = {k: pair_durations(k)[2] for k in PAIRS}

BAR_PITCH = 6  # px between waveform bars
PANEL_W = 640
LEFT_X0 = MARGIN_X
RIGHT_X0 = W - MARGIN_X - PANEL_W
CENTER_Y = 560
_pair = {}


def pair_setup(kind):
    if kind in _pair:
        return _pair[kind]
    c = PAIRS[kind]
    x, sr = read_wav(c["cough"])
    x = x[int(c["cough_range"][0] * sr):int(c["cough_range"][1] * sr)]
    cols = PANEL_W // BAR_PITCH
    per = len(x) / cols
    peaks = np.array([np.abs(x[int(i * per):int((i + 1) * per) + 1]).max() for i in range(cols)])
    bars = np.maximum((peaks / peaks.max()) ** 0.55, 0.012)
    midi = json.load(open(c["midi"]))
    notes = [[dict(n) for n in t["notes"]] for t in midi["tracks"]]
    allnotes = [n for t in notes for n in t]
    m0 = c["motif_range"][0]
    m1 = c["motif_range"][1]
    pitches = [(min(n["pitch"] for n in t), max(n["pitch"] for n in t)) for t in notes]
    _pair[kind] = dict(bars=bars, cols=cols, notes=notes, m0=m0, m1=m1, pitches=pitches)
    return _pair[kind]


def arrow(d, x0, x1, y, fill):
    line(d, (x0, y), (x1, y), 3, fill=fill)
    line(d, (x1 - 22, y - 18), (x1, y), 3, fill=fill)
    line(d, (x1 - 22, y + 18), (x1, y), 3, fill=fill)


def pair_frame(kind, fi):
    st = pair_setup(kind)
    c = PAIRS[kind]
    da, db, _ = pair_durations(kind)
    t = fi / FPS
    b0 = da + GAP
    img, d = new_canvas()

    # left: the cough waveform, played part ink, unplayed part light gray
    cols, bars = st["cols"], st["bars"]
    half = 150
    play_a = LEFT_X0 + min(max(t / da, 0.0), 1.0) * PANEL_W
    nlanes = len(c["lanes"])
    lane_h = 220 if nlanes == 1 else 150
    lane_gap = 40
    block = nlanes * lane_h + (nlanes - 1) * lane_gap
    top0 = CENTER_Y - block / 2
    label_y = min(CENTER_Y - half - 130, top0 - 140)
    text(d, (LEFT_X0, label_y), "Cough", 46, "Heavy", INK, tracking=-0.02)
    for i in range(cols):
        x = LEFT_X0 + i * BAR_PITCH
        h = bars[i] * half
        col = INK if x + BAR_PITCH / 2 <= play_a else UNPLAYED
        rect(d, (x, CENTER_Y - h, x + 3, CENTER_Y + h), fill=col)
    if 0 < t < da:
        line(d, (play_a, CENTER_Y - half - 24), (play_a, CENTER_Y + half + 24), 2)

    # arrow and right-hand label appear just before the music starts
    a = ease((t - (b0 - 0.5)) / 0.4)
    if a > 0:
        arrow(d, LEFT_X0 + PANEL_W + 70, RIGHT_X0 - 70, CENTER_Y, mix(PAPER, INK, a))
        text(d, (RIGHT_X0, label_y), c["label"], 46, "Heavy", mix(PAPER, INK, a), tracking=-0.02)

    # right: MIDI lanes; notes fade in light, darken as the playhead passes
    m0, m1 = st["m0"], st["m1"]
    span_t = m1 - m0
    tm = m0 + (t - b0)  # position in the motif audio
    play_b = RIGHT_X0 + min(max((tm - m0) / span_t, 0.0), 1.0) * PANEL_W
    for li in range(nlanes):
        top = top0 + li * (lane_h + lane_gap)
        rect(d, (RIGHT_X0, top, RIGHT_X0 + PANEL_W, top + lane_h), fill=mix(PAPER, LANE, a))
        text(d, (RIGHT_X0, top - 36), c["lanes"][li], 26, "Medium", mix(PAPER, MUTED, a))
        notes = st["notes"][li]
        pmin, pmax = st["pitches"][li]
        pspan = max(pmax - pmin, 1)
        for n in notes:
            nx0 = RIGHT_X0 + (n["start"] - m0) / span_t * PANEL_W
            nx1 = max(RIGHT_X0 + (n["end"] - m0) / span_t * PANEL_W, nx0 + 10)
            if nlanes == 1:
                ny, nh = top + lane_h / 2, 22
            else:
                ny, nh = top + 18 + (1 - (n["pitch"] - pmin) / pspan) * (lane_h - 36), 7
            played = t >= b0 and tm >= n["start"]
            col = mix(PAPER, INK, a) if played else mix(PAPER, UNPLAYED, a)
            rect(d, (nx0, ny - nh, nx1, ny + nh), fill=col, radius=3)
    if b0 <= t < b0 + db:
        line(d, (play_b, top0 - 30), (play_b, top0 + block + 30), 3)

    return finish(img)


# ----------------------------------------------------------------- main ----

def _save(args):
    fn, fi, path = args
    pair_frame(fn, fi).save(path)


def render_seq(kind, out, frames):
    os.makedirs(out, exist_ok=True)
    jobs = [(kind, i, os.path.join(out, f"{i:05d}.png")) for i in range(frames)]
    with Pool(max(os.cpu_count() - 2, 2)) as p:
        for k, _ in enumerate(p.imap(_save, jobs, chunksize=8)):
            if k % 100 == 0:
                print(f"{kind}: {k}/{frames}", flush=True)


if __name__ == "__main__":
    what, out = sys.argv[1], sys.argv[2]
    if what == "cards":
        make_cards(out)
    elif what in PAIRS:
        render_seq(what, out, int(round(PAIR_SECONDS[what] * FPS)))
    else:
        raise SystemExit("unknown scene")
