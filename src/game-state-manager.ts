/**
 * Copyright (c) 2024 Amuse Labs Pvt Ltd
 * Grabble - Scrabble with Gravity
 * Game state manager for turn order, player management, and game lifecycle
 */

import type { GameState, Player, Tile } from './types';
import { GrabbleEngine } from './game-engine';

/**
 * Game state manager - handles game initialization, player management, and lifecycle
 */
export class GameStateManager {
    private engine: GrabbleEngine;
    private state: GameState;

    /**
     * Create a new game with specified number of players
     */
    static createNewGame(
        numPlayers: number,
        playerNames: string[],
        targetScore: number = 100
    ): GameStateManager {
        if (numPlayers < 2 || numPlayers > 4) {
            throw new Error('Game must have 2-4 players');
        }
        if (playerNames.length !== numPlayers) {
            throw new Error('Player names array must match number of players');
        }

        // Create tile bag
        const tileBag = GrabbleEngine.createTileBag();

        // Create players with sequential turn order (player 1 always goes first)
        // Player 1 (id: 0) gets turnOrder 0, Player 2 (id: 1) gets turnOrder 1, etc.
        const playerColors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A']; // Distinct colors for 4 players
        const players: Player[] = playerNames.map((name, index) => ({
            id: index,
            name,
            color: playerColors[index],
            score: 0,
            rack: [],
            turnOrder: index // Sequential turn order: 0, 1, 2, 3
        }));

        // Deal initial tiles to each player
        for (const player of players) {
            for (let i = 0; i < 7; i++) {
                if (tileBag.length > 0) {
                    player.rack.push(tileBag.pop()!);
                }
            }
        }

        // Always start with player 1 (id: 0)
        const state: GameState = {
            board: GrabbleEngine.createEmptyBoard(),
            players,
            currentPlayerId: 0, // Always start with player 1
            tileBag,
            claimedWords: [],
            targetScore,
            gameStatus: 'playing'
        };

        return new GameStateManager(state);
    }

    /**
     * Load game from saved state
     */
    static loadGame(state: GameState): GameStateManager {
        return new GameStateManager(state);
    }

    private constructor(state: GameState) {
        this.state = state;
        this.engine = new GrabbleEngine(state);
    }

    /**
     * Get current game state
     */
    getState(): GameState {
        return this.engine.getState();
    }

    /**
     * Get game engine (for game logic operations)
     */
    getEngine(): GrabbleEngine {
        return this.engine;
    }

    /**
     * Get current player
     */
    getCurrentPlayer(): Player {
        const player = this.state.players.find(p => p.id === this.state.currentPlayerId);
        if (!player) {
            throw new Error(`Current player ${this.state.currentPlayerId} not found`);
        }
        return player;
    }

    /**
     * Get player by ID
     */
    getPlayer(playerId: number): Player | undefined {
        return this.state.players.find(p => p.id === playerId);
    }

    /**
     * Get all players sorted by turn order
     */
    getPlayersByTurnOrder(): Player[] {
        return [...this.state.players].sort((a, b) => a.turnOrder - b.turnOrder);
    }

    /**
     * Check if it's a specific player's turn
     */
    isPlayerTurn(playerId: number): boolean {
        return this.state.currentPlayerId === playerId;
    }

    /**
     * Get game status
     */
    getGameStatus(): 'waiting' | 'playing' | 'finished' {
        return this.state.gameStatus;
    }

    /**
     * Check if game is finished
     */
    isGameFinished(): boolean {
        return this.state.gameStatus === 'finished';
    }

    /**
     * Get winner if game is finished
     */
    getWinner(): Player | null {
        if (!this.isGameFinished() || this.state.winnerId === undefined) {
            return null;
        }
        return this.getPlayer(this.state.winnerId) || null;
    }

    /**
     * End game and determine winner (highest score)
     * Called when no legal moves remain
     */
    endGame(): Player {
        // Find player with highest score
        const winner = this.state.players.reduce((max, p) => 
            p.score > max.score ? p : max
        );

        this.state.gameStatus = 'finished';
        this.state.winnerId = winner.id;

        return winner;
    }

    /**
     * Serialize game state for storage
     */
    serialize(): string {
        return JSON.stringify(this.state);
    }

    /**
     * Deserialize game state from storage
     */
    static deserialize(serialized: string): GameStateManager {
        const state: GameState = JSON.parse(serialized);
        return new GameStateManager(state);
    }

    /**
     * Get claimed words for a specific player
     */
    getClaimedWordsForPlayer(playerId: number) {
        return this.state.claimedWords.filter(cw => cw.playerId === playerId);
    }

    /**
     * Get all claimed words
     */
    getAllClaimedWords() {
        return [...this.state.claimedWords];
    }

    /**
     * Get player scores as array
     */
    getPlayerScores(): Array<{ playerId: number; name: string; score: number }> {
        return this.state.players.map(p => ({
            playerId: p.id,
            name: p.name,
            score: p.score
        }));
    }

    /**
     * Get leaderboard (players sorted by score, descending)
     */
    getLeaderboard(): Player[] {
        return [...this.state.players].sort((a, b) => b.score - a.score);
    }
}

