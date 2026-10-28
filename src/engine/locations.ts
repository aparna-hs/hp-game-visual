// Game locations and map

import { Location, GameState } from './types';

// Helper to check if lumos is needed
function needsLight(state: GameState): boolean {
  const darkLocations = ['dark_corridor', 'deep_tunnel', 'shadow_passage'];
  return darkLocations.includes(state.location) && !state.challengeState.lumosActive;
}

export const LOCATIONS: Record<string, Location> = {
  // === ENTRANCE AREA ===
  'entrance_hall': {
    id: 'entrance_hall',
    name: 'Examination Entrance Hall',
    description: `You stand in a grand stone hall, torches flickering along the walls.
The ceiling arches high above, lost in shadow.

A heavy iron door blocks the path north. It appears to be locked.
A small preparation chamber lies to the east.`,
    connections: {
      'north': 'dark_corridor',
      'east': 'preparation_room',
      'west': 'water_passage',
    },
    items: [],
    challenge: 'alohomora',
    getDescription: (state: GameState) => {
      const doorUnlocked = state.challengeState.doorUnlocked;
      let desc = `You stand in a grand stone hall, torches flickering along the walls.
The ceiling arches high above, lost in shadow.`;

      if (doorUnlocked) {
        desc += `\n\nThe heavy iron door to the north stands open, leading into darkness.`;
      } else {
        desc += `\n\nA heavy iron door blocks the path north. It appears to be locked.`;
      }

      desc += `\n\nA small preparation chamber lies to the east. You can hear the sound of
dripping water from a flooded passage to the west - it doesn't look passable.`;
      return desc;
    },
  },

  'preparation_room': {
    id: 'preparation_room',
    name: 'Preparation Chamber',
    description: `A small chamber lined with shelves. Dust motes dance in the dim light
filtering through cracks in the stone. Old training manuals and empty potion vials
litter the shelves. A notice on the wall reads: "Candidates proceed at their own risk."

The main hall lies to the west.`,
    connections: {
      'west': 'entrance_hall',
    },
    items: ['dittany'],
    getDescription: (state: GameState) => {
      const hasItem = state.inventory.includes('dittany');
      let desc = `A small chamber lined with shelves. Dust motes dance in the dim light
filtering through cracks in the stone. Old training manuals and empty potion vials
litter the shelves. A notice on the wall reads: "Candidates proceed at their own risk."`;

      if (!hasItem) {
        desc += `\n\nAmong the clutter, you notice a small vial of Essence of Dittany,
still sealed.`;
      }

      desc += `\n\nThe main hall lies to the west.`;
      return desc;
    },
  },

  // === DARK CORRIDOR CHALLENGE ===
  'dark_corridor': {
    id: 'dark_corridor',
    name: 'The Dark Corridor',
    description: `Complete darkness engulfs you. You cannot see your hand in front
of your face. The air is cold and stale. Something skitters in the darkness ahead.
You hear dripping water echoing from somewhere.

You can barely make out the faint glow of torches behind you to the south.`,
    connections: {
      'south': 'entrance_hall',
      'north': 'deep_tunnel',
    },
    items: [],
    challenge: 'lumos',
    getDescription: (state: GameState) => {
      if (state.challengeState.lumosActive) {
        return `Your wand casts a steady glow, illuminating the corridor. The walls are
covered in ancient moss and carved runes - you could READ them for guidance.
The passage continues north, deeper into the examination maze. Behind you,
the entrance hall glimmers to the south.

You notice scratch marks on the floor, as if something heavy was dragged through here.`;
      }
      return `Complete darkness engulfs you. You cannot see your hand in front
of your face. The air is cold and stale. Something skitters in the darkness ahead.
You hear dripping water echoing from somewhere.

You can barely make out the faint glow of torches behind you to the south.`;
    },
  },

  'deep_tunnel': {
    id: 'deep_tunnel',
    name: 'Deep Tunnel',
    description: `The tunnel opens into a wider passage. Strange phosphorescent
fungi grow along the walls, providing a faint eerie glow.`,
    connections: {
      'south': 'dark_corridor',
      'north': 'chasm_room',
      'east': 'shadow_passage',
    },
    items: [],
    getDescription: (state: GameState) => {
      if (!state.challengeState.lumosActive) {
        return `Darkness presses in from all sides. You stumble forward, hands outstretched.
The ground is uneven and treacherous. You can barely make out the faintest glow ahead.`;
      }
      return `The tunnel opens into a wider passage. Strange phosphorescent fungi
grow along the walls. Your wandlight reveals three paths:
The passage continues north toward what sounds like wind howling across a gap.
A darker passage leads east into deeper shadow.
The corridor you came from stretches south.`;
    },
  },

  // === LEVITATION PUZZLE ===
  'chasm_room': {
    id: 'chasm_room',
    name: 'The Great Chasm',
    description: `You stand at the edge of a vast chasm. The gap stretches at least
twenty feet across, with nothing but darkness below.`,
    connections: {
      'south': 'deep_tunnel',
      'north': 'chasm_other_side',
    },
    items: [],
    challenge: 'levitation',
    getDescription: (state: GameState) => {
      const bridgeBuilt = state.challengeState.levitationBridgeBuilt;

      let desc = `You stand at the edge of a vast chasm. The gap stretches at least
twenty feet across, with nothing but darkness below. Wind howls up from the abyss.`;

      if (!bridgeBuilt) {
        desc += `\n\nSeveral large stone blocks lie scattered near the edge, remnants of
what might once have been a bridge. They look far too heavy to move by hand.

The passage behind you leads south.`;
      } else {
        desc += `\n\nThe stone blocks now form a sturdy bridge across the chasm, hovering
steadily in place with residual magic.

The passage continues north across the bridge, and south behind you.`;
      }

      return desc;
    },
  },

  'chasm_other_side': {
    id: 'chasm_other_side',
    name: 'Beyond the Chasm',
    description: `You've crossed the chasm. The passage here is wider, with elaborate
carvings depicting famous Aurors in battle.

An archway to the east leads to a chamber that emanates cold. The examination
trials await in that direction. The chasm lies to the south.`,
    connections: {
      'south': 'chasm_room',
      'east': 'dementor_chamber',
    },
    items: [],
  },

  // === DEMENTOR ENCOUNTER ===
  'dementor_chamber': {
    id: 'dementor_chamber',
    name: 'The Frost Chamber',
    description: `The temperature drops sharply as you enter.`,
    connections: {
      'west': 'chasm_other_side',
      'east': 'beyond_dementor',
    },
    items: [],
    challenge: 'dementor',
    getDescription: (state: GameState) => {
      if (state.challengeState.dementorDefeated) {
        return `The chamber has warmed considerably. Frost still clings to the walls,
but the oppressive despair has lifted. Light seems to return to normal here.

The passage continues east, and west leads back toward the chasm.`;
      }

      if (state.challengeState.dementorPhase === 'initial') {
        return `The temperature plummets. Your breath comes out in white clouds,
crystallizing in the air. Frost creeps across the stone walls with an audible crackle.

A feeling of overwhelming despair settles over you. Every happy memory seems to
drain away, leaving only cold emptiness. The torches on the walls flicker and dim
to mere embers.

Something moves in the shadows at the far end of the chamber. A tall, cloaked figure
glides toward you, its movements unnaturally smooth. Where a face should be, there
is only darkness under the hood. A rattling, sucking sound fills the air.

You cannot go further while it blocks your path.`;
      }

      if (state.challengeState.dementorPhase === 'memory_needed') {
        return `The dark creature looms before you, drawing closer. Your Patronus flickers
weakly, barely more than silver mist. The cold intensifies. You need something more...
something to fuel the spell. A memory. Your happiest memory.

Think of it. Focus on it. Cast again.`;
      }

      return `The chamber is cold and dark. Something terrible lurks here.`;
    },
  },

  'beyond_dementor': {
    id: 'beyond_dementor',
    name: 'Eastern Passage',
    description: `A long corridor stretches before you, the walls lined with portraits
of stern-looking witches and wizards - former Aurors, by the look of them. Their
painted eyes seem to follow your movement.

The passage continues east toward a large wooden door, and west leads back to
the frost chamber.`,
    connections: {
      'west': 'dementor_chamber',
      'east': 'inferi_lake',
    },
    items: [],
  },

  // === INFERI CHAMBER ===
  'inferi_lake': {
    id: 'inferi_lake',
    name: 'The Underground Lake',
    description: `You emerge into a vast cavern dominated by a dark underground lake.`,
    connections: {
      'west': 'beyond_dementor',
      'east': 'lake_shore',
    },
    items: [],
    challenge: 'inferi',
    getDescription: (state: GameState) => {
      if (state.challengeState.inferiCleared) {
        return `The cavern is peaceful now. The lake's surface is still, reflecting
your wandlight like a dark mirror. The smell of smoke lingers in the air, and
ash floats on the water's surface.

A rocky shore extends east, and the passage west leads back the way you came.`;
      }

      return `You emerge into a vast cavern dominated by a dark underground lake.
The water is black and still as glass, reflecting nothing. A narrow stone path
skirts the edge of the water.

The air is cold and smells of decay. As you step closer to the water's edge,
you notice pale shapes beneath the surface. At first, you think they might be
fish, but then you see the faces - human faces, eyes white and staring, mouths
open in silent screams.

The water begins to ripple. Pale hands break the surface.

Bodies begin to rise from the lake, their movements jerky and wrong. Dead eyes
fix upon you. They are between you and the eastern shore.`;
    },
  },

  'lake_shore': {
    id: 'lake_shore',
    name: 'Eastern Shore',
    description: `You've made it across the lake. The shore here is rocky and damp.
A passage leads north, carved into the cavern wall. You can hear something large
moving in that direction. The way back west skirts the now-still lake.`,
    connections: {
      'west': 'inferi_lake',
      'north': 'creature_enclosure',
    },
    items: ['wiggenweld_potion'],
    getDescription: (state: GameState) => {
      const hasPotion = state.inventory.includes('wiggenweld_potion');
      let desc = `You've made it across the lake. The shore here is rocky and damp.
A passage leads north, carved into the cavern wall. You can hear something large
moving in that direction.`;

      if (!hasPotion) {
        desc += `\n\nAmong the rocks, you spot a small bottle - a Wiggenweld Potion,
probably dropped by a previous candidate.`;
      }

      desc += `\n\nThe way back west skirts the lake.`;
      return desc;
    },
  },

  // === HIPPOGRIFF ENCOUNTER ===
  'creature_enclosure': {
    id: 'creature_enclosure',
    name: 'The Creature Enclosure',
    description: `You enter a large, open chamber with a high ceiling.`,
    connections: {
      'south': 'lake_shore',
      'north': 'beyond_creature',
    },
    items: [],
    challenge: 'hippogriff',
    getDescription: (state: GameState) => {
      if (state.challengeState.hippogriffTrusts) {
        return `The magnificent creature stands calmly, its feathers ruffling gently.
It watches you with intelligent orange eyes, accepting your presence. The path
north is clear.

You could even try to ride it, if you wished.`;
      }

      if (state.challengeState.hippogriffBowed) {
        return `The creature regards you with those fierce orange eyes. It seems to be
considering you. You hold your breath, not daring to move...`;
      }

      return `You enter a large, open chamber with a high ceiling that opens to
a shaft of natural light far above. Straw covers the ground, and the air smells
of animal and feathers.

A magnificent creature stands in your path. It has the body of a powerful horse
but the front legs, wings, and head of a giant eagle. Its feathers are a
stormy grey, and its orange eyes fix upon you with fierce intelligence.
Steel-colored talons dig into the straw.

The creature's wings flare slightly as you enter. It is clearly the guardian
of this passage.`;
    },
  },

  'beyond_creature': {
    id: 'beyond_creature',
    name: 'Northern Passage',
    description: `Past the creature's enclosure, the passage narrows and twists.
The walls here are carved with warnings in multiple languages. You can hear
voices ahead - not conversation, but the sound of guards on patrol.

The passage continues north toward what must be a heavily guarded area.
South leads back to the enclosure.`,
    connections: {
      'south': 'creature_enclosure',
      'north': 'guard_corridor',
    },
    items: [],
  },

  // === STEALTH SECTION ===
  'guard_corridor': {
    id: 'guard_corridor',
    name: 'Guard Corridor',
    description: `You peer around a corner into a long corridor.`,
    connections: {
      'south': 'beyond_creature',
      'north': 'beyond_guards',
    },
    items: [],
    challenge: 'stealth',
    getDescription: (state: GameState) => {
      if (state.challengeState.stealthPassed) {
        return `The corridor is quiet. The guards have moved on, unaware of your passage.
The way north is clear. South leads back the way you came.`;
      }

      // Check for cloak stealth
      const hasStealth = state.challengeState.wearingCloak;
      if (hasStealth) {
        return `Two figures in dark robes patrol the corridor ahead. Your Invisibility Cloak
renders you completely unseen. The guards continue their patrol, oblivious to your
presence. The exit lies just ahead to the north - you can slip past them while hidden.`;
      }

      if (state.challengeState.guardsAlerted) {
        return `The guards are on high alert, wands raised and scanning for you!

"Find them! They can't have gone far!"

You're spotted. You need a solution fast - perhaps magic to confuse them,
something to hide yourself, or you could fight them directly.
The passage north leads to the inner sanctum. South leads back the way you came.`;
      }

      return `You peer around a corner into a long corridor. Two figures in dark robes
patrol the hallway, their wands drawn. They speak in low voices, occasionally
glancing toward your direction.

"Did you hear something?"
"Probably another candidate who didn't make it past the lake..."

They're between you and the passage north. You could try to fight them, but
they look experienced, and there are two of them. An Auror knows when to avoid
unnecessary combat. There must be a cleverer way...`;
    },
  },

  'beyond_guards': {
    id: 'beyond_guards',
    name: 'Inner Sanctum Approach',
    description: `You've passed the guards. The passage here is grander, the stonework
more refined. Golden sconces hold ever-burning flames. The air hums with powerful
magic.

An ornate archway leads east to what must be a significant location. A narrower
passage leads west, and south leads back toward the guard corridor.`,
    connections: {
      'south': 'guard_corridor',
      'east': 'death_eater_chamber',
      'west': 'armory_corridor',
    },
    items: [],
  },

  // === ARMORY CORRIDOR ===
  'armory_corridor': {
    id: 'armory_corridor',
    name: 'The Armory Corridor',
    description: `A corridor lined with empty weapon racks and display cases. Most
of the magical artifacts have been removed, but a few remain, protected behind
shimmering enchantments.

You notice a small supply closet to the side, its door slightly ajar.

The corridor leads east back toward the inner sanctum.`,
    connections: {
      'east': 'beyond_guards',
    },
    items: ['dittany'],
    getDescription: (state: GameState) => {
      const dittanyTaken = state.inventory.filter(i => i === 'dittany').length >= 2;
      let desc = `A corridor lined with empty weapon racks and display cases. Most
of the magical artifacts have been removed, but a few remain, protected behind
shimmering enchantments.`;

      if (!dittanyTaken) {
        desc += `\n\nYou notice a small supply closet with its door ajar. Inside, you spot
a vial of Essence of Dittany.`;
      }

      desc += `\n\nThe corridor leads east back toward the inner sanctum.`;
      return desc;
    },
  },

  // === SHADOW PASSAGE (alternate dark route) ===
  'shadow_passage': {
    id: 'shadow_passage',
    name: 'Shadow Passage',
    description: `An extremely narrow passage, barely wide enough to squeeze through.`,
    connections: {
      'west': 'deep_tunnel',
      'east': 'hidden_room',
    },
    items: [],
    challenge: 'passage',
    getDescription: (state: GameState) => {
      if (!state.challengeState.lumosActive) {
        return `Impenetrable darkness. You can feel the walls pressing close on either side.
Moving without light here would be extremely dangerous.`;
      }
      if (state.challengeState.passageCleared) {
        return `The narrow passage stretches before you. You've already found a way through.
It continues east to a hidden chamber, or west back to the main tunnel.`;
      }
      return `An extremely narrow passage, barely wide enough to squeeze through.
Your wandlight reveals old cobwebs and dust. This path looks rarely used.

The walls press in from both sides - you won't fit through walking normally.
Perhaps you could CRAWL through, or find another way to make yourself smaller.

The tunnel opens wider to the west.`;
    },
  },

  'hidden_room': {
    id: 'hidden_room',
    name: 'Hidden Chamber',
    description: `A small, secret chamber. Dust covers everything, and you suspect
few candidates have found this place.`,
    connections: {
      'west': 'shadow_passage',
    },
    items: ['healing_herbs', 'invisibility_cloak'],
    getDescription: (state: GameState) => {
      const hasHerbs = state.inventory.includes('healing_herbs');
      const hasCloak = state.inventory.includes('invisibility_cloak');
      let desc = `A small, secret chamber. Dust covers everything, and you suspect
few candidates have found this place. Ancient texts line the walls.`;

      if (!hasHerbs) {
        desc += `\n\nOn a dusty shelf, you find some dried healing herbs, still potent.`;
      }

      if (!hasCloak) {
        desc += `\n\nDraped over an old chair, you notice a shimmering silvery cloak. It seems
to shift and blend with its surroundings... could it be?`;
      }

      desc += `\n\nThe only exit is west through the narrow passage.`;
      return desc;
    },
  },

  // === WATER PASSAGE ===
  'water_passage': {
    id: 'water_passage',
    name: 'Flooded Corridor',
    description: `Ankle-deep water covers the floor here. The sound of dripping
echoes from all directions. The walls are slick with moisture and green algae.

The main hall lies to the east. The passage continues west, growing deeper.
This appears to be a dead end - the water gets too deep to proceed safely.`,
    connections: {
      'east': 'entrance_hall',
    },
    items: [],
  },

  // === DEATH EATER DUEL ===
  'death_eater_chamber': {
    id: 'death_eater_chamber',
    name: 'The Dueling Chamber',
    description: `A grand chamber designed for formal magical duels.`,
    connections: {
      'west': 'beyond_guards',
      'north': 'final_approach',
    },
    items: [],
    challenge: 'duel',
    onEnter: (state: GameState) => {
      // Remove invisibility cloak if wearing it - can't duel while invisible
      if (state.challengeState.wearingCloak) {
        return {
          state: {
            ...state,
            challengeState: {
              ...state.challengeState,
              wearingCloak: false,
            },
          },
          message: `\n\nAs you step into the dueling chamber, the protective runes flare with
golden light. Your Invisibility Cloak is pulled away by the magical wards - the
chamber's ancient enchantments won't allow concealment during a formal duel.

You're fully visible now. This will be a fair fight.`,
        };
      }
      return { state, message: '' };
    },
    getDescription: (state: GameState) => {
      if (state.challengeState.deathEaterDefeated) {
        return `The dueling chamber is quiet. Your opponent lies unconscious on the floor,
wand several feet away. You have proven yourself in magical combat.

The final passage lies to the north. West leads back to the corridor.`;
      }

      return `A grand chamber designed for formal magical duels. Runes circle the floor,
creating a contained arena. Spectator galleries line the walls, though they sit empty.

A figure in dark robes stands at the far end of the chamber. As you enter, they
turn to face you. The mask of a Death Eater covers their face.

"So, another would-be Auror thinks they can pass the examination," a cold voice
sneers. "Let us see what you're truly made of."

They raise their wand, falling into a dueling stance. You must defeat them to proceed.`;
    },
  },

  // === FINAL CHAMBER ===
  'final_approach': {
    id: 'final_approach',
    name: 'The Final Approach',
    description: `A short corridor leads to an imposing golden door. Ancient runes
pulse with protective magic. This is clearly the entrance to the final chamber.

The dueling chamber lies south.`,
    connections: {
      'south': 'death_eater_chamber',
      'north': 'final_chamber',
    },
    items: [],
  },

  'final_chamber': {
    id: 'final_chamber',
    name: 'The Final Chamber',
    description: `You enter a magnificent circular chamber.`,
    connections: {
      'south': 'final_approach',
    },
    items: [],
    challenge: 'final',
    getDescription: (state: GameState) => {
      if (state.challengeState.finalChallengeComplete) {
        return `The chamber is peaceful now. A warm light suffuses everything. You have
proven yourself worthy.

A door has appeared in the far wall, leading out of the examination.`;
      }

      return `You enter a magnificent circular chamber. The domed ceiling is enchanted
to show a starry night sky. In the center stands something that takes your breath away.

The Mirror of Erised.

The ornate golden frame towers above you, inscribed with the words:
"Erised stra ehru oyt ube cafru oyt on wohsi"

As you approach, a voice echoes through the chamber:

"Final assessment. You have demonstrated skill and courage. But an Auror must
also resist temptation. This mirror shows the deepest desire of your heart."

"Will you SEE what the mirror reveals?"
"Or TURN AWAY now, before it ensnares you?"

The glass seems to shimmer, beckoning you closer...`;
    },
  },
};

// Get a location
export function getLocation(id: string): Location | undefined {
  return LOCATIONS[id];
}

// Check if player can move to a location (considering light requirements)
export function canMoveTo(state: GameState, direction: string): { allowed: boolean; message: string } {
  const currentLocation = LOCATIONS[state.location];
  if (!currentLocation) {
    return { allowed: false, message: "You are nowhere." };
  }

  const targetId = currentLocation.connections[direction.toLowerCase()];
  if (!targetId) {
    return { allowed: false, message: "You can't go that way." };
  }

  // Check if door is locked at entrance
  if (state.location === 'entrance_hall' && direction === 'north' && !state.challengeState.doorUnlocked) {
    return {
      allowed: false,
      message: "The heavy iron door is locked. You'll need to unlock it somehow."
    };
  }

  // Special checks
  const darkLocations = ['dark_corridor', 'deep_tunnel', 'shadow_passage'];
  if (darkLocations.includes(state.location) && !state.challengeState.lumosActive) {
    if (direction !== 'south' && state.location === 'dark_corridor') {
      return {
        allowed: false,
        message: "You stumble in the darkness, unable to find your way. You hear something skitter away from you. Perhaps you need light to proceed safely."
      };
    }
  }

  // Check if chasm bridge is built
  if (state.location === 'chasm_room' && direction === 'north' && !state.challengeState.levitationBridgeBuilt) {
    return {
      allowed: false,
      message: "The chasm yawns before you. There's no way across. The gap is far too wide to jump."
    };
  }

  // Check if dementor is blocking (blocks ALL exits when engaged)
  if (state.location === 'dementor_chamber' && !state.challengeState.dementorDefeated && state.challengeState.dementorEngaged) {
    return {
      allowed: false,
      message: "The Dementor glides between you and the exit. You cannot escape - you must defeat it or die trying."
    };
  }

  // Check if inferi are blocking (blocks ALL exits when engaged)
  if (state.location === 'inferi_lake' && !state.challengeState.inferiCleared && state.challengeState.inferiEngaged) {
    return {
      allowed: false,
      message: "The Inferi surge forward, blocking your retreat! Cold hands grab at you. There's no escape - you must destroy them!"
    };
  }

  // Check if narrow passage needs to be cleared
  if (state.location === 'shadow_passage' && direction === 'east' && !state.challengeState.passageCleared) {
    return {
      allowed: false,
      message: "You try to squeeze through, but the passage is too narrow. You get stuck and have to back out.\n\nPerhaps you could CRAWL through, or use magic to make yourself smaller."
    };
  }

  // Check if hippogriff is blocking - they can try but will take damage
  if (state.location === 'creature_enclosure' && direction === 'north' && !state.challengeState.hippogriffTrusts) {
    // Allow movement but flag it - damage will be applied in movement handler
    return { allowed: true, message: "" };
  }

  // Check if guards are blocking (cloak or muffliato can bypass)
  const hasGuardStealth = state.challengeState.stealthActive || state.challengeState.wearingCloak;
  if (state.location === 'guard_corridor' && direction === 'north' && !state.challengeState.stealthPassed && !hasGuardStealth) {
    return {
      allowed: false,
      message: "The guards would certainly spot you if you tried to walk past them. You need to find another way - perhaps a sound-muffling spell or something to make yourself unseen."
    };
  }

  // Check if Death Eater is blocking
  if (state.location === 'death_eater_chamber' && direction === 'north' && !state.challengeState.deathEaterDefeated) {
    return {
      allowed: false,
      message: "Your opponent stands between you and the exit, wand raised. You must defeat them first."
    };
  }

  // Block training hall route until eastern challenges are complete
  // This ensures Dementor, Inferi, and Hippogriff cannot be skipped
  if (state.location === 'chasm_other_side' && direction === 'north') {
    const allEasternComplete = state.challengeState.dementorDefeated &&
                               state.challengeState.inferiCleared &&
                               state.challengeState.hippogriffTrusts;
    if (!allEasternComplete) {
      return {
        allowed: false,
        message: `A magical barrier shimmers across the northern passage. Ancient runes glow with warning:

"Those who would become Aurors must first prove themselves against the darkness.
Seek the cold chamber to the east. Face what awaits beyond."

The barrier will not let you pass until you've completed the trials to the east.`
      };
    }
  }

  return { allowed: true, message: "" };
}
