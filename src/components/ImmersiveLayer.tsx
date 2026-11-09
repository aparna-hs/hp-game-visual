// ImmersiveLayer: full-screen cinematic moments — room reveals, the Dementor
// encounter, spell casts, damage pulses, healing shimmers and challenge
// bursts. Room art HOLDS until you take it in: Escape, any key or a click
// dismisses it (typing your next command dismisses it on the first keystroke).
// A generous auto-fallback keeps it from lingering forever. Every layer is
// pointer-events: none, so the terminal keeps focus and typing continues.

import React, { useCallback, useEffect, useRef, useState } from 'react';
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
const HOLD_FALLBACK_MS = 10000;
const CLOSE_ANIM_MS = 340;

interface Splash {
  key: number;
  spec: SceneSpec;
  label: string;
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

function renderSummon(v: VfxEvent) {
  return (
    <div key={v.id} className="vfx-summon">
      <svg viewBox="0 0 22 34" width="46" height="70" aria-hidden="true">
        <rect x="9" y="1" width="4" height="4" fill="#8a6d3a" />
        <rect x="8.5" y="4" width="5" height="4" fill="#9fd8b4" opacity="0.9" />
        <rect
          x="5"
          y="8"
          width="12"
          height="24"
          rx="4.5"
          fill="#123f26"
          stroke="#7ef29a"
          strokeWidth="1.5"
        />
        <rect x="7" y="18" width="8" height="12" rx="2.5" fill="#fbbf24" />
        <rect x="7" y="10" width="2.5" height="7" fill="#d1fae5" opacity="0.75" />
      </svg>
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
    case 'summon':
      return renderSummon(v);
    default:
      return null;
  }
}

export default function ImmersiveLayer({ state, vfx }: { state: GameState; vfx: VfxEvent[] }) {
  const [splash, setSplash] = useState<Splash | null>(null);
  const [closing, setClosing] = useState(false);
  const [failed, setFailed] = useState<Set<string>>(new Set());

  const keyRef = useRef(1);
  const prevLoc = useRef<string | null>(null);
  const prevDementorEngaged = useRef(false);
  const prevDoorOpen = useRef(false);
  const prevBridgeBuilt = useRef(false);
  const prevDementorDefeated = useRef(false);
  const splashRef = useRef<Splash | null>(null);
  const closingRef = useRef(false);
  const closeTimerRef = useRef<number | null>(null);

  const openSplash = useCallback((spec: SceneSpec, label: string) => {
    if (closeTimerRef.current !== null) {
      window.clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
    closingRef.current = false;
    setClosing(false);
    const next: Splash = { key: keyRef.current++, spec, label };
    splashRef.current = next;
    setSplash(next);
  }, []);

  const dismissSplash = useCallback(() => {
    if (!splashRef.current || closingRef.current) return;
    closingRef.current = true;
    setClosing(true);
    closeTimerRef.current = window.setTimeout(() => {
      splashRef.current = null;
      closingRef.current = false;
      closeTimerRef.current = null;
      setSplash(null);
      setClosing(false);
    }, CLOSE_ANIM_MS);
  }, []);

  // Clean up any pending close animation on unmount
  useEffect(() => {
    const timer = closeTimerRef;
    return () => {
      if (timer.current !== null) window.clearTimeout(timer.current);
    };
  }, []);

  // Room-entry splash (also fires once when the examination begins).
  // Cleared whenever play stops (victory / death / restart).
  useEffect(() => {
    if (state.gamePhase !== 'playing') {
      prevLoc.current = null;
      if (splashRef.current) dismissSplash();
      return;
    }
    if (prevLoc.current === state.location) return;
    prevLoc.current = state.location;
    const spec = resolveScene(state);
    openSplash(spec, spec.label.toUpperCase());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.location, state.gamePhase]);

  // Dementor encounter: the close-up art replaces the room reveal
  useEffect(() => {
    const engaged =
      state.challengeState.dementorEngaged &&
      !state.challengeState.dementorDefeated &&
      state.gamePhase === 'playing';
    if (engaged && !prevDementorEngaged.current) {
      openSplash(MOMENT_SCENES.dementor_encounter, 'A DEMENTOR APPROACHES');
    }
    prevDementorEngaged.current = engaged;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.challengeState.dementorEngaged, state.challengeState.dementorDefeated, state.gamePhase]);

  // Set pieces: dedicated art when world-changing actions land
  useEffect(() => {
    const opened = state.challengeState.doorUnlocked && state.gamePhase === 'playing';
    if (opened && !prevDoorOpen.current) {
      openSplash(MOMENT_SCENES.door_open, 'THE IRON DOOR SWINGS OPEN');
    }
    prevDoorOpen.current = opened;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.challengeState.doorUnlocked, state.gamePhase]);

  useEffect(() => {
    const built = state.challengeState.levitationBridgeBuilt && state.gamePhase === 'playing';
    if (built && !prevBridgeBuilt.current) {
      openSplash(MOMENT_SCENES.bridge_built, 'A BRIDGE ASSEMBLES ITSELF');
    }
    prevBridgeBuilt.current = built;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.challengeState.levitationBridgeBuilt, state.gamePhase]);

  useEffect(() => {
    const defeated = state.challengeState.dementorDefeated && state.gamePhase === 'playing';
    if (defeated && !prevDementorDefeated.current) {
      openSplash(MOMENT_SCENES.patronus, 'EXPECTO PATRONUM!');
    }
    prevDementorDefeated.current = defeated;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.challengeState.dementorDefeated, state.gamePhase]);

  // A held splash dismisses on Escape / any key / any tap, and after a
  // generous fallback timer so it can never linger forever.
  useEffect(() => {
    if (!splash || closing) return;
    const onDismiss = () => dismissSplash();
    const fallback = window.setTimeout(onDismiss, HOLD_FALLBACK_MS);
    document.addEventListener('keydown', onDismiss);
    document.addEventListener('pointerdown', onDismiss);
    return () => {
      window.clearTimeout(fallback);
      document.removeEventListener('keydown', onDismiss);
      document.removeEventListener('pointerdown', onDismiss);
    };
  }, [splash, closing, dismissSplash]);

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
    (v) =>
      v.type === 'damage' ||
      v.type === 'heal' ||
      v.type === 'challenge' ||
      v.type === 'summon'
  );

  // A splash holds until dismissed. A spell cast with no splash up gets its
  // own brief full-screen art flash, timed with the VFX lifetime.
  const isSplashRoot = splash !== null;
  // Set-piece art tells its own story (e.g. darkness beyond the open door),
  // so room-state overlays must not stack on top of it.
  const setPieceRoot = splash?.spec.setPiece === true;
  const rootSpec = splash ? splash.spec : spellFx.length > 0 ? resolveScene(state) : null;
  const rootKey = splash ? `splash-${splash.key}` : `spell-${spellFx[0]?.id}`;
  const rootClass = isSplashRoot
    ? `immersive-root ${closing ? 'immersive-out' : 'immersive-in'}`
    : 'immersive-root immersive-lifecycle';

  return (
    <>
      {rootSpec && (
        <div
          key={rootKey}
          className={rootClass}
          style={isSplashRoot ? undefined : { animationDuration: `${SPELL_VFX_MS}ms` }}
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
          {showLumos && !setPieceRoot && <div className="overlay-lumos" />}
          {showFire && !setPieceRoot && <div className="overlay-fire" />}
          {showDoor && !setPieceRoot && <div className="overlay-door" />}
          {cold && <div className="overlay-cold" />}
          {spellFx.map(renderSpellFx)}
          <div className="scene-scanlines" />
          <div className="scene-vignette" />
          {splash && <div className="immersive-label">{splash.label}</div>}
          {splash && !closing && <div className="immersive-hint">ESC TO CONTINUE</div>}
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
