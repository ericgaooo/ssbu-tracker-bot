const { createCanvas } = require("canvas");
const GIFEncoder = require("gifencoder");

function clampText(ctx, text, maxWidth) {
  let output = String(text ?? "");
  while (output.length > 0 && ctx.measureText(output).width > maxWidth) {
    output = output.slice(0, -1);
  }
  return output === text ? output : `${output}…`;
}

function drawBackground(ctx, width, height, frame = 0) {
  const bg = ctx.createLinearGradient(0, 0, width, height);
  bg.addColorStop(0, "#120f1f");
  bg.addColorStop(0.45, "#231942");
  bg.addColorStop(1, "#0f172a");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, width, height);

  for (let i = 0; i < 18; i += 1) {
    const x = (i * 79 + frame * 14) % (width + 180) - 90;
    const y = 100 + ((i * 97) % (height - 200));
    const r = 18 + (i % 4) * 10;

    const glow = ctx.createRadialGradient(x, y, 0, x, y, r * 2.8);
    glow.addColorStop(0, "rgba(255, 214, 10, 0.22)");
    glow.addColorStop(0.5, "rgba(255, 122, 0, 0.12)");
    glow.addColorStop(1, "rgba(255, 255, 255, 0)");
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(x, y, r * 2.8, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.save();
  ctx.globalAlpha = 0.09;
  for (let i = 0; i < 9; i += 1) {
    const x = 100 + i * 125 + Math.sin((frame + i) * 0.35) * 18;
    const y = 160 + (i % 3) * 210;
    drawImpactBurst(ctx, x, y, 26 + (i % 3) * 8, "#ffffff");
  }
  ctx.restore();
}

function drawImpactBurst(ctx, cx, cy, radius, color) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.fillStyle = color;
  for (let i = 0; i < 12; i += 1) {
    ctx.rotate(Math.PI / 6);
    ctx.beginPath();
    ctx.moveTo(0, -radius * 1.8);
    ctx.lineTo(radius * 0.28, -radius * 0.7);
    ctx.lineTo(-radius * 0.28, -radius * 0.7);
    ctx.closePath();
    ctx.fill();
  }
  ctx.beginPath();
  ctx.arc(0, 0, radius * 0.52, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawSpikeBall(ctx, x, y, r, rotation = 0) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rotation);

  const ring = ctx.createRadialGradient(0, 0, r * 0.12, 0, 0, r);
  ring.addColorStop(0, "#fff7c2");
  ring.addColorStop(0.45, "#ffd60a");
  ring.addColorStop(0.8, "#ff9f1c");
  ring.addColorStop(1, "#ff6b00");

  ctx.fillStyle = ring;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = "rgba(84, 35, 0, 0.42)";
  ctx.lineWidth = Math.max(2, r * 0.08);
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.72, Math.PI * 0.22, Math.PI * 1.1);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.78, Math.PI * 1.22, Math.PI * 1.95);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(-r * 0.76, -r * 0.05);
  ctx.quadraticCurveTo(0, -r * 0.52, r * 0.76, -r * 0.08);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(-r * 0.72, r * 0.16);
  ctx.quadraticCurveTo(0, r * 0.62, r * 0.72, r * 0.12);
  ctx.stroke();

  ctx.restore();
}

function drawHeader(ctx, width, frame) {
  ctx.save();

  ctx.fillStyle = "rgba(255,255,255,0.08)";
  roundRect(ctx, 56, 36, width - 112, 170, 32);
  ctx.fill();

  ctx.font = "bold 62px Sans";
  ctx.fillStyle = "#ffffff";
  ctx.fillText("ANDREW SPIKER LEADERBOARD", 88, 106);

  ctx.font = "28px Sans";
  ctx.fillStyle = "#ffd166";
  ctx.fillText("Documenting crimes against the newest player", 90, 148);

  const bounce = Math.sin(frame * 0.35) * 6;
  drawSpikeBall(ctx, width - 115, 110 + bounce, 42, frame * 0.12);
  drawImpactBurst(ctx, width - 115, 110 + bounce, 30 + Math.sin(frame * 0.35) * 3, "rgba(255,255,255,0.65)");

  ctx.restore();
}

function drawAndrewZone(ctx, width, height, frame) {
  const zoneY = height - 185;

  const zone = ctx.createLinearGradient(0, zoneY, 0, height);
  zone.addColorStop(0, "rgba(255, 90, 95, 0.16)");
  zone.addColorStop(1, "rgba(255, 30, 60, 0.3)");
  ctx.fillStyle = zone;
  roundRect(ctx, 56, zoneY, width - 112, 120, 28);
  ctx.fill();

  const wobble = Math.sin(frame * 0.5) * 5;

  ctx.font = "bold 36px Sans";
  ctx.fillStyle = "#ffe8e8";
  ctx.fillText("Andrew danger zone", 88, zoneY + 48);

  ctx.font = "24px Sans";
  ctx.fillStyle = "#ffd1d1";
  ctx.fillText("Current defensive rating: absolutely cooked", 88, zoneY + 84);

  drawImpactBurst(ctx, width - 125, zoneY + 58 + wobble, 26 + Math.sin(frame * 0.45) * 2, "#ffb703");
  drawSpikeBall(ctx, width - 125, zoneY + 58 + wobble, 28, frame * 0.18);
}

function drawRow(ctx, row, index, x, y, width, frame) {
  const isTop = index === 0;
  const cardHeight = 92;
  const lift = isTop ? Math.sin(frame * 0.45) * 3 : 0;

  ctx.save();
  ctx.translate(0, lift);

  const fill = ctx.createLinearGradient(x, y, x + width, y + cardHeight);
  if (isTop) {
    fill.addColorStop(0, "rgba(255, 214, 10, 0.95)");
    fill.addColorStop(1, "rgba(255, 122, 0, 0.95)");
  } else {
    fill.addColorStop(0, "rgba(255,255,255,0.09)");
    fill.addColorStop(1, "rgba(255,255,255,0.04)");
  }

  ctx.fillStyle = fill;
  roundRect(ctx, x, y, width, cardHeight, 24);
  ctx.fill();

  if (isTop) {
    ctx.strokeStyle = "rgba(255,255,255,0.42)";
    ctx.lineWidth = 2;
    roundRect(ctx, x, y, width, cardHeight, 24);
    ctx.stroke();
  }

  ctx.fillStyle = isTop ? "#2b1400" : "#ffffff";
  ctx.font = "bold 34px Sans";
  ctx.fillText(`#${index + 1}`, x + 24, y + 56);

  ctx.font = "bold 30px Sans";
  const name = clampText(ctx, row.displayName, width - 300);
  ctx.fillText(name, x + 110, y + 54);

  ctx.font = "24px Sans";
  ctx.fillStyle = isTop ? "#4a2500" : "#d9dbff";
  const tag =
    row.count >= 25
      ? "Certified menace"
      : row.count >= 10
      ? "Spike enthusiast"
      : row.count >= 5
      ? "Rising threat"
      : "Developing villain arc";
  ctx.fillText(tag, x + 112, y + 82);

  ctx.font = "bold 34px Sans";
  ctx.fillStyle = isTop ? "#2b1400" : "#ffd166";
  ctx.textAlign = "right";
  ctx.fillText(`${row.count} spike${row.count === 1 ? "" : "s"}`, x + width - 26, y + 58);
  ctx.textAlign = "left";

  ctx.restore();
}

function roundRect(ctx, x, y, width, height, radius) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

function getCanvasHeight(rowCount) {
  const visibleRows = Math.max(1, rowCount);
  return Math.max(760, 250 + visibleRows * 108 + 170);
}

function drawFrame(ctx, rows, width, height, frame) {
  drawBackground(ctx, width, height, frame);
  drawHeader(ctx, width, frame);

  const startY = 230;
  const rowWidth = width - 112;
  const rowX = 56;

  rows.forEach((row, index) => {
    drawRow(ctx, row, index, rowX, startY + index * 108, rowWidth, frame);
  });

  if (rows.length === 0) {
    ctx.fillStyle = "rgba(255,255,255,0.1)";
    roundRect(ctx, 56, 248, width - 112, 110, 26);
    ctx.fill();

    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 34px Sans";
    ctx.fillText("No Andrew spikes recorded yet.", 90, 314);
  }

  drawAndrewZone(ctx, width, height, frame);

  if (rows.length > 0) {
    const stampPulse = 1 + Math.sin(frame * 0.45) * 0.03;
    ctx.save();
    ctx.translate(width - 205, 210);
    ctx.rotate(-0.18);
    ctx.scale(stampPulse, stampPulse);

    ctx.strokeStyle = "rgba(255, 80, 80, 0.95)";
    ctx.lineWidth = 5;
    roundRect(ctx, -110, -34, 220, 68, 18);
    ctx.stroke();

    ctx.font = "bold 30px Sans";
    ctx.fillStyle = "rgba(255, 80, 80, 0.95)";
    ctx.textAlign = "center";
    ctx.fillText("SPIKE!", 0, 11);
    ctx.restore();
    ctx.textAlign = "left";
  }
}

async function generateAndrewSpikeImage(rows) {
  const width = 1000;
  const height = getCanvasHeight(rows.length);
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext("2d");

  drawFrame(ctx, rows, width, height, 0);

  return canvas.toBuffer("image/png");
}

async function generateAndrewSpikeGif(rows) {
  const width = 1000;
  const height = getCanvasHeight(rows.length);
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext("2d");

  const encoder = new GIFEncoder(width, height);
  encoder.start();
  encoder.setRepeat(0);
  encoder.setDelay(70);
  encoder.setQuality(10);

  const totalFrames = 18;
  for (let frame = 0; frame < totalFrames; frame += 1) {
    drawFrame(ctx, rows, width, height, frame);
    encoder.addFrame(ctx);
  }

  encoder.finish();
  return encoder.out.getData();
}

module.exports = {
  generateAndrewSpikeImage,
  generateAndrewSpikeGif
};