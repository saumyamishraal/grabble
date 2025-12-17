import React from 'react';
import type { Player } from '../types';

interface ScoreAreaProps {
  players: Player[];
  currentPlayerId: number;
}

const ScoreArea: React.FC<ScoreAreaProps> = ({ players, currentPlayerId }) => {
  return (
    <div className="score-area">
      {players.map(player => (
        <div 
          key={player.id} 
          className={`player-score ${player.id === currentPlayerId ? 'current-player' : ''}`}
        >
          <div className="player-name">{player.name}</div>
          <div className="score-value">{player.score}</div>
        </div>
      ))}
    </div>
  );
};

export default ScoreArea;

