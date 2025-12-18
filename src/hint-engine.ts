/**
 * Copyright (c) 2024 Amuse Labs Pvt Ltd
 * Grabble - Scrabble with Gravity
 * Hint Engine - Trie-based word finding for player hints
 */

import type { Tile, Position } from './types';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Trie node for dictionary lookups
 */
interface TrieNode {
    children: Map<string, TrieNode>;
    isWord: boolean;
    word?: string;  // Store full word at terminal nodes
}

/**
 * Direction vector for word search
 */
interface Direction {
    dx: number;
    dy: number;
    name: string;
}

/**
 * All 8 directions to search for words
 */
const ALL_DIRECTIONS: Direction[] = [
    { dx: 1, dy: 0, name: 'right' },
    { dx: -1, dy: 0, name: 'left' },
    { dx: 0, dy: 1, name: 'down' },
    { dx: 0, dy: -1, name: 'up' },
    { dx: 1, dy: 1, name: 'down-right' },
    { dx: -1, dy: 1, name: 'down-left' },
    { dx: 1, dy: -1, name: 'up-right' },
    { dx: -1, dy: -1, name: 'up-left' }
];

/**
 * Solution found by hint algorithm
 */
export interface HintSolution {
    // For backward compatibility (depth 1)
    tileIndex: number;      // First rack tile to use
    column: number;         // First column to drop it in

    // For depth 2 solutions
    tileIndices: number[];  // All rack tiles to use (1 or 2)
    columns: number[];      // All columns to drop tiles in
    depth: 1 | 2;           // Solution depth

    word: string;           // Resulting word
    positions: Position[];  // Word positions on board
    direction: Direction;   // Direction of word
    blankLetter?: string;   // If blank tile, which letter it represents
    blankLetters?: string[]; // For multi-blank scenarios
}

/**
 * Progressive hint result (masked based on level)
 */
export interface HintResult {
    level: 0 | 1 | 2 | 3 | 4;
    hasMoves: boolean;

    // Level 1+
    usefulTiles?: number[];  // rack indices

    // Level 2+
    targetColumns?: number[];

    // Level 3+
    partialWord?: string;  // e.g., "C__"
    wordLength?: number;

    // Level 4
    fullSolution?: HintSolution;

    // Swap suggestion (when no words found)
    suggestSwap?: boolean;
    tilesToSwap?: number[];
}

// ============================================================================
// TRIE DATA STRUCTURE
// ============================================================================

/**
 * Trie (prefix tree) for efficient dictionary lookups
 */
export class Trie {
    private root: TrieNode;

    constructor() {
        this.root = this.createNode();
    }

    private createNode(): TrieNode {
        return {
            children: new Map(),
            isWord: false
        };
    }

    /**
     * Insert a word into the Trie
     */
    insert(word: string): void {
        let node = this.root;
        const upperWord = word.toUpperCase();

        const chars = upperWord.split('');
        for (let i = 0; i < chars.length; i++) {
            const char = chars[i];
            if (!node.children.has(char)) {
                node.children.set(char, this.createNode());
            }
            node = node.children.get(char)!;
        }

        node.isWord = true;
        node.word = upperWord;
    }

    /**
     * Check if a complete word exists in the Trie
     */
    hasWord(word: string): boolean {
        const node = this.traverse(word.toUpperCase());
        return node !== null && node.isWord;
    }

    /**
     * Check if a prefix exists in the Trie
     */
    hasPrefix(prefix: string): boolean {
        return this.traverse(prefix.toUpperCase()) !== null;
    }

    /**
     * Traverse the Trie following a string path
     * Returns the node at the end, or null if path doesn't exist
     */
    private traverse(str: string): TrieNode | null {
        let node = this.root;

        const chars = str.split('');
        for (let i = 0; i < chars.length; i++) {
            const char = chars[i];
            if (!node.children.has(char)) {
                return null;
            }
            node = node.children.get(char)!;
        }

        return node;
    }

    /**
     * Get count of words in Trie (for debugging)
     */
    getWordCount(): number {
        let count = 0;
        const traverse = (node: TrieNode) => {
            if (node.isWord) count++;
            Array.from(node.children.values()).forEach(child => {
                traverse(child);
            });
        };
        traverse(this.root);
        return count;
    }
}

/**
 * Build a Trie from dictionary set
 */
export function buildTrieFromDictionary(dictionary: Set<string>): Trie {
    const trie = new Trie();
    Array.from(dictionary).forEach(word => {
        if (word.length >= 3) {
            trie.insert(word);
        }
    });
    return trie;
}

// ============================================================================
// BOARD UTILITIES
// ============================================================================

/**
 * Get accessible positions (where tiles can land after gravity)
 * Returns the lowest empty row in each column
 */
export function getAccessiblePositions(board: (Tile | null)[][]): Array<{ column: number; row: number }> {
    const positions: Array<{ column: number; row: number }> = [];

    for (let col = 0; col < 7; col++) {
        // Find lowest empty row in this column (bottom-up search)
        for (let row = 6; row >= 0; row--) {
            if (board[row][col] === null) {
                positions.push({ column: col, row });
                break;
            }
        }
    }

    return positions;
}

/**
 * Get the row where a tile would land in a column after gravity
 */
function getLandingRow(board: (Tile | null)[][], column: number): number {
    for (let row = 6; row >= 0; row--) {
        if (board[row][column] === null) {
            return row;
        }
    }
    return -1; // Column is full
}

/**
 * Create a deep copy of the board
 */
function copyBoard(board: (Tile | null)[][]): (Tile | null)[][] {
    return board.map(row => row.map(cell => cell ? { ...cell } : null));
}

/**
 * Simulate placing a tile in a column (with gravity)
 * Returns new board state (does not modify original)
 */
function simulatePlacement(board: (Tile | null)[][], column: number, tile: Tile): (Tile | null)[][] {
    const newBoard = copyBoard(board);
    const landingRow = getLandingRow(newBoard, column);

    if (landingRow >= 0) {
        newBoard[landingRow][column] = { ...tile };
    }

    return newBoard;
}

/**
 * Check if position is within board bounds
 */
function isValidPosition(x: number, y: number): boolean {
    return x >= 0 && x < 7 && y >= 0 && y < 7;
}

// ============================================================================
// WORD EXTRACTION
// ============================================================================

/**
 * Extract a word starting from a position in a given direction
 * Extends both backwards and forwards from the starting point
 */
function extractWordInDirection(
    board: (Tile | null)[][],
    startX: number,
    startY: number,
    dx: number,
    dy: number
): { word: string; positions: Position[] } {
    const positions: Position[] = [];
    const letters: string[] = [];

    // Walk backwards to find word start
    let x = startX - dx;
    let y = startY - dy;
    const backPositions: Position[] = [];
    const backLetters: string[] = [];

    while (isValidPosition(x, y) && board[y][x] !== null) {
        const tile = board[y][x]!;
        const letter = tile.letter === ' ' ? (tile.blankLetter || '?') : tile.letter;
        backPositions.unshift({ x, y });
        backLetters.unshift(letter);
        x -= dx;
        y -= dy;
    }

    // Add backwards portion
    positions.push(...backPositions);
    letters.push(...backLetters);

    // Add starting position
    const startTile = board[startY][startX];
    if (startTile) {
        const startLetter = startTile.letter === ' ' ? (startTile.blankLetter || '?') : startTile.letter;
        positions.push({ x: startX, y: startY });
        letters.push(startLetter);
    }

    // Walk forwards to find word end
    x = startX + dx;
    y = startY + dy;

    while (isValidPosition(x, y) && board[y][x] !== null) {
        const tile = board[y][x]!;
        const letter = tile.letter === ' ' ? (tile.blankLetter || '?') : tile.letter;
        positions.push({ x, y });
        letters.push(letter);
        x += dx;
        y += dy;
    }

    return {
        word: letters.join('').toUpperCase(),
        positions
    };
}

// ============================================================================
// LETTER PLAYABILITY (for swap suggestions)
// ============================================================================

/**
 * Playability scores based on dictionary frequency
 * Higher = easier to use in words
 */
const LETTER_PLAYABILITY: Record<string, number> = {
    'E': 0.95, 'A': 0.90, 'R': 0.85, 'I': 0.85, 'O': 0.82,
    'T': 0.80, 'N': 0.78, 'S': 0.77, 'L': 0.72, 'C': 0.65,
    'U': 0.60, 'D': 0.55, 'P': 0.52, 'M': 0.50, 'H': 0.48,
    'G': 0.42, 'B': 0.38, 'F': 0.35, 'Y': 0.32, 'W': 0.30,
    'K': 0.25, 'V': 0.22, 'X': 0.10, 'Z': 0.08, 'J': 0.06, 'Q': 0.04,
    ' ': 0.99  // Blank tiles are very versatile
};

/**
 * Get swap suggestion - returns indices of tiles hardest to use
 */
export function getSwapSuggestion(rack: Tile[]): number[] {
    return rack
        .map((tile, index) => ({
            index,
            score: LETTER_PLAYABILITY[tile.letter] ?? 0.5
        }))
        .sort((a, b) => a.score - b.score)  // Lowest playability first
        .slice(0, Math.min(3, rack.length))  // Suggest up to 3 tiles
        .map(t => t.index);
}

// ============================================================================
// CORE HINT ALGORITHM (Greedy with Early-Exit)
// ============================================================================

/**
 * Find the first valid word that can be formed
 * Uses greedy early-exit strategy - stops as soon as a valid word is found
 * 
 * @param board Current board state
 * @param rack Player's current tiles
 * @param trie Dictionary trie for word validation
 * @returns HintSolution if found, null if no valid words exist
 */
export function findFirstValidWord(
    board: (Tile | null)[][],
    rack: Tile[],
    trie: Trie
): HintSolution | null {
    const accessible = getAccessiblePositions(board);

    // Separate regular tiles from blanks - check regular tiles FIRST for efficiency
    const regularTileIndices: number[] = [];
    const blankTileIndices: number[] = [];

    for (let i = 0; i < rack.length; i++) {
        if (rack[i].letter === ' ') {
            blankTileIndices.push(i);
        } else {
            regularTileIndices.push(i);
        }
    }

    // PASS 1: Try regular tiles first (cheaper and avoids blank when letter exists)
    for (const { column, row } of accessible) {
        for (const direction of ALL_DIRECTIONS) {
            for (const tileIndex of regularTileIndices) {
                const tile = rack[tileIndex];
                const testBoard = simulatePlacement(board, column, tile);
                const landingRow = getLandingRow(board, column);

                if (landingRow < 0) continue;  // Column is full

                const { word, positions } = extractWordInDirection(
                    testBoard,
                    column,
                    landingRow,
                    direction.dx,
                    direction.dy
                );

                if (word.length >= 3 && !word.includes('?') && trie.hasWord(word)) {
                    return {
                        tileIndex,
                        column,
                        tileIndices: [tileIndex],
                        columns: [column],
                        depth: 1,
                        word,
                        positions,
                        direction
                    };
                }
            }
        }
    }

    // PASS 2: Try blank tiles only if no regular tile solution found
    for (const { column } of accessible) {
        for (const direction of ALL_DIRECTIONS) {
            for (const tileIndex of blankTileIndices) {
                const result = tryBlankTile(board, column, direction, trie);
                if (result) {
                    return {
                        tileIndex,
                        column,
                        tileIndices: [tileIndex],
                        columns: [column],
                        depth: 1,
                        word: result.word,
                        positions: result.positions,
                        direction,
                        blankLetter: result.blankLetter
                    };
                }
            }
        }
    }

    // PASS 3: Try depth-2 search (2 tiles) if no single-tile solution found
    const depth2Result = findFirstValidWordDepth2(board, rack, trie);
    if (depth2Result) {
        return depth2Result;
    }

    return null;  // No valid words found
}

/**
 * Find the first valid word that can be formed by placing 2 tiles
 * Fallback when single-tile search fails
 */
function findFirstValidWordDepth2(
    board: (Tile | null)[][],
    rack: Tile[],
    trie: Trie
): HintSolution | null {
    const accessible = getAccessiblePositions(board);
    if (accessible.length === 0 || rack.length < 2) return null;

    // Try all combinations of 2 tiles in different columns
    for (let i = 0; i < rack.length; i++) {
        const tile1 = rack[i];
        if (tile1.letter === ' ') continue; // Skip blanks for now (simpler)

        for (const { column: col1 } of accessible) {
            const board1 = simulatePlacement(board, col1, tile1);
            const landing1 = getLandingRow(board, col1);
            if (landing1 < 0) continue;

            // Get accessible positions after first placement
            const accessible2 = getAccessiblePositions(board1);

            for (let j = 0; j < rack.length; j++) {
                if (j === i) continue; // Can't use same tile twice
                const tile2 = rack[j];
                if (tile2.letter === ' ') continue; // Skip blanks for now

                for (const { column: col2 } of accessible2) {
                    const board2 = simulatePlacement(board1, col2, tile2);
                    const landing2 = getLandingRow(board1, col2);
                    if (landing2 < 0) continue;

                    // Check all directions from both new tile positions
                    for (const direction of ALL_DIRECTIONS) {
                        // Check word through tile1's position
                        const result1 = extractWordInDirection(
                            board2, col1, landing1,
                            direction.dx, direction.dy
                        );
                        if (result1.word.length >= 3 &&
                            !result1.word.includes('?') &&
                            trie.hasWord(result1.word)) {
                            return {
                                tileIndex: i,
                                column: col1,
                                tileIndices: [i, j],
                                columns: [col1, col2],
                                depth: 2,
                                word: result1.word,
                                positions: result1.positions,
                                direction
                            };
                        }

                        // Check word through tile2's position
                        const result2 = extractWordInDirection(
                            board2, col2, landing2,
                            direction.dx, direction.dy
                        );
                        if (result2.word.length >= 3 &&
                            !result2.word.includes('?') &&
                            trie.hasWord(result2.word)) {
                            return {
                                tileIndex: i,
                                column: col1,
                                tileIndices: [i, j],
                                columns: [col1, col2],
                                depth: 2,
                                word: result2.word,
                                positions: result2.positions,
                                direction
                            };
                        }
                    }
                }
            }
        }
    }

    return null;
}

/**
 * Try placing a blank tile with each letter A-Z
 * Early-exit: stops at first valid word found
 */
function tryBlankTile(
    board: (Tile | null)[][],
    column: number,
    direction: Direction,
    trie: Trie
): { word: string; positions: Position[]; blankLetter: string } | null {
    const landingRow = getLandingRow(board, column);
    if (landingRow < 0) return null;

    // Try each letter A-Z
    for (let charCode = 65; charCode <= 90; charCode++) {
        const letter = String.fromCharCode(charCode);
        const blankTile: Tile = {
            letter: ' ',
            points: 0,
            blankLetter: letter
        };

        const testBoard = simulatePlacement(board, column, blankTile);

        const { word, positions } = extractWordInDirection(
            testBoard,
            column,
            landingRow,
            direction.dx,
            direction.dy
        );

        if (word.length >= 3 && !word.includes('?') && trie.hasWord(word)) {
            // EARLY EXIT - found valid word with this letter!
            return { word, positions, blankLetter: letter };
        }
    }

    return null;
}

// ============================================================================
// PROGRESSIVE HINT LEVELS
// ============================================================================

/**
 * Get hint at specified level (progressive disclosure)
 * 
 * Level 0: Just tells if moves are possible
 * Level 1: Shows which rack tiles are useful
 * Level 2: Shows which columns to target
 * Level 3: Shows partial word (first letter + length)
 * Level 4: Shows full solution
 */
export function getHintAtLevel(
    solution: HintSolution | null,
    rack: Tile[],
    level: 0 | 1 | 2 | 3 | 4
): HintResult {
    // No valid words found - suggest swap
    if (!solution) {
        return {
            level,
            hasMoves: false,
            suggestSwap: true,
            tilesToSwap: getSwapSuggestion(rack)
        };
    }

    // Build progressive hint based on level
    // Level 0: Just confirms moves possible
    // Level 1: Shows which tile(s) to use
    // Level 2: Shows partial word (length hint)
    // Level 3: Shows column (penultimate, most helpful before reveal)
    // Level 4: Full reveal
    switch (level) {
        case 0:
            return {
                level,
                hasMoves: true
            };

        case 1:
            return {
                level,
                hasMoves: true,
                usefulTiles: solution.tileIndices  // Use array for depth-2
            };

        case 2:
            // Partial word (less obvious than column)
            return {
                level,
                hasMoves: true,
                usefulTiles: solution.tileIndices,
                partialWord: solution.word[0] + '_'.repeat(solution.word.length - 1),
                wordLength: solution.word.length
            };

        case 3:
            // Column hint (penultimate - very helpful)
            return {
                level,
                hasMoves: true,
                usefulTiles: solution.tileIndices,
                targetColumns: solution.columns,
                partialWord: solution.word[0] + '_'.repeat(solution.word.length - 1),
                wordLength: solution.word.length
            };

        case 4:
            return {
                level,
                hasMoves: true,
                usefulTiles: solution.tileIndices,
                targetColumns: solution.columns,
                partialWord: solution.word[0] + '_'.repeat(solution.word.length - 1),
                wordLength: solution.word.length,
                fullSolution: solution
            };
    }
}

// ============================================================================
// MAIN HINT FUNCTION (convenience wrapper)
// ============================================================================

/**
 * Get a hint for the current game state
 * 
 * @param board Current board state
 * @param rack Player's current tiles
 * @param trie Dictionary trie
 * @param level Hint detail level (0-4)
 * @returns HintResult with appropriate level of detail
 */
export function getHint(
    board: (Tile | null)[][],
    rack: Tile[],
    trie: Trie,
    level: 0 | 1 | 2 | 3 | 4 = 0
): HintResult {
    const solution = findFirstValidWord(board, rack, trie);
    return getHintAtLevel(solution, rack, level);
}
