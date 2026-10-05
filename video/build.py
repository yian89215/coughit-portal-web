#!/usr/bin/env python3
"""Assembles assets/coughit-demo.mp4 (+ poster) from the drawn scenes, the
simulator recording and the demo audio. Needs ffmpeg, Pillow, numpy.

  python3 build.py [WORK_DIR]

WORK_DIR (default ./_work) holds frames and intermediates and is safe to delete.
Outputs go to ../assets/coughit-demo.mp4 and ../assets/video-poster.jpg.
"""
import os
import subprocess
import sys

import numpy as np

import render

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(HERE, "source")
OUT = os.path.join(HERE, "..", "assets")
WORK = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else os.path.join(HERE, "_work"))
os.makedirs(WORK, exist_ok=True)

FPS = 30
SR = 16000

# ---- timeline (seconds) -------------------------------------------------
D_TITLE, D_SEP, D_END = 4.0, 2.0, 4.0
D_STACK = render.STACK_SECONDS                      # 22.0
D_TRIO = render.TRIO_T1 - render.TRIO_T0            # 9.0

# Simulator recording: tap at 4.03s, cough detected (red) at 14.10s. Listening
# is static in between, so that stretch is cut and cross-faded.
REC_A = (3.2, 4.12)      # idle ring -> tap; dissolves into the listening dot before the start toast (4.13s-6.2s) appears
REC_B = (10.2, 17.6)     # listening -> red
REC_RED_AT = 14.10       # first red frame in the recording
XFADE = 0.3
D_PHONE = (REC_A[1] - REC_A[0]) + (REC_B[1] - REC_B[0]) - XFADE

T_TITLE = 0.0
T_SEP1 = T_TITLE + D_TITLE
T_PHONE = T_SEP1 + D_SEP
T_SEP2 = T_PHONE + D_PHONE
T_STACK = T_SEP2 + D_SEP
T_SEP3 = T_STACK + D_STACK
T_TRIO = T_SEP3 + D_SEP
T_END = T_TRIO + D_TRIO
T_TOTAL = T_END + D_END

# The cough is placed so its first loud burst lands just before the red frame.
COUGH_ONSET_IN_CLIP = 1.07
red_in_phone = (REC_A[1] - REC_A[0]) - XFADE + (REC_RED_AT - REC_B[0])
T_COUGH = T_PHONE + red_in_phone - 0.55 - COUGH_ONSET_IN_CLIP


def run(cmd, **kw):
    print("$", " ".join(str(c) for c in cmd)[:220], flush=True)
    subprocess.run(cmd, check=True, **kw)


def ffmpeg(*args):
    run(["ffmpeg", "-v", "error", "-y", *args])


ENC = ["-c:v", "libx264", "-preset", "slow", "-crf", "18", "-pix_fmt", "yuv420p", "-r", str(FPS)]


def fade_vf(dur, d_in=0.4, d_out=0.4):
    return f"fade=t=in:st=0:d={d_in}:color=white,fade=t=out:st={dur - d_out}:d={d_out}:color=white"


# ---- video segments -----------------------------------------------------
def still(name, png, dur):
    out = os.path.join(WORK, f"{name}.mp4")
    ffmpeg("-loop", "1", "-framerate", str(FPS), "-t", str(dur), "-i", png,
           "-vf", fade_vf(dur, 0.35, 0.35), *ENC, out)
    return out


def sequence(name, folder, dur):
    out = os.path.join(WORK, f"{name}.mp4")
    ffmpeg("-framerate", str(FPS), "-i", os.path.join(folder, "%05d.png"), "-t", str(dur),
           "-vf", fade_vf(dur), *ENC, out)
    return out


def phone_scene():
    """Simulator footage centered on white. The iOS notification banner (it
    carries the colored app icon) is painted over; that area is blank white
    in the app at this point, so nothing of the app itself is hidden."""
    rec = os.path.join(SRC, "app_listen_cough.mov")
    mask = "drawbox=x=0:y=150:w=iw:h=345:color=white@1:t=fill"
    out = os.path.join(WORK, "phone.mp4")
    a_len = REC_A[1] - REC_A[0]
    ph = 900                                  # phone height in the 1080p frame
    pw = round(1206 * ph / 2622)              # width after scaling (even-ish)
    px, py = (1920 - pw) // 2, (1080 - ph) // 2
    fc = (
        f"[0:v]trim=start={REC_A[0]}:end={REC_A[1]},setpts=PTS-STARTPTS,fps={FPS}[a];"
        f"[0:v]trim=start={REC_B[0]}:end={REC_B[1]},setpts=PTS-STARTPTS,fps={FPS}[b];"
        f"[a][b]xfade=transition=fade:duration={XFADE}:offset={a_len - XFADE}[x];"
        f"[x]{mask},scale={pw}:{ph}:flags=lanczos,"
        f"pad=1920:1080:{px}:{py}:color=white,"
        f"drawbox=x={px - 2}:y={py - 2}:w={pw + 4}:h={ph + 4}:color=0x111111:t=3,"
        f"{fade_vf(D_PHONE)}[v]"
    )
    ffmpeg("-i", rec, "-filter_complex", fc, "-map", "[v]", "-t", str(D_PHONE), *ENC, out)
    return out


# ---- audio ---------------------------------------------------------------
def soft_limit(x, ceiling=0.89):
    return np.tanh(x / ceiling) * ceiling


def seg(path, start_s, dur_s, target_rms_db, fade_in, fade_out):
    x, _ = render.read_wav(path)
    x = x[int(start_s * SR):int((start_s + dur_s) * SR)].copy()
    rms = np.sqrt(np.mean(x ** 2)) + 1e-9
    x *= (10 ** (target_rms_db / 20)) / rms
    x = soft_limit(x)
    n_in, n_out = int(fade_in * SR), int(fade_out * SR)
    x[:n_in] *= np.linspace(0, 1, n_in)
    x[len(x) - n_out:] *= np.linspace(1, 0, n_out)
    return x


def build_audio():
    total = int(T_TOTAL * SR)
    mix = np.zeros(total)

    def place(x, at):
        i = int(at * SR)
        mix[i:i + len(x)] += x[: total - i]

    cough, _ = render.read_wav(os.path.join(SRC, "cough_15.wav"))
    cough = cough * (10 ** (-2 / 20) / np.abs(cough).max())  # peak -2 dBFS, the source clips at 0
    n = int(0.05 * SR)
    cough[:n] *= np.linspace(0, 1, n)
    cough[-n:] *= np.linspace(1, 0, n)
    place(cough, T_COUGH)

    place(seg(os.path.join(SRC, "cocreate_drum.wav"), 0, D_STACK, -17, 0.2, 1.6), T_STACK)
    place(seg(os.path.join(SRC, "cocreate_trio.wav"), render.TRIO_T0, D_TRIO, -15, 0.3, 1.6), T_TRIO)

    mix = soft_limit(mix, 0.93)
    pcm = (np.clip(mix, -1, 1) * 32767).astype("<i2")
    wav = os.path.join(WORK, "master16k.wav")
    import wave
    with wave.open(wav, "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(pcm.tobytes())
    return wav


# ---- go --------------------------------------------------------------------
def main():
    frames = os.path.join(WORK, "frames")
    cards = os.path.join(frames, "cards")
    if not os.path.isdir(cards):
        run([sys.executable, os.path.join(HERE, "render.py"), "cards", cards])
    for kind, count in (("stack", int(D_STACK * FPS)), ("trio", int(D_TRIO * FPS))):
        d = os.path.join(frames, kind)
        if not (os.path.isdir(d) and len(os.listdir(d)) == count):
            run([sys.executable, os.path.join(HERE, "render.py"), kind, d])

    segs = [
        still("title", os.path.join(cards, "title.png"), D_TITLE),
        still("sep1", os.path.join(cards, "sep1.png"), D_SEP),
        phone_scene(),
        still("sep2", os.path.join(cards, "sep2.png"), D_SEP),
        sequence("stack", os.path.join(frames, "stack"), D_STACK),
        still("sep3", os.path.join(cards, "sep3.png"), D_SEP),
        sequence("trio", os.path.join(frames, "trio"), D_TRIO),
        still("end", os.path.join(cards, "end.png"), D_END),
    ]
    lst = os.path.join(WORK, "list.txt")
    with open(lst, "w") as f:
        for s in segs:
            f.write(f"file '{s}'\n")
    silent = os.path.join(WORK, "silent.mp4")
    ffmpeg("-f", "concat", "-safe", "0", "-i", lst, "-c", "copy", silent)

    wav = build_audio()
    os.makedirs(OUT, exist_ok=True)
    final = os.path.join(OUT, "coughit-demo.mp4")
    ffmpeg("-i", silent, "-i", wav, "-map", "0:v", "-map", "1:a",
           "-c:v", "copy", "-c:a", "aac", "-b:a", "160k", "-ar", "48000", "-ac", "2",
           "-shortest", "-movflags", "+faststart", final)

    # poster: the moment the app catches the cough
    ffmpeg("-ss", f"{T_PHONE + red_in_phone + 1.2:.2f}", "-i", final, "-frames:v", "1",
           "-q:v", "3", os.path.join(OUT, "video-poster.jpg"))
    print(f"\ntotal {T_TOTAL:.1f}s  cough at {T_COUGH:.2f}s  -> {final}")


if __name__ == "__main__":
    main()
