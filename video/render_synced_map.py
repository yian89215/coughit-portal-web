#!/usr/bin/env python3
"""Build a map clip whose camera and selected pin follow demo playback.

Usage:
  python3 render_synced_map.py RAW.mov drum|trio [OUT_DIR]

The MIDI roll is cropped from the current App recording. The map panel is
rendered from the same city-level demo coordinates used by DemoLoader, so every
four/eight-second contribution can jump to its own centered location even when
the old recording kept one pin selected for the whole track.
"""

import io
import json
import math
import os
import shutil
import subprocess
import sys
import tempfile
import urllib.request

from PIL import Image, ImageDraw, ImageFont

from prep_map import CROPS, FPS, LEAD, SCALE, SECONDS, play_start

HERE = os.path.dirname(os.path.abspath(__file__))
SF = "/System/Library/Fonts/SFNS.ttf"
TILE_URL = (
    "https://server.arcgisonline.com/ArcGIS/rest/services/"
    "Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}"
)
ATTRIBUTION = "Map data: Esri, TomTom, Garmin, FAO, NOAA, USGS, OSM contributors"
ZOOM = 8

COLORS = [
    "#e5303f",
    "#f56c27",
    "#d314db",
    "#188f2a",
    "#146e91",
    "#535896",
    "#9e472b",
]

# Mirrors DemoLoader._loadDrumFinalVizByPitch: every drum piece belongs to one
# cough, so its complete lane keeps that contributor's pin colour as the
# arrangement grows from one cough to seven.
DRUM_PITCH_TO_INDEX = {
    49: 0, 57: 0,       # crash
    38: 1, 40: 1,       # snare
    42: 2, 44: 2,       # closed hi-hat
    35: 3, 36: 3,       # kick
    46: 4,               # open hi-hat
    47: 5, 48: 5, 50: 5,  # mid tom
    41: 6, 43: 6, 45: 6,  # low tom
}

# App display order: My Cough first, then the other contributors. `start` is
# the position in the complete track at which the location becomes active.
POINTS = {
    "drum": [
        dict(name="Taipei, TW", lat=25.030, lng=121.560, start=0),
        dict(name="Taichung, TW", lat=24.147, lng=120.673, start=4),
        dict(name="Hsinchu, TW", lat=24.807, lng=120.968, start=8),
        dict(name="Banqiao, TW", lat=25.014, lng=121.463, start=12),
        dict(name="Taipei, TW", lat=25.048, lng=121.517, start=16),
        dict(name="Hsinchu, TW", lat=24.795, lng=120.994, start=20),
        dict(name="Banqiao, TW", lat=25.020, lng=121.469, start=24),
    ],
    "trio": [
        dict(name="Taipei, TW", lat=25.030, lng=121.560, start=8),
        dict(name="Taoyuan, TW", lat=24.990, lng=121.300, start=0),
        dict(name="Hsinchu, TW", lat=24.810, lng=120.970, start=16),
    ],
}


def run(cmd):
    print("$", " ".join(str(v) for v in cmd)[:240], flush=True)
    subprocess.run(cmd, check=True)


def world_pixel(lat, lng, zoom):
    scale = 256 * (2 ** zoom)
    x = (lng + 180.0) / 360.0 * scale
    sin_lat = math.sin(math.radians(max(-85.0511, min(85.0511, lat))))
    y = (0.5 - math.log((1 + sin_lat) / (1 - sin_lat)) / (4 * math.pi)) * scale
    return x, y


def fetch_tile(x, y, zoom, cache):
    key = (zoom, x, y)
    if key not in cache:
        request = urllib.request.Request(
            TILE_URL.format(z=zoom, y=y, x=x),
            headers={"User-Agent": "CoughIt academic demo website"},
        )
        with urllib.request.urlopen(request, timeout=20) as response:
            cache[key] = Image.open(io.BytesIO(response.read())).convert("RGB")
    return cache[key]


def marker(draw, x, y, color, selected, label, font):
    radius = 14 if selected else 10
    outline = 3 if selected else 2
    # A compact map-pin silhouette: circle plus pointed bottom.
    draw.ellipse(
        (x - radius, y - radius * 2, x + radius, y),
        fill=color,
        outline="white",
        width=outline,
    )
    draw.polygon(
        [(x - radius + 3, y - radius), (x + radius - 3, y - radius), (x, y + radius)],
        fill=color,
    )
    inner = 4 if selected else 3
    draw.ellipse((x - inner, y - radius - inner, x + inner, y - radius + inner), fill="white")
    if not selected:
        return
    box = draw.textbbox((0, 0), label, font=font)
    tw, th = box[2] - box[0], box[3] - box[1]
    bx0, by0 = x - tw / 2 - 9, y - radius * 2 - th - 15
    bx1, by1 = x + tw / 2 + 9, y - radius * 2 - 7
    draw.rounded_rectangle((bx0, by0, bx1, by1), radius=5, fill=color)
    draw.text((x, (by0 + by1) / 2), label, font=font, fill="white", anchor="mm")


def render_panel(kind, selected_indices, focus_index, width, height, cache):
    points = POINTS[kind]
    if focus_index is None:
        center_lat = sum(point["lat"] for point in points) / len(points)
        center_lng = sum(point["lng"] for point in points) / len(points)
    else:
        focus = points[focus_index]
        center_lat, center_lng = focus["lat"], focus["lng"]
    center_x, center_y = world_pixel(center_lat, center_lng, ZOOM)
    left, top = center_x - width / 2, center_y - height / 2
    tile_x0, tile_y0 = math.floor(left / 256), math.floor(top / 256)
    tile_x1, tile_y1 = math.floor((left + width) / 256), math.floor((top + height) / 256)
    canvas = Image.new("RGB", (width, height), "#e5e5e5")
    for ty in range(tile_y0, tile_y1 + 1):
        for tx in range(tile_x0, tile_x1 + 1):
            tile = fetch_tile(tx, ty, ZOOM, cache)
            canvas.paste(tile, (round(tx * 256 - left), round(ty * 256 - top)))

    draw = ImageDraw.Draw(canvas)
    font = ImageFont.truetype(SF, 18)
    font.set_variation_by_name("Bold")
    for index, point in enumerate(points):
        px, py = world_pixel(point["lat"], point["lng"], ZOOM)
        marker(
            draw,
            round(px - left),
            round(py - top),
            COLORS[index],
            index in selected_indices,
            point["name"],
            font,
        )
    attr_font = ImageFont.truetype(SF, 10)
    draw.rectangle((0, height - 18, width, height), fill=(255, 255, 255, 220))
    draw.text((width - 8, height - 9), ATTRIBUTION, font=attr_font, fill="#555555", anchor="rm")
    return canvas


def build_map_timeline(kind, width, height, duration, work, ffmpeg):
    cache = {}
    points = POINTS[kind]
    ordered = sorted(enumerate(points), key=lambda item: item[1]["start"])
    # Before playback the App fits the whole set with no active marker. Drum
    # then accumulates every newly joined cough; Trio swaps to the newest one.
    changes = [(0.0, tuple(), None)]
    for sequence_index, (index, point) in enumerate(ordered):
        change_at = LEAD + point["start"]
        if change_at < duration:
            selected = (
                tuple(item[0] for item in ordered[:sequence_index + 1])
                if kind == "drum" else (index,)
            )
            changes.append((change_at, selected, index))

    panels = []
    for sequence_index, (_, selected, focus) in enumerate(changes):
        path = os.path.join(work, f"map-{kind}-{sequence_index}.png")
        render_panel(kind, selected, focus, width, height, cache).save(path)
        panels.append(path)

    concat = os.path.join(work, f"map-{kind}.txt")
    with open(concat, "w") as handle:
        for i, (start, _, _) in enumerate(changes):
            end = changes[i + 1][0] if i + 1 < len(changes) else duration
            handle.write(f"file '{panels[i]}'\n")
            handle.write(f"duration {end - start:.6f}\n")
        handle.write(f"file '{panels[-1]}'\n")

    output = os.path.join(work, f"map-{kind}-timeline.mp4")
    run([
        ffmpeg, "-v", "error", "-y", "-f", "concat", "-safe", "0", "-i", concat,
        "-vf", f"fps={FPS},format=yuv420p", "-t", str(duration),
        "-c:v", "libx264", "-preset", "slow", "-crf", "18", output,
    ])
    return output


def rgb(value):
    value = value.lstrip("#")
    return tuple(int(value[i:i + 2], 16) for i in (0, 2, 4))


def soften(color, amount=0.55):
    base = rgb(color)
    return tuple(round(channel + (255 - channel) * amount) for channel in base)


def note_color(kind, note, played):
    index = (
        DRUM_PITCH_TO_INDEX.get(note["pitch"])
        if kind == "drum" else note.get("contributor_cough_index")
    )
    color = COLORS[index] if isinstance(index, int) and index < len(COLORS) else "#686868"
    # The App keeps AI-fill notes in the owning lane colour but quieter.
    quiet = 0.72 if note.get("is_ai_fill") else 0.55
    return rgb(color) if played and not note.get("is_ai_fill") else soften(color, quiet)


def render_midi_frame(kind, elapsed, width, height, midi):
    """Draw a clean, label-free scrolling MIDI roll from contributor data."""
    canvas = Image.new("RGB", (width, height), "white")
    draw = ImageDraw.Draw(canvas)
    current = max(0.0, elapsed - LEAD)
    window = 12.0
    history = 3.0
    start = max(0.0, current - history)
    end = start + window
    pad_x, pad_y = 24, 22
    inner_w, inner_h = width - pad_x * 2, height - pad_y * 2

    tracks = midi["tracks"]
    if kind == "drum":
        lane_count = len(COLORS)
        lane_h = inner_h / lane_count
        for index in range(lane_count + 1):
            y = pad_y + index * lane_h
            draw.line((pad_x, y, width - pad_x, y), fill="#eeeeee", width=1)

        def note_y(_track_index, note):
            lane = DRUM_PITCH_TO_INDEX[note["pitch"]]
            return pad_y + lane * lane_h + lane_h * 0.25, lane_h * 0.5
    else:
        lane_count = max(1, len(tracks))
        lane_h = inner_h / lane_count
        track_ranges = []
        for track in tracks:
            pitches = [note["pitch"] for note in track["notes"]]
            track_ranges.append((min(pitches), max(pitches)))
        for index in range(lane_count):
            y0 = pad_y + index * lane_h + 5
            y1 = pad_y + (index + 1) * lane_h - 5
            draw.rounded_rectangle((pad_x, y0, width - pad_x, y1), radius=8, fill="#f7f7f7")

        def note_y(track_index, note):
            low, high = track_ranges[track_index]
            usable = max(8, lane_h - 22)
            ratio = (note["pitch"] - low) / max(1, high - low)
            y = pad_y + (track_index + 1) * lane_h - 10 - ratio * usable
            return y - 3, 6

    for track_index, track in enumerate(tracks):
        for note in track["notes"]:
            if kind == "drum" and note["pitch"] not in DRUM_PITCH_TO_INDEX:
                continue
            if note["end"] < start or note["start"] > end:
                continue
            x0 = pad_x + (note["start"] - start) / window * inner_w
            x1 = pad_x + (note["end"] - start) / window * inner_w
            x0 = max(pad_x, x0)
            x1 = min(width - pad_x, max(x0 + 5, x1))
            y, note_h = note_y(track_index, note)
            color = note_color(kind, note, note["start"] <= current)
            draw.rounded_rectangle((x0, y, x1, y + note_h), radius=max(2, note_h / 3), fill=color)

    cursor_x = pad_x + (current - start) / window * inner_w
    draw.line((cursor_x, pad_y - 4, cursor_x, height - pad_y + 4), fill="#7a2ea8", width=3)
    return canvas


def build_midi_timeline(kind, width, height, duration, work, ffmpeg):
    midi_path = os.path.join(HERE, "source", f"cocreate_{kind}_viz.json")
    with open(midi_path) as handle:
        midi = json.load(handle)
    frames = os.path.join(work, f"midi-{kind}")
    os.makedirs(frames, exist_ok=True)
    for frame in range(round(duration * FPS)):
        elapsed = frame / FPS
        render_midi_frame(kind, elapsed, width, height, midi).save(
            os.path.join(frames, f"{frame:05d}.png")
        )
    output = os.path.join(work, f"midi-{kind}-timeline.mp4")
    run([
        ffmpeg, "-v", "error", "-y", "-framerate", str(FPS),
        "-i", os.path.join(frames, "%05d.png"), "-t", str(duration),
        "-c:v", "libx264", "-preset", "slow", "-crf", "18",
        "-pix_fmt", "yuv420p", "-r", str(FPS), output,
    ])
    return output


def main():
    if len(sys.argv) < 3 or sys.argv[2] not in CROPS:
        raise SystemExit("usage: render_synced_map.py RAW.mov drum|trio [OUT_DIR]")
    raw, kind = sys.argv[1], sys.argv[2]
    out_dir = sys.argv[3] if len(sys.argv) > 3 else os.path.join(HERE, "source")
    ffmpeg = shutil.which("ffmpeg")
    if not ffmpeg:
        raise SystemExit("ffmpeg was not found on PATH")

    crop = CROPS[kind]
    t_play = play_start(raw, crop["roll"])
    t0 = max(t_play - LEAD, 0.0)
    duration = LEAD + SECONDS
    mx, my, mw, mh = crop["map"]
    rx, ry, rw, rh = crop["roll"]
    pw, ph = round(mw * SCALE / 2) * 2, round(mh * SCALE / 2) * 2
    qw, qh = round(rw * SCALE / 2) * 2, round(rh * SCALE / 2) * 2
    gap = 56
    x0 = (1920 - (pw + gap + qw)) // 2
    qx = x0 + pw + gap
    py, qy = (1080 - ph) // 2, (1080 - qh) // 2

    with tempfile.TemporaryDirectory(prefix=f"coughit-{kind}-map-") as work:
        map_video = build_map_timeline(kind, pw, ph, duration, work, ffmpeg)
        midi_video = build_midi_timeline(kind, qw, qh, duration, work, ffmpeg)
        output = os.path.join(out_dir, f"map_{kind}.mp4")
        os.makedirs(out_dir, exist_ok=True)
        filters = (
            f"[0:v]fps={FPS},scale={pw}:{ph}:flags=lanczos[map];"
            f"[1:v]fps={FPS},scale={qw}:{qh}:flags=lanczos[roll];"
            f"color=c=white:s=1920x1080:r={FPS}:d={duration}[bg];"
            f"[bg][map]overlay={x0}:{py}[withmap];[withmap][roll]overlay={qx}:{qy}[v]"
        )
        run([
            ffmpeg, "-v", "error", "-y", "-i", map_video, "-i", midi_video,
            "-filter_complex", filters, "-map", "[v]", "-an", "-t", str(duration),
            "-c:v", "libx264", "-preset", "slow", "-crf", "18", "-pix_fmt", "yuv420p",
            "-r", str(FPS), output,
        ])
        print(f"{kind}: playback starts at {t_play:.2f}s; wrote {output}")


if __name__ == "__main__":
    main()
