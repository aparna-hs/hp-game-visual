// Core game types

export interface GameState {
  playerName: string;
  health: number;
  maxHealth: number;
  location: string;
  inventory: string[];
  visitedLocations: Set<string>;
  challengesCompleted: Set<string>;
  gamePhase: 'intro' | 'naming' | 'ready' | 'playing' | 'victory' | 'death';
  score: number;
  hintsUsed: number;
  episkeyCasts: number;

  // Journey log tracking
  journeyLog: Array<{ location: string; direction?: string }>;

  // Challenge-specific state
  challengeState: ChallengeState;

  // Combat state
  combatState: CombatState | null;

  // Attempt tracking for hints
  attemptCounts: Record<string, number>;
  hintRequestCounts: Record<string, number>;
}

export interface ChallengeState {
  // Door and passage
  doorUnlocked: boolean;
  passageCleared: boolean;

  lumosActive: boolean;
  levitationBridgeBuilt: boolean;
  dementorDefeated: boolean;
  inferiCleared: boolean;
  hippogriffBowed: boolean;
  hippogriffTrusts: boolean;
  deathEaterDefeated: boolean;
  stealthPassed: boolean;
  stealthActive: boolean;
  finalChallengeComplete: boolean;

  // Mirror of Erised
  mirrorLookedOnce: boolean;

  // Dementor encounter
  dementorPhase: 'initial' | 'first_patronus' | 'memory_needed' | 'complete';
  dementorEngaged: boolean;

  // Inferi encounter
  inferiEngaged: boolean;

  // Patronus memory
  awaitingMemory: boolean;

  // Invisibility cloak
  wearingCloak: boolean;

  // Death Eater duel
  duelRound: number;
  deathEaterHealth: number;
  duelDefending: boolean;

  // Guard encounter
  guardsAlerted: boolean;
}

export interface CombatState {
  enemy: string;
  enemyHealth: number;
  enemyMaxHealth: number;
  round: number;
  playerDefending: boolean;
}

export interface Location {
  id: string;
  name: string;
  description: string;
  connections: Record<string, string>; // direction -> location id
  items: string[];
  challenge?: string;
  onEnter?: (state: GameState) => { state: GameState; message: string };
  getDescription?: (state: GameState) => string;
}

export interface CommandResult {
  message: string;
  state: GameState;
  color?: 'normal' | 'damage' | 'healing' | 'magic' | 'gold' | 'warning';
}

export interface Spell {
  name: string;
  incantation: string;
  variations?: string[];
  description: string;
}

export type Direction = 'north' | 'south' | 'east' | 'west' | 'up' | 'down' | 'enter' | 'exit';
