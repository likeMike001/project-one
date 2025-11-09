"use client";

type WalletSignalCardProps = {
  wallet: string;
  onWalletChange: (value: string) => void;
  onRunSignal: () => void;
  recStatus: "idle" | "loading" | "error";
  disabled: boolean;
  modelMessage: string | null;
};

export function WalletSignalCard({
  wallet,
  onWalletChange,
  onRunSignal,
  recStatus,
  disabled,
  modelMessage,
}: WalletSignalCardProps) {
  return (
    <div className="mt-6 rounded-2xl bg-black/30 p-4">
      <label className="text-sm text-slate-300">Optional wallet signal</label>
      <div className="mt-2 flex flex-col gap-3 sm:flex-row">
        <input
          value={wallet}
          onChange={(event) => onWalletChange(event.target.value)}
          placeholder="0x... (coming soon to modeling layer)"
          className="flex-1 rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white outline-none transition focus:border-emerald-400/70"
          disabled={disabled}
        />
        <button
          onClick={onRunSignal}
          disabled={recStatus === "loading" || disabled}
          className={`rounded-xl px-6 py-3 text-sm font-semibold shadow-2xl shadow-emerald-500/30 transition ${
            recStatus === "loading"
              ? "cursor-not-allowed bg-slate-600 text-slate-300"
              : "bg-gradient-to-r from-emerald-400 to-cyan-400 text-slate-900"
          }`}
          type="button"
        >
          {recStatus === "loading" ? "Updating..." : "Run signal"}
        </button>
      </div>
      <p className="mt-2 text-xs text-slate-400">
        Wallet routing remains optional; we will pass it to the modeling layer
        when available.
      </p>
      {modelMessage && (
        <p className="mt-3 text-xs text-slate-400">
          {recStatus === "error" ? "Heads up: " : "Latest: "}
          {modelMessage}
        </p>
      )}
    </div>
  );
}
