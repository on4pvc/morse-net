const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const CWBot = require('./bot/CWBot');

const app = express();
const server = http.createServer(app);

const io = socketIo(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    },
    transports: ['websocket', 'polling']
});

app.use(express.static(path.join(__dirname, 'public')));

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

const privateChannels = new Map();

// Bots par utilisateur
let userBots = new Map();

io.on('connection', (socket) => {
    console.log(`User connected: ${socket.id}`);
    
    let currentUser = {
        id: socket.id,
        username: 'VISITOR',
        channel: 'LOBBY'
    };
    
    let userBot = null;
    
    channels.LOBBY.users.set(socket.id, currentUser);
    broadcastChannelUsers();
    
    // ========== GESTION DU BOT ==========
    
    socket.on('configureBot', (options) => {
        if (userBot) {
            userBot.setOptions(options);
        }
        socket.emit('botConfigured', userBot ? userBot.getState() : null);
    });
    
    socket.on('startBotQSO', (options = {}) => {
        if (currentUser.channel !== 'PRACTICE') return;
        
        userBot = new CWBot({
            qsoType: options.qsoType || 'casual',
            difficulty: options.difficulty || 'beginner',
            ...options
        });
        
        const result = userBot.startNewQSO();
        
        setTimeout(() => {
            if (result.response && result.response.text) {
                socket.emit('botMessage', {
                    callsign: result.botProfile.callsign,
                    text: result.response.text,
                    morse: result.response.morse,
                    profile: result.botProfile,
                    qsoState: result.qsoState
                });
            }
        }, 2000);
        
        socket.emit('botStarted', {
            profile: result.botProfile,
            qsoState: result.qsoState
        });
    });
    
    socket.on('sendToBot', (data) => {
        if (!userBot || currentUser.channel !== 'PRACTICE') return;
        
        const { text } = data;
        const result = userBot.receiveMessage(text);
        
        const delay = 2000 + Math.random() * 3000;
        
        setTimeout(() => {
            if (result.response && result.response.text) {
                socket.emit('botMessage', {
                    callsign: userBot.profile.callsign,
                    text: result.response.text,
                    morse: result.response.morse,
                    analysis: result.analysis,
                    qsoState: result.qsoState
                });
            }
            
            if (result.qsoState.state === 'ended') {
                setTimeout(() => {
                    socket.emit('qsoEnded', {
                        duration: result.qsoState.duration,
                        exchanges: result.qsoState.exchangeCount
                    });
                }, 1000);
            }
        }, delay);
        
        socket.emit('messageAnalysis', result.analysis);
    });
    
    socket.on('resetBot', () => {
        if (userBot) {
            userBot.reset();
            socket.emit('botReset', userBot.getState());
        }
    });
    
    socket.on('getBotState', () => {
        socket.emit('botState', userBot ? userBot.getState() : null);
    });
    
    // ========== GESTION DES CANAUX ==========
    
    socket.on('joinChannel', (data) => {
        const { channelId, username } = data;
        if (!channelId) return;
        
        // Leave current channel
        leaveChannel(socket.id, currentUser.channel);
        
        // Update user info
        currentUser.username = (username || 'VISITOR').substring(0, 12).toUpperCase();
        currentUser.channel = channelId;
        
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
        
        // Si on rejoint Practice, préparer le bot
        if (channelId === 'PRACTICE') {
            userBot = new CWBot({
                qsoType: 'casual',
                difficulty: 'beginner'
            });
            socket.emit('botReady', userBot.getState());
        } else {
            userBot = null;
        }
        
        broadcastChannelUsers();
        
        // Notify others in the channel
        if (channelId !== 'LOBBY' && channelId !== 'PRACTICE') {
            socket.to(channelId).emit('userJoined', {
                username: currentUser.username,
                channelId: channelId
            });
        }
    });
    
    // Communication morse entre utilisateurs
    socket.on('morseMessage', (data) => {
        const { text, morse, channelId } = data;
        
        if (channelId === 'LOBBY') return;
        
        // Mode Practice = envoyer au bot
        if (channelId === 'PRACTICE' && userBot) {
            socket.emit('userMessageSent', { text, morse });
            
            const result = userBot.receiveMessage(text);
            
            const delay = 2000 + Math.random() * 3000;
            setTimeout(() => {
                if (result.response && result.response.text) {
                    socket.emit('botMessage', {
                        callsign: userBot.profile.callsign,
                        text: result.response.text,
                        morse: result.response.morse,
                        qsoState: result.qsoState
                    });
                }
                
                if (result.qsoState && result.qsoState.state === 'ended') {
                    setTimeout(() => {
                        socket.emit('qsoEnded', {
                            duration: result.qsoState.duration,
                            exchanges: result.qsoState.exchangeCount
                        });
                    }, 1000);
                }
            }, delay);
            
            return;
        }
        
        // Mode normal = broadcast aux autres
        socket.to(channelId).emit('morseMessage', {
            text: text.substring(0, 500),
            morse: morse ? morse.substring(0, 2000) : '',
            username: currentUser.username,
            senderId: socket.id,
            timestamp: Date.now()
        });
    });
    
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
    
    socket.on('createPrivateChannel', (channelName) => {
        if (!channelName) return;
        const safeName = channelName.substring(0, 15).replace(/[^a-zA-Z0-9-_]/g, '');
        
        if (!privateChannels.has(safeName)) {
            privateChannels.set(safeName, { name: safeName, type: 'private', users: new Map() });
        }
        socket.emit('privateChannelCreated', safeName);
    });
    
    socket.on('disconnect', () => {
        console.log(`User disconnected: ${socket.id}`);
        
        leaveChannel(socket.id, currentUser.channel);
        userBots.delete(socket.id);
        
        if (currentUser.channel !== 'LOBBY' && currentUser.channel !== 'PRACTICE') {
            socket.to(currentUser.channel).emit('userLeft', {
                username: currentUser.username,
                channelId: currentUser.channel
            });
        }
        
        broadcastChannelUsers();
    });
    
    function leaveChannel(socketId, channelId) {
        if (channelId.startsWith('PRIV_')) {
            const privName = channelId.replace('PRIV_', '');
            if (privateChannels.has(privName)) {
                privateChannels.get(privName).users.delete(socketId);
                if (privateChannels.get(privName).users.size === 0) {
                    setTimeout(() => {
                        if (privateChannels.has(privName) && privateChannels.get(privName).users.size === 0) {
                            privateChannels.delete(privName);
                        }
                    }, 300000);
                }
            }
        } else if (channels[channelId]) {
            channels[channelId].users.delete(socketId);
        }
        socket.leave(channelId);
    }
    
    // NOUVELLE FONCTION: Envoyer les détails des utilisateurs
    function broadcastChannelUsers() {
        const channelDetails = {};
        
        // Canaux publics
        for (const [id, channel] of Object.entries(channels)) {
            const users = [];
            channel.users.forEach((user) => {
                users.push({
                    id: user.id,
                    username: user.username
                });
            });
            
            channelDetails[id] = {
                count: channel.users.size,
                users: users
            };
        }
        
        // Canaux privés
        for (const [name, channel] of privateChannels) {
            const users = [];
            channel.users.forEach((user) => {
                users.push({
                    id: user.id,
                    username: user.username
                });
            });
            
            channelDetails['PRIV_' + name] = {
                count: channel.users.size,
                users: users
            };
        }
        
        io.emit('channelUsers', channelDetails);
    }
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`
    ╔═══════════════════════════════════════════════════════╗
    ║           ⚡ MORSE NET SERVER v2.3 ⚡                  ║
    ║              WITH USER LIST                           ║
    ╠═══════════════════════════════════════════════════════╣
    ║  Port: ${PORT}                                             ║
    ║  Bot: CWBot v1.0 loaded                               ║
    ╚═══════════════════════════════════════════════════════╝
    `);
});

process.on('SIGTERM', () => {
    console.log('Shutting down...');
    server.close(() => process.exit(0));
});
