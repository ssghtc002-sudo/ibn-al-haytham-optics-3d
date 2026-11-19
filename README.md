# Ibn al-Haytham (Alhazen) — *Book of Optics* & Camera Obscura (3D YouTube Short)

Production-grade **30-second 9:16 portrait (`1080×1920`, `30 fps`, `900` frames)** 3D animated YouTube Short celebrating **Scientist #3 — Ibn al-Haytham (Alhazen, c. 965–1040)**, showcasing how he debunked the ancient eye-laser myth and invented the Camera Obscura to prove that light travels in straight lines into the eye.

## Key Features
- **100% Unique Golden Age Fatimid Cairo Set**: Candlelit Cairo Observatory chamber with procedural Islamic octagram mosaic tiles, carved horseshoe archway, hanging brass lanterns, distant Al-Azhar minaret silhouette under a starry crescent-moon night sky, inlaid walnut optics workbench, darkened cedar pinhole partition with animated sliding shutter, and luminous parchment screen displaying an **upside-down inverted candle flame**.
- **100% Unique Era-Accurate Cast**:
  - **Ibn al-Haytham (Alhazen)**: Sculpted multi-wrap ivory silk Fatimid scholar turban (`imamah`) with golden `qalansuwa` dome, emerald-teal flowing embroidered `jubbah` robe, pointed scholar beard, and handheld brass optics lens.
  - **Rival Elder Theorist**: Bald crown with fluffy silver side-tuft curls, bushy brows, brass monocle (drops in shock!), crimson philosopher mantle, ancient scroll, and Beat 1 neon-magenta "eye-laser" beams.
- **Cinema Camera Grammar & Acting**: 6-beat viral narrative arc (`low_angle_push_in` -> `medium_two_shot_ots` -> `macro_orbital_insert` -> `dutch_tilt_reaction` -> `sweeping_crane_reveal` -> `hero_wide_pullback`), 6 Pixar emotional presets, automatic blinking, eye darts, and 900-frame voice-synced lip-sync.
- **Audio & Foley Production**: 3 distinct Kokoro ONNX voices (`bm_george`, `am_michael`, `bm_lewis`), custom 108 BPM G Hijaz Maqam Cairo Oud/Qanun/Ney/Darbuka BGM with `-5.5 dB` dialogue ducking, 20 timed Foley SFX cues, mastered to `-14.0 LUFS` / `-1.9 dBFS` True Peak.
- **Clean Boxless YouTube Subtitles**: Zero top UI clutter, centered outlined 800-weight captions with `#38BDF8` word-synced highlights and offscreen anti-bleed compositing.

## Reproduce Locally
```bash
# 1. Pre-flight scene verification (<1s Node gate)
node verify_scene.mjs

# 2. Visual QA keyframe capture (~15s)
node render/render_frames.mjs --qa-only

# 3. Full 900-frame WebCodecs H.264 render + FFmpeg audio mux
rm -rf .segments && node render/render_frames.mjs
```

## Deliverable
- Rendered MP4: [`output/ibn_al_haytham_optics_short.mp4`](output/ibn_al_haytham_optics_short.mp4)
- Subtitles: [`output/subtitles.srt`](output/subtitles.srt)
