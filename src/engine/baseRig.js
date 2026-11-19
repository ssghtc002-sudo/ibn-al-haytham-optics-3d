/**
 * Golden Age Cairo Pixar Parametric Humanoid Rig & Acting Engine
 * (/home/antigravity/ssghtc002-sudo/ibn-al-haytham-optics-3d/src/engine/baseRig.js)
 *
 * 100% unique character silhouettes & outfits for Ibn al-Haytham (Alhazen) & Rival Elder Theorist:
 *  - `outfitStyle: 'scholar_jubbah'` -> flowing ankle-length Fatimid embroidered robe + long cuffs
 *  - `outfitStyle: 'philosopher_mantle'` -> stocky draped scholar robe with wide diagonal shoulder stole
 *  - `headgear: 'fatimid_turban'` -> multi-wrap ivory silk imamah turban + emerald-gold qalansuwa dome
 *  - `headgear: 'elder_tufts'` -> bald glossy pate with silver-gray side-tuft curls
 *  - `beardStyle: 'pointed_scholar'` vs `'round_elder'`
 *  - 6 Core Emotional Presets + Pixar auto-blink + eye darts + lip-sync + strict arm Euler signs
 */
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

function makeCanvas(w, h) {
  if (typeof document !== 'undefined') {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    return c;
  }
  return null;
}

export function safeMerge(geometries) {
  const prep = geometries.map((g) => {
    const cloned = g.index ? g.toNonIndexed() : g.clone();
    if (!cloned.attributes.normal) cloned.computeVertexNormals();
    if (!cloned.attributes.uv) {
      const count = cloned.attributes.position.count;
      cloned.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(count * 2), 2));
    }
    return cloned;
  });
  const merged = mergeGeometries(prep, false);
  for (const g of prep) g.dispose();
  return merged;
}

export function createRadialGlowTexture(colorHex = '#FFE79A') {
  const c = makeCanvas(128, 128);
  if (!c) return null;
  const ctx = c.getContext('2d');
  const col = new THREE.Color(colorHex);
  const r = Math.round(col.r * 255);
  const g = Math.round(col.g * 255);
  const b = Math.round(col.b * 255);
  const grad = ctx.createRadialGradient(64, 64, 2, 64, 64, 62);
  grad.addColorStop(0.0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.24, `rgba(${r},${g},${b},0.88)`);
  grad.addColorStop(0.58, `rgba(${r},${g},${b},0.30)`);
  grad.addColorStop(1.0, `rgba(${r},${g},${b},0.0)`);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

export function createGlowSprite(colorHex = '#FFE79A', size = 1.0, opacity = 0.85) {
  const tex = createRadialGlowTexture(colorHex);
  const mat = new THREE.SpriteMaterial({
    map: tex,
    color: new THREE.Color(colorHex),
    transparent: true,
    opacity,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const sp = new THREE.Sprite(mat);
  sp.scale.set(size, size, 1);
  return sp;
}

export function createContactShadowTexture() {
  const c = makeCanvas(128, 128);
  if (!c) return null;
  const ctx = c.getContext('2d');
  const grad = ctx.createRadialGradient(64, 64, 4, 64, 64, 60);
  grad.addColorStop(0.0, 'rgba(4,6,14,0.68)');
  grad.addColorStop(0.55, 'rgba(4,6,14,0.32)');
  grad.addColorStop(1.0, 'rgba(4,6,14,0.0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

export function createContactShadowDisc(radius = 0.34, opacity = 0.82, sharedMat = null) {
  const geo = new THREE.PlaneGeometry(radius * 2, radius * 2);
  geo.rotateX(-Math.PI * 0.5);
  const mat =
    sharedMat ||
    new THREE.MeshBasicMaterial({
      map: createContactShadowTexture(),
      transparent: true,
      opacity,
      depthWrite: false,
    });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.y = 0.004;
  mesh.renderOrder = 2;
  return mesh;
}

export function createIrisTexture(irisHex = '#3D2717') {
  const c = makeCanvas(128, 128);
  if (!c) return null;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, 128, 128);
  const g = ctx.createRadialGradient(64, 64, 8, 64, 64, 54);
  g.addColorStop(0, '#0C0F14');
  g.addColorStop(0.32, '#0C0F14');
  g.addColorStop(0.36, irisHex);
  g.addColorStop(0.84, irisHex);
  g.addColorStop(0.95, '#191C24');
  g.addColorStop(1, '#191C24');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(64, 64, 54, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#FFFFFF';
  ctx.beginPath();
  ctx.arc(48, 46, 9.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(76, 78, 4.5, 0, Math.PI * 2);
  ctx.fill();

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

export class MaterialRegistry {
  constructor() {
    this.map = new Map();
    this.contactShadowTex = createContactShadowTexture();
    this.contactShadowMat = this.getBasic('shared_contact_shadow', {
      map: this.contactShadowTex,
      transparent: true,
      opacity: 0.78,
      depthWrite: false,
    });
  }

  getStandard(key, props) {
    if (this.map.has(key)) return this.map.get(key);
    const mat = new THREE.MeshStandardMaterial(props);
    this.map.set(key, mat);
    return mat;
  }

  getBasic(key, props) {
    if (this.map.has(key)) return this.map.get(key);
    const mat = new THREE.MeshBasicMaterial(props);
    this.map.set(key, mat);
    return mat;
  }

  count() {
    return this.map.size;
  }
}

const EMOTION_PRESETS = {
  neutral: {
    browLY: 0.0, browRY: 0.0, browLRz: 0.06, browRRz: -0.06,
    eyeScaleX: 1.0, eyeScaleY: 1.0, headTiltZ: 0.0, headPitchX: 0.0, smile: 0.28,
  },
  curious: {
    browLY: 0.020, browRY: -0.005, browLRz: 0.16, browRRz: -0.04,
    eyeScaleX: 1.05, eyeScaleY: 1.08, headTiltZ: 0.14, headPitchX: -0.04, smile: 0.34,
  },
  focused: {
    browLY: -0.013, browRY: -0.013, browLRz: -0.22, browRRz: 0.22,
    eyeScaleX: 1.02, eyeScaleY: 0.82, headTiltZ: -0.03, headPitchX: 0.09, smile: 0.14,
  },
  shocked: {
    browLY: 0.034, browRY: 0.034, browLRz: 0.16, browRRz: -0.16,
    eyeScaleX: 1.20, eyeScaleY: 1.26, headTiltZ: 0.05, headPitchX: -0.12, smile: 0.0,
  },
  scheming: {
    browLY: -0.010, browRY: 0.024, browLRz: -0.16, browRRz: 0.18,
    eyeScaleX: 1.04, eyeScaleY: 0.78, headTiltZ: -0.08, headPitchX: -0.06, smile: 0.65,
  },
  panicked: {
    browLY: 0.032, browRY: 0.032, browLRz: 0.24, browRRz: -0.24,
    eyeScaleX: 1.20, eyeScaleY: 1.25, headTiltZ: 0.09, headPitchX: -0.08, smile: 0.0,
  },
  triumphant: {
    browLY: 0.022, browRY: 0.022, browLRz: 0.14, browRRz: -0.14,
    eyeScaleX: 1.08, eyeScaleY: 1.06, headTiltZ: -0.05, headPitchX: -0.10, smile: 0.88,
  },
};

export function buildPixarHumanoid(opts = {}, registry = new MaterialRegistry()) {
  const {
    id = 'character',
    outfitStyle = 'scholar_jubbah', // 'scholar_jubbah' | 'philosopher_mantle'
    beardStyle = 'pointed_scholar', // 'pointed_scholar' | 'round_elder' | 'none'
    headgear = 'fatimid_turban', // 'fatimid_turban' | 'elder_tufts' | 'none'
    skinColor = '#C68E64',
    suitColor = '#0F5C58',
    accentColor = '#E6B44C',
    turbanColor = '#F3EAD8',
    trouserColor = '#1E283A',
    shoeColor = '#46291A',
    hairColor = '#1E1816',
    irisColor = '#2E1C11',
    hasMustache = true,
    hasMonocle = false,
    longSleeves = true,
    torsoWidth = 1.04,
    castShadow = true,
  } = opts;

  const root = new THREE.Group();
  root.name = `char_${id}`;

  const rig = new THREE.Group();
  rig.name = `${id}_rig`;
  root.add(rig);

  // Shared materials (reused across parts to keep global material palette <= 25)
  const skinMat = registry.getStandard(`skin_${skinColor}`, { color: skinColor, roughness: 0.40, metalness: 0.03 });
  const suitMat = registry.getStandard(`suit_${suitColor}`, { color: suitColor, roughness: 0.60, metalness: 0.06 });
  const accentMat = registry.getStandard(`accent_${accentColor}`, { color: accentColor, roughness: 0.28, metalness: 0.68 });
  const turbanMat = registry.getStandard(`turban_${turbanColor}`, { color: turbanColor, roughness: 0.68, metalness: 0.03 });
  const trouserMat = registry.getStandard(`trouser_${trouserColor}`, { color: trouserColor, roughness: 0.72, metalness: 0.04 });
  const shoeMat = registry.getStandard(`shoe_${shoeColor}`, { color: shoeColor, roughness: 0.38, metalness: 0.08 });
  const hairMat = registry.getStandard(`hair_${hairColor}`, { color: hairColor, roughness: 0.62, metalness: 0.04 });
  const teethMat = registry.getStandard('teeth_shared', { color: '#F6F2E8', roughness: 0.24, metalness: 0.0 });
  const irisTex = createIrisTexture(irisColor);
  const irisMat = registry.getStandard(`eyeball_${irisColor}`, {
    map: irisTex || null,
    color: irisTex ? '#FFFFFF' : '#F4F4F4',
    roughness: 0.14,
    metalness: 0.04,
  });
  const cavityMat = registry.getBasic('mouth_cavity', { color: '#2A0B0F' });
  const lipMat = registry.getStandard('lip_shared', {
    color: '#9C5147',
    roughness: 0.44,
    metalness: 0.02,
  });

  // Pelvis
  const pelvis = new THREE.Group();
  pelvis.position.set(0, 0.58, 0);
  rig.add(pelvis);

  // Chest
  const chestGroup = new THREE.Group();
  chestGroup.position.set(0, 0.06, 0);
  pelvis.add(chestGroup);

  // Distinct Era-Accurate Robe Silhouettes
  let coatProfile;
  if (outfitStyle === 'scholar_jubbah') {
    // Graceful Fatimid scholar jubbah reaching past mid-calf with flared hem
    coatProfile = [
      new THREE.Vector2(0.01, -0.34),
      new THREE.Vector2(0.228, -0.34),
      new THREE.Vector2(0.205, -0.16),
      new THREE.Vector2(0.172, 0.02),
      new THREE.Vector2(0.156, 0.12),
      new THREE.Vector2(0.176, 0.26),
      new THREE.Vector2(0.158, 0.36),
      new THREE.Vector2(0.086, 0.41),
      new THREE.Vector2(0.005, 0.42),
    ];
  } else {
    // Stockier philosopher tunic with fuller waist
    coatProfile = [
      new THREE.Vector2(0.01, -0.24),
      new THREE.Vector2(0.212, -0.24),
      new THREE.Vector2(0.198, -0.05),
      new THREE.Vector2(0.186, 0.10),
      new THREE.Vector2(0.188, 0.24),
      new THREE.Vector2(0.164, 0.35),
      new THREE.Vector2(0.088, 0.40),
      new THREE.Vector2(0.005, 0.41),
    ];
  }
  const coatGeo = new THREE.LatheGeometry(coatProfile, 18);
  coatGeo.scale(torsoWidth, 1.0, 0.86);
  const coatMesh = new THREE.Mesh(coatGeo, suitMat);
  chestGroup.add(coatMesh);

  // Distinct Chest Accents (merged into 1 draw call!)
  const accentParts = [];
  if (outfitStyle === 'scholar_jubbah') {
    // Wide embroidered silk waist sash (hizam), Mandarin collar, gold hem ring & front lapel trim
    const sashGeo = new THREE.TorusGeometry(0.162, 0.032, 8, 18);
    sashGeo.rotateX(Math.PI * 0.5);
    sashGeo.scale(torsoWidth * 1.02, 1.25, 0.88);
    sashGeo.translate(0, 0.06, 0);
    accentParts.push(sashGeo);

    const hemRing = new THREE.TorusGeometry(0.226, 0.014, 6, 18);
    hemRing.rotateX(Math.PI * 0.5);
    hemRing.scale(torsoWidth, 1.0, 0.86);
    hemRing.translate(0, -0.33, 0);
    accentParts.push(hemRing);

    const collarGeo = new THREE.CylinderGeometry(0.082, 0.096, 0.072, 14);
    collarGeo.translate(0, 0.395, 0);
    accentParts.push(collarGeo);

    const placketProfile = [
      new THREE.Vector2(0.224, -0.32),
      new THREE.Vector2(0.198, -0.14),
      new THREE.Vector2(0.168, 0.04),
      new THREE.Vector2(0.178, 0.25),
      new THREE.Vector2(0.160, 0.36),
      new THREE.Vector2(0.094, 0.41),
    ];
    const placketGeo = new THREE.LatheGeometry(placketProfile, 5, -0.14, 0.28);
    placketGeo.scale(torsoWidth, 1.0, 0.875);
    accentParts.push(placketGeo);
  } else {
    // Diagonal draped philosopher stole + brass clasp + lower trim
    const sashGeo = new THREE.TorusGeometry(0.188, 0.028, 8, 18);
    sashGeo.rotateX(Math.PI * 0.5);
    sashGeo.scale(torsoWidth, 1.0, 0.88);
    sashGeo.translate(0, 0.02, 0);
    accentParts.push(sashGeo);

    const stole = new THREE.TorusGeometry(0.215, 0.032, 8, 18);
    stole.scale(0.88, 1.18, 0.80);
    stole.rotateZ(0.56);
    stole.translate(0.02, 0.18, 0.015);
    accentParts.push(stole);

    const clasp = new THREE.SphereGeometry(0.036, 10, 8);
    clasp.scale(1.0, 1.0, 0.5);
    clasp.translate(-0.11, 0.33, 0.145);
    accentParts.push(clasp);
  }
  chestGroup.add(new THREE.Mesh(safeMerge(accentParts), accentMat));

  // Head Group
  const headGroup = new THREE.Group();
  headGroup.position.set(0, 0.44, 0);
  chestGroup.add(headGroup);

  const neckGeo = new THREE.CylinderGeometry(0.056, 0.068, 0.09, 12);
  neckGeo.translate(0, 0.02, 0);

  const skullGeo = new THREE.SphereGeometry(0.186, 22, 16);
  skullGeo.scale(0.95, 1.04, 0.94);
  skullGeo.translate(0, 0.21, 0);

  const earLGeo = new THREE.SphereGeometry(0.038, 10, 8);
  earLGeo.scale(0.55, 1.05, 0.72);
  earLGeo.translate(-0.176, 0.205, -0.01);

  const earRGeo = new THREE.SphereGeometry(0.038, 10, 8);
  earRGeo.scale(0.55, 1.05, 0.72);
  earRGeo.translate(0.176, 0.205, -0.01);

  const noseGeo = new THREE.SphereGeometry(0.036, 12, 10);
  noseGeo.scale(0.88, 0.92, 1.28);
  noseGeo.translate(0, 0.195, 0.176);

  const headSkinMesh = new THREE.Mesh(safeMerge([neckGeo, skullGeo, earLGeo, earRGeo, noseGeo]), skinMat);
  headGroup.add(headSkinMesh);

  // Unified L/R Eyeballs in an articulated eyesPivot
  const eyesPivot = new THREE.Group();
  eyesPivot.position.set(0, 0.242, 0.146);
  headGroup.add(eyesPivot);

  const eyeParts = [];
  for (const side of [-1, 1]) {
    const eGeo = new THREE.SphereGeometry(0.041, 14, 10);
    const pos = eGeo.attributes.position;
    const uv = eGeo.attributes.uv;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const y = pos.getY(i);
      const z = pos.getZ(i);
      if (z > 0) {
        uv.setXY(
          i,
          Math.max(0.02, Math.min(0.98, 0.5 + x / 0.072)),
          Math.max(0.02, Math.min(0.98, 0.5 + y / 0.072))
        );
      } else {
        uv.setXY(i, 0.02, 0.02);
      }
    }
    eGeo.scale(0.96, 1.04, 0.68);
    eGeo.translate(side * 0.064, 0, 0);
    eyeParts.push(eGeo);
  }
  const eyesMesh = new THREE.Mesh(safeMerge(eyeParts), irisMat);
  eyesPivot.add(eyesMesh);

  function buildBrow(side) {
    const thick = headgear === 'elder_tufts' ? 0.0155 : 0.012;
    const bGeo = new THREE.CapsuleGeometry(thick, 0.054, 5, 8);
    bGeo.rotateZ(Math.PI * 0.5);
    const brow = new THREE.Mesh(bGeo, hairMat);
    brow.position.set(side * 0.064, 0.302, 0.160);
    brow.rotation.z = -side * 0.06;
    brow.userData.baseY = 0.302;
    brow.userData.baseRotZ = -side * 0.06;
    headGroup.add(brow);
    return brow;
  }
  const eyeL = { mesh: eyesPivot, brow: buildBrow(-1) };
  const eyeR = { mesh: eyesPivot, brow: buildBrow(1) };

  // Mouth Assembly
  const mouthGroup = new THREE.Group();
  mouthGroup.position.set(0, 0.125, 0.158);
  headGroup.add(mouthGroup);

  const cavity = new THREE.Mesh(new THREE.SphereGeometry(0.044, 12, 8), cavityMat);
  cavity.scale.set(1.22, 0.65, 0.55);
  cavity.position.z = -0.008;
  mouthGroup.add(cavity);

  const teeth = new THREE.Mesh(new THREE.CylinderGeometry(0.038, 0.038, 0.018, 10, 1, false, -0.7, 1.4), teethMat);
  teeth.position.set(0, 0.016, 0.002);
  mouthGroup.add(teeth);

  const lowerLip = new THREE.Mesh(new THREE.CapsuleGeometry(0.010, 0.054, 5, 8), lipMat);
  lowerLip.rotation.z = Math.PI * 0.5;
  lowerLip.position.set(0, -0.018, 0.018);
  mouthGroup.add(lowerLip);

  // Hair & Facial Hair (strictly tailored per character, zero clipping!)
  const hairParts = [];
  if (headgear === 'elder_tufts') {
    // Bald shiny top crown, fluffy silver side-tufts around temples & back only
    for (let i = -3; i <= 3; i++) {
      if (i === 0) continue;
      const ang = i * 0.44 + Math.PI; // wrap around back & sides
      const puff = new THREE.SphereGeometry(0.048, 8, 6);
      puff.scale(0.95, 0.88, 0.95);
      puff.translate(Math.sin(ang) * 0.172, 0.215 - Math.abs(i) * 0.006, Math.cos(ang) * 0.158 - 0.01);
      hairParts.push(puff);
    }
    for (const s of [-1, 1]) {
      const temple = new THREE.SphereGeometry(0.042, 8, 6);
      temple.translate(s * 0.168, 0.248, 0.035);
      hairParts.push(temple);
    }
  } else if (headgear === 'fatimid_turban') {
    // Neat dark sideburns tucked cleanly beneath the turban edges
    for (const s of [-1, 1]) {
      const sideburn = new THREE.CapsuleGeometry(0.016, 0.065, 5, 8);
      sideburn.translate(s * 0.158, 0.195, 0.052);
      hairParts.push(sideburn);
    }
  }

  if (hasMustache) {
    for (const s of [-1, 1]) {
      const wing = new THREE.CapsuleGeometry(0.0125, 0.038, 5, 8);
      wing.rotateZ(s * 1.24);
      wing.rotateY(s * 0.25);
      wing.translate(s * 0.028, 0.156, 0.168);
      hairParts.push(wing);
    }
  }

  if (beardStyle === 'pointed_scholar') {
    // Neat sculpted Islamic scholar beard following jawline + tapered chin point (tucked cleanly away from chest!)
    const chinCone = new THREE.ConeGeometry(0.068, 0.108, 12);
    chinCone.rotateX(Math.PI);
    chinCone.scale(1.05, 1.0, 0.68);
    chinCone.translate(0, 0.052, 0.122);
    hairParts.push(chinCone);

    for (const s of [-1, 1]) {
      const jaw = new THREE.CapsuleGeometry(0.020, 0.080, 5, 8);
      jaw.rotateZ(s * 0.42);
      jaw.rotateX(0.32);
      jaw.translate(s * 0.094, 0.108, 0.105);
      hairParts.push(jaw);
    }
  } else if (beardStyle === 'round_elder') {
    // Full rounded elder philosopher beard tucked at chin
    const mainB = new THREE.SphereGeometry(0.078, 12, 10);
    mainB.scale(1.12, 0.92, 0.68);
    mainB.translate(0, 0.066, 0.125);
    hairParts.push(mainB);
  }

  if (hairParts.length > 0) {
    headGroup.add(new THREE.Mesh(safeMerge(hairParts), hairMat));
  }

  // Headgear Group (Fatimid Multi-Wrap Scholar Turban!)
  const headgearGroup = new THREE.Group();
  headgearGroup.name = 'headgear';
  headgearGroup.position.set(0, 0.345, -0.008);
  headgearGroup.userData.baseY = 0.345;
  headgearGroup.visible = headgear === 'fatimid_turban';

  if (headgear === 'fatimid_turban') {
    const wrapParts = [];
    // Layered angled silk wraps forming an iconic Fatimid scholar imamah
    const w1 = new THREE.TorusGeometry(0.184, 0.056, 10, 22);
    w1.rotateX(Math.PI * 0.5);
    w1.scale(1.04, 0.95, 1.04);
    w1.translate(0, 0.010, 0);
    wrapParts.push(w1);

    const w2 = new THREE.TorusGeometry(0.168, 0.052, 10, 22);
    w2.rotateX(Math.PI * 0.5 + 0.14);
    w2.rotateZ(0.12);
    w2.scale(1.05, 0.92, 1.05);
    w2.translate(0, 0.064, -0.006);
    wrapParts.push(w2);

    const w3 = new THREE.TorusGeometry(0.142, 0.046, 10, 20);
    w3.rotateX(Math.PI * 0.5 - 0.14);
    w3.rotateZ(-0.12);
    w3.translate(0, 0.112, -0.004);
    wrapParts.push(w3);

    // Front folded silk knot
    const knot = new THREE.SphereGeometry(0.052, 10, 8);
    knot.scale(1.25, 0.85, 0.72);
    knot.translate(0, 0.055, 0.195);
    wrapParts.push(knot);

    headgearGroup.add(new THREE.Mesh(safeMerge(wrapParts), turbanMat));

    // Inner qalansuwa dome & golden scholar band peeking through top
    const domeGeo = new THREE.SphereGeometry(0.138, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.52);
    domeGeo.translate(0, 0.105, -0.004);
    const jewelGeo = new THREE.OctahedronGeometry(0.026, 0);
    jewelGeo.scale(0.85, 1.25, 0.6);
    jewelGeo.translate(0, 0.062, 0.224);
    headgearGroup.add(new THREE.Mesh(safeMerge([domeGeo, jewelGeo]), accentMat));
  }
  headGroup.add(headgearGroup);

  // Monocle (for Rival Elder Theorist)
  let monocleGroup = null;
  if (hasMonocle) {
    monocleGroup = new THREE.Group();
    monocleGroup.position.set(0.064, 0.242, 0.184);
    monocleGroup.userData.basePos = monocleGroup.position.clone();
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.046, 0.0065, 8, 16), accentMat);
    monocleGroup.add(ring);
    headGroup.add(monocleGroup);
  }

  // Arms (armL = -1, armR = +1; strict Euler sign convention)
  function buildArm(side) {
    const shoulder = new THREE.Group();
    shoulder.position.set(side * (0.180 * torsoWidth), 0.31, 0);
    chestGroup.add(shoulder);

    const upper = new THREE.Mesh(new THREE.CapsuleGeometry(0.050, 0.195, 6, 10), suitMat);
    upper.position.y = -0.105;
    shoulder.add(upper);

    const elbow = new THREE.Group();
    elbow.position.set(0, -0.220, 0);
    shoulder.add(elbow);

    if (longSleeves) {
      // Flowing robe sleeve on forearm + separate hand
      const sleeveGeo = new THREE.CylinderGeometry(0.044, 0.058, 0.175, 10);
      sleeveGeo.translate(0, -0.088, 0);
      const forearm = new THREE.Mesh(sleeveGeo, suitMat);
      elbow.add(forearm);

      const hGeo = new THREE.SphereGeometry(0.044, 10, 8);
      hGeo.scale(0.88, 1.08, 0.78);
      hGeo.translate(0, -0.198, 0);
      const hand = new THREE.Mesh(hGeo, skinMat);
      elbow.add(hand);

      const propMount = new THREE.Group();
      propMount.position.set(0, -0.210, 0.03);
      elbow.add(propMount);
      return { shoulder, elbow, upper, forearm, hand, propMount };
    } else {
      const faGeo = new THREE.CapsuleGeometry(0.040, 0.165, 6, 10);
      faGeo.translate(0, -0.092, 0);
      const hGeo = new THREE.SphereGeometry(0.045, 10, 8);
      hGeo.scale(0.88, 1.08, 0.78);
      hGeo.translate(0, -0.200, 0);
      const forearm = new THREE.Mesh(safeMerge([faGeo, hGeo]), skinMat);
      elbow.add(forearm);

      const propMount = new THREE.Group();
      propMount.position.set(0, -0.212, 0.03);
      elbow.add(propMount);
      return { shoulder, elbow, upper, forearm, hand: forearm, propMount };
    }
  }
  const armL = buildArm(-1);
  const armR = buildArm(1);

  // Legs (merged thigh+shin under robes to keep draw calls super lean!)
  function buildLeg(side) {
    const hip = new THREE.Group();
    hip.position.set(side * 0.088, -0.02, 0);
    pelvis.add(hip);

    const thighGeo = new THREE.CapsuleGeometry(0.056, 0.215, 6, 10);
    thighGeo.translate(0, -0.132, 0);
    const shinGeo = new THREE.CapsuleGeometry(0.046, 0.215, 6, 10);
    shinGeo.translate(0, -0.377, 0);
    const legMesh = new THREE.Mesh(safeMerge([thighGeo, shinGeo]), trouserMat);
    hip.add(legMesh);

    const ankle = new THREE.Group();
    ankle.position.set(0, -0.507, 0);
    hip.add(ankle);

    // Pointed Golden Age leather slipper
    const shoeBase = new THREE.CapsuleGeometry(0.046, 0.110, 6, 10);
    shoeBase.rotateX(Math.PI * 0.5);
    shoeBase.scale(1.0, 0.76, 1.0);
    shoeBase.translate(0, -0.022, 0.044);
    const shoeTip = new THREE.ConeGeometry(0.032, 0.055, 8);
    shoeTip.rotateX(Math.PI * 0.42);
    shoeTip.translate(0, -0.016, 0.122);
    const shoe = new THREE.Mesh(safeMerge([shoeBase, shoeTip]), shoeMat);
    ankle.add(shoe);

    return { hip, knee: ankle, ankle, thigh: legMesh, shin: legMesh, shoe };
  }
  const legL = buildLeg(-1);
  const legR = buildLeg(1);

  const contactShadow = createContactShadowDisc(0.36, 0.80, registry.contactShadowMat);
  root.add(contactShadow);

  // Selective shadow casting on key body meshes only
  if (castShadow) {
    [coatMesh, headSkinMesh, legL.thigh, legR.thigh, armL.upper, armR.upper].forEach((m) => {
      if (m && m.isMesh) m.castShadow = true;
    });
  }

  let baseSoleOffset = 0;
  function groundFeet(surfaceY = 0) {
    rig.position.y = 0;
    rig.updateMatrixWorld(true);
    const boxL = new THREE.Box3().setFromObject(legL.shoe);
    const boxR = new THREE.Box3().setFromObject(legR.shoe);
    const minWorldY = Math.min(boxL.min.y, boxR.min.y);
    const delta = surfaceY - minWorldY;
    rig.position.y += delta;
    baseSoleOffset = rig.position.y;
    rig.updateMatrixWorld(true);
    contactShadow.position.y = 0.004;
    return delta;
  }

  groundFeet(0);

  function setLipSync(open01 = 0, smile = 0.25) {
    const o = Math.max(0, Math.min(1, open01));
    cavity.visible = o > 0.04;
    cavity.scale.set(1.18 + smile * 0.16, 0.22 + o * 0.95, 0.55);
    lowerLip.position.y = -0.012 - o * 0.032;
    teeth.visible = o > 0.10 || smile > 0.48;
  }

  function applyEmotion(emotion = 'neutral', t = 0, intensity = 1.0, seed = 0) {
    const preset = EMOTION_PRESETS[emotion] || EMOTION_PRESETS.neutral;
    const k = Math.max(0, Math.min(1.2, intensity));

    let blinkSquish = 1.0;
    if (emotion !== 'shocked') {
      const period = 3.1 + (seed % 7) * 0.13;
      const phase = ((t + seed * 1.37) % period);
      if (phase < 0.12) {
        const b = Math.sin((phase / 0.12) * Math.PI);
        blinkSquish = 1.0 - b * 0.88;
      }
    }

    const dartSpeed = emotion === 'panicked' ? 7.5 : 1.25;
    const dartAmp = emotion === 'panicked' ? 0.22 : 0.08;
    const eyeYaw = Math.sin(t * dartSpeed + seed) * dartAmp;
    const eyePitch = Math.cos(t * (dartSpeed * 0.72) + seed * 2.1) * (dartAmp * 0.45);

    eyesPivot.scale.set(
      1 + (preset.eyeScaleX - 1) * k,
      (1 + (preset.eyeScaleY - 1) * k) * blinkSquish,
      1
    );
    eyesPivot.rotation.set(eyePitch, eyeYaw, 0);

    eyeL.brow.position.y = eyeL.brow.userData.baseY + preset.browLY * k;
    eyeR.brow.position.y = eyeR.brow.userData.baseY + preset.browRY * k;
    eyeL.brow.rotation.z = preset.browLRz * k;
    eyeR.brow.rotation.z = preset.browRRz * k;

    headGroup.rotation.z += preset.headTiltZ * k;
    headGroup.rotation.x += preset.headPitchX * k;

    return preset.smile;
  }

  function setHatPop(pop01 = 0) {
    if (!headgearGroup.visible) return;
    const p = Math.max(0, Math.min(1, pop01));
    headgearGroup.position.y = 0.345 + p * 0.22;
    headgearGroup.rotation.z = p * 0.20;
    headgearGroup.rotation.y = p * 0.9;
  }

  function setMonocleDrop(drop01 = 0) {
    if (!monocleGroup) return;
    const p = Math.max(0, Math.min(1, drop01));
    const bp = monocleGroup.userData.basePos;
    monocleGroup.position.set(bp.x + p * 0.05, bp.y - p * 0.22, bp.z + p * 0.038);
    monocleGroup.rotation.z = p * 1.25;
  }

  function resetPose() {
    rig.position.set(0, baseSoleOffset, 0);
    rig.rotation.set(0, 0, 0);
    pelvis.rotation.set(0, 0, 0);
    chestGroup.rotation.set(0, 0, 0);
    headGroup.rotation.set(0, 0, 0);
    eyesPivot.scale.set(1, 1, 1);
    eyesPivot.rotation.set(0, 0, 0);
    eyeL.brow.rotation.z = eyeL.brow.userData.baseRotZ;
    eyeR.brow.rotation.z = eyeR.brow.userData.baseRotZ;
    eyeL.brow.position.y = eyeL.brow.userData.baseY;
    eyeR.brow.position.y = eyeR.brow.userData.baseY;
    armL.shoulder.rotation.set(0, 0, -0.18);
    armL.elbow.rotation.set(-0.22, 0, 0);
    armR.shoulder.rotation.set(0, 0, 0.18);
    armR.elbow.rotation.set(-0.22, 0, 0);
    legL.hip.rotation.set(0, 0, 0);
    legR.hip.rotation.set(0, 0, 0);
    setHatPop(0);
    setMonocleDrop(0);
    if (monocleGroup) monocleGroup.visible = true;
  }

  return {
    root,
    rig,
    pelvis,
    chestGroup,
    headGroup,
    headgearGroup,
    monocleGroup,
    eyesPivot,
    eyeL,
    eyeR,
    armL,
    armR,
    legL,
    legR,
    contactShadow,
    groundFeet,
    setLipSync,
    applyEmotion,
    setHatPop,
    setMonocleDrop,
    resetPose,
  };
}
