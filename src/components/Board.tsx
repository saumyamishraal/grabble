import React from 'react';
import type { Tile, Position } from '../game-engine';

interface BoardProps {
  board: (Tile | null)[][];
  selectedPositions: Position[];
  isPlacingTiles: boolean;
  onCellClick: (x: number, y: number) => void;
  onColumnClick: (column: number) => void;
}

const Board: React.FC<BoardProps> = ({ 
  board, 
  selectedPositions, 
  isPlacingTiles, 
  onCellClick, 
  onColumnClick 
}) => {
  const isSelected = (x: number, y: number) => {
    return selectedPositions.some(p => p.x === x && p.y === y);
  };

  const isDropZone = (x: number, y: number) => {
    return isPlacingTiles && y === 0;
  };

  const getPlayerColor = (playerId: number | undefined): string => {
    if (playerId === undefined) return '#999';
    const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A'];
    return colors[playerId] || '#999';
  };

  return (
    <div className="board-container">
      <div className="board">
        {board.map((row, y) =>
          row.map((cell, x) => {
            const tile = cell;
            const selected = isSelected(x, y);
            const dropZone = isDropZone(x, y);
            
            return (
              <div
                key={`${x}-${y}`}
                className={`cell ${selected ? 'highlighted' : ''} ${dropZone ? 'drop-zone' : ''}`}
                onClick={() => {
                  if (dropZone) {
                    onColumnClick(x);
                  } else {
                    onCellClick(x, y);
                  }
                }}
              >
                {tile && (
                  <div 
                    className="tile"
                    style={{ borderLeft: `4px solid ${getPlayerColor(tile.playerId)}` }}
                  >
                    <div className="letter">{tile.letter}</div>
                    <div className="points">{tile.points}</div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default Board;

