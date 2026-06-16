// Cloudflare Worker: Taiwan Bank FX JSON API
// Endpoints:
//   GET /rates/latest.json  -> read latest FX data from KV
//   GET /rates/update       -> manually refresh and store latest FX data
// Cron Trigger refreshes data automatically.
// Required binding:
//   KV namespace binding name: FX_KV

const BOT_CSV_URL = 'https://rate.bot.com.tw/xrt/flcsv/0/day';
const KV_KEY = 'rates:latest';
const CACHE_TTL_SECONDS = 60;

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

function jsonResponse(data, init = {}) {
  return new Response(JSON.stringify(data, null, 2), {
    ...init,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': `public, max-age=${CACHE_TTL_SECONDS}`,
      ...CORS_HEADERS,
      ...(init.headers || {}),
    },
  });
}

function getTaipeiTimeString(date = new Date()) {
  const parts = new Intl.DateTimeFormat('zh-TW', {
    timeZone: 'Asia/Taipei',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(date);

  const map = Object.fromEntries(parts.map(p => [p.type, p.value]));
  return `${map.year}/${map.month}/${map.day} ${map.hour}:${map.minute}:${map.second}`;
}

function parseNumber(value) {
  if (!value) return null;
  const cleaned = String(value).trim().replace(/,/g, '');
  if (!cleaned || cleaned === '-') return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

function parseCSVLine(line) {
  const out = [];
  let cur = '';
  let quoted = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (quoted && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        quoted = !quoted;
      }
    } else if (ch === ',' && !quoted) {
      out.push(cur.trim());
      cur = '';
    } else {
      cur += ch;
    }
  }
  out.push(cur.trim());
  return out.map(v => v.replace(/^"|"$/g, '').trim());
}

function decodeCSV(arrayBuffer) {
  // Cloudflare Workers supports TextDecoder. BOT CSV may be UTF-8 or Big5-like.
  // Currency codes/numeric columns are ASCII, so UTF-8 is enough for our parsing.
  return new TextDecoder('utf-8').decode(arrayBuffer).replace(/^\uFEFF/, '');
}

function pickColumns(cols) {
  // Expected BOT flcsv common layout:
  // 0 currency code, 2 cash buy, 3 spot buy, 12 cash sell, 13 spot sell
  // Some mirrored exports shift sell columns to 13/14. We validate by selecting sane pairs.
  const candidates = [
    { cashBuy: 2, spotBuy: 3, cashSell: 12, spotSell: 13 },
    { cashBuy: 2, spotBuy: 3, cashSell: 13, spotSell: 14 },
  ];

  for (const c of candidates) {
    const spotBuy = parseNumber(cols[c.spotBuy]);
    const spotSell = parseNumber(cols[c.spotSell]);
    if (spotBuy && spotSell && spotSell >= spotBuy) {
      return {
        cashBuy: parseNumber(cols[c.cashBuy]),
        spotBuy,
        cashSell: parseNumber(cols[c.cashSell]),
        spotSell,
      };
    }
  }

  return {
    cashBuy: parseNumber(cols[2]),
    spotBuy: parseNumber(cols[3]),
    cashSell: parseNumber(cols[12]),
    spotSell: parseNumber(cols[13]),
  };
}

async function fetchBotRates() {
  const res = await fetch(`${BOT_CSV_URL}?_=${Date.now()}`, {
    headers: {
      'User-Agent': 'Mozilla/5.0 Cloudflare Worker FX Sync',
      'Accept': 'text/csv,text/plain,*/*',
    },
  });

  if (!res.ok) {
    throw new Error(`BOT CSV fetch failed: ${res.status}`);
  }

  const text = decodeCSV(await res.arrayBuffer());
  const lines = text.split(/\r?\n/).map(s => s.trim()).filter(Boolean);

  if (lines.length < 2) {
    throw new Error('BOT CSV is empty');
  }

  const details = {};

  for (let i = 1; i < lines.length; i++) {
    const cols = parseCSVLine(lines[i]);
    const code = cols[0];
    if (!/^[A-Z]{3}$/.test(code)) continue;

    const picked = pickColumns(cols);
    details[code] = {
      cash: { buy: picked.cashBuy, sell: picked.cashSell },
      spot: { buy: picked.spotBuy, sell: picked.spotSell },
    };
  }

  if (!details.USD?.spot?.buy || !details.USD?.spot?.sell) {
    throw new Error('USD spot rate missing');
  }

  const usdMid = (details.USD.spot.buy + details.USD.spot.sell) / 2;
  const rates = { USD: 1, TWD: usdMid };

  for (const [code, d] of Object.entries(details)) {
    if (code === 'USD') continue;
    const buy = d.spot.buy ?? d.cash.buy;
    const sell = d.spot.sell ?? d.cash.sell;
    if (buy && sell) {
      const twdPerUnit = (buy + sell) / 2;
      rates[code] = usdMid / twdPerUnit;
    }
  }

  const now = new Date();
  return {
    source: '臺灣銀行牌告匯率',
    updateTime: getTaipeiTimeString(now),
    generatedAt: now.toISOString(),
    quoteTimeSource: 'cloudflare-generated-time',
    details,
    rates,
  };
}

async function updateRates(env) {
  const latest = await fetchBotRates();
  await env.FX_KV.put(KV_KEY, JSON.stringify(latest), {
    metadata: {
      generatedAt: latest.generatedAt,
      updateTime: latest.updateTime,
      source: latest.source,
    },
  });
  return latest;
}

async function getLatest(env) {
  const value = await env.FX_KV.get(KV_KEY);
  if (!value) {
    return {
      source: '臺灣銀行牌告匯率',
      updateTime: '尚未同步，請先呼叫 /rates/update 或等待 Cron Trigger',
      generatedAt: null,
      details: {},
      rates: {},
    };
  }
  return JSON.parse(value);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: CORS_HEADERS });
    }

    if (url.pathname === '/' || url.pathname === '/rates/latest.json') {
      return jsonResponse(await getLatest(env));
    }

    if (url.pathname === '/rates/update') {
      try {
        return jsonResponse(await updateRates(env));
      } catch (err) {
        const fallback = await getLatest(env);
        return jsonResponse({
          error: String(err?.message || err),
          fallback,
        }, { status: fallback.generatedAt ? 200 : 502 });
      }
    }

    return jsonResponse({ error: 'Not found' }, { status: 404 });
  },

  async scheduled(event, env, ctx) {
    ctx.waitUntil(updateRates(env));
  },
};
