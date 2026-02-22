/**
 * Procédures d'appel CW standard
 * Personnalisez ces procédures selon vos besoins
 */

const procedures = {
    
    // ========== TYPES DE QSO ==========
    
    QSO_TYPES: {
        CASUAL: 'casual',       // QSO décontracté
        CONTEST: 'contest',     // QSO de contest (rapide)
        DX: 'dx',               // QSO DX (échange minimal)
        RAGCHEW: 'ragchew',     // QSO long et amical
        TRAINING: 'training'    // Mode entraînement (pédagogique)
    },
    
    // ========== PHASES D'UN QSO ==========
    
    QSO_PHASES: {
        IDLE: 'idle',                    // En attente
        CALLING_CQ: 'calling_cq',        // Appel CQ
        WAITING_ANSWER: 'waiting_answer', // Attente de réponse
        RECEIVED_CALL: 'received_call',  // Appel reçu
        SENDING_REPORT: 'sending_report', // Envoi du rapport
        RECEIVING_REPORT: 'receiving_report', // Réception du rapport
        EXCHANGING_INFO: 'exchanging_info', // Échange d'infos
        CLOSING: 'closing',              // Fermeture du QSO
        ENDED: 'ended'                   // QSO terminé
    },
    
    // ========== APPELS CQ ==========
    
    CQ_CALLS: {
        standard: [
            'CQ CQ CQ DE {mycall} {mycall} {mycall} K',
            'CQ CQ DE {mycall} {mycall} K',
            'CQ CQ CQ DE {mycall} K'
        ],
        contest: [
            'CQ TEST DE {mycall} {mycall}',
            'CQ CONTEST DE {mycall}',
            '{mycall} TEST'
        ],
        dx: [
            'CQ DX DE {mycall} {mycall} K',
            'CQ DX DX DE {mycall} K'
        ]
    },
    
    // ========== RÉPONSES À UN APPEL ==========
    
    ANSWER_TEMPLATES: {
        // Quand le bot répond à l'utilisateur qui appelle CQ
        toUserCQ: [
            '{usercall} DE {mycall} {mycall} K',
            '{usercall} {usercall} DE {mycall} K',
            '{usercall} DE {mycall} {mycall} {mycall} K'
        ],
        
        // Quand l'utilisateur répond au CQ du bot
        ackUserAnswer: [
            '{usercall} DE {mycall} GM/GA/GE TNX FER CALL',
            '{usercall} DE {mycall} GD TO MEET U',
            '{usercall} TNX FER COMING BACK'
        ]
    },
    
    // ========== ÉCHANGE DE RAPPORTS ==========
    
    SIGNAL_REPORTS: {
        first_report: [
            'UR RST {rst} {rst} NAME {name} {name} QTH {qth} HW CPY? {usercall} DE {mycall} K',
            'RST {rst} {rst} NAME IS {name} QTH {qth} {qth} HW? K',
            'UR {rst} {rst} NAME {name} QTH NR {qth} K'
        ],
        
        contest_report: [
            'UR 5NN {serial}',
            '5NN {serial} {serial}',
            'TU 599 {serial}'
        ],
        
        dx_report: [
            'UR 599 599 TU',
            '599 TU 73',
            'R 599 GL'
        ]
    },
    
    // ========== CONFIRMATIONS ==========
    
    CONFIRMATIONS: {
        roger: [
            'R R R',
            'RR',
            'ROGER',
            'R OK',
            'R R FB'
        ],
        
        repeat: [
            'PSE AGN?',
            'AGN PSE',
            'RPT NAME?',
            'QRZ?',
            'UR NAME AGN PSE'
        ],
        
        understood: [
            'FB FB',
            'OK OK',
            'VY FB',
            'SOLID CPY',
            'FB COPY'
        ]
    },
    
    // ========== ÉCHANGE D'INFORMATIONS ==========
    
    INFO_EXCHANGE: {
        rig: [
            'RIG HR IS {rig}',
            'RUNNING {rig} {power}W',
            'PWR {power}W INTO {antenna}'
        ],
        
        wx: [
            'WX HR IS {wx}',
            'TEMP {temp}C {wx}',
            'WX {wx} TEMP {temp}'
        ],
        
        qth_info: [
            'QTH IS {qth} {country}',
            'LOCATED IN {qth}',
            'MY QTH {qth} NEAR {city}'
        ],
        
        antenna: [
            'ANT IS {antenna}',
            'USING {antenna} AT {height}M',
            'ANT {antenna}'
        ]
    },
    
    // ========== CLÔTURE DU QSO ==========
    
    CLOSING: {
        thanks: [
            'TNX FER QSO',
            'TNX FB QSO',
            'TU FER NICE QSO',
            'TNX CALL'
        ],
        
        farewell: [
            '73 73 {usercall} DE {mycall} SK',
            'HPE CUAGN 73 73 GL',
            'VY 73 GB {usercall} DE {mycall} E E',
            '73 ES GB SK E E',
            'TU 73 GL DX {usercall} DE {mycall} SK'
        ],
        
        contest_end: [
            'TU {mycall}',
            'TU 73',
            'GL'
        ]
    },
    
    // ========== ABRÉVIATIONS CW STANDARDS ==========
    
    ABBREVIATIONS: {
        'GM': 'Good Morning',
        'GA': 'Good Afternoon', 
        'GE': 'Good Evening',
        'GN': 'Good Night',
        'OM': 'Old Man (ami)',
        'YL': 'Young Lady',
        'XYL': 'Wife',
        'HW': 'How (Comment)',
        'HR': 'Here (Ici)',
        'UR': 'Your/You are',
        'TU': 'Thank You',
        'TNX': 'Thanks',
        'FB': 'Fine Business (Très bien)',
        'VY': 'Very',
        'ES': 'And (&)',
        'DE': 'From',
        'K': 'Over (à vous)',
        'SK': 'End of contact',
        'AR': 'End of message',
        'BK': 'Break',
        'R': 'Roger (Reçu)',
        'RST': 'Readability-Strength-Tone',
        'QTH': 'Location',
        'QSL': 'Confirmation',
        'QRZ': 'Who is calling?',
        'QRM': 'Interference',
        'QRN': 'Static noise',
        'QSB': 'Fading',
        'QRS': 'Send slower',
        'QRQ': 'Send faster',
        'PSE': 'Please',
        'AGN': 'Again',
        'CPY': 'Copy',
        'HPE': 'Hope',
        'CUAGN': 'See you again',
        'CUL': 'See you later',
        'GL': 'Good Luck',
        'DX': 'Long distance',
        'WX': 'Weather',
        'ANT': 'Antenna',
        'RIG': 'Radio equipment',
        'PWR': 'Power'
    },
    
    // ========== MOTS-CLÉS DE DÉTECTION ==========
    
    KEYWORDS: {
        // Détection d'appel CQ
        cq: ['CQ', 'CQ CQ', 'CQ DX', 'CQ TEST', 'CQ CONTEST'],
        
        // Détection de salutation
        greeting: ['GM', 'GA', 'GE', 'GN', 'HELLO', 'HI'],
        
        // Détection de rapport
        report: ['RST', 'UR', '599', '579', '559', '5NN'],
        
        // Détection de nom
        name: ['NAME', 'NAME IS', 'NAME HR', 'OP', 'OP IS'],
        
        // Détection de QTH
        qth: ['QTH', 'QTH IS', 'QTH HR', 'LOCATED'],
        
        // Détection de question
        question: ['HW', 'HW?', '?', 'QRL', 'QRZ', 'AGN', 'RPT'],
        
        // Détection de confirmation
        confirm: ['R', 'RR', 'R R', 'OK', 'FB', 'ROGER', 'QSL'],
        
        // Détection de clôture
        closing: ['73', 'TU', 'TNX', 'GB', 'GL', 'SK', 'CUL', 'CUAGN'],
        
        // Détection de demande de répétition
        repeat: ['AGN', 'AGN?', 'PSE AGN', 'RPT', 'QRZ?', '?']
    }
};

module.exports = procedures;
