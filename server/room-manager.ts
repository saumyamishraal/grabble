/**
 * Room Manager - handles game room/lobby lifecycle
 */

import { v4 as uuidv4 } from 'uuid';
import type { Room, RoomPlayer } from './types';

const PLAYER_COLORS = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A'];

/**
 * Generate a random 4-character room code
 */
function generateRoomCode(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Removed ambiguous chars
    let code = '';
    for (let i = 0; i < 4; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
}

export class RoomManager {
    private rooms: Map<string, Room> = new Map();
    private playerToRoom: Map<string, string> = new Map(); // socketId -> roomCode

    /**
     * Create a new room
     */
    createRoom(hostSocketId: string, hostName: string, targetScore: number = 100, hintsEnabled: boolean = true): Room {
        // Generate unique room code
        let code: string;
        do {
            code = generateRoomCode();
        } while (this.rooms.has(code));

        const host: RoomPlayer = {
            id: hostSocketId,
            name: hostName,
            isHost: true,
            isReady: true, // Host is always ready
            color: PLAYER_COLORS[0]
        };

        const room: Room = {
            code,
            players: [host],
            hostId: hostSocketId,
            status: 'waiting',
            gameState: null,
            createdAt: new Date(),
            maxPlayers: 4,
            targetScore,
            hintsEnabled
        };

        this.rooms.set(code, room);
        this.playerToRoom.set(hostSocketId, code);

        console.log(`📦 Room ${code} created by ${hostName}`);
        return room;
    }

    /**
     * Join an existing room
     */
    joinRoom(roomCode: string, socketId: string, playerName: string): { success: boolean; room?: Room; error?: string } {
        const room = this.rooms.get(roomCode.toUpperCase());

        if (!room) {
            return { success: false, error: 'Room not found' };
        }

        if (room.status !== 'waiting') {
            return { success: false, error: 'Game already in progress' };
        }

        if (room.players.length >= room.maxPlayers) {
            return { success: false, error: 'Room is full' };
        }

        // Check if player name already taken in room
        if (room.players.some(p => p.name.toLowerCase() === playerName.toLowerCase())) {
            return { success: false, error: 'Name already taken in this room' };
        }

        const player: RoomPlayer = {
            id: socketId,
            name: playerName,
            isHost: false,
            isReady: false,
            color: PLAYER_COLORS[room.players.length]
        };

        room.players.push(player);
        this.playerToRoom.set(socketId, roomCode);

        console.log(`👤 ${playerName} joined room ${roomCode}`);
        return { success: true, room };
    }

    /**
     * Leave a room
     */
    leaveRoom(socketId: string): { roomCode: string | null; room: Room | null; wasHost: boolean } {
        const roomCode = this.playerToRoom.get(socketId);
        if (!roomCode) {
            return { roomCode: null, room: null, wasHost: false };
        }

        const room = this.rooms.get(roomCode);
        if (!room) {
            this.playerToRoom.delete(socketId);
            return { roomCode, room: null, wasHost: false };
        }

        const playerIndex = room.players.findIndex(p => p.id === socketId);
        const wasHost = room.hostId === socketId;

        if (playerIndex !== -1) {
            const player = room.players[playerIndex];
            room.players.splice(playerIndex, 1);
            console.log(`👋 ${player.name} left room ${roomCode}`);
        }

        this.playerToRoom.delete(socketId);

        // If room is empty, delete it
        if (room.players.length === 0) {
            this.rooms.delete(roomCode);
            console.log(`🗑️ Room ${roomCode} deleted (empty)`);
            return { roomCode, room: null, wasHost };
        }

        // If host left, transfer to next player
        if (wasHost && room.players.length > 0) {
            room.hostId = room.players[0].id;
            room.players[0].isHost = true;
            console.log(`👑 ${room.players[0].name} is now host of room ${roomCode}`);
        }

        return { roomCode, room, wasHost };
    }

    /**
     * Set player ready state
     */
    setPlayerReady(socketId: string, ready: boolean): Room | null {
        const roomCode = this.playerToRoom.get(socketId);
        if (!roomCode) return null;

        const room = this.rooms.get(roomCode);
        if (!room) return null;

        const player = room.players.find(p => p.id === socketId);
        if (player) {
            player.isReady = ready;
        }

        return room;
    }

    /**
     * Check if all players are ready
     */
    areAllPlayersReady(roomCode: string): boolean {
        const room = this.rooms.get(roomCode);
        if (!room) return false;
        return room.players.length >= 2 && room.players.every(p => p.isReady);
    }

    /**
     * Get room by code
     */
    getRoom(roomCode: string): Room | undefined {
        return this.rooms.get(roomCode.toUpperCase());
    }

    /**
     * Get room by player socket ID
     */
    getRoomByPlayer(socketId: string): Room | undefined {
        const roomCode = this.playerToRoom.get(socketId);
        if (!roomCode) return undefined;
        return this.rooms.get(roomCode);
    }

    /**
     * Get room code for a player
     */
    getRoomCodeForPlayer(socketId: string): string | undefined {
        return this.playerToRoom.get(socketId);
    }

    /**
     * Update room game state
     */
    updateGameState(roomCode: string, gameState: any): void {
        const room = this.rooms.get(roomCode);
        if (room) {
            room.gameState = gameState;
        }
    }

    /**
     * Set room status
     */
    setRoomStatus(roomCode: string, status: 'waiting' | 'playing' | 'finished'): void {
        const room = this.rooms.get(roomCode);
        if (room) {
            room.status = status;
        }
    }

    /**
     * Get number of active rooms
     */
    getActiveRoomCount(): number {
        return this.rooms.size;
    }

    /**
     * Get player in room by socket ID
     */
    getPlayer(socketId: string): RoomPlayer | undefined {
        const room = this.getRoomByPlayer(socketId);
        if (!room) return undefined;
        return room.players.find(p => p.id === socketId);
    }

    /**
     * Map socket ID to game player ID
     */
    getGamePlayerId(socketId: string): number | undefined {
        const room = this.getRoomByPlayer(socketId);
        if (!room) return undefined;
        const index = room.players.findIndex(p => p.id === socketId);
        return index >= 0 ? index : undefined;
    }
}
