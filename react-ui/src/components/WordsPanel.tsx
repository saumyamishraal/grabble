import React from 'react';
import type { ClaimedWord } from '../game-engine';

interface WordsPanelProps {
  claimedWords: ClaimedWord[];
}

const WordsPanel: React.FC<WordsPanelProps> = ({ claimedWords }) => {
  return (
    <div className="words-panel">
      <h3>Claimed Words</h3>
      <div className="words-list">
        {claimedWords.length === 0 ? (
          <div style={{ color: '#999', fontStyle: 'italic' }}>
            No words claimed yet
          </div>
        ) : (
          claimedWords.map((cw, index) => (
            <div key={index} className="word-item">
              <span className="word-text">{cw.word.toUpperCase()}</span>
              <span className="word-score">+{cw.score}</span>
              {cw.bonuses.length > 0 && (
                <span className="word-bonuses">
                  ({cw.bonuses.join(', ')})
                </span>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default WordsPanel;

