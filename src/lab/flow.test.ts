import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { simulateShot } from '../engine';
import { CoffeeFlow } from './flow';
import { frameAt, ONSET_S, TAIL_S } from './shotFrame';

const shot = simulateShot({
  bean: { robustaShare: 0, roast: 0.45, process: 'washed', daysOffRoast: 14 },
  grind: { particleUm: 300, burr: 'conical' },
  brew: { method: 'espresso', doseG: 18, waterG: 36, tempC: 93, pressureBar: 9, filter: 'metal', profile: 'flat' },
})!;

describe('frameAt (what the spouts show)', () => {
  it('beads first, then a full stream, then a dripping tail', () => {
    const justAfter = frameAt(shot, shot.firstDropS + 0.3);
    expect(justAfter.visualFlow).toBeLessThan(justAfter.flow * 0.2);
    const mid = frameAt(shot, shot.firstDropS + ONSET_S + 2);
    expect(mid.visualFlow).toBeCloseTo(mid.flow, 5);
    const tail = frameAt(shot, shot.timeS + 0.3);
    expect(tail.flow).toBe(0);
    expect(tail.visualFlow).toBeGreaterThan(0);
    expect(frameAt(shot, shot.timeS + TAIL_S + 0.1).visualFlow).toBe(0);
    expect(frameAt(shot, shot.firstDropS - 0.5).visualFlow).toBe(0);
  });

  it('weight and progress grow to the end of the shot', () => {
    expect(frameAt(shot, shot.timeS).weight).toBeCloseTo(36, 0);
    expect(frameAt(shot, shot.timeS).progress).toBe(1);
    expect(frameAt(shot, shot.timeS / 2).weight).toBeLessThan(frameAt(shot, shot.timeS * 0.75).weight);
  });
});

describe('CoffeeFlow', () => {
  const make = () => {
    const scene = new THREE.Scene();
    const flow = new CoffeeFlow(scene, [{ x: -0.5, z: 0 }, { x: 0.5, z: 0 }], -1.4);
    const streams = scene.children.filter((o) => o instanceof THREE.Mesh && o.material instanceof THREE.ShaderMaterial);
    const drips = scene.children.find((o) => o instanceof THREE.InstancedMesh) as THREE.InstancedMesh;
    return { flow, streams, drips };
  };

  it('low flow falls as drops, high flow as a continuous stream', () => {
    const { flow, streams, drips } = make();
    let maxDrops = 0;
    for (let i = 0; i < 60; i++) {
      flow.update(0.3, -8.5, 1 / 30, 0.1);
      maxDrops = Math.max(maxDrops, drips.count);
    }
    expect(streams.every((s) => !s.visible)).toBe(true);
    expect(maxDrops).toBeGreaterThan(0);

    for (let i = 0; i < 60; i++) flow.update(1.6, -8.5, 1 / 30, 0.5);
    expect(streams.every((s) => s.visible)).toBe(true);
    expect(drips.count).toBe(0); // airborne drops have landed, none spawned
  });

  it('nothing moves while paused, and reset clears the air', () => {
    const { flow, drips } = make();
    let i = 0;
    while (drips.count === 0 && i++ < 200) flow.update(0.3, -8.5, 1 / 30, 0.1);
    const n = drips.count;
    expect(n).toBeGreaterThan(0);
    flow.update(0.3, -8.5, 0, 0.1);
    expect(drips.count).toBe(n);
    flow.reset();
    expect(drips.count).toBe(0);
  });
});
