#!/usr/bin/env node
/**
 * Fetch prediction market data using manual market IDs
 * Saves snapshot to data/snapshots/YYYY-MM-DD.json
 */

const fs = require('fs');
const path = require('path');

// Load .env file if present
const envPath = path.join(__dirname, '..', '.env');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  envContent.split('\n').forEach(line => {
    const [key, ...val] = line.split('=');
    if (key && !key.startsWith('#')) {
      process.env[key.trim()] = val.join('=').trim();
    }
  });
}

const DATA_DIR = path.join(__dirname, '..', 'data');
const MANIFOLD_API = 'https://api.manifold.markets/v0';
const POLYMARKET_API = 'https://gamma-api.polymarket.com';
const KALSHI_API = 'https://api.elections.kalshi.com';

// Kalshi credentials (loaded from kalshi-bot)
let kalshiKeyId = null;
let kalshiPrivateKey = null;

async function loadKalshiCredentials() {
  try {
    const crypto = require('crypto');
    const kalshiBotPath = path.join(__dirname, '..', '..', 'kalshi-bot');
    const Database = require(path.join(kalshiBotPath, 'node_modules', 'better-sqlite3'));
    
    const kalshiEnvPath = path.join(kalshiBotPath, '.env');
    if (fs.existsSync(kalshiEnvPath)) {
      const envContent = fs.readFileSync(kalshiEnvPath, 'utf8');
      envContent.split('\n').forEach(line => {
        const [key, ...val] = line.split('=');
        if (key && !key.startsWith('#')) {
          process.env[key.trim()] = val.join('=').trim();
        }
      });
    }
    
    const MASTER_KEY = process.env.LOCAL_MASTER_KEY;
    if (!MASTER_KEY) return false;
    
    function getMasterKey() {
      return crypto.createHash('sha256').update(MASTER_KEY).digest();
    }
    
    function decrypt(payload) {
      const b = Buffer.from(payload, 'base64');
      const iv = b.subarray(0, 12);
      const tag = b.subarray(12, 28);
      const data = b.subarray(28);
      const key = getMasterKey();
      const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
      decipher.setAuthTag(tag);
      return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
    }
    
    const dbPath = path.join(kalshiBotPath, 'bot.sqlite');
    const db = new Database(dbPath, { readonly: true });
    
    const secretRow = db.prepare('SELECT encrypted_value FROM secrets WHERE name = ?').get('KALSHI_PRIVATE_KEY_PEM');
    const configRow = db.prepare('SELECT value FROM settings WHERE key = ?').get('bot.config');
    db.close();
    
    const config = configRow ? JSON.parse(configRow.value) : {};
    kalshiKeyId = config.extraKalshiKeyId;
    kalshiPrivateKey = decrypt(secretRow.encrypted_value);
    
    return true;
  } catch (err) {
    console.log('   Note: Could not load Kalshi credentials:', err.message);
    return false;
  }
}

function signKalshiRequest(timestampMs, method, pathWithQuery) {
  const crypto = require('crypto');
  const payload = `${timestampMs}${method.toUpperCase()}${pathWithQuery}`;
  const signature = crypto.sign('sha256', Buffer.from(payload, 'utf8'), {
    key: kalshiPrivateKey,
    padding: crypto.constants.RSA_PKCS1_PSS_PADDING,
    saltLength: crypto.constants.RSA_PSS_SALTLEN_DIGEST
  });
  return signature.toString('base64');
}

// Load market definitions
const marketsConfig = JSON.parse(
  fs.readFileSync(path.join(DATA_DIR, 'markets.json'), 'utf8')
);

// ============ KALSHI ============
async function getKalshiMarket(ticker) {
  if (!kalshiKeyId || !kalshiPrivateKey) return null;
  
  const timestampMs = String(Date.now());
  const endpoint = `/trade-api/v2/markets/${ticker}`;
  const signature = signKalshiRequest(timestampMs, 'GET', endpoint);
  
  const resp = await fetch(`${KALSHI_API}${endpoint}`, {
    headers: {
      'Accept': 'application/json',
      'KALSHI-ACCESS-KEY': kalshiKeyId,
      'KALSHI-ACCESS-TIMESTAMP': timestampMs,
      'KALSHI-ACCESS-SIGNATURE': signature
    }
  });
  
  if (!resp.ok) return null;
  const data = await resp.json();
  return data.market;
}

// ============ MANIFOLD ============
async function getManifoldBySlug(slug) {
  const url = `${MANIFOLD_API}/slug/${slug}`;
  const resp = await fetch(url);
  if (!resp.ok) return null;
  return resp.json();
}

// ============ POLYMARKET ============
async function getPolymarketBySlug(slug, targetOutcome = null) {
  // First get the event
  const url = `${POLYMARKET_API}/events?slug=${slug}`;
  const resp = await fetch(url);
  if (!resp.ok) return null;
  
  const events = await resp.json();
  if (!events || events.length === 0) return null;
  
  const event = events[0];
  
  // If it's a multi-market event, find the right one
  if (event.markets && event.markets.length > 0) {
    // If targetOutcome specified, find matching market
    if (targetOutcome) {
      const market = event.markets.find(m => 
        m.question.toLowerCase().includes(targetOutcome.toLowerCase()) ||
        m.groupItemTitle?.toLowerCase().includes(targetOutcome.toLowerCase())
      );
      if (market) {
        return {
          ...market,
          eventSlug: slug,
          eventTitle: event.title
        };
      }
    }
    // Otherwise return first/main market
    return {
      ...event.markets[0],
      eventSlug: slug,
      eventTitle: event.title
    };
  }
  
  return event;
}

async function fetchAllMarkets() {
  const snapshot = {
    timestamp: new Date().toISOString(),
    markets: {}
  };
  
  console.log('Fetching prediction market data...\n');
  
  // Try to load Kalshi credentials
  const hasKalshi = await loadKalshiCredentials();
  if (hasKalshi) {
    console.log('✓ Kalshi credentials loaded\n');
  }
  
  for (const market of marketsConfig.markets) {
    console.log(`📊 ${market.question}`);
    
    const data = {
      id: market.id,
      question: market.question,
      category: market.category,
      sources: {}
    };
    
    // ============ KALSHI ============
    if (market.kalshi_ticker && kalshiKeyId) {
      try {
        const kalshiMarket = await getKalshiMarket(market.kalshi_ticker);
        if (kalshiMarket) {
          const yesBid = parseFloat(kalshiMarket.yes_bid_dollars) * 100;
          const yesAsk = parseFloat(kalshiMarket.yes_ask_dollars) * 100;
          const midPrice = (yesBid + yesAsk) / 2;
          
          data.sources.kalshi = {
            probability: Math.round(midPrice),
            ticker: market.kalshi_ticker,
            title: kalshiMarket.title,
            url: `https://kalshi.com/markets/${kalshiMarket.ticker}`,
            volume: Math.round(parseFloat(kalshiMarket.volume_fp || 0))
          };
          console.log(`   ✅ Kalshi: ${data.sources.kalshi.probability}% (${data.sources.kalshi.volume} contracts)`);
        } else {
          console.log(`   ⚠️  Kalshi: Market not found`);
        }
      } catch (err) {
        console.log(`   ❌ Kalshi: Error - ${err.message}`);
      }
    }
    
    // ============ MANIFOLD ============
    if (market.manifold_slug) {
      try {
        const manifoldMarket = await getManifoldBySlug(market.manifold_slug);
        if (manifoldMarket && !manifoldMarket.isResolved) {
          // Handle multi-answer markets
          let probability = null;
          if (manifoldMarket.outcomeType === 'BINARY') {
            probability = Math.round(manifoldMarket.probability * 100);
          } else if (manifoldMarket.outcomeType === 'MULTIPLE_CHOICE' && manifoldMarket.answers) {
            // For multi-choice, look for relevant answer
            const yesAnswer = manifoldMarket.answers.find(a => 
              a.text.toLowerCase().includes('yes') || 
              a.text.toLowerCase().includes('100k') ||
              a.text.toLowerCase().includes('$100')
            );
            if (yesAnswer) {
              probability = Math.round(yesAnswer.probability * 100);
            }
          }
          
          if (probability !== null) {
            data.sources.manifold = {
              probability,
              question: manifoldMarket.question,
              url: manifoldMarket.url,
              volume: Math.round(manifoldMarket.volume || 0),
              traders: manifoldMarket.uniqueBettorCount || 0
            };
            console.log(`   ✅ Manifold: ${probability}% (${data.sources.manifold.traders} traders)`);
          } else {
            console.log(`   ⚠️  Manifold: Couldn't extract probability`);
          }
        } else if (manifoldMarket?.isResolved) {
          console.log(`   ⚠️  Manifold: Market already resolved`);
        } else {
          console.log(`   ⚠️  Manifold: Market not found`);
        }
      } catch (err) {
        console.log(`   ❌ Manifold: Error - ${err.message}`);
      }
    }
    
    // ============ POLYMARKET ============
    if (market.polymarket_slug) {
      try {
        const polyMarket = await getPolymarketBySlug(market.polymarket_slug, market.polymarket_outcome);
        if (polyMarket && !polyMarket.closed) {
          let yesPrice = null;
          
          // Parse outcome prices
          if (polyMarket.outcomePrices) {
            try {
              const prices = JSON.parse(polyMarket.outcomePrices);
              yesPrice = parseFloat(prices[0]);
            } catch (e) {}
          }
          
          if (yesPrice !== null) {
            data.sources.polymarket = {
              probability: Math.round(yesPrice * 100),
              question: polyMarket.question || polyMarket.eventTitle,
              url: `https://polymarket.com/event/${market.polymarket_slug}`,
              volume: Math.round(polyMarket.volumeNum || 0),
              liquidity: Math.round(polyMarket.liquidityNum || 0)
            };
            console.log(`   ✅ Polymarket: ${data.sources.polymarket.probability}% ($${data.sources.polymarket.volume.toLocaleString()} volume)`);
          } else {
            console.log(`   ⚠️  Polymarket: Couldn't extract price`);
          }
        } else if (polyMarket?.closed) {
          console.log(`   ⚠️  Polymarket: Market closed`);
        } else {
          console.log(`   ⚠️  Polymarket: Market not found`);
        }
      } catch (err) {
        console.log(`   ❌ Polymarket: Error - ${err.message}`);
      }
    }
    
    snapshot.markets[market.id] = data;
    
    // Rate limiting - be nice to the APIs
    await new Promise(r => setTimeout(r, 300));
  }
  
  return snapshot;
}

async function main() {
  try {
    const snapshot = await fetchAllMarkets();
    
    // Save snapshot
    const today = new Date().toISOString().split('T')[0];
    const snapshotsDir = path.join(DATA_DIR, 'snapshots');
    if (!fs.existsSync(snapshotsDir)) {
      fs.mkdirSync(snapshotsDir, { recursive: true });
    }
    const snapshotPath = path.join(snapshotsDir, `${today}.json`);
    
    fs.writeFileSync(snapshotPath, JSON.stringify(snapshot, null, 2));
    console.log(`\n✅ Saved snapshot to ${snapshotPath}`);
    
    // Also save as "latest" for easy access
    const latestPath = path.join(DATA_DIR, 'latest.json');
    fs.writeFileSync(latestPath, JSON.stringify(snapshot, null, 2));
    console.log(`✅ Saved latest to ${latestPath}`);
    
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
}

main();
