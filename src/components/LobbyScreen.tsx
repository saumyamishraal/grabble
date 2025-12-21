/**
 * LobbyScreen - Create/Join Room UI for multiplayer
 */

import React, { useState, useEffect } from 'react';
import type { Room, RoomPlayer } from '../server-types';
import { UI_MESSAGES } from '../constants/messages';
import { useAuth } from '../contexts/AuthContext';
import AuthButton from './AuthButton';

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
    createRoom: (playerName: string, targetScore?: number, hintsEnabled?: boolean, uid?: string, photoURL?: string) => void;
    joinRoom: (roomCode: string, playerName: string, uid?: string, photoURL?: string) => void;
    leaveRoom: (uid?: string) => void;
    setReady: (ready: boolean) => void;
    startGame: () => void;
    onPlaySolo: () => void;

    // Active game (for rejoin)
    getActiveGame: (uid: string) => Promise<{ roomCode: string; playerId: string } | null>;
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
    onPlaySolo,
    getActiveGame
}) => {
    const { user } = useAuth();
    const [mode, setMode] = useState<LobbyMode>('menu');
    const [playerName, setPlayerName] = useState('');
    const [targetScore, setTargetScore] = useState(100);
    const [joinCode, setJoinCode] = useState('');
    const [hintsEnabled, setHintsEnabled] = useState(true);

    // Active game check for rejoin
    const [activeGame, setActiveGame] = useState<{ roomCode: string } | null>(null);
    const [checkingActiveGame, setCheckingActiveGame] = useState(true);

    // Pre-fill player name from Google profile
    useEffect(() => {
        if (user?.displayName && !playerName) {
            setPlayerName(user.displayName);
        }
    }, [user, playerName]);

    // Check for active game on mount
    useEffect(() => {
        const checkActiveGame = async () => {
            if (user?.uid && !roomCode) {
                setCheckingActiveGame(true);
                const active = await getActiveGame(user.uid);
                setActiveGame(active);
                setCheckingActiveGame(false);
            } else {
                setCheckingActiveGame(false);
            }
        };
        checkActiveGame();
    }, [user, roomCode, getActiveGame]);

    const handleRejoin = () => {
        if (activeGame && playerName.trim()) {
            joinRoom(activeGame.roomCode, playerName.trim(), user?.uid, user?.photoURL || undefined);
        }
    };

    const handleDismissRejoin = async () => {
        if (user?.uid) {
            // Clear the active game from Firebase
            leaveRoom(user.uid);
        }
        setActiveGame(null);
    };

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
                            onClick={() => leaveRoom(user?.uid)}
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
                    <h1 style={{ margin: 0, textAlign: 'center' }}>{UI_MESSAGES.lobby.title}</h1>
                    <p className="subtitle" style={{ margin: '5px 0 15px 0', textAlign: 'center' }}>{UI_MESSAGES.lobby.subtitle}</p>

                    <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '20px' }}>
                        <AuthButton variant="full" />
                    </div>

                    {/* Rejoin prompt */}
                    {!checkingActiveGame && activeGame && (
                        <div style={{
                            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                            borderRadius: '12px',
                            padding: '16px',
                            marginBottom: '20px',
                            color: 'white',
                            textAlign: 'center'
                        }}>
                            <div style={{ fontSize: '16px', fontWeight: 600, marginBottom: '8px' }}>
                                🎮 You have an active game!
                            </div>
                            <div style={{ fontSize: '14px', opacity: 0.9, marginBottom: '12px' }}>
                                Room: <strong>{activeGame.roomCode}</strong>
                            </div>
                            <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
                                <button
                                    className="btn"
                                    style={{ background: 'white', color: '#764ba2', fontWeight: 600 }}
                                    onClick={handleRejoin}
                                    disabled={!playerName.trim()}
                                >
                                    Rejoin Game
                                </button>
                                <button
                                    className="btn"
                                    style={{ background: 'rgba(255,255,255,0.2)', color: 'white', border: '1px solid rgba(255,255,255,0.3)' }}
                                    onClick={handleDismissRejoin}
                                >
                                    Leave Game
                                </button>
                            </div>
                        </div>
                    )}

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
                createRoom(playerName.trim(), targetScore, hintsEnabled, user?.uid, user?.photoURL || undefined);
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
                joinRoom(joinCode.trim().toUpperCase(), playerName.trim(), user?.uid, user?.photoURL || undefined);
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
