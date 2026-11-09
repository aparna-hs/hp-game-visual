// ImmersiveLayer: full-screen cinematic moments — room reveals, the Dementor
// encounter, spell casts, damage pulses, healing shimmers and challenge
// bursts. Nothing persistent: art appears over the whole app for a moment,
// then fades. Every layer is pointer-events: none, so the terminal keeps
// focus and typing continues underneath.

import React, { useEffect, useRef, useState } from 'react';
import { GameState } from '../engine/types';
import { VfxEvent } from '../lib/diff';
import { MOMENT_SCENES, resolveScene, SceneSpec } from '../lib/sceneIndex';

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

const SPELL_VFX_MS = 1600;

interface Splash {
  key: number;
  spec: SceneSpec;
  label: string;
  duration: number;
}

/** Deterministic pseudo-random burst vectors so particles don't reshuffle on re-render. */
function particleVectors(seed: number, count: number): { dx: string; dy: string }[] {
  const out: { dx: string; dy: string }[] = [];
  for (let i = 0; i < count; i++) {
    const h = Math.sin(seed * 999 + i * 77) * 10000;
    const angle = (h - Math.floor(h)) * Math.PI * 2;
    const dist = 60 + ((i * 17) % 130);
    out.push({ dx: `${Math.cos(angle) * dist}px`, dy: `${Math.sin(angle) * dist}px` });
  }
  return out;
}

/** Procedural fallback: a tinted, dithered SVG backdrop instead of broken art. */
function FallbackScene({ spec }: { spec: SceneSpec }) {
  const hue = spec.hue;
  const pixels = Array.from({ length: 160 }, (_, i) => {
    const h1 = Math.sin(i * 127.1 + hue) * 43758.5;
    const h2 = Math.sin(i * 311.7 + hue * 2) * 12543.8;
    return {
      x: (h1 - Math.floor(h1)) * 100,
      y: (h2 - Math.floor(h2)) * 100,
      o: 0.05 + ((i % 7) / 7) * 0.22,
      s: i % 5 === 0 ? 0.8 : 0.35,
    };
  });
  return (
    <div className="scene-art" style={{ background: `hsl(${hue} 32% 7%)` }}>
      <svg viewBox="0 0 100 100" preserveAspectRatio="xMidYMid slice" className="w-full h-full">
        {pixels.map((p, i) => (
          <rect
            key={i}
            x={p.x}
            y={p.y}
            width={p.s}
            height={p.s}
            fill={`hsl(${hue} 45% 60%)`}
            opacity={p.o}
          />
        ))}
        <rect x="0" y="0" width="100" height="100" fill={`hsl(${hue} 40% 10%)`} opacity="0.55" />
      </svg>
    </div>
  );
}

function renderSpellFx(v: VfxEvent) {
  const color = SPELL_COLORS[v.category ?? ''] ?? 'rgba(255, 255, 255, 0.7)';
  const particles = particleVectors(v.id, 14);
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

function renderEffectFx(v: VfxEvent) {
  switch (v.type) {
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

export default function ImmersiveLayer({ state, vfx }: { state: GameState; vfx: VfxEvent[] }) {
  const [splash, setSplash] = useState<Splash | null>(null);
  const [failed, setFailed] = useState<Set<string>>(new Set());
  const keyRef = useRef(1);
  const prevLoc = useRef<string | null>(null);
  const prevDementorEngaged = useRef(false);

  // Room-entry splash (also fires once when the examination begins)
  useEffect(() => {
    if (state.gamePhase !== 'playing') {
      prevLoc.current = null;
      return;
    }
    if (prevLoc.current === state.location) return;
    prevLoc.current = state.location;
    const spec = resolveScene(state);
    setSplash({ key: keyRef.current++, spec, label: spec.label.toUpperCase(), duration: 1700 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.location, state.gamePhase]);

  // Dementor encounter: the close-up art replaces the room reveal
  useEffect(() => {
    const engaged =
      state.challengeState.dementorEngaged &&
      !state.challengeState.dementorDefeated &&
      state.gamePhase === 'playing';
    if (engaged && !prevDementorEngaged.current) {
      setSplash({
        key: keyRef.current++,
        spec: MOMENT_SCENES.dementor_encounter,
        label: 'A DEMENTOR APPROACHES',
        duration: 2200,
      });
    }
    prevDementorEngaged.current = engaged;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.challengeState.dementorEngaged, state.challengeState.dementorDefeated, state.gamePhase]);

  // Auto-dismiss each splash
  useEffect(() => {
    if (!splash) return;
    const t = window.setTimeout(() => setSplash(null), splash.duration + 150);
    return () => window.clearTimeout(t);
  }, [splash]);

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
  const playing = state.gamePhase === 'playing';
  const darkRoom = ['dark_corridor', 'deep_tunnel', 'shadow_passage'].includes(state.location);
  const showLumos = playing && darkRoom && cs.lumosActive;
  const showFire = playing && state.location === 'inferi_lake' && cs.inferiCleared;
  const showDoor = playing && state.location === 'entrance_hall' && cs.doorUnlocked;
  const cold =
    playing &&
    state.location === 'dementor_chamber' &&
    cs.dementorEngaged &&
    !cs.dementorDefeated;

  const spellFx = vfx.filter((v) => v.type === 'spell');
  const effectFx = vfx.filter(
    (v) => v.type === 'damage' || v.type === 'heal' || v.type === 'challenge'
  );

  // A spell cast gets its own full-screen art moment when no splash is up;
  // during a splash the effects render on top of the splash art.
  const rootSpec = splash ? splash.spec : spellFx.length > 0 ? resolveScene(state) : null;
  const rootDuration = splash ? splash.duration : SPELL_VFX_MS;
  const rootKey = splash ? `splash-${splash.key}` : `spell-${spellFx[0]?.id}`;

  return (
    <>
      {rootSpec && (
        <div
          key={rootKey}
          className="immersive-root"
          style={{ animationDuration: `${rootDuration}ms` }}
        >
          {failed.has(rootSpec.src) ? (
            <FallbackScene spec={rootSpec} />
          ) : (
            <img
              src={rootSpec.src}
              alt=""
              onError={() => markFailed(rootSpec.src)}
              className={`scene-art ${cold ? 'cold' : ''}`}
            />
          )}
          {showLumos && <div className="overlay-lumos" />}
          {showFire && <div className="overlay-fire" />}
          {showDoor && <div className="overlay-door" />}
          {cold && <div className="overlay-cold" />}
          {spellFx.map(renderSpellFx)}
          <div className="scene-scanlines" />
          <div className="scene-vignette" />
          {splash && (
            <div className="immersive-label" style={{ animationDuration: `${rootDuration}ms` }}>
              {splash.label}
            </div>
          )}
        </div>
      )}
      {(effectFx.length > 0 || (!rootSpec && spellFx.length > 0)) && (
        <div className="immersive-fx-root">
          {effectFx.map(renderEffectFx)}
          {!rootSpec && spellFx.map(renderSpellFx)}
        </div>
      )}
    </>
  );
}
