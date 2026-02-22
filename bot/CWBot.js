/**
 * Bot CW Intelligent v1.1
 * Avec détection du callsign utilisateur
 */

const procedures = require('./procedures');
const responses = require('./responses');
const QSOStateMachine = require('./QSOStateMachine');

class CWBot {
    constructor(options = {}) {
        this.options = {
            speed: options.speed || 'normal',
            difficulty: options.difficulty || 'beginner',
            qsoType: options.qsoType || 'casual',
            autoRespond: options.autoRespond !== false,
            responseDelay: options.responseDelay || { min: 2000, max: 5000 },
            ...options
        };
        
        this.profile = this.selectRandomProfile();
        this.qso = new QSOStateMachine();
        this.lastUserMessage = null;
        this.pendingResponse = null;
        this.messageCallback = null;
        
        // NOUVEAU: Callsign de l'utilisateur
        this.userCallsign = options.userCallsign || null;
    }
    
    // ========== CONFIGURATION ==========
    
    // NOUVEAU: Définir le callsign de l'utilisateur
    setUserCallsign(callsign) {
        if (callsign && typeof callsign === 'string') {
            this.userCallsign = callsign.toUpperCase().trim();
            console.log('[BOT] User callsign set to:', this.userCallsign);
        }
    }
    
    // NOUVEAU: Obtenir le callsign de l'utilisateur
    getUserCallsign() {
        return this.userCallsign;
    }
    
    selectRandomProfile() {
        const profiles = responses.BOT_PROFILES;
        return profiles[Math.floor(Math.random() * profiles.length)];
    }
    
    changeProfile(callsign = null) {
        if (callsign) {
            const profile = responses.BOT_PROFILES.find(p => p.callsign === callsign);
            if (profile) {
                this.profile = profile;
                return this.profile;
            }
        }
        this.profile = this.selectRandomProfile();
        return this.profile;
    }
    
    onMessage(callback) {
        this.messageCallback = callback;
    }
    
    // ========== ANALYSE DES MESSAGES ==========
    
    analyzeMessage(text) {
        const upperText = text.toUpperCase().trim();
        const words = upperText.split(/\s+/);
        
        const analysis = {
            original: text,
            normalized: upperText,
            words: words,
            detected: {
                isCQ: false,
                isGreeting: false,
                isReport: false,
                hasName: false,
                hasQTH: false,
                isQuestion: false,
                isConfirmation: false,
                isClosing: false,
                isRepeatRequest: false,
                hasCallsign: false,
                hasBotCallsign: false,      // NOUVEAU: Détecte si le callsign du bot est mentionné
                hasUserCallsign: false,      // NOUVEAU: Détecte si le callsign de l'utilisateur est présent
                userCallsignMatch: false,    // NOUVEAU: Le callsign extrait correspond au callsign configuré
                isCallingBot: false          // NOUVEAU: L'utilisateur appelle spécifiquement le bot
            },
            extracted: {
                callsign: null,
                callsigns: [],              // NOUVEAU: Tous les callsigns trouvés
                name: null,
                qth: null,
                rst: null
            },
            // NOUVEAU: Informations sur le callsign utilisateur
            userCallsignInfo: {
                configured: this.userCallsign,
                foundInMessage: false,
                matchesConfigured: false
            }
        };
        
        // Détecter les types de messages
        analysis.detected.isCQ = this.containsKeywords(upperText, procedures.KEYWORDS.cq);
        analysis.detected.isGreeting = this.containsKeywords(upperText, procedures.KEYWORDS.greeting);
        analysis.detected.isReport = this.containsKeywords(upperText, procedures.KEYWORDS.report);
        analysis.detected.hasName = this.containsKeywords(upperText, procedures.KEYWORDS.name);
        analysis.detected.hasQTH = this.containsKeywords(upperText, procedures.KEYWORDS.qth);
        analysis.detected.isQuestion = this.containsKeywords(upperText, procedures.KEYWORDS.question);
        analysis.detected.isConfirmation = this.containsKeywords(upperText, procedures.KEYWORDS.confirm);
        analysis.detected.isClosing = this.containsKeywords(upperText, procedures.KEYWORDS.closing);
        analysis.detected.isRepeatRequest = this.containsKeywords(upperText, procedures.KEYWORDS.repeat);
        
        // NOUVEAU: Extraire TOUS les callsigns
        analysis.extracted.callsigns = this.extractAllCallsigns(upperText);
        
        // Extraire le callsign principal (premier qui n'est pas le bot)
        analysis.extracted.callsign = this.extractCallsign(upperText);
        analysis.extracted.name = this.extractName(upperText);
        analysis.extracted.qth = this.extractQTH(upperText);
        analysis.extracted.rst = this.extractRST(upperText);
        
        if (analysis.extracted.callsign) {
            analysis.detected.hasCallsign = true;
        }
        
        // NOUVEAU: Vérifier si le callsign du bot est mentionné
        if (this.profile && this.profile.callsign) {
            analysis.detected.hasBotCallsign = analysis.extracted.callsigns.includes(this.profile.callsign);
            
            // L'utilisateur appelle le bot s'il mentionne son callsign suivi de DE
            const callingPattern = new RegExp(this.profile.callsign + '\\s+(DE|D E)\\s+', 'i');
            analysis.detected.isCallingBot = callingPattern.test(upperText);
        }
        
        // NOUVEAU: Vérifier le callsign de l'utilisateur
        if (this.userCallsign) {
            analysis.userCallsignInfo.configured = this.userCallsign;
            analysis.userCallsignInfo.foundInMessage = analysis.extracted.callsigns.includes(this.userCallsign);
            
            // Vérifier si le callsign extrait correspond au callsign configuré
            if (analysis.extracted.callsign) {
                analysis.userCallsignInfo.matchesConfigured = (analysis.extracted.callsign === this.userCallsign);
                analysis.detected.userCallsignMatch = analysis.userCallsignInfo.matchesConfigured;
            }
            
            analysis.detected.hasUserCallsign = analysis.userCallsignInfo.foundInMessage;
        }
        
        return analysis;
    }
    
    containsKeywords(text, keywords) {
        return keywords.some(keyword => {
            const regex = new RegExp('\\b' + keyword.replace(/[?]/g, '\\?') + '\\b', 'i');
            return regex.test(text);
        });
    }
    
    // NOUVEAU: Extraire tous les callsigns
    extractAllCallsigns(text) {
        const callsignRegex = /\b([A-Z]{1,2}[0-9][A-Z]{1,4}|[0-9][A-Z][0-9][A-Z]{1,4})\b/gi;
        const matches = text.match(callsignRegex);
        
        if (matches) {
            return [...new Set(matches.map(call => call.toUpperCase()))];
        }
        return [];
    }
    
    extractCallsign(text) {
        const callsignRegex = /\b([A-Z]{1,2}[0-9][A-Z]{1,4}|[0-9][A-Z][0-9][A-Z]{1,4})\b/gi;
        const matches = text.match(callsignRegex);
        
        if (matches) {
            // Filtrer le callsign du bot
            const userCalls = matches.filter(call => 
                call.toUpperCase() !== this.profile.callsign
            );
            return userCalls.length > 0 ? userCalls[0].toUpperCase() : null;
        }
        return null;
    }
    
    extractName(text) {
        const patterns = [
            /NAME\s+(?:IS\s+)?([A-Z]{2,12})/i,
            /NAME\s*[=:]\s*([A-Z]{2,12})/i,
            /OP\s+(?:IS\s+)?([A-Z]{2,12})/i,
            /MY\s+NAME\s+([A-Z]{2,12})/i
        ];
        
        for (const pattern of patterns) {
            const match = text.match(pattern);
            if (match) {
                return match[1].toUpperCase();
            }
        }
        return null;
    }
    
    extractQTH(text) {
        const patterns = [
            /QTH\s+(?:IS\s+)?(?:IN\s+)?([A-Z]{2,20})/i,
            /QTH\s*[=:]\s*([A-Z]{2,20})/i,
            /LOCATED\s+(?:IN\s+)?([A-Z]{2,20})/i
        ];
        
        for (const pattern of patterns) {
            const match = text.match(pattern);
            if (match) {
                return match[1].toUpperCase();
            }
        }
        return null;
    }
    
    extractRST(text) {
        const patterns = [
            /RST\s+([0-9]{3})/i,
            /UR\s+([0-9]{3})/i,
            /\b([0-9]{3})\s+[0-9]{3}\b/,
            /\b(5[0-9N]{2})\b/i
        ];
        
        for (const pattern of patterns) {
            const match = text.match(pattern);
            if (match) {
                return match[1].toUpperCase().replace('N', '9');
            }
        }
        return null;
    }
    
    // ========== GÉNÉRATION DE RÉPONSES ==========
    
    processUserMessage(text) {
        this.lastUserMessage = text;
        const analysis = this.analyzeMessage(text);
        
        // NOUVEAU: Mise à jour des infos utilisateur avec validation du callsign
        if (analysis.extracted.callsign) {
            // Utiliser le callsign configuré si disponible et correspondant
            if (this.userCallsign && analysis.detected.hasUserCallsign) {
                this.qso.setUserInfo({ callsign: this.userCallsign });
            } else if (analysis.extracted.callsign) {
                this.qso.setUserInfo({ callsign: analysis.extracted.callsign });
            }
        } else if (this.userCallsign && !this.qso.userInfo.callsign) {
            // Utiliser le callsign configuré par défaut
            this.qso.setUserInfo({ callsign: this.userCallsign });
        }
        
        if (analysis.extracted.name) {
            this.qso.setUserInfo({ name: analysis.extracted.name });
        }
        if (analysis.extracted.qth) {
            this.qso.setUserInfo({ qth: analysis.extracted.qth });
        }
        if (analysis.extracted.rst) {
            this.qso.setUserInfo({ rst: analysis.extracted.rst });
        }
        
        const response = this.generateResponse(analysis);
        
        return {
            analysis,
            response,
            qsoState: this.qso.getState()
        };
    }
    
    generateResponse(analysis) {
        const state = this.qso.state;
        const phases = procedures.QSO_PHASES;
        let responseText = '';
        let nextState = state;
        
        // NOUVEAU: Utiliser le callsign configuré si disponible
        const userCall = this.userCallsign || this.qso.userInfo.callsign || 'OM';
        
        // Si pas de QSO actif et l'utilisateur appelle CQ
        if (!this.qso.isActive() && analysis.detected.isCQ) {
            this.qso.startQSO(this.profile, this.options.qsoType);
            
            // NOUVEAU: Utiliser le callsign configuré
            if (this.userCallsign) {
                this.qso.setUserInfo({ callsign: this.userCallsign });
            }
            
            this.qso.transition(phases.RECEIVED_CALL);
            responseText = this.generateAnswerToCQ(analysis);
            nextState = phases.SENDING_REPORT;
        }
        // Si pas de QSO actif, le bot lance un CQ
        else if (!this.qso.isActive()) {
            this.qso.startQSO(this.profile, this.options.qsoType);
            
            // NOUVEAU: Utiliser le callsign configuré
            if (this.userCallsign) {
                this.qso.setUserInfo({ callsign: this.userCallsign });
            }
            
            responseText = this.generateCQCall();
            nextState = phases.WAITING_ANSWER;
        }
        else {
            switch (state) {
                case phases.CALLING_CQ:
                case phases.WAITING_ANSWER:
                    // NOUVEAU: Vérifier si l'utilisateur utilise son bon callsign
                    if (analysis.detected.hasCallsign || analysis.detected.isGreeting || analysis.detected.isCallingBot) {
                        this.qso.transition(phases.RECEIVED_CALL);
                        
                        // NOUVEAU: Feedback si le callsign ne correspond pas
                        if (this.userCallsign && analysis.extracted.callsign && 
                            analysis.extracted.callsign !== this.userCallsign) {
                            // L'utilisateur a tapé un callsign différent de celui configuré
                            console.log('[BOT] Warning: User typed different callsign:', 
                                analysis.extracted.callsign, 'vs configured:', this.userCallsign);
                        }
                        
                        responseText = this.generateAcknowledgment(analysis);
                        nextState = phases.SENDING_REPORT;
                    } else {
                        responseText = this.generateCQCall();
                    }
                    break;
                    
                case phases.RECEIVED_CALL:
                case phases.SENDING_REPORT:
                    responseText = this.generateReport();
                    this.qso.transition(phases.RECEIVING_REPORT);
                    nextState = phases.RECEIVING_REPORT;
                    break;
                    
                case phases.RECEIVING_REPORT:
                    if (analysis.detected.isReport || analysis.detected.hasName || analysis.detected.hasQTH) {
                        this.qso.incrementExchange();
                        
                        if (this.options.qsoType === 'contest' || this.options.qsoType === 'dx') {
                            responseText = this.generateClosing();
                            this.qso.transition(phases.CLOSING);
                            nextState = phases.ENDED;
                        } else {
                            responseText = this.generateConversation(analysis);
                            this.qso.transition(phases.EXCHANGING_INFO);
                            nextState = phases.EXCHANGING_INFO;
                        }
                    } else if (analysis.detected.isRepeatRequest) {
                        responseText = this.generateReport();
                    } else {
                        responseText = this.generatePromptForReport();
                    }
                    break;
                    
                case phases.EXCHANGING_INFO:
                    this.qso.incrementExchange();
                    
                    if (analysis.detected.isClosing) {
                        responseText = this.generateClosing();
                        this.qso.transition(phases.CLOSING);
                        nextState = phases.ENDED;
                    } else if (analysis.detected.isQuestion) {
                        responseText = this.generateAnswer(analysis);
                    } else if (this.qso.exchangeCount >= 3) {
                        responseText = this.generateClosing();
                        this.qso.transition(phases.CLOSING);
                        nextState = phases.ENDED;
                    } else {
                        responseText = this.generateConversation(analysis);
                    }
                    break;
                    
                case phases.CLOSING:
                    responseText = this.generateFarewell();
                    this.qso.transition(phases.ENDED);
                    nextState = phases.ENDED;
                    break;
                    
                case phases.ENDED:
                    this.qso.reset();
                    this.changeProfile();
                    responseText = null;
                    break;
            }
        }
        
        if (nextState !== state) {
            this.qso.transition(nextState);
        }
        
        return {
            text: responseText,
            morse: responseText ? this.textToMorse(responseText) : null,
            state: this.qso.state,
            // NOUVEAU: Informations sur le callsign utilisateur
            userCallsignInfo: {
                configured: this.userCallsign,
                detected: this.qso.userInfo.callsign,
                match: this.userCallsign && this.qso.userInfo.callsign === this.userCallsign
            }
        };
    }
    
    // ========== GÉNÉRATEURS DE MESSAGES ==========
    
    generateCQCall() {
        const templates = procedures.CQ_CALLS[this.options.qsoType === 'contest' ? 'contest' : 'standard'];
        const template = templates[Math.floor(Math.random() * templates.length)];
        return this.fillTemplate(template);
    }
    
    generateAnswerToCQ(analysis) {
        const templates = procedures.ANSWER_TEMPLATES.toUserCQ;
        const template = templates[Math.floor(Math.random() * templates.length)];
        return this.fillTemplate(template);
    }
    
    generateAcknowledgment(analysis) {
        const style = this.profile.style || 'friendly';
        const greetings = responses.STYLE_RESPONSES[style].greeting;
        const greeting = greetings[Math.floor(Math.random() * greetings.length)];
        
        const templates = procedures.ANSWER_TEMPLATES.ackUserAnswer;
        const template = templates[Math.floor(Math.random() * templates.length)];
        
        return `${this.fillTemplate(template)} ${greeting}`;
    }
    
    generateReport() {
        let templates;
        
        switch (this.options.qsoType) {
            case 'contest':
                templates = procedures.SIGNAL_REPORTS.contest_report;
                break;
            case 'dx':
                templates = procedures.SIGNAL_REPORTS.dx_report;
                break;
            default:
                templates = procedures.SIGNAL_REPORTS.first_report;
        }
        
        const template = templates[Math.floor(Math.random() * templates.length)];
        return this.fillTemplate(template);
    }
    
    generatePromptForReport() {
        const prompts = [
            'UR RST? NAME? QTH?',
            'PSE UR INFO',
            'HW CPY? UR RST ES NAME?',
            '{usercall} UR RST?'
        ];
        const prompt = prompts[Math.floor(Math.random() * prompts.length)];
        return this.fillTemplate(prompt);
    }
    
    generateConversation(analysis) {
        const parts = [];
        
        if (analysis.detected.isReport || analysis.detected.hasName) {
            const confirms = procedures.CONFIRMATIONS.understood;
            parts.push(confirms[Math.floor(Math.random() * confirms.length)]);
        }
        
        if (Math.random() > 0.5) {
            const questions = responses.CONVERSATION.questions;
            parts.push(questions[Math.floor(Math.random() * questions.length)]);
        } else {
            const comments = responses.CONVERSATION.comments;
            parts.push(comments[Math.floor(Math.random() * comments.length)]);
        }
        
        parts.push(this.fillTemplate('{usercall} DE {mycall} K'));
        
        return parts.join(' ');
    }
    
    generateAnswer(analysis) {
        const text = analysis.normalized;
        let answer = '';
        
        if (text.includes('WX') || text.includes('WEATHER')) {
            const wx = responses.WEATHER[Math.floor(Math.random() * responses.WEATHER.length)];
            answer = this.fillTemplate(responses.CONVERSATION.weather_responses[0], wx);
        } else if (text.includes('RIG') || text.includes('PWR') || text.includes('POWER')) {
            answer = this.fillTemplate(responses.CONVERSATION.rig_responses[0]);
        } else if (text.includes('ANT')) {
            answer = this.fillTemplate('ANT IS {antenna}');
        } else {
            answer = 'FB OM ' + this.fillTemplate('{usercall} DE {mycall} K');
        }
        
        return answer;
    }
    
    generateClosing() {
        const thanks = procedures.CLOSING.thanks;
        const thankYou = thanks[Math.floor(Math.random() * thanks.length)];
        
        return `${this.fillTemplate(thankYou)} ${this.generateFarewell()}`;
    }
    
    generateFarewell() {
        let templates;
        
        if (this.options.qsoType === 'contest') {
            templates = procedures.CLOSING.contest_end;
        } else {
            templates = procedures.CLOSING.farewell;
        }
        
        const template = templates[Math.floor(Math.random() * templates.length)];
        return this.fillTemplate(template);
    }
    
    // ========== UTILITAIRES ==========
    
    fillTemplate(template, extraVars = {}) {
        // NOUVEAU: Utiliser le callsign configuré en priorité
        const userCall = this.userCallsign || this.qso.userInfo.callsign || 'OM';
        
        const vars = {
            mycall: this.profile.callsign,
            usercall: userCall,
            name: this.profile.name,
            qth: this.profile.qth,
            country: this.profile.country,
            rst: this.qso.botInfo.rst || '599',
            rig: this.profile.rig,
            power: this.profile.power,
            antenna: this.profile.antenna,
            serial: String(Math.floor(Math.random() * 900) + 100),
            ...extraVars
        };
        
        let result = template;
        for (const [key, value] of Object.entries(vars)) {
            result = result.replace(new RegExp(`\\{${key}\\}`, 'gi'), value);
        }
        
        return result;
    }
    
    textToMorse(text) {
        const morseTable = {
            'A': '.-', 'B': '-...', 'C': '-.-.', 'D': '-..', 'E': '.', 'F': '..-.',
            'G': '--.', 'H': '....', 'I': '..', 'J': '.---', 'K': '-.-', 'L': '.-..',
            'M': '--', 'N': '-.', 'O': '---', 'P': '.--.', 'Q': '--.-', 'R': '.-.',
            'S': '...', 'T': '-', 'U': '..-', 'V': '...-', 'W': '.--', 'X': '-..-',
            'Y': '-.--', 'Z': '--..', '1': '.----', '2': '..---', '3': '...--',
            '4': '....-', '5': '.....', '6': '-....', '7': '--...', '8': '---..',
            '9': '----.', '0': '-----', '/': '-..-.', '?': '..--..', '.': '.-.-.-',
            ',': '--..--', '=': '-...-', '+': '.-.-.'
        };
        
        return text.toUpperCase().split('').map(char => {
            if (char === ' ') return '/';
            return morseTable[char] || '';
        }).filter(m => m).join(' ');
    }
    
    // ========== API PUBLIQUE ==========
    
    // MODIFIÉ: Accepte le callsign utilisateur
    startNewQSO(userCallsign = null) {
        this.changeProfile();
        
        // NOUVEAU: Définir le callsign utilisateur
        if (userCallsign) {
            this.setUserCallsign(userCallsign);
        }
        
        const response = this.generateResponse({ detected: {}, extracted: {} });
        return {
            botProfile: this.profile,
            response,
            qsoState: this.qso.getState(),
            userCallsign: this.userCallsign
        };
    }
    
    receiveMessage(text) {
        return this.processUserMessage(text);
    }
    
    getState() {
        return {
            profile: this.profile,
            qso: this.qso.getState(),
            options: this.options,
            userCallsign: this.userCallsign  // NOUVEAU
        };
    }
    
    reset() {
        this.qso.reset();
        this.changeProfile();
        this.lastUserMessage = null;
        // Note: on garde le userCallsign
    }
    
    setOptions(options) {
        this.options = { ...this.options, ...options };
        
        // NOUVEAU: Mettre à jour le callsign si fourni
        if (options.userCallsign) {
            this.setUserCallsign(options.userCallsign);
        }
    }
}

module.exports = CWBot;
