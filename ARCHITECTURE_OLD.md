# Grabble Architecture

## Overview
Grabble is a turn-based multiplayer word game (2-4 players) on a 7×7 grid with gravity mechanics. Players drop tiles from column tops, gravity resolves, then players explicitly claim words for scoring.

**Supports Two Modes:**
- **Local Mode**: Single-device play using the local game engine
- **Multiplayer Mode**: Real-time online play via Socket.IO server

---

## System Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                     REACT FRONTEND                           │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐     │
│  │ App.tsx  │  │ Board.tsx│  │ Rack.tsx │  │LobbyScreen│    │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘     │
│         │              │           │             │           │
│         ▼              ▼           ▼             ▼           │
│  ┌─────────────────────────────────────────────────────┐    │
│  │               useSocket Hook                         │    │
│  │         (Socket.IO Client Connection)               │    │
│  └─────────────────────────────┬───────────────────────┘    │
└────────────────────────────────│─────────────────────────────┘
                                 │ WebSocket
                                 ▼
┌──────────────────────────────────────────────────────────────┐
│                    NODE.JS SERVER                            │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐   │
│  │ index.ts     │  │socket-events │  │  room-manager.ts │   │
│  │ (Express)    │  │    .ts       │  │  (Lobby Logic)   │   │
│  └──────────────┘  └──────────────┘  └──────────────────┘   │
│         │                  │                   │             │
│         ▼                  ▼                   ▼             │
│  ┌─────────────────────────────────────────────────────┐    │
│  │            SHARED GAME ENGINE                        │    │
│  │  game-engine.ts | game-state-manager.ts | types.ts  │    │
│  └─────────────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────────────┘
```

---

## File Structure

```
grabble/
├── src/                           # React Frontend
│   ├── App.tsx                    # Main app component & game logic
│   ├── components/                # React UI components
│   │   ├── ActionButtons.tsx      # Submit/Swap buttons
│   │   ├── BlankTileModal.tsx     # Blank tile letter selection
│   │   ├── Board.tsx              # 7×7 game board with drag-drop
│   │   ├── ErrorModal.tsx         # Error display modal
│   │   ├── LobbyScreen.tsx        # Multiplayer lobby UI
│   │   ├── Navbar.tsx             # Top navigation bar
│   │   ├── Rack.tsx               # Player tile rack
│   │   ├── ScoreArea.tsx          # Player scores display
│   │   ├── SetupModal.tsx         # Local game setup
│   │   ├── SwapConfirmModal.tsx   # Tile swap confirmation
│   │   └── WordsPanel.tsx         # Claimed words list
│   ├── hooks/
│   │   └── useSocket.ts           # Socket.IO client hook
│   ├── game-engine.ts             # Core game logic (SHARED)
│   ├── game-state-manager.ts      # Game lifecycle (SHARED)
│   ├── word-detection.ts          # Word finding utilities (SHARED)
│   ├── types.ts                   # TypeScript types (SHARED)
│   └── styles.scss                # Game styles
├── server/                        # Node.js Server
│   ├── index.ts                   # Express + Socket.IO server
│   ├── socket-events.ts           # Socket event handlers
│   ├── room-manager.ts            # Game room management
│   ├── dictionary.ts              # Server-side dictionary
│   └── types.ts                   # Server-specific types
├── public/
│   └── dictionary.txt             # Word dictionary (78,000+ words)
└── ARCHITECTURE.md                # This file
```

---

## React Components

### Main App (`App.tsx`)
The central component managing game state and user interactions.

| State Variable | Purpose |
|---------------|---------|
| `gameManager` | Local GameStateManager instance |
| `engine` | Local GrabbleEngine instance |
| `selectedTiles` | Indices of selected rack tiles |
| `selectedWords` | Positions of selected words for claiming |
| `tilesPlacedThisTurn` | Track tiles placed during current turn |
| `blankTileModal` | Modal state for blank tile letter selection |
| `isMultiplayer` | Whether in multiplayer mode |

### UI Components

| Component | File | Purpose |
|-----------|------|---------|
| **Board** | `Board.tsx` | Renders 7×7 grid, handles drag-drop, word selection |
| **Rack** | `Rack.tsx` | Player's 7 tiles, drag source, selection UI |
| **ScoreArea** | `ScoreArea.tsx` | All players' scores, highlights current player |
| **ActionButtons** | `ActionButtons.tsx` | Submit Move, Swap Tiles buttons |
| **WordsPanel** | `WordsPanel.tsx` | List of all claimed words |
| **LobbyScreen** | `LobbyScreen.tsx` | Create/join room, ready up, start game |
| **SetupModal** | `SetupModal.tsx` | Local game configuration (players, names) |
| **BlankTileModal** | `BlankTileModal.tsx` | Letter selection for blank tiles |
| **SwapConfirmModal** | `SwapConfirmModal.tsx` | Confirm tile swap action |
| **ErrorModal** | `ErrorModal.tsx` | Display error messages |
| **Navbar** | `Navbar.tsx` | Game title and current player indicator |
w
---

## Game Engine (`game-engine.ts`)

The `GrabbleEngine` class contains all core game logic, used by both local and server modes.

### Board Management
| Method | Purpose |
|--------|---------|
| `createEmptyBoard()` | Initialize 7×7 null-filled board |
| `placeTiles(placements, playerId)` | Place tiles at column tops, resolve gravity |
| `placeTileAtPosition(x, y, tile, playerId)` | Place tile at specific position |
| `removeTile(x, y)` | Remove tile and resolve gravity |
| `resolveGravity()` | Make all tiles fall to lowest empty cell |

### Tile Management
| Method | Purpose |
|--------|---------|
| `createTileBag()` | Create full Scrabble tile set (100 tiles) |
| `shuffle(array)` | Fisher-Yates shuffle algorithm |
| `removeTilesFromRack(playerId, indices)` | Remove tiles by index from player rack |
| `returnTileToRack(playerId, tile)` | Add tile back to player rack |
| `refillPlayerRack(playerId)` | Draw tiles to fill rack to 7 |
| `swapTiles(playerId, indices)` | Discard selected tiles, draw new ones |
| `setBlankTileLetter(x, y, letter, playerId)` | Set letter for blank tile |

### Word Validation & Scoring
| Method | Purpose |
|--------|---------|
| `extractWord(positions)` | Get word string from board positions |
| `validateWordClaim(claim, newTiles, dictionary)` | Validate single word claim |
| `processWordClaims(claims, newTiles, dictionary)` | Process all claims for a turn |
| `calculateWordScore(word, positions, dictionary)` | Calculate score with bonuses |
| `isPalindrome(word)` | Check if word reads same forwards/backwards |
| `isEmordnilap(word, positions, dictionary)` | Check if reverse is different valid word |

### Game Flow
| Method | Purpose |
|--------|---------|
| `getState()` | Get current game state (deep copy) |
| `advanceTurn()` | Move to next player's turn |
| `checkWinCondition()` | Check if any player reached target score |
| `canContinueGame()` | Check if moves are still possible |

---

## Game State Manager (`game-state-manager.ts`)

Higher-level wrapper managing game lifecycle.

| Method | Purpose |
|--------|---------|
| `createNewGame(numPlayers, names, targetScore)` | Initialize new game |
| `loadGame(state)` | Restore game from saved state |
| `getState()` | Get current game state |
| `getEngine()` | Get GrabbleEngine instance |
| `getCurrentPlayer()` | Get player whose turn it is |
| `getPlayer(playerId)` | Get specific player by ID |
| `getPlayersByTurnOrder()` | Get players sorted by turn order |
| `isPlayerTurn(playerId)` | Check if it's a player's turn |
| `getGameStatus()` | Get 'waiting' | 'playing' | 'finished' |
| `isGameFinished()` | Check if game is over |
| `getWinner()` | Get winning player |
| `endGame()` | End game and determine winner |
| `serialize()` / `deserialize()` | Save/load game state |
| `getClaimedWordsForPlayer(playerId)` | Get player's claimed words |
| `getAllClaimedWords()` | Get all claimed words |
| `getPlayerScores()` | Get score array |
| `getLeaderboard()` | Get players sorted by score |

---

## Word Detection (`word-detection.ts`)

Utility functions for finding and validating words.

| Function | Purpose |
|----------|---------|
| `findAllWords(board)` | Find all words on board (all directions) |
| `findWordsInDirection(board, x, y, dx, dy)` | Find words from position in direction |
| `extractWordFromPositions(board, positions, preserveOrder)` | Get word string from positions |
| `isValidWordLine(positions)` | Check positions form straight line |
| `getReverseWord(board, positions)` | Get word read in reverse |
| `containsNewTile(positions, newTiles)` | Check if word contains new tile |
| `getWordDirection(positions)` | Get direction vector of word |
| `areWordsSameDirection(word1, word2)` | Check if words are parallel |
| `isSubstringWord(claimed, longer)` | Check if word is substring of another |

---

## Multiplayer Server

### Socket Events (`socket-events.ts`)

#### Client → Server Events
| Event | Payload | Purpose |
|-------|---------|---------|
| `create_room` | `{ playerName, targetScore }` | Create new game room |
| `join_room` | `{ roomCode, playerName }` | Join existing room |
| `leave_room` | - | Leave current room |
| `set_ready` | `{ ready: boolean }` | Toggle ready status |
| `start_game` | - | Host starts the game |
| `place_tiles` | `{ placements: [{column, tileIndex}] }` | Place tiles on board |
| `claim_words` | `{ claims: [{positions}] }` | Submit word claims |
| `swap_tiles` | `{ tileIndices: number[] }` | Swap selected tiles |
| `end_turn` | - | End turn without claiming |
| `remove_tile` | `{ column, row }` | Remove tile from board |
| `set_blank_letter` | `{ x, y, letter }` | Set blank tile letter |

#### Server → Client Events
| Event | Payload | Purpose |
|-------|---------|---------|
| `room_created` | `{ roomCode, room }` | Room successfully created |
| `room_joined` | `{ room, playerId }` | Successfully joined room |
| `room_state` | `room` | Updated room state |
| `player_joined` | `player` | New player joined |
| `player_left` | `playerId` | Player left room |
| `player_ready` | `{ playerId, ready }` | Player ready state changed |
| `game_started` | `gameState` | Game has begun |
| `game_state` | `gameState` | Full state update |
| `tiles_placed` | `{ playerId, gameState, placedPositions }` | Tiles were placed |
| `tile_removed` | `{ playerId, gameState, removedPosition }` | Tile was removed |
| `words_claimed` | `{ playerId, results, gameState }` | Words were claimed |
| `tiles_swapped` | `{ playerId, gameState }` | Tiles were swapped |
| `turn_changed` | `{ currentPlayerId, gameState }` | Turn advanced |
| `game_ended` | `{ winnerId, finalState }` | Game finished |
| `blank_letter_set` | `{ x, y, letter, gameState }` | Blank tile letter set |
| `error` | `{ message, code? }` | Error occurred |

### Room Manager (`room-manager.ts`)

Manages game lobbies and player connections.

| Method | Purpose |
|--------|---------|
| `createRoom(hostId, name, targetScore)` | Create new room with 4-char code |
| `joinRoom(code, socketId, name)` | Add player to room |
| `leaveRoom(socketId)` | Remove player, transfer host if needed |
| `setPlayerReady(socketId, ready)` | Set ready state |
| `areAllPlayersReady(code)` | Check if game can start |
| `getRoom(code)` | Get room by code |
| `getRoomByPlayer(socketId)` | Get room by player |
| `updateGameState(code, state)` | Update room's game state |
| `setRoomStatus(code, status)` | Set room status |
| `getGamePlayerId(socketId)` | Map socket ID to game player ID |

---

## Scoring System

```
Base Score = Sum of tile point values

Bonuses (multiplicative):
├── Diagonal Word:  ×2
├── Palindrome:     ×2  (reads same forwards/backwards)
└── Emordnilap:     ×2  (reverse is different valid word)

Maximum multiplier: ×8 (diagonal palindrome emordnilap)
```

### Tile Point Values
| Points | Letters |
|--------|---------|
| 1 | A, E, I, O, U, L, N, S, T, R |
| 2 | D, G |
| 3 | B, C, M, P |
| 4 | F, H, V, W, Y |
| 5 | K |
| 8 | J, X |
| 10 | Q, Z |
| 0 | Blank (can be any letter) |

---

## Data Flow

### Local Game Flow
```
User Action → App.tsx → GameEngine → State Update → React Re-render
```

### Multiplayer Game Flow
```
User Action → App.tsx → useSocket → Socket.IO → Server
                                                  ↓
                                            socket-events.ts
                                                  ↓
                                            GameEngine
                                                  ↓
                                            Broadcast to all
                                                  ↓
                              All Clients ← useSocket ← Socket.IO
```

---

## Technology Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 19, TypeScript |
| Styling | SCSS (mobile-first) |
| Build | Create React App |
| Server | Node.js, Express, Socket.IO |
| Game Logic | Pure TypeScript |
| Dictionary | Text file (78,000+ words) |

---

## Development Commands

```bash
# Start frontend (port 3000)
npm start

# Start server (port 3001)
cd server && npx ts-node index.ts

# Build for production
npm run build
```
