import * as THREE from 'three';

/** Small deterministic PRNG so the puck looks the same on every load. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * A fractured coffee-ground shard: a subdivided icosahedron with every corner pushed
 * in or out, then squashed. Non-indexed geometry gives crisp facets like broken cells.
 */
function shardGeometry(seed: number): THREE.BufferGeometry {
  const rnd = mulberry32(seed);
  const geo = new THREE.IcosahedronGeometry(1, 1);
  const pos = geo.attributes.position as THREE.BufferAttribute;
  // Same displacement for coincident vertices, so faces stay closed.
  const disp = new Map<string, number>();
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const key = `${v.x.toFixed(3)},${v.y.toFixed(3)},${v.z.toFixed(3)}`;
    let d = disp.get(key);
    if (d === undefined) {
      d = 0.62 + rnd() * 0.55;
      disp.set(key, d);
    }
    v.multiplyScalar(d);
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  geo.scale(1, 0.55 + rnd() * 0.25, 0.75 + rnd() * 0.25);
  geo.computeVertexNormals();
  return geo;
}

/**
 * Whole roasted bean: an ellipsoid with a flat face and an S-shaped centre cut.
 */
function beanGeometry(): THREE.BufferGeometry {
  const geo = new THREE.SphereGeometry(1, 36, 24);
  const pos = geo.attributes.position as THREE.BufferAttribute;
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    let { x, y, z } = v;
    x *= 0.66;
    z *= 0.92;
    y *= 0.48;
    if (y > 0) {
      y *= 0.5; // flat side
      const crease = Math.abs(x - 0.07 * Math.sin(z * 3.4));
      if (crease < 0.12) y -= 0.16 * Math.pow(1 - crease / 0.12, 2);
    }
    pos.setXYZ(i, x, y, z);
  }
  geo.computeVertexNormals();
  return geo;
}

export interface GroundsParams {
  grindUm: number;
  fines: number;
  doseG: number;
  roast: number;
}

const VARIANTS = 4;

export class Grounds {
  readonly meshes: THREE.InstancedMesh[] = [];
  private core: THREE.Mesh;
  private coreMat: THREE.MeshStandardMaterial;
  private beans: THREE.InstancedMesh;
  private beanMat: THREE.MeshPhysicalMaterial;
  private perVariant: number;
  // Per-particle data (global index i → variant i % VARIANTS, slot ⌊i / VARIANTS⌋).
  private x: Float32Array;
  private yf: Float32Array;
  private z: Float32Array;
  private jitter: Float32Array;
  private shade: Float32Array;
  private quat: Float32Array;
  private depth: Float32Array;
  private fine: Uint8Array;
  private raw = new THREE.Color('#3b2214');
  private readonly spent = new THREE.Color('#c9a27e');
  private tmpM = new THREE.Matrix4();
  private tmpQ = new THREE.Quaternion();
  private tmpV = new THREE.Vector3();
  private tmpS = new THREE.Vector3();
  private tmpC = new THREE.Color();
  puckH = 1;

  constructor(
    scene: THREE.Scene,
    clipMat: <T extends THREE.Material>(m: T) => T,
    radius: number,
    private readonly count: number,
    beanSpot: { x: number; y: number; z: number },
  ) {
    this.perVariant = Math.ceil(count / VARIANTS);
    this.x = new Float32Array(count);
    this.yf = new Float32Array(count);
    this.z = new Float32Array(count);
    this.jitter = new Float32Array(count);
    this.shade = new Float32Array(count);
    this.quat = new Float32Array(count * 4);
    this.depth = new Float32Array(count);
    this.fine = new Uint8Array(count);

    const rnd = mulberry32(58);
    const q = new THREE.Quaternion();
    const e = new THREE.Euler();
    for (let i = 0; i < count; i++) {
      const r = (radius - 0.2) * Math.sqrt(rnd());
      const a = rnd() * Math.PI * 2;
      this.x[i] = r * Math.cos(a);
      this.z[i] = r * Math.sin(a);
      this.yf[i] = rnd();
      this.jitter[i] = 0.75 + rnd() * 0.5;
      this.shade[i] = 0.82 + rnd() * 0.36;
      q.setFromEuler(e.set(rnd() * Math.PI * 2, rnd() * Math.PI * 2, rnd() * Math.PI * 2));
      q.toArray(this.quat, i * 4);
    }

    const mat = clipMat(new THREE.MeshStandardMaterial({ roughness: 0.92, metalness: 0, flatShading: true }));
    for (let v = 0; v < VARIANTS; v++) {
      const mesh = new THREE.InstancedMesh(shardGeometry(1000 + v * 77), mat, this.perVariant);
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      for (let k = 0; k < this.perVariant; k++) mesh.setColorAt(k, this.raw);
      this.meshes.push(mesh);
      scene.add(mesh);
    }

    // Dense core so the puck reads as a solid cake rather than loose gravel.
    this.coreMat = clipMat(new THREE.MeshStandardMaterial({ color: '#2a170d', roughness: 1 }));
    this.core = new THREE.Mesh(new THREE.CylinderGeometry(radius - 0.32, radius - 0.38, 1, 48), this.coreMat);
    scene.add(this.core);

    // A handful of whole beans on the drip tray.
    this.beanMat = new THREE.MeshPhysicalMaterial({ color: '#4a2a17', roughness: 0.42, clearcoat: 0.6, clearcoatRoughness: 0.35 });
    const n = 14;
    this.beans = new THREE.InstancedMesh(beanGeometry(), this.beanMat, n);
    const br = mulberry32(7);
    for (let i = 0; i < n; i++) {
      const a = br() * Math.PI * 2;
      const d = Math.sqrt(br()) * 1.6;
      this.tmpV.set(beanSpot.x + Math.cos(a) * d, beanSpot.y + 0.24 + (i > 10 ? 0.35 : 0), beanSpot.z + Math.sin(a) * d);
      // Mostly lying flat-side down, a few tipped over.
      e.set(br() < 0.75 ? Math.PI : br() * Math.PI, br() * Math.PI * 2, (br() - 0.5) * 0.5);
      this.tmpM.compose(this.tmpV, this.tmpQ.setFromEuler(e), this.tmpS.setScalar(0.52 + br() * 0.1));
      this.beans.setMatrixAt(i, this.tmpM);
    }
    scene.add(this.beans);
  }

  setPuck(p: GroundsParams) {
    // ~18 g fills about 1.1 cm of a 58 mm basket.
    this.puckH = Math.min(2.0, 1.1 * (p.doseG / 18));
    // Visual radius: ~7× enlarged so 300 µm reads as a real grain on screen.
    const coarse = (p.grindUm / 10000) * 3.4;
    const fineR = Math.max(0.025, coarse * 0.3);
    const fineShare = Math.min(0.45, p.fines);
    this.raw = new THREE.Color('#9a6a43').lerp(new THREE.Color('#1c0e07'), p.roast);
    this.beanMat.color.copy(new THREE.Color('#8a5631').lerp(new THREE.Color('#150a05'), p.roast));
    // Darker roasts get an oily sheen.
    this.beanMat.clearcoat = 0.3 + 0.6 * p.roast;

    for (let i = 0; i < this.count; i++) {
      const isFine = this.jitter[i]! < 0.75 + fineShare * 0.5;
      this.fine[i] = isFine ? 1 : 0;
      const r = (isFine ? fineR : coarse) * this.jitter[i]!;
      const yFrac = this.yf[i]!;
      this.depth[i] = 1 - yFrac;
      this.tmpV.set(this.x[i]!, 0.04 + yFrac * (this.puckH - 0.08), this.z[i]!);
      this.tmpQ.fromArray(this.quat, i * 4);
      this.tmpM.compose(this.tmpV, this.tmpQ, this.tmpS.setScalar(r));
      this.meshes[i % VARIANTS]!.setMatrixAt(Math.floor(i / VARIANTS), this.tmpM);
    }
    for (const m of this.meshes) m.instanceMatrix.needsUpdate = true;
    this.core.scale.y = this.puckH * 0.9;
    this.core.position.y = (this.puckH * 0.9) / 2;
  }

  /** Extraction front moves top → bottom; fines give up their solubles first. */
  setProgress(progress: number) {
    for (let i = 0; i < this.count; i++) {
      const front = progress * 1.6 - this.depth[i]! * 0.6;
      const e = Math.min(1, Math.max(0, front * (this.fine[i] ? 1.4 : 1)));
      this.tmpC.copy(this.raw).lerp(this.spent, e * 0.55).multiplyScalar(this.shade[i]!);
      this.meshes[i % VARIANTS]!.setColorAt(Math.floor(i / VARIANTS), this.tmpC);
    }
    for (const m of this.meshes) if (m.instanceColor) m.instanceColor.needsUpdate = true;
    this.coreMat.color.copy(this.raw).lerp(this.spent, Math.min(1, progress) * 0.25).multiplyScalar(0.62);
  }
}
