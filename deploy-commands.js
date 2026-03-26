require("dotenv").config();
const { REST, Routes, SlashCommandBuilder } = require("discord.js");

const formatChoices = [
  { name: "Best of 3", value: "bo3" },
  { name: "Best of 5", value: "bo5" },
  { name: "First to 5", value: "ft5" },
  { name: "First to 10", value: "ft10" },
  { name: "Other", value: "other" }
];

const commands = [
  new SlashCommandBuilder()
    .setName("report-set")
    .setDescription("Report a full set that you played")
    .addUserOption(option =>
      option.setName("opponent").setDescription("Who you played against").setRequired(true)
    )
    .addStringOption(option => {
      option.setName("format").setDescription("Set format").setRequired(true);
      for (const choice of formatChoices) option.addChoices(choice);
      return option;
    })
    .addIntegerOption(option =>
      option.setName("my_wins").setDescription("How many games you won in the set").setRequired(true)
    )
    .addIntegerOption(option =>
      option.setName("opponent_wins").setDescription("How many games your opponent won in the set").setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("report-game-win")
    .setDescription("Quickly report a single game win")
    .addUserOption(option =>
      option.setName("opponent").setDescription("Who you beat").setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("report-game-loss")
    .setDescription("Quickly report a single game loss")
    .addUserOption(option =>
      option.setName("opponent").setDescription("Who beat you").setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("my-record")
    .setDescription("Show your Smash record"),

  new SlashCommandBuilder()
    .setName("player-record")
    .setDescription("Show another player's Smash record")
    .addUserOption(option =>
      option.setName("user").setDescription("Player to look up").setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("record-against")
    .setDescription("Show your record against another player")
    .addUserOption(option =>
      option.setName("opponent").setDescription("Opponent to compare against").setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("leaderboard")
    .setDescription("Show the official ranked leaderboard in text"),

  new SlashCommandBuilder()
    .setName("leaderboard-image")
    .setDescription("Show the official ranked leaderboard as an image"),

  new SlashCommandBuilder()
    .setName("leaderboard-animated")
    .setDescription("Show the official ranked leaderboard as an animated image"),

  new SlashCommandBuilder()
    .setName("my-rank")
    .setDescription("Show your rank"),

  new SlashCommandBuilder()
    .setName("player-rank")
    .setDescription("Show another player's rank")
    .addUserOption(option =>
      option.setName("user").setDescription("Player to look up").setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("set-rank")
    .setDescription("Set a player's official rank")
    .addUserOption(option =>
      option.setName("user").setDescription("Player whose rank to set").setRequired(true)
    )
    .addIntegerOption(option =>
      option.setName("rank").setDescription("Rank number, like 1 or 2").setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("my-reports")
    .setDescription("Show your recent reports"),

  new SlashCommandBuilder()
    .setName("delete-report")
    .setDescription("Delete one of your reports by report ID")
    .addStringOption(option =>
      option.setName("report_id").setDescription("Report ID from /my-reports").setRequired(true)
    )
].map(command => command.toJSON());

const rest = new REST({ version: "10" }).setToken(process.env.DISCORD_TOKEN);

(async () => {
  try {
    console.log("Deploying global slash commands...");
    await rest.put(
      Routes.applicationCommands(process.env.CLIENT_ID),
      { body: commands }
    );
    console.log("Global slash commands deployed.");
  } catch (error) {
    console.error(error);
  }
})();