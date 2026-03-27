require("dotenv").config();
const {
  Client,
  GatewayIntentBits,
  AttachmentBuilder
} = require("discord.js");
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

const {
  ensurePlayer,
  setPlayerRank,
  getPlayerRank,
  createSetReport,
  createGameReport,
  deleteSetReportById,
  deleteGameReportById,
  getReportsByReporter,
  getDerivedRecordForUser,
  getHeadToHead,
  getLeaderboard
} = require("./db");

const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});

const ADMIN_USER_ID = process.env.ADMIN_USER_ID || "";

client.once("clientReady", () => {
  console.log(`Logged in as ${client.user.tag}`);
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

function formatRecordLine(record) {
  return (
    `Set Record: **${record.setWins}-${record.setLosses}**\n` +
    `Set Games: **${record.setGamesWon}-${record.setGamesLost}**\n` +
    `Ad Hoc Games: **${record.adHocWins}-${record.adHocLosses}**\n` +
    `Sets Played: **${record.setsPlayed}**`
  );
}

function normalizeFormat(format) {
  const map = {
    bo3: "Best of 3",
    bo5: "Best of 5",
    ft5: "First to 5",
    ft10: "First to 10",
    other: "Other"
  };
  return map[format] || format;
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
      bg: "#4D3300",
      accent: "#FFD447",
      text: "#FFF4C2",
      glow: "rgba(255, 212, 71, 0.46)",
      pillBg: "#FFE27D",
      pillText: "#3D2600"
    };
  }
  if (place === 2) {
    return {
      bg: "#24355C",
      accent: "#D8E3FF",
      text: "#EEF5FF",
      glow: "rgba(216, 227, 255, 0.28)",
      pillBg: "#EEF3FF",
      pillText: "#22304A"
    };
  }
  if (place === 3) {
    return {
      bg: "#5A3426",
      accent: "#F5B38A",
      text: "#FFE7D8",
      glow: "rgba(245, 179, 138, 0.30)",
      pillBg: "#FFD4B9",
      pillText: "#472719"
    };
  }

  return {
    bg: "#221E46",
    accent: "#7A8CFF",
    text: "#EEF2FF",
    glow: "rgba(122, 140, 255, 0.18)",
    pillBg: "#313878",
    pillText: "#EEF2FF"
  };
}

async function buildLeaderboardEntries(guild, rows) {
  return Promise.all(
    rows.map(async (row, index) => {
      const displayName = await getDisplayNameFromGuild(guild, row.user_id, row.username);
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
        place: index + 1,
        displayName,
        canvasDisplayName: sanitizeDisplayNameForCanvas(displayName),
        rank: row.rank,
        setWins: row.setWins,
        setLosses: row.setLosses,
        setsPlayed: row.setsPlayed,
        avatarImage
      };
    })
  );
}

function createParticles(width, height, count, layer = "front") {
  const colors = [
    "#7A8CFF",
    "#58E1FF",
    "#C767FF",
    "#FF5AB8",
    "#FFD447",
    "#FFFFFF"
  ];

  const front = layer === "front";
  return Array.from({ length: count }, () => ({
    x: Math.random() * width,
    y: Math.random() * height,
    len: front ? 8 + Math.random() * 14 : 5 + Math.random() * 9,
    thickness: front ? 2 + Math.random() * 2.6 : 1.2 + Math.random() * 1.4,
    angle: Math.random() * Math.PI,
    speed: front ? 1.5 + Math.random() * 2.8 : 0.7 + Math.random() * 1.5,
    drift: front ? -1.8 + Math.random() * 3.6 : -0.8 + Math.random() * 1.6,
    color: colors[Math.floor(Math.random() * colors.length)],
    alpha: front ? 0.95 : 0.5
  }));
}

function createEnergyOrbs(width, height, count) {
  const colors = [
    "rgba(88,225,255,0.14)",
    "rgba(199,103,255,0.14)",
    "rgba(122,140,255,0.16)",
    "rgba(255,90,184,0.10)"
  ];

  return Array.from({ length: count }, () => ({
    x: Math.random() * width,
    y: Math.random() * height,
    r: 20 + Math.random() * 46,
    speed: 0.25 + Math.random() * 0.75,
    drift: -0.8 + Math.random() * 1.6,
    color: colors[Math.floor(Math.random() * colors.length)]
  }));
}

function createSparkles(width, height, count) {
  return Array.from({ length: count }, () => ({
    x: Math.random() * width,
    y: Math.random() * height,
    size: 4 + Math.random() * 8,
    phase: Math.random() * Math.PI * 2
  }));
}

function createBurstParticles(width, countPerSide = 75) {
  const colors = [
    "#58E1FF",
    "#C767FF",
    "#FF5AB8",
    "#FFD447",
    "#FFFFFF"
  ];

  const particles = [];

  function makeParticle(side) {
    const left = side === "left";
    const originX = left ? 50 : width - 50;
    const originY = 96 + Math.random() * 28;

    const angleBase = left ? -0.42 : Math.PI + 0.42;
    const spread = 1.0;
    const angle = angleBase + (Math.random() - 0.5) * spread;

    return {
      originX,
      originY,
      angle,
      speed: 7 + Math.random() * 10,
      gravity: 0.2 + Math.random() * 0.16,
      size: 5 + Math.random() * 9,
      rot: Math.random() * Math.PI,
      rotSpeed: -0.2 + Math.random() * 0.4,
      color: colors[Math.floor(Math.random() * colors.length)],
      alpha: 0.72 + Math.random() * 0.2,
      shape: Math.random() > 0.5 ? "rect" : "circle"
    };
  }

  for (let i = 0; i < countPerSide; i++) {
    particles.push(makeParticle("left"));
    particles.push(makeParticle("right"));
  }

  return particles;
}

function drawParticles(ctx, particles, frame, width, height) {
  for (const p of particles) {
    const y = (p.y + frame * p.speed * 6) % (height + 40) - 20;
    const x = (p.x + frame * p.drift * 2 + width) % width;
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

function drawOrbs(ctx, orbs, frame, width, height) {
  for (const o of orbs) {
    const y = (o.y + frame * o.speed * 2) % (height + o.r * 2) - o.r;
    const x = (o.x + frame * o.drift + width) % width;

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

function drawSparkles(ctx, sparkles, frame) {
  for (const s of sparkles) {
    const alpha = 0.16 + (Math.sin(frame * 0.55 + s.phase) + 1) * 0.22;
    drawSparkle(ctx, s.x, s.y, s.size, alpha);
  }
}

function drawBurstParticles(ctx, particles, frame) {
  const t = frame * 1.12;

  for (const p of particles) {
    const x = p.originX + Math.cos(p.angle) * p.speed * t;
    const y = p.originY + Math.sin(p.angle) * p.speed * t + p.gravity * t * t;

    const life = Math.max(0, 1 - frame / 22);
    if (life <= 0) continue;

    ctx.save();
    ctx.globalAlpha = p.alpha * life;
    ctx.translate(x, y);
    ctx.rotate(p.rot + frame * p.rotSpeed);
    ctx.fillStyle = p.color;

    if (p.shape === "rect") {
      drawRoundedRect(ctx, -p.size / 2, -p.size / 3, p.size, p.size * 0.66, 2);
      ctx.fill();
    } else {
      ctx.beginPath();
      ctx.arc(0, 0, p.size * 0.38, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }
}

function drawBackground(ctx, width, height, backParticles = null, frontParticles = null, orbs = null, sparkles = null, burstParticles = null, frame = 0) {
  const bg = ctx.createLinearGradient(0, 0, width, height);
  bg.addColorStop(0, "#060916");
  bg.addColorStop(0.45, "#0A102A");
  bg.addColorStop(1, "#140B2A");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, width, height);

  const topGlow = ctx.createLinearGradient(0, 0, 0, 220);
  topGlow.addColorStop(0, "rgba(88,225,255,0.16)");
  topGlow.addColorStop(1, "rgba(88,225,255,0)");
  ctx.fillStyle = topGlow;
  ctx.fillRect(0, 0, width, 220);

  const leftBeam = ctx.createRadialGradient(180, 100, 20, 180, 100, 420);
  leftBeam.addColorStop(0, "rgba(122,140,255,0.22)");
  leftBeam.addColorStop(1, "rgba(122,140,255,0)");
  ctx.fillStyle = leftBeam;
  ctx.fillRect(0, 0, width, height);

  const rightBeam = ctx.createRadialGradient(width - 180, 120, 30, width - 180, 120, 400);
  rightBeam.addColorStop(0, "rgba(199,103,255,0.18)");
  rightBeam.addColorStop(1, "rgba(199,103,255,0)");
  ctx.fillStyle = rightBeam;
  ctx.fillRect(0, 0, width, height);

  if (orbs) drawOrbs(ctx, orbs, frame, width, height);
  if (sparkles) drawSparkles(ctx, sparkles, frame);
  if (burstParticles) drawBurstParticles(ctx, burstParticles, frame);
  if (backParticles) drawParticles(ctx, backParticles, frame, width, height);
  if (frontParticles) drawParticles(ctx, frontParticles, frame, width, height);
}

function drawHeaderShimmer(ctx, x, y, width, height, frame) {
  const shimmerX = x - 100 + ((frame % 18) / 17) * (width + 200);

  ctx.save();
  drawRoundedRect(ctx, x, y, width, height, 28);
  ctx.clip();

  const grad = ctx.createLinearGradient(shimmerX - 140, 0, shimmerX + 140, 0);
  grad.addColorStop(0, "rgba(255,255,255,0)");
  grad.addColorStop(0.35, "rgba(255,255,255,0.14)");
  grad.addColorStop(0.5, "rgba(255,255,255,0.30)");
  grad.addColorStop(0.65, "rgba(255,255,255,0.14)");
  grad.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = grad;
  ctx.fillRect(shimmerX - 160, y, 320, height);

  ctx.restore();
}

function drawPodiumBlock(ctx, entry, x, y, width, height, frame) {
  const colors = getPlacementColors(entry.place);
  const pulse = entry.place <= 3 ? 18 + (Math.sin(frame * 0.5 + entry.place) + 1) * 8 : 12;
  const avatarSize = entry.place === 1 ? 118 : 98;

  ctx.save();
  ctx.shadowColor = colors.glow;
  ctx.shadowBlur = pulse;
  drawRoundedRect(ctx, x, y, width, height, 26);
  ctx.fillStyle = colors.bg;
  ctx.fill();
  ctx.restore();

  drawRoundedRect(ctx, x, y, width, height, 26);
  ctx.fillStyle = colors.bg;
  ctx.fill();

  drawRoundedRect(ctx, x, y, 10, height, 5);
  ctx.fillStyle = colors.accent;
  ctx.fill();

  const badgeW = 76;
  const badgeH = 48;
  const badgeX = x + 22;
  const badgeY = y + 22;

  drawRoundedRect(ctx, badgeX, badgeY, badgeW, badgeH, 14);
  ctx.fillStyle = colors.pillBg;
  ctx.fill();

  ctx.fillStyle = colors.pillText;
  ctx.font = "bold 24px SmashFont";
  const placeText = `#${entry.place}`;
  const placeWidth = ctx.measureText(placeText).width;
  ctx.fillText(placeText, badgeX + (badgeW - placeWidth) / 2, badgeY + 32);

  const avatarX = x + (width - avatarSize) / 2;
  const avatarY = y + 84 + (entry.place === 1 ? Math.sin(frame * 0.65) * 6 : 0);

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
    ctx.strokeStyle = "rgba(255,255,255,0.34)";
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
    ctx.font = `bold ${entry.place === 1 ? 40 : 34}px SmashFont`;
    const initial = entry.canvasDisplayName.slice(0, 1).toUpperCase();
    const initialWidth = ctx.measureText(initial).width;
    ctx.fillText(
      initial,
      avatarX + (avatarSize - initialWidth) / 2,
      avatarY + avatarSize / 2 + 14
    );
  }

  ctx.fillStyle = colors.text;
  ctx.font = entry.place === 1 ? "bold 34px SmashFont" : "bold 28px SmashFont";
  const name = truncateText(ctx, entry.canvasDisplayName, width - 46);
  const nameWidth = ctx.measureText(name).width;
  ctx.fillText(name, x + (width - nameWidth) / 2, y + height - 82);

  ctx.fillStyle = "#DCE6FF";
  ctx.font = "24px SmashFont";
  const rankText = `Rank #${entry.rank}`;
  const rankWidth = ctx.measureText(rankText).width;
  ctx.fillText(rankText, x + (width - rankWidth) / 2, y + height - 48);

  const recordPillW = 170;
  const recordPillH = 42;
  const recordPillX = x + (width - recordPillW) / 2;
  const recordPillY = y + height - 128;

  drawRoundedRect(ctx, recordPillX, recordPillY, recordPillW, recordPillH, 16);
  ctx.fillStyle = "rgba(255,255,255,0.10)";
  ctx.fill();

  ctx.fillStyle = "#FFFFFF";
  ctx.font = "bold 24px SmashFont";
  const recordText = `${entry.setWins}-${entry.setLosses}`;
  const recordWidth = ctx.measureText(recordText).width;
  ctx.fillText(recordText, recordPillX + (recordPillW - recordWidth) / 2, recordPillY + 28);

  if (entry.place === 1) {
    const champPillW = 118;
    const champPillH = 28;
    const champX = x + (width - champPillW) / 2;
    const champY = y + 22;

    drawRoundedRect(ctx, champX, champY, champPillW, champPillH, 12);
    ctx.fillStyle = "#FFD447";
    ctx.fill();

    ctx.fillStyle = "#2D1B00";
    ctx.font = "bold 14px SmashFont";
    const champText = "CHAMPION";
    const champWidth = ctx.measureText(champText).width;
    ctx.fillText(champText, champX + (champPillW - champWidth) / 2, champY + 19);
  }
}

function drawListCard(ctx, entry, x, y, width, height, frame) {
  const colors = getPlacementColors(entry.place);
  const pulse = 10 + (Math.sin(frame * 0.3 + entry.place) + 1) * 2;

  ctx.save();
  ctx.shadowColor = colors.glow;
  ctx.shadowBlur = pulse;
  drawRoundedRect(ctx, x, y, width, height, 22);
  ctx.fillStyle = colors.bg;
  ctx.fill();
  ctx.restore();

  drawRoundedRect(ctx, x, y, width, height, 22);
  ctx.fillStyle = colors.bg;
  ctx.fill();

  drawRoundedRect(ctx, x, y, 8, height, 5);
  ctx.fillStyle = colors.accent;
  ctx.fill();

  const badgeX = x + 20;
  const badgeY = y + 18;
  const badgeW = 70;
  const badgeH = 42;

  drawRoundedRect(ctx, badgeX, badgeY, badgeW, badgeH, 13);
  ctx.fillStyle = colors.pillBg;
  ctx.fill();

  ctx.fillStyle = colors.pillText;
  ctx.font = "bold 22px SmashFont";
  const placeText = `#${entry.place}`;
  const placeWidth = ctx.measureText(placeText).width;
  ctx.fillText(placeText, badgeX + (badgeW - placeWidth) / 2, badgeY + 29);

  const avatarSize = 68;
  const avatarX = badgeX + badgeW + 22;
  const avatarY = y + (height - avatarSize) / 2;

  if (entry.avatarImage) {
    drawCircleImage(ctx, entry.avatarImage, avatarX, avatarY, avatarSize);

    ctx.beginPath();
    ctx.arc(avatarX + avatarSize / 2, avatarY + avatarSize / 2, avatarSize / 2 + 2, 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(255,255,255,0.34)";
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
    const initialWidth = ctx.measureText(initial).width;
    ctx.fillText(initial, avatarX + (avatarSize - initialWidth) / 2, avatarY + 44);
  }

  const textX = avatarX + avatarSize + 20;

  ctx.fillStyle = "#F6FAFF";
  ctx.font = "bold 28px SmashFont";
  const name = truncateText(ctx, entry.canvasDisplayName, 420);
  ctx.fillText(name, textX, y + 44);

  ctx.fillStyle = "#DCE6FF";
  ctx.font = "22px SmashFont";
  ctx.fillText(`Rank #${entry.rank}`, textX, y + 76);

  const recordPillW = 190;
  const recordPillH = 42;
  const recordPillX = x + width - recordPillW - 26;
  const recordPillY = y + 22;

  drawRoundedRect(ctx, recordPillX, recordPillY, recordPillW, recordPillH, 15);
  ctx.fillStyle = "rgba(255,255,255,0.10)";
  ctx.fill();

  ctx.fillStyle = "#FFFFFF";
  ctx.font = "bold 24px SmashFont";
  const recordText = `${entry.setWins}-${entry.setLosses}`;
  const recordWidth = ctx.measureText(recordText).width;
  ctx.fillText(recordText, recordPillX + (recordPillW - recordWidth) / 2, recordPillY + 28);
}

function drawLeaderboardFrame(ctx, entries, width, height, backParticles = null, frontParticles = null, orbs = null, sparkles = null, burstParticles = null, frame = 0) {
  const outerPadding = 28;
  const headerHeight = 108;

  drawBackground(ctx, width, height, backParticles, frontParticles, orbs, sparkles, burstParticles, frame);

  drawRoundedRect(ctx, outerPadding, outerPadding, width - outerPadding * 2, headerHeight, 28);
  const headerGrad = ctx.createLinearGradient(0, 0, width, 0);
  headerGrad.addColorStop(0, "#1F245C");
  headerGrad.addColorStop(0.45, "#3A1E7A");
  headerGrad.addColorStop(1, "#0E5E7A");
  ctx.fillStyle = headerGrad;
  ctx.fill();

  drawHeaderShimmer(ctx, outerPadding, outerPadding, width - outerPadding * 2, headerHeight, frame);

  ctx.fillStyle = "#F7FAFF";
  ctx.font = "bold 42px SmashFont";
  ctx.fillText("SSBU LEADERBOARD", outerPadding + 34, outerPadding + 60);

  ctx.fillStyle = "#BFD4FF";
  ctx.font = "22px SmashFont";
  ctx.fillText("Official Ranked Order", outerPadding + 34, outerPadding + 90);

  const topThree = entries.slice(0, 3);
  const rest = entries.slice(3);

  if (topThree.length > 0) {
    const podiumTop = 168;
    const centerW = 360;
    const centerH = 340;
    const sideW = 290;
    const sideH = 286;
    const gap = 26;
    const centerX = (width - centerW) / 2;
    const centerY = podiumTop;
    const leftX = centerX - gap - sideW;
    const rightX = centerX + centerW + gap;
    const sideY = podiumTop + 44;

    const first = topThree.find((e) => e.place === 1);
    const second = topThree.find((e) => e.place === 2);
    const third = topThree.find((e) => e.place === 3);

    if (second) drawPodiumBlock(ctx, second, leftX, sideY, sideW, sideH, frame);
    if (first) drawPodiumBlock(ctx, first, centerX, centerY, centerW, centerH, frame);
    if (third) drawPodiumBlock(ctx, third, rightX, sideY, sideW, sideH, frame);
  }

  if (rest.length > 0) {
    const listTop = 550;
    const cardHeight = 102;
    const cardGap = 16;
    const cardX = outerPadding + 8;
    const cardW = width - (outerPadding + 8) * 2;

    for (let i = 0; i < rest.length; i++) {
      const entry = rest[i];
      const y = listTop + i * (cardHeight + cardGap);
      drawListCard(ctx, entry, cardX, y, cardW, cardHeight, frame);
    }
  }
}

async function generateLeaderboardImage(rows, guild) {
  const entries = await buildLeaderboardEntries(guild, rows.slice(0, 10));

  const width = 1280;
  const height = entries.length <= 3 ? 920 : 550 + (entries.length - 3) * 118 + 130;

  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext("2d");

  drawLeaderboardFrame(ctx, entries, width, height);

  return canvas.toBuffer("image/png");
}

async function generateAnimatedLeaderboardGif(rows, guild) {
  const entries = await buildLeaderboardEntries(guild, rows.slice(0, 10));

  const width = 1280;
  const height = entries.length <= 3 ? 920 : 550 + (entries.length - 3) * 118 + 130;

  const encoder = new GIFEncoder(width, height);
  encoder.start();
  encoder.setRepeat(0);
  encoder.setDelay(80);
  encoder.setQuality(10);

  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext("2d");

  const backParticles = createParticles(width, height, 90, "back");
  const frontParticles = createParticles(width, height, 130, "front");
  const orbs = createEnergyOrbs(width, height, 16);
  const sparkles = createSparkles(width, height, 20);
  const burstParticles = createBurstParticles(width, 78);

  const frameCount = 24;
  for (let frame = 0; frame < frameCount; frame++) {
    ctx.clearRect(0, 0, width, height);
    drawLeaderboardFrame(
      ctx,
      entries,
      width,
      height,
      backParticles,
      frontParticles,
      orbs,
      sparkles,
      burstParticles,
      frame
    );
    encoder.addFrame(ctx);
  }

  encoder.finish();
  return encoder.out.getData();
}

client.on("interactionCreate", async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  try {
    if (interaction.commandName === "smashreportset") {
      const reporter = interaction.user;
      const opponent = interaction.options.getUser("opponent");
      const format = interaction.options.getString("format");
      const myWins = interaction.options.getInteger("my_wins");
      const opponentWins = interaction.options.getInteger("opponent_wins");

      if (opponent.id === reporter.id) {
        await interaction.reply("You cannot report a set against yourself.");
        return;
      }

      if (myWins < 0 || opponentWins < 0) {
        await interaction.reply("Wins cannot be negative.");
        return;
      }

      if (myWins === opponentWins) {
        await interaction.reply("A set report cannot end in a tie.");
        return;
      }

      const reporterName =
        await getDisplayNameFromGuild(interaction.guild, reporter.id, reporter.globalName || reporter.username);
      const opponentName =
        await getDisplayNameFromGuild(interaction.guild, opponent.id, opponent.globalName || opponent.username);

      ensurePlayer(reporter.id, reporterName);
      ensurePlayer(opponent.id, opponentName);

      const report = createSetReport({
        reporterId: reporter.id,
        reporterName,
        opponentId: opponent.id,
        opponentName,
        format,
        reporterWins: myWins,
        opponentWins
      });

      const updatedRecord = getDerivedRecordForUser(reporter.id);

      await interaction.reply(
        `✅ Set recorded.\n` +
          `**${reporterName}** ${myWins}-${opponentWins} **${opponentName}** (${normalizeFormat(format)})\n` +
          `${formatRecordLine(updatedRecord)}\n` +
          `Report ID: \`${report.id}\``
      );
      return;
    }

    if (interaction.commandName === "smashreportgamewin" || interaction.commandName === "smashreportgameloss") {
      const reporter = interaction.user;
      const opponent = interaction.options.getUser("opponent");
      const result = interaction.commandName === "smashreportgamewin" ? "win" : "loss";

      if (opponent.id === reporter.id) {
        await interaction.reply("You cannot report a result against yourself.");
        return;
      }

      const reporterName =
        await getDisplayNameFromGuild(interaction.guild, reporter.id, reporter.globalName || reporter.username);
      const opponentName =
        await getDisplayNameFromGuild(interaction.guild, opponent.id, opponent.globalName || opponent.username);

      ensurePlayer(reporter.id, reporterName);
      ensurePlayer(opponent.id, opponentName);

      const report = createGameReport({
        reporterId: reporter.id,
        reporterName,
        opponentId: opponent.id,
        opponentName,
        result
      });

      const updatedRecord = getDerivedRecordForUser(reporter.id);

      await interaction.reply(
        result === "win"
          ? `✅ Recorded a single game win over **${opponentName}**.\n${formatRecordLine(updatedRecord)}\nReport ID: \`${report.id}\``
          : `✅ Recorded a single game loss to **${opponentName}**.\n${formatRecordLine(updatedRecord)}\nReport ID: \`${report.id}\``
      );
      return;
    }

    if (interaction.commandName === "smashmyrecord") {
      const user = interaction.user;
      const displayName =
        await getDisplayNameFromGuild(interaction.guild, user.id, user.globalName || user.username);

      const record = getDerivedRecordForUser(user.id);

      await interaction.reply(`📊 **${displayName}'s Record**\n${formatRecordLine(record)}`);
      return;
    }

    if (interaction.commandName === "smashplayerrecord") {
      const user = interaction.options.getUser("user");
      const displayName =
        await getDisplayNameFromGuild(interaction.guild, user.id, user.globalName || user.username);

      const record = getDerivedRecordForUser(user.id);

      await interaction.reply(`📊 **${displayName}'s Record**\n${formatRecordLine(record)}`);
      return;
    }

    if (interaction.commandName === "smashrecordagainst") {
      const self = interaction.user;
      const opponent = interaction.options.getUser("opponent");

      if (self.id === opponent.id) {
        await interaction.reply("You cannot view a record against yourself.");
        return;
      }

      const selfName =
        await getDisplayNameFromGuild(interaction.guild, self.id, self.globalName || self.username);
      const opponentName =
        await getDisplayNameFromGuild(interaction.guild, opponent.id, opponent.globalName || opponent.username);

      const h2h = getHeadToHead(self.id, opponent.id);

      await interaction.reply(
        `⚔️ **${selfName} vs ${opponentName}**\n` +
          `Set Record: **${h2h.aSetWins}-${h2h.bSetWins}**\n` +
          `Set Games: **${h2h.aSetGamesWon}-${h2h.bSetGamesWon}**\n` +
          `Ad Hoc Games: **${h2h.aAdHocWins}-${h2h.bAdHocWins}**\n` +
          `Sets Played: **${h2h.setsPlayed}**`
      );
      return;
    }

    if (interaction.commandName === "smashleaderboard") {
      const rows = getLeaderboard();

      if (rows.length === 0) {
        await interaction.reply("No ranked players exist yet.");
        return;
      }

      const lines = await Promise.all(
        rows.slice(0, 10).map(async (row, index) => {
          const displayName = await getDisplayNameFromGuild(interaction.guild, row.user_id, row.username);
          return `${index + 1}. **${displayName}** — Rank **#${row.rank}** | Set Record **${row.setWins}-${row.setLosses}**`;
        })
      );

      await interaction.reply(`🏆 **Official Ranked Leaderboard**\n${lines.join("\n")}`);
      return;
    }

    if (interaction.commandName === "smashleaderboardimage") {
      const rows = getLeaderboard();

      if (rows.length === 0) {
        await interaction.reply("No ranked players exist yet.");
        return;
      }

      await interaction.deferReply();

      const imageBuffer = await generateLeaderboardImage(rows, interaction.guild);
      const attachment = new AttachmentBuilder(imageBuffer, {
        name: "smash-leaderboard.png"
      });

      await interaction.editReply({
        content: "🏆 **Official Ranked Leaderboard**",
        files: [attachment]
      });
      return;
    }

    if (interaction.commandName === "smashleaderboardanimated") {
      const rows = getLeaderboard();

      if (rows.length === 0) {
        await interaction.reply("No ranked players exist yet.");
        return;
      }

      await interaction.deferReply();

      const gifBuffer = await generateAnimatedLeaderboardGif(rows, interaction.guild);
      const attachment = new AttachmentBuilder(gifBuffer, {
        name: "smash-leaderboard-animated.gif"
      });

      await interaction.editReply({
        content: "🏆 **Official Ranked Leaderboard**",
        files: [attachment]
      });
      return;
    }

    if (interaction.commandName === "smashmyrank") {
      const user = interaction.user;
      const displayName =
        await getDisplayNameFromGuild(interaction.guild, user.id, user.globalName || user.username);

      const rank = getPlayerRank(user.id);

      await interaction.reply(
        rank
          ? `🎖️ **${displayName}** is currently **Rank #${rank}**.`
          : `🎖️ **${displayName}** does not have a rank set yet.`
      );
      return;
    }

    if (interaction.commandName === "smashplayerrank") {
      const user = interaction.options.getUser("user");
      const displayName =
        await getDisplayNameFromGuild(interaction.guild, user.id, user.globalName || user.username);

      const rank = getPlayerRank(user.id);

      await interaction.reply(
        rank
          ? `🎖️ **${displayName}** is currently **Rank #${rank}**.`
          : `🎖️ **${displayName}** does not have a rank set yet.`
      );
      return;
    }

    if (interaction.commandName === "smashsetrank") {
      if (!ADMIN_USER_ID || interaction.user.id !== ADMIN_USER_ID) {
        await interaction.reply("You are not allowed to set ranks.");
        return;
      }

      const user = interaction.options.getUser("user");
      const rank = interaction.options.getInteger("rank");

      if (rank <= 0) {
        await interaction.reply("Rank must be a positive number.");
        return;
      }

      const displayName =
        await getDisplayNameFromGuild(interaction.guild, user.id, user.globalName || user.username);

      setPlayerRank(user.id, displayName, rank);

      await interaction.reply(`✅ Set **${displayName}** to **Rank #${rank}** and shifted others if needed.`);
      return;
    }

    if (interaction.commandName === "smashmyreports") {
      const reports = getReportsByReporter(interaction.user.id, 15);

      if (reports.length === 0) {
        await interaction.reply("You have not reported any results yet.");
        return;
      }

      const lines = reports.map((r) => `\`${r.id}\` [${r.type}] — ${r.text}`);
      await interaction.reply(`🧾 **Your Recent Reports**\n${lines.join("\n")}`);
      return;
    }

    if (interaction.commandName === "smashdeletereport") {
      const reportId = interaction.options.getString("report_id");

      let result = deleteSetReportById(reportId, interaction.user.id);
      if (!result.ok && result.reason === "not_found") {
        result = deleteGameReportById(reportId, interaction.user.id);
      }

      if (!result.ok) {
        if (result.reason === "not_found") {
          await interaction.reply("No report with that ID was found.");
          return;
        }
        if (result.reason === "forbidden") {
          await interaction.reply("You can only delete reports that you created.");
          return;
        }
      }

      await interaction.reply(`🗑️ Deleted ${result.type} report \`${result.report.id}\`.`);
      return;
    }
  } catch (err) {
    console.error(err);
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp("Something broke.");
    } else {
      await interaction.reply("Something broke.");
    }
  }
});

client.login(process.env.DISCORD_TOKEN);