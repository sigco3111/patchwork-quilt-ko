// The first scene: a small scrap quilt heaped into a hill on a sewing table, a felt cottage on top (?scene=table).
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { createQuilt } from './quilt.js';
import { createTable, ground, TABLE } from './table.js';
import { createScenery } from './scenery.js';

export async function createWorld({ fabrics, renderer, scene, say, turn }) {
  scene.background = new THREE.Color('#1c1714');
  // the room's soft light from all round, and the lamp on the table for the one that makes shadows
  scene.environment = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.42;
  const lamp = new THREE.DirectionalLight('#ffdcae', 3.5);
  lamp.position.set(15, 24, 13);
  lamp.castShadow = true;
  lamp.shadow.mapSize.set(4096, 4096);
  Object.assign(lamp.shadow.camera, { left: -27, right: 27, top: 22, bottom: -22, near: 2, far: 80 });
  lamp.shadow.bias = -0.0003;
  lamp.shadow.normalBias = 0.025;
  lamp.shadow.radius = 4;
  const rim = new THREE.DirectionalLight('#a8c0ff', 0.75);
  rim.position.set(-14, 9, -20);
  scene.add(lamp, lamp.target, rim);

  say('Sewing the quilt');
  await turn();
  const quilt = createQuilt(fabrics);
  await turn();
  const table = createTable(fabrics);
  const scenery = createScenery(fabrics);
  scene.add(quilt.group, table.group, scenery.group);
  return {
    ground: (x, z) => (Math.abs(x) > TABLE.hw || Math.abs(z) > TABLE.hd ? -30 : ground(x, z)),
    field: { cells: 384, size: 96, centre: [0, 0] },
    colliders: [...table.colliders, ...scenery.colliders], boxes: [scenery.box],
    start: { x: 1.3, z: 8.4, yaw: Math.PI },
    follow: { pitch: 0.16, want: 9.5, side: 1.15, lift: 0.9 },
    lens: { lens: 20, most: 15 },
    far: 400,
    counts: { ...quilt.counts, ...scenery.counts },
    step(n) { scenery.step(n); },
    update() {},
  };
}
