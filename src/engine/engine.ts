// Main game engine - handles all game logic and challenges

import { GameState, CommandResult, ChallengeState, CombatState } from './types';
import { LOCATIONS, canMoveTo, getLocation } from './locations';
import {
  parseCommand,
  ParsedCommand,
  checkUnforgivable,
  handleLook,
  handleInventory,
  handleHelp,
  handleScore,
  handleJourney,
  getLocationDescription,
} from './parser';
import { matchSpell, getSpellCategory } from './spells';

// Create initial game state
export function createInitialState(): GameState {
  return {
    playerName: '',
    health: 100,
    maxHealth: 100,
    location: 'entrance_hall',
    inventory: [],
    visitedLocations: new Set(['entrance_hall']),
    challengesCompleted: new Set(),
    gamePhase: 'intro',
    score: 0,
    hintsUsed: 0,
    episkeyCasts: 0,
    journeyLog: [{ location: 'entrance_hall' }],
    challengeState: createInitialChallengeState(),
    combatState: null,
    attemptCounts: {},
    hintRequestCounts: {},
  };
}

function createInitialChallengeState(): ChallengeState {
  return {
    // Door and passage
    doorUnlocked: false,
    passageCleared: false,

    lumosActive: false,
    levitationBridgeBuilt: false,
    dementorDefeated: false,
    inferiCleared: false,
    hippogriffBowed: false,
    hippogriffTrusts: false,
    deathEaterDefeated: false,
    stealthPassed: false,
    stealthActive: false,
    finalChallengeComplete: false,

    // Mirror of Erised
    mirrorLookedOnce: false,

    // Dementor encounter
    dementorPhase: 'initial',
    dementorEngaged: false,

    // Inferi encounter
    inferiEngaged: false,

    // Patronus memory
    awaitingMemory: false,

    // Invisibility cloak
    wearingCloak: false,

    // Death Eater duel
    duelRound: 0,
    deathEaterHealth: 100,
    duelDefending: false,

    // Guard encounter
    guardsAlerted: false,
  };
}

// Process a command and return the result
export function processCommand(state: GameState, input: string): CommandResult {
  const command = parseCommand(input);

  // Track attempts for hint system
  let newState = { ...state };
  const attemptKey = `${state.location}_${command.verb}`;
  newState.attemptCounts = { ...state.attemptCounts };
  newState.attemptCounts[state.location] = (newState.attemptCounts[state.location] || 0) + 1;

  // Handle awaiting memory input for Patronus
  if (state.challengeState.awaitingMemory) {
    return handleMemoryInput(newState, input);
  }

  // Check for unforgivable curses
  const unforgivableMessage = checkUnforgivable(command);
  if (unforgivableMessage) {
    return { message: unforgivableMessage, state: newState, color: 'warning' };
  }

  // Easter egg: Secret west_z command at water passage
  const normalizedInput = input.trim().toLowerCase();
  if (state.location === 'water_passage' && (normalizedInput === 'west_z' || normalizedInput === 'go west_z')) {
    return {
      message: `You attempt to venture deeper west with mysterious confidence...

The water seems to ripple with ancient magic. A ghostly voice echoes from the depths:

"Ah, one who seeks the secret path! But alas, this way is reserved only for
those who have truly proven their devotion to the wizarding world.

Go forth, young wizard. Read all seven sacred tomes of Harry Potter - every page,
every word, every footnote. Study the house-elf liberation movements, memorize
the Quidditch World Cup results, learn why Dumbledore loved socks.

Only when you have absorbed the complete chronicles, when you can recite
Hermione's class schedule and name every Weasley in birth order, when you
dream in Parseltongue and sneeze in spells...

ONLY THEN shall you be deemed eligible to venture west into these sacred waters.

For now, the passage remains closed to you. Go! Read! Return when you are worthy!"

The voice fades. The water stills. Perhaps you should head back east.`,
      state: newState,
      color: 'magic',
    };
  }

  // Process the command
  let result: CommandResult;
  switch (command.type) {
    case 'movement':
      result = handleMovement(newState, command.verb);
      break;

    case 'spell':
      result = handleSpell(newState, command);
      break;

    case 'action':
      result = handleAction(newState, command);
      break;

    case 'system':
      result = handleSystem(newState, command.verb);
      break;

    case 'unknown':
    default:
      // Check if it might be a failed spell
      if (command.verb && command.verb.length > 4) {
        result = {
          message: "Nothing happens. Perhaps that's not quite the right incantation.",
          state: newState,
        };
      } else {
        result = {
          message: "I don't understand that command. Type HELP for assistance.",
          state: newState,
        };
      }
  }

  // Apply continuous creature damage if engaged
  result = applyCreatureDamage(result, command);

  return result;
}

// Apply continuous damage from engaged creatures
function applyCreatureDamage(result: CommandResult, command: ParsedCommand): CommandResult {
  const state = result.state;

  // Dementor continuous damage
  if (state.location === 'dementor_chamber' &&
      state.challengeState.dementorEngaged &&
      !state.challengeState.dementorDefeated) {
    const damage = 10;
    const newHealth = Math.max(0, state.health - damage);

    if (newHealth <= 0) {
      return {
        message: result.message + `\n\nThe Dementor descends upon you. The cold becomes unbearable.
Everything goes dark as the last of your happiness is drained away...

Your body will be found later, cold and still, with no visible injuries.
The examiners will note: "Dementor's Kiss - total soul extraction."

EXAMINATION FAILED - CANDIDATE LOST`,
        state: { ...state, health: 0, gamePhase: 'death' },
        color: 'damage',
      };
    }

    return {
      message: result.message + `\n\nThe Dementor glides closer. Despair overwhelms you. [-${damage} HP]`,
      state: { ...state, health: newHealth },
      color: result.color === 'magic' ? 'magic' : 'damage',
    };
  }

  // Inferi continuous damage
  if (state.location === 'inferi_lake' &&
      state.challengeState.inferiEngaged &&
      !state.challengeState.inferiCleared) {
    const damage = 15;
    const newHealth = Math.max(0, state.health - damage);

    if (newHealth <= 0) {
      return {
        message: result.message + `\n\nCold, dead hands drag you beneath the water.
The pale faces surround you as darkness closes in...

You sink into the dark water, joining the other pale forms below.
The examiners will find only disturbed water and silence.

EXAMINATION FAILED - CANDIDATE DROWNED`,
        state: { ...state, health: 0, gamePhase: 'death' },
        color: 'damage',
      };
    }

    return {
      message: result.message + `\n\nThe Inferi grab at you with rotting hands! [-${damage} HP]`,
      state: { ...state, health: newHealth },
      color: result.color === 'magic' ? 'magic' : 'damage',
    };
  }

  // Guard attacks if player is spotted and tries to do anything
  // Only cloak provides protection from guards
  const hasGuardStealth = state.challengeState.wearingCloak;
  if (state.location === 'guard_corridor' &&
      !state.challengeState.stealthPassed &&
      !hasGuardStealth &&
      state.challengeState.guardsAlerted) {
    const damage = 15;
    const newHealth = Math.max(0, state.health - damage);

    if (newHealth <= 0) {
      return {
        message: result.message + `\n\n"INTRUDER!" The guards spot your movement!

Multiple curses fly at you. You try to dodge, but there are too many.
Stunning Spells hit you from both sides. Your heart stops.

"Excessive force noted," one guard says flatly to the other.

EXAMINATION FAILED - SUBDUED BY GUARDS`,
        state: { ...state, health: 0, gamePhase: 'death' },
        color: 'damage',
      };
    }

    const attackMessages = [
      '"STOP!" A Stunning Spell narrowly misses you!',
      'You dodge a jet of red light - barely!',
      '"Intruder!" A curse grazes your shoulder!',
      'Both guards attack at once!',
    ];
    const attackMsg = attackMessages[Math.floor(Math.random() * attackMessages.length)];

    return {
      message: result.message + `\n\n${attackMsg} [-${damage} HP]

The guards are alert and attacking. You need a solution quickly!`,
      state: { ...state, health: newHealth },
      color: result.color === 'magic' ? 'magic' : 'damage',
    };
  }

  // Death Eater duel - continuous damage if player doesn't use combat spells
  if (state.location === 'death_eater_chamber' &&
      !state.challengeState.deathEaterDefeated) {

    // Check if the command was a combat spell (offensive or defensive)
    const combatSpells = ['stupefy', 'expelliarmus', 'petrificus totalus', 'impedimenta',
                          'reducto', 'confringo', 'incendio', 'flipendo', 'depulso',
                          'bombarda', 'diffindo', 'incarcerous', 'levicorpus',
                          'rictusempra', 'locomotor mortis', 'tarantallegra', 'densaugeo', 'furnunculus',
                          'protego', 'protego maxima'];
    const isCombatSpell = command.type === 'spell' && combatSpells.includes(command.verb);

    // If not a combat spell, Death Eater attacks
    if (!isCombatSpell) {
      const damage = 15;
      const newHealth = Math.max(0, state.health - damage);
      const round = state.challengeState.duelRound;

      if (newHealth <= 0) {
        return {
          message: result.message + `\n\nWhile you hesitate, the Death Eater strikes!

A dark curse tears through you. Your wand clatters to the floor.

The masked figure stands over you, lowering their wand.
"Another one who wasn't ready," they say coldly.

EXAMINATION FAILED - DEFEATED IN COMBAT`,
          state: { ...state, health: 0, gamePhase: 'death' },
          color: 'damage',
        };
      }

      // Increment duel round since a turn passed
      const newState = {
        ...state,
        health: newHealth,
        challengeState: {
          ...state.challengeState,
          duelRound: round + 1,
        },
      };

      const attackMessages = [
        'The Death Eater seizes your hesitation! A curse flies at you!',
        '"Focus on the duel!" A hex catches you off guard!',
        'While distracted, you take a direct hit from their wand!',
        'The Death Eater attacks while you waste time!',
      ];
      const attackMsg = attackMessages[round % attackMessages.length];

      return {
        message: result.message + `\n\n${attackMsg} [-${damage} HP]

You're in a duel! Attack with combat spells or defend with Protego!`,
        state: newState,
        color: 'damage',
      };
    }
  }

  return result;
}

// Handle memory input for Patronus
function handleMemoryInput(state: GameState, input: string): CommandResult {
  const memory = input.trim();

  // Check if memory is too short
  if (memory.length < 10) {
    return {
      message: `You try to focus on that thought, but it's not enough.
The memory needs to be more specific, more meaningful...

The Dementor draws closer. Think harder! What is your happiest memory?`,
      state,
    };
  }

  // Memory is good enough - success!
  const newState = {
    ...state,
    score: state.score + 10,
    challengesCompleted: new Set([...state.challengesCompleted, 'dementor']),
    challengeState: {
      ...state.challengeState,
      dementorDefeated: true,
      dementorEngaged: false,
      dementorPhase: 'complete' as const,
      awaitingMemory: false,
    },
  };

  const patronusForms = ['stag', 'phoenix', 'otter', 'doe', 'wolf', 'eagle', 'lion'];
  const patronus = patronusForms[Math.floor(Math.random() * patronusForms.length)];

  return {
    message: `You focus on that memory - truly feel it - the joy, the warmth, the love.

"EXPECTO PATRONUM!"

A blinding silver light erupts from your wand, coalescing into the form of a
brilliant silver ${patronus.toUpperCase()}! Your Patronus charges at the Dementor,
driving it back with radiant force.

The hooded figure shrieks - a horrible, rattling sound - and flees into the shadows.
Warmth floods back into the chamber. Your happy memories return.

[DEMENTOR CHALLENGE COMPLETED - +10 points]`,
    state: newState,
    color: 'magic',
  };
}

// Handle movement commands
function handleMovement(state: GameState, direction: string): CommandResult {
  const check = canMoveTo(state, direction);

  if (!check.allowed) {
    // Take damage if moving in dark without light
    const darkLocations = ['dark_corridor', 'deep_tunnel', 'shadow_passage'];
    if (darkLocations.includes(state.location) && !state.challengeState.lumosActive) {
      const damage = 5;
      const newHealth = Math.max(0, state.health - damage);
      const newState = { ...state, health: newHealth };

      if (newHealth <= 0) {
        return {
          message: `You stumble in the darkness and fall, striking your head on the stone floor.
The last thing you feel is cold...

Hours later, a search party finds your body at the bottom of a pit.
"First-year spell would have saved them," an examiner sighs.

EXAMINATION FAILED - CANDIDATE FELL`,
          state: { ...newState, gamePhase: 'death' },
          color: 'damage',
        };
      }

      return {
        message: `${check.message}\n\nYou stumble and hit your head on the wall. [-${damage} HP]`,
        state: newState,
        color: 'damage',
      };
    }

    return { message: check.message, state };
  }

  // Move to new location
  const currentLocation = LOCATIONS[state.location];
  const newLocationId = currentLocation.connections[direction];
  const newLocation = LOCATIONS[newLocationId];

  const newVisited = new Set(state.visitedLocations);
  newVisited.add(newLocationId);

  // Track journey
  const newJourneyLog = [
    ...state.journeyLog.slice(0, -1),
    { location: state.location, direction },
    { location: newLocationId },
  ];

  let newState: GameState = {
    ...state,
    location: newLocationId,
    visitedLocations: newVisited,
    journeyLog: newJourneyLog,
  };

  // Call onEnter handler if location has one
  let onEnterMessage = '';
  if (newLocation.onEnter) {
    const result = newLocation.onEnter(newState);
    newState = result.state;
    onEnterMessage = result.message;
  }

  // Handle stealth movement (Invisibility Cloak only)
  // Only trigger when coming FROM guard_corridor and haven't already passed
  const hasStealthForGuards = state.challengeState.wearingCloak;
  if (hasStealthForGuards &&
      newLocationId === 'beyond_guards' &&
      state.location === 'guard_corridor' &&
      !state.challengeState.stealthPassed) {
    newState = {
      ...newState,
      challengeState: {
        ...newState.challengeState,
        stealthPassed: true,
      },
      score: newState.score + 10,
      challengesCompleted: new Set([...newState.challengesCompleted, 'stealth']),
    };

    return {
      message: `You slip past the guards undetected. The guards look right through you,
unable to see beneath your Invisibility Cloak. They continue their patrol,
completely unaware of your passage.

[STEALTH SECTION COMPLETED - +10 points]

${getLocationDescription(newState)}`,
      state: newState,
      color: 'magic',
    };
  }

  // Get description of new location
  const description = getLocationDescription(newState);

  // Check for special location entries (challenges)
  let extraMessage = '';

  // Engage Dementor when entering chamber
  if (newLocationId === 'dementor_chamber' && !newState.challengeState.dementorDefeated) {
    const damage = 10;
    newState = {
      ...newState,
      health: Math.max(0, newState.health - damage),
      challengeState: { ...newState.challengeState, dementorEngaged: true },
    };
    extraMessage = `\n\nThe cold seeps into your bones. You feel your happiness draining away. [-${damage} HP]`;
  }

  // Engage Inferi when entering lake
  if (newLocationId === 'inferi_lake' && !newState.challengeState.inferiCleared) {
    const damage = 10;
    newState = {
      ...newState,
      health: Math.max(0, newState.health - damage),
      challengeState: { ...newState.challengeState, inferiEngaged: true },
    };
    extraMessage = `\n\nPale hands reach for you! Cold fingers grasp your ankle before you wrench free. [-${damage} HP]`;
  }

  // Alert guards when entering guard corridor without stealth
  // Check for cloak stealth only
  const hasStealthOnEntry = newState.challengeState.wearingCloak;
  if (newLocationId === 'guard_corridor' &&
      !newState.challengeState.stealthPassed &&
      !hasStealthOnEntry) {
    // Just mark as alerted, but don't damage yet - give them a chance
    newState = {
      ...newState,
      challengeState: { ...newState.challengeState, guardsAlerted: true },
    };
    extraMessage = `\n\nYou freeze. Two guards patrol ahead, wands drawn. They haven't spotted you yet,
but they're alert. Fighting two experienced guards head-on would be dangerous.

Perhaps there's a cleverer way past them...`;
  } else if (newLocationId === 'guard_corridor' &&
             !newState.challengeState.stealthPassed &&
             hasStealthOnEntry) {
    // Entering with stealth active - show guards but they don't see you
    extraMessage = `\n\nTwo guards patrol ahead. They don't notice you slip into the corridor,
invisible beneath your cloak. You can proceed north past them undetected.`;
  }

  // Hippogriff attacks if you try to pass without showing respect
  if (state.location === 'creature_enclosure' &&
      newLocationId === 'beyond_creature' &&
      !state.challengeState.hippogriffTrusts) {
    const damage = 25;
    const newHealth = Math.max(0, newState.health - damage);

    if (newHealth <= 0) {
      return {
        message: `You try to walk past the Hippogriff without proper respect.

The creature screeches in outrage! Its talons flash, catching you across the chest.
You fall backward, blood streaming from the wounds.

EXAMINATION FAILED - KILLED BY HIPPOGRIFF

You should have bowed. Pride before a proud creature is fatal.`,
        state: { ...newState, health: 0, gamePhase: 'death' },
        color: 'damage',
      };
    }

    return {
      message: `You try to walk past the Hippogriff without proper respect.

SCREEEEEE!

The creature rears up in fury! Its sharp talons slash across your arm as you
stumble backward into the previous chamber. [-${damage} HP]

The Hippogriff blocks your path, wings spread, eyes blazing. You feel blood
running down your arm.

It will not let you pass until you show proper respect. You must BOW.

${getLocationDescription(state)}`,
      state: {
        ...state,
        health: newHealth,
        location: state.location, // Force them back to creature_enclosure
        visitedLocations: state.visitedLocations,
        journeyLog: state.journeyLog,
      },
      color: 'damage',
    };
  }

  return {
    message: description + onEnterMessage + extraMessage,
    state: newState,
    color: extraMessage ? 'damage' : 'normal',
  };
}

// Handle spell casting
function handleSpell(state: GameState, command: ParsedCommand): CommandResult {
  const spellName = command.verb;

  // Handle ACCIO with target
  if (spellName === 'accio' && command.target) {
    return handleAccio(state, command.target);
  }

  // Handle unknown spells
  if (spellName === 'unknown_spell') {
    return {
      message: "Nothing happens. That doesn't seem to be a proper incantation.",
      state,
    };
  }

  // Handle specific spells based on location and context
  switch (spellName) {
    case 'lumos':
    case 'lumos maxima':
      return handleLumos(state, spellName === 'lumos maxima');

    case 'nox':
      return handleNox(state);

    case 'wingardium leviosa':
      return handleLevitation(state);

    case 'expecto patronum':
      return handlePatronus(state);

    case 'protego':
    case 'protego maxima':
      return handleProtego(state, spellName === 'protego maxima');

    case 'incendio':
    case 'confringo':
      return handleFireSpell(state, spellName);

    case 'stupefy':
    case 'expelliarmus':
    case 'impedimenta':
    case 'petrificus totalus':
    case 'reducto':
    case 'flipendo':
    case 'depulso':
    case 'bombarda':
    case 'diffindo':
    case 'incarcerous':
    case 'levicorpus':
    case 'rictusempra':
    case 'locomotor mortis':
    case 'tarantallegra':
    case 'densaugeo':
    case 'furnunculus':
      return handleOffensiveSpell(state, spellName);

    case 'confundo':
      return handleConfundo(state);

    case 'episkey':
      return handleEpiskey(state);

    case 'aguamenti':
      return handleAguamenti(state);

    case 'revelio':
    case 'homenum revelio':
      return handleRevelio(state, spellName);

    case 'alohomora':
      return handleAlohomora(state);

    case 'reducio':
      return handleReducio(state);

    case 'sectumsempra':
      return {
        message: `You begin the incantation for Sectumsempra, but hesitate. This dark curse
could cause terrible harm. As an Auror candidate, you should use more controlled magic.
The examiners would not look kindly on such excessive force.`,
        state,
        color: 'warning',
      };

    default:
      return {
        message: "You cast the spell, but it doesn't seem to have any effect here.",
        state,
        color: 'magic',
      };
  }
}

// LUMOS handling
function handleLumos(state: GameState, maxima: boolean): CommandResult {
  if (state.challengeState.lumosActive) {
    return {
      message: "Your wand is already lit.",
      state,
    };
  }

  const newState = {
    ...state,
    challengeState: { ...state.challengeState, lumosActive: true },
  };

  const darkLocations = ['dark_corridor', 'deep_tunnel', 'shadow_passage'];
  const inDark = darkLocations.includes(state.location);

  // Award points for first time using lumos in dark corridor
  if (inDark && !state.challengesCompleted.has('lumos')) {
    newState.score += 10;
    newState.challengesCompleted = new Set([...state.challengesCompleted, 'lumos']);

    const intensity = maxima ? 'brilliant' : 'steady';
    return {
      message: `"${maxima ? 'Lumos Maxima!' : 'Lumos!'}"\n\nA ${intensity} light erupts from the tip of your wand, pushing back the darkness.
The shadows retreat, revealing the passage around you.

[DARK CORRIDOR CHALLENGE COMPLETED - +10 points]

${getLocationDescription(newState)}`,
      state: newState,
      color: 'magic',
    };
  }

  return {
    message: `"${maxima ? 'Lumos Maxima!' : 'Lumos!'}"\n\nLight springs from your wand, illuminating your surroundings.${inDark ? '\n\n' + getLocationDescription(newState) : ''}`,
    state: newState,
    color: 'magic',
  };
}

// NOX handling
function handleNox(state: GameState): CommandResult {
  if (!state.challengeState.lumosActive) {
    return {
      message: "Your wand light is already extinguished.",
      state,
    };
  }

  return {
    message: '"Nox."\n\nThe light from your wand fades away.',
    state: {
      ...state,
      challengeState: { ...state.challengeState, lumosActive: false },
    },
    color: 'magic',
  };
}

// Levitation handling
function handleLevitation(state: GameState): CommandResult {
  if (state.location !== 'chasm_room') {
    return {
      message: "You cast Wingardium Leviosa, but there's nothing here that needs levitating.",
      state,
      color: 'magic',
    };
  }

  if (state.challengeState.levitationBridgeBuilt) {
    return {
      message: "The bridge is already in place.",
      state,
    };
  }

  const newState = {
    ...state,
    score: state.score + 10,
    challengesCompleted: new Set([...state.challengesCompleted, 'levitation']),
    challengeState: { ...state.challengeState, levitationBridgeBuilt: true },
  };

  return {
    message: `"Wingardium Leviosa!"

You focus your will on the heavy stone blocks. One by one, they rise into the air,
hovering against gravity. With careful movements of your wand, you guide them
into position across the chasm.

The blocks settle into place, forming a solid bridge. The magic holds them steady.

[LEVITATION PUZZLE COMPLETED - +10 points]`,
    state: newState,
    color: 'magic',
  };
}

// Alohomora handling
function handleAlohomora(state: GameState): CommandResult {
  if (state.location !== 'entrance_hall') {
    return {
      message: '"Alohomora!"\n\nYou cast the unlocking charm, but there\'s nothing locked here.',
      state,
      color: 'magic',
    };
  }

  if (state.challengeState.doorUnlocked) {
    return {
      message: "The door is already unlocked.",
      state,
    };
  }

  const newState = {
    ...state,
    score: state.score + 10,
    challengesCompleted: new Set([...state.challengesCompleted, 'alohomora']),
    challengeState: { ...state.challengeState, doorUnlocked: true },
  };

  return {
    message: `"Alohomora!"

You point your wand at the heavy iron door. There's a satisfying click as the
lock disengages. The door swings open with a creak, revealing darkness beyond.

[DOOR UNLOCKED - +10 points]`,
    state: newState,
    color: 'magic',
  };
}

// Reducio handling (shrinking spell for narrow passage)
function handleReducio(state: GameState): CommandResult {
  if (state.location !== 'shadow_passage') {
    return {
      message: '"Reducio!"\n\nThe shrinking charm swirls from your wand, but there\'s nothing here that needs shrinking.',
      state,
      color: 'magic',
    };
  }

  if (state.challengeState.passageCleared) {
    return {
      message: "You've already passed through this area.",
      state,
    };
  }

  const newVisited = new Set(state.visitedLocations);
  newVisited.add('hidden_room');

  const newState = {
    ...state,
    location: 'hidden_room',
    visitedLocations: newVisited,
    score: state.score + 10,
    challengeState: { ...state.challengeState, passageCleared: true },
  };

  return {
    message: `"Reducio!"

You cast the Shrinking Charm on yourself. Your body compresses, everything around
you growing larger. The tight passage that seemed impossibly narrow now appears
as a wide corridor.

You slip through easily, then feel the magic fade as you return to normal size
on the other side.

[NARROW PASSAGE CLEARED - +10 points (Magic solution)]

${getLocationDescription(newState)}`,
    state: newState,
    color: 'magic',
  };
}

// Patronus handling
function handlePatronus(state: GameState): CommandResult {
  if (state.location !== 'dementor_chamber') {
    return {
      message: `"Expecto Patronum!"

Silver mist erupts from your wand, swirling briefly before fading.
Without a true threat to focus against, the Patronus doesn't fully form.`,
      state,
      color: 'magic',
    };
  }

  if (state.challengeState.dementorDefeated) {
    return {
      message: "The chamber is clear. There's no need for a Patronus here anymore.",
      state,
    };
  }

  const phase = state.challengeState.dementorPhase;

  if (phase === 'initial') {
    // First attempt - weak patronus, now ask for memory
    const newState = {
      ...state,
      challengeState: {
        ...state.challengeState,
        dementorPhase: 'memory_needed' as const,
        awaitingMemory: true,
      },
    };

    return {
      message: `"Expecto Patronum!"

Silver mist shoots from your wand, but it's weak - barely more than wisps of light.
The hooded figure hesitates for a moment, then continues its approach. The cold
intensifies. Your happy thoughts feel distant, fading...

You need something stronger. A memory. Your happiest memory.

Think of your happiest moment - truly feel it - and describe it:`,
      state: newState,
      color: 'magic',
    };
  }

  if (phase === 'memory_needed') {
    // Player cast again without giving memory - redirect them to give memory
    const newState = {
      ...state,
      challengeState: {
        ...state.challengeState,
        awaitingMemory: true,
      },
    };

    return {
      message: `"Expecto Patronum!"

Silver mist appears again, but it's still not strong enough.
You need to focus on a SPECIFIC happy memory. Describe it - what moment
brought you the greatest joy?`,
      state: newState,
      color: 'magic',
    };
  }

  return {
    message: "The creature is already gone.",
    state,
  };
}

// Protego handling
function handleProtego(state: GameState, maxima: boolean): CommandResult {
  if (state.location !== 'death_eater_chamber' && state.location !== 'guard_corridor') {
    return {
      message: `"${maxima ? 'Protego Maxima!' : 'Protego!'}"\n\nA shimmering shield forms before you, then fades. There's no attack to block.`,
      state,
      color: 'magic',
    };
  }

  // Death Eater duel
  if (state.location === 'death_eater_chamber' && !state.challengeState.deathEaterDefeated) {
    const newState = {
      ...state,
      challengeState: {
        ...state.challengeState,
        duelDefending: true,
        duelRound: state.challengeState.duelRound + 1,
      },
    };

    const defenseMessages = [
      'A dark curse splashes harmlessly against your barrier!',
      'The Death Eater\'s hex rebounds off your shield!',
      'Your shield flares brightly, absorbing a jet of green sparks!',
      'The curse dissipates against your protective magic!',
    ];

    const round = state.challengeState.duelRound;
    const defenseMsg = defenseMessages[round % defenseMessages.length];

    return {
      message: `"${maxima ? 'Protego Maxima!' : 'Protego!'}"

A shimmering shield springs up before you. ${defenseMsg}

The Death Eater snarls in frustration. "You can't hide behind shields forever!"

You're protected for now, but defense alone won't win this duel.`,
      state: newState,
      color: 'magic',
    };
  }

  return {
    message: `"${maxima ? 'Protego Maxima!' : 'Protego!'}"\n\nA protective shield shimmers around you.`,
    state,
    color: 'magic',
  };
}

// Fire spell handling (Incendio, Confringo)
function handleFireSpell(state: GameState, spell: string): CommandResult {
  if (state.location === 'inferi_lake' && !state.challengeState.inferiCleared) {
    const newState = {
      ...state,
      score: state.score + 10,
      challengesCompleted: new Set([...state.challengesCompleted, 'inferi']),
      challengeState: { ...state.challengeState, inferiCleared: true },
    };

    const spellName = spell === 'incendio' ? 'Incendio' : 'Confringo';
    const effect = spell === 'incendio'
      ? 'Flames erupt from your wand, sweeping across the water'
      : 'A ball of fire explodes from your wand, engulfing the creatures';

    return {
      message: `"${spellName}!"

${effect}. The pale bodies shriek and recoil, flames catching
on their rotted flesh. They sink back beneath the water, fleeing the fire.

The lake surface churns briefly, then goes still. Ash floats on the water.
The path to the eastern shore is clear.

[INFERI CHALLENGE COMPLETED - +10 points]`,
      state: newState,
      color: 'magic',
    };
  }

  // Death Eater duel
  if (state.location === 'death_eater_chamber' && !state.challengeState.deathEaterDefeated) {
    return handleOffensiveSpell(state, spell);
  }

  return {
    message: `"${spell === 'incendio' ? 'Incendio' : 'Confringo'}!"\n\nFire bursts from your wand, but there's nothing here that needs burning.`,
    state,
    color: 'magic',
  };
}

// Offensive spell handling
function handleOffensiveSpell(state: GameState, spell: string): CommandResult {
  // Death Eater duel
  if (state.location === 'death_eater_chamber' && !state.challengeState.deathEaterDefeated) {
    return handleDeathEaterCombat(state, spell);
  }

  // Guard corridor - fight option
  if (state.location === 'guard_corridor' && !state.challengeState.stealthPassed) {
    const damage = 20;
    const newHealth = Math.max(0, state.health - damage);

    if (newHealth <= 0) {
      return {
        message: `You attack the guards! They react instantly, both firing curses at once.
You manage to stun one, but the other's Stunning Spell catches you full in the chest.
Everything goes dark.

The surviving guard checks your pulse and shakes his head.
"Stealth was always an option," he mutters.

EXAMINATION FAILED - COMBAT CASUALTY`,
        state: { ...state, health: 0, gamePhase: 'death' },
        color: 'damage',
      };
    }

    const newState = {
      ...state,
      health: newHealth,
      score: state.score + 5, // Less points for fighting
      challengesCompleted: new Set([...state.challengesCompleted, 'stealth']),
      challengeState: { ...state.challengeState, stealthPassed: true },
    };

    return {
      message: `You burst from cover, wand blazing!

"${spell.charAt(0).toUpperCase() + spell.slice(1)}!"

You stun one guard, but the other returns fire. A Stinging Hex catches your arm
before your second spell takes them down. [-${damage} HP]

Both guards lie unconscious. The path is clear, though the loud fight may have
alerted others.

[GUARDS DEFEATED - +5 points (Combat approach)]`,
      state: newState,
      color: 'damage',
    };
  }

  // Inferi - stupefy only stuns temporarily
  if (state.location === 'inferi_lake' && !state.challengeState.inferiCleared) {
    return {
      message: `"${spell.charAt(0).toUpperCase() + spell.slice(1)}!"

Your spell strikes one of the pale bodies. It falls back into the water...
but moments later, it rises again. These things don't stay down.

Something else might be more effective against the undead.`,
      state,
      color: 'magic',
    };
  }

  // Hippogriff - attack is BAD
  if (state.location === 'creature_enclosure' && !state.challengeState.hippogriffTrusts) {
    const damage = 40;
    const newHealth = Math.max(0, state.health - damage);

    if (newHealth <= 0) {
      return {
        message: `You raise your wand against the proud creature. Its eyes flash with fury.
Before you can complete your spell, it lunges. Talons rake across you with
terrible force. The last thing you see is those fierce orange eyes.

The Hippogriff returns to its calm stance, as if nothing happened.
Your body lies still in the straw.

EXAMINATION FAILED - MAULED BY CREATURE`,
        state: { ...state, health: 0, gamePhase: 'death' },
        color: 'damage',
      };
    }

    return {
      message: `You raise your wand threateningly. The creature's eyes flash with fury!
It rears up, wings spreading wide, and strikes with its talons. You barely
dodge the worst of it, but still take a vicious hit. [-${damage} HP]

The creature snorts angrily, more hostile than before. Perhaps aggression
is not the answer here.`,
      state: {
        ...state,
        health: newHealth,
        score: Math.max(0, state.score - 5),
      },
      color: 'damage',
    };
  }

  return {
    message: `"${spell.charAt(0).toUpperCase() + spell.slice(1)}!"\n\nThe spell fires into the air, but there's no target here.`,
    state,
    color: 'magic',
  };
}

// Death Eater combat - enhanced multi-turn duel system
function handleDeathEaterCombat(state: GameState, spell: string): CommandResult {
  const deHealth = state.challengeState.deathEaterHealth;
  const round = state.challengeState.duelRound;
  const wasDefending = state.challengeState.duelDefending;

  // Calculate damage based on spell
  let damage = 20;
  let spellEffect = 'Your spell strikes the Death Eater!';

  if (spell === 'stupefy') {
    damage = 25;
    spellEffect = 'A jet of red light hits them square in the chest!';
  } else if (spell === 'expelliarmus') {
    damage = 25;
    spellEffect = 'The disarming spell connects, and they struggle to keep grip on their wand!';
  } else if (spell === 'reducto') {
    damage = 30;
    spellEffect = 'The blasting curse explodes against their defenses!';
  } else if (spell === 'confringo' || spell === 'incendio') {
    damage = 30;
    spellEffect = 'Fire engulfs them momentarily before they manage to extinguish it!';
  } else if (spell === 'petrificus totalus') {
    damage = 20;
    spellEffect = 'They partially freeze but manage to shake off the Body-Bind!';
  } else if (spell === 'impedimenta') {
    damage = 15;
    spellEffect = 'They slow momentarily, fighting against the jinx!';
  } else if (spell === 'flipendo') {
    damage = 15;
    spellEffect = 'The knockback jinx sends them stumbling backward!';
  } else if (spell === 'bombarda') {
    damage = 30;
    spellEffect = 'The explosive curse detonates with tremendous force!';
  } else if (spell === 'diffindo') {
    damage = 25;
    spellEffect = 'The severing charm slashes through their robes!';
  } else if (spell === 'incarcerous') {
    damage = 20;
    spellEffect = 'Ropes burst from your wand, binding their arms!';
  } else if (spell === 'levicorpus') {
    damage = 20;
    spellEffect = 'They\'re yanked into the air by their ankle!';
  } else if (spell === 'locomotor mortis') {
    damage = 15;
    spellEffect = 'Their legs snap together - the Leg-Locker Curse strikes!';
  } else if (spell === 'rictusempra') {
    damage = 10;
    spellEffect = 'They double over, fighting uncontrollable laughter!';
  } else if (spell === 'tarantallegra') {
    damage = 10;
    spellEffect = 'Their legs begin dancing uncontrollably!';
  } else if (spell === 'densaugeo') {
    damage = 10;
    spellEffect = 'Their front teeth begin growing rapidly!';
  } else if (spell === 'furnunculus') {
    damage = 10;
    spellEffect = 'Boils erupt across their exposed skin!';
  } else if (spell === 'depulso') {
    damage = 15;
    spellEffect = 'The banishing charm throws them backward!';
  }

  const newDeHealth = Math.max(0, deHealth - damage);

  // Calculate player damage - reduced if defending, none on first round
  let playerDamage = 0;
  if (round > 0) {
    playerDamage = wasDefending ? 5 : 15; // Much less damage if we used Protego last turn
  }
  const newPlayerHealth = Math.max(0, state.health - playerDamage);

  // Death check
  if (newPlayerHealth <= 0) {
    const deathMessages = [
      'A dark curse tears through you. Your wand clatters to the floor.',
      'The Death Eater\'s final hex breaks through your defenses. You crumple.',
      'A jet of red light catches you in the chest. Your vision fades.',
    ];
    return {
      message: `You duel fiercely, but the Death Eater gains the upper hand.
${deathMessages[round % deathMessages.length]}

The masked figure stands over you, lowering their wand.
"Another one who wasn't ready," they say coldly.

EXAMINATION FAILED - DEFEATED IN COMBAT`,
      state: { ...state, health: 0, gamePhase: 'death' },
      color: 'damage',
    };
  }

  // Victory check
  if (newDeHealth <= 0) {
    const newState = {
      ...state,
      health: newPlayerHealth,
      score: state.score + 10,
      challengesCompleted: new Set([...state.challengesCompleted, 'duel']),
      challengeState: {
        ...state.challengeState,
        deathEaterDefeated: true,
        deathEaterHealth: 0,
        duelDefending: false,
      },
    };

    const isDisarm = spell === 'expelliarmus';
    const extraPoints = isDisarm ? 5 : 0; // Bonus for merciful approach
    newState.score += extraPoints;

    const victoryMessage = isDisarm
      ? `Their wand spirals through the air and clatters to the floor. The Death Eater
stumbles, defeated but conscious, hands raised in surrender.`
      : `The force of your spell drives them to the ground. They don't get up.`;

    return {
      message: `"${spell.charAt(0).toUpperCase() + spell.slice(1)}!"

${spellEffect}

${victoryMessage}

"Impressive dueling," you hear from somewhere above. An examiner's voice.
"The trial by combat is concluded."

[DEATH EATER DUEL COMPLETED - +${10 + extraPoints} points${extraPoints > 0 ? ' (Mercy bonus)' : ''}]`,
      state: newState,
      color: 'magic',
    };
  }

  // Combat continues - build the counter-attack message
  const newState = {
    ...state,
    health: newPlayerHealth,
    challengeState: {
      ...state.challengeState,
      deathEaterHealth: newDeHealth,
      duelRound: round + 1,
      duelDefending: false, // Reset defending state
    },
  };

  // Different counter-attacks based on how hurt the Death Eater is
  let counterAttack: string;
  let taunt: string;

  if (newDeHealth > 70) {
    // Healthy - confident attacks
    const earlyAttacks = [
      'They flick their wand - a Stunning Spell races toward you!',
      'Dark light gathers at their wand tip as they counter-attack!',
      '"Is that the best you can do?" they sneer, launching a curse!',
    ];
    counterAttack = earlyAttacks[round % earlyAttacks.length];
    taunt = 'The Death Eater looks confident, circling you slowly.';
  } else if (newDeHealth > 30) {
    // Wounded - desperate
    const midAttacks = [
      'They snarl and fire a rapid volley of hexes!',
      'Breathing hard, they slash their wand viciously through the air!',
      'Blood runs down their face as they cast another curse!',
    ];
    counterAttack = midAttacks[round % midAttacks.length];
    taunt = 'They\'re hurt but dangerous. The duel is far from over.';
  } else {
    // Near defeat - wild and desperate
    const lateAttacks = [
      'Panic in their eyes, they throw everything they have at you!',
      'With a desperate scream, they unleash a barrage of dark magic!',
      'Staggering, they raise their wand for one more strike!',
    ];
    counterAttack = lateAttacks[round % lateAttacks.length];
    taunt = 'They\'re weakening fast! One more good hit should finish this!';
  }

  const damageText = playerDamage > 0
    ? (wasDefending
        ? `\nYour lingering shield absorbs most of the blow. [-${playerDamage} HP]`
        : `\nThe spell grazes you! [-${playerDamage} HP]`)
    : '';

  return {
    message: `"${spell.charAt(0).toUpperCase() + spell.slice(1)}!"

${spellEffect}

${counterAttack}${damageText}

${taunt}`,
    state: newState,
    color: playerDamage > 0 ? 'damage' : 'magic',
  };
}

// Confundo handling - confuses guards to lure them away
function handleConfundo(state: GameState): CommandResult {
  if (state.location !== 'guard_corridor') {
    return {
      message: '"Confundo!"\n\nThe spell shoots from your wand, but there\'s no one here to confuse.',
      state,
      color: 'magic',
    };
  }

  if (state.challengeState.stealthPassed) {
    return {
      message: "The guards are already dealt with.",
      state,
    };
  }

  const newState = {
    ...state,
    score: state.score + 10,
    challengesCompleted: new Set([...state.challengesCompleted, 'stealth']),
    challengeState: {
      ...state.challengeState,
      stealthPassed: true,
      guardsAlerted: false,
    },
  };

  // Different message depending on if guards were already alerted
  if (state.challengeState.guardsAlerted) {
    return {
      message: `"Confundo!"

Your spell strikes one of the guards. His eyes glaze over momentarily.

"Did you hear that noise down the east corridor?" he says suddenly.
"We should check it out immediately!"

Both guards hurry off in the wrong direction, completely forgetting about you.
The path north is clear.

[STEALTH SECTION COMPLETED - +10 points]`,
      state: newState,
      color: 'magic',
    };
  }

  return {
    message: `"Confundo!"

Your spell strikes one of the guards before they fully notice you. His eyes
glaze over, confused.

"Wait... did we finish our patrol of the east wing?"
"I... I don't think so. We should head there now."

The guards wander off in the wrong direction, thoroughly bewildered. The path
north is clear.

[STEALTH SECTION COMPLETED - +10 points]`,
    state: newState,
    color: 'magic',
  };
}

// Episkey handling
function handleEpiskey(state: GameState): CommandResult {
  if (state.episkeyCasts >= 3) {
    return {
      message: `"Episkey..."

You attempt the healing charm, but your magical reserves are depleted. The spell
takes too much from the caster to use repeatedly. You'll need another method of healing.`,
      state,
    };
  }

  if (state.health >= state.maxHealth) {
    return {
      message: "You're not injured. There's nothing to heal.",
      state,
    };
  }

  const maxHealing = 15 + Math.floor(Math.random() * 6); // 15-20 HP
  const actualHealing = Math.min(maxHealing, state.maxHealth - state.health);
  const newHealth = state.health + actualHealing;

  const hpMessage = newHealth >= state.maxHealth
    ? `[Restored to full health: ${newHealth}/${state.maxHealth}]`
    : `[+${actualHealing} HP -> ${newHealth}/${state.maxHealth}]`;

  return {
    message: `"Episkey!"

A warm sensation spreads through your body as minor wounds close and bruises fade.
${hpMessage}

You feel ${state.episkeyCasts + 1 >= 3 ? 'drained. That was the last time you can cast this.' : 'better, though the spell has tired you slightly.'}`,
    state: {
      ...state,
      health: newHealth,
      episkeyCasts: state.episkeyCasts + 1,
    },
    color: 'healing',
  };
}

// Aguamenti handling
function handleAguamenti(state: GameState): CommandResult {
  if (state.location === 'inferi_lake' && !state.challengeState.inferiCleared) {
    const damage = 10;
    const newHealth = Math.max(0, state.health - damage);

    if (newHealth <= 0) {
      return {
        message: `"Aguamenti!"

Water sprays from your wand... and the pale bodies surge forward with renewed
vigor! The water seems to invigorate them. Cold hands grasp at you, pulling
you under...

YOU HAVE DIED. The examination has ended in failure.`,
        state: { ...state, health: 0, gamePhase: 'death' },
        color: 'damage',
      };
    }

    return {
      message: `"Aguamenti!"

Water sprays from your wand... and the pale bodies surge forward with renewed
vigor! The water seems to invigorate them. One grabs your ankle before you
wrench free. [-${damage} HP]

That was the wrong approach. These creatures respond to water, but not in the
way you wanted.`,
      state: { ...state, health: newHealth },
      color: 'damage',
    };
  }

  return {
    message: '"Aguamenti!"\n\nA stream of clear water sprays from your wand, splashing on the floor.',
    state,
    color: 'magic',
  };
}

// Revelio handling
function handleRevelio(state: GameState, spell: string): CommandResult {
  const isHomenum = spell === 'homenum revelio';

  if (isHomenum && state.location === 'guard_corridor' && !state.challengeState.stealthPassed) {
    return {
      message: `"Homenum Revelio!"

The spell confirms what you can already see: two guards patrol ahead.
You'll need to deal with them somehow - fight or sneak.`,
      state,
      color: 'magic',
    };
  }

  // Reveal hidden things in current location
  if (state.location === 'hidden_room' || state.location === 'shadow_passage') {
    return {
      message: `"${spell.charAt(0).toUpperCase() + spell.slice(1)}!"

The spell washes over the area. ${state.location === 'hidden_room' ?
        'Ancient protective enchantments glow faintly on the walls - this place has been hidden for centuries.' :
        'You detect a faint magical signature further east, something hidden from casual discovery.'}`,
      state,
      color: 'magic',
    };
  }

  return {
    message: `"${spell.charAt(0).toUpperCase() + spell.slice(1)}!"\n\nThe revealing charm finds nothing hidden in this area.`,
    state,
    color: 'magic',
  };
}

// Accio handling
function handleAccio(state: GameState, target: string): CommandResult {
  const normalizedTarget = target.toLowerCase().trim();

  if (normalizedTarget.includes('dittany')) {
    // Check if near armory or preparation room
    const nearHealingAreas = ['armory_corridor', 'preparation_room', 'beyond_guards'];
    if (nearHealingAreas.includes(state.location) && !state.inventory.includes('dittany')) {
      return {
        message: `"Accio Dittany!"

A small vial zooms toward you from somewhere nearby, landing in your outstretched hand.
You now have Essence of Dittany.`,
        state: {
          ...state,
          inventory: [...state.inventory, 'dittany'],
        },
        color: 'magic',
      };
    }
    return {
      message: `"Accio Dittany!"

You hear something rattle in the distance, but nothing comes. Perhaps there's no
Dittany close enough to summon from here.`,
      state,
      color: 'magic',
    };
  }

  if (normalizedTarget.includes('wand')) {
    return {
      message: `"Accio Wand!"

Your own wand vibrates in your hand. That probably wasn't what you meant.`,
      state,
    };
  }

  return {
    message: `"Accio ${target}!"

Nothing happens. Either there's no ${target} nearby, or it's protected against summoning.`,
    state,
    color: 'magic',
  };
}

// Handle action commands
function handleAction(state: GameState, command: ParsedCommand): CommandResult {
  const verb = command.verb;
  const target = command.target?.toLowerCase() || '';

  switch (verb) {
    case 'examine':
      return handleExamine(state, target);

    case 'take':
      return handleTake(state, target);

    case 'use':
      return handleUse(state, target);

    case 'bow':
      return handleBow(state);

    case 'ride':
      return handleRide(state);

    case 'leave':
      return handleLeave(state);

    case 'attack':
      if (state.location === 'creature_enclosure' && !state.challengeState.hippogriffTrusts) {
        return handleOffensiveSpell(state, 'stupefy');
      }
      return {
        message: "There's nothing here to attack.",
        state,
      };

    case 'crawl':
      return handleCrawl(state);

    case 'claim':
      return handleClaim(state);

    case 'wear':
      return handleWear(state, target);

    case 'remove':
      return handleRemove(state, target);

    case 'read':
      return handleRead(state, target);

    case 'touch':
      return handleTouch(state, target);

    case 'see':
      return handleSee(state, target);

    default:
      if (!target) {
        return { message: `${verb.charAt(0).toUpperCase() + verb.slice(1)} what?`, state };
      }
      return {
        message: `You can't ${verb} the ${target}.`,
        state,
      };
  }
}

// Handle seeing (for Mirror of Erised)
function handleSee(state: GameState, target: string): CommandResult {
  // Mirror of Erised in final chamber
  if (state.location === 'final_chamber' && !state.challengeState.finalChallengeComplete) {
    if (!target || target.includes('mirror') || target.includes('glass') || target.includes('erised')) {
      return handleSeeMirror(state);
    }
  }

  if (!target) {
    return { message: "See what?", state };
  }

  return {
    message: `You look at the ${target}, but nothing special happens.`,
    state,
  };
}

// Handle touching (for Mirror of Erised) - now triggers failure
function handleTouch(state: GameState, target: string): CommandResult {
  if (!target) {
    return { message: "Touch what?", state };
  }

  // Mirror of Erised in final chamber - touching it is bad
  if (state.location === 'final_chamber' && !state.challengeState.finalChallengeComplete &&
      (target.includes('mirror') || target.includes('glass') || target.includes('erised') || target === '')) {
    return handleTouchMirror(state);
  }

  // Looking into mirror is also touching/gazing at it
  if (state.location === 'final_chamber' && !state.challengeState.finalChallengeComplete) {
    // If they just typed "look into" without specifying mirror, assume mirror
    return handleTouchMirror(state);
  }

  return {
    message: `You touch the ${target}, but nothing happens.`,
    state,
  };
}

// Handle reading (for runes and other text)
function handleRead(state: GameState, target: string): CommandResult {
  // Reading runes provides location-specific hints
  if (target.includes('rune') || target.includes('wall') || target.includes('carving')) {
    const location = state.location;

    // Location-specific rune hints
    if (location === 'dark_corridor' && !state.challengeState.lumosActive) {
      return {
        message: `You squint at the wall in the darkness. You can barely make out some carved symbols...
but you can't read them without light.`,
        state,
      };
    }

    if (location === 'dark_corridor' && state.challengeState.lumosActive) {
      return {
        message: `Your wandlight illuminates ancient runes carved into the stone:

"Light conquers shadow, but shadow returns when light departs.
Keep your wand ready in the depths below."

The runes seem to be a warning about the dark passages ahead.`,
        state,
      };
    }

    if (location === 'chasm_room' && !state.challengeState.levitationBridgeBuilt) {
      return {
        message: `Runes carved into the cliff edge read:

"What the hand cannot lift, the mind can raise.
Speak the words of the Hovering Charm."

A hint about how to cross the chasm, perhaps.`,
        state,
      };
    }

    if (location === 'dementor_chamber' && !state.challengeState.dementorDefeated) {
      return {
        message: `Faded runes are carved near the entrance:

"Against the soul-devourer, only joy prevails.
Summon your guardian with the happiest memory."

The writing references the Patronus Charm.`,
        state,
      };
    }

    if (location === 'inferi_lake' && !state.challengeState.inferiCleared) {
      return {
        message: `Ancient warnings are etched into the stone:

"The drowned ones fear the flame eternal.
That which brings warmth to the living brings death to the dead."

A clear hint about using fire magic.`,
        state,
      };
    }

    if (location === 'creature_enclosure' && !state.challengeState.hippogriffTrusts) {
      return {
        message: `Carved instructions remain visible on a nearby wall:

"Approach with respect. Bow first, and wait.
Only the humble may pass the proud guardian."

Hagrid's lessons echo in your memory.`,
        state,
      };
    }

    if (location === 'guard_corridor' && !state.challengeState.stealthPassed) {
      return {
        message: `Discrete markings on the wall suggest:

"Some battles are won without fighting.
Muffle your steps, or cloak your form."

Stealth appears to be an option here.`,
        state,
      };
    }

    if (location === 'chasm_other_side' && !state.challengeState.dementorDefeated) {
      return {
        message: `Glowing runes pulse on the magical barrier:

"The trials of darkness must be faced before the trials of combat.
Seek the cold chamber to the east."

The eastern path leads to mandatory challenges.`,
        state,
      };
    }

    return {
      message: `You examine the runes, but they seem purely decorative in this area.`,
      state,
    };
  }

  // Reading other things
  if (!target) {
    return {
      message: "Read what? Try READ RUNES or specify what to read.",
      state,
    };
  }

  return {
    message: `There's nothing readable with that name here.`,
    state,
  };
}

// Examine handling
function handleExamine(state: GameState, target: string): CommandResult {
  if (!target) {
    return handleLook(state);
  }

  // Location-specific examinations
  const location = state.location;

  // Chasm room - examine blocks
  if (location === 'chasm_room' && (target.includes('block') || target.includes('stone') || target.includes('bridge'))) {
    if (state.challengeState.levitationBridgeBuilt) {
      return {
        message: "The stone blocks form a sturdy bridge, held in place by lingering magic.",
        state,
      };
    }
    return {
      message: `The stone blocks are massive - each must weigh several hundred pounds.
They're far too heavy to move by hand, but they look like they would fit together
to form a bridge across the chasm.`,
      state,
    };
  }

  // Dementor chamber
  if (location === 'dementor_chamber' && !state.challengeState.dementorDefeated &&
      (target.includes('creature') || target.includes('figure') || target.includes('shadow'))) {
    return {
      message: `A tall, cloaked figure, gliding rather than walking. Its face is hidden
beneath a hood, but you can hear its rattling breath - that horrible sucking
sound. The air around it is deathly cold. You've read about these in your
Dark creature studies...`,
      state,
    };
  }

  // Inferi lake
  if (location === 'inferi_lake' && !state.challengeState.inferiCleared &&
      (target.includes('water') || target.includes('body') || target.includes('bodies') || target.includes('lake'))) {
    return {
      message: `The water is black and still. Beneath the surface, you can see pale bodies -
dozens of them. Human forms, but wrong. Dead. Their eyes are white and empty,
their skin grey and waterlogged. They move with a jerky, unnatural animation.

You remember your lessons on these creatures. Fire. They fear fire.`,
      state,
    };
  }

  // Hippogriff
  if (location === 'creature_enclosure' && !state.challengeState.hippogriffTrusts &&
      (target.includes('creature') || target.includes('beast') || target.includes('bird') || target.includes('horse'))) {
    return {
      message: `A magnificent creature - part eagle, part horse. Its front half bears the head,
wings, and talons of a giant eagle, covered in steel-grey feathers. The back
half is the powerful body of a horse.

Its orange eyes watch you with fierce intelligence. These creatures are proud
and dangerous, but not evil. They demand respect. You recall Professor Hagrid's
lessons on proper etiquette...`,
      state,
    };
  }

  // Final chamber - Mirror of Erised
  if (location === 'final_chamber' && !state.challengeState.finalChallengeComplete &&
      (target.includes('mirror') || target.includes('erised') || target.includes('glass'))) {
    return {
      message: `The Mirror of Erised stands before you, its golden frame gleaming.
The inscription reads: "Erised stra ehru oyt ube cafru oyt on wohsi"

(Read backwards: "I show not your face but your heart's desire")

You've heard of this mirror - Dumbledore himself once said that many have
wasted their lives before it, transfixed by what they saw.

Do you LOOK INTO the mirror to see your heart's desire?
Or do you TURN AWAY before it's too late?`,
      state,
    };
  }

  // Inventory items
  if (state.inventory.includes('dittany') && target.includes('dittany')) {
    return {
      message: "A small vial of Essence of Dittany, a powerful healing potion that can close wounds instantly.",
      state,
    };
  }

  if (state.inventory.includes('wiggenweld_potion') && (target.includes('wiggenweld') || target.includes('potion'))) {
    return {
      message: "A Wiggenweld Potion, a powerful healing draught that can restore vitality.",
      state,
    };
  }

  return {
    message: `You examine the ${target}, but there's nothing particularly notable about it.`,
    state,
  };
}

// Take handling
function handleTake(state: GameState, target: string): CommandResult {
  if (!target) {
    return { message: "Take what? You need to specify what to take.", state };
  }

  const location = LOCATIONS[state.location];
  if (!location) {
    return { message: "There's nothing here to take.", state };
  }

  // Check for dittany
  if (target.includes('dittany') || target.includes('vial') || target.includes('essence')) {
    if (location.items.includes('dittany') && !state.inventory.includes('dittany')) {
      return {
        message: "You carefully pick up the vial of Essence of Dittany and store it safely.",
        state: {
          ...state,
          inventory: [...state.inventory, 'dittany'],
        },
      };
    }
    if (state.inventory.includes('dittany')) {
      return { message: "You already have Essence of Dittany.", state };
    }
    return { message: "There's no Dittany here to take.", state };
  }

  // Check for Wiggenweld Potion
  if (target.includes('wiggenweld') || target.includes('potion')) {
    if (location.items.includes('wiggenweld_potion') && !state.inventory.includes('wiggenweld_potion')) {
      return {
        message: "You pick up the Wiggenweld Potion. It might save your life.",
        state: {
          ...state,
          inventory: [...state.inventory, 'wiggenweld_potion'],
        },
      };
    }
    if (state.inventory.includes('wiggenweld_potion')) {
      return { message: "You already have a Wiggenweld Potion.", state };
    }
    return { message: "There's no potion here to take.", state };
  }

  // Check for healing herbs
  if (target.includes('herb')) {
    if (location.items.includes('healing_herbs') && !state.inventory.includes('healing_herbs')) {
      return {
        message: "You gather the dried healing herbs. They smell faintly of mint and lavender.",
        state: {
          ...state,
          inventory: [...state.inventory, 'healing_herbs'],
        },
      };
    }
    if (state.inventory.includes('healing_herbs')) {
      return { message: "You already have healing herbs.", state };
    }
    return { message: "There are no herbs here.", state };
  }

  // Check for the mirror in final chamber (touching it = failure)
  if (target.includes('mirror') || target.includes('erised')) {
    if (state.location === 'final_chamber' && !state.challengeState.finalChallengeComplete) {
      return handleTouchMirror(state);
    }
    return { message: "There's no mirror here.", state };
  }

  // Check for invisibility cloak
  if (target.includes('cloak') || target.includes('invisibility')) {
    if (location.items.includes('invisibility_cloak') && !state.inventory.includes('invisibility_cloak')) {
      return {
        message: `You pick up the cloak. The fabric is impossibly light, almost fluid in your
hands. This is unmistakably an Invisibility Cloak - extremely rare magical
artifact.

You could WEAR it to become invisible.`,
        state: {
          ...state,
          inventory: [...state.inventory, 'invisibility_cloak'],
        },
        color: 'magic',
      };
    }
    if (state.inventory.includes('invisibility_cloak')) {
      return { message: "You already have the Invisibility Cloak.", state };
    }
    return { message: "There's no cloak here.", state };
  }

  return { message: `There's no ${target} here to take.`, state };
}

// Use handling
function handleUse(state: GameState, target: string): CommandResult {
  if (!target) {
    return { message: "Use what? You need to specify an item from your inventory.", state };
  }

  if (target.includes('dittany')) {
    if (!state.inventory.includes('dittany')) {
      return { message: "You don't have any Dittany.", state };
    }
    if (state.health >= state.maxHealth) {
      return { message: "You're not injured. Save the Dittany for when you need it.", state };
    }

    const maxHealing = 35;
    const actualHealing = Math.min(maxHealing, state.maxHealth - state.health);
    const newHealth = state.health + actualHealing;
    const newInventory = state.inventory.filter(i => i !== 'dittany');

    const hpMessage = newHealth >= state.maxHealth
      ? `[Restored to full health: ${newHealth}/${state.maxHealth}]`
      : `[+${actualHealing} HP -> ${newHealth}/${state.maxHealth}]`;

    return {
      message: `You uncork the vial and apply the Essence of Dittany to your wounds.
The liquid sizzles slightly on contact, and you feel your injuries closing.
${hpMessage}`,
      state: {
        ...state,
        health: newHealth,
        inventory: newInventory,
      },
      color: 'healing',
    };
  }

  if (target.includes('wiggenweld') || target.includes('potion')) {
    if (!state.inventory.includes('wiggenweld_potion')) {
      return { message: "You don't have a Wiggenweld Potion.", state };
    }
    if (state.health >= state.maxHealth) {
      return { message: "You're in perfect health. Save the potion for when you need it.", state };
    }

    const maxHealing = 50;
    const actualHealing = Math.min(maxHealing, state.maxHealth - state.health);
    const newHealth = state.health + actualHealing;
    const newInventory = state.inventory.filter(i => i !== 'wiggenweld_potion');

    const hpMessage = newHealth >= state.maxHealth
      ? `[Restored to full health: ${newHealth}/${state.maxHealth}]`
      : `[+${actualHealing} HP -> ${newHealth}/${state.maxHealth}]`;

    return {
      message: `You drink the Wiggenweld Potion in one gulp. Warmth spreads through your body,
and you feel strength returning to your limbs.
${hpMessage}`,
      state: {
        ...state,
        health: newHealth,
        inventory: newInventory,
      },
      color: 'healing',
    };
  }

  if (target.includes('herb')) {
    if (!state.inventory.includes('healing_herbs')) {
      return { message: "You don't have any healing herbs.", state };
    }
    if (state.health >= state.maxHealth) {
      return { message: "You're not hurt. Save the herbs.", state };
    }

    const maxHealing = 20;
    const actualHealing = Math.min(maxHealing, state.maxHealth - state.health);
    const newHealth = state.health + actualHealing;
    const newInventory = state.inventory.filter(i => i !== 'healing_herbs');

    const hpMessage = newHealth >= state.maxHealth
      ? `[Restored to full health: ${newHealth}/${state.maxHealth}]`
      : `[+${actualHealing} HP -> ${newHealth}/${state.maxHealth}]`;

    return {
      message: `You chew the dried herbs. They taste bitter, but you feel slightly better.
${hpMessage}`,
      state: {
        ...state,
        health: newHealth,
        inventory: newInventory,
      },
      color: 'healing',
    };
  }

  return { message: `You don't have any ${target}, or it can't be used here.`, state };
}

// Wear handling (for invisibility cloak)
function handleWear(state: GameState, target: string): CommandResult {
  if (!target || target.includes('cloak') || target.includes('invisibility')) {
    if (!state.inventory.includes('invisibility_cloak')) {
      return {
        message: "You don't have anything wearable.",
        state,
      };
    }

    if (state.challengeState.wearingCloak) {
      return {
        message: "You're already wearing the Invisibility Cloak.",
        state,
      };
    }

    const newState = {
      ...state,
      challengeState: {
        ...state.challengeState,
        wearingCloak: true,
        // Note: Cloak provides stealth for guards only
        // stealthActive is NOT set here - we check wearingCloak contextually
      },
    };

    // Give context-specific message
    let extraMessage = '';
    if (state.location === 'guard_corridor' && !state.challengeState.stealthPassed) {
      if (state.challengeState.guardsAlerted) {
        extraMessage = `\n\nThe guards look around in confusion as you vanish from sight.
"Where did they go?" You can now slip past them to the north.`;
      } else {
        extraMessage = `\n\nThe guards continue their patrol, unable to see you. You can now
move north past them undetected.`;
      }
      // Reset guards alert since you're invisible now
      newState.challengeState.guardsAlerted = false;
    } else {
      extraMessage = `\n\n(Note: The cloak makes you invisible, but some magical creatures
and powerful wizards may still detect your presence through other means.)`;
    }

    return {
      message: `You sweep the Invisibility Cloak around your shoulders. The silvery fabric
settles over you, and you watch as your body fades from view.

You are now invisible.${extraMessage}`,
      state: newState,
      color: 'magic',
    };
  }

  return {
    message: `You can't wear the ${target}.`,
    state,
  };
}

// Remove handling (for invisibility cloak)
function handleRemove(state: GameState, target: string): CommandResult {
  if (!target || target.includes('cloak') || target.includes('invisibility')) {
    if (!state.challengeState.wearingCloak) {
      return {
        message: "You're not wearing anything special.",
        state,
      };
    }

    const newState = {
      ...state,
      challengeState: {
        ...state.challengeState,
        wearingCloak: false,
        stealthActive: false,
      },
    };

    return {
      message: `You remove the Invisibility Cloak. Your body becomes visible once more.`,
      state: newState,
    };
  }

  return {
    message: `You're not wearing a ${target}.`,
    state,
  };
}

// Bow handling
function handleBow(state: GameState): CommandResult {
  if (state.location !== 'creature_enclosure') {
    return {
      message: "You bow politely. Nothing happens.",
      state,
    };
  }

  if (state.challengeState.hippogriffTrusts) {
    return {
      message: "The creature dips its head in acknowledgment.",
      state,
    };
  }

  if (state.challengeState.hippogriffBowed) {
    // Second bow - creature accepts
    const newState = {
      ...state,
      score: state.score + 10 + 5, // Bonus for proper etiquette
      challengesCompleted: new Set([...state.challengesCompleted, 'hippogriff']),
      challengeState: {
        ...state.challengeState,
        hippogriffTrusts: true,
      },
    };

    return {
      message: `You maintain your bow, not breaking eye contact.

After a long, tense moment... the creature bows its great feathered head in return!

It steps aside, allowing you to pass. Its fierce eyes seem almost approving now.

[HIPPOGRIFF CHALLENGE COMPLETED - +15 points (Proper etiquette bonus)]`,
      state: newState,
      color: 'magic',
    };
  }

  // First bow
  return {
    message: `You bow low, maintaining eye contact with the proud creature.

The Hippogriff's fierce orange eyes bore into you. It doesn't move, doesn't blink.
The tension stretches on...

Wait. Hold your bow. Don't look away.`,
    state: {
      ...state,
      challengeState: { ...state.challengeState, hippogriffBowed: true },
    },
  };
}

// Ride handling
function handleRide(state: GameState): CommandResult {
  if (state.location !== 'creature_enclosure' || !state.challengeState.hippogriffTrusts) {
    return {
      message: "There's nothing here to ride.",
      state,
    };
  }

  // Skip to a further location
  const newVisited = new Set(state.visitedLocations);
  newVisited.add('beyond_creature');

  return {
    message: `You approach the Hippogriff and it allows you to mount. With powerful beats of
its wings, you soar upward through the shaft of light. The wind rushes past.

The creature lands gracefully in a corridor beyond, then nudges you off gently.
It turns and flies back the way it came.

You've saved considerable time and energy.`,
    state: {
      ...state,
      location: 'beyond_creature',
      visitedLocations: newVisited,
      score: state.score + 5, // Bonus for clever solution
    },
    color: 'magic',
  };
}

// Leave/Turn away handling (for final chamber - Mirror of Erised)
function handleLeave(state: GameState): CommandResult {
  if (state.location !== 'final_chamber' || state.challengeState.finalChallengeComplete) {
    return {
      message: "There's nothing to leave here.",
      state,
    };
  }

  const newState = {
    ...state,
    score: state.score + 20, // Higher points for moral choice
    challengesCompleted: new Set([...state.challengesCompleted, 'final']),
    challengeState: { ...state.challengeState, finalChallengeComplete: true },
    gamePhase: 'victory' as const,
  };

  return {
    message: `You close your eyes and turn away from the mirror.

It takes all your willpower. Part of you screams to look, just once, to see
what you truly desire. But you remember Dumbledore's words: "The happiest man
on earth would look into the mirror and see only himself, exactly as he is."

You don't need the mirror to know what you want. You want to be an Auror.
And that desire is one you can achieve through your own actions.

"Remarkable," the voice says, warm with approval. "Few have the wisdom to
turn away. The mirror shows you nothing you cannot earn for yourself."

The chamber fills with golden light. The mirror vanishes, and a door
materializes in the far wall.

[FINAL CHALLENGE COMPLETED - +20 points (Wisdom bonus)]

You step through the door and emerge into sunlight. Examiners await you,
their faces stern but approving.

"Congratulations," one says. "You have completed the Auror examination."`,
    state: newState,
    color: 'gold',
  };
}

// See Mirror handling (looking into the mirror with random outcomes)
function handleSeeMirror(state: GameState): CommandResult {
  if (state.location !== 'final_chamber' || state.challengeState.finalChallengeComplete) {
    return {
      message: "There's no mirror here to see.",
      state,
    };
  }

  // First look - give warning and chance to turn away
  if (!state.challengeState.mirrorLookedOnce) {
    const newState = {
      ...state,
      challengeState: {
        ...state.challengeState,
        mirrorLookedOnce: true,
      },
    };

    return {
      message: `You begin to step toward the mirror, drawn to its gleaming surface.

For a moment, you glimpse something in the reflection - something that calls to you,
promises you everything you ever wanted...

But then you remember Dumbledore's warning: "It does not do to dwell on dreams
and forget to live."

You hesitate at the edge. Part of you wants desperately to see what the mirror
will show. But another part knows the danger.

You can still TURN AWAY and walk past safely.

Or you can LOOK again and gaze into your heart's desire...

But be warned: The mirror has destroyed many who looked too deeply.`,
      state: newState,
      color: 'warning',
    };
  }

  // Second look - roll for outcome (90% normal desire, 10% dark desire)
  const visionRoll = Math.floor(Math.random() * 10);

  // 10% chance: See dark desire (FAIL)
  if (visionRoll === 0) {
    const newState = {
      ...state,
      score: 0,
      challengeState: { ...state.challengeState, finalChallengeComplete: true },
      gamePhase: 'death' as const,
    };

    return {
      message: `You step closer and gaze into the mirror's gleaming surface...

You see yourself - powerful, commanding, feared. Dark wizards bow before you.
Ancient magic crackles at your fingertips. You stand above everyone, answering
to no one. Supreme. Unstoppable.

The vision is intoxicating. You lean closer, wanting more...

"ENOUGH!"

Examiners rush in and pull you away. You struggle against them, desperate to
see more of that glorious vision.

The voice speaks, cold and final:

"You have failed. The mirror revealed your true desire: not to serve and protect,
but to dominate and control. You would have become exactly what Aurors are sworn
to fight against."

═══════════════════════════════════════════════════════════════════

EXAMINATION FAILED - CORRUPTED BY DESIRE

An Auror who desires power above all else is a Dark wizard in waiting.
This is an automatic disqualification, regardless of previous performance.`,
      state: newState,
      color: 'damage',
    };
  }

  // 90% chance: See normal Auror desire (pass with lower score)
  const newState = {
    ...state,
    score: state.score + 10,
    challengesCompleted: new Set([...state.challengesCompleted, 'final']),
    challengeState: { ...state.challengeState, finalChallengeComplete: true },
    gamePhase: 'victory' as const,
  };

  return {
    message: `Unable to resist, you step closer and gaze into the mirror's gleaming surface...

The reflection that stares back is you - but different. You wear the robes of
an Auror, the badge gleaming on your chest. Behind you, you see grateful faces
of people you've saved, dark wizards you've brought to justice. But what strikes
you most is the look in your reflection's eyes: determination, wisdom, and peace.

You realize: this isn't a fantasy of power. This is simply you, having achieved
what you've worked for through your own merit and dedication.

It takes effort, but you tear your eyes away from the mirror.

The voice speaks, with measured approval:

"You looked into Erised against better judgment, but your heart revealed itself
to be true. You desire duty and purpose, not power. This saves you - barely.
Remember: a wiser Auror would have turned away."

The mirror fades, and a door appears.

[FINAL CHALLENGE COMPLETED - +10 points (Acceptable - risky choice)]

You step through. The examiners nod, but their expressions are stern.

"You passed. But remember: luck favors the prepared, not the reckless."`,
    state: newState,
    color: 'warning',
  };
}

// Touch Mirror handling (reaching for the mirror = failure)
function handleTouchMirror(state: GameState): CommandResult {
  if (state.location !== 'final_chamber' || state.challengeState.finalChallengeComplete) {
    return {
      message: "There's nothing here to touch.",
      state,
    };
  }

  const newState = {
    ...state,
    score: 0, // Failed - no points
    challengeState: { ...state.challengeState, finalChallengeComplete: true },
    gamePhase: 'death' as const,
  };

  return {
    message: `Your fingers reach toward the mirror's surface...

The moment you touch it, visions flood your mind. You see yourself - powerful,
respected, feared. Dark artifacts answer to your command. You are unstoppable.
You are everything you ever wanted to be.

You cannot look away. Hours pass. Days. You don't notice.

The examiners find you standing before the mirror, eyes glazed, a smile frozen
on your face. They've seen this before. They know what must be done.

"Another one lost to Erised," an examiner sighs. "They never learn - the mirror
shows only desire, never the path to achieve it. They waste away, wanting."

They gently lead you from the chamber, but your eyes stay fixed on the mirror
until the very last moment. You'll spend weeks in St. Mungo's, recovering.

═══════════════════════════════════════════════════════════════════

EXAMINATION FAILED - CONSUMED BY DESIRE

The wisest wizards never look into the Mirror of Erised at all.
This is an automatic disqualification, regardless of previous performance.`,
    state: newState,
    color: 'damage',
  };
}

// Crawl handling
function handleCrawl(state: GameState): CommandResult {
  if (state.location !== 'shadow_passage') {
    return {
      message: "There's no need to crawl here.",
      state,
    };
  }

  if (state.challengeState.passageCleared) {
    return {
      message: "You've already cleared this passage.",
      state,
    };
  }

  const newVisited = new Set(state.visitedLocations);
  newVisited.add('hidden_room');

  const newState = {
    ...state,
    location: 'hidden_room',
    visitedLocations: newVisited,
    score: state.score + 5,
    challengeState: { ...state.challengeState, passageCleared: true },
  };

  return {
    message: `You get down on your hands and knees and carefully crawl through the tight space.
Cobwebs brush against your face and dust fills your nostrils, but you manage
to squeeze through to the other side.

[PASSAGE CLEARED - +5 points]

${getLocationDescription(newState)}`,
    state: newState,
    color: 'magic',
  };
}

// Claim handling - no longer used for badge
function handleClaim(state: GameState): CommandResult {
  return {
    message: "There's nothing to claim here.",
    state,
  };
}

// Handle system commands
function handleSystem(state: GameState, verb: string): CommandResult {
  switch (verb) {
    case 'help':
      return { ...handleHelp(), state };

    case 'hint':
      return handleHint(state);

    case 'inventory':
      return handleInventory(state);

    case 'look':
      return handleLook(state);

    case 'score':
      return handleScore(state);

    case 'journey':
      return handleJourney(state);

    case 'restart':
      return {
        message: "Are you sure you want to restart? Type RESTART CONFIRM to confirm.",
        state,
      };

    case 'quit':
      return {
        message: "Thank you for taking the Auror Examination. Type RESTART to try again.",
        state: { ...state, gamePhase: 'death' },
      };

    default:
      return {
        message: "Unknown command.",
        state,
      };
  }
}

// Hint system - progressive hints that get more specific with more attempts
function handleHint(state: GameState): CommandResult {
  const hintRequests = state.hintRequestCounts[state.location] || 0;
  const location = state.location;

  // Helper to create new state with penalty (only called for NEW hints)
  const createNewState = (extraPenalty: number = 0) => ({
    ...state,
    hintsUsed: state.hintsUsed + 1,
    score: state.score - 2 - extraPenalty,
    hintRequestCounts: {
      ...state.hintRequestCounts,
      [state.location]: hintRequests + 1,
    },
  });

  // Helper to add penalty message to hints
  const addPenalty = (msg: string, extraPenalty: number = 0): string => {
    const totalPenalty = 2 + extraPenalty;
    return `${msg}\n\n[-${totalPenalty} points for hint]`;
  };

  // Helper for repeated hints (no penalty)
  const repeatHint = (msg: string): string => {
    return `${msg}\n\n[No additional penalty for repeated hint]`;
  };

  // Entrance hall - locked door
  if (location === 'entrance_hall' && !state.challengeState.doorUnlocked) {
    if (hintRequests === 0) {
      return {
        message: addPenalty("The door is sealed. Maybe a charm can unlock doors?"),
        state: createNewState(),
      };
    }
    // Repeated hint - no penalty
    return {
      message: repeatHint("The door is sealed. Maybe a charm can unlock doors?"),
      state,
    };
  }

  // Dark corridor - needs light
  if (location === 'dark_corridor' && !state.challengeState.lumosActive) {
    if (hintRequests === 0) {
      return {
        message: addPenalty("You can't see anything. A wand-lighting charm would help."),
        state: createNewState(),
      };
    }
    // Repeated hint - no penalty
    return {
      message: repeatHint("You can't see anything. A wand-lighting charm would help."),
      state,
    };
  }

  // Shadow passage - needs to crawl or shrink
  if (location === 'shadow_passage' && !state.challengeState.passageCleared) {
    if (hintRequests === 0) {
      return {
        message: addPenalty("The space is too tight. Consider your options - magical or physical."),
        state: createNewState(),
      };
    }
    return {
      message: repeatHint("The space is too tight. Consider your options - magical or physical."),
      state,
    };
  }

  // Chasm room - levitation
  if (location === 'chasm_room' && !state.challengeState.levitationBridgeBuilt) {
    if (hintRequests === 0) {
      return {
        message: addPenalty("The blocks are heavy. A charm that lifts objects would help."),
        state: createNewState(),
      };
    }
    if (hintRequests === 1) {
      return {
        message: addPenalty("Remember Charms class with Professor Flitwick. The feather lesson."),
        state: createNewState(),
      };
    }
    return {
      message: repeatHint("Remember Charms class with Professor Flitwick. The feather lesson."),
      state,
    };
  }

  // Dementor chamber
  if (location === 'dementor_chamber' && !state.challengeState.dementorDefeated) {
    if (state.challengeState.dementorPhase === 'memory_needed') {
      return {
        message: addPenalty("The spell needs fuel. What gives a Patronus its power? Think of joy."),
        state: createNewState(),
      };
    }
    if (hintRequests === 0) {
      return {
        message: addPenalty("This dark creature feeds on happiness. A guardian of light can drive it away."),
        state: createNewState(),
      };
    }
    if (hintRequests === 1) {
      return {
        message: addPenalty("Harry Potter used this against dementors. It requires a powerful happy memory."),
        state: createNewState(),
      };
    }
    return {
      message: repeatHint("Harry Potter used this against dementors. It requires a powerful happy memory."),
      state,
    };
  }

  // Inferi lake
  if (location === 'inferi_lake' && !state.challengeState.inferiCleared) {
    if (hintRequests === 0) {
      return {
        message: addPenalty("The undead fear something ancient and primal. Think of warmth and light..."),
        state: createNewState(),
      };
    }
    if (hintRequests === 1) {
      return {
        message: addPenalty("These creatures are destroyed by fire. What fire spells do you know?"),
        state: createNewState(),
      };
    }
    return {
      message: repeatHint("These creatures are destroyed by fire. What fire spells do you know?"),
      state,
    };
  }

  // Hippogriff
  if (location === 'creature_enclosure' && !state.challengeState.hippogriffTrusts) {
    if (hintRequests === 0) {
      return {
        message: addPenalty("This creature values pride and respect above all. Show proper etiquette."),
        state: createNewState(),
      };
    }
    if (hintRequests === 1) {
      return {
        message: addPenalty("Remember Hagrid's Care of Magical Creatures lessons. How did he greet Buckbeak?"),
        state: createNewState(),
      };
    }
    return {
      message: repeatHint("Remember Hagrid's Care of Magical Creatures lessons. How did he greet Buckbeak?"),
      state,
    };
  }

  // Guard corridor
  if (location === 'guard_corridor' && !state.challengeState.stealthPassed) {
    if (hintRequests === 0) {
      return {
        message: addPenalty("Two against one isn't ideal. Perhaps stealth is wiser than combat."),
        state: createNewState(),
      };
    }
    if (hintRequests === 1) {
      return {
        message: addPenalty("You could confuse their minds with a spell, or hide yourself completely."),
        state: createNewState(),
      };
    }
    return {
      message: repeatHint("You could confuse their minds with a spell, or hide yourself completely."),
      state,
    };
  }

  // Death Eater duel
  if (location === 'death_eater_chamber' && !state.challengeState.deathEaterDefeated) {
    if (hintRequests === 0) {
      return {
        message: addPenalty("A proper duel requires both attack and defense. Trade spells wisely."),
        state: createNewState(),
      };
    }
    if (hintRequests === 1) {
      return {
        message: addPenalty("Use stunning or disarming spells to attack. Shield charms protect you."),
        state: createNewState(),
      };
    }
    return {
      message: repeatHint("Use stunning or disarming spells to attack. Shield charms protect you."),
      state,
    };
  }

  // Final chamber - Mirror of Erised
  if (location === 'final_chamber' && !state.challengeState.finalChallengeComplete) {
    if (hintRequests === 0) {
      return {
        message: addPenalty("Remember what Dumbledore said about this mirror. What would a wise wizard do?"),
        state: createNewState(),
      };
    }
    if (hintRequests === 1) {
      return {
        message: addPenalty("Those who seek power are tempted. Those who seek wisdom resist. Choose carefully."),
        state: createNewState(),
      };
    }
    return {
      message: repeatHint("Those who seek power are tempted. Those who seek wisdom resist. Choose carefully."),
      state,
    };
  }

  // Default hint
  if (hintRequests === 0) {
    return {
      message: addPenalty("Pay attention to descriptions and examine your surroundings. The answer lies within."),
      state: createNewState(),
    };
  }
  return {
    message: repeatHint("Pay attention to descriptions and examine your surroundings. The answer lies within."),
    state,
  };
}

// Calculate final grade
export function calculateGrade(state: GameState): { grade: string; title: string; description: string } {
  // Base score from challenges
  let totalScore = state.score;

  // Bonus for health remaining
  totalScore += Math.floor(state.health / 5);

  // Penalty for hints
  totalScore -= state.hintsUsed * 2;

  // Ensure minimum 0
  totalScore = Math.max(0, totalScore);

  // Calculate percentage (max possible around 100-120)
  const percentage = Math.min(100, Math.floor((totalScore / 100) * 100));

  if (percentage >= 95) {
    return {
      grade: 'O',
      title: 'Outstanding',
      description: 'Elite Auror material. Welcome to the Department.',
    };
  } else if (percentage >= 85) {
    return {
      grade: 'E',
      title: 'Exceeds Expectations',
      description: 'Excellent Auror candidate. You will serve the Ministry well.',
    };
  } else if (percentage >= 75) {
    return {
      grade: 'E',
      title: 'Exceeds Expectations',
      description: 'Strong Auror candidate. Report for duty.',
    };
  } else if (percentage >= 65) {
    return {
      grade: 'A',
      title: 'Acceptable',
      description: 'Qualified Auror. Additional training recommended.',
    };
  } else if (percentage >= 55) {
    return {
      grade: 'A',
      title: 'Acceptable',
      description: 'Probationary Auror. Close supervision required.',
    };
  } else if (percentage >= 45) {
    return {
      grade: 'P',
      title: 'Poor',
      description: 'You must retake the examination.',
    };
  } else if (percentage >= 30) {
    return {
      grade: 'D',
      title: 'Dreadful',
      description: 'Failed. You are not Auror material.',
    };
  } else {
    return {
      grade: 'T',
      title: 'Troll',
      description: 'Catastrophic failure. How did you even get here?',
    };
  }
}
