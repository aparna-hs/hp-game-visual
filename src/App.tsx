// App: terminal on the left, a map-centric panel on the right (desktop);
// terminal on top with map + event log below (mobile). Scene art lives in
// the full-screen ImmersiveLayer as cinematic moments, not a persistent box.

import { useGame } from './hooks/useGame';
import CombatPanel from './components/CombatPanel';
import EndScreen from './components/EndScreen';
import EventFeed from './components/EventFeed';
import ImmersiveLayer from './components/ImmersiveLayer';
import MapView from './components/MapView';
import Terminal from './components/Terminal';

export default function App() {
  const { gameState, output, events, vfx, endScreen, isMobile, submit, dismissEndScreen } =
    useGame();

  const terminal = (
    <Terminal gameState={gameState} output={output} isMobile={isMobile} onSubmit={submit} />
  );

  const immersive = <ImmersiveLayer state={gameState} vfx={vfx} />;
  const endOverlay = endScreen && (
    <EndScreen state={gameState} kind={endScreen} onDismiss={dismissEndScreen} />
  );

  if (!isMobile) {
    // Desktop: classic terminal left; fog-of-war map, combat and log right.
    return (
      <div className="h-full w-full bg-black flex overflow-hidden font-mono">
        <main className="flex-1 min-w-0 flex flex-col">{terminal}</main>

        <aside className="w-[380px] shrink-0 border-l border-green-900 bg-gray-950 flex flex-col overflow-hidden">
          <div className="flex-1 min-h-0">
            <MapView state={gameState} />
          </div>
          <CombatPanel state={gameState} />
          <div className="h-[220px] shrink-0 min-h-0 flex flex-col">
            <EventFeed events={events} />
          </div>
        </aside>

        {immersive}
        {endOverlay}
      </div>
    );
  }

  // Mobile: terminal on top; map and event log always visible below.
  return (
    <div className="h-full w-full bg-black flex flex-col overflow-hidden font-mono">
      <div className="h-[50%] min-h-0 flex flex-col border-b border-green-900">{terminal}</div>

      <div className="flex-1 min-h-0 flex flex-col bg-gray-950">
        <CombatPanel state={gameState} />
        <div className="flex-1 min-h-0">
          <MapView state={gameState} />
        </div>
        <div className="h-[130px] shrink-0 min-h-0 flex flex-col border-t border-green-900">
          <EventFeed events={events} />
        </div>
      </div>

      {immersive}
      {endOverlay}
    </div>
  );
}
