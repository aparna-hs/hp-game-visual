// CombatPanel: enemy stats during the Death Eater duel, plus threat
// indicators for the Dementor and Inferi encounters (no HP bars for those
// two — they tick damage via their engagement flags).

import { GameState } from '../engine/types';

const DEMENTOR_PHASE_LABELS: Record<string, string> = {
  initial: 'Cold intensifies',
  first_patronus: 'Patronus flickers',
  memory_needed: 'Patronus weakening',
  complete: 'Retreating',
};

export default function CombatPanel({ state }: { state: GameState }) {
  const cs = state.challengeState;
  if (state.gamePhase !== 'playing') return null;
  const duelActive = state.location === 'death_eater_chamber' && !cs.deathEaterDefeated;
  const dementorThreat = cs.dementorEngaged && !cs.dementorDefeated;
  const inferiThreat = cs.inferiEngaged && !cs.inferiCleared;

  if (!duelActive && !dementorThreat && !inferiThreat) return null;

  const enemyPct = Math.max(0, Math.min(100, cs.deathEaterHealth));

  return (
    <div className="shrink-0 border-t border-red-900/60 bg-red-950/20 px-3 py-2 font-mono select-none">
      <div className="flex items-center gap-2 text-[10px] tracking-widest text-red-400/90 mb-1.5">
        <span className="inline-block w-1.5 h-1.5 bg-red-500 animate-pulse" />
        ACTIVE THREAT
      </div>

      {duelActive && (
        <div className="mb-1">
          <div className="flex justify-between items-baseline">
            <span className="text-[11px] text-red-400">DEATH EATER</span>
            <span className="text-[10px] text-gray-400">
              Round {cs.duelRound}
              {cs.duelDefending && <span className="text-blue-400"> | PROTEGO</span>}
            </span>
          </div>
          <div className="mt-1 h-2.5 bg-gray-800 border border-gray-700 overflow-hidden">
            <div
              className="hp-bar-fill h-full bg-red-600"
              style={{ width: `${enemyPct}%` }}
            />
          </div>
          <div className="text-[9px] text-gray-500 mt-0.5">
            enemy vitality {cs.deathEaterHealth}/100
          </div>
        </div>
      )}

      {dementorThreat && (
        <div className="flex items-baseline justify-between">
          <span className="text-[11px] text-red-400">DEMENTOR</span>
          <span className="text-[9px] text-blue-300/80">
            {DEMENTOR_PHASE_LABELS[cs.dementorPhase] ?? 'Lurking'}
          </span>
        </div>
      )}

      {inferiThreat && (
        <div className="flex items-baseline justify-between">
          <span className="text-[11px] text-red-400">INFERI</span>
          <span className="text-[9px] text-blue-300/80">Rising from the lake</span>
        </div>
      )}
    </div>
  );
}
