'use client';

import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import type { CityData } from './CityGenerator';

export interface StreetGang3DEnvironmentProps {
  city: CityData;
  playerPosition?: { x: number; y: number };
  playerHeading?: number;
  className?: string;
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
}: StreetGang3DEnvironmentProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const targetRef = useRef(playerPosition);
  const headingRef = useRef(playerHeading);

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
      const target = targetRef.current ?? { x: 1900, y: 1800 };
      const px = mapX(target.x);
      const pz = mapZ(target.y);
      const heading = headingRef.current;
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
