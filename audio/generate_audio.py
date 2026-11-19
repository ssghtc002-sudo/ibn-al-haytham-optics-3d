"""
Ibn al-Haytham (Alhazen) — Book of Optics & Camera Obscura
Audio, Cairo Golden Age Middle Eastern BGM & Foley SFX Generator
(/home/antigravity/ssghtc002-sudo/ibn-al-haytham-optics-3d/audio/generate_audio.py)

Synthesizes:
  1. All 9 dialogue lines from `config/timeline.json` via single-load Kokoro ONNX
     (`bm_george` narrator pan 0.0, `am_michael` rival pan +0.18, `bm_lewis` alhazen pan -0.18)
     using shared `/home/antigravity/shorts-engine/audio/dspCore.py`, tempo-fitted cleanly
     within each line's `[start, maxEnd]` slot (`atempo` in `[0.88, 1.25]`).
  2. 100% unique 30.0s Cairo Golden Age Middle Eastern Instrumental BGM (108 BPM, 44.1 kHz stereo):
     - G Hijaz Maqam (`G Ab B C D Eb F# G`) resolving to radiant G Major in Beats 5-6,
     - Warm fretless Cairo Oud (deep resonant bass & ornate melodic arpeggios),
     - Shimmering 78-string Qanun counter-melody & cascading light-ray glissandi,
     - Breathy Cairo Ney reed flute pads & nocturnal dark-room solo phrasing,
     - Comedic chamber pizzicato strings for Beat 4's upside-down twist,
     - Crisp Egyptian Darbuka (doum/tek/ka) & resonant Bendir frame-drum groove,
     - Warm Golden Age chamber strings & horn swell for the Beats 5-6 Camera Obscura climax.
  3. All 20 timed Foley SFX cues defined in `config/timeline.json` across 14 unique SFX types.
  4. Mastered 44.1 kHz stereo WAV (`30.000s`, PCM_16, `-14.0 LUFS`, True Peak `<= -1.5 dBFS`),
     `audio/output/voice_manifest.json` (monotonic `words` + per-line `words` + 900-frame
     `lipSync` curves for `narrator`, `alhazen`, `rival`), and `output/subtitles.srt`.
"""

from __future__ import annotations

import json
import math
import sys
from pathlib import Path
from typing import Any

import numpy as np
import soundfile as sf
from scipy import signal

SHORTS_ENGINE_ROOT = Path("/home/antigravity/shorts-engine")
if str(SHORTS_ENGINE_ROOT) not in sys.path:
    sys.path.insert(0, str(SHORTS_ENGINE_ROOT))

from audio.dspCore import (
    CHANNELS,
    DURATION,
    FPS,
    SR,
    TOTAL_FRAMES,
    TOTAL_SAMPLES,
    add_stereo_event,
    adsr_env,
    butter_filter,
    master_and_export,
    midi_to_hz,
    pan_stereo,
    peaking_eq,
    synthesize_dialogue,
)

PROJECT_ROOT = Path(__file__).resolve().parent.parent
TIMELINE_PATH = PROJECT_ROOT / "config" / "timeline.json"

# 108 BPM Cairo Golden Age Groove
BPM = 108.0
BEAT = 60.0 / BPM         # 0.55556 s
EIGHTH = BEAT * 0.5       # 0.27778 s
SIXTEENTH = BEAT * 0.25   # 0.13889 s

# Clean phonetic clarity hints for Kokoro TTS (subtitles keep exact timeline.json text)
TTS_OVERRIDES: dict[str, str] = {
    "L1": "For a thousand years, geniuses thought your eyes shoot lasers.",
    "L2": "Behold my vision beams!",
    "L3": "Then Cairo polymath, Ibbin al Haytham, stepped into total darkness.",
    "L4": "If eyes shoot light, why can't you see now?",
    "L5": "Through one tiny pinhole, candle rays raced straight, crossed over, and projected the flame.",
    "L6": "Wait, why is it upside down?!",
    "L7": "Because light enters your eye, it never shoots out!",
    "L8": "He built the Camera Obscura, and unlocked human vision.",
    "L9": "Every phone camera today? Still inside his dark room.",
}

# Stereo spatialization & base mix gain per SFX type (scaled by timeline `intensity`)
SFX_MIX_PROFILE: dict[str, tuple[float, float]] = {
    # type: (base_gain, default_pan)
    "laser_zap": (0.76, 0.20),
    "laser_hum": (0.70, 0.22),
    "whip_whoosh": (0.64, 0.0),
    "shutter_slam": (0.86, 0.0),
    "power_down": (0.74, 0.18),
    "footstep_stumble": (0.72, 0.24),
    "match_ignite": (0.78, -0.22),
    "pinhole_click": (0.76, 0.0),
    "light_beam_shimmer": (0.74, 0.0),
    "projection_bloom": (0.78, 0.20),
    "comic_boing": (0.80, 0.20),
    "chime_insight": (0.76, -0.18),
    "eureka_swell": (0.82, 0.0),
    "camera_shutter_modern": (0.82, 0.0),
}


def load_timeline(path: Path = TIMELINE_PATH) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def _resolve_beat_id(t_sec: float, beats: list[dict[str, Any]]) -> str:
    for b in beats:
        if float(b["start"]) <= t_sec < float(b["end"]):
            return str(b["id"])
    return str(beats[-1]["id"]) if beats else "beat1"


def build_dsp_timeline(raw_timeline: dict[str, Any]) -> dict[str, Any]:
    """
    Adapt `config/timeline.json` into the schema expected by shared `dspCore.py`
    without modifying the source contract file on disk.
    """
    tl = json.loads(json.dumps(raw_timeline))
    beats = tl.get("beats", [])

    # Configure speaker roster (matching world positions: alhazen left -0.96, rival right +0.96)
    speakers: dict[str, dict[str, Any]] = {
        "narrator": {"voice": "bm_george", "lang": "en-gb", "speed": 1.06, "pan": 0.0},
        "rival": {"voice": "am_michael", "lang": "en-us", "speed": 1.09, "pan": 0.18},
        "alhazen": {"voice": "bm_lewis", "lang": "en-gb", "speed": 1.05, "pan": -0.18},
    }

    adapted_dialogue = []
    for item in tl.get("dialogue", []):
        spk = item["speaker"]
        if spk not in speakers:
            voice = item.get("voice", "bm_george")
            lang = "en-gb" if voice.startswith("b") else "en-us"
            speakers[spk] = {"voice": voice, "lang": lang, "speed": float(item.get("speed", 1.05)), "pan": 0.0}
        elif "voice" in item:
            speakers[spk]["voice"] = item["voice"]
            speakers[spk]["lang"] = "en-gb" if item["voice"].startswith("b") else "en-us"

        d_item = dict(item)
        d_item["end"] = float(item.get("end", item["maxEnd"]))
        d_item["beatId"] = item.get("beatId", _resolve_beat_id(float(item["start"]), beats))
        adapted_dialogue.append(d_item)

    tl["speakers"] = speakers
    tl["dialogue"] = adapted_dialogue

    # Normalize SFX events for dspCore manifest export
    sfx_list = []
    for ev in tl.get("sfx", []):
        norm_ev = dict(ev)
        norm_ev["time"] = float(ev["t"])
        sfx_list.append(norm_ev)
    tl["sfxEvents"] = sfx_list

    return tl


# ---------------------------------------------------------------------------
# Cairo Golden Age Middle Eastern Instruments (108 BPM — G Hijaz -> G Major)
# ---------------------------------------------------------------------------
def synth_cairo_oud(
    freq: float,
    dur: float = 0.44,
    gain: float = 0.22,
    is_bass: bool = False,
    ornament: float = 0.0,
    tremolo: bool = False,
) -> np.ndarray:
    """
    Warm Egyptian Cairo fretless Oud with cedar-bowl Helmholtz resonance,
    double-course gut strings, expressive Maqam pitch scoop, and soft risha pick attack.
    """
    n = int(round(dur * SR))
    if n <= 0:
        return np.zeros(0, dtype=np.float32)
    t = np.linspace(0.0, dur, n, endpoint=False, dtype=np.float32)

    # Expressive Maqam slide into the note
    scoop = 1.0 + ornament * np.exp(-t * 34.0)
    f1 = freq * 0.9990 * scoop
    f2 = freq * 1.0010 * scoop
    ph1 = 2.0 * math.pi * np.cumsum(f1) / SR
    ph2 = 2.0 * math.pi * np.cumsum(f2) / SR

    decay = 3.2 if is_bass else (3.6 if tremolo else 5.6)
    if is_bass:
        # Deep resonant oud bass course
        s1 = (
            0.70 * np.sin(ph1) * np.exp(-t * decay)
            + 0.24 * np.sin(2.0 * ph1) * np.exp(-t * (decay * 1.5))
            + 0.10 * np.sin(3.0 * ph1) * np.exp(-t * (decay * 2.2))
            + 0.04 * np.sin(4.0 * ph1) * np.exp(-t * (decay * 3.1))
        )
        s2 = (
            0.55 * np.sin(ph2 + 0.28) * np.exp(-t * decay)
            + 0.18 * np.sin(2.0 * ph2 + 0.50) * np.exp(-t * (decay * 1.6))
        )
        risha = np.sin(2.0 * math.pi * min(freq * 4.5, 1800.0) * t) * np.exp(-t * 95.0) * 0.12
        body = np.sin(2.0 * math.pi * 178.0 * t) * np.exp(-t * 34.0) * 0.10
        sig = butter_filter(0.58 * (s1 + s2) + risha + body, "low", 1050.0, order=2)
    else:
        # Singing mid-register oud arpeggio course
        s1 = (
            0.60 * np.sin(ph1) * np.exp(-t * decay)
            + 0.30 * np.sin(2.0 * ph1) * np.exp(-t * (decay * 1.4))
            + 0.15 * np.sin(3.0 * ph1) * np.exp(-t * (decay * 2.0))
            + 0.07 * np.sin(4.0 * ph1) * np.exp(-t * (decay * 2.8))
        )
        s2 = (
            0.52 * np.sin(ph2 + 0.35) * np.exp(-t * decay)
            + 0.24 * np.sin(2.0 * ph2 + 0.70) * np.exp(-t * (decay * 1.5))
            + 0.11 * np.sin(3.0 * ph2 + 1.05) * np.exp(-t * (decay * 2.1))
        )
        risha = np.sin(2.0 * math.pi * min(freq * 5.2, 3600.0) * t) * np.exp(-t * 130.0) * 0.15
        body = np.sin(2.0 * math.pi * 225.0 * t) * np.exp(-t * 42.0) * 0.07
        sig = 0.56 * (s1 + s2) + risha + body
        sig = peaking_eq(sig, 410.0, 1.1, 2.0)

    if tremolo:
        trem = 0.72 + 0.28 * np.sin(2.0 * math.pi * 13.5 * t)
        env = adsr_env(n, attack=0.006, decay=0.06, sustain=0.82, release=0.06)
        sig = sig * trem * env
    else:
        attack = np.clip(t / 0.0032, 0.0, 1.0)
        sig = sig * attack
        fade = min(n, int(0.030 * SR))
        if fade > 1:
            sig[-fade:] *= np.linspace(1.0, 0.0, fade, dtype=np.float32)

    return (sig * gain).astype(np.float32)


def synth_qanun_pluck(
    freq: float,
    dur: float = 0.58,
    gain: float = 0.15,
    shimmer: float = 1.0,
) -> np.ndarray:
    """
    Shimmering Cairo 78-string Qanun zither: triple-course micro-detuned nylon strings,
    crisp horn-plectrum transient, and sparkling crystalline harmonic overtones.
    """
    n = int(round(dur * SR))
    if n <= 0:
        return np.zeros(0, dtype=np.float32)
    t = np.linspace(0.0, dur, n, endpoint=False, dtype=np.float32)

    detunes = (0.9986, 1.0000, 1.0014)
    sig = np.zeros(n, dtype=np.float32)
    for idx, dt in enumerate(detunes):
        f = freq * dt
        ph = 2.0 * math.pi * f * t + idx * 0.42
        course = (
            0.50 * np.sin(ph) * np.exp(-t * 4.2)
            + 0.30 * shimmer * np.sin(2.0 * ph) * np.exp(-t * 6.8)
            + 0.17 * shimmer * np.sin(3.001 * ph) * np.exp(-t * 10.2)
            + 0.09 * shimmer * np.sin(4.003 * ph) * np.exp(-t * 14.8)
            + 0.05 * shimmer * np.sin(5.006 * ph) * np.exp(-t * 21.0)
        )
        sig += course / 3.0

    # Snappy horn-plectrum click
    plectrum = np.sin(2.0 * math.pi * min(freq * 6.5, 6200.0) * t) * np.exp(-t * 175.0) * 0.16 * shimmer
    attack = np.clip(t / 0.0018, 0.0, 1.0)
    out = (sig + plectrum) * attack
    out = peaking_eq(out, 3600.0, 1.2, 2.2)
    fade = min(n, int(0.045 * SR))
    if fade > 1:
        out[-fade:] *= np.linspace(1.0, 0.0, fade, dtype=np.float32)
    return (out * gain).astype(np.float32)


def synth_ney_flute(
    rng: np.random.Generator,
    freq: float,
    dur: float = 1.40,
    gain: float = 0.14,
    breathiness: float = 0.34,
    slide_from: float = 0.0,
) -> np.ndarray:
    """
    Breathy Cairo Ney reed flute: warm hollow woodwind tone with chiffon air chiff,
    expressive Maqam pitch approach, and gentle organic vibrato.
    """
    n = int(round(dur * SR))
    if n <= 0:
        return np.zeros(0, dtype=np.float32)
    t = np.linspace(0.0, dur, n, endpoint=False, dtype=np.float32)

    # Organic delayed vibrato + optional approach bend
    vib_depth = 0.0048 * np.clip((t - 0.16) / 0.35, 0.0, 1.0)
    vib = 1.0 + vib_depth * np.sin(2.0 * math.pi * 4.8 * t)
    slide = 1.0 + slide_from * np.exp(-t * 14.0)
    f_inst = freq * vib * slide
    ph = 2.0 * math.pi * np.cumsum(f_inst) / SR

    # Hollow end-blown reed spectrum (strong 1st, gentle 2nd & warm 3rd)
    tone = (
        0.68 * np.sin(ph)
        + 0.22 * np.sin(2.0 * ph)
        + 0.10 * np.sin(3.0 * ph)
        + 0.04 * np.sin(4.0 * ph)
    )

    # Breathy chiffon air turbulence centered near the note and upper octave
    raw = rng.standard_normal(n).astype(np.float32)
    lo_c = max(250.0, min(freq * 0.75, 4000.0))
    hi_c = min(9000.0, max(freq * 3.2, lo_c + 800.0))
    breath = butter_filter(raw, "band", (lo_c, hi_c), order=2)
    chiff = breath * (0.45 + 0.95 * np.exp(-t * 14.0)) * breathiness

    env = adsr_env(n, attack=min(0.14, dur * 0.24), decay=0.14, sustain=0.80, release=min(0.24, dur * 0.32))
    out = (tone + chiff) * env
    # Carve mild vocal-intelligibility pocket around 2.2 kHz
    out = peaking_eq(out, 2200.0, 1.0, -2.5)
    return (out * gain).astype(np.float32)


def synth_comic_pizz(freq: float, dur: float = 0.28, gain: float = 0.22, bend: float = 0.0) -> np.ndarray:
    """Witty staccato chamber pizzicato for Beat 4's upside-down comedic reveal."""
    n = int(round(dur * SR))
    if n <= 0:
        return np.zeros(0, dtype=np.float32)
    t = np.linspace(0.0, dur, n, endpoint=False, dtype=np.float32)

    f_curve = freq * (1.0 + bend * np.clip(t / max(0.05, dur * 0.75), 0.0, 1.0) + 0.025 * np.exp(-t * 110.0))
    ph = 2.0 * math.pi * np.cumsum(f_curve) / SR
    body = (
        0.72 * np.sin(ph) * np.exp(-t * 7.8)
        + 0.24 * np.sin(2.0 * ph) * np.exp(-t * 13.5)
        + 0.09 * np.sin(3.0 * ph) * np.exp(-t * 21.0)
    )
    snap = np.sin(2.0 * math.pi * min(freq * 4.0, 3200.0) * t) * np.exp(-t * 95.0) * 0.14
    attack = np.clip(t / 0.0025, 0.0, 1.0)
    sig = butter_filter((body + snap) * attack, "low", 1800.0, order=2)
    fade = min(n, int(0.022 * SR))
    if fade > 1:
        sig[-fade:] *= np.linspace(1.0, 0.0, fade, dtype=np.float32)
    return (sig * gain).astype(np.float32)


def synth_cairo_darbuka(stroke: str = "doum", gain: float = 0.22, muted: bool = False) -> np.ndarray:
    """
    Crisp Egyptian clay/ceramic goblet Darbuka:
      - 'doum': deep resonant belly strike
      - 'tek': bright ringing edge snap
      - 'ka': light off-hand ghost rim tap
      - 'pop': playful damped comedic pop
    """
    if stroke == "doum":
        dur = 0.18 if not muted else 0.11
        n = int(round(dur * SR))
        t = np.linspace(0.0, dur, n, endpoint=False, dtype=np.float32)
        f = 132.0 * (0.48 ** np.clip(t / 0.060, 0.0, 1.0)) + 58.0
        head = np.sin(2.0 * math.pi * np.cumsum(f) / SR) * np.exp(-t * (18.0 if not muted else 32.0))
        overtone = np.sin(2.0 * math.pi * 248.0 * t) * np.exp(-t * 68.0) * (0.20 if not muted else 0.08)
        attack = np.clip(t / 0.0024, 0.0, 1.0)
        return ((head + overtone) * attack * gain).astype(np.float32)

    if stroke == "pop":
        dur = 0.09
        n = int(round(dur * SR))
        t = np.linspace(0.0, dur, n, endpoint=False, dtype=np.float32)
        f = 540.0 * (0.52 ** np.clip(t / 0.028, 0.0, 1.0)) + 230.0
        snap = np.sin(2.0 * math.pi * np.cumsum(f) / SR) * np.exp(-t * 54.0)
        ring = np.sin(2.0 * math.pi * 1480.0 * t) * np.exp(-t * 130.0) * 0.28
        return ((snap + ring) * np.clip(t / 0.0012, 0.0, 1.0) * gain).astype(np.float32)

    is_tek = (stroke == "tek")
    dur = 0.095 if is_tek else 0.065
    n = int(round(dur * SR))
    t = np.linspace(0.0, dur, n, endpoint=False, dtype=np.float32)
    f1 = 485.0 if is_tek else 545.0
    f2 = 890.0 if is_tek else 975.0
    rim = (
        0.62 * np.sin(2.0 * math.pi * f1 * t) * np.exp(-t * (42.0 if is_tek else 64.0))
        + 0.38 * np.sin(2.0 * math.pi * f2 * t) * np.exp(-t * (60.0 if is_tek else 86.0))
    )
    click = np.sin(2.0 * math.pi * 1760.0 * t) * np.exp(-t * 165.0) * (0.24 if is_tek else 0.14)
    return ((rim + click) * np.clip(t / 0.0013, 0.0, 1.0) * gain * (1.0 if is_tek else 0.68)).astype(np.float32)


def synth_bendir_frame(rng: np.random.Generator, gain: float = 0.14) -> np.ndarray:
    """Warm North African/Egyptian Bendir frame drum with subtle gut-snare buzz."""
    dur = 0.24
    n = int(round(dur * SR))
    t = np.linspace(0.0, dur, n, endpoint=False, dtype=np.float32)
    f = 104.0 * (0.62 ** np.clip(t / 0.08, 0.0, 1.0)) + 52.0
    skin = np.sin(2.0 * math.pi * np.cumsum(f) / SR) * np.exp(-t * 13.5)
    buzz = butter_filter(rng.standard_normal(n).astype(np.float32), "band", (1600.0, 5200.0), order=2) * np.exp(-t * 28.0) * 0.22
    return ((skin * 0.82 + buzz) * np.clip(t / 0.003, 0.0, 1.0) * gain).astype(np.float32)


def synth_golden_orchestra(
    midis: list[int],
    dur: float,
    gain: float = 0.18,
    attack: float = 0.14,
    release: float = 0.28,
    warmth: float = 0.55,
) -> np.ndarray:
    """Lush Golden Age Cairo strings & warm cinema horn pad for Beats 5-6 climax."""
    n = int(round(dur * SR))
    if n <= 0:
        return np.zeros((0, CHANNELS), dtype=np.float32)
    t = np.linspace(0.0, dur, n, endpoint=False, dtype=np.float32)

    left = np.zeros(n, dtype=np.float32)
    right = np.zeros(n, dtype=np.float32)
    vib = 1.0 + 0.0030 * np.sin(2.0 * math.pi * 5.0 * t)

    for idx, m in enumerate(midis):
        f = midi_to_hz(m)
        fl = f * (0.9983 - 0.0003 * idx) * vib
        fr = f * (1.0017 + 0.0003 * idx) * vib
        pl = 2.0 * math.pi * np.cumsum(fl) / SR
        pr = 2.0 * math.pi * np.cumsum(fr) / SR

        wl = (
            0.54 * np.sin(pl)
            + (0.24 + 0.08 * warmth) * np.sin(2.0 * pl)
            + (0.11 + 0.06 * warmth) * np.sin(3.0 * pl)
            + (0.04 + 0.04 * warmth) * np.sin(4.0 * pl)
        )
        wr = (
            0.54 * np.sin(pr)
            + (0.24 + 0.08 * warmth) * np.sin(2.0 * pr)
            + (0.11 + 0.06 * warmth) * np.sin(3.0 * pr)
            + (0.04 + 0.04 * warmth) * np.sin(4.0 * pr)
        )
        w = 1.0 / (1.0 + 0.10 * idx)
        left += wl * w
        right += wr * w

    norm = max(1.0, len(midis) * 0.62)
    stereo = np.stack([left / norm, right / norm], axis=-1).astype(np.float32)
    stereo = butter_filter(stereo, "low", 2300.0 + 950.0 * warmth, order=2)
    stereo[:, 0] = peaking_eq(stereo[:, 0], 2150.0, 0.9, -3.0)
    stereo[:, 1] = peaking_eq(stereo[:, 1], 2150.0, 0.9, -3.0)

    env = adsr_env(n, attack=attack, decay=0.14, sustain=0.82, release=release)
    return (stereo * env[:, None] * gain).astype(np.float32)


def apply_cairo_chamber_reverb(bus: np.ndarray) -> np.ndarray:
    """Warm Cairo sandstone arched-chamber early reflections & stereo shimmer tail."""
    out = np.copy(bus)
    taps = [
        (0.037, 0.18, True),
        (0.083, 0.14, False),
        (0.149, 0.11, True),
        (0.241, 0.075, False),
    ]
    wet = np.zeros_like(bus)
    for d_sec, fb, swap in taps:
        d = int(round(d_sec * SR))
        if 0 < d < len(bus):
            if swap:
                wet[d:, 0] += bus[:-d, 1] * fb
                wet[d:, 1] += bus[:-d, 0] * fb
            else:
                wet[d:, 0] += bus[:-d, 0] * fb
                wet[d:, 1] += bus[:-d, 1] * fb
    wet = butter_filter(wet, "low", 3400.0, order=2)
    return (out + wet).astype(np.float32)


def generate_bgm(timeline: dict[str, Any]) -> np.ndarray:
    """
    Compose 100% unique 30.0s 108 BPM Cairo Golden Age Middle Eastern Instrumental BGM:
      - Beat 1 (0.00..4.50s): Quirky suspense (G Hijaz Oud bass, staccato Qanun, sneaky Darbuka)
      - Beat 2 (4.50..9.50s): Hushed dark-room mystery (Breathy Ney flute, deep Oud pedal, soft Bendir)
      - Beat 3 (9.50..15.50s): Crystalline wonder (Shimmering Qanun light-ray arpeggios, Ney harmonics)
      - Beat 4 (15.50..20.50s): Comedic pizzicato twist (Inverted Hijaz pizzicato leaps & cheeky Oud)
      - Beat 5 (20.50..25.50s): Soaring G Major triumph (Qanun gliss, Ney melody, Golden Orchestra)
      - Beat 6 (25.50..30.00s): Celebratory Cairo-to-Modern finale & crisp loopable cadence
    """
    rng = np.random.default_rng(10210965)  # Ibn al-Haytham (965-1040, Book of Optics 1021)
    bgm = np.zeros((TOTAL_SAMPLES, CHANNELS), dtype=np.float32)
    melodic = np.zeros((TOTAL_SAMPLES, CHANNELS), dtype=np.float32)

    # ------------------------------------------------------------------
    # BEAT 1 (0.00..4.50s): Quirky Suspense — G Hijaz (G Ab B C D Eb F# G)
    # ------------------------------------------------------------------
    # Low mysterious Ney drone breath
    add_stereo_event(melodic, pan_stereo(synth_ney_flute(rng, midi_to_hz(67), 2.1, gain=0.09, breathiness=0.40), -0.25), 0.15)
    add_stereo_event(melodic, pan_stereo(synth_ney_flute(rng, midi_to_hz(68), 1.9, gain=0.09, breathiness=0.38, slide_from=-0.03), 0.25), 2.35)

    # Sneaky syncopated Oud bass & quirky Qanun melody
    b1_bass = [
        (0.00, 43, 0.50, 0.26), (0.56, 50, 0.42, 0.22), (1.11, 44, 0.48, 0.25), (1.67, 43, 0.46, 0.24),
        (2.22, 43, 0.50, 0.26), (2.78, 50, 0.42, 0.22), (3.33, 51, 0.48, 0.24), (3.89, 50, 0.45, 0.25),
    ]
    for st, m, d, g in b1_bass:
        add_stereo_event(bgm, pan_stereo(synth_cairo_oud(midi_to_hz(m), d, g, is_bass=True), -0.05), st)

    b1_notes = [
        # (t, midi, dur, gain, pan, inst, orn)
        (0.00, 67, 0.34, 0.19, -0.24, "oud", -0.025),
        (0.28, 71, 0.36, 0.15, 0.28, "qanun", 0.0),
        (0.56, 74, 0.38, 0.18, -0.22, "oud", 0.020),
        (0.83, 75, 0.34, 0.15, 0.26, "qanun", 0.0),
        (1.11, 74, 0.36, 0.18, -0.24, "oud", -0.018),
        (1.39, 71, 0.34, 0.15, 0.24, "qanun", 0.0),
        (1.67, 68, 0.38, 0.19, -0.26, "oud", -0.028),
        (1.94, 67, 0.36, 0.15, 0.22, "qanun", 0.0),
        (2.22, 71, 0.34, 0.18, -0.22, "oud", 0.0),
        (2.50, 74, 0.38, 0.16, 0.28, "qanun", 0.0),
        (2.78, 79, 0.40, 0.19, -0.20, "oud", 0.022),
        (3.06, 75, 0.34, 0.15, 0.26, "qanun", 0.0),
        (3.33, 74, 0.34, 0.19, -0.22, "oud", 0.0),
        (3.61, 71, 0.32, 0.16, 0.26, "qanun", 0.0),
        (3.89, 74, 0.32, 0.19, -0.18, "oud", 0.015),
        (4.17, 75, 0.30, 0.17, 0.22, "qanun", 0.0),
    ]
    for st, m, d, g, pan, inst, orn in b1_notes:
        wav = synth_cairo_oud(midi_to_hz(m), d, g, ornament=orn) if inst == "oud" else synth_qanun_pluck(midi_to_hz(m), d, g)
        add_stereo_event(melodic, pan_stereo(wav, pan), st)

    # ------------------------------------------------------------------
    # BEAT 2 (4.50..9.50s): Hushed Dark-Room Mystery (Breathy Ney & Sparse Oud)
    # ------------------------------------------------------------------
    # Pause briefly on the 4.75s shutter slam, then enter dark hushed nocturnal atmosphere
    b2_ney_phrases = [
        (4.95, 74, 1.35, 0.14, -0.26, -0.032),  # D5 breathy sigh
        (6.35, 75, 1.10, 0.13, 0.24, -0.022),   # Eb5 dark tension
        (7.50, 71, 1.05, 0.13, -0.20, 0.025),   # B4 Hijaz mystery
        (8.58, 74, 0.90, 0.14, 0.18, -0.020),   # D5 anticipation into pinhole
    ]
    for st, m, d, g, pan, sl in b2_ney_phrases:
        add_stereo_event(melodic, pan_stereo(synth_ney_flute(rng, midi_to_hz(m), d, gain=g, breathiness=0.44, slide_from=sl), pan), st)

    # Deep sparse Oud pedal notes + dark whispered arpeggio tones
    b2_oud_bass = [
        (4.90, 43, 0.85, 0.23), (5.85, 44, 0.80, 0.21), (6.80, 43, 0.85, 0.22),
        (7.75, 50, 0.78, 0.22), (8.65, 44, 0.72, 0.23),
    ]
    for st, m, d, g in b2_oud_bass:
        add_stereo_event(bgm, pan_stereo(synth_cairo_oud(midi_to_hz(m), d, g, is_bass=True), -0.06), st)

    b2_sparse_plucks = [
        (5.15, 67, 0.48, 0.12, 0.28, "qanun"),
        (5.70, 68, 0.44, 0.13, -0.26, "oud"),
        (6.25, 71, 0.50, 0.12, 0.30, "qanun"),
        (7.05, 67, 0.46, 0.14, -0.24, "oud"),
        (7.60, 74, 0.52, 0.12, 0.28, "qanun"),
        (8.15, 71, 0.46, 0.14, -0.24, "oud"),
        (8.72, 68, 0.44, 0.13, 0.26, "qanun"),
        (9.10, 74, 0.46, 0.15, -0.20, "oud"),
    ]
    for st, m, d, g, pan, inst in b2_sparse_plucks:
        wav = synth_cairo_oud(midi_to_hz(m), d, g) if inst == "oud" else synth_qanun_pluck(midi_to_hz(m), d, g, shimmer=0.88)
        add_stereo_event(melodic, pan_stereo(wav, pan), st)

    # ------------------------------------------------------------------
    # BEAT 3 (9.50..15.50s): Crystalline Wonder — Pinhole Light Rays
    # ------------------------------------------------------------------
    # Delicate Qanun shimmer glissando entering Beat 3 (9.42..9.88s)
    for i, m in enumerate([62, 67, 68, 71, 74, 75, 79, 83, 86]):
        add_stereo_event(
            melodic,
            pan_stereo(synth_qanun_pluck(midi_to_hz(m), 0.62, 0.11 + 0.005 * i, shimmer=1.18), -0.40 + 0.10 * i),
            9.42 + i * 0.048,
        )

    # Luminous Ney flute light-beam pads
    add_stereo_event(melodic, pan_stereo(synth_ney_flute(rng, midi_to_hz(79), 2.55, gain=0.12, breathiness=0.32), -0.22), 9.85)
    add_stereo_event(melodic, pan_stereo(synth_ney_flute(rng, midi_to_hz(83), 2.65, gain=0.13, breathiness=0.30, slide_from=-0.025), 0.22), 12.55)

    # Shimmering Qanun arpeggios + flowing Oud counterpoint building across 9.72..15.40s
    b3_qanun_pattern = [74, 79, 83, 86, 83, 79, 75, 79, 83, 86, 87, 86, 83, 79, 74, 79]
    b3_oud_counter = [62, 67, 71, 74, 71, 68, 67, 71]
    b3_bass = [43, 50, 48, 50, 43, 47, 48, 50, 43, 50, 51, 50]

    t_cur = 9.72
    step = 0
    while t_cur < 15.38:
        prog = (t_cur - 9.72) / 5.66
        qm = b3_qanun_pattern[step % len(b3_qanun_pattern)]
        pan_q = -0.34 + 0.68 * ((step % 4) / 3.0)
        add_stereo_event(
            melodic,
            pan_stereo(synth_qanun_pluck(midi_to_hz(qm), 0.56, 0.13 + 0.03 * prog, shimmer=1.12 + 0.18 * prog), pan_q),
            t_cur,
        )

        # Flowing Oud counterpoint every quarter note
        if step % 2 == 0:
            om = b3_oud_counter[(step // 2) % len(b3_oud_counter)]
            add_stereo_event(
                melodic,
                pan_stereo(synth_cairo_oud(midi_to_hz(om), 0.46, 0.16 + 0.03 * prog, ornament=(-0.016 if step % 4 == 0 else 0.0)), -pan_q * 0.7),
                t_cur,
            )
            bm = b3_bass[(step // 2) % len(b3_bass)]
            add_stereo_event(bgm, pan_stereo(synth_cairo_oud(midi_to_hz(bm), 0.52, 0.23 + 0.03 * prog, is_bass=True), 0.0), t_cur)

        t_cur += EIGHTH
        step += 1

    # Sparkling high crystalline shimmer flourish at 14.25s projection bloom
    for i, m in enumerate([79, 83, 86, 91, 95]):
        add_stereo_event(
            melodic,
            pan_stereo(synth_qanun_pluck(midi_to_hz(m), 0.72, 0.12, shimmer=1.28), -0.30 + 0.15 * i),
            14.25 + i * 0.055,
        )

    # ------------------------------------------------------------------
    # BEAT 4 (15.50..20.50s): Comedic Pizzicato Twist — Upside-Down Motif!
    # ------------------------------------------------------------------
    # Brief cheeky pause right around 15.65s comic_boing, then playful inverted Hijaz pizzicato
    b4_pizz = [
        # Inverted leaping comic phrasing ("Wait—why is it upside down?!")
        (15.88, 79, 0.24, 0.22, -0.26, -0.06),
        (16.16, 75, 0.24, 0.20, 0.26, 0.04),
        (16.44, 71, 0.24, 0.21, -0.24, -0.05),
        (16.72, 68, 0.26, 0.22, 0.28, 0.06),
        (17.00, 74, 0.26, 0.22, -0.22, -0.04),
        (17.28, 67, 0.28, 0.23, 0.22, 0.05),
        # Witty strutting Alhazen rebuttal ("Because light enters your eye...")
        (17.62, 67, 0.26, 0.21, -0.26, 0.0),
        (17.90, 71, 0.26, 0.21, 0.24, 0.0),
        (18.18, 74, 0.26, 0.22, -0.24, 0.03),
        (18.46, 75, 0.24, 0.21, 0.26, -0.03),
        (18.74, 74, 0.26, 0.22, -0.22, 0.0),
        (19.02, 71, 0.26, 0.21, 0.24, 0.0),
        (19.30, 74, 0.26, 0.22, -0.24, 0.0),
        (19.58, 79, 0.28, 0.23, 0.26, 0.04),
        (19.86, 81, 0.26, 0.22, -0.20, 0.0),
        (20.14, 83, 0.28, 0.23, 0.20, 0.0),
    ]
    for idx, (st, m, d, g, pan, bend) in enumerate(b4_pizz):
        add_stereo_event(melodic, pan_stereo(synth_comic_pizz(midi_to_hz(m), d, g, bend=bend), pan), st)
        if idx % 2 == 0:
            # Playful Oud answer pluck + bouncy bass
            add_stereo_event(melodic, pan_stereo(synth_cairo_oud(midi_to_hz(m - 12), 0.30, 0.16), -pan * 0.7), st + 0.12)
            bm = 43 if (idx // 2) % 2 == 0 else 50
            add_stereo_event(bgm, pan_stereo(synth_comic_pizz(midi_to_hz(bm), 0.34, 0.26, bend=(-0.03 if idx % 4 == 2 else 0.0)), 0.0), st)

    # ------------------------------------------------------------------
    # BEAT 5 (20.50..25.50s): Soaring Triumph — Radiant G Major Camera Obscura!
    # ------------------------------------------------------------------
    # Sweeping upward Qanun golden glissando into Beat 5 (20.38..20.82s)
    for i, m in enumerate([55, 62, 67, 71, 74, 79, 83, 86, 91]):
        add_stereo_event(
            melodic,
            pan_stereo(synth_qanun_pluck(midi_to_hz(m), 0.65, 0.14 + 0.008 * i, shimmer=1.25), -0.40 + 0.10 * i),
            20.38 + i * 0.046,
        )

    # Lush Golden Age chamber orchestra & horn swells (G Major -> C Major -> D Major)
    add_stereo_event(bgm, synth_golden_orchestra([55, 62, 67, 71, 74, 79], 2.55, gain=0.22, warmth=0.68), 20.52)
    add_stereo_event(bgm, synth_golden_orchestra([48, 55, 60, 64, 67, 76], 1.45, gain=0.22, warmth=0.72), 23.02)
    add_stereo_event(bgm, synth_golden_orchestra([50, 57, 62, 66, 69, 78], 1.25, gain=0.23, warmth=0.78), 24.35)

    # Soaring triumphant Ney flute lead lines
    add_stereo_event(melodic, pan_stereo(synth_ney_flute(rng, midi_to_hz(79), 1.25, gain=0.16, breathiness=0.26, slide_from=-0.025), -0.16), 20.65)
    add_stereo_event(melodic, pan_stereo(synth_ney_flute(rng, midi_to_hz(83), 1.20, gain=0.16, breathiness=0.25), 0.16), 21.90)
    add_stereo_event(melodic, pan_stereo(synth_ney_flute(rng, midi_to_hz(86), 1.40, gain=0.17, breathiness=0.24, slide_from=-0.020), -0.12), 23.15)
    add_stereo_event(melodic, pan_stereo(synth_ney_flute(rng, midi_to_hz(83), 0.90, gain=0.16, breathiness=0.24), 0.14), 24.55)

    b5_melody = [74, 79, 83, 86, 83, 79, 76, 79, 84, 83, 79, 76, 74, 78, 81, 86]
    b5_bass = [43, 50, 47, 50, 48, 55, 50, 57, 43, 50]
    t_cur = 20.56
    step = 0
    while t_cur < 25.42:
        mn = b5_melody[step % len(b5_melody)]
        pan = -0.30 if step % 2 == 0 else 0.30
        add_stereo_event(
            melodic,
            pan_stereo(synth_cairo_oud(midi_to_hz(mn - 12), 0.36, 0.19, tremolo=(step % 4 == 0)), pan),
            t_cur,
        )
        add_stereo_event(
            melodic,
            pan_stereo(synth_qanun_pluck(midi_to_hz(mn), 0.48, 0.14, shimmer=1.22), -pan * 0.85),
            t_cur,
        )
        if step % 2 == 0:
            bm = b5_bass[(step // 2) % len(b5_bass)]
            add_stereo_event(bgm, pan_stereo(synth_cairo_oud(midi_to_hz(bm), 0.46, 0.26, is_bass=True), 0.0), t_cur)
        t_cur += EIGHTH
        step += 1

    # ------------------------------------------------------------------
    # BEAT 6 (25.50..30.00s): Smartphone Legacy Finale & Crisp Button Cadence
    # ------------------------------------------------------------------
    add_stereo_event(bgm, synth_golden_orchestra([55, 62, 67, 71, 79, 83], 2.15, gain=0.23, warmth=0.80), 25.52)
    add_stereo_event(bgm, synth_golden_orchestra([48, 55, 60, 64, 72, 79], 1.15, gain=0.23, warmth=0.82), 27.62)
    add_stereo_event(bgm, synth_golden_orchestra([50, 57, 62, 66, 74, 81], 0.85, gain=0.24, warmth=0.86), 28.68)

    add_stereo_event(melodic, pan_stereo(synth_ney_flute(rng, midi_to_hz(86), 1.80, gain=0.16, breathiness=0.24), -0.14), 25.65)
    add_stereo_event(melodic, pan_stereo(synth_ney_flute(rng, midi_to_hz(91), 1.65, gain=0.15, breathiness=0.22, slide_from=-0.02), 0.14), 27.55)

    b6_melody = [79, 83, 86, 83, 79, 74, 79, 83, 84, 83, 79, 76, 78, 81, 86]
    b6_bass = [43, 50, 47, 50, 48, 55, 50, 54]
    t_cur = 25.56
    step = 0
    while t_cur < 29.38:
        mn = b6_melody[step % len(b6_melody)]
        pan = -0.32 if step % 2 == 0 else 0.32
        add_stereo_event(
            melodic,
            pan_stereo(synth_cairo_oud(midi_to_hz(mn - 12), 0.34, 0.20, tremolo=True), pan),
            t_cur,
        )
        add_stereo_event(
            melodic,
            pan_stereo(synth_qanun_pluck(midi_to_hz(mn), 0.46, 0.15, shimmer=1.24), -pan * 0.85),
            t_cur,
        )
        if step % 2 == 0:
            bm = b6_bass[(step // 2) % len(b6_bass)]
            add_stereo_event(bgm, pan_stereo(synth_cairo_oud(midi_to_hz(bm), 0.44, 0.27, is_bass=True), 0.0), t_cur)
        t_cur += EIGHTH
        step += 1

    # Crisp Cairo Golden Age Heroic Button Cadence (29.46..29.92s)
    add_stereo_event(
        bgm,
        synth_golden_orchestra([55, 62, 67, 71, 79, 83, 91], 0.46, gain=0.26, attack=0.015, release=0.18, warmth=0.90),
        29.46,
    )
    add_stereo_event(bgm, pan_stereo(synth_cairo_oud(midi_to_hz(43), 0.42, 0.30, is_bass=True), 0.0), 29.46)
    add_stereo_event(melodic, pan_stereo(synth_cairo_oud(midi_to_hz(79), 0.38, 0.22, tremolo=True), -0.18), 29.46)
    add_stereo_event(melodic, pan_stereo(synth_qanun_pluck(midi_to_hz(91), 0.40, 0.19, shimmer=1.30), 0.20), 29.52)

    bgm += apply_cairo_chamber_reverb(melodic)

    # ------------------------------------------------------------------
    # Crisp Egyptian Darbuka & Bendir Groove (108 BPM — Maqsum / Malfuf)
    # Dynamically sculpted per beat!
    # ------------------------------------------------------------------
    perc_t = 0.0
    p_step = 0
    while perc_t < 29.42:
        # Dramatic hush right on the shutter slam (4.65..5.10s) and comic boing (15.55..15.86s)
        if (4.65 <= perc_t <= 5.10) or (15.55 <= perc_t <= 15.86):
            perc_t += SIXTEENTH
            p_step += 1
            continue

        pos8 = p_step % 8  # 8 sixteenths = 1.111s half-bar cycle at 108 BPM
        in_darkroom = (5.10 < perc_t < 9.48)
        in_wonder = (9.48 <= perc_t < 15.48)
        in_comic = (15.86 <= perc_t < 20.48)
        in_climax = (20.48 <= perc_t < 29.42)

        if in_darkroom:
            # Sparse muted dark-room heartbeat: gentle Bendir & muffled doum
            if pos8 == 0:
                add_stereo_event(bgm, pan_stereo(synth_bendir_frame(rng, gain=0.13), -0.10), perc_t)
            elif pos8 == 4:
                add_stereo_event(bgm, pan_stereo(synth_cairo_darbuka("doum", gain=0.13, muted=True), 0.08), perc_t)
            elif pos8 == 6:
                add_stereo_event(bgm, pan_stereo(synth_cairo_darbuka("ka", gain=0.09), 0.22), perc_t)
        elif in_comic:
            # Playful bouncy Darbuka with cheeky pops
            if pos8 == 0:
                add_stereo_event(bgm, pan_stereo(synth_cairo_darbuka("doum", gain=0.20), 0.0), perc_t)
            elif pos8 == 2:
                add_stereo_event(bgm, pan_stereo(synth_cairo_darbuka("pop", gain=0.16), 0.24), perc_t)
            elif pos8 == 4:
                add_stereo_event(bgm, pan_stereo(synth_cairo_darbuka("doum", gain=0.17), -0.06), perc_t)
            elif pos8 == 6:
                add_stereo_event(bgm, pan_stereo(synth_cairo_darbuka("tek", gain=0.16), -0.22), perc_t)
            elif pos8 == 7:
                add_stereo_event(bgm, pan_stereo(synth_cairo_darbuka("ka", gain=0.11), 0.24), perc_t)
        else:
            # Classic Egyptian Maqsum groove (Doum - Tek - - Doum - Tek -)
            g_scale = 1.08 if in_climax else (0.90 if in_wonder else 0.94)
            if pos8 == 0:
                add_stereo_event(bgm, pan_stereo(synth_cairo_darbuka("doum", gain=0.21 * g_scale), 0.0), perc_t)
                if in_climax:
                    add_stereo_event(bgm, pan_stereo(synth_bendir_frame(rng, gain=0.12), -0.18), perc_t)
            elif pos8 == 2:
                add_stereo_event(bgm, pan_stereo(synth_cairo_darbuka("tek", gain=0.15 * g_scale), 0.24), perc_t)
            elif pos8 == 3 and (in_wonder or in_climax):
                add_stereo_event(bgm, pan_stereo(synth_cairo_darbuka("ka", gain=0.11 * g_scale), -0.24), perc_t)
            elif pos8 == 4:
                add_stereo_event(bgm, pan_stereo(synth_cairo_darbuka("doum", gain=0.18 * g_scale), -0.05), perc_t)
            elif pos8 == 6:
                add_stereo_event(bgm, pan_stereo(synth_cairo_darbuka("tek", gain=0.16 * g_scale), -0.22), perc_t)
            elif pos8 == 7 and in_climax:
                add_stereo_event(bgm, pan_stereo(synth_cairo_darbuka("ka", gain=0.12 * g_scale), 0.26), perc_t)

        perc_t += SIXTEENTH
        p_step += 1

    # Final rhythmic button doum at 29.46s
    add_stereo_event(bgm, pan_stereo(synth_cairo_darbuka("doum", gain=0.24), 0.0), 29.46)
    add_stereo_event(bgm, pan_stereo(synth_bendir_frame(rng, gain=0.15), 0.0), 29.46)

    # ------------------------------------------------------------------
    # Beat-Transition Musical Swells (lifts energy cleanly at scene cuts)
    # ------------------------------------------------------------------
    t_axis = np.linspace(0.0, DURATION, TOTAL_SAMPLES, endpoint=False, dtype=np.float32)
    swell_env = np.ones(TOTAL_SAMPLES, dtype=np.float32)
    for tc in (0.12, 4.50, 9.50, 14.30, 15.50, 20.50, 25.50, 29.52):
        swell_env += 0.30 * np.exp(-0.5 * ((t_axis - tc) / 0.24) ** 2).astype(np.float32)
    bgm *= swell_env[:, None]

    # Clean micro-fades strictly within 30.000s
    fade_in = int(0.04 * SR)
    fade_out = int(0.08 * SR)
    bgm[:fade_in] *= np.linspace(0.0, 1.0, fade_in, dtype=np.float32)[:, None]
    bgm[-fade_out:] *= np.linspace(1.0, 0.0, fade_out, dtype=np.float32)[:, None]
    return bgm


# ---------------------------------------------------------------------------
# All 14 Unique Foley SFX Types (20 Timed Events in config/timeline.json)
# ---------------------------------------------------------------------------
def synth_sfx(sfx_type: str, event_idx: int = 0) -> np.ndarray:
    rng = np.random.default_rng(sum(ord(c) * (i + 1) for i, c in enumerate(sfx_type)) + 1021 + event_idx * 23)

    if sfx_type == "laser_zap":
        # Comedic sci-fi eye-laser PEW-ZAP! Fast descending FM chirp + electric crackle
        dur = 0.42
        n = int(round(dur * SR))
        t = np.linspace(0.0, dur, n, endpoint=False, dtype=np.float32)
        pitch_var = 1.0 if event_idx == 0 else 1.12
        f_sweep = (2750.0 * pitch_var) * (0.085 ** np.clip(t / 0.24, 0.0, 1.0)) + 190.0
        fm = 1.0 + 0.16 * np.sin(2.0 * math.pi * 68.0 * t) * np.exp(-t * 8.0)
        ph = 2.0 * math.pi * np.cumsum(f_sweep * fm) / SR
        pew = (0.66 * np.sin(ph) + 0.26 * np.sin(2.0 * ph) + 0.12 * np.sin(3.0 * ph)) * np.exp(-t * 9.5)
        spark = butter_filter(rng.standard_normal(n).astype(np.float32), "band", (2200.0, 9600.0), order=2) * np.exp(-t * 24.0) * 0.42
        punch = np.sin(2.0 * math.pi * np.cumsum(190.0 * (0.35 ** np.clip(t / 0.08, 0.0, 1.0)) + 52.0) / SR) * np.exp(-t * 22.0) * 0.46
        sig = np.tanh((pew + spark + punch) * 1.32) * 0.86
        fade = int(0.04 * SR)
        sig[-fade:] *= np.linspace(1.0, 0.0, fade, dtype=np.float32)
        return sig.astype(np.float32)

    if sfx_type == "laser_hum":
        # Vibrating comedic optical vision-beam hum + rising plasma buzz
        dur = 0.96
        n = int(round(dur * SR))
        t = np.linspace(0.0, dur, n, endpoint=False, dtype=np.float32)
        prog = t / dur
        vib = 1.0 + 0.032 * np.sin(2.0 * math.pi * 19.0 * t)
        f0 = (165.0 + 95.0 * prog) * vib
        ph = 2.0 * math.pi * np.cumsum(f0) / SR
        buzz = (
            0.48 * np.sin(ph)
            + 0.30 * np.sin(2.0 * ph)
            + 0.18 * np.sin(3.0 * ph)
            + 0.12 * np.sin(5.0 * ph)
            + 0.08 * np.sin(7.0 * ph)
        )
        shimmer = np.sin(2.0 * math.pi * (920.0 + 420.0 * prog) * t) * (0.55 + 0.45 * np.sin(2.0 * math.pi * 12.0 * t)) * 0.22
        air = butter_filter(rng.standard_normal(n).astype(np.float32), "band", (1800.0, 6800.0), order=2) * 0.18
        env = adsr_env(n, attack=0.06, decay=0.10, sustain=0.84, release=0.18)
        sig = np.tanh((buzz * 0.62 + shimmer + air) * env * 1.24) * 0.82
        return sig.astype(np.float32)

    if sfx_type == "whip_whoosh":
        # Snappy cinema whip-pan air sweep with alternating L<->R stereo motion
        dur = 0.34
        n = int(round(dur * SR))
        t = np.linspace(0.0, dur, n, endpoint=False, dtype=np.float32)
        raw = rng.standard_normal(n).astype(np.float32)
        lo = butter_filter(raw, "band", (200.0, 1150.0), order=2)
        hi = butter_filter(raw, "band", (1150.0, 5200.0), order=2)
        arch = np.sin(math.pi * (t / dur)) ** 1.35
        sweep = np.clip(t / dur, 0.0, 1.0)
        tone = np.sin(2.0 * math.pi * np.cumsum(165.0 + 490.0 * arch) / SR) * arch * 0.22
        mono = (lo * (1.0 - 0.45 * sweep) * 0.72 + hi * (0.35 + 0.65 * sweep) * 0.62 + tone) * arch
        mono = np.tanh(mono * 1.32).astype(np.float32) * 0.82
        direction = 1.0 if (event_idx % 2 == 0) else -1.0
        pan_curve = direction * np.linspace(-0.56, 0.56, n, dtype=np.float32)
        angle = (pan_curve + 1.0) * (math.pi / 4.0)
        return np.stack([mono * np.cos(angle), mono * np.sin(angle)], axis=-1).astype(np.float32)

    if sfx_type == "shutter_slam":
        # Heavy carved Cairo cedar wooden window shutter SLAM + brass latch clack + room boom
        dur = 0.64
        n = int(round(dur * SR))
        t = np.linspace(0.0, dur, n, endpoint=False, dtype=np.float32)
        f_sub = 148.0 * (0.24 ** np.clip(t / 0.10, 0.0, 1.0)) + 36.0
        thud = np.sin(2.0 * math.pi * np.cumsum(f_sub) / SR) * np.exp(-t * 11.5) * 0.92
        wood_crack = butter_filter(rng.standard_normal(n).astype(np.float32), "band", (320.0, 3200.0), order=2) * np.exp(-t * 42.0) * 0.75
        wood_res = (
            0.55 * np.sin(2.0 * math.pi * 245.0 * t) * np.exp(-t * 24.0)
            + 0.35 * np.sin(2.0 * math.pi * 510.0 * t) * np.exp(-t * 32.0)
        ) * 0.44
        # Secondary latch bounce rattle 0.065s later
        t_r = np.maximum(0.0, t - 0.065)
        r_mask = (t >= 0.065).astype(np.float32)
        latch = (
            np.sin(2.0 * math.pi * 1340.0 * t_r) * np.exp(-t_r * 45.0)
            + np.sin(2.0 * math.pi * 2420.0 * t_r) * np.exp(-t_r * 58.0) * 0.5
        ) * r_mask * 0.34
        sig = np.tanh((thud + wood_crack + wood_res + latch) * 1.38) * 0.88
        fade = int(0.06 * SR)
        sig[-fade:] *= np.linspace(1.0, 0.0, fade, dtype=np.float32)
        return sig.astype(np.float32)

    if sfx_type == "power_down":
        # Comedic descending laser-vision "bwooooomp..." power-off pitch droop
        dur = 0.86
        n = int(round(dur * SR))
        t = np.linspace(0.0, dur, n, endpoint=False, dtype=np.float32)
        prog = t / dur
        f_drop = 840.0 * (0.065 ** (prog ** 0.88)) + 48.0
        ph = 2.0 * math.pi * np.cumsum(f_drop) / SR
        wobble = 0.85 + 0.15 * np.sin(2.0 * math.pi * (14.0 - 10.0 * prog) * t)
        droop = (0.64 * np.sin(ph) + 0.28 * np.sin(2.0 * ph) + 0.14 * np.sin(3.0 * ph)) * wobble
        env = adsr_env(n, attack=0.015, decay=0.14, sustain=0.72, release=0.22)
        sig = np.tanh(droop * env * 1.24) * 0.84
        return sig.astype(np.float32)

    if sfx_type == "footstep_stumble":
        # Blind stumbling in the dark: 3 uneven stone scuffs + tiny wooden bench bump
        dur = 0.92
        n = int(round(dur * SR))
        t = np.linspace(0.0, dur, n, endpoint=False, dtype=np.float32)
        out = np.zeros(n, dtype=np.float32)
        steps = [
            (0.02, 130.0, 0.72, 0.11),
            (0.24, 155.0, 0.62, 0.09),
            (0.41, 118.0, 0.86, 0.13),  # Heavier stumble step
        ]
        for st_s, f_base, amp, s_dur in steps:
            d = int(round(st_s * SR))
            slen = min(int(round(s_dur * SR)), n - d)
            if slen > 8:
                tt = t[:slen]
                f_th = f_base * (0.40 ** np.clip(tt / 0.05, 0.0, 1.0)) + 44.0
                thud = np.sin(2.0 * math.pi * np.cumsum(f_th) / SR) * np.exp(-tt * 28.0) * 0.75
                scuff = butter_filter(rng.standard_normal(slen).astype(np.float32), "band", (420.0, 2800.0), order=2) * np.exp(-tt * 34.0) * 0.50
                out[d : d + slen] += (thud + scuff) * amp
        # Small hollow wood bump + ceramic wobble at 0.56s
        d_b = int(round(0.56 * SR))
        blen = n - d_b
        tt = t[:blen]
        bump = (
            np.sin(2.0 * math.pi * 215.0 * tt) * np.exp(-tt * 22.0) * 0.52
            + np.sin(2.0 * math.pi * 680.0 * tt) * np.exp(-tt * 16.0) * (0.5 + 0.5 * np.sin(2.0 * math.pi * 16.0 * tt)) * 0.24
        )
        out[d_b:] += bump
        fade = int(0.05 * SR)
        out[-fade:] *= np.linspace(1.0, 0.0, fade, dtype=np.float32)
        return np.tanh(out * 1.25).astype(np.float32) * 0.84

    if sfx_type == "match_ignite":
        # Crisp flint-and-tinder strike spark + warm candle flame ignition FWOOSH + gentle crackle
        dur = 0.72
        n = int(round(dur * SR))
        t = np.linspace(0.0, dur, n, endpoint=False, dtype=np.float32)
        raw = rng.standard_normal(n).astype(np.float32)
        # Flint strike scrape (0.00..0.09s)
        scrape = butter_filter(raw, "band", (2600.0, 9800.0), order=2) * np.exp(-t * 32.0) * 0.72
        spark_ring = np.sin(2.0 * math.pi * 4180.0 * t) * np.exp(-t * 68.0) * 0.30
        # Warm candle flame puff starting at 0.055s
        t_f = np.maximum(0.0, t - 0.055)
        f_mask = (t >= 0.055).astype(np.float32)
        flame_lo = butter_filter(raw, "band", (140.0, 780.0), order=2) * np.exp(-t_f * 5.2) * np.clip(t_f / 0.024, 0.0, 1.0) * f_mask
        flame_hi = butter_filter(raw, "band", (1100.0, 5400.0), order=2) * np.exp(-t_f * 6.8) * np.clip(t_f / 0.018, 0.0, 1.0) * f_mask
        # Tiny wick crackles
        crackles = np.zeros(n, dtype=np.float32)
        for cs in (0.14, 0.26, 0.39, 0.51):
            d = int(round(cs * SR))
            clen = min(int(round(0.014 * SR)), n - d)
            if clen > 4:
                tt = t[:clen]
                crackles[d : d + clen] += butter_filter(rng.standard_normal(clen).astype(np.float32), "high", 2800.0, order=2) * np.exp(-tt * 230.0) * 0.38
        sig = np.tanh((scrape + spark_ring + flame_lo * 0.90 + flame_hi * 0.58 + crackles) * 1.28) * 0.85
        fade = int(0.06 * SR)
        sig[-fade:] *= np.linspace(1.0, 0.0, fade, dtype=np.float32)
        return sig.astype(np.float32)

    if sfx_type == "pinhole_click":
        # Precision brass/ebony optical aperture slide-click + delicate resonant tick
        dur = 0.28
        n = int(round(dur * SR))
        t = np.linspace(0.0, dur, n, endpoint=False, dtype=np.float32)
        snap = butter_filter(rng.standard_normal(n).astype(np.float32), "band", (1400.0, 7600.0), order=2) * np.exp(-t * 88.0) * 0.72
        brass = (
            0.55 * np.sin(2.0 * math.pi * 1680.0 * t) * np.exp(-t * 36.0)
            + 0.35 * np.sin(2.0 * math.pi * 3140.0 * t) * np.exp(-t * 48.0)
            + 0.20 * np.sin(2.0 * math.pi * 4920.0 * t) * np.exp(-t * 62.0)
        ) * 0.56
        # Second tiny lock-in click at 0.042s
        t2 = np.maximum(0.0, t - 0.042)
        m2 = (t >= 0.042).astype(np.float32)
        lock = np.sin(2.0 * math.pi * 2480.0 * t2) * np.exp(-t2 * 72.0) * m2 * 0.44
        sig = np.tanh((snap + brass + lock) * 1.24) * 0.84
        fade = int(0.03 * SR)
        sig[-fade:] *= np.linspace(1.0, 0.0, fade, dtype=np.float32)
        return sig.astype(np.float32)

    if sfx_type == "light_beam_shimmer":
        # Ethereal crystalline light-ray gliding left -> right through the pinhole!
        dur = 1.65
        n = int(round(dur * SR))
        t = np.linspace(0.0, dur, n, endpoint=False, dtype=np.float32)
        prog = t / dur
        # Shimmering G Hijaz/Major optical harmonics
        freqs = [783.99, 1174.66, 1567.98, 1975.53, 2349.32, 3135.96]
        shimmer = np.zeros(n, dtype=np.float32)
        for idx, fr in enumerate(freqs):
            f_mod = fr * (1.0 + 0.008 * np.sin(2.0 * math.pi * (4.5 + idx * 1.4) * t))
            ph = 2.0 * math.pi * np.cumsum(f_mod) / SR
            twinkle = 0.55 + 0.45 * np.sin(2.0 * math.pi * (3.2 + idx * 1.9) * t + idx * 0.8)
            shimmer += np.sin(ph) * twinkle / (1.0 + 0.28 * idx)
        shimmer /= 2.6
        airy = butter_filter(rng.standard_normal(n).astype(np.float32), "band", (2400.0, 8200.0), order=2) * 0.14
        env = adsr_env(n, attack=0.18, decay=0.22, sustain=0.78, release=0.38)
        mono = np.tanh((shimmer + airy) * env * 1.18).astype(np.float32) * 0.82
        # Stereo left-to-right sweep matching candle (-X) -> pinhole (0) -> screen (+X)!
        pan_curve = np.linspace(-0.55, 0.55, n, dtype=np.float32)
        angle = (pan_curve + 1.0) * (math.pi / 4.0)
        return np.stack([mono * np.cos(angle), mono * np.sin(angle)], axis=-1).astype(np.float32)

    if sfx_type == "projection_bloom":
        # Warm golden radiant image-projection bloom chord on the parchment screen
        dur = 1.15
        n = int(round(dur * SR))
        t = np.linspace(0.0, dur, n, endpoint=False, dtype=np.float32)
        chord_freqs = [392.00, 587.33, 783.99, 987.77, 1174.66, 1567.98]
        bloom = np.zeros(n, dtype=np.float32)
        for idx, fr in enumerate(chord_freqs):
            delay = idx * 0.032
            tt = np.maximum(0.0, t - delay)
            mask = (t >= delay).astype(np.float32)
            v = (
                0.62 * np.sin(2.0 * math.pi * fr * tt) * np.exp(-tt * 2.4)
                + 0.24 * np.sin(2.0 * math.pi * (fr * 2.0) * tt) * np.exp(-tt * 4.2)
            ) * np.clip(tt / 0.06, 0.0, 1.0) * mask
            bloom += v / (1.0 + 0.18 * idx)
        warm_air = butter_filter(rng.standard_normal(n).astype(np.float32), "band", (600.0, 3200.0), order=2) * np.sin(math.pi * (t / dur)) * 0.16
        out = np.tanh((bloom * 0.52 + warm_air) * 1.15).astype(np.float32) * 0.84
        fade = int(0.10 * SR)
        out[-fade:] *= np.linspace(1.0, 0.0, fade, dtype=np.float32)
        return out

    if sfx_type == "comic_boing":
        # Snappy comedic elastic spring BOING + inverted pitch-flip squeak!
        dur = 0.62
        n = int(round(dur * SR))
        t = np.linspace(0.0, dur, n, endpoint=False, dtype=np.float32)
        wobble = np.sin(2.0 * math.pi * 19.5 * t) * np.exp(-t * 4.0)
        f_boing = 225.0 + 270.0 * (1.0 - np.exp(-t * 15.0)) + 210.0 * wobble
        ph = 2.0 * math.pi * np.cumsum(f_boing) / SR
        boing = (
            0.60 * np.sin(ph)
            + 0.30 * np.sin(2.0 * ph + 0.35 * np.exp(-t * 5.0))
            + 0.14 * np.sin(3.0 * ph)
        ) * np.exp(-t * 4.4) * 0.74
        # Quick upside-down cartoon pitch flip (down-then-up)
        t_z = np.clip(t / 0.24, 0.0, 1.0)
        z_mask = (t <= 0.26).astype(np.float32)
        f_flip = 1480.0 - 760.0 * np.sin(math.pi * t_z) + 420.0 * t_z
        flip = np.sin(2.0 * math.pi * np.cumsum(f_flip) / SR) * np.sin(math.pi * t_z) * z_mask * 0.30
        out = np.tanh((boing + flip) * 1.18).astype(np.float32) * 0.85
        fade = int(0.04 * SR)
        out[-fade:] *= np.linspace(1.0, 0.0, fade, dtype=np.float32)
        return out

    if sfx_type == "chime_insight":
        # Scholar's golden astrolabe bell + crystalline insight sparkle
        dur = 0.76
        n = int(round(dur * SR))
        t = np.linspace(0.0, dur, n, endpoint=False, dtype=np.float32)
        bell1 = (
            0.62 * np.sin(2.0 * math.pi * 1567.98 * t) * np.exp(-t * 4.6)
            + 0.28 * np.sin(2.0 * math.pi * 2349.32 * t) * np.exp(-t * 6.8)
            + 0.16 * np.sin(2.0 * math.pi * 3135.96 * t) * np.exp(-t * 10.5)
        ) * np.clip(t / 0.002, 0.0, 1.0)
        t2 = np.maximum(0.0, t - 0.065)
        m2 = (t >= 0.065).astype(np.float32)
        bell2 = (
            0.55 * np.sin(2.0 * math.pi * 2349.32 * t2) * np.exp(-t2 * 5.2)
            + 0.25 * np.sin(2.0 * math.pi * 3520.00 * t2) * np.exp(-t2 * 8.4)
        ) * m2 * 0.65
        out = (bell1 + bell2) * 0.72
        fade = int(0.07 * SR)
        out[-fade:] *= np.linspace(1.0, 0.0, fade, dtype=np.float32)
        return out.astype(np.float32)

    if sfx_type == "eureka_swell":
        # Grand Golden Age Camera Obscura climax! Sub bloom + ascending golden chime arpeggio + brass swell
        dur = 1.65
        n = int(round(dur * SR))
        t = np.linspace(0.0, dur, n, endpoint=False, dtype=np.float32)
        # Warm cinema impact boom
        f_sub = 118.0 * (0.32 ** np.clip(t / 0.20, 0.0, 1.0)) + 36.0
        sub = np.sin(2.0 * math.pi * np.cumsum(f_sub) / SR) * np.exp(-t * 3.8) * 0.56
        # Ascending G Major golden arpeggio
        arp = np.zeros(n, dtype=np.float32)
        for idx, fr in enumerate([392.00, 493.88, 587.33, 783.99, 987.77, 1174.66, 1567.98, 1975.53]):
            d = int(round((0.02 + idx * 0.048) * SR))
            if d < n:
                tt = t[: n - d]
                tone = (
                    0.62 * np.sin(2.0 * math.pi * fr * tt) * np.exp(-tt * 2.8)
                    + 0.26 * np.sin(2.0 * math.pi * (fr * 2.0) * tt) * np.exp(-tt * 4.8)
                ) * np.clip(tt / 0.004, 0.0, 1.0)
                arp[d:] += tone * 0.24
        # Heroic brass-string harmonic lift
        brass = np.zeros(n, dtype=np.float32)
        for idx, fr in enumerate([196.00, 293.66, 392.00, 493.88, 587.33, 783.99]):
            ph = 2.0 * math.pi * fr * t
            brass += (0.55 * np.sin(ph) + 0.28 * np.sin(2.0 * ph) + 0.14 * np.sin(3.0 * ph)) / (1.0 + 0.16 * idx)
        brass = butter_filter(brass / 3.0, "low", 3100.0, order=2) * adsr_env(n, attack=0.14, decay=0.20, sustain=0.80, release=0.38)
        sig = np.tanh((sub + arp + brass * 0.65) * 1.18) * 0.86
        return sig.astype(np.float32)

    if sfx_type == "camera_shutter_modern":
        # Crisp modern camera shutter KA-CHK! (subtle focus chirp + two-stage mechanical shutter click)
        dur = 0.36
        n = int(round(dur * SR))
        t = np.linspace(0.0, dur, n, endpoint=False, dtype=np.float32)
        out = np.zeros(n, dtype=np.float32)
        # Optional subtle clean high-tech focus chirp on the second (smartphone) snap
        if event_idx % 2 == 1:
            c_len = int(round(0.035 * SR))
            tt = t[:c_len]
            out[:c_len] += np.sin(2.0 * math.pi * 2637.02 * tt) * np.sin(math.pi * tt / 0.035) * 0.24
            t_click1 = 0.045
            t_click2 = 0.095
        else:
            t_click1 = 0.005
            t_click2 = 0.062

        # Curtain 1: sharp metallic mirror-up KA-
        d1 = int(round(t_click1 * SR))
        l1 = min(int(round(0.065 * SR)), n - d1)
        tt1 = t[:l1]
        c1 = (
            butter_filter(rng.standard_normal(l1).astype(np.float32), "band", (1200.0, 9600.0), order=2) * np.exp(-tt1 * 95.0) * 0.85
            + np.sin(2.0 * math.pi * 1850.0 * tt1) * np.exp(-tt1 * 120.0) * 0.42
            + np.sin(2.0 * math.pi * 340.0 * tt1) * np.exp(-tt1 * 68.0) * 0.46
        )
        out[d1 : d1 + l1] += c1

        # Curtain 2: snappy return -CHK!
        d2 = int(round(t_click2 * SR))
        l2 = min(int(round(0.085 * SR)), n - d2)
        tt2 = t[:l2]
        c2 = (
            butter_filter(rng.standard_normal(l2).astype(np.float32), "band", (1800.0, 11200.0), order=2) * np.exp(-tt2 * 82.0) * 0.92
            + np.sin(2.0 * math.pi * 2760.0 * tt2) * np.exp(-tt2 * 98.0) * 0.48
            + np.sin(2.0 * math.pi * 490.0 * tt2) * np.exp(-tt2 * 64.0) * 0.36
        )
        out[d2 : d2 + l2] += c2

        sig = np.tanh(out * 1.32) * 0.86
        fade = int(0.03 * SR)
        sig[-fade:] *= np.linspace(1.0, 0.0, fade, dtype=np.float32)
        return sig.astype(np.float32)

    raise ValueError(f"Unknown SFX type in timeline.json: {sfx_type}")


def _bound_sfx(wav: np.ndarray, ceiling: float = 0.85) -> np.ndarray:
    pk = float(np.max(np.abs(wav)))
    if pk > ceiling:
        wav = (wav * (ceiling / pk)).astype(np.float32)
    return wav


def measure_integrated_lufs_bs1770(stereo: np.ndarray, sr: int = SR) -> float:
    """Exact ITU-R BS.1770-4 K-weighted integrated loudness (LUFS) in pure SciPy/NumPy."""
    f0 = 1681.974450955533
    g_db = 3.999843853973347
    q0 = 0.7071752369554196
    k = math.tan(math.pi * f0 / sr)
    vh = 10.0 ** (g_db / 20.0)
    vb = vh ** 0.4996667741545416
    a0 = 1.0 + k / q0 + k * k
    b_shelf = np.array(
        [(vh + vb * k / q0 + k * k) / a0, 2.0 * (k * k - vh) / a0, (vh - vb * k / q0 + k * k) / a0],
        dtype=np.float64,
    )
    a_shelf = np.array([1.0, 2.0 * (k * k - 1.0) / a0, (1.0 - k / q0 + k * k) / a0], dtype=np.float64)

    f1 = 38.13547087602444
    q1 = 0.5003270373238773
    k1 = math.tan(math.pi * f1 / sr)
    a1_0 = 1.0 + k1 / q1 + k1 * k1
    b_hp = np.array([1.0, -2.0, 1.0], dtype=np.float64) / a1_0
    a_hp = np.array([1.0, 2.0 * (k1 * k1 - 1.0) / a1_0, (1.0 - k1 / q1 + k1 * k1) / a1_0], dtype=np.float64)

    y = signal.lfilter(b_shelf, a_shelf, stereo.astype(np.float64), axis=0)
    y = signal.lfilter(b_hp, a_hp, y, axis=0)

    block_len = int(round(0.400 * sr))
    hop_len = int(round(0.100 * sr))
    powers = []
    for start in range(0, len(y) - block_len + 1, hop_len):
        blk = y[start : start + block_len]
        powers.append(float(np.mean(np.sum(blk * blk, axis=1))))
    powers_arr = np.array(powers, dtype=np.float64)

    lufs_blocks = -0.691 + 10.0 * np.log10(np.maximum(powers_arr, 1e-18))
    abs_mask = lufs_blocks > -70.0
    if not np.any(abs_mask):
        return -70.0
    rel_thresh = -0.691 + 10.0 * math.log10(float(np.mean(powers_arr[abs_mask]))) - 10.0
    rel_mask = abs_mask & (lufs_blocks > rel_thresh)
    if not np.any(rel_mask):
        return -70.0
    return -0.691 + 10.0 * math.log10(float(np.mean(powers_arr[rel_mask])))


def calibrate_and_finalize_manifest(
    project_root: Path,
    timeline: dict[str, Any],
    target_lufs: float = -14.0,
    ceiling_dbfs: float = -1.62,
) -> tuple[float, float, float]:
    """
    Fine-tune exported `master_audio.wav` to hit `-14.0 LUFS` while strictly
    enforcing 4x oversampled True Peak `<= -1.5 dBFS`, and populate top-level
    flat `words` + loudness metadata in `voice_manifest.json`.
    """
    master_path = project_root / timeline["audio"]["masterPath"]
    manifest_path = project_root / timeline["audio"]["manifestPath"]

    mix, sr = sf.read(str(master_path), dtype="float32")
    ceiling_lin = 10.0 ** (ceiling_dbfs / 20.0)

    for _ in range(5):
        cur_lufs = measure_integrated_lufs_bs1770(mix, sr)
        diff_db = target_lufs - cur_lufs
        if abs(diff_db) < 0.05:
            break
        gain = 10.0 ** (diff_db / 20.0)
        mix = mix * gain
        abs_m = np.abs(mix)
        knee = ceiling_lin * 0.84
        over = abs_m > knee
        if np.any(over):
            sign = np.sign(mix[over])
            excess = (abs_m[over] - knee) / max(1e-6, ceiling_lin - knee)
            mix[over] = sign * (knee + (ceiling_lin - knee) * np.tanh(excess))

    # Strict 4x oversampled True Peak ceiling (<= -1.5 dBFS)
    up4 = signal.resample_poly(mix, 4, 1, axis=0)
    true_peak = float(np.max(np.abs(up4)))
    if true_peak > ceiling_lin:
        mix *= ceiling_lin / true_peak

    sf.write(str(master_path), mix, sr, subtype="PCM_16")

    final_wav, _ = sf.read(str(master_path), dtype="float32")
    final_lufs = measure_integrated_lufs_bs1770(final_wav, sr)
    final_up4 = signal.resample_poly(final_wav, 4, 1, axis=0)
    final_tp_db = 20.0 * math.log10(max(1e-9, float(np.max(np.abs(final_up4)))))
    final_sample_pk_db = 20.0 * math.log10(max(1e-9, float(np.max(np.abs(final_wav)))))

    if manifest_path.exists():
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
        # Build flat chronological `words` list alongside per-line `lines[i].words`
        flat_words: list[dict[str, Any]] = []
        for line in manifest.get("lines", []):
            for w in line.get("words", []):
                flat_words.append({
                    "word": w["word"],
                    "start": w["start"],
                    "end": w["end"],
                    "speaker": line["speaker"],
                    "lineId": line["id"],
                })
        manifest["words"] = flat_words
        manifest["loudnessLufs"] = round(final_lufs, 2)
        manifest["truePeakDbfs"] = round(final_tp_db, 2)
        manifest["peakDbfs"] = round(final_sample_pk_db, 3)
        manifest_path.write_text(json.dumps(manifest, indent=2), encoding="utf-8")

    return final_lufs, final_tp_db, final_sample_pk_db


def main() -> None:
    raw_timeline = load_timeline(TIMELINE_PATH)
    timeline = build_dsp_timeline(raw_timeline)

    n_lines = len(timeline["dialogue"])
    print(f"[Audio] Synthesizing {n_lines} Kokoro dialogue lines (bm_george / am_michael / bm_lewis)...")
    dialogue_bus, speaker_mono_buses, manifest_lines = synthesize_dialogue(
        timeline,
        tts_overrides=TTS_OVERRIDES,
    )

    print("[Audio] Composing 108 BPM Cairo Golden Age Middle Eastern BGM (Oud, Qanun, Ney, Darbuka)...")
    bgm_bus = generate_bgm(timeline)

    sfx_events = timeline.get("sfxEvents", [])
    print(f"[Audio] Synthesizing {len(sfx_events)} timed Foley SFX cues...")
    sfx_bus = np.zeros((TOTAL_SAMPLES, CHANNELS), dtype=np.float32)
    for idx, ev in enumerate(sfx_events):
        sfx_type = ev["type"]
        base_gain, default_pan = SFX_MIX_PROFILE.get(sfx_type, (0.72, 0.0))
        intensity = float(ev.get("intensity", 0.85))
        gain = base_gain * (0.55 + 0.50 * intensity)
        pan = float(ev.get("pan", default_pan))
        wav = _bound_sfx(synth_sfx(sfx_type, event_idx=idx)) * gain
        if wav.ndim == 2:
            add_stereo_event(sfx_bus, wav, float(ev["time"]))
        else:
            add_stereo_event(sfx_bus, pan_stereo(wav, pan), float(ev["time"]))

    master_and_export(
        PROJECT_ROOT,
        timeline,
        dialogue_bus,
        bgm_bus,
        sfx_bus,
        speaker_mono_buses,
        manifest_lines,
    )

    final_lufs, final_tp_db, final_sample_pk_db = calibrate_and_finalize_manifest(
        PROJECT_ROOT,
        timeline,
        target_lufs=-14.0,
        ceiling_dbfs=-1.62,
    )
    print(
        f"[Audio] Calibrated Master: {final_lufs:.2f} LUFS | "
        f"True Peak: {final_tp_db:.2f} dBFS | Sample Peak: {final_sample_pk_db:.2f} dBFS"
    )


if __name__ == "__main__":
    main()
