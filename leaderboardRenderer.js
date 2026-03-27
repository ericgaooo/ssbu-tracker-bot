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

function sanitizeDisplayNameForCanvas(name) {
  if (!name) return name;
  const stripped = name
    .replace(/[\p{Extended_Pictographic}\p{Emoji_Presentation}\uFE0F\u200D]/gu, "")
    .replace(/\s+/g, " ")
    .trim();
  return stripped || name;
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
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + width - r, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + r);
  ctx.lineTo(x + width, y + height - r);
  ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  ctx.lineTo(x + r, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
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

function createVerticalGradient(ctx, x, y, h, stops) {
  const grad = ctx.createLinearGradient(x, y, x, y + h);
  for (const [stop, color] of stops) {
    grad.addColorStop(stop, color);
  }
  return grad;
}

function getPlacementColors(place) {
  if (place === 1) {
    return {
      panelTop: "#2B1C05",
      panelBottom: "#130C02",
      accent: "#FFD54A",
      accentSoft: "#FFF2AE",
      text: "#FFF9E2",
      subtext: "#F1E6BB",
      glow: "rgba(255, 213, 74, 0.22)",
      badgeBg: "#FFE27A",
      badgeText: "#2F1A00",
      trim: "rgba(255, 225, 140, 0.45)"
    };
  }

  if (place === 2) {
    return {
      panelTop: "#17203E",
      panelBottom: "#0A1228",
      accent: "#E2EAFF",
      accentSoft: "#FFFFFF",
      text: "#F7F9FF",
      subtext: "#DEE6FF",
      glow: "rgba(221, 230, 255, 0.16)",
      badgeBg: "#EEF3FF",
      badgeText: "#1B2547",
      trim: "rgba(221, 230, 255, 0.18)"
    };
  }

  if (place === 3) {
    return {
      panelTop: "#3A1E13",
      panelBottom: "#1A0C06",
      accent: "#FFB78A",
      accentSoft: "#FFE2CF",
      text: "#FFF1E8",
      subtext: "#FFD8C3",
      glow: "rgba(255, 183, 138, 0.16)",
      badgeBg: "#FFD7BF",
      badgeText: "#4A2413",
      trim: "rgba(255, 183, 138, 0.18)"
    };
  }

  return {
    panelTop: "#121C40",
    panelBottom: "#0A1127",
    accent: "#7CA9FF",
    accentSoft: "#DCE8FF",
    text: "#F5F8FF",
    subtext: "#D8E4FF",
    glow: "rgba(124, 169, 255, 0.12)",
    badgeBg: "#213264",
    badgeText: "#F5F8FF",
    trim: "rgba(124, 169, 255, 0.16)"
  };
}

function createParticles(width, height, count) {
  const colors = [
    "rgba(255,213,74,0.50)",
    "rgba(255,255,255,0.45)",
    "rgba(102,227,255,0.42)",
    "rgba(255,102,194,0.32)"
  ];

  return Array.from({ length: count }, () => ({
    x: Math.random() * width,
    y: Math.random() * height,
    len: 6 + Math.random() * 10,
    thickness: 1 + Math.random() * 1.1,
    angle: Math.random() * Math.PI * 2,
    color: colors[Math.floor(Math.random() * colors.length)],
    alpha: 0.08 + Math.random() * 0.12,
    ampX: 4 + Math.random() * 10,
    ampY: 5 + Math.random() * 12,
    phase: Math.random() * Math.PI * 2,
    speed: 0.45 + Math.random() * 0.45
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

function drawSmashBallBurst(ctx, centerX, centerY, phase, animated = false) {
  const pulse = animated ? 1 + Math.sin(phase) * 0.012 : 1;

  const halo = ctx.createRadialGradient(centerX, centerY, 24, centerX, centerY, 230 * pulse);
  halo.addColorStop(0, "rgba(255,255,255,0.14)");
  halo.addColorStop(0.14, "rgba(255,214,74,0.14)");
  halo.addColorStop(0.34, "rgba(255,214,74,0.06)");
  halo.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = halo;
  ctx.fillRect(centerX - 280, centerY - 280, 560, 560);

  const rays = 12;
  ctx.save();
  ctx.translate(centerX, centerY);
  for (let i = 0; i < rays; i++) {
    const angle = (Math.PI * 2 * i) / rays + (animated ? phase * 0.02 : 0);
    ctx.save();
    ctx.rotate(angle);
    const rayGrad = ctx.createLinearGradient(0, 0, 150, 0);
    rayGrad.addColorStop(0, "rgba(255,255,255,0.09)");
    rayGrad.addColorStop(0.18, "rgba(255,226,130,0.09)");
    rayGrad.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = rayGrad;
    ctx.fillRect(20, -2, 150, 4);
    ctx.restore();
  }
  ctx.restore();
}

function drawBackgroundGrid(ctx, width, height) {
  ctx.save();
  ctx.globalAlpha = 0.03;
  ctx.strokeStyle = "#B4C7FF";
  ctx.lineWidth = 1;

  const gap = 52;

  for (let x = 0; x < width; x += gap) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();
  }

  for (let y = 0; y < height; y += gap) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }

  ctx.restore();
}

function drawSweep(ctx, width, height, phase) {
  const t = (Math.sin(phase) + 1) / 2;
  const sweepX = -180 + t * (width + 360);

  const grad = ctx.createLinearGradient(sweepX - 90, 0, sweepX + 90, 0);
  grad.addColorStop(0, "rgba(255,255,255,0)");
  grad.addColorStop(0.5, "rgba(255,255,255,0.025)");
  grad.addColorStop(1, "rgba(255,255,255,0)");

  ctx.save();
  ctx.translate(width / 2, height / 2);
  ctx.rotate(-0.28);
  ctx.fillStyle = grad;
  ctx.fillRect(-width, -height, width * 2, height * 2);
  ctx.restore();
}

function drawBackground(ctx, width, height, options = {}) {
  const {
    phase = 0,
    animated = false,
    particles = null
  } = options;

  const bg = ctx.createLinearGradient(0, 0, width, height);
  bg.addColorStop(0, "#050812");
  bg.addColorStop(0.35, "#0C1430");
  bg.addColorStop(0.7, "#140D26");
  bg.addColorStop(1, "#06080F");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, width, height);

  const topGlow = ctx.createRadialGradient(width / 2, 110, 20, width / 2, 110, 240);
  topGlow.addColorStop(0, "rgba(255,213,74,0.08)");
  topGlow.addColorStop(0.45, "rgba(255,213,74,0.03)");
  topGlow.addColorStop(1, "rgba(255,213,74,0)");
  ctx.fillStyle = topGlow;
  ctx.fillRect(0, 0, width, height);

  const leftGlow = ctx.createRadialGradient(110, 190, 10, 110, 190, 210);
  leftGlow.addColorStop(0, "rgba(255,90,189,0.05)");
  leftGlow.addColorStop(1, "rgba(255,90,189,0)");
  ctx.fillStyle = leftGlow;
  ctx.fillRect(0, 0, width, height);

  const rightGlow = ctx.createRadialGradient(width - 110, 180, 10, width - 110, 180, 210);
  rightGlow.addColorStop(0, "rgba(102,227,255,0.05)");
  rightGlow.addColorStop(1, "rgba(102,227,255,0)");
  ctx.fillStyle = rightGlow;
  ctx.fillRect(0, 0, width, height);

  drawBackgroundGrid(ctx, width, height);
  drawSmashBallBurst(ctx, width / 2, 142, phase, animated);

  if (animated && particles) {
    drawParticles(ctx, particles, phase);
    drawSweep(ctx, width, height, phase);
  }
}

function drawHeaderShimmer(ctx, x, y, width, height, phase) {
  const t = (Math.sin(phase) + 1) / 2;
  const shimmerX = x - 120 + t * (width + 240);

  ctx.save();
  drawRoundedRect(ctx, x, y, width, height, 28);
  ctx.clip();

  const grad = ctx.createLinearGradient(shimmerX - 130, 0, shimmerX + 130, 0);
  grad.addColorStop(0, "rgba(255,255,255,0)");
  grad.addColorStop(0.5, "rgba(255,255,255,0.07)");
  grad.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = grad;
  ctx.fillRect(shimmerX - 150, y, 300, height);

  ctx.restore();
}

function drawHeader(ctx, width, phase, totalPlayers, animated = false) {
  const x = 20;
  const y = 18;
  const w = width - 40;
  const h = 92;

  drawRoundedRect(ctx, x, y, w, h, 28);
  const headerGrad = ctx.createLinearGradient(x, y, x + w, y);
  headerGrad.addColorStop(0, "rgba(48,18,105,0.92)");
  headerGrad.addColorStop(0.35, "rgba(44,45,142,0.92)");
  headerGrad.addColorStop(0.7, "rgba(29,83,163,0.92)");
  headerGrad.addColorStop(1, "rgba(27,129,159,0.92)");
  ctx.fillStyle = headerGrad;
  ctx.fill();

  ctx.strokeStyle = "rgba(255,255,255,0.08)";
  ctx.lineWidth = 2;
  ctx.stroke();

  if (animated) {
    drawHeaderShimmer(ctx, x, y, w, h, phase);
  }

  ctx.fillStyle = "#F8FBFF";
  ctx.font = "bold 36px SmashFont";
  ctx.fillText("SSBU LEADERBOARD", x + 24, y + 46);

  ctx.fillStyle = "#D8E2FF";
  ctx.font = "18px SmashFont";
  ctx.fillText("Official Ranked Order", x + 24, y + 71);

  const pillW = 124;
  const pillH = 34;
  const pillX = x + w - pillW - 18;
  const pillY = y + 22;

  drawRoundedRect(ctx, pillX, pillY, pillW, pillH, 17);
  ctx.fillStyle = "rgba(255,255,255,0.11)";
  ctx.fill();

  ctx.fillStyle = "#FFFFFF";
  ctx.font = "bold 17px SmashFont";
  const txt = `${totalPlayers} Players`;
  const tw = ctx.measureText(txt).width;
  ctx.fillText(txt, pillX + (pillW - tw) / 2, pillY + 22);
}

function drawRankBadge(ctx, x, y, place, colors) {
  const w = 68;
  const h = 40;

  drawRoundedRect(ctx, x, y, w, h, 13);
  ctx.fillStyle = colors.badgeBg;
  ctx.fill();

  ctx.fillStyle = colors.badgeText;
  ctx.font = "bold 20px SmashFont";
  const text = `#${place}`;
  const tw = ctx.measureText(text).width;
  ctx.fillText(text, x + (w - tw) / 2, y + 27);
}

function drawRecordPill(ctx, x, y, w, h, label, value, accentColor) {
  drawRoundedRect(ctx, x, y, w, h, 16);
  ctx.fillStyle = "rgba(255,255,255,0.08)";
  ctx.fill();

  ctx.strokeStyle = "rgba(255,255,255,0.05)";
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.fillStyle = accentColor;
  ctx.font = "bold 13px SmashFont";
  ctx.fillText(label, x + 12, y + 17);

  ctx.fillStyle = "#FFFFFF";
  ctx.font = "bold 19px SmashFont";
  const tw = ctx.measureText(value).width;
  ctx.fillText(value, x + w - tw - 12, y + 28);
}

function drawCardSheen(ctx, x, y, w, h, phase, strength = 1) {
  const t = (Math.sin(phase) + 1) / 2;
  const sweepX = x - 60 + t * (w + 120);

  ctx.save();
  drawRoundedRect(ctx, x, y, w, h, 24);
  ctx.clip();

  const grad = ctx.createLinearGradient(sweepX - 60, 0, sweepX + 60, 0);
  grad.addColorStop(0, "rgba(255,255,255,0)");
  grad.addColorStop(0.5, `rgba(255,255,255,${0.05 * strength})`);
  grad.addColorStop(1, "rgba(255,255,255,0)");

  ctx.fillStyle = grad;
  ctx.fillRect(sweepX - 70, y, 140, h);
  ctx.restore();
}

function drawAvatarRing(ctx, cx, cy, r, colors, phase, champion = false, animated = false) {
  const pulse = animated
    ? (champion ? 1 + Math.sin(phase) * 0.01 : 1 + Math.sin(phase) * 0.006)
    : 1;

  const ringR = r + (champion ? 7 : 4) * pulse;

  const ring = ctx.createRadialGradient(cx, cy, ringR - 3, cx, cy, ringR + 8);
  ring.addColorStop(0, colors.glow);
  ring.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = ring;
  ctx.beginPath();
  ctx.arc(cx, cy, ringR + 8, 0, Math.PI * 2);
  ctx.fill();

  ctx.beginPath();
  ctx.arc(cx, cy, ringR, 0, Math.PI * 2);
  ctx.strokeStyle = colors.accent;
  ctx.lineWidth = champion ? 4 : 3;
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(cx, cy, r + 2, 0, Math.PI * 2);
  ctx.strokeStyle = "rgba(255,255,255,0.38)";
  ctx.lineWidth = 2;
  ctx.stroke();
}

function drawTopPlayerCard(ctx, entry, x, y, w, h, phase, options = {}) {
  const { isChampion = false, animated = false } = options;
  const colors = getPlacementColors(entry.place);
  const avatarSize = isChampion ? 118 : 86;
  const avatarRadius = avatarSize / 2;
  const bob = animated ? (isChampion ? Math.sin(phase) * 2 : Math.sin(phase + entry.place * 0.4) * 1.1) : 0;
  const shadowBlur = isChampion ? 8 : 5;

  ctx.save();
  ctx.shadowColor = colors.glow;
  ctx.shadowBlur = shadowBlur;
  drawRoundedRect(ctx, x, y, w, h, 26);
  ctx.fillStyle = createVerticalGradient(ctx, x, y, h, [
    [0, colors.panelTop],
    [1, colors.panelBottom]
  ]);
  ctx.fill();
  ctx.restore();

  drawRoundedRect(ctx, x, y, w, h, 26);
  ctx.fillStyle = createVerticalGradient(ctx, x, y, h, [
    [0, colors.panelTop],
    [1, colors.panelBottom]
  ]);
  ctx.fill();

  ctx.strokeStyle = colors.trim;
  ctx.lineWidth = 1.5;
  ctx.stroke();

  if (animated) {
    drawCardSheen(ctx, x, y, w, h, phase + entry.place * 0.3, isChampion ? 1 : 0.6);
  }

  drawRoundedRect(ctx, x, y, 8, h, 4);
  ctx.fillStyle = colors.accent;
  ctx.fill();

  drawRankBadge(ctx, x + 16, y + 16, entry.place, colors);

  if (isChampion) {
    const champX = x + w - 126;
    const champY = y + 16;
    drawRoundedRect(ctx, champX, champY, 106, 28, 12);
    ctx.fillStyle = "#FFD54A";
    ctx.fill();

    ctx.fillStyle = "#2D1900";
    ctx.font = "bold 13px SmashFont";
    const txt = "CHAMPION";
    const tw = ctx.measureText(txt).width;
    ctx.fillText(txt, champX + (106 - tw) / 2, champY + 19);
  }

  const avatarX = x + (w - avatarSize) / 2;
  const avatarY = y + 62 + bob;
  const avatarCX = avatarX + avatarRadius;
  const avatarCY = avatarY + avatarRadius;

  drawAvatarRing(ctx, avatarCX, avatarCY, avatarRadius, colors, phase, isChampion, animated);

  if (entry.avatarImage) {
    drawCircleImage(ctx, entry.avatarImage, avatarX, avatarY, avatarSize);
  } else {
    ctx.beginPath();
    ctx.arc(avatarCX, avatarCY, avatarRadius, 0, Math.PI * 2);
    ctx.fillStyle = "#2A376B";
    ctx.fill();

    ctx.fillStyle = "#F6FAFF";
    ctx.font = `bold ${isChampion ? 38 : 28}px SmashFont`;
    const initial = entry.canvasDisplayName.slice(0, 1).toUpperCase();
    const tw = ctx.measureText(initial).width;
    ctx.fillText(initial, avatarCX - tw / 2, avatarCY + 13);
  }

  ctx.fillStyle = colors.text;
  ctx.font = isChampion ? "bold 28px SmashFont" : "bold 23px SmashFont";
  const name = truncateText(ctx, entry.canvasDisplayName, w - 36);
  const nameW = ctx.measureText(name).width;
  ctx.fillText(name, x + (w - nameW) / 2, y + h - 86);

  ctx.fillStyle = colors.subtext;
  ctx.font = "20px SmashFont";
  const rankText = `Rank #${entry.rank}`;
  const rankW = ctx.measureText(rankText).width;
  ctx.fillText(rankText, x + (w - rankW) / 2, y + h - 54);

  const pillW = isChampion ? 176 : 158;
  const pillH = 38;
  const pillX = x + (w - pillW) / 2;
  const pillY = y + h - 34;
  drawRecordPill(ctx, pillX, pillY, pillW, pillH, "SET RECORD", `${entry.setWins}-${entry.setLosses}`, colors.accentSoft);
}

function drawLowerCard(ctx, entry, x, y, w, h, phase, animated = false) {
  const colors = getPlacementColors(entry.place);
  const avatarSize = 56;
  const avatarX = x + 100;
  const avatarY = y + (h - avatarSize) / 2;
  const avatarCX = avatarX + avatarSize / 2;
  const avatarCY = avatarY + avatarSize / 2;

  ctx.save();
  ctx.shadowColor = colors.glow;
  ctx.shadowBlur = 4;
  drawRoundedRect(ctx, x, y, w, h, 20);
  ctx.fillStyle = createVerticalGradient(ctx, x, y, h, [
    [0, colors.panelTop],
    [1, colors.panelBottom]
  ]);
  ctx.fill();
  ctx.restore();

  drawRoundedRect(ctx, x, y, w, h, 20);
  ctx.fillStyle = createVerticalGradient(ctx, x, y, h, [
    [0, colors.panelTop],
    [1, colors.panelBottom]
  ]);
  ctx.fill();

  ctx.strokeStyle = colors.trim;
  ctx.lineWidth = 1.2;
  ctx.stroke();

  if (animated) {
    drawCardSheen(ctx, x, y, w, h, phase + entry.place * 0.18, 0.35);
  }

  drawRoundedRect(ctx, x, y, 7, h, 4);
  ctx.fillStyle = colors.accent;
  ctx.fill();

  drawRankBadge(ctx, x + 16, y + 15, entry.place, colors);

  drawAvatarRing(ctx, avatarCX, avatarCY, avatarSize / 2, colors, phase + entry.place * 0.2, false, animated);

  if (entry.avatarImage) {
    drawCircleImage(ctx, entry.avatarImage, avatarX, avatarY, avatarSize);
  } else {
    ctx.beginPath();
    ctx.arc(avatarCX, avatarCY, avatarSize / 2, 0, Math.PI * 2);
    ctx.fillStyle = "#2A376B";
    ctx.fill();

    ctx.fillStyle = "#F6FAFF";
    ctx.font = "bold 22px SmashFont";
    const initial = entry.canvasDisplayName.slice(0, 1).toUpperCase();
    const tw = ctx.measureText(initial).width;
    ctx.fillText(initial, avatarCX - tw / 2, avatarCY + 8);
  }

  const textX = avatarX + avatarSize + 16;
  ctx.fillStyle = colors.text;
  ctx.font = "bold 22px SmashFont";
  const name = truncateText(ctx, entry.canvasDisplayName, 300);
  ctx.fillText(name, textX, y + 38);

  ctx.fillStyle = colors.subtext;
  ctx.font = "19px SmashFont";
  ctx.fillText(`Rank #${entry.rank}`, textX, y + 66);

  const recordW = 172;
  const recordH = 36;
  const recordX = x + w - recordW - 16;
  const recordY = y + 17;
  drawRecordPill(ctx, recordX, recordY, recordW, recordH, "SET RECORD", `${entry.setWins}-${entry.setLosses}`, colors.accentSoft);
}

function drawTopSection(ctx, entries, width, phase, animated = false) {
  const topThree = entries.slice(0, 3);
  const first = topThree.find((e) => e.place === 1);
  const second = topThree.find((e) => e.place === 2);
  const third = topThree.find((e) => e.place === 3);

  const topY = 138;
  const centerW = 296;
  const centerH = 292;
  const sideW = 224;
  const sideH = 242;
  const gap = 18;

  const centerX = (width - centerW) / 2;
  const leftX = centerX - sideW - gap;
  const rightX = centerX + centerW + gap;
  const sideY = topY + 32;

  if (second) {
    drawTopPlayerCard(ctx, second, leftX, sideY, sideW, sideH, phase, {
      isChampion: false,
      animated
    });
  }

  if (first) {
    drawTopPlayerCard(ctx, first, centerX, topY, centerW, centerH, phase, {
      isChampion: true,
      animated
    });
  }

  if (third) {
    drawTopPlayerCard(ctx, third, rightX, sideY, sideW, sideH, phase, {
      isChampion: false,
      animated
    });
  }
}

function drawLowerSection(ctx, entries, width, phase, animated = false) {
  const rest = entries.slice(3);
  if (rest.length === 0) return;

  const startY = 454;
  const cardH = 86;
  const gap = 12;
  const x = 24;
  const w = width - 48;

  for (let i = 0; i < rest.length; i++) {
    const y = startY + i * (cardH + gap);
    drawLowerCard(ctx, rest[i], x, y, w, cardH, phase, animated);
  }
}

function drawLeaderboardFrame(ctx, entries, width, height, options = {}) {
  const {
    phase = 0,
    animated = false,
    particles = null
  } = options;

  drawBackground(ctx, width, height, {
    phase,
    animated,
    particles
  });

  drawHeader(ctx, width, phase, entries.length, animated);
  drawTopSection(ctx, entries, width, phase, animated);
  drawLowerSection(ctx, entries, width, phase, animated);
}

function getLeaderboardHeight(entryCount) {
  if (entryCount <= 3) return 780;
  return 454 + (entryCount - 3) * 98 + 86;
}

async function generateLeaderboardImage(rows, guild) {
  const entries = await buildLeaderboardEntries(guild, rows);
  const width = 980;
  const height = getLeaderboardHeight(entries.length);

  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext("2d");

  drawLeaderboardFrame(ctx, entries, width, height, {
    animated: false,
    phase: 0
  });

  return canvas.toBuffer("image/png");
}

async function generateAnimatedLeaderboardGif(rows, guild) {
  const entries = await buildLeaderboardEntries(guild, rows);
  const width = 900;
  const height = getLeaderboardHeight(entries.length);

  const encoder = new GIFEncoder(width, height);
  encoder.start();
  encoder.setRepeat(0);
  encoder.setDelay(120);
  encoder.setQuality(20);

  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext("2d");

  const particles = createParticles(width, height, 16);
  const frameCount = 8;

  for (let frame = 0; frame < frameCount; frame++) {
    const phase = (frame / frameCount) * Math.PI * 2;
    ctx.clearRect(0, 0, width, height);
    drawLeaderboardFrame(ctx, entries, width, height, {
      animated: true,
      phase,
      particles
    });
    encoder.addFrame(ctx);
  }

  encoder.finish();
  return encoder.out.getData();
}

module.exports = {
  generateLeaderboardImage,
  generateAnimatedLeaderboardGif
};