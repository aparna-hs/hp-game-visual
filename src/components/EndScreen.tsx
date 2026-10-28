// EndScreen: full-screen victory/death art moment with the calculateGrade
// report card. Dismiss to return to the terminal (RESTART still available).

import { GameState } from '../engine/types';
import { calculateGrade } from '../engine/engine';
import { MOMENT_SCENES, SceneSpec } from '../lib/sceneIndex';

function EndArt({ spec }: { spec: SceneSpec }) {
  return (
    <div className="scene-frame h-44">
      <img src={spec.src} alt={spec.label} className="scene-art end-art" />
      <div className="scene-scanlines" />
      <div className="scene-vignette" />
    </div>
  );
}

interface EndScreenProps {
  state: GameState;
  kind: 'victory' | 'death';
  onDismiss: () => void;
}

export default function EndScreen({ state, kind, onDismiss }: EndScreenProps) {
  const victory = kind === 'victory';
  const grade = calculateGrade(state);
  const spec = victory ? MOMENT_SCENES.victory : MOMENT_SCENES.death;
  const accent = victory ? 'border-yellow-500/70' : 'border-red-700/70';
  const accentText = victory ? 'text-yellow-400' : 'text-red-500';

  return (
    <div
      className="end-fade fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4 overflow-y-auto"
      onClick={onDismiss}
    >
      <div
        className={`end-fade w-full max-w-xl border-2 ${accent} bg-gray-950/95 shadow-[0_0_60px_rgba(0,0,0,0.9)]`}
        onClick={(e) => e.stopPropagation()}
      >
        <EndArt spec={spec} />

        <div className="p-4 font-mono">
          <div className={`text-center text-sm tracking-widest mb-3 ${accentText}`}>
            {victory ? '═══════ EXAMINATION RESULTS ═══════' : '═══════ EXAMINATION FAILED ═══════'}
          </div>

          <div className="text-xs text-gray-300 space-y-1">
            <div>Candidate: <span className="text-yellow-300">{state.playerName}</span></div>
            <div>Final Score: <span className="text-yellow-300">{state.score} points</span></div>
            <div>Health Remaining: <span className="text-green-400">{state.health}/{state.maxHealth}</span></div>
            <div>Hints Used: <span className="text-purple-400">{state.hintsUsed}</span></div>
            <div>
              Challenges Completed:{' '}
              <span className="text-yellow-300">{state.challengesCompleted.size}/9</span>
            </div>
          </div>

          <div className={`mt-3 pt-3 border-t ${victory ? 'border-yellow-500/30' : 'border-red-700/30'}`}>
            <div className={`text-sm ${accentText}`}>
              GRADE: {grade.grade} - {grade.title}
            </div>
            <div className="text-xs text-gray-400 mt-1">{grade.description}</div>
          </div>

          <button
            onClick={onDismiss}
            className={`mt-4 w-full py-2 text-xs tracking-widest border ${
              victory
                ? 'border-yellow-500/70 text-yellow-300 hover:bg-yellow-500/10'
                : 'border-red-600/70 text-red-300 hover:bg-red-600/10'
            }`}
          >
            RETURN TO TERMINAL
          </button>
          <div className="mt-2 text-center text-[10px] text-gray-600">
            Type RESTART in the terminal to try again.
          </div>
        </div>
      </div>
    </div>
  );
}
