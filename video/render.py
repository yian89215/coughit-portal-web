#!/usr/bin/env python3
"""Renders the CoughIt web video's drawn scenes (cards, drum stack, trio roll).

Look: white paper, ink #111111, pure grays, red only for a caught cough, the
same system font as the app (SF). Frames are drawn at 2x and downsampled so
thin rules and type stay crisp. Run via build.sh; needs Pillow + numpy.

  python3 render.py cards  OUT_DIR
  python3 render.py stack  OUT_DIR
  python3 render.py trio   OUT_DIR
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
    text(d, (MARGIN_X, 330), "Transform your cough", 150, "Heavy", INK, tracking=-0.04)
    text(d, (MARGIN_X, 330 + 150 * 1.06), "into music.", 150, "Heavy", INK, tracking=-0.04)
    if end:
        y = 800
        line(d, (MARGIN_X, y - 40), (W - MARGIN_X, y - 40), 1.5)
        text(d, (MARGIN_X, y), "Download on the App Store", 44, "Bold", INK)
        text(d, (MARGIN_X, y + 70), "dreamalitylab.cc/coughit-eng", 34, "Medium", MUTED)
        text(d, (W - MARGIN_X, y + 70), "© 2026 CoughIt", 34, "Medium", MUTED, anchor="ra")
    return finish(img)


def card_sep(msg):
    img, d = new_canvas()
    text(d, (W / 2, H / 2), msg, 96, "Heavy", INK, anchor="mm", tracking=0)
    return finish(img)


def make_cards(out):
    os.makedirs(out, exist_ok=True)
    card_title().save(os.path.join(out, "title.png"))
    card_title(end=True).save(os.path.join(out, "end.png"))
    for i, msg in enumerate([
        "It starts with a cough.",
        "Each cough becomes a track.",
        "Three coughs, one piece.",
    ], 1):
        card_sep(msg).save(os.path.join(out, f"sep{i}.png"))


# ---------------------------------------------------------------- stack ----

STACK_SECONDS = 22.0
STACK_ENTRIES = [  # (time in the drum mix when the first note is heard, label)
    (0.10, "Crash"),
    (4.26, "Snare"),
    (8.13, "Hi-hat"),
    (12.49, "Kick"),
]
OUTPUT_AT = 17.0
ROW_X0, ROW_X1, ROW_Y = 160, 1760, 560
ROW_HALF = 190
BAR_PITCH = 6  # px between waveform bars
_stack = {}


def stack_setup():
    if _stack:
        return
    x, sr = read_wav(os.path.join(SRC, "cocreate_drum.wav"))
    x = x[: int(STACK_SECONDS * sr)]
    cols = (ROW_X1 - ROW_X0) // BAR_PITCH
    per = len(x) / cols
    peaks = np.array([np.abs(x[int(i * per):int((i + 1) * per) + 1]).max() for i in range(cols)])
    peaks = peaks / peaks.max()
    _stack["bars"] = np.maximum(peaks ** 0.55, 0.012)  # lift quiet hits, keep a thin floor
    _stack["cols"] = cols


def stack_frame(fi):
    stack_setup()
    t = fi / FPS
    img, d = new_canvas()
    cols = _stack["cols"]
    bars = _stack["bars"]
    px_per_s = (ROW_X1 - ROW_X0) / STACK_SECONDS
    play_x = ROW_X0 + t * px_per_s

    # counter: how many coughs have joined so far
    n = sum(1 for et, _ in STACK_ENTRIES if t >= et)
    if n:
        last_t = [et for et, _ in STACK_ENTRIES if t >= et][-1]
        pop = ease((t - last_t) / 0.25)
        text(d, (MARGIN_X, 96), str(n), 230, "Heavy", INK, tracking=-0.04)
        nw = text_width(str(n), 230, "Heavy", tracking=-0.04)
        word = "cough" if n == 1 else "coughs"
        text(d, (MARGIN_X + nw + 28, 250), word, 52, "Bold", INK)
        if pop < 1:  # soft flash as a new one joins
            veil = Image.new("RGB", (S(520), S(300)), PAPER)
            img.paste(Image.blend(img.crop((S(MARGIN_X - 10), S(80), S(MARGIN_X + 510), S(380))), veil, 0.65 * (1 - pop)),
                      (S(MARGIN_X - 10), S(80)))
            d = ImageDraw.Draw(img)

    # waveform row: played part ink, unplayed part light gray (as in the app)
    for i in range(cols):
        x = ROW_X0 + i * BAR_PITCH
        h = bars[i] * ROW_HALF
        col = INK if x + BAR_PITCH / 2 <= play_x else UNPLAYED
        rect(d, (x, ROW_Y - h, x + 3, ROW_Y + h), fill=col)

    # playhead
    line(d, (play_x, ROW_Y - ROW_HALF - 28), (play_x, ROW_Y + ROW_HALF + 28), 2)

    # entry labels under the row, placed at the moment each cough's drum is heard
    for k, (et, name) in enumerate(STACK_ENTRIES):
        a = ease((t - et) / 0.3)
        if a <= 0:
            continue
        ex = ROW_X0 + et * px_per_s
        ink = mix(PAPER, INK, a)
        sub = mix(PAPER, MUTED, a)
        line(d, (ex, ROW_Y + ROW_HALF + 22), (ex, ROW_Y + ROW_HALF + 74), 1.5, fill=ink)
        text(d, (ex + 14, ROW_Y + ROW_HALF + 28), f"Cough {k + 1}", 26, "Medium", sub)
        text(d, (ex + 14, ROW_Y + ROW_HALF + 62), name, 46, "Heavy", ink, tracking=-0.02)

    # output label
    a = ease((t - OUTPUT_AT) / 0.4)
    if a > 0:
        ink = mix(PAPER, INK, a)
        text(d, (ROW_X1, ROW_Y - ROW_HALF - 70), "Output", 46, "Heavy", ink, anchor="ra", tracking=-0.02)

    return finish(img)


# ----------------------------------------------------------------- trio ----

TRIO_T0, TRIO_T1 = 18.0, 27.0  # excerpt of cocreate_trio.wav
TRIO_PPS = 160
LANE_X0, LANE_X1 = 160, 1760
LANES_Y = [250, 510, 770]
LANE_H = 220
_trio = {}


def trio_setup():
    if _trio:
        return
    viz = json.load(open(os.path.join(SRC, "cocreate_trio_viz.json")))
    order = ["mel", "acc", "bass"]
    tracks = {t["id"]: t for t in viz["tracks"]}
    _trio["duration"] = 34.45  # length of cocreate_trio.wav, shown as 00:34 like the app
    lanes = []
    for tid in order:
        notes = tracks[tid]["notes"]
        pitches = [n["pitch"] for n in notes]
        lanes.append((notes, min(pitches), max(pitches)))
    _trio["lanes"] = lanes


def trio_frame(fi):
    trio_setup()
    t = TRIO_T0 + fi / FPS
    img, d = new_canvas()
    head_x = LANE_X0 + (LANE_X1 - LANE_X0) / 3
    note_w = 0.125 * TRIO_PPS
    for li, (top, (notes, pmin, pmax)) in enumerate(zip(LANES_Y, _trio["lanes"])):
        rect(d, (LANE_X0, top, LANE_X1, top + LANE_H), fill=LANE)
        text(d, (LANE_X0, top - 40), ["Violin", "Viola", "Double bass"][li], 26, "Medium", MUTED)
        span = max(pmax - pmin, 1)
        for n in notes:
            x = head_x + (n["start"] - t) * TRIO_PPS
            if x + note_w < LANE_X0 or x > LANE_X1:
                continue
            y = top + 22 + (1 - (n["pitch"] - pmin) / span) * (LANE_H - 44)
            a = 0.4 + 0.6 * min(max(n["velocity"], 0), 127) / 127
            x0, x1 = max(x, LANE_X0), min(x + note_w, LANE_X1)
            if x1 > x0:
                rect(d, (x0, y - 7, x1, y + 7), fill=mix(LANE, INK, a), radius=3)
    line(d, (head_x, LANES_Y[0] - 56), (head_x, LANES_Y[-1] + LANE_H + 28), 3)
    mm, ss = divmod(int(t), 60)
    dm, ds = divmod(int(round(_trio["duration"])), 60)
    text(d, (LANE_X0, LANES_Y[-1] + LANE_H + 40), f"{mm:02d}:{ss:02d}", 34, "Medium", INK2)
    text(d, (LANE_X1, LANES_Y[-1] + LANE_H + 40), f"{dm:02d}:{ds:02d}", 34, "Medium", MUTED, anchor="ra")
    return finish(img)


# ----------------------------------------------------------------- main ----

def _save(args):
    fn, fi, path = args
    {"stack": stack_frame, "trio": trio_frame}[fn](fi).save(path)


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
    elif what == "stack":
        render_seq("stack", out, int(STACK_SECONDS * FPS))
    elif what == "trio":
        render_seq("trio", out, int((TRIO_T1 - TRIO_T0) * FPS))
    else:
        raise SystemExit("unknown scene")
