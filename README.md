# Stake-Inspector

Trust-aware Ethereum staking copilot that blends quant signals, semantic news intelligence, and dataset integrity proofs into a single experience. The stack couples a Next.js dashboard, FastAPI model services, on-chain wallet inspection, and a lightweight trust layer so every recommendation is explainable and auditable.

## Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Repository Layout](#repository-layout)
- [Prerequisites](#prerequisites)
- [Environment Configuration](#environment-configuration)
- [Setup](#setup)
- [Running the Stack](#running-the-stack)
- [Data & Modeling Workflow](#data--modeling-workflow)
- [Wallet Intelligence Pipeline](#wallet-intelligence-pipeline)
- [Trust Proofs & Governance](#trust-proofs--governance)
- [Troubleshooting & Tips](#troubleshooting--tips)

## Overview

- Slider-driven UI lets operators bias recommendations toward _price precision_ or _semantic narratives_ and immediately see the action stack (stake / restake / liquid stake), EtherFi cluster regime, and Claude-authored commentary.
- Model Signal Service (FastAPI) loads trained RandomForest and clustering artifacts, merges wallet telemetry, and optionally routes summaries through Anthropic for natural-language narratives.
- Trust Layer keeps a registry of dataset hashes plus simulated EigenLayer attestations and Schnorr-style ZK proofs, exposing them to the dashboard for live integrity status.
- Synthetic news + FinBERT enrichment rounds out the dataset so ML models can learn how sentiment interacts with ETH staking flows.
- Wallet Inspector utility snapshots balances, transfers, and staking-related activity so personalized context can be piped into the inference service.

## Architecture

### Front-end (`front-end/`)
- Next.js 16 app (React 19 + Tailwind 4) rendering animated panels (`HeroSection`, `FocusControls`, `ActionStackCard`, `TrustVerificationPanel`, etc.).
- Reads `NEXT_PUBLIC_TRUST_API_URL` (default `http://localhost:8000`) and `NEXT_PUBLIC_MODEL_API_URL` (default `http://localhost:8001`). Demo mode can be toggled via `NEXT_PUBLIC_DEMO_SIGNALS` and `NEXT_PUBLIC_DEMO_WEIGHT`.
- Displays:
  - Slider-weighted recommendations and cluster insights from `/signals`.
  - Claude narrative + wallet summary when a wallet address is supplied.
  - Dataset verification cards fed by `/trust/datasets`.
  - Mock price projection, sentiment charts, and pipeline preview for ambient context.

### Model Signal Service (`service/model_signal_service.py`)
- FastAPI app with `POST /signals` and `GET /health`.
- Loads `artifacts/random_forest_model.pkl`, `etherfi_clusterer.pkl`, and `etherfi_clusters.pkl` to serve realtime recommendations.
- Accepts optional wallet hints, fetches wallet snapshots (via `wallet_snapshot.py` helper) when RPC + Etherscan credentials are configured, and synthesizes user-facing narratives (Claude Sonnet if `CLAUDE_API_KEY` is present, otherwise fallback text).
- Environment switches include `WALLET_LOOKBACK_BLOCKS`, `WALLET_MAX_EVENTS`, RPC throttling values, and tracked staking contracts.

### Trust Verification Layer (`trust_layer/`)
- FastAPI microservice that hashes every dataset / artifact listed in `trust_layer/config.py` and stores metadata in `trust_proofs.json`.
- Endpoints:
  - `GET /trust/datasets` -> cached registry consumed by the dashboard.
  - `POST /trust/verify` -> recompute hashes + Schnorr proofs and refresh registry.
  - `GET /health` -> uptime check.
- Uses deterministic Schnorr-on-BN254 simulation and placeholder EigenLayer attestations so UI can surface "verified" status even before full integrations.

### Modeling (`model/`) and Artifacts (`artifacts/`)
- `random_forest_model.py` trains RandomForest (and optional XGBoost) models over `data/final_with_sentiment.csv`, re-weighting semantic vs price features via `FocusConfig` (the same weights exposed by the UI slider).
- `clustering.py` groups EtherFi daily snapshots into behavioral regimes, exports both the KMeans pipeline and labeled dataframe.
- `finbert_embedder.py` fuses ETH staking metrics with FinBERT-embedded synthetic news to build `data/final_with_sentiment.csv`.
- Resulting pickles are stored under `artifacts/` and are loaded by the Model Signal Service.

### Synthetic News Service (`service/synthetic_news_service.py`)
- Optional FastAPI endpoint (`POST /generate_news_csv`) that asks Claude to emit Bloomberg / Reuters-style ETH staking stories as CSV, saves them under `data/`, and returns the raw CSV for inspection.

### Wallet & VR Utilities
- `wallet_inspector.py` pulls ETH balances, ERC-20 transfers, and inferred staking events using Infura (or compatible) RPC + Etherscan API, emitting JSON snapshots for both CLI use and service ingestion.
- `vr-layer/` contains quick scripts for VR/data-viz integrations (news extraction, price polling). These are standalone utilities but share the same data lake in `data/`.

## Repository Layout

| Path | Purpose |
| --- | --- |
| `front-end/` | Next.js dashboard (see `app/components/*.tsx`). |
| `service/model_signal_service.py` | Main FastAPI service powering the slider + wallet flow. |
| `service/synthetic_news_service.py` | Claude-backed synthetic news generator. |
| `trust_layer/` | Dataset hashing + proof service (`api.py`, `verification.py`, `config.py`). |
| `model/` | Training scripts, FinBERT enrichment, clustering utilities, and requirements. |
| `artifacts/` | Serialized model + clustering pickles consumed at runtime. |
| `data/` | Final datasets, synthetic news CSVs, wallet samples. |
| `datasets/` | Raw EtherFi CSV inputs referenced by the trust layer. |
| `wallet_inspector.py` | CLI to capture wallet telemetry used inside `/signals`. |
| `vr-layer/` | Experimental VR/data sourcing scripts (news + price fetchers). |

## Prerequisites

- Python 3.11+ (virtual environment recommended).
- Node.js 18+ with npm (or pnpm / yarn / bun) for the Next.js app.
- pip packages: `fastapi`, `uvicorn`, `anthropic`, `python-dotenv`, `web3`, `requests`, plus everything in `model/requirements.txt` and `trust_layer/requirements.txt`.
- Access tokens for third-party APIs you plan to use (Infura RPC, Etherscan, CoinGecko, Anthropic Claude, GNews, etc.).

## Environment Configuration

Create a `.env` file in the repo root 

```bash
CLAUDE_API_KEY=sk-...
RPC_URL=https://mainnet.infura.io/v3/<project-id>
ETHERSCAN_API_KEY=<key>
GNEWS_API_KEY=<key>
COINGECKO_BASE_URL=https://api.coingecko.com/api/v3/simple/price
COIN_GECKO=<key>
TRACKED_TOKEN_CONTRACTS=addr|symbol|decimals,addr|symbol|decimals
STAKING_CONTRACTS=0x...,0x...
LOG_LOOKBACK_BLOCKS=50000
LOG_CHUNK_SIZE=1500
WALLET_LOOKBACK_BLOCKS=75000
WALLET_MAX_EVENTS=150
```

Front-end specific variables:

```bash
NEXT_PUBLIC_TRUST_API_URL=http://localhost:8000
NEXT_PUBLIC_MODEL_API_URL=http://localhost:8001
NEXT_PUBLIC_DEMO_SIGNALS=false
NEXT_PUBLIC_DEMO_WEIGHT=65
```

Keep provider keys scoped (test vs prod) and rotate them regularly since they will be used both by CLI scripts (`wallet_inspector.py`) and the FastAPI services.

## Setup

```bash
# 1. Python environment
cd project-one
python -m venv .venv
. .\.venv\Scripts\activate          # Windows PowerShell
pip install --upgrade pip
pip install -r model/requirements.txt -r trust_layer/requirements.txt
pip install fastapi uvicorn anthropic python-dotenv web3 requests

# 2. Front-end deps
cd front-end
npm install
```

If you plan to run the VR utilities or extra scripts, also install `vr-layer/requirements.txt` in the same environment (`pip install -r vr-layer/requirements.txt`). GPU builds of PyTorch are optional; CPU wheels are sufficient for the provided dataset sizes.

## Running the Stack

### 1. Trust Verification API (port 8000)
```bash
cd project-one
uvicorn trust_layer.api:app --reload --port 8000
```
Verify with: `curl http://localhost:8000/trust/datasets`.

### 2. Model Signal Service (port 8001)
```bash
uvicorn service.model_signal_service:app --reload --port 8001
```
Health check: `curl http://localhost:8001/health`.  
`POST /signals` payload example:
```bash
curl -X POST http://localhost:8001/signals \
  -H "Content-Type: application/json" \
  -d '{"price_weight":0.65,"wallet":"0xf0bb...416c"}'
```

### 3. Optional Synthetic News Service (port 8002)
```bash
uvicorn service.synthetic_news_service:app --reload --port 8002
```
Call `POST /generate_news_csv` with `{"topic":"EtherFi Restaking","num_articles":12}` to mint a CSV under `data/`.

### 4. Next.js Dashboard (port 3000)
```bash
cd front-end
npm run dev
```
Open `http://localhost:3000`. The UI will poll `/trust/datasets` and `/signals` automatically; you can toggle demo mode by setting `NEXT_PUBLIC_DEMO_SIGNALS=true` before starting the dev server.

Run all four processes concurrently (different terminals or a process manager such as `tmux`, `taskspooler`, or `npm-run-all`).

## Data & Modeling Workflow

1. **Generate / ingest news**  
   - Run `uvicorn service.synthetic_news_service:app ...` and hit `/generate_news_csv` _or_ drop your own CSV in `data/`.
2. **Apply FinBERT sentiment + merge with ETH metrics**  
   - `python model/finbert_embedder.py` -> writes `data/final_with_sentiment.csv`.
3. **Train models**  
   - `python model/random_forest_model.py` to fit RandomForest (and optional XGBoost) artifacts keyed to the slider bias. Artifacts land in `artifacts/random_forest_model.pkl`.
4. **Cluster EtherFi regimes**  
   - `python model/clustering.py --clusters 3` -> saves `artifacts/etherfi_clusterer.pkl` and `artifacts/etherfi_clusters.pkl`.
5. **Refresh trust proofs**  
   - `python -m trust_layer.generate_proofs` (or `POST /trust/verify`) after any CSV/artifact changes so hashes stay in sync with the UI.
6. **Restart services** so the FastAPI runtime reloads fresh pickles.

The provided `artifacts/` directory already contains baseline pickles, so you can boot the stack immediately and retrain later when experimenting with new data.

## Wallet Intelligence Pipeline

- Script entrypoint: `python wallet_inspector.py 0xYourWallet --lookback-blocks 75000 --max-events 150 --out data/wallet_samples/sample.json`.
- Requires `RPC_URL`, `ETHERSCAN_API_KEY`, token contract hints (`TRACKED_TOKEN_CONTRACTS`), and staking contracts of interest (`STAKING_CONTRACTS`) to score deposits/withdrawals.
- Model Signal Service imports the module (`wallet_snapshot` alias) and, when a wallet address is provided in `/signals`, will fetch the summary, attach token balances + inferred staking events, and feed that context to Claude for narrative generation.
- To experiment offline, set `payload.wallet` in `POST /signals` to a known address and watch the `wallet_summary` block returned in the JSON response.

## Trust Proofs & Governance

- Datasets listed in `trust_layer/config.py` include the main EtherFi CSVs (`datasets/*.csv`), merged sentiment dataset (`data/final_with_sentiment.csv`), and generated news exports.
- `trust_layer/trust_proofs.json` is committed by default for demo purposes; regenerate it whenever you update inputs so the dashboard reflects the latest `sha256`, sizes, and simulated ZK proofs.
- Extend the trust list by appending new entries to `DATASETS` and rerunning `python -m trust_layer.generate_proofs`.
- Future integrations (EigenLayer attestations, verifiable ML artifacts) can follow the same pattern-declare in `config.py`, point to the artifact, and render in the UI.

## Troubleshooting & Tips

- **Artifacts missing**: `/signals` will return `503` until `artifacts/random_forest_model.pkl` and `artifacts/etherfi_clusterer.pkl` exist. Retrain or copy baseline files into `artifacts/`.
- **Claude narrative disabled**: if `CLAUDE_API_KEY` is absent the service prints `[claude] Narrative generation disabled` and falls back to deterministic copy-expected behavior.
- **Wallet snapshot failures**: check RPC/Explorer quotas and throttle via `RPC_THROTTLE_SECONDS` and `LOG_CHUNK_SIZE`. You can also set `wallet` to `""` to skip wallet enrichment entirely.
- **Front-end cannot reach APIs**: ensure CORS is open (already `allow_origins=["*"]`) and the `NEXT_PUBLIC_*` URLs match the ports you chose when launching the FastAPI apps.
- **Dependencies on Windows**: install `torch` wheels that match your Python version (`pip install torch --index-url https://download.pytorch.org/whl/cpu`) if the default install fails.
- **Linting**: run `npm run lint` inside `front-end/` for UI code and consider `ruff`/`black` for Python modules if you add new scripts.

---
Made with love for the Claude Hackathon - extend it with your own data sources, EigenLayer attestations, or VR renderers by dropping new modules under the existing structure.
