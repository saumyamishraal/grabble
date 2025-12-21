import React, { useState } from 'react';
import '../styles/WinScreen.scss';

interface WinScreenProps {
    winnerName: string;
    winnerScore: number;
    targetScore: number;
    allPlayers: { name: string; score: number }[];
    onContinuePlaying: (newTargetScore: number) => void;
    onNewGame: () => void;
    onGoHome: () => void;
}

const WinScreen: React.FC<WinScreenProps> = ({
    winnerName,
    winnerScore,
    targetScore,
    allPlayers,
    onContinuePlaying,
    onNewGame,
    onGoHome
}) => {
    const [newTarget, setNewTarget] = useState(targetScore + 50);

    const handleContinue = () => {
        onContinuePlaying(newTarget);
    };

    return (
        <div className="win-screen-overlay">
            <div className="win-screen-modal">
                <div className="confetti-container">
                    {[...Array(30)].map((_, i) => (
                        <div
                            key={i}
                            className="confetti"
                            style={{
                                left: `${Math.random() * 100}%`,
                                animationDelay: `${Math.random() * 2}s`,
                                backgroundColor: ['#ffd700', '#ff6b6b', '#4ecdc4', '#45b7d1', '#96ceb4', '#ff9f43'][Math.floor(Math.random() * 6)]
                            }}
                        />
                    ))}
                </div>

                <div className="trophy-icon">🏆</div>

                <h1 className="winner-announcement">
                    {winnerName} Wins!
                </h1>

                <p className="winner-score">
                    {winnerScore} points
                </p>

                <div className="final-scores">
                    <h3>Final Scores</h3>
                    <div className="scores-list">
                        {allPlayers
                            .sort((a, b) => b.score - a.score)
                            .map((player, index) => (
                                <div key={index} className={`score-row ${player.name === winnerName ? 'winner' : ''}`}>
                                    <span className="rank">{index + 1}.</span>
                                    <span className="name">{player.name}</span>
                                    <span className="score">{player.score}</span>
                                </div>
                            ))}
                    </div>
                </div>

                <div className="win-actions">
                    <div className="continue-section">
                        <label>
                            Continue to
                            <input
                                type="text"
                                inputMode="numeric"
                                value={newTarget}
                                onChange={(e) => setNewTarget(e.target.value as any)}
                                onBlur={(e) => {
                                    const val = parseInt(e.target.value) || targetScore + 50;
                                    setNewTarget(Math.max(winnerScore + 10, val));
                                }}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                        const val = parseInt((e.target as HTMLInputElement).value) || targetScore + 50;
                                        setNewTarget(Math.max(winnerScore + 10, val));
                                    }
                                }}
                            />
                            points
                        </label>
                        <button className="btn-continue" onClick={handleContinue}>
                            Keep Playing
                        </button>
                    </div>

                    <div className="other-actions">
                        <button className="btn-new-game" onClick={onNewGame}>
                            New Game
                        </button>
                        <button className="btn-home" onClick={onGoHome}>
                            Home
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default WinScreen;
