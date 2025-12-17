import React, { useState } from 'react';
import type { Tile, Position } from '../types';

interface BoardProps {
  board: (Tile | null)[][];
  selectedPositions: Position[];
  isPlacingTiles: boolean;
  onCellClick: (x: number, y: number) => void;
  onColumnClick: (column: number) => void;
  onTileDrop?: (column: number, tileData: { index: number; tile: Tile }) => void;
}

const Board: React.FC<BoardProps> = ({ 
  board, 
  selectedPositions, 
  isPlacingTiles, 
  onCellClick, 
  onColumnClick,
  onTileDrop
}) => {
  const [dragOverColumn, setDragOverColumn] = useState<number | null>(null);

  const isSelected = (x: number, y: number) => {
    return selectedPositions.some(p => p.x === x && p.y === y);
  };

  const isDropZone = (x: number, y: number) => {
    return y === 0; // Top row is always a drop zone
  };

  const handleDragOver = (e: React.DragEvent, column: number) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'move';
    setDragOverColumn(column);
  };

  const handleDragEnter = (e: React.DragEvent, column: number) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverColumn(column);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    // Only clear if we're actually leaving the drop zone
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const x = e.clientX;
    const y = e.clientY;
    if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) {
      setDragOverColumn(null);
    }
  };

  const handleDrop = (e: React.DragEvent, column: number) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverColumn(null);
    try {
      const data = e.dataTransfer.getData('text/plain');
      console.log('Drop data:', data); // Debug log
      if (data) {
        const parsed = JSON.parse(data);
        console.log('Parsed data:', parsed); // Debug log
        if (onTileDrop && parsed.tile && typeof parsed.index === 'number') {
          console.log('Calling onTileDrop with:', { column, parsed });
          onTileDrop(column, parsed);
        } else {
          console.warn('Invalid drop data format:', parsed);
        }
      } else {
        console.warn('No data in drop event');
      }
    } catch (error) {
      console.error('Error handling drop:', error);
    }
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
                className={`cell ${selected ? 'highlighted' : ''} ${dropZone ? 'drop-zone' : ''} ${dropZone && dragOverColumn === x ? 'drag-over' : ''}`}
                onClick={() => {
                  if (dropZone) {
                    onColumnClick(x);
                  } else {
                    onCellClick(x, y);
                  }
                }}
                onDragEnter={dropZone ? (e) => handleDragEnter(e, x) : undefined}
                onDragOver={dropZone ? (e) => handleDragOver(e, x) : undefined}
                onDragLeave={dropZone ? (e) => handleDragLeave(e) : undefined}
                onDrop={dropZone ? (e) => handleDrop(e, x) : undefined}
                title={dropZone ? `Drop tile here (column ${x + 1})` : tile ? `${tile.letter} (${tile.points} pts)` : `Cell (${x + 1}, ${y + 1})`}
              >
                {tile ? (
                  <div 
                    className="tile"
                    style={{ borderLeft: `4px solid ${getPlayerColor(tile.playerId)}` }}
                  >
                    <div className="letter">{tile.letter}</div>
                    <div className="points">{tile.points}</div>
                  </div>
                ) : dropZone ? (
                  <div className="drop-indicator">↓</div>
                ) : null}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default Board;

