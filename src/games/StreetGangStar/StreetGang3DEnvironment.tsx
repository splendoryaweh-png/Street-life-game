'use client';

import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import type { CityData } from './CityGenerator';

export interface StreetGang3DEnvironmentProps {
  city: CityData;
  playerPosition?: { x: number; y: number };
  playerHeading?: number;
  className?: string;
  playerColor?: string;
  laserBeams?: Array<{ x1: number; y1: number; x2: number; y2: number; color: string; life: number; maxLife: number }>;
  getPlayerSnapshot?: () => { x: number; y: number; heading: number; color?: string; isMoving?: boolean; laserBeams?: Array<{ x1: number; y1: number; x2: number; y2: number; color: string; life: number; maxLife: number }>; civilians?: Array<{ id: string; x: number; y: number; heading: number; color: string; state?: string }>; gangsters?: Array<{ id: string; x: number; y: number; heading: number; vehicleType: string; health: number; maxHealth: number }>; cars?: Array<{ id: string; x: number; y: number; heading: number; width: number; height: number; color: string }>; remotePlayers?: Array<{ id: string; x: number; y: number; heading: number; color: string; team: string; health: number }> };
}

/**
 * First-stage Three.js street environment for Street Gang Star.
 *
 * This component deliberately owns only the environment and camera. Character
 * rigs, weapons, collision and gameplay are connected in later migration steps.
 * World coordinates map from the existing 2D city (x/y) to Three.js (x/z), so
 * the existing CityData remains the source of truth during the renderer upgrade.
 */
export function StreetGang3DEnvironment({
  city,
  playerPosition,
  playerHeading = 0,
  className = '',
  playerColor = '#38BDF8',
  laserBeams = [],
  getPlayerSnapshot,
}: StreetGang3DEnvironmentProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const targetRef = useRef(playerPosition);
  const headingRef = useRef(playerHeading);
  const beamsRef = useRef(laserBeams);
  const snapshotRef = useRef(getPlayerSnapshot);
  useEffect(() => { beamsRef.current = laserBeams; snapshotRef.current = getPlayerSnapshot; }, [laserBeams, getPlayerSnapshot]);

  useEffect(() => {
    targetRef.current = playerPosition;
    headingRef.current = playerHeading;
  }, [playerPosition?.x, playerPosition?.y, playerHeading]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    } catch {
      host.dataset.webgl = 'unavailable';
      return;
    }

    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#9aa9b5');
    scene.fog = new THREE.Fog('#9aa9b5', 900, 4200);

    const camera = new THREE.PerspectiveCamera(58, 1, 0.1, 6500);
    const pixelRatio = Math.min(window.devicePixelRatio || 1, 1.6);
    renderer.setPixelRatio(pixelRatio);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    renderer.domElement.className = 'block h-full w-full';
    renderer.domElement.setAttribute('aria-label', 'Three-dimensional city street environment');
    host.appendChild(renderer.domElement);

    const world = new THREE.Group();
    scene.add(world);

    // Third-person character and laser sidearm; combat remains non-graphic.
    const playerRig = new THREE.Group();
    const skin = new THREE.MeshStandardMaterial({ color: '#9b6748', roughness: 0.82 });
    const clothing = new THREE.MeshStandardMaterial({ color: playerColor, roughness: 0.78 });
    const darkCloth = new THREE.MeshStandardMaterial({ color: '#20252b', roughness: 0.9 });
    const weaponMat = new THREE.MeshStandardMaterial({ color: '#303943', metalness: 0.72, roughness: 0.34 });
    const torso = new THREE.Mesh(new THREE.CapsuleGeometry(4.2, 7, 5, 10), clothing);
    torso.position.y = 12; torso.castShadow = true; playerRig.add(torso);
    const head = new THREE.Mesh(new THREE.SphereGeometry(2.8, 14, 12), skin);
    head.position.y = 20; head.castShadow = true; playerRig.add(head);
    const legGeometry = new THREE.CapsuleGeometry(1.45, 5.5, 4, 8);
    const leftLeg = new THREE.Mesh(legGeometry, darkCloth); leftLeg.position.set(-1.65, 4.2, 0);
    const rightLeg = new THREE.Mesh(legGeometry, darkCloth); rightLeg.position.set(1.65, 4.2, 0);
    playerRig.add(leftLeg, rightLeg);
    const armGeometry = new THREE.CapsuleGeometry(1.25, 5.5, 4, 8);
    const leftArm = new THREE.Mesh(armGeometry, clothing); leftArm.position.set(-5, 13, -1.8); leftArm.rotation.z = -0.38;
    const rightArm = new THREE.Mesh(armGeometry, clothing); rightArm.position.set(5, 13, -2.2); rightArm.rotation.z = 0.38;
    playerRig.add(leftArm, rightArm);
    const laserGun = new THREE.Group();
    const gunBody = new THREE.Mesh(new THREE.BoxGeometry(2.1, 1.8, 9), weaponMat); gunBody.position.set(0, 0, -2.8);
    const gunBarrel = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 4, 8), weaponMat);
    gunBarrel.rotation.x = Math.PI / 2; gunBarrel.position.z = -8;
    laserGun.add(gunBody, gunBarrel); laserGun.position.set(5.4, 13, -5.2); playerRig.add(laserGun);
    world.add(playerRig);

    const beamGeometry = new THREE.CylinderGeometry(0.22, 0.22, 1, 6);
    const beamPool: THREE.Mesh[] = [];
    for (let i = 0; i < 24; i += 1) {
      const beam = new THREE.Mesh(beamGeometry, new THREE.MeshBasicMaterial({ color: '#38BDF8', transparent: true, opacity: 0.9 }));
      beam.visible = false; world.add(beam); beamPool.push(beam);
    }

    const actorRoot = new THREE.Group(); world.add(actorRoot);
    const humanActors = new Map<string, THREE.Group>();
    const carActors = new Map<string, THREE.Mesh>();
    const actorMaterials = new Map<string, THREE.Material>();
    const getActorMaterial = (key: string, color: string) => { let material = actorMaterials.get(key); if (!material) { material = new THREE.MeshStandardMaterial({ color, roughness: 0.82 }); actorMaterials.set(key, material); } return material; };
    const createHumanActor = (key: string, color: string) => { const group = new THREE.Group(); const torso = new THREE.Mesh(new THREE.CapsuleGeometry(3.2, 6, 4, 8), getActorMaterial(`${key}-body`, color)); torso.position.y = 9; torso.castShadow = true; const head = new THREE.Mesh(new THREE.SphereGeometry(2.2, 10, 8), getActorMaterial(`${key}-skin`, '#9b6748')); head.position.y = 16; group.add(torso, head); actorRoot.add(group); humanActors.set(key, group); return group; };

    const materials = {
      asphalt: new THREE.MeshStandardMaterial({ color: city.theme.asphaltColor, roughness: 0.96 }),
      sidewalk: new THREE.MeshStandardMaterial({ color: city.theme.sidewalkColor, roughness: 0.9 }),
      curb: new THREE.MeshStandardMaterial({ color: city.theme.curbColor, roughness: 0.82 }),
      concrete: new THREE.MeshStandardMaterial({ color: '#85827b', roughness: 0.92 }),
      roof: new THREE.MeshStandardMaterial({ color: '#55575a', roughness: 0.9 }),
      glass: new THREE.MeshStandardMaterial({ color: '#344b5a', roughness: 0.28, metalness: 0.25 }),
      lane: new THREE.MeshStandardMaterial({ color: city.theme.roadMarkingColor, roughness: 0.8 }),
      grass: new THREE.MeshStandardMaterial({ color: city.theme.groundGrassColor, roughness: 1 }),
      wall: new THREE.MeshStandardMaterial({ color: city.theme.compoundWallColor, roughness: 0.95 }),
      lamp: new THREE.MeshStandardMaterial({ color: '#f4dca0', emissive: '#f4c76b', emissiveIntensity: 1.8 }),
    };

    const makeBox = (
      width: number,
      height: number,
      depth: number,
      material: THREE.Material,
      x: number,
      y: number,
      z: number,
      castShadow = true,
      receiveShadow = true,
    ) => {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), material);
      mesh.position.set(x, y + height / 2, z);
      mesh.castShadow = castShadow;
      mesh.receiveShadow = receiveShadow;
      world.add(mesh);
      return mesh;
    };

    const mapX = (x: number) => x - city.mapWidth / 2;
    const mapZ = (y: number) => y - city.mapHeight / 2;

    // Continuous ground plane under the road network.
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(city.mapWidth, city.mapHeight),
      materials.grass,
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.12;
    ground.receiveShadow = true;
    world.add(ground);

    // Roads, raised kerbs and sidewalks use the same generated city layout
    // as the existing game, preserving its geography while changing the view.
    city.roads.forEach((road) => {
      const centerX = mapX(road.x + road.width / 2);
      const centerZ = mapZ(road.y + road.height / 2);
      const roadMesh = new THREE.Mesh(
        new THREE.PlaneGeometry(road.width, road.height),
        materials.asphalt,
      );
      roadMesh.rotation.x = -Math.PI / 2;
      roadMesh.position.set(centerX, 0.015, centerZ);
      roadMesh.receiveShadow = true;
      world.add(roadMesh);

      const horizontal = road.direction === 'horizontal';
      const sidewalkWidth = 24;
      const roadLength = horizontal ? road.width : road.height;
      const roadBreadth = horizontal ? road.height : road.width;
      [-1, 1].forEach((side) => {
        const offset = roadBreadth / 2 + sidewalkWidth / 2;
        const sidewalk = new THREE.Mesh(
          new THREE.PlaneGeometry(
            horizontal ? roadLength : sidewalkWidth,
            horizontal ? sidewalkWidth : roadLength,
          ),
          materials.sidewalk,
        );
        sidewalk.rotation.x = -Math.PI / 2;
        sidewalk.position.set(
          centerX + (horizontal ? 0 : side * offset),
          0.04,
          centerZ + (horizontal ? side * offset : 0),
        );
        sidewalk.receiveShadow = true;
        world.add(sidewalk);
      });

      // Dashed lane markings; short segments keep the road readable at street level.
      const laneCount = Math.max(2, road.lanes);
      const laneOffset = roadBreadth / laneCount;
      for (let lane = 1; lane < laneCount; lane += 1) {
        const across = -roadBreadth / 2 + laneOffset * lane;
        if (lane === Math.floor(laneCount / 2)) {
          const dashCount = Math.floor(roadLength / 90);
          for (let dash = 0; dash < dashCount; dash += 1) {
            const along = -roadLength / 2 + dash * 90 + 24;
            const marking = new THREE.Mesh(
              new THREE.PlaneGeometry(horizontal ? 42 : 2.2, horizontal ? 2.2 : 42),
              materials.lane,
            );
            marking.rotation.x = -Math.PI / 2;
            marking.position.set(
              centerX + (horizontal ? along : across),
              0.055,
              centerZ + (horizontal ? across : along),
            );
            world.add(marking);
          }
        }
      }
    });

    // Buildings become solid, raised structures with visible facades and roofs.
    city.buildings.forEach((building, index) => {
      const height = 34 + ((index * 17) % 5) * 11;
      const bodyMaterial = new THREE.MeshStandardMaterial({
        color: building.wallColor,
        roughness: 0.88,
      });
      const roofMaterial = new THREE.MeshStandardMaterial({
        color: building.roofColor,
        roughness: 0.92,
      });
      const x = mapX(building.x + building.width / 2);
      const z = mapZ(building.y + building.height / 2);
      makeBox(building.width, height, building.height, bodyMaterial, x, 0, z);
      makeBox(building.width + 3, 3, building.height + 3, roofMaterial, x, height, z, false);

      // Repeated facade windows add scale and street-level detail without external assets.
      const windowRows = Math.max(1, Math.floor(height / 15));
      const columns = Math.max(2, Math.floor(building.width / 38));
      for (let row = 0; row < windowRows; row += 1) {
        for (let col = 0; col < columns; col += 1) {
          const wx = x - building.width / 2 + ((col + 0.5) * building.width) / columns;
          const wy = 7 + row * 14;
          const frontWindow = new THREE.Mesh(
            new THREE.BoxGeometry(13, 7, 0.8),
            materials.glass,
          );
          frontWindow.position.set(wx, wy, z + building.height / 2 + 0.45);
          world.add(frontWindow);
        }
      }
    });

    // Compound boundaries give the neighbourhood a recognisable urban layout.
    city.compounds.forEach((compound) => {
      const x = mapX(compound.x + compound.width / 2);
      const z = mapZ(compound.y + compound.height / 2);
      const halfW = compound.width / 2;
      const halfD = compound.height / 2;
      const wallHeight = 5;
      const wallMaterial = new THREE.MeshStandardMaterial({
        color: compound.fenceColor || city.theme.compoundWallColor,
        roughness: 0.94,
      });
      makeBox(compound.width, wallHeight, 7, wallMaterial, x, 0, z - halfD);
      makeBox(compound.width, wallHeight, 7, wallMaterial, x, 0, z + halfD);
      makeBox(7, wallHeight, compound.height, wallMaterial, x - halfW, 0, z);
      makeBox(7, wallHeight, compound.height, wallMaterial, x + halfW, 0, z);
    });

    // Streetlights are placed beside the generated avenue grid.
    const lampPositions = [600, 1400, 2200, 3000];
    lampPositions.forEach((streetY) => {
      [450, 1050, 1850, 2650, 3450].forEach((streetX) => {
        const x = mapX(streetX);
        const z = mapZ(streetY + 145);
        makeBox(2.2, 19, 2.2, materials.concrete, x, 0, z);
        makeBox(12, 1.5, 2, materials.concrete, x + 5, 18, z);
        const bulb = new THREE.Mesh(new THREE.SphereGeometry(2.2, 8, 8), materials.lamp);
        bulb.position.set(x + 10, 17.5, z);
        world.add(bulb);
      });
    });

    const hemisphere = new THREE.HemisphereLight('#dce8f2', '#34362f', 2.0);
    scene.add(hemisphere);
    const sunlight = new THREE.DirectionalLight('#fff1d6', 3.2);
    sunlight.position.set(-450, 900, 550);
    sunlight.castShadow = true;
    sunlight.shadow.mapSize.set(2048, 2048);
    sunlight.shadow.camera.left = -1200;
    sunlight.shadow.camera.right = 1200;
    sunlight.shadow.camera.top = 1200;
    sunlight.shadow.camera.bottom = -1200;
    scene.add(sunlight);

    const resize = () => {
      if (!host) return;
      const width = Math.max(1, host.clientWidth);
      const height = Math.max(1, host.clientHeight);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height, false);
    };
    const observer = new ResizeObserver(resize);
    observer.observe(host);
    resize();

    let frame = 0;
    const animate = () => {
      frame = window.requestAnimationFrame(animate);
      const live = snapshotRef.current?.();
      const target = live ?? targetRef.current ?? { x: 1900, y: 1800 };
      const px = mapX(target.x), pz = mapZ(target.y);
      const heading = live?.heading ?? headingRef.current;
      playerRig.position.set(px, 0, pz);
      playerRig.rotation.y = -heading;
      const stride = live?.isMoving ? Math.sin(Date.now() * 0.012) * 0.42 : 0;
      leftLeg.rotation.x = stride; rightLeg.rotation.x = -stride;
      leftArm.rotation.x = -stride * 0.55; rightArm.rotation.x = stride * 0.55;
      const syncHumanActors = (items: Array<{ id: string; x: number; y: number; heading: number; color: string }>, prefix: string) => { const active = new Set<string>(); items.forEach((item) => { const key = `${prefix}:${item.id}`; active.add(key); const actor = humanActors.get(key) ?? createHumanActor(key, item.color); actor.position.set(mapX(item.x), 0, mapZ(item.y)); actor.rotation.y = -item.heading; }); for (const [key, actor] of humanActors) { if (key.startsWith(`${prefix}:`) && !active.has(key)) { actorRoot.remove(actor); actor.traverse((node) => { if (node instanceof THREE.Mesh) node.geometry.dispose(); }); humanActors.delete(key); } } };
      syncHumanActors((live?.civilians ?? []).filter((c) => c.state !== 'saved').map((c) => ({ ...c, color: c.state === 'scared' ? '#D6DCE2' : c.color })), 'civilian');
      syncHumanActors((live?.gangsters ?? []).map((g) => ({ ...g, color: '#9F2525' })), 'gangster');
      syncHumanActors((live?.remotePlayers ?? []).map((p) => ({ ...p, color: p.color || (p.team === 'blue' ? '#0284C7' : '#991B1B') })), 'remote');
      const liveCars = live?.cars ?? []; const activeCars = new Set<string>(); liveCars.forEach((car) => { activeCars.add(car.id); let mesh = carActors.get(car.id); if (!mesh) { mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), getActorMaterial(`car-${car.id}`, car.color)); mesh.castShadow = true; mesh.receiveShadow = true; actorRoot.add(mesh); carActors.set(car.id, mesh); } mesh.position.set(mapX(car.x), 5, mapZ(car.y)); mesh.scale.set(car.width, 8, car.height); mesh.rotation.y = -car.heading; }); for (const [id, mesh] of carActors) { if (!activeCars.has(id)) { actorRoot.remove(mesh); mesh.geometry.dispose(); carActors.delete(id); } }
      const activeBeams = (live?.laserBeams ?? beamsRef.current).slice(-beamPool.length);
      beamPool.forEach((beam, index) => {
        const source = activeBeams[index];
        if (!source || source.life <= 0) { beam.visible = false; return; }
        const start = new THREE.Vector3(mapX(source.x1), 13, mapZ(source.y1));
        const end = new THREE.Vector3(mapX(source.x2), 2, mapZ(source.y2));
        const delta = end.clone().sub(start);
        beam.visible = true; beam.position.copy(start).add(end).multiplyScalar(0.5);
        beam.scale.set(1, delta.length(), 1);
        beam.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), delta.normalize());
        const mat = beam.material as THREE.MeshBasicMaterial;
        mat.color.set(source.color || '#38BDF8');
        mat.opacity = Math.max(0.12, source.life / Math.max(1, source.maxLife));
      });
      const distance = 34;
      const cameraOffsetX = Math.sin(heading) * distance;
      const cameraOffsetZ = Math.cos(heading) * distance;
      camera.position.set(px - cameraOffsetX, 22, pz + cameraOffsetZ);
      camera.lookAt(px, 5, pz);
      renderer.render(scene, camera);
    };
    animate();

    return () => {
      window.cancelAnimationFrame(frame);
      observer.disconnect();
      world.traverse((object) => {
        if (object instanceof THREE.Mesh) {
          object.geometry.dispose();
          const material = object.material;
          if (Array.isArray(material)) material.forEach((item) => item.dispose());
          else material.dispose();
        }
      });
      beamPool.forEach((beam) => (beam.material as THREE.Material).dispose());
      beamGeometry.dispose(); skin.dispose(); clothing.dispose(); darkCloth.dispose(); weaponMat.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [city]);

  return (
    <div
      ref={hostRef}
      className={`relative h-full min-h-[320px] w-full overflow-hidden bg-slate-500 ${className}`}
      data-street-gang-3d-environment
      aria-label={`${city.cityName} street environment`}
    />
  );
}
