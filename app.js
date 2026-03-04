const canvas = document.getElementById("simCanvas");
const ctx = canvas.getContext("2d");

const controls = {
  density: document.getElementById("density"),
  diameter: document.getElementById("diameter"),
  kp: document.getElementById("kp"),
  ki: document.getElementById("ki"),
  kd: document.getElementById("kd"),
  maxAngle: document.getElementById("maxAngle"),
  motorGain: document.getElementById("motorGain"),
  motorDamping: document.getElementById("motorDamping"),
  motorInertia: document.getElementById("motorInertia"),
};

const readout = document.getElementById("readout");

const g = 9.81;
const beamLength = 1.2;
const beamPixel = 760;
const center = { x: canvas.width / 2, y: canvas.height / 2 + 40 };

const state = {
  running: false,
  x: 0.22,
  v: 0,
  theta: 0,
  thetaDot: 0,
  integral: 0,
  prevError: 0,
  t: 0,
};

function getParams() {
  const density = Number(controls.density.value);
  const diameter = Number(controls.diameter.value);
  const radius = diameter / 2;
  const volume = (4 / 3) * Math.PI * Math.pow(radius, 3);
  const mass = density * volume;

  return {
    density,
    diameter,
    radius,
    mass,
    kp: Number(controls.kp.value),
    ki: Number(controls.ki.value),
    kd: Number(controls.kd.value),
    maxAngleRad: (Number(controls.maxAngle.value) * Math.PI) / 180,
    motorGain: Number(controls.motorGain.value),
    motorDamping: Number(controls.motorDamping.value),
    motorInertia: Number(controls.motorInertia.value),
  };
}

function reset() {
  state.running = false;
  state.x = 0.24;
  state.v = 0;
  state.theta = 0;
  state.thetaDot = 0;
  state.integral = 0;
  state.prevError = -state.x;
  state.t = 0;
}

function disturb() {
  state.v += (Math.random() - 0.5) * 0.8;
}

function step(dt) {
  const p = getParams();

  const ref = 0;
  const error = ref - state.x;
  state.integral += error * dt;
  const derivative = (error - state.prevError) / dt;
  state.prevError = error;

  const u = p.kp * error + p.ki * state.integral + p.kd * derivative;

  const thetaDDot = (p.motorGain * u - p.motorDamping * state.thetaDot) / p.motorInertia;
  state.thetaDot += thetaDDot * dt;
  state.theta += state.thetaDot * dt;

  if (state.theta > p.maxAngleRad) {
    state.theta = p.maxAngleRad;
    state.thetaDot *= -0.15;
  }
  if (state.theta < -p.maxAngleRad) {
    state.theta = -p.maxAngleRad;
    state.thetaDot *= -0.15;
  }

  const rollingAccel = (5 / 7) * g * Math.sin(state.theta);
  state.v += rollingAccel * dt;
  state.x += state.v * dt;

  const half = beamLength / 2 - p.radius;
  if (state.x > half) {
    state.x = half;
    state.v *= -0.3;
  }
  if (state.x < -half) {
    state.x = -half;
    state.v *= -0.3;
  }

  state.t += dt;

  readout.innerHTML = `
    <div>t: <b>${state.t.toFixed(2)} s</b></div>
    <div>Ball x: <b>${state.x.toFixed(3)} m</b> (ref = 0 m)</div>
    <div>Ball v: <b>${state.v.toFixed(3)} m/s</b></div>
    <div>Beam θ: <b>${((state.theta * 180) / Math.PI).toFixed(2)}°</b></div>
    <div>Ball mass: <b>${p.mass.toFixed(3)} kg</b></div>
    <div class="warn">벽 충돌 가능 / 공은 빔 밖으로 이탈 불가</div>
  `;
}

function drawGrid() {
  ctx.strokeStyle = "rgba(0,255,255,0.08)";
  ctx.lineWidth = 1;
  for (let i = 0; i < canvas.width; i += 40) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i, canvas.height);
    ctx.stroke();
  }
  for (let j = 0; j < canvas.height; j += 40) {
    ctx.beginPath();
    ctx.moveTo(0, j);
    ctx.lineTo(canvas.width, j);
    ctx.stroke();
  }
}

function draw() {
  const p = getParams();
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawGrid();

  ctx.save();
  ctx.translate(center.x, center.y);
  ctx.rotate(state.theta);

  const halfPx = beamPixel / 2;

  ctx.fillStyle = "#8ea0d6";
  ctx.fillRect(-halfPx, -8, beamPixel, 16);

  ctx.fillStyle = "#ff4d9d";
  ctx.shadowColor = "#ff4d9d";
  ctx.shadowBlur = 22;
  ctx.fillRect(-halfPx - 10, -40, 12, 80);
  ctx.fillRect(halfPx - 2, -40, 12, 80);

  const xPx = (state.x / beamLength) * beamPixel;
  const rPx = Math.max(12, p.radius * 200);

  ctx.beginPath();
  ctx.fillStyle = "#00e6ff";
  ctx.shadowColor = "#00e6ff";
  ctx.shadowBlur = 18;
  ctx.arc(xPx, -rPx - 8, rPx, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();

  ctx.beginPath();
  ctx.fillStyle = "#39ffb6";
  ctx.shadowColor = "#39ffb6";
  ctx.shadowBlur = 25;
  ctx.arc(center.x, center.y, 16, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#b8c8f8";
  ctx.font = "14px Segoe UI";
  ctx.fillText("Motor (Beam Center)", center.x - 70, center.y + 35);
}

let last = performance.now();
function loop(now) {
  const dt = Math.min(0.02, (now - last) / 1000);
  last = now;

  if (state.running) {
    step(dt);
  }
  draw();
  requestAnimationFrame(loop);
}

document.getElementById("startBtn").addEventListener("click", () => {
  state.running = true;
});

document.getElementById("pauseBtn").addEventListener("click", () => {
  state.running = false;
});

document.getElementById("resetBtn").addEventListener("click", () => {
  reset();
});

document.getElementById("disturbBtn").addEventListener("click", () => {
  disturb();
});

Object.values(controls).forEach((input) => {
  input.addEventListener("change", () => {
    const p = getParams();
    const half = beamLength / 2 - p.radius;
    state.x = Math.max(-half, Math.min(half, state.x));
  });
});

reset();
requestAnimationFrame(loop);
