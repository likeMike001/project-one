#!/usr/bin/env python3
"""
wallet_inspector.py

Inspect a Sepolia wallet via RPC (e.g. Infura) and produce a JSON summary that’s
easy to feed into Claude.

Usage (from repo root):

    pip install web3 python-dotenv requests
    # create .env (see template below)
    python wallet_inspector.py 0xCAFeC001142ddb11124CD67b9F6a1db9eb0FA6a1

This will write:
    output/<wallet>_summary.json
"""

from __future__ import annotations

import argparse
import json
import logging
import os
from dataclasses import dataclass, asdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, List, Optional, Tuple
import time

import requests
from dotenv import load_dotenv
from web3 import Web3
from web3._utils.events import get_event_data

# ---------------------------------------------------------------------------
# Config / .env
# ---------------------------------------------------------------------------

ROOT = Path(__file__).resolve().parent
OUTPUT_DIR = ROOT / "output"
OUTPUT_DIR.mkdir(exist_ok=True)

load_dotenv(ROOT / ".env")  # if file not present, dotenv just does nothing

RPC_URL = os.getenv("RPC_URL", "").strip()
ETHERSCAN_API_KEY = os.getenv("ETHERSCAN_API_KEY", "").strip()
LOG_LOOKBACK_BLOCKS = int(os.getenv("LOG_LOOKBACK_BLOCKS", "20000"))
DEFAULT_MAX_EVENTS = int(os.getenv("MAX_EVENTS", "200"))
LOG_CHUNK_SIZE = int(os.getenv("LOG_CHUNK_SIZE", "2000"))
RPC_THROTTLE_SECONDS = float(os.getenv("RPC_THROTTLE_SECONDS", "0.25"))
VAULT_ADDRESSES_ENV = os.getenv("VAULT_ADDRESSES", "")

if RPC_URL == "":
    raise SystemExit("❌ RPC_URL is not set in .env")

# Normalize vault addresses (if any)
VAULT_ADDRESSES = set(
    a.strip().lower()
    for a in VAULT_ADDRESSES_ENV.split(",")
    if a.strip()
)

# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
)
logger = logging.getLogger("wallet_inspector")

# ---------------------------------------------------------------------------
# Web3 setup
# ---------------------------------------------------------------------------

w3 = Web3(Web3.HTTPProvider(RPC_URL))
if not w3.is_connected():
    raise SystemExit(f"❌ Could not connect to RPC node: {RPC_URL}")

chain_id = w3.eth.chain_id
logger.info("Connected to RPC: %s (chain_id=%s)", RPC_URL, chain_id)

# ---------------------------------------------------------------------------
# ERC-20 basics
# ---------------------------------------------------------------------------

ERC20_MIN_ABI = [
    {
        "constant": True,
        "inputs": [],
        "name": "symbol",
        "outputs": [{"name": "", "type": "string"}],
        "type": "function",
    },
    {
        "constant": True,
        "inputs": [],
        "name": "decimals",
        "outputs": [{"name": "", "type": "uint8"}],
        "type": "function",
    },
    {
        "constant": True,
        "inputs": [{"name": "_owner", "type": "address"}],
        "name": "balanceOf",
        "outputs": [{"name": "balance", "type": "uint256"}],
        "type": "function",
    },
]

TRANSFER_TOPIC = w3.keccak(text="Transfer(address,address,uint256)").hex()

ETHERSCAN_BASE = "https://api-sepolia.etherscan.io/api"


# ---------------------------------------------------------------------------
# Dataclasses for clean JSON
# ---------------------------------------------------------------------------

@dataclass
class TokenBalance:
    token_address: str
    symbol: str
    decimals: int
    balance: float


@dataclass
class TransferEvent:
    token_address: str
    symbol: str
    tx_hash: str
    block_number: int
    timestamp: str
    from_address: str
    to_address: str
    value_raw: str
    value_human: float


@dataclass
class StakingEvent:
    tx_hash: str
    timestamp: str
    token_symbol: str
    direction: str  # "deposit" or "withdraw"
    counterparty: str
    value_human: float
    confidence: float
    reason: str


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def checksum(addr: str) -> str:
    return Web3.to_checksum_address(addr)


def to_iso(ts: int) -> str:
    return datetime.fromtimestamp(ts, tz=timezone.utc).isoformat()


def get_block_timestamp(block_number: int) -> str:
    block = w3.eth.get_block(block_number)
    return to_iso(block["timestamp"])


def get_token_contract(address: str):
    return w3.eth.contract(address=checksum(address), abi=ERC20_MIN_ABI)


def safe_call(fn, default=None):
    try:
        return fn()
    except Exception:
        return default


def get_token_metadata(token_address: str) -> Tuple[str, int]:
    """Get (symbol, decimals) with best effort."""
    contract = get_token_contract(token_address)
    symbol = safe_call(contract.functions.symbol().call, default="UNKNOWN")
    decimals = safe_call(contract.functions.decimals().call, default=18)
    # If Etherscan key exists, try to enrich symbol
    if ETHERSCAN_API_KEY and symbol == "UNKNOWN":
        try:
            resp = requests.get(
                ETHERSCAN_BASE,
                params={
                    "module": "token",
                    "action": "tokeninfo",
                    "contractaddress": token_address,
                    "apikey": ETHERSCAN_API_KEY,
                },
                timeout=10,
            )
            data = resp.json()
            if data.get("status") == "1" and data.get("result"):
                info = data["result"][0]
                symbol = info.get("symbol", symbol) or symbol
        except Exception:
            pass
    return symbol, int(decimals)


def human_value(raw: int, decimals: int) -> float:
    return float(raw) / (10 ** decimals)


def chunk_range(start: int, end: int, step: int):
    current = start
    while current <= end:
        yield current, min(current + step - 1, end)
        current += step


# ---------------------------------------------------------------------------
# Core logic
# ---------------------------------------------------------------------------

def get_eth_balance(wallet: str) -> float:
    wei_balance = w3.eth.get_balance(checksum(wallet))
    return w3.from_wei(wei_balance, "ether")


def fetch_transfer_logs(wallet: str, lookback_blocks: int) -> List[Dict]:
    """Fetch ERC-20 Transfer logs involving this wallet."""
    wallet = wallet.lower()
    latest = w3.eth.block_number
    start_block = max(0, latest - lookback_blocks)
    logger.info("Fetching logs from blocks %s -> %s", start_block, latest)

    all_logs: List[Dict] = []

    # Chunk requests so we don't blow up provider limits
    for s, e in chunk_range(start_block, latest, LOG_CHUNK_SIZE):
        try:
            logs = w3.eth.get_logs(
                {
                    "fromBlock": hex(s),
                    "toBlock": hex(e),
                    "topics": [TRANSFER_TOPIC, None, None],
                }
            )
            # Filter by address presence in topics[1] or topics[2]
            for log in logs:
                topics = log["topics"]
                if len(topics) < 3:
                    continue
                from_addr = "0x" + topics[1].hex()[-40:]
                to_addr = "0x" + topics[2].hex()[-40:]
                if wallet in from_addr.lower() or wallet in to_addr.lower():
                    all_logs.append(log)
        except Exception as exc:
            logger.warning("Log fetch failed for %s-%s: %s", s, e, exc)
        finally:
            if RPC_THROTTLE_SECONDS > 0:
                time.sleep(RPC_THROTTLE_SECONDS)

    logger.info("Found %d relevant Transfer logs", len(all_logs))
    return all_logs


def decode_transfer_event(log: Dict) -> Optional[TransferEvent]:
    token_address = log["address"]
    try:
        contract = get_token_contract(token_address)
        abi_event = contract.events.Transfer._get_event_abi()
        decoded = get_event_data(w3.codec, abi_event, log)
        args = decoded["args"]
        symbol, decimals = get_token_metadata(token_address)
        value_raw = int(args["value"])
        value_h = human_value(value_raw, decimals)
        ts = get_block_timestamp(log["blockNumber"])
        return TransferEvent(
            token_address=Web3.to_checksum_address(token_address),
            symbol=symbol,
            tx_hash=decoded["transactionHash"].hex(),
            block_number=log["blockNumber"],
            timestamp=ts,
            from_address=args["from"],
            to_address=args["to"],
            value_raw=str(value_raw),
            value_human=value_h,
        )
    except Exception as exc:
        logger.debug("Failed to decode event for %s: %s", token_address, exc)
        return None


def build_token_balances(wallet: str, transfers: List[TransferEvent]) -> List[TokenBalance]:
    token_addresses = sorted({t.token_address for t in transfers})
    balances: List[TokenBalance] = []
    for addr in token_addresses:
        contract = get_token_contract(addr)
        symbol, decimals = get_token_metadata(addr)
        raw_balance = safe_call(lambda: contract.functions.balanceOf(checksum(wallet)).call(), default=0)
        balance = human_value(raw_balance, decimals)
        balances.append(
            TokenBalance(
                token_address=addr,
                symbol=symbol,
                decimals=decimals,
                balance=balance,
            )
        )
    return balances


def infer_staking_events(wallet: str, transfers: List[TransferEvent]) -> List[StakingEvent]:
    """Very simple heuristic: if transfer goes to a known vault -> deposit, from vault -> withdraw."""
    wallet_l = wallet.lower()
    events: List[StakingEvent] = []

    for t in transfers:
        from_l = t.from_address.lower()
        to_l = t.to_address.lower()
        direction = None
        counterparty = None
        confidence = 0.0
        reason = ""

        if VAULT_ADDRESSES:
            if wallet_l == from_l and to_l in VAULT_ADDRESSES:
                direction = "deposit"
                counterparty = t.to_address
                confidence = 0.9
                reason = "Transfer from user to known vault address."
            elif wallet_l == to_l and from_l in VAULT_ADDRESSES:
                direction = "withdraw"
                counterparty = t.from_address
                confidence = 0.9
                reason = "Transfer from known vault to user."
        # If no vaults configured, fall back to weaker heuristic
        if direction is None:
            # treat transfers to contracts (non-EOA) as possible deposits
            if wallet_l == from_l and not w3.eth.get_code(t.to_address):
                # actually EOA, so skip
                pass
            elif wallet_l == from_l:
                direction = "deposit"
                counterparty = t.to_address
                confidence = 0.4
                reason = "Transfer to contract (possible staking/vault)."
            elif wallet_l == to_l and w3.eth.get_code(t.from_address):
                direction = "withdraw"
                counterparty = t.from_address
                confidence = 0.4
                reason = "Transfer from contract (possible unstake/exit)."

        if direction:
            events.append(
                StakingEvent(
                    tx_hash=t.tx_hash,
                    timestamp=t.timestamp,
                    token_symbol=t.symbol,
                    direction=direction,
                    counterparty=counterparty or "",
                    value_human=t.value_human,
                    confidence=confidence,
                    reason=reason,
                )
            )

    return events


def build_summary(
    wallet: str,
    lookback_blocks: int,
    max_events: int,
) -> Dict:
    wallet = checksum(wallet)

    # ETH balance
    eth_balance = float(get_eth_balance(wallet))
    logger.info("ETH balance: %s", eth_balance)

    # Transfer logs -> decoded events
    raw_logs = fetch_transfer_logs(wallet, lookback_blocks)
    decoded: List[TransferEvent] = []
    for log in raw_logs:
        ev = decode_transfer_event(log)
        if ev:
            decoded.append(ev)

    decoded.sort(key=lambda e: e.block_number, reverse=True)
    recent_transfers = decoded[:max_events]

    # Token balances
    token_balances = build_token_balances(wallet, decoded)

    # Staking events
    staking_events = infer_staking_events(wallet, recent_transfers)

    # Summary text for Claude
    holdings_parts = [f"ETH: {eth_balance:.6f}"]
    for tb in token_balances:
        if tb.balance > 0:
            holdings_parts.append(f"{tb.symbol}: {tb.balance:.6f}")
    holdings_text = ", ".join(holdings_parts) if holdings_parts else "No balances detected."

    if recent_transfers:
        last = recent_transfers[0]
        recent_activity_text = (
            f"Last transfer on {last.timestamp}: "
            f"{last.value_human:.6f} {last.symbol} "
            f"from {last.from_address} to {last.to_address} "
            f"(tx {last.tx_hash})."
        )
    else:
        recent_activity_text = "No recent ERC-20 transfers in the lookback window."

    summary_for_claude = {
        "holdings_text": holdings_text,
        "recent_activity_text": recent_activity_text,
        "questions_for_claude": [
            "Explain the wallet holdings above in simple language.",
            "Given the user’s eETH/ETHFI balances and time in vaults, explain the trade-offs between holding, restaking, and unwinding positions.",
            "Combine this wallet context with the model’s ETH trend prediction to suggest whether the user should stake, restake, or de-risk.",
        ],
    }

    now_iso = datetime.now(timezone.utc).isoformat()

    return {
        "wallet": wallet,
        "rpc_url": RPC_URL,
        "network": "sepolia" if chain_id == 11155111 else f"unknown(chain_id={chain_id})",
        "chain_id": chain_id,
        "fetched_at": now_iso,
        "eth_balance": eth_balance,
        "tokens": [asdict(tb) for tb in token_balances],
        "recent_transfers": [asdict(ev) for ev in recent_transfers],
        "staking_events_inferred": [asdict(se) for se in staking_events],
        "summary_for_claude": summary_for_claude,
        "config": {
            "lookback_blocks": lookback_blocks,
            "max_events": max_events,
            "vault_addresses": list(VAULT_ADDRESSES),
        },
        "errors": [],
    }


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description="Inspect a Sepolia wallet and summarize balances/activity.")
    p.add_argument("wallet", help="Wallet address to inspect (0x...)")
    p.add_argument(
        "--lookback-blocks",
        type=int,
        default=LOG_LOOKBACK_BLOCKS,
        help=f"How many blocks to look back for logs (default {LOG_LOOKBACK_BLOCKS}).",
    )
    p.add_argument(
        "--max-events",
        type=int,
        default=DEFAULT_MAX_EVENTS,
        help=f"Maximum number of recent transfers to include (default {DEFAULT_MAX_EVENTS}).",
    )
    return p.parse_args()


def main():
    args = parse_args()
    wallet = args.wallet

    if not Web3.is_address(wallet):
        raise SystemExit(f"❌ {wallet} is not a valid Ethereum address")

    summary = build_summary(
        wallet=wallet,
        lookback_blocks=args.lookback_blocks,
        max_events=args.max_events,
    )

    out_path = OUTPUT_DIR / f"{wallet}_summary.json"
    with out_path.open("w") as f:
        json.dump(summary, f, indent=2)

    logger.info("Summary written to %s", out_path)
    print(json.dumps(summary["summary_for_claude"], indent=2))


if __name__ == "__main__":
    main()
