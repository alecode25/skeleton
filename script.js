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

// Metric label spans (we'll update text based on view mode)
const lblLat    = mLat.querySelector('.m-label');
const lblFwd    = mFwd.querySelector('.m-label');
const lblSpalle = mSpalle.querySelector('.m-label');

// ── Skeleton colors ───────────────────────────────────────────────────────────

const JOINT_COL = {
    0:'#ff6b6b',  1:'#ff6b6b',  2:'#ff6b6b',  3:'#ff6b6b',  4:'#ff6b6b',
    5:'#ff6b6b',  6:'#ff6b6b',  7:'#ff6b6b',  8:'#ff6b6b',  9:'#ff6b6b', 10:'#ff6b6b',
    11:'#ff9f43', 12:'#ff9f43',
    13:'#4b9eff', 14:'#4b9eff', 15:'#4b9eff', 16:'#4b9eff',
    17:'#4b9eff', 18:'#4b9eff', 19:'#4b9eff', 20:'#4b9eff', 21:'#4b9eff', 22:'#4b9eff',
    23:'#ff9f43', 24:'#ff9f43',
    25:'#69f0ae', 26:'#69f0ae', 27:'#69f0ae', 28:'#69f0ae',
    29:'#69f0ae', 30:'#69f0ae', 31:'#69f0ae', 32:'#69f0ae',
};

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
    { a:11, b:12, col:'rgba(0,229,255,0.75)',   w:2.5 },
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
    { a:23, b:24, col:'rgba(0,229,255,0.75)',   w:2.5 },
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
// Strategy: narrow shoulder X-span OR large visibility difference → profile

let _stableView = 'frontal';
let _viewCount  = 0;
const VIEW_HYSTERESIS = 10; // frames needed to confirm view switch

function detectViewMode(lm) {
    const l11 = lm[11], l12 = lm[12];
    if (!l11 || !l12 || l11.visibility < 0.2 || l12.visibility < 0.2) return _stableView;

    const visDiff    = Math.abs(l11.visibility - l12.visibility);
    const xSpan      = Math.abs(l11.x - l12.x);

    let detected = 'frontal';
    if (visDiff > 0.28 || xSpan < 0.09) {
        // One shoulder much more visible or shoulders very close in X = profile
        detected = (l11.visibility >= l12.visibility) ? 'profile-left' : 'profile-right';
    }

    if (detected === _stableView) {
        _viewCount = Math.min(_viewCount + 1, VIEW_HYSTERESIS * 2);
    } else {
        _viewCount--;
        if (_viewCount <= 0) {
            _stableView = detected;
            _viewCount  = VIEW_HYSTERESIS;
        }
    }
    return _stableView;
}

// ── Angles ────────────────────────────────────────────────────────────────────

function computeAngles(lm) {
    const l11 = lm[11], l12 = lm[12];
    const l23 = lm[23], l24 = lm[24];
    if (!l11 || !l12 || !l23 || !l24) return { screen: 0, depth: 0 };

    const sX = (l11.x + l12.x) / 2,  hX = (l23.x + l24.x) / 2;
    const sY = (l11.y + l12.y) / 2,  hY = (l23.y + l24.y) / 2;
    const sZ = (l11.z + l12.z) / 2,  hZ = (l23.z + l24.z) / 2;

    // screen: angle of spine in XY plane from vertical (rad→deg)
    // positive = tilted right, negative = tilted left
    const dX = sX - hX;
    const dY = hY - sY; // positive: shoulders above hips (normal)
    const screen = Math.atan2(dX, dY) * (180 / Math.PI);

    // depth: angle in ZY plane from vertical (negative = leaning toward camera)
    const dZ = sZ - hZ;
    const depth = Math.atan2(dZ, dY) * (180 / Math.PI);

    return { screen, depth };
}

// 3-point angle in degrees (vectors BA and BC)
function angleBetween(A, B, C) {
    const BAx = A.x - B.x, BAy = A.y - B.y;
    const BCx = C.x - B.x, BCy = C.y - B.y;
    const dot  = BAx * BCx + BAy * BCy;
    const magA = Math.hypot(BAx, BAy);
    const magC = Math.hypot(BCx, BCy);
    if (magA === 0 || magC === 0) return null;
    return Math.acos(Math.min(1, Math.max(-1, dot / (magA * magC)))) * (180 / Math.PI);
}

// ── Posture analysis ──────────────────────────────────────────────────────────

function analyzePosture(lm, viewMode) {
    const l11 = lm[11], l12 = lm[12];
    const l23 = lm[23], l24 = lm[24];

    const res = {
        visible: false, viewMode,
        screenAngle: 0, depthAngle: 0,
        shoulderAsym: 0, headFwd: 0,
        score: 0, warnings: [], status: 'unknown',
    };

    if (!l11 || !l12 || !l23 || !l24) return res;

    const isProfile = viewMode !== 'frontal';
    const nearS = isProfile
        ? (viewMode === 'profile-left' ? l11 : l12)
        : { x:(l11.x+l12.x)/2, y:(l11.y+l12.y)/2, visibility:(l11.visibility+l12.visibility)/2 };
    const nearH = isProfile
        ? (viewMode === 'profile-left' ? l23 : l24)
        : { x:(l23.x+l24.x)/2, y:(l23.y+l24.y)/2, visibility:(l23.visibility+l24.visibility)/2 };

    // Score: in profile use best visible side; in frontal use average
    const sVis = isProfile
        ? Math.max(l11.visibility, l12.visibility)
        : (l11.visibility + l12.visibility) / 2;
    const hVis = isProfile
        ? Math.max(l23.visibility, l24.visibility)
        : (l23.visibility + l24.visibility) / 2;
    res.score = Math.round(((sVis + hVis) / 2) * 100);

    if (Math.min(nearS.visibility, nearH.visibility) < 0.25) return res;
    res.visible = true;

    const { screen, depth } = computeAngles(lm);
    res.screenAngle  = screen;
    res.depthAngle   = depth;
    res.shoulderAsym = Math.abs(l12.y - l11.y) * 100;

    // Head forward check: nose Z vs shoulder Z
    const nose = lm[0];
    if (nose && nose.visibility > 0.5) {
        res.headFwd = nearS.z - (nose.z || 0); // positive = nose more forward than shoulder
    }

    const warn = [];

    if (!isProfile) {
        // ── FRONTAL analysis ──
        // 1. Lateral spine tilt (screen angle)
        if (Math.abs(screen) > 15) {
            const dir = screen > 0 ? 'destra' : 'sinistra';
            warn.push(`Schiena inclinata ${Math.round(Math.abs(screen))}° verso ${dir}`);
        }
        // 2. Forward lean (3D depth angle)
        if (depth < -20) {
            warn.push(`Troppo in avanti — raddrizza il busto (${Math.round(Math.abs(depth))}°)`);
        }
        // 3. Shoulder height asymmetry
        if (res.shoulderAsym > 6) {
            const low = l12.y > l11.y ? 'destra' : 'sinistra';
            warn.push(`Spalla ${low} più bassa — equilibra le spalle`);
        }
    } else {
        // ── PROFILE analysis ──
        // Primary: screen angle = sagittal lean (forward/backward)
        // In profile, a negative screen angle = leaning forward (toward camera left)
        const fwdAngle = Math.abs(screen);
        if (fwdAngle > 30) {
            warn.push(`Schiena troppo inclinata in avanti — ${Math.round(fwdAngle)}° dalla verticale`);
        } else if (fwdAngle > 18) {
            warn.push(`Inclinazione in avanti — ${Math.round(fwdAngle)}° dalla verticale`);
        }

        // Hip-knee-ankle chain angle (knee not too far forward)
        const nearKnee   = viewMode === 'profile-left' ? lm[25] : lm[26];
        const nearAnkle  = viewMode === 'profile-left' ? lm[27] : lm[28];
        if (nearH && nearKnee && nearAnkle &&
            nearKnee.visibility > 0.4 && nearAnkle.visibility > 0.4) {
            const kneeAng = angleBetween(nearH, nearKnee, nearAnkle);
            if (kneeAng !== null && kneeAng < 155) {
                // Knee significantly bent — ok for squats but flag if unexpected
                // Just show as info for now
            }
        }

        // Head jutting forward: nose much more forward (in X) than shoulder
        if (res.headFwd > 0.12) {
            warn.push('Testa in avanti — rientra il mento');
        }
    }

    res.warnings = warn;
    res.status   = warn.length === 0 ? 'good'
                 : warn.length === 1 ? 'warning' : 'bad';

    return res;
}

// ── Drawing ───────────────────────────────────────────────────────────────────

function drawSkeleton(lm, W, H) {
    if (!lm || lm.length === 0) return;

    // Draw connections — visibility modulates opacity
    for (const { a, b, col, w } of CONNECTIONS) {
        const la = lm[a], lb = lm[b];
        if (!la || !lb) continue;
        const vis = Math.min(la.visibility, lb.visibility);
        if (vis < 0.1) continue;

        // Parse color and apply visibility alpha scaling
        CTX.beginPath();
        CTX.moveTo(la.x * W, la.y * H);
        CTX.lineTo(lb.x * W, lb.y * H);
        CTX.strokeStyle = col;
        CTX.lineWidth = (w || 2) * Math.min(1, 0.3 + vis * 0.7);
        CTX.globalAlpha = Math.min(1, 0.4 + vis * 0.6);
        CTX.stroke();
    }
    CTX.globalAlpha = 1;

    // Draw joints
    for (let i = 0; i < lm.length; i++) {
        const p = lm[i];
        if (!p || p.visibility < 0.15) continue;

        const x = p.x * W, y = p.y * H;
        const col   = JOINT_COL[i] || '#ffffff';
        const isKey = [11,12,23,24].includes(i);
        const r     = isKey ? 7 : 4;

        CTX.globalAlpha = Math.min(1, 0.4 + p.visibility * 0.6);

        if (isKey) {
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

        if (isKey) {
            CTX.beginPath();
            CTX.arc(x, y, r * 0.36, 0, Math.PI * 2);
            CTX.fillStyle = 'rgba(0,0,0,0.75)';
            CTX.fill();
        }
    }
    CTX.globalAlpha = 1;
}

function drawSpineLine(lm, W, H, posture, viewMode) {
    const l11 = lm[11], l12 = lm[12];
    const l23 = lm[23], l24 = lm[24];
    if (!l11 || !l12 || !l23 || !l24) return;

    const isProfile = viewMode !== 'frontal';

    // Use near-side shoulder/hip in profile, midpoints in frontal
    const spineTop = isProfile
        ? (viewMode === 'profile-left' ? l11 : l12)
        : { x:(l11.x+l12.x)/2, y:(l11.y+l12.y)/2,
            visibility:(l11.visibility+l12.visibility)/2 };
    const spineBot = isProfile
        ? (viewMode === 'profile-left' ? l23 : l24)
        : { x:(l23.x+l24.x)/2, y:(l23.y+l24.y)/2,
            visibility:(l23.visibility+l24.visibility)/2 };

    const spineVis = Math.min(spineTop.visibility, spineBot.visibility);
    if (spineVis < 0.2) return;

    const sX = spineTop.x * W, sY = spineTop.y * H;
    const hX = spineBot.x * W, hY = spineBot.y * H;

    const col = posture.status === 'good'    ? '#FFD700'
              : posture.status === 'warning'  ? '#ffc107'
              : posture.status === 'bad'      ? '#ff1744'
              : '#FFD700';

    // Glow
    CTX.beginPath(); CTX.moveTo(sX, sY); CTX.lineTo(hX, hY);
    CTX.strokeStyle = col + '28'; CTX.lineWidth = 18; CTX.stroke();

    // Core dashed line
    CTX.beginPath(); CTX.moveTo(sX, sY); CTX.lineTo(hX, hY);
    CTX.strokeStyle = col; CTX.lineWidth = 2.5;
    CTX.setLineDash([8, 5]); CTX.stroke(); CTX.setLineDash([]);

    // Endpoint dots
    for (const [px, py] of [[sX, sY], [hX, hY]]) {
        CTX.beginPath(); CTX.arc(px, py, 5, 0, Math.PI * 2);
        CTX.fillStyle = col; CTX.fill();
    }

    // Angle arc at hip
    if (!posture.visible) return;
    const arcR   = 40;
    // Vertical reference
    CTX.beginPath(); CTX.moveTo(hX, hY); CTX.lineTo(hX, hY - arcR - 12);
    CTX.strokeStyle = 'rgba(255,255,255,0.28)'; CTX.lineWidth = 1.2;
    CTX.setLineDash([4, 4]); CTX.stroke(); CTX.setLineDash([]);

    // Arc sweeping from vertical to spine direction
    const angleDeg = posture.screenAngle;
    const a0 = -Math.PI / 2;
    const a1 = a0 + (angleDeg * Math.PI / 180);
    CTX.beginPath();
    CTX.arc(hX, hY, arcR, Math.min(a0, a1), Math.max(a0, a1));
    CTX.strokeStyle = col; CTX.lineWidth = 2;
    CTX.stroke();

    // Angle label
    const labelAngle = Math.round(Math.abs(angleDeg));
    if (labelAngle > 1 && spineVis > 0.4) {
        CTX.font = 'bold 11px IBM Plex Mono, monospace';
        CTX.fillStyle = col;
        const lx = hX + (angleDeg >= 0 ? arcR + 6 : -(arcR + 30));
        CTX.fillText(labelAngle + '°', lx, hY - 8);
    }

    // In profile: also draw vertical plumb line from top of head to show overall posture
    if (isProfile && lm[0] && lm[0].visibility > 0.4) {
        const nose = lm[0];
        CTX.beginPath();
        CTX.moveTo(nose.x * W, nose.y * H);
        CTX.lineTo(hX, hY + 30);
        CTX.strokeStyle = 'rgba(255,255,255,0.15)';
        CTX.lineWidth = 1;
        CTX.setLineDash([3, 6]);
        CTX.stroke();
        CTX.setLineDash([]);
    }
}

// ── UI Updates ────────────────────────────────────────────────────────────────

function setMV(el, row, text, state) {
    el.textContent = text;
    el.className = 'm-val ' + (state || '');
    row.className = 'metric-row ' + (state === 'bad' ? 'warn' : state === 'warning' ? 'ok' : '');
}

function updateUI(posture, viewMode, hasBody) {
    const isProfile = viewMode !== 'frontal';

    // View badge
    viewBadge.textContent = isProfile ? 'PROFILO' : 'FRONTALE';
    viewBadge.className   = 'view-badge' + (isProfile ? ' profile' : '');

    // Metric labels change based on view
    if (isProfile) {
        lblLat.textContent    = 'INCL. AVANTI';
        lblFwd.textContent    = 'TESTA AVANTI';
        lblSpalle.textContent = 'GINOCCHIO';
    } else {
        lblLat.textContent    = 'INCL. LAT.';
        lblFwd.textContent    = 'LEAN AVANTI';
        lblSpalle.textContent = 'SIM. SPALLE';
    }

    // Score
    const ss = posture.score >= 70 ? 'good' : posture.score >= 40 ? 'warning' : 'bad';
    setMV(vScore, document.getElementById('m-score'), posture.score + '%', ss);

    if (!posture.visible || !hasBody) {
        angleVal.textContent = '—°';
        angleBadge.className = '';
        setMV(vLat,    mLat,    '—', '');
        setMV(vFwd,    mFwd,    '—', '');
        setMV(vSpalle, mSpalle, '—', '');
        warningBanner.classList.add('hidden');
        goodBanner.classList.add('hidden');
        return;
    }

    // Spine angle badge — shows the primary angle for current view
    const mainAngle = Math.round(Math.abs(posture.screenAngle));
    angleVal.textContent = mainAngle + '°';
    const as = mainAngle < (isProfile ? 18 : 15) ? 'good'
             : mainAngle < (isProfile ? 30 : 25) ? 'warning' : 'bad';
    angleBadge.className = as;

    if (!isProfile) {
        // Frontal metrics
        const latS = Math.abs(posture.screenAngle) < 15 ? 'good'
                   : Math.abs(posture.screenAngle) < 25 ? 'warning' : 'bad';
        setMV(vLat, mLat, Math.round(Math.abs(posture.screenAngle)) + '°', latS);

        const dA = Math.abs(posture.depthAngle);
        const fwdS = dA < 20 ? 'good' : dA < 35 ? 'warning' : 'bad';
        setMV(vFwd, mFwd, Math.round(dA) + '°', fwdS);

        const aS = posture.shoulderAsym < 6 ? 'good' : posture.shoulderAsym < 12 ? 'warning' : 'bad';
        setMV(vSpalle, mSpalle, Math.round(posture.shoulderAsym) + '%', aS);
    } else {
        // Profile metrics
        const fwdA = Math.abs(posture.screenAngle);
        const fwdS = fwdA < 18 ? 'good' : fwdA < 30 ? 'warning' : 'bad';
        setMV(vLat, mLat, Math.round(fwdA) + '°', fwdS);

        const hdF = Math.round(posture.headFwd * 100);
        const hdS = hdF < 8 ? 'good' : hdF < 14 ? 'warning' : 'bad';
        setMV(vFwd, mFwd, hdF + '%', hdS);

        setMV(vSpalle, mSpalle, '—', '');
    }

    // Banners
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

// ── Main result handler ───────────────────────────────────────────────────────

function onPoseResults(results) {
    if (CANVAS.width  !== VIDEO.videoWidth)  CANVAS.width  = VIDEO.videoWidth  || 640;
    if (CANVAS.height !== VIDEO.videoHeight) CANVAS.height = VIDEO.videoHeight || 480;

    const W = CANVAS.width, H = CANVAS.height;
    CTX.clearRect(0, 0, W, H);

    const lm      = results.poseLandmarks;
    const hasBody = !!lm && lm.length > 0;
    const viewMode = hasBody ? detectViewMode(lm) : _stableView;
    const posture  = analyzePosture(lm || [], viewMode);

    if (hasBody) {
        drawSkeleton(lm, W, H);
        drawSpineLine(lm, W, H, posture, viewMode);
    }

    // Status pill
    statusDot.className    = hasBody ? 'sdot active' : 'sdot warning';
    statusText.textContent = hasBody ? 'TRACCIAMENTO ATTIVO' : 'RICERCA CORPO...';

    updateUI(posture, viewMode, hasBody);
}

// ── MediaPipe setup ───────────────────────────────────────────────────────────

const pose = new Pose({
    locateFile: file => `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`
});

pose.setOptions({
    modelComplexity:         0,     // LITE model — fastest, ~30fps on modern hardware
    smoothLandmarks:         true,  // temporal smoothing built-in
    enableSegmentation:      false,
    smoothSegmentation:      false,
    minDetectionConfidence:  0.4,   // lower → better profile detection
    minTrackingConfidence:   0.4,
});

pose.onResults(onPoseResults);

// ── Camera ────────────────────────────────────────────────────────────────────

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
            'ACCESSO NEGATO — controlla i permessi';
        console.error(err);
    });
