const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);

// Configuration Socket.io pour production
const io = socketIo(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    },
    transports: ['websocket', 'polling']
});

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// Health check endpoint (pour les services de monitoring)
app.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok', uptime: process.uptime() });
});

// Channel data
const channels = {
    LOBBY: { name: 'Lobby', type: 'lobby', users: new Map() },
    PRACTICE: { name: 'Practice', type: 'practice', users: new Map() },
    CH1: { name: 'Channel 1', type: 'normal', users: new Map() },
    CH2: { name: 'Channel 2', type: 'normal', users: new Map() },
    CH3: { name: 'Channel 3', type: 'normal', users: new Map() },
    CH4: { name: 'Channel 4', type: 'normal', users: new Map() },
    CH5: { name: 'Channel 5', type: 'normal', users: new Map() },
    CH6: { name: 'Channel 6', type: 'normal', users: new Map() },
    CH7: { name: 'Channel 7', type: 'normal', users: new Map() },
    CH8: { name: 'Channel 8', type: 'normal', users: new Map() }
};

// Private channels (dynamic)
const privateChannels = new Map();

// Statistics
let stats = {
    totalConnections: 0,
    messagesTransmitted: 0,
    startTime: Date.now()
};

// Socket.io connection handling
io.on('connection', (socket) => {
    stats.totalConnections++;
    console.log(`[${new Date().toISOString()}] User connected: ${socket.id} (Total: ${io.engine.clientsCount})`);
    
    let currentUser = {
        id: socket.id,
        username: 'VISITOR',
        channel: 'LOBBY',
        connectedAt: Date.now()
    };
    
    // Add user to lobby initially
    channels.LOBBY.users.set(socket.id, currentUser);
    broadcastChannelUsers();
    
    // Send welcome message
    socket.emit('welcome', {
        serverId: 'morse-net-v2.1',
        serverTime: Date.now(),
        onlineUsers: io.engine.clientsCount
    });
    
    // Handle user joining a channel
    socket.on('joinChannel', (data) => {
        const { channelId, username } = data;
        
        // Validate input
        if (!channelId || typeof channelId !== 'string') return;
        
        // Leave current channel
        leaveChannel(socket.id, currentUser.channel);
        
        // Update user info
        currentUser.username = (username || 'VISITOR').substring(0, 12).toUpperCase();
        currentUser.channel = channelId;
        
        // Check if it's a private channel
        if (channelId.startsWith('PRIV_')) {
            const privName = channelId.replace('PRIV_', '');
            if (!privateChannels.has(privName)) {
                privateChannels.set(privName, { name: privName, type: 'private', users: new Map() });
            }
            privateChannels.get(privName).users.set(socket.id, currentUser);
            socket.join(channelId);
        } else if (channels[channelId]) {
            channels[channelId].users.set(socket.id, currentUser);
            socket.join(channelId);
        }
        
        broadcastChannelUsers();
        
        // Notify others in the channel
        if (channelId !== 'LOBBY' && channelId !== 'PRACTICE') {
            socket.to(channelId).emit('userJoined', {
                username: currentUser.username,
                channelId: channelId,
                timestamp: Date.now()
            });
        }
        
        console.log(`[${new Date().toISOString()}] ${currentUser.username} joined ${channelId}`);
    });
    
    // Handle morse element (dit or dah) - real-time
    socket.on('morseElement', (data) => {
        const { element, channelId } = data;
        
        if (channelId === 'LOBBY' || channelId === 'PRACTICE') return;
        if (!['dit', 'dah', '.', '-'].includes(element)) return;
        
        socket.to(channelId).emit('morseElement', {
            element: element,
            username: currentUser.username,
            senderId: socket.id,
            timestamp: Date.now()
        });
    });
    
    // Handle complete message
    socket.on('morseMessage', (data) => {
        const { text, morse, channelId } = data;
        
        if (channelId === 'LOBBY' || channelId === 'PRACTICE') return;
        if (!text || typeof text !== 'string') return;
        
        stats.messagesTransmitted++;
        
        socket.to(channelId).emit('morseMessage', {
            text: text.substring(0, 500), // Limit message length
            morse: morse ? morse.substring(0, 2000) : '',
            username: currentUser.username,
            senderId: socket.id,
            timestamp: Date.now()
        });
        
        console.log(`[${new Date().toISOString()}] [${channelId}] ${currentUser.username}: ${text.substring(0, 50)}...`);
    });
    
    // Handle real-time morse streaming (for live audio)
    socket.on('morseStart', (data) => {
        const { channelId } = data;
        if (channelId === 'LOBBY' || channelId === 'PRACTICE') return;
        
        socket.to(channelId).emit('morseStart', {
            username: currentUser.username,
            senderId: socket.id
        });
    });
    
    socket.on('morseStop', (data) => {
        const { channelId } = data;
        if (channelId === 'LOBBY' || channelId === 'PRACTICE') return;
        
        socket.to(channelId).emit('morseStop', {
            username: currentUser.username,
            senderId: socket.id
        });
    });
    
    // Handle private channel creation
    socket.on('createPrivateChannel', (channelName) => {
        if (!channelName || typeof channelName !== 'string') return;
        
        const safeName = channelName.substring(0, 15).replace(/[^a-zA-Z0-9-_]/g, '');
        
        if (!privateChannels.has(safeName)) {
            privateChannels.set(safeName, { name: safeName, type: 'private', users: new Map() });
            console.log(`[${new Date().toISOString()}] Private channel created: ${safeName}`);
        }
        socket.emit('privateChannelCreated', safeName);
    });
    
    // Handle disconnect
    socket.on('disconnect', (reason) => {
        console.log(`[${new Date().toISOString()}] User disconnected: ${socket.id} (${reason})`);
        
        // Remove from current channel
        leaveChannel(socket.id, currentUser.channel);
        
        // Notify others
        if (currentUser.channel !== 'LOBBY' && currentUser.channel !== 'PRACTICE') {
            socket.to(currentUser.channel).emit('userLeft', {
                username: currentUser.username,
                channelId: currentUser.channel,
                timestamp: Date.now()
            });
        }
        
        broadcastChannelUsers();
    });
    
    function leaveChannel(socketId, channelId) {
        if (channelId.startsWith('PRIV_')) {
            const privName = channelId.replace('PRIV_', '');
            if (privateChannels.has(privName)) {
                privateChannels.get(privName).users.delete(socketId);
                // Clean up empty private channels after 5 minutes
                if (privateChannels.get(privName).users.size === 0) {
                    setTimeout(() => {
                        if (privateChannels.has(privName) && privateChannels.get(privName).users.size === 0) {
                            privateChannels.delete(privName);
                            console.log(`[${new Date().toISOString()}] Private channel deleted: ${privName}`);
                        }
                    }, 300000);
                }
            }
        } else if (channels[channelId]) {
            channels[channelId].users.delete(socketId);
        }
        socket.leave(channelId);
    }
    
    function broadcastChannelUsers() {
        const channelCounts = {};
        
        for (const [id, channel] of Object.entries(channels)) {
            channelCounts[id] = channel.users.size;
        }
        
        for (const [name, channel] of privateChannels) {
            channelCounts['PRIV_' + name] = channel.users.size;
        }
        
        io.emit('channelUsers', channelCounts);
    }
});

// Cleanup inactive private channels every hour
setInterval(() => {
    for (const [name, channel] of privateChannels) {
        if (channel.users.size === 0) {
            privateChannels.delete(name);
            console.log(`[${new Date().toISOString()}] Cleanup: Private channel deleted: ${name}`);
        }
    }
}, 3600000);

// Start server
const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`
    ╔═══════════════════════════════════════════════════════╗
    ║           ⚡ MORSE NET SERVER v2.1 ⚡                  ║
    ╠═══════════════════════════════════════════════════════╣
    ║  Status:    ONLINE                                    ║
    ║  Port:      ${PORT}                                        ║
    ║  Time:      ${new Date().toISOString()}      ║
    ║  Node:      ${process.version}                              ║
    ╠═══════════════════════════════════════════════════════╣
    ║  Ready for connections!                               ║
    ╚═══════════════════════════════════════════════════════╝
    `);
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('SIGTERM received. Shutting down gracefully...');
    server.close(() => {
        console.log('Server closed.');
        process.exit(0);
    });
});
