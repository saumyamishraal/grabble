/**
 * Room/Lobby types for multiplayer
 * Copied from server/types.ts for client-side use
 */

import type { GameState, Player } from './types';

/**
 * Player in a room (before game starts)
 */
export interface RoomPlayer {
    id: string;           // Socket ID
    name: string;         // Display name
    isHost: boolean;      // Room creator
    isReady: boolean;     // Ready to start
    color: string;        // Player color
}

/**
 * Game room
 */
export interface Room {
    code: string;              // 4-character room code
    players: RoomPlayer[];     // Players in room
    hostId: string;            // Host's socket ID
    status: 'waiting' | 'playing' | 'finished';
    gameState: GameState | null;  // Game state once playing
    createdAt: Date;
    maxPlayers: number;
    targetScore: number;
    hintsEnabled?: boolean;     // Whether hints are allowed in this room
}

/**
 * Socket.IO event payloads - Client to Server
 */
export interface ClientToServerEvents {
    create_room: (data: { playerName: string; targetScore?: number; hintsEnabled?: boolean }) => void;
    join_room: (data: { roomCode: string; playerName: string }) => void;
    leave_room: () => void;
    set_ready: (ready: boolean) => void;
    start_game: () => void;
    place_tiles: (data: { placements: Array<{ column: number; tileIndex: number }> }) => void;
    claim_words: (data: { claims: Array<{ positions: Array<{ x: number; y: number }> }> }) => void;
    swap_tiles: (data: { tileIndices: number[] }) => void;
    end_turn: () => void;
    remove_tile: (data: { column: number; row: number }) => void;
    set_blank_letter: (data: { x: number; y: number; letter: string }) => void;
    request_new_game: () => void;
    respond_new_game: (data: { accepted: boolean }) => void;
}

/**
 * Socket.IO event payloads - Server to Client
 */
export interface ServerToClientEvents {
    room_created: (data: { roomCode: string; room: Room }) => void;
    room_joined: (data: { room: Room; playerId: string }) => void;
    room_state: (room: Room) => void;
    player_joined: (player: RoomPlayer) => void;
    player_left: (playerId: string) => void;
    player_ready: (data: { playerId: string; ready: boolean }) => void;
    game_started: (gameState: GameState) => void;
    game_state: (gameState: GameState) => void;
    tiles_placed: (data: { playerId: string; gameState: GameState; placedPositions?: Array<{ x: number; y: number }> }) => void;
    tile_removed: (data: { playerId: string; gameState: GameState; removedPosition: { x: number; y: number } }) => void;
    words_claimed: (data: { playerId: number; results: any; gameState: GameState }) => void;
    tiles_swapped: (data: { playerId: string; gameState: GameState }) => void;
    turn_changed: (data: { currentPlayerId: number; gameState: GameState }) => void;
    game_ended: (data: { winnerId: number; finalState: GameState }) => void;
    blank_letter_set: (data: { x: number; y: number; letter: string; gameState: GameState }) => void;
    new_game_requested: (data: { requesterId: string; requesterName: string }) => void;
    new_game_request_sent: () => void;
    new_game_response: (data: { playerId: string; playerName: string; accepted: boolean }) => void;
    new_game_all_accepted: (data: { gameState: GameState }) => void;
    new_game_declined: (data: { playerName: string }) => void;
    error: (data: { message: string; code?: string }) => void;
}

/**
 * Socket data stored on each socket
 */
export interface SocketData {
    playerId: string;
    playerName: string;
    roomCode: string | null;
}

