#!/usr/bin/env python3
"""Turns a raw simulator recording of the app's map screen into source/map_<kind>.mp4.

  python3 prep_map.py RAW.mov drum|trio [OUT_DIR]

The map screen is the full-screen "cough origins" view of a demo. Only two areas
are kept, side by side on white: the map (without the back and zoom buttons) and
the card's piano roll with its time labels (without the tab row, the city name
and the play button). That leaves no "Co-create" wording on screen. Everything
is turned gray except red, which stays on the map (the red pin and its label),
the same rule the rest of the video follows.

The clip starts 1.0 s before the first frame where the piano roll moves, and
runs LEAD + SECONDS long. build.py expects playback to start 1.0 s in.
"""
import os
import subprocess
import sys

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
LEAD, SECONDS = 1.0, 10.0
FPS = 30
SCALE = 0.72

# Crops in the recording's own pixels (1206 x 2622). x, y, w, h.
CROPS = {
    "drum": dict(map=(0, 520, 1206, 1080), roll=(60, 1838, 1090, 402)),
    "trio": dict(map=(0, 520, 1206, 900), roll=(60, 1662, 1090, 578)),
}


def play_start(raw, roll):
    """Seconds into the recording at which the piano roll first changes."""
    x, y, w, h = roll
    cmd = ["ffmpeg", "-v", "error", "-i", raw, "-vf",
           f"fps={FPS},crop={w}:{h}:{x}:{y},scale=160:-2,format=gray",
           "-f", "rawvideo", "-"]
    data = subprocess.run(cmd, capture_output=True, check=True).stdout
    fh = round(160 * h / w / 2) * 2
    frames = np.frombuffer(data, dtype=np.uint8).reshape(-1, fh, 160).astype(float)
    diff = np.abs(frames - frames[0]).mean(axis=(1, 2))
    idx = int(np.argmax(diff > 0.4))
    if diff[idx] <= 0.4:
        raise SystemExit("no playback found in the recording")
    return idx / FPS


def main():
    raw, kind = sys.argv[1], sys.argv[2]
    out_dir = sys.argv[3] if len(sys.argv) > 3 else os.path.join(HERE, "source")
    c = CROPS[kind]
    t_play = play_start(raw, c["roll"])
    t0 = max(t_play - LEAD, 0.0)
    print(f"{kind}: playback starts at {t_play:.2f}s in the recording, clip from {t0:.2f}s")

    mx, my, mw, mh = c["map"]
    rx, ry, rw, rh = c["roll"]
    pw, ph = round(mw * SCALE / 2) * 2, round(mh * SCALE / 2) * 2
    qw, qh = round(rw * SCALE / 2) * 2, round(rh * SCALE / 2) * 2
    gap = 56
    x0 = (1920 - (pw + gap + qw)) // 2
    qx = x0 + pw + gap
    py, qy = (1080 - ph) // 2, (1080 - qh) // 2

    red = "gt(r(X,Y)-g(X,Y),120)*gt(r(X,Y)-b(X,Y),100)*lt(g(X,Y),85)"
    fc = (
        f"[0:v]fps={FPS},trim=start={t0}:duration={LEAD + SECONDS},setpts=PTS-STARTPTS,split=2[a][b];"
        f"[a]crop={mw}:{mh}:{mx}:{my},scale={pw}:{ph}:flags=lanczos,format=rgba,split=2[m1][m2];"
        f"[m1]format=gray,format=rgba[g];"
        f"[m2]format=gbrap,geq=r='r(X,Y)':g='g(X,Y)':b='b(X,Y)':a='255*{red}'[r];"
        f"[g][r]overlay=format=auto,format=yuv420p[map];"
        f"[b]crop={rw}:{rh}:{rx}:{ry},scale={qw}:{qh}:flags=lanczos,format=gray,"
        f"curves=all='0/0 0.55/0.22 1/1',format=yuv420p[roll];"
        f"color=c=white:s=1920x1080:r={FPS}:d={LEAD + SECONDS}[bg];"
        f"[bg][map]overlay={x0}:{py}[t];[t][roll]overlay={qx}:{qy},"
        f"drawbox=x={x0 - 2}:y={py - 2}:w={pw + 4}:h={ph + 4}:color=0x111111:t=2,"
        f"drawbox=x={qx - 2}:y={qy - 2}:w={qw + 4}:h={qh + 4}:color=0x111111:t=2[v]"
    )
    os.makedirs(out_dir, exist_ok=True)
    out = os.path.join(out_dir, f"map_{kind}.mp4")
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", raw, "-filter_complex", fc, "-map", "[v]",
                    "-an", "-t", str(LEAD + SECONDS), "-c:v", "libx264", "-preset", "slow", "-crf", "18",
                    "-pix_fmt", "yuv420p", "-r", str(FPS), out], check=True)
    print("wrote", out)


if __name__ == "__main__":
    main()
