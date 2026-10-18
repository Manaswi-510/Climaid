/**
 * EarthGlobe.jsx — Dark Mode Luxe
 * Scroll-driven 3D Earth background canvas for Climaid.
 * The Earth remains as the background for the entire landing page.
 * As the user scrolls toward "Get Started", the Earth smoothly moves,
 * scales up, and rotates toward the Pune / South Asia focus.
 * Zero text-glow, controlled lighting, restrained metallic satellites, pure Three.js.
 */
import React, { useRef, useEffect, useState } from 'react';
import * as THREE from 'three';

function GlobeFallback() {
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 0,
        background: 'radial-gradient(circle at 70% 45%, #0d1e30 0%, #050a12 60%, #020408 100%)',
        pointerEvents: 'none',
      }}
    />
  );
}

// ─── Precision 3D Satellite Model ───────────────────────────────
function createSatelliteModel() {
  const group = new THREE.Group();

  // Central bus chassis (titanium / platinum finish)
  const bodyGeo = new THREE.BoxGeometry(0.038, 0.038, 0.055);
  const bodyMat = new THREE.MeshStandardMaterial({
    color: 0xe2e8f0,
    metalness: 0.95,
    roughness: 0.2,
  });
  const body = new THREE.Mesh(bodyGeo, bodyMat);
  group.add(body);

  // Solar panel arrays (dual wings, deep navy/cyan silicon cells)
  const panelGeo = new THREE.BoxGeometry(0.088, 0.004, 0.038);
  const panelMat = new THREE.MeshStandardMaterial({
    color: 0x0f2c42,
    emissive: 0x0c4a6e,
    emissiveIntensity: 0.3,
    metalness: 0.7,
    roughness: 0.35,
  });

  const leftPanel = new THREE.Mesh(panelGeo, panelMat);
  leftPanel.position.set(-0.068, 0, 0);
  group.add(leftPanel);

  const rightPanel = new THREE.Mesh(panelGeo, panelMat);
  rightPanel.position.set(0.068, 0, 0);
  group.add(rightPanel);

  return group;
}

export default function EarthGlobe() {
  const mountRef = useRef(null);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    let renderer, scene, camera, earthGroup, earthMesh, atmosphereMesh, starField;
    let satellites = [];
    let animId;
    let isDisposed = false;

    // Scroll progress tracker (0.0 at top, 1.0 at bottom)
    let scrollProgress = 0;
    let targetProgress = 0;

    const handleScroll = () => {
      const docHeight = document.documentElement.scrollHeight - window.innerHeight;
      const currentScroll = window.scrollY || window.pageYOffset || 0;
      targetProgress = docHeight > 0 ? Math.min(1, Math.max(0, currentScroll / docHeight)) : 0;
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();

    try {
      const width = window.innerWidth;
      const height = window.innerHeight;

      // 1. Scene & Camera
      scene = new THREE.Scene();
      camera = new THREE.PerspectiveCamera(42, width / height, 0.1, 100);
      camera.position.set(0, 0, 3.6);

      // 2. High-performance WebGL Renderer
      renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: true,
        powerPreference: 'high-performance',
      });
      renderer.setSize(width, height);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      container.appendChild(renderer.domElement);

      // 3. Deep Space Starfield (restrained, 900 stars, no chaotic particles)
      const starCount = 900;
      const starGeo = new THREE.BufferGeometry();
      const starPositions = new Float32Array(starCount * 3);
      const starColors = new Float32Array(starCount * 3);

      for (let i = 0; i < starCount; i++) {
        const r = 10 + Math.random() * 20;
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(2 * Math.random() - 1);
        starPositions[i * 3]     = r * Math.sin(phi) * Math.cos(theta);
        starPositions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
        starPositions[i * 3 + 2] = r * Math.cos(phi);

        // Controlled metallic white and subtle cobalt tints
        const tint = Math.random();
        if (tint < 0.8) {
          starColors[i * 3] = 0.95; starColors[i * 3 + 1] = 0.98; starColors[i * 3 + 2] = 1.0;
        } else {
          starColors[i * 3] = 0.45; starColors[i * 3 + 1] = 0.70; starColors[i * 3 + 2] = 0.95;
        }
      }

      starGeo.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
      starGeo.setAttribute('color', new THREE.BufferAttribute(starColors, 3));
      const starMat = new THREE.PointsMaterial({
        size: 0.032,
        vertexColors: true,
        transparent: true,
        opacity: 0.8,
        sizeAttenuation: true,
      });
      starField = new THREE.Points(starGeo, starMat);
      scene.add(starField);

      // 4. Controlled Lighting (Realistic Sun Key + Cool Space Rim)
      const sunLight = new THREE.DirectionalLight(0xfff8f0, 2.7);
      sunLight.position.set(-3.8, 2.6, 2.4);
      scene.add(sunLight);

      const rimLight = new THREE.DirectionalLight(0x38bdf8, 0.4);
      rimLight.position.set(4.0, -1.5, 1.2);
      scene.add(rimLight);

      const ambientLight = new THREE.AmbientLight(0x08131f, 0.35);
      scene.add(ambientLight);

      // 5. Earth Master Group
      earthGroup = new THREE.Group();
      scene.add(earthGroup);

      // Earth Sphere Geometry
      const earthGeo = new THREE.SphereGeometry(1, 64, 64);
      const earthMat = new THREE.MeshStandardMaterial({
        color: 0x0e3650,
        roughness: 0.7,
        metalness: 0.1,
      });

      earthMesh = new THREE.Mesh(earthGeo, earthMat);
      earthMesh.rotation.set(0.18, 2.2, 0);
      earthGroup.add(earthMesh);

      // Texture loader
      const textureLoader = new THREE.TextureLoader();
      textureLoader.load(
        '/images/earth_day.jpg',
        (texture) => {
          if (isDisposed) return;
          texture.colorSpace = THREE.SRGBColorSpace;
          earthMat.color.setHex(0xffffff);
          earthMat.map = texture;
          earthMat.needsUpdate = true;
        },
        undefined,
        (err) => {
          console.warn('Earth texture loading fallback:', err);
        }
      );

      // 6. Atmosphere Layer (Controlled realistic blue limb)
      const atmosGeo = new THREE.SphereGeometry(1.022, 48, 48);
      const atmosMat = new THREE.MeshStandardMaterial({
        color: 0x38bdf8,
        transparent: true,
        opacity: 0.18,
        side: THREE.BackSide,
        depthWrite: false,
      });
      atmosphereMesh = new THREE.Mesh(atmosGeo, atmosMat);
      earthGroup.add(atmosphereMesh);

      // 7. Small Satellites
      const satConfigs = [
        { radius: 1.35, inclination: 1.1, speed: 0.005, angle: 0.8 },
        { radius: 1.48, inclination: 0.3, speed: 0.004, angle: 2.6 },
        { radius: 1.42, inclination: -0.8, speed: 0.0045, angle: 4.8 },
      ];

      satellites = satConfigs.map((cfg) => {
        const model = createSatelliteModel();
        earthGroup.add(model);
        return {
          model,
          radius: cfg.radius,
          inclination: cfg.inclination,
          speed: cfg.speed,
          angle: cfg.angle,
        };
      });

      // 8. Cursor Parallax
      let mouseX = 0;
      let mouseY = 0;
      const handleMouseMove = (e) => {
        if (prefersReducedMotion) return;
        mouseX = (e.clientX / window.innerWidth - 0.5) * 2;
        mouseY = (e.clientY / window.innerHeight - 0.5) * 2;
      };
      window.addEventListener('mousemove', handleMouseMove);

      // Initial layout setup based on screen width
      let isMobile = window.innerWidth < 768;

      // 9. Animation Loop with Scroll-Driven Cinematic Camera & Earth Trajectory
      let idleSpin = 0;

      const animate = () => {
        if (isDisposed) return;
        animId = requestAnimationFrame(animate);

        // Smooth scroll progress interpolation
        scrollProgress += (targetProgress - scrollProgress) * 0.08;

        const p = scrollProgress;

        // Cinematic Positioning as you scroll:
        // Hero (p=0): Earth positioned on the right (x ~ 1.05 desktop, 0 mobile), centered vertically.
        // Mid sections (p~0.5): Earth glides toward center, rotating toward South Asia / India.
        // Bottom CTA (p=1): Earth centers perfectly (x = 0), scales up (scale ~ 2.2), and descends
        // to form a majestic curved planetary horizon beneath the "Get Started" button (Image 3).
        const baseHeroX = isMobile ? 0 : 1.05;
        const targetX = baseHeroX * (1 - p);
        const targetY = isMobile
          ? (-0.2 * (1 - p) - 1.15 * p)
          : (0.02 * (1 - p) - 1.35 * p);

        const targetScale = isMobile
          ? (0.9 + 1.0 * p)
          : (1.05 + 1.15 * p);

        // Rotation: Slow idle spin + scroll-driven rotation facing India/Pune
        idleSpin += prefersReducedMotion ? 0 : 0.0006;
        const targetRotY = 2.2 + p * 3.6 + idleSpin + mouseX * 0.12;
        const targetRotX = 0.18 + mouseY * 0.10 - p * 0.12;

        // Apply smooth dampening to earth group
        earthGroup.position.x += (targetX - earthGroup.position.x) * 0.08;
        earthGroup.position.y += (targetY - earthGroup.position.y) * 0.08;

        earthMesh.rotation.y += (targetRotY - earthMesh.rotation.y) * 0.06;
        earthMesh.rotation.x += (targetRotX - earthMesh.rotation.x) * 0.06;

        const currentScale = earthGroup.scale.x;
        const newScale = currentScale + (targetScale - currentScale) * 0.08;
        earthGroup.scale.set(newScale, newScale, newScale);

        if (atmosphereMesh) {
          atmosphereMesh.rotation.copy(earthMesh.rotation);
        }

        // Orbiting satellites
        satellites.forEach((sat) => {
          sat.angle += sat.speed;
          const x = sat.radius * Math.cos(sat.angle);
          const y = sat.radius * Math.sin(sat.angle) * Math.cos(sat.inclination);
          const z = sat.radius * Math.sin(sat.angle) * Math.sin(sat.inclination);

          sat.model.position.set(x, y, z);
          sat.model.lookAt(0, 0, 0);
          sat.model.rotateY(Math.PI / 2);
        });

        // Gentle starfield drift
        if (starField) {
          starField.rotation.y += 0.0001;
        }

        renderer.render(scene, camera);
      };

      animate();

      // 10. Resize handler
      const handleResize = () => {
        if (isDisposed) return;
        const w = window.innerWidth;
        const h = window.innerHeight;
        isMobile = w < 768;
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        renderer.setSize(w, h);
      };

      window.addEventListener('resize', handleResize);

      // Cleanup
      return () => {
        isDisposed = true;
        cancelAnimationFrame(animId);
        window.removeEventListener('scroll', handleScroll);
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('resize', handleResize);

        earthGeo.dispose();
        earthMat.dispose();
        atmosGeo.dispose();
        atmosMat.dispose();
        starGeo.dispose();
        starMat.dispose();
        if (earthMat.map) earthMat.map.dispose();

        renderer.dispose();
        if (renderer.domElement && renderer.domElement.parentNode === container) {
          container.removeChild(renderer.domElement);
        }
      };
    } catch (err) {
      console.error('Three.js full-screen Earth initialization failed:', err);
      setHasError(true);
    }
  }, []);

  if (hasError) {
    return <GlobeFallback />;
  }

  return (
    <div
      ref={mountRef}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        zIndex: 0,
        pointerEvents: 'none',
        overflow: 'hidden',
      }}
      aria-hidden="true"
    />
  );
}
