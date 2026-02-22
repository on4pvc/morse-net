/**
 * Réponses contextuelles du bot CW
 * Organisées par contexte et situation
 */

const responses = {
    
    // ========== PROFILS DE BOTS ==========
    
    BOT_PROFILES: [
        {
            callsign: 'F4BOT',
            name: 'JEAN',
            qth: 'PARIS',
            country: 'FRANCE',
            rig: 'ICOM IC-7300',
            power: 100,
            antenna: 'DIPOLE',
            style: 'friendly'
        },
        {
            callsign: 'DL2CW',
            name: 'HANS',
            qth: 'MUNICH',
            country: 'GERMANY',
            rig: 'YAESU FT-991A',
            power: 50,
            antenna: 'VERTICAL',
            style: 'formal'
        },
        {
            callsign: 'G3TEST',
            name: 'JOHN',
            qth: 'LONDON',
            country: 'ENGLAND',
            rig: 'ELECRAFT K3',
            power: 100,
            antenna: 'BEAM',
            style: 'casual'
        },
        {
            callsign: 'EA5HAM',
            name: 'CARLOS',
            qth: 'VALENCIA',
            country: 'SPAIN',
            rig: 'KENWOOD TS-590',
            power: 75,
            antenna: 'VERTICAL GP',
            style: 'friendly'
        },
        {
            callsign: 'I2CW',
            name: 'MARCO',
            qth: 'MILANO',
            country: 'ITALY',
            rig: 'FLEX 6600',
            power: 100,
            antenna: 'HEXBEAM',
            style: 'enthusiastic'
        },
        {
            callsign: 'ON4NET',
            name: 'PAUL',
            qth: 'BRUSSELS',
            country: 'BELGIUM',
            rig: 'ICOM IC-7610',
            power: 100,
            antenna: 'COBWEB',
            style: 'casual'
        },
        {
            callsign: 'PA3CW',
            name: 'WILLEM',
            qth: 'AMSTERDAM',
            country: 'NETHERLANDS',
            rig: 'YAESU FTDX10',
            power: 80,
            antenna: 'LOOP',
            style: 'friendly'
        },
        {
            callsign: 'SM5ORM',
            name: 'ERIK',
            qth: 'STOCKHOLM',
            country: 'SWEDEN',
            rig: 'KENWOOD TS-890',
            power: 100,
            antenna: 'YAGI 3EL',
            style: 'formal'
        }
    ],
    
    // ========== MÉTÉO SIMULÉE ==========
    
    WEATHER: [
        { wx: 'SUNNY', temp: 22 },
        { wx: 'CLOUDY', temp: 18 },
        { wx: 'RAINY', temp: 14 },
        { wx: 'WINDY', temp: 16 },
        { wx: 'CLEAR', temp: 20 },
        { wx: 'OVERCAST', temp: 15 },
        { wx: 'COLD', temp: 5 },
        { wx: 'WARM', temp: 25 }
    ],
    
    // ========== RST GÉNÉRÉS ==========
    
    RST_OPTIONS: [
        '599', '599', '599',  // Plus fréquent
        '589', '579', '569',
        '559', '549',
        '5NN'  // Abréviation contest
    ],
    
    // ========== RÉPONSES SELON LE STYLE ==========
    
    STYLE_RESPONSES: {
        friendly: {
            greeting: ['GM OM', 'GA DEAR OM', 'GE MY FRIEND', 'HI HI'],
            thanks: ['TNX VY MUCH', 'MANY TNX', 'TU TU'],
            closing: ['HPE CUAGN SN', 'VY 73 ES GL', 'BCNU 73 73']
        },
        formal: {
            greeting: ['GM', 'GA', 'GE'],
            thanks: ['TNX', 'TU', 'TNX FER QSO'],
            closing: ['73', '73 SK', 'GB']
        },
        casual: {
            greeting: ['HI OM', 'HLO', 'GD DAY'],
            thanks: ['TNX FER CALL', 'TU OM', 'TNX'],
            closing: ['73 CUL', 'GL 73', '73 GB']
        },
        enthusiastic: {
            greeting: ['GM GM GM', 'HI HI OM', 'GA VY NICE'],
            thanks: ['WOW TNX', 'FB FB TNX', 'TU TU TU'],
            closing: ['VY 73 HPE CUAGN', 'FB QSO 73 73', 'GL DX 73']
        }
    },
    
    // ========== PHRASES DE CONVERSATION ==========
    
    CONVERSATION: {
        // Questions que le bot peut poser
        questions: [
            'HW IS WX IN UR QTH?',
            'WOT RIG U RUNNING?',
            'HW LNG U BEEN HAM?',
            'WOT ANT U USING?',
            'HW CONDX UR END?',
            'FIRST QSO TODAY?'
        ],
        
        // Commentaires généraux
        comments: [
            'CONDX FB TODAY',
            'NICE SIG HR',
            'UR SIG SOLID HR',
            'FB FIST OM',
            'NICE CW OM',
            'VY FB COPY'
        ],
        
        // Réponses aux questions sur la météo
        weather_responses: [
            'WX HR {wx} TEMP {temp}C',
            'WX IS {wx} ES {temp} DEGREES',
            '{wx} SKY TEMP ABT {temp}C'
        ],
        
        // Réponses aux questions sur l'équipement
        rig_responses: [
            'RIG HR IS {rig} {power}W',
            'RUNNING {rig} INTO {antenna}',
            '{rig} ES {antenna} ANT'
        ]
    },
    
    // ========== GESTION DES ERREURS ==========
    
    ERROR_HANDLING: {
        not_understood: [
            'SRI QRM PSE AGN',
            'QRN HR PSE RPT',
            'SRI MISSED UR MSG AGN PSE',
            'QSB HR PSE RPT'
        ],
        
        ask_slower: [
            'PSE QRS',
            'QRS PSE OM',
            'SRI PSE SLOWER'
        ],
        
        confirm_callsign: [
            'UR CALL AGN PSE?',
            'QRZ?',
            'CALL?'
        ]
    },
    
    // ========== MESSAGES SPÉCIAUX ==========
    
    SPECIAL: {
        // Premier contact
        first_contact: [
            'FB TO MEET U {name}',
            'NICE TO MEET U OM',
            'GLD TO WORK U'
        ],
        
        // Si déjà travaillé
        worked_before: [
            'FB TO WORK U AGN',
            'NICE QSO AGN OM',
            'GD TO HR U AGN'
        ],
        
        // Encouragement pour débutants
        encouragement: [
            'FB CW OM KEEP PRACTICING',
            'VY GD FIST',
            'UR CW IS FB'
        ]
    }
};

module.exports = responses;
