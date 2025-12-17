import React from 'react';
import type { Player } from '../types';
import { getPlayerColor, getPlayerColorLight } from '../utils/playerColors';

interface ScoreAreaProps {
  players: Player[];
  currentPlayerId: number;
}

const ScoreArea: React.FC<ScoreAreaProps> = ({ players, currentPlayerId }) => {
  // Sort players by ID to ensure Player 1 is leftmost, Player 2 to the right, etc.
  const sortedPlayers = [...players].sort((a, b) => a.id - b.id);
  
  return (
    <div className="score-area">
      {sortedPlayers.map(player => {
        const playerColor = getPlayerColor(player.id);
        const playerColorLight = getPlayerColorLight(player.id);
        const isCurrentPlayer = player.id === currentPlayerId;
        return (
          <div 
            key={player.id} 
            className={`player-score ${isCurrentPlayer ? 'current-player' : ''}`}
            style={{
              borderLeft: `4px solid ${playerColor}`,
              ...(isCurrentPlayer ? {
                background: playerColorLight,
                border: `2px solid ${playerColor}`,
              } : {})
            }}
          >
            <div 
              className="player-name"
              style={{ color: playerColor, fontWeight: 'bold' }}
            >
              {player.name}
            </div>
            <div 
              className="score-value"
              style={{ color: playerColor, fontWeight: 'bold' }}
            >
              {player.score}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default ScoreArea;

