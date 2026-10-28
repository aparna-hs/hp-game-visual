// Maps game state to a scene image plus its fallback tint.
// Scenes live in /public/scenes; state variants (lumos glow, fire, door,
// cold) are CSS overlays applied by SceneView, not separate images.

import { GameState } from '../engine/types';

export interface SceneSpec {
  /** Absolute path under /scenes/ */
  src: string;
  label: string;
  /** Hue for the procedural fallback when the image is missing */
  hue: number;
}

const scene = (file: string, label: string, hue: number): SceneSpec => ({
  src: `/scenes/${file}.png`,
  label,
  hue,
});

export const LOCATION_SCENES: Record<string, SceneSpec> = {
  entrance_hall: scene('entrance_hall', 'Examination Entrance Hall', 38),
  preparation_room: scene('preparation_room', 'Preparation Chamber', 40),
  dark_corridor: scene('dark_corridor', 'The Dark Corridor', 220),
  deep_tunnel: scene('deep_tunnel', 'Deep Tunnel', 165),
  chasm_room: scene('chasm_room', 'The Great Chasm', 210),
  chasm_other_side: scene('chasm_other_side', 'Beyond the Chasm', 30),
  dementor_chamber: scene('dementor_chamber', 'The Frost Chamber', 200),
  beyond_dementor: scene('beyond_dementor', 'Eastern Passage', 35),
  inferi_lake: scene('inferi_lake', 'The Underground Lake', 190),
  lake_shore: scene('lake_shore', 'Eastern Shore', 170),
  creature_enclosure: scene('creature_enclosure', 'The Creature Enclosure', 45),
  beyond_creature: scene('beyond_creature', 'Northern Passage', 25),
  guard_corridor: scene('guard_corridor', 'Guard Corridor', 280),
  beyond_guards: scene('beyond_guards', 'Inner Sanctum Approach', 45),
  armory_corridor: scene('armory_corridor', 'The Armory Corridor', 30),
  shadow_passage: scene('shadow_passage', 'Shadow Passage', 230),
  hidden_room: scene('hidden_room', 'Hidden Chamber', 320),
  water_passage: scene('water_passage', 'Flooded Corridor', 160),
  death_eater_chamber: scene('death_eater_chamber', 'The Dueling Chamber', 350),
  final_approach: scene('final_approach', 'The Final Approach', 48),
  final_chamber: scene('final_chamber', 'The Final Chamber', 260),
};

export const MOMENT_SCENES = {
  title: scene('title', 'Ministry of Magic - Auror Examination', 120),
  dementor_encounter: scene('dementor_encounter', 'A Dementor Approaches', 210),
  duel: scene('duel', 'The Duel', 350),
  mirror: scene('mirror', 'The Mirror of Erised', 265),
  victory: scene('victory', 'Auror Examination Complete', 45),
  death: scene('death', 'Examination Failed', 220),
} as const;

export type MomentKey = keyof typeof MOMENT_SCENES;

/**
 * Pick the scene for the current state: phase screens first, then
 * key moments inside rooms, then the plain location art.
 */
export function resolveScene(state: GameState): SceneSpec {
  const phase = state.gamePhase;
  if (phase === 'intro' || phase === 'naming' || phase === 'ready') {
    return MOMENT_SCENES.title;
  }
  if (phase === 'death') return MOMENT_SCENES.death;
  if (phase === 'victory') return MOMENT_SCENES.victory;

  const cs = state.challengeState;
  if (
    state.location === 'dementor_chamber' &&
    cs.dementorEngaged &&
    !cs.dementorDefeated
  ) {
    return MOMENT_SCENES.dementor_encounter;
  }
  if (state.location === 'death_eater_chamber' && !cs.deathEaterDefeated) {
    return MOMENT_SCENES.duel;
  }
  if (state.location === 'final_chamber' && !cs.finalChallengeComplete) {
    return MOMENT_SCENES.mirror;
  }

  return LOCATION_SCENES[state.location] ?? LOCATION_SCENES.entrance_hall;
}
