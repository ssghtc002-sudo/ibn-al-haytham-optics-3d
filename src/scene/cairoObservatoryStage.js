/**
 * 100% Unique 3D Environment & Acting Choreography:
 * Golden Age Fatimid Cairo — Ibn al-Haytham's Candlelit Camera Obscura Observatory (c. 1021 AD)
 * (/home/antigravity/ssghtc002-sudo/ibn-al-haytham-optics-3d/src/scene/cairoObservatoryStage.js)
 */
import * as THREE from 'three';
import {
  MaterialRegistry,
  buildPixarHumanoid,
  createGlowSprite,
  createContactShadowDisc,
  safeMerge,
} from '../engine/baseRig.js';

function makeCanvas(w, h) {
  if (typeof document !== 'undefined') {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    return c;
  }
  return null;
}

function clamp01(v) {
  return Math.max(0, Math.min(1, v));
}

function smoothstep(e0, e1, x) {
  const t = clamp01((x - e0) / (e1 - e0));
  return t * t * (3 - 2 * t);
}

/** Procedural Islamic Octagram Geometric Mosaic Tile Floor (turquoise, lapis, cream & gold) */
function createCairoMosaicTexture() {
  const c = makeCanvas(512, 512);
  if (!c) return null;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#14233C';
  ctx.fillRect(0, 0, 512, 512);

  const cell = 128;
  for (let gx = 0; gx < 4; gx++) {
    for (let gy = 0; gy < 4; gy++) {
      const cx = gx * cell + cell * 0.5;
      const cy = gy * cell + cell * 0.5;

      // Cream stone tile border
      ctx.strokeStyle = '#C9B38C';
      ctx.lineWidth = 4;
      ctx.strokeRect(gx * cell + 3, gy * cell + 3, cell - 6, cell - 6);

      // Turquoise 8-point star (Rub el Hizb octagram)
      ctx.save();
      ctx.translate(cx, cy);
      for (const rot of [0, Math.PI * 0.25]) {
        ctx.save();
        ctx.rotate(rot);
        ctx.fillStyle = rot === 0 ? '#116B6A' : '#19507A';
        ctx.fillRect(-34, -34, 68, 68);
        ctx.strokeStyle = '#E0AF4B';
        ctx.lineWidth = 2.5;
        ctx.strokeRect(-34, -34, 68, 68);
        ctx.restore();
      }
      // Inner golden rosette
      ctx.fillStyle = '#D9A441';
      ctx.beginPath();
      ctx.arc(0, 0, 14, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#0D1B33';
      ctx.beginPath();
      ctx.arc(0, 0, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(5, 5);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

/** Procedural Warm Carved Fatimid Limestone Texture */
function createLimestoneTexture() {
  const c = makeCanvas(256, 256);
  if (!c) return null;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#7C644B';
  ctx.fillRect(0, 0, 256, 256);
  for (let y = 0; y < 256; y += 32) {
    ctx.fillStyle = y % 64 === 0 ? '#745D45' : '#856C51';
    ctx.fillRect(0, y, 256, 30);
    ctx.fillStyle = '#4B3A2A';
    ctx.fillRect(0, y + 30, 256, 2);
    const offset = (y / 32) % 2 === 0 ? 0 : 64;
    for (let x = offset; x < 256; x += 128) {
      ctx.fillRect(x, y, 2, 32);
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(3, 3);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

/** Procedural Starry Nocturnal Cairo Sky + Glowing Crescent Moon (1024x1024 crisp stars!) */
function createCairoNightSkyTexture() {
  const c = makeCanvas(1024, 1024);
  if (!c) return null;
  const ctx = c.getContext('2d');
  const grad = ctx.createLinearGradient(0, 0, 0, 1024);
  grad.addColorStop(0.0, '#040817');
  grad.addColorStop(0.40, '#0C1A3C');
  grad.addColorStop(0.75, '#1B305C');
  grad.addColorStop(1.0, '#3A2E4D');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 1024, 1024);

  // Crisp tiny pinprick stars (deterministic)
  let seed = 1021;
  const rand = () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };
  for (let i = 0; i < 320; i++) {
    const sx = rand() * 1024;
    const sy = rand() * 760;
    const sr = 0.9 + rand() * 1.9;
    ctx.fillStyle = i % 5 === 0 ? 'rgba(255,235,178,0.95)' : 'rgba(220,240,255,0.90)';
    ctx.beginPath();
    ctx.arc(sx, sy, sr, 0, Math.PI * 2);
    ctx.fill();
  }

  // Luminous Golden Crescent Moon (aspect-corrected for 18x12 plane, pure crescent cutout with zero dark oval!)
  const mx = 576;
  const my = 486;
  const glow = ctx.createRadialGradient(0, 0, 10, 0, 0, 105);
  glow.addColorStop(0, 'rgba(255,240,185,0.52)');
  glow.addColorStop(0.45, 'rgba(130,185,255,0.16)');
  glow.addColorStop(1, 'rgba(12,26,60,0)');
  ctx.save();
  ctx.translate(mx, my);
  ctx.scale(12 / 18, 1.0);
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(0, 0, 105, 0, Math.PI * 2);
  ctx.fill();

  const mc = makeCanvas(128, 128);
  if (mc) {
    const mctx = mc.getContext('2d');
    mctx.fillStyle = '#FFF5C8';
    mctx.beginPath();
    mctx.arc(64, 64, 34, 0, Math.PI * 2);
    mctx.fill();
    mctx.globalCompositeOperation = 'destination-out';
    mctx.beginPath();
    mctx.arc(49, 58, 29, 0, Math.PI * 2);
    mctx.fill();
    ctx.drawImage(mc, -64, -64);
  }
  ctx.restore();

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

/** Procedural Luminous Parchment Projection Screen with CRISP UPSIDE-DOWN INVERTED CANDLE FLAME */
function createInvertedFlameScreenTexture() {
  const c = makeCanvas(256, 384);
  if (!c) return null;
  const ctx = c.getContext('2d');

  // Warm parchment background with dark vignette so glowing inverted flame pops!
  const bg = ctx.createRadialGradient(128, 192, 16, 128, 192, 190);
  bg.addColorStop(0.0, '#4A3620');
  bg.addColorStop(0.55, '#2A1D12');
  bg.addColorStop(1.0, '#140E09');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, 256, 384);

  // Thin gold geometric border
  ctx.strokeStyle = '#E6B44C';
  ctx.lineWidth = 8;
  ctx.strokeRect(10, 10, 236, 364);

  // Radiant halo around the UPSIDE-DOWN flame!
  const halo = ctx.createRadialGradient(128, 224, 6, 128, 224, 108);
  halo.addColorStop(0.0, 'rgba(255,245,190,0.95)');
  halo.addColorStop(0.35, 'rgba(255,165,45,0.62)');
  halo.addColorStop(0.75, 'rgba(56,189,248,0.22)');
  halo.addColorStop(1.0, 'rgba(20,14,9,0)');
  ctx.fillStyle = halo;
  ctx.fillRect(0, 90, 256, 260);

  // Inverted candle stick (at TOP of screen, hanging upside down!)
  ctx.fillStyle = '#EFE3C8';
  ctx.fillRect(108, 42, 40, 106);
  ctx.fillStyle = '#B8893B';
  ctx.fillRect(92, 34, 72, 16);

  // Dark wick pointing DOWNWARD
  ctx.fillStyle = '#1E1510';
  ctx.fillRect(125, 148, 6, 18);

  // Crisp UPSIDE-DOWN teardrop flame pointing straight DOWN!
  ctx.beginPath();
  ctx.moveTo(128, 308); // flame tip pointing DOWN!
  ctx.bezierCurveTo(72, 238, 78, 174, 128, 160);
  ctx.bezierCurveTo(178, 174, 184, 238, 128, 308);
  ctx.closePath();
  const fg = ctx.createLinearGradient(128, 160, 128, 308);
  fg.addColorStop(0.0, '#38BDF8');
  fg.addColorStop(0.28, '#FFF9D6');
  fg.addColorStop(0.70, '#FFB72B');
  fg.addColorStop(1.0, '#FF5E1A');
  ctx.fillStyle = fg;
  ctx.fill();

  // Inner bright white core (inverted)
  ctx.beginPath();
  ctx.moveTo(128, 268);
  ctx.bezierCurveTo(104, 228, 106, 188, 128, 176);
  ctx.bezierCurveTo(150, 188, 152, 228, 128, 268);
  ctx.closePath();
  ctx.fillStyle = '#FFFFFF';
  ctx.fill();

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

/** Helper to orient a thin cylinder ray segment from point A to point B */
function createRaySegmentMesh(pA, pB, radius, mat) {
  const dir = new THREE.Vector3().subVectors(pB, pA);
  const len = dir.length();
  const geo = new THREE.CylinderGeometry(radius, radius, len, 10, 1, false);
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.copy(pA).addScaledVector(dir, 0.5);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
  return mesh;
}

export function buildCairoObservatoryStage(scene, timeline) {
  const registry = new MaterialRegistry();

  // =========================================================================
  // 1. SHARED SCENE MATERIALS (Strictly <= 25 unique materials total!)
  // =========================================================================
  const mosaicTex = createCairoMosaicTexture();
  const limestoneTex = createLimestoneTexture();
  const skyTex = createCairoNightSkyTexture();
  const screenTex = createInvertedFlameScreenTexture();

  const floorMat = registry.getStandard('cairo_mosaic_floor', {
    map: mosaicTex,
    color: '#FFFFFF',
    roughness: 0.44,
    metalness: 0.14,
  });

  const stoneMat = registry.getStandard('cairo_limestone_arch', {
    map: limestoneTex,
    color: '#DEC4A2',
    roughness: 0.80,
    metalness: 0.05,
  });

  const lapisMat = registry.getStandard('lapis_accent_tile', {
    color: '#1A457A',
    roughness: 0.36,
    metalness: 0.22,
  });

  const brassMat = registry.getStandard('accent_#E6B44C', {
    color: '#E6B44C',
    roughness: 0.28,
    metalness: 0.68,
  });

  const walnutMat = registry.getStandard('shoe_#46291A', {
    color: '#46291A',
    roughness: 0.38,
    metalness: 0.08,
  });

  const darkCedarMat = registry.getStandard('hair_#1E1816', {
    color: '#1E1816',
    roughness: 0.62,
    metalness: 0.04,
  });

  const parchmentMat = registry.getStandard('turban_#F3EAD8', {
    color: '#F3EAD8',
    roughness: 0.68,
    metalness: 0.03,
  });

  const skyMat = registry.getBasic('cairo_night_sky', {
    map: skyTex,
    color: '#FFFFFF',
  });

  const flameMat = registry.getStandard('flame_gold_emissive', {
    color: '#FFD166',
    emissive: '#FF9820',
    emissiveIntensity: 1.85,
    roughness: 0.18,
    metalness: 0.0,
  });

  const cyanOpticsMat = registry.getStandard('cyan_optics_emissive', {
    color: '#38BDF8',
    emissive: '#38BDF8',
    emissiveIntensity: 1.75,
    roughness: 0.15,
    metalness: 0.10,
  });

  const laserMagentaMat = registry.getStandard('laser_magenta_emissive', {
    color: '#FF4FD8',
    emissive: '#F72585',
    emissiveIntensity: 2.35,
    roughness: 0.12,
    metalness: 0.0,
  });

  const projectionScreenMat = registry.getStandard('parchment_projection', {
    map: screenTex,
    emissiveMap: screenTex,
    color: '#FFFFFF',
    emissive: '#FFE4B5',
    emissiveIntensity: 0.15,
    roughness: 0.55,
    metalness: 0.02,
    side: THREE.DoubleSide,
  });

  const phoneBodyMat = registry.getStandard('trouser_#1B2436', {
    color: '#1B2436',
    roughness: 0.25,
    metalness: 0.55,
  });

  // =========================================================================
  // 2. STATIC CAIRO GOLDEN AGE OBSERVATORY ARCHITECTURE (Merged into 4 meshes!)
  // =========================================================================
  // 2a. Geometric Mosaic Floor
  const floorGeo = new THREE.PlaneGeometry(18, 18);
  floorGeo.rotateX(-Math.PI * 0.5);
  const floorMesh = new THREE.Mesh(floorGeo, floorMat);
  floorMesh.receiveShadow = true;
  scene.add(floorMesh);

  // 2b. Starry Nocturnal Cairo Sky + Crescent Moon Backdrop
  const skyGeo = new THREE.PlaneGeometry(18, 12);
  const skyMesh = new THREE.Mesh(skyGeo, skyMat);
  skyMesh.position.set(0, 4.4, -8.5);
  scene.add(skyMesh);

  // 2c. Carved Fatimid Horseshoe Archway, Fluted Columns, Balcony & Distant Al-Azhar Minaret
  const stoneParts = [];
  // Side observatory piers framing the central arch
  for (const sx of [-1, 1]) {
    const pier = new THREE.BoxGeometry(2.8, 5.2, 0.72);
    pier.translate(sx * 2.95, 2.6, -2.55);
    stoneParts.push(pier);

    // Fluted Islamic column with muqarnas-style stepped capital
    const colShaft = new THREE.CylinderGeometry(0.18, 0.20, 3.05, 14);
    colShaft.translate(sx * 1.56, 1.525, -2.35);
    stoneParts.push(colShaft);

    const colBase = new THREE.BoxGeometry(0.48, 0.24, 0.48);
    colBase.translate(sx * 1.56, 0.12, -2.35);
    stoneParts.push(colBase);

    const colCap = new THREE.CylinderGeometry(0.28, 0.18, 0.28, 8);
    colCap.translate(sx * 1.56, 3.16, -2.35);
    stoneParts.push(colCap);

    // Side wall alcoves
    const sideWall = new THREE.BoxGeometry(0.55, 5.2, 6.2);
    sideWall.translate(sx * 4.2, 2.6, 0.4);
    stoneParts.push(sideWall);
  }

  // Top lintel above archway
  const topWall = new THREE.BoxGeometry(8.8, 1.65, 0.72);
  topWall.translate(0, 5.25, -2.55);
  stoneParts.push(topWall);

  // Sculpted Pointed Horseshoe Arch Ring (16 carved voussoir stones!)
  for (let i = 0; i < 15; i++) {
    const a = -0.25 + (i / 14) * (Math.PI + 0.50);
    const rx = Math.cos(a) * 1.56;
    const ry = 3.10 + Math.sin(a) * 1.38 + (i === 7 ? 0.12 : 0);
    const block = new THREE.BoxGeometry(0.36, 0.28, 0.68);
    block.rotateZ(a - Math.PI * 0.5);
    block.translate(rx, ry, -2.42);
    stoneParts.push(block);
  }

  // Low carved stone balcony balustrade behind bench
  const rail = new THREE.BoxGeometry(3.2, 0.14, 0.28);
  rail.translate(0, 0.86, -2.42);
  stoneParts.push(rail);
  for (let i = -5; i <= 5; i++) {
    const post = new THREE.CylinderGeometry(0.045, 0.055, 0.80, 8);
    post.translate(i * 0.28, 0.42, -2.42);
    stoneParts.push(post);
  }

  // Distant Cairo Al-Azhar Minaret & Dome Silhouette visible through the arch!
  const minaretBase = new THREE.BoxGeometry(0.92, 2.8, 0.92);
  minaretBase.translate(-0.78, 1.4, -7.2);
  stoneParts.push(minaretBase);

  const minaretShaft = new THREE.CylinderGeometry(0.32, 0.42, 2.6, 10);
  minaretShaft.translate(-0.78, 3.8, -7.2);
  stoneParts.push(minaretShaft);

  const minaretBalcony = new THREE.CylinderGeometry(0.48, 0.36, 0.20, 10);
  minaretBalcony.translate(-0.78, 4.45, -7.2);
  stoneParts.push(minaretBalcony);

  const minaretDome = new THREE.SphereGeometry(0.30, 12, 10);
  minaretDome.scale(1.0, 1.35, 1.0);
  minaretDome.translate(-0.78, 5.22, -7.2);
  stoneParts.push(minaretDome);

  // Secondary distant Cairo dome
  const distantDome = new THREE.SphereGeometry(0.95, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.55);
  distantDome.scale(1.0, 1.15, 1.0);
  distantDome.translate(0.75, 1.9, -7.4);
  stoneParts.push(distantDome);

  const distantWall = new THREE.BoxGeometry(2.2, 2.0, 1.2);
  distantWall.translate(0.75, 1.0, -7.4);
  stoneParts.push(distantWall);

  const cairoArchMesh = new THREE.Mesh(safeMerge(stoneParts), stoneMat);
  cairoArchMesh.receiveShadow = true;
  scene.add(cairoArchMesh);

  // 2d. Decorative Lapis Lazuli Arch Inlays + Mashrabiya Panels + Book of Optics Cover
  const lapisParts = [];
  for (const sx of [-1, 1]) {
    const panel = new THREE.BoxGeometry(0.95, 2.2, 0.08);
    panel.translate(sx * 2.38, 2.15, -2.16);
    lapisParts.push(panel);
  }
  const archFrieze = new THREE.BoxGeometry(5.6, 0.24, 0.10);
  archFrieze.translate(0, 4.68, -2.16);
  lapisParts.push(archFrieze);

  // Open *Kitab al-Manazir* (Book of Optics) cover resting neatly on front-left of bench
  const bookCover = new THREE.BoxGeometry(0.30, 0.024, 0.22);
  bookCover.rotateY(0.18);
  bookCover.translate(-0.52, 0.852, -0.14);
  lapisParts.push(bookCover);

  scene.add(new THREE.Mesh(safeMerge(lapisParts), lapisMat));

  // =========================================================================
  // 3. HERO OPTICS WORKBENCH & CAMERA OBSCURA APPARATUS
  // =========================================================================
  const benchY = timeline.world.benchTopY; // 0.84
  const benchZ = timeline.world.benchPos[2]; // -0.35

  // 3a. Inlaid Walnut Optics Bench (merged static wood)
  const benchParts = [];
  const tableTop = new THREE.BoxGeometry(1.40, 0.08, 0.54);
  tableTop.translate(0, benchY - 0.04, benchZ);
  benchParts.push(tableTop);

  for (const sx of [-0.60, 0.60]) {
    for (const sz of [-0.20, 0.20]) {
      const leg = new THREE.BoxGeometry(0.085, benchY - 0.08, 0.085);
      leg.translate(sx, (benchY - 0.08) * 0.5, benchZ + sz);
      benchParts.push(leg);
    }
  }
  const stretcher = new THREE.BoxGeometry(1.22, 0.06, 0.08);
  stretcher.translate(0, 0.24, benchZ);
  benchParts.push(stretcher);

  const benchMesh = new THREE.Mesh(safeMerge(benchParts), walnutMat);
  benchMesh.castShadow = true;
  benchMesh.receiveShadow = true;
  scene.add(benchMesh);

  // Contact shadow under bench
  const benchShadow = createContactShadowDisc(1.05, 0.72, registry.contactShadowMat);
  benchShadow.scale.set(1.05, 1.0, 0.55);
  benchShadow.position.set(0, 0.004, benchZ);
  scene.add(benchShadow);

  // 3b. Darkened Cedar Camera Obscura Pinhole Partition (with real circular pinhole aperture!)
  const partW = 0.055;
  const partH = 0.66;
  const partD = 0.44;
  const pinholeY = timeline.world.pinholePos[1]; // 1.18
  const partitionParts = [];
  // Build thick frame around pinhole so light rays visibly pass RIGHT THROUGH the open hole!
  const botWall = new THREE.BoxGeometry(partW, 0.28, partD);
  botWall.translate(0, benchY + 0.14, benchZ);
  partitionParts.push(botWall);

  const topPartWall = new THREE.BoxGeometry(partW, 0.24, partD);
  topPartWall.translate(0, benchY + 0.54, benchZ);
  partitionParts.push(topPartWall);

  const frontPillar = new THREE.BoxGeometry(partW, 0.16, 0.16);
  frontPillar.translate(0, pinholeY, benchZ + 0.14);
  partitionParts.push(frontPillar);

  const backPillar = new THREE.BoxGeometry(partW, 0.16, 0.16);
  backPillar.translate(0, pinholeY, benchZ - 0.14);
  partitionParts.push(backPillar);

  const partitionMesh = new THREE.Mesh(safeMerge(partitionParts), darkCedarMat);
  partitionMesh.castShadow = true;
  scene.add(partitionMesh);

  // Animated Brass-Trimmed Darkroom Shutter Slide (slides over/off the pinhole in Beat 2 -> Beat 3!)
  const shutterMesh = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.22, 0.18), walnutMat);
  shutterMesh.position.set(0.038, pinholeY, benchZ);
  scene.add(shutterMesh);

  // 3c. Gleaming Brass Hardware (Candelabra + Pinhole Bezel + Screen Frame + Hanging Cairo Lanterns!)
  const brassParts = [];
  // Pinhole Brass Aperture Ring (centered cleanly at (0, 1.18, -0.35), oriented along X axis!)
  const pinholeBezel = new THREE.TorusGeometry(0.052, 0.014, 10, 22);
  pinholeBezel.rotateY(Math.PI * 0.5);
  pinholeBezel.translate(0, pinholeY, benchZ);
  brassParts.push(pinholeBezel);

  // Ornate 3-Candle Brass Candelabra on left of bench (x = -0.56)
  const candX = timeline.world.candlePos[0]; // -0.56
  const candBase = new THREE.CylinderGeometry(0.05, 0.11, 0.05, 14);
  candBase.translate(candX, benchY + 0.025, benchZ);
  brassParts.push(candBase);
  const candStem = new THREE.CylinderGeometry(0.022, 0.032, 0.16, 12);
  candStem.translate(candX, benchY + 0.12, benchZ);
  brassParts.push(candStem);
  const candCup = new THREE.CylinderGeometry(0.055, 0.028, 0.035, 14);
  candCup.translate(candX, benchY + 0.20, benchZ);
  brassParts.push(candCup);

  // Projection screen world X reference (brass frame mounted cleanly inside screenPivot below!)
  const scrX = timeline.world.screenPos[0];

  // Two Hanging Cairo Brass Pierced Lanterns flanking the archway!
  for (const sx of [-1.25, 1.25]) {
    const chain = new THREE.CylinderGeometry(0.008, 0.008, 1.0, 6);
    chain.translate(sx, 3.35, -2.05);
    brassParts.push(chain);
    const lanternCap = new THREE.ConeGeometry(0.14, 0.16, 8);
    lanternCap.translate(sx, 2.82, -2.05);
    brassParts.push(lanternCap);
    const lanternBase = new THREE.ConeGeometry(0.12, 0.14, 8);
    lanternBase.rotateX(Math.PI);
    lanternBase.translate(sx, 2.48, -2.05);
    brassParts.push(lanternBase);
  }
  // Distant Minaret Golden Crescent Finial
  const finial = new THREE.CylinderGeometry(0.015, 0.025, 0.42, 6);
  finial.translate(-0.78, 5.75, -7.2);
  brassParts.push(finial);

  scene.add(new THREE.Mesh(safeMerge(brassParts), brassMat));

  // 3d. Ivory Wax Candle + Book of Optics Open Parchment Pages (merged using parchmentMat)
  const waxParts = [];
  const candleWax = new THREE.CylinderGeometry(0.034, 0.038, 0.15, 14);
  candleWax.translate(candX, benchY + 0.285, benchZ);
  waxParts.push(candleWax);

  const bookPages = new THREE.BoxGeometry(0.27, 0.018, 0.19);
  bookPages.rotateY(0.18);
  bookPages.translate(-0.52, 0.870, -0.14);
  waxParts.push(bookPages);
  scene.add(new THREE.Mesh(safeMerge(waxParts), parchmentMat));

  // 3e. Glowing Candle Flame + Hanging Lantern Cores (animated flame pulse!)
  const flameGroup = new THREE.Group();
  flameGroup.position.set(candX, benchY + 0.365, benchZ);
  const flameProfile = [
    new THREE.Vector2(0.001, 0.0),
    new THREE.Vector2(0.032, 0.025),
    new THREE.Vector2(0.038, 0.062),
    new THREE.Vector2(0.022, 0.112),
    new THREE.Vector2(0.001, 0.148),
  ];
  const flameMesh = new THREE.Mesh(new THREE.LatheGeometry(flameProfile, 14), flameMat);
  flameGroup.add(flameMesh);
  scene.add(flameGroup);

  // Soft Additive Candle Glow Halo Sprite (single shared sprite material!)
  const candleHalo = createGlowSprite('#FFBE55', 0.52, 0.82);
  candleHalo.position.set(candX, benchY + 0.43, benchZ);
  scene.add(candleHalo);

  // Lantern glowing cores merged into 1 mesh using flameMat
  const lanternCores = [];
  for (const sx of [-1.25, 1.25]) {
    const core = new THREE.CylinderGeometry(0.095, 0.085, 0.22, 8);
    core.translate(sx, 2.65, -2.05);
    lanternCores.push(core);
  }
  const lanternCoresMesh = new THREE.Mesh(safeMerge(lanternCores), flameMat);
  scene.add(lanternCoresMesh);

  // 3f. Luminous Parchment Projection Screen + Aligned Brass Frame (100% unobstructed view of UPSIDE-DOWN FLAME!)
  const screenPivot = new THREE.Group();
  screenPivot.position.set(scrX, benchY + 0.34, benchZ);
  screenPivot.rotation.y = -Math.PI * 0.5 + 0.82; // angled cleanly toward camera & pinhole!
  const screenMesh = new THREE.Mesh(new THREE.PlaneGeometry(0.36, 0.56), projectionScreenMat);
  screenPivot.add(screenMesh);

  const scrFrameParts = [];
  const fBase = new THREE.BoxGeometry(0.42, 0.04, 0.07);
  fBase.translate(0, -0.32, 0);
  scrFrameParts.push(fBase);
  const fTop = new THREE.BoxGeometry(0.42, 0.03, 0.045);
  fTop.translate(0, 0.30, 0);
  scrFrameParts.push(fTop);
  for (const fx of [-0.195, 0.195]) {
    const fPost = new THREE.CylinderGeometry(0.015, 0.017, 0.62, 10);
    fPost.translate(fx, -0.01, 0);
    scrFrameParts.push(fPost);
  }
  screenPivot.add(new THREE.Mesh(safeMerge(scrFrameParts), brassMat));
  scene.add(screenPivot);

  // =========================================================================
  // 4. VOLUMETRIC CROSSING LIGHT RAYS (X-Crossing through Pinhole!)
  // =========================================================================
  const raysGroup = new THREE.Group();
  raysGroup.visible = false;
  scene.add(raysGroup);

  const pFlameTop = new THREE.Vector3(candX + 0.02, benchY + 0.49, benchZ);
  const pFlameBot = new THREE.Vector3(candX + 0.02, benchY + 0.36, benchZ);
  const pPinhole = new THREE.Vector3(0.0, pinholeY, benchZ);
  const pScreenBot = new THREE.Vector3(scrX - 0.02, benchY + 0.22, benchZ);
  const pScreenTop = new THREE.Vector3(scrX - 0.02, benchY + 0.48, benchZ);

  // Top amber ray: flame tip -> pinhole -> BOTTOM of projection screen (demonstrating inversion!)
  const rayTopPre = createRaySegmentMesh(pFlameTop, pPinhole, 0.011, flameMat);
  const rayTopPost = createRaySegmentMesh(pPinhole, pScreenBot, 0.011, flameMat);
  raysGroup.add(rayTopPre, rayTopPost);

  // Bottom cyan ray: flame base -> pinhole -> TOP of projection screen (crisp contrasting X!)
  const rayBotPre = createRaySegmentMesh(pFlameBot, pPinhole, 0.011, cyanOpticsMat);
  const rayBotPost = createRaySegmentMesh(pPinhole, pScreenTop, 0.011, cyanOpticsMat);
  raysGroup.add(rayBotPre, rayBotPost);

  // Instanced Photon Beads streaming along both crossing light paths (32 photons, 1 draw call!)
  const PHOTON_COUNT = 32;
  const photonInst = new THREE.InstancedMesh(new THREE.SphereGeometry(0.016, 8, 6), flameMat, PHOTON_COUNT);
  photonInst.frustumCulled = false;
  raysGroup.add(photonInst);

  // =========================================================================
  // 5. BEAT 1 COMEDIC PROP: NEON-MAGENTA "EYE-LASER BEAMS"
  // =========================================================================
  const eyeLaserGroup = new THREE.Group();
  eyeLaserGroup.visible = false;
  const laserParts = [];
  for (const s of [-1, 1]) {
    const beam = new THREE.CylinderGeometry(0.014, 0.024, 1.15, 10);
    beam.rotateX(Math.PI * 0.5);
    beam.translate(s * 0.064, 0.0, 0.62);
    laserParts.push(beam);
  }
  const laserMesh = new THREE.Mesh(safeMerge(laserParts), laserMagentaMat);
  eyeLaserGroup.add(laserMesh);

  // =========================================================================
  // 6. BEATS 5-6 LEGACY HOLOGRAM: MODERN SMARTPHONE CAMERA & APERTURE IRIS
  // =========================================================================
  const holoGroup = new THREE.Group();
  holoGroup.position.set(0.0, 2.02, benchZ + 0.05);
  holoGroup.visible = false;
  scene.add(holoGroup);

  // Sleek Modern Smartphone Body + Raised Triple-Lens Camera Island
  const phoneSlab = new THREE.BoxGeometry(0.42, 0.78, 0.044);
  const camBump = new THREE.BoxGeometry(0.20, 0.21, 0.030);
  camBump.translate(-0.08, 0.24, 0.032);
  const phoneMesh = new THREE.Mesh(safeMerge([phoneSlab, camBump]), lapisMat);
  holoGroup.add(phoneMesh);

  // Glowing Cyan Holographic Perimeter Frame + Triple-Lens Modules + Central Aperture Iris!
  const holoRings = [];
  const edgeT = new THREE.BoxGeometry(0.44, 0.018, 0.052);
  edgeT.translate(0, 0.39, 0);
  const edgeB = new THREE.BoxGeometry(0.44, 0.018, 0.052);
  edgeB.translate(0, -0.39, 0);
  const edgeL = new THREE.BoxGeometry(0.018, 0.78, 0.052);
  edgeL.translate(-0.21, 0, 0);
  const edgeR = new THREE.BoxGeometry(0.018, 0.78, 0.052);
  edgeR.translate(0.21, 0, 0);
  holoRings.push(edgeT, edgeB, edgeL, edgeR);

  // Central holographic optical aperture rings + viewfinder ticks
  const mainLens = new THREE.TorusGeometry(0.115, 0.015, 10, 24);
  mainLens.translate(0.0, -0.06, 0.038);
  holoRings.push(mainLens);

  const innerDot = new THREE.TorusGeometry(0.048, 0.010, 8, 18);
  innerDot.translate(0.0, -0.06, 0.042);
  holoRings.push(innerDot);

  const outerIris = new THREE.TorusGeometry(0.44, 0.012, 10, 36);
  outerIris.translate(0.0, 0.02, 0.046);
  holoRings.push(outerIris);

  // 3 crisp triple-lens modules inside top-left camera island
  for (const [lx, ly] of [[-0.13, 0.29], [-0.03, 0.29], [-0.13, 0.19]]) {
    const l = new THREE.TorusGeometry(0.030, 0.0085, 8, 16);
    l.translate(lx, ly, 0.052);
    holoRings.push(l);
  }
  const holoLensMesh = new THREE.Mesh(safeMerge(holoRings), cyanOpticsMat);
  holoGroup.add(holoLensMesh);

  // =========================================================================
  // 7. 100% UNIQUE CAST: IBN AL-HAYTHAM & ELDER PTOLEMY THEORIST
  // =========================================================================
  const alhazen = buildPixarHumanoid(
    {
      id: 'alhazen',
      outfitStyle: 'scholar_jubbah',
      beardStyle: 'pointed_scholar',
      headgear: 'fatimid_turban',
      skinColor: '#C68E64',
      suitColor: '#0F5C58', // Deep Fatimid Emerald-Teal Jubbah
      accentColor: '#E6B44C', // Hammered Gold Trim
      turbanColor: '#F3EAD8', // Ivory Silk Multi-Wrap Turban
      trouserColor: '#1B2436',
      shoeColor: '#46291A',
      hairColor: '#1E1816',
      irisColor: '#2E1C11',
      hasMustache: true,
      hasMonocle: false,
      longSleeves: true,
      torsoWidth: 1.04,
      castShadow: true,
    },
    registry
  );
  alhazen.root.position.set(...timeline.world.alhazenPos);
  alhazen.groundFeet(0);
  scene.add(alhazen.root);

  // Handheld Prop for Ibn al-Haytham: Brass Magnifying Optics Lens!
  const lensRim = new THREE.TorusGeometry(0.068, 0.012, 8, 18);
  lensRim.translate(0, -0.14, 0);
  const lensHandle = new THREE.CylinderGeometry(0.013, 0.015, 0.11, 8);
  lensHandle.translate(0, -0.02, 0);
  const opticsLensProp = new THREE.Mesh(safeMerge([lensRim, lensHandle]), brassMat);
  alhazen.armR.propMount.add(opticsLensProp);

  const rival = buildPixarHumanoid(
    {
      id: 'rival',
      outfitStyle: 'philosopher_mantle',
      beardStyle: 'round_elder',
      headgear: 'elder_tufts',
      skinColor: '#D4A27E',
      suitColor: '#7C2332', // Crimson-Burgundy Philosopher Robe
      accentColor: '#E6B44C',
      turbanColor: '#F3EAD8',
      trouserColor: '#1B2436',
      shoeColor: '#46291A',
      hairColor: '#C8CDD6', // Silver-Gray Elder Tufts & Bushy Brows
      irisColor: '#2E1C11',
      hasMustache: true,
      hasMonocle: true,
      longSleeves: false,
      torsoWidth: 1.12,
      castShadow: true,
    },
    registry
  );
  rival.root.scale.setScalar(0.94);
  rival.root.position.set(...timeline.world.rivalPos);
  rival.groundFeet(0);
  scene.add(rival.root);

  // Attach Eye-Laser Emitter Group right to Rival's head eyes!
  eyeLaserGroup.position.set(0, 0.242, 0.175);
  rival.headGroup.add(eyeLaserGroup);

  // Handheld Prop for Rival: Rolled Ancient Emission-Theory Scroll!
  const scrollGeo = new THREE.CylinderGeometry(0.028, 0.028, 0.24, 12);
  scrollGeo.translate(0, -0.04, 0);
  const scrollProp = new THREE.Mesh(scrollGeo, parchmentMat);
  rival.armL.propMount.add(scrollProp);

  // =========================================================================
  // 8. 3-LIGHT COMPILED CAP (Hemi + Warm Shadow Key + Nocturnal Indigo-Cyan Rim)
  // =========================================================================
  const hemiLight = new THREE.HemisphereLight('#92B8F8', '#523C2A', 0.78);
  scene.add(hemiLight);

  const keyLight = new THREE.DirectionalLight('#FFD9A0', 1.65);
  keyLight.position.set(-2.4, 4.4, 3.2);
  keyLight.castShadow = true;
  keyLight.shadow.mapSize.set(1024, 1024);
  keyLight.shadow.camera.near = 0.5;
  keyLight.shadow.camera.far = 14;
  keyLight.shadow.camera.left = -3.4;
  keyLight.shadow.camera.right = 3.4;
  keyLight.shadow.camera.top = 3.8;
  keyLight.shadow.camera.bottom = -1.2;
  keyLight.shadow.bias = -0.0006;
  scene.add(keyLight);

  const rimLight = new THREE.DirectionalLight('#55B7FF', 1.45);
  rimLight.position.set(2.6, 2.8, -3.2);
  scene.add(rimLight);

  scene.fog = new THREE.FogExp2('#0D152C', 0.042);

  // Reusable matrix helper for photon beads
  const _m = new THREE.Matrix4();
  const _p = new THREE.Vector3();
  const _q = new THREE.Quaternion();
  const _s = new THREE.Vector3();

  // =========================================================================
  // 9. PER-FRAME 6-BEAT PIXAR ANIMATION & PHYSICS UPDATE(t, manifest)
  // =========================================================================
  function update(t, voiceManifest = null) {
    const frameIdx = Math.max(0, Math.min(899, Math.round(t * 30)));
    const alhazenLip = voiceManifest?.lipSync?.alhazen?.[frameIdx] || 0;
    const rivalLip = voiceManifest?.lipSync?.rival?.[frameIdx] || 0;

    // Interpolate Beat Lighting & Atmospheric Fog smoothly
    const beats = timeline.beats;
    let activeBeat = beats[0];
    for (const b of beats) {
      if (t >= b.start && t <= b.end) {
        activeBeat = b;
        break;
      }
    }
    const targetFogColor = new THREE.Color(activeBeat.fog.color);
    scene.fog.color.copy(targetFogColor);
    scene.fog.density = activeBeat.fog.density;
    keyLight.intensity = activeBeat.lighting.keyIntensity;
    hemiLight.intensity = activeBeat.lighting.hemiIntensity;
    rimLight.intensity = activeBeat.lighting.rimIntensity;

    // Candle Flame Flicker (lit at Beat 3 t = 10.05s, tiny warm glow in Beat 1, dark in Beat 2!)
    const candleOn = t < 4.75 ? 0.55 : t < 10.0 ? 0.0 : smoothstep(10.0, 10.55, t);
    const flicker = 1.0 + Math.sin(t * 19.0) * 0.09 + Math.cos(t * 31.0) * 0.05;
    flameGroup.visible = candleOn > 0.02;
    candleHalo.visible = candleOn > 0.02;
    if (flameGroup.visible) {
      flameGroup.scale.set(candleOn * (0.94 + Math.sin(t * 17) * 0.06), candleOn * flicker, candleOn);
      candleHalo.material.opacity = 0.80 * candleOn * (0.92 + Math.sin(t * 23) * 0.08);
      candleHalo.scale.setScalar(0.46 + 0.12 * candleOn * flicker);
    }

    // Lantern glow dims dramatically during Beat 2 Total Darkness!
    const darkRoomDip = t >= 4.70 && t < 10.0 ? 0.18 : 1.0;
    lanternCoresMesh.visible = darkRoomDip > 0.25;

    // Darkroom Shutter Animation (closed in Beat 2 4.75..11.25s, slides cleanly UP open in Beat 3 at 11.25s!)
    const shutterClosed = smoothstep(4.65, 4.95, t) * (1.0 - smoothstep(11.15, 11.65, t));
    shutterMesh.position.y = pinholeY + (1.0 - shutterClosed) * 0.24;

    // Crossing Volumetric Light Rays (emerge at t = 11.8s -> bloom through Beat 6!)
    const rayProgress = smoothstep(11.75, 13.85, t);
    raysGroup.visible = rayProgress > 0.02;
    if (raysGroup.visible) {
      const preProg = clamp01(rayProgress * 2.0);
      const postProg = clamp01((rayProgress - 0.45) * 2.0);
      rayTopPre.scale.set(1, Math.max(0.01, preProg), 1);
      rayBotPre.scale.set(1, Math.max(0.01, preProg), 1);
      rayTopPost.visible = postProg > 0.02;
      rayBotPost.visible = postProg > 0.02;
      rayTopPost.scale.set(1, Math.max(0.01, postProg), 1);
      rayBotPost.scale.set(1, Math.max(0.01, postProg), 1);

      // Animate 32 golden photon beads streaming straight along both crossing rays!
      for (let i = 0; i < PHOTON_COUNT; i++) {
        const isTop = i % 2 === 0;
        const u = ((t * 0.68 + i / PHOTON_COUNT) % 1.0) * rayProgress;
        if (u <= 0.5) {
          const s = u * 2.0;
          _p.lerpVectors(isTop ? pFlameTop : pFlameBot, pPinhole, s);
        } else {
          const s = (u - 0.5) * 2.0;
          _p.lerpVectors(pPinhole, isTop ? pScreenBot : pScreenTop, s);
        }
        const rad = 0.75 + 0.35 * Math.sin(t * 14 + i);
        _s.set(rad, rad, rad);
        _m.compose(_p, _q, _s);
        photonInst.setMatrixAt(i, _m);
      }
      photonInst.instanceMatrix.needsUpdate = true;
    }

    // Projection Screen Upside-Down Flame Reveal (stays dark blank parchment until crossing rays hit at t = 13.3s!)
    const screenGlow = smoothstep(13.3, 14.5, t);
    projectionScreenMat.color.setRGB(
      0.06 + 0.94 * screenGlow,
      0.05 + 0.95 * screenGlow,
      0.04 + 0.96 * screenGlow
    );
    projectionScreenMat.emissiveIntensity = screenGlow * 1.65;

    // Beat 1 Comedic Eye-Lasers (active 0.0..4.85s, sputters & dies 4.85..5.40s!)
    const laserActive = t < 5.35;
    eyeLaserGroup.visible = laserActive;
    if (laserActive) {
      const zapPulse = 0.82 + 0.32 * Math.sin(t * 36.0);
      const sputter = t > 4.80 ? Math.max(0.0, 1.0 - (t - 4.80) / 0.55) * (Math.sin(t * 62.0) > -0.2 ? 1 : 0.15) : 1.0;
      eyeLaserGroup.scale.set(zapPulse * sputter, zapPulse * sputter, Math.max(0.05, sputter));
    }

    // Beats 5-6 Modern Smartphone Camera Hologram (rises at t = 21.0s, spins gently!)
    const holoReveal = smoothstep(20.9, 22.4, t);
    holoGroup.visible = holoReveal > 0.01;
    if (holoGroup.visible) {
      holoGroup.scale.setScalar(holoReveal * (0.94 + 0.04 * Math.sin(t * 3.2)));
      holoGroup.position.y = 1.82 + holoReveal * 0.24 + Math.sin(t * 2.4) * 0.03;
      holoGroup.rotation.y = Math.sin(t * 1.15) * 0.34;
    }

    // =========================================================================
    // CHARACTER CHOREOGRAPHY (6-Beat Pixar Acting, Strict Grounding & Margin Safety)
    // =========================================================================
    alhazen.resetPose();
    rival.resetPose();

    const breathA = Math.sin(t * 2.5) * 0.012;
    const breathR = Math.sin(t * 2.8 + 1.2) * 0.012;
    alhazen.chestGroup.position.y = 0.06 + breathA;
    rival.chestGroup.position.y = 0.06 + breathR;

    // Default clean floor positions (read from timeline.world contract)
    alhazen.root.position.set(...timeline.world.alhazenPos);
    rival.root.position.set(...timeline.world.rivalPos);
    alhazen.root.rotation.y = 0.34;
    rival.root.rotation.y = -0.36;
    opticsLensProp.visible = true;
    scrollProp.visible = true;

    let emoA = activeBeat.emotions.alhazen;
    let emoR = activeBeat.emotions.rival;

    if (t < 4.5) {
      // BEAT 1: Rival confidently fires ridiculous "Eye Lasers" while Ibn al-Haytham watches amused!
      rival.root.rotation.y = -0.52;
      rival.chestGroup.rotation.x = 0.08;
      rival.headGroup.rotation.y = -0.08 + Math.sin(t * 2.4) * 0.14;
      // Rival points dramatically toward the bench with inner arm (armL), outer arm on hip
      rival.armL.shoulder.rotation.set(-0.78, 0.22, -0.26);
      rival.armL.elbow.rotation.set(-0.35, 0, 0);
      rival.armR.shoulder.rotation.set(-0.25, 0, 0.34);
      rival.armR.elbow.rotation.set(-0.62, 0, 0);

      // Ibn al-Haytham leans slightly, holding brass lens skeptically, wry raised eyebrow
      alhazen.headGroup.rotation.y = 0.26;
      alhazen.armL.shoulder.rotation.set(-0.22, 0, -0.24);
      alhazen.armL.elbow.rotation.set(-0.55, 0, 0);
      alhazen.armR.shoulder.rotation.set(-0.88, -0.32, 0.24);
      alhazen.armR.elbow.rotation.set(-0.48, 0, 0);
    } else if (t < 9.5) {
      // BEAT 2: Total Darkness! Ibn al-Haytham gestures smugly while Rival waves arms & stumbles!
      const panicOsc = Math.sin(t * 8.5);
      alhazen.root.rotation.y = 0.40;
      alhazen.headGroup.rotation.y = 0.18;
      // Ibn al-Haytham palms-out questioning gesture ("why can't you see now?")
      const talkBeat = Math.sin(t * 6.5) * 0.10;
      alhazen.armL.shoulder.rotation.set(-0.52 + talkBeat, 0.12, -0.28);
      alhazen.armL.elbow.rotation.set(-0.46, 0, 0);
      alhazen.armR.shoulder.rotation.set(-0.72 - talkBeat, -0.22, 0.22);
      alhazen.armR.elbow.rotation.set(-0.42, 0, 0);

      // Rival panics in darkness, groping air safely within frame!
      rival.root.rotation.y = -0.28 + Math.sin(t * 3.8) * 0.16;
      rival.chestGroup.rotation.z = panicOsc * 0.07;
      rival.headGroup.rotation.y = Math.sin(t * 6.0) * 0.30;
      rival.armL.shoulder.rotation.set(-0.92 + panicOsc * 0.14, 0.18, -0.22);
      rival.armL.elbow.rotation.set(-0.42, 0, 0);
      rival.armR.shoulder.rotation.set(-0.72 - panicOsc * 0.14, -0.15, 0.30);
      rival.armR.elbow.rotation.set(-0.48, 0, 0);
    } else if (t < 15.5) {
      // BEAT 3: Macro Insert on Candle -> Pinhole -> Crossing Rays!
      // Step both characters cleanly back/aside so the macro optics bench shot is 100% unobstructed!
      alhazen.root.position.set(-1.18, 0.0, 0.56);
      rival.root.position.set(1.18, 0.0, 0.56);
      alhazen.root.rotation.y = 0.62;
      rival.root.rotation.y = -0.62;
      alhazen.chestGroup.rotation.x = 0.06;
      rival.chestGroup.rotation.x = 0.08;
      alhazen.armL.shoulder.rotation.set(-0.20, 0, -0.20);
      alhazen.armR.shoulder.rotation.set(-0.35, -0.15, 0.18);
      rival.armL.shoulder.rotation.set(-0.32, 0.15, -0.18);
      rival.armR.shoulder.rotation.set(-0.20, 0, 0.20);
    } else if (t < 20.5) {
      // BEAT 4: Dutch Tilt Comedic Twist — Flame is UPSIDE DOWN!
      // Rival recoils in total shock, monocle pops off, tilts head sideways & holds scroll upside down!
      const shockWave = smoothstep(15.5, 16.0, t);
      rival.root.rotation.y = -0.32;
      rival.chestGroup.rotation.x = -0.10 * shockWave;
      rival.headGroup.rotation.z = -0.24 * shockWave + Math.sin(t * 5.2) * 0.06;
      rival.setMonocleDrop(shockWave * (0.85 + 0.12 * Math.sin(t * 9.0)));
      // Rival throws hands up in disbelief (safe within 9:16 margins!)
      rival.armL.shoulder.rotation.set(-1.35, 0.28, -0.25);
      rival.armL.elbow.rotation.set(-0.55, 0, 0);
      rival.armR.shoulder.rotation.set(-1.20, -0.18, 0.34);
      rival.armR.elbow.rotation.set(-0.58, 0, 0);

      // Ibn al-Haytham smiles knowingly and gestures cleanly toward the glowing optics rays!
      const explainPulse = Math.sin(t * 7.2) * 0.08;
      alhazen.root.rotation.y = 0.38;
      alhazen.headGroup.rotation.y = 0.15;
      alhazen.armL.shoulder.rotation.set(-0.30, 0.10, -0.22);
      alhazen.armL.elbow.rotation.set(-0.48, 0, 0);
      alhazen.armR.shoulder.rotation.set(-0.88 + explainPulse, -0.35, 0.22);
      alhazen.armR.elbow.rotation.set(-0.42, 0, 0);
    } else if (t < 25.5) {
      // BEAT 5: Breakthrough Climax — Sweeping Crane Reveal of Camera Obscura & Hologram!
      const swell = smoothstep(20.6, 21.4, t);
      alhazen.root.rotation.y = 0.22;
      alhazen.chestGroup.rotation.x = -0.05 * swell;
      // Triumphant raised scholar pose (total X in [-2.3, -2.5], compact Z so zero edge clip!)
      alhazen.armL.shoulder.rotation.set(-2.05 * swell - 0.30, 0.14, -0.22);
      alhazen.armL.elbow.rotation.set(-0.32, 0, 0);
      alhazen.armR.shoulder.rotation.set(-2.12 * swell - 0.30, -0.18, 0.22);
      alhazen.armR.elbow.rotation.set(-0.28, 0, 0);
      alhazen.setHatPop(Math.sin(clamp01((t - 20.85) / 0.55) * Math.PI) * 0.45);

      // Rival gazes up at floating modern camera lens in pure awe!
      rival.root.rotation.y = -0.38;
      rival.headGroup.rotation.x = -0.24 * swell;
      rival.setMonocleDrop(0.55);
      rival.armL.shoulder.rotation.set(-0.72, 0.22, -0.22);
      rival.armL.elbow.rotation.set(-0.55, 0, 0);
      rival.armR.shoulder.rotation.set(-0.42, -0.10, 0.26);
      rival.armR.elbow.rotation.set(-0.50, 0, 0);
    } else {
      // BEAT 6: Modern Legacy Hero Wide Pull-Back & Loopable Ending!
      alhazen.root.rotation.y = 0.14;
      alhazen.headGroup.rotation.y = -0.06; // proud charismatic glance at the camera!
      alhazen.armL.shoulder.rotation.set(-0.32, 0.08, -0.22);
      alhazen.armL.elbow.rotation.set(-0.50, 0, 0);
      alhazen.armR.shoulder.rotation.set(-1.95, -0.18, 0.20);
      alhazen.armR.elbow.rotation.set(-0.36, 0, 0);

      // Rival peers curiously with a goofy amused smile toward the floating smartphone camera!
      rival.root.rotation.y = -0.36;
      rival.headGroup.rotation.x = -0.16;
      rival.headGroup.rotation.z = 0.10 * Math.sin(t * 2.5);
      rival.armL.shoulder.rotation.set(-0.85, 0.25, -0.22);
      rival.armL.elbow.rotation.set(-0.45, 0, 0);
      rival.armR.shoulder.rotation.set(-0.30, 0, 0.24);
      rival.armR.elbow.rotation.set(-0.48, 0, 0);
    }

    // Apply Pixar Emotions, Auto-Blink, Eye Darts & Voice-Synced Lip-Sync
    const smileA = alhazen.applyEmotion(emoA, t, 1.0, 3);
    const smileR = rival.applyEmotion(emoR, t, 1.0, 9);
    alhazen.setLipSync(alhazenLip, smileA);
    rival.setLipSync(rivalLip, smileR);

    // Ensure strict foot grounding every single frame!
    alhazen.groundFeet(0);
    rival.groundFeet(0);
  }

  return {
    alhazen,
    rival,
    benchMesh,
    partitionMesh,
    screenPivot,
    holoGroup,
    raysGroup,
    registry,
    update,
    getHudCallouts(t) {
      // Zero top UI clutter; clean optional subtle scene flash handled by hudCompositor!
      return [];
    },
  };
}
