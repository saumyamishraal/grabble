# Grabble Architecture Plan

## Overview
Grabble is a turn-based multiplayer word game (2-4 players) on a 7×7 grid with gravity mechanics. Players drop tiles from column tops, gravity resolves, then players explicitly claim words for scoring.

## Architecture Decision: React Frontend with Core Game Engine

**Why React**: Component-based architecture makes UI development much easier, automatic re-rendering, better state management, and excellent developer experience.

**Core Engine**: TypeScript game engine handles all game logic, reusable across different UI implementations.

## System Components

### 1. Frontend (React/TypeScript)
**Location**: `react-ui/src/`

**Key Files**:
- `App.tsx` - Main app component with game state management
- `components/SetupModal.tsx` - Game setup interface
- `components/Navbar.tsx` - Top navigation bar
- `components/ScoreArea.tsx` - Player scores display
- `components/Board.tsx` - 7×7 game board rendering
- `components/Rack.tsx` - Player tile rack
- `components/ActionButtons.tsx` - Submit/Swap buttons
- `components/WordsPanel.tsx` - Claimed words list

**Responsibilities**:
- Render UI components
- Handle user interactions
- Manage React state
- Call game engine methods
- Display game state reactively

### 2. Core Game Engine (TypeScript)
**Location**: `react-ui/src/game-engine/`

**Key Files**:
- `game-engine.ts` - Core game logic (gravity, scoring, validation)
- `game-state-manager.ts` - Game lifecycle and player management
- `word-detection.ts` - Word finding and validation utilities
- `types.ts` - TypeScript interfaces and types

**Responsibilities**:
- Tile bag creation and shuffling
- Board state management
- Gravity resolution algorithm
- Word validation and scoring
- Turn management
- Win condition checking

### 3. Dictionary Integration
**Location**: `react-ui/public/dictionary.txt`

**Format**: One word per line, automatically loaded on app start
- Words converted to uppercase
- Only 3+ letter words used
- Falls back to basic dictionary if file missing

## Data Flow

### Game Creation Flow
1. User opens app → Setup modal appears
2. User enters player names and settings
3. `App.tsx` calls `GameStateManager.createNewGame()`
4. Game engine initializes board, deals tiles
5. React state updates → UI renders game

### Turn Flow
1. Player selects tiles from rack (React state)
2. Player clicks column to drop tiles
3. `App.tsx` calls `engine.placeTiles()`
4. Engine resolves gravity automatically
5. Player highlights words on board (React state)
6. Player clicks "Submit Move"
7. `App.tsx` calls `engine.processWordClaims()`
8. Engine validates words, calculates scores
9. Engine advances turn, refills rack
10. React state updates → UI re-renders

### State Synchronization
- React manages UI state (selected tiles, word positions)
- Game engine manages game state (board, scores, turn)
- React components read from game engine state
- User actions trigger engine methods
- Engine state changes trigger React re-renders

## Key Algorithms

### Gravity Resolution
```
For each column (left to right):
  Collect all tiles in column (top to bottom)
  Clear column
  Place tiles back from bottom up
```

### Word Detection
- Find all words on board (horizontal, vertical, diagonal)
- Validate word lines are straight
- Extract letters from positions
- Check dictionary membership

### Scoring
```
Base score = sum of letter values
If diagonal: multiply by 2
If palindrome: multiply by 2
If emordnilap: multiply by 2
Bonuses stack multiplicatively
```

## Technology Stack

- **Frontend**: React 19, TypeScript
- **Styling**: SCSS (mobile-first responsive)
- **Build**: Create React App (CRA)
- **Game Engine**: Pure TypeScript (no dependencies)
- **Dictionary**: Text file (one word per line)

## File Structure

```
grabble/
├── react-ui/
│   ├── src/
│   │   ├── components/        # React UI components
│   │   ├── game-engine/       # Core game logic
│   │   ├── App.tsx            # Main app
│   │   └── styles.scss        # Game styles
│   ├── public/
│   │   └── dictionary.txt     # Word dictionary
│   └── package.json
├── README.md                   # Project overview
└── ARCHITECTURE.md            # This file
```

## Implementation Phases

### Phase 1: Core Game Engine ✅
- Board state management
- Tile bag and distribution
- Gravity resolution
- Word detection
- Scoring system

### Phase 2: React UI ✅
- Component architecture
- State management
- User interactions
- Dictionary loading

### Phase 3: Future Enhancements
- Multiplayer via Socket.IO
- Database persistence
- Real-time synchronization
- Mobile app version

## Key Design Decisions

1. **React for UI**: Much easier than vanilla TypeScript DOM manipulation
2. **Separate Game Engine**: Reusable logic, testable independently
3. **Text Dictionary**: Simple, easy to replace with API later
4. **Mobile-First**: Responsive design for all devices
5. **Component-Based**: Each UI piece is independent and reusable

## Migration Path: Prototype → Production

When ready to add multiplayer:
1. Extract game engine to shared package
2. Add Socket.IO server
3. Move state management to server
4. Add database persistence
5. Keep React UI, connect via Socket.IO client

