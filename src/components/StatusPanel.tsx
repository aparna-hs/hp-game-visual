// StatusPanel: HP bar (animated), score with delta pop, inventory, and the
// nine challenge badges. Everything derives from GameState directly.

import { useEffect, useRef, useState } from 'react';
import { GameState } from '../engine/types';
import { CHALLENGE_NAMES, CHALLENGE_ORDER, itemName } from '../lib/diff';

export default function StatusPanel({ state }: { state: GameState }) {
  const healthPct = Math.max(0, Math.min(100, (state.health / state.maxHealth) * 100));
  const barColor =
    healthPct <= 25 ? 'bg-red-500' : healthPct <= 50 ? 'bg-yellow-500' : 'bg-green-500';

  // Score delta pop
  const prevScore = useRef(state.score);
  const [pop, setPop] = useState<{ delta: number; key: number } | null>(null);

  useEffect(() => {
    if (state.score === prevScore.current) return;
    const delta = state.score - prevScore.current;
    prevScore.current = state.score;
    setPop({ delta, key: Date.now() });
    const t = window.setTimeout(() => setPop(null), 1100);
    return () => window.clearTimeout(t);
  }, [state.score]);

  const playing =
    state.gamePhase === 'playing' || state.gamePhase === 'victory' || state.gamePhase === 'death';

  return (
    <div className="shrink-0 border-t border-green-900 px-3 py-2 font-mono select-none">
      <div className="text-[10px] tracking-widest text-green-500/80 mb-1.5">CANDIDATE STATUS</div>

      {/* HP */}
      <div className="flex items-center gap-2">
        <span className="text-[11px] text-green-400 w-6 shrink-0">HP</span>
        <div className="flex-1 h-3 bg-gray-800 border border-gray-700 overflow-hidden">
          <div
            className={`hp-bar-fill h-full ${barColor}`}
            style={{ width: `${playing ? healthPct : 100}%` }}
          />
        </div>
        <span className="text-[11px] text-green-400 shrink-0">
          {state.health}/{state.maxHealth}
        </span>
      </div>

      {/* Score */}
      <div className="relative flex items-center gap-2 mt-1.5">
        <span className="text-[11px] text-yellow-400 w-6 shrink-0">SC</span>
        <span className="text-sm text-yellow-300">{state.score}</span>
        {pop && (
          <span
            key={pop.key}
            className={`score-pop absolute left-14 text-[11px] ${
              pop.delta > 0 ? 'text-green-400' : 'text-red-400'
            }`}
          >
            {pop.delta > 0 ? `+${pop.delta}` : pop.delta}
          </span>
        )}
        <span className="text-[10px] text-gray-600 ml-1">
          hints: {state.hintsUsed}
        </span>
      </div>

      {/* Inventory */}
      <div className="flex items-start gap-2 mt-1.5">
        <span className="text-[11px] text-purple-400 w-6 shrink-0">INV</span>
        {state.inventory.length === 0 ? (
          <span className="text-[10px] text-gray-600">empty satchel</span>
        ) : (
          <div className="flex flex-wrap gap-1">
            {state.inventory.map((item, i) => (
              <span
                key={`${item}-${i}`}
                className="px-1 py-px text-[10px] border border-purple-900/70 text-purple-300 bg-purple-950/30 rounded-sm"
              >
                {itemName(item)}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Challenge badges */}
      <div className="grid grid-cols-3 gap-1 mt-2">
        {CHALLENGE_ORDER.map((id) => {
          const unlocked = playing && state.challengesCompleted.has(id);
          return (
            <div
              key={`${id}-${unlocked}`}
              className={`px-1 py-0.5 text-[9px] leading-tight text-center border rounded-sm truncate ${
                unlocked
                  ? 'badge-unlock border-amber-500/70 text-amber-300 bg-amber-500/10'
                  : 'border-gray-800 text-gray-600'
              }`}
            >
              <span className="mr-0.5">{unlocked ? '★' : '✦'}</span>
              {CHALLENGE_NAMES[id]}
            </div>
          );
        })}
      </div>
    </div>
  );
}
