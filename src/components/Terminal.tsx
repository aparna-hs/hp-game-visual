// Terminal: ported from hp-game's Terminal.tsx. Same phases, output colors,
// command history (arrow keys), health bar and restart flow — but game state
// lives in useGame so the visual panel shares it.

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { GameState } from '../engine/types';
import { OutputLine } from '../hooks/useGame';

interface TerminalProps {
  gameState: GameState;
  output: OutputLine[];
  isMobile: boolean;
  onSubmit: (input: string) => void;
}

export default function Terminal({ gameState, output, isMobile, onSubmit }: TerminalProps) {
  const [inputValue, setInputValue] = useState('');
  const [commandHistory, setCommandHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const outputRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll to bottom
  useEffect(() => {
    if (outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }
  }, [output]);

  // Focus input on click (desktop only; on mobile the keyboard would
  // pop over the visual panel on every tap)
  useEffect(() => {
    if (isMobile) return;
    const handleClick = () => inputRef.current?.focus();
    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, [isMobile]);

  const handleCommand = useCallback(
    (input: string) => {
      const trimmedInput = input.trim();
      if (!trimmedInput) return;

      // Add to history
      setCommandHistory((prev) => [...prev, trimmedInput]);
      setHistoryIndex(-1);
      onSubmit(trimmedInput);
      setInputValue('');
    },
    [onSubmit]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        handleCommand(inputValue);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (commandHistory.length > 0) {
          const newIndex = historyIndex < commandHistory.length - 1 ? historyIndex + 1 : historyIndex;
          setHistoryIndex(newIndex);
          setInputValue(commandHistory[commandHistory.length - 1 - newIndex] || '');
        }
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (historyIndex > 0) {
          const newIndex = historyIndex - 1;
          setHistoryIndex(newIndex);
          setInputValue(commandHistory[commandHistory.length - 1 - newIndex] || '');
        } else if (historyIndex === 0) {
          setHistoryIndex(-1);
          setInputValue('');
        }
      }
    },
    [handleCommand, inputValue, commandHistory, historyIndex]
  );

  const getColorClass = (line: OutputLine) => {
    // Player input gets a distinct color
    if (line.type === 'player') {
      return 'text-cyan-300';
    }

    // Handle explicit colors
    switch (line.color) {
      case 'damage':
        return 'text-red-500';
      case 'healing':
        return 'text-green-400';
      case 'magic':
        return 'text-blue-400';
      case 'gold':
        return 'text-yellow-400';
      case 'warning':
        return 'text-orange-400';
      default:
        return 'text-gray-300';
    }
  };

  // Health bar component
  const renderHealthBar = () => {
    if (gameState.gamePhase !== 'playing') return null;

    const healthPercent = (gameState.health / gameState.maxHealth) * 100;
    const filledBlocks = Math.round(healthPercent / 10);
    const emptyBlocks = 10 - filledBlocks;

    let barColor = 'bg-green-500';
    if (healthPercent <= 25) barColor = 'bg-red-500';
    else if (healthPercent <= 50) barColor = 'bg-yellow-500';

    // Get current location name
    const currentLocation = gameState.location;
    const locationName = currentLocation
      .split('_')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');

    // Build inventory display
    const inventoryCount = gameState.inventory.length;
    const inventoryDisplay =
      inventoryCount === 0
        ? 'None'
        : inventoryCount <= 2
          ? gameState.inventory
              .map((item) => {
                // Short names for status bar
                if (item === 'dittany') return 'Dittany';
                if (item === 'wiggenweld_potion') return 'Potion';
                if (item === 'healing_herbs') return 'Herbs';
                if (item === 'invisibility_cloak') return 'Cloak';
                return item;
              })
              .join(', ')
          : `${inventoryCount} items`;

    return (
      <div className="px-2 sm:px-4 py-2 border-b border-green-900 text-xs sm:text-sm">
        <div className="flex items-center gap-1 sm:gap-2 flex-wrap">
          <span className="text-blue-400">{locationName}</span>
          <span className="text-gray-500 hidden sm:inline">|</span>
        </div>
        <div className="flex items-center gap-1 sm:gap-2 flex-wrap mt-1">
          <span className="text-green-400">HP:</span>
          <div className="flex">
            {[...Array(filledBlocks)].map((_, i) => (
              <div key={`filled-${i}`} className={`w-2 sm:w-3 h-3 sm:h-4 ${barColor} mr-0.5`} />
            ))}
            {[...Array(emptyBlocks)].map((_, i) => (
              <div key={`empty-${i}`} className="w-2 sm:w-3 h-3 sm:h-4 bg-gray-700 mr-0.5" />
            ))}
          </div>
          <span className="text-green-400">
            {gameState.health}/{gameState.maxHealth}
          </span>
          <span className="text-gray-500 mx-1">|</span>
          <span className="text-yellow-400">Score: {gameState.score}</span>
          <span className="text-gray-500 mx-1">|</span>
          <span className="text-purple-400">Items: {inventoryDisplay}</span>
        </div>
      </div>
    );
  };

  return (
    <div className="h-full bg-black flex flex-col overflow-hidden">
      {/* Header */}
      <div className="border-b border-green-900 px-2 sm:px-4 py-1 sm:py-2 bg-gray-900 shrink-0">
        <div className="text-green-400 font-mono text-xs sm:text-sm">
          {isMobile
            ? 'AUROR EXAM v1.0'
            : 'MINISTRY OF MAGIC - AUROR EXAMINATION TERMINAL v1.0'}
        </div>
      </div>

      {/* Health Bar */}
      {renderHealthBar()}

      {/* Output Area */}
      <div
        ref={outputRef}
        className="flex-1 min-h-0 overflow-y-auto thin-scroll px-2 sm:px-4 py-2 sm:py-4 font-mono text-xs sm:text-sm leading-relaxed overflow-x-auto"
      >
        {output.map((line, index) => (
          <div key={index} className={`${getColorClass(line)} whitespace-pre-wrap break-words`}>
            {line.text}
          </div>
        ))}
      </div>

      {/* Input Area */}
      <div
        className={`px-2 sm:px-4 py-3 sm:py-4 bg-gray-900 shrink-0 ${
          isMobile ? 'border-t-2 border-green-500' : 'border-t border-green-900'
        }`}
      >
        <div className="flex items-center gap-2">
          <span className={`text-green-400 mr-1 text-sm ${isMobile ? 'font-bold' : ''}`}>&gt;</span>
          <input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            className={`flex-1 text-green-400 outline-none font-mono text-sm ${
              isMobile
                ? 'bg-gray-800 px-2 py-2 rounded border border-green-700 focus:border-green-500'
                : 'bg-transparent'
            }`}
            placeholder={isMobile ? 'Type command...' : ''}
            autoFocus
            autoComplete="off"
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
          />
          {isMobile ? (
            <button
              onClick={() => {
                handleCommand(inputValue);
              }}
              className="bg-green-700 hover:bg-green-600 text-white px-3 py-2 rounded font-mono text-sm font-bold border border-green-500 active:bg-green-800 min-w-[60px]"
            >
              ⏎
            </button>
          ) : (
            <span className="text-green-400 cursor-blink text-sm">_</span>
          )}
        </div>
      </div>
    </div>
  );
}
