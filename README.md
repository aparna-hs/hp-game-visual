# Auror Examination — Visual Edition

A visual sibling of [hp-game](https://github.com/aparna-hs/harry-potter-text-adventure) — the
Harry Potter Auror exam text adventure for people who read the books, appreciate Zork, and
prefer typing to clicking.

The text terminal is still the primary interface. Around it:

- **Immersive full-screen moments** — entering a room reveals its pixel art
  across the whole screen with the room's name. Moments hold until you
  acknowledge them (Esc or a click/tap — with an "ESC TO CONTINUE" hint,
  "TAP TO CONTINUE" on touch screens, and a 10s safety fallback), so you
  can actually take the art in; every other key passes through, so typing
  the next command never cuts a moment short.
  Spell casts flash full-screen in the spell's color (light = white,
  offense = red, defense = blue, healing = green, utility = gold) with a
  particle burst over the art; these brief flashes never block play, and
  during the duel the chamber art shows once on entry while each cast
  renders just its burst. Damage pulses red, healing shimmers green,
  challenge completions burst gold, and a successful Accio summons the
  object flying into the foreground. World-changing actions get dedicated
  set-piece art: the iron door swinging open onto the darkness beyond, the
  bridge assembling itself, the Patronus charge. The Dementor encounter
  gets its own close-up moment, and the duel art shows an anonymous
  hooded candidate — the examinee is whoever you named, not any specific
  character.
- **Fog-of-war map** — the heart of the side panel. Rooms appear only after
  you have actually walked to them. No `?` stubs, no challenge list, no hints,
  nothing spoiler-y. Edges appear only once both endpoints have been visited.
- **Combat panel** — the Death Eater's vitality and duel round while you fight,
  plus threat indicators for the Dementor and Inferi.
- **Event feed** — "Entered: The Dark Corridor", "Challenge complete: Dementor
  (+10)", "Wand lit (Lumos)", derived entirely from state diffs. Past events
  only; it never previews what lies ahead.

HP, score and inventory stay where they always were — in the terminal's status
bar. The game itself is untouched: same difficulty, same hints (still -2
points), same exact parser, no autocomplete.

## The engine is vendored, not rewritten

`src/engine/` is a verbatim snapshot of hp-game's `src/game/`:

```
src/engine/types.ts      # GameState & friends
src/engine/engine.ts     # processCommand, createInitialState, calculateGrade
src/engine/parser.ts     # command parsing & system commands
src/engine/spells.ts     # spell definitions & fuzzy matching
src/engine/locations.ts  # the 21-room world
```

The engine is pure TypeScript with zero React dependencies, so it drops in unchanged.
**If hp-game's engine evolves, re-copy the files here; do not edit them in place.**

The only contract the UI needs is:

```ts
processCommand(state, input) → { message, state, color }
```

The UI keeps the previous `GameState` and diffs it after every command — zero engine
changes needed. `lib/diff.ts` turns each transition into feed events and VFX triggers;
`lib/mapLayout.ts` holds hand-authored coordinates for the 21-room connection graph;
`lib/sceneIndex.ts` maps state to a scene image.

## Stack

- Vite + React 18 + TypeScript (client-only; no SSR)
- Tailwind CSS
- No other runtime dependencies

## Development

```bash
npm install
npm run dev      # start dev server
npm run build    # tsc + vite build (must pass with zero TS errors)
npm run preview  # serve the production build
```

## Deploying to Vercel

This is a static client-side app:

1. Push this repo to GitHub/GitLab.
2. In Vercel: **Add New Project → import the repo**. Vercel auto-detects Vite
   (build command `npm run build`, output directory `dist`). If it doesn't:
   - Framework preset: **Vite**
   - Build command: `npm run build`
   - Output directory: `dist`
3. Deploy. Done — no server, no environment variables.

Or from the CLI: `npx vercel --prod` from this directory.

## Layout

**Desktop:** terminal on the left; a ~380px panel on the right with the
fog-of-war map as its core, the combat panel (when a fight is active) and the
event log. Scene art is not a permanent box — it appears as full-screen
immersive moments driven by what you do.

**Mobile (<768px):** terminal on top; the map and event log are always visible
below (no tabs to dig through).

## Scenes

`public/scenes/` holds generated 16-bit pixel art (21 location scenes plus title,
Dementor encounter, duel, Mirror of Erised, victory, death, and the door /
bridge / Patronus set-piece moments). A unifying
CSS treatment (scanlines + vignette + slight palette filter) keeps the art cohesive.
State variants (Lumos glow in dark rooms, embers on the lake after the Inferi burn,
the open doorway, the Dementor's cold desaturation) are CSS overlays applied during
the immersive moments. If an image ever fails to load, a procedural SVG tint renders
in its place instead of broken art.

## Project structure

```
src/
├── App.tsx               # two-column layout + mobile stack
├── engine/               # vendored from hp-game/src/game/ (unchanged)
├── hooks/useGame.ts      # game state + command submission + phase flow
├── lib/diff.ts           # GameState diffing → events + VFX triggers
├── lib/mapLayout.ts      # hand-authored coordinates for all 21 rooms
├── lib/sceneIndex.ts     # location → scene image + state variants
└── components/
    ├── Terminal.tsx      # ported from hp-game (phases, history, colors)
    ├── ImmersiveLayer.tsx# full-screen moments: room reveals, spells, damage
    ├── MapView.tsx       # SVG fog-of-war node graph
    ├── EventFeed.tsx     # derived from diffs (past events only)
    ├── CombatPanel.tsx   # enemy HP during the duel; threat indicators
    └── EndScreen.tsx     # victory/death art + grade report card
```

## Upstream

Game design, engine and terminal UX come from the original project — see hp-game's
`README.md`, `WALKTHROUGH.md` and `CHANGELOG_SESSION.md`. This repo only adds the
visual layer.
