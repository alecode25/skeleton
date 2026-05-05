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

const vLat    = document.getElementById('v-lat');
const vFwd    = document.getElementById('v-fwd');
const vSpalle = document.getElementById('v-spalle');
const vScore  = document.getElementById('v-score');
const mLat    = document.getElementById('m-lat');
const mFwd    = document.getElementById('m-fwd');
const mSpalle = document.getElementById('m-spalle');
const lblLat    = mLat.querySelector('.m-label');
const lblFwd    = document.getElementById('lbl-fwd');
const lblSpalle = document.getElementById('lbl-spalle');

// ── MediaPipe landmark indices ────────────────────────────────────────────────
const LM = {
    NOSE:        0,
    L_SHOULDER: 11, R_SHOULDER: 12,
    L_ELBOW:    13, R_ELBOW:    14,
    L_WRIST:    15, R_WRIST:    16,
    L_HIP:      23, R_HIP:      24,
    L_KNEE:     25, R_KNEE:     26,
    L_ANKLE:    27, R_ANKLE:    28,
};

// ── Skeleton visuals ──────────────────────────────────────────────────────────
const JOINT_COL = {
    0:'#ff6b6b',  1:'#ff6b6b',  2:'#ff6b6b',  3:'#ff6b6b',  4:'#ff6b6b',
    5:'#ff6b6b',  6:'#ff6b6b',  7:'#ff6b6b',  8:'#ff6b6b',  9:'#ff6b6b', 10:'#ff6b6b',
    11:'#ff9f43', 12:'#ff9f43',                               // shoulders ← key
    13:'#4b9eff', 14:'#4b9eff', 15:'#4b9eff', 16:'#4b9eff',
    17:'#4b9eff', 18:'#4b9eff', 19:'#4b9eff', 20:'#4b9eff', 21:'#4b9eff', 22:'#4b9eff',
    23:'#ff9f43', 24:'#ff9f43',                               // hips ← key
    25:'#69f0ae', 26:'#69f0ae', 27:'#69f0ae', 28:'#69f0ae',
    29:'#69f0ae', 30:'#69f0ae', 31:'#69f0ae', 32:'#69f0ae',
};
const KEY_JOINTS = new Set([11, 12, 23, 24]);

const CONNECTIONS = [
    { a:0,  b:1,  col:'rgba(255,107,107,0.55)' },
    { a:1,  b:2,  col:'rgba(255,107,107,0.55)' },
    { a:2,  b:3,  col:'rgba(255,107,107,0.55)' },
    { a:3,  b:7,  col:'rgba(255,107,107,0.55)' },
    { a:0,  b:4,  col:'rgba(255,107,107,0.55)' },
    { a:4,  b:5,  col:'rgba(255,107,107,0.55)' },
    { a:5,  b:6,  col:'rgba(255,107,107,0.55)' },
    { a:6,  b:8,  col:'rgba(255,107,107,0.55)' },
    { a:9,  b:10, col:'rgba(255,107,107,0.55)' },
    { a:11, b:12, col:'rgba(0,229,255,0.80)',   w:2.5 },
    { a:11, b:13, col:'rgba(75,158,255,0.85)',  w:2.5 },
    { a:13, b:15, col:'rgba(75,158,255,0.85)',  w:2.5 },
    { a:15, b:17, col:'rgba(75,158,255,0.65)'  },
    { a:15, b:19, col:'rgba(75,158,255,0.65)'  },
    { a:15, b:21, col:'rgba(75,158,255,0.65)'  },
    { a:17, b:19, col:'rgba(75,158,255,0.45)'  },
    { a:12, b:14, col:'rgba(75,158,255,0.85)',  w:2.5 },
    { a:14, b:16, col:'rgba(75,158,255,0.85)',  w:2.5 },
    { a:16, b:18, col:'rgba(75,158,255,0.65)'  },
    { a:16, b:20, col:'rgba(75,158,255,0.65)'  },
    { a:16, b:22, col:'rgba(75,158,255,0.65)'  },
    { a:18, b:20, col:'rgba(75,158,255,0.45)'  },
    { a:11, b:23, col:'rgba(255,159,67,0.85)',  w:2.5 },
    { a:12, b:24, col:'rgba(255,159,67,0.85)',  w:2.5 },
    { a:23, b:24, col:'rgba(0,229,255,0.80)',   w:2.5 },
    { a:23, b:25, col:'rgba(105,240,174,0.85)', w:2.5 },
    { a:25, b:27, col:'rgba(105,240,174,0.85)', w:2.5 },
    { a:27, b:29, col:'rgba(105,240,174,0.65)'  },
    { a:29, b:31, col:'rgba(105,240,174,0.55)'  },
    { a:27, b:31, col:'rgba(105,240,174,0.45)'  },
    { a:24, b:26, col:'rgba(105,240,174,0.85)', w:2.5 },
    { a:26, b:28, col:'rgba(105,240,174,0.85)', w:2.5 },
    { a:28, b:30, col:'rgba(105,240,174,0.65)'  },
    { a:30, b:32, col:'rgba(105,240,174,0.55)'  },
    { a:28, b:32, col:'rgba(105,240,174,0.45)'  },
];

// ── View mode detection ───────────────────────────────────────────────────────

let _stableView = 'frontal';
let _viewCount  = 0;

function detectViewMode(lm) {
    const ls = lm[LM.L_SHOULDER], rs = lm[LM.R_SHOULDER];
    if (!ls || !rs) return _stableView;

    const visDiff = Math.abs(ls.visibility - rs.visibility);
    const xSpan   = Math.abs(ls.x - rs.x);

    let detected = 'frontal';
    if (visDiff > 0.28 || xSpan < 0.09) {
        detected = ls.visibility >= rs.visibility ? 'profile-left' : 'profile-right';
    }

    if (detected === _stableView) {
        _viewCount = Math.min(_viewCount + 1, 20);
    } else {
        _viewCount--;
        if (_viewCount <= 0) { _stableView = detected; _viewCount = 10; }
    }
    return _stableView;
}

// ── Angles ────────────────────────────────────────────────────────────────────

function computeAngles(lm) {
    const ls = lm[LM.L_SHOULDER], rs = lm[LM.R_SHOULDER];
    const lh = lm[LM.L_HIP],     rh = lm[LM.R_HIP];
    if (!ls || !rs || !lh || !rh) return { screen: 0, depth: 0 };

    const sX = (ls.x + rs.x) / 2, sY = (ls.y + rs.y) / 2, sZ = (ls.z + rs.z) / 2;
    const hX = (lh.x + rh.x) / 2, hY = (lh.y + rh.y) / 2, hZ = (lh.z + rh.z) / 2;

    const dX = sX - hX, dY = hY - sY, dZ = sZ - hZ;
    return {
        screen: Math.atan2(dX, dY) * (180 / Math.PI),  // lateral tilt (XY plane)
        depth:  Math.atan2(dZ, dY) * (180 / Math.PI),  // forward lean (ZY plane)
    };
}

function angleBetween3pts(A, B, C) {
    const bax = A.x-B.x, bay = A.y-B.y, bcx = C.x-B.x, bcy = C.y-B.y;
    const dot = bax*bcx + bay*bcy;
    const mag = Math.hypot(bax, bay) * Math.hypot(bcx, bcy);
    if (mag === 0) return null;
    return Math.acos(Math.min(1, Math.max(-1, dot/mag))) * (180/Math.PI);
}

// ── Posture analysis ──────────────────────────────────────────────────────────

function analyzePosture(lm, viewMode) {
    const ls = lm[LM.L_SHOULDER], rs = lm[LM.R_SHOULDER];
    const lh = lm[LM.L_HIP],     rh = lm[LM.R_HIP];

    const res = {
        visible: false, viewMode,
        screenAngle: 0, depthAngle: 0,
        shoulderAsym: 0, hipAsym: 0, headFwd: 0,
        score: 0, warnings: [], status: 'unknown',
    };

    if (!ls || !rs || !lh || !rh) return res;

    const isProfile = viewMode !== 'frontal';
    const nearS = isProfile ? (viewMode === 'profile-left' ? ls : rs) : null;
    const nearH = isProfile ? (viewMode === 'profile-left' ? lh : rh) : null;

    const sVis = isProfile ? Math.max(ls.visibility, rs.visibility)
                           : (ls.visibility + rs.visibility) / 2;
    const hVis = isProfile ? Math.max(lh.visibility, rh.visibility)
                           : (lh.visibility + rh.visibility) / 2;
    res.score = Math.round(((sVis + hVis) / 2) * 100);

    const minVis = isProfile
        ? Math.min(nearS?.visibility ?? 0, nearH?.visibility ?? 0)
        : Math.min(ls.visibility, rs.visibility, lh.visibility, rh.visibility);
    if (minVis < 0.2) return res;

    res.visible = true;
    const { screen, depth } = computeAngles(lm);
    res.screenAngle  = screen;
    res.depthAngle   = depth;
    res.shoulderAsym = Math.abs(ls.y - rs.y) * 100;
    res.hipAsym      = Math.abs(lh.y - rh.y) * 100;

    // Head forward: nose Z vs near-shoulder Z (MediaPipe has Z!)
    const nose = lm[LM.NOSE];
    if (nose && nose.visibility > 0.5 && nearS) {
        res.headFwd = (nearS.z - nose.z) * 100; // positive = nose forward
    }

    const warn = [];

    if (!isProfile) {
        // FRONTAL
        if (Math.abs(screen) > 15) {
            const dir = screen > 0 ? 'destra' : 'sinistra';
            warn.push(`Schiena inclinata ${Math.round(Math.abs(screen))}° verso ${dir}`);
        }
        if (depth < -20) {
            warn.push(`Troppo in avanti — raddrizza il busto (${Math.round(Math.abs(depth))}°)`);
        }
        if (res.shoulderAsym > 6) {
            const low = rs.y > ls.y ? 'destra' : 'sinistra';
            warn.push(`Spalla ${low} più bassa — equilibra le spalle`);
        }
        if (res.hipAsym > 5) {
            const low = rh.y > lh.y ? 'destra' : 'sinistra';
            warn.push(`Anca ${low} più bassa — controlla l'allineamento`);
        }
    } else {
        // PROFILE — screen angle = sagittal lean
        const fwd = Math.abs(screen);
        if (fwd > 30) {
            warn.push(`Schiena troppo in avanti — ${Math.round(fwd)}° dalla verticale`);
        } else if (fwd > 18) {
            warn.push(`Inclinazione in avanti — ${Math.round(fwd)}°`);
        }
        if (res.headFwd > 12) {
            warn.push('Testa in avanti — rientra il mento');
        }
        const nearKnee  = viewMode === 'profile-left' ? lm[LM.L_KNEE]  : lm[LM.R_KNEE];
        const nearAnkle = viewMode === 'profile-left' ? lm[LM.L_ANKLE] : lm[LM.R_ANKLE];
        if (nearH && nearKnee?.visibility > 0.4 && nearAnkle?.visibility > 0.4) {
            const ka = angleBetween3pts(nearH, nearKnee, nearAnkle);
            if (ka !== null && ka < 100) {
                warn.push(`Ginocchio piegato ${Math.round(ka)}° — controlla la posizione`);
            }
        }
    }

    res.warnings = warn;
    res.status   = warn.length === 0 ? 'good' : warn.length === 1 ? 'warning' : 'bad';
    return res;
}

// ── Drawing ───────────────────────────────────────────────────────────────────

function drawSkeleton(lm, W, H) {
    for (const { a, b, col, w } of CONNECTIONS) {
        const la = lm[a], lb = lm[b];
        if (!la || !lb) continue;
        const vis = Math.min(la.visibility, lb.visibility);
        if (vis < 0.1) continue;
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
        if (!p || p.visibility < 0.1) continue;
        const x   = p.x * W, y = p.y * H;
        const col = JOINT_COL[i] || '#fff';
        const key = KEY_JOINTS.has(i);
        const r   = key ? 7 : 4;
        CTX.globalAlpha = Math.min(1, 0.35 + p.visibility * 0.65);
        if (key) {
            CTX.beginPath(); CTX.arc(x, y, r+4, 0, Math.PI*2);
            CTX.strokeStyle = col + '44'; CTX.lineWidth = 2; CTX.stroke();
        }
        CTX.beginPath(); CTX.arc(x, y, r, 0, Math.PI*2);
        CTX.fillStyle = col; CTX.fill();
        if (key) {
            CTX.beginPath(); CTX.arc(x, y, r*0.35, 0, Math.PI*2);
            CTX.fillStyle = 'rgba(0,0,0,0.75)'; CTX.fill();
        }
    }
    CTX.globalAlpha = 1;
}

function drawSpineLine(lm, W, H, posture, viewMode) {
    const ls = lm[LM.L_SHOULDER], rs = lm[LM.R_SHOULDER];
    const lh = lm[LM.L_HIP],     rh = lm[LM.R_HIP];
    if (!ls || !rs || !lh || !rh) return;

    const isProfile = viewMode !== 'frontal';
    const top = isProfile
        ? (viewMode === 'profile-left' ? ls : rs)
        : { x:(ls.x+rs.x)/2, y:(ls.y+rs.y)/2, visibility:(ls.visibility+rs.visibility)/2 };
    const bot = isProfile
        ? (viewMode === 'profile-left' ? lh : rh)
        : { x:(lh.x+rh.x)/2, y:(lh.y+rh.y)/2, visibility:(lh.visibility+rh.visibility)/2 };

    if (Math.min(top.visibility, bot.visibility) < 0.2) return;

    const sX = top.x*W, sY = top.y*H, hX = bot.x*W, hY = bot.y*H;
    const col = posture.status === 'good'    ? '#FFD700'
              : posture.status === 'warning'  ? '#ffc107'
              : posture.status === 'bad'      ? '#ff1744' : '#FFD700';

    // Glow
    CTX.beginPath(); CTX.moveTo(sX,sY); CTX.lineTo(hX,hY);
    CTX.strokeStyle = col+'25'; CTX.lineWidth = 20; CTX.stroke();

    // Dashed line
    CTX.beginPath(); CTX.moveTo(sX,sY); CTX.lineTo(hX,hY);
    CTX.strokeStyle = col; CTX.lineWidth = 2.5;
    CTX.setLineDash([8,5]); CTX.stroke(); CTX.setLineDash([]);

    // Endpoint dots
    for (const [px,py] of [[sX,sY],[hX,hY]]) {
        CTX.beginPath(); CTX.arc(px,py,5,0,Math.PI*2);
        CTX.fillStyle = col; CTX.fill();
    }

    if (!posture.visible) return;

    // Vertical reference + arc at hip
    const arcR = 40;
    CTX.beginPath(); CTX.moveTo(hX, hY); CTX.lineTo(hX, hY - arcR - 14);
    CTX.strokeStyle = 'rgba(255,255,255,0.25)'; CTX.lineWidth = 1;
    CTX.setLineDash([4,4]); CTX.stroke(); CTX.setLineDash([]);

    const a0 = -Math.PI/2, a1 = a0 + posture.screenAngle*Math.PI/180;
    CTX.beginPath(); CTX.arc(hX, hY, arcR, Math.min(a0,a1), Math.max(a0,a1));
    CTX.strokeStyle = col; CTX.lineWidth = 2; CTX.stroke();

    const deg = Math.round(Math.abs(posture.screenAngle));
    if (deg > 1 && top.visibility > 0.4) {
        CTX.font = 'bold 11px IBM Plex Mono, monospace';
        CTX.fillStyle = col;
        CTX.fillText(deg+'°', hX + (posture.screenAngle >= 0 ? arcR+6 : -(arcR+32)), hY-8);
    }

    if (isProfile && lm[LM.NOSE]?.visibility > 0.4) {
        const n = lm[LM.NOSE];
        CTX.beginPath(); CTX.moveTo(n.x*W, n.y*H); CTX.lineTo(hX, hY+20);
        CTX.strokeStyle = 'rgba(255,255,255,0.13)'; CTX.lineWidth = 1;
        CTX.setLineDash([3,7]); CTX.stroke(); CTX.setLineDash([]);
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

    viewBadge.textContent = isProfile ? 'PROFILO' : 'FRONTALE';
    viewBadge.className   = 'view-badge' + (isProfile ? ' profile' : '');

    if (isProfile) {
        lblLat.textContent    = 'INCL. AVANTI';
        lblFwd.textContent    = 'TESTA AVANTI';
        lblSpalle.textContent = 'GINOCCHIO';
    } else {
        lblLat.textContent    = 'INCL. LAT.';
        lblFwd.textContent    = 'LEAN AVANTI';
        lblSpalle.textContent = 'ASIMM. SPALLE';
    }

    const ss = posture.score >= 70 ? 'good' : posture.score >= 40 ? 'warning' : 'bad';
    setMV(vScore, document.getElementById('m-score'), posture.score+'%', ss);

    if (!posture.visible || !hasBody) {
        angleVal.textContent = '—°'; angleBadge.className = '';
        setMV(vLat,mLat,'—',''); setMV(vFwd,mFwd,'—',''); setMV(vSpalle,mSpalle,'—','');
        warningBanner.classList.add('hidden'); goodBanner.classList.add('hidden');
        return;
    }

    const mainAng = Math.round(Math.abs(posture.screenAngle));
    angleVal.textContent = mainAng+'°';
    const thr = isProfile ? [18,30] : [15,25];
    angleBadge.className = mainAng < thr[0] ? 'good' : mainAng < thr[1] ? 'warning' : 'bad';

    if (!isProfile) {
        const ls = mainAng < 15 ? 'good' : mainAng < 25 ? 'warning' : 'bad';
        setMV(vLat, mLat, mainAng+'°', ls);

        const da = Math.abs(posture.depthAngle);
        setMV(vFwd, mFwd, Math.round(da)+'°',
              da < 20 ? 'good' : da < 35 ? 'warning' : 'bad');

        setMV(vSpalle, mSpalle, Math.round(posture.shoulderAsym)+'%',
              posture.shoulderAsym < 6 ? 'good' : posture.shoulderAsym < 12 ? 'warning' : 'bad');
    } else {
        setMV(vLat, mLat, mainAng+'°',
              mainAng < 18 ? 'good' : mainAng < 30 ? 'warning' : 'bad');
        setMV(vFwd, mFwd, Math.round(posture.headFwd)+'%',
              posture.headFwd < 8 ? 'good' : posture.headFwd < 14 ? 'warning' : 'bad');
        setMV(vSpalle, mSpalle, '—', '');
    }

    const { warnings, status } = posture;
    if (status === 'good') {
        warningBanner.classList.add('hidden');
        goodBanner.classList.remove('hidden');
    } else {
        goodBanner.classList.add('hidden');
        const wi = Math.floor(Date.now() / 2400) % warnings.length;
        warningText.textContent = '⚠ ' + warnings[wi].toUpperCase();
        warningBanner.classList.remove('hidden');
    }
}

// ── MediaPipe Pose ────────────────────────────────────────────────────────────

function onResults(results) {
    if (CANVAS.width  !== VIDEO.videoWidth)  CANVAS.width  = VIDEO.videoWidth  || 640;
    if (CANVAS.height !== VIDEO.videoHeight) CANVAS.height = VIDEO.videoHeight || 480;
    const W = CANVAS.width, H = CANVAS.height;
    CTX.clearRect(0, 0, W, H);

    const lm      = results.poseLandmarks;
    const hasBody = !!lm && lm.length > 0;
    const viewMode = hasBody ? detectViewMode(lm) : _stableView;
    const posture  = analyzePosture(lm ?? [], viewMode);

    if (hasBody) {
        drawSkeleton(lm, W, H);
        drawSpineLine(lm, W, H, posture, viewMode);
    }

    statusDot.className    = hasBody ? 'sdot active' : 'sdot warning';
    statusText.textContent = hasBody ? 'TRACCIAMENTO ATTIVO' : 'RICERCA CORPO...';
    updateUI(posture, viewMode, hasBody);
}

const pose = new Pose({
    locateFile: file => `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`
});

pose.setOptions({
    modelComplexity:         0,
    smoothLandmarks:         true,
    enableSegmentation:      false,
    smoothSegmentation:      false,
    minDetectionConfidence:  0.4,
    minTrackingConfidence:   0.4,
});

pose.onResults(onResults);

const camera = new Camera(VIDEO, {
    onFrame: async () => { await pose.send({ image: VIDEO }); },
    width:  640,
    height: 480,
});

camera.start()
    .then(() => {
        statusDot.className    = 'sdot active';
        statusText.textContent = 'FOTOCAMERA ATTIVA';
        loadingOv.classList.add('hidden');
    })
    .catch(err => {
        statusDot.className    = 'sdot error';
        statusText.textContent = 'ERRORE FOTOCAMERA';
        loadingOv.querySelector('.loader-text').textContent =
            err.name === 'NotAllowedError'
                ? 'ACCESSO FOTOCAMERA NEGATO'
                : 'ERRORE INIZIALIZZAZIONE';
        console.error(err);
    });
