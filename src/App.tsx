import React, { useState, useEffect, useMemo, useRef } from 'react';
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
import SwapConfirmModal from './components/SwapConfirmModal';
import BlankTileModal from './components/BlankTileModal';
import LobbyScreen from './components/LobbyScreen';
import { useSocket } from './hooks/useSocket';

// Dictionary loading function
async function loadDictionary(): Promise<Set<string>> {
  try {
    // Use process.env.PUBLIC_URL for GitHub Pages compatibility
    const dictionaryPath = `${process.env.PUBLIC_URL || ''}/dictionary.txt`;
    console.log('Loading dictionary from', dictionaryPath, '...');
    const response = await fetch(dictionaryPath);
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
  // Socket hook for multiplayer
  const {
    connected,
    roomCode,
    room,
    isHost,
    playerId,
    gameState: socketGameState,
    tilesPlacedThisTurn: socketTilesPlacedThisTurn,
    error: socketError,
    clearError: clearSocketError,
    createRoom,
    joinRoom,
    leaveRoom,
    setReady,
    startGame: socketStartGame,
    placeTiles: socketPlaceTiles,
    claimWords: socketClaimWords,
    swapTiles: socketSwapTiles,
    removeTile: socketRemoveTile,
    setBlankLetter: socketSetBlankLetter,
  } = useSocket();

  // Multiplayer mode: true when in a room that is playing
  const isMultiplayer = room?.status === 'playing' && socketGameState !== null;

  const [gameManager, setGameManager] = useState<GameStateManager | null>(null);
  const [engine, setEngine] = useState<GrabbleEngine | null>(null);
  const [selectedTiles, setSelectedTiles] = useState<number[]>([]);
  const [selectedWords, setSelectedWords] = useState<Position[][]>([]); // Array of word positions (multiple words)
  const [wordDirection, setWordDirection] = useState<'horizontal' | 'vertical' | 'diagonal' | null>(null);
  const [pendingPlacements, setPendingPlacements] = useState<Array<{ column: number; tile: Tile }>>([]);
  const [tilesPlacedThisTurn, setTilesPlacedThisTurn] = useState<Position[]>([]); // Track tiles placed this turn
  const [isPlacingTiles, setIsPlacingTiles] = useState(false);
  const [showSetup, setShowSetup] = useState(false); // Start false so lobby shows first when connected
  const [dictionary, setDictionary] = useState<Set<string>>(new Set());
  const [dictionaryLoaded, setDictionaryLoaded] = useState(false);
  const [renderKey, setRenderKey] = useState(0); // Force re-render
  const [fallingTiles, setFallingTiles] = useState<Set<string>>(new Set()); // Track tiles with falling animation
  const prevSocketTilesPlacedRef = useRef<Position[]>([]); // Track previous socket tiles for animation (use ref to avoid dependency issues)
  const [errorModal, setErrorModal] = useState<{ isOpen: boolean; message: string }>({ isOpen: false, message: '' });
  const [showSwapConfirm, setShowSwapConfirm] = useState(false);
  const [blankTileModal, setBlankTileModal] = useState<{ isOpen: boolean; position: Position | null; currentLetter: string }>({
    isOpen: false,
    position: null,
    currentLetter: ''
  });

  // Helper function to show error modal
  const showError = (message: string) => {
    setErrorModal({ isOpen: true, message });
  };

  const closeErrorModal = () => {
    setErrorModal({ isOpen: false, message: '' });
  };

  // Extract recognized words from selected positions (preserving drag direction)
  const recognizedWords = useMemo(() => {
    const currentState = isMultiplayer ? socketGameState : gameManager?.getState();

    if (!currentState || selectedWords.length === 0) return [];

    return selectedWords
      .filter(positions => isValidWordLine(positions) && positions.length >= 3)
      .map(positions => {
        // Extract word preserving the order of positions (drag direction)
        return extractWordFromPositions(currentState.board, positions, true);
      })
      .filter(word => word.length >= 3);
  }, [selectedWords, gameManager, socketGameState, isMultiplayer]);

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

  // Trigger falling animation for newly placed tiles in multiplayer mode
  useEffect(() => {
    if (isMultiplayer && socketTilesPlacedThisTurn.length > prevSocketTilesPlacedRef.current.length) {
      // Find newly placed tiles by comparing arrays
      const newTiles = socketTilesPlacedThisTurn.filter(
        newPos => !prevSocketTilesPlacedRef.current.some(
          prevPos => prevPos.x === newPos.x && prevPos.y === newPos.y
        )
      );

      // Trigger falling animation for each new tile
      newTiles.forEach(pos => {
        const tileKey = `${pos.x}-${pos.y}`;
        setFallingTiles(prev => new Set(prev).add(tileKey));

        // Remove animation after it completes
        setTimeout(() => {
          setFallingTiles(prev => {
            const newSet = new Set(prev);
            newSet.delete(tileKey);
            return newSet;
          });
        }, 500);
      });

      // Check if any newly placed tile is a blank tile (needs letter assignment)
      if (socketGameState) {
        const myIdx = room?.players.findIndex(rp => rp.id === playerId) ?? -1;

        for (const pos of newTiles) {
          const placedTile = socketGameState.board[pos.y]?.[pos.x];

          if (placedTile && placedTile.letter === ' ' && !placedTile.isBlankLocked) {
            // Check if this tile belongs to me (I placed it)
            if (placedTile.playerId === myIdx) {
              setBlankTileModal({
                isOpen: true,
                position: pos,
                currentLetter: placedTile.blankLetter || ''
              });
              break; // Only show one modal at a time
            }
          }
        }
      }

      // Update previous tiles
      prevSocketTilesPlacedRef.current = [...socketTilesPlacedThisTurn];
    } else if (!isMultiplayer) {
      // Reset when switching to local mode
      prevSocketTilesPlacedRef.current = [];
    }
  }, [socketTilesPlacedThisTurn, isMultiplayer, socketGameState, room, playerId]);

  // Clear UI state when turn changes in multiplayer
  useEffect(() => {
    if (isMultiplayer && socketGameState) {
      const myIdx = room?.players.findIndex(rp => rp.id === playerId) ?? -1;
      const isMyTurn = socketGameState.currentPlayerId === myIdx;

      // If it's no longer my turn, clear all UI selections
      if (!isMyTurn) {
        setSelectedWords([]);
        setSelectedTiles([]);
        setWordDirection(null);
      }
    }
  }, [isMultiplayer, socketGameState?.currentPlayerId, room, playerId]);

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
    const { index, tile } = tileData;
    const column = x;

    // Multiplayer mode: emit socket event
    if (isMultiplayer) {
      console.log('📤 Multiplayer: emitting place_tiles', { column, tileIndex: index });
      socketPlaceTiles([{ column, tileIndex: index }]);
      // Server will respond with updated game state, which triggers re-render
      return;
    }

    // Local mode: use engine directly
    if (!gameManager || !engine) {
      console.warn('Game manager or engine not available');
      return;
    }

    const currentPlayer = gameManager.getCurrentPlayer();

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

        // If this is a blank tile, show modal to enter letter
        const placedTile = state.board[placedPosition.y][placedPosition.x];
        if (placedTile && placedTile.letter === ' ') {
          setBlankTileModal({
            isOpen: true,
            position: placedPosition,
            currentLetter: placedTile.blankLetter || ''
          });
        }
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
    // Multiplayer mode: emit socket event
    if (isMultiplayer) {
      console.log('📤 Multiplayer: asking to remove tile at', { x, y });
      // We need to import this from useSocket
      socketRemoveTile(x, y);
      return;
    }

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
        setTilesPlacedThisTurn(prev => {
          // After gravity, tiles above the removed tile have moved down
          // Update positions: tiles in the same column (x) above the removed row (y) move down by 1
          return prev
            .filter(pos => !(pos.x === x && pos.y === y)) // Remove the deleted tile
            .map(pos => {
              // If tile is in same column and above removed position, it moved down
              if (pos.x === x && pos.y < y) {
                return { x: pos.x, y: pos.y + 1 };
              }
              return pos;
            });
        });

        // Also remove any selected words that contain this position
        // And update positions in selected words after gravity
        setSelectedWords(prev => prev
          .filter(wordPositions =>
            !wordPositions.some(pos => pos.x === x && pos.y === y)
          )
          .map(wordPositions =>
            wordPositions.map(pos => {
              // If position is in same column and above removed position, it moved down
              if (pos.x === x && pos.y < y) {
                return { x: pos.x, y: pos.y + 1 };
              }
              return pos;
            })
          )
        );
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
    // Client-side selection logic doesn't need engine/manager
    // if (!gameManager || !engine) return;

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
    // Multiplayer mode: emit socket event
    if (isMultiplayer) {
      console.log('📤 Multiplayer: submitting word claims');

      const currentState = socketGameState;
      if (!currentState) return;

      if (!dictionaryLoaded || dictionary.size === 0) {
        showError('Dictionary is still loading. Please wait...');
        return;
      }

      // 1. Require word selection OR tile placement (but actually must select word)
      if (selectedWords.length === 0) {
        showError('Please select at least one word by dragging from start to finish before submitting.');
        return;
      }

      // 2. Validate selected words are straight lines
      const validWords = selectedWords.filter(positions => isValidWordLine(positions));
      if (validWords.length === 0) {
        showError('Please select valid words (straight lines of 3+ tiles) by dragging.');
        return;
      }

      // 3. New Rule: ALL tiles placed this turn MUST be used in at least one selected word
      const allNewlyPlacedTiles = socketTilesPlacedThisTurn || []; // Use accumulated socket state

      if (allNewlyPlacedTiles.length > 0) {
        // Check if at least one word contains a newly placed tile (Connectivity Rule)
        const hasNewTile = validWords.some(wordPositions =>
          allNewlyPlacedTiles.some(newPos =>
            wordPositions.some(pos => pos.x === newPos.x && pos.y === newPos.y)
          )
        );

        if (!hasNewTile) {
          showError('At least one selected word must contain a tile you placed this turn.');
          return;
        }

        // Check if ALL newly placed tiles are used
        const allPlacedTilesInWords = allNewlyPlacedTiles.every(placedPos =>
          validWords.some(wordPositions =>
            wordPositions.some(pos => pos.x === placedPos.x && pos.y === placedPos.y)
          )
        );

        if (!allPlacedTilesInWords) {
          // Identify unused tiles to show helpful error
          const unclaimedTiles = allNewlyPlacedTiles.filter(placedPos =>
            !validWords.some(wordPositions =>
              wordPositions.some(pos => pos.x === placedPos.x && pos.y === placedPos.y)
            )
          );
          const unclaimedLetters = unclaimedTiles.map(pos => {
            const tile = currentState.board[pos.y][pos.x];
            return tile ? tile.letter : '?';
          }).join(', ');
          showError(`All tiles placed this turn must be part of a selected word. The following tiles are not part of any selected word: ${unclaimedLetters.toUpperCase()}`);
          return;
        }
      } else {
        // If no tiles placed this turn, user cannot submit (unless pass? but submit usually implies playing)
        // Actually, if selectedWords > 0 but no placed tiles, it's usually invalid unless modifiable board.
        // In Scrabble, you must place tiles OR swap OR pass. You can't just select existing words.
        showError('You must place at least one tile to make a move.');
        return;
      }

      // Emit claim_words event to server
      const claims = validWords.map(positions => ({ positions }));
      socketClaimWords(claims);

      // Clear local selection state
      setSelectedWords([]);
      setWordDirection(null);

      return;
    }

    // Local mode: use engine directly
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
        // Remove tiles from rack before placing (in the reverse order to preserve indices)
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

      // Get current game state for validation
      const gameEngineState = engine.getState();

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
              const tile = gameEngineState.board[pos.y][pos.x];
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

        // Lock all blank tiles that were part of the submitted words
        const stateAfterSubmit = engine.getState();
        for (const wordPositions of validWords) {
          for (const pos of wordPositions) {
            const tile = stateAfterSubmit.board[pos.y][pos.x];
            if (tile && tile.letter === ' ') {
              tile.isBlankLocked = true;
            }
          }
        }

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
    if (selectedTiles.length === 0) {
      showError('Please select tiles to swap.');
      return;
    }

    // Check if we have the necessary components for local game
    if (!isMultiplayer && (!gameManager || !engine)) {
      showError('Game not initialized.');
      return;
    }

    // Show confirmation modal
    setShowSwapConfirm(true);
  };

  const confirmSwapTiles = () => {
    if (selectedTiles.length === 0) return;

    try {
      if (isMultiplayer) {
        // Multiplayer: use socket
        socketSwapTiles(selectedTiles);

        // Clear selections
        setSelectedTiles([]);
        setShowSwapConfirm(false);

        // Clear all turn state
        setSelectedWords([]);
        setTilesPlacedThisTurn([]);
        setPendingPlacements([]);

        console.log('Tiles swapped via socket, turn will advance on server');
      } else {
        // Local game: use engine
        if (!gameManager || !engine) return;

        const currentPlayer = gameManager.getCurrentPlayer();

        // Perform the swap
        engine.swapTiles(currentPlayer.id, selectedTiles);

        // Clear selections
        setSelectedTiles([]);
        setShowSwapConfirm(false);

        // Advance turn (player loses turn for swapping)
        engine.advanceTurn();

        // Clear all turn state
        setSelectedWords([]);
        setTilesPlacedThisTurn([]);
        setPendingPlacements([]);

        // Force re-render
        setGameManager(gameManager);
        setEngine(engine);
        setRenderKey(prev => prev + 1);

        console.log('Tiles swapped, turn advanced');
      }
    } catch (error) {
      console.error('Error swapping tiles:', error);
      showError(`Error swapping tiles: ${error instanceof Error ? error.message : 'Unknown error'}`);
      setShowSwapConfirm(false);
    }
  };

  const cancelSwapTiles = () => {
    setShowSwapConfirm(false);
    // Keep tiles selected so user can try again or change selection
  };

  const handleBlankTileConfirm = (letter: string) => {
    if (!blankTileModal.position) return;

    const { x, y } = blankTileModal.position;

    // Multiplayer mode: emit socket event
    if (isMultiplayer) {
      console.log('📤 Multiplayer: setting blank tile letter', { x, y, letter });
      socketSetBlankLetter(x, y, letter);
      setBlankTileModal({ isOpen: false, position: null, currentLetter: '' });
      return;
    }

    // Local mode: use engine directly
    if (!gameManager || !engine) return;

    // Access the engine's state directly (not a copy) to update the tile
    const state = (engine as any).state;
    if (!state || !state.board || !state.board[y] || !state.board[y][x]) {
      console.error('Invalid tile position or state');
      return;
    }

    const tile = state.board[y][x];

    if (tile && tile.letter === ' ') {
      // Update the blank tile with the letter directly in the engine's state
      tile.blankLetter = letter.toUpperCase();
      // Don't lock it yet - will be locked after submission
      tile.isBlankLocked = false;

      setBlankTileModal({ isOpen: false, position: null, currentLetter: '' });
      // Force re-render by updating render key and game manager
      setRenderKey(prev => prev + 1);
      setGameManager(gameManager);
      setEngine(engine);
    }
  };

  const handleBlankTileCancel = () => {
    // If canceling, remove the blank tile from board and return to rack
    if (!gameManager || !engine || !blankTileModal.position) {
      setBlankTileModal({ isOpen: false, position: null, currentLetter: '' });
      return;
    }

    const { x, y } = blankTileModal.position;
    const currentPlayer = gameManager.getCurrentPlayer();
    const state = engine.getState();
    const tile = state.board[y][x];

    if (tile && tile.letter === ' ' && tile.playerId === currentPlayer.id) {
      // Remove tile and return to rack
      const removedTile = engine.removeTile(x, y);
      if (removedTile) {
        // Return blank tile to rack (without blankLetter)
        const tileToReturn = { letter: removedTile.letter, points: removedTile.points };
        currentPlayer.rack.push(tileToReturn);

        // Remove from tilesPlacedThisTurn
        setTilesPlacedThisTurn(prev => prev.filter(pos => !(pos.x === x && pos.y === y)));

        setRenderKey(prev => prev + 1);
      }
    }

    setBlankTileModal({ isOpen: false, position: null, currentLetter: '' });
  };

  const handleBlankTileEdit = (x: number, y: number) => {
    if (!gameManager || !engine) return;

    const state = engine.getState();
    const tile = state.board[y][x];
    const currentPlayer = gameManager.getCurrentPlayer();

    // Only allow editing if:
    // 1. It's a blank tile
    // 2. It belongs to current player
    // 3. It's not locked (can edit until turn is submitted)
    // 4. It was placed this turn
    if (tile && tile.letter === ' ' &&
      tile.playerId === currentPlayer.id &&
      !tile.isBlankLocked &&
      tilesPlacedThisTurn.some(pos => pos.x === x && pos.y === y)) {
      setBlankTileModal({
        isOpen: true,
        position: { x, y },
        currentLetter: tile.blankLetter || ''
      });
    }
  };

  if (!dictionaryLoaded) {
    return <div className="loading">Loading dictionary...</div>;
  }

  // Multiplayer: Show lobby if not in a playing game
  if (!isMultiplayer && (room?.status === 'waiting' || !room)) {
    // Show lobby for multiplayer flow (room is null or waiting)
    // Check if user has interacted with multiplayer (connected but not in local game)
    if (connected && !gameManager && !showSetup) {
      return (
        <LobbyScreen
          connected={connected}
          error={socketError}
          clearError={clearSocketError}
          roomCode={roomCode}
          room={room}
          isHost={isHost}
          playerId={playerId}
          createRoom={createRoom}
          joinRoom={joinRoom}
          leaveRoom={leaveRoom}
          setReady={setReady}
          startGame={socketStartGame}
          onPlaySolo={() => setShowSetup(true)}
        />
      );
    }
  }

  // Local mode: show setup modal
  if (showSetup && !isMultiplayer) {
    return <SetupModal onStartGame={handleStartGame} />;
  }

  // Use socket game state for multiplayer, local state otherwise
  const state = isMultiplayer ? socketGameState! : gameManager?.getState();

  // Find MY player index in the game (the player I control)
  // In multiplayer: room.players[i].id is socket ID, game players use index as ID
  const myPlayerIndex = isMultiplayer
    ? room!.players.findIndex(rp => rp.id === playerId)
    : state?.currentPlayerId ?? 0;  // In local mode, we control current player

  // Get my player object (the one I control) 
  const myPlayer = state?.players[myPlayerIndex];

  // Get the current turn player (may or may not be me)
  const currentTurnPlayer = state?.players[state?.currentPlayerId ?? 0];

  // Is it my turn?
  const isMyTurn = isMultiplayer
    ? state?.currentPlayerId === myPlayerIndex
    : true;  // In local mode, it's always "my turn" (hotseat mode)

  if (!state || !myPlayer) {
    // Show lobby if we don't have a game state yet
    return (
      <LobbyScreen
        connected={connected}
        error={socketError}
        clearError={clearSocketError}
        roomCode={roomCode}
        room={room}
        isHost={isHost}
        playerId={playerId}
        createRoom={createRoom}
        joinRoom={joinRoom}
        leaveRoom={leaveRoom}
        setReady={setReady}
        startGame={socketStartGame}
        onPlaySolo={() => setShowSetup(true)}
      />
    );
  }

  // Whose turn is it? Show in navbar
  const turnIndicatorName = currentTurnPlayer?.name ?? 'Unknown';

  // Debug: Log tiles placed this turn
  const finalTilesPlacedThisTurn = isMultiplayer ? socketTilesPlacedThisTurn : tilesPlacedThisTurn;
  console.log('🎮 Rendering with tilesPlacedThisTurn:', finalTilesPlacedThisTurn, 'isMultiplayer:', isMultiplayer);

  return (
    <div className="game-container" key={renderKey}>
      <Navbar currentPlayerName={isMyTurn ? `Your turn (${myPlayer.name})` : `${turnIndicatorName}'s turn`} />
      <ScoreArea players={state.players} currentPlayerId={state.currentPlayerId} />
      <Board
        board={state.board}
        selectedPositions={selectedWordPositions}
        isPlacingTiles={isPlacingTiles}
        onColumnClick={isMyTurn ? handleColumnClick : () => { }}
        onTileDrop={isMyTurn ? handleTileDrop : () => { }}
        onTileRemove={isMyTurn ? handleTileRemove : () => { }}
        fallingTiles={fallingTiles}
        currentPlayerId={myPlayer.id}
        onWordSelect={isMyTurn ? handleWordSelect : () => { }}
        tilesPlacedThisTurn={finalTilesPlacedThisTurn}
        onBlankTileEdit={isMyTurn ? handleBlankTileEdit : () => { }}
      />
      <Rack
        tiles={myPlayer.rack}
        selectedIndices={selectedTiles}
        onTileClick={handleTileSelect}
        onTileDragStart={(index, tile) => {
          // Optional: visual feedback when dragging starts
        }}
        playerId={myPlayer.id}
        disabled={!isMyTurn}
      />
      <ActionButtons
        canSubmit={tilesPlacedThisTurn.length > 0 || pendingPlacements.length > 0 || selectedWords.length > 0}
        onSubmit={handleSubmitMove}
        onSwap={handleSwapTiles}
        canSwap={selectedTiles.length > 0}
        recognizedWords={recognizedWords}
        hasWordSelected={selectedWords.length > 0}
        selectedTilesCount={selectedTiles.length}
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
      <SwapConfirmModal
        isOpen={showSwapConfirm}
        selectedTiles={selectedTiles.map(index => myPlayer.rack[index]).filter(Boolean)}
        onConfirm={confirmSwapTiles}
        onCancel={cancelSwapTiles}
      />
      <BlankTileModal
        isOpen={blankTileModal.isOpen}
        position={blankTileModal.position}
        currentLetter={blankTileModal.currentLetter}
        onConfirm={handleBlankTileConfirm}
        onCancel={handleBlankTileCancel}
      />
    </div>
  );
}

export default App;
