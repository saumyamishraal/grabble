import React from 'react';
import type { ClaimedWord, Player } from '../types';
import { getPlayerColor } from '../utils/playerColors';

interface WordsPanelProps {
  claimedWords: ClaimedWord[];
  players: Player[];
}

const WordsPanel: React.FC<WordsPanelProps> = ({ claimedWords, players }) => {
  const getPlayerName = (playerId: number): string => {
    const player = players.find(p => p.id === playerId);
    return player ? player.name : `Player ${playerId + 1}`;
  };

  return (
    <div className="words-panel">
      <h3>Claimed Words</h3>
      <div className="words-list">
        {claimedWords.length === 0 ? (
          <div style={{ color: '#999', fontStyle: 'italic' }}>
            No words claimed yet
          </div>
        ) : (
          claimedWords.map((cw, index) => {
            const playerColor = getPlayerColor(cw.playerId);
            return (
              <div key={index} className="word-item">
                <span 
                  className="word-player"
                  style={{ color: playerColor, fontWeight: 'bold' }}
                >
                  {getPlayerName(cw.playerId)}:
                </span>
                <span className="word-text">{cw.word.toUpperCase()}</span>
                <span className="word-score">+{cw.score}</span>
                {cw.bonuses.length > 0 && (
                  <span className="word-bonuses">
                    ({cw.bonuses.join(', ')})
                  </span>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default WordsPanel;

