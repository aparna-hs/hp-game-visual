// Hand-authored fog-of-war map layout for all 21 rooms.
// Coordinates: x grows east, y grows SOUTH (negative y = north), so every
// direction-labelled connection (n/s/e/w) renders as a clean orthogonal edge.
//
// Reveal rule (strict): a node renders only when its room is in
// visitedLocations; an edge only when BOTH endpoints are visited.

import { LOCATIONS } from '../engine/locations';
import { GameState } from '../engine/types';

export interface MapNode {
  id: string;
  x: number;
  y: number;
  label: string;
  labelPos: 'below' | 'right';
}

export const MAP_NODES: MapNode[] = [
  { id: 'entrance_hall', x: 0, y: 0, label: 'Entrance', labelPos: 'below' },
  { id: 'preparation_room', x: 110, y: 0, label: 'Prep', labelPos: 'below' },
  { id: 'water_passage', x: -110, y: 0, label: 'Flooded', labelPos: 'below' },
  { id: 'dark_corridor', x: 0, y: -120, label: 'Dark Corridor', labelPos: 'right' },
  { id: 'deep_tunnel', x: 0, y: -240, label: 'Tunnel', labelPos: 'below' },
  { id: 'shadow_passage', x: 130, y: -240, label: 'Shadow', labelPos: 'below' },
  { id: 'hidden_room', x: 260, y: -240, label: 'Hidden', labelPos: 'below' },
  { id: 'chasm_room', x: 0, y: -360, label: 'Chasm', labelPos: 'below' },
  { id: 'chasm_other_side', x: 0, y: -480, label: 'Far Side', labelPos: 'below' },
  { id: 'dementor_chamber', x: 130, y: -480, label: 'Frost', labelPos: 'below' },
  { id: 'beyond_dementor', x: 260, y: -480, label: 'E. Passage', labelPos: 'below' },
  { id: 'inferi_lake', x: 390, y: -480, label: 'Lake', labelPos: 'below' },
  { id: 'lake_shore', x: 520, y: -480, label: 'Shore', labelPos: 'below' },
  { id: 'creature_enclosure', x: 520, y: -600, label: 'Creature', labelPos: 'below' },
  { id: 'beyond_creature', x: 520, y: -720, label: 'N. Passage', labelPos: 'below' },
  { id: 'guard_corridor', x: 520, y: -840, label: 'Guards', labelPos: 'below' },
  { id: 'beyond_guards', x: 520, y: -960, label: 'Sanctum', labelPos: 'below' },
  { id: 'armory_corridor', x: 390, y: -960, label: 'Armory', labelPos: 'below' },
  { id: 'death_eater_chamber', x: 650, y: -960, label: 'Duel', labelPos: 'below' },
  { id: 'final_approach', x: 650, y: -1080, label: 'Approach', labelPos: 'below' },
  { id: 'final_chamber', x: 650, y: -1200, label: 'Final', labelPos: 'below' },
];

export const MAP_NODE_BY_ID: Record<string, MapNode> = Object.fromEntries(
  MAP_NODES.map((n) => [n.id, n])
);

export interface MapEdge {
  from: string;
  to: string;
  dir: string;
}

// Undirected edges derived from the LOCATIONS connection graph.
export const MAP_EDGES: MapEdge[] = (() => {
  const edges: MapEdge[] = [];
  const seen = new Set<string>();
  for (const [id, loc] of Object.entries(LOCATIONS)) {
    for (const [dir, target] of Object.entries(loc.connections)) {
      const key = [id, target].sort().join('|');
      if (seen.has(key)) continue;
      seen.add(key);
      edges.push({ from: id, to: target, dir });
    }
  }
  return edges;
})();

// Fixed viewBox that fits all 21 rooms with label and padding margins.
export const MAP_VIEWBOX = { x: -190, y: -1250, w: 950, h: 1360 };

// Challenge associated with each room (for the small completion marker).
export const CHALLENGE_BY_ROOM: Record<string, string> = {
  entrance_hall: 'alohomora',
  dark_corridor: 'lumos',
  chasm_room: 'levitation',
  shadow_passage: 'passage',
  dementor_chamber: 'dementor',
  inferi_lake: 'inferi',
  creature_enclosure: 'hippogriff',
  guard_corridor: 'stealth',
  death_eater_chamber: 'duel',
  final_chamber: 'final',
};

export function isRoomChallengeDone(state: GameState, roomId: string): boolean {
  const challenge = CHALLENGE_BY_ROOM[roomId];
  if (!challenge) return false;
  // The narrow passage is never added to challengesCompleted; track its flag.
  if (challenge === 'passage') return state.challengeState.passageCleared;
  return state.challengesCompleted.has(challenge);
}
