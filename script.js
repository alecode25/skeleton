const VIDEO   = document.getElementById('video');
const CANVAS  = document.getElementById('canvas');
const CTX     = CANVAS.getContext('2d');

const statusDot     = document.getElementById('status-dot');
const statusText    = document.getElementById('status-text');
const loadingOv     = document.getElementById('loading-overlay');
const angleBadge    = document.getElementById('angle-badge');
const angleVal      = document.getElementById('spine-angle-val');
const viewBadge     = document.getElementById('view-badge');
const warningBanner = document.getElementById('warning-banner');
const warningText   = document.getElementById('warning-text');
const goodBanner    = document.getElementById('good-banner');

const exerciseBadge = document.getElementById('exercise-badge');
const repBadge      = document.getElementById('rep-badge');
const repCountEl    = document.getElementById('rep-count-val');
const badgeLbl      = document.getElementById('badge-lbl');
const voiceBtn      = document.getElementById('voice-btn');

const vfCorners = document.querySelector('.vf-corners');

const vLat    = document.getElementById('v-lat');
const vFwd    = document.getElementById('v-fwd');
const vSpalle = document.getElementById('v-spalle');
const vExtra  = document.getElementById('v-extra');
const vScore  = document.getElementById('v-score');
const mLat    = document.getElementById('m-lat');
const mFwd    = document.getElementById('m-fwd');
const mSpalle = document.getElementById('m-spalle');
const mExtra  = document.getElementById('m-extra');
const mScore  = document.getElementById('m-score');
const lblLat    = document.getElementById('m-lat').querySelector('.m-label');
const lblFwd    = document.getElementById('lbl-fwd');
const lblSpalle = document.getElementById('lbl-spalle');
const lblExtra  = document.getElementById('lbl-extra');

// ══════════════════════════════════════════════════════════════════════════════
//  MOTORE DI ANALISI
//
//  Convenzioni interne (importanti):
//  · I keypoint sono tenuti in PIXEL del frame video, non normalizzati per
//    larghezza/altezza separatamente. Normalizzare x/vW e y/vH deforma lo
//    spazio quando il frame non è quadrato (16:9 ⇒ asse x compresso 0.56×) e
//    falsa OGNI angolo calcolato con atan2/acos.
//  · Le distanze sono espresse in % della lunghezza del tronco (torso), così
//    le metriche non cambiano se l'utente è vicino o lontano dalla camera.
//  · Gli angoli sono in gradi. Positivo = verso +x dello schermo, che
//    corrisponde al lato ANATOMICO SINISTRO (immagine camera non specchiata).
// ══════════════════════════════════════════════════════════════════════════════

const RAD = 180 / Math.PI;

// ── MoveNet keypoint indices (17 punti) ───────────────────────────────────────
const KP = {
    NOSE: 0,
    L_EYE: 1, R_EYE: 2,
    L_EAR: 3, R_EAR: 4,
    L_SHOULDER: 5,  R_SHOULDER: 6,
    L_ELBOW:    7,  R_ELBOW:    8,
    L_WRIST:    9,  R_WRIST:   10,
    L_HIP:     11,  R_HIP:     12,
    L_KNEE:    13,  R_KNEE:    14,
    L_ANKLE:   15,  R_ANKLE:   16,
};

// Soglie di confidenza per uso dei punti
const C_CORE = 0.22;   // spalle / anche: struttura del tronco
const C_LIMB = 0.28;   // ginocchia, caviglie, gomiti, polsi
const C_HEAD = 0.25;   // orecchie / naso

// ── Colori per articolazione ──────────────────────────────────────────────────
const JOINT_COL = [
    '#ff6b6b',  // 0  nose
    '#ff9090',  // 1  l_eye
    '#ff9090',  // 2  r_eye
    '#ffa07a',  // 3  l_ear
    '#ffa07a',  // 4  r_ear
    '#ff9f43',  // 5  l_shoulder  ← key
    '#ff9f43',  // 6  r_shoulder  ← key
    '#4b9eff',  // 7  l_elbow
    '#4b9eff',  // 8  r_elbow
    '#4b9eff',  // 9  l_wrist
    '#4b9eff',  // 10 r_wrist
    '#ff9f43',  // 11 l_hip       ← key
    '#ff9f43',  // 12 r_hip       ← key
    '#69f0ae',  // 13 l_knee      ← key
    '#69f0ae',  // 14 r_knee      ← key
    '#00e5ff',  // 15 l_ankle
    '#00e5ff',  // 16 r_ankle
];

const KEY_JOINTS = new Set([5, 6, 11, 12, 13, 14]);

const CONNECTIONS = [
    // Faccia
    { a:3,  b:1,  col:'rgba(255,107,107,0.50)', w:1.2 },
    { a:1,  b:0,  col:'rgba(255,107,107,0.50)', w:1.2 },
    { a:0,  b:2,  col:'rgba(255,107,107,0.50)', w:1.2 },
    { a:2,  b:4,  col:'rgba(255,107,107,0.50)', w:1.2 },
    // Collo (orecchie → spalle)
    { a:3,  b:5,  col:'rgba(255,159,67,0.55)',  w:1.8 },
    { a:4,  b:6,  col:'rgba(255,159,67,0.55)',  w:1.8 },
    // Barra spalle
    { a:5,  b:6,  col:'rgba(0,229,255,0.85)',   w:2.8 },
    // Braccio sinistro
    { a:5,  b:7,  col:'rgba(75,158,255,0.88)',  w:2.5 },
    { a:7,  b:9,  col:'rgba(75,158,255,0.88)',  w:2.5 },
    // Braccio destro
    { a:6,  b:8,  col:'rgba(75,158,255,0.88)',  w:2.5 },
    { a:8,  b:10, col:'rgba(75,158,255,0.88)',  w:2.5 },
    // Torso
    { a:5,  b:11, col:'rgba(255,159,67,0.88)',  w:2.8 },
    { a:6,  b:12, col:'rgba(255,159,67,0.88)',  w:2.8 },
    // Barra fianchi
    { a:11, b:12, col:'rgba(0,229,255,0.85)',   w:2.8 },
    // Gamba sinistra
    { a:11, b:13, col:'rgba(105,240,174,0.88)', w:2.5 },
    { a:13, b:15, col:'rgba(105,240,174,0.88)', w:2.5 },
    // Gamba destra
    { a:12, b:14, col:'rgba(105,240,174,0.88)', w:2.5 },
    { a:14, b:16, col:'rgba(105,240,174,0.88)', w:2.5 },
];

// ── Config esercizi ───────────────────────────────────────────────────────────
//  Angoli in GRADI (soglia W = warning, B = bad).
//  Deviazioni lineari in % della lunghezza del tronco.
const EXERCISES = {
    inpiedi: {
        name: 'IN PIEDI', needLegs: false, needProfile: false,
        fr: { leanW: 3.5, leanB: 7,  shW: 2.5, shB: 5, hipW: 2.5, hipB: 5, earW: 3, earB: 6 },
        pr: { flexW: 7,   flexB: 14, cvaW: 52, cvaB: 46 },
    },
    seduto: {
        name: 'SEDUTO', needLegs: false, needProfile: true,
        fr: { leanW: 4.5, leanB: 9,  shW: 3,   shB: 6,   hipW: 4, hipB: 8, earW: 4, earB: 7.5 },
        pr: { flexW: 11,  flexB: 20, cvaW: 50, cvaB: 44 },
    },
    squat: {
        name: 'SQUAT', needLegs: true, needProfile: true,
        fr: { leanW: 5,  leanB: 10, shW: 4,  shB: 8,  hipW: 4,  hipB: 9,  earW: 6,   earB: 12,
              valgusW: 0.80, valgusB: 0.65 },
        pr: { flexW: 35, flexB: 55, cvaW: 48, cvaB: 42,
              kneeStraight: 135, shinMin: 8, depthW: 0, depthB: -12,
              rep: { joint: 'knee', down: 125, up: 155, minDepth: 110 } },
    },
    pushup: {
        name: 'PUSH-UP', needLegs: true, needProfile: true,
        fr: { leanW: 5, leanB: 10, shW: 4, shB: 8, hipW: 4, hipB: 9, earW: 8, earB: 15 },
        pr: { horizontal: true, sagW: 7, sagB: 14, wristW: 12, wristB: 22, cvaW: 46, cvaB: 40,
              rep: { joint: 'elbow', down: 130, up: 155, minDepth: 115 } },
    },
};

let activeExercise = 'inpiedi';
let repState = { count: 0, phase: 'up', minAng: 999, lastRepAt: -Infinity };

// ══════════════════════════════════════════════════════════════════════════════
//  Helper geometrici (spazio pixel)
// ══════════════════════════════════════════════════════════════════════════════

const sc   = kp => (kp && kp.score) || 0;
const okp  = (kp, thr) => !!kp && kp.score >= thr;
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const clamp = (v, lo, hi) => v < lo ? lo : v > hi ? hi : v;

// Midpoint pesato sulla confidenza: un punto incerto non trascina più il centro.
// Se un solo lato è affidabile, usa quello (caso profilo).
function midW(a, b, thr = C_CORE) {
    const sa = sc(a), sb = sc(b);
    const ga = sa >= thr, gb = sb >= thr;
    if (ga && gb) {
        const w = sa + sb;
        return { x: (a.x * sa + b.x * sb) / w, y: (a.y * sa + b.y * sb) / w, score: (sa + sb) / 2 };
    }
    if (ga) return { x: a.x, y: a.y, score: sa * 0.85 };
    if (gb) return { x: b.x, y: b.y, score: sb * 0.85 };
    return null;
}

// Angolo del vettore from→to rispetto alla verticale schermo.
// from = punto basso (anche), to = punto alto (spalle). Positivo = verso +x.
function tiltFromVertical(from, to) {
    return Math.atan2(to.x - from.x, from.y - to.y) * RAD;
}

// Inclinazione di un segmento rispetto all'orizzonte, 0..90 (magnitudine).
function tiltFromHorizontal(a, b) {
    return Math.atan2(Math.abs(b.y - a.y), Math.abs(b.x - a.x)) * RAD;
}

// Angolo interno A-B-C in gradi (B = vertice).
function angle3(A, B, C) {
    const bax = A.x - B.x, bay = A.y - B.y;
    const bcx = C.x - B.x, bcy = C.y - B.y;
    const mag = Math.hypot(bax, bay) * Math.hypot(bcx, bcy);
    if (mag < 1e-6) return null;
    return Math.acos(clamp((bax * bcx + bay * bcy) / mag, -1, 1)) * RAD;
}

// Distanza perpendicolare firmata di P dalla retta A→B (px).
// Segno: positivo se P sta a sinistra del verso A→B nello spazio canvas.
function perpDev(P, A, B) {
    const dx = B.x - A.x, dy = B.y - A.y;
    const len = Math.hypot(dx, dy);
    if (len < 1e-6) return null;
    return ((P.x - A.x) * dy - (P.y - A.y) * dx) / len;
}

// ══════════════════════════════════════════════════════════════════════════════
//  Filtro One-Euro — smoothing adattivo alla velocità
//
//  L'EMA a coefficiente fisso usata prima era un compromesso perdente:
//  abbastanza forte da ritardare i movimenti rapidi, non abbastanza da togliere
//  il jitter a corpo fermo, e dipendente dal frame rate. One-Euro alza la
//  frequenza di taglio quando il punto si muove ⇒ fermo = stabile, in
//  movimento = reattivo. dt reale ⇒ comportamento identico a 30 e 60 fps.
// ══════════════════════════════════════════════════════════════════════════════

const FC_MIN  = 1.5;   // Hz: taglio a corpo fermo (più basso = più stabile)
const FC_BETA = 5.0;   // Hz per (tronco/s): quanto si apre con la velocità
const D_CUT   = 1.0;   // Hz: taglio sulla derivata

function euroAlpha(fc, dt) {
    const tau = 1 / (2 * Math.PI * fc);
    return 1 / (1 + tau / dt);
}

class OneEuro {
    constructor() { this.x = null; this.dx = 0; }
    reset() { this.x = null; this.dx = 0; }
    filter(x, dt, scaleRef) {
        if (this.x === null || !isFinite(this.x)) { this.x = x; this.dx = 0; return x; }
        const dxRaw = (x - this.x) / dt;
        const ad    = euroAlpha(D_CUT, dt);
        this.dx     = ad * dxRaw + (1 - ad) * this.dx;
        const speed = Math.abs(this.dx) / Math.max(scaleRef, 1);   // tronchi al secondo
        const a     = euroAlpha(FC_MIN + FC_BETA * speed, dt);
        this.x      = a * x + (1 - a) * this.x;
        return this.x;
    }
}

// Stato del tracker temporale
const FX = Array.from({ length: 17 }, () => ({ x: new OneEuro(), y: new OneEuro() }));
let   tracked      = null;     // keypoint filtrati (pixel)
let   rejectRun    = new Int16Array(17);
let   lastFrameAt  = 0;
let   missingFrames = 0;
const MAX_MISSING  = 10;
const SCORE_ALPHA  = 0.45;     // smoothing della confidenza (per-frame)
const MAX_JUMP     = 0.55;     // salto massimo plausibile: 0.55 tronchi / 100 ms
const MAX_REJECT   = 4;        // dopo N reject consecutivi accetta (recupero teleport)

let scaleRef = 0;              // lunghezza tronco in px, smussata

function torsoLenOf(kps) {
    const sh = midW(kps[KP.L_SHOULDER], kps[KP.R_SHOULDER], 0.15);
    const hp = midW(kps[KP.L_HIP],      kps[KP.R_HIP],      0.15);
    if (sh && hp) {
        const d = dist(sh, hp);
        if (d > 4) return d;
    }
    // Fallback: larghezza spalle (≈ tronco) o larghezza anche
    const ls = kps[KP.L_SHOULDER], rs = kps[KP.R_SHOULDER];
    if (okp(ls, 0.15) && okp(rs, 0.15)) {
        const w = dist(ls, rs);
        if (w > 4) return w * 1.15;
    }
    return 0;
}

function trackKeypoints(raw, now) {
    const dt = lastFrameAt ? clamp((now - lastFrameAt) / 1000, 1 / 120, 0.2) : 1 / 30;
    lastFrameAt = now;

    const rawTorso = torsoLenOf(raw);
    if (rawTorso > 0) scaleRef = scaleRef ? 0.85 * scaleRef + 0.15 * rawTorso : rawTorso;
    const ref = Math.max(scaleRef, 1);

    if (!tracked) {
        tracked = raw.map(kp => ({ x: kp.x, y: kp.y, score: kp.score }));
        FX.forEach(f => { f.x.reset(); f.y.reset(); });
        rejectRun.fill(0);
        for (let i = 0; i < 17; i++) {
            FX[i].x.filter(raw[i].x, dt, ref);
            FX[i].y.filter(raw[i].y, dt, ref);
        }
        return tracked;
    }

    const jumpLimit = MAX_JUMP * ref * (dt / 0.1);

    for (let i = 0; i < 17; i++) {
        const r = raw[i], t = tracked[i];
        t.score = SCORE_ALPHA * r.score + (1 - SCORE_ALPHA) * t.score;

        if (r.score < 0.12) { rejectRun[i] = 0; continue; }   // troppo incerto: tieni l'ultima posizione

        // Reject di salti implausibili (limb-swap / flicker tipico di MoveNet):
        // scarta solo se la nuova stima non è anche più sicura della precedente.
        const jump = Math.hypot(r.x - t.x, r.y - t.y);
        if (jump > jumpLimit && r.score < t.score + 0.15 && rejectRun[i] < MAX_REJECT) {
            rejectRun[i]++;
            continue;
        }
        if (rejectRun[i] >= MAX_REJECT) {        // recupero: riaggancia senza inerzia
            FX[i].x.reset(); FX[i].y.reset();
        }
        rejectRun[i] = 0;
        t.x = FX[i].x.filter(r.x, dt, ref);
        t.y = FX[i].y.filter(r.y, dt, ref);
    }
    return tracked;
}

// ── Validazione persona ───────────────────────────────────────────────────────
//  Usa la DISTANZA spalle-anche, non la differenza di sola Y: con il corpo
//  orizzontale (push-up / plank) la Y è quasi identica e il vecchio controllo
//  scartava la persona come non valida.
function isValidPerson(kps, frameH) {
    if (!kps || kps.length < 17) return false;
    if (kps.filter(kp => kp.score > 0.25).length < 5) return false;
    const sh = midW(kps[KP.L_SHOULDER], kps[KP.R_SHOULDER], 0.18);
    const hp = midW(kps[KP.L_HIP],      kps[KP.R_HIP],      0.18);
    if (!sh || !hp) return false;
    return dist(sh, hp) > frameH * 0.07;
}

// ══════════════════════════════════════════════════════════════════════════════
//  Voce
// ══════════════════════════════════════════════════════════════════════════════
const synth       = window.speechSynthesis;
let voiceEnabled  = true;
let lastSpokenTxt = '';
let lastSpokenAt  = 0;
let lastStatus    = 'unknown';
let lastRepCount  = 0;

function speak(text, force = false) {
    if (!voiceEnabled || !synth) return;
    const now = Date.now();
    if (!force && text === lastSpokenTxt && now - lastSpokenAt < 7000) return;
    if (!force && now - lastSpokenAt < 3500) return;
    synth.cancel();
    const utt    = new SpeechSynthesisUtterance(text);
    utt.lang     = 'it-IT';
    utt.rate     = 0.92;
    utt.volume   = 1;
    const voices = synth.getVoices();
    const itVoice = voices.find(v => v.lang.startsWith('it'));
    if (itVoice) utt.voice = itVoice;
    synth.speak(utt);
    lastSpokenTxt = text;
    lastSpokenAt  = now;
}

voiceBtn.addEventListener('click', () => {
    voiceEnabled = !voiceEnabled;
    voiceBtn.textContent = voiceEnabled ? '🔊' : '🔇';
    voiceBtn.classList.toggle('muted', !voiceEnabled);
    if (!voiceEnabled) synth.cancel();
});

// ══════════════════════════════════════════════════════════════════════════════
//  Vista (frontale / profilo) e direzione dello sguardo
//
//  Il rapporto larghezza-spalle / lunghezza-tronco è invariante alla distanza:
//  frontale ≈ 0.8–1.1, profilo ≈ 0–0.3. La soglia assoluta usata prima
//  classificava come "profilo" qualsiasi persona lontana.
// ══════════════════════════════════════════════════════════════════════════════
const VIEW_PROFILE_MAX = 0.45;   // sotto → profilo
const VIEW_FRONTAL_MIN = 0.62;   // sopra → frontale
const VIEW_HOLD        = 8;      // frame concordi richiesti per cambiare

let _view        = 'frontal';
let _viewCand    = 'frontal';
let _viewCandRun = 0;
let _facing      = 1;            // +1 = rivolto verso +x schermo
let _facingRun   = 0;

function detectView(lm) {
    const ls = lm[KP.L_SHOULDER], rs = lm[KP.R_SHOULDER];
    const sh = midW(ls, rs), hp = midW(lm[KP.L_HIP], lm[KP.R_HIP]);
    if (!sh || !hp || !ls || !rs) return _view;

    const torso = Math.max(dist(sh, hp), 1);
    const span  = Math.abs(ls.x - rs.x) / torso;
    const vdiff = Math.abs(sc(ls) - sc(rs));

    let detected = _view;
    if (span < VIEW_PROFILE_MAX || vdiff > 0.35) detected = 'profile';
    else if (span > VIEW_FRONTAL_MIN)            detected = 'frontal';

    if (detected === _view) { _viewCandRun = 0; _viewCand = _view; return _view; }
    if (detected !== _viewCand) { _viewCand = detected; _viewCandRun = 1; }
    else if (++_viewCandRun >= VIEW_HOLD) { _view = detected; _viewCandRun = 0; }
    return _view;
}

// Lato del corpo più vicino alla camera (somma confidenze spalla+anca+ginocchio)
function nearSide(lm) {
    const L = sc(lm[KP.L_SHOULDER]) + sc(lm[KP.L_HIP]) + sc(lm[KP.L_KNEE]);
    const R = sc(lm[KP.R_SHOULDER]) + sc(lm[KP.R_HIP]) + sc(lm[KP.R_KNEE]);
    return L >= R ? 'L' : 'R';
}

// Direzione in cui l'utente è rivolto, dedotta dal naso rispetto al centro
// spalle (il naso è anteriore). Non si deduce più dalla sola etichetta
// profilo-destro/sinistro, che era una congettura.
function detectFacing(lm, sh) {
    const nose = lm[KP.NOSE];
    if (!sh) return _facing;
    let sign = 0;
    if (okp(nose, C_HEAD)) sign = Math.sign(nose.x - sh.x);
    if (!sign) {
        const le = lm[KP.L_EAR], re = lm[KP.R_EAR];
        const ear = sc(le) >= sc(re) ? le : re;
        if (okp(ear, C_HEAD)) sign = Math.sign(ear.x - sh.x);
    }
    if (!sign) return _facing;
    if (sign === _facing) { _facingRun = 0; return _facing; }
    if (++_facingRun >= 5) { _facing = sign; _facingRun = 0; }
    return _facing;
}

// ══════════════════════════════════════════════════════════════════════════════
//  Smoothing metriche + classificazione con isteresi
// ══════════════════════════════════════════════════════════════════════════════
const METRIC_TAU   = 0.12;   // s — costante di tempo (indipendente dagli fps)
const STATUS_WINDOW = 12;
const GRADE_HYST   = 0.12;   // ±12% attorno alla soglia prima di cambiare stato

const _sm     = {};
const _grades = {};
let   _statusHist = [];
let   _dt = 1 / 30;

function smv(key, val) {
    if (val === null || val === undefined || !isFinite(val)) return null;
    const a = 1 - Math.exp(-_dt / METRIC_TAU);
    _sm[key] = (key in _sm) ? _sm[key] + a * (val - _sm[key]) : val;
    return _sm[key];
}

// Margine di isteresi ASSOLUTO, ricavato dalla distanza fra le due soglie.
// Un margine percentuale non funziona su metriche vicine a 180° (un angolo di
// allineamento "buono ≥ 168°" non potrebbe mai superare 168 × 1.12).
const hystMargin = (w, b) => Math.max(0.3, Math.abs(b - w) * GRADE_HYST * 1.8);

// Valori bassi = buoni
function gradeLow(key, v, w, b) {
    const prev = _grades[key] || 'good';
    const m = hystMargin(w, b);
    let g;
    if (v >= b + m) g = 'bad';
    else if (v <= w - m) g = 'good';
    else if (prev === 'bad'  && v > b - m) g = 'bad';
    else if (prev === 'good' && v < w + m) g = 'good';
    else g = 'warning';
    _grades[key] = g;
    return g;
}

// Valori alti = buoni (CVA, allineamento colonna, rapporto ginocchia/caviglie)
function gradeHigh(key, v, w, b) {
    const prev = _grades[key] || 'good';
    const m = hystMargin(w, b);
    let g;
    if (v <= b - m) g = 'bad';
    else if (v >= w + m) g = 'good';
    else if (prev === 'bad'  && v < b + m) g = 'bad';
    else if (prev === 'good' && v > w - m) g = 'good';
    else g = 'warning';
    _grades[key] = g;
    return g;
}

function stableStatus(raw) {
    _statusHist.push(raw);
    if (_statusHist.length > STATUS_WINDOW) _statusHist.shift();
    const n    = _statusHist.length;
    const bad  = _statusHist.filter(s => s === 'bad').length;
    const good = _statusHist.filter(s => s === 'good').length;
    if (bad  / n >= 0.50) return 'bad';
    if (good / n >= 0.60) return 'good';
    return 'warning';
}

function resetSmoothState() {
    for (const k in _sm) delete _sm[k];
    for (const k in _grades) delete _grades[k];
    _statusHist  = [];
    tracked      = null;
    scaleRef     = 0;
    lastFrameAt  = 0;
    missingFrames = 0;
    _view = 'frontal'; _viewCand = 'frontal'; _viewCandRun = 0;
    _facing = 1; _facingRun = 0;
    FX.forEach(f => { f.x.reset(); f.y.reset(); });
    rejectRun.fill(0);
}

// ══════════════════════════════════════════════════════════════════════════════
//  Modello della colonna
//
//  MoveNet non ha keypoint vertebrali: il "mezza-colonna" disegnato prima era
//  il punto medio spalle-anche, quindi per costruzione sempre allineato — zero
//  informazione.
//
//  Qui la curvatura è una quantità MISURATA: lo scostamento di C7 dalla corda
//  bacino→testa. Due output:
//   · alignAngle = angolo bacino-C7-testa (180° = colonna in asse). Scende
//     quando la catena si incurva (slouch, dorso chiuso, testa avanti).
//   · bendVec    = vettore di scostamento in px, usato per disegnare la
//     colonna come curva reale invece che come bastone rigido.
// ══════════════════════════════════════════════════════════════════════════════
function buildSpine(lm, view) {
    const sh = midW(lm[KP.L_SHOULDER], lm[KP.R_SHOULDER]);
    const hp = midW(lm[KP.L_HIP],      lm[KP.R_HIP]);
    if (!sh || !hp) return null;

    const torso = Math.max(dist(sh, hp), 1);

    // Asse del tronco (unitario, dal bacino verso le spalle)
    const ax = (sh.x - hp.x) / torso, ay = (sh.y - hp.y) / torso;

    // C7: anatomicamente sopra la linea delle articolazioni delle spalle
    const c7 = { x: sh.x + ax * torso * 0.07, y: sh.y + ay * torso * 0.07, score: sh.score };

    // Riferimento testa: orecchio vicino in profilo, media orecchie in frontale
    let head = null;
    if (view === 'profile') {
        const near = nearSide(lm) === 'L' ? lm[KP.L_EAR] : lm[KP.R_EAR];
        const far  = nearSide(lm) === 'L' ? lm[KP.R_EAR] : lm[KP.L_EAR];
        head = okp(near, C_HEAD) ? near : (okp(far, C_HEAD) ? far : null);
    } else {
        head = midW(lm[KP.L_EAR], lm[KP.R_EAR], C_HEAD);
    }
    if (!head && okp(lm[KP.NOSE], C_HEAD)) head = lm[KP.NOSE];

    // Scostamento di C7 dalla corda bacino→testa, come VETTORE (px): niente
    // ambiguità di segno, ed è direttamente il vettore di curvatura da disegnare.
    let bendVec = { x: 0, y: 0 };
    let bendPct = null, alignAngle = null;
    if (head) {
        const L = dist(hp, head);
        if (L > 1) {
            const ux = (head.x - hp.x) / L, uy = (head.y - hp.y) / L;
            const vx = c7.x - hp.x,         vy = c7.y - hp.y;
            const t  = vx * ux + vy * uy;
            bendVec  = { x: vx - t * ux, y: vy - t * uy };
            bendPct  = (Math.hypot(bendVec.x, bendVec.y) / torso) * 100;
            alignAngle = angle3(hp, c7, head);   // 180° = bacino-dorso-testa in asse
        }
    }

    return { sh, hp, c7, head, torso, ax, ay, bendVec, bendPct, alignAngle };
}

// ══════════════════════════════════════════════════════════════════════════════
//  Analisi postura
// ══════════════════════════════════════════════════════════════════════════════
const dirName = v => (v > 0 ? 'sinistra' : 'destra');   // +x schermo = lato anatomico sinistro

function analyzePosture(lm, view, frameH) {
    const res = {
        visible: false, view, facing: _facing,
        trunkLean: null, trunkFlex: null,
        shTilt: null, hipTilt: null, earTilt: null,
        cva: null, headOffset: null, align: null, alignDev: null,
        kneeAngle: null, kneeAngleRaw: null, kneeRatio: null, shinLean: null, hipDepth: null,
        elbowAngle: null, elbowAngleRaw: null, bodySag: null, wristDev: null,
        spine: null, bodyLine: null, phase: repState.phase,
        score: 0, warnings: [], status: 'unknown', framing: null,
    };
    if (!lm || !lm.length) return res;

    const isProfile = view === 'profile';
    const side  = nearSide(lm);
    const sh    = midW(lm[KP.L_SHOULDER], lm[KP.R_SHOULDER]);
    const hp    = midW(lm[KP.L_HIP],      lm[KP.R_HIP]);
    const facing = detectFacing(lm, sh);
    res.facing = facing;

    if (!sh || !hp) return res;

    const spine = buildSpine(lm, view);
    if (!spine) return res;
    res.spine = spine;

    // Confidenza di rilevamento sui punti effettivamente usati
    const ex = EXERCISES[activeExercise];
    const need = [KP.L_SHOULDER, KP.R_SHOULDER, KP.L_HIP, KP.R_HIP];
    if (ex.needLegs) need.push(KP.L_KNEE, KP.R_KNEE, KP.L_ANKLE, KP.R_ANKLE);
    const confAvg = need.reduce((s, i) => s + sc(lm[i]), 0) / need.length;
    res.score = Math.round(clamp(smv('conf', confAvg * 100) ?? 0, 0, 100));

    if (Math.min(sh.score, hp.score) < 0.18) return res;
    res.visible = true;

    const torso = spine.torso;
    const warn  = [];
    const push  = (msg, sev) => warn.push({ msg, sev });

    // ── Inquadratura ──────────────────────────────────────────────────────────
    if (torso / frameH < 0.13) {
        res.framing = 'Avvicinati alla camera — corpo troppo piccolo';
        push(res.framing, 1);
    } else if (ex.needLegs && ![KP.L_KNEE, KP.R_KNEE, KP.L_ANKLE, KP.R_ANKLE].some(i => okp(lm[i], C_LIMB))) {
        res.framing = 'Inquadra le gambe nel campo visivo';
        push(res.framing, 1);
    }

    if (!isProfile) {
        // ══ FRONTALE ══════════════════════════════════════════════════════════
        const fr = ex.fr;

        // Inclinazione laterale del tronco (angolo reale, spazio pixel)
        res.trunkLean = smv('trunkLean', tiltFromVertical(spine.hp, spine.c7));
        const leanAbs = Math.abs(res.trunkLean);
        const gLean = gradeLow('lean', leanAbs, fr.leanW, fr.leanB);
        if (gLean !== 'good') {
            push(`Schiena inclinata ${Math.round(leanAbs)}° verso ${dirName(res.trunkLean)}`,
                 gLean === 'bad' ? 2 : 1);
        }

        // Obliquità spalle e anche come ANGOLI (invarianti alla distanza)
        const ls = lm[KP.L_SHOULDER], rs = lm[KP.R_SHOULDER];
        const lh = lm[KP.L_HIP],      rh = lm[KP.R_HIP];
        if (okp(ls, C_CORE) && okp(rs, C_CORE)) {
            res.shTilt = smv('shTilt', tiltFromHorizontal(ls, rs));
            const g = gradeLow('shTilt', res.shTilt, fr.shW, fr.shB);
            if (g !== 'good') {
                push(`Spalla ${rs.y > ls.y ? 'destra' : 'sinistra'} più bassa — equilibra le spalle`,
                     g === 'bad' ? 2 : 1);
            }
        }
        if (okp(lh, C_CORE) && okp(rh, C_CORE)) {
            res.hipTilt = smv('hipTilt', tiltFromHorizontal(lh, rh));
            const g = gradeLow('hipTilt', res.hipTilt, fr.hipW, fr.hipB);
            if (g !== 'good') {
                push(`Anca ${rh.y > lh.y ? 'destra' : 'sinistra'} più bassa — controlla l'allineamento`,
                     g === 'bad' ? 2 : 1);
            }
        }

        // Inclinazione della testa (linea orecchie)
        const le = lm[KP.L_EAR], re = lm[KP.R_EAR];
        if (okp(le, C_HEAD) && okp(re, C_HEAD)) {
            res.earTilt = smv('earTilt', tiltFromHorizontal(le, re));
            const g = gradeLow('earTilt', res.earTilt, fr.earW, fr.earB);
            if (g === 'bad')      push(`Testa inclinata — orecchio ${re.y > le.y ? 'destro' : 'sinistro'} più basso`, 2);
            else if (g === 'warning') push('Testa leggermente inclinata — centra la testa', 1);
        }

        // Valgo del ginocchio (squat): rapporto larghezza ginocchia / caviglie
        if (activeExercise === 'squat') {
            const lk = lm[KP.L_KNEE], rk = lm[KP.R_KNEE];
            const la = lm[KP.L_ANKLE], ra = lm[KP.R_ANKLE];
            if (okp(lk, C_LIMB) && okp(rk, C_LIMB) && okp(la, C_LIMB) && okp(ra, C_LIMB)) {
                const ankleD = Math.abs(la.x - ra.x);
                if (ankleD > torso * 0.08) {
                    res.kneeRatio = smv('kneeRatio', Math.abs(lk.x - rk.x) / ankleD);
                    const g = gradeHigh('kneeRatio', res.kneeRatio, fr.valgusW, fr.valgusB);
                    if (g === 'bad')      push("Ginocchia cedono verso l'interno — spingi verso l'esterno", 2);
                    else if (g === 'warning') push('Allinea le ginocchia con le punte dei piedi', 1);
                }
            }
        }

    } else {
        // ══ PROFILO ═══════════════════════════════════════════════════════════
        const pr = ex.pr;
        const nearEar   = side === 'L' ? lm[KP.L_EAR]   : lm[KP.R_EAR];
        const nearKnee  = side === 'L' ? lm[KP.L_KNEE]  : lm[KP.R_KNEE];
        const nearAnkle = side === 'L' ? lm[KP.L_ANKLE] : lm[KP.R_ANKLE];
        const nearElbow = side === 'L' ? lm[KP.L_ELBOW] : lm[KP.R_ELBOW];
        const nearWrist = side === 'L' ? lm[KP.L_WRIST] : lm[KP.R_WRIST];

        // Flessione del tronco: angolo dalla verticale, firmato in avanti
        const rawFlex = tiltFromVertical(spine.hp, spine.c7) * facing;
        res.trunkFlex = smv('trunkFlex', rawFlex);

        // Allineamento della colonna misurato (vedi buildSpine)
        if (spine.alignAngle !== null) res.align = smv('align', spine.alignAngle);
        if (spine.bendPct   !== null) res.alignDev = smv('alignDev', spine.bendPct);

        // Testa: angolo cranio-vertebrale (riferimento clinico) quando il tronco
        // è quasi verticale, altrimenti offset anteriore dell'orecchio su C7.
        if (okp(nearEar, C_HEAD)) {
            const fwd = (nearEar.x - spine.c7.x) * facing;
            res.headOffset = smv('headOffset', (fwd / torso) * 100);
            if (Math.abs(res.trunkFlex) < 25) {
                res.cva = smv('cva', Math.atan2(spine.c7.y - nearEar.y, fwd) * RAD);
            }
        }

        if (pr.horizontal) {
            // ── PUSH-UP / PLANK ──────────────────────────────────────────────
            // Metrica corretta: deviazione perpendicolare del bacino dalla retta
            // spalla→caviglia, in % tronco. Indipendente da distanza e camera
            // (l'angolo "dalla verticale" usato prima dipendeva da entrambe).
            const foot = okp(nearAnkle, C_LIMB) ? nearAnkle
                       : (okp(nearKnee, C_LIMB) ? nearKnee : null);
            if (foot) {
                const d = perpDev(spine.hp, spine.sh, foot);
                if (d !== null) {
                    // Positivo = bacino verso l'alto (pike), negativo = cede (sag)
                    const sign = Math.sign(perpDev({ x: spine.sh.x, y: spine.sh.y - 100 },
                                                   spine.sh, foot)) || 1;
                    res.bodySag  = smv('bodySag', (d / torso) * 100 * sign);
                    res.bodyLine = { a: { x: spine.sh.x, y: spine.sh.y },
                                     b: { x: foot.x,     y: foot.y     } };
                    const mag = Math.abs(res.bodySag);
                    const g = gradeLow('sag', mag, pr.sagW, pr.sagB);
                    if (g !== 'good') {
                        const up = res.bodySag > 0;
                        push(up ? `Fianchi troppo alti ${Math.round(mag)}% — abbassa il bacino`
                                : `Fianchi che cedono ${Math.round(mag)}% — stringi il core`,
                             g === 'bad' ? 2 : 1);
                    }
                }
            } else {
                push('Inquadra tutto il corpo di profilo', 1);
            }

            // Gomito (profondità) + polsi sotto le spalle
            if (okp(nearElbow, C_LIMB) && okp(nearWrist, C_LIMB)) {
                const ea = angle3(spine.sh, nearElbow, nearWrist);
                if (ea !== null) { res.elbowAngleRaw = ea; res.elbowAngle = smv('elbowAngle', ea); }
            }
            if (okp(nearWrist, C_LIMB)) {
                res.wristDev = smv('wristDev', (Math.abs(nearWrist.x - spine.sh.x) / torso) * 100);
                const g = gradeLow('wrist', res.wristDev, pr.wristW, pr.wristB);
                if (g === 'bad')      push('Polsi non sotto le spalle — aggiusta le mani', 2);
                else if (g === 'warning') push('Centra le mani sotto le spalle', 1);
            }

        } else {
            // ── IN PIEDI / SEDUTO / SQUAT ────────────────────────────────────
            const flexAbs = Math.abs(res.trunkFlex);
            const g = gradeLow('flex', flexAbs, pr.flexW, pr.flexB);
            if (g !== 'good') {
                const back = res.trunkFlex < 0;
                push(back ? `Tronco inclinato indietro — ${Math.round(flexAbs)}° dalla verticale`
                          : `Schiena inclinata in avanti — ${Math.round(flexAbs)}° dalla verticale`,
                     g === 'bad' ? 2 : 1);
            }
        }

        // ── Testa e collo: UNA sola metrica attiva, per non segnalare due volte
        //    lo stesso difetto. Con il tronco verticale vale l'identità
        //    align = 90 + CVA, quindi le due misure sono la stessa cosa:
        //     · tronco quasi verticale → CVA clinico (riferito all'orizzonte)
        //     · tronco inclinato (squat, plank) → align − 90, cioè lo stesso
        //       angolo misurato rispetto all'asse del tronco.
        //    Le soglie restano sulla scala clinica del CVA in entrambi i casi.
        if (res.cva !== null) {
            const g = gradeHigh('cva', res.cva, pr.cvaW, pr.cvaB);
            if (g === 'bad')      push('Testa molto avanti — rientra il mento', 2);
            else if (g === 'warning') push('Collo protratto — allunga la nuca', 1);
        } else if (res.align !== null) {
            const g = gradeHigh('align', res.align, 90 + pr.cvaW, 90 + pr.cvaB);
            if (g === 'bad')      push('Testa fuori asse col tronco — allinea la nuca', 2);
            else if (g === 'warning') push('Collo fuori asse — allinea la testa al tronco', 1);
        }

        // Ginocchio (hip-knee-ankle) — angolo ora corretto (spazio pixel).
        // Il valore grezzo (già stabilizzato a livello di keypoint) serve al
        // conteggio ripetizioni: lo smoothing della metrica attenua i picchi
        // di ~20% a una ripetizione al secondo e farebbe perdere le soglie.
        if (okp(nearKnee, C_LIMB) && okp(nearAnkle, C_LIMB)) {
            const ka = angle3(spine.hp, nearKnee, nearAnkle);
            if (ka !== null) { res.kneeAngleRaw = ka; res.kneeAngle = smv('kneeAngle', ka); }
        }

        if (activeExercise === 'squat') {
            // Profondità: anca rispetto al ginocchio, in % tronco (≥0 = parallelo)
            if (okp(nearKnee, C_LIMB)) {
                res.hipDepth = smv('hipDepth', ((spine.hp.y - nearKnee.y) / torso) * 100);
            }
            // Inclinazione tibia: firmata in avanti via direzione dello sguardo
            if (okp(nearKnee, C_LIMB) && okp(nearAnkle, C_LIMB)) {
                res.shinLean = smv('shinLean', tiltFromVertical(nearAnkle, nearKnee) * facing);
            }
            const inDescent = res.kneeAngle !== null && res.kneeAngle < 145;
            if (inDescent && res.shinLean !== null && res.shinLean < pr.shinMin) {
                push('Tibia verticale — lavora sulla mobilità della caviglia', 1);
            }
            if (inDescent && res.hipDepth !== null) {
                const g = gradeLow('depth', -res.hipDepth, -pr.depthW, -pr.depthB);
                if (g === 'bad') push('Scendi di più — anca sopra il ginocchio', 1);
            }
        }
    }

    // ── Stato aggregato: pesato sulla gravità, non sul numero di warning ──────
    warn.sort((a, b) => b.sev - a.sev);
    res.warnings = warn.map(w => w.msg);
    const raw = warn.some(w => w.sev === 2) ? 'bad' : warn.length ? 'warning' : 'good';
    res.status = stableStatus(raw);
    res.phase  = repState.phase;
    return res;
}

// ══════════════════════════════════════════════════════════════════════════════
//  Conteggio ripetizioni — con debounce temporale e validazione profondità
// ══════════════════════════════════════════════════════════════════════════════
const REP_MIN_PERIOD = 450;   // ms tra due ripetizioni valide

function updateReps(posture, now) {
    const rep = EXERCISES[activeExercise].pr.rep;
    if (!rep || posture.view !== 'profile') return;
    // Angolo grezzo: le soglie di fase vanno valutate sul picco reale
    const ang = rep.joint === 'knee'
        ? (posture.kneeAngleRaw  ?? posture.kneeAngle)
        : (posture.elbowAngleRaw ?? posture.elbowAngle);
    if (ang === null || ang === undefined) return;

    if (repState.phase === 'up') {
        if (ang < rep.down) { repState.phase = 'down'; repState.minAng = ang; }
    } else {
        repState.minAng = Math.min(repState.minAng, ang);
        if (ang > rep.up) {
            const deep  = repState.minAng <= rep.minDepth;
            const spaced = now - repState.lastRepAt > REP_MIN_PERIOD;
            if (deep && spaced) { repState.count++; repState.lastRepAt = now; }
            repState.phase  = 'up';
            repState.minAng = 999;
        }
    }
}

// ══════════════════════════════════════════════════════════════════════════════
//  Disegno (coordinate pixel = coordinate canvas)
// ══════════════════════════════════════════════════════════════════════════════

// Il canvas è specchiato via CSS (scaleX(-1)): il testo disegnato normalmente
// uscirebbe rovesciato. Qui si annulla il mirror solo per il glifo.
function drawText(str, x, y, col, size) {
    CTX.save();
    CTX.translate(x, y);
    CTX.scale(-1, 1);
    CTX.font      = `bold ${size}px 'IBM Plex Mono', monospace`;
    CTX.textAlign = 'center';
    CTX.textBaseline = 'middle';
    CTX.fillStyle = col;
    CTX.fillText(str, 0, 0);
    CTX.restore();
}

function drawSkeleton(lm, torso) {
    const k = clamp(torso / 170, 0.55, 2.2);   // scala con la taglia del soggetto

    for (const { a, b, col, w } of CONNECTIONS) {
        const la = lm[a], lb = lm[b];
        if (!la || !lb) continue;
        const vis = Math.min(la.score, lb.score);
        if (vis < 0.10) continue;
        CTX.globalAlpha = Math.min(1, 0.35 + vis * 0.65);
        CTX.beginPath();
        CTX.moveTo(la.x, la.y);
        CTX.lineTo(lb.x, lb.y);
        CTX.strokeStyle = col;
        CTX.lineWidth   = (w || 2) * k * Math.min(1, 0.4 + vis * 0.6);
        CTX.stroke();
    }
    CTX.globalAlpha = 1;

    for (let i = 0; i < lm.length; i++) {
        const p = lm[i];
        if (!p || p.score < 0.10) continue;
        const col = JOINT_COL[i] || '#fff';
        const key = KEY_JOINTS.has(i);
        const r   = (key ? 7 : 4) * k;

        CTX.globalAlpha = Math.min(1, 0.35 + p.score * 0.65);
        if (key) {
            CTX.beginPath();
            CTX.arc(p.x, p.y, r + 4 * k, 0, Math.PI * 2);
            CTX.strokeStyle = col + '44';
            CTX.lineWidth   = 2 * k;
            CTX.stroke();
        }
        CTX.beginPath();
        CTX.arc(p.x, p.y, r, 0, Math.PI * 2);
        CTX.fillStyle = col;
        CTX.fill();
        if (key) {
            CTX.beginPath();
            CTX.arc(p.x, p.y, r * 0.35, 0, Math.PI * 2);
            CTX.fillStyle = 'rgba(0,0,0,0.75)';
            CTX.fill();
        }
    }
    CTX.globalAlpha = 1;
}

// Colonna come curva: la Bézier quadratica passa per la deviazione misurata
// (controllo = medio + 2×deviazione ⇒ B(0.5) = medio + deviazione).
function drawSpine(spine, posture) {
    const { hp, c7, head, torso, bendVec } = spine;
    const k   = clamp(torso / 170, 0.55, 2.2);
    const col = posture.status === 'bad' ? '#ff1744'
              : posture.status === 'warning' ? '#ffc107' : '#FFD700';

    // Punto di controllo = medio + 2× lo scostamento desiderato, così la Bézier
    // ci passa esattamente in mezzo (B(0.5) = medio + scostamento).
    // Lo scostamento misurato di C7 dalla corda bacino→testa include tutto
    // l'avanzamento della testa: come curva disegnata va smorzato, altrimenti
    // la colonna appare un arco. Il numero mostrato nel pannello resta la
    // misura esatta — qui si scala solo la resa grafica.
    const BEND_DRAW = 0.45;
    const maxBend   = torso * 0.10;
    const bm = Math.hypot(bendVec.x, bendVec.y) * BEND_DRAW;
    const f  = (bm > maxBend ? maxBend / bm : 1) * BEND_DRAW;
    const cx = (hp.x + c7.x) / 2 + bendVec.x * f * 2;
    const cy = (hp.y + c7.y) / 2 + bendVec.y * f * 2;

    // Alone
    CTX.beginPath();
    CTX.moveTo(hp.x, hp.y);
    CTX.quadraticCurveTo(cx, cy, c7.x, c7.y);
    CTX.strokeStyle = col + '25';
    CTX.lineWidth   = 18 * k;
    CTX.lineCap     = 'round';
    CTX.stroke();

    // Curva colonna
    CTX.beginPath();
    CTX.moveTo(hp.x, hp.y);
    CTX.quadraticCurveTo(cx, cy, c7.x, c7.y);
    CTX.strokeStyle = col;
    CTX.lineWidth   = 3 * k;
    CTX.stroke();

    // Vertebre lungo la curva (sacro → lombare → dorsale → C7)
    for (let i = 0; i <= 4; i++) {
        const t = i / 4, u = 1 - t;
        const vx = u * u * hp.x + 2 * u * t * cx + t * t * c7.x;
        const vy = u * u * hp.y + 2 * u * t * cy + t * t * c7.y;
        const r  = (i === 0 || i === 4 ? 5 : 3.4) * k;
        CTX.beginPath(); CTX.arc(vx, vy, r, 0, Math.PI * 2);
        CTX.fillStyle = col; CTX.fill();
        CTX.beginPath(); CTX.arc(vx, vy, r * 0.4, 0, Math.PI * 2);
        CTX.fillStyle = 'rgba(0,0,0,0.6)'; CTX.fill();
    }

    // Segmento cervicale C7 → testa
    if (head) {
        CTX.beginPath();
        CTX.moveTo(c7.x, c7.y); CTX.lineTo(head.x, head.y);
        CTX.strokeStyle = col + 'aa';
        CTX.lineWidth = 2.2 * k;
        CTX.setLineDash([6 * k, 4 * k]); CTX.stroke(); CTX.setLineDash([]);
    }

    if (!posture.visible) { CTX.lineCap = 'butt'; return; }

    // Corpo orizzontale (plank / push-up): il riferimento non è la verticale ma
    // la retta spalla→caviglia, cioè esattamente ciò che viene valutato.
    if (posture.bodyLine) {
        const { a, b } = posture.bodyLine;
        CTX.beginPath();
        CTX.moveTo(a.x, a.y); CTX.lineTo(b.x, b.y);
        CTX.strokeStyle = 'rgba(255,255,255,0.30)';
        CTX.lineWidth = 1.4 * k;
        CTX.setLineDash([7 * k, 5 * k]); CTX.stroke(); CTX.setLineDash([]);

        // Tacca perpendicolare sul bacino = scostamento misurato
        const dvx = b.x - a.x, dvy = b.y - a.y, dl = Math.hypot(dvx, dvy) || 1;
        const t2  = ((hp.x - a.x) * dvx + (hp.y - a.y) * dvy) / (dl * dl);
        const px2 = a.x + dvx * t2, py2 = a.y + dvy * t2;
        CTX.beginPath();
        CTX.moveTo(px2, py2); CTX.lineTo(hp.x, hp.y);
        CTX.strokeStyle = col; CTX.lineWidth = 2 * k; CTX.stroke();
        const pct = Math.abs(Math.round(posture.bodySag ?? 0));
        if (pct >= 2) drawText(pct + '%', (px2 + hp.x) / 2 + 22 * k, (py2 + hp.y) / 2, col, Math.round(12 * k));
        CTX.lineCap = 'butt';
        return;
    }

    // Verticale di riferimento + arco dell'angolo misurato
    const arcR = clamp(torso * 0.38, 26, 90);
    CTX.beginPath();
    CTX.moveTo(hp.x, hp.y); CTX.lineTo(hp.x, hp.y - arcR - 14 * k);
    CTX.strokeStyle = 'rgba(255,255,255,0.25)';
    CTX.lineWidth = 1.2 * k;
    CTX.setLineDash([4 * k, 4 * k]); CTX.stroke(); CTX.setLineDash([]);

    const deg = tiltFromVertical(hp, c7);
    const a0 = -Math.PI / 2, a1 = a0 + deg / RAD;
    CTX.beginPath();
    CTX.arc(hp.x, hp.y, arcR, Math.min(a0, a1), Math.max(a0, a1));
    CTX.strokeStyle = col; CTX.lineWidth = 2 * k; CTX.stroke();

    const shown = Math.round(Math.abs(deg));
    if (shown > 1) {
        const tx = hp.x + (deg >= 0 ? arcR + 16 * k : -(arcR + 16 * k));
        drawText(shown + '°', tx, hp.y - 10 * k, col, Math.round(12 * k));
    }
    CTX.lineCap = 'butt';
}

// Centri calcolati (collo e pelvi) — punti di riferimento del tronco
function drawTrunkRefs(spine) {
    const { sh, hp, torso } = spine;
    const k = clamp(torso / 170, 0.55, 2.2);
    const dot = (p, col) => {
        CTX.beginPath(); CTX.arc(p.x, p.y, 5 * k, 0, Math.PI * 2);
        CTX.fillStyle = col; CTX.fill();
        CTX.beginPath(); CTX.arc(p.x, p.y, 9 * k, 0, Math.PI * 2);
        CTX.strokeStyle = col + '33'; CTX.lineWidth = 2 * k; CTX.stroke();
    };
    CTX.globalAlpha = Math.min(1, 0.5 + sh.score * 0.4);
    dot(sh, '#ffd700');
    CTX.globalAlpha = Math.min(1, 0.5 + hp.score * 0.4);
    dot(hp, '#ff9f43');
    CTX.globalAlpha = 1;
}

// ══════════════════════════════════════════════════════════════════════════════
//  UI
// ══════════════════════════════════════════════════════════════════════════════
function setMV(el, row, text, state) {
    el.textContent = text;
    el.className   = 'm-val ' + (state || '');
    row.className  = 'metric-row ' + (state === 'bad' ? 'warn' : state === 'warning' ? 'ok' : '');
}

const clearRows = () => {
    setMV(vLat, mLat, '—', ''); setMV(vFwd, mFwd, '—', '');
    setMV(vSpalle, mSpalle, '—', ''); setMV(vExtra, mExtra, '—', '');
};

function labels(view, exKey) {
    const p = view === 'profile';
    if (!p) {
        lblLat.textContent = 'INCL. LAT.';
        lblFwd.textContent = 'OBLIQ. SPALLE';
        lblSpalle.textContent = 'OBLIQ. ANCHE';
        lblExtra.textContent = exKey === 'squat' ? 'GINOCCHIA/CAVIGLIE' : 'INCL. TESTA';
        return;
    }
    if (exKey === 'squat') {
        lblLat.textContent = 'SCHIENA'; lblFwd.textContent = 'GINOCCHIO';
        lblSpalle.textContent = 'PROFONDITÀ'; lblExtra.textContent = 'INCL. TIBIA';
    } else if (exKey === 'pushup') {
        lblLat.textContent = 'PIANO CORPO'; lblFwd.textContent = 'GOMITO';
        lblSpalle.textContent = 'POLSI'; lblExtra.textContent = 'COLLO';
    } else {
        lblLat.textContent = 'INCL. AVANTI'; lblFwd.textContent = 'TESTA (CVA)';
        lblSpalle.textContent = 'ALLIN. COLONNA'; lblExtra.textContent = 'COLLO';
    }
}

function updateUI(posture, view, hasBody) {
    const isProfile = view === 'profile';
    const ex = EXERCISES[activeExercise];

    viewBadge.textContent = isProfile ? 'PROFILO' : 'FRONTALE';
    viewBadge.className   = 'view-badge' + (isProfile ? ' profile' : '');
    labels(view, activeExercise);

    const ss = posture.score >= 70 ? 'good' : posture.score >= 40 ? 'warning' : 'bad';
    setMV(vScore, mScore, posture.score + '%', ss);

    if (!posture.visible || !hasBody) {
        angleVal.textContent = '—°'; angleBadge.className = '';
        clearRows();
        warningBanner.classList.add('hidden');
        goodBanner.classList.add('hidden');
        repBadge.classList.add('hidden');
        if (vfCorners) vfCorners.classList.remove('good', 'bad');
        return;
    }

    if (ex.needProfile && !isProfile) {
        angleVal.textContent = '—°'; angleBadge.className = '';
        clearRows();
        warningText.textContent = '⚠ GIRATI DI PROFILO';
        warningBanner.classList.remove('hidden');
        goodBanner.classList.add('hidden');
        repBadge.classList.add('hidden');
        if (vfCorners) vfCorners.classList.remove('good', 'bad');
        return;
    }

    if (ex.pr.rep) {
        repBadge.classList.remove('hidden');
        repCountEl.textContent = repState.count;
    } else {
        repBadge.classList.add('hidden');
    }

    const pr = ex.pr;

    // ── Badge angolo principale ──────────────────────────────────────────────
    if (isProfile && pr.horizontal) {
        const sag = posture.bodySag;
        angleVal.textContent = sag === null ? '—' : Math.round(Math.abs(sag)) + '%';
        badgeLbl.textContent = 'PIANO';
        angleBadge.className = sag === null ? '' : _grades['sag'] || '';
    } else if (isProfile) {
        const f = Math.abs(posture.trunkFlex ?? 0);
        angleVal.textContent = Math.round(f) + '°';
        badgeLbl.textContent = activeExercise === 'squat' ? 'SCHIENA' : 'COLONNA';
        angleBadge.className = _grades['flex'] || '';
    } else {
        const l = Math.abs(posture.trunkLean ?? 0);
        angleVal.textContent = Math.round(l) + '°';
        badgeLbl.textContent = 'COLONNA';
        angleBadge.className = _grades['lean'] || '';
    }

    // ── Righe metriche ───────────────────────────────────────────────────────
    if (!isProfile) {
        setMV(vLat, mLat, Math.round(Math.abs(posture.trunkLean ?? 0)) + '°', _grades['lean'] || '');
        posture.shTilt === null
            ? setMV(vFwd, mFwd, '—', '')
            : setMV(vFwd, mFwd, posture.shTilt.toFixed(1) + '°', _grades['shTilt'] || '');
        posture.hipTilt === null
            ? setMV(vSpalle, mSpalle, '—', '')
            : setMV(vSpalle, mSpalle, posture.hipTilt.toFixed(1) + '°', _grades['hipTilt'] || '');

        if (activeExercise === 'squat') {
            posture.kneeRatio === null
                ? setMV(vExtra, mExtra, '—', '')
                : setMV(vExtra, mExtra, Math.round(posture.kneeRatio * 100) + '%', _grades['kneeRatio'] || '');
        } else {
            posture.earTilt === null
                ? setMV(vExtra, mExtra, '—', '')
                : setMV(vExtra, mExtra, posture.earTilt.toFixed(1) + '°', _grades['earTilt'] || '');
        }

    } else if (activeExercise === 'squat') {
        setMV(vLat, mLat, Math.round(Math.abs(posture.trunkFlex ?? 0)) + '°', _grades['flex'] || '');
        if (posture.kneeAngle === null) setMV(vFwd, mFwd, '—', '');
        else {
            // Sopra kneeStraight siamo in piedi, non a metà rep: nessun giudizio.
            const ka = posture.kneeAngle;
            setMV(vFwd, mFwd, Math.round(ka) + '°',
                ka <= 110 ? 'good' : ka <= pr.kneeStraight ? 'warning' : '');
        }
        if (posture.hipDepth === null) setMV(vSpalle, mSpalle, '—', '');
        else {
            const d = posture.hipDepth;
            setMV(vSpalle, mSpalle,
                d >= 0 ? 'PROFONDA' : d > pr.depthB ? 'OK' : 'POCO',
                d >= 0 ? 'good'     : d > pr.depthB ? 'warning' : 'bad');
        }
        if (posture.shinLean === null) setMV(vExtra, mExtra, '—', '');
        else {
            const sl = posture.shinLean;
            setMV(vExtra, mExtra, Math.round(sl) + '°',
                sl > pr.shinMin ? 'good' : sl > 0 ? 'warning' : 'bad');
        }

    } else if (activeExercise === 'pushup') {
        if (posture.bodySag === null) setMV(vLat, mLat, '—', '');
        else {
            const s = posture.bodySag;
            setMV(vLat, mLat, (s > 0 ? '+' : '') + Math.round(s) + '%', _grades['sag'] || '');
        }
        if (posture.elbowAngle === null) setMV(vFwd, mFwd, '—', '');
        else {
            const ea = posture.elbowAngle;
            setMV(vFwd, mFwd, Math.round(ea) + '°',
                ea < 100 ? 'good' : ea < 140 ? 'warning' : 'bad');
        }
        posture.wristDev === null
            ? setMV(vSpalle, mSpalle, '—', '')
            : setMV(vSpalle, mSpalle, Math.round(posture.wristDev) + '%', _grades['wrist'] || '');
        // Con il tronco orizzontale il CVA non è definito: la metrica valida è
        // l'allineamento testa-tronco (align).
        posture.align === null
            ? setMV(vExtra, mExtra, '—', '')
            : setMV(vExtra, mExtra, Math.round(posture.align - 90) + '°', _grades['align'] || '');

    } else {
        setMV(vLat, mLat, Math.round(Math.abs(posture.trunkFlex ?? 0)) + '°', _grades['flex'] || '');
        posture.cva === null
            ? setMV(vFwd, mFwd, '—', '')
            : setMV(vFwd, mFwd, Math.round(posture.cva) + '°', _grades['cva'] || '');
        // ALLIN. COLONNA: angolo bacino-C7-testa (180° = in asse). Non graduato
        // quando il CVA è disponibile — misurano lo stesso difetto.
        posture.align === null
            ? setMV(vSpalle, mSpalle, '—', '')
            : setMV(vSpalle, mSpalle, Math.round(posture.align) + '°',
                    posture.cva === null ? (_grades['align'] || '') : '');
        posture.headOffset === null
            ? setMV(vExtra, mExtra, '—', '')
            : setMV(vExtra, mExtra, Math.round(posture.headOffset) + '%', '');
    }

    // ── Banner + voce ────────────────────────────────────────────────────────
    const { warnings, status } = posture;
    if (vfCorners) {
        vfCorners.classList.toggle('good', status === 'good');
        vfCorners.classList.toggle('bad', status === 'bad');
    }

    if (status === 'good' || warnings.length === 0) {
        warningBanner.classList.add('hidden');
        goodBanner.classList.remove('hidden');
        if (activeExercise === 'squat' && posture.hipDepth !== null) {
            goodBanner.textContent = posture.hipDepth >= 0 ? '✓ BUONA PROFONDITÀ' : '✓ FORMA CORRETTA';
        } else if (activeExercise === 'pushup') {
            goodBanner.textContent = posture.phase === 'down' ? '✓ OTTIMA PROFONDITÀ' : '✓ FORMA CORRETTA';
        } else {
            goodBanner.textContent = '✓ POSTURA CORRETTA';
        }
    } else {
        goodBanner.classList.add('hidden');
        const wi = Math.floor(Date.now() / 2400) % warnings.length;
        warningText.textContent = '⚠ ' + warnings[wi].toUpperCase();
        warningBanner.classList.remove('hidden');
        speak(warnings[0], status !== lastStatus);
    }
    lastStatus = status;

    if (repState.count > lastRepCount) {
        lastRepCount = repState.count;
        speak(String(repState.count), true);
    }
}

// ══════════════════════════════════════════════════════════════════════════════
//  Loop di rilevamento
// ══════════════════════════════════════════════════════════════════════════════
function onPoseResults(keypoints, now) {
    if (CANVAS.width  !== VIDEO.videoWidth)  CANVAS.width  = VIDEO.videoWidth  || 640;
    if (CANVAS.height !== VIDEO.videoHeight) CANVAS.height = VIDEO.videoHeight || 480;
    const W = CANVAS.width, H = CANVAS.height;
    CTX.clearRect(0, 0, W, H);

    // MoveNet restituisce già pixel del frame: li teniamo così (nessuna
    // normalizzazione anisotropa che falserebbe gli angoli).
    const raw = (keypoints && keypoints.length >= 17)
        ? keypoints.map(kp => ({ x: kp.x, y: kp.y, score: kp.score ?? 0 }))
        : null;

    const valid = raw && isValidPerson(raw, H);

    if (valid) {
        missingFrames = 0;
        trackKeypoints(raw, now);
    } else {
        missingFrames++;
        if (missingFrames > MAX_MISSING) { tracked = null; scaleRef = 0; }
    }

    const lm      = (tracked && missingFrames <= MAX_MISSING) ? tracked : null;
    const hasBody = !!lm;

    _dt = clamp((now - (onPoseResults._last || now - 33)) / 1000, 1 / 120, 0.25);
    onPoseResults._last = now;

    const view    = lm ? detectView(lm) : _view;
    const posture = analyzePosture(lm, view, H);

    if (hasBody && posture.spine) {
        updateReps(posture, now);
        drawTrunkRefs(posture.spine);
        drawSkeleton(lm, posture.spine.torso);
        drawSpine(posture.spine, posture);
    } else if (hasBody) {
        drawSkeleton(lm, scaleRef || 170);
    }

    statusDot.className    = hasBody ? 'sdot active' : 'sdot warning';
    statusText.textContent = hasBody ? 'TRACCIAMENTO ATTIVO' : 'RICERCA CORPO...';
    updateUI(posture, view, hasBody);
}

let detector = null;
let looping  = false;

async function loop() {
    if (!looping) return;
    if (detector && VIDEO.readyState >= 2) {
        try {
            const poses = await detector.estimatePoses(VIDEO, { flipHorizontal: false });
            onPoseResults(poses[0]?.keypoints ?? null, performance.now());
        } catch (_) { /* skip bad frame */ }
    }
    requestAnimationFrame(loop);
}

// ── Init ──────────────────────────────────────────────────────────────────────
async function init() {
    try {
        await tf.ready();
        await tf.setBackend('webgl');

        loadingOv.classList.remove('hidden');
        loadingOv.querySelector('.loader-text').textContent = 'CARICAMENTO MOVENET THUNDER...';

        if (!detector) {
            detector = await poseDetection.createDetector(
                poseDetection.SupportedModels.MoveNet,
                {
                    modelType: poseDetection.movenet.modelType.SINGLEPOSE_THUNDER,
                    enableSmoothing: false,   // lo smoothing è nostro (One-Euro adattivo)
                    minPoseScore: 0.25,
                }
            );
        }

        if (!VIDEO.srcObject) {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' },
                audio: false,
            });
            VIDEO.srcObject = stream;
            await new Promise(r => { VIDEO.onloadedmetadata = r; });
        }
        VIDEO.play();

        statusDot.className    = 'sdot active';
        statusText.textContent = 'FOTOCAMERA ATTIVA';
        loadingOv.classList.add('hidden');
        looping = true;
        loop();
    } catch (err) {
        statusDot.className    = 'sdot error';
        statusText.textContent = 'ERRORE';
        loadingOv.classList.remove('hidden');
        loadingOv.querySelector('.loader-text').textContent =
            err.name === 'NotAllowedError'
                ? 'ACCESSO FOTOCAMERA NEGATO'
                : `ERRORE: ${err.message}`;
        console.error(err);
    }
}

// ── Torna alla selezione ─────────────────────────────────────────────────────
document.getElementById('back-btn').addEventListener('click', () => {
    looping = false;

    if (VIDEO.srcObject) {
        VIDEO.srcObject.getTracks().forEach(t => t.stop());
        VIDEO.srcObject = null;
    }

    CTX.clearRect(0, 0, CANVAS.width, CANVAS.height);

    fetch('/api/deepfit/stop', { method: 'POST' }).catch(() => {});

    resetSmoothState();
    synth.cancel();
    lastStatus   = 'unknown';
    lastRepCount = 0;
    repState     = { count: 0, phase: 'up', minAng: 999, lastRepAt: -Infinity };

    statusDot.className    = 'sdot';
    statusText.textContent = 'IN ATTESA';
    loadingOv.classList.add('hidden');
    warningBanner.classList.add('hidden');
    goodBanner.classList.add('hidden');
    repBadge.classList.add('hidden');
    if (vfCorners) vfCorners.classList.remove('good', 'bad');

    document.getElementById('exercise-select').classList.remove('hidden');
});

// ── Selezione esercizio ───────────────────────────────────────────────────────
document.querySelectorAll('.ex-card').forEach(btn => {
    btn.addEventListener('click', () => {
        activeExercise = btn.dataset.ex;
        repState      = { count: 0, phase: 'up', minAng: 999, lastRepAt: -Infinity };
        lastRepCount  = 0;
        lastStatus    = 'unknown';
        lastSpokenTxt = '';
        resetSmoothState();
        synth.cancel();
        if (exerciseBadge) {
            exerciseBadge.textContent = EXERCISES[activeExercise].name;
            exerciseBadge.dataset.ex  = activeExercise;
        }
        document.getElementById('exercise-select').classList.add('hidden');
        init();
    });
});
