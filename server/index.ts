/**
 * Grabble Multiplayer Server
 * Socket.IO server for real-time game synchronization
 */

import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { RoomManager } from './room-manager';
import { setupSocketEvents } from './socket-events';

const PORT = process.env.PORT || 3001;

// Express app
const app = express();
app.use(cors());
app.use(express.json());

// HTTP server
const httpServer = createServer(app);

// Socket.IO server with CORS for React dev server
const io = new Server(httpServer, {
    cors: {
        origin: ['http://localhost:3000', 'http://127.0.0.1:3000'],
        methods: ['GET', 'POST'],
        credentials: true
    }
});

// Room manager for game lobbies
const roomManager = new RoomManager();

// Set up socket event handlers
setupSocketEvents(io, roomManager);

// Root endpoint - server info
app.get('/', (req, res) => {
    res.send(`
        <html>
        <head><title>Grabble Server</title></head>
        <body style="font-family: system-ui; max-width: 600px; margin: 50px auto; padding: 20px;">
            <h1>🎮 Grabble Multiplayer Server</h1>
            <p>Socket.IO server is running and ready for connections.</p>
            <h3>Status</h3>
            <ul>
                <li>Active Rooms: ${roomManager.getActiveRoomCount()}</li>
                <li>Uptime: ${Math.floor(process.uptime())}s</li>
            </ul>
            <p><a href="/test">🧪 Open Test Page</a></p>
            <p>Open the game at <a href="http://localhost:3000">http://localhost:3000</a></p>
        </body>
        </html>
    `);
});

// Interactive test page
app.get('/test', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Grabble Socket Test</title>
            <script src="https://cdn.socket.io/4.7.2/socket.io.min.js"></script>
            <style>
                body { font-family: system-ui; max-width: 800px; margin: 40px auto; padding: 20px; }
                .log { background: #1e1e1e; color: #0f0; padding: 15px; height: 300px; overflow-y: auto; font-family: monospace; border-radius: 8px; }
                .log p { margin: 2px 0; }
                button { padding: 10px 20px; margin: 5px; cursor: pointer; border-radius: 4px; border: none; background: #4ECDC4; color: white; font-weight: bold; }
                button:hover { opacity: 0.9; }
                input { padding: 10px; margin: 5px; border-radius: 4px; border: 1px solid #ddd; }
                .connected { color: #4ECDC4; }
                .error { color: #FF6B6B; }
                .event { color: #45B7D1; }
            </style>
        </head>
        <body>
            <h1>🧪 Grabble WebSocket Test</h1>
            
            <div>
                <input type="text" id="playerName" placeholder="Your name" value="TestPlayer">
                <input type="text" id="roomCode" placeholder="Room code (to join)">
            </div>
            <div>
                <button onclick="createRoom()">Create Room</button>
                <button onclick="joinRoom()">Join Room</button>
                <button onclick="setReady()">Set Ready</button>
                <button onclick="startGame()">Start Game</button>
            </div>
            
            <h3>Event Log</h3>
            <div class="log" id="log"></div>
            
            <script>
                const socket = io('http://localhost:3001');
                const log = document.getElementById('log');
                
                function addLog(msg, className = '') {
                    const p = document.createElement('p');
                    p.className = className;
                    p.textContent = new Date().toLocaleTimeString() + ' - ' + msg;
                    log.appendChild(p);
                    log.scrollTop = log.scrollHeight;
                }
                
                // Connection events
                socket.on('connect', () => addLog('✅ Connected! ID: ' + socket.id, 'connected'));
                socket.on('disconnect', () => addLog('❌ Disconnected', 'error'));
                
                // Room events
                socket.on('room_created', (data) => {
                    addLog('📦 Room created: ' + data.roomCode, 'event');
                    document.getElementById('roomCode').value = data.roomCode;
                });
                socket.on('room_joined', (data) => addLog('📦 Joined room: ' + data.room.code + ' with ' + data.room.players.length + ' players', 'event'));
                socket.on('player_joined', (player) => addLog('👤 ' + player.name + ' joined', 'event'));
                socket.on('player_left', (id) => addLog('👋 Player left: ' + id, 'event'));
                socket.on('player_ready', (data) => addLog('✋ Player ready: ' + data.ready, 'event'));
                socket.on('game_started', (state) => addLog('🎮 Game started! Current player: ' + state.currentPlayerId, 'event'));
                socket.on('game_state', (state) => addLog('📊 Game state updated', 'event'));
                socket.on('error', (data) => addLog('❌ Error: ' + data.message, 'error'));
                
                function createRoom() {
                    const name = document.getElementById('playerName').value || 'Player';
                    socket.emit('create_room', { playerName: name, targetScore: 100 });
                    addLog('📤 Creating room as ' + name);
                }
                
                function joinRoom() {
                    const name = document.getElementById('playerName').value || 'Player';
                    const code = document.getElementById('roomCode').value;
                    if (!code) { addLog('⚠️ Enter a room code first', 'error'); return; }
                    socket.emit('join_room', { roomCode: code, playerName: name });
                    addLog('📤 Joining room ' + code);
                }
                
                function setReady() {
                    socket.emit('set_ready', true);
                    addLog('📤 Setting ready');
                }
                
                function startGame() {
                    socket.emit('start_game');
                    addLog('📤 Starting game');
                }
            </script>
        </body>
        </html>
    `);
});

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        activeRooms: roomManager.getActiveRoomCount(),
        timestamp: new Date().toISOString()
    });
});

// Start server
httpServer.listen(PORT, () => {
    console.log(`🎮 Grabble server running on http://localhost:${PORT}`);
    console.log(`📡 Socket.IO ready for connections`);
});

export { io, roomManager };
