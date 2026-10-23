import * as THREE from "three";

const ROOM = { minX: -8.9, maxX: 8.9, minZ: -51, maxZ: 18, floor: 0, ceiling: 8.4 };

function seededRandom(seed) {
  let value = seed >>> 0;
  return () => {
    value = (value * 1664525 + 1013904223) >>> 0;
    return value / 4294967296;
  };
}

function makeNoiseTexture(base, seed, size = 256) {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, size, size);
  const rnd = seededRandom(seed);
  for (let i = 0; i < 30000; i++) {
    const alpha = rnd() * 0.13;
    const shade = rnd() > 0.5 ? 255 : 0;
    ctx.fillStyle = "rgba(" + shade + "," + shade + "," + shade + "," + alpha + ")";
    const w = 1 + rnd() * 2;
    ctx.fillRect(rnd() * size, rnd() * size, w, w);
  }
  for (let i = 0; i < 18; i++) {
    ctx.fillStyle = "rgba(4,10,12," + (0.025 + rnd() * 0.035) + ")";
    ctx.fillRect(rnd() * size, rnd() * size, size * (0.05 + rnd() * 0.15), 1 + rnd() * 3);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.anisotropy = 4;
  return texture;
}

function makeSignTexture(title, detail, accent) {
  const canvas = document.createElement("canvas");
  canvas.width = 768;
  canvas.height = 256;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#071418";
  ctx.fillRect(0, 0, 768, 256);
  ctx.fillStyle = accent;
  ctx.fillRect(0, 0, 12, 256);
  ctx.strokeStyle = "rgba(185,235,225,.24)";
  ctx.lineWidth = 3;
  ctx.strokeRect(19, 18, 730, 220);
  ctx.fillStyle = accent;
  ctx.font = "700 68px Segoe UI, sans-serif";
  ctx.fillText(title, 45, 113);
  ctx.fillStyle = "#d6e5df";
  ctx.font = "500 25px Segoe UI, sans-serif";
  ctx.fillText(detail, 48, 174);
  ctx.fillStyle = "rgba(220,245,238,.48)";
  ctx.font = "18px monospace";
  ctx.fillText("MUMBAI  /  SIGNAL NETWORK", 48, 216);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function mat(color, options = {}) {
  return new THREE.MeshStandardMaterial({
    color,
    roughness: options.roughness ?? 0.82,
    metalness: options.metalness ?? 0.05,
    emissive: options.emissive ?? 0x000000,
    emissiveIntensity: options.emissiveIntensity ?? 0,
    transparent: options.transparent ?? false,
    opacity: options.opacity ?? 1,
    side: options.side ?? THREE.FrontSide,
    map: options.map ?? null
  });
}

function boxMesh(root, name, x, y, z, w, h, d, material, cast = true, receive = true) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
  mesh.name = name;
  mesh.position.set(x, y, z);
  mesh.castShadow = cast;
  mesh.receiveShadow = receive;
  root.add(mesh);
  return mesh;
}

function planeMesh(root, name, x, y, z, w, d, material, rotationX = -Math.PI / 2) {
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, d), material);
  mesh.name = name;
  mesh.rotation.x = rotationX;
  mesh.position.set(x, y, z);
  mesh.receiveShadow = true;
  root.add(mesh);
  return mesh;
}

function addSign(root, text, line, accent, x, y, z, width = 4.2) {
  const signMaterial = new THREE.MeshBasicMaterial({
    map: makeSignTexture(text, line, accent),
    side: THREE.DoubleSide,
    toneMapped: false
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, width * 0.33), signMaterial);
  mesh.position.set(x, y, z);
  root.add(mesh);
  const frame = mat(0x202b2b, { metalness: 0.55, roughness: 0.45 });
  boxMesh(root, "sign-frame", x, y + width * 0.18, z + 0.035, width + 0.16, 0.08, 0.12, frame, false);
  return mesh;
}

function addFloor(root, floors, x, z, width, depth, y, material, phase = "solid", name = "walkway") {
  const mesh = planeMesh(root, name, x, y, z, width, depth, material);
  floors.push({ x, z, width, depth, y, phase, mesh, kind: "floor" });
  return mesh;
}

function addCeilingPath(root, ceilings, x, z, width, depth, y, material, phase = "solid") {
  const mesh = planeMesh(root, "inverted-route", x, y, z, width, depth, material, Math.PI / 2);
  mesh.material = material.clone();
  mesh.material.side = THREE.DoubleSide;
  ceilings.push({ x, z, width, depth, y, phase, mesh, kind: "ceiling" });
  return mesh;
}

function createShard(root, x, y, z, accent, phase = "solid") {
  const group = new THREE.Group();
  group.position.set(x, y, z);
  group.userData.baseY = y;
  group.userData.phase = phase;
  const crystalMaterial = mat(accent, { roughness: 0.22, metalness: 0.25, emissive: accent, emissiveIntensity: 2.1 });
  const crystal = new THREE.Mesh(new THREE.OctahedronGeometry(0.38, 0), crystalMaterial);
  crystal.rotation.set(0.15, 0.4, 0.1);
  crystal.castShadow = true;
  group.add(crystal);
  const halo = new THREE.Mesh(
    new THREE.TorusGeometry(0.58, 0.027, 8, 42),
    new THREE.MeshBasicMaterial({ color: accent, transparent: true, opacity: 0.76 })
  );
  halo.rotation.x = Math.PI / 2;
  group.add(halo);
  const light = new THREE.PointLight(accent, 1.3, 4.5, 2);
  light.position.y = 0.16;
  group.add(light);
  root.add(group);
  return { group, position: new THREE.Vector3(x, y, z), phase, collected: false };
}

function createTrain(root, accent, z) {
  const train = new THREE.Group();
  train.position.set(0, 1.45, z);
  const body = mat(0x29383a, { roughness: 0.36, metalness: 0.52 });
  const stripe = mat(0xe9d4a7, { roughness: 0.48, metalness: 0.26 });
  const glass = mat(0x07151a, { roughness: 0.14, metalness: 0.5, emissive: 0x2f7981, emissiveIntensity: 0.4 });
  const trim = mat(accent, { roughness: 0.24, metalness: 0.5, emissive: accent, emissiveIntensity: 2.4 });
  boxMesh(train, "local-carriage", 0, 0, 0, 15.5, 2.25, 2.15, body);
  boxMesh(train, "local-band", 0, -0.55, 1.09, 15.35, 0.25, 0.06, stripe, false);
  boxMesh(train, "local-light", 0, 0.95, 1.1, 15.1, 0.045, 0.05, trim, false);
  for (let i = -6; i <= 6; i += 2) {
    boxMesh(train, "train-window", i, 0.35, 1.105, 1.5, 0.86, 0.045, glass, false);
    boxMesh(train, "window-frame", i - 0.78, 0.35, 1.13, 0.055, 0.95, 0.035, trim, false);
  }
  for (const end of [-1, 1]) {
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.12, 10, 8), mat(0xffcf88, { emissive: 0xff8a4d, emissiveIntensity: 3 }));
    lamp.position.set(end * 7.4, -0.68, 1.12);
    train.add(lamp);
  }
  root.add(train);
  return { group: train, z, phase: 0, halfW: 7.85, halfD: 1.2 };
}

function createPortal(root, accent, z) {
  const portal = new THREE.Group();
  portal.position.set(0, 2.5, z);
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(1.85, 0.12, 18, 84),
    mat(accent, { roughness: 0.18, metalness: 0.35, emissive: accent, emissiveIntensity: 3.2 })
  );
  ring.castShadow = true;
  portal.add(ring);
  const inner = new THREE.Mesh(
    new THREE.CircleGeometry(1.72, 48),
    new THREE.MeshBasicMaterial({ color: accent, transparent: true, opacity: 0.13, side: THREE.DoubleSide, depthWrite: false })
  );
  inner.position.z = -0.02;
  portal.add(inner);
  const halo = new THREE.PointLight(accent, 2.4, 11, 2);
  halo.position.set(0, 0, 1);
  portal.add(halo);
  root.add(portal);
  return { group: portal, collider: null, open: false };
}

function addPuddle(root, x, z, rx, rz, tint) {
  const puddleMaterial = mat(tint, { roughness: 0.12, metalness: 0.68, transparent: true, opacity: 0.47, emissive: tint, emissiveIntensity: 0.08, side: THREE.DoubleSide });
  const puddle = new THREE.Mesh(new THREE.CircleGeometry(1, 32), puddleMaterial);
  puddle.rotation.x = -Math.PI / 2;
  puddle.scale.set(rx, rz, 1);
  puddle.position.set(x, 0.012, z);
  root.add(puddle);
  return puddle;
}

function addCityBackdrop(root, seed, accent) {
  const rnd = seededRandom(seed);
  const buildingMat = mat(0x253239, { roughness: 0.9 });
  const darkMat = mat(0x161f25, { roughness: 0.9 });
  const windowMat = mat(accent, { roughness: 0.3, emissive: accent, emissiveIntensity: 1.3 });
  for (let side of [-1, 1]) {
    for (let i = 0; i < 12; i++) {
      const z = -49 + i * 6.1;
      const x = side * (10.8 + rnd() * 2.5);
      const h = 5 + rnd() * 10;
      const w = 2.6 + rnd() * 3.2;
      const d = 4.1 + rnd() * 2.7;
      const shell = boxMesh(root, "city-block", x, h / 2 - 0.2, z, w, h, d, i % 3 === 0 ? darkMat : buildingMat, false);
      shell.userData.noninteractive = true;
      for (let row = 0; row < Math.min(4, Math.floor(h / 2)); row++) {
        for (let col = 0; col < 2; col++) {
          if (rnd() > 0.48) {
            const wx = x + (col ? 0.57 : -0.57) * w * 0.55;
            boxMesh(root, "city-window", wx, 0.8 + row * 1.55, z + d / 2 + 0.015, 0.28, 0.55, 0.045, windowMat, false, false);
          }
        }
      }
    }
  }
}

function addStationDetails(root, accent, warm) {
  const column = mat(0x3c4140, { roughness: 0.65, metalness: 0.2 });
  const trim = mat(0x171f21, { roughness: 0.55, metalness: 0.55 });
  const bench = mat(0x314342, { roughness: 0.66, metalness: 0.32 });
  for (let z = 9; z >= -45; z -= 9) {
    for (const x of [-7.1, 7.1]) {
      boxMesh(root, "platform-column", x, 3.5, z, 0.62, 7, 0.74, column);
      boxMesh(root, "column-base", x, 0.28, z, 0.95, 0.56, 1.0, trim);
      boxMesh(root, "column-signal", x, 5.9, z + 0.41, 0.12, 1.1, 0.05, mat(accent, { emissive: accent, emissiveIntensity: 2.2 }), false, false);
    }
    const lightStrip = mat(warm, { emissive: warm, emissiveIntensity: 2.1 });
    boxMesh(root, "station-strip", 0, 7.6, z, 13.5, 0.07, 0.09, lightStrip, false, false);
  }
  for (const z of [6, -2, -38]) {
    boxMesh(root, "bench-seat", -5.1, 0.76, z, 2.5, 0.12, 0.55, bench);
    boxMesh(root, "bench-back", -5.1, 1.22, z - 0.22, 2.5, 0.78, 0.12, bench);
    for (const x of [-6, -4.2]) boxMesh(root, "bench-leg", x, 0.39, z, 0.1, 0.7, 0.12, trim);
  }
  addSign(root, "DADAR", "PLATFORM 04  →  CHURCHGATE", "#8ef5d6", 0, 7.35, -4.4, 5.4);
  addSign(root, "CHURCHGATE", "LOCAL  /  00:00  /  SIGNAL LOST", "#ffb46f", -6.5, 3.3, -35, 3.6);
}

function addCoastalDetails(root, accent, warm) {
  const stone = mat(0x526264, { roughness: 0.76, metalness: 0.12 });
  const carved = mat(0x83928a, { roughness: 0.72, metalness: 0.15 });
  for (const z of [8, -2, -33, -43]) {
    for (const x of [-7.4, 7.4]) {
      const arch = new THREE.Group();
      arch.position.set(x, 0, z);
      boxMesh(arch, "sea-arch-post", 0, 2.15, 0, 0.65, 4.3, 0.65, stone);
      boxMesh(arch, "sea-arch-cap", 0, 4.45, 0, 1.4, 0.32, 0.95, carved);
      boxMesh(arch, "sea-arch-light", 0, 4.1, 0.35, 0.12, 0.12, 0.04, mat(warm, { emissive: warm, emissiveIntensity: 2.6 }), false, false);
      root.add(arch);
    }
  }
  const canopy = mat(0x1c2b30, { roughness: 0.46, metalness: 0.46 });
  for (let z = 15; z > -47; z -= 7.5) {
    boxMesh(root, "causeway-beam", 0, 8.15, z, 14.5, 0.22, 0.32, canopy);
    for (const x of [-6.8, 6.8]) {
      boxMesh(root, "causeway-cable", x, 7.55, z, 0.12, 1.1, 0.13, mat(accent, { emissive: accent, emissiveIntensity: 1.2 }), false, false);
    }
  }
}

function addDharaviDetails(root, accent, warm) {
  const plaster = mat(0x534849, { roughness: 0.92 });
  const awning = mat(0x855e55, { roughness: 0.8 });
  const balcony = mat(0x202b30, { roughness: 0.52, metalness: 0.48 });
  const light = mat(warm, { emissive: warm, emissiveIntensity: 1.8 });
  const rnd = seededRandom(312);
  for (let z = 12; z > -48; z -= 5.5) {
    for (const side of [-1, 1]) {
      const x = side * (7.65 + rnd() * 0.45);
      const h = 5.4 + rnd() * 2.9;
      boxMesh(root, "chawl-facade", x, h / 2, z, 2.0, h, 5.1, plaster, false);
      boxMesh(root, "chawl-balcony", x - side * 1.0, 2.8, z, 0.25, 1.9, 4.1, balcony, false);
      boxMesh(root, "chawl-awning", x - side * 1.2, 4.15, z, 0.58, 0.12, 2.2, awning, false);
      for (let floor = 0; floor < 3; floor++) {
        const window = boxMesh(root, "chawl-window", x - side * 1.04, 1.45 + floor * 1.58, z + (rnd() - 0.5) * 2.2, 0.08, 0.75, 0.95, rnd() > 0.5 ? light : balcony, false, false);
        if (window.material === light) window.material = light.clone();
      }
      for (const rod of [-1.2, 1.2]) {
        boxMesh(root, "laundry-line", x - side * 1.45, 5.45, z + rod, 0.025, 0.025, 1.7, balcony, false, false);
        const cloth = mat(rnd() > 0.5 ? 0x886b67 : 0x52756e, { roughness: 0.94 });
        boxMesh(root, "laundry", x - side * 1.45, 5.1, z + rod, 0.035, 0.62, 0.42, cloth, false, false);
      }
      if (z % 11 < 1) addSign(root, side < 0 ? "MACHHI GALLI" : "CROSS LANE", "DHARAVI  /  WARD 173", "#f0a1ff", x - side * 1.35, 6.5, z + 2.2, 3.3);
    }
  }
  for (const x of [-5.9, 5.9]) {
    const waterTank = new THREE.Mesh(new THREE.CylinderGeometry(0.58, 0.58, 0.75, 14), balcony);
    waterTank.position.set(x, 7.3, -28);
    root.add(waterTank);
  }
  addSign(root, "KUMBHARWADA", "THE LANE IS NOT HERE", "#f0a1ff", 0, 6.7, -7, 5.0);
}

function addSeaLinkDetails(root, accent, warm) {
  const steel = mat(0x263640, { roughness: 0.43, metalness: 0.65 });
  const cable = mat(0x84969a, { roughness: 0.38, metalness: 0.75 });
  const rnd = seededRandom(411);
  for (const z of [6, -17, -40]) {
    const tower = new THREE.Group();
    tower.position.set(0, 0, z);
    for (const x of [-4.2, 4.2]) {
      boxMesh(tower, "bridge-pylon", x, 5.25, 0, 0.68, 10.5, 0.82, steel);
      boxMesh(tower, "bridge-crossbeam", 0, 9.35, 0, 8.8, 0.48, 0.72, steel);
      for (const side of [-1, 1]) {
        for (let i = 0; i < 5; i++) {
          const startX = x;
          const endX = side * (8.4 + i * 0.18);
          const cableMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 1, 5), cable);
          const a = new THREE.Vector3(startX, 9.0, 0);
          const b = new THREE.Vector3(endX, 3.1 + i * 0.45, 0);
          cableMesh.position.copy(a).add(b).multiplyScalar(0.5);
          cableMesh.scale.y = a.distanceTo(b);
          cableMesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.sub(a).normalize());
          tower.add(cableMesh);
        }
      }
    }
    root.add(tower);
  }
  for (let i = 0; i < 20; i++) {
    const x = (rnd() - 0.5) * 240;
    const z = -50 + rnd() * 75;
    const light = new THREE.Mesh(new THREE.SphereGeometry(0.045 + rnd() * 0.045, 6, 6), mat(rnd() > 0.5 ? warm : accent, { emissive: rnd() > 0.5 ? warm : accent, emissiveIntensity: 1.5 }));
    light.position.set(x, 0.3 + rnd() * 2.4, z);
    root.add(light);
  }
  const sea = planeMesh(root, "arabian-sea", 0, -0.8, -17, 170, 100, mat(0x09202a, { roughness: 0.17, metalness: 0.72, transparent: true, opacity: 0.74, side: THREE.DoubleSide }));
  sea.rotation.x = -Math.PI / 2;
  for (const x of [-8.9, 8.9]) {
    for (let i = 0; i < 12; i++) {
      const light = boxMesh(root, "bridge-lane-light", x, 0.24, 14 - i * 5.2, 0.12, 0.07, 0.55, mat(accent, { emissive: accent, emissiveIntensity: 2.2 }), false, false);
      light.userData.flicker = Math.random() * 10;
    }
  }
}

function addHazardTrack(root, z, accent) {
  const rail = mat(0x657477, { roughness: 0.44, metalness: 0.73 });
  const sleeper = mat(0x282f32, { roughness: 0.9 });
  for (const x of [-1.0, 1.0]) {
    const line = boxMesh(root, "track-rail", 0, 0.045, z + x, 18.5, 0.1, 0.11, rail, false);
    line.castShadow = false;
  }
  for (let x = -8.5; x <= 8.5; x += 1.5) {
    boxMesh(root, "track-sleeper", x, 0.01, z, 0.28, 0.055, 2.75, sleeper, false);
  }
  for (const x of [-9.0, 9.0]) {
    boxMesh(root, "track-signal-post", x, 2.0, z, 0.15, 4.0, 0.15, mat(0x394347, { metalness: 0.6 }), false);
    const signal = new THREE.Mesh(new THREE.SphereGeometry(0.17, 10, 8), mat(accent, { emissive: accent, emissiveIntensity: 2.2 }));
    signal.position.set(x, 3.65, z);
    root.add(signal);
  }
}

function addPulseGate(root, pulseGates, z, accent, options = {}) {
  const group = new THREE.Group();
  group.position.z = z;
  const width = 16.4;
  const frame = mat(0x354448, { roughness: 0.44, metalness: 0.62 });
  const warningStripe = mat(0xffbc62, { roughness: 0.34, metalness: 0.12, emissive: 0x713416, emissiveIntensity: 0.8 });
  const beamMaterial = mat(0xff3655, { roughness: 0.24, metalness: 0.12, emissive: 0xff2445, emissiveIntensity: 0.45, transparent: true, opacity: 0.12, side: THREE.DoubleSide });
  for (const x of [-8.12, 8.12]) {
    boxMesh(group, "arc-gate-pylon", x, 2.0, 0, 0.38, 4.0, 0.42, frame);
    boxMesh(group, "arc-gate-warning", x, 0.28, 0.23, 0.42, 0.16, 0.08, warningStripe, false, false);
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.13, 10, 8), mat(accent, { emissive: accent, emissiveIntensity: 0.7 }));
    lamp.position.set(x, 4.18, 0);
    group.add(lamp);
  }
  const beam = boxMesh(group, "pulse-arc", 0, 2.1, 0, width, 3.72, 0.12, beamMaterial, false, false);
  const floorMark = boxMesh(group, "arc-gate-floor-mark", 0, 0.035, 0.45, 16.2, 0.025, 0.22, warningStripe, false, false);
  const status = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 8), mat(0xff3655, { emissive: 0xff2445, emissiveIntensity: 0.65 }));
  status.position.set(0, 4.35, 0);
  group.add(status);
  const statusLight = new THREE.PointLight(0xff3655, 0.35, 8, 2);
  statusLight.position.set(0, 3.4, 1.1);
  group.add(statusLight);
  root.add(group);
  pulseGates.push({
    group, beam, floorMark, status, statusLight, x: 0, z, width, halfDepth: 0.34,
    yMin: 0.05, yMax: 4.0, phase: options.phase || "solid",
    clock: options.offset || 0, period: options.period || 4.8,
    activeFor: options.activeFor || 2.65, respawnZ: options.respawnZ ?? null,
    active: false, accent
  });
}

function addBarricade(root, colliders, x, z, width = 12.8) {
  const bodyMat = mat(0xe07a3d, { roughness: 0.56, metalness: 0.16, emissive: 0x34150a, emissiveIntensity: 0.35 });
  const stripeMat = mat(0xf6e2b9, { roughness: 0.38, metalness: 0.24, emissive: 0x44301a, emissiveIntensity: 0.28 });
  const body = boxMesh(root, "monsoon-barricade", x, 0.56, z, width, 1.05, 0.42, bodyMat);
  body.userData.challengeObstacle = true;
  for (let offset = -width / 2 + 0.45; offset < width / 2 - 0.3; offset += 1.2) {
    const stripe = boxMesh(root, "barricade-reflector", x + offset, 0.56, z + 0.225, 0.38, 0.82, 0.035, stripeMat, false, false);
    stripe.rotation.z = -0.42;
  }
  for (const offset of [-width / 2 + 0.32, width / 2 - 0.32]) {
    boxMesh(root, "barricade-foot", x + offset, 0.12, z, 0.62, 0.24, 0.9, mat(0x242b2d, { metalness: 0.48 }), false);
  }
  colliders.push({ x, z, w: width, d: 0.52, yMin: 0, yMax: 1.08, phase: "solid", active: true });
}

function addCeilingObstacle(root, colliders, x, z) {
  const shell = mat(0x303c3f, { roughness: 0.42, metalness: 0.58, emissive: 0x10292c, emissiveIntensity: 0.35 });
  const glow = mat(0xff7955, { roughness: 0.26, emissive: 0xff3a34, emissiveIntensity: 1.25 });
  const y = ROOM.ceiling - 0.86;
  boxMesh(root, "ceiling-route-obstacle", x, y, z, 2.0, 1.52, 1.55, shell);
  boxMesh(root, "ceiling-obstacle-signal", x, y - 0.78, z + 0.02, 1.35, 0.08, 0.12, glow, false, false);
  colliders.push({ x, z, w: 2.05, d: 1.62, yMin: ROOM.ceiling - 1.62, yMax: ROOM.ceiling + 0.05, phase: "solid", active: true });
}
export function buildWorld(root, levelIndex) {
  const config = [
    { seed: 110, sign: ["DADAR", "PLATFORM 04 → CHURCHGATE"], gap: null, echo: null, gravity: false, train: -14, barricades: [[-1.7, -4.2, 12.9], [1.7, -18.2, 12.9], [-1.7, -27.1, 12.9]], ceilingObstacles: [], pulseGates: [{ z: -8, offset: 0.9, period: 4.7, activeFor: 2.4 }, { z: -33, offset: 2.8, period: 4.5, activeFor: 2.25 }] },
    { seed: 207, sign: ["HAJI ALI", "CAUSEWAY  /  HIGH TIDE"], gap: [-16, -27], echo: null, gravity: true, train: null, barricades: [[1.7, -7.2, 12.9], [-1.7, -32.4, 12.9], [1.7, -43.5, 12.9]], ceilingObstacles: [[-2.2, -19.2], [2.2, -24.4]], pulseGates: [{ z: -11, offset: 0.4, period: 4.6, activeFor: 2.35 }, { z: -37, offset: 2.1, period: 4.5, activeFor: 2.2 }] },
    { seed: 312, sign: ["DHARAVI", "WARD 173  /  CROSS LANE"], gap: [-19, -31], echo: [-19, -31], gravity: false, train: null, barricades: [[-1.7, -7.5, 12.9], [1.7, -35.4, 12.9], [-1.7, -42.7, 12.9]], ceilingObstacles: [], pulseGates: [{ z: -12, offset: 0.6, period: 4.6, activeFor: 2.25 }, { z: -21.4, offset: 1.5, period: 4.4, activeFor: 2.1, phase: "echo", respawnZ: -17 }, { z: -28, offset: 2.7, period: 4.3, activeFor: 2.05, phase: "echo", respawnZ: -17 }] },
    { seed: 411, sign: ["SEA LINK", "BANDRA → WORLI  /  LOOP 04"], gap: [-18, -27], echo: [-34, -42], gravity: true, train: -10, barricades: [[1.7, -4.2, 12.9], [-1.7, -13.1, 12.9], [-1.7, -30.4, 12.9]], ceilingObstacles: [[-2.4, -22.4], [2.8, -24.8], [-2.0, -26]], pulseGates: [{ z: -2.2, offset: 1.3, period: 4.5, activeFor: 2.2 }, { z: -15, offset: 0.8, period: 4.4, activeFor: 2.0 }, { z: -37.2, offset: 2.4, period: 4.3, activeFor: 1.95, phase: "echo", respawnZ: -32 }, { z: -40.2, offset: 0.7, period: 4.2, activeFor: 1.9, phase: "echo", respawnZ: -32 }] }
  ][levelIndex];

  const palette = [
    { accent: 0x8ef5d6, warm: 0xffb46f, fog: 0x101b27, sky: 0x09121c },
    { accent: 0x89e8f3, warm: 0xffcf81, fog: 0x10232b, sky: 0x071820 },
    { accent: 0xf0a1ff, warm: 0xffbb77, fog: 0x1e1825, sky: 0x110d1b },
    { accent: 0x8ef5d6, warm: 0xffb46f, fog: 0x101b29, sky: 0x07111e }
  ][levelIndex];

  const rnd = seededRandom(config.seed);
  const floors = [];
  const ceilings = [];
  const colliders = [];
  const collectibles = [];
  const pulseGates = [];
  const phaseMeshes = [];
  const accentMat = mat(palette.accent, { roughness: 0.23, metalness: 0.25, emissive: palette.accent, emissiveIntensity: 2.15 });
  const darkConcrete = mat(0x253135, { roughness: 0.88, map: makeNoiseTexture("#263337", config.seed) });
  const floorMaterial = mat(0xffffff, { roughness: 0.32, metalness: 0.2, map: makeNoiseTexture("#596264", config.seed + 4) });
  floorMaterial.map.repeat.set(4, 22);
  const wallMaterial = mat(0xffffff, { roughness: 0.94, map: makeNoiseTexture("#343c3c", config.seed + 8) });
  wallMaterial.map.repeat.set(2, 9);
  const roofMaterial = mat(0xffffff, { roughness: 0.92, map: makeNoiseTexture("#253236", config.seed + 12) });
  const lampMaterial = mat(palette.warm, { emissive: palette.warm, emissiveIntensity: 2.8, roughness: 0.3 });

  root.userData.palette = palette;
  root.userData.floors = floors;
  root.userData.ceilings = ceilings;
  root.userData.colliders = colliders;
  root.userData.collectibles = collectibles;
  root.userData.pulseGates = pulseGates;
  root.userData.phaseMeshes = phaseMeshes;
  root.userData.timeFrozen = false;

  // Wet concrete path, split so the missing pieces are real gaps.
  const segments = [];
  let cursor = ROOM.minZ;
  if (config.gap) {
    segments.push([ROOM.minZ, config.gap[0] - ROOM.minZ]);
    segments.push([config.gap[1], ROOM.maxZ - config.gap[1]]);
  } else {
    segments.push([ROOM.minZ, ROOM.maxZ - ROOM.minZ]);
  }
  segments.forEach(([start, depth]) => {
    if (depth <= 0) return;
    const z = start + depth / 2;
    addFloor(root, floors, 0, z, 17.4, depth, 0, floorMaterial, "solid");
  });

  // Room shell and continuous ceiling carry the sound and light.
  const leftWall = boxMesh(root, "north-city-wall", -9.15, 4.4, -16.5, 0.55, 8.8, 70, wallMaterial);
  const rightWall = boxMesh(root, "south-city-wall", 9.15, 4.4, -16.5, 0.55, 8.8, wallMaterial);
  colliders.push({ x: -9.15, z: -16.5, w: 0.55, d: 70, yMin: 0, yMax: 9, phase: "solid", active: true });
  colliders.push({ x: 9.15, z: -16.5, w: 0.55, d: 70, yMin: 0, yMax: 9, phase: "solid", active: true });
  boxMesh(root, "rear-wall", 0, 4.4, 18.2, 18.8, 8.8, 0.55, wallMaterial);
  boxMesh(root, "portal-wall", 0, 4.4, -51.4, 18.8, 8.8, wallMaterial);
  if (levelIndex !== 3) {
    const ceiling = planeMesh(root, "station-ceiling", 0, ROOM.ceiling, -16.5, 18.2, 70, roofMaterial, Math.PI / 2);
    ceiling.material.side = THREE.DoubleSide;
    if (config.gravity) {
      // Ceiling route follows the entire gap; solid floor around it remains a safe landing.
      const bridge = planeMesh(root, "gravity-path", 0, ROOM.ceiling - 0.015, (config.gap[0] + config.gap[1]) / 2, 12.2, Math.abs(config.gap[0] - config.gap[1]) + 1.2, mat(palette.accent, { roughness: 0.34, metalness: 0.28, emissive: palette.accent, emissiveIntensity: 0.17, transparent: true, opacity: 0.84 }));
      bridge.material.side = THREE.DoubleSide;
      ceilings.push({ x: 0, z: (config.gap[0] + config.gap[1]) / 2, width: 12.2, depth: Math.abs(config.gap[0] - config.gap[1]) + 1.2, y: ROOM.ceiling, phase: "solid", mesh: bridge, kind: "ceiling" });
    }
  } else {
    // The Sea Link opens to the Arabian Sea and a broken sky.
    const brokenRoof = planeMesh(root, "broken-canopy", 0, ROOM.ceiling, -7, 11.2, 20, roofMaterial, Math.PI / 2);
    brokenRoof.material.side = THREE.DoubleSide;
    addCeilingPath(root, ceilings, 0, -22.5, 11.5, 11.5, ROOM.ceiling, mat(palette.accent, { roughness: 0.32, metalness: 0.25, emissive: palette.accent, emissiveIntensity: 0.2, transparent: true, opacity: 0.78 }));
  }

  addCityBackdrop(root, config.seed, palette.accent);
  if (levelIndex === 0) addStationDetails(root, palette.accent, palette.warm);
  if (levelIndex === 1) addCoastalDetails(root, palette.accent, palette.warm);
  if (levelIndex === 2) addDharaviDetails(root, palette.accent, palette.warm);
  if (levelIndex === 3) addSeaLinkDetails(root, palette.accent, palette.warm);

  config.barricades.forEach(([x, z, width]) => addBarricade(root, colliders, x, z, width));
  config.ceilingObstacles.forEach(([x, z]) => addCeilingObstacle(root, colliders, x, z));

  // Architectural lighting and a readable route through the room.
  for (let z = 12; z > -48; z -= 8) {
    for (const side of [-1, 1]) {
      const x = side * 8.45;
      const lamp = boxMesh(root, "route-light", x, 3.55, z, 0.09, 0.09, 0.68, accentMat, false, false);
      lamp.rotation.y = Math.PI / 2;
      if (z % 16 < 1) {
        const point = new THREE.PointLight(palette.accent, 0.42, 9, 2);
        point.position.set(side * 7.7, 5.2, z);
        root.add(point);
      }
    }
  }
  for (let i = 0; i < 22; i++) {
    const x = (rnd() - 0.5) * 14;
    const z = -49 + rnd() * 67;
    const puddle = addPuddle(root, x, z, 0.35 + rnd() * 1.5, 0.22 + rnd() * 1.1, levelIndex === 2 ? 0x563a58 : 0x38717a);
    puddle.material.opacity = 0.14 + rnd() * 0.15;
  }

  // Repeating coloured route markers in place of floating UI arrows.
  const laneMark = mat(palette.accent, { emissive: palette.accent, emissiveIntensity: 0.75, transparent: true, opacity: 0.42 });
  for (let z = 14; z > -49; z -= 2.8) {
    for (const x of [-0.12, 0.12]) {
      boxMesh(root, "wet-route-dash", x, 0.02, z, 0.04, 0.018, 0.64, laneMark, false, false);
    }
  }

  // The flooded causeway is visible below the lower road, and goes nowhere until gravity is used.
  if (levelIndex === 1) {
    const flood = planeMesh(root, "flood-water", 0, -0.7, -21.4, 16.8, 10.8, mat(0x0f6670, { roughness: 0.15, metalness: 0.73, transparent: true, opacity: 0.56, emissive: 0x07363a, emissiveIntensity: 0.34, side: THREE.DoubleSide }));
    flood.rotation.x = -Math.PI / 2;
    for (let i = 0; i < 9; i++) {
      const ripple = new THREE.Mesh(new THREE.TorusGeometry(0.32 + i * 0.12, 0.012, 5, 36), new THREE.MeshBasicMaterial({ color: palette.accent, transparent: true, opacity: 0.26 }));
      ripple.rotation.x = Math.PI / 2;
      ripple.position.set((i % 3 - 1) * 3.4, -0.65, -18 - Math.floor(i / 3) * 3.0);
      root.add(ripple);
    }
  }

  // A second reality shows through as a translucent outline before it is entered.
  if (config.echo) {
    const echoDeck = new THREE.Mesh(
      new THREE.BoxGeometry(12.1, 0.26, Math.abs(config.echo[0] - config.echo[1])),
      mat(palette.accent, { roughness: 0.18, metalness: 0.25, transparent: true, opacity: 0.18, emissive: palette.accent, emissiveIntensity: 0.3, side: THREE.DoubleSide })
    );
    echoDeck.position.set(0, -0.13, (config.echo[0] + config.echo[1]) / 2);
    echoDeck.name = "echo-bridge";
    root.add(echoDeck);
    phaseMeshes.push(echoDeck);
    floors.push({ x: 0, z: (config.echo[0] + config.echo[1]) / 2, width: 12.1, depth: Math.abs(config.echo[0] - config.echo[1]) + 0.2, y: 0, phase: "echo", mesh: echoDeck, kind: "floor" });
    for (const x of [-5.8, 5.8]) {
      const rail = boxMesh(root, "echo-rail", x, 0.58, (config.echo[0] + config.echo[1]) / 2, 0.12, 1.0, Math.abs(config.echo[0] - config.echo[1]), accentMat, false);
      phaseMeshes.push(rail);
    }
  }

  let hazard = null;
  if (config.train !== null) {
    addHazardTrack(root, config.train, palette.accent);
    hazard = createTrain(root, palette.accent, config.train);
  }
  config.pulseGates.forEach((gate) => addPulseGate(root, pulseGates, gate.z, palette.accent, gate));

  const shardSets = [
    [[0, 1.3, 4], [2.7, 1.35, -23], [-2.4, 1.4, -36]],
    [[-1.9, 1.35, 4], [0.8, 6.9, -21.6], [2.1, 1.35, -39]],
    [[-2.2, 1.3, 4], [0, 1.25, -24], [2.1, 1.35, -39]],
    [[-2.3, 1.35, 4], [1.2, 6.9, -22.5], [2.0, 1.35, -45]]
  ];
  shardSets[levelIndex].forEach((point, i) => {
    const shardPhase = levelIndex === 2 && i === 1 ? "echo" : levelIndex === 3 && i === 2 ? "echo" : "solid";
    collectibles.push(createShard(root, point[0], point[1], point[2], palette.accent, shardPhase));
  });

  // Broken portal stays occluded until all three fragments are restored.
  const portal = createPortal(root, palette.accent, -48.4);
  const gateMesh = boxMesh(root, "sealed-gate", 0, 2.8, -46.9, 8.4, 5.6, 0.32, mat(0x18413f, { roughness: 0.3, metalness: 0.4, transparent: true, opacity: 0.74, emissive: palette.accent, emissiveIntensity: 0.38 }));
  const gateCollider = { x: 0, z: -46.9, w: 8.4, d: 0.55, yMin: 0, yMax: 5.6, phase: "solid", active: true, isGate: true };
  colliders.push(gateCollider);
  portal.collider = gateCollider;
  portal.gateMesh = gateMesh;
  portal.open = false;

  // Side rails prevent accidental exits while leaving the whole route visible.
  for (const x of [-8.55, 8.55]) {
    for (const z of [9, -6, -32, -44]) {
      boxMesh(root, "safety-post", x, 0.62, z, 0.17, 1.24, 0.17, darkConcrete);
      boxMesh(root, "safety-cap", x, 1.27, z, 0.24, 0.12, 0.24, accentMat, false);
    }
  }

  const world = {
    levelIndex,
    palette,
    floors,
    ceilings,
    colliders,
    collectibles,
    pulseGates,
    phaseMeshes,
    hazard,
    portal,
    timeFrozen: false,
    setGateOpen(open) {
      if (portal.open === open) return;
      portal.open = open;
      gateCollider.active = !open;
      gateMesh.visible = !open;
      portal.group.scale.setScalar(open ? 1 : 0.84);
      portal.group.children[1].material.opacity = open ? 0.5 : 0.13;
      portal.group.children[0].material.emissiveIntensity = open ? 4.5 : 1.2;
    },
    setPhase(phase) {
      phaseMeshes.forEach((mesh) => {
        const isEcho = phase === "echo";
        mesh.visible = true;
        mesh.material.transparent = true;
        mesh.material.opacity = isEcho ? (mesh.name === "echo-bridge" ? 0.88 : 0.72) : 0.12;
        mesh.material.emissiveIntensity = isEcho ? 1.8 : 0.2;
      });
    },
    update(dt, elapsed, phase, frozen) {
      this.timeFrozen = frozen;
      collectibles.forEach((item, i) => {
        if (item.collected) return;
        item.group.rotation.y += dt * (frozen ? 0.15 : 0.7 + i * 0.08);
        item.group.position.y = item.group.userData.baseY + Math.sin(elapsed * 1.8 + i * 2.2) * 0.12;
        const visible = item.phase === "solid" || phase === "echo";
        item.group.visible = visible;
        item.group.children[0].material.emissiveIntensity = visible ? 2.1 : 0.25;
      });
      if (hazard) {
        if (!frozen) hazard.phase += dt;
        hazard.group.position.x = Math.sin(hazard.phase * (levelIndex === 3 ? 1.04 : 0.72)) * (levelIndex === 3 ? 15.5 : 13.8);
      }
      pulseGates.forEach((gate) => {
        if (!frozen) gate.clock += dt;
        const cycle = gate.clock % gate.period;
        const isActive = cycle < gate.activeFor;
        const warning = !isActive && cycle > gate.period - 0.55;
        const visibleInPhase = gate.phase !== "echo" || phase === "echo";
        const color = isActive ? 0xff3655 : warning ? 0xffc15b : gate.accent;
        gate.active = isActive;
        gate.beam.material.color.setHex(color);
        gate.beam.material.emissive.setHex(color);
        gate.beam.material.emissiveIntensity = isActive ? 2.5 : warning ? 1.3 : 0.2;
        gate.beam.material.opacity = visibleInPhase ? (isActive ? 0.72 : warning ? 0.34 : 0.1) : 0.035;
        gate.status.material.color.setHex(color);
        gate.status.material.emissive.setHex(color);
        gate.status.material.emissiveIntensity = isActive ? 2.2 : warning ? 1.2 : 0.35;
        gate.statusLight.color.setHex(color);
        gate.statusLight.intensity = visibleInPhase ? (isActive ? 1.8 : warning ? 0.9 : 0.24) : 0.04;
        gate.floorMark.material.color.setHex(warning ? 0xffc15b : isActive ? 0xff3655 : gate.accent);
        gate.floorMark.material.emissive.setHex(warning ? 0xff8c32 : isActive ? 0xff2445 : gate.accent);
        gate.floorMark.material.emissiveIntensity = isActive ? 1.2 : 0.35;
      });
      portal.group.rotation.y = Math.sin(elapsed * 0.8) * 0.045;
      portal.group.rotation.z = Math.sin(elapsed * 0.55) * 0.035;
    }
  };
  world.setPhase("solid");
  world.setGateOpen(false);
  return world;
}

export const WORLD_BOUNDS = ROOM;



