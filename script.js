const VIDEO   = document.getElementById('video');
const CANVAS  = document.getElementById('canvas');
const CTX     = CANVAS.getContext('2d');

const statusDot     = document.getElementById('status-dot');
const statusText    = document.getElementById('status-text');
const loadingOv     = document.getElementById('loading-overlay');
const angleBadge    = document.getElementById('angle-badge');
const angleVal      = document.getElementById('spine-angle-val');
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

// ── Skeleton segment colors (Dartfish style) ──────────────────────────────────

// Color per joint index
const JOINT_COL = {
    // Face / head
    0:'#ff6b6b', 1:'#ff6b6b', 2:'#ff6b6b', 3:'#ff6b6b', 4:'#ff6b6b',
    5:'#ff6b6b', 6:'#ff6b6b', 7:'#ff6b6b', 8:'#ff6b6b', 9:'#ff6b6b', 10:'#ff6b6b',
    // Shoulders (key back points — orange)
    11:'#ff9f43', 12:'#ff9f43',
    // Arms — blue
    13:'#4b9eff', 14:'#4b9eff', 15:'#4b9eff', 16:'#4b9eff',
    17:'#4b9eff', 18:'#4b9eff', 19:'#4b9eff', 20:'#4b9eff', 21:'#4b9eff', 22:'#4b9eff',
    // Hips (key back points — orange)
    23:'#ff9f43', 24:'#ff9f43',
    // Legs — lime green
    25:'#69f0ae', 26:'#69f0ae', 27:'#69f0ae', 28:'#69f0ae',
    29:'#69f0ae', 30:'#69f0ae', 31:'#69f0ae', 32:'#69f0ae',
};

// Color per connection [indexA, indexB] → color string
const CONNECTIONS = [
    // Face
    { a:0,  b:1,  col:'rgba(255,107,107,0.6)' },
    { a:1,  b:2,  col:'rgba(255,107,107,0.6)' },
    { a:2,  b:3,  col:'rgba(255,107,107,0.6)' },
    { a:3,  b:7,  col:'rgba(255,107,107,0.6)' },
    { a:0,  b:4,  col:'rgba(255,107,107,0.6)' },
    { a:4,  b:5,  col:'rgba(255,107,107,0.6)' },
    { a:5,  b:6,  col:'rgba(255,107,107,0.6)' },
    { a:6,  b:8,  col:'rgba(255,107,107,0.6)' },
    { a:9,  b:10, col:'rgba(255,107,107,0.6)' },
    // Shoulder bar (cyan — spine reference)
    { a:11, b:12, col:'rgba(0,229,255,0.8)',  w:2.5 },
    // Left arm
    { a:11, b:13, col:'rgba(75,158,255,0.85)' },
    { a:13, b:15, col:'rgba(75,158,255,0.85)' },
    { a:15, b:17, col:'rgba(75,158,255,0.7)'  },
    { a:15, b:19, col:'rgba(75,158,255,0.7)'  },
    { a:15, b:21, col:'rgba(75,158,255,0.7)'  },
    { a:17, b:19, col:'rgba(75,158,255,0.5)'  },
    // Right arm
    { a:12, b:14, col:'rgba(75,158,255,0.85)' },
    { a:14, b:16, col:'rgba(75,158,255,0.85)' },
    { a:16, b:18, col:'rgba(75,158,255,0.7)'  },
    { a:16, b:20, col:'rgba(75,158,255,0.7)'  },
    { a:16, b:22, col:'rgba(75,158,255,0.7)'  },
    { a:18, b:20, col:'rgba(75,158,255,0.5)'  },
    // Torso sides
    { a:11, b:23, col:'rgba(255,159,67,0.85)', w:2.5 },
    { a:12, b:24, col:'rgba(255,159,67,0.85)', w:2.5 },
    // Hip bar
    { a:23, b:24, col:'rgba(0,229,255,0.8)',  w:2.5 },
    // Left leg
    { a:23, b:25, col:'rgba(105,240,174,0.85)' },
    { a:25, b:27, col:'rgba(105,240,174,0.85)' },
    { a:27, b:29, col:'rgba(105,240,174,0.7)'  },
    { a:29, b:31, col:'rgba(105,240,174,0.6)'  },
    { a:27, b:31, col:'rgba(105,240,174,0.5)'  },
    // Right leg
    { a:24, b:26, col:'rgba(105,240,174,0.85)' },
    { a:26, b:28, col:'rgba(105,240,174,0.85)' },
    { a:28, b:30, col:'rgba(105,240,174,0.7)'  },
    { a:30, b:32, col:'rgba(105,240,174,0.6)'  },
    { a:28, b:32, col:'rgba(105,240,174,0.5)'  },
];

// ── Posture Analysis ──────────────────────────────────────────────────────────

const THRESHOLDS = {
    lateralTilt:  15,   // degrees — spine tilt left/right
    forwardLean: 0.12,  // normalized Z units — shoulder vs hip depth
    shoulderAsym: 6,    // % of frame height — shoulder height diff
};

function analyzePosture(lm) {
    const l11 = lm[11], l12 = lm[12];
    const l23 = lm[23], l24 = lm[24];

    const res = {
        visible: false,
        lateralAngle: 0,
        forwardLean: 0,
        shoulderAsym: 0,
        score: 0,
        warnings: [],
        status: 'unknown',
    };

    if (!l11 || !l12 || !l23 || !l24) return res;

    const minVis = Math.min(l11.visibility, l12.visibility, l23.visibility, l24.visibility);
    const avgVis = (l11.visibility + l12.visibility + l23.visibility + l24.visibility) / 4;
    res.score = Math.round(avgVis * 100);
    if (minVis < 0.3) return res;

    res.visible = true;

    // Mid-points
    const sX = (l11.x + l12.x) / 2;
    const sY = (l11.y + l12.y) / 2;
    const hX = (l23.x + l24.x) / 2;
    const hY = (l23.y + l24.y) / 2;

    // Lateral spine angle (from vertical, in image plane)
    // Vector: hips → shoulders (should point straight up)
    const dx = sX - hX;
    const dy = hY - sY; // positive when shoulders above hips (normal)
    res.lateralAngle = Math.atan2(dx, dy) * (180 / Math.PI);

    // Forward lean via Z axis (negative Z = toward camera)
    const sZ = (l11.z + l12.z) / 2;
    const hZ = (l23.z + l24.z) / 2;
    // sZ - hZ < 0  → shoulders closer to camera than hips → leaning forward
    res.forwardLean = hZ - sZ; // positive = forward lean

    // Shoulder asymmetry (height diff in frame %)
    res.shoulderAsym = Math.abs(l12.y - l11.y) * 100;

    // Evaluate warnings
    if (Math.abs(res.lateralAngle) > THRESHOLDS.lateralTilt) {
        const dir = res.lateralAngle > 0 ? 'destra' : 'sinistra';
        res.warnings.push(`Schiena inclinata di ${Math.round(Math.abs(res.lateralAngle))}° verso ${dir}`);
    }

    if (res.forwardLean > THRESHOLDS.forwardLean) {
        const pct = Math.round(res.forwardLean * 300);
        res.warnings.push(`Troppo in avanti — raddrizza il busto (${pct}%)`);
    }

    if (res.shoulderAsym > THRESHOLDS.shoulderAsym) {
        const low = l12.y > l11.y ? 'destra' : 'sinistra';
        res.warnings.push(`Spalla ${low} più bassa — equilibra le spalle`);
    }

    res.status = res.warnings.length === 0 ? 'good'
               : res.warnings.length === 1 ? 'warning'
               : 'bad';

    return res;
}

// ── Drawing ───────────────────────────────────────────────────────────────────

function drawAngleArc(cx, cy, angleDeg, r, col) {
    // Small arc indicator at the hip center, like Dartfish
    const a0 = -Math.PI / 2; // straight up
    const a1 = a0 + (angleDeg * Math.PI / 180);

    CTX.beginPath();
    CTX.arc(cx, cy, r, Math.min(a0, a1), Math.max(a0, a1));
    CTX.strokeStyle = col;
    CTX.lineWidth = 2;
    CTX.stroke();

    // Vertical reference line
    CTX.beginPath();
    CTX.moveTo(cx, cy);
    CTX.lineTo(cx, cy - r - 8);
    CTX.strokeStyle = 'rgba(255,255,255,0.35)';
    CTX.lineWidth = 1;
    CTX.setLineDash([3, 3]);
    CTX.stroke();
    CTX.setLineDash([]);
}

function drawSpineLine(lm, W, H, postureStatus) {
    const l11 = lm[11], l12 = lm[12];
    const l23 = lm[23], l24 = lm[24];
    if (!l11 || !l12 || !l23 || !l24) return;

    const spineVis = Math.min(l11.visibility, l12.visibility, l23.visibility, l24.visibility);
    if (spineVis < 0.25) return;

    const sX = ((l11.x + l12.x) / 2) * W;
    const sY = ((l11.y + l12.y) / 2) * H;
    const hX = ((l23.x + l24.x) / 2) * W;
    const hY = ((l23.y + l24.y) / 2) * H;

    const spineCol = postureStatus === 'good'    ? '#FFD700'
                   : postureStatus === 'warning'  ? '#ffc107'
                   : postureStatus === 'bad'      ? '#ff1744'
                   : '#FFD700';

    // Glow
    CTX.beginPath();
    CTX.moveTo(sX, sY);
    CTX.lineTo(hX, hY);
    CTX.strokeStyle = spineCol + '30';
    CTX.lineWidth = 16;
    CTX.stroke();

    // Dashed spine
    CTX.beginPath();
    CTX.moveTo(sX, sY);
    CTX.lineTo(hX, hY);
    CTX.strokeStyle = spineCol;
    CTX.lineWidth = 2.5;
    CTX.setLineDash([8, 5]);
    CTX.stroke();
    CTX.setLineDash([]);

    // End dots (shoulder mid + hip mid)
    for (const [px, py] of [[sX, sY], [hX, hY]]) {
        CTX.beginPath();
        CTX.arc(px, py, 5, 0, Math.PI * 2);
        CTX.fillStyle = spineCol;
        CTX.fill();
    }
}

function drawSkeleton(lm, W, H) {
    CTX.clearRect(0, 0, W, H);
    if (!lm || lm.length === 0) return;

    // Connections
    for (const { a, b, col, w } of CONNECTIONS) {
        const la = lm[a], lb = lm[b];
        if (!la || !lb) continue;
        const vis = Math.min(la.visibility, lb.visibility);
        if (vis < 0.15) continue;

        CTX.beginPath();
        CTX.moveTo(la.x * W, la.y * H);
        CTX.lineTo(lb.x * W, lb.y * H);
        CTX.strokeStyle = col || 'rgba(255,255,255,0.4)';
        CTX.lineWidth = (w || 2) * Math.min(1, vis + 0.2);
        CTX.stroke();
    }

    // Joints
    for (let i = 0; i < lm.length; i++) {
        const p = lm[i];
        if (!p || p.visibility < 0.2) continue;

        const x = p.x * W, y = p.y * H;
        const col = JOINT_COL[i] || '#ffffff';
        const isKey = [11,12,23,24].includes(i);
        const r = isKey ? 7 : 4;

        // Outer ring for key joints
        if (isKey) {
            CTX.beginPath();
            CTX.arc(x, y, r + 3, 0, Math.PI * 2);
            CTX.strokeStyle = col + '55';
            CTX.lineWidth = 2;
            CTX.stroke();
        }

        // Filled circle
        CTX.beginPath();
        CTX.arc(x, y, r, 0, Math.PI * 2);
        CTX.fillStyle = col;
        CTX.fill();

        // Dark center for key joints (like reference image style)
        if (isKey) {
            CTX.beginPath();
            CTX.arc(x, y, r * 0.38, 0, Math.PI * 2);
            CTX.fillStyle = 'rgba(0,0,0,0.7)';
            CTX.fill();
        }
    }
}

// ── UI Updates ────────────────────────────────────────────────────────────────

let lastWarningCount = 0;

function setMetricVal(el, row, text, state) {
    el.textContent = text;
    el.className = 'm-val ' + (state || '');
    row.className = 'metric-row ' + (state === 'bad' ? 'warn' : state === 'warning' ? 'ok' : '');
}

function updateUI(posture, hasBody) {
    // Score
    const scoreState = posture.score >= 70 ? 'good' : posture.score >= 40 ? 'warning' : 'bad';
    setMetricVal(vScore, document.getElementById('m-score'), posture.score + '%', scoreState);

    if (!posture.visible || !hasBody) {
        angleVal.textContent = '—°';
        angleBadge.className = '';
        setMetricVal(vLat,    mLat,    '—', '');
        setMetricVal(vFwd,    mFwd,    '—', '');
        setMetricVal(vSpalle, mSpalle, '—', '');
        warningBanner.classList.add('hidden');
        goodBanner.classList.add('hidden');
        return;
    }

    // Spine angle
    const angleAbs = Math.round(Math.abs(posture.lateralAngle));
    angleVal.textContent = angleAbs + '°';
    const angleState = angleAbs < THRESHOLDS.lateralTilt ? 'good' : angleAbs < 25 ? 'warning' : 'bad';
    angleBadge.className = angleState;

    // Lateral tilt metric
    const latState = angleAbs < THRESHOLDS.lateralTilt ? 'good' : angleAbs < 25 ? 'warning' : 'bad';
    setMetricVal(vLat, mLat, angleAbs + '°', latState);

    // Forward lean
    const fwdPct = Math.round(posture.forwardLean * 300);
    const fwdState = fwdPct < 30 ? 'good' : fwdPct < 55 ? 'warning' : 'bad';
    setMetricVal(vFwd, mFwd, fwdPct + '%', fwdState);

    // Shoulder asymmetry
    const asymState = posture.shoulderAsym < THRESHOLDS.shoulderAsym ? 'good'
                    : posture.shoulderAsym < 12 ? 'warning' : 'bad';
    setMetricVal(vSpalle, mSpalle, Math.round(posture.shoulderAsym) + '%', asymState);

    // Banners
    const { warnings, status } = posture;

    if (status === 'good') {
        warningBanner.classList.add('hidden');
        goodBanner.classList.remove('hidden');
    } else {
        goodBanner.classList.add('hidden');
        // Rotate through warnings every ~2s to not overwhelm
        const wi = Math.floor(Date.now() / 2200) % warnings.length;
        warningText.textContent = '⚠ ' + warnings[wi].toUpperCase();
        warningBanner.classList.remove('hidden');
    }
}

// ── Main onResults ────────────────────────────────────────────────────────────

function onPoseResults(results) {
    // Sync canvas resolution
    if (CANVAS.width  !== VIDEO.videoWidth)  CANVAS.width  = VIDEO.videoWidth  || 640;
    if (CANVAS.height !== VIDEO.videoHeight) CANVAS.height = VIDEO.videoHeight || 480;

    const W = CANVAS.width, H = CANVAS.height;
    const lm = results.poseLandmarks;
    const hasBody = !!lm && lm.length > 0;

    const posture = analyzePosture(lm || []);

    // Draw
    drawSkeleton(lm, W, H);
    if (hasBody) {
        drawSpineLine(lm, W, H, posture.status);

        // Angle arc at hip midpoint
        const l23 = lm[23], l24 = lm[24];
        if (l23 && l24 && posture.visible) {
            const hX = ((l23.x + l24.x) / 2) * W;
            const hY = ((l23.y + l24.y) / 2) * H;
            const arcCol = posture.status === 'good' ? '#FFD700'
                         : posture.status === 'warning' ? '#ffc107' : '#ff1744';
            drawAngleArc(hX, hY, posture.lateralAngle, 38, arcCol);

            // Angle label next to arc
            const vis = Math.min(l23.visibility, l24.visibility);
            if (vis > 0.4) {
                CTX.font = '600 11px IBM Plex Mono, monospace';
                CTX.fillStyle = arcCol;
                CTX.fillText(Math.round(Math.abs(posture.lateralAngle)) + '°', hX + 44, hY - 4);
            }
        }
    }

    // Status indicator
    if (hasBody) {
        statusDot.className  = 'sdot active';
        statusText.textContent = 'TRACCIAMENTO ATTIVO';
    } else {
        statusDot.className  = 'sdot warning';
        statusText.textContent = 'RICERCA CORPO...';
    }

    updateUI(posture, hasBody);
}

// ── MediaPipe Pose ────────────────────────────────────────────────────────────

const pose = new Pose({
    locateFile: file => `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`
});

pose.setOptions({
    modelComplexity:        0,    // LITE — much faster, less stutter
    smoothLandmarks:        true,
    enableSegmentation:     false,
    smoothSegmentation:     false,
    minDetectionConfidence: 0.5,
    minTrackingConfidence:  0.5,
});

pose.onResults(onPoseResults);

// ── Camera ────────────────────────────────────────────────────────────────────

const camera = new Camera(VIDEO, {
    onFrame: async () => { await pose.send({ image: VIDEO }); },
    width:  640,   // lower res → faster inference → less stutter
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
        loadingOv.querySelector('.loader-text').textContent = 'ACCESSO NEGATO — controlla i permessi';
        console.error(err);
    });
