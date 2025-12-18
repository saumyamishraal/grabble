import React from 'react';
import type { Tile } from '../types';
import { getPlayerColor } from '../utils/playerColors';

interface RackProps {
  tiles: Tile[];
  selectedIndices: number[];
  onTileClick: (index: number) => void;
  onTileDragStart?: (index: number, tile: Tile) => void;
  playerId?: number;
  disabled?: boolean;  // When true, tiles cannot be dragged or selected
  hintedIndices?: number[];  // Indices of tiles highlighted by hint system (use these)
  swapHintedIndices?: number[];  // Indices of tiles suggested for swapping (swap these)
}

const Rack: React.FC<RackProps> = ({
  tiles,
  selectedIndices,
  onTileClick,
  onTileDragStart,
  playerId = 0,
  disabled = false,
  hintedIndices = [],
  swapHintedIndices = []
}) => {
  const playerColor = getPlayerColor(playerId);

  const handleDragStart = (e: React.DragEvent, index: number, tile: Tile) => {
    if (disabled) {
      e.preventDefault();
      return;
    }
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.dropEffect = 'move';
    // Set data in multiple formats for better compatibility
    const data = JSON.stringify({ index, tile });
    e.dataTransfer.setData('text/plain', data);
    e.dataTransfer.setData('application/json', data);
    if (onTileDragStart) {
      onTileDragStart(index, tile);
    }
  };

  const isHinted = (index: number) => hintedIndices.includes(index);
  const isSwapHinted = (index: number) => swapHintedIndices.includes(index);

  return (
    <div className="rack-container">
      <div className="rack-label">{disabled ? 'Waiting for your turn...' : 'Your Tiles (Tap to select, then tap board to place)'}</div>
      <div className="rack">
        {tiles.map((tile, index) => (
          <div
            key={index}
            className={`rack-tile ${selectedIndices.includes(index) ? 'selected' : ''} ${disabled ? 'disabled' : ''} ${isHinted(index) ? 'hinted' : ''} ${isSwapHinted(index) ? 'swap-hinted' : ''}`}
            onClick={() => !disabled && onTileClick(index)}
            draggable={!disabled}
            onDragStart={(e) => handleDragStart(e, index, tile)}
            style={{
              backgroundColor: playerColor,
              color: 'white',
              opacity: disabled ? 0.6 : 1,
              cursor: disabled ? 'not-allowed' : 'grab',
            }}
          >
            <div className="letter">{tile.letter === ' ' ? '?' : tile.letter}</div>
            <div className="points">{tile.points}</div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Rack;
