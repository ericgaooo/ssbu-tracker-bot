require("dotenv").config();
const {
  Client,
  GatewayIntentBits,
  AttachmentBuilder
} = require("discord.js");

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

const {
  generateLeaderboardImage,
  generateAnimatedLeaderboardGif
} = require("./leaderboardRenderer");

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

      const reporterName = await getDisplayNameFromGuild(
        interaction.guild,
        reporter.id,
        reporter.globalName || reporter.username
      );

      const opponentName = await getDisplayNameFromGuild(
        interaction.guild,
        opponent.id,
        opponent.globalName || opponent.username
      );

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

    if (
      interaction.commandName === "smashreportgamewin" ||
      interaction.commandName === "smashreportgameloss"
    ) {
      const reporter = interaction.user;
      const opponent = interaction.options.getUser("opponent");
      const result =
        interaction.commandName === "smashreportgamewin" ? "win" : "loss";

      if (opponent.id === reporter.id) {
        await interaction.reply("You cannot report a result against yourself.");
        return;
      }

      const reporterName = await getDisplayNameFromGuild(
        interaction.guild,
        reporter.id,
        reporter.globalName || reporter.username
      );

      const opponentName = await getDisplayNameFromGuild(
        interaction.guild,
        opponent.id,
        opponent.globalName || opponent.username
      );

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

      const displayName = await getDisplayNameFromGuild(
        interaction.guild,
        user.id,
        user.globalName || user.username
      );

      const record = getDerivedRecordForUser(user.id);

      await interaction.reply(
        `📊 **${displayName}'s Record**\n${formatRecordLine(record)}`
      );
      return;
    }

    if (interaction.commandName === "smashplayerrecord") {
      const user = interaction.options.getUser("user");

      const displayName = await getDisplayNameFromGuild(
        interaction.guild,
        user.id,
        user.globalName || user.username
      );

      const record = getDerivedRecordForUser(user.id);

      await interaction.reply(
        `📊 **${displayName}'s Record**\n${formatRecordLine(record)}`
      );
      return;
    }

    if (interaction.commandName === "smashrecordagainst") {
      const self = interaction.user;
      const opponent = interaction.options.getUser("opponent");

      if (self.id === opponent.id) {
        await interaction.reply("You cannot view a record against yourself.");
        return;
      }

      const selfName = await getDisplayNameFromGuild(
        interaction.guild,
        self.id,
        self.globalName || self.username
      );

      const opponentName = await getDisplayNameFromGuild(
        interaction.guild,
        opponent.id,
        opponent.globalName || opponent.username
      );

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
        rows.map(async (row, index) => {
          const displayName = await getDisplayNameFromGuild(
            interaction.guild,
            row.user_id,
            row.username
          );

          return `${index + 1}. **${displayName}** — Rank **#${row.rank}** | Set Record **${row.setWins}-${row.setLosses}**`;
        })
      );

      await interaction.reply(
        `🏆 **Official Ranked Leaderboard**\n${lines.join("\n")}`
      );
      return;
    }

    if (interaction.commandName === "smashleaderboardimage") {
      const rows = getLeaderboard();

      if (rows.length === 0) {
        await interaction.reply("No ranked players exist yet.");
        return;
      }

      await interaction.deferReply();

      const imageBuffer = await generateLeaderboardImage(
        rows,
        interaction.guild
      );

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

      const gifBuffer = await generateAnimatedLeaderboardGif(
        rows,
        interaction.guild
      );

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

      const displayName = await getDisplayNameFromGuild(
        interaction.guild,
        user.id,
        user.globalName || user.username
      );

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

      const displayName = await getDisplayNameFromGuild(
        interaction.guild,
        user.id,
        user.globalName || user.username
      );

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

      const displayName = await getDisplayNameFromGuild(
        interaction.guild,
        user.id,
        user.globalName || user.username
      );

      setPlayerRank(user.id, displayName, rank);

      await interaction.reply(
        `✅ Set **${displayName}** to **Rank #${rank}** and shifted others if needed.`
      );
      return;
    }

    if (interaction.commandName === "smashmyreports") {
      const reports = getReportsByReporter(interaction.user.id, 15);

      if (reports.length === 0) {
        await interaction.reply("You have not reported any results yet.");
        return;
      }

      const lines = reports.map(
        (r) => `\`${r.id}\` [${r.type}] — ${r.text}`
      );

      await interaction.reply(
        `🧾 **Your Recent Reports**\n${lines.join("\n")}`
      );
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
          await interaction.reply(
            "You can only delete reports that you created."
          );
          return;
        }
      }

      await interaction.reply(
        `🗑️ Deleted ${result.type} report \`${result.report.id}\`.`
      );
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