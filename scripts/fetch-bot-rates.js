const fs = require('fs');
const path = require('path');

const BOT_PAGE_URL = 'https://rate.bot.com.tw/xrt?redirect=true';
const BOT_CSV_URL = 'https://rate.bot.com.tw/xrt/flcsv/0/day';

function parseNumber(value) {
  if (value == null) return null;
  const text = String(value).trim();
  if (!text || text === '-') return null;
  const number = Number(text.replace(/,/g, ''));
  return Number.isFinite(number) ? number : null;
}

function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    const next = line[i + 1];

    if (ch === '"' && inQuotes && next === '"') {
      current += '"';
      i += 1;
    } else if (ch === '"') {
      inQuotes = !inQuotes;
    } else if (ch === ',' && !inQuotes) {
      result.push(current.trim().replace(/^"|"$/g, ''));
      current = '';
    } else {
      current += ch;
    }
  }

  result.push(current.trim().replace(/^"|"$/g, ''));
  return result;
}

function getTaipeiTimeString(date = new Date()) {
  return new Intl.DateTimeFormat('zh-TW', {
    timeZone: 'Asia/Taipei',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  }).format(date).replace(/\//g, '/');
}

function normalizeTaipeiQuoteTime(text) {
  if (!text) return '';
  const match = String(text).match(/(\d{4})\/(\d{1,2})\/(\d{1,2})\s+(\d{1,2}):(\d{2})(?::(\d{2}))?/);
  if (!match) return '';
  const [, y, m, d, hh, mm, ss = '00'] = match;
  return `${y}/${m.padStart(2, '0')}/${d.padStart(2, '0')} ${hh.padStart(2, '0')}:${mm}:${ss}`;
}

async function fetchOfficialQuoteTime() {
  try {
    const response = await fetch(`${BOT_PAGE_URL}&_=${Date.now()}`, {
      redirect: 'follow',
      headers: {
        'user-agent': 'Mozilla/5.0 fx-rate-bot'
      }
    });

    if (!response.ok) {
      console.warn(`BOT page fetch failed: ${response.status}`);
      return null;
    }

    const html = await response.text();

    const patterns = [
      /牌價最新掛牌時間\s*[：:]?\s*([0-9/]+\s+[0-9:]+)/,
      /最新掛牌時間\s*[：:]?\s*([0-9/]+\s+[0-9:]+)/,
      /掛牌時間\s*[：:]?\s*([0-9/]+\s+[0-9:]+)/,
      /(20\d{2}\/\d{1,2}\/\d{1,2}\s+\d{1,2}:\d{2}(?::\d{2})?)/
    ];

    for (const pattern of patterns) {
      const match = html.match(pattern);
      const quoteTime = normalizeTaipeiQuoteTime(match && match[1]);
      if (quoteTime) return quoteTime;
    }

    console.warn('Official quote time not found on BOT page. Using generated time as display time.');
    return null;
  } catch (error) {
    console.warn('BOT page quote time fetch skipped:', error.message);
    return null;
  }
}

async function fetchCsvText() {
  const response = await fetch(`${BOT_CSV_URL}?_=${Date.now()}`, {
    headers: {
      'user-agent': 'Mozilla/5.0 fx-rate-bot'
    }
  });

  if (!response.ok) {
    throw new Error(`BOT CSV fetch failed: ${response.status}`);
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  return buffer.toString('utf8').replace(/^\uFEFF/, '');
}

function parseBotCsv(text) {
  const lines = text.split(/\r?\n/).filter(line => line.trim());
  if (lines.length < 2) {
    throw new Error('BOT CSV is empty');
  }

  const details = {};

  for (let i = 1; i < lines.length; i += 1) {
    const cols = parseCSVLine(lines[i]);
    const code = cols[0];

    if (!/^[A-Z]{3}$/.test(code)) continue;

    const cashBuy = parseNumber(cols[2]);
    const spotBuy = parseNumber(cols[3]);
    const cashSell = parseNumber(cols[13]);
    const spotSell = parseNumber(cols[14]);

    details[code] = {
      cash: {
        buy: cashBuy,
        sell: cashSell
      },
      spot: {
        buy: spotBuy,
        sell: spotSell
      }
    };
  }

  if (!details.USD || details.USD.spot.buy == null || details.USD.spot.sell == null) {
    throw new Error('USD spot rate missing from BOT CSV');
  }

  return details;
}

function buildUsdBaseRates(details) {
  const rates = { USD: 1 };
  const usdMid = (details.USD.spot.buy + details.USD.spot.sell) / 2;
  rates.TWD = usdMid;

  for (const [code, detail] of Object.entries(details)) {
    if (code === 'USD') continue;

    const buy = detail.spot.buy ?? detail.cash.buy;
    const sell = detail.spot.sell ?? detail.cash.sell;

    if (buy != null && sell != null) {
      const twdPerUnit = (buy + sell) / 2;
      if (twdPerUnit > 0) {
        rates[code] = usdMid / twdPerUnit;
      }
    }
  }

  return rates;
}

function writeJsonToBothLocations(output) {
  const locations = [
    path.join(process.cwd(), 'rates', 'latest.json'),
    path.join(process.cwd(), 'public', 'rates', 'latest.json')
  ];

  for (const filePath of locations) {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, JSON.stringify(output, null, 2), 'utf8');
  }
}

async function main() {
  const [quoteTime, csvText] = await Promise.all([
    fetchOfficialQuoteTime(),
    fetchCsvText()
  ]);

  const details = parseBotCsv(csvText);
  const rates = buildUsdBaseRates(details);
  const generatedAt = new Date().toISOString();
  const generatedTaipeiTime = getTaipeiTimeString(new Date());

  const output = {
    source: '臺灣銀行牌告匯率',
    updateTime: quoteTime || generatedTaipeiTime,
    quoteTimeSource: quoteTime ? 'bot-page' : 'generated-time-fallback',
    generatedAt,
    details,
    rates
  };

  writeJsonToBothLocations(output);

  const usdMid = (details.USD.spot.buy + details.USD.spot.sell) / 2;
  console.log('FX rates updated');
  console.log('Quote time:', output.updateTime);
  console.log('Quote time source:', output.quoteTimeSource);
  console.log('Generated at:', output.generatedAt);
  console.log('USD spot:', details.USD.spot);
  console.log('USD mid:', usdMid);
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
