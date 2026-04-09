#!/usr/bin/env node
/**
 * Generate AI probability estimates using Claude + GPT
 * 
 * Requires ANTHROPIC_API_KEY environment variable
 * Usage: node generate-ai.js
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
const ANTHROPIC_API = 'https://api.anthropic.com/v1/messages';
const OPENAI_API = 'https://api.openai.com/v1/chat/completions';
const XAI_API = 'https://api.x.ai/v1/chat/completions';

// Check for API keys
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;
const OPENAI_KEY = process.env.OPENAI_API_KEY;
const XAI_KEY = process.env.XAI_API_KEY;

if (!ANTHROPIC_KEY) {
  console.error('Error: ANTHROPIC_API_KEY environment variable required');
  process.exit(1);
}

// Load market data
const marketsConfig = JSON.parse(
  fs.readFileSync(path.join(DATA_DIR, 'markets.json'), 'utf8')
);

const latestSnapshot = JSON.parse(
  fs.readFileSync(path.join(DATA_DIR, 'latest.json'), 'utf8')
);

async function askClaude(prompt) {
  const resp = await fetch(ANTHROPIC_API, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': ANTHROPIC_KEY,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }]
    })
  });
  
  if (!resp.ok) {
    const error = await resp.text();
    throw new Error(`Claude API error: ${resp.status} - ${error}`);
  }
  
  const data = await resp.json();
  return data.content[0].text;
}

async function askGPT(prompt) {
  if (!OPENAI_KEY) return null;
  
  const resp = await fetch(OPENAI_API, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${OPENAI_KEY}`
    },
    body: JSON.stringify({
      model: 'gpt-3.5-turbo',
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }]
    })
  });
  
  if (!resp.ok) {
    const error = await resp.text();
    throw new Error(`GPT API error: ${resp.status} - ${error}`);
  }
  
  const data = await resp.json();
  return data.choices[0].message.content;
}

async function askGrok(prompt) {
  if (!XAI_KEY) return null;
  
  const resp = await fetch(XAI_API, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${XAI_KEY}`
    },
    body: JSON.stringify({
      model: 'grok-3-mini',
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }]
    })
  });
  
  if (!resp.ok) {
    const error = await resp.text();
    throw new Error(`Grok API error: ${resp.status} - ${error}`);
  }
  
  const data = await resp.json();
  return data.choices[0].message.content;
}

async function generateAnalysis() {
  const today = new Date().toISOString().split('T')[0];
  
  const analysis = {
    generated_at: new Date().toISOString(),
    models: {
      claude: 'claude-sonnet-4-20250514',
      gpt: OPENAI_KEY ? 'gpt-3.5-turbo' : null,
      grok: XAI_KEY ? 'grok-3-mini' : null
    },
    markets: {}
  };
  
  console.log('🤖 Generating AI probability estimates...\n');
  const activeModels = ['Claude'];
  if (OPENAI_KEY) activeModels.push('GPT-3.5');
  if (XAI_KEY) activeModels.push('Grok');
  console.log(`   (Using: ${activeModels.join(' + ')})\n`);
  
  for (const market of marketsConfig.markets) {
    const marketData = latestSnapshot.markets[market.id];
    const kalshiProb = marketData?.sources?.kalshi?.probability;
    const polymarketProb = marketData?.sources?.polymarket?.probability;
    const manifoldProb = marketData?.sources?.manifold?.probability;
    
    // Build market context
    const marketContext = [];
    if (kalshiProb) marketContext.push(`Kalshi: ${kalshiProb}%`);
    if (polymarketProb) marketContext.push(`Polymarket: ${polymarketProb}%`);
    if (manifoldProb) marketContext.push(`Manifold: ${manifoldProb}%`);
    
    console.log(`📊 ${market.question}`);
    
    const prompt = `You are a professional forecaster. Estimate the probability of the following event.

Question: ${market.question}
Resolution date: ${market.resolution_date}
Today's date: ${today}

${marketContext.length > 0 ? `Current prediction market prices:\n${marketContext.join('\n')}` : ''}

Instructions:
1. Consider base rates, current events, and relevant factors
2. Give your probability estimate as a percentage (e.g., "45%")
3. Explain your reasoning in 2-3 sentences
4. If you disagree with the market consensus, explain why

Format your response as:
[PROBABILITY: XX%]
[REASONING: Your explanation here]`;

    const marketAnalysis = { claude: null, gpt: null, grok: null };
    
    // Ask Claude
    try {
      const response = await askClaude(prompt);
      const probMatch = response.match(/\[PROBABILITY:\s*(\d+)%\]/);
      const reasonMatch = response.match(/\[REASONING:\s*([\s\S]*?)(?:\]|$)/);
      
      marketAnalysis.claude = {
        probability: probMatch ? parseInt(probMatch[1]) : null,
        reasoning: reasonMatch ? reasonMatch[1].trim() : response
      };
      
      if (marketAnalysis.claude.probability !== null) {
        console.log(`   Claude: ${marketAnalysis.claude.probability}%`);
      }
    } catch (err) {
      console.log(`   Claude error: ${err.message}`);
      marketAnalysis.claude = { error: err.message };
    }
    
    // Ask GPT (if key available)
    if (OPENAI_KEY) {
      try {
        const response = await askGPT(prompt);
        const probMatch = response.match(/\[PROBABILITY:\s*(\d+)%\]/);
        const reasonMatch = response.match(/\[REASONING:\s*([\s\S]*?)(?:\]|$)/);
        
        marketAnalysis.gpt = {
          probability: probMatch ? parseInt(probMatch[1]) : null,
          reasoning: reasonMatch ? reasonMatch[1].trim() : response
        };
        
        if (marketAnalysis.gpt.probability !== null) {
          console.log(`   GPT-3.5: ${marketAnalysis.gpt.probability}%`);
        }
      } catch (err) {
        console.log(`   GPT error: ${err.message}`);
        marketAnalysis.gpt = { error: err.message };
      }
    }
    
    // Ask Grok (if key available)
    if (XAI_KEY) {
      try {
        const response = await askGrok(prompt);
        const probMatch = response.match(/\[PROBABILITY:\s*(\d+)%\]/);
        const reasonMatch = response.match(/\[REASONING:\s*([\s\S]*?)(?:\]|$)/);
        
        marketAnalysis.grok = {
          probability: probMatch ? parseInt(probMatch[1]) : null,
          reasoning: reasonMatch ? reasonMatch[1].trim() : response
        };
        
        if (marketAnalysis.grok.probability !== null) {
          console.log(`   Grok: ${marketAnalysis.grok.probability}%`);
        }
      } catch (err) {
        console.log(`   Grok error: ${err.message}`);
        marketAnalysis.grok = { error: err.message };
      }
    }
    
    // Combine into single entry (backwards compatible + new structure)
    analysis.markets[market.id] = {
      probability: marketAnalysis.claude?.probability,
      reasoning: marketAnalysis.claude?.reasoning,
      claude: marketAnalysis.claude,
      gpt: marketAnalysis.gpt,
      grok: marketAnalysis.grok
    };
    
    // Rate limiting
    await new Promise(r => setTimeout(r, 500));
  }
  
  // Save analysis
  const analysisPath = path.join(DATA_DIR, 'ai-analysis.json');
  fs.writeFileSync(analysisPath, JSON.stringify(analysis, null, 2));
  console.log(`\n✅ Saved AI analysis to ${analysisPath}`);
  
  return analysis;
}

// Calculate weighted composite
function calcComposite(sources) {
  const weights = { kalshi: 3, polymarket: 2, manifold: 1 };
  let totalWeight = 0;
  let weightedSum = 0;
  
  if (sources?.kalshi?.probability) {
    weightedSum += sources.kalshi.probability * weights.kalshi;
    totalWeight += weights.kalshi;
  }
  if (sources?.polymarket?.probability) {
    weightedSum += sources.polymarket.probability * weights.polymarket;
    totalWeight += weights.polymarket;
  }
  if (sources?.manifold?.probability) {
    weightedSum += sources.manifold.probability * weights.manifold;
    totalWeight += weights.manifold;
  }
  
  return totalWeight > 0 ? Math.round(weightedSum / totalWeight) : null;
}

function calculateDivergence(sources, ai) {
  if (!ai?.probability) return null;
  
  const composite = calcComposite(sources);
  if (composite === null) return null;
  
  const diff = ai.probability - composite;
  return {
    ai_vs_composite: diff,
    composite,
    significant: Math.abs(diff) >= 10
  };
}

// Create combined data file for the dashboard
async function createDashboardData() {
  const analysis = JSON.parse(
    fs.readFileSync(path.join(DATA_DIR, 'ai-analysis.json'), 'utf8')
  );
  
  const combined = {
    updated_at: new Date().toISOString(),
    categories: marketsConfig.categories,
    markets: []
  };
  
  for (const market of marketsConfig.markets) {
    const snapshot = latestSnapshot.markets[market.id];
    const ai = analysis.markets[market.id];
    
    combined.markets.push({
      id: market.id,
      question: market.question,
      category: market.category,
      resolution_date: market.resolution_date,
      kalshi: snapshot?.sources?.kalshi || null,
      polymarket: snapshot?.sources?.polymarket || null,
      manifold: snapshot?.sources?.manifold || null,
      ai: ai || null,
      divergence: calculateDivergence(snapshot?.sources, ai)
    });
  }
  
  const dashboardPath = path.join(DATA_DIR, 'dashboard.json');
  fs.writeFileSync(dashboardPath, JSON.stringify(combined, null, 2));
  console.log(`✅ Saved dashboard data to ${dashboardPath}`);
}

async function main() {
  await generateAnalysis();
  await createDashboardData();
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
