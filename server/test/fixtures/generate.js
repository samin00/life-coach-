// Deterministic synthetic Google Takeout watch-history.json generator (used by tests and the smoke run).
// Usage: node test/fixtures/generate.js <late|day> > watch-history.json

function rng(seed) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32);
}

const PROFILES = {
  late: {
    seed: 42,
    events: 600,
    days: 45,
    channels: [
      ["Fireship", "coding", "How React Server Components really work"],
      ["Theo - t3.gg", "coding", "Why I stopped using TypeScript enums"],
      ["Jeff Nippard", "fitness", "The most effective hypertrophy workout"],
      ["Graham Stephan", "finance", "Investing $10,000 in stocks explained"],
      ["penguinz0", "comedy", "Reaction to the worst meme ever"],
      ["MrBeast", "entertainment", "Last to leave the circle wins"],
    ],
    // hour weights: heavy 21:00-03:00
    hours: [9, 8, 6, 4, 1, 0, 0, 1, 1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 4, 5, 6, 9, 11, 12],
    shortsRate: 0.3,
    burst: 0.85,
  },
  day: {
    seed: 7,
    events: 180,
    days: 40,
    channels: [
      ["Babish Culinary Universe", "cooking", "Pasta recipe from scratch"],
      ["Andrew Huberman", "science", "Science of focus and morning routine"],
      ["Kurzgesagt", "science", "What if the sun disappeared - space documentary"],
      ["Rick Beato", "music", "Guitar song analysis: what makes this album great"],
    ],
    hours: [0, 0, 0, 0, 0, 0, 0, 2, 4, 3, 2, 2, 5, 4, 2, 2, 3, 5, 6, 4, 2, 1, 0, 0],
    shortsRate: 0.05,
    burst: 0.3,
  },
};

export function generateWatchHistory(profileName = "late", { endDate = "2026-09-20" } = {}) {
  const p = PROFILES[profileName];
  const rand = rng(p.seed);
  const totalW = p.hours.reduce((s, w) => s + w, 0);
  const pickHour = () => {
    let x = rand() * totalW;
    for (let h = 0; h < 24; h++) if ((x -= p.hours[h]) < 0) return h;
    return 23;
  };
  const end = Date.parse(endDate + "T00:00:00Z");
  const out = [];
  let prev = null;
  for (let i = 0; i < p.events; i++) {
    let ts;
    if (prev && rand() < p.burst) ts = prev + Math.floor(3 + rand() * 12) * 60000; // binge: next video 3-15 min later
    else {
      const day = Math.floor(rand() * p.days);
      ts = end - day * 86400000 + pickHour() * 3600000 + Math.floor(rand() * 60) * 60000;
    }
    prev = ts;
    const [channel, , title] = p.channels[Math.floor(rand() * rand() * p.channels.length)];
    const short = rand() < p.shortsRate;
    const id = Math.floor(rand() * 1e9).toString(36);
    out.push({
      header: "YouTube",
      title: `Watched ${title}${short ? " #shorts" : ""}`,
      titleUrl: short ? `https://www.youtube.com/shorts/${id}` : `https://www.youtube.com/watch?v=${id}`,
      subtitles: [{ name: channel, url: `https://www.youtube.com/channel/UC${id}` }],
      time: new Date(ts).toISOString(),
      products: ["YouTube"],
    });
  }
  return out.sort((a, b) => (a.time < b.time ? 1 : -1)); // Takeout lists newest first
}

if (import.meta.url === `file://${process.argv[1]}`) {
  process.stdout.write(JSON.stringify(generateWatchHistory(process.argv[2] || "late"), null, 1));
}
