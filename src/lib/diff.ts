// State diffing: derives GameEvents and VFX triggers from GameState transitions.
// The vendored engine is a black box — everything the visual panel knows
// comes from comparing the previous state with the next.

import { GameState } from '../engine/types';
import { LOCATIONS } from '../engine/locations';

export type EventTone = 'info' | 'good' | 'bad' | 'gold' | 'magic';

export type EventKind =
  | 'location'
  | 'challenge'
  | 'health'
  | 'score'
  | 'item'
  | 'flag'
  | 'combat'
  | 'phase';

export interface GameEvent {
  id: number;
  turn: number;
  kind: EventKind;
  text: string;
  tone: EventTone;
}

export type VfxType = 'spell' | 'damage' | 'heal' | 'challenge' | 'victory' | 'death';

export interface VfxEvent {
  id: number;
  type: VfxType;
  /** Spell category, when type === 'spell' */
  category?: string;
  /** Damage / heal magnitude */
  amount?: number;
}

// Pre-id'd raw forms produced by diffStates; useGame stamps ids and turns.
export interface RawEvent {
  kind: EventKind;
  text: string;
  tone: EventTone;
}

export interface RawVfx {
  type: VfxType;
  category?: string;
  amount?: number;
}

// The 9 scored challenges, in progression order (badges in StatusPanel).
export const CHALLENGE_ORDER: string[] = [
  'alohomora',
  'lumos',
  'levitation',
  'dementor',
  'inferi',
  'hippogriff',
  'stealth',
  'duel',
  'final',
];

export const CHALLENGE_NAMES: Record<string, string> = {
  alohomora: 'Locked Door',
  lumos: 'Darkness',
  levitation: 'Chasm',
  dementor: 'Dementor',
  inferi: 'Inferi',
  hippogriff: 'Hippogriff',
  stealth: 'Guards',
  duel: 'Duel',
  final: 'Mirror',
};

const ITEM_NAMES: Record<string, string> = {
  dittany: 'Essence of Dittany',
  wiggenweld_potion: 'Wiggenweld Potion',
  healing_herbs: 'Healing Herbs',
  invisibility_cloak: 'Invisibility Cloak',
};

export function itemName(id: string): string {
  return ITEM_NAMES[id] ?? id;
}

function countItems(inventory: string[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const item of inventory) {
    counts.set(item, (counts.get(item) ?? 0) + 1);
  }
  return counts;
}

/**
 * Compare two consecutive GameStates and derive feed events + VFX triggers.
 * Pure function; no engine or React knowledge.
 */
export function diffStates(prev: GameState | null, next: GameState): {
  events: RawEvent[];
  vfx: RawVfx[];
} {
  if (!prev) return { events: [], vfx: [] };

  const events: RawEvent[] = [];
  const vfx: RawVfx[] = [];

  // Phase transitions
  if (prev.gamePhase !== next.gamePhase) {
    if (next.gamePhase === 'victory') {
      events.push({ kind: 'phase', text: 'EXAMINATION COMPLETE', tone: 'gold' });
      vfx.push({ type: 'victory' });
    }
    if (next.gamePhase === 'death') {
      events.push({ kind: 'phase', text: 'The examination ends in failure', tone: 'bad' });
      vfx.push({ type: 'death' });
    }
  }

  // Location
  if (prev.location !== next.location) {
    const loc = LOCATIONS[next.location];
    events.push({
      kind: 'location',
      text: `Entered: ${loc ? loc.name : next.location}`,
      tone: 'magic',
    });
  }

  // Health
  const dHealth = next.health - prev.health;
  if (dHealth < 0) {
    events.push({ kind: 'health', text: `-${Math.abs(dHealth)} HP`, tone: 'bad' });
    vfx.push({ type: 'damage', amount: Math.abs(dHealth) });
  } else if (dHealth > 0) {
    events.push({ kind: 'health', text: `+${dHealth} HP`, tone: 'good' });
    vfx.push({ type: 'heal', amount: dHealth });
  }

  // Challenges completed
  const newChallenges = [...next.challengesCompleted].filter(
    (c) => !prev.challengesCompleted.has(c)
  );
  const scoreDelta = next.score - prev.score;

  for (const c of newChallenges) {
    const name = CHALLENGE_NAMES[c] ?? c;
    const text =
      scoreDelta !== 0
        ? `Challenge complete: ${name} (${scoreDelta > 0 ? '+' : ''}${scoreDelta})`
        : `Challenge complete: ${name}`;
    events.push({ kind: 'challenge', text, tone: 'gold' });
    vfx.push({ type: 'challenge' });
  }

  // Score changes outside of challenge completions (hints, penalties, etc.)
  if (scoreDelta !== 0 && newChallenges.length === 0) {
    events.push({
      kind: 'score',
      text: `Score ${scoreDelta > 0 ? '+' : ''}${scoreDelta}`,
      tone: scoreDelta > 0 ? 'gold' : 'bad',
    });
  }

  // Inventory (multiset-aware: two dittany vials count separately)
  const prevCounts = countItems(prev.inventory);
  const nextCounts = countItems(next.inventory);
  for (const [item, n] of nextCounts) {
    const added = n - (prevCounts.get(item) ?? 0);
    if (added > 0) {
      events.push({ kind: 'item', text: `Acquired: ${itemName(item)}`, tone: 'good' });
    }
  }
  for (const [item, n] of prevCounts) {
    const removed = n - (nextCounts.get(item) ?? 0);
    if (removed > 0) {
      events.push({ kind: 'item', text: `Lost: ${itemName(item)}`, tone: 'bad' });
    }
  }

  // Combat: enemy damage taken
  const deDelta = next.challengeState.deathEaterHealth - prev.challengeState.deathEaterHealth;
  if (deDelta < 0) {
    events.push({
      kind: 'combat',
      text: `Death Eater takes ${Math.abs(deDelta)} damage`,
      tone: 'good',
    });
  }

  // Challenge-state flag transitions worth surfacing
  const pc = prev.challengeState;
  const nc = next.challengeState;

  const flag = (
    was: boolean,
    is: boolean,
    onText: string,
    onTone: EventTone,
    offText?: string,
    offTone: EventTone = 'info'
  ) => {
    if (was !== is) {
      if (is) {
        events.push({ kind: 'flag', text: onText, tone: onTone });
      } else if (offText) {
        events.push({ kind: 'flag', text: offText, tone: offTone });
      }
    }
  };

  flag(pc.lumosActive, nc.lumosActive, 'Wand lit (Lumos)', 'magic', 'Wand light extinguished');
  flag(pc.doorUnlocked, nc.doorUnlocked, 'The iron door swings open', 'gold');
  flag(
    pc.levitationBridgeBuilt,
    nc.levitationBridgeBuilt,
    'A bridge assembles itself across the chasm',
    'magic'
  );
  flag(pc.passageCleared, nc.passageCleared, 'The narrow passage is passable', 'good');
  flag(pc.dementorEngaged, nc.dementorEngaged, 'A Dementor has engaged you', 'bad');
  flag(pc.inferiEngaged, nc.inferiEngaged, 'The Inferi rise from the lake', 'bad');
  flag(pc.hippogriffBowed, nc.hippogriffBowed, 'You bow to the hippogriff', 'info');
  flag(pc.hippogriffTrusts, nc.hippogriffTrusts, 'The hippogriff bows back', 'magic');
  flag(pc.guardsAlerted, nc.guardsAlerted, 'The guards are alerted', 'bad');
  flag(
    pc.wearingCloak,
    nc.wearingCloak,
    'Invisibility cloak on',
    'magic',
    'Invisibility cloak removed'
  );
  flag(pc.stealthActive, nc.stealthActive, 'A muffling spell hides your steps', 'magic');
  flag(
    pc.duelDefending,
    nc.duelDefending,
    'You brace behind a Protego shield',
    'info',
    'Shield lowered'
  );
  flag(
    pc.mirrorLookedOnce,
    nc.mirrorLookedOnce,
    'You look into the Mirror of Erised',
    'magic'
  );
  flag(
    pc.awaitingMemory,
    nc.awaitingMemory,
    'A memory could fuel your Patronus',
    'magic'
  );

  return { events, vfx };
}
