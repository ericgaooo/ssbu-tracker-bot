const { createCanvas, loadImage, registerFont } = require("canvas");
const GIFEncoder = require("gif-encoder-2");

registerFont("./assets/fonts/Nunito-Bold.ttf", {
  family: "SmashFont",
  weight: "bold"
});

registerFont("./assets/fonts/Nunito-Regular.ttf", {
  family: "SmashFont",
  weight: "normal"
});

async function getDisplayNameFromGuild(guild, userId, fallback = "Unknown Player") {
  try {
    const member = await guild.members.fetch(userId);
    return member.displayName;
  } catch {
    return fallback;
  }
}

async function getAvatarUrlFromGuild(guild, userId) {
  try {
    const member = await guild.members.fetch(userId);
    return member.displayAvatarURL({
      extension: "png",
      size: 256,
      forceStatic: true
    });
  } catch {
    return null;
  }
}

async function buildLeaderboardEntries(guild, rows) {
  return Promise.all(
    rows.map(async (row, index) => {
      const displayName = await getDisplayNameFromGuild(
        guild,
        row.user_id,
        row.username || "Unknown Player"
      );

      const avatarUrl = await getAvatarUrlFromGuild(guild, row.user_id);

      let avatarImage = null;
      if (avatarUrl) {
        try {
          avatarImage = await loadImage(avatarUrl);
        } catch {
          avatarImage = null;
        }
      }

      return {
        ...row,
        place: index + 1,
        displayName,
        canvasDisplayName: sanitizeDisplayNameForCanvas(displayName),
        avatarImage
      };
    })
  );
}

function drawRoundedRect(ctx, x, y, width, height, radius) {
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

function drawCircleImage(ctx, image, x, y, size) {
  ctx.save();
  ctx.beginPath();
  ctx.arc(x + size / 2, y + size / 2, size / 2, 0, Math.PI * 2);
  ctx.closePath();
  ctx.clip();
  ctx.drawImage(image, x, y, size, size);
  ctx.restore();
}

function truncateText(ctx, text, maxWidth) {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let output = text;
  while (output.length > 0 && ctx.measureText(`${output}…`).width > maxWidth) {
    output = output.slice(0, -1);
  }
  return `${output}…`;
}

function sanitizeDisplayNameForCanvas(name) {
  if (!name) return name;
  const stripped = name
    .replace(/[\p{Extended_Pictographic}\p{Emoji_Presentation}\uFE0F\u200D]/gu, "")
    .replace(/\s+/g, " ")
    .trim();
  return stripped || name;
}

function getPlacementColors(place) {
  if (place === 1) {
    return {
      bg: "#161006",
      accent: "#FFD84D",
      text: "#FFF7D6",
      glow: "rgba(255,216,77,0.65)",
      badgeBg: "#FFE27D",
      badgeText: "#2A1800",
      panelEdge: "rgba(255,216,77,0.65)"
    };
  }
  if (place === 2) {
    return {
      bg: "#0E1839",
      accent: "#E4ECFF",
      text: "#F3F7FF",
      glow: "rgba(228,236,255,0.32)",
      badgeBg: "#EEF3FF",
      badgeText: "#1A2745",
      panelEdge: "rgba(228,236,255,0.35)"
    };
  }
  if (place === 3) {
    return {
      bg: "#34150E",
      accent: "#FFBE94",
      text: "#FFEADF",
      glow: "rgba(255,190,148,0.38)",
      badgeBg: "#FFD7BF",
      badgeText: "#472012",
      panelEdge: "rgba(255,190,148,0.35)"
    };
  }

  return {
    bg: "#111733",
    accent: "#7FA3FF",
    text: "#F1F5FF",
    glow: "rgba(127,163,255,0.20)",
    badgeBg: "#26305F",
    badgeText: "#F1F5FF",
    panelEdge: "rgba(127,163,255,0.25)"
  };
}

function createParticles(width, height, count) {
  const colors = ["#FFD84D", "#FFFFFF", "#63E3FF", "#FF4FB8", "#8F7BFF"];
  return Array.from({ length: count }, () => ({
    x: Math.random() * width,
    y: Math.random() * height,
    len: 7 + Math.random() * 14,
    thickness: 1.4 + Math.random() * 2.2,
    angle: Math.random() * Math.PI,
    color: colors[Math.floor(Math.random() * colors.length)],
    alpha: 0.35 + Math.random() * 0.45,
    ampX: 10 + Math.random() * 28,
    ampY: 14 + Math.random() * 42,
    phase: Math.random() * Math.PI * 2,
    speed: 0.7 + Math.random() * 1.3
  }));
}

function createEnergyOrbs(width, height, count) {
  const colors = [
    "rgba(255,216,77,0.16)",
    "rgba(255,79,184,0.10)",
    "rgba(99,227,255,0.10)",
    "rgba(143,123,255,0.12)"
  ];

  return Array.from({ length: count }, () => ({
    x: Math.random() * width,
    y: Math.random() * height,
    r: 24 + Math.random() * 52,
    phase: Math.random() * Math.PI * 2,
    speed: 0.55 + Math.random() * 1.1,
    driftX: 8 + Math.random() * 24,
    driftY: 10 + Math.random() * 28,
    color: colors[Math.floor(Math.random() * colors.length)]
  }));
}

function createSparkles(width, height, count) {
  return Array.from({ length: count }, () => ({
    x: Math.random() * width,
    y: Math.random() * height,
    size: 4 + Math.random() * 8,
    phase: Math.random() * Math.PI * 2,
    speed: 0.6 + Math.random() * 1.2
  }));
}

function drawParticles(ctx, particles, phase) {
  for (const p of particles) {
    const x = p.x + Math.sin(phase * p.speed + p.phase) * p.ampX;
    const y = p.y + Math.cos(phase * p.speed + p.phase) * p.ampY;
    const dx = Math.cos(p.angle) * p.len;
    const dy = Math.sin(p.angle) * p.len;

    ctx.save();
    ctx.globalAlpha = p.alpha;
    ctx.strokeStyle = p.color;
    ctx.lineWidth = p.thickness;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + dx, y + dy);
    ctx.stroke();
    ctx.restore();
  }
}

function drawOrbs(ctx, orbs, phase) {
  for (const o of orbs) {
    const x = o.x + Math.sin(phase * o.speed + o.phase) * o.driftX;
    const y = o.y + Math.cos(phase * o.speed + o.phase) * o.driftY;

    ctx.beginPath();
    ctx.arc(x, y, o.r, 0, Math.PI * 2);
    ctx.fillStyle = o.color;
    ctx.fill();
  }
}

function drawSparkle(ctx, x, y, size, alpha) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = "#FFFFFF";
  ctx.lineWidth = 2;
  ctx.lineCap = "round";

  ctx.beginPath();
  ctx.moveTo(x - size, y);
  ctx.lineTo(x + size, y);
  ctx.moveTo(x, y - size);
  ctx.lineTo(x, y + size);
  ctx.stroke();

  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(x - size * 0.65, y - size * 0.65);
  ctx.lineTo(x + size * 0.65, y + size * 0.65);
  ctx.moveTo(x + size * 0.65, y - size * 0.65);
  ctx.lineTo(x - size * 0.65, y + size * 0.65);
  ctx.stroke();

  ctx.restore();
}

function drawSparkles(ctx, sparkles, phase) {
  for (const s of sparkles) {
    const alpha = 0.10 + (Math.sin(phase * s.speed + s.phase) + 1) * 0.18;
    drawSparkle(ctx, s.x, s.y, s.size, alpha);
  }
}

function drawSmashBallBurst(ctx, centerX, centerY, phase) {
  const pulse = 1 + Math.sin(phase) * 0.04;

  const halo = ctx.createRadialGradient(centerX, centerY, 16, centerX, centerY, 280 * pulse);
  halo.addColorStop(0, "rgba(255,255,255,0.25)");
  halo.addColorStop(0.16, "rgba(255,220,102,0.24)");
  halo.addColorStop(0.4, "rgba(255,220,102,0.11)");
  halo.addColorStop(0.72, "rgba(255,79,184,0.05)");
  halo.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = halo;
  ctx.fillRect(centerX - 320, centerY - 320, 640, 640);

  const rays = 16;
  ctx.save();
  ctx.translate(centerX, centerY);
  for (let i = 0; i < rays; i++) {
    const angle = (Math.PI * 2 * i) / rays + phase * 0.08;
    ctx.save();
    ctx.rotate(angle);
    const rayGrad = ctx.createLinearGradient(0, 0, 180, 0);
    rayGrad.addColorStop(0, "rgba(255,255,255,0.26)");
    rayGrad.addColorStop(0.18, "rgba(255,227,120,0.22)");
    rayGrad.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = rayGrad;
    ctx.fillRect(24, -3, 180, 6);
    ctx.restore();
  }
  ctx.restore();

  const slashGrad = ctx.createLinearGradient(centerX - 260, centerY - 160, centerX + 260, centerY + 160);
  slashGrad.addColorStop(0, "rgba(255,255,255,0)");
  slashGrad.addColorStop(0.46, "rgba(255,255,255,0.06)");
  slashGrad.addColorStop(0.5, "rgba(255,255,255,0.18)");
  slashGrad.addColorStop(0.54, "rgba(255,255,255,0.06)");
  slashGrad.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = slashGrad;
  ctx.save();
  ctx.translate(centerX, centerY);
  ctx.rotate(-0.30);
  ctx.fillRect(-320, -12, 640, 24);
  ctx.restore();
}

function drawBackground(ctx, width, height, particles = null, orbs = null, sparkles = null, phase = 0) {
  const bg = ctx.createLinearGradient(0, 0, width, height);
  bg.addColorStop(0, "#02040D");
  bg.addColorStop(0.35, "#0B1032");
  bg.addColorStop(0.68, "#150926");
  bg.addColorStop(1, "#05070F");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, width, height);

  const leftGlow = ctx.createRadialGradient(180, 180, 20, 180, 180, 420);
  leftGlow.addColorStop(0, "rgba(255,79,184,0.15)");
  leftGlow.addColorStop(1, "rgba(255,79,184,0)");
  ctx.fillStyle = leftGlow;
  ctx.fillRect(0, 0, width, height);

  const rightGlow = ctx.createRadialGradient(width - 180, 180, 20, width - 180, 180, 420);
  rightGlow.addColorStop(0, "rgba(99,227,255,0.15)");
  rightGlow.addColorStop(1, "rgba(99,227,255,0)");
  ctx.fillStyle = rightGlow;
  ctx.fillRect(0, 0, width, height);

  drawSmashBallBurst(ctx, width / 2, 150, phase);

  if (orbs) drawOrbs(ctx, orbs, phase);
  if (sparkles) drawSparkles(ctx, sparkles, phase);
  if (particles) drawParticles(ctx, particles, phase);
}

function drawHeaderShimmer(ctx, x, y, width, height, phase) {
  const t = (Math.sin(phase) + 1) / 2;
  const shimmerX = x - 140 + t * (width + 280);

  ctx.save();
  drawRoundedRect(ctx, x, y, width, height, 28);
  ctx.clip();

  const grad = ctx.createLinearGradient(shimmerX - 180, 0, shimmerX + 180, 0);
  grad.addColorStop(0, "rgba(255,255,255,0)");
  grad.addColorStop(0.35, "rgba(255,255,255,0.08)");
  grad.addColorStop(0.5, "rgba(255,255,255,0.22)");
  grad.addColorStop(0.65, "rgba(255,255,255,0.08)");
  grad.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = grad;
  ctx.fillRect(shimmerX - 200, y, 400, height);

  ctx.restore();
}

function drawHeader(ctx, width, phase) {
  const x = 24;
  const y = 18;
  const w = width - 48;
  const h = 96;

  drawRoundedRect(ctx, x, y, w, h, 26);
  const headerGrad = ctx.createLinearGradient(x, y, x + w, y);
  headerGrad.addColorStop(0, "rgba(56,20,116,0.92)");
  headerGrad.addColorStop(0.33, "rgba(54,47,146,0.92)");
  headerGrad.addColorStop(0.66, "rgba(34,83,150,0.92)");
  headerGrad.addColorStop(1, "rgba(56,131,163,0.92)");
  ctx.fillStyle = headerGrad;
  ctx.fill();

  drawHeaderShimmer(ctx, x, y, w, h, phase);

  ctx.fillStyle = "#F7FAFF";
  ctx.font = "bold 42px SmashFont";
  ctx.fillText("SSBU LEADERBOARD", x + 26, y + 50);

  ctx.fillStyle = "#D0DBFF";
  ctx.font = "20px SmashFont";
  ctx.fillText("Official Ranked Order", x + 26, y + 78);
}

function drawRankBadge(ctx, x, y, place, colors) {
  const w = 74;
  const h = 44;
  drawRoundedRect(ctx, x, y, w, h, 14);
  ctx.fillStyle = colors.badgeBg;
  ctx.fill();

  ctx.fillStyle = colors.badgeText;
  ctx.font = "bold 22px SmashFont";
  const text = `#${place}`;
  const tw = ctx.measureText(text).width;
  ctx.fillText(text, x + (w - tw) / 2, y + 30);
}

function drawRecordPill(ctx, x, y, w, h, recordText) {
  drawRoundedRect(ctx, x, y, w, h, 16);
  ctx.fillStyle = "rgba(255,255,255,0.10)";
  ctx.fill();

  ctx.fillStyle = "#FFFFFF";
  ctx.font = "bold 24px SmashFont";
  const tw = ctx.measureText(recordText).width;
  ctx.fillText(recordText, x + (w - tw) / 2, y + 28);
}

function drawTopPlayerCard(ctx, entry, x, y, w, h, phase, isChampion = false) {
  const colors = getPlacementColors(entry.place);
  const avatarSize = isChampion ? 140 : 102;
  const pulse = isChampion
    ? 20 + (Math.sin(phase) + 1) * 8
    : 12 + (Math.sin(phase + entry.place) + 1) * 3;

  ctx.save();
  ctx.shadowColor = colors.glow;
  ctx.shadowBlur = pulse;
  drawRoundedRect(ctx, x, y, w, h, 26);
  ctx.fillStyle = colors.bg;
  ctx.fill();
  ctx.restore();

  drawRoundedRect(ctx, x, y, w, h, 26);
  ctx.fillStyle = colors.bg;
  ctx.fill();

  drawRoundedRect(ctx, x, y, 10, h, 5);
  ctx.fillStyle = colors.accent;
  ctx.fill();

  drawRankBadge(ctx, x + 18, y + 18, entry.place, colors);

  if (isChampion) {
    const champX = x + w - 136;
    const champY = y + 18;
    drawRoundedRect(ctx, champX, champY, 116, 28, 12);
    ctx.fillStyle = "#FFD447";
    ctx.fill();

    ctx.fillStyle = "#2D1B00";
    ctx.font = "bold 14px SmashFont";
    const txt = "CHAMPION";
    const tw = ctx.measureText(txt).width;
    ctx.fillText(txt, champX + (116 - tw) / 2, champY + 19);
  }

  const bob = isChampion ? Math.sin(phase) * 7 : Math.sin(phase + entry.place) * 3;
  const avatarX = x + (w - avatarSize) / 2;
  const avatarY = y + 64 + bob;

  if (entry.avatarImage) {
    drawCircleImage(ctx, entry.avatarImage, avatarX, avatarY, avatarSize);
    ctx.beginPath();
    ctx.arc(
      avatarX + avatarSize / 2,
      avatarY + avatarSize / 2,
      avatarSize / 2 + 2,
      0,
      Math.PI * 2
    );
    ctx.strokeStyle = "rgba(255,255,255,0.40)";
    ctx.lineWidth = 3;
    ctx.stroke();
  } else {
    ctx.beginPath();
    ctx.arc(
      avatarX + avatarSize / 2,
      avatarY + avatarSize / 2,
      avatarSize / 2,
      0,
      Math.PI * 2
    );
    ctx.fillStyle = "#2C366B";
    ctx.fill();

    ctx.fillStyle = "#F3F7FF";
    ctx.font = `bold ${isChampion ? 44 : 36}px SmashFont`;
    const initial = entry.canvasDisplayName.slice(0, 1).toUpperCase();
    const tw = ctx.measureText(initial).width;
    ctx.fillText(initial, avatarX + (avatarSize - tw) / 2, avatarY + avatarSize / 2 + 16);
  }

  ctx.fillStyle = colors.text;
  ctx.font = isChampion ? "bold 34px SmashFont" : "bold 28px SmashFont";
  const name = truncateText(ctx, entry.canvasDisplayName, w - 40);
  const nameW = ctx.measureText(name).width;
  ctx.fillText(name, x + (w - nameW) / 2, y + h - 96);

  ctx.fillStyle = "#DCE6FF";
  ctx.font = "24px SmashFont";
  const rankText = `Rank #${entry.rank}`;
  const rankW = ctx.measureText(rankText).width;
  ctx.fillText(rankText, x + (w - rankW) / 2, y + h - 58);

  const pillW = 170;
  const pillH = 42;
  const pillX = x + (w - pillW) / 2;
  const pillY = y + h - 38;
  drawRecordPill(ctx, pillX, pillY, pillW, pillH, `${entry.setWins}-${entry.setLosses}`);
}

function drawLowerCard(ctx, entry, x, y, w, h, phase) {
  const colors = getPlacementColors(entry.place);
  const pulse = 10 + (Math.sin(phase + entry.place * 0.35) + 1) * 2;

  ctx.save();
  ctx.shadowColor = colors.glow;
  ctx.shadowBlur = pulse;
  drawRoundedRect(ctx, x, y, w, h, 22);
  ctx.fillStyle = colors.bg;
  ctx.fill();
  ctx.restore();

  drawRoundedRect(ctx, x, y, w, h, 22);
  ctx.fillStyle = colors.bg;
  ctx.fill();

  drawRoundedRect(ctx, x, y, 8, h, 5);
  ctx.fillStyle = colors.accent;
  ctx.fill();

  drawRankBadge(ctx, x + 18, y + 18, entry.place, colors);

  const avatarSize = 68;
  const avatarX = x + 112;
  const avatarY = y + (h - avatarSize) / 2;

  if (entry.avatarImage) {
    drawCircleImage(ctx, entry.avatarImage, avatarX, avatarY, avatarSize);
    ctx.beginPath();
    ctx.arc(avatarX + avatarSize / 2, avatarY + avatarSize / 2, avatarSize / 2 + 2, 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(255,255,255,0.36)";
    ctx.lineWidth = 3;
    ctx.stroke();
  } else {
    ctx.beginPath();
    ctx.arc(avatarX + avatarSize / 2, avatarY + avatarSize / 2, avatarSize / 2, 0, Math.PI * 2);
    ctx.fillStyle = "#2C366B";
    ctx.fill();

    ctx.fillStyle = "#F3F7FF";
    ctx.font = "bold 26px SmashFont";
    const initial = entry.canvasDisplayName.slice(0, 1).toUpperCase();
    const tw = ctx.measureText(initial).width;
    ctx.fillText(initial, avatarX + (avatarSize - tw) / 2, avatarY + 44);
  }

  const textX = avatarX + avatarSize + 18;
  ctx.fillStyle = "#F6FAFF";
  ctx.font = "bold 28px SmashFont";
  const name = truncateText(ctx, entry.canvasDisplayName, 400);
  ctx.fillText(name, textX, y + 44);

  ctx.fillStyle = "#DCE6FF";
  ctx.font = "22px SmashFont";
  ctx.fillText(`Rank #${entry.rank}`, textX, y + 76);

  const pillW = 190;
  const pillH = 42;
  const pillX = x + w - pillW - 24;
  const pillY = y + 30;
  drawRecordPill(ctx, pillX, pillY, pillW, pillH, `${entry.setWins}-${entry.setLosses}`);
}

function drawTopSection(ctx, entries, width, phase) {
  const topThree = entries.slice(0, 3);
  const first = topThree.find((e) => e.place === 1);
  const second = topThree.find((e) => e.place === 2);
  const third = topThree.find((e) => e.place === 3);

  const topY = 152;
  const centerW = 378;
  const centerH = 352;
  const sideW = 292;
  const sideH = 292;
  const gap = 26;

  const centerX = (width - centerW) / 2;
  const leftX = centerX - sideW - gap;
  const rightX = centerX + centerW + gap;
  const sideY = topY + 34;

  if (second) drawTopPlayerCard(ctx, second, leftX, sideY, sideW, sideH, phase, false);
  if (first) drawTopPlayerCard(ctx, first, centerX, topY, centerW, centerH, phase, true);
  if (third) drawTopPlayerCard(ctx, third, rightX, sideY, sideW, sideH, phase, false);
}

function drawLowerSection(ctx, entries, width, phase) {
  const rest = entries.slice(3);
  if (rest.length === 0) return;

  const startY = 538;
  const cardH = 102;
  const gap = 16;
  const x = 32;
  const w = width - 64;

  for (let i = 0; i < rest.length; i++) {
    const y = startY + i * (cardH + gap);
    drawLowerCard(ctx, rest[i], x, y, w, cardH, phase);
  }
}

function drawLeaderboardFrame(
  ctx,
  entries,
  width,
  height,
  particles = null,
  orbs = null,
  sparkles = null,
  phase = 0
) {
  drawBackground(ctx, width, height, particles, orbs, sparkles, phase);
  drawHeader(ctx, width, phase);
  drawTopSection(ctx, entries, width, phase);
  drawLowerSection(ctx, entries, width, phase);
}

async function generateLeaderboardImage(rows, guild) {
  const entries = await buildLeaderboardEntries(guild, rows.slice(0, 10));
  const width = 1280;
  const height = entries.length <= 3 ? 900 : 538 + (entries.length - 3) * 118 + 120;

  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext("2d");
  drawLeaderboardFrame(ctx, entries, width, height);

  return canvas.toBuffer("image/png");
}

async function generateAnimatedLeaderboardGif(rows, guild) {
  const entries = await buildLeaderboardEntries(guild, rows.slice(0, 10));
  const width = 1280;
  const height = entries.length <= 3 ? 900 : 538 + (entries.length - 3) * 118 + 120;

  const encoder = new GIFEncoder(width, height);
  encoder.start();
  encoder.setRepeat(0);
  encoder.setDelay(70);
  encoder.setQuality(10);

  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext("2d");

  const particles = createParticles(width, height, 120);
  const orbs = createEnergyOrbs(width, height, 16);
  const sparkles = createSparkles(width, height, 20);

  const frameCount = 36;
  for (let frame = 0; frame < frameCount; frame++) {
    const phase = (frame / frameCount) * Math.PI * 2;
    ctx.clearRect(0, 0, width, height);
    drawLeaderboardFrame(ctx, entries, width, height, particles, orbs, sparkles, phase);
    encoder.addFrame(ctx);
  }

  encoder.finish();
  return encoder.out.getData();
}

module.exports = {
  generateLeaderboardImage,
  generateAnimatedLeaderboardGif
};