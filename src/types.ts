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
 * Standard Scrabble letter distribution and point values
 * 
 * Distribution:
 * A x 9, B x 2, C x 2, D x 4, E x 12, F x 2, G x 3, H x 2, I x 9, J x 1,
 * K x 1, L x 4, M x 2, N x 6, O x 8, P x 2, Q x 1, R x 6, S x 4, T x 6,
 * U x 4, V x 2, W x 2, X x 1, Y x 2, Z x 1, Blank x 2
 * 
 * Point values:
 * 1 point: A, E, I, O, U, L, N, S, T, R
 * 2 points: D, G
 * 3 points: B, C, M, P
 * 4 points: F, H, V, W, Y
 * 5 points: K
 * 8 points: J, X
 * 10 points: Q, Z
 * 0 points: Blank
 */
export const STANDARD_SCRABBLE_DISTRIBUTION: Record<string, { count: number; points: number }> = {
    // 1 point letters
    'A': { count: 9, points: 1 },
    'E': { count: 12, points: 1 },
    'I': { count: 9, points: 1 },
    'O': { count: 8, points: 1 },
    'U': { count: 4, points: 1 },
    'L': { count: 4, points: 1 },
    'N': { count: 6, points: 1 },
    'S': { count: 4, points: 1 },
    'T': { count: 6, points: 1 },
    'R': { count: 6, points: 1 },
    
    // 2 point letters
    'D': { count: 4, points: 2 },
    'G': { count: 3, points: 2 },
    
    // 3 point letters
    'B': { count: 2, points: 3 },
    'C': { count: 2, points: 3 },
    'M': { count: 2, points: 3 },
    'P': { count: 2, points: 3 },
    
    // 4 point letters
    'F': { count: 2, points: 4 },
    'H': { count: 2, points: 4 },
    'V': { count: 2, points: 4 },
    'W': { count: 2, points: 4 },
    'Y': { count: 2, points: 4 },
    
    // 5 point letters
    'K': { count: 1, points: 5 },
    
    // 8 point letters
    'J': { count: 1, points: 8 },
    'X': { count: 1, points: 8 },
    
    // 10 point letters
    'Q': { count: 1, points: 10 },
    'Z': { count: 1, points: 10 },
    
    // Blank tiles
    ' ': { count: 2, points: 0 }
};

