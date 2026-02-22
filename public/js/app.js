// ========================================
// MORSE NET v2.2 - Application JavaScript
// ========================================

// ========== SOCKET CONNECTION ==========
var socket = io();
var isConnected = false;

// ========== CONFIGURATION ==========
var config = {
    wpm: 20,
    frequency: 700,
    mode: 'B',
    reverse: false,
    username: 'VISITOR',
    privateChannels: [],
    botQsoType: 'casual',
    botDifficulty: 'beginner',
    botAutoStart: true,
    showBotAnalysis: false
};

var currentChannel = 'LOBBY';
var audioContext = null;
var oscillator = null;
var gainNode = null;
var channelUserCounts = {};

// Bot state
var botState = {
    profile: null,
    qsoState: 'idle',
    isActive: false
};

// Other users' oscillators
var otherUsersAudio = {};

// ========== CHANNEL DATA ==========
var channelData = {
    LOBBY: { name: 'Lobby', description: "Canal d'accueil - Mode silencieux", type: 'lobby' },
    PRACTICE: { name: 'Practice', description: 'Entraînement avec Bot QSO intelligent', type: 'practice' },
    CH1: { name: 'Channel 1', description: 'Canal de communication', type: 'normal' },
    CH2: { name: 'Channel 2', description: 'Canal de communication', type: 'normal' },
    CH3: { name: 'Channel 3', description: 'Canal de communication', type: 'normal' },
    CH4: { name: 'Channel 4', description: 'Canal de communication', type: 'normal' },
    CH5: { name: 'Channel 5', description: 'Canal de communication', type: 'normal' },
    CH6: { name: 'Channel 6', description: 'Canal de communication', type: 'normal' },
    CH7: { name: 'Channel 7', description: 'Canal de communication', type: 'normal' },
    CH8: { name: 'Channel 8', description: 'Canal de communication', type: 'normal' }
};

// ========== MORSE CODE TABLE ==========
var morseTable = {
    'A': '.-', 'B': '-...', 'C': '-.-.', 'D': '-..', 'E': '.', 'F': '..-.',
    'G': '--.', 'H': '....', 'I': '..', 'J': '.---', 'K': '-.-', 'L': '.-..',
    'M': '--', 'N': '-.', 'O': '---', 'P': '.--.', 'Q': '--.-', 'R': '.-.',
    'S': '...', 'T': '-', 'U': '..-', 'V': '...-', 'W': '.--', 'X': '-..-',
    'Y': '-.--', 'Z': '--..', '1': '.----', '2': '..---', '3': '...--',
    '4': '....-', '5': '.....', '6': '-....', '7': '--...', '8': '---..',
    '9': '----.', '0': '-----', '/': '-..-.', '?': '..--..', '.': '.-.-.-',
    ',': '--..--', '=': '-...-', '+': '.-.-.'
};

var reverseMorseTable = {};
for (var key in morseTable) {
    reverseMorseTable[morseTable[key]] = key;
}

// ========== KEYER STATE ==========
var keyerState = {
    ditPressed: false,
    dahPressed: false,
    isPlaying: false,
    lastElement: null,
    currentMorse: '',
    currentText: '',
    lastKeyTime: 0,
    currentLineElement: null,
    lineTimeout: null,
    letterTimeout: null,
    wordTimeout: null
};

// ========== SOCKET EVENTS ==========
socket.on('connect', function() {
    isConnected = true;
    updateConnectionStatus('connected');
    console.log('Connected to server');
    
    socket.emit('joinChannel', {
        channelId: currentChannel,
        username: config.username
    });
});

socket.on('disconnect', function() {
    isConnected = false;
    updateConnectionStatus('disconnected');
    console.log('Disconnected from server');
});

socket.on('channelUsers', function(counts) {
    channelUserCounts = counts;
    renderChannels();
});

socket.on('userJoined', function(data) {
    addSystemMessage(data.username + ' a rejoint le canal');
});

socket.on('userLeft', function(data) {
    addSystemMessage(data.username + ' a quitté le canal');
});

// ========== BOT EVENTS ==========
socket.on('botReady', function(state) {
    console.log('Bot ready:', state);
    botState = state;
    updateBotDisplay();
    
    if (config.botAutoStart) {
        addSystemMessage('🤖 Bot CW prêt. Appuyez sur START QSO ou tapez CQ pour commencer!');
    }
});

socket.on('botStarted', function(data) {
    console.log('Bot started:', data);
    botState.profile = data.profile;
    botState.qsoState = data.qsoState.state;
    botState.isActive = true;
    updateBotDisplay();
});

socket.on('botMessage', function(data) {
    console.log('Bot message:', data);
    
    if (data.qsoState) {
        botState.qsoState = data.qsoState.state;
        updateBotDisplay();
    }
    
    addBotMessage(data.callsign, data.morse, data.text);
    
    if (data.morse) {
        playReceivedMorse(data.morse);
    }
});

socket.on('botReset', function(state) {
    console.log('Bot reset:', state);
    botState = state || { profile: null, qsoState: 'idle', isActive: false };
    updateBotDisplay();
    addSystemMessage('🔄 Bot réinitialisé. Prêt pour un nouveau QSO.');
});

socket.on('qsoEnded', function(data) {
    console.log('QSO ended:', data);
    var duration = Math.round(data.duration / 1000);
    addSystemMessage('✅ QSO terminé! Durée: ' + duration + 's, Échanges: ' + data.exchanges);
    addSystemMessage('💡 Cliquez START QSO ou tapez CQ pour un nouveau QSO.');
    
    botState.qsoState = 'ended';
    botState.isActive = false;
    updateBotDisplay();
});

socket.on('messageAnalysis', function(analysis) {
    console.log('Message analysis:', analysis);
    
    if (config.showBotAnalysis) {
        var detected = [];
        if (analysis.detected.isCQ) detected.push('CQ');
        if (analysis.detected.isGreeting) detected.push('Greeting');
        if (analysis.detected.isReport) detected.push('Report');
        if (analysis.detected.isClosing) detected.push('Closing');
        
        if (detected.length > 0) {
            addSystemMessage('📊 Détecté: ' + detected.join(', '));
        }
        
        if (analysis.extracted.callsign) {
            addSystemMessage('📊 Callsign: ' + analysis.extracted.callsign);
        }
    }
});

socket.on('morseStart', function(data) {
    startOtherUserTone(data.senderId);
});

socket.on('morseStop', function(data) {
    stopOtherUserTone(data.senderId);
});

socket.on('morseMessage', function(data) {
    addOtherUserMessage(data.username, data.morse, data.text);
});

// ========== CONNECTION STATUS ==========
function updateConnectionStatus(status) {
    var el = document.getElementById('connectionStatus');
    el.className = 'connection-status ' + status;
    if (status === 'connected') {
        el.textContent = '🟢 Connected';
    } else if (status === 'disconnected') {
        el.textContent = '🔴 Disconnected';
    } else {
        el.textContent = '⏳ Connecting...';
    }
}

// ========== BOT FUNCTIONS ==========
function updateBotDisplay() {
    var callsignEl = document.getElementById('botCallsign');
    var nameEl = document.getElementById('botName');
    var stateEl = document.getElementById('qsoState');
    
    if (botState.profile) {
        callsignEl.textContent = botState.profile.callsign;
        nameEl.textContent = botState.profile.name + ' - ' + botState.profile.qth + ', ' + botState.profile.country;
    } else {
        callsignEl.textContent = '-';
        nameEl.textContent = 'En attente...';
    }
    
    var stateText = botState.qsoState || 'idle';
    stateText = stateText.toUpperCase().replace(/_/g, ' ');
    stateEl.textContent = stateText;
    
    if (botState.isActive) {
        stateEl.classList.add('active');
    } else {
        stateEl.classList.remove('active');
    }
}

function startBotQSO() {
    if (currentChannel !== 'PRACTICE') {
        alert('Le bot QSO n\'est disponible que dans le canal Practice!');
        return;
    }
    
    socket.emit('startBotQSO', {
        qsoType: config.botQsoType,
        difficulty: config.botDifficulty
    });
    
    addSystemMessage('🚀 Démarrage du QSO...');
}

function resetBot() {
    socket.emit('resetBot');
}

// ========== TIMING ==========
function getDitLength() {
    return 1200 / config.wpm;
}

function getDahLength() {
    return getDitLength() * 3;
}

function getElementSpace() {
    return getDitLength();
}

function getLetterSpace() {
    return getDitLength() * 4;
}

function getWordSpace() {
    return getDitLength() * 7;
}

// ========== AUDIO ==========
function initAudio() {
    if (!audioContext) {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioContext.state === 'suspended') {
        audioContext.resume();
    }
}

function startTone() {
    var channelType = channelData[currentChannel] ? channelData[currentChannel].type : 'normal';
    if (channelType === 'lobby') return;
    
    initAudio();
    if (oscillator) return;

    oscillator = audioContext.createOscillator();
    gainNode = audioContext.createGain();
    
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(config.frequency, audioContext.currentTime);
    
    gainNode.gain.setValueAtTime(0, audioContext.currentTime);
    gainNode.gain.linearRampToValueAtTime(0.3, audioContext.currentTime + 0.008);
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    oscillator.start();
    
    if (channelType === 'normal') {
        socket.emit('morseStart', { channelId: currentChannel });
    }
}

function stopTone() {
    if (oscillator && gainNode) {
        gainNode.gain.linearRampToValueAtTime(0, audioContext.currentTime + 0.008);
        
        var osc = oscillator;
        setTimeout(function() {
            try { osc.stop(); } catch(e) {}
        }, 15);
        
        oscillator = null;
        gainNode = null;
        
        var channelType = channelData[currentChannel] ? channelData[currentChannel].type : 'normal';
        if (channelType === 'normal') {
            socket.emit('morseStop', { channelId: currentChannel });
        }
    }
}

function startOtherUserTone(senderId) {
    initAudio();
    
    if (otherUsersAudio[senderId]) return;
    
    var osc = audioContext.createOscillator();
    var gain = audioContext.createGain();
    
    osc.type = 'sine';
    osc.frequency.setValueAtTime(config.frequency * 0.85, audioContext.currentTime);
    
    gain.gain.setValueAtTime(0, audioContext.currentTime);
    gain.gain.linearRampToValueAtTime(0.2, audioContext.currentTime + 0.008);
    
    osc.connect(gain);
    gain.connect(audioContext.destination);
    
    osc.start();
    
    otherUsersAudio[senderId] = { oscillator: osc, gain: gain };
}

function stopOtherUserTone(senderId) {
    if (otherUsersAudio[senderId]) {
        var audio = otherUsersAudio[senderId];
        audio.gain.gain.linearRampToValueAtTime(0, audioContext.currentTime + 0.008);
        
        setTimeout(function() {
            try { audio.oscillator.stop(); } catch(e) {}
        }, 15);
        
        delete otherUsersAudio[senderId];
    }
}

function playReceivedMorse(morse) {
    initAudio();
    
    var elements = morse.split('');
    var index = 0;
    var otherFreq = config.frequency * 0.85;
    
    function playNext() {
        if (index >= elements.length) return;
        
        var el = elements[index];
        index++;
        
        if (el === '.' || el === '-') {
            var dur = el === '.' ? getDitLength() : getDahLength();
            
            var osc = audioContext.createOscillator();
            var gain = audioContext.createGain();
            
            osc.type = 'sine';
            osc.frequency.setValueAtTime(otherFreq, audioContext.currentTime);
            gain.gain.setValueAtTime(0.2, audioContext.currentTime);
            
            osc.connect(gain);
            gain.connect(audioContext.destination);
            
            osc.start();
            osc.stop(audioContext.currentTime + dur / 1000);
            
            setTimeout(playNext, dur + getElementSpace());
        } else if (el === ' ') {
            setTimeout(playNext, getLetterSpace());
        } else if (el === '/') {
            setTimeout(playNext, getWordSpace());
        } else {
            playNext();
        }
    }
    
    playNext();
}

// ========== IAMBIC KEYER ==========
function playElement(element) {
    var channelType = channelData[currentChannel] ? channelData[currentChannel].type : 'normal';
    if (channelType === 'lobby') return;
    
    keyerState.isPlaying = true;
    startTone();
    
    var duration = element === '.' ? getDitLength() : getDahLength();
    keyerState.currentMorse += element;
    
    var indicator = element === '.' ? 'ditIndicator' : 'dahIndicator';
    document.getElementById(indicator).classList.add('active');
    
    updateCurrentLine();
    
    if (keyerState.letterTimeout) {
        clearTimeout(keyerState.letterTimeout);
        keyerState.letterTimeout = null;
    }
    
    setTimeout(function() {
        stopTone();
        document.getElementById('ditIndicator').classList.remove('active');
        document.getElementById('dahIndicator').classList.remove('active');
        
        keyerState.lastKeyTime = Date.now();
        keyerState.lastElement = element;
        
        keyerState.letterTimeout = setTimeout(function() {
            finalizeLetter();
        }, getLetterSpace());
        
        setTimeout(function() {
            keyerState.isPlaying = false;
            processNextElement();
        }, getElementSpace());
    }, duration);
}

function processNextElement() {
    if (keyerState.isPlaying) return;

    var ditKey = config.reverse ? keyerState.dahPressed : keyerState.ditPressed;
    var dahKey = config.reverse ? keyerState.ditPressed : keyerState.dahPressed;

    if (config.mode === 'B') {
        if (ditKey && dahKey) {
            playElement(keyerState.lastElement === '.' ? '-' : '.');
        } else if (ditKey) {
            playElement('.');
        } else if (dahKey) {
            playElement('-');
        }
    } else {
        if (ditKey) {
            playElement('.');
        } else if (dahKey) {
            playElement('-');
        }
    }
}

function finalizeLetter() {
    if (keyerState.currentMorse) {
        var letter = reverseMorseTable[keyerState.currentMorse];
        if (letter) {
            keyerState.currentText += letter;
        } else {
            keyerState.currentText += '[' + keyerState.currentMorse + ']';
        }
        updateCurrentLine();
        keyerState.currentMorse = '';
        
        if (keyerState.wordTimeout) {
            clearTimeout(keyerState.wordTimeout);
        }
        keyerState.wordTimeout = setTimeout(function() {
            if (keyerState.currentText && !keyerState.currentText.endsWith(' ')) {
                keyerState.currentText += ' ';
                updateCurrentLine();
            }
        }, getWordSpace() - getLetterSpace());
        
        if (keyerState.lineTimeout) {
            clearTimeout(keyerState.lineTimeout);
        }
        keyerState.lineTimeout = setTimeout(function() {
            finalizeLine();
        }, 5000);
    }
}

function updateCurrentLine() {
    var channelType = channelData[currentChannel] ? channelData[currentChannel].type : 'normal';
    if (channelType === 'lobby') return;
    
    if (!keyerState.currentLineElement) {
        keyerState.currentLineElement = createNewLine();
    }
    
    var morseCodeEl = keyerState.currentLineElement.querySelector('.morse-code');
    var morseTextEl = keyerState.currentLineElement.querySelector('.morse-text');
    
    var displayMorse = '';
    if (keyerState.currentText) {
        var chars = keyerState.currentText.split('');
        var morseParts = [];
        for (var i = 0; i < chars.length; i++) {
            var m = morseTable[chars[i]];
            if (m) morseParts.push(m);
            else if (chars[i] === ' ') morseParts.push('/');
        }
        displayMorse = morseParts.join(' ');
    }
    if (keyerState.currentMorse) {
        displayMorse += (displayMorse ? ' ' : '') + keyerState.currentMorse;
    }
    
    morseCodeEl.textContent = displayMorse;
    morseTextEl.innerHTML = keyerState.currentText + '<span class="cursor">▌</span>';
    
    scrollToBottom();
}

function createNewLine() {
    var display = document.getElementById('morseDisplay');
    var anchor = document.getElementById('scrollAnchor');
    
    var line = document.createElement('div');
    line.className = 'morse-line current';
    line.innerHTML = 
        '<span class="morse-timestamp">' + getTimestamp() + '</span>' +
        '<span class="morse-user">' + config.username + ':</span>' +
        '<div class="morse-content">' +
            '<div class="morse-code"></div>' +
            '<div class="morse-text"><span class="cursor">▌</span></div>' +
        '</div>';
    
    display.insertBefore(line, anchor);
    scrollToBottom();
    return line;
}

function finalizeLine() {
    if (keyerState.currentLineElement) {
        keyerState.currentLineElement.classList.remove('current');
        var cursor = keyerState.currentLineElement.querySelector('.cursor');
        if (cursor) cursor.remove();
        
        if (keyerState.currentText.trim()) {
            var text = keyerState.currentText.trim();
            var morse = textToMorse(text);
            
            socket.emit('morseMessage', {
                text: text,
                morse: morse,
                channelId: currentChannel
            });
        }
    }
    
    keyerState.currentLineElement = null;
    keyerState.currentText = '';
    keyerState.currentMorse = '';
    
    if (keyerState.letterTimeout) clearTimeout(keyerState.letterTimeout);
    if (keyerState.wordTimeout) clearTimeout(keyerState.wordTimeout);
    if (keyerState.lineTimeout) clearTimeout(keyerState.lineTimeout);
    keyerState.letterTimeout = null;
    keyerState.wordTimeout = null;
    keyerState.lineTimeout = null;
}

function textToMorse(text) {
    var result = [];
    for (var i = 0; i < text.length; i++) {
        var char = text[i].toUpperCase();
        if (morseTable[char]) {
            result.push(morseTable[char]);
        } else if (char === ' ') {
            result.push('/');
        }
    }
    return result.join(' ');
}

// ========== KEYBOARD EVENTS ==========
document.addEventListener('keydown', function(e) {
    if (e.repeat) return;
    
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
    
    if (e.code === 'ControlLeft') {
        e.preventDefault();
        initAudio();
        keyerState.ditPressed = true;
        if (!keyerState.isPlaying) processNextElement();
    } else if (e.code === 'ControlRight') {
        e.preventDefault();
        initAudio();
        keyerState.dahPressed = true;
        if (!keyerState.isPlaying) processNextElement();
    }
});

document.addEventListener('keyup', function(e) {
    if (e.code === 'ControlLeft') {
        e.preventDefault();
        keyerState.ditPressed = false;
    } else if (e.code === 'ControlRight') {
        e.preventDefault();
        keyerState.dahPressed = false;
    }
});

// ========== UTILITY FUNCTIONS ==========
function getTimestamp() {
    var now = new Date();
    var h = now.getHours().toString().padStart(2, '0');
    var m = now.getMinutes().toString().padStart(2, '0');
    return h + ':' + m;
}

function scrollToBottom() {
    var display = document.getElementById('morseDisplay');
    var anchor = document.getElementById('scrollAnchor');
    
    requestAnimationFrame(function() {
        if (anchor) {
            anchor.scrollIntoView({ behavior: 'auto', block: 'end' });
        }
        display.scrollTop = display.scrollHeight;
    });
}

function clearDisplay() {
    var display = document.getElementById('morseDisplay');
    display.innerHTML = '<div class="scroll-anchor" id="scrollAnchor"></div>';
    keyerState.currentLineElement = null;
    keyerState.currentText = '';
    keyerState.currentMorse = '';
    addSystemMessage('Display cleared');
}

function addSystemMessage(text) {
    var display = document.getElementById('morseDisplay');
    var anchor = document.getElementById('scrollAnchor');
    
    var line = document.createElement('div');
    line.className = 'morse-line system';
    line.innerHTML = 
        '<span class="morse-timestamp">' + getTimestamp() + '</span>' +
        '<span class="morse-user system">SYSTEM:</span>' +
        '<div class="morse-content">' +
            '<div class="morse-text">' + text + '</div>' +
        '</div>';
    
    display.insertBefore(line, anchor);
    scrollToBottom();
}

function addBotMessage(callsign, morse, text) {
    var display = document.getElementById('morseDisplay');
    var anchor = document.getElementById('scrollAnchor');
    
    var line = document.createElement('div');
    line.className = 'morse-line bot-message';
    line.innerHTML = 
        '<span class="morse-timestamp">' + getTimestamp() + '</span>' +
        '<span class="morse-user bot">🤖 ' + callsign + ':</span>' +
        '<div class="morse-content">' +
            '<div class="morse-code">' + (morse || '') + '</div>' +
            '<div class="morse-text">' + text + '</div>' +
        '</div>';
    
    display.insertBefore(line, anchor);
    scrollToBottom();
}

function addOtherUserMessage(username, morse, text) {
    var display = document.getElementById('morseDisplay');
    var anchor = document.getElementById('scrollAnchor');
    
    var line = document.createElement('div');
    line.className = 'morse-line other-user';
    line.innerHTML = 
        '<span class="morse-timestamp">' + getTimestamp() + '</span>' +
        '<span class="morse-user other">' + username + ':</span>' +
        '<div class="morse-content">' +
            '<div class="morse-code">' + (morse || '') + '</div>' +
            '<div class="morse-text">' + text + '</div>' +
        '</div>';
    
    display.insertBefore(line, anchor);
    scrollToBottom();
    
    if (morse) {
        playReceivedMorse(morse);
    }
}

function toggleHelp() {
    var helpPanel = document.getElementById('qsoHelp');
    var helpToggle = document.getElementById('helpToggle');
    
    if (helpPanel.classList.contains('active')) {
        helpPanel.classList.remove('active');
        helpToggle.style.display = 'flex';
    } else {
        helpPanel.classList.add('active');
        helpToggle.style.display = 'none';
    }
}

// ========== CHANNEL FUNCTIONS ==========
function renderChannels() {
    var channelsList = document.getElementById('channelsList');
    channelsList.innerHTML = '';

    var specialSection = document.createElement('div');
    specialSection.className = 'channel-section';
    specialSection.innerHTML = '<div class="channel-section-title">📌 SPECIAL</div>';
    
    var specialIds = ['LOBBY', 'PRACTICE'];
    for (var i = 0; i < specialIds.length; i++) {
        var id = specialIds[i];
        var channel = channelData[id];
        var item = createChannelItem(id, channel);
        specialSection.appendChild(item);
    }
    channelsList.appendChild(specialSection);

    var publicSection = document.createElement('div');
    publicSection.className = 'channel-section';
    publicSection.innerHTML = '<div class="channel-section-title">📡 PUBLIC CHANNELS</div>';
    
    var publicIds = ['CH1', 'CH2', 'CH3', 'CH4', 'CH5', 'CH6', 'CH7', 'CH8'];
    for (var j = 0; j < publicIds.length; j++) {
        var pId = publicIds[j];
        var pChannel = channelData[pId];
        var pItem = createChannelItem(pId, pChannel);
        publicSection.appendChild(pItem);
    }
    channelsList.appendChild(publicSection);

    if (config.privateChannels.length > 0) {
        var privateSection = document.createElement('div');
        privateSection.className = 'channel-section';
        privateSection.innerHTML = '<div class="channel-section-title">🔒 PRIVATE CHANNELS</div>';
        
        for (var k = 0; k < config.privateChannels.length; k++) {
            var name = config.privateChannels[k];
            var privId = 'PRIV_' + name;
            var privItem = document.createElement('div');
            privItem.className = 'channel-item private';
            if (currentChannel === privId) privItem.classList.add('active');
            
            var privUsers = channelUserCounts[privId] || 0;
            privItem.innerHTML = 
                '<span class="channel-name">' + name + '</span>' +
                '<div class="channel-info">' +
                    '<span class="user-count">👥 ' + privUsers + '</span>' +
                    '<span class="channel-status ' + (currentChannel === privId ? 'active-status' : '') + '"></span>' +
                '</div>';
            
            (function(pName, pPrivId) {
                privItem.onclick = function() {
                    switchChannel(pPrivId, pName, 'Canal privé');
                };
            })(name, privId);
            
            privateSection.appendChild(privItem);
        }
        channelsList.appendChild(privateSection);
    }

    updateTotalUsers();
}

function createChannelItem(id, channel) {
    var item = document.createElement('div');
    item.className = 'channel-item ' + channel.type;
    if (currentChannel === id) item.classList.add('active');
    
    var userCount = channelUserCounts[id] || 0;
    var displayUsers = userCount;
    
    if (id === 'PRACTICE') {
        displayUsers = '🤖 BOT';
    }
    
    item.innerHTML = 
        '<span class="channel-name">' + channel.name + '</span>' +
        '<div class="channel-info">' +
            '<span class="user-count">👥 ' + displayUsers + '</span>' +
            '<span class="channel-status ' + (currentChannel === id ? 'active-status' : '') + '"></span>' +
        '</div>';
    
    (function(channelId, channelName, channelDesc) {
        item.onclick = function() {
            switchChannel(channelId, channelName, channelDesc);
        };
    })(id, channel.name, channel.description);
    
    return item;
}

function switchChannel(id, name, description) {
    finalizeLine();
    
    currentChannel = id;
    document.getElementById('channelTitle').textContent = name;
    document.getElementById('channelDescription').textContent = description;
    
    socket.emit('joinChannel', {
        channelId: id,
        username: config.username
    });
    
    var display = document.getElementById('morseDisplay');
    display.innerHTML = '<div class="scroll-anchor" id="scrollAnchor"></div>';
    
    var channelInfo = channelData[id];
    var channelType = channelInfo ? channelInfo.type : 'private';
    
    document.getElementById('mutedOverlay').classList.remove('active');
    document.getElementById('practiceBar').classList.remove('active');
    
    if (channelType === 'lobby') {
        document.getElementById('mutedOverlay').classList.add('active');
        addSystemMessage('Bienvenue dans le Lobby. Ce canal est en mode silencieux.');
    } else if (channelType === 'practice') {
        document.getElementById('practiceBar').classList.add('active');
        addSystemMessage('🎯 Mode Practice avec Bot CW intelligent.');
        addSystemMessage('📚 Tapez CQ ou cliquez START QSO pour commencer.');
        
        botState = { profile: null, qsoState: 'idle', isActive: false };
        updateBotDisplay();
    } else {
        addSystemMessage('Connecté à ' + name + '. Bonne transmission!');
    }
    
    renderChannels();
}

function updateTotalUsers() {
    var total = 0;
    for (var id in channelUserCounts) {
        total += channelUserCounts[id];
    }
    document.getElementById('totalUsers').textContent = '👥 ' + total + ' online';
}

// ========== SETTINGS ==========
function openSettings() {
    document.getElementById('settingsModal').classList.add('active');
}

function closeSettings() {
    config.wpm = parseInt(document.getElementById('wpmSlider').value);
    config.frequency = parseInt(document.getElementById('freqSlider').value);
    config.mode = document.getElementById('iambicMode').value;
    config.reverse = document.getElementById('reverseKeys').checked;
    config.username = document.getElementById('username').value.toUpperCase() || 'VISITOR';
    config.botQsoType = document.getElementById('botQsoType').value;
    config.botDifficulty = document.getElementById('botDifficulty').value;
    config.botAutoStart = document.getElementById('botAutoStart').checked;
    config.showBotAnalysis = document.getElementById('showBotAnalysis').checked;
    
    document.getElementById('wpmDisplay').textContent = config.wpm;
    document.getElementById('freqDisplay').textContent = config.frequency + ' Hz';
    document.getElementById('modeDisplay').textContent = 'IAMBIC-' + config.mode;
    document.getElementById('userDisplay').textContent = config.username;
    
    document.getElementById('settingsModal').classList.remove('active');
    saveSettings();
    
    socket.emit('joinChannel', {
        channelId: currentChannel,
        username: config.username
    });
    
    if (currentChannel === 'PRACTICE') {
        socket.emit('configureBot', {
            qsoType: config.botQsoType,
            difficulty: config.botDifficulty
        });
    }
    
    renderChannels();
}

function applyPrivateChannels() {
    var input = document.getElementById('privateChannels').value;
    var channels = input.split(',');
    config.privateChannels = [];
    
    for (var i = 0; i < channels.length; i++) {
        var name = channels[i].trim();
        if (name.length > 0 && name.length <= 15) {
            config.privateChannels.push(name);
            socket.emit('createPrivateChannel', name);
        }
    }
    
    renderChannels();
    saveSettings();
    
    if (config.privateChannels.length > 0) {
        alert('✓ ' + config.privateChannels.length + ' canal(aux) privé(s) créé(s):\n' + config.privateChannels.join(', '));
    }
}

function saveSettings() {
    try {
        localStorage.setItem('morseNetSettings', JSON.stringify(config));
    } catch(e) {}
}

function loadSettings() {
    try {
        var saved = localStorage.getItem('morseNetSettings');
        if (saved) {
            var settings = JSON.parse(saved);
            config.wpm = settings.wpm || 20;
            config.frequency = settings.frequency || 700;
            config.mode = settings.mode || 'B';
            config.reverse = settings.reverse || false;
            config.username = settings.username || 'VISITOR';
            config.privateChannels = settings.privateChannels || [];
            config.botQsoType = settings.botQsoType || 'casual';
            config.botDifficulty = settings.botDifficulty || 'beginner';
            config.botAutoStart = settings.botAutoStart !== false;
            config.showBotAnalysis = settings.showBotAnalysis || false;
            
            document.getElementById('wpmSlider').value = config.wpm;
            document.getElementById('freqSlider').value = config.frequency;
            document.getElementById('iambicMode').value = config.mode;
            document.getElementById('reverseKeys').checked = config.reverse;
            document.getElementById('username').value = config.username;
            document.getElementById('privateChannels').value = config.privateChannels.join(', ');
            document.getElementById('botQsoType').value = config.botQsoType;
            document.getElementById('botDifficulty').value = config.botDifficulty;
            document.getElementById('botAutoStart').checked = config.botAutoStart;
            document.getElementById('showBotAnalysis').checked = config.showBotAnalysis;
            
            document.getElementById('wpmValue').textContent = config.wpm + ' WPM';
            document.getElementById('freqValue').textContent = config.frequency + ' Hz';
            document.getElementById('wpmDisplay').textContent = config.wpm;
            document.getElementById('freqDisplay').textContent = config.frequency + ' Hz';
            document.getElementById('modeDisplay').textContent = 'IAMBIC-' + config.mode;
            document.getElementById('userDisplay').textContent = config.username;
        }
    } catch(e) {}
}

// ========== EVENT LISTENERS ==========
document.getElementById('wpmSlider').addEventListener('input', function() {
    document.getElementById('wpmValue').textContent = this.value + ' WPM';
});

document.getElementById('freqSlider').addEventListener('input', function() {
    document.getElementById('freqValue').textContent = this.value + ' Hz';
});

// ========== INITIALIZATION ==========
document.addEventListener('DOMContentLoaded', function() {
    loadSettings();
    renderChannels();
    updateConnectionStatus('connecting');
});

document.addEventListener('contextmenu', function(e) {
    if (e.ctrlKey) e.preventDefault();
});

window.addEventListener('beforeunload', saveSettings);
