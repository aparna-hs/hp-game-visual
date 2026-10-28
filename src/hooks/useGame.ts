// Game state ownership + command submission. The phase flow (intro/naming/
// ready/playing/victory/death), output text, and restart behavior are ported
// from hp-game's Terminal component; the vendored engine stays untouched.
// Every state transition is diffed (lib/diff.ts) to drive the visual panel.

import { useCallback, useEffect, useRef, useState } from 'react';
import { GameState } from '../engine/types';
import { calculateGrade, createInitialState, processCommand } from '../engine/engine';
import { getLocationDescription, parseCommand } from '../engine/parser';
import { getSpellCategory } from '../engine/spells';
import { diffStates, GameEvent, RawEvent, RawVfx, VfxEvent } from '../lib/diff';

export interface OutputLine {
  text: string;
  color?: 'normal' | 'damage' | 'healing' | 'magic' | 'gold' | 'warning';
  type?: 'system' | 'player' | 'game';
}

export type EndScreen = 'victory' | 'death' | null;

const ASCII_TITLE = `
 █████╗ ██╗   ██╗██████╗  ██████╗ ██████╗      ███████╗██╗  ██╗ █████╗ ███╗   ███╗
██╔══██╗██╗   ██╗██╔══██╗██╔═══██╗██╔══██╗     ██╔════╝╚██╗██╔╝██╔══██╗████╗ ████║
███████║██║   ██╗██████╔╝██║   ██║██████╔╝     █████╗   ╚███╔╝ ███████║██╔████╔██║
██╔══██║██║   ██╗██╔══██╗██║   ██║██╔══██╗     ██╔══╝   ██╔╝██╗ ██╔══██║██║╚██╔╝██║
██║  ██║╚██████╔╝██║  ██║╚██████╔╝██║  ██║     ███████╗██╔╝ ██╗██║  ██║██║ ╚═╝ ██║
╚═╝  ╚═╝ ╚═════╝ ╚═╝  ╚═╝ ╚═════╝ ╚═╝  ╚═╝     ╚══════╝╚═╝  ╚═╝╚═╝  ╚═╝╚═╝     ╚═╝
`;

const ASCII_TITLE_MOBILE = `
 ▄▀█ █ █ █▀█ █▀█ █▀█   █▀▀ ▀▄▀ ▄▀█ █▀▄▀█
 █▀█ █▄█ █▀▄ █▄█ █▀▄   ██▄ █░█ █▀█ █░▀░█
`;

const WAND_ART = `
              ══════════════ ✦ ★ ⚡
`;

const MINISTRY_HEADER = `
═══════════════════════════════════════════════════════════════════
              MINISTRY OF MAGIC - AUROR OFFICE
                   FINAL EXAMINATION
═══════════════════════════════════════════════════════════════════

Congratulations on completing your Auror training program.
You have passed the written exams, physical conditioning, and
dueling qualifications.

This is your FINAL test - the practical examination.

Real magical threats. Real danger.
Some candidates don't return.

`;

const MAX_EVENTS = 30;
const VFX_TTL_MS = 1600;

function initialOutput(isMobile: boolean): OutputLine[] {
  const title = isMobile ? ASCII_TITLE_MOBILE : ASCII_TITLE;
  return [
    { text: title, color: 'magic', type: 'system' },
    { text: WAND_ART, color: 'gold', type: 'system' },
    { text: MINISTRY_HEADER, color: 'normal', type: 'system' },
    { text: 'What is your name, candidate?', color: 'gold', type: 'system' },
  ];
}

export function useGame() {
  const [isMobile, setIsMobile] = useState(
    () => typeof window !== 'undefined' && window.innerWidth < 768
  );
  const [gameState, setGameState] = useState<GameState>(() => ({
    ...createInitialState(),
    gamePhase: 'naming',
  }));
  const [output, setOutput] = useState<OutputLine[]>(() => initialOutput(isMobile));
  const [events, setEvents] = useState<GameEvent[]>([]);
  const [vfx, setVfx] = useState<VfxEvent[]>([]);
  const [endScreen, setEndScreen] = useState<EndScreen>(null);

  const idRef = useRef(1);
  const turnRef = useRef(0);
  const timersRef = useRef<number[]>([]);

  // Track mobile viewport (shared by Terminal and the panel layout).
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Clear pending VFX prune timers on unmount.
  useEffect(() => {
    const timers = timersRef.current;
    return () => {
      for (const t of timers) window.clearTimeout(t);
      timers.length = 0;
    };
  }, []);

  const addOutput = useCallback((lines: OutputLine[]) => {
    setOutput((prev) => [...prev, ...lines]);
  }, []);

  const pushEvents = useCallback((raw: RawEvent[]) => {
    if (raw.length === 0) return;
    const turn = turnRef.current;
    const stamped: GameEvent[] = raw.map((e) => ({ ...e, id: idRef.current++, turn }));
    setEvents((prev) => [...stamped, ...prev].slice(0, MAX_EVENTS));
  }, []);

  const pushVfx = useCallback((raw: RawVfx[]) => {
    if (raw.length === 0) return;
    const stamped: VfxEvent[] = raw.map((v) => ({ ...v, id: idRef.current++ }));
    setVfx((prev) => [...prev, ...stamped]);
    const ids = new Set(stamped.map((v) => v.id));
    const timer = window.setTimeout(() => {
      setVfx((prev) => prev.filter((v) => !ids.has(v.id)));
    }, VFX_TTL_MS);
    timersRef.current.push(timer);
  }, []);

  const doRestart = useCallback(
    (mobile: boolean) => {
      setGameState({ ...createInitialState(), gamePhase: 'naming' });
      setOutput(initialOutput(mobile));
      setEvents([]);
      setVfx([]);
      setEndScreen(null);
      turnRef.current = 0;
    },
    []
  );

  const submit = useCallback(
    (input: string) => {
      const trimmedInput = input.trim();
      if (!trimmedInput) return;

      turnRef.current += 1;

      // Echo player input
      addOutput([{ text: `> ${trimmedInput}`, type: 'player' }]);

      // Handle naming phase
      if (gameState.gamePhase === 'naming') {
        const name = trimmedInput;
        const newState = { ...gameState, playerName: name, gamePhase: 'ready' as const };
        setGameState(newState);

        addOutput([
          { text: '', type: 'game' },
          { text: `Welcome, ${name}.`, color: 'gold', type: 'system' },
          { text: '', type: 'game' },
          {
            text: `You are about to enter the Ministry's underground examination maze.
Your goal: Navigate through dangerous challenges and reach the final chamber.

This will test everything you have learned. Your wand is ready.
Your knowledge will be tested. Not all candidates survive.`,
            type: 'game',
          },
          { text: '', type: 'game' },
          { text: 'Type START when you are ready to begin.', color: 'magic', type: 'system' },
        ]);
        return;
      }

      // Handle ready phase - waiting for START command
      if (gameState.gamePhase === 'ready') {
        if (trimmedInput.toLowerCase() === 'start') {
          const newState = { ...gameState, gamePhase: 'playing' as const };
          setGameState(newState);

          addOutput([
            { text: '', type: 'game' },
              { text: '═══════════════════════════════════════════════════════════════════', type: 'system' },
              { text: '                         COMMANDS', color: 'gold', type: 'system' },
              { text: '═══════════════════════════════════════════════════════════════════', type: 'system' },
              { text: '', type: 'game' },
              {
                text: `Cast spells by typing the incantation (e.g., LUMOS)
Move: NORTH, SOUTH, EAST, WEST (or N, S, E, W)
Interact: EXAMINE, TAKE, USE, READ
Info: INVENTORY (or I), LOOK, JOURNEY, HELP

Type HINT if stuck (WARNING: hints reduce your score by 2 points)`,
                type: 'game',
              },
              { text: '', type: 'game' },
              { text: '═══════════════════════════════════════════════════════════════════', type: 'system' },
              { text: '                    YOUR EXAMINATION BEGINS', color: 'gold', type: 'system' },
              { text: '═══════════════════════════════════════════════════════════════════', type: 'system' },
              { text: '', type: 'game' },
              { text: getLocationDescription(newState), type: 'game' },
              { text: '', type: 'game' },
              { text: 'Type JOURNEY anytime to see where you\'ve been.', color: 'magic', type: 'system' },
              {
                text: 'Type HELP for commands or HINT if stuck (WARNING: hints reduce your score by 2 points).',
                color: 'magic',
                type: 'system',
              },
              { text: '', type: 'game' },
              { text: `Good luck, ${newState.playerName}.`, color: 'gold', type: 'system' },
          ]);
        } else {
          addOutput([
            { text: '', type: 'game' },
            { text: 'Type START to begin your examination.', color: 'warning', type: 'system' },
          ]);
        }
        return;
      }

      // Handle restart (available during playing / victory / death)
      if (
        trimmedInput.toLowerCase() === 'restart confirm' ||
        trimmedInput.toLowerCase() === 'restart'
      ) {
        doRestart(isMobile);
        return;
      }

      // Handle death state
      if (gameState.gamePhase === 'death') {
        addOutput([
          { text: '', type: 'game' },
          { text: 'The examination has ended. Type RESTART to try again.', type: 'system' },
        ]);
        return;
      }

      if (gameState.gamePhase === 'victory') {
        // Show final score, then lock the terminal (same as hp-game)
        const grade = calculateGrade(gameState);
        addOutput([
          { text: '', type: 'game' },
          { text: '═══════════════════════════════════════════════════════════════════', color: 'gold', type: 'system' },
          { text: '                    EXAMINATION RESULTS', color: 'gold', type: 'system' },
          { text: '═══════════════════════════════════════════════════════════════════', color: 'gold', type: 'system' },
          { text: '', type: 'game' },
          { text: `  Candidate: ${gameState.playerName}`, type: 'game' },
          { text: `  Final Score: ${gameState.score} points`, type: 'game' },
          { text: `  Health Remaining: ${gameState.health}/${gameState.maxHealth}`, type: 'game' },
          { text: `  Hints Used: ${gameState.hintsUsed}`, type: 'game' },
          { text: `  Challenges Completed: ${gameState.challengesCompleted.size}/9`, type: 'game' },
          { text: '', type: 'game' },
          { text: `  GRADE: ${grade.grade} - ${grade.title}`, color: 'gold', type: 'game' },
          { text: `  ${grade.description}`, type: 'game' },
          { text: '', type: 'game' },
          { text: '═══════════════════════════════════════════════════════════════════', color: 'gold', type: 'system' },
          { text: '', type: 'game' },
          { text: 'Congratulations on completing the Auror Examination!', color: 'magic', type: 'system' },
          { text: 'Type RESTART to play again.', type: 'system' },
        ]);
        setGameState((prev) => ({ ...prev, gamePhase: 'death' })); // Prevent further commands
        return;
      }

      // Playing: hand the command to the vendored engine
      const prev = gameState;
      const result = processCommand(prev, trimmedInput);
      setGameState(result.state);

      addOutput([
        { text: '', type: 'game' },
        { text: result.message, color: result.color, type: 'game' },
      ]);

      // Spell-cast VFX: classify the input with the engine's own parser
      const parsed = parseCommand(trimmedInput);
      if (parsed.type === 'spell' && parsed.verb !== 'unknown_spell') {
        const category = getSpellCategory(parsed.verb);
        if (category) {
          pushVfx([{ type: 'spell', category }]);
        }
      }

      // Diff-driven events + VFX (location, health, challenges, flags, combat)
      const { events: rawEvents, vfx: rawVfx } = diffStates(prev, result.state);
      pushEvents(rawEvents);
      pushVfx(rawVfx);

      // Check for death
      if (result.state.gamePhase === 'death') {
        const grade = calculateGrade(result.state);
        addOutput([
          { text: '', type: 'game' },
          { text: '═══════════════════════════════════════════════════════════════════', color: 'damage', type: 'system' },
          { text: '                    EXAMINATION FAILED', color: 'damage', type: 'system' },
          { text: '═══════════════════════════════════════════════════════════════════', color: 'damage', type: 'system' },
          { text: '', type: 'game' },
          { text: `  Candidate: ${result.state.playerName}`, type: 'game' },
          { text: `  Final Score: ${result.state.score} points`, type: 'game' },
          { text: `  GRADE: ${grade.grade} - ${grade.title}`, color: 'damage', type: 'game' },
          { text: '', type: 'game' },
          { text: 'Type RESTART to try again.', type: 'system' },
        ]);
        setEndScreen('death');
      }

      // Check for victory
      if (result.state.gamePhase === 'victory') {
        const grade = calculateGrade(result.state);
        addOutput([
          { text: '', type: 'game' },
          { text: '═══════════════════════════════════════════════════════════════════', color: 'gold', type: 'system' },
          { text: '                    EXAMINATION COMPLETE', color: 'gold', type: 'system' },
          { text: '═══════════════════════════════════════════════════════════════════', color: 'gold', type: 'system' },
          { text: '', type: 'game' },
          { text: `  Candidate: ${result.state.playerName}`, type: 'game' },
          { text: `  Final Score: ${result.state.score} points`, type: 'game' },
          { text: `  Health Remaining: ${result.state.health}/${result.state.maxHealth}`, type: 'game' },
          { text: `  Hints Used: ${result.state.hintsUsed}`, type: 'game' },
          { text: `  Challenges Completed: ${result.state.challengesCompleted.size}/9`, type: 'game' },
          { text: '', type: 'game' },
          { text: `  GRADE: ${grade.grade} - ${grade.title}`, color: 'gold', type: 'game' },
          { text: `  ${grade.description}`, type: 'game' },
          { text: '', type: 'game' },
          { text: '═══════════════════════════════════════════════════════════════════', color: 'gold', type: 'system' },
          { text: '', type: 'game' },
          { text: 'Type RESTART to play again.', type: 'system' },
        ]);
        setEndScreen('victory');
      }
    },
    [gameState, isMobile, addOutput, pushEvents, pushVfx, doRestart]
  );

  const dismissEndScreen = useCallback(() => setEndScreen(null), []);

  return {
    gameState,
    output,
    events,
    vfx,
    endScreen,
    isMobile,
    submit,
    dismissEndScreen,
  };
}
