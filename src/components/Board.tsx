import React, { useState, useEffect } from 'react';
import type { Tile, Position } from '../types';
import { getPlayerColor } from '../utils/playerColors';
import { isValidWordLine } from '../word-detection';

interface BoardProps {
  board: (Tile | null)[][];
  selectedPositions: Position[];
  isPlacingTiles: boolean;
  onColumnClick: (column: number) => void;
  onTileDrop?: (x: number, y: number, tileData: { index: number; tile: Tile }) => void;
  onTileRemove?: (x: number, y: number) => void;
  fallingTiles?: Set<string>;
  currentPlayerId?: number;
  onWordSelect?: (positions: Position[]) => void;
  tilesPlacedThisTurn?: Position[]; // Tiles placed in current turn (for showing remove button)
  onBlankTileEdit?: (x: number, y: number) => void; // Handler for editing blank tile letter
}

const Board: React.FC<BoardProps> = ({ 
  board, 
  selectedPositions, 
  isPlacingTiles, 
  onColumnClick,
  onTileDrop,
  onTileRemove,
  fallingTiles = new Set(),
  currentPlayerId,
  onWordSelect,
  tilesPlacedThisTurn = [],
  onBlankTileEdit
}) => {
  const [dragOverCell, setDragOverCell] = useState<Position | null>(null);
  const [draggedTilePos, setDraggedTilePos] = useState<Position | null>(null);
  const [draggedTileForRemoval, setDraggedTileForRemoval] = useState<Position | null>(null);
  const [isDraggingWord, setIsDraggingWord] = useState(false);
  const [dragStartPos, setDragStartPos] = useState<Position | null>(null);
  const [dragCurrentPos, setDragCurrentPos] = useState<Position | null>(null);

  // Add document-level drop handler to catch drops outside the board
  useEffect(() => {
    const handleDocumentDrop = (e: DragEvent) => {
      // Only handle if we're dragging a tile from the board
      if (draggedTileForRemoval && onTileRemove) {
        const boardContainer = document.querySelector('.board-container');
        if (boardContainer) {
          const rect = boardContainer.getBoundingClientRect();
          const xPos = e.clientX;
          const yPos = e.clientY;
          
          // If dropped outside the board container, remove the tile
          if (xPos < rect.left || xPos > rect.right || yPos < rect.top || yPos > rect.bottom) {
            console.log('Tile dropped outside board, removing:', draggedTileForRemoval);
            onTileRemove(draggedTileForRemoval.x, draggedTileForRemoval.y);
            setDraggedTileForRemoval(null);
          }
        }
      }
    };

    const handleDocumentDragOver = (e: DragEvent) => {
      // Allow drop outside board
      if (draggedTileForRemoval && e.dataTransfer) {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
      }
    };

    document.addEventListener('drop', handleDocumentDrop);
    document.addEventListener('dragover', handleDocumentDragOver);
    return () => {
      document.removeEventListener('drop', handleDocumentDrop);
      document.removeEventListener('dragover', handleDocumentDragOver);
    };
  }, [draggedTileForRemoval, onTileRemove]);

  const isSelected = (x: number, y: number) => {
    return selectedPositions.some(p => p.x === x && p.y === y);
  };

  // Helper to get positions between start and end in a straight line
  const getPositionsBetween = (start: Position, end: Position): Position[] => {
    const positions: Position[] = [];
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    
    // Check if it's a valid straight line
    if (dx !== 0 && dy !== 0 && Math.abs(dx) !== Math.abs(dy)) {
      return [start]; // Not a straight line, just return start
    }
    
    const steps = Math.max(Math.abs(dx), Math.abs(dy));
    const stepX = dx === 0 ? 0 : (dx > 0 ? 1 : -1);
    const stepY = dy === 0 ? 0 : (dy > 0 ? 1 : -1);
    
    for (let i = 0; i <= steps; i++) {
      positions.push({
        x: start.x + (stepX * i),
        y: start.y + (stepY * i)
      });
    }
    
    return positions;
  };

  const handleMouseDown = (e: React.MouseEvent, x: number, y: number) => {
    // Only start word selection if clicking on a tile (not empty cell)
    if (board[y][x] && !isPlacingTiles) {
      setIsDraggingWord(true);
      setDragStartPos({ x, y });
      setDragCurrentPos({ x, y });
      e.preventDefault();
    }
  };

  const handleMouseMove = (e: React.MouseEvent, x: number, y: number) => {
    if (isDraggingWord && dragStartPos) {
      setDragCurrentPos({ x, y });
    }
  };

  const handleMouseUp = (e: React.MouseEvent) => {
    if (isDraggingWord && dragStartPos && dragCurrentPos && onWordSelect) {
      const positions = getPositionsBetween(dragStartPos, dragCurrentPos);
      // Filter to only positions with tiles
      const validPositions = positions.filter(pos => 
        pos.x >= 0 && pos.x < 7 && pos.y >= 0 && pos.y < 7 && board[pos.y]?.[pos.x]
      );
      
      if (validPositions.length >= 3 && isValidWordLine(validPositions)) {
        // Preserve drag direction (start to end, not sorted)
        onWordSelect(validPositions);
      }
      
      setIsDraggingWord(false);
      setDragStartPos(null);
      setDragCurrentPos(null);
    } else if (isDraggingWord) {
      // Cancel drag if no valid selection
      setIsDraggingWord(false);
      setDragStartPos(null);
      setDragCurrentPos(null);
    }
  };

  // Get currently dragging word positions for visual feedback
  const getDraggingWordPositions = (): Position[] => {
    if (!isDraggingWord || !dragStartPos || !dragCurrentPos) {
      return [];
    }
    return getPositionsBetween(dragStartPos, dragCurrentPos).filter(pos => 
      pos.x >= 0 && pos.x < 7 && pos.y >= 0 && pos.y < 7 && board[pos.y]?.[pos.x]
    );
  };

  const handleDragOver = (e: React.DragEvent, x: number, y: number) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'move';
    setDragOverCell({ x, y });
  };

  const handleDragEnter = (e: React.DragEvent, x: number, y: number) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverCell({ x, y });
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const x = e.clientX;
    const y = e.clientY;
    if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) {
      setDragOverCell(null);
    }
  };

  const handleDrop = (e: React.DragEvent, x: number, y: number) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverCell(null);
    
    // Clear dragged tile for removal since we're dropping on the board
    setDraggedTileForRemoval(null);
    
    try {
      const data = e.dataTransfer.getData('text/plain');
      if (data) {
        const parsed = JSON.parse(data);
        // Check if this is a tile from the rack (has index and tile)
        if (parsed.tile && typeof parsed.index === 'number' && onTileDrop) {
          // Always allow drop - tile will fall to lowest empty cell in column via gravity
          onTileDrop(x, y, parsed);
        }
        // If dragging a tile from board to another board position, clear removal flag
        else if (parsed.fromBoard) {
          setDraggedTileForRemoval(null);
        }
      }
    } catch (error) {
      console.error('Error handling drop:', error);
    }
  };

  const handleTileDragStart = (e: React.DragEvent, x: number, y: number) => {
    const tile = board[y][x];
    // Only allow dragging own tiles during own turn
    if (tile && tile.playerId !== undefined && currentPlayerId !== undefined) {
      if (tile.playerId !== currentPlayerId) {
        e.preventDefault();
        return;
      }
    }
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', JSON.stringify({ fromBoard: true, x, y }));
    setDraggedTilePos({ x, y });
    setDraggedTileForRemoval({ x, y }); // Track tile being dragged for removal
  };

  const handleTileDragEnd = (e: React.DragEvent, x: number, y: number) => {
    // Clear drag state
    setDraggedTilePos(null);
    // Note: Removal is handled by document drop handler if dropped outside
    // If dropped inside board, draggedTileForRemoval will be cleared by drop handler
    setTimeout(() => {
      setDraggedTileForRemoval(null);
    }, 100);
  };

  const draggingWordPositions = getDraggingWordPositions();
  const isInDraggingWord = (x: number, y: number) => {
    return draggingWordPositions.some(p => p.x === x && p.y === y);
  };

  return (
    <div className="board-container">
      <div 
        className="board"
        onMouseUp={handleMouseUp}
        onMouseLeave={() => {
          // Cancel drag if mouse leaves board
          if (isDraggingWord) {
            setIsDraggingWord(false);
            setDragStartPos(null);
            setDragCurrentPos(null);
          }
        }}
      >
        {board.map((row, y) =>
          row.map((cell, x) => {
            const tile = cell;
            const selected = isSelected(x, y);
            const isDragOver = dragOverCell && dragOverCell.x === x && dragOverCell.y === y;
            const isEmpty = tile === null;
            const isTopRow = y === 0;
            const isInDragSelection = isInDraggingWord(x, y);
            
            return (
              <div
                key={`${x}-${y}`}
                className={`cell ${selected ? 'highlighted' : ''} ${isEmpty && isTopRow ? 'drop-zone' : ''} ${isDragOver ? 'drag-over' : ''} ${tile ? 'has-tile' : ''} ${isInDragSelection ? 'word-selecting' : ''}`}
                onMouseDown={(e) => handleMouseDown(e, x, y)}
                onMouseMove={(e) => handleMouseMove(e, x, y)}
                onClick={() => {
                  if (isEmpty && isTopRow) {
                    onColumnClick(x);
                  }
                  // Don't handle click for word selection - use drag instead
                }}
                onDoubleClick={(e) => {
                  // Double-click to remove tile (only if it's the current player's tile)
                  e.stopPropagation();
                  if (tile && tile.playerId === currentPlayerId && onTileRemove) {
                    console.log('Double-click on cell, removing tile:', { x, y, tile });
                    onTileRemove(x, y);
                  }
                }}
                onDragEnter={(e) => handleDragEnter(e, x, y)}
                onDragOver={(e) => handleDragOver(e, x, y)}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, x, y)}
                title={isEmpty && isTopRow ? `Drop tile here (column ${x + 1})` : tile ? `${tile.letter} (${tile.points} pts) - Drag to select word, double-click to remove` : `Cell (${x + 1}, ${y + 1})`}
              >
                {tile ? (
                  <div 
                    className={`tile ${draggedTilePos && draggedTilePos.x === x && draggedTilePos.y === y ? 'dragging' : ''} ${fallingTiles.has(`${x}-${y}`) ? 'falling' : ''} ${tile.playerId === currentPlayerId ? 'removable' : ''} ${tile.letter === ' ' ? 'blank-tile' : ''}`}
                    style={{ 
                      backgroundColor: getPlayerColor(tile.playerId || 0),
                      color: 'white',
                      borderLeft: `4px solid ${getPlayerColor(tile.playerId || 0)}`,
                      ...(tile.letter === ' ' ? {
                        borderTop: '2px dashed rgba(255, 255, 255, 0.6)',
                        borderRight: '2px dashed rgba(255, 255, 255, 0.6)',
                        borderBottom: '2px dashed rgba(255, 255, 255, 0.6)',
                      } : {}),
                      ...(fallingTiles.has(`${x}-${y}`) ? {
                        '--fall-distance': `${y * 100}%`
                      } as React.CSSProperties : {})
                    }}
                    draggable={tile.playerId === currentPlayerId}
                    onDragStart={(e) => handleTileDragStart(e, x, y)}
                    onDragEnd={(e) => handleTileDragEnd(e, x, y)}
                    onClick={(e) => {
                      // Prevent cell click from firing when clicking on tile
                      e.stopPropagation();
                    }}
                    onDoubleClick={(e) => {
                      e.stopPropagation();
                      const wasPlacedThisTurn = tilesPlacedThisTurn.some(pos => pos.x === x && pos.y === y);
                      
                      // If it's a blank tile and editable, open edit modal
                      if (tile.letter === ' ' && tile.playerId === currentPlayerId && !tile.isBlankLocked && onBlankTileEdit) {
                        console.log('Double-click on blank tile, editing:', { x, y, tile });
                        onBlankTileEdit(x, y);
                        return;
                      }
                      
                      // Otherwise, double-click to remove (only if placed this turn)
                      if (tile.playerId === currentPlayerId && wasPlacedThisTurn && onTileRemove) {
                        console.log('Double-click on tile, removing:', { x, y, tile });
                        onTileRemove(x, y);
                      }
                    }}
                  >
                    {(() => {
                      // Only show remove button if:
                      // 1. Tile belongs to current player
                      // 2. Tile was placed in this turn
                      const isCurrentPlayerTile = tile && tile.playerId !== undefined && currentPlayerId !== undefined && tile.playerId === currentPlayerId;
                      const wasPlacedThisTurn = tilesPlacedThisTurn.some(pos => pos.x === x && pos.y === y);
                      const shouldShowRemoveButton = isCurrentPlayerTile && wasPlacedThisTurn && onTileRemove;
                      
                      return shouldShowRemoveButton ? (
                        <button
                          className="remove-tile-btn"
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            e.preventDefault();
                            console.log('Remove button clicked, removing tile:', { x, y, tile, playerId: tile.playerId, currentPlayerId });
                            onTileRemove(x, y);
                          }}
                          onMouseDown={(e) => {
                            e.stopPropagation();
                          }}
                          title="Remove tile"
                          aria-label="Remove tile"
                        >
                          ×
                        </button>
                      ) : null;
                    })()}
                    <div 
                      className="letter"
                      onClick={(e) => {
                        // Allow clicking blank tiles to edit them (if not locked and belongs to current player)
                        if (tile.letter === ' ' && onBlankTileEdit) {
                          const isEditable = tile.playerId === currentPlayerId && !tile.isBlankLocked;
                          if (isEditable) {
                            e.stopPropagation();
                            onBlankTileEdit(x, y);
                          }
                        }
                      }}
                      style={{
                        cursor: (tile.letter === ' ' && 
                                tile.playerId === currentPlayerId && 
                                !tile.isBlankLocked) 
                                ? 'pointer' : 'default',
                        fontWeight: tile.letter === ' ' && tile.blankLetter ? 'bold' : 'normal',
                        fontSize: tile.letter === ' ' && tile.blankLetter ? '1.1em' : '1em'
                      }}
                      title={tile.letter === ' ' && tile.playerId === currentPlayerId && !tile.isBlankLocked
                        ? 'Click or double-click to edit blank tile letter' 
                        : tile.letter === ' ' && tile.isBlankLocked 
                        ? `Blank tile (locked as ${tile.blankLetter || '?'})` 
                        : tile.letter === ' '
                        ? 'Blank tile'
                        : ''}
                    >
                      {tile.letter === ' ' ? (tile.blankLetter ? tile.blankLetter.toUpperCase() : '?') : tile.letter}
                    </div>
                    <div className="points">{tile.points}</div>
                  </div>
                ) : isEmpty && isTopRow ? (
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

