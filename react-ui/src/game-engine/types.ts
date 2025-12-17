/**
 * Copyright (c) 2024 Amuse Labs Pvt Ltd
 * Grabble - Scrabble with Gravity
 * Type definitions for Grabble game
 */

/**
 * Standard Scrabble tile with letter and point value
 */
export interface Tile {
    letter: string;  // Single letter (or blank)
    points: number;  // Point value (0-10)
    playerId?: number; // Which player placed this tile (for visual ownership)
}

/**
 * Position on the 7x7 board
 */
export interface Position {
    x: number; // Column (0-6)
    y: number; // Row (0-6)
}

/**
 * Tile placement - tile dropped into a column
 */
export interface TilePlacement {
    column: number;  // Column index (0-6)
    tile: Tile;     // Tile being placed
}

/**
 * Word claim - player's explicit word declaration
 */
export interface WordClaim {
    positions: Position[];  // Coordinates of word (must be straight line)
    playerId: number;        // Player claiming the word
}

/**
 * Claimed word record (already scored)
 */
export interface ClaimedWord {
    word: string;           // The word text
    positions: Position[]; // Board positions
    playerId: number;       // Who claimed it
    score: number;          // Points scored
    bonuses: string[];      // Applied bonuses (e.g., ['diagonal', 'palindrome'])
}

/**
 * Player in the game
 */
export interface Player {
    id: number;           // Unique player ID (0-3)
    name: string;          // Player name
    color: string;         // Visual color (hex code)
    score: number;         // Current score
    rack: Tile[];          // Current tiles (max 7)
    turnOrder: number;     // Turn order (0 = first, 1 = second, etc.)
}

/**
 * Game state
 */
export interface GameState {
    board: (Tile | null)[][];  // 7x7 board (null = empty)
    players: Player[];          // All players
    currentPlayerId: number;    // ID of player whose turn it is
    tileBag: Tile[];            // Remaining tiles
    claimedWords: ClaimedWord[]; // Words already claimed
    targetScore: number;        // Win condition (default 100)
    gameStatus: 'waiting' | 'playing' | 'finished';
    winnerId?: number;           // Winner ID if game finished
}

/**
 * Standard Scrabble letter distribution
 */
export const STANDARD_SCRABBLE_DISTRIBUTION: Record<string, { count: number; points: number }> = {
    'A': { count: 9, points: 1 },
    'B': { count: 2, points: 3 },
    'C': { count: 2, points: 3 },
    'D': { count: 4, points: 2 },
    'E': { count: 12, points: 1 },
    'F': { count: 2, points: 4 },
    'G': { count: 3, points: 2 },
    'H': { count: 2, points: 4 },
    'I': { count: 9, points: 1 },
    'J': { count: 1, points: 8 },
    'K': { count: 1, points: 5 },
    'L': { count: 4, points: 1 },
    'M': { count: 2, points: 3 },
    'N': { count: 6, points: 1 },
    'O': { count: 8, points: 1 },
    'P': { count: 2, points: 3 },
    'Q': { count: 1, points: 10 },
    'R': { count: 6, points: 1 },
    'S': { count: 4, points: 1 },
    'T': { count: 6, points: 1 },
    'U': { count: 4, points: 1 },
    'V': { count: 2, points: 4 },
    'W': { count: 2, points: 4 },
    'X': { count: 1, points: 8 },
    'Y': { count: 2, points: 4 },
    'Z': { count: 1, points: 10 },
    ' ': { count: 2, points: 0 }  // Blank tiles
};

