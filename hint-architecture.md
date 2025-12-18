# Hint Mechanism Architecture

## Problem Statement

Players can get stuck when they can't find valid words with their current rack + accessible board positions. We need a frictionless hint system that:
- Reduces frustration without removing the puzzle challenge
- Is computationally efficient (real-time response)
- Works for both local and multiplayer modes
- Penalizes hint usage to preserve competitive integrity

---

## Design Decisions (Confirmed)

| Decision | Choice | Rationale |
|----------|--------|-----------|
| **Search Strategy** | Greedy (early-exit) | Find first valid word, not all/best |
| **Blank Tile Handling** | Try A→Z, stop at first hit | ~13 avg checks, not 26 |
| **Score Preview** | No | Hints guide, not optimize |
| **Multiplayer Hints** | Allowed with penalty | Cooldown + reduced score multiplier |
| **Hint Penalty** | Score multiplier reduction | Hinted words score at reduced rate |

---

## Part 1: Hint Types (Progressive Disclosure)

Hints escalate in specificity. Players can request increasingly detailed help.

### Level 0: "Possible?" Check
**Question answered**: "Can I even make a word right now?"
- Boolean indicator: ✅ words possible / ⚠️ consider swapping
- No spoilers, just reassurance or nudge to swap

### Level 1: Rack Highlight
**Question answered**: "Which of my tiles are useful?"
- Highlight rack tiles that can form at least one valid word
- Grayed out tiles are "dead" for this turn
- Doesn't reveal the word or placement

### Level 2: Column Hint
**Question answered**: "Where should I look?"
- Highlight board columns where a word can be formed
- Combined with Level 1: "Use tile X in column Y area"
- Still requires player to figure out the actual word

### Level 3: Partial Word
**Question answered**: "What word am I looking for?"
- Show first letter + blanks: `C _ T` (3-letter word starting with C)
- Or show word length: "Look for a 5-letter word"

### Level 4: Full Solution
**Question answered**: "Just tell me!"
- Reveal one complete valid move
- Show: which tile(s), which column(s), resulting word(s)
- **No score preview** (player discovers score on submission)

### Swap Suggestion
**Triggered when**: No valid words found after full search
- "Consider swapping these tiles: Q, X, Z"
- Suggest tiles least likely to form words given dictionary analysis

---

## Part 2: Hint Penalties

### Penalty System

Words formed using hints receive reduced scoring:

```
Normal word score:    base × bonuses (diagonal, palindrome, emordnilap)
Hinted word score:    base × bonuses × HINT_PENALTY_MULTIPLIER
```

**Proposed multiplier**: `0.5` (50% of normal score)

### Multiplayer Considerations

| Aspect | Behavior |
|--------|----------|
| **Availability** | Hints allowed for all players |
| **Cooldown** | Cannot request hint for N seconds after using one |
| **Penalty** | Hinted words score at reduced multiplier |
| **Tracking** | Server tracks which placements used hints |

### Implementation

```typescript
interface HintUsage {
  turnNumber: number;
  levelUsed: 0 | 1 | 2 | 3 | 4;
  tilesAffected: number[];  // rack indices that were hinted
}

// When scoring a word:
if (wordUsedHintedTiles(placements, hintUsage)) {
  score = score * HINT_PENALTY_MULTIPLIER;
}
```

---

## Part 3: The Computational Problem

### Input
```
Given:
  - board[7][7]: current tile configuration
  - rack[1-7]: player's available tiles
  - dictionary: set of valid words (via Trie)

Find:
  - ONE valid word (greedy/early-exit)
  - Stop as soon as a valid placement is found
```

### Key Insight: "Accessible Positions"

A tile can only land where gravity takes it:

```
For each column (0-6):
  accessible_row = lowest empty row (after gravity)
  (or -1 if column is full)
```

This reduces search space from 49 to ≤7 positions.

### 8 Directions (Not 4!)

When a tile lands at position (x, y), it could form/extend words in **8 directions**:

```
    ↖  ↑  ↗
     \ | /
   ← ─ ● ─ →
     / | \
    ↙  ↓  ↘
```

| Direction | Vector (dx, dy) |
|-----------|-----------------|
| Right | (1, 0) |
| Left | (-1, 0) |
| Down | (0, 1) |
| Up | (0, -1) |
| Down-Right | (1, 1) |
| Down-Left | (-1, 1) |
| Up-Right | (1, -1) |
| Up-Left | (-1, -1) |

Each direction must be checked separately because a new tile might:
- Continue an existing word in one direction
- Create a new word starting from the tile
- Bridge two partial sequences

---

## Part 4: Greedy Algorithm (Early-Exit)

### Core Principle

**Stop at first valid word found.** Don't enumerate all possibilities.

```
function findFirstValidWord(board, rack, trie):
  for col in 0..6:
    landing_row = getAccessibleRow(col)
    if landing_row < 0: continue
    
    for direction in ALL_8_DIRECTIONS:
      for tileIndex, tile in enumerate(rack):
        // Simulate placing this tile
        testBoard = simulatePlacement(board, col, tile)
        
        // Check if this creates a valid word in this direction
        word = extractWordAtPosition(testBoard, col, landing_row, direction)
        
        if len(word) >= 3 and trie.hasWord(word):
          // EARLY EXIT: Found a valid word!
          return {
            tile: tileIndex,
            column: col,
            word: word,
            direction: direction
          }
  
  return null  // No valid words found → suggest swap
```

### Blank Tile Handling (Greedy)

```
function tryBlankTile(board, col, direction, trie):
  for letter in 'A'..'Z':
    tile = { letter: letter, isBlank: true }
    testBoard = simulatePlacement(board, col, tile)
    word = extractWordAtPosition(testBoard, col, landing_row, direction)
    
    if trie.hasWord(word):
      return { letter, word }  // EARLY EXIT
  
  return null
```

Average case: ~13 letter attempts (assuming uniform distribution of valid words).

### Complexity Analysis

| Step | Complexity |
|------|------------|
| Columns | O(7) |
| Directions per position | O(8) |
| Rack tiles per direction | O(7) |
| Word extraction + validation | O(word_length) ≈ O(10) |
| **Worst case (no valid words)** | **O(7 × 8 × 7 × 10) ≈ 4,000 ops** |
| **Best case (first try works)** | **O(1 × 1 × 1 × 10) ≈ 10 ops** |

Both are real-time (< 10ms even worst case).

---

## Part 5: Trie Data Structure

### Building the Trie

```typescript
class Trie {
  root: TrieNode = { children: new Map(), isWord: false };
  
  insert(word: string): void {
    let node = this.root;
    for (const char of word.toUpperCase()) {
      if (!node.children.has(char)) {
        node.children.set(char, { children: new Map(), isWord: false });
      }
      node = node.children.get(char)!;
    }
    node.isWord = true;
    node.word = word;
  }
  
  hasWord(word: string): boolean {
    const node = this.traverse(word);
    return node !== null && node.isWord;
  }
  
  hasPrefix(prefix: string): boolean {
    return this.traverse(prefix) !== null;
  }
  
  private traverse(str: string): TrieNode | null {
    let node = this.root;
    for (const char of str.toUpperCase()) {
      if (!node.children.has(char)) return null;
      node = node.children.get(char)!;
    }
    return node;
  }
}
```

### Memory Estimate

- 78,000 words × avg 6 chars = ~470,000 nodes
- Each node: ~50 bytes (Map overhead + flags)
- **Total: ~25MB** (acceptable for browser)

Optimization: Use compressed trie (DAWG) to reduce to ~5MB if needed.

---

## Part 6: Swap Suggestion Logic

### When to Suggest

```
if findFirstValidWord() returns null:
  return getSwapSuggestion(rack)
```

### Tile Playability Scoring

Precompute based on dictionary frequency:

```typescript
const LETTER_PLAYABILITY: Record<string, number> = {
  // High playability (common in words)
  'E': 0.95, 'A': 0.90, 'R': 0.85, 'I': 0.85, 'O': 0.82,
  'T': 0.80, 'N': 0.78, 'S': 0.77, 'L': 0.72, 'C': 0.65,
  // ... medium ...
  'U': 0.55, 'D': 0.52, 'P': 0.48, 'M': 0.45, 'H': 0.42,
  // Low playability (hard to use)
  'G': 0.35, 'B': 0.30, 'F': 0.28, 'Y': 0.25, 'W': 0.23,
  'K': 0.18, 'V': 0.15, 'X': 0.08, 'Z': 0.06, 'J': 0.05, 'Q': 0.03
};

function getSwapSuggestion(rack: Tile[]): number[] {
  // Sort rack by playability (ascending = hardest first)
  const ranked = rack
    .map((tile, index) => ({ index, score: LETTER_PLAYABILITY[tile.letter] || 0.5 }))
    .sort((a, b) => a.score - b.score);
  
  // Suggest swapping bottom 2-3 tiles
  return ranked.slice(0, Math.min(3, rack.length)).map(t => t.index);
}
```

---

## Part 7: Data Structures

### Trie Node
```typescript
interface TrieNode {
  children: Map<string, TrieNode>;
  isWord: boolean;
  word?: string;
}
```

### Hint Result
```typescript
interface HintResult {
  level: 0 | 1 | 2 | 3 | 4;
  
  // Level 0
  hasMoves: boolean;
  
  // Level 1+
  usefulTiles?: number[];  // rack indices
  
  // Level 2+
  targetColumns?: number[];
  
  // Level 3+
  partialWord?: string;  // e.g., "C_T"
  wordLength?: number;
  
  // Level 4 (no score shown)
  fullSolution?: {
    placements: Array<{column: number, tileIndex: number}>;
    resultingWord: string;
  };
  
  // Swap suggestion (when no words found)
  suggestSwap?: boolean;
  tilesToSwap?: number[];
}
```

### Hint State (for penalty tracking)
```typescript
interface HintState {
  used: boolean;
  levelUsed: number;
  affectedTileIndices: number[];
  timestamp: number;  // for cooldown
}
```

---

## Part 8: Implementation Plan

### Phase 1: Trie Infrastructure
- [ ] Create `src/hint-engine.ts`
- [ ] Implement `Trie` class with insert/hasWord/hasPrefix
- [ ] Build Trie from dictionary on app load
- [ ] Add to existing dictionary loading flow

### Phase 2: Core Hint Algorithm
- [ ] `getAccessiblePositions(board)` → `{column, row}[]`
- [ ] `findFirstValidWord(board, rack, trie)` → `HintResult | null`
- [ ] Handle blank tiles with greedy letter search
- [ ] Handle 8 directions correctly

### Phase 3: Progressive Hints
- [ ] Internal: always compute full solution first
- [ ] `getHintAtLevel(fullSolution, level)` → masked result
- [ ] Track hint usage per turn

### Phase 4: Hint Penalties
- [ ] Track which tiles were hinted
- [ ] Modify scoring to apply `HINT_PENALTY_MULTIPLIER`
- [ ] Display penalty in UI (e.g., "50% hint penalty")

### Phase 5: UI Components
- [ ] "Hint" button (shows hint level indicator)
- [ ] Rack tile highlighting (Level 1)
- [ ] Column highlighting on board (Level 2)
- [ ] Partial word display (Level 3)
- [ ] Full solution overlay (Level 4)

### Phase 6: Multiplayer Integration
- [ ] Add hint cooldown timer (e.g., 30 seconds between hints)
- [ ] Server-side hint tracking for fairness
- [ ] Broadcast hint usage to other players? (optional)

---

## Summary

| Component | Approach |
|-----------|----------|
| **Search Strategy** | Greedy early-exit (first valid word) |
| **Directions** | All 8 directions checked |
| **Blank Tiles** | Try A→Z, stop at first valid |
| **Data Structure** | Trie for O(word_length) lookups |
| **Penalties** | 0.5× score multiplier for hinted words |
| **Multiplayer** | Allowed with cooldown |
| **Worst-case Complexity** | O(4,000) ops (~10ms) |
| **Memory** | ~25MB for Trie |

This design prioritizes correctness and speed over optimality, enabling real-time hints while preserving game challenge through penalties.
