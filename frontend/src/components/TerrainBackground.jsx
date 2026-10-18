import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';

/**
 * TerrainBackground.jsx
 * 
 * Interactive 3D undulating terrain & skyline particle field inspired by
 * cinematic digital landscape telemetry (dark theme with warm amber horizon,
 * undulating elevation mesh, city silhouettes, floating stars, and cursor parallax).
 * 
 * Ultra-performant: uses optimized BufferGeometry, vertex displacement loop,
 * and smooth camera lerping with mouse position.
 */
export default function TerrainBackground() {
  const mountRef = useRef(null);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    // 1. Scene, Camera, Renderer
    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x020610, 0.009);

    const width = window.innerWidth;
    const height = window.innerHeight;

    const camera = new THREE.PerspectiveCamera(55, width / height, 0.5, 500);
    camera.position.set(0, 18, 55);
    camera.lookAt(0, 10, -50);

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance',
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
    renderer.setClearColor(0x020610, 1);
    container.appendChild(renderer.domElement);

    // 2. Terrain Particles & Wireframe Topography
    const GRID_X = 140;
    const GRID_Z = 110;
    const SPACING = 2.4;
    const TOTAL_POINTS = GRID_X * GRID_Z;

    const terrainGeom = new THREE.BufferGeometry();
    const positions = new Float32Array(TOTAL_POINTS * 3);
    const baseHeights = new Float32Array(TOTAL_POINTS);
    const colors = new Float32Array(TOTAL_POINTS * 3);

    // Color palette: deep midnight blue in valleys, warm gold/amber on ridge lines and horizon
    const cDeep = new THREE.Color(0x00456E);     // Deep river blue
    const cCyan = new THREE.Color(0x0284C7);     // Vibrant cyan
    const cAmber = new THREE.Color(0xF59E0B);    // Warm horizon amber
    const cGold = new THREE.Color(0xFBBF24);     // Peak gold

    let idx = 0;
    for (let iz = 0; iz < GRID_Z; iz++) {
      for (let ix = 0; ix < GRID_X; ix++) {
        const x = (ix - GRID_X / 2) * SPACING;
        const z = -iz * SPACING + 25; // stretches into distance
        const distFromCenter = Math.abs(x) / (GRID_X * SPACING * 0.5);

        // Natural valley in center with rising ridge mountains on lateral flanks
        const lateralRidge = Math.pow(distFromCenter, 1.8) * 16;
        const baseH = lateralRidge - 4;

        positions[idx * 3]     = x;
        positions[idx * 3 + 1] = baseH;
        positions[idx * 3 + 2] = z;
        baseHeights[idx]       = baseH;

        // Gradient coloring based on distance & height
        const depthRatio = iz / GRID_Z; // 0 near, 1 far
        const pointColor = new THREE.Color();

        if (depthRatio > 0.65) {
          // Warm amber horizon glow band
          pointColor.copy(cAmber).lerp(cGold, (depthRatio - 0.65) * 2.8);
        } else if (lateralRidge > 8) {
          pointColor.copy(cCyan).lerp(cAmber, 0.4);
        } else {
          pointColor.copy(cDeep).lerp(cCyan, depthRatio);
        }

        colors[idx * 3]     = pointColor.r;
        colors[idx * 3 + 1] = pointColor.g;
        colors[idx * 3 + 2] = pointColor.b;

        idx++;
      }
    }

    terrainGeom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    terrainGeom.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    // Particle sprite
    const pMaterial = new THREE.PointsMaterial({
      size: 1.4,
      vertexColors: true,
      transparent: true,
      opacity: 0.85,
      blending: THREE.AdditiveBlending,
    });
    const terrainPoints = new THREE.Points(terrainGeom, pMaterial);
    scene.add(terrainPoints);

    // Contour wireframe lines along lateral corridors
    const lineMaterial = new THREE.LineBasicMaterial({
      color: 0x0284C7,
      transparent: true,
      opacity: 0.18,
      blending: THREE.AdditiveBlending,
    });
    // Create longitude lines
    const lineIndices = [];
    for (let iz = 0; iz < GRID_Z; iz += 3) {
      for (let ix = 0; ix < GRID_X - 1; ix++) {
        const i1 = iz * GRID_X + ix;
        const i2 = i1 + 1;
        lineIndices.push(i1, i2);
      }
    }
    const lineGeom = terrainGeom.clone();
    lineGeom.setIndex(lineIndices);
    const terrainLines = new THREE.LineSegments(lineGeom, lineMaterial);
    scene.add(terrainLines);

    // 3. Distant City Skyline Silhouettes (Particle Columns matching screenshot)
    const buildingCount = 14;
    const buildingGeom = new THREE.BufferGeometry();
    const bPositions = [];
    const bColors = [];

    for (let b = 0; b < buildingCount; b++) {
      const bx = (b - buildingCount / 2) * 16 + (Math.random() - 0.5) * 8;
      const bz = -140 - Math.random() * 40;
      const bHeight = 16 + Math.random() * 26;
      const bWidth = 6 + Math.random() * 8;

      // Vertical structural column dots
      for (let h = 0; h < bHeight; h += 2.2) {
        for (let w = -bWidth / 2; w <= bWidth / 2; w += 2.4) {
          bPositions.push(bx + w, h, bz);
          // Faint cyan / amber outline
          bColors.push(0.3, 0.5, 0.75);
        }
      }
    }

    buildingGeom.setAttribute('position', new THREE.Float32BufferAttribute(bPositions, 3));
    buildingGeom.setAttribute('color', new THREE.Float32BufferAttribute(bColors, 3));

    const bMaterial = new THREE.PointsMaterial({
      size: 1.8,
      vertexColors: true,
      transparent: true,
      opacity: 0.45,
      blending: THREE.AdditiveBlending,
    });
    const skyline = new THREE.Points(buildingGeom, bMaterial);
    scene.add(skyline);

    // 4. Distant Ambient Starfield / Floating Data Particles
    const starCount = 350;
    const starGeom = new THREE.BufferGeometry();
    const starPos = [];
    for (let s = 0; s < starCount; s++) {
      starPos.push(
        (Math.random() - 0.5) * 260,
        Math.random() * 60 + 10,
        -Math.random() * 180
      );
    }
    starGeom.setAttribute('position', new THREE.Float32BufferAttribute(starPos, 3));
    const starMat = new THREE.PointsMaterial({
      color: 0xE2E8F0,
      size: 1.0,
      transparent: true,
      opacity: 0.55,
    });
    const stars = new THREE.Points(starGeom, starMat);
    scene.add(stars);

    // 5. Horizon Golden Glow Band Plane
    const glowGeom = new THREE.PlaneGeometry(320, 28);
    // Create gradient canvas texture
    const glowCanvas = document.createElement('canvas');
    glowCanvas.width = 512;
    glowCanvas.height = 128;
    const gctx = glowCanvas.getContext('2d');
    const grad = gctx.createLinearGradient(0, 128, 0, 0);
    grad.addColorStop(0, 'rgba(0, 0, 0, 0)');
    grad.addColorStop(0.35, 'rgba(180, 83, 9, 0.28)'); // Amber
    grad.addColorStop(0.65, 'rgba(245, 158, 11, 0.42)'); // Bright warm amber
    grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    gctx.fillStyle = grad;
    gctx.fillRect(0, 0, 512, 128);

    const glowTex = new THREE.CanvasTexture(glowCanvas);
    const glowMat = new THREE.MeshBasicMaterial({
      map: glowTex,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    const horizonGlow = new THREE.Mesh(glowGeom, glowMat);
    horizonGlow.position.set(0, 14, -135);
    scene.add(horizonGlow);

    // 6. Interactive Cursor Tracking (Damped Parallax)
    let mouseX = 0;
    let mouseY = 0;
    let targetX = 0;
    let targetY = 0;

    const handlePointerMove = (e) => {
      mouseX = (e.clientX / window.innerWidth) * 2 - 1;
      mouseY = (e.clientY / window.innerHeight) * 2 - 1;
    };

    window.addEventListener('pointermove', handlePointerMove, { passive: true });

    // Resize Handler
    const handleResize = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    // 7. Animation Loop
    let animId;
    let clock = new THREE.Clock();

    const animate = () => {
      animId = requestAnimationFrame(animate);
      const elapsed = clock.getElapsedTime();

      // Smooth mouse damping
      targetX += (mouseX - targetX) * 0.045;
      targetY += (mouseY - targetY) * 0.045;

      // Undulate terrain vertices
      const posAttr = terrainGeom.attributes.position;
      const posArr = posAttr.array;

      for (let i = 0; i < TOTAL_POINTS; i++) {
        const x = posArr[i * 3];
        const z = posArr[i * 3 + 2];
        const baseH = baseHeights[i];

        // Complex gentle multi-frequency wave motion
        const wave1 = Math.sin(x * 0.04 + elapsed * 0.9 + z * 0.03) * 1.8;
        const wave2 = Math.cos(z * 0.05 - elapsed * 0.7) * 1.2;

        posArr[i * 3 + 1] = baseH + wave1 + wave2;
      }
      posAttr.needsUpdate = true;
      lineGeom.attributes.position.needsUpdate = true;

      // Camera parallax response to cursor
      camera.position.x = targetX * 14;
      camera.position.y = 18 - targetY * 8;
      camera.lookAt(targetX * 5, 8 - targetY * 4, -70);

      // Subtle slow star twinkle / drift
      stars.rotation.y = elapsed * 0.005;

      renderer.render(scene, camera);
    };

    animate();

    // 8. Cleanup
    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('resize', handleResize);
      if (container && renderer.domElement) {
        container.removeChild(renderer.domElement);
      }
      terrainGeom.dispose();
      lineGeom.dispose();
      buildingGeom.dispose();
      starGeom.dispose();
      glowGeom.dispose();
      pMaterial.dispose();
      lineMaterial.dispose();
      bMaterial.dispose();
      starMat.dispose();
      glowMat.dispose();
      glowTex.dispose();
      renderer.dispose();
    };
  }, []);

  return (
    <div
      ref={mountRef}
      style={{
        position: 'fixed',
        inset: 0,
        width: '100vw',
        height: '100vh',
        pointerEvents: 'none',
        zIndex: -1,
        overflow: 'hidden',
        background: '#020610',
      }}
      aria-hidden="true"
    />
  );
}
