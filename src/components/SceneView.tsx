// SceneView: location pixel art with crossfade, code-driven state overlays
// (lumos glow, inferi fire, open door, dementor cold) and the VFX layer
// (spell flashes, damage pulses, challenge bursts).

import React, { useEffect, useState } from 'react';
import { GameState } from '../engine/types';
import { VfxEvent } from '../lib/diff';
import { resolveScene, SceneSpec } from '../lib/sceneIndex';

const SPELL_COLORS: Record<string, string> = {
  light: 'rgba(255, 255, 255, 0.85)',
  defense: 'rgba(80, 140, 255, 0.85)',
  offense: 'rgba(255, 60, 50, 0.85)',
  healing: 'rgba(70, 220, 130, 0.85)',
  utility: 'rgba(255, 200, 60, 0.85)',
  unforgivable: 'rgba(130, 20, 30, 0.9)',
  movement: 'rgba(200, 160, 255, 0.8)',
  stealth: 'rgba(180, 180, 200, 0.8)',
};

interface SceneViewProps {
  state: GameState;
  vfx: VfxEvent[];
}

interface SceneState {
  cur: SceneSpec;
  prev: SceneSpec | null;
}

/** Deterministic pseudo-random burst vectors so particles don't reshuffle on re-render. */
function particleVectors(seed: number, count: number): { dx: string; dy: string }[] {
  const out: { dx: string; dy: string }[] = [];
  for (let i = 0; i < count; i++) {
    const h = Math.sin(seed * 999 + i * 77) * 10000;
    const angle = (h - Math.floor(h)) * Math.PI * 2;
    const dist = 45 + ((i * 13) % 55);
    out.push({ dx: `${Math.cos(angle) * dist}px`, dy: `${Math.sin(angle) * dist}px` });
  }
  return out;
}

/** Procedural fallback: a tinted, dithered SVG backdrop instead of broken art. */
function FallbackScene({ spec }: { spec: SceneSpec }) {
  const hue = spec.hue;
  const pixels = Array.from({ length: 90 }, (_, i) => {
    const h1 = Math.sin(i * 127.1 + hue) * 43758.5;
    const h2 = Math.sin(i * 311.7 + hue * 2) * 12543.8;
    return {
      x: (h1 - Math.floor(h1)) * 320,
      y: (h2 - Math.floor(h2)) * 200,
      o: 0.05 + ((i % 7) / 7) * 0.2,
      s: i % 5 === 0 ? 4 : 2,
    };
  });
  return (
    <div className="scene-art" style={{ background: `hsl(${hue} 32% 7%)` }}>
      <svg viewBox="0 0 320 200" preserveAspectRatio="xMidYMid slice" className="w-full h-full">
        {pixels.map((p, i) => (
          <rect key={i} x={p.x} y={p.y} width={p.s} height={p.s} fill={`hsl(${hue} 45% 60%)`} opacity={p.o} />
        ))}
        <ellipse cx="160" cy="105" rx="150" ry="80" fill={`hsl(${hue} 40% 12%)`} />
        <ellipse cx="160" cy="95" rx="90" ry="55" fill={`hsl(${hue} 45% 18%)`} />
      </svg>
    </div>
  );
}

function renderVfx(v: VfxEvent) {
  switch (v.type) {
    case 'spell': {
      const color = SPELL_COLORS[v.category ?? ''] ?? 'rgba(255, 255, 255, 0.7)';
      const particles = particleVectors(v.id, 12);
      return (
        <div key={v.id}>
          <div className="vfx-spell" style={{ '--vfx': color } as React.CSSProperties} />
          {particles.map((p, i) => (
            <span
              key={i}
              className="vfx-particle"
              style={{ '--vfx': color, '--dx': p.dx, '--dy': p.dy } as React.CSSProperties}
            />
          ))}
        </div>
      );
    }
    case 'damage':
      return <div key={v.id} className="vfx-damage" />;
    case 'heal':
      return <div key={v.id} className="vfx-heal" />;
    case 'challenge':
      return (
        <div key={v.id}>
          <div className="vfx-challenge" />
          <div className="vfx-ring" />
        </div>
      );
    default:
      return null;
  }
}

export default function SceneView({ state, vfx }: SceneViewProps) {
  const spec = resolveScene(state);
  const [scene, setScene] = useState<SceneState>({ cur: spec, prev: null });
  const [failed, setFailed] = useState<Set<string>>(new Set());

  // Crossfade: keep the previous scene beneath while the new one fades in.
  useEffect(() => {
    setScene((prev) => (prev.cur.src === spec.src ? prev : { cur: spec, prev: prev.cur }));
  }, [spec]);

  useEffect(() => {
    if (!scene.prev) return;
    const t = window.setTimeout(() => setScene((prev) => ({ ...prev, prev: null })), 700);
    return () => window.clearTimeout(t);
  }, [scene]);

  const markFailed = (src: string) => {
    setFailed((prev) => {
      if (prev.has(src)) return prev;
      const next = new Set(prev);
      next.add(src);
      return next;
    });
  };

  // State overlays (code variants, not extra images)
  const cs = state.challengeState;
  const playing = state.gamePhase === 'playing' || state.gamePhase === 'victory';
  const darkRoom = ['dark_corridor', 'deep_tunnel', 'shadow_passage'].includes(state.location);
  const showLumos = playing && darkRoom && cs.lumosActive;
  const showFire = playing && state.location === 'inferi_lake' && cs.inferiCleared;
  const showDoor = playing && state.location === 'entrance_hall' && cs.doorUnlocked;
  const cold =
    playing &&
    state.location === 'dementor_chamber' &&
    cs.dementorEngaged &&
    !cs.dementorDefeated;

  const curFailed = failed.has(scene.cur.src);
  const prevFailed = scene.prev ? failed.has(scene.prev.src) : false;
  const sceneVfx = vfx.filter(
    (v) => v.type === 'spell' || v.type === 'damage' || v.type === 'heal' || v.type === 'challenge'
  );

  return (
    <div className="scene-frame h-full w-full">
      {scene.prev &&
        (prevFailed ? (
          <FallbackScene spec={scene.prev} />
        ) : (
          <img src={scene.prev.src} alt="" className="scene-art" />
        ))}

      {curFailed ? (
        <FallbackScene spec={scene.cur} />
      ) : (
        <img
          key={scene.cur.src}
          src={scene.cur.src}
          alt={scene.cur.label}
          onError={() => markFailed(scene.cur.src)}
          className={`scene-art scene-fade ${cold ? 'cold' : ''}`}
        />
      )}

      {showLumos && <div className="overlay-lumos" />}
      {showFire && <div className="overlay-fire" />}
      {showDoor && <div className="overlay-door" />}
      {cold && <div className="overlay-cold" />}

      <div className="vfx-layer">{sceneVfx.map(renderVfx)}</div>
      <div className="scene-scanlines" />
      <div className="scene-vignette" />

      <div className="absolute bottom-0 inset-x-0 z-40 px-2 py-1 bg-black/70 border-t border-green-900/70 font-mono text-[10px] tracking-widest text-green-300/90 truncate">
        {scene.cur.label.toUpperCase()}
      </div>
    </div>
  );
}
