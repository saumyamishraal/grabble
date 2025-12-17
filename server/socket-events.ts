/**
 * Socket.IO Event Handlers
 * Handles all real-time game communication
 */

import { Server, Socket } from 'socket.io';
import { RoomManager } from './room-manager';
import type { ClientToServerEvents, ServerToClientEvents, SocketData } from './types';
import { GameStateManager } from '../src/game-state-manager';
import { loadDictionary } from './dictionary';
import type { TilePlacement, WordClaim, Position } from '../src/types';

// Dictionary for word validation
let dictionary: Set<string> = new Set();

// Store game managers per room
const gameManagers: Map<string, GameStateManager> = new Map();

export function setupSocketEvents(
    io: Server<ClientToServerEvents, ServerToClientEvents, {}, SocketData>,
    roomManager: RoomManager
) {
    // Load dictionary on startup
    loadDictionary().then(dict => {
        dictionary = dict;
        console.log(`📚 Dictionary loaded with ${dictionary.size} words`);
    });

    io.on('connection', (socket) => {
        console.log(`🔌 Client connected: ${socket.id}`);

        // Initialize socket data
        socket.data.playerId = socket.id;
        socket.data.roomCode = null;

        /**
         * Create a new room
         */
        socket.on('create_room', ({ playerName, targetScore = 100 }) => {
            try {
                // Leave any existing room
                if (socket.data.roomCode) {
                    handleLeaveRoom(socket, io, roomManager);
                }

                const room = roomManager.createRoom(socket.id, playerName, targetScore);
                socket.data.playerName = playerName;
                socket.data.roomCode = room.code;

                // Join socket.io room for broadcasting
                socket.join(room.code);

                socket.emit('room_created', { roomCode: room.code, room });
                console.log(`✅ Room ${room.code} created for ${playerName}`);
            } catch (error: any) {
                socket.emit('error', { message: error.message });
            }
        });

        /**
         * Join existing room
         */
        socket.on('join_room', ({ roomCode, playerName }) => {
            try {
                const targetRoomCode = roomCode.toUpperCase();

                // Check if already in this room
                if (socket.data.roomCode === targetRoomCode) {
                    // Update name if changed
                    const room = roomManager.getRoom(targetRoomCode);
                    if (room) {
                        const player = room.players.find(p => p.id === socket.id);
                        if (player) {
                            player.name = playerName;
                            socket.data.playerName = playerName;
                            socket.emit('room_joined', { room, playerId: socket.id });
                            return;
                        }
                    }
                }

                // Leave any existing room (if different)
                if (socket.data.roomCode && socket.data.roomCode !== targetRoomCode) {
                    handleLeaveRoom(socket, io, roomManager);
                }

                const result = roomManager.joinRoom(targetRoomCode, socket.id, playerName);

                if (!result.success) {
                    socket.emit('error', { message: result.error || 'Failed to join room' });
                    return;
                }

                socket.data.playerName = playerName;
                socket.data.roomCode = roomCode.toUpperCase();

                // Join socket.io room
                socket.join(roomCode.toUpperCase());

                // Notify the joiner
                socket.emit('room_joined', {
                    room: result.room!,
                    playerId: socket.id
                });

                // Notify others in the room
                const player = result.room!.players.find(p => p.id === socket.id);
                if (player) {
                    socket.to(roomCode.toUpperCase()).emit('player_joined', player);
                }

                console.log(`✅ ${playerName} joined room ${roomCode}`);
            } catch (error: any) {
                socket.emit('error', { message: error.message });
            }
        });

        /**
         * Leave room
         */
        socket.on('leave_room', () => {
            handleLeaveRoom(socket, io, roomManager);
        });

        /**
         * Set ready status
         */
        socket.on('set_ready', (ready) => {
            const room = roomManager.setPlayerReady(socket.id, ready);
            if (room) {
                io.to(room.code).emit('player_ready', { playerId: socket.id, ready });
            }
        });

        /**
         * Start the game (host only)
         */
        socket.on('start_game', () => {
            const room = roomManager.getRoomByPlayer(socket.id);
            if (!room) {
                socket.emit('error', { message: 'Not in a room' });
                return;
            }

            if (room.hostId !== socket.id) {
                socket.emit('error', { message: 'Only the host can start the game' });
                return;
            }

            if (!roomManager.areAllPlayersReady(room.code)) {
                socket.emit('error', { message: 'Not all players are ready' });
                return;
            }

            if (room.players.length < 2) {
                socket.emit('error', { message: 'Need at least 2 players to start' });
                return;
            }

            try {
                // Create game with player names from room
                const playerNames = room.players.map(p => p.name);
                const manager = GameStateManager.createNewGame(
                    room.players.length,
                    playerNames,
                    room.targetScore
                );

                gameManagers.set(room.code, manager);
                roomManager.setRoomStatus(room.code, 'playing');
                roomManager.updateGameState(room.code, manager.getState());

                const gameState = manager.getState();
                io.to(room.code).emit('game_started', gameState);
                console.log(`🎮 Game started in room ${room.code}`);
            } catch (error: any) {
                socket.emit('error', { message: error.message });
            }
        });

        /**
         * Place tiles on board
         */
        socket.on('place_tiles', async ({ placements }) => {
            const room = roomManager.getRoomByPlayer(socket.id);
            if (!room || room.status !== 'playing') {
                socket.emit('error', { message: 'Game not in progress' });
                return;
            }

            const manager = gameManagers.get(room.code);
            if (!manager) {
                socket.emit('error', { message: 'Game not found' });
                return;
            }

            const playerId = roomManager.getGamePlayerId(socket.id);
            if (playerId === undefined) {
                socket.emit('error', { message: 'Player not found' });
                return;
            }

            const state = manager.getState();
            if (state.currentPlayerId !== playerId) {
                socket.emit('error', { message: 'Not your turn' });
                return;
            }

            try {
                const engine = manager.getEngine();
                const player = state.players.find(p => p.id === playerId);
                if (!player) {
                    socket.emit('error', { message: 'Player not found' });
                    return;
                }

                // Convert placements to TilePlacement format
                const tilePlacements: TilePlacement[] = placements.map(p => ({
                    column: p.column,
                    tile: player.rack[p.tileIndex]
                }));

                // Place tiles
                engine.placeTiles(tilePlacements, playerId);

                // Remove placed tiles from rack (in reverse order to maintain indices)
                const indices = placements.map(p => p.tileIndex).sort((a, b) => b - a);
                for (const idx of indices) {
                    player.rack.splice(idx, 1);
                }

                const newState = manager.getState();
                roomManager.updateGameState(room.code, newState);

                io.to(room.code).emit('tiles_placed', {
                    playerId: socket.id,
                    gameState: newState
                });
            } catch (error: any) {
                socket.emit('error', { message: error.message });
            }
        });

        /**
         * Claim words and end turn
         */
        socket.on('claim_words', async ({ claims }) => {
            const room = roomManager.getRoomByPlayer(socket.id);
            if (!room || room.status !== 'playing') {
                socket.emit('error', { message: 'Game not in progress' });
                return;
            }

            const manager = gameManagers.get(room.code);
            if (!manager) {
                socket.emit('error', { message: 'Game not found' });
                return;
            }

            const playerId = roomManager.getGamePlayerId(socket.id);
            if (playerId === undefined) {
                socket.emit('error', { message: 'Player not found' });
                return;
            }

            const state = manager.getState();
            if (state.currentPlayerId !== playerId) {
                socket.emit('error', { message: 'Not your turn' });
                return;
            }

            try {
                const engine = manager.getEngine();

                // Convert claims to WordClaim format
                const wordClaims: WordClaim[] = claims.map(c => ({
                    positions: c.positions as Position[],
                    playerId
                }));

                // Get newly placed tiles (tiles with this player's ID that were just placed)
                // For now, we'll track this on the client side and pass it
                // This is a simplification - in production, you'd track this server-side
                const newlyPlacedTiles: Position[] = []; // TODO: Track on server

                // Process word claims
                const results = await engine.processWordClaims(wordClaims, newlyPlacedTiles, dictionary);

                if (results.valid) {
                    // Refill rack and advance turn
                    engine.refillPlayerRack(playerId);
                    engine.advanceTurn();

                    // Check win condition
                    const winnerId = engine.checkWinCondition();
                    const newState = manager.getState();
                    roomManager.updateGameState(room.code, newState);

                    if (winnerId !== null) {
                        roomManager.setRoomStatus(room.code, 'finished');
                        io.to(room.code).emit('game_ended', {
                            winnerId,
                            finalState: newState
                        });
                    } else {
                        io.to(room.code).emit('words_claimed', {
                            playerId: socket.id,
                            results,
                            gameState: newState
                        });
                        io.to(room.code).emit('turn_changed', {
                            currentPlayerId: newState.currentPlayerId,
                            gameState: newState
                        });
                    }
                } else {
                    socket.emit('error', { message: 'Invalid word claims' });
                }
            } catch (error: any) {
                socket.emit('error', { message: error.message });
            }
        });

        /**
         * Swap tiles
         */
        socket.on('swap_tiles', ({ tileIndices }) => {
            const room = roomManager.getRoomByPlayer(socket.id);
            if (!room || room.status !== 'playing') {
                socket.emit('error', { message: 'Game not in progress' });
                return;
            }

            const manager = gameManagers.get(room.code);
            if (!manager) {
                socket.emit('error', { message: 'Game not found' });
                return;
            }

            const playerId = roomManager.getGamePlayerId(socket.id);
            if (playerId === undefined) {
                socket.emit('error', { message: 'Player not found' });
                return;
            }

            const state = manager.getState();
            if (state.currentPlayerId !== playerId) {
                socket.emit('error', { message: 'Not your turn' });
                return;
            }

            try {
                const engine = manager.getEngine();
                engine.swapTiles(playerId, tileIndices);
                engine.advanceTurn();

                const newState = manager.getState();
                roomManager.updateGameState(room.code, newState);

                io.to(room.code).emit('tiles_swapped', {
                    playerId: socket.id,
                    gameState: newState
                });
                io.to(room.code).emit('turn_changed', {
                    currentPlayerId: newState.currentPlayerId,
                    gameState: newState
                });
            } catch (error: any) {
                socket.emit('error', { message: error.message });
            }
        });

        /**
         * End turn without claiming words
         */
        socket.on('end_turn', () => {
            const room = roomManager.getRoomByPlayer(socket.id);
            if (!room || room.status !== 'playing') {
                socket.emit('error', { message: 'Game not in progress' });
                return;
            }

            const manager = gameManagers.get(room.code);
            if (!manager) {
                socket.emit('error', { message: 'Game not found' });
                return;
            }

            const playerId = roomManager.getGamePlayerId(socket.id);
            if (playerId === undefined) {
                socket.emit('error', { message: 'Player not found' });
                return;
            }

            const state = manager.getState();
            if (state.currentPlayerId !== playerId) {
                socket.emit('error', { message: 'Not your turn' });
                return;
            }

            try {
                const engine = manager.getEngine();
                engine.refillPlayerRack(playerId);
                engine.advanceTurn();

                const newState = manager.getState();
                roomManager.updateGameState(room.code, newState);

                io.to(room.code).emit('turn_changed', {
                    currentPlayerId: newState.currentPlayerId,
                    gameState: newState
                });
            } catch (error: any) {
                socket.emit('error', { message: error.message });
            }
        });

        /**
         * Handle disconnection
         */
        socket.on('disconnect', () => {
            console.log(`🔌 Client disconnected: ${socket.id}`);
            handleLeaveRoom(socket, io, roomManager);
        });
    });
}

/**
 * Helper to handle leaving a room
 */
function handleLeaveRoom(
    socket: Socket<ClientToServerEvents, ServerToClientEvents, {}, SocketData>,
    io: Server<ClientToServerEvents, ServerToClientEvents, {}, SocketData>,
    roomManager: RoomManager
) {
    const { roomCode, room, wasHost } = roomManager.leaveRoom(socket.id);

    if (roomCode) {
        socket.leave(roomCode);
        socket.data.roomCode = null;

        if (room) {
            // Notify remaining players
            io.to(roomCode).emit('player_left', socket.id);
            io.to(roomCode).emit('room_state', room);
        }
    }
}
