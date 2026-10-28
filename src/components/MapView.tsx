// MapView: fog-of-war SVG node graph. A room renders only when it is in
// visitedLocations; an edge only when both endpoints are visited. No stubs,
// no "?" placeholders — nothing appears that hasn't been walked to.

import { GameState } from '../engine/types';
import {
  CHALLENGE_BY_ROOM,
  isRoomChallengeDone,
  MAP_EDGES,
  MAP_NODE_BY_ID,
  MAP_NODES,
  MAP_VIEWBOX,
  MapNode,
} from '../lib/mapLayout';

const NODE_R = 16;
const FONT_SIZE = 28;
const LABEL_DY = 34;

function NodeLabel({ node, isCurrent }: { node: MapNode; isCurrent: boolean }) {
  const fill = isCurrent ? '#fcd34d' : '#86efac';
  const pos =
    node.labelPos === 'right'
      ? { x: node.x + NODE_R + 10, y: node.y + 9, anchor: 'start' as const }
      : { x: node.x, y: node.y + LABEL_DY, anchor: 'middle' as const };

  return (
    <g opacity={isCurrent ? 1 : 0.82}>
      {/* halo copy under the text so labels stay readable over edges */}
      <text
        x={pos.x}
        y={pos.y}
        textAnchor={pos.anchor}
        fontSize={FONT_SIZE}
        fontFamily="ui-monospace, monospace"
        stroke="#000"
        strokeWidth={7}
        fill="none"
      >
        {node.label}
      </text>
      <text
        x={pos.x}
        y={pos.y}
        textAnchor={pos.anchor}
        fontSize={FONT_SIZE}
        fontFamily="ui-monospace, monospace"
        fill={fill}
      >
        {node.label}
      </text>
    </g>
  );
}

export default function MapView({ state }: { state: GameState }) {
  const visited = state.visitedLocations;
  const current = state.location;

  const visibleNodes = MAP_NODES.filter((n) => visited.has(n.id));
  const visibleEdges = MAP_EDGES.filter((e) => visited.has(e.from) && visited.has(e.to));
  const nodeVisible = (id: string) => visited.has(id);

  return (
    <div className="h-full w-full flex flex-col min-h-0">
      <div className="px-3 pt-2 pb-1 font-mono text-[10px] tracking-widest text-green-500/80 shrink-0">
        EXPLORATION MAP
        <span className="text-gray-600"> - rooms appear as you visit them</span>
      </div>
      <div className="flex-1 min-h-0 px-2 pb-2">
        <svg
          viewBox={`${MAP_VIEWBOX.x} ${MAP_VIEWBOX.y} ${MAP_VIEWBOX.w} ${MAP_VIEWBOX.h}`}
          preserveAspectRatio="xMidYMid meet"
          className="w-full h-full"
        >
          {/* Edges — only between two visited rooms */}
          {visibleEdges.map((e) => {
            const a = MAP_NODE_BY_ID[e.from];
            const b = MAP_NODE_BY_ID[e.to];
            if (!a || !b) return null;
            return (
              <line
                key={`${e.from}|${e.to}`}
                x1={a.x}
                y1={a.y}
                x2={b.x}
                y2={b.y}
                stroke="#2e7d4f"
                strokeWidth={4}
                strokeLinecap="round"
                opacity={0.8}
                className="map-edge-in"
              />
            );
          })}

          {/* Nodes — only visited rooms */}
          {visibleNodes.map((n) => {
            const isCurrent = n.id === current;
            const isChallengeRoom = Boolean(CHALLENGE_BY_ROOM[n.id]);
            const done = isRoomChallengeDone(state, n.id);
            const stroke = isCurrent ? '#7ef29a' : done ? '#4ade80' : isChallengeRoom ? '#c8952a' : '#2e7d4f';
            return (
              <g key={n.id} className="map-node-in">
                {isCurrent && (
                  <circle
                    cx={n.x}
                    cy={n.y}
                    r={NODE_R + 9}
                    fill="none"
                    stroke="#7ef29a"
                    strokeWidth={4}
                    className="map-current-ring"
                  />
                )}
                <circle
                  cx={n.x}
                  cy={n.y}
                  r={NODE_R}
                  fill="#0d2417"
                  stroke={stroke}
                  strokeWidth={4}
                />
                {done && (
                  <circle cx={n.x + 11} cy={n.y - 11} r={6} fill="#fbbf24" stroke="#000" strokeWidth={2} />
                )}
                {nodeVisible(n.id) && <NodeLabel node={n} isCurrent={isCurrent} />}
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}
