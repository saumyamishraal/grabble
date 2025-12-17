# Grabble

Scrabble with Gravity - A turn-based multiplayer word game built with React and TypeScript.

## Overview

Grabble is played on a 7×7 grid where players drop tiles from column tops. Gravity resolves after placement, and players explicitly claim words for scoring. First player to reach the target score (default 100) wins!

## Features

- 🎮 Turn-based multiplayer (2-4 players)
- 📱 Mobile-first responsive design
- 🎯 Gravity mechanics - tiles fall straight down
- 📝 Explicit word claiming - players highlight words themselves
- 🏆 Scoring with bonuses (diagonal, palindrome, emordnilap)
- 📚 Dictionary validation from text file
- ⚛️ Built with React and TypeScript

## Quick Start

### Prerequisites
- Node.js 16+ and npm

### Installation

1. **Clone the repository**:
   ```bash
   git clone https://github.com/saumyamishraal/grabble.git
   cd grabble
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Add dictionary file** (optional):
   - Create `public/dictionary.txt` with one word per line
   - If missing, a fallback dictionary will be used

4. **Start the development server**:
   ```bash
   npm start
   ```
   Opens at http://localhost:3000

5. **Build for production**:
   ```bash
   npm run build
   ```

## How to Play

1. **Setup**: Enter player names (2-4 players) and target score
2. **Your Turn**: 
   - Click tiles in your rack to select them
   - Click a column header (top row) to drop selected tiles
   - Gravity resolves automatically
   - Click cells on the board to highlight words
   - Click "Submit Move" to validate and score words
3. **Scoring**: Words score points based on letter values + bonuses
4. **Win**: First player to reach target score wins!

## Game Rules

- **Tile Placement**: Drop tiles from column tops (row 0)
- **Gravity**: Tiles fall straight down after placement
- **Word Claiming**: Players must explicitly highlight words
- **Word Requirements**: 
  - Must be 3+ letters
  - Must be in dictionary
  - Must be a straight line (horizontal/vertical/diagonal)
  - Must contain at least one newly placed tile
- **Bonuses**:
  - Diagonal words: ×2
  - Palindromes: ×2
  - Emordnilaps: ×2 (reverses to different valid word)
  - Bonuses stack multiplicatively

## Project Structure

```
grabble/
├── src/
│   ├── components/        # React UI components
│   │   ├── SetupModal.tsx
│   │   ├── Board.tsx
│   │   ├── Rack.tsx
│   │   └── ...
│   ├── game-engine/       # Core game logic
│   │   ├── game-engine.ts
│   │   ├── game-state-manager.ts
│   │   └── ...
│   ├── App.tsx           # Main app component
│   └── styles.scss       # Game styles
├── public/
│   └── dictionary.txt    # Word dictionary (add your own)
├── README.md
└── ARCHITECTURE.md       # Detailed architecture documentation
```

## Development

### Available Scripts

- `npm start` - Start development server
- `npm run build` - Build for production
- `npm test` - Run tests
- `npm run eject` - Eject from Create React App

### Adding Features

- **UI Components**: Add to `src/components/`
- **Game Logic**: Modify `src/game-engine/`
- **Styling**: Update `src/styles.scss`

## Dictionary Format

The dictionary file (`public/dictionary.txt`) should contain one word per line:
```
CAT
DOG
BAT
RAT
...
```

Words are automatically:
- Converted to uppercase
- Filtered to 3+ letters only
- Validated as letters only

## Architecture

See [ARCHITECTURE.md](./ARCHITECTURE.md) for detailed architecture documentation.

## License

ISC

## Contributing

Contributions welcome! Please feel free to submit a Pull Request.
