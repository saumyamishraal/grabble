import React from 'react';
import type { Tile } from '../types';
import { getPlayerColor } from '../utils/playerColors';

interface RackProps {
  tiles: Tile[];
  selectedIndices: number[];
  onTileClick: (index: number) => void;
  onTileDragStart?: (index: number, tile: Tile) => void;
  playerId?: number;
}

const Rack: React.FC<RackProps> = ({ tiles, selectedIndices, onTileClick, onTileDragStart, playerId = 0 }) => {
  const playerColor = getPlayerColor(playerId);
  
  const handleDragStart = (e: React.DragEvent, index: number, tile: Tile) => {
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

  return (
    <div className="rack-container">
      <div className="rack-label">Your Tiles (Drag anywhere on board)</div>
      <div className="rack">
        {tiles.map((tile, index) => (
          <div
            key={index}
            className={`rack-tile ${selectedIndices.includes(index) ? 'selected' : ''}`}
            onClick={() => onTileClick(index)}
            draggable={true}
            onDragStart={(e) => handleDragStart(e, index, tile)}
            style={{
              backgroundColor: playerColor,
              color: 'white',
            }}
          >
            <div className="letter">{tile.letter}</div>
            <div className="points">{tile.points}</div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Rack;

