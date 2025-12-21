/**
 * Firebase Configuration for Grabble
 * Realtime Database for multiplayer game state synchronization
 */

import { initializeApp } from 'firebase/app';
import { getDatabase, ref, set, get, onValue, push, update, remove, DatabaseReference, DataSnapshot } from 'firebase/database';

// Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyAlnObIacPJsUTXjuabtu1h20J1ff6r7vg",
    authDomain: "grabble-eba6c.firebaseapp.com",
    databaseURL: "https://grabble-eba6c-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "grabble-eba6c",
    storageBucket: "grabble-eba6c.firebasestorage.app",
    messagingSenderId: "831470666148",
    appId: "1:831470666148:web:895880fb8d082dc7840131",
    measurementId: "G-H4V2DKWGV2"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const database = getDatabase(app);

// Export database utilities
export { database, ref, set, get, onValue, push, update, remove };
export type { DatabaseReference, DataSnapshot };

// Helper to generate room codes
export function generateRoomCode(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < 4; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}

// Database path helpers
export const dbPaths = {
    rooms: () => 'rooms',
    room: (roomCode: string) => `rooms/${roomCode}`,
    roomPlayers: (roomCode: string) => `rooms/${roomCode}/players`,
    roomPlayer: (roomCode: string, playerId: string) => `rooms/${roomCode}/players/${playerId}`,
    roomGame: (roomCode: string) => `rooms/${roomCode}/game`,
    roomGameState: (roomCode: string) => `rooms/${roomCode}/game/state`,
};

console.log('🔥 Firebase initialized for Grabble');
