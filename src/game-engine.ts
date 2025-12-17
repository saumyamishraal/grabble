/**
 * Copyright (c) 2024 Amuse Labs Pvt Ltd
 * Grabble - Scrabble with Gravity
 * Core game engine with game logic
 */

import type { Tile, Position, TilePlacement, WordClaim, ClaimedWord, GameState, Player } from './types';
import { STANDARD_SCRABBLE_DISTRIBUTION } from './types';
import { isValidWordLine, extractWordFromPositions, getReverseWord, containsNewTile, findAllWords } from './word-detection';

/**
 * Core game engine for Grabble
 */
export class GrabbleEngine {
    private state: GameState;

    constructor(state: GameState) {
        this.state = state;
    }

    /**
     * Get current game state
     */
    getState(): GameState {
        return JSON.parse(JSON.stringify(this.state)); // Deep copy
    }

    /**
     * Initialize a new tile bag from standard Scrabble distribution
     */
    static createTileBag(): Tile[] {
        const bag: Tile[] = [];
        for (const [letter, { count, points }] of Object.entries(STANDARD_SCRABBLE_DISTRIBUTION)) {
            for (let i = 0; i < count; i++) {
                bag.push({ letter, points });
            }
        }
        return this.shuffle(bag);
    }

    /**
     * Shuffle array using Fisher-Yates algorithm
     */
    static shuffle<T>(array: T[]): T[] {
        const shuffled = [...array];
        for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        return shuffled;
    }

    /**
     * Initialize empty 7x7 board
     */
    static createEmptyBoard(): (Tile | null)[][] {
        const board: (Tile | null)[][] = [];
        for (let y = 0; y < 7; y++) {
            board[y] = [];
            for (let x = 0; x < 7; x++) {
                board[y][x] = null;
            }
        }
        return board;
    }

    /**
     * Place tiles from column tops (row 0)
     * Tiles are placed first, then gravity resolves
     */
    placeTiles(placements: TilePlacement[], playerId: number): void {
        // Place tiles at top of columns
        for (const placement of placements) {
            const { column, tile } = placement;
            if (column < 0 || column >= 7) {
                throw new Error(`Invalid column: ${column}`);
            }
            
            // Find first empty cell in column (starting from top)
            let placed = false;
            for (let row = 0; row < 7; row++) {
                if (this.state.board[row][column] === null) {
                    this.state.board[row][column] = {
                        ...tile,
                        playerId
                    };
                    placed = true;
                    break;
                }
            }
            
            if (!placed) {
                throw new Error(`Column ${column} is full`);
            }
        }

        // Resolve gravity after all placements
        this.resolveGravity();
    }

    /**
     * Place a tile directly at a specific position (without gravity)
     * Used for dropping tiles anywhere on the board
     */
    placeTileAtPosition(x: number, y: number, tile: Tile, playerId: number): void {
        if (x < 0 || x >= 7 || y < 0 || y >= 7) {
            throw new Error(`Invalid position: (${x}, ${y})`);
        }
        
        if (this.state.board[y][x] !== null) {
            throw new Error(`Position (${x}, ${y}) is already occupied`);
        }
        
        this.state.board[y][x] = {
            ...tile,
            playerId
        };
    }

    /**
     * Remove a tile from the board at the given position
     * Returns the removed tile or null if position was empty
     */
    removeTile(x: number, y: number): Tile | null {
        if (x < 0 || x >= 7 || y < 0 || y >= 7) {
            throw new Error(`Invalid position: (${x}, ${y})`);
        }
        
        const tile = this.state.board[y][x];
        if (tile === null) {
            return null;
        }
        
        this.state.board[y][x] = null;
        // Resolve gravity after removal
        this.resolveGravity();
        return tile;
    }

    /**
     * Resolve gravity - tiles fall straight down until they hit bottom or another tile
     */
    private resolveGravity(): void {
        // Process each column independently
        for (let col = 0; col < 7; col++) {
            // Collect all tiles in this column (top to bottom)
            const tiles: Tile[] = [];
            for (let row = 0; row < 7; row++) {
                const tile = this.state.board[row][col];
                if (tile !== null) {
                    tiles.push(tile);
                    this.state.board[row][col] = null;
                }
            }

            // Place tiles back from bottom up
            let rowIndex = 6; // Start from bottom row
            for (let i = tiles.length - 1; i >= 0; i--) {
                this.state.board[rowIndex][col] = tiles[i];
                rowIndex--;
            }
        }
    }

    /**
     * Extract word from board given positions
     * Returns the word string and validates it's a straight line
     */
    extractWord(positions: Position[]): { word: string; isValid: boolean } {
        if (!isValidWordLine(positions)) {
            return { word: '', isValid: false };
        }

        // Verify all positions have tiles
        for (const pos of positions) {
            if (this.state.board[pos.y]?.[pos.x] === null) {
                return { word: '', isValid: false };
            }
        }

        // Extract word - sort positions to get correct reading order (top-to-bottom, left-to-right)
        const word = extractWordFromPositions(this.state.board, positions, false);
        const trimmedWord = word.trim().toUpperCase();
        return { word: trimmedWord, isValid: trimmedWord.length >= 3 };
    }

    /**
     * Check if word is a palindrome (same forward and backward)
     */
    isPalindrome(word: string): boolean {
        const cleaned = word.replace(/\s+/g, '').toUpperCase();
        return cleaned === cleaned.split('').reverse().join('');
    }

    /**
     * Check if word is an emordnilap (reverses to a different valid word)
     * Uses the reverse word from board positions to handle multi-character tiles correctly
     * Both the original word and the reverse word must be valid dictionary words
     */
    async isEmordnilap(word: string, positions: Position[], dictionary: Set<string>): Promise<boolean> {
        // First verify the original word is in the dictionary (should already be validated, but double-check)
        const wordUpper = word.toUpperCase();
        if (!dictionary.has(wordUpper)) {
            return false;
        }
        
        const reverseWord = getReverseWord(this.state.board, positions);
        if (!reverseWord) {
            return false;
        }
        const reverseUpper = reverseWord.toUpperCase();
        
        // Both words must be different and both must be valid dictionary words
        return reverseUpper !== wordUpper && dictionary.has(reverseUpper);
    }

    /**
     * Calculate word score with bonuses
     */
    async calculateWordScore(
        word: string,
        positions: Position[],
        dictionary: Set<string>
    ): Promise<{ score: number; bonuses: string[] }> {
        // Base score: sum of letter values
        let baseScore = 0;
        for (const pos of positions) {
            const tile = this.state.board[pos.y][pos.x];
            if (tile) {
                baseScore += tile.points;
            }
        }

        const bonuses: string[] = [];
        let multiplier = 1;

        // Check if diagonal word
        if (positions.length > 0) {
            const dx = positions[positions.length - 1].x - positions[0].x;
            const dy = positions[positions.length - 1].y - positions[0].y;
            if (dx !== 0 && dy !== 0) {
                bonuses.push('diagonal');
                multiplier *= 2;
            }
        }

        // Check if palindrome
        if (this.isPalindrome(word)) {
            bonuses.push('palindrome');
            multiplier *= 2;
        }

        // Check if emordnilap
        if (await this.isEmordnilap(word, positions, dictionary)) {
            bonuses.push('emordnilap');
            multiplier *= 2;
        }

        return {
            score: baseScore * multiplier,
            bonuses
        };
    }

    /**
     * Validate word claim
     * Returns validation result with error message if invalid
     */
    async validateWordClaim(
        claim: WordClaim,
        newlyPlacedTiles: Position[],
        dictionary: Set<string>
    ): Promise<{ valid: boolean; error?: string; word?: string; score?: number; bonuses?: string[] }> {
        // Extract word
        const { word, isValid } = this.extractWord(claim.positions);
        if (!isValid) {
            return { valid: false, error: 'Word must be a straight line of 3+ letters' };
        }

        // Word is already uppercase from extractWord
        const wordUpper = word.toUpperCase().trim();
        console.log('Validating word claim:', {
            word,
            wordUpper,
            wordLength: wordUpper.length,
            inDictionary: dictionary.has(wordUpper),
            dictionarySize: dictionary.size,
            positions: claim.positions,
            sampleDictWords: Array.from(dictionary).slice(0, 10)
        });

        // Check dictionary - ensure we're checking the exact uppercase trimmed word
        if (!dictionary.has(wordUpper)) {
            // Try to find similar words for debugging
            const similarWords = Array.from(dictionary).filter(w => 
                w.length === wordUpper.length && 
                w.startsWith(wordUpper[0])
            ).slice(0, 5);
            console.log('Word not found. Similar words:', similarWords);
            return { valid: false, error: `Word "${wordUpper}" not in dictionary` };
        }

        // Check if word contains at least one newly placed tile
        if (!containsNewTile(claim.positions, newlyPlacedTiles)) {
            return { valid: false, error: 'Word must contain at least one newly placed tile' };
        }

        // Check if word already claimed (exact same positions)
        const wordAlreadyClaimed = this.state.claimedWords.some(cw => {
            // Check if word text matches
            if (cw.word.toUpperCase() !== word.toUpperCase()) return false;
            
            // Check if positions match exactly (same word in same location)
            if (cw.positions.length !== claim.positions.length) return false;
            
            // Sort positions for comparison
            const cwPositionsSorted = [...cw.positions].sort((a, b) => {
                if (a.y !== b.y) return a.y - b.y;
                return a.x - b.x;
            });
            const claimPositionsSorted = [...claim.positions].sort((a, b) => {
                if (a.y !== b.y) return a.y - b.y;
                return a.x - b.x;
            });
            
            // Check if all positions match
            return cwPositionsSorted.every((cwPos, index) => {
                const claimPos = claimPositionsSorted[index];
                return cwPos.x === claimPos.x && cwPos.y === claimPos.y;
            });
        });
        if (wordAlreadyClaimed) {
            return { valid: false, error: 'Word already claimed' };
        }

        // NEW RULE: Check that ALL words containing newly placed tiles are valid
        // This prevents claiming "RAIN" when it's part of invalid "ROARAIN"
        // But allows perpendicular words (like RAIN vertical next to ROAR horizontal)
        const allWordsOnBoard = findAllWords(this.state.board);
        const wordsContainingNewTiles = allWordsOnBoard.filter(wordPositions => 
            containsNewTile(wordPositions, newlyPlacedTiles)
        );

        // Validate each word that contains newly placed tiles
        for (const wordPositions of wordsContainingNewTiles) {
            const { word: boardWord, isValid: boardWordValid } = this.extractWord(wordPositions);
            if (!boardWordValid || boardWord.length < 3) {
                continue; // Skip invalid word lines
            }
            
            const boardWordUpper = boardWord.toUpperCase();
            
            // Check if this word is in the dictionary
            if (!dictionary.has(boardWordUpper)) {
                // Check if this word overlaps with the claimed word positions
                // If it's the same word being claimed, skip (already validated above)
                const isClaimedWord = wordPositions.length === claim.positions.length &&
                    wordPositions.every(wp => 
                        claim.positions.some(cp => cp.x === wp.x && cp.y === wp.y)
                    );
                
                if (isClaimedWord) {
                    continue; // This is the word being claimed, already validated
                }
                
                // Found an invalid word containing newly placed tiles
                return { 
                    valid: false, 
                    error: `Cannot claim "${word.toUpperCase()}" because it creates invalid word "${boardWordUpper}"` 
                };
            }
        }

        // Calculate score
        const { score, bonuses } = await this.calculateWordScore(word, claim.positions, dictionary);

        return {
            valid: true,
            word,
            score,
            bonuses
        };
    }

    /**
     * Process word claims for a turn
     * Returns validation results for each claim
     */
    async processWordClaims(
        claims: WordClaim[],
        newlyPlacedTiles: Position[],
        dictionary: Set<string>
    ): Promise<{
        valid: boolean;
        results: Array<{ valid: boolean; error?: string; word?: string; score?: number; bonuses?: string[] }>;
        totalScore: number;
    }> {
        const results = [];
        let totalScore = 0;

        for (const claim of claims) {
            const result = await this.validateWordClaim(claim, newlyPlacedTiles, dictionary);
            results.push(result);
            if (result.valid && result.score !== undefined) {
                totalScore += result.score;
            }
        }

        // If any claim is invalid, entire move is rejected
        const allValid = results.every(r => r.valid);
        if (!allValid) {
            return { valid: false, results, totalScore: 0 };
        }

        // All valid - record claimed words and update scores
        for (let i = 0; i < claims.length; i++) {
            const claim = claims[i];
            const result = results[i];
            if (result.valid && result.word && result.score !== undefined) {
                this.state.claimedWords.push({
                    word: result.word,
                    positions: claim.positions,
                    playerId: claim.playerId,
                    score: result.score,
                    bonuses: result.bonuses || []
                });

                // Update player score
                const player = this.state.players.find(p => p.id === claim.playerId);
                if (player) {
                    player.score += result.score;
                }
            }
        }

        return { valid: true, results, totalScore };
    }

    /**
     * Draw tiles from bag to fill player rack (up to 7 tiles)
     */
    refillPlayerRack(playerId: number): void {
        const player = this.state.players.find(p => p.id === playerId);
        if (!player) {
            throw new Error(`Player ${playerId} not found`);
        }

        while (player.rack.length < 7 && this.state.tileBag.length > 0) {
            const tile = this.state.tileBag.pop()!;
            player.rack.push(tile);
        }
    }

    /**
     * Swap tiles (player discards selected tiles, draws new ones)
     */
    swapTiles(playerId: number, tileIndices: number[]): void {
        const player = this.state.players.find(p => p.id === playerId);
        if (!player) {
            throw new Error(`Player ${playerId} not found`);
        }

        // Remove selected tiles from rack
        const removedTiles: Tile[] = [];
        for (const index of tileIndices.sort((a, b) => b - a)) { // Sort descending to remove from end
            if (index >= 0 && index < player.rack.length) {
                removedTiles.push(player.rack.splice(index, 1)[0]);
            }
        }

        // Return tiles to bag and shuffle
        this.state.tileBag.push(...removedTiles);
        this.state.tileBag = GrabbleEngine.shuffle(this.state.tileBag);

        // Draw new tiles
        while (player.rack.length < 7 && this.state.tileBag.length > 0) {
            const tile = this.state.tileBag.pop()!;
            player.rack.push(tile);
        }
    }

    /**
     * Advance to next player's turn
     */
    advanceTurn(): void {
        const currentPlayer = this.state.players.find(p => p.id === this.state.currentPlayerId);
        if (!currentPlayer) {
            throw new Error(`Current player ${this.state.currentPlayerId} not found`);
        }

        const currentTurnOrder = currentPlayer.turnOrder;
        const nextTurnOrder = (currentTurnOrder + 1) % this.state.players.length;
        const nextPlayer = this.state.players.find(p => p.turnOrder === nextTurnOrder);
        
        if (nextPlayer) {
            this.state.currentPlayerId = nextPlayer.id;
        }
    }

    /**
     * Check win condition
     * Returns winner ID if game is won, null otherwise
     */
    checkWinCondition(): number | null {
        for (const player of this.state.players) {
            if (player.score >= this.state.targetScore) {
                this.state.gameStatus = 'finished';
                this.state.winnerId = player.id;
                return player.id;
            }
        }
        return null;
    }

    /**
     * Check if game can continue (tiles available and legal moves possible)
     */
    canContinueGame(): boolean {
        // If tile bag is empty and all players have empty racks, game ends
        if (this.state.tileBag.length === 0) {
            const allRacksEmpty = this.state.players.every(p => p.rack.length === 0);
            if (allRacksEmpty) {
                return false;
            }
        }
        return true;
    }
}

