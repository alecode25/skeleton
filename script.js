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

const vLat    = document.getElementById('v-lat');
const vFwd    = document.getElementById('v-fwd');
const vSpalle = document.getElementById('v-spalle');
const vScore  = document.getElementById('v-score');
const mLat    = document.getElementById('m-lat');
const mFwd    = document.getElementById('m-fwd');
const mSpalle = document.getElementById('m-spalle');
const lblLat    = document.getElementById('m-lat').querySelector('.m-label');
const lblFwd    = document.getElementById('lbl-fwd');
const lblSpalle = document.getElementById('lbl-spalle');

// ── MoveNet keypoint indices ──────────────────────────────────────────────────
const KP = {
    NOSE:           0,
    L_EYE: 1, R_EYE: 2, L_EAR: 3, R_EAR: 4,
    L_SHOULDER:     5,  R_SHOULDER:  6,
    L_ELBOW:        7,  R_ELBOW:     8,
    L_WRIST:        9,  R_WRIST:    10,
    L_HIP:         11,  R_HIP:      12,
    L_KNEE:        13,  R_KNEE:     14,
    L_ANKLE:       15,  R_ANKLE:    16,
};

// ── Skeleton visuals ──────────────────────────────────────────────────────────
// Index → color
const JOINT_COL = [
    '#ff6b6b',  // 0  nose
    '#ff6b6b',  // 1  l_eye
    '#ff6b6b',  // 2  r_eye
    '#ff6b6b',  // 3  l_ear
    '#ff6b6b',  // 4  r_ear
    '#ff9f43',  // 5  l_shoulder  ← key
    '#ff9f43',  // 6  r_shoulder  ← key
    '#4b9eff',  // 7  l_elbow
    '#4b9eff',  // 8  r_elbow
    '#4b9eff',  // 9  l_wrist
    '#4b9eff',  // 10 r_wrist
    '#ff9f43',  // 11 l_hip       ← key
    '#ff9f43',  // 12 r_hip       ← key
    '#69f0ae',  // 13 l_knee
    '#69f0ae',  // 14 r_knee
    '#69f0ae',  // 15 l_ankle
    '#69f0ae',  // 16 r_ankle
];
const KEY_JOINTS = new Set([5, 6, 11, 12]);

const CONNECTIONS = [
    // Face
    { a:3,  b:1,  col:'rgba(255,107,107,0.55)' },
    { a:1,  b:0,  col:'rgba(255,107,107,0.55)' },
    { a:0,  b:2,  col:'rgba(255,107,107,0.55)' },
    { a:2,  b:4,  col:'rgba(255,107,107,0.55)' },
    // Shoulder bar
    { a:5,  b:6,  col:'rgba(0,229,255,0.80)',   w:2.5 },
    // Left arm
    { a:5,  b:7,  col:'rgba(75,158,255,0.85)',  w:2.5 },
    { a:7,  b:9,  col:'rgba(75,158,255,0.85)',  w:2.5 },
    // Right arm
    { a:6,  b:8,  col:'rgba(75,158,255,0.85)',  w:2.5 },
    { a:8,  b:10, col:'rgba(75,158,255,0.85)',  w:2.5 },
    // Torso
    { a:5,  b:11, col:'rgba(255,159,67,0.85)',  w:2.5 },
    { a:6,  b:12, col:'rgba(255,159,67,0.85)',  w:2.5 },
    // Hip bar
    { a:11, b:12, col:'rgba(0,229,255,0.80)',   w:2.5 },
    // Left leg
    { a:11, b:13, col:'rgba(105,240,174,0.85)', w:2.5 },
    { a:13, b:15, col:'rgba(105,240,174,0.85)', w:2.5 },
    // Right leg
    { a:12, b:14, col:'rgba(105,240,174,0.85)', w:2.5 },
    { a:14, b:16, col:'rgba(105,240,174,0.85)', w:2.5 },
];

// ── Exercise configs ──────────────────────────────────────────────────────────
// fr = frontal rules, pr = profile rules
// kneeMode: 'lt' = warn if angle < kneeThr (bent when shouldn't), 'gt' = warn if > kneeThr (not bent enough)
const EXERCISES = {
    postura: {
        name: 'POSTURA ERETTA',
        fr: { spineW:15, spineB:25, shW:6, shB:12, hipW:5, hipB:10 },
        pr: { fwdW:18, fwdB:30, headW:8, headB:14, kneeMode:'lt', kneeThr:100 },
    },
    squat: {
        name: 'SQUAT',
        fr: { spineW:15, spineB:25, shW:8, shB:16, hipW:8, hipB:16 },
        pr: { fwdW:45, fwdB:65, headW:20, headB:30, kneeMode:'gt', kneeThr:140 },
    },
    stacco: {
        name: 'STACCO',
        fr: { spineW:15, spineB:25, shW:6, shB:12, hipW:5, hipB:10 },
        pr: { fwdW:30, fwdB:50, headW:15, headB:22, kneeMode:'none' },
    },
    plank: {
        name: 'PLANK',
        fr: { spineW:15, spineB:25, shW:6, shB:12, hipW:5, hipB:10 },
        // horizontal=true: good when |angle| 65-105°, warn outside, bad < 50° or > 115°
        pr: { horizontal:true, angLowB:50, angLowW:65, angHighW:105, angHighB:115, headW:25, headB:35, kneeMode:'none' },
    },
};

let activeExercise = 'postura';

// ── View mode detection ───────────────────────────────────────────────────────

let _stableView = 'frontal';
let _viewCount  = 0;

function detectViewMode(lm) {
    const ls = lm[KP.L_SHOULDER], rs = lm[KP.R_SHOULDER];
    if (!ls || !rs) return _stableView;

    const visDiff  = Math.abs(ls.score - rs.score);
    // Normalized shoulder X-span (close to 0 = profile)
    const xSpan    = Math.abs(ls.x - rs.x);

    let detected = 'frontal';
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

// ── Angles ────────────────────────────────────────────────────────────────────

function computeScreenAngle(lm) {
    const ls = lm[KP.L_SHOULDER], rs = lm[KP.R_SHOULDER];
    const lh = lm[KP.L_HIP],     rh = lm[KP.R_HIP];
    if (!ls || !rs || !lh || !rh) return 0;

    const sX = (ls.x + rs.x) / 2, sY = (ls.y + rs.y) / 2;
    const hX = (lh.x + rh.x) / 2, hY = (lh.y + rh.y) / 2;
    // Vector hips→shoulders, angle from vertical (positive = tilted right)
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

// ── Posture analysis ──────────────────────────────────────────────────────────

function analyzePosture(lm, viewMode) {
    const ls = lm[KP.L_SHOULDER], rs = lm[KP.R_SHOULDER];
    const lh = lm[KP.L_HIP],     rh = lm[KP.R_HIP];

    const res = {
        visible: false, viewMode,
        screenAngle: 0,
        shoulderAsym: 0, hipAsym: 0, headFwd: 0, kneeAngle: null,
        score: 0, warnings: [], status: 'unknown',
    };

    if (!ls || !rs || !lh || !rh) return res;

    const isProfile  = viewMode !== 'frontal';
    const nearS = isProfile ? (viewMode === 'profile-left' ? ls : rs) : null;
    const nearH = isProfile ? (viewMode === 'profile-left' ? lh : rh) : null;

    // Score: best visible side in profile, average in frontal
    const sScore = isProfile ? Math.max(ls.score, rs.score) : (ls.score + rs.score) / 2;
    const hScore = isProfile ? Math.max(lh.score, rh.score) : (lh.score + rh.score) / 2;
    res.score = Math.round(((sScore + hScore) / 2) * 100);

    const minVis = isProfile
        ? Math.min(nearS?.score ?? 0, nearH?.score ?? 0)
        : Math.min(ls.score, rs.score, lh.score, rh.score);
    if (minVis < 0.2) return res;

    res.visible      = true;
    res.screenAngle  = computeScreenAngle(lm);
    res.shoulderAsym = Math.abs(ls.y - rs.y) * 100;
    res.hipAsym      = Math.abs(lh.y - rh.y) * 100;

    // Head forward check (nose X vs shoulder X in profile)
    const nose = lm[KP.NOSE];
    if (isProfile && nose && nose.score > 0.4 && nearS) {
        res.headFwd = Math.abs(nose.x - nearS.x) * 100;
    }

    const ex   = EXERCISES[activeExercise];
    const warn = [];

    if (!isProfile) {
        // ── FRONTAL ──
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
    } else {
        // ── PROFILE ──
        const pr  = ex.pr;
        const fwd = Math.abs(res.screenAngle);

        if (pr.horizontal) {
            // PLANK: body should be horizontal (|angle| ≈ 90°)
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

        if (res.headFwd > pr.headW) {
            warn.push('Testa in avanti — rientra il mento');
        }

        // Knee angle
        const nearKnee  = viewMode === 'profile-left' ? lm[KP.L_KNEE]  : lm[KP.R_KNEE];
        const nearAnkle = viewMode === 'profile-left' ? lm[KP.L_ANKLE] : lm[KP.R_ANKLE];
        if (nearH && nearKnee?.score > 0.4 && nearAnkle?.score > 0.4) {
            const ka = angleBetween3pts(nearH, nearKnee, nearAnkle);
            if (ka !== null) {
                res.kneeAngle = ka;
                if (pr.kneeMode === 'lt' && ka < pr.kneeThr) {
                    warn.push(`Ginocchio piegato ${Math.round(ka)}° — controlla la posizione`);
                } else if (pr.kneeMode === 'gt' && ka > pr.kneeThr) {
                    warn.push(`Ginocchio troppo dritto ${Math.round(ka)}° — scendi di più`);
                }
            }
        }
    }

    res.warnings = warn;
    res.status   = warn.length === 0 ? 'good'
                 : warn.length === 1 ? 'warning' : 'bad';
    return res;
}

// ── Drawing ───────────────────────────────────────────────────────────────────

function drawSkeleton(lm, W, H) {
    // Connections
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

    // Joints
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

    if (Math.min(spineTop.score, spineBot.score) < 0.2) return;

    const sX = spineTop.x * W, sY = spineTop.y * H;
    const hX = spineBot.x * W, hY = spineBot.y * H;

    const col = posture.status === 'good'    ? '#FFD700'
              : posture.status === 'warning'  ? '#ffc107'
              : posture.status === 'bad'      ? '#ff1744'
              : '#FFD700';

    // Glow
    CTX.beginPath(); CTX.moveTo(sX, sY); CTX.lineTo(hX, hY);
    CTX.strokeStyle = col + '25'; CTX.lineWidth = 20; CTX.stroke();

    // Dashed spine line
    CTX.beginPath(); CTX.moveTo(sX, sY); CTX.lineTo(hX, hY);
    CTX.strokeStyle = col; CTX.lineWidth = 2.5;
    CTX.setLineDash([8, 5]); CTX.stroke(); CTX.setLineDash([]);

    // Endpoint dots
    for (const [px, py] of [[sX,sY],[hX,hY]]) {
        CTX.beginPath(); CTX.arc(px, py, 5, 0, Math.PI*2);
        CTX.fillStyle = col; CTX.fill();
    }

    if (!posture.visible) return;

    // Vertical reference at hip
    const arcR = 40;
    CTX.beginPath(); CTX.moveTo(hX, hY); CTX.lineTo(hX, hY - arcR - 14);
    CTX.strokeStyle = 'rgba(255,255,255,0.25)'; CTX.lineWidth = 1;
    CTX.setLineDash([4,4]); CTX.stroke(); CTX.setLineDash([]);

    // Angle arc
    const angleDeg = posture.screenAngle;
    const a0 = -Math.PI / 2;
    const a1 = a0 + angleDeg * Math.PI / 180;
    CTX.beginPath();
    CTX.arc(hX, hY, arcR, Math.min(a0,a1), Math.max(a0,a1));
    CTX.strokeStyle = col; CTX.lineWidth = 2; CTX.stroke();

    // Angle label
    const deg = Math.round(Math.abs(angleDeg));
    if (deg > 1 && spineTop.score > 0.4) {
        CTX.font      = 'bold 11px IBM Plex Mono, monospace';
        CTX.fillStyle = col;
        CTX.fillText(deg + '°', hX + (angleDeg >= 0 ? arcR + 6 : -(arcR + 32)), hY - 8);
    }

    // Profile: plumb line from nose to give full-body reference
    if (isProfile) {
        const nose = lm[KP.NOSE];
        if (nose && nose.score > 0.4) {
            CTX.beginPath();
            CTX.moveTo(nose.x * W, nose.y * H);
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

    viewBadge.textContent = isProfile ? 'PROFILO' : 'FRONTALE';
    viewBadge.className   = 'view-badge' + (isProfile ? ' profile' : '');

    // Update metric labels per view / exercise
    const ex = EXERCISES[activeExercise];
    if (isProfile) {
        lblLat.textContent    = ex.pr.horizontal ? 'PIANO' : 'INCL. AVANTI';
        lblFwd.textContent    = 'TESTA AVANTI';
        lblSpalle.textContent = (activeExercise === 'postura' || activeExercise === 'squat') ? 'GINOCCHIO' : '—';
    } else {
        lblLat.textContent    = 'INCL. LAT.';
        lblFwd.textContent    = 'ASIMM. SPALLE';
        lblSpalle.textContent = 'ALIGN. ANCHE';
    }

    // Score
    const ss = posture.score >= 70 ? 'good' : posture.score >= 40 ? 'warning' : 'bad';
    setMV(vScore, document.getElementById('m-score'), posture.score + '%', ss);

    if (!posture.visible || !hasBody) {
        angleVal.textContent = '—°'; angleBadge.className = '';
        setMV(vLat, mLat, '—', ''); setMV(vFwd, mFwd, '—', '');
        setMV(vSpalle, mSpalle, '—', '');
        warningBanner.classList.add('hidden');
        goodBanner.classList.add('hidden');
        return;
    }

    // Primary angle badge
    const mainAng = Math.round(Math.abs(posture.screenAngle));
    const { pr, fr } = ex;

    if (isProfile && pr.horizontal) {
        // Plank: show deviation from horizontal (0° = perfect)
        const devH = Math.round(Math.abs(90 - mainAng));
        angleVal.textContent = devH + '°';
        const a = mainAng;
        angleBadge.className = (a >= pr.angLowW && a <= pr.angHighW) ? 'good'
                             : (a <  pr.angLowB  || a >  pr.angHighB) ? 'bad' : 'warning';
    } else {
        angleVal.textContent = mainAng + '°';
        const thr = isProfile ? [pr.fwdW, pr.fwdB] : [fr.spineW, fr.spineB];
        angleBadge.className = mainAng < thr[0] ? 'good' : mainAng < thr[1] ? 'warning' : 'bad';
    }

    if (!isProfile) {
        const ls = mainAng < fr.spineW ? 'good' : mainAng < fr.spineB ? 'warning' : 'bad';
        setMV(vLat, mLat, mainAng + '°', ls);

        const as = posture.shoulderAsym < fr.shW ? 'good' : posture.shoulderAsym < fr.shB ? 'warning' : 'bad';
        setMV(vFwd, mFwd, Math.round(posture.shoulderAsym) + '%', as);

        const hs = posture.hipAsym < fr.hipW ? 'good' : posture.hipAsym < fr.hipB ? 'warning' : 'bad';
        setMV(vSpalle, mSpalle, Math.round(posture.hipAsym) + '%', hs);
    } else if (pr.horizontal) {
        // Plank profile
        const devH = Math.round(Math.abs(90 - mainAng));
        const a  = mainAng;
        const ps = (a >= pr.angLowW && a <= pr.angHighW) ? 'good'
                 : (a <  pr.angLowB  || a >  pr.angHighB) ? 'bad' : 'warning';
        setMV(vLat, mLat, devH + '°', ps);

        const hf = posture.headFwd;
        setMV(vFwd, mFwd, Math.round(hf) + '%', hf < pr.headW ? 'good' : hf < pr.headB ? 'warning' : 'bad');
        setMV(vSpalle, mSpalle, '—', '');
    } else {
        const fs = mainAng < pr.fwdW ? 'good' : mainAng < pr.fwdB ? 'warning' : 'bad';
        setMV(vLat, mLat, mainAng + '°', fs);

        const hf = posture.headFwd;
        setMV(vFwd, mFwd, Math.round(hf) + '%', hf < pr.headW ? 'good' : hf < pr.headB ? 'warning' : 'bad');

        if (posture.kneeAngle !== null && pr.kneeMode !== 'none') {
            const ka = posture.kneeAngle;
            const ks = pr.kneeMode === 'lt'
                ? (ka >= pr.kneeThr ? 'good' : ka >= pr.kneeThr - 25 ? 'warning' : 'bad')
                : (ka <= pr.kneeThr - 30 ? 'good' : ka <= pr.kneeThr ? 'warning' : 'bad');
            setMV(vSpalle, mSpalle, Math.round(ka) + '°', ks);
        } else {
            setMV(vSpalle, mSpalle, '—', '');
        }
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

// ── Detect loop ───────────────────────────────────────────────────────────────

function onPoseResults(keypoints) {
    if (CANVAS.width  !== VIDEO.videoWidth)  CANVAS.width  = VIDEO.videoWidth  || 640;
    if (CANVAS.height !== VIDEO.videoHeight) CANVAS.height = VIDEO.videoHeight || 480;
    const W = CANVAS.width, H = CANVAS.height;
    CTX.clearRect(0, 0, W, H);

    const hasBody = !!keypoints && keypoints.length > 0;

    // Normalize pixel coords → [0,1]  (MoveNet returns absolute pixels)
    const vW = VIDEO.videoWidth  || W;
    const vH = VIDEO.videoHeight || H;
    const lm = hasBody ? keypoints.map(kp => ({
        x: kp.x / vW, y: kp.y / vH, score: kp.score ?? 0,
    })) : null;

    const viewMode = lm ? detectViewMode(lm) : _stableView;
    const posture  = analyzePosture(lm ?? [], viewMode);

    if (lm) {
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
                modelType: poseDetection.movenet.modelType.SINGLEPOSE_LIGHTNING,
                enableSmoothing: true,
                minPoseScore: 0.15,
            }
        );

        const stream = await navigator.mediaDevices.getUserMedia({
            video: { width: 640, height: 480, facingMode: 'user' },
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

// ── Exercise selection ────────────────────────────────────────────────────────
document.querySelectorAll('.ex-card').forEach(btn => {
    btn.addEventListener('click', () => {
        activeExercise = btn.dataset.ex;
        if (exerciseBadge) exerciseBadge.textContent = EXERCISES[activeExercise].name;
        document.getElementById('exercise-select').classList.add('hidden');
        init();
    });
});
