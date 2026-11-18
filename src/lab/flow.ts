import * as THREE from 'three';
import { mulberry32 } from './grounds';

/**
 * The coffee leaving the portafilter: twin shader streams with travelling
 * "tiger stripes" and crema bubbles, drips at low flow, and ripples where the
 * coffee lands.
 */

const STREAM_VERTEX = /* glsl */ `
  uniform float uTime;
  uniform float uWobble;
  varying vec2 vUv;
  varying vec3 vN;
  varying vec3 vView;
  void main() {
    vUv = uv;
    vec3 p = position;
    float along = 1.0 - uv.y;               // 0 at the spout, 1 at the cup
    p.xz *= mix(1.0, 0.62, along);          // the stream thins as it accelerates
    p.x += sin(along * 14.0 - uTime * 9.0) * uWobble * along;
    p.z += cos(along * 11.0 - uTime * 7.0) * uWobble * along * 0.6;
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    vN = normalize(normalMatrix * normal);
    vView = normalize(-mv.xyz);
    gl_Position = projectionMatrix * mv;
  }
`;

const STREAM_FRAGMENT = /* glsl */ `
  uniform float uTime;
  uniform vec3 uDark;
  uniform vec3 uLight;
  uniform float uOpacity;
  uniform float uLength;
  uniform float uRadius;
  varying vec2 vUv;
  varying vec3 vN;
  varying vec3 vView;
  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  void main() {
    float along = 1.0 - vUv.y;
    float y = along * uLength;               // world-space distance from the spout (cm)
    // Tiger stripes travel down with the flow.
    float bands = 0.5 + 0.5 * sin(y * 7.0 - uTime * 26.0 + sin(vUv.x * 6.2832) * 1.4);
    float tiger = smoothstep(0.3, 0.8, bands);
    vec3 col = mix(uDark, uLight, tiger * 0.6);
    // Crema micro-bubbles riding the stream: square cells in world units → round bubbles.
    float around = 10.0;
    float cellSize = 6.2832 * uRadius / around;
    vec2 cell = vec2(vUv.x * around, (y - uTime * 4.5) / cellSize);
    vec2 f = fract(cell) - 0.5;
    float pick = step(0.82, hash(floor(cell)));
    float bubble = pick * smoothstep(0.32, 0.18, length(f));
    col = mix(col, uLight * 1.25, bubble * 0.6);
    // Cheap lighting: diffuse + rim + a glossy streak.
    vec3 L = normalize(vec3(0.5, 0.6, 0.7));
    float ndl = clamp(dot(vN, L), 0.0, 1.0);
    float rim = pow(1.0 - abs(dot(vN, vView)), 2.0);
    float spec = pow(max(dot(reflect(-L, vN), vView), 0.0), 28.0);
    col *= 0.5 + 0.65 * ndl;
    col += rim * 0.22 * uLight + spec * 0.55;
    // Edges a little translucent, like a real liquid thread.
    gl_FragColor = vec4(col, uOpacity * (0.86 + 0.14 * tiger) * mix(1.0, 0.72, rim));
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

/** Below this flow (g/s) the stream breaks into drips. */
const STREAM_FLOW = 0.6;
const MAX_DRIPS = 90;
/** Visual gravity (cm/s²) – slowed so drops are visible. */
const GRAVITY = 260;

interface Drip {
  alive: boolean;
  spout: number;
  x: number;
  y: number;
  z: number;
  vy: number;
  r: number;
}

export class CoffeeFlow {
  private streams: THREE.Mesh[] = [];
  private streamMat: THREE.ShaderMaterial;
  private drips: THREE.InstancedMesh;
  private dripMat: THREE.MeshStandardMaterial;
  private pool: Drip[] = [];
  private ripples: THREE.Mesh[] = [];
  private ripplePhase = [0, 0.5];
  private spawnAcc = [0, 0];
  private time = 0;
  private rnd = mulberry32(3);
  private tmpM = new THREE.Matrix4();
  private tmpQ = new THREE.Quaternion();
  private tmpV = new THREE.Vector3();
  private tmpS = new THREE.Vector3();

  constructor(
    scene: THREE.Scene,
    private readonly spouts: { x: number; z: number }[],
    private readonly spoutY: number,
  ) {
    this.streamMat = new THREE.ShaderMaterial({
      vertexShader: STREAM_VERTEX,
      fragmentShader: STREAM_FRAGMENT,
      transparent: true,
      depthWrite: false,
      uniforms: {
        uTime: { value: 0 },
        uWobble: { value: 0.35 },
        uDark: { value: new THREE.Color('#2a1208') },
        uLight: { value: new THREE.Color('#c88a52') },
        uOpacity: { value: 0.95 },
        uLength: { value: 6 },
        uRadius: { value: 0.05 },
      },
    });
    for (const s of spouts) {
      const m = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 1, 18, 48, true), this.streamMat);
      m.position.set(s.x, 0, s.z);
      m.visible = false;
      m.renderOrder = 4;
      this.streams.push(m);
      scene.add(m);
    }

    this.dripMat = new THREE.MeshStandardMaterial({ color: '#3a1a0b', roughness: 0.15, metalness: 0.05 });
    this.drips = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 12, 10), this.dripMat, MAX_DRIPS);
    this.drips.count = 0;
    scene.add(this.drips);
    for (let i = 0; i < MAX_DRIPS; i++) this.pool.push({ alive: false, spout: 0, x: 0, y: 0, z: 0, vy: 0, r: 0 });

    const ringMat = new THREE.MeshBasicMaterial({ color: '#e7c39b', transparent: true, opacity: 0, depthWrite: false });
    for (const s of spouts) {
      const ring = new THREE.Mesh(new THREE.RingGeometry(0.75, 1, 40), ringMat.clone());
      ring.rotation.x = -Math.PI / 2;
      ring.position.set(s.x, 0, s.z);
      ring.visible = false;
      this.ripples.push(ring);
      scene.add(ring);
    }
  }

  /**
   * @param flow    current flow (g/s)
   * @param surfaceY height of the liquid surface (cm)
   * @param dt      simulated seconds since the last frame (0 when paused)
   * @param blond   0 … 1, how far into the shot (stream lightens)
   */
  update(flow: number, surfaceY: number, dt: number, blond: number) {
    this.time += dt;
    const u = this.streamMat.uniforms;
    u.uTime!.value = this.time;
    // Early: dark, syrupy; late: "blonding" towards pale caramel.
    (u.uDark!.value as THREE.Color).set('#2a1208').lerp(new THREE.Color('#8a5228'), blond * blond);
    (u.uLight!.value as THREE.Color).set('#b97a45').lerp(new THREE.Color('#e9c08c'), blond);
    this.dripMat.color.copy(u.uDark!.value as THREE.Color).lerp(u.uLight!.value as THREE.Color, 0.35);

    const len = this.spoutY - surfaceY;
    const continuous = flow >= STREAM_FLOW && len > 0.1;
    u.uLength!.value = len;
    const r = 0.028 + Math.sqrt(Math.max(0, flow)) * 0.042;
    u.uRadius!.value = r;
    for (const s of this.streams) {
      s.visible = continuous;
      s.scale.set(r, Math.max(0.01, len), r);
      s.position.y = surfaceY + len / 2;
    }

    // Drips: below the stream threshold the flow arrives as beads.
    if (dt > 0 && flow > 0.01 && !continuous) {
      this.spouts.forEach((_, si) => {
        this.spawnAcc[si] = this.spawnAcc[si]! + dt * flow * 14;
        while (this.spawnAcc[si]! >= 1) {
          this.spawnAcc[si] = this.spawnAcc[si]! - 1;
          this.spawn(si, flow);
        }
      });
    }
    this.stepDrips(dt, surfaceY);

    // Ripples where the coffee lands.
    this.ripples.forEach((ring, i) => {
      const active = flow > 0.01 && len > 0.1;
      ring.visible = active;
      if (!active) return;
      this.ripplePhase[i] = (this.ripplePhase[i]! + dt * (continuous ? 2.2 : 1.2)) % 1;
      const ph = this.ripplePhase[i]!;
      const scale = 0.12 + ph * (continuous ? 0.9 : 0.6);
      ring.scale.set(scale, scale, 1);
      ring.position.y = surfaceY + 0.02;
      (ring.material as THREE.MeshBasicMaterial).opacity = (1 - ph) * 0.55;
    });
  }

  private spawn(spout: number, flow: number) {
    const d = this.pool.find((p) => !p.alive);
    if (!d) return;
    const s = this.spouts[spout]!;
    d.alive = true;
    d.spout = spout;
    d.x = s.x + (this.rnd() - 0.5) * 0.06;
    d.z = s.z + (this.rnd() - 0.5) * 0.06;
    d.y = this.spoutY - 0.05;
    d.vy = -(5 + flow * 20);
    d.r = 0.055 + Math.min(0.05, flow * 0.06) + this.rnd() * 0.02;
  }

  private stepDrips(dt: number, surfaceY: number) {
    let n = 0;
    const steps = Math.max(1, Math.ceil(dt / 0.02));
    const h = dt / steps;
    for (const d of this.pool) {
      if (!d.alive) continue;
      for (let k = 0; k < steps; k++) {
        d.vy -= GRAVITY * h;
        d.y += d.vy * h;
      }
      if (d.y <= surfaceY) {
        d.alive = false;
        this.ripplePhase[d.spout] = 0; // each landing drop starts a fresh ripple
        continue;
      }
      // Drops stretch as they speed up.
      const stretch = 1 + Math.min(1.4, -d.vy / 120);
      this.tmpV.set(d.x, d.y, d.z);
      this.tmpS.set(d.r / Math.sqrt(stretch), d.r * stretch, d.r / Math.sqrt(stretch));
      this.tmpM.compose(this.tmpV, this.tmpQ.identity(), this.tmpS);
      this.drips.setMatrixAt(n++, this.tmpM);
    }
    this.drips.count = n;
    this.drips.instanceMatrix.needsUpdate = true;
  }

  /** Restart: clear airborne drops (e.g. when the shot is replayed). */
  reset() {
    for (const d of this.pool) d.alive = false;
    this.drips.count = 0;
    this.time = 0;
  }
}

/** Mottled, bubbly crema texture drawn once on a canvas. */
export function cremaTexture(): THREE.CanvasTexture {
  const size = 256;
  const cv = document.createElement('canvas');
  cv.width = cv.height = size;
  const g = cv.getContext('2d')!;
  const grad = g.createRadialGradient(size / 2, size / 2, size * 0.05, size / 2, size / 2, size / 2);
  grad.addColorStop(0, '#c99263');
  grad.addColorStop(0.7, '#a86a3c');
  grad.addColorStop(1, '#6e3c1f');
  g.fillStyle = grad;
  g.fillRect(0, 0, size, size);
  const rnd = mulberry32(11);
  // Tiger mottling.
  for (let i = 0; i < 260; i++) {
    const r = 4 + rnd() * 18;
    g.fillStyle = rnd() < 0.5 ? `rgba(70,32,12,${0.08 + rnd() * 0.18})` : `rgba(230,190,140,${0.06 + rnd() * 0.16})`;
    g.beginPath();
    g.ellipse(rnd() * size, rnd() * size, r, r * (0.4 + rnd() * 0.6), rnd() * Math.PI, 0, Math.PI * 2);
    g.fill();
  }
  // Tiny bubbles.
  for (let i = 0; i < 500; i++) {
    const r = 0.6 + rnd() * 2.2;
    g.strokeStyle = `rgba(255,235,205,${0.15 + rnd() * 0.3})`;
    g.lineWidth = 0.6;
    g.beginPath();
    g.arc(rnd() * size, rnd() * size, r, 0, Math.PI * 2);
    g.stroke();
  }
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
