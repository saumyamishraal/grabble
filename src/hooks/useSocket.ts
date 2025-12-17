/**
 * Socket.IO React Hook
 * Manages WebSocket connection to Grabble server
 */

import { useEffect, useState, useCallback, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import type { GameState } from '../types';
import type { Room, RoomPlayer, ServerToClientEvents } from '../../server/types';

// Server URL - configurable, or defaults to the same host as the React app but on port 3001
const SOCKET_URL = process.env.REACT_APP_SOCKET_URL || `http://${window.location.hostname}:3001`;

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

    // Error handling
    error: string | null;
    clearError: () => void;

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
}

export function useSocket(): UseSocketReturn {
    const socketRef = useRef<Socket | null>(null);
    const [connected, setConnected] = useState(false);
    const [roomCode, setRoomCode] = useState<string | null>(null);
    const [room, setRoom] = useState<Room | null>(null);
    const [playerId, setPlayerId] = useState<string | null>(null);
    const [gameState, setGameState] = useState<GameState | null>(null);
    const [error, setError] = useState<string | null>(null);

    // Initialize socket connection
    useEffect(() => {
        const socket = io(SOCKET_URL, {
            autoConnect: true,
            reconnection: true,
            reconnectionAttempts: 5,
            reconnectionDelay: 1000
        });

        socketRef.current = socket;

        // Connection events
        socket.on('connect', () => {
            console.log('🔌 Connected to server');
            setConnected(true);
            setPlayerId(socket.id || null);
        });

        socket.on('disconnect', () => {
            console.log('🔌 Disconnected from server');
            setConnected(false);
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
            setGameState(gameState);
        });

        socket.on('words_claimed', (data: Parameters<ServerToClientEvents['words_claimed']>[0]) => {
            const { gameState } = data;
            setGameState(gameState);
        });

        socket.on('tiles_swapped', (data: Parameters<ServerToClientEvents['tiles_swapped']>[0]) => {
            const { gameState } = data;
            setGameState(gameState);
        });

        socket.on('turn_changed', (data: Parameters<ServerToClientEvents['turn_changed']>[0]) => {
            const { gameState } = data;
            setGameState(gameState);
        });

        socket.on('game_ended', (data: Parameters<ServerToClientEvents['game_ended']>[0]) => {
            const { winnerId, finalState } = data;
            console.log(`🏆 Game ended! Winner: ${winnerId}`);
            setGameState(finalState);
            setRoom(prev => prev ? { ...prev, status: 'finished' } : null);
        });

        // Error handling
        socket.on('error', (data: Parameters<ServerToClientEvents['error']>[0]) => {
            const { message } = data;
            console.error('❌ Socket error:', message);
            setError(message);
        });

        // Cleanup on unmount
        return () => {
            socket.disconnect();
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
        socketRef.current?.emit('end_turn');
    }, []);

    const clearError = useCallback(() => {
        setError(null);
    }, []);

    return {
        socket: socketRef.current,
        connected,
        roomCode,
        room,
        isHost,
        playerId,
        gameState,
        error,
        clearError,
        createRoom,
        joinRoom,
        leaveRoom,
        setReady,
        startGame,
        placeTiles,
        claimWords,
        swapTiles,
        endTurn
    };
}
