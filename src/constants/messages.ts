/**
 * Centralized UI Messages
 * All user-facing text strings are stored here for easy editing and maintenance.
 */

export const UI_MESSAGES = {
  // ============================================
  // BUTTONS & ACTIONS
  // ============================================
  buttons: {
    submitMove: 'Submit Move',
    swapTiles: 'Swap Tiles',
    swapTilesWithCount: (count: number) => `Swap Tiles${count > 0 ? ` (${count})` : ''}`,
    swapTilesTooltip: (count: number) => count > 0 
      ? `Swap ${count} selected tile${count !== 1 ? 's' : ''}` 
      : 'Select tiles to swap',
    hint: '💡 Hint',
    hintWithLevel: (level: number) => `💡 Hint (${level}/4)`,
    hintFullSolution: '💡 Full Solution',
    hintTooltip: (level: number) => level === 0 
      ? 'Get a hint' 
      : `Click for more detail (level ${level + 1})`,
    clear: 'Clear',
    clearSelection: 'Clear selection',
    cancel: 'Cancel',
    confirm: 'Confirm',
    ok: 'OK',
    close: 'Close',
    back: 'Back',
    accept: 'Accept',
    decline: 'Decline',
    startGame: 'Start Game',
    startSolo: '🧘 Start Solo',
    createRoom: 'Create Room',
    joinRoom: 'Join Room',
    playLocal: 'Play Local',
    imReady: "I'm Ready!",
    notReady: 'Not Ready',
    leaveRoom: 'Leave Room',
    startNewGame: 'Start New Game',
    requestClearBoard: 'Clear Tiles',
    turnSoundOn: 'Turn Sound On',
    turnSoundOff: 'Turn Sound Off',
    confirmSwap: 'Confirm Swap',
  },

  // ============================================
  // LOBBY SCREEN
  // ============================================
  lobby: {
    title: 'Grabble',
    subtitle: 'Scrabble with Gravity',
    connected: '🟢 Connected to server',
    connecting: '🔴 Connecting...',
    or: 'or',
    gameLobby: '🎮 Game Lobby',
    roomCode: 'Room Code:',
    copyToClipboard: 'Copy to clipboard',
    players: (count: number, max: number) => `Players (${count}/${max})`,
    host: '👑 Host',
    you: '(You)',
    ready: '✓ Ready',
    notReady: 'Not Ready',
    waitingForPlayers: 'Waiting for more players to join...',
    allPlayersMustBeReady: 'All players must be ready',
    startTheGame: 'Start the game',
    yourName: 'Your Name:',
    enterYourName: 'Enter your name',
    targetScore: 'Target Score:',
    enableHints: 'Enable Hints',
    roomCodePlaceholder: 'e.g. AB3K',
  },

  // ============================================
  // SETUP MODAL
  // ============================================
  setup: {
    startNewGame: 'Start New Game',
    gameMode: 'Game Mode:',
    versus: '🎮 Versus',
    soloEndless: '🧘 Solo Endless',
    numberOfPlayers: 'Number of Players:',
    players: (count: number) => `${count} Players`,
    playerName: (index: number) => `Player ${index + 1} Name:`,
    targetScore: 'Target Score:',
    zenMode: '🧘 Zen Mode (hide score)',
    zenModeDescription: '🎯 Build words endlessly until the board fills up!',
    zenModeHighScore: '📈 Your high score will be saved on this device.',
    enableHints: '💡 Enable Hints',
  },

  // ============================================
  // ACTION BUTTONS & GAME ACTIONS
  // ============================================
  actions: {
    selectedWords: 'Selected Words:',
  },

  // ============================================
  // WORDS PANEL
  // ============================================
  words: {
    claimedWords: 'Scored Words',
    noWordsClaimed: 'No words scored yet',
  },

  // ============================================
  // NAVBAR & INFO MODAL
  // ============================================
  navbar: {
    title: 'Grabble',
    howToPlay: 'How to play',
    howToPlayTitle: 'How to Play Grabble',
    objective: 'Objective',
    objectiveDescription: 'Form words on a 7×7 grid using Scrabble tiles. Be the first to reach the target score!',
    placingTiles: 'Placing Tiles',
    placingTilesItems: [
      'Drag tiles from your rack to the top row of any column',
      'Tiles automatically fall to the lowest empty space in that column.',
      'You can also drag tiles directly to any empty cell on the board',
    ],
    formingWords: 'Forming Words',
    formingWordsItems: [
      'Drag your cursor across tiles to select a word (horizontal, vertical, or diagonal)',
      'Words must be at least 3 letters long',
      'All words must be valid dictionary words',
      'You can select multiple words before submitting',
    ],
    removingTiles: 'Removing Tiles',
    removingTilesItems: [
      'Double-click a tile to remove it (only tiles placed this turn)',
      'Drag a tile out of the board to remove it',
      'Click the × button on a tile to remove it',
      'You can only remove tiles you placed during your current turn',
    ],
    scoring: 'Scoring',
    scoringItems: [
      'Base Score: Sum of letter values',
      'Diagonal Bonus: 2× multiplier for diagonal words',
      'Palindrome Bonus: 2× multiplier for words that read the same forwards and backwards (e.g., "RADAR")',
      'Emordnilap Bonus: 2× multiplier when a word and its reverse are both valid (e.g., "TIN" and "NIT")',
      'Bonuses stack multiplicatively',
    ],
    specialTiles: 'Special Tiles',
    specialTilesItems: [
      'Blank Tiles: Click to assign a letter. The letter is locked after you submit your move',
      'Blank tiles are worth 0 points',
    ],
    otherActions: 'Other Actions',
    otherActionsItems: [
      'Swap Tiles: Select tiles from your rack and swap them for new ones (costs your turn)',
      'Submit Move: Submit all selected words to score points',
    ],
  },

  // ============================================
  // BLANK TILE MODAL
  // ============================================
  blankTile: {
    title: 'Enter Letter for Blank Tile',
    description: 'What letter should this blank tile represent?',
    letter: 'Letter:',
  },

  // ============================================
  // SWAP CONFIRM MODAL
  // ============================================
  swap: {
    title: 'Confirm Swap Tiles',
    description: (count: number) => `You are about to swap ${count} tile${count !== 1 ? 's' : ''}. This will end your turn.`,
    tilesToSwap: 'Tiles to swap:',
    points: 'pts',
  },

  // ============================================
  // NEW GAME REQUEST MODAL
  // ============================================
  newGameRequest: {
    requestSent: 'Request Sent',
    waitingForAcceptance: 'Waiting for all players to accept the new game request...',
    title: 'New Game Request',
    requestMessage: (name: string) => `${name} wants to start a new game. Do you accept?`,
    requestDeclined: 'Request Declined',
    declinedMessage: (name: string) => `${name} declined the new game request. The current game will continue.`,
  },

  // ============================================
  // ERROR MESSAGES
  // ============================================
  errors: {
    error: 'Error',
    boardClearingComingSoon: 'Board clearing functionality coming soon!',
    cannotRemoveOwnTiles: 'You can only remove your own tiles.',
    cannotRemoveDuringTurn: 'You can only remove tiles during your turn.',
    cannotMoveOwnTiles: 'You can only move your own tiles.',
    cannotMoveDuringTurn: 'You can only move tiles during your turn.',
    cannotMoveTilesPlacedThisTurn: 'You can only move tiles placed this turn.',
    dictionaryLoading: 'Dictionary is still loading. Please wait...',
    selectWordBeforeSubmit: 'Please select at least one word by dragging from start to finish before submitting.',
    selectValidWords: 'Please select valid words (straight lines of 3+ tiles) by dragging.',
    mustContainNewTile: 'At least one selected word must contain a tile you placed this turn.',
    errorPlacingTile: (error: string) => `Error placing tile: ${error}`,
    errorRemovingTile: (error: string) => `Error removing tile: ${error}`,
    errorMovingTile: (error: string) => `Error moving tile: ${error}`,
    unclaimedTiles: (letters: string) => `All tiles placed this turn must be part of a selected word. The following tiles are not part of any selected word: ${letters}`,
    mustPlaceTile: 'You must place at least one tile to make a move.',
    placeTilesAndSelectWord: 'Please place tiles and select at least one word by dragging before submitting.',
    dictionaryNotLoaded: 'Dictionary not loaded yet. Please wait...',
    invalidWordClaims: (errors: string) => `Invalid word claims: ${errors}`,
    invalidWordClaimsGeneric: 'Invalid word claims. Please check your word selection.',
    gameOver: (name: string, score: number) => `Game Over! ${name} wins with ${score} points!`,
    errorSubmittingMove: (error: string) => `Error: ${error}`,
    selectTilesToSwap: 'Please select tiles to swap.',
    gameNotInitialized: 'Game not initialized.',
    errorSwappingTiles: (error: string) => `Error swapping tiles: ${error}`,
  },

  // ============================================
  // HINT MESSAGES
  // ============================================
  hints: {
    cannotGetHint: '⚠️ Cannot get hint right now',
    hintsNotAvailable: '⚠️ Hints are not available until a word has been played. Complete your first move!',
    noSingleTileHint: '⚠️ No single-tile hint found. Consider swapping tiles?',
    wordsPossible: '✅ Words are possible! Click again for more detail.',
    highlightedTilesCanFormWord: (count: number) => count === 2
      ? '💡 Highlighted tiles can form a word together (2-tile move).'
      : '💡 Highlighted tile can form a word.',
    lookForWord: (word: string, length: number) => `🔤 Look for: ${word} (${length} letters)`,
    lookForLength: (length: number) => `🔤 Look for a ${length || '?'}-letter word`,
    placeTilesInColumns: (col1: number, col2: number) => `📍 Place tiles in columns ${col1} and ${col2}`,
    placeTileInColumn: (col: number) => `📍 Place highlighted tile in column ${col}`,
    fullSolutionWord: (word: string, cols: number[]) => {
      if (cols.length === 2) {
        return `🎯 Word: ${word} (Columns ${cols[0]}, ${cols[1]})`;
      }
      return `🎯 Word: ${word} (Column ${cols[0]})`;
    },
  },

  // ============================================
  // BONUS OVERLAY
  // ============================================
  bonus: {
    points: (points: number) => `+${points} points`,
  },
} as const;

// Type helper for message keys (useful for TypeScript autocomplete)
export type MessageKey = keyof typeof UI_MESSAGES;

