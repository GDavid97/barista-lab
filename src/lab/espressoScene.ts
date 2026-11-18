import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { CoffeeFlow, cremaTexture } from './flow';
import { Grounds } from './grounds';

/**
 * 3D espresso rig driven by the simulation: group head, see-through basket with a
 * particle puck, water drops, twin streams and a filling glass.
 * Units: 1 = 1 cm. The basket floor sits at y = 0.
 */

export interface PuckParams {
  grindUm: number;
  fines: number;
  doseG: number;
  /** 0 (very light) … 1 (very dark). */
  roast: number;
  /** Final beverage weight, sizes the glass fill. */
  yieldG: number;
}

export interface ShotFrame {
  /** Pressure at the puck (bar). */
  pressure: number;
  /** Flow into the cup (g/s). */
  flow: number;
  /** Flow as seen at the spouts (beading onset, dripping tail) – drives the visuals. */
  visualFlow: number;
  /** Beverage in the cup (g). */
  weight: number;
  /** 0 … 1 progress of the whole extraction. */
  progress: number;
  /** Strength of the final drink (%), tints the liquid. */
  tds: number;
  /** Simulated seconds advanced since the previous frame (for drop motion). */
  dt: number;
}

const PARTICLES = 2400;
const DROPS = 140;
const BASKET_R = 2.9;
const BASKET_H = 2.2;
const GLASS_R = 2.5;
const GLASS_H = 6;
const GLASS_Y = -9.2;
const SPOUT_Y = -1.4;

/** Max. camera swing either side of the front view (rad, ≈ 80°). */
const AZIMUTH_LIMIT = Math.PI * 0.44;
/** Auto-rotation sweep speed (rad/s). */
const SWEEP_SPEED = 0.18;
const RESUME_AFTER_MS = 3000;

const c = (hex: string) => new THREE.Color(hex);

export class EspressoScene {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera: THREE.PerspectiveCamera;
  private controls: OrbitControls;
  private clip = new THREE.Plane(new THREE.Vector3(0, 0, -1), 0);
  private clipped: THREE.Material[] = [];
  private resizeObs: ResizeObserver;

  private grounds: Grounds;
  private flow: CoffeeFlow;
  private lastWeight = 0;

  private drops: THREE.InstancedMesh;
  private dropY = new Float32Array(DROPS);
  private dropXZ = new Float32Array(DROPS * 2);

  private liquid: THREE.Mesh;
  private liquidMat: THREE.MeshPhysicalMaterial;
  private crema: THREE.Mesh;
  private showerGlow: THREE.MeshStandardMaterial;
  private yieldG = 36;

  private tmpM = new THREE.Matrix4();
  private tmpQ = new THREE.Quaternion();
  private tmpV = new THREE.Vector3();
  private tmpS = new THREE.Vector3();
  private spherical = new THREE.Spherical();
  private autoRotate = false;
  private interacting = false;
  private lastInteraction = 0;
  private lastFrame = performance.now();
  private sweepDir = 1;

  constructor(private container: HTMLElement) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    this.renderer.localClippingEnabled = true;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    container.appendChild(this.renderer.domElement);

    this.camera = new THREE.PerspectiveCamera(38, 1, 0.1, 200);
    this.camera.position.set(17, 5, 23);
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.target.set(0, -3.6, 0);
    this.controls.enableDamping = true;
    this.controls.minDistance = 7;
    this.controls.maxDistance = 40;
    this.controls.maxPolarAngle = Math.PI * 0.62;
    // The machine body stands behind the rig: only allow front and side views,
    // otherwise the camera swings behind the panel and sees nothing.
    this.controls.minAzimuthAngle = -AZIMUTH_LIMIT;
    this.controls.maxAzimuthAngle = AZIMUTH_LIMIT;
    this.controls.addEventListener('start', () => {
      this.interacting = true;
    });
    this.controls.addEventListener('end', () => {
      this.interacting = false;
      this.lastInteraction = performance.now();
    });

    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    pmrem.dispose();

    this.scene.add(new THREE.HemisphereLight(0xfff1e0, 0x2a1a12, 0.6));
    const key = new THREE.DirectionalLight(0xffe2c4, 2.2);
    key.position.set(8, 14, 10);
    this.scene.add(key);
    const rim = new THREE.PointLight(0xd9935f, 30, 30);
    rim.position.set(-8, 2, -6);
    this.scene.add(rim);

    this.buildMachine();
    this.showerGlow = this.buildShower();
    this.grounds = new Grounds(this.scene, (m) => this.clipMat(m), BASKET_R, PARTICLES, { x: 5.2, y: GLASS_Y - 0.05, z: 1.6 });
    this.drops = this.buildDrops();
    this.flow = new CoffeeFlow(
      this.scene,
      [
        { x: -0.55, z: 0 },
        { x: 0.55, z: 0 },
      ],
      SPOUT_Y,
    );
    ({ liquid: this.liquid, liquidMat: this.liquidMat, crema: this.crema } = this.buildGlass());

    this.resizeObs = new ResizeObserver(() => this.resize());
    this.resizeObs.observe(container);
    this.resize();
  }

  /* ---------------- construction ---------------- */

  private clipMat<T extends THREE.Material>(m: T): T {
    this.clipped.push(m);
    return m;
  }

  private buildMachine() {
    const chrome = this.clipMat(new THREE.MeshStandardMaterial({ color: '#d8d8dc', metalness: 1, roughness: 0.18 }));
    const dark = new THREE.MeshStandardMaterial({ color: '#1c1512', metalness: 0.4, roughness: 0.5 });

    // Group head
    const head = new THREE.Mesh(new THREE.CylinderGeometry(3.4, 3.6, 1.6, 48), chrome);
    head.position.y = BASKET_H + 1.3;
    this.scene.add(head);
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.8, 2.4, 48), chrome);
    neck.position.y = BASKET_H + 3.2;
    this.scene.add(neck);

    // Machine body behind
    const body = new THREE.Mesh(new THREE.BoxGeometry(16, 24, 3), dark);
    body.position.set(0, -2, -6.5);
    this.scene.add(body);

    // Basket (see-through stainless) with a perforated floor
    const basketMat = this.clipMat(
      new THREE.MeshPhysicalMaterial({
        color: '#e9e9ee',
        metalness: 0.9,
        roughness: 0.15,
        transparent: true,
        opacity: 0.28,
        side: THREE.DoubleSide,
        depthWrite: false,
      }),
    );
    const basket = new THREE.Mesh(new THREE.CylinderGeometry(BASKET_R + 0.08, BASKET_R - 0.15, BASKET_H, 64, 1, true), basketMat);
    basket.position.y = BASKET_H / 2;
    basket.renderOrder = 2;
    this.scene.add(basket);
    const floor = new THREE.Mesh(new THREE.CircleGeometry(BASKET_R - 0.15, 64), this.clipMat(new THREE.MeshStandardMaterial({ color: '#9a9aa0', metalness: 1, roughness: 0.35, side: THREE.DoubleSide })));
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -0.01;
    this.scene.add(floor);

    // Portafilter body, spouts and handle
    const pf = new THREE.Mesh(new THREE.CylinderGeometry(BASKET_R + 0.45, BASKET_R - 0.4, 1.1, 48, 1, true), chrome);
    pf.position.y = -0.2;
    this.scene.add(pf);
    const pfBottom = new THREE.Mesh(new THREE.SphereGeometry(BASKET_R - 0.35, 32, 12, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), chrome);
    pfBottom.scale.y = 0.35;
    pfBottom.position.y = -0.7;
    this.scene.add(pfBottom);
    for (const x of [-0.55, 0.55]) {
      const spout = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.14, 0.6, 16), chrome);
      spout.position.set(x, SPOUT_Y + 0.25, 0);
      this.scene.add(spout);
    }
    const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.5, 7, 24), new THREE.MeshStandardMaterial({ color: '#2a1a12', roughness: 0.55 }));
    handle.rotation.z = Math.PI / 2 - 0.12;
    handle.position.set(BASKET_R + 4.2, -0.15, 0);
    this.scene.add(handle);

    // Drip tray
    const tray = new THREE.Mesh(new THREE.BoxGeometry(14, 0.6, 9), new THREE.MeshStandardMaterial({ color: '#2b2b2f', metalness: 0.8, roughness: 0.35 }));
    tray.position.set(0, GLASS_Y - 0.35, -0.5);
    this.scene.add(tray);
    const grid = new THREE.GridHelper(13, 26, 0x55555a, 0x3c3c40);
    grid.position.set(0, GLASS_Y - 0.04, -0.5);
    this.scene.add(grid);
  }

  private buildShower(): THREE.MeshStandardMaterial {
    const mat = new THREE.MeshStandardMaterial({ color: '#cfd6dd', metalness: 0.9, roughness: 0.25, emissive: '#5aa9ff', emissiveIntensity: 0 });
    const screen = new THREE.Mesh(new THREE.CylinderGeometry(BASKET_R - 0.1, BASKET_R - 0.1, 0.12, 48), mat);
    screen.position.y = BASKET_H + 0.45;
    this.scene.add(screen);
    return mat;
  }

  private buildDrops(): THREE.InstancedMesh {
    // Plain transparency, no transmission pass: cheap enough for phones.
    const mat = this.clipMat(
      new THREE.MeshStandardMaterial({ color: '#9fd3ff', roughness: 0.05, metalness: 0.1, transparent: true, opacity: 0.8, emissive: '#2f6fa8', emissiveIntensity: 0.4 }),
    );
    const mesh = new THREE.InstancedMesh(new THREE.SphereGeometry(0.07, 10, 8), mat, DROPS);
    for (let i = 0; i < DROPS; i++) {
      const r = (BASKET_R - 0.4) * Math.sqrt(Math.random());
      const a = Math.random() * Math.PI * 2;
      this.dropXZ[i * 2] = r * Math.cos(a);
      this.dropXZ[i * 2 + 1] = r * Math.sin(a);
      this.dropY[i] = Math.random();
    }
    mesh.count = 0;
    this.scene.add(mesh);
    return mesh;
  }

  private buildGlass() {
    const glassMat = this.clipMat(
      new THREE.MeshPhysicalMaterial({
        color: '#ffffff',
        roughness: 0.05,
        metalness: 0,
        clearcoat: 1,
        transparent: true,
        opacity: 0.22,
        side: THREE.DoubleSide,
        depthWrite: false,
      }),
    );
    const glass = new THREE.Mesh(new THREE.CylinderGeometry(GLASS_R + 0.12, GLASS_R, GLASS_H, 48, 1, true), glassMat);
    glass.position.y = GLASS_Y + GLASS_H / 2;
    glass.renderOrder = 3;
    this.scene.add(glass);
    const base = new THREE.Mesh(new THREE.CylinderGeometry(GLASS_R, GLASS_R, 0.4, 48), glassMat);
    base.position.y = GLASS_Y + 0.2;
    this.scene.add(base);

    const liquidMat = this.clipMat(new THREE.MeshPhysicalMaterial({ color: '#2a140a', roughness: 0.2, transparent: true, opacity: 0.95 }));
    const liquid = new THREE.Mesh(new THREE.CylinderGeometry(GLASS_R - 0.05, GLASS_R - 0.08, 1, 48), liquidMat);
    liquid.position.y = GLASS_Y + 0.4;
    liquid.visible = false;
    this.scene.add(liquid);
    const crema = new THREE.Mesh(
      new THREE.CylinderGeometry(GLASS_R - 0.04, GLASS_R - 0.04, 0.12, 48),
      this.clipMat(new THREE.MeshStandardMaterial({ map: cremaTexture(), roughness: 0.85 })),
    );
    crema.visible = false;
    this.scene.add(crema);
    return { liquid, liquidMat, crema };
  }

  /* ---------------- updates ---------------- */

  setPuck(p: PuckParams) {
    this.yieldG = p.yieldG;
    this.grounds.setPuck(p);
  }

  setFrame(f: ShotFrame) {
    this.grounds.setProgress(f.progress);
    // Scrubbing backwards: drops in the air belong to a later moment.
    if (f.weight < this.lastWeight - 0.5) this.flow.reset();
    this.lastWeight = f.weight;

    // Shower screen glows with pressure; drops rain while water is being pushed.
    this.showerGlow.emissiveIntensity = Math.min(1.2, f.pressure / 8);
    const nDrops = f.pressure > 0.05 && f.progress < 1 ? Math.round(DROPS * Math.min(1, 0.25 + f.pressure / 10)) : 0;
    this.drops.count = nDrops;
    const top = BASKET_H + 0.35;
    const bottom = this.grounds.puckH + 0.02;
    for (let i = 0; i < nDrops; i++) {
      this.dropY[i] = (this.dropY[i]! + f.dt * (0.8 + f.pressure * 0.25)) % 1;
      this.tmpV.set(this.dropXZ[i * 2]!, top - this.dropY[i]! * (top - bottom), this.dropXZ[i * 2 + 1]!);
      this.tmpM.compose(this.tmpV, this.tmpQ.identity(), this.tmpS.setScalar(1));
      this.drops.setMatrixAt(i, this.tmpM);
    }
    this.drops.instanceMatrix.needsUpdate = true;

    // Glass: liquid rises with the weight (1 g ≈ 1 cm³), crema rides on top.
    const area = Math.PI * GLASS_R * GLASS_R;
    const h = Math.min(GLASS_H - 0.6, f.weight / area);
    this.liquid.visible = h > 0.02;
    this.liquid.scale.y = Math.max(0.001, h);
    this.liquid.position.y = GLASS_Y + 0.4 + h / 2;
    this.crema.visible = h > 0.05;
    this.crema.position.y = GLASS_Y + 0.4 + h + 0.05;
    // Crema builds up through the shot.
    this.crema.scale.y = Math.min(1.6, 0.3 + f.progress * 1.3);
    this.crema.rotation.y += f.dt * 0.15;
    // Strong espresso is near-black; later "blonding" lightens the stream.
    const darkness = Math.min(1, f.tds / 10);
    this.liquidMat.color.copy(c('#6b3a1d')).lerp(c('#140804'), darkness);
    const blond = Math.min(1, f.weight / Math.max(1, this.yieldG));
    const surface = this.liquid.visible ? GLASS_Y + 0.4 + h + 0.1 : GLASS_Y + 0.4;
    this.flow.update(f.visualFlow, surface, f.dt, blond);
  }

  setSection(on: boolean) {
    for (const m of this.clipped) {
      m.clippingPlanes = on ? [this.clip] : [];
      m.needsUpdate = true;
    }
  }

  setAutoRotate(on: boolean) {
    this.autoRotate = on;
  }

  /**
   * Auto-rotation sweeps back and forth between the side views instead of
   * circling (OrbitControls' own autoRotate would stall at the azimuth limit).
   * It pauses while the user drags and resumes a few seconds after release.
   */
  private sweep(now: number) {
    const dt = Math.min(0.1, (now - this.lastFrame) / 1000);
    this.lastFrame = now;
    if (!this.autoRotate || this.interacting || now - this.lastInteraction < RESUME_AFTER_MS) return;
    const offset = this.tmpV.copy(this.camera.position).sub(this.controls.target);
    this.spherical.setFromVector3(offset);
    const limit = AZIMUTH_LIMIT * 0.85;
    let theta = this.spherical.theta + this.sweepDir * SWEEP_SPEED * dt;
    if (theta > limit || theta < -limit) {
      this.sweepDir = theta > limit ? -1 : 1;
      theta = Math.max(-limit, Math.min(limit, theta));
    }
    this.spherical.theta = theta;
    offset.setFromSpherical(this.spherical);
    this.camera.position.copy(this.controls.target).add(offset);
  }

  render() {
    this.sweep(performance.now());
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  }

  private resize() {
    const w = Math.max(1, this.container.clientWidth);
    const h = Math.max(1, this.container.clientHeight);
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    // Portrait screens: widen the view so the whole rig still fits.
    this.camera.fov = w / h < 1 ? 52 : 38;
    this.camera.updateProjectionMatrix();
  }

  dispose() {
    this.resizeObs.disconnect();
    this.controls.dispose();
    this.scene.traverse((o) => {
      if (o instanceof THREE.Mesh) {
        o.geometry.dispose();
        const mats = Array.isArray(o.material) ? o.material : [o.material];
        mats.forEach((m) => m.dispose());
      }
    });
    this.scene.environment?.dispose();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}
