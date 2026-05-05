const VIDEO   = document.getElementById('video');
const CANVAS  = document.getElementById('canvas');
const CTX     = CANVAS.getContext('2d');

const statusDot    = document.getElementById('status-dot');
const statusText   = document.getElementById('status-text');
const scoreValue   = document.getElementById('score-value');
const ringProgress = document.getElementById('ring-progress');
const feedbackBanner = document.getElementById('feedback-banner');
const feedbackText   = document.getElementById('feedback-text');
const loadingOverlay = document.getElementById('loading-overlay');

// Landmark row elements keyed by landmark index or 'spine'
const LM_ROWS = {
    11:      document.getElementById('lm-spalla-sx'),
    12:      document.getElementById('lm-spalla-dx'),
    23:      document.getElementById('lm-anca-sx'),
    24:      document.getElementById('lm-anca-dx'),
    spine:   document.getElementById('lm-colonna'),
};

// All MediaPipe Pose connections (index pairs)
const POSE_CONNECTIONS = [
    [0,1],[1,2],[2,3],[3,7],
    [0,4],[4,5],[5,6],[6,8],
    [9,10],
    [11,12],
    [11,13],[13,15],[15,17],[15,19],[15,21],[17,19],
    [12,14],[14,16],[16,18],[16,20],[16,22],[18,20],
    [11,23],[12,24],
    [23,24],
    [23,25],[24,26],
    [25,27],[26,28],
    [27,29],[28,30],
    [29,31],[30,32],
    [27,31],[28,32]
];

// Key back landmarks used for quality scoring
const BACK_LMS = [11, 12, 23, 24];

// ── Helpers ──────────────────────────────────────────────────────────────────

function visColor(v) {
    if (v >= 0.70) return '#00ff88';
    if (v >= 0.40) return '#ffb700';
    return '#ff3040';
}

function dotClass(v) {
    if (v >= 0.70) return 'good';
    if (v >= 0.40) return 'ok';
    return 'poor';
}

function calcScore(landmarks) {
    if (!landmarks) return 0;
    const sum = BACK_LMS.reduce((acc, i) => acc + (landmarks[i]?.visibility ?? 0), 0);
    return Math.round((sum / BACK_LMS.length) * 100);
}

// ── UI Updates ────────────────────────────────────────────────────────────────

function updateScore(score) {
    const CIRC = 314; // 2π × r=50
    scoreValue.textContent = score;
    ringProgress.style.strokeDashoffset = CIRC - (score / 100) * CIRC;

    const col = score >= 70 ? '#00ff88' : score >= 40 ? '#ffb700' : '#ff3040';
    ringProgress.style.stroke  = col;
    ringProgress.style.filter  = `drop-shadow(0 0 6px ${col})`;
    scoreValue.style.color     = col;
}

function updateLMRow(key, visibility) {
    const row = LM_ROWS[key];
    if (!row) return;
    row.querySelector('.lm-dot').className = 'lm-dot ' + dotClass(visibility);
    row.querySelector('.lm-val').textContent = Math.round(visibility * 100) + '%';
}

function resetLMRows() {
    for (const row of Object.values(LM_ROWS)) {
        row.querySelector('.lm-dot').className = 'lm-dot';
        row.querySelector('.lm-val').textContent = '—';
    }
}

function updateFeedback(score, hasBody) {
    let text, cls;
    if (!hasBody) {
        text = 'Nessun corpo rilevato — Posizionati davanti alla fotocamera';
        cls  = 'poor';
    } else if (score >= 70) {
        text = 'RILEVAMENTO OTTIMALE — Corpo tracciato correttamente';
        cls  = 'good';
    } else if (score >= 40) {
        text = 'RILEVAMENTO PARZIALE — Avvicinarsi e centrare il corpo';
        cls  = 'warning';
    } else {
        text = 'RILEVAMENTO INSUFFICIENTE — Mostrare tutto il busto';
        cls  = 'poor';
    }
    feedbackText.textContent = text;
    feedbackBanner.className = 'feedback-banner ' + cls;
}

// ── Drawing ───────────────────────────────────────────────────────────────────

function drawSkeleton(landmarks) {
    const W = CANVAS.width;
    const H = CANVAS.height;
    CTX.clearRect(0, 0, W, H);
    if (!landmarks || landmarks.length === 0) return;

    // Draw connections
    for (const [a, b] of POSE_CONNECTIONS) {
        const lA = landmarks[a];
        const lB = landmarks[b];
        if (!lA || !lB) continue;
        const vis = Math.min(lA.visibility, lB.visibility);
        if (vis < 0.15) continue;

        const isBack = BACK_LMS.includes(a) && BACK_LMS.includes(b);

        CTX.beginPath();
        CTX.moveTo(lA.x * W, lA.y * H);
        CTX.lineTo(lB.x * W, lB.y * H);
        CTX.strokeStyle = isBack
            ? `rgba(0, 212, 255, ${vis * 0.9})`
            : `rgba(255, 255, 255, ${vis * 0.3})`;
        CTX.lineWidth = isBack ? 2.5 : 1.5;
        CTX.stroke();
    }

    // Spine midline: mid-shoulders → mid-hips
    const l11 = landmarks[11], l12 = landmarks[12];
    const l23 = landmarks[23], l24 = landmarks[24];

    if (l11 && l12 && l23 && l24) {
        const sX = ((l11.x + l12.x) / 2) * W;
        const sY = ((l11.y + l12.y) / 2) * H;
        const hX = ((l23.x + l24.x) / 2) * W;
        const hY = ((l23.y + l24.y) / 2) * H;
        const spineVis = Math.min(l11.visibility, l12.visibility, l23.visibility, l24.visibility);

        // Glow
        CTX.beginPath();
        CTX.moveTo(sX, sY);
        CTX.lineTo(hX, hY);
        CTX.strokeStyle = `rgba(0, 212, 255, ${spineVis * 0.25})`;
        CTX.lineWidth = 14;
        CTX.stroke();

        // Dashed spine line
        CTX.beginPath();
        CTX.moveTo(sX, sY);
        CTX.lineTo(hX, hY);
        CTX.strokeStyle = `rgba(0, 212, 255, ${spineVis * 0.95})`;
        CTX.lineWidth = 2.5;
        CTX.setLineDash([7, 5]);
        CTX.stroke();
        CTX.setLineDash([]);

        // Centre dot
        const mX = (sX + hX) / 2;
        const mY = (sY + hY) / 2;
        CTX.beginPath();
        CTX.arc(mX, mY, 4.5, 0, Math.PI * 2);
        CTX.fillStyle = '#00d4ff';
        CTX.fill();

        updateLMRow('spine', spineVis);
    }

    // Draw keypoints
    for (let i = 0; i < landmarks.length; i++) {
        const lm = landmarks[i];
        if (!lm || lm.visibility < 0.15) continue;

        const x = lm.x * W;
        const y = lm.y * H;
        const isKey = BACK_LMS.includes(i);
        const col   = visColor(lm.visibility);
        const r     = isKey ? 6 : 3;

        if (isKey) {
            // Halo
            CTX.beginPath();
            CTX.arc(x, y, r + 5, 0, Math.PI * 2);
            CTX.fillStyle = col + '20';
            CTX.fill();
        }

        CTX.beginPath();
        CTX.arc(x, y, r, 0, Math.PI * 2);
        CTX.fillStyle = isKey ? col : `rgba(255,255,255,${lm.visibility * 0.55})`;
        CTX.fill();

        if (isKey) updateLMRow(i, lm.visibility);
    }
}

// ── MediaPipe Pose ────────────────────────────────────────────────────────────

const pose = new Pose({
    locateFile: file => `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`
});

pose.setOptions({
    modelComplexity:       1,
    smoothLandmarks:       true,
    enableSegmentation:    false,
    smoothSegmentation:    false,
    minDetectionConfidence: 0.5,
    minTrackingConfidence:  0.5,
});

pose.onResults(results => {
    // Keep canvas in sync with actual video resolution
    if (CANVAS.width  !== VIDEO.videoWidth)  CANVAS.width  = VIDEO.videoWidth  || 1280;
    if (CANVAS.height !== VIDEO.videoHeight) CANVAS.height = VIDEO.videoHeight || 720;

    const lm     = results.poseLandmarks;
    const hasBody = !!lm && lm.length > 0;

    drawSkeleton(lm);

    const score = calcScore(lm);
    updateScore(score);
    updateFeedback(score, hasBody);

    if (hasBody) {
        statusDot.className  = 'status-dot active';
        statusText.textContent = 'TRACCIAMENTO ATTIVO';
    } else {
        statusDot.className  = 'status-dot warning';
        statusText.textContent = 'RICERCA CORPO...';
        resetLMRows();
    }
});

// ── Camera ────────────────────────────────────────────────────────────────────

const camera = new Camera(VIDEO, {
    onFrame: async () => { await pose.send({ image: VIDEO }); },
    width:  1280,
    height: 720,
});

camera.start()
    .then(() => {
        statusDot.className    = 'status-dot active';
        statusText.textContent = 'FOTOCAMERA ATTIVA';
        loadingOverlay.classList.add('hidden');
    })
    .catch(err => {
        statusDot.className    = 'status-dot error';
        statusText.textContent = 'ERRORE FOTOCAMERA';
        loadingOverlay.querySelector('.loader-text').textContent =
            'ACCESSO FOTOCAMERA NEGATO';
        console.error(err);
    });
