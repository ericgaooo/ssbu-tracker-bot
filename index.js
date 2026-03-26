require("dotenv").config();
const {
  Client,
  GatewayIntentBits,
  AttachmentBuilder
} = require("discord.js");
const { createCanvas, loadImage } = require("canvas");
const GIFEncoder = require("gif-encoder-2");

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
      cardBg: "#4D3300",
      accent: "#FFD447",
      badgeBg: "#FFE27D",
      badgeText: "#3D2600",
      glow: "rgba(255, 212, 71, 0.42)"
    };
  }
  if (place === 2) {
    return {
      cardBg: "#24355C",
      accent: "#D8E3FF",
      badgeBg: "#EEF3FF",
      badgeText: "#22304A",
      glow: "rgba(216, 227, 255, 0.28)"
    };
  }
  if (place === 3) {
    return {
      cardBg: "#5A3426",
      accent: "#F5B38A",
      badgeBg: "#FFD4B9",
      badgeText: "#472719",
      glow: "rgba(245, 179, 138, 0.30)"
    };
  }

  return {
    cardBg: "#221E46",
    accent: "#7A8CFF",
    badgeBg: "#2E346A",
    badgeText: "#EDF0FF",
    glow: "rgba(122, 140, 255, 0.18)"
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
    len: front ? 8 + Math.random() * 12 : 5 + Math.random() * 8,
    thickness: front ? 2 + Math.random() * 2.4 : 1.2 + Math.random() * 1.5,
    angle: Math.random() * Math.PI,
    speed: front ? 1.5 + Math.random() * 2.7 : 0.7 + Math.random() * 1.4,
    drift: front ? -1.8 + Math.random() * 3.6 : -0.8 + Math.random() * 1.6,
    color: colors[Math.floor(Math.random() * colors.length)],
    alpha: front ? 0.95 : 0.50
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
    r: 16 + Math.random() * 42,
    speed: 0.25 + Math.random() * 0.7,
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

function createBurstParticles(width, countPerSide = 70) {
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
      gravity: 0.20 + Math.random() * 0.16,
      size: 5 + Math.random() * 9,
      rot: Math.random() * Math.PI,
      rotSpeed: -0.2 + Math.random() * 0.4,
      color: colors[Math.floor(Math.random() * colors.length)],
      alpha: 0.70 + Math.random() * 0.25,
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

  const topGlow = ctx.createLinearGradient(0, 0, 0, 180);
  topGlow.addColorStop(0, "rgba(88,225,255,0.16)");
  topGlow.addColorStop(1, "rgba(88,225,255,0)");
  ctx.fillStyle = topGlow;
  ctx.fillRect(0, 0, width, 200);

  const leftBeam = ctx.createRadialGradient(180, 100, 20, 180, 100, 380);
  leftBeam.addColorStop(0, "rgba(122,140,255,0.22)");
  leftBeam.addColorStop(1, "rgba(122,140,255,0)");
  ctx.fillStyle = leftBeam;
  ctx.fillRect(0, 0, width, height);

  const rightBeam = ctx.createRadialGradient(width - 180, 120, 30, width - 180, 120, 360);
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

function drawLeaderboardFrame(ctx, entries, width, height, backParticles = null, frontParticles = null, orbs = null, sparkles = null, burstParticles = null, frame = 0) {
  const outerPadding = 28;
  const headerHeight = 108;
  const cardHeight = 108;
  const cardGap = 18;
  const listTop = outerPadding + headerHeight + 20;

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
  ctx.font = "bold 42px sans-serif";
  ctx.fillText("SSBU LEADERBOARD", outerPadding + 34, outerPadding + 60);

  ctx.fillStyle = "#BFD4FF";
  ctx.font = "22px sans-serif";
  ctx.fillText("Official Ranked Order", outerPadding + 34, outerPadding + 90);

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    const colors = getPlacementColors(entry.place);

    const bobOffset = entry.place === 1 ? Math.sin(frame * 0.65) * 8 : 0;
    const y = listTop + i * (cardHeight + cardGap) + bobOffset;

    const cardX = outerPadding + 8;
    const cardW = width - (outerPadding + 8) * 2;
    const pulse = entry.place <= 3 ? 20 + (Math.sin(frame * 0.5 + i) + 1) * 8 : 12;

    ctx.save();
    ctx.shadowColor = colors.glow;
    ctx.shadowBlur = pulse;
    drawRoundedRect(ctx, cardX, y, cardW, cardHeight, 24);
    ctx.fillStyle = colors.cardBg;
    ctx.fill();
    ctx.restore();

    drawRoundedRect(ctx, cardX, y, 10, cardHeight, 5);
    ctx.fillStyle = colors.accent;
    ctx.fill();

    const badgeX = cardX + 22;
    const badgeY = y + 22;
    const badgeW = 70;
    const badgeH = 46;

    drawRoundedRect(ctx, badgeX, badgeY, badgeW, badgeH, 14);
    ctx.fillStyle = colors.badgeBg;
    ctx.fill();

    ctx.fillStyle = colors.badgeText;
    ctx.font = "bold 22px sans-serif";
    const placeText = `#${entry.place}`;
    const placeWidth = ctx.measureText(placeText).width;
    ctx.fillText(placeText, badgeX + (badgeW - placeWidth) / 2, badgeY + 31);

    const avatarSize = 72;
    const avatarX = badgeX + badgeW + 24;
    const avatarY = y + (cardHeight - avatarSize) / 2;

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
      ctx.font = "bold 28px sans-serif";
      const initial = entry.canvasDisplayName.slice(0, 1).toUpperCase();
      const initialWidth = ctx.measureText(initial).width;
      ctx.fillText(initial, avatarX + (avatarSize - initialWidth) / 2, avatarY + 46);
    }

    const textX = avatarX + avatarSize + 22;

    ctx.fillStyle = "#F6FAFF";
    ctx.font = "bold 30px sans-serif";
    const displayName = truncateText(ctx, entry.canvasDisplayName, 420);
    ctx.fillText(displayName, textX, y + 46);

    ctx.fillStyle = "#DCE6FF";
    ctx.font = "24px sans-serif";
    ctx.fillText(`Rank #${entry.rank}`, textX, y + 80);

    const recordPillX = cardX + cardW - 260;
    const recordPillY = y + 28;
    const recordPillW = 220;
    const recordPillH = 50;

    drawRoundedRect(ctx, recordPillX, recordPillY, recordPillW, recordPillH, 18);
    ctx.fillStyle = "rgba(255,255,255,0.10)";
    ctx.fill();

    ctx.fillStyle = "#FFFFFF";
    ctx.font = "bold 24px sans-serif";
    const recordText = `${entry.setWins}-${entry.setLosses}`;
    const recordWidth = ctx.measureText(recordText).width;
    ctx.fillText(recordText, recordPillX + (recordPillW - recordWidth) / 2, recordPillY + 33);

    ctx.fillStyle = "#C9D7FF";
    ctx.font = "18px sans-serif";
    const subText = `${entry.setsPlayed} sets played`;
    const subWidth = ctx.measureText(subText).width;
    ctx.fillText(subText, recordPillX + (recordPillW - subWidth) / 2, y + 94);

    if (entry.place === 1) {
      const champPillX = cardX + cardW - 145;
      const champPillY = y + 14;
      const champPillW = 112;
      const champPillH = 26;

      drawRoundedRect(ctx, champPillX, champPillY, champPillW, champPillH, 12);
      ctx.fillStyle = "#FFD447";
      ctx.fill();

      ctx.fillStyle = "#2D1B00";
      ctx.font = "bold 14px sans-serif";
      const champText = "CHAMPION";
      const champWidth = ctx.measureText(champText).width;
      ctx.fillText(champText, champPillX + (champPillW - champWidth) / 2, champPillY + 18);
    }
  }
}

async function generateLeaderboardImage(rows, guild) {
  const entries = await buildLeaderboardEntries(guild, rows.slice(0, 10));

  const width = 1280;
  const outerPadding = 28;
  const headerHeight = 108;
  const cardHeight = 108;
  const cardGap = 18;
  const listTop = outerPadding + headerHeight + 20;
  const height =
    listTop +
    entries.length * cardHeight +
    Math.max(0, entries.length - 1) * cardGap +
    outerPadding;

  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext("2d");

  drawLeaderboardFrame(ctx, entries, width, height);

  return canvas.toBuffer("image/png");
}

async function generateAnimatedLeaderboardGif(rows, guild) {
  const entries = await buildLeaderboardEntries(guild, rows.slice(0, 10));

  const width = 1280;
  const outerPadding = 28;
  const headerHeight = 108;
  const cardHeight = 108;
  const cardGap = 18;
  const listTop = outerPadding + headerHeight + 20;
  const height =
    listTop +
    entries.length * cardHeight +
    Math.max(0, entries.length - 1) * cardGap +
    outerPadding;

  const encoder = new GIFEncoder(width, height);
  encoder.start();
  encoder.setRepeat(0);
  encoder.setDelay(80);
  encoder.setQuality(10);

  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext("2d");

  const backParticles = createParticles(width, height, 80, "back");
  const frontParticles = createParticles(width, height, 120, "front");
  const orbs = createEnergyOrbs(width, height, 14);
  const sparkles = createSparkles(width, height, 18);
  const burstParticles = createBurstParticles(width, 75);

  const frameCount = 22;
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
    if (interaction.commandName === "report-set") {
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

    if (interaction.commandName === "report-game-win" || interaction.commandName === "report-game-loss") {
      const reporter = interaction.user;
      const opponent = interaction.options.getUser("opponent");
      const result = interaction.commandName === "report-game-win" ? "win" : "loss";

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

    if (interaction.commandName === "my-record") {
      const user = interaction.user;
      const displayName =
        await getDisplayNameFromGuild(interaction.guild, user.id, user.globalName || user.username);

      const record = getDerivedRecordForUser(user.id);

      await interaction.reply(`📊 **${displayName}'s Record**\n${formatRecordLine(record)}`);
      return;
    }

    if (interaction.commandName === "player-record") {
      const user = interaction.options.getUser("user");
      const displayName =
        await getDisplayNameFromGuild(interaction.guild, user.id, user.globalName || user.username);

      const record = getDerivedRecordForUser(user.id);

      await interaction.reply(`📊 **${displayName}'s Record**\n${formatRecordLine(record)}`);
      return;
    }

    if (interaction.commandName === "record-against") {
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

    if (interaction.commandName === "leaderboard") {
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

    if (interaction.commandName === "leaderboard-image") {
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

    if (interaction.commandName === "leaderboard-animated") {
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

    if (interaction.commandName === "my-rank") {
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

    if (interaction.commandName === "player-rank") {
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

    if (interaction.commandName === "set-rank") {
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

    if (interaction.commandName === "my-reports") {
      const reports = getReportsByReporter(interaction.user.id, 15);

      if (reports.length === 0) {
        await interaction.reply("You have not reported any results yet.");
        return;
      }

      const lines = reports.map((r) => `\`${r.id}\` [${r.type}] — ${r.text}`);
      await interaction.reply(`🧾 **Your Recent Reports**\n${lines.join("\n")}`);
      return;
    }

    if (interaction.commandName === "delete-report") {
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