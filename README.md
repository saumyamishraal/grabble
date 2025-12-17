# Grabble Game Engine

Core game engine for Grabble (Scrabble with Gravity) - a turn-based multiplayer word game.

## Overview

Grabble is played on a 7×7 grid where players drop tiles from column tops. Gravity resolves after placement, and players explicitly claim words for scoring.

## Core Components

### 1. Types (`types.ts`)
- `Tile` - Letter tile with point value
- `Position` - Board coordinates (x, y)
- `GameState` - Complete game state
- `Player` - Player information and rack
- `WordClaim` - Player's word declaration
- `ClaimedWord` - Scored word record

### 2. Game Engine (`game-engine.ts`)
Core game logic including:
- Tile bag creation and shuffling
- Board initialization
- Tile placement with gravity resolution
- Word validation and scoring
- Turn management
- Win condition checking

### 3. Game State Manager (`game-state-manager.ts`)
Game lifecycle management:
- Create new games
- Load/save game state
- Player management
- Turn order handling
- Leaderboard

### 4. Word Detection (`word-detection.ts`)
Word finding utilities:
- Find all words on board
- Validate word lines (horizontal/vertical/diagonal)
- Extract words from positions
- Check for new tile requirements

## Usage Example

```typescript
import { GameStateManager, GrabbleEngine } from './grabble';

// Create a new 2-player game
const gameManager = GameStateManager.createNewGame(
    2,
    ['Alice', 'Bob'],
    100  // target score
);

// Get current player
const currentPlayer = gameManager.getCurrentPlayer();

// Place tiles (example: place tile 'A' in column 3)
const engine = gameManager.getEngine();
engine.placeTiles([
    { column: 3, tile: { letter: 'A', points: 1 } }
], currentPlayer.id);

// Claim words (example: claim word at positions)
const dictionary = new Set(['CAT', 'DOG', 'BAT']); // Your dictionary
const newlyPlacedTiles = [{ x: 3, y: 0 }];
const claims = [{
    positions: [{ x: 2, y: 0 }, { x: 3, y: 0 }, { x: 4, y: 0 }],
    playerId: currentPlayer.id
}];

const result = await engine.processWordClaims(claims, newlyPlacedTiles, dictionary);
if (result.valid) {
    // Words validated and scored
    engine.refillPlayerRack(currentPlayer.id);
    engine.advanceTurn();
    
    // Check win condition
    const winnerId = engine.checkWinCondition();
    if (winnerId !== null) {
        console.log('Game won!');
    }
} else {
    // Move rejected - revert board state
    console.error('Invalid word claims');
}

// Swap tiles instead of placing
engine.swapTiles(currentPlayer.id, [0, 1]); // Swap first two tiles
engine.advanceTurn();

// Save game state
const serialized = gameManager.serialize();
localStorage.setItem('grabble-game', serialized);

// Load game state
const loaded = GameStateManager.deserialize(serialized);
```

## Key Features

### Gravity Resolution
Tiles fall straight down after placement. Gravity resolves column by column, moving tiles to the lowest available position.

### Word Validation
- Words must be 3+ letters
- Must exist in dictionary
- Must be a straight line (horizontal, vertical, or diagonal)
- Must contain at least one newly placed tile
- Cannot be claimed twice

### Scoring
- Base score: sum of letter values
- Diagonal bonus: ×2
- Palindrome bonus: ×2 (same forward/backward)
- Emordnilap bonus: ×2 (reverses to different valid word)
- Bonuses stack multiplicatively

### Turn Management
- Players take turns in randomized order
- Turn order fixed for entire game
- Players can swap tiles (pass turn) or place tiles

## Game Flow

1. **Setup**: Create game with 2-4 players, deal 7 tiles each
2. **Turn**: 
   - Player selects tiles from rack
   - Drops tiles into columns (from top)
   - Gravity resolves automatically
   - Player highlights and claims words
   - Words validated and scored
   - Rack refilled, turn advances
3. **Win**: First player to reach target score (default 100) wins

## Next Steps

This core engine is ready for:
- Frontend UI integration
- Socket.IO multiplayer server
- Dictionary API integration
- Database persistence

