import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import './App.css';
import './styles.scss';
import { GrabbleEngine } from './game-engine';
import { GameStateManager } from './game-state-manager';
import type { Tile, Position, WordClaim, Player, ClaimedWord } from './types';
import { extractWordFromPositions, isValidWordLine, getReverseWord } from './word-detection';
import { Trie, buildTrieFromDictionary, findFirstValidWord, getHintAtLevel, HintResult, HintSolution } from './hint-engine';
import { initSounds, playTileDropSound } from './utils/sounds';
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
import BonusOverlay from './components/BonusOverlay';
import LobbyScreen from './components/LobbyScreen';
import NewGameRequestModal from './components/NewGameRequestModal';
import { useSocket } from './hooks/useSocket';
import { getPlayerColor } from './utils/playerColors';

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
    requestNewGame: socketRequestNewGame,
    respondNewGame: socketRespondNewGame,
    newGameRequest,
    newGameDeclined,
    clearNewGameRequest,
    clearNewGameDeclined,
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
  const [soundEnabled, setSoundEnabled] = useState(true); // Sound toggle state
  const [newGameRequestModal, setNewGameRequestModal] = useState<{
    isOpen: boolean;
    mode: 'request_sent' | 'request_received' | 'declined' | null;
    requesterName?: string;
    declinedPlayerName?: string;
  }>({ isOpen: false, mode: null });
  const [fallingTiles, setFallingTiles] = useState<Set<string>>(new Set()); // Track tiles with falling animation
  const [removingTiles, setRemovingTiles] = useState<Set<string>>(new Set()); // Track tiles being removed (flying to rack)
  const [removingTileData, setRemovingTileData] = useState<Map<string, { dx: number; dy: number }>>(new Map()); // Removal animation direction
  const [bottomRowShake, setBottomRowShake] = useState<Set<number>>(new Set()); // Columns that should shake at bottom row
  const [fallingTileData, setFallingTileData] = useState<Map<string, { y: number; column: number; delay: number; duration: number }>>(new Map()); // Track tile fall data for stagger
  const columnFallQueue = useRef<Map<number, Position[]>>(new Map()); // Track tiles falling in each column for stagger
  const prevSocketTilesPlacedRef = useRef<Position[]>([]); // Track previous socket tiles for animation (use ref to avoid dependency issues)
  const prevSocketBoardRef = useRef<(Tile | null)[][] | null>(null); // Track previous board state to detect new tiles
  const prevClaimedWordsLengthRef = useRef<number>(0); // Track previous claimed words length for palindrome detection
  const [errorModal, setErrorModal] = useState<{ isOpen: boolean; message: string }>({ isOpen: false, message: '' });
  const [showSwapConfirm, setShowSwapConfirm] = useState(false);
  const [blankTileModal, setBlankTileModal] = useState<{ isOpen: boolean; position: Position | null; currentLetter: string }>({
    isOpen: false,
    position: null,
    currentLetter: ''
  });
  const [palindromeTiles, setPalindromeTiles] = useState<Set<string>>(new Set()); // Track tiles with palindrome animation
  const [palindromeBonus, setPalindromeBonus] = useState<{ show: boolean; points: number; word: string; playerColor: string } | null>(null);
  const [emordnilapTiles, setEmordnilapTiles] = useState<Set<string>>(new Set()); // Track tiles with emordnilap animation
  const [emordnilapPositions, setEmordnilapPositions] = useState<Position[]>([]); // Store word positions for emordnilap animation
  const [emordnilapBonus, setEmordnilapBonus] = useState<{ show: boolean; points: number; word: string; reverseWord: string; playerColor: string } | null>(null);
  const [diagonalTiles, setDiagonalTiles] = useState<Set<string>>(new Set()); // Track tiles with diagonal animation
  const [diagonalPositions, setDiagonalPositions] = useState<Position[]>([]); // Store word positions for diagonal animation
  const [diagonalBonus, setDiagonalBonus] = useState<{ show: boolean; points: number; word: string; playerColor: string } | null>(null);

  // Hint system state
  const [trie, setTrie] = useState<Trie | null>(null);
  const [hintLevel, setHintLevel] = useState<0 | 1 | 2 | 3 | 4>(0);
  const [hintResult, setHintResult] = useState<HintResult | null>(null);
  const [hintMessage, setHintMessage] = useState<string>('');
  const [hintedTileIndices, setHintedTileIndices] = useState<number[]>([]);  // Tiles to USE (golden)
  const [swapHintedTileIndices, setSwapHintedTileIndices] = useState<number[]>([]);  // Tiles to SWAP (red)
  const [hintedColumns, setHintedColumns] = useState<number[]>([]);
  const cachedHintSolutionRef = useRef<HintSolution | null>(null);  // Cache raw solution (not level-specific result)

  // Helper function to show error modal
  const showError = (message: string) => {
    setErrorModal({ isOpen: true, message });
  };

  const closeErrorModal = () => {
    setErrorModal({ isOpen: false, message: '' });
  };

  // Initialize sounds on mount
  useEffect(() => {
    initSounds();
  }, []);

  // Show socket errors in the error modal
  useEffect(() => {
    if (socketError) {
      setErrorModal({ isOpen: true, message: socketError });
      clearSocketError(); // Clear socket error after showing in modal
    }
  }, [socketError, clearSocketError]);

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

  // Build Trie from dictionary for hint system
  useEffect(() => {
    if (dictionaryLoaded && dictionary.size > 0 && !trie) {
      console.log('Building Trie from dictionary...');
      const newTrie = buildTrieFromDictionary(dictionary);
      setTrie(newTrie);
      console.log('Trie built with', newTrie.getWordCount(), 'words');
    }
  }, [dictionaryLoaded, dictionary, trie]);

  // Reset hint state when:
  // - Tiles are placed this turn (tilesPlacedThisTurn changes)
  // - Turn changes (currentPlayerId changes)
  // - Words are claimed (claimedWords changes)
  // - Rack changes (myPlayer's rack length changes)
  const currentClaimedWordsLength = isMultiplayer
    ? socketGameState?.claimedWords?.length || 0
    : gameManager?.getState()?.claimedWords?.length || 0;

  const currentRackLength = isMultiplayer
    ? ((): number => {
      if (!socketGameState || !room || !playerId) return 0;
      const myRoomPlayerIndex = room.players.findIndex(rp => rp.id === playerId);
      return socketGameState.players[myRoomPlayerIndex]?.rack?.length || 0;
    })()
    : gameManager?.getCurrentPlayer()?.rack?.length || 0;

  useEffect(() => {
    setHintLevel(0);
    setHintResult(null);
    setHintMessage('');
    setHintedTileIndices([]);
    setSwapHintedTileIndices([]);
    setHintedColumns([]);
    cachedHintSolutionRef.current = null;  // Clear cached solution
  }, [tilesPlacedThisTurn.length, socketGameState?.currentPlayerId, currentClaimedWordsLength, currentRackLength]);

  // Handle bonuses from multiplayer socket events
  // Process multiple words with bonuses sequentially
  useEffect(() => {
    if (isMultiplayer && socketGameState && room && playerId) {
      const claimedWords = socketGameState.claimedWords || [];
      const currentLength = claimedWords.length;

      // Only check if new words were added
      if (currentLength > prevClaimedWordsLengthRef.current) {
        const myRoomPlayerIndex = room.players.findIndex(rp => rp.id === playerId);
        const myGamePlayerId = myRoomPlayerIndex !== -1 ? myRoomPlayerIndex : -1;

        // Collect all bonus animations to show (flattened: word + bonus type)
        // Priority within each word: Diagonal → Emordnilap → Palindrome
        type BonusAnimation = {
          word: string;
          positions: Position[];
          bonusType: 'diagonal' | 'emordnilap' | 'palindrome';
          score: number;
          reverseWord?: string;
        };

        const newBonusAnimations: BonusAnimation[] = [];

        for (let i = prevClaimedWordsLengthRef.current; i < currentLength; i++) {
          const claimedWord = claimedWords[i];
          if (claimedWord && claimedWord.playerId === myGamePlayerId) {
            const bonuses = claimedWord.bonuses || [];

            // Add bonuses in priority order: Diagonal → Emordnilap → Palindrome
            if (bonuses.includes('diagonal')) {
              newBonusAnimations.push({
                word: claimedWord.word,
                positions: claimedWord.positions,
                bonusType: 'diagonal',
                score: claimedWord.score
              });
            }
            if (bonuses.includes('emordnilap')) {
              const reverseWord = getReverseWord(socketGameState.board, claimedWord.positions);
              newBonusAnimations.push({
                word: claimedWord.word,
                positions: claimedWord.positions,
                bonusType: 'emordnilap',
                score: claimedWord.score,
                reverseWord: reverseWord || undefined
              });
            }
            if (bonuses.includes('palindrome')) {
              newBonusAnimations.push({
                word: claimedWord.word,
                positions: claimedWord.positions,
                bonusType: 'palindrome',
                score: claimedWord.score
              });
            }
          }
        }

        // Process bonuses sequentially, one at a time
        const processNextBonus = (index: number) => {
          if (index >= newBonusAnimations.length) {
            prevClaimedWordsLengthRef.current = currentLength;
            return;
          }

          const bonusAnim = newBonusAnimations[index];
          const tileKeys = new Set(bonusAnim.positions.map(pos => `${pos.x}-${pos.y}`));
          let animationDuration = 2500;

          // Clear all previous animations first
          setPalindromeTiles(new Set());
          setEmordnilapTiles(new Set());
          setDiagonalTiles(new Set());
          setPalindromeBonus(null);
          setEmordnilapBonus(null);
          setDiagonalBonus(null);
          setEmordnilapPositions([]);
          setDiagonalPositions([]);

          // Show the appropriate animation based on bonus type
          if (bonusAnim.bonusType === 'diagonal') {
            setDiagonalTiles(tileKeys);
            setDiagonalPositions(bonusAnim.positions);
            setDiagonalBonus({
              show: true,
              points: bonusAnim.score,
              word: bonusAnim.word,
              playerColor: getPlayerColor(myGamePlayerId)
            });
            animationDuration = 2500;

            setTimeout(() => {
              setDiagonalTiles(new Set());
              setDiagonalPositions([]);
              setDiagonalBonus(null);
            }, 2500);
          } else if (bonusAnim.bonusType === 'emordnilap') {
            setEmordnilapTiles(tileKeys);
            setEmordnilapPositions(bonusAnim.positions);
            setEmordnilapBonus({
              show: true,
              points: bonusAnim.score,
              word: bonusAnim.word,
              reverseWord: bonusAnim.reverseWord || '',
              playerColor: getPlayerColor(myGamePlayerId)
            });
            animationDuration = 3000;

            setTimeout(() => {
              setEmordnilapTiles(new Set());
              setEmordnilapPositions([]);
              setEmordnilapBonus(null);
            }, 3000);
          } else if (bonusAnim.bonusType === 'palindrome') {
            setPalindromeTiles(tileKeys);
            setPalindromeBonus({
              show: true,
              points: bonusAnim.score,
              word: bonusAnim.word,
              playerColor: getPlayerColor(myGamePlayerId)
            });
            animationDuration = 2500;

            setTimeout(() => {
              setPalindromeTiles(new Set());
              setPalindromeBonus(null);
            }, 2500);
          }

          // Process next bonus after current animation completes
          setTimeout(() => {
            // Clear all animations before showing next
            setPalindromeTiles(new Set());
            setEmordnilapTiles(new Set());
            setDiagonalTiles(new Set());
            setPalindromeBonus(null);
            setEmordnilapBonus(null);
            setDiagonalBonus(null);
            setEmordnilapPositions([]);
            setDiagonalPositions([]);

            // Small delay before next animation
            setTimeout(() => {
              processNextBonus(index + 1);
            }, 300);
          }, animationDuration);
        };

        // Start processing from first bonus
        if (newBonusAnimations.length > 0) {
          processNextBonus(0);
        } else {
          prevClaimedWordsLengthRef.current = currentLength;
        }
      }
    } else if (!isMultiplayer) {
      // Reset when switching to local mode
      prevClaimedWordsLengthRef.current = 0;
    }
  }, [socketGameState?.claimedWords, socketGameState?.board, isMultiplayer, room, playerId]);

  // Trigger falling animation for newly placed tiles in multiplayer mode
  useEffect(() => {
    if (isMultiplayer && socketGameState) {
      const currentBoard = socketGameState.board;
      const prevBoard = prevSocketBoardRef.current;

      // Detect new tiles by comparing board states
      const newTiles: Position[] = [];
      if (prevBoard) {
        // Compare boards to find new tiles
        for (let y = 0; y < 7; y++) {
          for (let x = 0; x < 7; x++) {
            const currentTile = currentBoard[y]?.[x];
            const prevTile = prevBoard[y]?.[x];
            // Tile exists now but didn't before
            if (currentTile && !prevTile) {
              newTiles.push({ x, y });
            }
          }
        }
      } else {
        // First render - use placedPositions from socketTilesPlacedThisTurn
        newTiles.push(...socketTilesPlacedThisTurn);
      }

      // Trigger falling animation for each new tile
      if (newTiles.length > 0) {
        // Use requestAnimationFrame to ensure DOM has updated with new tiles
        requestAnimationFrame(() => {
          // Group tiles by column for stagger calculation
          const tilesByColumn = new Map<number, Position[]>();
          newTiles.forEach(pos => {
            const column = pos.x;
            if (!tilesByColumn.has(column)) {
              tilesByColumn.set(column, []);
            }
            tilesByColumn.get(column)!.push(pos);
          });

          // Process each column
          tilesByColumn.forEach((columnTiles, column) => {
            columnTiles.forEach((pos, index) => {
              const tileKey = `${pos.x}-${pos.y}`;
              // Verify tile exists on board before animating
              const tile = currentBoard[pos.y]?.[pos.x];
              if (tile) {
                // Calculate fall distance (number of rows fallen)
                const fallDistance = pos.y;

                // Calculate variable duration based on fall distance
                // 1 row = 0.2s, 6 rows = 0.5s (linear interpolation)
                const duration = 0.2 + (fallDistance * (0.5 - 0.2) / 6);

                // Calculate stagger delay for tiles in same column
                const delay = index * 0.3; // 300ms delay between tiles in same column

                // Store tile data for animation
                setFallingTileData(prev => {
                  const newMap = new Map(prev);
                  newMap.set(tileKey, {
                    y: pos.y,
                    column: pos.x,
                    delay: delay,
                    duration: duration
                  });
                  return newMap;
                });

                setFallingTiles(prev => {
                  const newSet = new Set(prev);
                  newSet.add(tileKey);
                  return newSet;
                });

                // Play sound when tile lands (at 70% of animation, when it hits the bottom)
                const landingTime = (delay + duration * 0.7) * 1000; // 70% of animation = landing
                setTimeout(() => {
                  playTileDropSound(soundEnabled);
                  // Trigger bottom row shake if falling more than 4 rows (when tile actually lands)
                  if (fallDistance > 4) {
                    setBottomRowShake(prev => new Set(prev).add(pos.x));
                    setTimeout(() => {
                      setBottomRowShake(prev => {
                        const newSet = new Set(prev);
                        newSet.delete(pos.x);
                        return newSet;
                      });
                    }, 300);
                  }
                }, landingTime);

                // Remove animation after it completes
                const totalTime = (delay + duration) * 1000 + 50; // Add 50ms buffer
                setTimeout(() => {
                  setFallingTiles(prev => {
                    const newSet = new Set(prev);
                    newSet.delete(tileKey);
                    return newSet;
                  });
                  setFallingTileData(prev => {
                    const newMap = new Map(prev);
                    newMap.delete(tileKey);
                    return newMap;
                  });
                }, totalTime);
              }
            });
          });
        });
      }

      // Update previous board state
      prevSocketBoardRef.current = currentBoard.map(row => row.map(tile => tile ? { ...tile } : null));

      // Check if any newly placed tile is a blank tile (needs letter assignment)
      if (room && playerId && newTiles.length > 0) {
        // Map socket ID to game player ID: room.players order matches game state players order
        const myRoomPlayerIndex = room.players.findIndex(rp => rp.id === playerId);
        if (myRoomPlayerIndex !== -1) {
          // Game player IDs are 0-indexed and match room player order
          const myGamePlayerId = myRoomPlayerIndex;

          for (const pos of newTiles) {
            const placedTile = currentBoard[pos.y]?.[pos.x];

            if (placedTile && placedTile.letter === ' ' && !placedTile.isBlankLocked) {
              // Check if this tile belongs to me (I placed it)
              if (placedTile.playerId === myGamePlayerId) {
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
      }

      // Update previous tiles tracking
      prevSocketTilesPlacedRef.current = [...socketTilesPlacedThisTurn];
    } else if (!isMultiplayer) {
      // Reset when switching to local mode
      prevSocketTilesPlacedRef.current = [];
      prevSocketBoardRef.current = null;
    }
  }, [socketTilesPlacedThisTurn, isMultiplayer, socketGameState, room, playerId]);

  // Clear UI state when turn changes in multiplayer
  useEffect(() => {
    if (isMultiplayer && socketGameState && room && playerId) {
      // Map socket ID to game player ID: room.players order matches game state players order
      const myRoomPlayerIndex = room.players.findIndex(rp => rp.id === playerId);
      const myGamePlayerId = myRoomPlayerIndex !== -1 ? myRoomPlayerIndex : -1;
      const isMyTurn = socketGameState.currentPlayerId === myGamePlayerId;

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

  // Handle hint request - progressive levels
  const handleHint = useCallback(() => {
    const currentState = isMultiplayer ? socketGameState : gameManager?.getState();
    const currentRack = isMultiplayer ? ((): Tile[] => {
      if (!socketGameState || !room || !playerId) return [];
      const myRoomPlayerIndex = room.players.findIndex(rp => rp.id === playerId);
      return socketGameState.players[myRoomPlayerIndex]?.rack || [];
    })() : gameManager?.getCurrentPlayer()?.rack || [];

    if (!trie || !currentState || currentRack.length === 0) {
      setHintMessage('⚠️ Cannot get hint right now');
      return;
    }

    // Ban hints until at least one word has been claimed (first complete turn finished)
    const hasCompletedTurns = (currentState.claimedWords?.length || 0) > 0;
    if (!hasCompletedTurns) {
      setHintMessage('⚠️ Hints are not available until a word has been played. Complete your first move!');
      return;
    }

    // Find solution (cached or new)
    // Only use cache if hintLevel > 0 (meaning we already calculated on this turn)
    let solution: HintSolution | null;
    if (hintLevel > 0) {
      // Use cached solution for progressive levels
      solution = cachedHintSolutionRef.current;
    } else {
      // First hint request this turn - calculate fresh and cache
      solution = findFirstValidWord(currentState.board, currentRack, trie);
      cachedHintSolutionRef.current = solution;
      console.log('🔍 Hint search result:', solution ? `Found: ${solution.word}` : 'No words found');
    }

    // Generate result at current level from solution
    const result = getHintAtLevel(solution, currentRack, hintLevel);
    setHintResult(result);

    // Generate message and set highlighting based on result
    if (!result.hasMoves) {
      setHintMessage('⚠️ No single-tile hint found. Consider swapping tiles?');
      // Highlight swap suggestions (red glow) - these are tiles to SWAP
      setHintedTileIndices([]);  // Clear playable hints
      setSwapHintedTileIndices(result.tilesToSwap || []);
      setHintedColumns([]);
    } else {
      // Clear swap hints when moves are available
      setSwapHintedTileIndices([]);
      // Set playable tile highlighting from result
      setHintedTileIndices(result.usefulTiles || []);
      setHintedColumns(result.targetColumns || []);

      switch (hintLevel) {
        case 0:
          setHintMessage('✅ Words are possible! Click again for more detail.');
          // Clear highlighting at level 0
          setHintedTileIndices([]);
          setHintedColumns([]);
          break;
        case 1:
          setHintMessage('💡 Highlighted tile(s) can form a word.');
          break;
        case 2:
          // Partial word hint (less obvious)
          if (result.partialWord) {
            setHintMessage(`🔤 Look for: ${result.partialWord} (${result.wordLength} letters)`);
          } else {
            setHintMessage(`🔤 Look for a ${result.wordLength || '?'}-letter word`);
          }
          break;
        case 3:
          // Column hint (penultimate - most helpful before full reveal)
          setHintMessage(`📍 Place highlighted tile in column ${(result.targetColumns?.[0] ?? 0) + 1}`);
          break;
        case 4:
          if (result.fullSolution) {
            setHintMessage(`🎯 Word: ${result.fullSolution.word} (Column ${result.fullSolution.column + 1})`);
          }
          break;
      }
    }

    // Increment level for next request (max 4)
    if (hintLevel < 4) {
      setHintLevel((prev) => Math.min(prev + 1, 4) as 0 | 1 | 2 | 3 | 4);
    }
  }, [isMultiplayer, socketGameState, room, playerId, gameManager, trie, hintLevel]);

  // Handler for starting a new game from the menu
  const handleStartNewGame = () => {
    if (isMultiplayer) {
      // In multiplayer, request a new game
      socketRequestNewGame();
      setNewGameRequestModal({
        isOpen: true,
        mode: 'request_sent'
      });
    } else {
      // In single player, just restart
      if (gameManager) {
        handleStartGame(gameManager.getNumPlayers(), gameManager.getPlayerNames(), gameManager.getTargetScore());
      }
    }
  };

  // Watch for new game requests from other players
  useEffect(() => {
    console.log('🔍 Checking new game request:', {
      isMultiplayer,
      newGameRequest,
      playerId,
      shouldShow: isMultiplayer && newGameRequest && playerId && newGameRequest.requesterId !== playerId
    });

    if (isMultiplayer && newGameRequest && playerId) {
      // Only show modal if I'm not the requester
      if (newGameRequest.requesterId !== playerId) {
        console.log('✅ Showing new game request modal for:', newGameRequest.requesterName);
        setNewGameRequestModal({
          isOpen: true,
          mode: 'request_received',
          requesterName: newGameRequest.requesterName,
        });
      } else {
        console.log('⏭️ Skipping modal - I am the requester');
      }
    }
  }, [newGameRequest, isMultiplayer, playerId]);

  // Watch for declined notifications
  useEffect(() => {
    if (isMultiplayer && newGameDeclined) {
      setNewGameRequestModal({
        isOpen: true,
        mode: 'declined',
        declinedPlayerName: newGameDeclined.playerName,
      });
      clearNewGameDeclined();
    }
  }, [newGameDeclined, isMultiplayer, clearNewGameDeclined]);

  // Watch for when new game request is cleared (all accepted) to close requester's modal
  useEffect(() => {
    if (isMultiplayer && !newGameRequest && newGameRequestModal.isOpen && newGameRequestModal.mode === 'request_sent') {
      console.log('✅ All players accepted - closing requester modal');
      setNewGameRequestModal({ isOpen: false, mode: null });
    }
  }, [newGameRequest, isMultiplayer, newGameRequestModal]);

  // Handle new game request accept/decline
  const handleAcceptNewGame = () => {
    socketRespondNewGame(true);
    setNewGameRequestModal({ isOpen: false, mode: null });
    clearNewGameRequest();
  };

  const handleDeclineNewGame = () => {
    socketRespondNewGame(false);
    setNewGameRequestModal({ isOpen: false, mode: null });
    clearNewGameRequest();
  };

  // Handler for requesting to clear the board (placeholder for future implementation)
  const handleClearBoard = () => {
    // TODO: Implement board clearing functionality
    showError('Board clearing functionality coming soon!');
  };

  // Handler for toggling sound
  // Handler for toggling sound
  const handleToggleSound = () => {
    setSoundEnabled(prev => !prev);
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

        // Calculate fall distance (number of rows fallen)
        const fallDistance = placedPosition.y;

        // Calculate variable duration based on fall distance
        // 1 row = 0.2s, 6 rows = 0.5s (linear interpolation)
        const duration = 0.2 + (fallDistance * (0.5 - 0.2) / 6);

        // Calculate stagger delay for tiles in same column
        const column = placedPosition.x;
        const columnQueue = columnFallQueue.current.get(column) || [];
        const delay = columnQueue.length * 0.3; // 300ms delay between tiles in same column

        // Add to column queue
        columnFallQueue.current.set(column, [...columnQueue, placedPosition]);

        // Store tile data for animation
        const tileKey = `${placedPosition.x}-${placedPosition.y}`;
        const finalPlacedPosition = placedPosition; // Capture for closure
        setFallingTileData(prev => {
          const newMap = new Map(prev);
          newMap.set(tileKey, {
            y: finalPlacedPosition.y,
            column: finalPlacedPosition.x,
            delay: delay,
            duration: duration
          });
          return newMap;
        });

        // Add falling animation
        setFallingTiles(prev => new Set(prev).add(tileKey));

        // Play sound when tile lands (at 70% of animation, when it hits the bottom)
        const landingTime = (delay + duration * 0.7) * 1000; // 70% of animation = landing
        setTimeout(() => {
          playTileDropSound(soundEnabled);
          // Trigger bottom row shake if falling more than 4 rows (when tile actually lands)
          if (fallDistance > 4) {
            setBottomRowShake(prev => new Set(prev).add(column));
            setTimeout(() => {
              setBottomRowShake(prev => {
                const newSet = new Set(prev);
                newSet.delete(column);
                return newSet;
              });
            }, 300);
          }
        }, landingTime);

        // Remove animation class after animation completes
        const totalTime = (delay + duration) * 1000 + 50; // Add 50ms buffer
        setTimeout(() => {
          setFallingTiles(prev => {
            const newSet = new Set(prev);
            newSet.delete(tileKey);
            return newSet;
          });
          setFallingTileData(prev => {
            const newMap = new Map(prev);
            newMap.delete(tileKey);
            return newMap;
          });
          // Remove from column queue
          const updatedQueue = columnFallQueue.current.get(column) || [];
          const filteredQueue = updatedQueue.filter(p => `${p.x}-${p.y}` !== tileKey);
          if (filteredQueue.length === 0) {
            columnFallQueue.current.delete(column);
          } else {
            columnFallQueue.current.set(column, filteredQueue);
          }
        }, totalTime);

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

    // Only allow removing tiles placed in THIS turn (before submitting)
    // After turn ends, tiles become non-removable
    const wasPlacedThisTurn = tilesPlacedThisTurn.some(pos => pos.x === x && pos.y === y);
    if (!wasPlacedThisTurn) {
      // Don't show error - the X button shouldn't be visible for tiles from previous turns
      return;
    }

    try {
      // Get the tile before removal (for returning to rack)
      const tileToRemove = state.board[y][x];
      if (!tileToRemove) {
        return;
      }

      // Calculate direction to rack for animation
      // Use requestAnimationFrame to ensure DOM is ready
      requestAnimationFrame(() => {
        const rackElement = document.querySelector('.rack-container');
        const cellElement = document.querySelector(`.cell[data-x="${x}"][data-y="${y}"]`);

        let dx = -200; // Default: fly left
        let dy = -300; // Default: fly up

        if (rackElement && cellElement) {
          const rackRect = rackElement.getBoundingClientRect();
          const cellRect = (cellElement as HTMLElement).getBoundingClientRect();
          dx = rackRect.left + rackRect.width / 2 - (cellRect.left + cellRect.width / 2);
          dy = rackRect.top + rackRect.height / 2 - (cellRect.top + cellRect.height / 2);
        }

        // Trigger removal animation
        const tileKey = `${x}-${y}`;
        setRemovingTiles(prev => new Set(prev).add(tileKey));
        setRemovingTileData(prev => {
          const newMap = new Map(prev);
          newMap.set(tileKey, { dx, dy });
          return newMap;
        });

        // Force a re-render to show the animation
        setRenderKey(prev => prev + 1);

        // After animation completes, actually remove the tile
        setTimeout(() => {
          const removedTile = engine.removeTile(x, y);
          if (removedTile) {
            // Return tile to rack (without playerId)
            const tileToReturn = { letter: removedTile.letter, points: removedTile.points };
            currentPlayer.rack.push(tileToReturn);

            // Remove from tilesPlacedThisTurn if it was tracked there
            // After gravity, tiles above the removed tile have moved down
            setTilesPlacedThisTurn(prev => {
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

            // Clear removal animation
            setRemovingTiles(prev => {
              const newSet = new Set(prev);
              newSet.delete(tileKey);
              return newSet;
            });
            setRemovingTileData(prev => {
              const newMap = new Map(prev);
              newMap.delete(tileKey);
              return newMap;
            });

            // Force re-render
            setRenderKey(prev => prev + 1);
            console.log('Tile removed and returned to rack:', { x, y, tile: removedTile });
          }
        }, 500); // Match animation duration
      }); // Close requestAnimationFrame
    } catch (error) {
      console.error('Error removing tile:', error);
      showError(`Error removing tile: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  // Handle moving a tile within the board (reordering)
  const handleTileMove = (fromX: number, fromY: number, toX: number, toY: number) => {
    // Multiplayer mode: emit socket event
    if (isMultiplayer) {
      // TODO: Implement socket event for tile move
      console.log('📤 Multiplayer: tile move not yet implemented', { fromX, fromY, toX, toY });
      return;
    }

    if (!gameManager || !engine) return;

    const currentPlayer = gameManager.getCurrentPlayer();
    const state = engine.getState();
    const tile = state.board[fromY][fromX];

    // Check if tile exists and belongs to current player
    if (!tile) {
      return;
    }

    if (tile.playerId !== currentPlayer.id) {
      showError('You can only move your own tiles.');
      return;
    }

    // Check if it's the current player's turn
    if (state.currentPlayerId !== currentPlayer.id) {
      showError('You can only move tiles during your turn.');
      return;
    }

    // Only allow moving tiles placed in THIS turn
    const wasPlacedThisTurn = tilesPlacedThisTurn.some(pos => pos.x === fromX && pos.y === fromY);
    if (!wasPlacedThisTurn) {
      showError('You can only move tiles placed this turn.');
      return;
    }

    // Don't allow moving to the same position
    if (fromX === toX && fromY === toY) {
      return;
    }

    try {
      // Get state before removal to compare
      const prevState = engine.getState();

      // Remove tile from current position (this will apply gravity to tiles above)
      const removedTile = engine.removeTile(fromX, fromY);
      if (removedTile) {
        // Update tilesPlacedThisTurn to reflect removal and gravity
        setTilesPlacedThisTurn(prev => {
          return prev
            .filter(pos => !(pos.x === fromX && pos.y === fromY))
            .map(pos => {
              // If tile is in same column and above removed position, it moved down
              if (pos.x === fromX && pos.y < fromY) {
                return { x: pos.x, y: pos.y + 1 };
              }
              return pos;
            });
        });

        // Place tile at new position (will apply gravity)
        engine.placeTiles([{ column: toX, tile: removedTile }], currentPlayer.id);

        // Get state after placement to find where tile landed
        const newState = engine.getState();
        let finalPos: Position | null = null;

        // Find the newly placed tile by comparing board states
        for (let row = 6; row >= 0; row--) {
          const boardTile = newState.board[row][toX];
          const prevTile = prevState.board[row][toX];
          // If there's a tile now that wasn't there before, or it's a new tile by this player
          if (boardTile && (!prevTile || (prevTile.playerId !== currentPlayer.id && boardTile.playerId === currentPlayer.id))) {
            finalPos = { x: toX, y: row };
            break;
          }
        }

        if (finalPos) {
          // Update tilesPlacedThisTurn with new position
          setTilesPlacedThisTurn(prev => [...prev, finalPos!]);

          // Trigger falling animation for the moved tile
          const fallDistance = finalPos.y;
          const duration = 0.2 + (fallDistance * (0.5 - 0.2) / 6);
          const tileKey = `${finalPos.x}-${finalPos.y}`;

          setFallingTileData(prev => {
            const newMap = new Map(prev);
            newMap.set(tileKey, {
              y: finalPos!.y,
              column: finalPos!.x,
              delay: 0,
              duration: duration
            });
            return newMap;
          });

          setFallingTiles(prev => new Set(prev).add(tileKey));

          // Play sound when tile lands (at 70% of animation, when it hits the bottom)
          const landingTime = duration * 0.7 * 1000; // 70% of animation = landing
          setTimeout(() => {
            playTileDropSound(soundEnabled);
            // Trigger bottom row shake if falling more than 4 rows (when tile actually lands)
            if (fallDistance > 4) {
              setBottomRowShake(prev => new Set(prev).add(toX));
              setTimeout(() => {
                setBottomRowShake(prev => {
                  const newSet = new Set(prev);
                  newSet.delete(toX);
                  return newSet;
                });
              }, 300);
            }
          }, landingTime);

          setTimeout(() => {
            setFallingTiles(prev => {
              const newSet = new Set(prev);
              newSet.delete(tileKey);
              return newSet;
            });
            setFallingTileData(prev => {
              const newMap = new Map(prev);
              newMap.delete(tileKey);
              return newMap;
            });
          }, (duration * 1000) + 50);
        }

        // Force re-render
        setRenderKey(prev => prev + 1);
        console.log('Tile moved:', { fromX, fromY, toX, toY, tile: removedTile, finalPos });
      }
    } catch (error) {
      console.error('Error moving tile:', error);
      showError(`Error moving tile: ${error instanceof Error ? error.message : 'Unknown error'}`);
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
          // Collect all error messages, filtering out undefined values
          const errorMessages = result.results
            .map(r => r.error)
            .filter((error): error is string => error !== undefined && error.length > 0);

          if (errorMessages.length > 0) {
            showError('Invalid word claims: ' + errorMessages.join('. '));
          } else {
            showError('Invalid word claims. Please check your word selection.');
          }
          return;
        }

        console.log('Word claims validated successfully! Score:', result.totalScore);

        // Check for bonuses and trigger animations sequentially
        // Process all words with bonuses, showing animations one by one
        // Within each word, prioritize bonuses: Diagonal → Emordnilap → Palindrome
        const stateAfterSubmit = engine.getState();

        // Collect all bonus animations to show (flattened: word + bonus type)
        type BonusAnimation = {
          word: string;
          positions: Position[];
          bonusType: 'diagonal' | 'emordnilap' | 'palindrome';
          score: number;
          reverseWord?: string;
        };

        const bonusAnimations: BonusAnimation[] = [];

        for (let i = 0; i < result.results.length; i++) {
          const wordResult = result.results[i];
          if (wordResult.valid && wordResult.word && wordResult.score !== undefined) {
            const bonuses = wordResult.bonuses || [];
            const wordPositions = validWords[i];

            // Add bonuses in priority order: Diagonal → Emordnilap → Palindrome
            if (bonuses.includes('diagonal')) {
              bonusAnimations.push({
                word: wordResult.word,
                positions: wordPositions,
                bonusType: 'diagonal',
                score: wordResult.score
              });
            }
            if (bonuses.includes('emordnilap')) {
              const reverseWord = getReverseWord(stateAfterSubmit.board, wordPositions);
              bonusAnimations.push({
                word: wordResult.word,
                positions: wordPositions,
                bonusType: 'emordnilap',
                score: wordResult.score,
                reverseWord: reverseWord || undefined
              });
            }
            if (bonuses.includes('palindrome')) {
              bonusAnimations.push({
                word: wordResult.word,
                positions: wordPositions,
                bonusType: 'palindrome',
                score: wordResult.score
              });
            }
          }
        }

        // Process bonuses sequentially, one at a time
        const processNextBonus = (index: number) => {
          if (index >= bonusAnimations.length) return;

          const bonusAnim = bonusAnimations[index];
          const tileKeys = new Set(bonusAnim.positions.map(pos => `${pos.x}-${pos.y}`));
          let animationDuration = 2500;

          // Clear all previous animations first
          setPalindromeTiles(new Set());
          setEmordnilapTiles(new Set());
          setDiagonalTiles(new Set());
          setPalindromeBonus(null);
          setEmordnilapBonus(null);
          setDiagonalBonus(null);
          setEmordnilapPositions([]);
          setDiagonalPositions([]);

          // Show the appropriate animation based on bonus type
          if (bonusAnim.bonusType === 'diagonal') {
            setDiagonalTiles(tileKeys);
            setDiagonalPositions(bonusAnim.positions);
            setDiagonalBonus({
              show: true,
              points: bonusAnim.score,
              word: bonusAnim.word,
              playerColor: getPlayerColor(currentPlayer.id)
            });
            animationDuration = 2500;

            setTimeout(() => {
              setDiagonalTiles(new Set());
              setDiagonalPositions([]);
              setDiagonalBonus(null);
            }, 2500);
          } else if (bonusAnim.bonusType === 'emordnilap') {
            setEmordnilapTiles(tileKeys);
            setEmordnilapPositions(bonusAnim.positions);
            setEmordnilapBonus({
              show: true,
              points: bonusAnim.score,
              word: bonusAnim.word,
              reverseWord: bonusAnim.reverseWord || '',
              playerColor: getPlayerColor(currentPlayer.id)
            });
            animationDuration = 3000;

            setTimeout(() => {
              setEmordnilapTiles(new Set());
              setEmordnilapPositions([]);
              setEmordnilapBonus(null);
            }, 3000);
          } else if (bonusAnim.bonusType === 'palindrome') {
            setPalindromeTiles(tileKeys);
            setPalindromeBonus({
              show: true,
              points: bonusAnim.score,
              word: bonusAnim.word,
              playerColor: getPlayerColor(currentPlayer.id)
            });
            animationDuration = 2500;

            setTimeout(() => {
              setPalindromeTiles(new Set());
              setPalindromeBonus(null);
            }, 2500);
          }

          // Process next bonus after current animation completes
          setTimeout(() => {
            // Clear all animations before showing next
            setPalindromeTiles(new Set());
            setEmordnilapTiles(new Set());
            setDiagonalTiles(new Set());
            setPalindromeBonus(null);
            setEmordnilapBonus(null);
            setDiagonalBonus(null);
            setEmordnilapPositions([]);
            setDiagonalPositions([]);

            // Small delay before next animation
            setTimeout(() => {
              processNextBonus(index + 1);
            }, 300);
          }, animationDuration);
        };

        // Start processing from first bonus
        if (bonusAnimations.length > 0) {
          processNextBonus(0);
        }

        // Lock all blank tiles that were part of the submitted words
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
      // Clear column fall queue when turn ends
      columnFallQueue.current.clear();

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
    // Multiplayer mode: check socket game state
    if (isMultiplayer) {
      if (!socketGameState || !room || playerId === null) return;

      const myIdx = room.players.findIndex(rp => rp.id === playerId);
      if (myIdx === -1) return;

      const tile = socketGameState.board[y]?.[x];
      const isMyTurn = socketGameState.currentPlayerId === myIdx;
      const finalTilesPlacedThisTurn = socketTilesPlacedThisTurn || [];

      // Only allow editing if:
      // 1. It's a blank tile
      // 2. It belongs to current player (me)
      // 3. It's not locked (can edit until turn is submitted)
      // 4. It was placed this turn (or is my tile during my turn)
      if (tile && tile.letter === ' ' &&
        tile.playerId === myIdx &&
        !tile.isBlankLocked &&
        isMyTurn &&
        (finalTilesPlacedThisTurn.some(pos => pos.x === x && pos.y === y) || tile.playerId === myIdx)) {
        setBlankTileModal({
          isOpen: true,
          position: { x, y },
          currentLetter: tile.blankLetter || ''
        });
      }
      return;
    }

    // Local mode: use engine directly
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
      <Navbar
        currentPlayerName={isMyTurn ? `Your turn (${myPlayer.name})` : `${turnIndicatorName}'s turn`}
        onStartNewGame={handleStartNewGame}
        onClearBoard={handleClearBoard}
        onToggleSound={handleToggleSound}
        soundEnabled={soundEnabled}
      />
      <ScoreArea players={state.players} currentPlayerId={state.currentPlayerId} />
      <div className="board-and-words-container">
        <div className="board-container">
          <Board
            board={state.board}
            selectedPositions={selectedWordPositions}
            isPlacingTiles={isPlacingTiles}
            onColumnClick={isMyTurn ? handleColumnClick : () => { }}
            onTileDrop={isMyTurn ? handleTileDrop : () => { }}
            onTileRemove={isMyTurn ? handleTileRemove : () => { }}
            fallingTiles={fallingTiles}
            fallingTileData={fallingTileData}
            removingTiles={removingTiles}
            removingTileData={removingTileData}
            bottomRowShake={bottomRowShake}
            currentPlayerId={myPlayer.id}
            onWordSelect={isMyTurn ? handleWordSelect : () => { }}
            tilesPlacedThisTurn={finalTilesPlacedThisTurn}
            onTileMove={isMyTurn ? handleTileMove : undefined}
            onBlankTileEdit={isMyTurn ? handleBlankTileEdit : () => { }}
            palindromeTiles={palindromeTiles}
            emordnilapTiles={emordnilapTiles}
            emordnilapPositions={emordnilapPositions}
            diagonalTiles={diagonalTiles}
            diagonalPositions={diagonalPositions}
          />
        </div>
        <WordsPanel claimedWords={state.claimedWords} players={state.players} className="desktop-words-panel" />
      </div>
      <div className="rack-and-actions-container">
        <Rack
          tiles={myPlayer.rack}
          selectedIndices={selectedTiles}
          onTileClick={handleTileSelect}
          onTileDragStart={(index, tile) => {
            // Optional: visual feedback when dragging starts
          }}
          playerId={myPlayer.id}
          disabled={!isMyTurn}
          hintedIndices={hintedTileIndices}
          swapHintedIndices={swapHintedTileIndices}
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
          onHint={handleHint}
          hintLevel={hintLevel}
          canHint={isMyTurn && trie !== null}
          hintMessage={hintMessage}
        />
      </div >
      <WordsPanel claimedWords={state.claimedWords} players={state.players} className="mobile-words-panel" />
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
      {
        palindromeBonus && (
          <BonusOverlay
            show={palindromeBonus.show}
            text="Palindrome Bonus"
            points={palindromeBonus.points}
            playerColor={palindromeBonus.playerColor}
            onComplete={() => setPalindromeBonus(null)}
          />
        )
      }
      {
        emordnilapBonus && (
          <BonusOverlay
            show={emordnilapBonus.show}
            text="Emordnilap Bonus"
            points={emordnilapBonus.points}
            playerColor={emordnilapBonus.playerColor}
            reverseWord={emordnilapBonus.reverseWord}
            onComplete={() => setEmordnilapBonus(null)}
          />
        )
      }
      {
        diagonalBonus && (
          <BonusOverlay
            show={diagonalBonus.show}
            text="Diagonal Bonus"
            points={diagonalBonus.points}
            playerColor={diagonalBonus.playerColor}
            onComplete={() => setDiagonalBonus(null)}
          />
        )
      }
      <NewGameRequestModal
        isOpen={newGameRequestModal.isOpen}
        mode={newGameRequestModal.mode}
        requesterName={newGameRequestModal.requesterName}
        declinedPlayerName={newGameRequestModal.declinedPlayerName}
        onAccept={handleAcceptNewGame}
        onDecline={handleDeclineNewGame}
        onClose={() => {
          setNewGameRequestModal({ isOpen: false, mode: null });
          if (newGameRequestModal.mode === 'request_received') {
            clearNewGameRequest();
          }
        }}
      />
    </div >
  );
}

export default App;
