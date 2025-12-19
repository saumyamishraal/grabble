/**
 * LobbyScreen - Create/Join Room UI for multiplayer
 */

import React, { useState } from 'react';
import type { Room, RoomPlayer } from '../server-types';
import { UI_MESSAGES } from '../constants/messages';

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
    createRoom: (playerName: string, targetScore?: number, hintsEnabled?: boolean) => void;
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
    const [hintsEnabled, setHintsEnabled] = useState(true);

    // If in a room, show waiting room
    if (roomCode && room) {
        const myPlayer = room.players.find(p => p.id === playerId);
        const allReady = room.players.length >= 2 && room.players.every(p => p.isReady);

        return (
            <div className="modal show">
                <div className="modal-content lobby-screen">
                    <h2>{UI_MESSAGES.lobby.gameLobby}</h2>

                    <div className="room-code-display">
                        <span className="label">{UI_MESSAGES.lobby.roomCode}</span>
                        <span className="code">{roomCode}</span>
                        <button
                            className="btn-copy"
                            onClick={() => navigator.clipboard.writeText(roomCode)}
                            title={UI_MESSAGES.lobby.copyToClipboard}
                        >
                            📋
                        </button>
                    </div>

                    <div className="players-list">
                        <h3>{UI_MESSAGES.lobby.players(room.players.length, 4)}</h3>
                        {room.players.map((player, index) => (
                            <div
                                key={player.id}
                                className={`player-row ${player.id === playerId ? 'is-me' : ''}`}
                                style={{ borderLeftColor: player.color }}
                            >
                                <span className="player-name">
                                    {player.name}
                                    {player.isHost && <span className="host-badge">{UI_MESSAGES.lobby.host}</span>}
                                    {player.id === playerId && <span className="you-badge">{UI_MESSAGES.lobby.you}</span>}
                                </span>
                                <span className={`ready-status ${player.isReady ? 'ready' : 'not-ready'}`}>
                                    {player.isReady ? UI_MESSAGES.lobby.ready : UI_MESSAGES.lobby.notReady}
                                </span>
                            </div>
                        ))}
                    </div>

                    {room.players.length < 2 && (
                        <p className="waiting-text">{UI_MESSAGES.lobby.waitingForPlayers}</p>
                    )}

                    <div className="lobby-actions">
                        {!myPlayer?.isReady ? (
                            <button
                                className="btn btn-primary"
                                onClick={() => setReady(true)}
                            >
                                {UI_MESSAGES.buttons.imReady}
                            </button>
                        ) : (
                            <button
                                className="btn btn-secondary"
                                onClick={() => setReady(false)}
                            >
                                {UI_MESSAGES.buttons.notReady}
                            </button>
                        )}

                        {isHost && (
                            <button
                                className="btn btn-success"
                                onClick={startGame}
                                disabled={!allReady}
                                title={!allReady ? UI_MESSAGES.lobby.allPlayersMustBeReady : UI_MESSAGES.lobby.startTheGame}
                            >
                                {UI_MESSAGES.buttons.startGame}
                            </button>
                        )}

                        <button
                            className="btn btn-danger"
                            onClick={leaveRoom}
                        >
                            {UI_MESSAGES.buttons.leaveRoom}
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
                    <h1>{UI_MESSAGES.lobby.title}</h1>
                    <p className="subtitle">{UI_MESSAGES.lobby.subtitle}</p>

                    <div className="connection-status">
                        {connected ? (
                            <span className="connected">{UI_MESSAGES.lobby.connected}</span>
                        ) : (
                            <span className="disconnected">{UI_MESSAGES.lobby.connecting}</span>
                        )}
                    </div>

                    <div className="menu-buttons">
                        <button
                            className="btn btn-primary btn-large"
                            onClick={() => setMode('create')}
                            disabled={!connected}
                        >
                            {UI_MESSAGES.buttons.createRoom}
                        </button>
                        <button
                            className="btn btn-secondary btn-large"
                            onClick={() => setMode('join')}
                            disabled={!connected}
                        >
                            {UI_MESSAGES.buttons.joinRoom}
                        </button>
                        <div style={{ margin: '1rem 0', textAlign: 'center', fontSize: '0.9rem', color: '#999' }}>
                            {UI_MESSAGES.lobby.or}
                        </div>
                        <button
                            className="btn btn-solo btn-large"
                            onClick={onPlaySolo}
                        >
                            {UI_MESSAGES.buttons.playLocal}
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
                createRoom(playerName.trim(), targetScore, hintsEnabled);
            }
        };

        return (
            <div className="modal show">
                <div className="modal-content lobby-screen">
                    <h2>{UI_MESSAGES.buttons.createRoom}</h2>

                    <form onSubmit={handleCreate}>
                        <div className="form-group">
                            <label>{UI_MESSAGES.lobby.yourName}</label>
                            <input
                                type="text"
                                value={playerName}
                                onChange={(e) => setPlayerName(e.target.value)}
                                placeholder={UI_MESSAGES.lobby.enterYourName}
                                required
                                autoFocus
                            />
                        </div>

                        <div className="form-group">
                            <label>{UI_MESSAGES.lobby.targetScore}</label>
                            <input
                                type="number"
                                value={targetScore}
                                onChange={(e) => setTargetScore(parseInt(e.target.value) || 100)}
                                min="50"
                                max="500"
                            />
                        </div>

                        <div className="form-group form-checkbox">
                            <label>
                                <input
                                    type="checkbox"
                                    checked={hintsEnabled}
                                    onChange={(e) => setHintsEnabled(e.target.checked)}
                                />
                                {UI_MESSAGES.lobby.enableHints}
                            </label>
                        </div>

                        <div className="form-actions">
                            <button type="submit" className="btn btn-primary">
                                {UI_MESSAGES.buttons.createRoom}
                            </button>
                            <button
                                type="button"
                                className="btn btn-secondary"
                                onClick={() => setMode('menu')}
                            >
                                {UI_MESSAGES.buttons.back}
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
                    <h2>{UI_MESSAGES.buttons.joinRoom}</h2>

                    <form onSubmit={handleJoin}>
                        <div className="form-group">
                            <label>{UI_MESSAGES.lobby.yourName}</label>
                            <input
                                type="text"
                                value={playerName}
                                onChange={(e) => setPlayerName(e.target.value)}
                                placeholder={UI_MESSAGES.lobby.enterYourName}
                                required
                                autoFocus
                            />
                        </div>

                        <div className="form-group">
                            <label>{UI_MESSAGES.lobby.roomCode}</label>
                            <input
                                type="text"
                                value={joinCode}
                                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                                placeholder={UI_MESSAGES.lobby.roomCodePlaceholder}
                                maxLength={4}
                                required
                                style={{ textTransform: 'uppercase', letterSpacing: '0.2em' }}
                            />
                        </div>

                        <div className="form-actions">
                            <button type="submit" className="btn btn-primary">
                                {UI_MESSAGES.buttons.joinRoom}
                            </button>
                            <button
                                type="button"
                                className="btn btn-secondary"
                                onClick={() => setMode('menu')}
                            >
                                {UI_MESSAGES.buttons.back}
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
