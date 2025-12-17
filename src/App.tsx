import React, { useState, useEffect } from 'react';
import './App.css';
import './styles.scss';
import { GrabbleEngine } from './game-engine';
import { GameStateManager } from './game-state-manager';
import type { Tile, Position, WordClaim, Player, ClaimedWord } from './types';
import SetupModal from './components/SetupModal';
import Navbar from './components/Navbar';
import ScoreArea from './components/ScoreArea';
import Board from './components/Board';
import Rack from './components/Rack';
import ActionButtons from './components/ActionButtons';
import WordsPanel from './components/WordsPanel';

// Dictionary loading function
async function loadDictionary(): Promise<Set<string>> {
  try {
    console.log('Loading dictionary from /dictionary.txt...');
    const response = await fetch('/dictionary.txt');
    console.log('Dictionary fetch response:', response.status, response.statusText);
    
    if (!response.ok) {
      console.warn('Dictionary file not found (status:', response.status, '), using fallback');
      return new Set(['CAT', 'DOG', 'BAT', 'RAT', 'MAT', 'SAT', 'HAT', 'PAT',
        'CAR', 'BAR', 'FAR', 'TAR', 'WAR', 'JAR',
        'BED', 'RED', 'FED', 'LED', 'TED',
        'BIG', 'DIG', 'FIG', 'JIG', 'PIG', 'WIG']);
    }
    
    const text = await response.text();
    console.log('Dictionary text loaded, length:', text.length, 'characters');
    
    const words = text.split('\n')
      .map(line => line.trim().toUpperCase())
      .filter(line => line.length > 0 && !line.startsWith('#')) // Skip empty lines and comments
      .filter(word => word.length >= 3 && /^[A-Z]+$/.test(word));
    
    const dict = new Set(words);
    console.log(`Loaded ${dict.size} words from dictionary (first 10:`, Array.from(dict).slice(0, 10), ')');
    return dict;
  } catch (error) {
    console.error('Error loading dictionary:', error);
    return new Set(['CAT', 'DOG', 'BAT', 'RAT', 'MAT', 'SAT', 'HAT', 'PAT',
      'CAR', 'BAR', 'FAR', 'TAR', 'WAR', 'JAR',
      'BED', 'RED', 'FED', 'LED', 'TED',
      'BIG', 'DIG', 'FIG', 'JIG', 'PIG', 'WIG']);
  }
}

function App() {
  const [gameManager, setGameManager] = useState<GameStateManager | null>(null);
  const [engine, setEngine] = useState<GrabbleEngine | null>(null);
  const [selectedTiles, setSelectedTiles] = useState<number[]>([]);
  const [selectedWordPositions, setSelectedWordPositions] = useState<Position[]>([]);
  const [wordDirection, setWordDirection] = useState<'horizontal' | 'vertical' | 'diagonal' | null>(null);
  const [pendingPlacements, setPendingPlacements] = useState<Array<{ column: number; tile: Tile }>>([]);
  const [tilesPlacedThisTurn, setTilesPlacedThisTurn] = useState<Position[]>([]); // Track tiles placed this turn
  const [isPlacingTiles, setIsPlacingTiles] = useState(false);
  const [showSetup, setShowSetup] = useState(true);
  const [dictionary, setDictionary] = useState<Set<string>>(new Set());
  const [dictionaryLoaded, setDictionaryLoaded] = useState(false);
  const [renderKey, setRenderKey] = useState(0); // Force re-render

  useEffect(() => {
    loadDictionary().then((dict) => {
      console.log('Setting dictionary state, size:', dict.size);
      setDictionary(dict);
      setDictionaryLoaded(true);
      console.log('Dictionary loaded in state, size:', dict.size);
    }).catch((error) => {
      console.error('Failed to load dictionary:', error);
      // Set fallback dictionary
      const fallback = new Set(['CAT', 'DOG', 'BAT', 'RAT', 'MAT', 'SAT', 'HAT', 'PAT',
        'CAR', 'BAR', 'FAR', 'TAR', 'WAR', 'JAR',
        'BED', 'RED', 'FED', 'LED', 'TED',
        'BIG', 'DIG', 'FIG', 'JIG', 'PIG', 'WIG']);
      setDictionary(fallback);
      setDictionaryLoaded(true);
    });
  }, []);

  const handleStartGame = (numPlayers: number, playerNames: string[], targetScore: number) => {
    const manager = GameStateManager.createNewGame(numPlayers, playerNames, targetScore);
    const gameEngine = manager.getEngine();
    setGameManager(manager);
    setEngine(gameEngine);
    setShowSetup(false);
  };

  const handleTileSelect = (index: number) => {
    if (isPlacingTiles) return;
    setSelectedTiles(prev => 
      prev.includes(index) 
        ? prev.filter(i => i !== index)
        : [...prev, index]
    );
  };

  const handleColumnClick = (column: number) => {
    if (!gameManager || !engine || selectedTiles.length === 0) return;
    
    const currentPlayer = gameManager.getCurrentPlayer();
    const tile = currentPlayer.rack[selectedTiles[0]];
    
    setPendingPlacements(prev => [...prev, { column, tile }]);
    setSelectedTiles(prev => prev.slice(1));
    setIsPlacingTiles(true);
  };

  const handleTileDrop = (column: number, tileData: { index: number; tile: Tile }) => {
    if (!gameManager || !engine) {
      console.warn('Game manager or engine not available');
      return;
    }
    
    console.log('handleTileDrop called:', { column, tileData });
    
    const currentPlayer = gameManager.getCurrentPlayer();
    const { index, tile } = tileData;
    
    // Verify the tile exists at this index
    if (index < 0 || index >= currentPlayer.rack.length) {
      console.warn('Invalid tile index:', index);
      return;
    }
    
    const rackTile = currentPlayer.rack[index];
    if (!rackTile || rackTile.letter !== tile.letter || rackTile.points !== tile.points) {
      console.warn('Tile mismatch at index:', { index, expected: tile, found: rackTile });
      return;
    }
    
    try {
      // Place tile immediately on the board
      const placement = { column, tile };
      engine.placeTiles([placement], currentPlayer.id);
      
      // Remove tile from rack (don't refill - wait until after submit)
      currentPlayer.rack = currentPlayer.rack.filter((_, i) => i !== index);
      
      // Track where tile was placed (after gravity)
      const state = engine.getState();
      let placedPosition: Position | null = null;
      for (let y = 6; y >= 0; y--) {
        const boardTile = state.board[y][column];
        if (boardTile && boardTile.playerId === currentPlayer.id && boardTile.letter === tile.letter) {
          placedPosition = { x: column, y };
          break;
        }
      }
      
      if (placedPosition) {
        setTilesPlacedThisTurn(prev => [...prev, placedPosition!]);
      }
      
      // Clear selections
      setSelectedTiles(prev => prev.filter(i => i !== index));
      setPendingPlacements([]);
      setIsPlacingTiles(false);
      
      // Force re-render by updating render key
      // The state is already updated in the engine, we just need to trigger React re-render
      setRenderKey(prev => prev + 1);
      
      console.log('Tile placed successfully at:', placedPosition);
    } catch (error) {
      console.error('Error placing tile:', error);
      alert(`Error placing tile: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  // Helper function to detect word direction from positions
  const detectWordDirection = (positions: Position[]): 'horizontal' | 'vertical' | 'diagonal' | null => {
    if (positions.length < 2) return null;
    
    const sorted = [...positions].sort((a, b) => {
      if (a.y !== b.y) return a.y - b.y;
      return a.x - b.x;
    });
    
    const dx = sorted[1].x - sorted[0].x;
    const dy = sorted[1].y - sorted[0].y;
    
    if (dx === 0 && dy !== 0) return 'vertical';
    if (dx !== 0 && dy === 0) return 'horizontal';
    if (dx !== 0 && dy !== 0 && Math.abs(dx) === Math.abs(dy)) return 'diagonal';
    
    return null;
  };

  const handleCellClick = (x: number, y: number) => {
    if (isPlacingTiles || !gameManager) return;
    
    const pos: Position = { x, y };
    setSelectedWordPositions(prev => {
      const idx = prev.findIndex(p => p.x === x && p.y === y);
      if (idx === -1) {
        const newPositions = [...prev, pos];
        // Auto-detect direction when 2+ positions selected
        if (newPositions.length >= 2) {
          const detected = detectWordDirection(newPositions);
          if (detected) {
            setWordDirection(detected);
          }
        } else {
          setWordDirection(null);
        }
        return newPositions;
      } else {
        const newPositions = prev.filter((_, i) => i !== idx);
        // Re-detect direction if positions remain
        if (newPositions.length >= 2) {
          const detected = detectWordDirection(newPositions);
          if (detected) {
            setWordDirection(detected);
          } else {
            setWordDirection(null);
          }
        } else {
          setWordDirection(null);
        }
        return newPositions;
      }
    });
  };

  const handleSubmitMove = async () => {
    if (!gameManager || !engine) return;
    
    const currentPlayer = gameManager.getCurrentPlayer();
    
    // Check if we have tiles placed this turn OR pending placements
    const hasPlacedTiles = tilesPlacedThisTurn.length > 0 || pendingPlacements.length > 0;
    
    if (!hasPlacedTiles && selectedWordPositions.length === 0) {
      alert('Please place tiles or select a word before submitting.');
      return;
    }
    
    try {
      // Handle pending placements (click-based placement)
      let newlyPlacedFromPending: Position[] = [];
      if (pendingPlacements.length > 0) {
        // Remove tiles from rack
        const tilesToPlace = pendingPlacements.map(p => p.tile);
        const newRack = currentPlayer.rack.filter((tile, idx) => {
          const placementIdx = tilesToPlace.findIndex(p => 
            p.letter === tile.letter && p.points === tile.points
          );
          return placementIdx === -1;
        });
        currentPlayer.rack = newRack;
        
        engine.placeTiles(pendingPlacements, currentPlayer.id);
        setIsPlacingTiles(false);
        
        // Get newly placed positions (after gravity)
        const state = engine.getState();
        for (const placement of pendingPlacements) {
          for (let y = 6; y >= 0; y--) {
            const tile = state.board[y][placement.column];
            if (tile && tile.playerId === currentPlayer.id) {
              newlyPlacedFromPending.push({ x: placement.column, y });
              break;
            }
          }
        }
        setTilesPlacedThisTurn(prev => [...prev, ...newlyPlacedFromPending]);
      }
      
      // Combine all newly placed tiles for validation
      const allNewlyPlacedTiles = [...tilesPlacedThisTurn, ...newlyPlacedFromPending];
      
      console.log('Submit move - tiles placed this turn:', allNewlyPlacedTiles);
      console.log('Submit move - selected word positions:', selectedWordPositions);
      console.log('Submit move - dictionary size:', dictionary.size, 'dictionary loaded:', dictionaryLoaded);
      
      if (!dictionaryLoaded || dictionary.size === 0) {
        alert('Dictionary is still loading. Please wait...');
        return;
      }
      
      // Process word claims
      if (selectedWordPositions.length > 0) {
        // Require word direction to be selected
        if (!wordDirection) {
          alert('Please select word direction (horizontal, vertical, or diagonal) before submitting.');
          return;
        }
        
        // Validate that positions match the selected direction
        const detected = detectWordDirection(selectedWordPositions);
        if (detected !== wordDirection) {
          alert(`Selected positions form a ${detected || 'invalid'} line, but you selected ${wordDirection}. Please correct your selection.`);
          return;
        }
        
        // Check if word contains at least one newly placed tile
        if (allNewlyPlacedTiles.length > 0) {
          const hasNewTile = allNewlyPlacedTiles.some(newPos =>
            selectedWordPositions.some(pos => pos.x === newPos.x && pos.y === newPos.y)
          );
          
          if (!hasNewTile) {
            alert('Selected word must contain at least one tile you placed this turn.');
            return;
          }
        }
        
        const claims: WordClaim[] = [{
          positions: selectedWordPositions,
          playerId: currentPlayer.id
        }];
        
        console.log('Processing word claims:', { 
          claims, 
          newlyPlacedTiles: allNewlyPlacedTiles,
          dictionarySize: dictionary.size,
          dictionaryLoaded,
          sampleWords: Array.from(dictionary).slice(0, 5)
        });
        
        if (dictionary.size === 0) {
          alert('Dictionary not loaded yet. Please wait...');
          return;
        }
        
        const result = await engine.processWordClaims(claims, allNewlyPlacedTiles, dictionary);
        
        console.log('Word claims result:', result);
        
        if (!result.valid) {
          alert('Invalid word claims: ' + result.results.map(r => r.error).join(', '));
          return;
        }
        
        console.log('Word claims validated successfully! Score:', result.totalScore);
        setSelectedWordPositions([]);
        setWordDirection(null);
      } else if (allNewlyPlacedTiles.length > 0) {
        // Tiles placed but no word selected - still allow submit (pass turn)
        console.log('Tiles placed but no word claimed - passing turn');
      }
      
      // Refill rack and advance turn (only after submitting)
      engine.refillPlayerRack(currentPlayer.id);
      engine.advanceTurn();
      
      // Clear all turn state
      setWordDirection(null);
      setTilesPlacedThisTurn([]);
      setPendingPlacements([]);
      setSelectedTiles([]);
      
      // Check win condition
      const winnerId = engine.checkWinCondition();
      if (winnerId !== null) {
        const winner = gameManager.getPlayer(winnerId);
        alert(`Game Over! ${winner?.name} wins with ${winner?.score} points!`);
      }
      
      // Force re-render by updating render key
      setRenderKey(prev => prev + 1);
      
    } catch (error) {
      console.error('Error submitting move:', error);
      alert('Error: ' + (error as Error).message);
    }
  };

  const handleSwapTiles = () => {
    if (!gameManager || !engine || selectedTiles.length === 0) return;
    
    const currentPlayer = gameManager.getCurrentPlayer();
    engine.swapTiles(currentPlayer.id, selectedTiles);
    setSelectedTiles([]);
    engine.advanceTurn();
    
    // Force re-render
    setGameManager(gameManager);
    setEngine(engine);
  };

  if (!dictionaryLoaded) {
    return <div className="loading">Loading dictionary...</div>;
  }

  if (showSetup) {
    return <SetupModal onStartGame={handleStartGame} />;
  }

  if (!gameManager || !engine) {
    return null;
  }

  const state = gameManager.getState();
  const currentPlayer = gameManager.getCurrentPlayer();

  return (
    <div className="game-container" key={renderKey}>
      <Navbar currentPlayerName={currentPlayer.name} />
      <ScoreArea players={state.players} currentPlayerId={state.currentPlayerId} />
      <Board 
        board={state.board}
        selectedPositions={selectedWordPositions}
        isPlacingTiles={isPlacingTiles}
        onCellClick={handleCellClick}
        onColumnClick={handleColumnClick}
        onTileDrop={handleTileDrop}
      />
      <Rack 
        tiles={currentPlayer.rack}
        selectedIndices={selectedTiles}
        onTileClick={handleTileSelect}
        onTileDragStart={(index, tile) => {
          // Optional: visual feedback when dragging starts
        }}
      />
      <ActionButtons
        canSubmit={tilesPlacedThisTurn.length > 0 || pendingPlacements.length > 0 || selectedWordPositions.length > 0}
        onSubmit={handleSubmitMove}
        onSwap={handleSwapTiles}
        canSwap={selectedTiles.length > 0}
        wordDirection={wordDirection}
        onDirectionChange={setWordDirection}
        hasWordSelected={selectedWordPositions.length > 0}
      />
      <WordsPanel claimedWords={state.claimedWords} />
    </div>
  );
}

export default App;
