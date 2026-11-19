/**
 * Ibn al-Haytham — Book of Optics & Camera Obscura 3D Short
 * Main Application & Deterministic Frame Engine
 * (/home/antigravity/ssghtc002-sudo/ibn-al-haytham-optics-3d/src/main.js)
 */
import * as THREE from 'three';
import { createBaseDirector } from './engine/baseDirector.js';
import { createHudCompositor, createFrameCompositor } from './engine/hudCompositor.js';
import { buildCairoObservatoryStage } from './scene/cairoObservatoryStage.js';

async function init() {
  const [timeline, manifest] = await Promise.all([
    fetch('/config/timeline.json').then((r) => r.json()),
    fetch('/audio/output/voice_manifest.json').then((r) => (r.ok ? r.json() : null)).catch(() => null),
  ]);

  // Normalize sfx -> sfxEvents for createBaseDirector & createHudCompositor
  if (!timeline.sfxEvents && Array.isArray(timeline.sfx)) {
    timeline.sfxEvents = timeline.sfx.map((ev) => ({
      time: ev.t,
      type: ev.type,
      shake: ev.shake ?? 0.2,
      flash: ev.flash ?? 0.0,
    }));
  }

  const width = timeline.resolution?.width || 1080;
  const height = timeline.resolution?.height || 1920;
  const fps = timeline.fps || 30;
  const duration = timeline.duration || 30.0;
  const totalFrames = timeline.totalFrames || 900;

  const webglCanvas = document.getElementById('webgl-canvas');
  const hudCanvas = document.getElementById('hud-canvas');

  const renderer = new THREE.WebGLRenderer({
    canvas: webglCanvas,
    antialias: true,
    preserveDrawingBuffer: true,
    powerPreference: 'high-performance',
  });
  renderer.setPixelRatio(1);
  renderer.setSize(width, height, false);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.shadowMap.autoUpdate = false;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#091024');

  const camera = new THREE.PerspectiveCamera(42, width / height, 0.1, 60);
  const stage = buildCairoObservatoryStage(scene, timeline);
  const director = createBaseDirector(camera, timeline);

  const sfxEvents = timeline.sfxEvents || [];
  function drawOverlay(ctx, t) {
    for (let i = 0; i < sfxEvents.length; i++) {
      const ev = sfxEvents[i];
      if (!ev.flash || ev.flash <= 0) continue;
      const dt = t - ev.time;
      if (dt < 0 || dt > 0.30) continue;
      const a = ev.flash * Math.exp(-dt * 11.0);
      if (a > 0.008) {
        const isLaser = ev.type === 'laser_zap' || ev.type === 'laser_hum';
        const isOptics = ev.type === 'light_beam_shimmer' || ev.type === 'camera_shutter_modern';
        const g = ctx.createRadialGradient(width * 0.5, height * 0.42, 20, width * 0.5, height * 0.42, height * 0.54);
        g.addColorStop(
          0.0,
          isLaser
            ? `rgba(255, 79, 216, ${a.toFixed(3)})`
            : isOptics
            ? `rgba(186, 230, 253, ${a.toFixed(3)})`
            : `rgba(254, 240, 199, ${a.toFixed(3)})`
        );
        g.addColorStop(1.0, 'rgba(56, 189, 248, 0)');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, width, height);
      }
    }
  }

  const hud = createHudCompositor(timeline, manifest, hudCanvas, {
    subtitleY: 1650,
    accentColor: '#38BDF8',
    accentGlow: 'rgba(56, 189, 248, 0.50)',
    drawOverlay,
  });
  const compositor = createFrameCompositor(webglCanvas, hudCanvas, width, height);

  function renderFrame(frameIndex = 0) {
    const f = Math.max(0, Math.min(totalFrames - 1, Math.floor(frameIndex)));
    const t = f / fps;

    stage.update(t, manifest);
    director.update(t, {});

    if (f === 0 || f % 2 === 0) {
      renderer.shadowMap.needsUpdate = true;
    }
    renderer.render(scene, camera);
    hud.render(t);

    return {
      frame: f,
      time: +t.toFixed(3),
      calls: renderer.info.render.calls,
      tris: renderer.info.render.triangles,
      materials: stage.registry.count(),
    };
  }

  window.__RENDER_FRAME__ = renderFrame;
  window.__GET_COMPOSITE_CANVAS__ = () => compositor.composite();
  window.__SCENE_READY__ = true;

  const isRenderMode = new URLSearchParams(window.location.search).get('render') === '1';
  if (!isRenderMode) {
    let startTs = performance.now();
    function loop(now) {
      const elapsed = ((now - startTs) / 1000) % duration;
      renderFrame(Math.floor(elapsed * fps));
      requestAnimationFrame(loop);
    }
    requestAnimationFrame(loop);
  } else {
    renderFrame(0);
  }
}

init().catch((err) => {
  console.error('[IbnAlHaythamMain Error]', err);
});
