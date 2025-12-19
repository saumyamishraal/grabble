import React, { useState } from 'react';
import { UI_MESSAGES } from '../constants/messages';

type GameModeSelection = 'normal' | 'solo';

interface SetupModalProps {
  onStartGame: (
    numPlayers: number,
    playerNames: string[],
    targetScore: number,
    hintsEnabled: boolean,
    gameMode: GameModeSelection,
    zenMode: boolean
  ) => void;
}

const SetupModal: React.FC<SetupModalProps> = ({ onStartGame }) => {
  const [gameMode, setGameMode] = useState<GameModeSelection>('normal');
  const [numPlayers, setNumPlayers] = useState(2);
  const [playerNames, setPlayerNames] = useState<string[]>(['Player 1', 'Player 2']);
  const [targetScore, setTargetScore] = useState(100);
  const [hintsEnabled, setHintsEnabled] = useState(true);
  const [zenMode, setZenMode] = useState(false);
  const [soloPlayerName, setSoloPlayerName] = useState('Player');

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
    if (gameMode === 'solo') {
      // Solo mode: 1 player, no target score (endless)
      onStartGame(1, [soloPlayerName], 0, hintsEnabled, 'solo', zenMode);
    } else {
      onStartGame(numPlayers, playerNames, targetScore, hintsEnabled, 'normal', false);
    }
  };

  return (
    <div className="modal show">
      <div className="modal-content">
        <h2>{UI_MESSAGES.setup.startNewGame}</h2>
        <form onSubmit={handleSubmit}>
          {/* Game Mode Selection */}
          <div className="form-group">
            <label>{UI_MESSAGES.setup.gameMode}</label>
            <div className="game-mode-toggle">
              <button
                type="button"
                className={`mode-btn ${gameMode === 'normal' ? 'active' : ''}`}
                onClick={() => setGameMode('normal')}
              >
                {UI_MESSAGES.setup.versus}
              </button>
              <button
                type="button"
                className={`mode-btn ${gameMode === 'solo' ? 'active' : ''}`}
                onClick={() => setGameMode('solo')}
              >
                {UI_MESSAGES.setup.soloEndless}
              </button>
            </div>
          </div>

          {gameMode === 'normal' ? (
            <>
              {/* Normal Mode Options */}
              <div className="form-group">
                <label>{UI_MESSAGES.setup.numberOfPlayers}</label>
                <select
                  value={numPlayers}
                  onChange={(e) => handleNumPlayersChange(parseInt(e.target.value))}
                >
                  <option value="2">{UI_MESSAGES.setup.players(2)}</option>
                  <option value="3">{UI_MESSAGES.setup.players(3)}</option>
                  <option value="4">{UI_MESSAGES.setup.players(4)}</option>
                </select>
              </div>

              {playerNames.map((name, index) => (
                <div key={index} className="form-group">
                  <label>{UI_MESSAGES.setup.playerName(index + 1)}</label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => handlePlayerNameChange(index, e.target.value)}
                    required
                  />
                </div>
              ))}

              <div className="form-group">
                <label>{UI_MESSAGES.setup.targetScore}</label>
                <input
                  type="number"
                  value={targetScore}
                  onChange={(e) => setTargetScore(parseInt(e.target.value) || 100)}
                  min="50"
                  max="500"
                />
              </div>
            </>
          ) : (
            <>
              {/* Solo Mode Options */}
              <div className="form-group">
                <label>{UI_MESSAGES.lobby.yourName}</label>
                <input
                  type="text"
                  value={soloPlayerName}
                  onChange={(e) => setSoloPlayerName(e.target.value)}
                  placeholder={UI_MESSAGES.lobby.enterYourName}
                  required
                />
              </div>

              <div className="form-group form-checkbox">
                <label>
                  <input
                    type="checkbox"
                    checked={zenMode}
                    onChange={(e) => setZenMode(e.target.checked)}
                  />
                  {UI_MESSAGES.setup.zenMode}
                </label>
              </div>

              <div className="solo-info">
                <p>{UI_MESSAGES.setup.zenModeDescription}</p>
                <p>{UI_MESSAGES.setup.zenModeHighScore}</p>
              </div>
            </>
          )}

          <div className="form-group form-checkbox">
            <label>
              <input
                type="checkbox"
                checked={hintsEnabled}
                onChange={(e) => setHintsEnabled(e.target.checked)}
              />
              {UI_MESSAGES.setup.enableHints}
            </label>
          </div>

          <button type="submit" className="btn btn-primary">
            {gameMode === 'solo' ? UI_MESSAGES.buttons.startSolo : UI_MESSAGES.buttons.startGame}
          </button>
        </form>
      </div>
    </div>
  );
};

export default SetupModal;
