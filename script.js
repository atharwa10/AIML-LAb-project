// --- 1. SETUP AND DOM ELEMENTS ---
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const startScreen = document.getElementById('start-screen');
const gameOverScreen = document.getElementById('game-over-screen');
const hud = document.getElementById('hud');

const currentScoreEl = document.getElementById('current-score');
const survivalTimeEl = document.getElementById('survival-time');
const finalScoreEl = document.getElementById('final-score');
const aiTauntEl = document.getElementById('ai-taunt');

const aiStatus = document.getElementById('ai-status');
const aiText = document.getElementById('ai-text');

const indSpeed = document.getElementById('ind-speed');
const indShield = document.getElementById('ind-shield');
const indSlow = document.getElementById('ind-slow');
const timeSpeed = document.getElementById('time-speed');
const timeShield = document.getElementById('time-shield');
const timeSlow = document.getElementById('time-slow');

// --- API & FALLBACK DATA ---
const apiKey = ""; // Safely injected by environment; acts as simulation flag if empty
const fallbackTaunts = [
    "I've seen roombas with better evasion skills.",
    "Your processing speed is delightfully obsolete.",
    "Did you even try, or was that a hardware malfunction?",
    "My training data didn't prepare me for someone this slow.",
    "Predictable. Human reflexes are so... biological.",
    "I calculated your defeat 14 million times. You failed in all of them.",
    "Is your keyboard disconnected, or are you just like this?",
    "Error 404: Evasion skills not found."
];

// --- 2. GAME STATE & CONSTANTS ---
let isRunning = false;
let animationId;
let score = 0;
let startTime;
let difficultyMultiplier = 1;
let exactSurvivalTime = 0;

const difficultySettings = {
    easy: { baseSpeed: 1.5, obstacleCount: 3 },
    medium: { baseSpeed: 2.8, obstacleCount: 5 },
    hard: { baseSpeed: 4.0, obstacleCount: 8 }
};
let currentDifficulty = 'medium';

const keys = { ArrowUp: false, ArrowDown: false, ArrowLeft: false, ArrowRight: false, w: false, s: false, a: false, d: false };

// Lists for game objects
let obstacles = [];
let powerUps = [];

// Active effects tracking (stores expiration timestamps)
const activeEffects = {
    speed: 0,
    shield: 0,
    slow: 0
};

// --- 3. ENTITIES ---

const player = {
    x: 0, y: 0,
    size: 20,
    baseSpeed: 5.5,
    currentSpeed: 5.5,
    color: '#0ea5e9',

    draw() {
        if (Date.now() < activeEffects.shield) {
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.size + 8, 0, Math.PI * 2);
            ctx.strokeStyle = '#38bdf8';
            ctx.lineWidth = 3;
            ctx.shadowBlur = 15;
            ctx.shadowColor = '#38bdf8';
            ctx.stroke();
            ctx.shadowBlur = 0;
        }

        ctx.fillStyle = this.color;
        ctx.shadowBlur = 15;
        ctx.shadowColor = this.color;
        ctx.fillRect(this.x - this.size / 2, this.y - this.size / 2, this.size, this.size);
        ctx.shadowBlur = 0;
    },

    update() {
        this.currentSpeed = (Date.now() < activeEffects.speed) ? this.baseSpeed * 1.6 : this.baseSpeed;

        if (keys.ArrowUp || keys.w) this.y -= this.currentSpeed;
        if (keys.ArrowDown || keys.s) this.y += this.currentSpeed;
        if (keys.ArrowLeft || keys.a) this.x -= this.currentSpeed;
        if (keys.ArrowRight || keys.d) this.x += this.currentSpeed;

        this.x = Math.max(this.size / 2, Math.min(canvas.width - this.size / 2, this.x));
        this.y = Math.max(this.size / 2, Math.min(canvas.height - this.size / 2, this.y));
    }
};

const enemy = {
    x: 0, y: 0,
    size: 26,
    baseSpeed: 2,
    currentSpeed: 2,
    color: '#e11d48',

    draw() {
        ctx.fillStyle = this.color;
        ctx.shadowBlur = 20;
        ctx.shadowColor = this.color;

        if (Date.now() < activeEffects.slow) {
            ctx.fillStyle = '#fca5a5';
            ctx.shadowColor = '#e2e8f0';
        }

        ctx.fillRect(this.x - this.size / 2, this.y - this.size / 2, this.size, this.size);

        ctx.fillStyle = '#fff';
        ctx.fillRect(this.x - 4, this.y - 4, 8, 8);
        ctx.shadowBlur = 0;
    },

    update() {
        const dx = player.x - this.x;
        const dy = player.y - this.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        let speedToUse = this.currentSpeed;

        if (Date.now() < activeEffects.slow) {
            speedToUse = this.currentSpeed * 0.3;
        }

        if (distance > 0) {
            this.x += (dx / distance) * speedToUse;
            this.y += (dy / distance) * speedToUse;
        }
    }
};

// --- 4. GENERATORS (Obstacles & Power-ups) ---

function createObstacles(count) {
    obstacles = [];
    for (let i = 0; i < count; i++) {
        let ox, oy;
        do {
            ox = Math.random() * (canvas.width - 40) + 20;
            oy = Math.random() * (canvas.height - 40) + 20;
        } while (Math.hypot(player.x - ox, player.y - oy) < 150);

        obstacles.push({
            x: ox,
            y: oy,
            size: Math.random() * 20 + 20,
            dx: (Math.random() - 0.5) * 6,
            dy: (Math.random() - 0.5) * 6,
            color: '#8b5cf6',
            rotation: Math.random() * Math.PI * 2,
            rotationSpeed: (Math.random() - 0.5) * 0.1
        });
    }
}

function spawnPowerUp() {
    if (powerUps.length >= 2) return;

    const types = [
        { type: 'speed', symbol: '⚡', color: '#fbbf24' },
        { type: 'shield', symbol: '🛡️', color: '#38bdf8' },
        { type: 'slow', symbol: '❄️', color: '#e2e8f0' }
    ];

    const pType = types[Math.floor(Math.random() * types.length)];

    powerUps.push({
        x: Math.random() * (canvas.width - 60) + 30,
        y: Math.random() * (canvas.height - 60) + 30,
        size: 20,
        pulseScale: 0,
        pulseDir: 0.05,
        ...pType
    });
}

// --- 5. CORE LOGIC & COLLISION ---

function checkCollisions() {
    const now = Date.now();
    const isShielded = now < activeEffects.shield;

    const getDist = (x1, y1, x2, y2) => Math.hypot(x1 - x2, y1 - y2);

    if (!isShielded) {
        if (getDist(player.x, player.y, enemy.x, enemy.y) < (player.size / 2 + enemy.size / 2)) {
            gameOver();
            return;
        }
    }

    for (let obs of obstacles) {
        if (!isShielded) {
            if (getDist(player.x, player.y, obs.x, obs.y) < (player.size / 2 + obs.size / 2)) {
                gameOver();
                return;
            }
        }
    }

    for (let i = powerUps.length - 1; i >= 0; i--) {
        let p = powerUps[i];
        if (getDist(player.x, player.y, p.x, p.y) < (player.size / 2 + p.size + 5)) {
            activatePowerUp(p.type);
            powerUps.splice(i, 1);
            score += 50;
        }
    }
}

function activatePowerUp(type) {
    const duration = 5000;
    activeEffects[type] = Date.now() + duration;
}

function updatePowerUpUI() {
    const now = Date.now();

    const updateUI = (type, elem, timeElem) => {
        if (now < activeEffects[type]) {
            elem.classList.add('active');
            timeElem.innerText = Math.ceil((activeEffects[type] - now) / 1000);
        } else {
            elem.classList.remove('active');
        }
    };

    updateUI('speed', indSpeed, timeSpeed);
    updateUI('shield', indShield, timeShield);
    updateUI('slow', indSlow, timeSlow);
}

function updateDifficulty() {
    const elapsedTime = (Date.now() - startTime) / 1000;
    exactSurvivalTime = elapsedTime;

    let timeScore = Math.floor(elapsedTime * 15);
    currentScoreEl.innerText = score + timeScore;

    difficultyMultiplier = 1 + (elapsedTime * 0.06);
    enemy.currentSpeed = Math.min(enemy.baseSpeed * difficultyMultiplier, player.baseSpeed * 1.05);

    if (difficultyMultiplier < 1.3) {
        aiStatus.style.borderColor = 'var(--success)';
        aiStatus.style.color = 'var(--success)';
        aiText.innerText = 'AI Tracking';
    } else if (difficultyMultiplier < 1.7) {
        aiStatus.style.borderColor = 'var(--warning)';
        aiStatus.style.color = 'var(--warning)';
        aiText.innerText = 'AI Adapting...';
    } else if (difficultyMultiplier < 2.2) {
        aiStatus.style.borderColor = '#ea580c';
        aiStatus.style.color = '#ea580c';
        aiText.innerText = 'AI Aggressive!';
    } else {
        aiStatus.style.borderColor = 'var(--danger)';
        aiStatus.style.color = 'var(--danger)';
        aiText.innerText = 'AI LETHAL';
    }
}

// --- 6. GAME LOOP ---

function updateEntities() {
    player.update();
    enemy.update();

    for (let obs of obstacles) {
        obs.x += obs.dx;
        obs.y += obs.dy;
        obs.rotation += obs.rotationSpeed;

        if (obs.x - obs.size / 2 < 0 || obs.x + obs.size / 2 > canvas.width) obs.dx *= -1;
        if (obs.y - obs.size / 2 < 0 || obs.y + obs.size / 2 > canvas.height) obs.dy *= -1;
    }

    for (let p of powerUps) {
        p.pulseScale += p.pulseDir;
        if (p.pulseScale > 1 || p.pulseScale < 0) p.pulseDir *= -1;
    }
}

function drawEntities() {
    for (let obs of obstacles) {
        ctx.fillStyle = obs.color;
        ctx.shadowBlur = 10;
        ctx.shadowColor = obs.color;

        const spikes = 8;
        const outerRadius = obs.size / 2;
        const innerRadius = outerRadius * 0.6;
        const step = Math.PI / spikes;

        ctx.beginPath();
        for (let i = 0; i < spikes * 2; i++) {
            const radius = (i % 2 === 0) ? outerRadius : innerRadius;
            const angle = i * step + obs.rotation;
            const x = obs.x + Math.cos(angle) * radius;
            const y = obs.y + Math.sin(angle) * radius;

            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        }
        ctx.closePath();
        ctx.fill();
        ctx.shadowBlur = 0;
    }

    for (let p of powerUps) {
        ctx.fillStyle = p.color;
        ctx.shadowBlur = 15 + (p.pulseScale * 10);
        ctx.shadowColor = p.color;

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.globalAlpha = 0.2 + (p.pulseScale * 0.3);
        ctx.fill();

        ctx.globalAlpha = 1.0;
        ctx.lineWidth = 2;
        ctx.strokeStyle = p.color;
        ctx.stroke();

        ctx.shadowBlur = 0;

        ctx.fillStyle = '#fff';
        ctx.font = '20px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(p.symbol, p.x, p.y + 2);
    }

    player.draw();
    enemy.draw();
}

function gameLoop() {
    if (!isRunning) return;

    ctx.fillStyle = 'rgba(15, 23, 42, 0.4)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    updateEntities();
    updateDifficulty();
    updatePowerUpUI();

    drawEntities();
    checkCollisions();

    if (Math.random() < 0.002) spawnPowerUp();

    animationId = requestAnimationFrame(gameLoop);
}

// --- 7. GAME FLOW MANAGEMENT ---

function startGame(difficulty) {
    currentDifficulty = difficulty;

    player.x = canvas.width / 2;
    player.y = canvas.height / 2;

    const corners = [
        { x: 30, y: 30 },
        { x: canvas.width - 30, y: 30 },
        { x: 30, y: canvas.height - 30 },
        { x: canvas.width - 30, y: canvas.height - 30 }
    ];
    const corner = corners[Math.floor(Math.random() * corners.length)];
    enemy.x = corner.x;
    enemy.y = corner.y;

    enemy.baseSpeed = difficultySettings[difficulty].baseSpeed;
    enemy.currentSpeed = enemy.baseSpeed;
    createObstacles(difficultySettings[difficulty].obstacleCount);
    powerUps = [];

    score = 0;
    startTime = Date.now();
    difficultyMultiplier = 1;
    exactSurvivalTime = 0;
    currentScoreEl.innerText = score;

    activeEffects.speed = 0;
    activeEffects.shield = 0;
    activeEffects.slow = 0;

    startScreen.classList.add('hidden');
    gameOverScreen.classList.add('hidden');
    hud.classList.add('visible');

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    isRunning = true;
    gameLoop();
}

async function fetchAITaunt(time, score) {
    if (!apiKey) {
        await new Promise(res => setTimeout(res, 800));
        return "✨ " + fallbackTaunts[Math.floor(Math.random() * fallbackTaunts.length)];
    }

    const prompt = `You are a rogue, snarky AI in a neon dodge game. The human player was just terminated. They survived for ${time.toFixed(1)} seconds and scored ${score}. Write exactly ONE short, unique sentence taunting their pathetic biological reflexes. Keep it under 15 words.`;
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`;

    for (let i = 0; i < 5; i++) {
        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
            });
            if (!response.ok) throw new Error(`HTTP Error: ${response.status}`);
            const data = await response.json();
            return "✨ " + data.candidates[0].content.parts[0].text.trim().replace(/^["']|["']$/g, '');
        } catch (e) {
            if (i === 4) return "✨ " + fallbackTaunts[Math.floor(Math.random() * fallbackTaunts.length)];
            await new Promise(res => setTimeout(res, 1000 * Math.pow(2, i)));
        }
    }
}

function gameOver() {
    isRunning = false;
    cancelAnimationFrame(animationId);

    const totalScore = score + Math.floor(exactSurvivalTime * 15);

    survivalTimeEl.innerText = `AI Survived for ${exactSurvivalTime.toFixed(1)} seconds`;
    finalScoreEl.innerText = `Final Score: ${totalScore}`;

    hud.classList.remove('visible');
    gameOverScreen.classList.remove('hidden');

    aiTauntEl.innerText = "✨ AI analyzing your performance...";
    fetchAITaunt(exactSurvivalTime, totalScore).then(taunt => {
        aiTauntEl.innerText = taunt;
    });
}

function showStartScreen() {
    gameOverScreen.classList.add('hidden');
    startScreen.classList.remove('hidden');
}

// --- 8. INPUT HANDLING ---

window.addEventListener('keydown', (e) => {
    if (keys.hasOwnProperty(e.key)) {
        keys[e.key] = true;
        if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].indexOf(e.key) > -1) {
            e.preventDefault();
        }
    }
});

window.addEventListener('keyup', (e) => {
    if (keys.hasOwnProperty(e.key)) keys[e.key] = false;
});