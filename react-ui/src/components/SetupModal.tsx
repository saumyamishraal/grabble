import React, { useState } from 'react';
import type { Player } from '../game-engine';

interface SetupModalProps {
  onStartGame: (numPlayers: number, playerNames: string[], targetScore: number) => void;
}

const SetupModal: React.FC<SetupModalProps> = ({ onStartGame }) => {
  const [numPlayers, setNumPlayers] = useState(2);
  const [playerNames, setPlayerNames] = useState<string[]>(['Player 1', 'Player 2']);
  const [targetScore, setTargetScore] = useState(100);

  const handleNumPlayersChange = (value: number) => {
    setNumPlayers(value);
    const newNames = Array.from({ length: value }, (_, i) => 
      i < playerNames.length ? playerNames[i] : `Player ${i + 1}`
    );
    setPlayerNames(newNames);
  };

  const handlePlayerNameChange = (index: number, name: string) => {
    const newNames = [...playerNames];
    newNames[index] = name;
    setPlayerNames(newNames);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onStartGame(numPlayers, playerNames, targetScore);
  };

  return (
    <div className="modal show">
      <div className="modal-content">
        <h2>Start New Game</h2>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Number of Players:</label>
            <select 
              value={numPlayers} 
              onChange={(e) => handleNumPlayersChange(parseInt(e.target.value))}
            >
              <option value="2">2 Players</option>
              <option value="3">3 Players</option>
              <option value="4">4 Players</option>
            </select>
          </div>
          
          {playerNames.map((name, index) => (
            <div key={index} className="form-group">
              <label>Player {index + 1} Name:</label>
              <input
                type="text"
                value={name}
                onChange={(e) => handlePlayerNameChange(index, e.target.value)}
                required
              />
            </div>
          ))}
          
          <div className="form-group">
            <label>Target Score:</label>
            <input
              type="number"
              value={targetScore}
              onChange={(e) => setTargetScore(parseInt(e.target.value) || 100)}
              min="50"
              max="500"
            />
          </div>
          
          <button type="submit" className="btn btn-primary">Start Game</button>
        </form>
      </div>
    </div>
  );
};

export default SetupModal;

