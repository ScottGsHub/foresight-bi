# 🔮 ForesightBI — AI-Powered Prediction Intelligence

A dashboard that aggregates prediction markets and compares them to AI probability estimates, highlighting divergences for business intelligence.

![Dashboard Preview](preview.png)

## Features

- 📊 **Multi-Source Aggregation** — Pulls from Manifold Markets (Kalshi, Polymarket coming)
- 🤖 **AI Analysis** — Claude generates independent probability estimates with reasoning
- ⚡ **Divergence Detection** — Highlights when AI disagrees with market consensus by 10%+
- 🎯 **Business Focus** — Curated questions relevant to business decisions
- 📱 **Beautiful Dashboard** — Dark theme, responsive, no build step required

## Quick Start

### 1. Clone the repo

```bash
git clone https://github.com/ScottGsHub/foresight-bi.git
cd foresight-bi
```

### 2. Fetch market data

```bash
node scripts/fetch-markets.js
```

### 3. Generate AI analysis (requires Anthropic API key)

```bash
ANTHROPIC_API_KEY=sk-ant-... node scripts/generate-ai.js
```

### 4. Open the dashboard

Just open `index.html` in your browser — no server needed!

Or serve it locally:
```bash
npx serve .
# or
python -m http.server 8000
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
  "manifold_search": "search terms for Manifold"
}
```

Then re-run the scripts.

## Categories

- **macro** — Inflation, rates, recession, GDP
- **tech** — AI regulation, tech company events
- **crypto** — Bitcoin, Ethereum, regulation
- **politics** — Elections, policy
- **markets** — S&P 500, commodities

## How It Works

1. **Fetch**: `fetch-markets.js` searches Manifold for each question and extracts probabilities
2. **Analyze**: `generate-ai.js` asks Claude for independent probability estimates
3. **Compare**: The dashboard shows both side-by-side and flags divergences
4. **Decide**: Use insights for business strategy, hedging, or curiosity

## Why This Matters

Prediction markets aggregate crowd wisdom. AI provides independent analysis. When they disagree significantly, it could indicate:

- **Market inefficiency** — an opportunity
- **AI blind spot** — the crowd knows something AI doesn't
- **Information asymmetry** — worth investigating further

Neither is always right. The divergence itself is the insight.

## Limitations

- Manifold is mostly play money — prices may be less reliable than real-money markets
- AI probability estimates are based on training data cutoff
- This is not financial advice

## Future Plans

- [ ] Add Kalshi integration
- [ ] Add Polymarket integration  
- [ ] Track accuracy over time (who was right?)
- [ ] Scenario explorer (if X, then Y)
- [ ] Migrate to Supabase for real-time updates
- [ ] Email/notification alerts for big divergences

## License

MIT — do whatever you want with it.

---

Built with ❤️ using [Manifold Markets API](https://docs.manifold.markets/api) + [Claude AI](https://anthropic.com)
