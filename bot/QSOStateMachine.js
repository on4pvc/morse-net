/**
 * Machine à états pour gérer le flux d'un QSO
 */

const procedures = require('./procedures');

class QSOStateMachine {
    constructor() {
        this.reset();
    }
    
    reset() {
        this.state = procedures.QSO_PHASES.IDLE;
        this.qsoType = procedures.QSO_TYPES.CASUAL;
        this.exchangeCount = 0;
        this.userInfo = {
            callsign: null,
            name: null,
            qth: null,
            rst: null
        };
        this.botInfo = {
            callsign: null,
            name: null,
            qth: null,
            rst: null
        };
        this.history = [];
        this.startTime = null;
        this.lastActivity = Date.now();
    }
    
    // Démarrer un nouveau QSO
    startQSO(botProfile, qsoType = 'casual') {
        this.reset();
        this.qsoType = qsoType;
        this.botInfo = { ...botProfile };
        this.botInfo.rst = this.generateRST();
        this.state = procedures.QSO_PHASES.CALLING_CQ;
        this.startTime = Date.now();
        this.log('QSO started', { type: qsoType, bot: botProfile.callsign });
        return this;
    }
    
    // Transition d'état
    transition(newState, data = {}) {
        const oldState = this.state;
        this.state = newState;
        this.lastActivity = Date.now();
        this.log('State transition', { from: oldState, to: newState, data });
        return this;
    }
    
    // Vérifier si le QSO est actif
    isActive() {
        return this.state !== procedures.QSO_PHASES.IDLE && 
               this.state !== procedures.QSO_PHASES.ENDED;
    }
    
    // Vérifier si le QSO est terminé
    isEnded() {
        return this.state === procedures.QSO_PHASES.ENDED;
    }
    
    // Obtenir la durée du QSO
    getDuration() {
        if (!this.startTime) return 0;
        return Date.now() - this.startTime;
    }
    
    // Générer un RST aléatoire réaliste
    generateRST() {
        const options = ['599', '599', '599', '589', '579', '569', '559'];
        return options[Math.floor(Math.random() * options.length)];
    }
    
    // Stocker les infos utilisateur extraites
    setUserInfo(info) {
        if (info.callsign) this.userInfo.callsign = info.callsign.toUpperCase();
        if (info.name) this.userInfo.name = info.name.toUpperCase();
        if (info.qth) this.userInfo.qth = info.qth.toUpperCase();
        if (info.rst) this.userInfo.rst = info.rst;
        this.log('User info updated', this.userInfo);
    }
    
    // Logger les événements
    log(event, data = {}) {
        this.history.push({
            timestamp: Date.now(),
            event,
            state: this.state,
            data
        });
    }
    
    // Obtenir l'état actuel
    getState() {
        return {
            state: this.state,
            qsoType: this.qsoType,
            exchangeCount: this.exchangeCount,
            userInfo: this.userInfo,
            botInfo: this.botInfo,
            duration: this.getDuration(),
            isActive: this.isActive()
        };
    }
    
    // Incrémenter le compteur d'échanges
    incrementExchange() {
        this.exchangeCount++;
        return this.exchangeCount;
    }
    
    // Déterminer la prochaine phase logique
    getNextPhase() {
        const phases = procedures.QSO_PHASES;
        
        switch (this.state) {
            case phases.IDLE:
                return phases.CALLING_CQ;
                
            case phases.CALLING_CQ:
                return phases.WAITING_ANSWER;
                
            case phases.WAITING_ANSWER:
                return phases.RECEIVED_CALL;
                
            case phases.RECEIVED_CALL:
                return phases.SENDING_REPORT;
                
            case phases.SENDING_REPORT:
                return phases.RECEIVING_REPORT;
                
            case phases.RECEIVING_REPORT:
                if (this.qsoType === 'contest' || this.qsoType === 'dx') {
                    return phases.CLOSING;
                }
                return phases.EXCHANGING_INFO;
                
            case phases.EXCHANGING_INFO:
                if (this.exchangeCount >= 2) {
                    return phases.CLOSING;
                }
                return phases.EXCHANGING_INFO;
                
            case phases.CLOSING:
                return phases.ENDED;
                
            default:
                return phases.IDLE;
        }
    }
}

module.exports = QSOStateMachine;
