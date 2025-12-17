import React, { useState, useEffect, useMemo } from 'react';
import './App.css';
import './styles.scss';
import { GrabbleEngine } from './game-engine';
import { GameStateManager } from './game-state-manager';
import type { Tile, Position, WordClaim, Player, ClaimedWord } from './types';
import { extractWordFromPositions, isValidWordLine } from './word-detection';
import SetupModal from './components/SetupModal';
import Navbar from './components/Navbar';
import ScoreArea from './components/ScoreArea';
import Board from './components/Board';
import Rack from './components/Rack';
import ActionButtons from './components/ActionButtons';
import WordsPanel from './components/WordsPanel';
import ErrorModal from './components/ErrorModal';

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
  const [selectedWords, setSelectedWords] = useState<Position[][]>([]); // Array of word positions (multiple words)
  const [wordDirection, setWordDirection] = useState<'horizontal' | 'vertical' | 'diagonal' | null>(null);
  const [pendingPlacements, setPendingPlacements] = useState<Array<{ column: number; tile: Tile }>>([]);
  const [tilesPlacedThisTurn, setTilesPlacedThisTurn] = useState<Position[]>([]); // Track tiles placed this turn
  const [isPlacingTiles, setIsPlacingTiles] = useState(false);
  const [showSetup, setShowSetup] = useState(true);
  const [dictionary, setDictionary] = useState<Set<string>>(new Set());
  const [dictionaryLoaded, setDictionaryLoaded] = useState(false);
  const [renderKey, setRenderKey] = useState(0); // Force re-render
  const [fallingTiles, setFallingTiles] = useState<Set<string>>(new Set()); // Track tiles with falling animation
  const [errorModal, setErrorModal] = useState<{ isOpen: boolean; message: string }>({ isOpen: false, message: '' });

  // Helper function to show error modal
  const showError = (message: string) => {
    setErrorModal({ isOpen: true, message });
  };

  const closeErrorModal = () => {
    setErrorModal({ isOpen: false, message: '' });
  };

  // Extract recognized words from selected positions (preserving drag direction)
  const recognizedWords = useMemo(() => {
    if (!gameManager || selectedWords.length === 0) return [];
    
    const state = gameManager.getState();
    return selectedWords
      .filter(positions => isValidWordLine(positions) && positions.length >= 3)
      .map(positions => {
        // Extract word preserving the order of positions (drag direction)
        return extractWordFromPositions(state.board, positions, true);
      })
      .filter(word => word.length >= 3);
  }, [selectedWords, gameManager]);

  // Get all selected positions flattened for highlighting
  const selectedWordPositions = useMemo(() => {
    return selectedWords.flat();
  }, [selectedWords]);

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

  const handleTileDrop = (x: number, y: number, tileData: { index: number; tile: Tile }) => {
    if (!gameManager || !engine) {
      console.warn('Game manager or engine not available');
      return;
    }
    
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
      // ALWAYS use column placement with gravity, regardless of where tile is dropped
      // Determine the column based on x coordinate
      const column = x;
      
      // Get state before placement to compare
      const prevState = engine.getState();
      
      const placement = { column, tile };
      engine.placeTiles([placement], currentPlayer.id);
      
      // Track where tile was placed (after gravity - it falls to the lowest empty cell in the column)
      const state = engine.getState();
      let placedPosition: Position | null = null;
      // Find the tile we just placed (it will be at the lowest empty position in the column)
      // Compare with previous state to find the new tile
      for (let row = 6; row >= 0; row--) {
        const boardTile = state.board[row][column];
        const prevTile = prevState.board[row][column];
        // If there's a tile now that wasn't there before, or it's a new tile by this player
        if (boardTile && (!prevTile || (prevTile.playerId !== currentPlayer.id && boardTile.playerId === currentPlayer.id))) {
          placedPosition = { x: column, y: row };
          break;
        }
      }
      
      if (placedPosition) {
        setTilesPlacedThisTurn(prev => [...prev, placedPosition!]);
        // Add falling animation
        setFallingTiles(prev => new Set(prev).add(`${placedPosition!.x}-${placedPosition!.y}`));
        // Remove animation class after animation completes
        setTimeout(() => {
          setFallingTiles(prev => {
            const newSet = new Set(prev);
            newSet.delete(`${placedPosition!.x}-${placedPosition!.y}`);
            return newSet;
          });
        }, 500);
      }
      
      // Remove tile from rack (don't refill - wait until after submit)
      currentPlayer.rack = currentPlayer.rack.filter((_, i) => i !== index);
      
      // Clear selections
      setSelectedTiles(prev => prev.filter(i => i !== index));
      setPendingPlacements([]);
      setIsPlacingTiles(false);
      
      // Force re-render by updating render key
      setRenderKey(prev => prev + 1);
      
      console.log('Tile placed successfully at:', { x, y });
    } catch (error) {
      console.error('Error placing tile:', error);
      showError(`Error placing tile: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const handleTileRemove = (x: number, y: number) => {
    if (!gameManager || !engine) return;
    
    const currentPlayer = gameManager.getCurrentPlayer();
    const state = engine.getState();
    const tile = state.board[y][x];
    
    // Check if tile exists and belongs to current player
    if (!tile) {
      return;
    }
    
    if (tile.playerId !== currentPlayer.id) {
      showError('You can only remove your own tiles.');
      return;
    }
    
    // Check if it's the current player's turn (can only remove during active turn)
    if (state.currentPlayerId !== currentPlayer.id) {
      showError('You can only remove tiles during your turn.');
      return;
    }
    
    // Check if this tile was placed in the current turn
    const wasPlacedThisTurn = tilesPlacedThisTurn.some(pos => pos.x === x && pos.y === y);
    if (!wasPlacedThisTurn) {
      // Don't show error - the X button shouldn't be visible for tiles from previous turns
      return;
    }
    
    try {
      const removedTile = engine.removeTile(x, y);
      if (removedTile) {
        // Return tile to rack (without playerId)
        const tileToReturn = { letter: removedTile.letter, points: removedTile.points };
        currentPlayer.rack.push(tileToReturn);
        
        // Remove from tilesPlacedThisTurn
        setTilesPlacedThisTurn(prev => prev.filter(pos => !(pos.x === x && pos.y === y)));
        
        // Also remove any selected words that contain this position
        setSelectedWords(prev => prev.filter(wordPositions => 
          !wordPositions.some(pos => pos.x === x && pos.y === y)
        ));
        
        // Force re-render
        setRenderKey(prev => prev + 1);
        console.log('Tile removed and returned to rack:', { x, y, tile: removedTile });
      }
    } catch (error) {
      console.error('Error removing tile:', error);
      showError(`Error removing tile: ${error instanceof Error ? error.message : 'Unknown error'}`);
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

  const handleWordSelect = (positions: Position[]) => {
    if (!gameManager || !engine) return;
    
    // Check if this word is already selected (by comparing position keys)
    const wordKey = positions.map(p => `${p.x},${p.y}`).sort().join('|');
    
    setSelectedWords(prev => {
      // Check if word already exists
      const exists = prev.some(word => {
        const key = word.map(p => `${p.x},${p.y}`).sort().join('|');
        return key === wordKey;
      });
      
      if (exists) {
        // Remove if already selected (toggle off)
        return prev.filter(word => {
          const key = word.map(p => `${p.x},${p.y}`).sort().join('|');
          return key !== wordKey;
        });
      } else {
        // Add new word
        return [...prev, positions];
      }
    });
  };

  const handleSubmitMove = async () => {
    if (!gameManager || !engine) return;
    
    const currentPlayer = gameManager.getCurrentPlayer();
    
    // Check if we have tiles placed this turn OR pending placements
    const hasPlacedTiles = tilesPlacedThisTurn.length > 0 || pendingPlacements.length > 0;
    
    if (!hasPlacedTiles && selectedWords.length === 0) {
      showError('Please place tiles and select at least one word by dragging before submitting.');
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
      console.log('Submit move - selected words:', selectedWords);
      console.log('Submit move - recognized words:', recognizedWords);
      console.log('Submit move - dictionary size:', dictionary.size, 'dictionary loaded:', dictionaryLoaded);
      
      if (!dictionaryLoaded || dictionary.size === 0) {
        showError('Dictionary is still loading. Please wait...');
        return;
      }
      
      // Require word selection before submitting
      if (selectedWords.length === 0) {
        showError('Please select at least one word by dragging from start to finish before submitting.');
        return;
      }
      
      // Process word claims for all selected words
      if (selectedWords.length > 0) {
        // Validate all selected words
        const validWords = selectedWords.filter(positions => isValidWordLine(positions));
        
        if (validWords.length === 0) {
          showError('Please select valid words (straight lines of 3+ tiles) by dragging.');
          return;
        }
        
        // Check if at least one word contains a newly placed tile
        if (allNewlyPlacedTiles.length > 0) {
          const hasNewTile = validWords.some(wordPositions =>
            allNewlyPlacedTiles.some(newPos =>
              wordPositions.some(pos => pos.x === newPos.x && pos.y === newPos.y)
            )
          );
          
          if (!hasNewTile) {
            showError('At least one selected word must contain a tile you placed this turn.');
            return;
          }
          
          // NEW RULE: All placed tiles must be part of at least one selected word
          const allPlacedTilesInWords = allNewlyPlacedTiles.every(placedPos =>
            validWords.some(wordPositions =>
              wordPositions.some(pos => pos.x === placedPos.x && pos.y === placedPos.y)
            )
          );
          
          if (!allPlacedTilesInWords) {
            const unclaimedTiles = allNewlyPlacedTiles.filter(placedPos =>
              !validWords.some(wordPositions =>
                wordPositions.some(pos => pos.x === placedPos.x && pos.y === placedPos.y)
              )
            );
            const unclaimedLetters = unclaimedTiles.map(pos => {
              const tile = state.board[pos.y][pos.x];
              return tile ? tile.letter : '?';
            }).join(', ');
            showError(`All tiles placed this turn must be part of a selected word. The following tiles are not part of any selected word: ${unclaimedLetters.toUpperCase()}`);
            return;
          }
        }
        
        const claims: WordClaim[] = validWords.map(positions => ({
          positions,
          playerId: currentPlayer.id
        }));
        
        console.log('Processing word claims:', { 
          claims, 
          recognizedWords,
          newlyPlacedTiles: allNewlyPlacedTiles,
          dictionarySize: dictionary.size,
          dictionaryLoaded
        });
        
        if (dictionary.size === 0) {
          showError('Dictionary not loaded yet. Please wait...');
          return;
        }
        
        const result = await engine.processWordClaims(claims, allNewlyPlacedTiles, dictionary);
        
        console.log('Word claims result:', result);
        
        if (!result.valid) {
          showError('Invalid word claims: ' + result.results.map(r => r.error).join(', '));
          return;
        }
        
        console.log('Word claims validated successfully! Score:', result.totalScore);
        setSelectedWords([]);
        setWordDirection(null);
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
        showError(`Game Over! ${winner?.name} wins with ${winner?.score} points!`);
      }
      
      // Force re-render by updating render key
      setRenderKey(prev => prev + 1);
      
    } catch (error) {
      console.error('Error submitting move:', error);
      showError('Error: ' + (error as Error).message);
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
        onColumnClick={handleColumnClick}
        onTileDrop={handleTileDrop}
        onTileRemove={handleTileRemove}
        fallingTiles={fallingTiles}
        currentPlayerId={currentPlayer.id}
        onWordSelect={handleWordSelect}
        tilesPlacedThisTurn={tilesPlacedThisTurn}
      />
      <Rack 
        tiles={currentPlayer.rack}
        selectedIndices={selectedTiles}
        onTileClick={handleTileSelect}
        onTileDragStart={(index, tile) => {
          // Optional: visual feedback when dragging starts
        }}
        playerId={currentPlayer.id}
      />
      <ActionButtons
        canSubmit={tilesPlacedThisTurn.length > 0 || pendingPlacements.length > 0 || selectedWords.length > 0}
        onSubmit={handleSubmitMove}
        onSwap={handleSwapTiles}
        canSwap={selectedTiles.length > 0}
        recognizedWords={recognizedWords}
        hasWordSelected={selectedWords.length > 0}
        onClearSelection={() => {
          setSelectedWords([]);
          setRenderKey(prev => prev + 1);
        }}
      />
      <WordsPanel claimedWords={state.claimedWords} players={state.players} />
      <ErrorModal 
        isOpen={errorModal.isOpen} 
        message={errorModal.message} 
        onClose={closeErrorModal} 
      />
    </div>
  );
}

export default App;
