/**
 * Sub-1-Second Node Pre-Flight Geometry, Budget, Grounding, NDC & 3D Box3 Collision Gate
 * (/home/antigravity/ssghtc002-sudo/ibn-al-haytham-optics-3d/verify_scene.mjs)
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as THREE from 'three';
import { createBaseDirector } from './src/engine/baseDirector.js';
import { buildCairoObservatoryStage } from './src/scene/cairoObservatoryStage.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const timeline = JSON.parse(fs.readFileSync(path.join(__dirname, 'config/timeline.json'), 'utf8'));
if (!timeline.sfxEvents && Array.isArray(timeline.sfx)) {
  timeline.sfxEvents = timeline.sfx.map((ev) => ({
    time: ev.t,
    type: ev.type,
    shake: ev.shake ?? 0.2,
    flash: ev.flash ?? 0.0,
  }));
}
const manifestPath = path.join(__dirname, 'audio/output/voice_manifest.json');
const voiceManifest = fs.existsSync(manifestPath) ? JSON.parse(fs.readFileSync(manifestPath, 'utf8')) : null;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(42, 1080 / 1920, 0.1, 60);
const director = createBaseDirector(camera, timeline);
const stage = buildCairoObservatoryStage(scene, timeline);

let errors = [];
let peakDraws = 0;
let peakTris = 0;
let lightCount = 0;
const uniqueMatUuids = new Set();

scene.traverse((obj) => {
  if (obj.isLight) lightCount++;
  if (obj.material) {
    const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
    for (const m of mats) uniqueMatUuids.add(m.uuid);
  }
});

function countVisibleStats() {
  let draws = 0;
  let tris = 0;
  scene.traverseVisible((obj) => {
    if (obj.isInstancedMesh) {
      draws++;
      const g = obj.geometry;
      const baseTris = g.index ? g.index.count / 3 : g.attributes.position.count / 3;
      tris += baseTris * obj.count;
    } else if (obj.isMesh) {
      draws++;
      const g = obj.geometry;
      tris += g.index ? g.index.count / 3 : g.attributes.position.count / 3;
    } else if (obj.isSprite) {
      draws++;
      tris += 2;
    }
  });
  return { draws, tris: Math.round(tris) };
}

function projectWorld(vec) {
  const p = vec.clone().project(camera);
  return { x: p.x, y: p.y, z: p.z };
}

function boxIntersects(a, b) {
  const ba = new THREE.Box3().setFromObject(a);
  const bb = new THREE.Box3().setFromObject(b);
  return ba.intersectsBox(bb);
}

const sampleCount = 30;
for (let i = 0; i < sampleCount; i++) {
  const t = Number(((i / (sampleCount - 1)) * 29.9).toFixed(2));
  stage.update(t, voiceManifest);
  director.update(t, {});
  scene.updateMatrixWorld(true);
  camera.updateMatrixWorld(true);

  const stats = countVisibleStats();
  peakDraws = Math.max(peakDraws, stats.draws);
  peakTris = Math.max(peakTris, stats.tris);

  // 1. Matrix & NaN Sanity + Foot Grounding
  for (const [name, ch] of [
    ['alhazen', stage.alhazen],
    ['rival', stage.rival],
  ]) {
    if (ch.root.matrixWorld.elements.some((v) => Number.isNaN(v))) {
      errors.push(`[t=${t}s] NaN matrix on ${name}`);
    }
    const bL = new THREE.Box3().setFromObject(ch.legL.shoe);
    const bR = new THREE.Box3().setFromObject(ch.legR.shoe);
    const minY = Math.min(bL.min.y, bR.min.y);
    if (Math.abs(minY - 0.0) > 0.015) {
      errors.push(`[t=${t}s] ${name} foot grounding drift: minY=${minY.toFixed(4)}`);
    }
  }

  // 2. NDC Frustum & Subtitle Safe-Band Gate (skip Beat 3 macro insert where camera zooms tightly onto optics bench!)
  const inMacro = t >= 9.4 && t <= 15.6;
  if (!inMacro) {
    const checkChars = t < 4.5 ? [['rival', stage.rival]] : [['alhazen', stage.alhazen], ['rival', stage.rival]];
    for (const [name, ch] of checkChars) {
      const headBox = new THREE.Box3().setFromObject(ch.headGroup);
      const headTop = new THREE.Vector3((headBox.min.x + headBox.max.x) * 0.5, headBox.max.y, (headBox.min.z + headBox.max.z) * 0.5);
      const headMid = new THREE.Vector3((headBox.min.x + headBox.max.x) * 0.5, (headBox.min.y + headBox.max.y) * 0.5, (headBox.min.z + headBox.max.z) * 0.5);
      const ndcTop = projectWorld(headTop);
      const ndcMid = projectWorld(headMid);
      if (Math.abs(ndcMid.x) > 0.88) {
        errors.push(`[t=${t}s] ${name} head clipped X: ndcX=${ndcMid.x.toFixed(3)}`);
      }
      if (ndcTop.y > 0.90) {
        errors.push(`[t=${t}s] ${name} head clipped TOP: ndcY=${ndcTop.y.toFixed(3)}`);
      }
      if (ndcMid.y < -0.45) {
        errors.push(`[t=${t}s] ${name} head too low (subtitle band): ndcY=${ndcMid.y.toFixed(3)}`);
      }
    }
  } else {
    // In Beat 3 macro insert, verify pinhole & projection screen sit cleanly in upper/middle viewport!
    const ndcPin = projectWorld(new THREE.Vector3(...timeline.world.pinholePos));
    const ndcScr = projectWorld(new THREE.Vector3(timeline.world.screenPos[0], 1.18, timeline.world.screenPos[2]));
    if (Math.abs(ndcPin.x) > 0.70 || ndcPin.y < -0.40 || ndcPin.y > 0.75) {
      errors.push(`[t=${t}s] Beat 3 macro pinhole poorly framed: (${ndcPin.x.toFixed(2)}, ${ndcPin.y.toFixed(2)})`);
    }
    if (Math.abs(ndcScr.x) > 0.92) {
      errors.push(`[t=${t}s] Beat 3 macro projection screen clipped X: ${ndcScr.x.toFixed(2)}`);
    }
  }

  // 3. 3D Box3 Limb-vs-Bench & Partition Collision Gate
  for (const [name, ch] of [
    ['alhazen', stage.alhazen],
    ['rival', stage.rival],
  ]) {
    for (const [partName, obj] of [
      ['handL', ch.armL.hand],
      ['handR', ch.armR.hand],
      ['shoeL', ch.legL.shoe],
      ['shoeR', ch.legR.shoe],
    ]) {
      if (boxIntersects(obj, stage.benchMesh)) {
        errors.push(`[t=${t}s] 3D Box3 collision: ${name}.${partName} penetrates opticsBench`);
      }
      if (boxIntersects(obj, stage.partitionMesh)) {
        errors.push(`[t=${t}s] 3D Box3 collision: ${name}.${partName} penetrates pinholePartition`);
      }
    }
  }
}

// 4. Budget Assertions
if (peakDraws > 65) errors.push(`Draw budget exceeded: ${peakDraws} > 65`);
if (peakTris > 65000) errors.push(`Triangle budget exceeded: ${peakTris} > 65000`);
if (uniqueMatUuids.size > 25) errors.push(`Material budget exceeded: ${uniqueMatUuids.size} > 25`);
if (lightCount > 3) errors.push(`Light budget exceeded: ${lightCount} > 3`);

console.log(`=== Pre-Flight Verification: Ibn al-Haytham (Alhazen) ===`);
console.log(`Peak Draws: ${peakDraws}/65 | Peak Tris: ${peakTris}/65000 | Unique Mats: ${uniqueMatUuids.size}/25 (Registry: ${stage.registry.count()}) | Lights: ${lightCount}/3`);
if (errors.length > 0) {
  console.error(`FAILED with ${errors.length} error(s):`);
  for (const e of errors.slice(0, 25)) console.error('  -', e);
  process.exit(1);
}
console.log(`PASSED: 0 errors across ${sampleCount} timestamps!`);
