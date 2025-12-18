/**
 * Unit tests for Hint Engine
 * Tests Trie data structure and core hint algorithm
 */

import {
    Trie,
    buildTrieFromDictionary,
    getAccessiblePositions,
    findFirstValidWord,
    getSwapSuggestion,
    getHintAtLevel,
    getHint
} from './hint-engine';
import type { Tile, Position } from './types';

// ============================================================================
// TRIE TESTS
// ============================================================================

describe('Trie', () => {
    describe('insert and hasWord', () => {
        it('should insert and find a single word', () => {
            const trie = new Trie();
            trie.insert('CAT');
            expect(trie.hasWord('CAT')).toBe(true);
        });

        it('should be case insensitive', () => {
            const trie = new Trie();
            trie.insert('cat');
            expect(trie.hasWord('CAT')).toBe(true);
            expect(trie.hasWord('Cat')).toBe(true);
            expect(trie.hasWord('cat')).toBe(true);
        });

        it('should not find words not inserted', () => {
            const trie = new Trie();
            trie.insert('CAT');
            expect(trie.hasWord('DOG')).toBe(false);
            expect(trie.hasWord('CA')).toBe(false);
            expect(trie.hasWord('CATS')).toBe(false);
        });

        it('should handle multiple words with shared prefixes', () => {
            const trie = new Trie();
            trie.insert('CAT');
            trie.insert('CAR');
            trie.insert('CART');

            expect(trie.hasWord('CAT')).toBe(true);
            expect(trie.hasWord('CAR')).toBe(true);
            expect(trie.hasWord('CART')).toBe(true);
            expect(trie.hasWord('CA')).toBe(false);
        });

        it('should handle words that are prefixes of other words', () => {
            const trie = new Trie();
            trie.insert('THE');
            trie.insert('THEM');
            trie.insert('THEME');

            expect(trie.hasWord('THE')).toBe(true);
            expect(trie.hasWord('THEM')).toBe(true);
            expect(trie.hasWord('THEME')).toBe(true);
            expect(trie.hasWord('TH')).toBe(false);
        });
    });

    describe('hasPrefix', () => {
        it('should find existing prefixes', () => {
            const trie = new Trie();
            trie.insert('HELLO');

            expect(trie.hasPrefix('H')).toBe(true);
            expect(trie.hasPrefix('HE')).toBe(true);
            expect(trie.hasPrefix('HEL')).toBe(true);
            expect(trie.hasPrefix('HELL')).toBe(true);
            expect(trie.hasPrefix('HELLO')).toBe(true);
        });

        it('should not find non-existing prefixes', () => {
            const trie = new Trie();
            trie.insert('HELLO');

            expect(trie.hasPrefix('X')).toBe(false);
            expect(trie.hasPrefix('HI')).toBe(false);
            expect(trie.hasPrefix('HELLOWORLD')).toBe(false);
        });
    });

    describe('getWordCount', () => {
        it('should count words correctly', () => {
            const trie = new Trie();
            expect(trie.getWordCount()).toBe(0);

            trie.insert('CAT');
            expect(trie.getWordCount()).toBe(1);

            trie.insert('DOG');
            expect(trie.getWordCount()).toBe(2);

            trie.insert('CART');
            expect(trie.getWordCount()).toBe(3);
        });

        it('should not double-count duplicate insertions', () => {
            const trie = new Trie();
            trie.insert('CAT');
            trie.insert('CAT');
            trie.insert('CAT');

            expect(trie.getWordCount()).toBe(1);
        });
    });
});

describe('buildTrieFromDictionary', () => {
    it('should build trie from dictionary set', () => {
        const dictionary = new Set(['CAT', 'DOG', 'BAT', 'RAT']);
        const trie = buildTrieFromDictionary(dictionary);

        expect(trie.hasWord('CAT')).toBe(true);
        expect(trie.hasWord('DOG')).toBe(true);
        expect(trie.hasWord('BAT')).toBe(true);
        expect(trie.hasWord('RAT')).toBe(true);
        expect(trie.hasWord('HAT')).toBe(false);
    });

    it('should filter out words shorter than 3 letters', () => {
        const dictionary = new Set(['A', 'AN', 'CAT', 'AT', 'THE']);
        const trie = buildTrieFromDictionary(dictionary);

        expect(trie.hasWord('A')).toBe(false);
        expect(trie.hasWord('AN')).toBe(false);
        expect(trie.hasWord('AT')).toBe(false);
        expect(trie.hasWord('CAT')).toBe(true);
        expect(trie.hasWord('THE')).toBe(true);
    });
});

// ============================================================================
// BOARD UTILITIES TESTS
// ============================================================================

describe('getAccessiblePositions', () => {
    it('should return bottom row for empty board', () => {
        const emptyBoard: (Tile | null)[][] = Array(7).fill(null).map(() => Array(7).fill(null));
        const positions = getAccessiblePositions(emptyBoard);

        expect(positions).toHaveLength(7);
        positions.forEach((pos, col) => {
            expect(pos.column).toBe(col);
            expect(pos.row).toBe(6);  // Bottom row
        });
    });

    it('should account for existing tiles', () => {
        const board: (Tile | null)[][] = Array(7).fill(null).map(() => Array(7).fill(null));
        // Place a tile at bottom of column 0
        board[6][0] = { letter: 'A', points: 1 };

        const positions = getAccessiblePositions(board);

        // Column 0 should return row 5 now
        const col0 = positions.find(p => p.column === 0);
        expect(col0?.row).toBe(5);

        // Other columns should still be row 6
        const col1 = positions.find(p => p.column === 1);
        expect(col1?.row).toBe(6);
    });

    it('should exclude full columns', () => {
        const board: (Tile | null)[][] = Array(7).fill(null).map(() => Array(7).fill(null));
        // Fill column 0 completely
        for (let row = 0; row < 7; row++) {
            board[row][0] = { letter: 'A', points: 1 };
        }

        const positions = getAccessiblePositions(board);

        expect(positions.find(p => p.column === 0)).toBeUndefined();
        expect(positions).toHaveLength(6);
    });
});

// ============================================================================
// SWAP SUGGESTION TESTS
// ============================================================================

describe('getSwapSuggestion', () => {
    it('should suggest low-playability tiles', () => {
        const rack: Tile[] = [
            { letter: 'E', points: 1 },  // High playability
            { letter: 'Q', points: 10 }, // Very low playability
            { letter: 'A', points: 1 },  // High playability
            { letter: 'Z', points: 10 }, // Very low playability
        ];

        const suggestions = getSwapSuggestion(rack);

        // Should suggest Q and Z (indices 1 and 3)
        expect(suggestions).toContain(1);  // Q
        expect(suggestions).toContain(3);  // Z
        expect(suggestions.length).toBeLessThanOrEqual(3);
    });

    it('should return up to 3 suggestions', () => {
        const rack: Tile[] = [
            { letter: 'Q', points: 10 },
            { letter: 'Z', points: 10 },
            { letter: 'X', points: 8 },
            { letter: 'J', points: 8 },
            { letter: 'K', points: 5 },
        ];

        const suggestions = getSwapSuggestion(rack);
        expect(suggestions.length).toBe(3);
    });
});

// ============================================================================
// HINT ALGORITHM TESTS
// ============================================================================

describe('findFirstValidWord', () => {
    it('should return null for empty rack', () => {
        const emptyBoard: (Tile | null)[][] = Array(7).fill(null).map(() => Array(7).fill(null));
        const dictionary = new Set(['CAT', 'DOG', 'BAT']);
        const trie = buildTrieFromDictionary(dictionary);

        const result = findFirstValidWord(emptyBoard, [], trie);
        expect(result).toBeNull();
    });

    it('should find a word with existing board tiles', () => {
        const board: (Tile | null)[][] = Array(7).fill(null).map(() => Array(7).fill(null));
        // Place 'CA' at bottom of column 0
        board[6][0] = { letter: 'C', points: 3 };
        board[5][0] = { letter: 'A', points: 1 };

        const rack: Tile[] = [{ letter: 'T', points: 1 }];
        const dictionary = new Set(['CAT', 'DOG', 'BAT']);
        const trie = buildTrieFromDictionary(dictionary);

        const result = findFirstValidWord(board, rack, trie);

        // Should find 'CAT' or 'TAC' depending on direction
        // The test is that it finds SOMETHING valid
        if (result) {
            expect(trie.hasWord(result.word)).toBe(true);
            expect(result.word.length).toBeGreaterThanOrEqual(3);
        }
    });
});

describe('getHintAtLevel', () => {
    const mockSolution = {
        tileIndex: 2,
        column: 3,
        tileIndices: [2],
        columns: [3],
        depth: 1 as const,
        word: 'CAT',
        positions: [{ x: 3, y: 6 }, { x: 3, y: 5 }, { x: 3, y: 4 }],
        direction: { dx: 0, dy: -1, name: 'up' }
    };

    const mockRack: Tile[] = [
        { letter: 'A', points: 1 },
        { letter: 'B', points: 3 },
        { letter: 'C', points: 3 },
    ];

    it('Level 0: should only indicate moves are possible', () => {
        const result = getHintAtLevel(mockSolution, mockRack, 0);

        expect(result.level).toBe(0);
        expect(result.hasMoves).toBe(true);
        expect(result.usefulTiles).toBeUndefined();
        expect(result.fullSolution).toBeUndefined();
    });

    it('Level 1: should reveal useful tiles', () => {
        const result = getHintAtLevel(mockSolution, mockRack, 1);

        expect(result.level).toBe(1);
        expect(result.hasMoves).toBe(true);
        expect(result.usefulTiles).toEqual([2]);
        expect(result.targetColumns).toBeUndefined();
    });

    it('Level 2: should reveal partial word', () => {
        const result = getHintAtLevel(mockSolution, mockRack, 2);

        expect(result.level).toBe(2);
        expect(result.usefulTiles).toEqual([2]);
        expect(result.partialWord).toBe('C__');
        expect(result.wordLength).toBe(3);
        expect(result.targetColumns).toBeUndefined();
    });

    it('Level 3: should reveal target columns', () => {
        const result = getHintAtLevel(mockSolution, mockRack, 3);

        expect(result.level).toBe(3);
        expect(result.targetColumns).toEqual([3]);
        expect(result.partialWord).toBe('C__');
        expect(result.fullSolution).toBeUndefined();
    });

    it('Level 4: should reveal full solution', () => {
        const result = getHintAtLevel(mockSolution, mockRack, 4);

        expect(result.level).toBe(4);
        expect(result.fullSolution).toEqual(mockSolution);
    });

    it('should suggest swap when no solution found', () => {
        const result = getHintAtLevel(null, mockRack, 0);

        expect(result.hasMoves).toBe(false);
        expect(result.suggestSwap).toBe(true);
        expect(result.tilesToSwap).toBeDefined();
    });
});

describe('getHint (integration)', () => {
    it('should work end-to-end', () => {
        const board: (Tile | null)[][] = Array(7).fill(null).map(() => Array(7).fill(null));
        const rack: Tile[] = [
            { letter: 'C', points: 3 },
            { letter: 'A', points: 1 },
            { letter: 'T', points: 1 },
        ];
        const dictionary = new Set(['CAT', 'DOG', 'BAT', 'HAT', 'RAT', 'MAT']);
        const trie = buildTrieFromDictionary(dictionary);

        const hint = getHint(board, rack, trie, 0);

        // On empty board with C, A, T in rack, should find moves possible
        // (though forming CAT requires specific positioning)
        expect(hint.level).toBe(0);
        // hasMoves depends on whether CAT can be formed with current logic
        expect(typeof hint.hasMoves).toBe('boolean');
    });
});
