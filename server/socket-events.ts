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

// Track tiles placed by players in the current turn (socket.id -> positions)
const playerTurnTiles = new Map<string, Position[]>();

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

        // Clear turn tiles on disconnect
        socket.on('disconnect', () => {
            playerTurnTiles.delete(socket.id);
        });

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

                // Clear any stored turn tiles from previous games
                room.players.forEach(p => playerTurnTiles.delete(p.id));

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

                // Get state before placement to track where tiles land
                const prevState = manager.getState();

                console.log(`📥 Place tiles request from ${player.name} (${playerId}):`, placements);
                console.log('Rack before placement:', player.rack.map(t => t.letter).join(','));

                // Convert placements to TilePlacement format
                const tilePlacements: TilePlacement[] = placements.map(p => ({
                    column: p.column,
                    tile: player.rack[p.tileIndex]
                }));

                // Place tiles
                engine.placeTiles(tilePlacements, playerId);

                // Remove placed tiles from rack using engine method (this modifies internal state)
                const indices = placements.map(p => p.tileIndex);
                const removedTiles = engine.removeTilesFromRack(playerId, indices);
                console.log('Removed tiles from rack:', removedTiles.map(t => t?.letter).join(','));

                const newState = manager.getState();
                console.log('Rack after placement:', newState.players.find(p => p.id === playerId)?.rack.map(t => t.letter).join(','));

                // Calculate where tiles actually landed (after gravity)
                const placedPositions: Position[] = [];
                for (const placement of tilePlacements) {
                    const column = placement.column;
                    // Find where the new tile landed in this column
                    for (let row = 6; row >= 0; row--) {
                        const boardTile = newState.board[row][column];
                        const prevTile = prevState.board[row][column];
                        // Tile exists now but didn't before, or changed ownership
                        if (boardTile && (!prevTile || prevTile.playerId !== playerId) && boardTile.playerId === playerId) {
                            placedPositions.push({ x: column, y: row });
                            break;
                        }
                    }
                }

                // Update server-side turn tracking
                const currentTurnTiles = playerTurnTiles.get(socket.id) || [];
                playerTurnTiles.set(socket.id, [...currentTurnTiles, ...placedPositions]);

                console.log('📤 Sending tiles_placed with placedPositions:', placedPositions);

                roomManager.updateGameState(room.code, newState);

                io.to(room.code).emit('tiles_placed', {
                    playerId: socket.id,
                    gameState: newState,
                    placedPositions  // NEW: Include where tiles landed
                });
            } catch (error: any) {
                console.error('Error placing tiles:', error);
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

            console.log(`📥 Claim words request from ${playerId}:`, JSON.stringify(claims));

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

                // Retrieve tiles placed this turn by this player
                const newlyPlacedTiles = playerTurnTiles.get(socket.id) || [];

                // Validate with dictionary (use global directory variable)
                console.log('Validating with dictionary size:', dictionary.size);

                // Convert socket claims { positions: {x,y}[] } to WordClaim[] { positions: [], playerId }
                const wordClaims: WordClaim[] = claims.map(c => ({
                    positions: c.positions,
                    playerId
                }));

                const result = await engine.processWordClaims(wordClaims, newlyPlacedTiles, dictionary);

                console.log('Validation result:', JSON.stringify(result));

                if (!result.valid) {
                    // Collect all error messages, filtering out undefined values
                    const errorMessages = result.results
                        .map(r => r.error)
                        .filter((error): error is string => error !== undefined && error.length > 0);
                    
                    if (errorMessages.length > 0) {
                        socket.emit('error', { message: 'Invalid word claims: ' + errorMessages.join('. ') });
                    } else {
                        socket.emit('error', { message: 'Invalid word claims. Please check your word selection.' });
                    }
                    return;
                }

                // Validation passed
                player.score += result.totalScore;
                engine.refillPlayerRack(playerId);
                engine.advanceTurn();

                // Clear turn tiles for this player
                playerTurnTiles.delete(socket.id);

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
                        playerId,
                        results: result,
                        gameState: newState
                    });

                    io.to(room.code).emit('turn_changed', {
                        currentPlayerId: newState.currentPlayerId,
                        gameState: newState
                    });
                }
            } catch (error: any) {
                console.error('Error claiming words:', error);
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

                // Remove all tiles placed this turn from the board and return to rack
                const placedTilesThisTurn = playerTurnTiles.get(socket.id) || [];
                console.log(`🔄 Swapping tiles for player ${playerId}, removing ${placedTilesThisTurn.length} placed tiles first`);

                for (const pos of placedTilesThisTurn) {
                    const removedTile = engine.removeTile(pos.x, pos.y);
                    if (removedTile) {
                        engine.returnTileToRack(playerId, removedTile);
                        console.log(`  ↩️ Removed tile at (${pos.x}, ${pos.y}) and returned to rack`);
                    }
                }

                // Now swap the selected tiles
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

                // Clear turn tiles
                playerTurnTiles.delete(socket.id);
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

                // Clear turn tiles
                playerTurnTiles.delete(socket.id);
            } catch (error: any) {
                socket.emit('error', { message: error.message });
            }
        });

        /**
         * Remove a tile
         */
        socket.on('remove_tile', async ({ column, row }) => {
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
                const gameEngine = manager.getEngine();
                const tile = state.board[row][column];

                if (!tile) {
                    // Tile might already be gone
                    return;
                }

                // Verify ownership
                if (tile.playerId !== playerId) {
                    socket.emit('error', { message: 'You can only remove your own tiles' });
                    return;
                }

                // Verify tile was placed this turn (can only remove tiles placed in current turn)
                // Note: After gravity, tiles move down, so we check if ANY tile in this column
                // was placed this turn, and if the tile at this position belongs to the player
                const tilesPlacedThisTurn = playerTurnTiles.get(socket.id) || [];
                // Check if any tile in this column was placed this turn
                const tileInColumnPlacedThisTurn = tilesPlacedThisTurn.some(pos => pos.x === column);
                if (!tileInColumnPlacedThisTurn) {
                    socket.emit('error', { message: 'You can only remove tiles placed this turn' });
                    return;
                }

                // Remove the tile
                const removedTile = gameEngine.removeTile(column, row);
                if (removedTile) {
                    // Return tile to rack using engine method (modifies internal state)
                    gameEngine.returnTileToRack(playerId, removedTile);

                    const newState = manager.getState();
                    roomManager.updateGameState(room.code, newState);

                    // Update turn tracking: remove the deleted position and adjust positions above it
                    // After gravity, tiles above the removed tile move down by 1 row
                    const current = playerTurnTiles.get(socket.id);
                    if (current) {
                        const updated = current
                            .filter(p => !(p.x === column && p.y === row)) // Remove deleted tile
                            .map(p => {
                                // If tile is in same column and above removed position, it moved down
                                if (p.x === column && p.y < row) {
                                    return { x: p.x, y: p.y + 1 };
                                }
                                return p;
                            });
                        playerTurnTiles.set(socket.id, updated);
                    }

                    io.to(room.code).emit('tile_removed', {
                        playerId: socket.id,
                        gameState: newState,
                        removedPosition: { x: column, y: row }
                    });
                }
            } catch (error: any) {
                socket.emit('error', { message: error.message });
            }
        });

        /**
         * Set letter for a blank tile
         */
        socket.on('set_blank_letter', ({ x, y, letter }) => {
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
                const success = engine.setBlankTileLetter(x, y, letter, playerId);

                if (!success) {
                    socket.emit('error', { message: 'Could not set blank tile letter' });
                    return;
                }

                const newState = manager.getState();
                roomManager.updateGameState(room.code, newState);

                io.to(room.code).emit('blank_letter_set', {
                    x,
                    y,
                    letter: letter.toUpperCase(),
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
