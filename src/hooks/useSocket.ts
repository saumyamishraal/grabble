/**
 * Socket.IO React Hook
 * Manages WebSocket connection to Grabble server
 */

import { useEffect, useState, useCallback, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import type { GameState } from '../types';
import type { Room, RoomPlayer, ServerToClientEvents } from '../server-types';

// Server URL - configurable via environment variable or config
// For GitHub Pages: set REACT_APP_SOCKET_URL in build, or it will try to connect to same hostname:3001
// For production: use your deployed server URL (e.g., https://your-app.railway.app)
const getSocketUrl = (): string => {
    // Check for environment variable (set at build time)
    if (process.env.REACT_APP_SOCKET_URL) {
        return process.env.REACT_APP_SOCKET_URL;
    }

    // Check if we're on GitHub Pages (saumyamishraal.github.io)
    if (window.location.hostname.includes('github.io')) {
        // Replace with your actual server URL after deployment
        // Example: return 'https://grabble-server.railway.app';
        return 'https://your-server-url.railway.app'; // TODO: Replace with your actual server URL
    }

    // Default: localhost for development
    return `http://${window.location.hostname}:3001`;
};

const SOCKET_URL = getSocketUrl();
console.log('🔌 Socket URL:', SOCKET_URL, 'from hostname:', window.location.hostname);

// Types imported from server/types.ts

interface UseSocketReturn {
    // Connection state
    socket: Socket | null;
    connected: boolean;

    // Room state
    roomCode: string | null;
    room: Room | null;
    isHost: boolean;
    playerId: string | null;

    // Game state
    gameState: GameState | null;
    tilesPlacedThisTurn: Array<{ x: number; y: number }>;  // NEW: Track placed tiles for current turn

    // Error handling
    error: string | null;
    clearError: () => void;
    
    // New game request state
    newGameRequest: { requesterId: string; requesterName: string } | null;
    newGameDeclined: { playerName: string } | null;
    clearNewGameRequest: () => void;
    clearNewGameDeclined: () => void;

    // Room actions
    createRoom: (playerName: string, targetScore?: number) => void;
    joinRoom: (roomCode: string, playerName: string) => void;
    leaveRoom: () => void;
    setReady: (ready: boolean) => void;
    startGame: () => void;

    // Game actions
    placeTiles: (placements: Array<{ column: number; tileIndex: number }>) => void;
    claimWords: (claims: Array<{ positions: Array<{ x: number; y: number }> }>) => void;
    swapTiles: (tileIndices: number[]) => void;
    endTurn: () => void;
    removeTile: (column: number, row: number) => void;
    setBlankLetter: (x: number, y: number, letter: string) => void;
    requestNewGame: () => void;
    respondNewGame: (accepted: boolean) => void;
}

export function useSocket(): UseSocketReturn {
    const socketRef = useRef<Socket | null>(null);
    const [connected, setConnected] = useState(false);
    const [roomCode, setRoomCode] = useState<string | null>(null);
    const [room, setRoom] = useState<Room | null>(null);
    const [playerId, setPlayerId] = useState<string | null>(null);
    const [gameState, setGameState] = useState<GameState | null>(null);
    const [tilesPlacedThisTurn, setTilesPlacedThisTurn] = useState<Array<{ x: number; y: number }>>([]);
    const [error, setError] = useState<string | null>(null);
    const [newGameRequest, setNewGameRequest] = useState<{ requesterId: string; requesterName: string } | null>(null);
    const [newGameDeclined, setNewGameDeclined] = useState<{ playerName: string } | null>(null);

    // Initialize socket connection
    useEffect(() => {
        // Singleton pattern: reuse existing socket if available
        // This prevents hot-reload from disconnecting players
        if (socketRef.current?.connected) {
            console.log('♻️ Reusing existing socket connection');
            setConnected(true);
            setPlayerId(socketRef.current.id || null);
            return;
        }

        // Only create new socket if none exists
        if (!socketRef.current) {
            const socket = io(SOCKET_URL, {
                autoConnect: true,
                reconnection: true,
                reconnectionAttempts: 10,
                reconnectionDelay: 1000,
                reconnectionDelayMax: 5000,
                timeout: 20000,
                transports: ['websocket', 'polling'], // Try websocket first, fallback to polling
                upgrade: true,
                rememberUpgrade: false
            });

            socketRef.current = socket;
            console.log('🔌 Creating new socket connection');
        }

        const socket = socketRef.current;

        // Connection events
        socket.on('connect', () => {
            console.log('✅ Connected to server at', SOCKET_URL);
            setConnected(true);
            setPlayerId(socket.id || null);
        });

        socket.on('connect_error', (error) => {
            console.error('❌ Socket connection error:', error.message, 'trying to connect to:', SOCKET_URL);
            setError(`Connection failed: ${error.message}. Server URL: ${SOCKET_URL}`);
        });

        socket.on('disconnect', (reason) => {
            console.log('🔌 Disconnected from server. Reason:', reason);
            setConnected(false);
            // Don't clear playerId on disconnect - allow reconnection
        });

        socket.on('reconnect', (attemptNumber) => {
            console.log('🔄 Reconnected after', attemptNumber, 'attempts');
            setConnected(true);
            setPlayerId(socket.id || null);
        });

        // Room events
        socket.on('room_created', (data: Parameters<ServerToClientEvents['room_created']>[0]) => {
            const { roomCode, room } = data;
            console.log(`📦 Room created: ${roomCode}`);
            setRoomCode(roomCode);
            setRoom(room);
        });

        socket.on('room_joined', (data: Parameters<ServerToClientEvents['room_joined']>[0]) => {
            const { room, playerId } = data;
            console.log(`📦 Joined room: ${room.code}`);
            setRoomCode(room.code);
            setRoom(room);
            setPlayerId(playerId);
        });

        socket.on('room_state', (room: Parameters<ServerToClientEvents['room_state']>[0]) => {
            setRoom(room);
        });

        socket.on('player_joined', (player: Parameters<ServerToClientEvents['player_joined']>[0]) => {
            setRoom(prev => {
                if (!prev) return null;
                return {
                    ...prev,
                    players: [...prev.players, player]
                };
            });
        });

        socket.on('player_left', (leftPlayerId: Parameters<ServerToClientEvents['player_left']>[0]) => {
            setRoom(prev => {
                if (!prev) return null;
                return {
                    ...prev,
                    players: prev.players.filter(p => p.id !== leftPlayerId)
                };
            });
        });

        socket.on('player_ready', (data: Parameters<ServerToClientEvents['player_ready']>[0]) => {
            const { playerId, ready } = data;
            setRoom(prev => {
                if (!prev) return null;
                return {
                    ...prev,
                    players: prev.players.map(p =>
                        p.id === playerId ? { ...p, isReady: ready } : p
                    )
                };
            });
        });

        // Game events
        socket.on('game_started', (gameState: Parameters<ServerToClientEvents['game_started']>[0]) => {
            console.log('🎮 Game started');
            setGameState(gameState);
            setRoom(prev => prev ? { ...prev, status: 'playing' } : null);
        });

        socket.on('game_state', (gameState: Parameters<ServerToClientEvents['game_state']>[0]) => {
            setGameState(gameState);
        });

        socket.on('tiles_placed', (data: Parameters<ServerToClientEvents['tiles_placed']>[0]) => {
            const { gameState } = data;
            // Type cast needed because TypeScript may cache the old type
            const placedPositions = (data as any).placedPositions as Array<{ x: number; y: number }> | undefined;
            console.log('📥 Received tiles_placed, placedPositions:', placedPositions);
            setGameState(gameState);
            // Accumulate placed tiles for this turn
            if (placedPositions) {
                setTilesPlacedThisTurn(prev => {
                    const updated = [...prev, ...placedPositions];
                    console.log('📍 Updated tilesPlacedThisTurn:', updated);
                    return updated;
                });
            }
        });

        socket.on('words_claimed', (data: Parameters<ServerToClientEvents['words_claimed']>[0]) => {
            const { gameState } = data;
            setGameState(gameState);
        });

        socket.on('tiles_swapped', (data: Parameters<ServerToClientEvents['tiles_swapped']>[0]) => {
            const { gameState } = data;
            console.log('🔄 Tiles swapped, clearing turn state');
            setGameState(gameState);
            setTilesPlacedThisTurn([]); // Clear placed tiles tracking
        });

        socket.on('tile_removed', (data: any) => {
            const { gameState, removedPosition } = data as any; // Type cast to handle cached types
            setGameState(gameState);
            // Update tilesPlacedThisTurn: remove the deleted position and adjust positions above it
            // After gravity, tiles above the removed tile move down by 1 row
            setTilesPlacedThisTurn(prev =>
                prev
                    .filter(pos => !(pos.x === removedPosition.x && pos.y === removedPosition.y)) // Remove deleted tile
                    .map(pos => {
                        // If tile is in same column and above removed position, it moved down
                        if (pos.x === removedPosition.x && pos.y < removedPosition.y) {
                            return { x: pos.x, y: pos.y + 1 };
                        }
                        return pos;
                    })
            );
        });

        socket.on('turn_changed', (data: Parameters<ServerToClientEvents['turn_changed']>[0]) => {
            const { gameState } = data;
            setGameState(gameState);
            // Clear tiles placed when turn changes
            setTilesPlacedThisTurn([]);
        });

        socket.on('game_ended', (data: Parameters<ServerToClientEvents['game_ended']>[0]) => {
            const { winnerId, finalState } = data;
            console.log(`🏆 Game ended! Winner: ${winnerId}`);
            setGameState(finalState);
            setRoom(prev => prev ? { ...prev, status: 'finished' } : null);
        });

        socket.on('blank_letter_set', (data: any) => {
            const { gameState } = data;
            console.log('📝 Blank letter set:', data.x, data.y, data.letter);
            setGameState(gameState);
        });

        // New game request handlers
        socket.on('new_game_request_sent', () => {
            console.log('📤 New game request sent');
        });

        socket.on('new_game_requested', (data: { requesterId: string; requesterName: string }) => {
            console.log('🔄 New game requested by:', data.requesterName, 'requesterId:', data.requesterId, 'my playerId:', socket.id);
            setNewGameRequest(data);
        });

        socket.on('new_game_response', (data: { playerId: string; playerName: string; accepted: boolean }) => {
            console.log(`📝 ${data.playerName} ${data.accepted ? 'accepted' : 'declined'} new game request`);
        });

        socket.on('new_game_all_accepted', (data: { gameState: GameState }) => {
            console.log('✅ All players accepted - starting new game, new gameState:', data.gameState);
            setGameState(data.gameState);
            setTilesPlacedThisTurn([]);
            setNewGameRequest(null); // Clear request when all accepted
            setNewGameDeclined(null); // Also clear any declined state
        });

        socket.on('new_game_declined', (data: { playerName: string }) => {
            console.log(`❌ New game declined by ${data.playerName}`);
            setNewGameDeclined(data);
            setNewGameRequest(null); // Clear request when declined
        });

        // Error handling
        socket.on('error', (data: Parameters<ServerToClientEvents['error']>[0]) => {
            const { message } = data;
            console.error('❌ Socket error:', message);
            setError(message);
        });

        // Cleanup on unmount - DON'T disconnect socket during hot reload
        // Only remove event listeners to prevent duplicate handlers
        return () => {
            // Note: We intentionally don't call socket.disconnect() here
            // This allows the socket to persist across React hot reloads
            // The socket will disconnect when the browser tab closes
            console.log('🔄 Component unmounting, keeping socket alive');
        };
    }, []);

    // Computed values
    const isHost = room?.hostId === playerId;

    // Actions
    const createRoom = useCallback((playerName: string, targetScore = 100) => {
        socketRef.current?.emit('create_room', { playerName, targetScore });
    }, []);

    const joinRoom = useCallback((code: string, playerName: string) => {
        socketRef.current?.emit('join_room', { roomCode: code, playerName });
    }, []);

    const leaveRoom = useCallback(() => {
        socketRef.current?.emit('leave_room');
        setRoomCode(null);
        setRoom(null);
        setGameState(null);
    }, []);

    const setReady = useCallback((ready: boolean) => {
        socketRef.current?.emit('set_ready', ready);
    }, []);

    const startGame = useCallback(() => {
        socketRef.current?.emit('start_game');
    }, []);

    const placeTiles = useCallback((placements: Array<{ column: number; tileIndex: number }>) => {
        socketRef.current?.emit('place_tiles', { placements });
    }, []);

    const claimWords = useCallback((claims: Array<{ positions: Array<{ x: number; y: number }> }>) => {
        socketRef.current?.emit('claim_words', { claims });
    }, []);

    const swapTiles = useCallback((tileIndices: number[]) => {
        socketRef.current?.emit('swap_tiles', { tileIndices });
    }, []);

    const endTurn = useCallback(() => {
        if (!socketRef.current) return;
        socketRef.current.emit('end_turn');
    }, []);

    const removeTile = useCallback((column: number, row: number) => {
        if (!socketRef.current) return;
        socketRef.current.emit('remove_tile', { column, row });
    }, []);

    const setBlankLetter = useCallback((x: number, y: number, letter: string) => {
        if (!socketRef.current) return;
        socketRef.current.emit('set_blank_letter', { x, y, letter });
    }, []);

    const requestNewGame = useCallback(() => {
        if (!socketRef.current) return;
        socketRef.current.emit('request_new_game');
    }, []);

    const respondNewGame = useCallback((accepted: boolean) => {
        if (!socketRef.current) return;
        socketRef.current.emit('respond_new_game', { accepted });
    }, []);

    const clearError = useCallback(() => {
        setError(null);
    }, []);

    const clearNewGameRequest = useCallback(() => {
        setNewGameRequest(null);
    }, []);

    const clearNewGameDeclined = useCallback(() => {
        setNewGameDeclined(null);
    }, []);

    return {
        socket: socketRef.current,
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
    };
}
