// EventFeed: derived entirely from GameState diffs. Newest first, capped
// at ~30 events. RESTART clears the feed along with the rest.

import { GameEvent } from '../lib/diff';

const TONE_CLASSES: Record<string, string> = {
  info: 'text-gray-400',
  good: 'text-green-400',
  bad: 'text-red-400',
  gold: 'text-yellow-400',
  magic: 'text-blue-400',
};

export default function EventFeed({ events }: { events: GameEvent[] }) {
  return (
    <div className="border-t border-green-900 flex flex-col min-h-0 h-full">
      <div className="px-3 pt-2 pb-1 font-mono text-[10px] tracking-widest text-green-500/80 shrink-0">
        EXAM LOG
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto thin-scroll px-3 pb-2 space-y-0.5 font-mono">
        {events.length === 0 && (
          <div className="text-gray-600 text-[11px]">No events yet. Begin your examination...</div>
        )}
        {events.map((e, i) => (
          <div
            key={e.id}
            className={`${i === 0 ? 'feed-in' : ''} ${TONE_CLASSES[e.tone]} text-[11px] flex gap-2`}
          >
            <span className="text-gray-700 shrink-0 w-6 text-right">{e.turn}</span>
            <span className="min-w-0 break-words">{e.text}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
