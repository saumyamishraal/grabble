import React from 'react';
import type { Tile } from '../game-engine';

interface RackProps {
  tiles: Tile[];
  selectedIndices: number[];
  onTileClick: (index: number) => void;
}

const Rack: React.FC<RackProps> = ({ tiles, selectedIndices, onTileClick }) => {
  return (
    <div className="rack-container">
      <div className="rack-label">Your Tiles</div>
      <div className="rack">
        {tiles.map((tile, index) => (
          <div
            key={index}
            className={`rack-tile ${selectedIndices.includes(index) ? 'selected' : ''}`}
            onClick={() => onTileClick(index)}
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

