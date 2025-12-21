/**
 * useGameSync - Firebase Realtime Database Hook for Grabble
 * Replaces useSocket with Firebase-backed room and game state management
 */

import { useEffect, useState, useCallback, useRef } from 'react';
import {
    database,
    ref,
    set,
    get,
    onValue,
    push,
    update,
    remove,
    generateRoomCode,
    dbPaths
} from '../firebase';
import type { GameState, Position, Tile } from '../types';
import type { Room, RoomPlayer } from '../server-types';
import { GameStateManager } from '../game-state-manager';

// Player colors for assignment
const PLAYER_COLORS = ['#e74c3c', '#3498db', '#2ecc71', '#9b59b6'];

interface UseGameSyncReturn {
    // Connection state
    connected: boolean;

    // Room state
    roomCode: string | null;
    room: Room | null;
    isHost: boolean;
    playerId: string | null;

    // Game state
    gameState: GameState | null;
    tilesPlacedThisTurn: Position[];

    // Error handling
    error: string | null;
    clearError: () => void;

    // New game request state
    newGameRequest: { requesterId: string; requesterName: string } | null;
    newGameDeclined: { playerName: string } | null;
    clearNewGameRequest: () => void;
    clearNewGameDeclined: () => void;

    // Room actions
    createRoom: (playerName: string, targetScore?: number, hintsEnabled?: boolean, uid?: string, photoURL?: string) => void;
    joinRoom: (roomCode: string, playerName: string, uid?: string, photoURL?: string) => void;
    leaveRoom: (uid?: string) => void;
    setReady: (ready: boolean) => void;
    startGame: () => void;

    // Game actions (these operate locally, sync on submit)
    placeTiles: (placements: Array<{ column: number; tileIndex: number }>) => void;
    claimWords: (claims: Array<{ positions: Position[] }>) => void;
    swapTiles: (tileIndices: number[]) => void;
    endTurn: () => void;
    removeTile: (column: number, row: number) => void;
    setBlankLetter: (x: number, y: number, letter: string) => void;
    requestNewGame: () => void;
    respondNewGame: (accepted: boolean) => void;

    // Full game state sync (for batch update mode)
    syncGameState: (newState: GameState) => Promise<void>;

    // Active game (for rejoin)
    getActiveGame: (uid: string) => Promise<{ roomCode: string; playerId: string } | null>;
}

export function useGameSync(): UseGameSyncReturn {
    // Connection state
    const [connected, setConnected] = useState(false);

    // Room state
    const [roomCode, setRoomCode] = useState<string | null>(null);
    const [room, setRoom] = useState<Room | null>(null);
    const [playerId, setPlayerId] = useState<string | null>(null);

    // Game state
    const [gameState, setGameState] = useState<GameState | null>(null);
    const [tilesPlacedThisTurn, setTilesPlacedThisTurn] = useState<Position[]>([]);

    // Error state
    const [error, setError] = useState<string | null>(null);

    // New game request state
    const [newGameRequest, setNewGameRequest] = useState<{ requesterId: string; requesterName: string } | null>(null);
    const [newGameDeclined, setNewGameDeclined] = useState<{ playerName: string } | null>(null);

    // Refs for cleanup
    const unsubscribeRoomRef = useRef<(() => void) | null>(null);
    const unsubscribeGameRef = useRef<(() => void) | null>(null);

    // Generate a unique player ID on mount
    useEffect(() => {
        const id = `player_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        setPlayerId(id);
        setConnected(true);
        console.log('🔥 Firebase connected, playerId:', id);

        return () => {
            // Cleanup subscriptions
            if (unsubscribeRoomRef.current) unsubscribeRoomRef.current();
            if (unsubscribeGameRef.current) unsubscribeGameRef.current();
        };
    }, []);

    // Computed values - use hostId rather than array order (Firebase objects don't preserve order)
    const isHost = room?.hostId === playerId;

    // Error handling
    const clearError = useCallback(() => setError(null), []);
    const clearNewGameRequest = useCallback(() => setNewGameRequest(null), []);
    const clearNewGameDeclined = useCallback(() => setNewGameDeclined(null), []);

    // Subscribe to room updates
    const subscribeToRoom = useCallback((code: string) => {
        if (unsubscribeRoomRef.current) unsubscribeRoomRef.current();

        const roomRef = ref(database, dbPaths.room(code));
        const unsubscribe = onValue(roomRef, (snapshot) => {
            const data = snapshot.val();
            if (data) {
                // Convert players object to array if needed
                const players = data.players ? Object.values(data.players) as RoomPlayer[] : [];
                setRoom({
                    code: data.code || code,
                    players,
                    hostId: data.hostId || players[0]?.id,
                    status: data.status || 'waiting',
                    gameState: data.gameState || null,
                    createdAt: data.createdAt ? new Date(data.createdAt) : new Date(),
                    maxPlayers: data.maxPlayers || 4,
                    targetScore: data.targetScore || 100,
                    hintsEnabled: data.hintsEnabled ?? true
                });
            } else {
                // Room was deleted
                setRoom(null);
                setRoomCode(null);
            }
        });

        unsubscribeRoomRef.current = unsubscribe;
    }, []);

    // Subscribe to game state updates
    const subscribeToGame = useCallback((code: string) => {
        if (unsubscribeGameRef.current) unsubscribeGameRef.current();

        const gameRef = ref(database, dbPaths.roomGameState(code));
        const unsubscribe = onValue(gameRef, (snapshot) => {
            const data = snapshot.val();
            console.log('📥 Raw Firebase data:', data);

            if (data) {
                // Firebase converts arrays to objects - convert them back
                const convertedState = { ...data };

                // Convert board back to 2D array (7 rows x 7 cols)
                // Firebase may not store null/empty values, so we need to create explicit structure
                if (data.board) {
                    // Create a proper 7x7 board with nulls for empty cells
                    convertedState.board = [];
                    for (let row = 0; row < 7; row++) {
                        const rowData = data.board[row];
                        const convertedRow = [];
                        for (let col = 0; col < 7; col++) {
                            const cell = rowData && rowData[col] ? rowData[col] : null;
                            convertedRow.push(cell);
                        }
                        convertedState.board.push(convertedRow);
                    }
                } else {
                    // Create empty board if not present
                    convertedState.board = Array(7).fill(null).map(() => Array(7).fill(null));
                }

                // Convert players array and their racks
                if (data.players) {
                    const playersArr = Array.isArray(data.players)
                        ? data.players
                        : Object.values(data.players);
                    convertedState.players = playersArr.map((player: any) => ({
                        ...player,
                        rack: player.rack
                            ? (Array.isArray(player.rack) ? player.rack : Object.values(player.rack))
                            : []
                    }));
                }

                // Convert tileBag
                if (data.tileBag) {
                    convertedState.tileBag = Array.isArray(data.tileBag)
                        ? data.tileBag
                        : Object.values(data.tileBag);
                }

                // Convert claimedWords
                if (data.claimedWords) {
                    convertedState.claimedWords = Array.isArray(data.claimedWords)
                        ? data.claimedWords
                        : Object.values(data.claimedWords);
                } else {
                    convertedState.claimedWords = [];
                }

                console.log('📥 Converted game state:', convertedState);
                console.log('📥 Board is array?', Array.isArray(convertedState.board), 'length:', convertedState.board?.length);
                setGameState(convertedState as GameState);
                // Clear tiles placed this turn when turn changes
                setTilesPlacedThisTurn([]);
            }
        });

        unsubscribeGameRef.current = unsubscribe;
    }, []);

    // Active game tracking helpers (for rejoin functionality)
    const setActiveGame = useCallback(async (code: string, uid?: string) => {
        if (!uid) return;
        try {
            await set(ref(database, dbPaths.activeGame(uid)), {
                roomCode: code,
                playerId,
                joinedAt: Date.now()
            });
            console.log('💾 Active game saved for rejoin:', code);
        } catch (err) {
            console.error('Failed to save active game:', err);
        }
    }, [playerId]);

    const clearActiveGame = useCallback(async (uid?: string) => {
        if (!uid) return;
        try {
            await remove(ref(database, dbPaths.activeGame(uid)));
            console.log('🗑️ Active game cleared');
        } catch (err) {
            console.error('Failed to clear active game:', err);
        }
    }, []);

    const getActiveGame = useCallback(async (uid: string): Promise<{ roomCode: string; playerId: string } | null> => {
        try {
            const snapshot = await get(ref(database, dbPaths.activeGame(uid)));
            if (snapshot.exists()) {
                const data = snapshot.val();
                // Check if the room still exists
                const roomSnapshot = await get(ref(database, dbPaths.room(data.roomCode)));
                if (roomSnapshot.exists()) {
                    return data;
                } else {
                    // Room no longer exists, clean up
                    await remove(ref(database, dbPaths.activeGame(uid)));
                    return null;
                }
            }
            return null;
        } catch (err) {
            console.error('Failed to get active game:', err);
            return null;
        }
    }, []);

    // Room actions
    const createRoom = useCallback(async (playerName: string, targetScore = 100, hintsEnabled = true, uid?: string, photoURL?: string) => {
        if (!playerId) return;

        try {
            const code = generateRoomCode();
            const player: RoomPlayer = {
                id: playerId,
                name: playerName,
                isReady: false,
                isHost: true,
                color: PLAYER_COLORS[0],
                ...(uid && { uid }),
                ...(photoURL && { photoURL })
            };

            const roomData = {
                code,
                hostId: playerId,
                status: 'waiting' as const,
                maxPlayers: 4,
                targetScore,
                hintsEnabled,
                players: { [playerId]: player },
                createdAt: Date.now()
            };

            await set(ref(database, dbPaths.room(code)), roomData);
            setRoomCode(code);
            subscribeToRoom(code);
            // Track active game for rejoin functionality
            await setActiveGame(code, uid);
            console.log('📦 Room created:', code);
        } catch (err) {
            setError('Failed to create room');
            console.error(err);
        }
    }, [playerId, subscribeToRoom, setActiveGame]);

    const joinRoom = useCallback(async (code: string, playerName: string, uid?: string, photoURL?: string) => {
        if (!playerId) return;

        try {
            const upperCode = code.toUpperCase();
            const roomRef = ref(database, dbPaths.room(upperCode));
            const snapshot = await get(roomRef);

            if (!snapshot.exists()) {
                setError('Room not found');
                return;
            }

            const roomData = snapshot.val();
            const players = roomData.players ? Object.values(roomData.players) as RoomPlayer[] : [];

            if (players.length >= 4) {
                setError('Room is full');
                return;
            }

            const player: RoomPlayer = {
                id: playerId,
                name: playerName,
                isReady: false,
                isHost: false,
                color: PLAYER_COLORS[players.length],
                ...(uid && { uid }),
                ...(photoURL && { photoURL })
            };

            await set(ref(database, dbPaths.roomPlayer(upperCode, playerId)), player);
            setRoomCode(upperCode);
            subscribeToRoom(upperCode);
            // Track active game for rejoin functionality
            await setActiveGame(upperCode, uid);
            console.log('✅ Joined room:', upperCode);
        } catch (err) {
            setError('Failed to join room');
            console.error(err);
        }
    }, [playerId, subscribeToRoom, setActiveGame]);

    const leaveRoom = useCallback(async (uid?: string) => {
        if (!roomCode || !playerId) return;

        try {
            // Remove player from room
            await remove(ref(database, dbPaths.roomPlayer(roomCode, playerId)));

            // Check if room is empty and delete it
            const roomRef = ref(database, dbPaths.roomPlayers(roomCode));
            const snapshot = await get(roomRef);
            if (!snapshot.exists() || Object.keys(snapshot.val() || {}).length === 0) {
                await remove(ref(database, dbPaths.room(roomCode)));
            }

            // Cleanup subscriptions
            if (unsubscribeRoomRef.current) unsubscribeRoomRef.current();
            if (unsubscribeGameRef.current) unsubscribeGameRef.current();

            setRoom(null);
            setRoomCode(null);
            setGameState(null);
            // Clear active game reference
            await clearActiveGame(uid);
            console.log('👋 Left room:', roomCode);
        } catch (err) {
            setError('Failed to leave room');
            console.error(err);
        }
    }, [roomCode, playerId, clearActiveGame]);

    const setReady = useCallback(async (ready: boolean) => {
        if (!roomCode || !playerId) return;

        try {
            await update(ref(database, dbPaths.roomPlayer(roomCode, playerId)), { isReady: ready });
        } catch (err) {
            setError('Failed to update ready status');
            console.error(err);
        }
    }, [roomCode, playerId]);

    const startGame = useCallback(async () => {
        console.log('🎮 startGame called', { roomCode, room, isHost, playerId });

        if (!roomCode || !room) {
            console.log('❌ Cannot start: no room');
            return;
        }
        if (!isHost) {
            console.log('❌ Cannot start: not host', { hostId: room.hostId, playerId });
            return;
        }

        try {
            // Get player names from room
            const playerNames = room.players.map((p: RoomPlayer) => p.name);
            console.log('👥 Creating game for players:', playerNames);

            // Create game state using GameStateManager
            const gameManager = GameStateManager.createNewGame(
                room.players.length,
                playerNames,
                room.targetScore || 100
            );

            const initialState = gameManager.getState();

            // Update player colors to match room
            initialState.players = initialState.players.map((p, idx) => ({
                ...p,
                color: room.players[idx]?.color || PLAYER_COLORS[idx]
            }));

            // Save game state and update room status to 'playing'
            await set(ref(database, dbPaths.roomGameState(roomCode)), initialState);
            await update(ref(database, dbPaths.room(roomCode)), { status: 'playing' });

            subscribeToGame(roomCode);
            console.log('🎮 Game started in room:', roomCode);
        } catch (err) {
            setError('Failed to start game');
            console.error('❌ Error starting game:', err);
        }
    }, [roomCode, room, isHost, playerId, subscribeToGame]);

    // Game actions - these work with the batch update system
    // The actual game logic happens locally in App.tsx via localMultiplayerEngine
    // These are called when submitting the turn to sync to Firebase

    const placeTiles = useCallback(async (placements: Array<{ column: number; tileIndex: number }>) => {
        // In batch mode, tiles are placed locally first
        // This is called during submit to sync final state
        console.log('📤 Firebase: placeTiles called (batch mode)', placements);
    }, []);

    const claimWords = useCallback(async (claims: Array<{ positions: Position[] }>) => {
        if (!roomCode || !gameState || !playerId) return;

        // In batch mode, the full game state is synced after local validation
        // For now, we'll sync the complete game state
        console.log('📤 Firebase: claimWords called', claims);

        // The actual sync happens via syncGameState below
    }, [roomCode, gameState, playerId]);

    const swapTiles = useCallback(async (tileIndices: number[]) => {
        console.log('📤 Firebase: swapTiles called', tileIndices);
        // TODO: Implement swap via Firebase
    }, []);

    const endTurn = useCallback(async () => {
        console.log('📤 Firebase: endTurn called');
        // Pass turn is handled by syncing game state with updated currentPlayerId
    }, []);

    const removeTile = useCallback(async (column: number, row: number) => {
        // In batch mode, removals happen locally
        console.log('📤 Firebase: removeTile called', { column, row });
    }, []);

    const setBlankLetter = useCallback(async (x: number, y: number, letter: string) => {
        console.log('📤 Firebase: setBlankLetter called', { x, y, letter });
        // Blank letter is set locally, synced with full state on submit
    }, []);

    const requestNewGame = useCallback(async () => {
        if (!roomCode || !playerId || !room) return;

        const myPlayer = room.players.find(p => p.id === playerId);
        await set(ref(database, `${dbPaths.room(roomCode)}/newGameRequest`), {
            requesterId: playerId,
            requesterName: myPlayer?.name || 'Unknown'
        });
    }, [roomCode, playerId, room]);

    const respondNewGame = useCallback(async (accepted: boolean) => {
        if (!roomCode) return;

        if (accepted) {
            // Restart game
            await startGame();
        }
        // Clear the request
        await remove(ref(database, `${dbPaths.room(roomCode)}/newGameRequest`));
    }, [roomCode, startGame]);

    // Sync complete game state to Firebase (for batch update mode)
    const syncGameState = useCallback(async (newState: GameState) => {
        if (!roomCode) {
            console.error('❌ Cannot sync: no roomCode');
            return;
        }

        try {
            console.log('📤 Syncing game state to Firebase...', newState);
            await set(ref(database, dbPaths.roomGameState(roomCode)), newState);
            console.log('✅ Game state synced to Firebase');
        } catch (err) {
            console.error('❌ Failed to sync game state:', err);
            setError('Failed to sync game state');
        }
    }, [roomCode]);

    // Subscribe to game when room has game state
    useEffect(() => {
        if (roomCode && room) {
            // Check if game exists
            const gameRef = ref(database, dbPaths.roomGameState(roomCode));
            get(gameRef).then((snapshot) => {
                if (snapshot.exists()) {
                    subscribeToGame(roomCode);
                }
            });
        }
    }, [roomCode, room, subscribeToGame]);

    return {
        connected,
        roomCode,
        room,
        isHost,
        playerId,
        gameState,
        tilesPlacedThisTurn,
        error,
        clearError,
        newGameRequest,
        newGameDeclined,
        clearNewGameRequest,
        clearNewGameDeclined,
        createRoom,
        joinRoom,
        leaveRoom,
        setReady,
        startGame,
        placeTiles,
        claimWords,
        swapTiles,
        endTurn,
        removeTile,
        setBlankLetter,
        requestNewGame,
        respondNewGame,
        syncGameState,
        // Active game (for rejoin)
        getActiveGame
    };
}
