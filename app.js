const canvas = document.getElementById("simCanvas");
const ctx = canvas.getContext("2d");
const plotCanvas = document.getElementById("plotCanvas");
const plotCtx = plotCanvas.getContext("2d");

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
const plotWindowSec = 12;

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

const history = [];

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
  history.length = 0;
}

function disturb() {
  state.v += (Math.random() - 0.5) * 0.8;
}

function trackHistory(ref) {
  history.push({ t: state.t, ref, x: state.x });
  const threshold = state.t - plotWindowSec;
  while (history.length > 2 && history[0].t < threshold) {
    history.shift();
  }
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
  trackHistory(ref);

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

function drawPlot() {
  const w = plotCanvas.width;
  const h = plotCanvas.height;
  const margin = { left: 52, right: 16, top: 12, bottom: 28 };
  const innerW = w - margin.left - margin.right;
  const innerH = h - margin.top - margin.bottom;

  plotCtx.clearRect(0, 0, w, h);
  plotCtx.fillStyle = "#071120";
  plotCtx.fillRect(0, 0, w, h);

  const now = state.t;
  const tMin = Math.max(0, now - plotWindowSec);
  const tMax = tMin + plotWindowSec;
  const yMin = -beamLength / 2;
  const yMax = beamLength / 2;

  plotCtx.strokeStyle = "rgba(0,230,255,0.2)";
  plotCtx.lineWidth = 1;
  for (let i = 0; i <= 6; i += 1) {
    const y = margin.top + (innerH * i) / 6;
    plotCtx.beginPath();
    plotCtx.moveTo(margin.left, y);
    plotCtx.lineTo(margin.left + innerW, y);
    plotCtx.stroke();
  }

  const xScale = (t) => margin.left + ((t - tMin) / (tMax - tMin)) * innerW;
  const yScale = (v) => margin.top + ((yMax - v) / (yMax - yMin)) * innerH;

  plotCtx.strokeStyle = "#ff5ca8";
  plotCtx.lineWidth = 2;
  plotCtx.beginPath();
  plotCtx.moveTo(margin.left, yScale(0));
  plotCtx.lineTo(margin.left + innerW, yScale(0));
  plotCtx.stroke();

  if (history.length > 1) {
    plotCtx.strokeStyle = "#00e6ff";
    plotCtx.shadowColor = "#00e6ff";
    plotCtx.shadowBlur = 10;
    plotCtx.lineWidth = 2;
    plotCtx.beginPath();
    history.forEach((point, index) => {
      const x = xScale(point.t);
      const y = yScale(point.x);
      if (index === 0) {
        plotCtx.moveTo(x, y);
      } else {
        plotCtx.lineTo(x, y);
      }
    });
    plotCtx.stroke();
    plotCtx.shadowBlur = 0;
  }

  plotCtx.fillStyle = "#8ea0d6";
  plotCtx.font = "12px Segoe UI";
  plotCtx.fillText(`${tMin.toFixed(1)} s`, margin.left, h - 8);
  plotCtx.fillText(`${tMax.toFixed(1)} s`, w - 50, h - 8);
  plotCtx.fillText(`${(yMax).toFixed(2)} m`, 6, margin.top + 6);
  plotCtx.fillText(`0.00 m`, 6, yScale(0) + 4);
  plotCtx.fillText(`${(yMin).toFixed(2)} m`, 6, margin.top + innerH);
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

  drawPlot();
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
trackHistory(0);
requestAnimationFrame(loop);
