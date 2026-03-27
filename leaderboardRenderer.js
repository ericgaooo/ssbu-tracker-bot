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
      panelTop: "#2A1A04",
      panelBottom: "#120B02",
      accent: "#FFD54A",
      accentSoft: "#FFF0A6",
      text: "#FFF8DB",
      subtext: "#F0E4B5",
      glow: "rgba(255, 213, 74, 0.36)",
      badgeBg: "#FFE27A",
      badgeText: "#2F1A00",
      trim: "rgba(255, 225, 140, 0.55)"
    };
  }

  if (place === 2) {
    return {
      panelTop: "#16203E",
      panelBottom: "#0A1127",
      accent: "#DDE6FF",
      accentSoft: "#FFFFFF",
      text: "#F6F8FF",
      subtext: "#DDE5FF",
      glow: "rgba(221, 230, 255, 0.22)",
      badgeBg: "#EEF2FF",
      badgeText: "#1B2547",
      trim: "rgba(221, 230, 255, 0.28)"
    };
  }

  if (place === 3) {
    return {
      panelTop: "#3B1D12",
      panelBottom: "#1B0C06",
      accent: "#FFB78A",
      accentSoft: "#FFE0CC",
      text: "#FFF0E7",
      subtext: "#FFD7C1",
      glow: "rgba(255, 183, 138, 0.24)",
      badgeBg: "#FFD7BD",
      badgeText: "#4A2413",
      trim: "rgba(255, 183, 138, 0.26)"
    };
  }

  return {
    panelTop: "#111C3F",
    panelBottom: "#0A1127",
    accent: "#77A7FF",
    accentSoft: "#DCE8FF",
    text: "#F5F8FF",
    subtext: "#D7E3FF",
    glow: "rgba(119, 167, 255, 0.16)",
    badgeBg: "#213264",
    badgeText: "#F5F8FF",
    trim: "rgba(119, 167, 255, 0.18)"
  };
}

function createParticles(width, height, count) {
  const colors = [
    "rgba(255,213,74,0.72)",
    "rgba(255,255,255,0.72)",
    "rgba(102,227,255,0.62)",
    "rgba(255,102,194,0.52)"
  ];

  return Array.from({ length: count }, () => ({
    x: Math.random() * width,
    y: Math.random() * height,
    len: 7 + Math.random() * 13,
    thickness: 1 + Math.random() * 1.6,
    angle: Math.random() * Math.PI * 2,
    color: colors[Math.floor(Math.random() * colors.length)],
    alpha: 0.12 + Math.random() * 0.18,
    ampX: 6 + Math.random() * 18,
    ampY: 8 + Math.random() * 22,
    phase: Math.random() * Math.PI * 2,
    speed: 0.6 + Math.random() * 0.8
  }));
}

function createEnergyOrbs(width, height, count) {
  const colors = [
    "rgba(255,213,74,0.08)",
    "rgba(255,95,189,0.06)",
    "rgba(102,227,255,0.06)",
    "rgba(147,125,255,0.07)"
  ];

  return Array.from({ length: count }, () => ({
    x: Math.random() * width,
    y: Math.random() * height,
    r: 28 + Math.random() * 46,
    phase: Math.random() * Math.PI * 2,
    speed: 0.25 + Math.random() * 0.45,
    driftX: 5 + Math.random() * 14,
    driftY: 6 + Math.random() * 18,
    color: colors[Math.floor(Math.random() * colors.length)]
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

function drawSweep(ctx, width, height, phase) {
  const t = (Math.sin(phase) + 1) / 2;
  const sweepX = -220 + t * (width + 440);

  const grad = ctx.createLinearGradient(sweepX - 120, 0, sweepX + 120, 0);
  grad.addColorStop(0, "rgba(255,255,255,0)");
  grad.addColorStop(0.5, "rgba(255,255,255,0.035)");
  grad.addColorStop(1, "rgba(255,255,255,0)");

  ctx.save();
  ctx.translate(width / 2, height / 2);
  ctx.rotate(-0.28);
  ctx.fillStyle = grad;
  ctx.fillRect(-width, -height, width * 2, height * 2);
  ctx.restore();
}

function drawSmashBallBurst(ctx, centerX, centerY, phase, animated = false) {
  const pulse = animated ? 1 + Math.sin(phase) * 0.02 : 1;

  const halo = ctx.createRadialGradient(centerX, centerY, 24, centerX, centerY, 260 * pulse);
  halo.addColorStop(0, "rgba(255,255,255,0.18)");
  halo.addColorStop(0.14, "rgba(255,214,74,0.18)");
  halo.addColorStop(0.34, "rgba(255,214,74,0.08)");
  halo.addColorStop(0.58, "rgba(255,102,194,0.03)");
  halo.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = halo;
  ctx.fillRect(centerX - 320, centerY - 320, 640, 640);

  const rays = 14;
  ctx.save();
  ctx.translate(centerX, centerY);
  for (let i = 0; i < rays; i++) {
    const angle = (Math.PI * 2 * i) / rays + (animated ? phase * 0.03 : 0);
    ctx.save();
    ctx.rotate(angle);
    const rayGrad = ctx.createLinearGradient(0, 0, 170, 0);
    rayGrad.addColorStop(0, "rgba(255,255,255,0.12)");
    rayGrad.addColorStop(0.18, "rgba(255,226,130,0.12)");
    rayGrad.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = rayGrad;
    ctx.fillRect(24, -2, 170, 4);
    ctx.restore();
  }
  ctx.restore();
}

function drawBackgroundGrid(ctx, width, height) {
  ctx.save();
  ctx.globalAlpha = 0.045;
  ctx.strokeStyle = "#AFC4FF";
  ctx.lineWidth = 1;

  const gap = 48;

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

function drawBackground(ctx, width, height, options = {}) {
  const {
    particles = null,
    orbs = null,
    phase = 0,
    animated = false
  } = options;

  const bg = ctx.createLinearGradient(0, 0, width, height);
  bg.addColorStop(0, "#040713");
  bg.addColorStop(0.28, "#0B1231");
  bg.addColorStop(0.55, "#160C2A");
  bg.addColorStop(0.82, "#0B1026");
  bg.addColorStop(1, "#05070F");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, width, height);

  const topGlow = ctx.createRadialGradient(width / 2, 120, 30, width / 2, 120, 360);
  topGlow.addColorStop(0, "rgba(255,213,74,0.12)");
  topGlow.addColorStop(0.32, "rgba(255,213,74,0.05)");
  topGlow.addColorStop(1, "rgba(255,213,74,0)");
  ctx.fillStyle = topGlow;
  ctx.fillRect(0, 0, width, height);

  const leftGlow = ctx.createRadialGradient(120, 220, 10, 120, 220, 300);
  leftGlow.addColorStop(0, "rgba(255,90,189,0.08)");
  leftGlow.addColorStop(1, "rgba(255,90,189,0)");
  ctx.fillStyle = leftGlow;
  ctx.fillRect(0, 0, width, height);

  const rightGlow = ctx.createRadialGradient(width - 120, 190, 10, width - 120, 190, 320);
  rightGlow.addColorStop(0, "rgba(102,227,255,0.08)");
  rightGlow.addColorStop(1, "rgba(102,227,255,0)");
  ctx.fillStyle = rightGlow;
  ctx.fillRect(0, 0, width, height);

  drawBackgroundGrid(ctx, width, height);
  drawSmashBallBurst(ctx, width / 2, 150, phase, animated);

  if (orbs) drawOrbs(ctx, orbs, phase);
  if (particles) drawParticles(ctx, particles, phase);
  if (animated) drawSweep(ctx, width, height, phase);
}

function drawHeaderShimmer(ctx, x, y, width, height, phase) {
  const t = (Math.sin(phase) + 1) / 2;
  const shimmerX = x - 140 + t * (width + 280);

  ctx.save();
  drawRoundedRect(ctx, x, y, width, height, 30);
  ctx.clip();

  const grad = ctx.createLinearGradient(shimmerX - 180, 0, shimmerX + 180, 0);
  grad.addColorStop(0, "rgba(255,255,255,0)");
  grad.addColorStop(0.5, "rgba(255,255,255,0.09)");
  grad.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = grad;
  ctx.fillRect(shimmerX - 200, y, 400, height);

  ctx.restore();
}

function drawHeader(ctx, width, phase, totalPlayers, animated = false) {
  const x = 24;
  const y = 18;
  const w = width - 48;
  const h = 100;

  drawRoundedRect(ctx, x, y, w, h, 30);
  const headerGrad = ctx.createLinearGradient(x, y, x + w, y);
  headerGrad.addColorStop(0, "rgba(49,18,106,0.92)");
  headerGrad.addColorStop(0.35, "rgba(46,45,145,0.92)");
  headerGrad.addColorStop(0.7, "rgba(29,83,163,0.92)");
  headerGrad.addColorStop(1, "rgba(27,133,162,0.92)");
  ctx.fillStyle = headerGrad;
  ctx.fill();

  ctx.strokeStyle = "rgba(255,255,255,0.10)";
  ctx.lineWidth = 2;
  ctx.stroke();

  if (animated) {
    drawHeaderShimmer(ctx, x, y, w, h, phase);
  }

  ctx.fillStyle = "#F8FBFF";
  ctx.font = "bold 40px SmashFont";
  ctx.fillText("SSBU LEADERBOARD", x + 28, y + 50);

  ctx.fillStyle = "#D8E2FF";
  ctx.font = "19px SmashFont";
  ctx.fillText("Official Ranked Order", x + 28, y + 78);

  const pillW = 128;
  const pillH = 36;
  const pillX = x + w - pillW - 22;
  const pillY = y + 24;

  drawRoundedRect(ctx, pillX, pillY, pillW, pillH, 18);
  ctx.fillStyle = "rgba(255,255,255,0.12)";
  ctx.fill();

  ctx.fillStyle = "#FFFFFF";
  ctx.font = "bold 18px SmashFont";
  const txt = `${totalPlayers} Players`;
  const tw = ctx.measureText(txt).width;
  ctx.fillText(txt, pillX + (pillW - tw) / 2, pillY + 24);
}

function drawRankBadge(ctx, x, y, place, colors) {
  const w = 76;
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

function drawRecordPill(ctx, x, y, w, h, label, value, accentColor) {
  drawRoundedRect(ctx, x, y, w, h, 18);
  ctx.fillStyle = "rgba(255,255,255,0.08)";
  ctx.fill();

  ctx.strokeStyle = "rgba(255,255,255,0.06)";
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.fillStyle = accentColor;
  ctx.font = "bold 14px SmashFont";
  ctx.fillText(label, x + 14, y + 18);

  ctx.fillStyle = "#FFFFFF";
  ctx.font = "bold 21px SmashFont";
  const tw = ctx.measureText(value).width;
  ctx.fillText(value, x + w - tw - 14, y + 29);
}

function drawCardSheen(ctx, x, y, w, h, phase, strength = 1) {
  const t = (Math.sin(phase) + 1) / 2;
  const sweepX = x - 70 + t * (w + 140);

  ctx.save();
  drawRoundedRect(ctx, x, y, w, h, 26);
  ctx.clip();

  const grad = ctx.createLinearGradient(sweepX - 80, 0, sweepX + 80, 0);
  grad.addColorStop(0, "rgba(255,255,255,0)");
  grad.addColorStop(0.5, `rgba(255,255,255,${0.07 * strength})`);
  grad.addColorStop(1, "rgba(255,255,255,0)");

  ctx.fillStyle = grad;
  ctx.fillRect(sweepX - 90, y, 180, h);
  ctx.restore();
}

function drawAvatarRing(ctx, cx, cy, r, colors, phase, champion = false, animated = false) {
  const pulse = animated
    ? (champion ? 1 + Math.sin(phase) * 0.02 : 1 + Math.sin(phase) * 0.01)
    : 1;

  const ringR = r + (champion ? 8 : 5) * pulse;

  const ring = ctx.createRadialGradient(cx, cy, ringR - 4, cx, cy, ringR + 10);
  ring.addColorStop(0, colors.glow);
  ring.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = ring;
  ctx.beginPath();
  ctx.arc(cx, cy, ringR + 10, 0, Math.PI * 2);
  ctx.fill();

  ctx.beginPath();
  ctx.arc(cx, cy, ringR, 0, Math.PI * 2);
  ctx.strokeStyle = colors.accent;
  ctx.lineWidth = champion ? 4 : 3;
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(cx, cy, r + 2, 0, Math.PI * 2);
  ctx.strokeStyle = "rgba(255,255,255,0.42)";
  ctx.lineWidth = 2;
  ctx.stroke();
}

function drawTopPlayerCard(ctx, entry, x, y, w, h, phase, options = {}) {
  const { isChampion = false, animated = false } = options;
  const colors = getPlacementColors(entry.place);
  const avatarSize = isChampion ? 132 : 96;
  const avatarRadius = avatarSize / 2;
  const bob = animated ? (isChampion ? Math.sin(phase) * 4 : Math.sin(phase + entry.place * 0.4) * 2.2) : 0;
  const shadowBlur = isChampion ? 14 : 8;

  ctx.save();
  ctx.shadowColor = colors.glow;
  ctx.shadowBlur = shadowBlur;
  drawRoundedRect(ctx, x, y, w, h, 28);
  ctx.fillStyle = createVerticalGradient(ctx, x, y, h, [
    [0, colors.panelTop],
    [1, colors.panelBottom]
  ]);
  ctx.fill();
  ctx.restore();

  drawRoundedRect(ctx, x, y, w, h, 28);
  ctx.fillStyle = createVerticalGradient(ctx, x, y, h, [
    [0, colors.panelTop],
    [1, colors.panelBottom]
  ]);
  ctx.fill();

  ctx.strokeStyle = colors.trim;
  ctx.lineWidth = 2;
  ctx.stroke();

  if (animated) {
    drawCardSheen(ctx, x, y, w, h, phase + entry.place * 0.35, isChampion ? 1 : 0.7);
  }

  drawRoundedRect(ctx, x, y, 10, h, 5);
  ctx.fillStyle = colors.accent;
  ctx.fill();

  drawRankBadge(ctx, x + 18, y + 18, entry.place, colors);

  if (isChampion) {
    const champX = x + w - 136;
    const champY = y + 18;
    drawRoundedRect(ctx, champX, champY, 116, 30, 13);
    ctx.fillStyle = "#FFD54A";
    ctx.fill();

    ctx.fillStyle = "#2D1900";
    ctx.font = "bold 14px SmashFont";
    const txt = "CHAMPION";
    const tw = ctx.measureText(txt).width;
    ctx.fillText(txt, champX + (116 - tw) / 2, champY + 20);
  }

  const avatarX = x + (w - avatarSize) / 2;
  const avatarY = y + 66 + bob;
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
    ctx.font = `bold ${isChampion ? 42 : 32}px SmashFont`;
    const initial = entry.canvasDisplayName.slice(0, 1).toUpperCase();
    const tw = ctx.measureText(initial).width;
    ctx.fillText(initial, avatarCX - tw / 2, avatarCY + 14);
  }

  ctx.fillStyle = colors.text;
  ctx.font = isChampion ? "bold 31px SmashFont" : "bold 26px SmashFont";
  const name = truncateText(ctx, entry.canvasDisplayName, w - 42);
  const nameW = ctx.measureText(name).width;
  ctx.fillText(name, x + (w - nameW) / 2, y + h - 98);

  ctx.fillStyle = colors.subtext;
  ctx.font = "22px SmashFont";
  const rankText = `Rank #${entry.rank}`;
  const rankW = ctx.measureText(rankText).width;
  ctx.fillText(rankText, x + (w - rankW) / 2, y + h - 62);

  const pillW = isChampion ? 190 : 170;
  const pillH = 42;
  const pillX = x + (w - pillW) / 2;
  const pillY = y + h - 38;
  drawRecordPill(ctx, pillX, pillY, pillW, pillH, "SET RECORD", `${entry.setWins}-${entry.setLosses}`, colors.accentSoft);
}

function drawLowerCard(ctx, entry, x, y, w, h, phase, animated = false) {
  const colors = getPlacementColors(entry.place);
  const avatarSize = 62;
  const avatarX = x + 108;
  const avatarY = y + (h - avatarSize) / 2;
  const avatarCX = avatarX + avatarSize / 2;
  const avatarCY = avatarY + avatarSize / 2;

  ctx.save();
  ctx.shadowColor = colors.glow;
  ctx.shadowBlur = 6;
  drawRoundedRect(ctx, x, y, w, h, 22);
  ctx.fillStyle = createVerticalGradient(ctx, x, y, h, [
    [0, colors.panelTop],
    [1, colors.panelBottom]
  ]);
  ctx.fill();
  ctx.restore();

  drawRoundedRect(ctx, x, y, w, h, 22);
  ctx.fillStyle = createVerticalGradient(ctx, x, y, h, [
    [0, colors.panelTop],
    [1, colors.panelBottom]
  ]);
  ctx.fill();

  ctx.strokeStyle = colors.trim;
  ctx.lineWidth = 1.5;
  ctx.stroke();

  if (animated) {
    drawCardSheen(ctx, x, y, w, h, phase + entry.place * 0.2, 0.45);
  }

  drawRoundedRect(ctx, x, y, 8, h, 5);
  ctx.fillStyle = colors.accent;
  ctx.fill();

  drawRankBadge(ctx, x + 18, y + 18, entry.place, colors);

  drawAvatarRing(ctx, avatarCX, avatarCY, avatarSize / 2, colors, phase + entry.place * 0.2, false, animated);

  if (entry.avatarImage) {
    drawCircleImage(ctx, entry.avatarImage, avatarX, avatarY, avatarSize);
  } else {
    ctx.beginPath();
    ctx.arc(avatarCX, avatarCY, avatarSize / 2, 0, Math.PI * 2);
    ctx.fillStyle = "#2A376B";
    ctx.fill();

    ctx.fillStyle = "#F6FAFF";
    ctx.font = "bold 24px SmashFont";
    const initial = entry.canvasDisplayName.slice(0, 1).toUpperCase();
    const tw = ctx.measureText(initial).width;
    ctx.fillText(initial, avatarCX - tw / 2, avatarCY + 9);
  }

  const textX = avatarX + avatarSize + 18;
  ctx.fillStyle = colors.text;
  ctx.font = "bold 25px SmashFont";
  const name = truncateText(ctx, entry.canvasDisplayName, 350);
  ctx.fillText(name, textX, y + 42);

  ctx.fillStyle = colors.subtext;
  ctx.font = "21px SmashFont";
  ctx.fillText(`Rank #${entry.rank}`, textX, y + 73);

  const recordW = 188;
  const recordH = 40;
  const recordX = x + w - recordW - 20;
  const recordY = y + 19;
  drawRecordPill(ctx, recordX, recordY, recordW, recordH, "SET RECORD", `${entry.setWins}-${entry.setLosses}`, colors.accentSoft);
}

function drawTopSection(ctx, entries, width, phase, animated = false) {
  const topThree = entries.slice(0, 3);
  const first = topThree.find((e) => e.place === 1);
  const second = topThree.find((e) => e.place === 2);
  const third = topThree.find((e) => e.place === 3);

  const topY = 152;
  const centerW = 330;
  const centerH = 330;
  const sideW = 252;
  const sideH = 272;
  const gap = 22;

  const centerX = (width - centerW) / 2;
  const leftX = centerX - sideW - gap;
  const rightX = centerX + centerW + gap;
  const sideY = topY + 34;

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

  const startY = 510;
  const cardH = 96;
  const gap = 14;
  const x = 28;
  const w = width - 56;

  for (let i = 0; i < rest.length; i++) {
    const y = startY + i * (cardH + gap);
    drawLowerCard(ctx, rest[i], x, y, w, cardH, phase, animated);
  }
}

function drawLeaderboardFrame(ctx, entries, width, height, options = {}) {
  const { phase = 0, animated = false, particles = null, orbs = null } = options;

  drawBackground(ctx, width, height, {
    phase,
    animated,
    particles,
    orbs
  });

  drawHeader(ctx, width, phase, entries.length, animated);
  drawTopSection(ctx, entries, width, phase, animated);
  drawLowerSection(ctx, entries, width, phase, animated);
}

function getLeaderboardHeight(entryCount) {
  if (entryCount <= 3) return 860;
  return 510 + (entryCount - 3) * 110 + 110;
}

async function generateLeaderboardImage(rows, guild) {
  const entries = await buildLeaderboardEntries(guild, rows);
  const width = 1200;
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
  const width = 1100;
  const height = getLeaderboardHeight(entries.length);

  const encoder = new GIFEncoder(width, height);
  encoder.start();
  encoder.setRepeat(0);
  encoder.setDelay(75);
  encoder.setQuality(12);

  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext("2d");

  const particles = createParticles(width, height, 42);
  const orbs = createEnergyOrbs(width, height, 8);

  const frameCount = 24;

  for (let frame = 0; frame < frameCount; frame++) {
    const phase = (frame / frameCount) * Math.PI * 2;
    ctx.clearRect(0, 0, width, height);
    drawLeaderboardFrame(ctx, entries, width, height, {
      animated: true,
      phase,
      particles,
      orbs
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