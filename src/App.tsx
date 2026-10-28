// App: two-column layout (terminal left, visual panel right) on desktop;
// terminal on top with toggleable Scene / Map / Status tabs on mobile.

import { useState } from 'react';
import { useGame } from './hooks/useGame';
import CombatPanel from './components/CombatPanel';
import EndScreen from './components/EndScreen';
import EventFeed from './components/EventFeed';
import MapView from './components/MapView';
import SceneView from './components/SceneView';
import StatusPanel from './components/StatusPanel';
import Terminal from './components/Terminal';

type MobileTab = 'scene' | 'map' | 'status';

const TAB_LABELS: { id: MobileTab; label: string }[] = [
  { id: 'scene', label: 'SCENE' },
  { id: 'map', label: 'MAP' },
  { id: 'status', label: 'STATUS' },
];

export default function App() {
  const { gameState, output, events, vfx, endScreen, isMobile, submit, dismissEndScreen } =
    useGame();
  const [tab, setTab] = useState<MobileTab>('scene');

  const terminal = (
    <Terminal
      gameState={gameState}
      output={output}
      isMobile={isMobile}
      onSubmit={submit}
    />
  );

  const endOverlay = endScreen && (
    <EndScreen state={gameState} kind={endScreen} onDismiss={dismissEndScreen} />
  );

  if (!isMobile) {
    // Desktop: classic terminal left, ~380px visual panel right.
    return (
      <div className="h-full w-full bg-black flex overflow-hidden font-mono">
        <main className="flex-1 min-w-0 flex flex-col">{terminal}</main>

        <aside className="w-[380px] shrink-0 border-l border-green-900 bg-gray-950 flex flex-col overflow-hidden">
          <div className="h-[300px] shrink-0 border-b border-green-900">
            <SceneView state={gameState} vfx={vfx} />
          </div>
          <div className="flex-1 min-h-[200px]">
            <MapView state={gameState} />
          </div>
          <CombatPanel state={gameState} />
          <StatusPanel state={gameState} />
          <div className="h-[210px] shrink-0 min-h-0 flex">
            <div className="w-full min-h-0">
              <EventFeed events={events} />
            </div>
          </div>
        </aside>

        {endOverlay}
      </div>
    );
  }

  // Mobile: terminal on top; panel collapses into toggleable tabs below.
  return (
    <div className="h-full w-full bg-black flex flex-col overflow-hidden font-mono">
      <div className="h-[52%] min-h-0 flex flex-col border-b border-green-900">{terminal}</div>

      <nav className="flex shrink-0 border-b border-green-900 bg-gray-900">
        {TAB_LABELS.map(({ id, label }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`flex-1 py-2 text-xs tracking-widest font-mono border-b-2 ${
              tab === id
                ? 'border-green-400 text-green-300 bg-green-900/30'
                : 'border-transparent text-gray-500'
            }`}
          >
            {label}
          </button>
        ))}
      </nav>

      <div className="flex-1 min-h-0 flex flex-col bg-gray-950">
        {tab === 'scene' && (
          <>
            <div className="flex-1 min-h-0">
              <SceneView state={gameState} vfx={vfx} />
            </div>
            <CombatPanel state={gameState} />
          </>
        )}
        {tab === 'map' && <MapView state={gameState} />}
        {tab === 'status' && (
          <div className="flex-1 min-h-0 flex flex-col overflow-y-auto thin-scroll">
            <StatusPanel state={gameState} />
            <div className="flex-1 min-h-[160px] flex flex-col">
              <EventFeed events={events} />
            </div>
          </div>
        )}
      </div>

      {endOverlay}
    </div>
  );
}
