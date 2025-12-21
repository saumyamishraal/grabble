import React, { useState, useEffect } from 'react';
import { UI_MESSAGES } from '../constants/messages';
import { useAuth } from '../contexts/AuthContext';
import AuthButton from './AuthButton';

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
  highScore?: number;
}

const SetupModal: React.FC<SetupModalProps> = ({ onStartGame, highScore = 0 }) => {
  const { user } = useAuth();
  const [gameMode, setGameMode] = useState<GameModeSelection>('normal');
  const [numPlayers, setNumPlayers] = useState(2);
  const [playerNames, setPlayerNames] = useState<string[]>(['Player 1', 'Player 2']);
  const [targetScore, setTargetScore] = useState(100);
  const [hintsEnabled, setHintsEnabled] = useState(true);
  const [zenMode, setZenMode] = useState(false);
  const [soloPlayerName, setSoloPlayerName] = useState('Player');

  // Pre-fill player name from Google profile
  useEffect(() => {
    if (user?.displayName) {
      setSoloPlayerName(user.displayName);
      setPlayerNames(prev => [user.displayName!, ...prev.slice(1)]);
    }
  }, [user]);

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
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
          <h2 style={{ margin: 0 }}>{UI_MESSAGES.setup.startNewGame}</h2>
          <AuthButton variant="compact" />
        </div>
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
                  type="text"
                  inputMode="numeric"
                  value={targetScore}
                  onChange={(e) => setTargetScore(e.target.value as any)}
                  onBlur={(e) => {
                    const val = parseInt(e.target.value) || 100;
                    setTargetScore(Math.max(10, Math.min(500, val)));
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      const val = parseInt((e.target as HTMLInputElement).value) || 100;
                      setTargetScore(Math.max(10, Math.min(500, val)));
                    }
                  }}
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
                {highScore > 0 && (
                  <div className="high-score-badge" style={{
                    marginTop: '12px',
                    padding: '10px 16px',
                    background: 'linear-gradient(135deg, rgba(255, 215, 0, 0.2), rgba(255, 215, 0, 0.1))',
                    borderRadius: '10px',
                    border: '1px solid rgba(255, 215, 0, 0.3)',
                    textAlign: 'center'
                  }}>
                    <span style={{ fontSize: '0.85rem', color: '#aaa' }}>Your Best Score</span>
                    <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#ffd700' }}>
                      🏆 {highScore}
                    </div>
                  </div>
                )}
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
