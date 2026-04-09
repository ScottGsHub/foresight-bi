# 🔮 ForesightBI — AI-Powered Prediction Intelligence

A dashboard that aggregates prediction markets and compares them to AI probability estimates, highlighting divergences for business intelligence.

## Features

- 📊 **Multi-Source Aggregation** — Pulls from Kalshi, Polymarket, and Manifold Markets
- 🤖 **Multi-AI Analysis** — Claude, GPT-3.5, and Grok generate independent probability estimates
- ⚖️ **Weighted Composite** — Real-money markets weighted higher (Kalshi 3x, Polymarket 2x, Manifold 1x)
- 📍 **Dot Strip Visualization** — See all estimates at a glance on a 0-100% scale
- ⚡ **Divergence Detection** — Highlights when AI consensus disagrees with market composite
- 📱 **Beautiful Dashboard** — Dark theme, responsive, no build step required

## Quick Start

### 1. Clone the repo

```bash
git clone https://github.com/ScottGsHub/foresight-bi.git
cd foresight-bi
```

### 2. Set up environment

```bash
cp .env.example .env
# Edit .env with your API keys
```

Required keys:
- `ANTHROPIC_API_KEY` — For Claude AI analysis
- `OPENAI_API_KEY` — For GPT analysis (optional)
- `XAI_API_KEY` — For Grok analysis (optional)

For Kalshi integration (optional), see the kalshi-bot setup for encrypted credential storage.

### 3. Fetch market data

```bash
node scripts/fetch-markets.js
```

### 4. Generate AI analysis

```bash
node scripts/generate-ai.js
```

### 5. Open the dashboard

Just open `index.html` in your browser, or serve locally:

```bash
npx http-server -p 8080
# Then visit http://localhost:8080
```

## Project Structure

```
foresight-bi/
├── data/
│   ├── markets.json        # Market definitions (edit to add/remove)
│   ├── latest.json         # Latest market snapshot
│   ├── ai-analysis.json    # AI probability estimates
│   ├── dashboard.json      # Combined data for frontend
│   └── snapshots/          # Historical data by date
├── scripts/
│   ├── fetch-markets.js    # Fetch from prediction markets
│   └── generate-ai.js      # Generate AI estimates
├── index.html              # Dashboard (single file, no build)
└── README.md
```

## Adding New Markets

Edit `data/markets.json`:

```json
{
  "id": "my-new-market",
  "question": "Will X happen by Y date?",
  "category": "macro",
  "resolution_date": "2026-12-31",
  "kalshi_ticker": "TICKER-NAME",
  "manifold_slug": "username/market-slug",
  "polymarket_slug": "event-slug",
  "polymarket_outcome": "Yes"
}
```

Use `null` for any platform that doesn't have a matching market. Then re-run the scripts.

## Data Sources

| Source | Type | Weight | Notes |
|--------|------|--------|-------|
| **Kalshi** | Real money | 3x | US-regulated, requires API credentials |
| **Polymarket** | Real money | 2x | Crypto-based, public API |
| **Manifold** | Play money | 1x | Free API, great coverage |

## AI Models

| Model | Provider | Notes |
|-------|----------|-------|
| **Claude** | Anthropic | Primary analysis, strong reasoning |
| **GPT-3.5** | OpenAI | Fast, good baseline |
| **Grok** | xAI | Alternative perspective |

## How It Works

1. **Fetch**: `fetch-markets.js` pulls prices from Kalshi, Polymarket, and Manifold
2. **Analyze**: `generate-ai.js` asks each AI for independent probability estimates
3. **Compare**: Dashboard shows dot strip (all estimates) and divergence bar (AI vs markets)
4. **Decide**: Use insights for research, strategy, or curiosity

## Interpreting the Dashboard

**Dot Strip Chart:**
- Filled dots = Market sources
- Hollow dots = AI models
- Clustered dots = Strong consensus
- Spread dots = Disagreement (potential opportunity)

**Divergence Bar:**
- Green (right) = AI more bullish than markets
- Red (left) = AI more bearish than markets
- Centered = AI and markets agree

## Why This Matters

Prediction markets aggregate crowd wisdom with skin in the game. AI provides independent analysis. When they disagree significantly, it could indicate:

- **Market inefficiency** — a trading opportunity
- **AI blind spot** — the crowd knows something AI doesn't
- **Information asymmetry** — worth investigating further

Neither is always right. The divergence itself is the insight.

## Troubleshooting

### "localhost refused to connect"

The server runs as a background process and may die when your terminal closes or the system cleans up idle processes.

**Quick fix:** Restart the server
```bash
cd /path/to/foresight-bi
npx http-server -p 8080 -c-1 &
```

**Permanent fixes:**

1. **Use tmux/screen** (keeps server alive after terminal closes)
   ```bash
   tmux new -s foresight
   cd /path/to/foresight-bi && npx http-server -p 8080
   # Press Ctrl+B, then D to detach
   # Reattach later with: tmux attach -t foresight
   ```

2. **Use systemd** (auto-starts on boot)
   ```bash
   # Create /etc/systemd/system/foresight.service
   # Then: sudo systemctl enable --now foresight
   ```

3. **Just open the file directly** (no server needed for basic viewing)
   ```bash
   # Open index.html in your browser directly
   # Note: Some features may not work due to CORS
   ```

## Limitations

- Market coverage varies — not every question has matches on all platforms
- AI estimates are based on training data cutoffs
- Polymarket may be geo-restricted in some regions
- This is not financial advice

## Future Plans

- [ ] Track accuracy over time (who was right?)
- [ ] Add more markets and categories
- [ ] Email/notification alerts for big divergences
- [ ] Historical divergence trends
- [ ] Scenario explorer (if X, then Y)

## License

MIT — do whatever you want with it.

---

Built with ❤️ using [Kalshi](https://kalshi.com), [Polymarket](https://polymarket.com), [Manifold](https://manifold.markets) + [Claude](https://anthropic.com), [GPT](https://openai.com), [Grok](https://x.ai)
