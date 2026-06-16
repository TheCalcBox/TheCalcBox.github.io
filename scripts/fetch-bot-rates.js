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

function normalizeTaipeiQuoteTime(text) {
  if (!text) return '';
  const match = String(text).match(/(\d{4})\/(\d{1,2})\/(\d{1,2})\s+(\d{1,2}):(\d{2})(?::(\d{2}))?/);
  if (!match) return '';
  const [, y, m, d, hh, mm, ss = '00'] = match;
  return `${y}/${m.padStart(2, '0')}/${d.padStart(2, '0')} ${hh.padStart(2, '0')}:${mm}:${ss}`;
}

async function fetchOfficialQuoteTime() {
  const response = await fetch(`${BOT_PAGE_URL}&_=${Date.now()}`, {
    redirect: 'follow'
  });

  if (!response.ok) {
    throw new Error(`BOT page fetch failed: ${response.status}`);
  }

  const html = await response.text();
  const match = html.match(/牌價最新掛牌時間\s*[：:]\s*([0-9/]+\s+[0-9:]+)/);
  const quoteTime = normalizeTaipeiQuoteTime(match && match[1]);

  if (!quoteTime) {
    throw new Error('Official quote time not found on BOT page');
  }

  return quoteTime;
}

async function fetchCsvText() {
  const response = await fetch(`${BOT_CSV_URL}?_=${Date.now()}`);

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

    // BOT CSV columns used here:
    // 0 currency code
    // 2 cash buy
    // 3 spot buy
    // 13 cash sell
    // 14 spot sell
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

  const output = {
    source: '臺灣銀行牌告匯率',
    updateTime: quoteTime,
    generatedAt,
    details,
    rates
  };

  writeJsonToBothLocations(output);

  const usdMid = (details.USD.spot.buy + details.USD.spot.sell) / 2;
  console.log('FX rates updated');
  console.log('BOT quote time:', output.updateTime);
  console.log('Generated at:', output.generatedAt);
  console.log('USD spot:', details.USD.spot);
  console.log('USD mid:', usdMid);
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
