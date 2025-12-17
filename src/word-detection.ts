/**
 * Copyright (c) 2024 Amuse Labs Pvt Ltd
 * Grabble - Scrabble with Gravity
 * Word detection utilities for finding words on the board
 */

import type { Position, Tile } from './types';

/**
 * Direction vectors for word detection
 */
const DIRECTIONS = [
    { dx: 1, dy: 0 },   // Horizontal right
    { dx: 0, dy: 1 },   // Vertical down
    { dx: 1, dy: 1 },   // Diagonal down-right
    { dx: 1, dy: -1 }   // Diagonal up-right
];

/**
 * Find all possible words starting from a position in a given direction
 * Returns array of word positions (each word is an array of positions)
 */
export function findWordsInDirection(
    board: (Tile | null)[][],
    startX: number,
    startY: number,
    dx: number,
    dy: number
): Position[][] {
    const words: Position[][] = [];
    const rows = board.length;
    const cols = board[0]?.length || 0;

    // Start from the given position and extend in the direction
    let currentWord: Position[] = [];
    
    // Move backwards first to find the start of any word containing this position
    let x = startX;
    let y = startY;
    
    // Go backwards until we hit an empty cell or board edge
    while (x >= 0 && x < cols && y >= 0 && y < rows && board[y][x] !== null) {
        x -= dx;
        y -= dy;
    }
    
    // Move forward one step (we went one too far back)
    x += dx;
    y += dy;
    
    // Now collect positions going forward
    while (x >= 0 && x < cols && y >= 0 && y < rows) {
        if (board[y][x] === null) {
            // Hit empty cell - if we have a word, save it
            if (currentWord.length >= 3) {
                words.push([...currentWord]);
            }
            currentWord = [];
        } else {
            currentWord.push({ x, y });
        }
        x += dx;
        y += dy;
    }
    
    // Don't forget the word at the end if we hit the board edge
    if (currentWord.length >= 3) {
        words.push([...currentWord]);
    }
    
    return words;
}

/**
 * Find all words on the board (horizontal, vertical, diagonal)
 * Returns array of word positions
 */
export function findAllWords(board: (Tile | null)[][]): Position[][] {
    const words: Position[][] = [];
    const rows = board.length;
    const cols = board[0]?.length || 0;
    const seen = new Set<string>();

    // Check each cell as a potential starting point
    for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
            if (board[y][x] === null) continue;

            // Check each direction
            for (const { dx, dy } of DIRECTIONS) {
                const foundWords = findWordsInDirection(board, x, y, dx, dy);
                
                for (const wordPositions of foundWords) {
                    // Create a unique key for this word (normalize by sorting positions)
                    const sorted = [...wordPositions].sort((a, b) => {
                        if (a.y !== b.y) return a.y - b.y;
                        return a.x - b.x;
                    });
                    const key = sorted.map(p => `${p.x},${p.y}`).join('|');
                    
                    if (!seen.has(key)) {
                        seen.add(key);
                        words.push(wordPositions);
                    }
                }
            }
        }
    }

    return words;
}

/**
 * Extract word string from board positions
 * @param preserveOrder - If true, use positions as-is. If false, sort them.
 */
export function extractWordFromPositions(
    board: (Tile | null)[][],
    positions: Position[],
    preserveOrder: boolean = false
): string {
    let orderedPositions: Position[];
    
    if (preserveOrder) {
        // Use positions as provided (respects drag direction)
        orderedPositions = positions;
    } else {
        // Sort positions to get correct order (top-left to bottom-right)
        orderedPositions = [...positions].sort((a, b) => {
            if (a.y !== b.y) return a.y - b.y;
            return a.x - b.x;
        });
    }

    const letters: string[] = [];
    for (const pos of orderedPositions) {
        const tile = board[pos.y]?.[pos.x];
        if (tile) {
            // For blank tiles, use blankLetter if available, otherwise use space
            if (tile.letter === ' ' && tile.blankLetter) {
                letters.push(tile.blankLetter);
            } else {
                letters.push(tile.letter);
            }
        }
    }

    const result = letters.join('').trim();
    // Debug: log extraction details for troubleshooting
    if (result.length > 0 && result.length <= 10) {
        console.log('extractWordFromPositions:', {
            preserveOrder,
            positions: positions.map(p => `(${p.x},${p.y})`),
            orderedPositions: orderedPositions.map(p => `(${p.x},${p.y})`),
            letters,
            result
        });
    }
    return result;
}

/**
 * Check if positions form a valid straight line (horizontal, vertical, or diagonal)
 */
export function isValidWordLine(positions: Position[]): boolean {
    if (positions.length < 3) {
        return false;
    }

    // Sort positions
    const sorted = [...positions].sort((a, b) => {
        if (a.y !== b.y) return a.y - b.y;
        return a.x - b.x;
    });

    // Determine direction from first two positions
    const dx = sorted[1].x - sorted[0].x;
    const dy = sorted[1].y - sorted[0].y;

    // Check if direction is valid (must be horizontal, vertical, or diagonal)
    if (dx !== 0 && dy !== 0 && Math.abs(dx) !== Math.abs(dy)) {
        return false;
    }

    // Normalize direction
    const dirX = dx === 0 ? 0 : (dx > 0 ? 1 : -1);
    const dirY = dy === 0 ? 0 : (dy > 0 ? 1 : -1);

    // Verify all positions follow the same direction
    for (let i = 1; i < sorted.length; i++) {
        const expectedX = sorted[i - 1].x + dirX;
        const expectedY = sorted[i - 1].y + dirY;
        if (sorted[i].x !== expectedX || sorted[i].y !== expectedY) {
            return false;
        }
    }

    return true;
}

/**
 * Check if word can be read in reverse direction (for palindrome/emordnilap detection)
 * Returns the reverse word if valid, null otherwise
 */
export function getReverseWord(
    board: (Tile | null)[][],
    positions: Position[]
): string | null {
    if (!isValidWordLine(positions)) {
        return null;
    }

    // Sort positions to get forward word
    const sorted = [...positions].sort((a, b) => {
        if (a.y !== b.y) return a.y - b.y;
        return a.x - b.x;
    });

    // Extract reverse word (read positions backwards)
    const letters: string[] = [];
    for (let i = sorted.length - 1; i >= 0; i--) {
        const pos = sorted[i];
        const tile = board[pos.y]?.[pos.x];
        if (tile) {
            // For blank tiles, use blankLetter if available, otherwise use space
            if (tile.letter === ' ' && tile.blankLetter) {
                letters.push(tile.blankLetter);
            } else {
                letters.push(tile.letter);
            }
        }
    }

    return letters.join('').trim();
}

/**
 * Check if positions contain at least one of the newly placed tiles
 */
export function containsNewTile(
    positions: Position[],
    newlyPlacedTiles: Position[]
): boolean {
    return positions.some(pos =>
        newlyPlacedTiles.some(newPos => newPos.x === pos.x && newPos.y === pos.y)
    );
}

