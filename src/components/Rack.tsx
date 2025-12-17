import React from 'react';
import type { Tile } from '../types';

interface RackProps {
  tiles: Tile[];
  selectedIndices: number[];
  onTileClick: (index: number) => void;
  onTileDragStart?: (index: number, tile: Tile) => void;
}

const Rack: React.FC<RackProps> = ({ tiles, selectedIndices, onTileClick, onTileDragStart }) => {
  const handleDragStart = (e: React.DragEvent, index: number, tile: Tile) => {
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.dropEffect = 'move';
    // Set data in multiple formats for better compatibility
    const data = JSON.stringify({ index, tile });
    e.dataTransfer.setData('text/plain', data);
    e.dataTransfer.setData('application/json', data);
    console.log('Drag start:', { index, tile, data }); // Debug log
    if (onTileDragStart) {
      onTileDragStart(index, tile);
    }
  };

  return (
    <div className="rack-container">
      <div className="rack-label">Your Tiles (Drag to top row of board)</div>
      <div className="rack">
        {tiles.map((tile, index) => (
          <div
            key={index}
            className={`rack-tile ${selectedIndices.includes(index) ? 'selected' : ''}`}
            onClick={() => onTileClick(index)}
            draggable={true}
            onDragStart={(e) => handleDragStart(e, index, tile)}
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

