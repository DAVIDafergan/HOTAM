"use client";

import { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Line } from '@react-three/drei';
import * as THREE from 'three';

const INK_COLOR = '#1C1815';
// Lighter than the base parchment token (#F5EDE0) because this sits inside
// `.section-surface`, which lays a white/40 blur over the page background —
// matching that composited tone keeps the canvas from reading as a floating
// grey box against its surroundings.
const PARCHMENT_COLOR = '#F9F4EA';
const GOLD_COLOR = '#B08D57';
const ANIMATION_DURATION_SECONDS = 2.4;
const CURVE_POINT_COUNT = 140;

// A single flourish stroke, loosely evoking a scribe's signature — built from
// a handful of control points run through a smooth Catmull-Rom curve rather
// than hand-authored per-point data, so it stays easy to read/adjust.
function buildSignatureCurve() {
  const controlPoints = [
    new THREE.Vector3(-2.4, -0.3, 0),
    new THREE.Vector3(-1.6, 0.5, 0.15),
    new THREE.Vector3(-0.7, -0.4, 0.05),
    new THREE.Vector3(0.1, 0.55, 0.2),
    new THREE.Vector3(0.9, -0.25, 0),
    new THREE.Vector3(1.7, 0.35, 0.1),
    new THREE.Vector3(2.5, -0.1, 0),
  ];
  const curve = new THREE.CatmullRomCurve3(controlPoints, false, 'catmullrom', 0.5);
  return curve.getPoints(CURVE_POINT_COUNT);
}

function useReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mql = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduced(mql.matches);
    const handler = () => setReduced(mql.matches);
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, []);
  return reduced;
}

/** Draws once when it enters view, then stays static — never loops. */
function InkStroke({ active }: { active: boolean }) {
  const fullPoints = useMemo(buildSignatureCurve, []);
  const reducedMotion = useReducedMotion();
  const [visiblePoints, setVisiblePoints] = useState<THREE.Vector3[]>(
    reducedMotion ? fullPoints : [fullPoints[0]],
  );
  const progressRef = useRef(0);
  const doneRef = useRef(reducedMotion);

  useEffect(() => {
    if (reducedMotion) {
      setVisiblePoints(fullPoints);
      doneRef.current = true;
    }
  }, [reducedMotion, fullPoints]);

  useFrame((_, delta) => {
    if (doneRef.current || !active) return;
    progressRef.current = Math.min(1, progressRef.current + delta / ANIMATION_DURATION_SECONDS);
    const count = Math.max(2, Math.round(progressRef.current * fullPoints.length));
    setVisiblePoints(fullPoints.slice(0, count));
    if (progressRef.current >= 1) {
      doneRef.current = true;
    }
  });

  if (visiblePoints.length < 2) return null;

  return (
    <Line
      points={visiblePoints}
      color={INK_COLOR}
      lineWidth={2.5}
      worldUnits={false}
    />
  );
}

function ParchmentPlane() {
  // Unlit on purpose: a flat rectangle has no depth for lighting to reveal,
  // and an unlit material renders its exact color regardless of R3F's
  // physically-based light units — which is what lets this blend seamlessly
  // into the page's own background instead of reading as a shaded box.
  return (
    <mesh position={[0, 0, -0.3]}>
      <planeGeometry args={[8, 4]} />
      <meshBasicMaterial color={PARCHMENT_COLOR} />
    </mesh>
  );
}

function Scene({ active }: { active: boolean }) {
  return (
    <>
      {/* Soft, angled "gallery" lighting — one warm key light, gentle fill,
          no harsh specular highlights. */}
      <ambientLight intensity={1.15} color="#FFF8EC" />
      <directionalLight
        position={[3, 4, 5]}
        intensity={0.5}
        color="#FFEFD6"
      />
      <pointLight position={[-2, 1, 2]} intensity={0.15} color={GOLD_COLOR} />
      <ParchmentPlane />
      <InkStroke active={active} />
    </>
  );
}

export default function SignatureInkAnimation() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);
  const hasTriggeredRef = useRef(false);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry.isIntersecting && !hasTriggeredRef.current) {
          hasTriggeredRef.current = true;
          setInView(true);
        }
      },
      { threshold: 0.35 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={containerRef}
      className="w-full max-w-2xl mx-auto h-32 md:h-40"
      role="presentation"
      aria-hidden="true"
    >
      <Canvas
        camera={{ position: [0, 0, 5], fov: 40 }}
        dpr={[1, 1.5]}
        gl={{ antialias: true, alpha: true }}
        flat
      >
        <Scene active={inView} />
      </Canvas>
    </div>
  );
}
