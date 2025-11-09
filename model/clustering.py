"""
Simple clustering utility for EtherFi staking health snapshots.

This script loads ``etherfi_combined_labeled.csv`` (the dataset provided in
this directory), imputes missing values, and runs a lightweight clustering
algorithm that groups days with similar staking / liquidity behavior.

Clusters can then be interpreted downstream as:

    * stake-baseline days      → balanced flows & stable APRs
    * restake-style days       → strong deposits, rising APR expectations
    * liquid-stake-style days  → net withdrawals, falling APR expectations

Usage (from repo root):

    python -m project-one.model.clustering --clusters 3
"""

from __future__ import annotations

import argparse
import pickle
from dataclasses import dataclass
from pathlib import Path
from typing import List, Sequence

import numpy as np
import pandas as pd
from sklearn.cluster import KMeans
from sklearn.impute import SimpleImputer
from sklearn.preprocessing import StandardScaler

# --------------------------------------------------------------------------- #
# Paths & configuration
# --------------------------------------------------------------------------- #

MODULE_ROOT = Path(__file__).resolve().parent
WORKSPACE_ROOT = MODULE_ROOT.parent
DATA_PATH = MODULE_ROOT / "etherfi_combined_labeled.csv"
ARTIFACTS_DIR = WORKSPACE_ROOT / "artifacts"
DEFAULT_CLUSTER_ARTIFACT = ARTIFACTS_DIR / "etherfi_clusterer.pkl"
DEFAULT_CLUSTERED_FRAME = ARTIFACTS_DIR / "etherfi_clusters.pkl"

# Columns that best capture staking vs liquidity regime changes.
SUMMARY_COLUMNS: Sequence[str] = (
    "daily_apr",
    "avg_7day_apr",
    "oracle_rate",
    "dex_rate",
    "nav_ratio",
    "premium_or_discount_perc",
    "withdraw",
    "deposit",
    "daily_netflow",
    "withdrawers",
    "depositors",
    "token_balance_usd",
    "future_apr_change_pct",
)


@dataclass
class ClusterArtifacts:
    feature_names: List[str]
    imputer: SimpleImputer
    scaler: StandardScaler
    model: KMeans


def save_pickle(obj: object, output_path: str | Path) -> Path:
    """Serialize helper that ensures parent directories exist."""
    output_path = Path(output_path)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    with output_path.open("wb") as fh:
        pickle.dump(obj, fh)
    return output_path


# --------------------------------------------------------------------------- #
# Core helpers
# --------------------------------------------------------------------------- #

def load_dataset(path: Path = DATA_PATH) -> pd.DataFrame:
    """Load dataset and parse timestamp."""
    if not path.exists():
        raise FileNotFoundError(f"Dataset not found: {path}")

    df = pd.read_csv(path)
    if "timestamp" in df.columns:
        df["timestamp"] = pd.to_datetime(df["timestamp"], errors="coerce", utc=True)

    return df


def build_feature_matrix(df: pd.DataFrame, exclude: Sequence[str] | None = None) -> tuple[np.ndarray, List[str], SimpleImputer, StandardScaler]:
    """
    Extract numeric feature matrix with imputation + scaling.

    Missing values are imputed with median statistics so the clustering model
    can operate without dropping rows.
    """
    exclude = set(exclude or [])
    numeric_cols = [col for col in df.select_dtypes(include=[np.number]).columns if col not in exclude]
    if not numeric_cols:
        raise ValueError("No numeric columns available for clustering.")

    feature_frame = df[numeric_cols].copy()

    imputer = SimpleImputer(strategy="median")
    imputed = imputer.fit_transform(feature_frame)

    scaler = StandardScaler()
    scaled = scaler.fit_transform(imputed)

    return scaled, numeric_cols, imputer, scaler


def cluster_etherfi(
    *,
    n_clusters: int = 3,
    random_state: int = 42,
) -> tuple[pd.DataFrame, pd.DataFrame, ClusterArtifacts]:
    """
    Run KMeans clustering on EtherFi daily snapshots.

    Returns the dataframe with cluster labels, a summary table, and the
    fitted preprocessing / model artifacts.
    """
    df = load_dataset()
    features, feature_names, imputer, scaler = build_feature_matrix(df, exclude=["target_label"])

    model = KMeans(n_clusters=n_clusters, random_state=random_state, n_init="auto")
    cluster_labels = model.fit_predict(features)
    df = df.copy()
    df["cluster"] = cluster_labels

    available_summary_cols = [col for col in SUMMARY_COLUMNS if col in df.columns]
    summary = (
        df.groupby("cluster")[available_summary_cols]
        .agg(["mean", "median"])
        .round(4)
        .swaplevel(axis=1)
        .sort_index(axis=1)
    )

    artifacts = ClusterArtifacts(
        feature_names=feature_names,
        imputer=imputer,
        scaler=scaler,
        model=model,
    )
    return df, summary, artifacts


# --------------------------------------------------------------------------- #
# CLI
# --------------------------------------------------------------------------- #

def _parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Cluster EtherFi staking states.")
    parser.add_argument("--clusters", type=int, default=3, help="Number of clusters to learn (default: 3).")
    parser.add_argument("--head", type=int, default=0, help="Print head() of clustered frame for quick inspection.")
    parser.add_argument(
        "--export-artifacts",
        type=Path,
        help=f"Override path for clustering artifacts pickle (default: {DEFAULT_CLUSTER_ARTIFACT}).",
    )
    parser.add_argument(
        "--export-clusters",
        type=Path,
        help=f"Override path for clustered dataframe pickle (default: {DEFAULT_CLUSTERED_FRAME}).",
    )
    parser.add_argument(
        "--skip-export",
        action="store_true",
        help="Disable pickle exports (otherwise defaults under project-one/artifacts/).",
    )
    return parser.parse_args()


def main() -> None:
    args = _parse_args()
    clustered_df, summary, artifacts = cluster_etherfi(n_clusters=args.clusters)

    print(f"Clustered {len(clustered_df):,} rows into {args.clusters} groups.")
    print("\nCluster counts:")
    print(clustered_df["cluster"].value_counts().sort_index())

    print("\nCluster summary (mean/median for key staking metrics):")
    print(summary)

    if args.head > 0:
        print(f"\nFirst {args.head} rows with cluster labels:")
        print(clustered_df.head(args.head))

    print("\nArtifacts:")
    print(f"- Features used ({len(artifacts.feature_names)}): {', '.join(artifacts.feature_names[:8])} ...")
    print(f"- Imputation strategy: median over numeric columns")
    print(f"- Scaling: z-score via StandardScaler")

    if not args.skip_export:
        artifact_path = args.export_artifacts or DEFAULT_CLUSTER_ARTIFACT
        saved_artifacts = save_pickle(artifacts, artifact_path)
        print(f"\nSaved clustering artifacts to {saved_artifacts}")

        cluster_path = args.export_clusters or DEFAULT_CLUSTERED_FRAME
        saved_clusters = save_pickle(clustered_df, cluster_path)
        print(f"Saved clustered dataframe to {saved_clusters}")


if __name__ == "__main__":
    main()
