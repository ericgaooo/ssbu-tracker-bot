const fs = require("fs");
const path = require("path");

const DATA_DIR =
  process.env.DATA_DIR || (process.env.RAILWAY_ENVIRONMENT ? "/app/data" : "./data");
const DB_FILE = path.join(DATA_DIR, "smash_data.json");

function ensureDataFile() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  if (!fs.existsSync(DB_FILE)) {
    const initial = {
      players: {},
      set_reports: [],
      game_reports: [],
      andrew_spikes: {}
    };
    fs.writeFileSync(DB_FILE, JSON.stringify(initial, null, 2), "utf8");
  }
}

function readDb() {
  ensureDataFile();
  const db = JSON.parse(fs.readFileSync(DB_FILE, "utf8"));

  if (!db.players) db.players = {};
  if (!db.set_reports) db.set_reports = [];
  if (!db.game_reports) db.game_reports = [];
  if (!db.andrew_spikes) db.andrew_spikes = {};

  return db;
}

function writeDb(data) {
  ensureDataFile();
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), "utf8");
}

function cryptoRandomId() {
  return `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function ensurePlayer(userId, username) {
  const db = readDb();

  if (!db.players[userId]) {
    db.players[userId] = {
      user_id: userId,
      username,
      rank: null,
      updated_at: new Date().toISOString()
    };
  } else {
    db.players[userId].username = username;
    db.players[userId].updated_at = new Date().toISOString();
  }

  writeDb(db);
}

function setPlayerRank(userId, username, rank) {
  const db = readDb();

  if (!db.players[userId]) {
    db.players[userId] = {
      user_id: userId,
      username,
      rank: null,
      updated_at: new Date().toISOString()
    };
  } else {
    db.players[userId].username = username;
    db.players[userId].updated_at = new Date().toISOString();
  }

  const oldRank = db.players[userId].rank;

  for (const playerId of Object.keys(db.players)) {
    if (playerId === userId) continue;

    const other = db.players[playerId];
    if (other.rank == null) continue;

    if (oldRank == null) {
      if (other.rank >= rank) other.rank += 1;
    } else if (rank < oldRank) {
      if (other.rank >= rank && other.rank < oldRank) other.rank += 1;
    } else if (rank > oldRank) {
      if (other.rank <= rank && other.rank > oldRank) other.rank -= 1;
    }
  }

  db.players[userId].rank = rank;
  db.players[userId].updated_at = new Date().toISOString();

  writeDb(db);
  return rank;
}

function getPlayerRank(userId) {
  const db = readDb();
  return db.players[userId]?.rank ?? null;
}

function createSetReport({
  reporterId,
  reporterName,
  opponentId,
  opponentName,
  format,
  reporterWins,
  opponentWins
}) {
  ensurePlayer(reporterId, reporterName);
  ensurePlayer(opponentId, opponentName);

  const db = readDb();

  const report = {
    id: cryptoRandomId(),
    reporter_id: reporterId,
    reporter_name: reporterName,
    opponent_id: opponentId,
    opponent_name: opponentName,
    format,
    reporter_wins: reporterWins,
    opponent_wins: opponentWins,
    created_at: new Date().toISOString()
  };

  db.set_reports.push(report);
  writeDb(db);
  return report;
}

function createGameReport({
  reporterId,
  reporterName,
  opponentId,
  opponentName,
  result
}) {
  ensurePlayer(reporterId, reporterName);
  ensurePlayer(opponentId, opponentName);

  const db = readDb();

  const report = {
    id: cryptoRandomId(),
    reporter_id: reporterId,
    reporter_name: reporterName,
    opponent_id: opponentId,
    opponent_name: opponentName,
    result,
    created_at: new Date().toISOString()
  };

  db.game_reports.push(report);
  writeDb(db);
  return report;
}

function deleteSetReportById(reportId, requesterId) {
  const db = readDb();
  const index = db.set_reports.findIndex((r) => r.id === reportId);

  if (index === -1) return { ok: false, reason: "not_found" };

  const report = db.set_reports[index];
  if (report.reporter_id !== requesterId) {
    return { ok: false, reason: "forbidden" };
  }

  db.set_reports.splice(index, 1);
  writeDb(db);

  return { ok: true, report, type: "set" };
}

function deleteGameReportById(reportId, requesterId) {
  const db = readDb();
  const index = db.game_reports.findIndex((r) => r.id === reportId);

  if (index === -1) return { ok: false, reason: "not_found" };

  const report = db.game_reports[index];
  if (report.reporter_id !== requesterId) {
    return { ok: false, reason: "forbidden" };
  }

  db.game_reports.splice(index, 1);
  writeDb(db);

  return { ok: true, report, type: "game" };
}

function getReportsByReporter(userId, limit = 15) {
  const db = readDb();

  const setReports = db.set_reports
    .filter((r) => r.reporter_id === userId)
    .map((r) => ({
      id: r.id,
      type: "set",
      created_at: r.created_at,
      text: `You ${r.reporter_wins}-${r.opponent_wins} ${r.opponent_name} (${r.format})`
    }));

  const gameReports = db.game_reports
    .filter((r) => r.reporter_id === userId)
    .map((r) => ({
      id: r.id,
      type: "game",
      created_at: r.created_at,
      text: `You reported a ${r.result} vs ${r.opponent_name}`
    }));

  return [...setReports, ...gameReports]
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    .slice(0, limit);
}

function getDerivedRecordForUser(userId) {
  const db = readDb();

  const setReports = db.set_reports.filter(
    (r) => r.reporter_id === userId || r.opponent_id === userId
  );

  const gameReports = db.game_reports.filter(
    (r) => r.reporter_id === userId || r.opponent_id === userId
  );

  let setsPlayed = 0;
  let setWins = 0;
  let setLosses = 0;

  let setGamesWon = 0;
  let setGamesLost = 0;

  let adHocWins = 0;
  let adHocLosses = 0;

  for (const r of setReports) {
    setsPlayed += 1;

    if (r.reporter_id === userId) {
      setGamesWon += r.reporter_wins;
      setGamesLost += r.opponent_wins;
      if (r.reporter_wins > r.opponent_wins) setWins += 1;
      else setLosses += 1;
    } else {
      setGamesWon += r.opponent_wins;
      setGamesLost += r.reporter_wins;
      if (r.opponent_wins > r.reporter_wins) setWins += 1;
      else setLosses += 1;
    }
  }

  for (const r of gameReports) {
    if (r.reporter_id === userId) {
      if (r.result === "win") adHocWins += 1;
      else adHocLosses += 1;
    } else {
      if (r.result === "win") adHocLosses += 1;
      else adHocWins += 1;
    }
  }

  return {
    setsPlayed,
    setWins,
    setLosses,
    setGamesWon,
    setGamesLost,
    adHocWins,
    adHocLosses
  };
}

function getHeadToHead(userAId, userBId) {
  const db = readDb();

  const setReports = db.set_reports.filter((r) => {
    return (
      (r.reporter_id === userAId && r.opponent_id === userBId) ||
      (r.reporter_id === userBId && r.opponent_id === userAId)
    );
  });

  const gameReports = db.game_reports.filter((r) => {
    return (
      (r.reporter_id === userAId && r.opponent_id === userBId) ||
      (r.reporter_id === userBId && r.opponent_id === userAId)
    );
  });

  let aSetWins = 0;
  let bSetWins = 0;
  let aSetGamesWon = 0;
  let bSetGamesWon = 0;
  let aAdHocWins = 0;
  let bAdHocWins = 0;

  for (const r of setReports) {
    if (r.reporter_id === userAId) {
      aSetGamesWon += r.reporter_wins;
      bSetGamesWon += r.opponent_wins;
      if (r.reporter_wins > r.opponent_wins) aSetWins += 1;
      else bSetWins += 1;
    } else {
      aSetGamesWon += r.opponent_wins;
      bSetGamesWon += r.reporter_wins;
      if (r.opponent_wins > r.reporter_wins) aSetWins += 1;
      else bSetWins += 1;
    }
  }

  for (const r of gameReports) {
    if (r.reporter_id === userAId) {
      if (r.result === "win") aAdHocWins += 1;
      else bAdHocWins += 1;
    } else {
      if (r.result === "win") bAdHocWins += 1;
      else aAdHocWins += 1;
    }
  }

  return {
    setsPlayed: setReports.length,
    aSetWins,
    bSetWins,
    aSetGamesWon,
    bSetGamesWon,
    aAdHocWins,
    bAdHocWins
  };
}

function getLeaderboard() {
  const db = readDb();

  const rows = Object.keys(db.players).map((id) => {
    const player = db.players[id];
    const record = getDerivedRecordForUser(id);

    return {
      user_id: id,
      username: player.username,
      rank: player.rank,
      ...record
    };
  });

  const rankedRows = rows.filter((row) => row.rank != null);

  rankedRows.sort((a, b) => {
    if (a.rank !== b.rank) return a.rank - b.rank;
    return a.username.localeCompare(b.username);
  });

  return rankedRows;
}

function incrementAndrewSpike(userId, username) {
  const db = readDb();

  if (!db.andrew_spikes[userId]) {
    db.andrew_spikes[userId] = {
      user_id: userId,
      username,
      count: 0,
      updated_at: new Date().toISOString(),
      last_spike_at: null
    };
  }

  db.andrew_spikes[userId].username = username;
  db.andrew_spikes[userId].count += 1;
  db.andrew_spikes[userId].updated_at = new Date().toISOString();
  db.andrew_spikes[userId].last_spike_at = new Date().toISOString();

  writeDb(db);
  return db.andrew_spikes[userId];
}

function setAndrewSpikeCount(userId, username, count) {
  const db = readDb();

  if (!db.andrew_spikes[userId]) {
    db.andrew_spikes[userId] = {
      user_id: userId,
      username,
      count: 0,
      updated_at: new Date().toISOString(),
      last_spike_at: null
    };
  }

  db.andrew_spikes[userId].username = username;
  db.andrew_spikes[userId].count = Math.max(0, count);
  db.andrew_spikes[userId].updated_at = new Date().toISOString();

  writeDb(db);
  return db.andrew_spikes[userId];
}

function getAndrewSpikeCount(userId) {
  const db = readDb();
  return db.andrew_spikes[userId]?.count ?? 0;
}

function getAndrewSpikeLeaderboard() {
  const db = readDb();

  const rows = Object.values(db.andrew_spikes).map((entry) => ({
    user_id: entry.user_id,
    username: entry.username,
    count: entry.count ?? 0,
    updated_at: entry.updated_at || null,
    last_spike_at: entry.last_spike_at || null
  }));

  rows.sort((a, b) => {
    if (b.count !== a.count) return b.count - a.count;
    return a.username.localeCompare(b.username);
  });

  return rows;
}

module.exports = {
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
  getLeaderboard,
  incrementAndrewSpike,
  setAndrewSpikeCount,
  getAndrewSpikeCount,
  getAndrewSpikeLeaderboard
};