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
const lblLat    = document.getElementById('m-lat').querySelector('.m-label');
const lblFwd    = document.getElementById('lbl-fwd');
const lblSpalle = document.getElementById('lbl-spalle');
const lblExtra  = document.getElementById('lbl-extra');

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
    { a:3,  b:1,  col:'rgba(255,107,107,0.50)' },
    { a:1,  b:0,  col:'rgba(255,107,107,0.50)' },
    { a:0,  b:2,  col:'rgba(255,107,107,0.50)' },
    { a:2,  b:4,  col:'rgba(255,107,107,0.50)' },
    // Collo (orecchie → spalle) — punti aggiuntivi
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

// ── Exercise configs ──────────────────────────────────────────────────────────
const EXERCISES = {
    inpiedi: {
        name: 'IN PIEDI',
        fr: { spineW:10, spineB:18, shW:5, shB:10, hipW:4, hipB:8, earW:4, earB:8 },
        pr: { fwdW:15, fwdB:25, headW:8, headB:14, neckW:8, neckB:16, kneeMode:'none' },
    },
    seduto: {
        name: 'SEDUTO',
        fr: { spineW:15, spineB:25, shW:6, shB:12, hipW:5, hipB:10, earW:5, earB:10 },
        pr: { fwdW:25, fwdB:40, headW:10, headB:18, neckW:12, neckB:22, kneeMode:'none' },
    },
    squat: {
        name: 'SQUAT',
        fr: { spineW:15, spineB:28, shW:8, shB:16, hipW:8, hipB:16, earW:8, earB:16, kneeValgusW:20, kneeValgusB:38 },
        pr: { fwdW:40, fwdB:60, headW:18, headB:28, neckW:15, neckB:25, kneeMode:'gt', kneeThr:130, shinLeanMin:8 },
    },
    pushup: {
        name: 'PUSH-UP',
        fr: { spineW:15, spineB:25, shW:6, shB:12, hipW:5, hipB:10, earW:8, earB:14 },
        pr: { horizontal:true, angLowB:50, angLowW:65, angHighW:105, angHighB:115, headW:25, headB:35, neckW:15, neckB:25, kneeMode:'none', wristW:8, wristB:16 },
    },
};

let activeExercise = 'inpiedi';
let repState = { count: 0, phase: 'up' };

// ── Smoothing EMA ─────────────────────────────────────────────────────────────
const SMOOTH_ALPHA  = 0.55;
const SCORE_ALPHA   = 0.40;
let   smoothedKps   = null;
let   missingFrames = 0;
const MAX_MISSING   = 10;

function smoothKeypoints(raw) {
    if (!raw) return null;
    if (!smoothedKps || smoothedKps.length !== raw.length) {
        smoothedKps = raw.map(kp => ({ ...kp }));
        return smoothedKps;
    }
    for (let i = 0; i < raw.length; i++) {
        const r = raw[i], s = smoothedKps[i];
        if (r.score > 0.15) {
            s.x = SMOOTH_ALPHA * s.x + (1 - SMOOTH_ALPHA) * r.x;
            s.y = SMOOTH_ALPHA * s.y + (1 - SMOOTH_ALPHA) * r.y;
        }
        s.score = SCORE_ALPHA * s.score + (1 - SCORE_ALPHA) * r.score;
    }
    return smoothedKps;
}

// ── Person validator ──────────────────────────────────────────────────────────
function isValidPerson(kps) {
    if (!kps || kps.length < 17) return false;
    const highConf = kps.filter(kp => kp.score > 0.25).length;
    if (highConf < 4) return false;
    const ls = kps[KP.L_SHOULDER], rs = kps[KP.R_SHOULDER];
    const lh = kps[KP.L_HIP],     rh = kps[KP.R_HIP];
    if (ls.score < 0.20 && rs.score < 0.20) return false;
    const syMid  = (ls.y + rs.y) / 2;
    const hyMid  = (lh.y + rh.y) / 2;
    if (Math.abs(syMid - hyMid) < 0.06) return false;
    return true;
}

// ── Speech ────────────────────────────────────────────────────────────────────
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

// ── View detection ────────────────────────────────────────────────────────────
let _stableView = 'frontal';
let _viewCount  = 0;

function detectViewMode(lm) {
    const ls = lm[KP.L_SHOULDER], rs = lm[KP.R_SHOULDER];
    if (!ls || !rs) return _stableView;
    const visDiff = Math.abs(ls.score - rs.score);
    const xSpan   = Math.abs(ls.x - rs.x);
    let detected  = 'frontal';
    if (visDiff > 0.28 || xSpan < 0.09) {
        detected = ls.score >= rs.score ? 'profile-left' : 'profile-right';
    }
    if (detected === _stableView) {
        _viewCount = Math.min(_viewCount + 1, 20);
    } else {
        _viewCount--;
        if (_viewCount <= 0) { _stableView = detected; _viewCount = 10; }
    }
    return _stableView;
}

// ── Metric smoothing ──────────────────────────────────────────────────────────
const METRIC_ALPHA  = 0.62;
const STATUS_WINDOW = 12;
const _sm = {};
let   _statusHist = [];

function smv(key, val) {
    if (val === null || val === undefined) return val;
    _sm[key] = (key in _sm) ? METRIC_ALPHA * _sm[key] + (1 - METRIC_ALPHA) * val : val;
    return _sm[key];
}

function stableStatus(raw) {
    _statusHist.push(raw);
    if (_statusHist.length > STATUS_WINDOW) _statusHist.shift();
    const n    = _statusHist.length;
    const bad  = _statusHist.filter(s => s === 'bad').length;
    const good = _statusHist.filter(s => s === 'good').length;
    if (bad  / n >= 0.60) return 'bad';
    if (good / n >= 0.60) return 'good';
    return 'warning';
}

function resetSmoothState() {
    for (const k in _sm) delete _sm[k];
    _statusHist = [];
}

// ── Angles ────────────────────────────────────────────────────────────────────
function computeScreenAngle(lm) {
    const ls = lm[KP.L_SHOULDER], rs = lm[KP.R_SHOULDER];
    const lh = lm[KP.L_HIP],     rh = lm[KP.R_HIP];
    if (!ls || !rs || !lh || !rh) return 0;
    const sX = (ls.x + rs.x) / 2, sY = (ls.y + rs.y) / 2;
    const hX = (lh.x + rh.x) / 2, hY = (lh.y + rh.y) / 2;
    return Math.atan2(sX - hX, hY - sY) * (180 / Math.PI);
}

function angleBetween3pts(A, B, C) {
    const bax = A.x - B.x, bay = A.y - B.y;
    const bcx = C.x - B.x, bcy = C.y - B.y;
    const dot  = bax * bcx + bay * bcy;
    const mag  = Math.hypot(bax, bay) * Math.hypot(bcx, bcy);
    if (mag === 0) return null;
    return Math.acos(Math.min(1, Math.max(-1, dot / mag))) * (180 / Math.PI);
}

// ── Analisi postura ───────────────────────────────────────────────────────────
function analyzePosture(lm, viewMode) {
    const ls = lm[KP.L_SHOULDER], rs = lm[KP.R_SHOULDER];
    const lh = lm[KP.L_HIP],     rh = lm[KP.R_HIP];

    const res = {
        visible: false, viewMode,
        screenAngle: 0,
        shoulderAsym: 0, hipAsym: 0, headFwd: 0,
        earAsym: null, neckFwd: null,
        kneeValgus: null, shinLean: null, wristShoulderDev: null,
        kneeAngle: null, elbowAngle: null, hipDepth: null, phase: null,
        score: 0, warnings: [], status: 'unknown',
    };

    if (!ls || !rs || !lh || !rh) return res;

    const isProfile = viewMode !== 'frontal';
    const nearS = isProfile ? (viewMode === 'profile-left' ? ls : rs) : null;
    const nearH = isProfile ? (viewMode === 'profile-left' ? lh : rh) : null;

    const sScore = isProfile ? Math.max(ls.score, rs.score) : (ls.score + rs.score) / 2;
    const hScore = isProfile ? Math.max(lh.score, rh.score) : (lh.score + rh.score) / 2;
    res.score = Math.round(((sScore + hScore) / 2) * 100);

    const minVis = isProfile
        ? Math.min(nearS?.score ?? 0, nearH?.score ?? 0)
        : Math.min(ls.score, rs.score, lh.score, rh.score);
    if (minVis < 0.18) return res;

    res.visible      = true;
    res.screenAngle  = smv('screenAngle',  computeScreenAngle(lm));
    res.shoulderAsym = smv('shoulderAsym', Math.abs(ls.y - rs.y) * 100);
    res.hipAsym      = smv('hipAsym',      Math.abs(lh.y - rh.y) * 100);

    const nose = lm[KP.NOSE];
    if (isProfile && nose && nose.score > 0.35 && nearS) {
        res.headFwd = smv('headFwd', Math.abs(nose.x - nearS.x) * 100);
    }

    const ex   = EXERCISES[activeExercise];
    const warn = [];

    if (!isProfile) {
        // ── FRONTALE ──────────────────────────────────────────────────────────
        const fr = ex.fr;

        if (Math.abs(res.screenAngle) > fr.spineW) {
            const dir = res.screenAngle > 0 ? 'destra' : 'sinistra';
            warn.push(`Schiena inclinata ${Math.round(Math.abs(res.screenAngle))}° verso ${dir}`);
        }
        if (res.shoulderAsym > fr.shW) {
            const low = rs.y > ls.y ? 'destra' : 'sinistra';
            warn.push(`Spalla ${low} più bassa — equilibra le spalle`);
        }
        if (res.hipAsym > fr.hipW) {
            const low = rh.y > lh.y ? 'destra' : 'sinistra';
            warn.push(`Anca ${low} più bassa — controlla l'allineamento`);
        }

        // Simmetria orecchie → inclinazione testa
        const le = lm[KP.L_EAR], re = lm[KP.R_EAR];
        if (le?.score > 0.22 && re?.score > 0.22) {
            res.earAsym = smv('earAsym', Math.abs(le.y - re.y) * 100);
            if (res.earAsym > (fr.earB ?? 8)) {
                const low = re.y > le.y ? 'destra' : 'sinistra';
                warn.push(`Testa inclinata — orecchio ${low} più basso`);
            } else if (res.earAsym > (fr.earW ?? 4)) {
                warn.push('Testa leggermente inclinata — centra la testa');
            }
        }

        // Knee valgus per squat (ginocchia che cedono verso il centro)
        if (activeExercise === 'squat') {
            const lk = lm[KP.L_KNEE], rk = lm[KP.R_KNEE];
            const la = lm[KP.L_ANKLE], ra = lm[KP.R_ANKLE];
            if (lk?.score > 0.28 && rk?.score > 0.28 && la?.score > 0.28 && ra?.score > 0.28) {
                const kneeDist  = Math.abs(lk.x - rk.x);
                const ankleDist = Math.abs(la.x - ra.x);
                const ratio = ankleDist > 0.01 ? kneeDist / ankleDist : 1;
                res.kneeValgus = smv('kneeValgus', Math.max(0, (1 - ratio) * 100));
                if (ratio < 0.62) {
                    warn.push("Ginocchia cedono verso l'interno — spingi verso l'esterno");
                } else if (ratio < 0.78) {
                    warn.push('Allinea le ginocchia con le punte dei piedi');
                }
            }
        }

    } else {
        // ── PROFILO ───────────────────────────────────────────────────────────
        const pr  = ex.pr;
        const fwd = Math.abs(res.screenAngle);

        if (pr.horizontal) {
            if (fwd < pr.angLowB) {
                warn.push('Posizionati di profilo per il plank');
            } else if (fwd < pr.angLowW) {
                warn.push('Fianchi troppo alti — abbassa il bacino');
            } else if (fwd > pr.angHighB) {
                warn.push('Fianchi che cedono — stringi il core');
            } else if (fwd > pr.angHighW) {
                warn.push('Fianchi leggermente bassi — stringi il core');
            }
        } else {
            if (fwd > pr.fwdB) {
                warn.push(`Schiena troppo inclinata — ${Math.round(fwd)}° dalla verticale`);
            } else if (fwd > pr.fwdW) {
                warn.push(`Inclinazione in avanti — ${Math.round(fwd)}° dalla verticale`);
            }
        }

        // Testa in avanti (naso)
        if (res.headFwd > pr.headW) {
            warn.push('Testa in avanti — rientra il mento');
        }

        // Collo in avanti via orecchio (più preciso del naso)
        const nearEar = viewMode === 'profile-left' ? lm[KP.L_EAR] : lm[KP.R_EAR];
        if (nearEar?.score > 0.25 && nearS) {
            const offset = viewMode === 'profile-left'
                ? (nearEar.x - nearS.x) * 100
                : (nearS.x - nearEar.x) * 100;
            res.neckFwd = smv('neckFwd', Math.max(0, offset));
            if (res.neckFwd > (pr.neckB ?? 16)) {
                warn.push('Postura testa in avanti — rientra il collo');
            } else if (res.neckFwd > (pr.neckW ?? 8)) {
                warn.push('Collo protratto — solleva leggermente il mento');
            }
        }

        // Angolo ginocchio (hip-knee-ankle)
        const nearKnee  = viewMode === 'profile-left' ? lm[KP.L_KNEE]  : lm[KP.R_KNEE];
        const nearAnkle = viewMode === 'profile-left' ? lm[KP.L_ANKLE] : lm[KP.R_ANKLE];
        if (nearH && nearKnee?.score > 0.35 && nearAnkle?.score > 0.35) {
            const ka = angleBetween3pts(nearH, nearKnee, nearAnkle);
            if (ka !== null) {
                res.kneeAngle = smv('kneeAngle', ka);
                if (pr.kneeMode === 'lt' && ka < pr.kneeThr) {
                    warn.push(`Ginocchio piegato ${Math.round(ka)}° — controlla la posizione`);
                } else if (pr.kneeMode === 'gt' && ka > pr.kneeThr) {
                    warn.push(`Ginocchio troppo dritto ${Math.round(ka)}° — scendi di più`);
                }
            }
        }

        // Inclinazione tibia (shin lean) → indica mobilità caviglia nello squat
        if (activeExercise === 'squat' && nearAnkle?.score > 0.30 && nearKnee?.score > 0.30) {
            const rawLean = Math.atan2(
                nearKnee.x - nearAnkle.x,
                nearAnkle.y - nearKnee.y
            ) * (180 / Math.PI);
            const lean = viewMode === 'profile-right' ? -rawLean : rawLean;
            res.shinLean = smv('shinLean', lean);
            if (res.kneeAngle !== null && res.kneeAngle < 145 && lean < (pr.shinLeanMin ?? 8)) {
                warn.push('Tallone che si solleva — lavora sulla mobilità della caviglia');
            }
        }

        // Profondità anca (squat)
        if (activeExercise === 'squat' && nearH && nearKnee?.score > 0.28) {
            res.hipDepth = smv('hipDepth', nearH.y - nearKnee.y);
        }

        // Angolo gomito + offset polso (push-up)
        if (activeExercise === 'pushup') {
            const nearElbow = viewMode === 'profile-left' ? lm[KP.L_ELBOW] : lm[KP.R_ELBOW];
            const nearWrist = viewMode === 'profile-left' ? lm[KP.L_WRIST] : lm[KP.R_WRIST];
            if (nearS && nearElbow?.score > 0.28 && nearWrist?.score > 0.28) {
                const ea = angleBetween3pts(nearS, nearElbow, nearWrist);
                if (ea !== null) res.elbowAngle = smv('elbowAngle', ea);
            }
            if (nearS && nearWrist?.score > 0.28) {
                res.wristShoulderDev = smv('wristShoulder', Math.abs(nearWrist.x - nearS.x) * 100);
                if (res.wristShoulderDev > (pr.wristB ?? 16)) {
                    warn.push('Polsi non sotto le spalle — aggiusta la posizione delle mani');
                } else if (res.wristShoulderDev > (pr.wristW ?? 8)) {
                    warn.push('Centra le mani sotto le spalle');
                }
            }
        }

        // Conteggio ripetizioni
        if (activeExercise === 'squat' && res.kneeAngle !== null) {
            if (repState.phase === 'up'   && res.kneeAngle < 105) repState.phase = 'down';
            else if (repState.phase === 'down' && res.kneeAngle > 155) { repState.phase = 'up'; repState.count++; }
        }
        if (activeExercise === 'pushup' && res.elbowAngle !== null) {
            if (repState.phase === 'up'   && res.elbowAngle < 100) repState.phase = 'down';
            else if (repState.phase === 'down' && res.elbowAngle > 155) { repState.phase = 'up'; repState.count++; }
        }
        res.phase = repState.phase;
    }

    res.warnings = warn;
    const rawStatus = warn.length === 0 ? 'good' : warn.length === 1 ? 'warning' : 'bad';
    res.status = stableStatus(rawStatus);
    return res;
}

// ── Drawing ───────────────────────────────────────────────────────────────────
function drawSkeleton(lm, W, H) {
    for (const { a, b, col, w } of CONNECTIONS) {
        const la = lm[a], lb = lm[b];
        if (!la || !lb) continue;
        const vis = Math.min(la.score, lb.score);
        if (vis < 0.08) continue;
        CTX.globalAlpha = Math.min(1, 0.35 + vis * 0.65);
        CTX.beginPath();
        CTX.moveTo(la.x * W, la.y * H);
        CTX.lineTo(lb.x * W, lb.y * H);
        CTX.strokeStyle = col;
        CTX.lineWidth   = (w || 2) * Math.min(1, 0.4 + vis * 0.6);
        CTX.stroke();
    }
    CTX.globalAlpha = 1;

    for (let i = 0; i < lm.length; i++) {
        const p = lm[i];
        if (!p || p.score < 0.08) continue;
        const x   = p.x * W, y = p.y * H;
        const col = JOINT_COL[i] || '#fff';
        const key = KEY_JOINTS.has(i);
        const r   = key ? 7 : 4;

        CTX.globalAlpha = Math.min(1, 0.35 + p.score * 0.65);
        if (key) {
            CTX.beginPath();
            CTX.arc(x, y, r + 4, 0, Math.PI * 2);
            CTX.strokeStyle = col + '44';
            CTX.lineWidth   = 2;
            CTX.stroke();
        }
        CTX.beginPath();
        CTX.arc(x, y, r, 0, Math.PI * 2);
        CTX.fillStyle = col;
        CTX.fill();
        if (key) {
            CTX.beginPath();
            CTX.arc(x, y, r * 0.35, 0, Math.PI * 2);
            CTX.fillStyle = 'rgba(0,0,0,0.75)';
            CTX.fill();
        }
    }
    CTX.globalAlpha = 1;
}

// Punti virtuali calcolati (non dal modello): COLLO, MEZZA-COLONNA, PELVI
function drawVirtualPoints(lm, W, H) {
    const ls = lm[KP.L_SHOULDER], rs = lm[KP.R_SHOULDER];
    const lh = lm[KP.L_HIP],     rh = lm[KP.R_HIP];
    if (!ls || !rs) return;

    const sScore = (ls.score + rs.score) / 2;
    const hScore = lh && rh ? (lh.score + rh.score) / 2 : 0;

    const sMidX = (ls.x + rs.x) / 2, sMidY = (ls.y + rs.y) / 2;

    // COLLO: centro spalle
    if (sScore > 0.25) {
        const nx = sMidX * W, ny = sMidY * H;
        CTX.globalAlpha = Math.min(1, 0.5 + sScore * 0.4);
        CTX.beginPath(); CTX.arc(nx, ny, 5, 0, Math.PI * 2);
        CTX.fillStyle = '#ffd700'; CTX.fill();
        CTX.beginPath(); CTX.arc(nx, ny, 9, 0, Math.PI * 2);
        CTX.strokeStyle = '#ffd70033'; CTX.lineWidth = 2; CTX.stroke();
    }

    if (sScore > 0.25 && hScore > 0.25) {
        const hMidX = (lh.x + rh.x) / 2, hMidY = (lh.y + rh.y) / 2;
        const minSH = Math.min(sScore, hScore);

        // PELVI: centro fianchi
        const px = hMidX * W, py = hMidY * H;
        CTX.globalAlpha = Math.min(1, 0.5 + minSH * 0.4);
        CTX.beginPath(); CTX.arc(px, py, 5, 0, Math.PI * 2);
        CTX.fillStyle = '#ff9f43'; CTX.fill();
        CTX.beginPath(); CTX.arc(px, py, 9, 0, Math.PI * 2);
        CTX.strokeStyle = '#ff9f4333'; CTX.lineWidth = 2; CTX.stroke();

        // MEZZA-COLONNA: punto intermedio tra collo e pelvi
        const msx = ((sMidX + hMidX) / 2) * W;
        const msy = ((sMidY + hMidY) / 2) * H;
        CTX.globalAlpha = Math.min(1, 0.45 + minSH * 0.4);
        CTX.beginPath(); CTX.arc(msx, msy, 4, 0, Math.PI * 2);
        CTX.fillStyle = '#ffd700'; CTX.fill();

        // Linea virtuale spine center (tratteggiata sottile)
        CTX.beginPath();
        CTX.moveTo(sMidX * W, sMidY * H);
        CTX.lineTo(hMidX * W, hMidY * H);
        CTX.strokeStyle = 'rgba(255,215,0,0.18)';
        CTX.lineWidth = 6; CTX.setLineDash([]); CTX.stroke();
    }

    CTX.globalAlpha = 1;
}

function drawSpineLine(lm, W, H, posture, viewMode) {
    const ls = lm[KP.L_SHOULDER], rs = lm[KP.R_SHOULDER];
    const lh = lm[KP.L_HIP],     rh = lm[KP.R_HIP];
    if (!ls || !rs || !lh || !rh) return;

    const isProfile = viewMode !== 'frontal';
    const spineTop  = isProfile
        ? (viewMode === 'profile-left' ? ls : rs)
        : { x:(ls.x+rs.x)/2, y:(ls.y+rs.y)/2, score:(ls.score+rs.score)/2 };
    const spineBot  = isProfile
        ? (viewMode === 'profile-left' ? lh : rh)
        : { x:(lh.x+rh.x)/2, y:(lh.y+rh.y)/2, score:(lh.score+rh.score)/2 };

    if (Math.min(spineTop.score, spineBot.score) < 0.18) return;

    const sX = spineTop.x * W, sY = spineTop.y * H;
    const hX = spineBot.x * W, hY = spineBot.y * H;

    const col = posture.status === 'good'   ? '#FFD700'
              : posture.status === 'warning' ? '#ffc107'
              : posture.status === 'bad'     ? '#ff1744'
              : '#FFD700';

    CTX.beginPath(); CTX.moveTo(sX, sY); CTX.lineTo(hX, hY);
    CTX.strokeStyle = col + '25'; CTX.lineWidth = 20; CTX.stroke();

    CTX.beginPath(); CTX.moveTo(sX, sY); CTX.lineTo(hX, hY);
    CTX.strokeStyle = col; CTX.lineWidth = 2.5;
    CTX.setLineDash([8, 5]); CTX.stroke(); CTX.setLineDash([]);

    for (const [px, py] of [[sX,sY],[hX,hY]]) {
        CTX.beginPath(); CTX.arc(px, py, 5, 0, Math.PI * 2);
        CTX.fillStyle = col; CTX.fill();
    }

    if (!posture.visible) return;

    const arcR = 40;
    CTX.beginPath(); CTX.moveTo(hX, hY); CTX.lineTo(hX, hY - arcR - 14);
    CTX.strokeStyle = 'rgba(255,255,255,0.25)'; CTX.lineWidth = 1;
    CTX.setLineDash([4,4]); CTX.stroke(); CTX.setLineDash([]);

    const angleDeg = posture.screenAngle;
    const a0 = -Math.PI / 2;
    const a1 = a0 + angleDeg * Math.PI / 180;
    CTX.beginPath();
    CTX.arc(hX, hY, arcR, Math.min(a0,a1), Math.max(a0,a1));
    CTX.strokeStyle = col; CTX.lineWidth = 2; CTX.stroke();

    const deg = Math.round(Math.abs(angleDeg));
    if (deg > 1 && spineTop.score > 0.35) {
        CTX.font      = 'bold 11px IBM Plex Mono, monospace';
        CTX.fillStyle = col;
        CTX.fillText(deg + '°', hX + (angleDeg >= 0 ? arcR + 6 : -(arcR + 32)), hY - 8);
    }

    if (isProfile) {
        const noseP = lm[KP.NOSE];
        if (noseP && noseP.score > 0.35) {
            CTX.beginPath();
            CTX.moveTo(noseP.x * W, noseP.y * H);
            CTX.lineTo(hX, hY + 20);
            CTX.strokeStyle = 'rgba(255,255,255,0.13)';
            CTX.lineWidth = 1;
            CTX.setLineDash([3, 7]); CTX.stroke(); CTX.setLineDash([]);
        }
    }
}

// ── UI ────────────────────────────────────────────────────────────────────────
function setMV(el, row, text, state) {
    el.textContent = text;
    el.className   = 'm-val ' + (state || '');
    row.className  = 'metric-row ' + (state === 'bad' ? 'warn' : state === 'warning' ? 'ok' : '');
}

function updateUI(posture, viewMode, hasBody) {
    const isProfile = viewMode !== 'frontal';
    const ex = EXERCISES[activeExercise];

    viewBadge.textContent = isProfile ? 'PROFILO' : 'FRONTALE';
    viewBadge.className   = 'view-badge' + (isProfile ? ' profile' : '');

    if (isProfile) {
        if (activeExercise === 'squat') {
            lblLat.textContent = 'SCHIENA'; lblFwd.textContent = 'GINOCCHIO'; lblSpalle.textContent = 'PROFONDITÀ';
        } else if (activeExercise === 'pushup') {
            lblLat.textContent = 'PIANO CORPO'; lblFwd.textContent = 'GOMITO'; lblSpalle.textContent = '—';
        } else {
            lblLat.textContent = 'INCL. AVANTI'; lblFwd.textContent = 'TESTA AVANTI'; lblSpalle.textContent = '—';
        }
    } else {
        lblLat.textContent = 'INCL. LAT.'; lblFwd.textContent = 'ASIMM. SPALLE'; lblSpalle.textContent = 'ALIGN. ANCHE';
    }

    const ss = posture.score >= 70 ? 'good' : posture.score >= 40 ? 'warning' : 'bad';
    setMV(vScore, document.getElementById('m-score'), posture.score + '%', ss);

    if (!posture.visible || !hasBody) {
        angleVal.textContent = '—°'; angleBadge.className = '';
        setMV(vLat, mLat, '—', ''); setMV(vFwd, mFwd, '—', '');
        setMV(vSpalle, mSpalle, '—', ''); setMV(vExtra, mExtra, '—', '');
        lblExtra.textContent = '—';
        warningBanner.classList.add('hidden');
        goodBanner.classList.add('hidden');
        repBadge.classList.add('hidden');
        if (vfCorners) vfCorners.classList.remove('good','bad');
        return;
    }

    if (activeExercise !== 'inpiedi' && !isProfile) {
        angleVal.textContent = '—°'; angleBadge.className = '';
        setMV(vLat, mLat, '—', ''); setMV(vFwd, mFwd, '—', '');
        setMV(vSpalle, mSpalle, '—', ''); setMV(vExtra, mExtra, '—', '');
        lblExtra.textContent = '—';
        warningText.textContent = '⚠ GIRATI DI PROFILO';
        warningBanner.classList.remove('hidden');
        goodBanner.classList.add('hidden');
        repBadge.classList.add('hidden');
        return;
    }

    if (activeExercise === 'squat' || activeExercise === 'pushup') {
        repBadge.classList.remove('hidden');
        repCountEl.textContent = repState.count;
    } else {
        repBadge.classList.add('hidden');
    }

    const mainAng = Math.round(Math.abs(posture.screenAngle));
    const { pr, fr } = ex;

    if (isProfile && pr.horizontal) {
        const devH = Math.round(Math.abs(90 - mainAng));
        angleVal.textContent = devH + '°';
        badgeLbl.textContent = 'PIANO';
        const a = mainAng;
        angleBadge.className = (a >= pr.angLowW && a <= pr.angHighW) ? 'good'
                             : (a <  pr.angLowB  || a >  pr.angHighB) ? 'bad' : 'warning';
    } else {
        angleVal.textContent = mainAng + '°';
        badgeLbl.textContent = activeExercise === 'squat' ? 'SCHIENA' : 'COLONNA';
        const thr = isProfile ? [pr.fwdW, pr.fwdB] : [fr.spineW, fr.spineB];
        angleBadge.className = mainAng < thr[0] ? 'good' : mainAng < thr[1] ? 'warning' : 'bad';
    }

    if (!isProfile) {
        setMV(vLat, mLat, mainAng + '°',
            mainAng < fr.spineW ? 'good' : mainAng < fr.spineB ? 'warning' : 'bad');
        setMV(vFwd, mFwd, Math.round(posture.shoulderAsym) + '%',
            posture.shoulderAsym < fr.shW ? 'good' : posture.shoulderAsym < fr.shB ? 'warning' : 'bad');
        setMV(vSpalle, mSpalle, Math.round(posture.hipAsym) + '%',
            posture.hipAsym < fr.hipW ? 'good' : posture.hipAsym < fr.hipB ? 'warning' : 'bad');

        if (activeExercise === 'squat' && posture.kneeValgus !== null) {
            lblExtra.textContent = 'VALGUS GINOCCHIO';
            const kv = posture.kneeValgus ?? 0;
            setMV(vExtra, mExtra, Math.round(kv) + '%',
                kv < fr.kneeValgusW ? 'good' : kv < fr.kneeValgusB ? 'warning' : 'bad');
        } else if (posture.earAsym !== null) {
            lblExtra.textContent = 'SIMM. ORECCHIE';
            const ea = posture.earAsym ?? 0;
            setMV(vExtra, mExtra, Math.round(ea) + '%',
                ea < (fr.earW ?? 4) ? 'good' : ea < (fr.earB ?? 8) ? 'warning' : 'bad');
        } else {
            lblExtra.textContent = '—'; setMV(vExtra, mExtra, '—', '');
        }

    } else if (activeExercise === 'squat') {
        setMV(vLat, mLat, mainAng + '°',
            mainAng < pr.fwdW ? 'good' : mainAng < pr.fwdB ? 'warning' : 'bad');
        if (posture.kneeAngle !== null) {
            const ka = posture.kneeAngle;
            setMV(vFwd, mFwd, Math.round(ka) + '°',
                ka < 100 ? 'good' : ka < pr.kneeThr ? 'warning' : 'bad');
        } else { setMV(vFwd, mFwd, '—', ''); }
        if (posture.hipDepth !== null) {
            const d = posture.hipDepth;
            setMV(vSpalle, mSpalle,
                d > 0.04 ? 'PROFONDA' : d > -0.04 ? 'OK' : 'POCO',
                d > 0.04 ? 'good'     : d > -0.04 ? 'warning' : 'bad');
        } else { setMV(vSpalle, mSpalle, '—', ''); }

        lblExtra.textContent = 'INCL. TIBIA';
        if (posture.shinLean !== null && posture.shinLean !== undefined) {
            const sl = posture.shinLean;
            setMV(vExtra, mExtra, Math.round(sl) + '°',
                sl > (pr.shinLeanMin ?? 8) ? 'good' : sl > 0 ? 'warning' : 'bad');
        } else { setMV(vExtra, mExtra, '—', ''); }

    } else if (activeExercise === 'pushup') {
        const devH = Math.round(Math.abs(90 - mainAng));
        const a = mainAng;
        setMV(vLat, mLat, devH + '°',
            (a >= pr.angLowW && a <= pr.angHighW) ? 'good'
            : (a < pr.angLowB || a > pr.angHighB) ? 'bad' : 'warning');
        if (posture.elbowAngle !== null) {
            const ea = posture.elbowAngle;
            setMV(vFwd, mFwd, Math.round(ea) + '°',
                ea < 100 ? 'good' : ea < 140 ? 'warning' : 'bad');
        } else { setMV(vFwd, mFwd, '—', ''); }
        setMV(vSpalle, mSpalle, '—', '');

        lblExtra.textContent = 'OFFSET POLSO';
        if (posture.wristShoulderDev !== null && posture.wristShoulderDev !== undefined) {
            const wd = posture.wristShoulderDev;
            setMV(vExtra, mExtra, Math.round(wd) + '%',
                wd < (pr.wristW ?? 8) ? 'good' : wd < (pr.wristB ?? 16) ? 'warning' : 'bad');
        } else { setMV(vExtra, mExtra, '—', ''); }

    } else {
        setMV(vLat, mLat, mainAng + '°',
            mainAng < pr.fwdW ? 'good' : mainAng < pr.fwdB ? 'warning' : 'bad');
        setMV(vFwd, mFwd, Math.round(posture.headFwd) + '%',
            posture.headFwd < pr.headW ? 'good' : posture.headFwd < pr.headB ? 'warning' : 'bad');
        setMV(vSpalle, mSpalle, '—', '');

        lblExtra.textContent = 'AVANZ. COLLO';
        if (posture.neckFwd !== null && posture.neckFwd !== undefined) {
            const nf = posture.neckFwd;
            setMV(vExtra, mExtra, Math.round(nf) + '%',
                nf < (pr.neckW ?? 8) ? 'good' : nf < (pr.neckB ?? 16) ? 'warning' : 'bad');
        } else { setMV(vExtra, mExtra, '—', ''); }
    }

    const { warnings, status } = posture;
    if (vfCorners) {
        vfCorners.classList.toggle('good', status === 'good');
        vfCorners.classList.toggle('bad', status === 'bad');
    }
    if (status === 'good') {
        warningBanner.classList.add('hidden');
        goodBanner.classList.remove('hidden');
        if (activeExercise === 'squat' && posture.hipDepth !== null) {
            goodBanner.textContent = posture.hipDepth > 0.04 ? '✓ BUONA PROFONDITÀ' : '✓ SCENDI DI PIÙ';
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

// ── Detection loop ────────────────────────────────────────────────────────────
function onPoseResults(keypoints) {
    if (CANVAS.width  !== VIDEO.videoWidth)  CANVAS.width  = VIDEO.videoWidth  || 640;
    if (CANVAS.height !== VIDEO.videoHeight) CANVAS.height = VIDEO.videoHeight || 480;
    const W = CANVAS.width, H = CANVAS.height;
    CTX.clearRect(0, 0, W, H);

    const vW = VIDEO.videoWidth  || W;
    const vH = VIDEO.videoHeight || H;

    const rawKps = (keypoints && keypoints.length > 0)
        ? keypoints.map(kp => ({ x: kp.x / vW, y: kp.y / vH, score: kp.score ?? 0 }))
        : null;

    const validDetection = rawKps && isValidPerson(rawKps);

    if (validDetection) {
        missingFrames = 0;
        smoothKeypoints(rawKps);
    } else {
        missingFrames++;
        if (missingFrames > MAX_MISSING) smoothedKps = null;
    }

    const lm      = (smoothedKps && missingFrames <= MAX_MISSING) ? smoothedKps : null;
    const hasBody = !!lm;

    const viewMode = lm ? detectViewMode(lm) : _stableView;
    const posture  = analyzePosture(lm ?? [], viewMode);

    if (hasBody) {
        drawVirtualPoints(lm, W, H);    // Punti calcolati: collo, mezza-colonna, pelvi
        drawSkeleton(lm, W, H);
        drawSpineLine(lm, W, H, posture, viewMode);
    }

    statusDot.className    = hasBody ? 'sdot active' : 'sdot warning';
    statusText.textContent = hasBody ? 'TRACCIAMENTO ATTIVO' : 'RICERCA CORPO...';
    updateUI(posture, viewMode, hasBody);
}

let detector = null;
let looping  = false;

async function loop() {
    if (!looping) return;
    if (detector && VIDEO.readyState >= 2) {
        try {
            const poses = await detector.estimatePoses(VIDEO, { flipHorizontal: false });
            onPoseResults(poses[0]?.keypoints ?? null);
        } catch (_) { /* skip bad frame */ }
    }
    requestAnimationFrame(loop);
}

// ── Init ──────────────────────────────────────────────────────────────────────
async function init() {
    try {
        await tf.ready();
        await tf.setBackend('webgl');

        loadingOv.querySelector('.loader-text').textContent = 'CARICAMENTO MOVENET THUNDER...';

        detector = await poseDetection.createDetector(
            poseDetection.SupportedModels.MoveNet,
            {
                modelType: poseDetection.movenet.modelType.SINGLEPOSE_THUNDER,
                enableSmoothing: false,
                minPoseScore: 0.25,
            }
        );

        const stream = await navigator.mediaDevices.getUserMedia({
            video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' },
            audio: false,
        });
        VIDEO.srcObject = stream;
        await new Promise(r => { VIDEO.onloadedmetadata = r; });
        VIDEO.play();

        statusDot.className    = 'sdot active';
        statusText.textContent = 'FOTOCAMERA ATTIVA';
        loadingOv.classList.add('hidden');
        looping = true;
        loop();
    } catch (err) {
        statusDot.className    = 'sdot error';
        statusText.textContent = 'ERRORE';
        loadingOv.querySelector('.loader-text').textContent =
            err.name === 'NotAllowedError'
                ? 'ACCESSO FOTOCAMERA NEGATO'
                : `ERRORE: ${err.message}`;
        console.error(err);
    }
}

// ── Torna alla selezione ─────────────────────────────────────────────────────
document.getElementById('back-btn').addEventListener('click', () => {
    // Ferma il loop di rilevamento
    looping = false;

    // Ferma la fotocamera
    if (VIDEO.srcObject) {
        VIDEO.srcObject.getTracks().forEach(t => t.stop());
        VIDEO.srcObject = null;
    }

    // Pulisce il canvas
    CTX.clearRect(0, 0, CANVAS.width, CANVAS.height);

    // Ferma DeepFit (se il server è attivo)
    fetch('/api/deepfit/stop', { method: 'POST' }).catch(() => {});

    // Reset stato
    smoothedKps   = null;
    missingFrames = 0;
    resetSmoothState();
    synth.cancel();
    lastStatus    = 'unknown';
    lastRepCount  = 0;

    // Resetta UI
    statusDot.className    = 'sdot';
    statusText.textContent = 'IN ATTESA';
    loadingOv.classList.add('hidden');
    warningBanner.classList.add('hidden');
    goodBanner.classList.add('hidden');
    repBadge.classList.add('hidden');
    if (vfCorners) vfCorners.classList.remove('good', 'bad');

    // Mostra la schermata di selezione
    document.getElementById('exercise-select').classList.remove('hidden');
});

// ── Selezione esercizio ───────────────────────────────────────────────────────
document.querySelectorAll('.ex-card').forEach(btn => {
    btn.addEventListener('click', () => {
        activeExercise = btn.dataset.ex;
        repState      = { count: 0, phase: 'up' };
        lastRepCount  = 0;
        lastStatus    = 'unknown';
        lastSpokenTxt = '';
        smoothedKps   = null;
        missingFrames = 0;
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
