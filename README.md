# Auror Examination — Visual Edition

A visual sibling of [hp-game](https://github.com/aparna-hs/harry-potter-text-adventure) — the
Harry Potter Auror exam text adventure for people who read the books, appreciate Zork, and
prefer typing to clicking.

The text terminal is still the primary interface. A side panel adds:

- **Pixel-art scenes** for every location, with crossfades and state overlays
  (a warm wand-glow in dark rooms while Lumos is lit, embers on the lake after the Inferi
  burn, a lit doorway once the iron door opens, a cold desaturation while the Dementor
  is engaged).
- **Fog-of-war map** — rooms appear only after you have actually walked to them.
  No `?` stubs, no hints, nothing spoiler-y. Edges appear only once both endpoints
  have been visited.
- **Spell VFX** — casting a spell flashes over the scene with a color matching the
  spell's category (light = white, offense = red, defense = blue, healing = green,
  utility = gold), plus damage pulses, healing shimmers and gold bursts when a
  challenge completes.
- **Status dashboard** — animated HP bar, score with delta pops, inventory, and the
  nine challenge badges.
- **Combat panel** — the Death Eater's vitality and duel round, plus threat
  indicators for the Dementor and Inferi.
- **Event feed** — "Entered: The Dark Corridor", "Challenge complete: Dementor (+10)",
  "Wand lit (Lumos)", derived entirely from state diffs.

The game itself is untouched: same difficulty, same hints (still -2 points), same exact
parser, no autocomplete. The visuals are a lens on the same examination.

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

**Desktop:** terminal on the left; a ~380px visual panel on the right
(scene → fog-of-war map → combat panel → status → event feed).

**Mobile (<768px):** terminal on top; the panel collapses into Scene / Map / Status
tabs below.

## Scenes

`public/scenes/` holds generated 16-bit pixel art (21 location scenes plus title,
Dementor encounter, duel, Mirror of Erised, victory and death moments). A unifying
CSS treatment (scanlines + vignette + slight palette filter) keeps the art cohesive.
State variants are code overlays, not extra images. If an image ever fails to load,
a procedural SVG tint renders in its place instead of broken art.

## Project structure

```
src/
├── App.tsx             # two-column layout + mobile tabs + phase screens
├── engine/             # vendored from hp-game/src/game/ (unchanged)
├── hooks/useGame.ts    # game state + command submission + phase flow
├── lib/diff.ts         # GameState diffing → events + VFX triggers
├── lib/mapLayout.ts    # hand-authored coordinates for all 21 rooms
├── lib/sceneIndex.ts   # location → scene image + state variants
└── components/
    ├── Terminal.tsx    # ported from hp-game (phases, history, colors)
    ├── SceneView.tsx   # location art, crossfade, overlays, VFX
    ├── MapView.tsx     # SVG fog-of-war node graph
    ├── StatusPanel.tsx # HP, score, inventory, 9 challenge badges
    ├── EventFeed.tsx   # derived from diffs
    ├── CombatPanel.tsx # enemy HP during the duel; threat indicators
    └── EndScreen.tsx   # victory/death art + grade report card
```

## Upstream

Game design, engine and terminal UX come from the original project — see hp-game's
`README.md`, `WALKTHROUGH.md` and `CHANGELOG_SESSION.md`. This repo only adds the
visual layer.
