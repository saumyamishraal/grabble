/**
 * LobbyScreen - Create/Join Room UI for multiplayer
 */

import React, { useState } from 'react';
import type { Room, RoomPlayer } from '../../server/types';

interface LobbyScreenProps {
    // Connection state
    connected: boolean;
    error: string | null;
    clearError: () => void;

    // Room state
    roomCode: string | null;
    room: Room | null;
    isHost: boolean;
    playerId: string | null;

    // Actions
    createRoom: (playerName: string, targetScore?: number) => void;
    joinRoom: (roomCode: string, playerName: string) => void;
    leaveRoom: () => void;
    setReady: (ready: boolean) => void;
    startGame: () => void;
    onPlaySolo: () => void; // Trigger local single-player game
}

type LobbyMode = 'menu' | 'create' | 'join';

const LobbyScreen: React.FC<LobbyScreenProps> = ({
    connected,
    error,
    clearError,
    roomCode,
    room,
    isHost,
    playerId,
    createRoom,
    joinRoom,
    leaveRoom,
    setReady,
    startGame,
    onPlaySolo
}) => {
    const [mode, setMode] = useState<LobbyMode>('menu');
    const [playerName, setPlayerName] = useState('');
    const [targetScore, setTargetScore] = useState(100);
    const [joinCode, setJoinCode] = useState('');

    // If in a room, show waiting room
    if (roomCode && room) {
        const myPlayer = room.players.find(p => p.id === playerId);
        const allReady = room.players.length >= 2 && room.players.every(p => p.isReady);

        return (
            <div className="modal show">
                <div className="modal-content lobby-screen">
                    <h2>🎮 Game Lobby</h2>

                    <div className="room-code-display">
                        <span className="label">Room Code:</span>
                        <span className="code">{roomCode}</span>
                        <button
                            className="btn-copy"
                            onClick={() => navigator.clipboard.writeText(roomCode)}
                            title="Copy to clipboard"
                        >
                            📋
                        </button>
                    </div>

                    <div className="players-list">
                        <h3>Players ({room.players.length}/4)</h3>
                        {room.players.map((player, index) => (
                            <div
                                key={player.id}
                                className={`player-row ${player.id === playerId ? 'is-me' : ''}`}
                                style={{ borderLeftColor: player.color }}
                            >
                                <span className="player-name">
                                    {player.name}
                                    {player.isHost && <span className="host-badge">👑 Host</span>}
                                    {player.id === playerId && <span className="you-badge">(You)</span>}
                                </span>
                                <span className={`ready-status ${player.isReady ? 'ready' : 'not-ready'}`}>
                                    {player.isReady ? '✓ Ready' : 'Not Ready'}
                                </span>
                            </div>
                        ))}
                    </div>

                    {room.players.length < 2 && (
                        <p className="waiting-text">Waiting for more players to join...</p>
                    )}

                    <div className="lobby-actions">
                        {!myPlayer?.isReady ? (
                            <button
                                className="btn btn-primary"
                                onClick={() => setReady(true)}
                            >
                                I'm Ready!
                            </button>
                        ) : (
                            <button
                                className="btn btn-secondary"
                                onClick={() => setReady(false)}
                            >
                                Not Ready
                            </button>
                        )}

                        {isHost && (
                            <button
                                className="btn btn-success"
                                onClick={startGame}
                                disabled={!allReady}
                                title={!allReady ? 'All players must be ready' : 'Start the game'}
                            >
                                Start Game
                            </button>
                        )}

                        <button
                            className="btn btn-danger"
                            onClick={leaveRoom}
                        >
                            Leave Room
                        </button>
                    </div>

                    {error && (
                        <div className="error-message">
                            {error}
                            <button onClick={clearError}>×</button>
                        </div>
                    )}
                </div>
            </div>
        );
    }

    // Main menu
    if (mode === 'menu') {
        return (
            <div className="modal show">
                <div className="modal-content lobby-screen">
                    <h1>🎮 Grabble</h1>
                    <p className="subtitle">Scrabble with Gravity</p>

                    <div className="connection-status">
                        {connected ? (
                            <span className="connected">🟢 Connected to server</span>
                        ) : (
                            <span className="disconnected">🔴 Connecting...</span>
                        )}
                    </div>

                    <div className="menu-buttons">
                        <button
                            className="btn btn-primary btn-large"
                            onClick={() => setMode('create')}
                            disabled={!connected}
                        >
                            Create Room
                        </button>
                        <button
                            className="btn btn-secondary btn-large"
                            onClick={() => setMode('join')}
                            disabled={!connected}
                        >
                            Join Room
                        </button>
                        <div style={{ margin: '1rem 0', textAlign: 'center', fontSize: '0.9rem', color: '#999' }}>
                            or
                        </div>
                        <button
                            className="btn btn-solo btn-large"
                            onClick={onPlaySolo}
                        >
                            Play Local
                        </button>
                    </div>

                    {error && (
                        <div className="error-message">
                            {error}
                            <button onClick={clearError}>×</button>
                        </div>
                    )}
                </div>
            </div>
        );
    }

    // Create room form
    if (mode === 'create') {
        const handleCreate = (e: React.FormEvent) => {
            e.preventDefault();
            if (playerName.trim()) {
                createRoom(playerName.trim(), targetScore);
            }
        };

        return (
            <div className="modal show">
                <div className="modal-content lobby-screen">
                    <h2>Create Room</h2>

                    <form onSubmit={handleCreate}>
                        <div className="form-group">
                            <label>Your Name:</label>
                            <input
                                type="text"
                                value={playerName}
                                onChange={(e) => setPlayerName(e.target.value)}
                                placeholder="Enter your name"
                                required
                                autoFocus
                            />
                        </div>

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

                        <div className="form-actions">
                            <button type="submit" className="btn btn-primary">
                                Create Room
                            </button>
                            <button
                                type="button"
                                className="btn btn-secondary"
                                onClick={() => setMode('menu')}
                            >
                                Back
                            </button>
                        </div>
                    </form>

                    {error && (
                        <div className="error-message">
                            {error}
                            <button onClick={clearError}>×</button>
                        </div>
                    )}
                </div>
            </div>
        );
    }

    // Join room form
    if (mode === 'join') {
        const handleJoin = (e: React.FormEvent) => {
            e.preventDefault();
            if (playerName.trim() && joinCode.trim()) {
                joinRoom(joinCode.trim().toUpperCase(), playerName.trim());
            }
        };

        return (
            <div className="modal show">
                <div className="modal-content lobby-screen">
                    <h2>Join Room</h2>

                    <form onSubmit={handleJoin}>
                        <div className="form-group">
                            <label>Your Name:</label>
                            <input
                                type="text"
                                value={playerName}
                                onChange={(e) => setPlayerName(e.target.value)}
                                placeholder="Enter your name"
                                required
                                autoFocus
                            />
                        </div>

                        <div className="form-group">
                            <label>Room Code:</label>
                            <input
                                type="text"
                                value={joinCode}
                                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                                placeholder="e.g. AB3K"
                                maxLength={4}
                                required
                                style={{ textTransform: 'uppercase', letterSpacing: '0.2em' }}
                            />
                        </div>

                        <div className="form-actions">
                            <button type="submit" className="btn btn-primary">
                                Join Room
                            </button>
                            <button
                                type="button"
                                className="btn btn-secondary"
                                onClick={() => setMode('menu')}
                            >
                                Back
                            </button>
                        </div>
                    </form>

                    {error && (
                        <div className="error-message">
                            {error}
                            <button onClick={clearError}>×</button>
                        </div>
                    )}
                </div>
            </div>
        );
    }

    return null;
};

export default LobbyScreen;
