"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { BrowserProvider, getAddress, isAddress } from "ethers";
import { motion } from "motion/react";
import {
  ArrowRight,
  CheckCircle2,
  ChevronLeft,
  Cpu,
  Gauge,
  Loader2,
  Lock,
  Radar,
  ShieldCheck,
  ShieldAlert,
  Sparkles,
  TrendingUp,
  Wallet,
  X,
  Zap,
  LayoutGrid,
} from "lucide-react";

import { getVaultState } from "../agent/vault/getVaultState"
import { settings } from "../agent/settings";

type EthereumProvider = {
  request: (args: {
    method: string;
    params?: unknown[] | Record<string, unknown>;
  }) => Promise<any>;
  on?: (
    event: "accountsChanged" | "chainChanged",
    handler: (...args: any[]) => void,
  ) => void;
  removeListener?: (
    event: "accountsChanged" | "chainChanged",
    handler: (...args: any[]) => void,
  ) => void;
};

declare global {
  interface Window {
    ethereum?: EthereumProvider;
  }
}

type Page = "vault" | "swarm";

function truncateAddress(address: string, left = 6, right = 4) {
  if (!address) return "";
  return `${address.slice(0, left)}…${address.slice(-right)}`;
}

function formatChain(chainId: bigint | number | string) {
  const value = typeof chainId === "bigint" ? Number(chainId) : Number(chainId);
  return Number.isFinite(value) ? `Chain ${value}` : "Unknown network";
}

function useCountUp(target: number, duration = 1400, active = false) {
  const [value, setValue] = useState(0);
  const raf = useRef<number | null>(null);

  useEffect(() => {
    if (!active) return;

    let start: number | null = null;
    const tick = (now: number) => {
      if (start === null) start = now;
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(Math.round(target * eased));
      if (progress < 1) {
        raf.current = requestAnimationFrame(tick);
      }
    };

    raf.current = requestAnimationFrame(tick);
    return () => {
      if (raf.current !== null) cancelAnimationFrame(raf.current);
    };
  }, [target, duration, active]);

  return value;
}

function GlassShell({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-3xl border border-white/10 bg-white/[0.03] shadow-[0_20px_70px_rgba(0,0,0,0.45)] ${className}`}
      style={{ backdropFilter: "blur(16px)" }}
    >
      {children}
    </div>
  );
}

function MetricCard({
  label,
  value,
  caption,
  icon,
  accent,
  active,
}: {
  label: string;
  value: string;
  caption?: string;
  icon: React.ReactNode;
  accent: string;
  active: boolean;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 18 }}
      animate={active ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
      className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-b from-white/[0.06] to-white/[0.02] p-5"
    >
      <div
        className="absolute -right-8 -top-8 h-28 w-28 rounded-full blur-3xl"
        style={{ background: `${accent}20` }}
      />
      <div className="relative flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-slate-400">
            {label}
          </p>
          <p className="mt-2 text-3xl font-semibold tracking-tight text-slate-100">
            {value}
          </p>
          {caption ? (
            <p className="mt-2 text-xs leading-relaxed text-slate-400">
              {caption}
            </p>
          ) : null}
        </div>
        <div
          className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10"
          style={{ background: `${accent}16`, color: accent }}
        >
          {icon}
        </div>
      </div>
    </motion.div>
  );
}

function WalletConnectModal({
  open,
  loading,
  error,
  onConnect,
  onClose,
  connectedAddress,
  networkName,
}: {
  open: boolean;
  loading: boolean;
  error: string | null;
  onConnect: () => void;
  onClose: () => void;
  connectedAddress?: string | null;
  networkName?: string | null;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
      <motion.button
        aria-label="Close overlay"
        className="absolute inset-0 cursor-default bg-slate-950/80 backdrop-blur-md"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        onClick={onClose}
      />
      <motion.div
        initial={{ opacity: 0, y: 24, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
        className="relative w-full max-w-md"
      >
        <GlassShell className="overflow-hidden">
          <div className="border-b border-white/8 px-6 py-5">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-[11px] font-medium uppercase tracking-[0.24em] text-cyan-300/80">
                  Wallet connection
                </p>
                <h2 className="mt-2 text-xl font-semibold text-slate-100">
                  Connect your wallet
                </h2>
              </div>
              <button
                onClick={onClose}
                className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] text-slate-300 transition hover:bg-white/[0.08] hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <p className="mt-3 text-sm leading-relaxed text-slate-400">
              This uses a user-initiated wallet request through ethers.js. No
              automatic signing or background connection is performed.
            </p>
          </div>

          <div className="space-y-4 px-6 py-5">
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                <p className="text-[11px] uppercase tracking-[0.22em] text-slate-500">
                  Status
                </p>
                <p className="mt-2 text-sm font-medium text-slate-100">
                  {connectedAddress ? "Ready" : "Waiting"}
                </p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                <p className="text-[11px] uppercase tracking-[0.22em] text-slate-500">
                  Network
                </p>
                <p className="mt-2 text-sm font-medium text-slate-100">
                  {networkName ?? "Not detected"}
                </p>
              </div>
            </div>

            <div className="rounded-2xl border border-cyan-400/15 bg-cyan-400/5 p-4">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-xl bg-cyan-400/10 text-cyan-300">
                  <ShieldCheck className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-100">
                    Security checks
                  </p>
                  <p className="mt-1 text-xs leading-relaxed text-slate-400">
                    The app validates the returned wallet address and waits for
                    the connection promise to resolve before enabling
                    navigation.
                  </p>
                </div>
              </div>
            </div>

            {error ? (
              <div className="rounded-2xl border border-rose-400/15 bg-rose-400/5 p-4 text-sm text-rose-200">
                {error}
              </div>
            ) : null}

            <button
              onClick={onConnect}
              disabled={loading}
              className="flex w-full items-center justify-center gap-3 rounded-2xl px-4 py-4 font-medium text-slate-950 transition disabled:cursor-not-allowed disabled:opacity-70"
              style={{
                background:
                  "linear-gradient(135deg, rgba(34,211,238,1) 0%, rgba(56,189,248,1) 45%, rgba(129,140,248,1) 100%)",
              }}
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Connecting…
                </>
              ) : (
                <>
                  <Wallet className="h-4 w-4" />
                  Connect wallet
                </>
              )}
            </button>

            <p className="text-center text-xs leading-relaxed text-slate-500">
              Signing and transaction approvals remain separate actions.
            </p>
          </div>
        </GlassShell>
      </motion.div>
    </div>
  );
}

function ApprovalModal({
  open,
  onClose,
  onApprove,
  walletAddress,
  networkName,
}: {
  open: boolean;
  onClose: () => void;
  onApprove: () => void;
  walletAddress?: string | null;
  networkName?: string | null;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center p-4">
      <motion.button
        aria-label="Close overlay"
        className="absolute inset-0 bg-slate-950/75 backdrop-blur-md"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        onClick={onClose}
      />
      <motion.div
        initial={{ opacity: 0, y: 24, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
        className="relative w-full max-w-lg"
      >
        <GlassShell className="overflow-hidden">
          <div className="border-b border-white/8 px-6 py-5">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-[11px] font-medium uppercase tracking-[0.24em] text-amber-300/80">
                  Ledger approval
                </p>
                <h2 className="mt-2 text-xl font-semibold text-slate-100">
                  Review and approve the strategy
                </h2>
              </div>
              <button
                onClick={onClose}
                className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] text-slate-300 transition hover:bg-white/[0.08] hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <p className="mt-3 text-sm leading-relaxed text-slate-400">
              This popup is reusable across the app. It can represent any
              hardware-wallet approval step without exposing the action as an
              always-visible banner or button.
            </p>
          </div>

          <div className="space-y-4 px-6 py-5">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                <p className="text-[11px] uppercase tracking-[0.22em] text-slate-500">
                  Wallet
                </p>
                <p className="mt-2 text-sm font-medium text-slate-100">
                  {walletAddress
                    ? truncateAddress(walletAddress, 8, 6)
                    : "Not connected"}
                </p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                <p className="text-[11px] uppercase tracking-[0.22em] text-slate-500">
                  Network
                </p>
                <p className="mt-2 text-sm font-medium text-slate-100">
                  {networkName ?? "Unknown network"}
                </p>
              </div>
            </div>

            <div className="rounded-2xl border border-amber-400/15 bg-amber-400/5 p-4">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-xl bg-amber-400/10 text-amber-300">
                  <Lock className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-100">
                    What you are approving
                  </p>
                  <ul className="mt-2 space-y-1 text-xs leading-relaxed text-slate-400">
                    <li>• Strategy payload review</li>
                    <li>• Transaction execution authorization</li>
                    <li>• Signature confirmation request</li>
                  </ul>
                </div>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                <p className="text-[11px] uppercase tracking-[0.22em] text-slate-500">
                  Authorization scope
                </p>
                <p className="mt-2 text-sm font-medium text-slate-100">
                  Single transaction
                </p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                <p className="text-[11px] uppercase tracking-[0.22em] text-slate-500">
                  Review status
                </p>
                <p className="mt-2 text-sm font-medium text-slate-100">
                  Awaiting approval
                </p>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={onClose}
                className="flex-1 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm font-medium text-slate-300 transition hover:bg-white/[0.06] hover:text-white"
              >
                Cancel
              </button>
              <button
                onClick={onApprove}
                className="flex-1 rounded-2xl px-4 py-3 text-sm font-medium text-slate-950 transition"
                style={{
                  background:
                    "linear-gradient(135deg, rgba(245,158,11,1) 0%, rgba(251,146,60,1) 100%)",
                }}
              >
                Approve
              </button>
            </div>
          </div>
        </GlassShell>
      </motion.div>
    </div>
  );
}

function AgentCard({
  title,
  subtitle,
  accent,
  icon,
  status,
  children,
}: {
  title: string;
  subtitle: string;
  accent: string;
  icon: React.ReactNode;
  status: string;
  children: React.ReactNode;
}) {
  return (
    <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-white/[0.03] p-5">
      <div
        className="absolute -right-10 -top-10 h-28 w-28 rounded-full blur-3xl"
        style={{ background: `${accent}18` }}
      />
      <div className="relative flex items-start justify-between gap-4">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <div
              className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10"
              style={{ background: `${accent}14`, color: accent }}
            >
              {icon}
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-100">{title}</p>
              <p className="text-xs text-slate-400">{subtitle}</p>
            </div>
          </div>
        </div>

        <span
          className="rounded-full border px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.22em]"
          style={{
            borderColor: `${accent}30`,
            color: accent,
            background: `${accent}10`,
          }}
        >
          {status}
        </span>
      </div>

      <div className="relative mt-5 space-y-4 text-sm text-slate-300">
        {children}
      </div>
    </div>
  );
}

function VaultDashboard({
  walletAddress,
  networkName,
  onConnectWallet,
  onOpenSwarm,
  connected,
  connecting,
}: {
  walletAddress: string | null;
  networkName: string | null;
  onConnectWallet: () => void;
  onOpenSwarm: () => void;
  connected: boolean;
  connecting: boolean;
}) {
  const [ready, setReady] = useState(false);
  const [amount, setAmount] = useState("250");
  const [mode, setMode] = useState<"deposit" | "redeem">("deposit");
  const [txState, setTxState] = useState<"idle" | "pending" | "done">("idle");

  const tvl = useCountUp(1482920, 1600, ready);
  const balance = useCountUp(25000, 1500, ready);

  useEffect(() => {
    const t = setTimeout(() => setReady(true), 120);
    return () => clearTimeout(t);
  }, []);

  const execute = () => {
    if (!connected) {
      onConnectWallet();
      return;
    }
    if (!amount || txState !== "idle") return;

    setTxState("pending");
    setTimeout(() => {
      setTxState("done");
      setTimeout(() => setTxState("idle"), 2200);
    }, 1200);
  };

  return (
    <div className="min-h-screen bg-[#070b15] text-slate-100">
      <header className="sticky top-0 z-40 border-b border-white/8 bg-slate-950/70 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl border border-cyan-400/15 bg-cyan-400/10 p-2 text-cyan-300">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-semibold tracking-[0.12em] text-transparent bg-gradient-to-r from-cyan-300 to-indigo-300 bg-clip-text">
                CHRONOS
              </p>
              <p className="text-xs text-slate-400">Vault operations console</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={onOpenSwarm}
              className="hidden rounded-2xl border border-amber-400/20 bg-amber-400/10 px-4 py-2 text-sm font-medium text-amber-200 transition hover:bg-amber-400/15 sm:inline-flex"
            >
              Open OG Swarm
            </button>

            <button
              onClick={onConnectWallet}
              disabled={connecting}
              className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-2 text-sm font-medium text-slate-200 transition hover:bg-white/[0.06] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {connecting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Wallet className="h-4 w-4" />
              )}
              {walletAddress ? truncateAddress(walletAddress) : "Connect"}
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="grid gap-8 lg:grid-cols-[1.2fr_0.8fr]">
          <section className="space-y-6">
            <GlassShell className="p-6 sm:p-8">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full border border-emerald-400/15 bg-emerald-400/10 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.22em] text-emerald-300">
                  {connected ? "Wallet connected" : "Wallet required"}
                </span>
                <span className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-[11px] text-slate-300">
                  {networkName ?? "Network not detected"}
                </span>
              </div>

              <div className="mt-6 max-w-2xl">
                <h1 className="text-4xl font-semibold tracking-tight text-slate-50 sm:text-5xl">
                  Professional vault operations with a clean execution flow.
                </h1>
                <p className="mt-4 max-w-xl text-sm leading-7 text-slate-400 sm:text-base">
                  Connect a wallet with ethers.js, validate the address after
                  the provider resolves, and only then allow navigation to the
                  OG Swarm intelligence workspace.
                </p>
              </div>

              <div className="mt-8 flex flex-wrap gap-3">
                <button
                  onClick={onOpenSwarm}
                  className="inline-flex items-center gap-2 rounded-2xl bg-slate-100 px-4 py-3 text-sm font-medium text-slate-950 transition hover:bg-white"
                >
                  Enter OG Swarm
                  <ArrowRight className="h-4 w-4" />
                </button>
                <button
                  onClick={onConnectWallet}
                  className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm font-medium text-slate-200 transition hover:bg-white/[0.06]"
                >
                  <ShieldCheck className="h-4 w-4" />
                  {walletAddress ? "Reconnect wallet" : "Connect wallet"}
                </button>
              </div>
            </GlassShell>

            <div className="grid gap-4 sm:grid-cols-3">
              <MetricCard
                label="Total Value Locked"
                value={`$${tvl.toLocaleString()}`}
                caption="Live portfolio capital under management."
                icon={<TrendingUp className="h-5 w-5" />}
                accent="#22d3ee"
                active={ready}
              />
              <MetricCard
                label="Vault Balance"
                value={`${(balance / 100).toFixed(2)} CHR`}
                caption="Shares tracked against the active vault."
                icon={<Wallet className="h-5 w-5" />}
                accent="#818cf8"
                active={ready}
              />
              
            </div>
          </section>

          <section className="space-y-6">
            <GlassShell className="p-6 sm:p-7">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[11px] font-medium uppercase tracking-[0.24em] text-cyan-300/80">
                    Capital actions
                  </p>
                  <h2 className="mt-2 text-xl font-semibold text-slate-100">
                    Deposit or redeem
                  </h2>
                </div>
                <div className="inline-flex items-center gap-2 rounded-full border border-cyan-400/15 bg-cyan-400/10 px-3 py-1 text-[11px] text-cyan-200">
                  <span className="h-1.5 w-1.5 rounded-full bg-cyan-300" />
                  Live
                </div>
              </div>

              <div className="mt-5 inline-flex rounded-2xl border border-white/10 bg-white/[0.03] p-1">
                {(["deposit", "redeem"] as const).map((item) => (
                  <button
                    key={item}
                    onClick={() => setMode(item)}
                    className="relative rounded-xl px-5 py-2.5 text-sm font-medium capitalize transition"
                    style={{ color: mode === item ? "#f8fafc" : "#94a3b8" }}
                  >
                    {mode === item && (
                      <motion.span
                        layoutId="vault-pill"
                        className="absolute inset-0 rounded-xl border border-cyan-400/20 bg-cyan-400/10"
                        transition={{
                          type: "spring",
                          bounce: 0.2,
                          duration: 0.35,
                        }}
                      />
                    )}
                    <span className="relative z-10">{item}</span>
                  </button>
                ))}
              </div>

              <div className="mt-5">
                <label className="mb-2 block text-xs font-medium uppercase tracking-[0.2em] text-slate-500">
                  Amount
                </label>
                <div className="flex gap-3">
                  <input
                    type="number"
                    min="0"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="h-14 w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 text-sm text-slate-100 outline-none transition focus:border-cyan-400/40"
                    placeholder="0.00"
                  />
                  <button
                    onClick={() => setAmount("250")}
                    className="h-14 rounded-2xl border border-cyan-400/15 bg-cyan-400/10 px-4 text-xs font-semibold uppercase tracking-[0.2em] text-cyan-200 transition hover:bg-cyan-400/15"
                  >
                    Max
                  </button>
                </div>
              </div>

              <div className="mt-5 flex items-center justify-between text-xs text-slate-500">
                <span>Available: 250.00 CHR</span>
                <span>Fee: 0.10%</span>
              </div>

              <button
                onClick={execute}
                disabled={txState !== "idle"}
                className="mt-6 flex h-14 w-full items-center justify-center gap-2 rounded-2xl font-medium text-slate-950 transition disabled:cursor-not-allowed disabled:opacity-70"
                style={{
                  background:
                    "linear-gradient(135deg, rgba(34,211,238,1) 0%, rgba(59,130,246,1) 45%, rgba(129,140,248,1) 100%)",
                }}
              >
                {txState === "pending" ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Broadcasting…
                  </>
                ) : txState === "done" ? (
                  <>
                    <CheckCircle2 className="h-4 w-4" />
                    Transaction confirmed
                  </>
                ) : (
                  <>
                    <Zap className="h-4 w-4" />
                    {connected
                      ? `Execute ${mode}`
                      : "Connect wallet to continue"}
                  </>
                )}
              </button>
            </GlassShell>

            <GlassShell className="p-6">
              <div className="flex items-center gap-3">
                <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3 text-cyan-300">
                  <ShieldAlert className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-slate-100">
                    Connection policy
                  </h3>
                  <p className="mt-1 text-xs leading-relaxed text-slate-400">
                    The Swarm page stays locked until the wallet connection
                    completes successfully.
                  </p>
                </div>
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                  <p className="text-[11px] uppercase tracking-[0.2em] text-slate-500">
                    Address
                  </p>
                  <p className="mt-2 text-sm font-medium text-slate-100">
                    {walletAddress
                      ? truncateAddress(walletAddress, 8, 6)
                      : "Not connected"}
                  </p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                  <p className="text-[11px] uppercase tracking-[0.2em] text-slate-500">
                    Wallet state
                  </p>
                  <p className="mt-2 text-sm font-medium text-slate-100">
                    {connected ? "Verified" : "Pending"}
                  </p>
                </div>
              </div>
            </GlassShell>
          </section>
        </div>
      </main>
    </div>
  );
}

function SwarmHub({
  walletAddress,
  networkName,
  onBack,
  onRequestApproval,
}: {
  walletAddress: string | null;
  networkName: string | null;
  onBack: () => void;
  onRequestApproval: () => void;
}) {
  const [mounted, setMounted] = useState(false);

  const scout = [
    {
      title: "Market scan",
      body: "Aggregates liquidity depth and route availability across active protocols.",
    },
    {
      title: "Opportunity filter",
      body: "Prioritizes routes with the best capital efficiency and execution window.",
    },
  ];

  const risk = [
    {
      title: "Exposure control",
      body: "Caps allocation size against available liquidity and tolerance bands.",
    },
    {
      title: "Drawdown guard",
      body: "Keeps strategy selection inside conservative volatility thresholds.",
    },
  ];

  const strategist = [
    {
      title: "Path selection",
      body: "Selects the most efficient route and prepares a single execution payload.",
    },
    {
      title: "Approval stage",
      body: "Requests a reusable hardware-wallet popup before any broadcast occurs.",
    },
  ];

  const executor = [
    {
      title: "Transaction build",
      body: "Encodes calldata and prepares gas-aware execution parameters.",
    },
    {
      title: "Broadcast control",
      body: "Blocks sending until the approval modal has been completed.",
    },
  ];

  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 120);
    const open = setTimeout(() => onRequestApproval(), 700);
    return () => {
      clearTimeout(t);
      clearTimeout(open);
    };
  }, [onRequestApproval]);

  return (
    <div className="min-h-screen bg-[#060914] text-slate-100">
      <header className="sticky top-0 z-40 border-b border-white/8 bg-slate-950/75 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
          <button
            onClick={onBack}
            className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-2 text-sm font-medium text-slate-300 transition hover:bg-white/[0.06] hover:text-white"
          >
            <ChevronLeft className="h-4 w-4" />
            Back
          </button>

          <div className="flex items-center gap-2">
            <span className="rounded-full border border-emerald-400/15 bg-emerald-400/10 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.2em] text-emerald-300">
              Swarm active
            </span>
            <span className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-[11px] text-slate-300">
              {networkName ?? "Network not detected"}
            </span>
          </div>

          <div className="hidden items-center gap-2 sm:flex">
            <span className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-xs text-slate-300">
              {walletAddress ? truncateAddress(walletAddress) : "No wallet"}
            </span>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <motion.section
          initial={{ opacity: 0, y: 18 }}
          animate={mounted ? { opacity: 1, y: 0 } : {}}
          className="overflow-hidden rounded-[2rem] border border-white/10 bg-gradient-to-br from-white/[0.05] to-white/[0.02] p-6 sm:p-8"
        >
          <div className="flex flex-wrap items-center gap-3">
            <div className="rounded-2xl border border-amber-400/15 bg-amber-400/10 p-3 text-amber-300">
              <LayoutGrid className="h-6 w-6" />
            </div>
            <div>
              <p className="text-[11px] font-medium uppercase tracking-[0.24em] text-amber-300/80">
                OG Swarm Intelligence Hub
              </p>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-50 sm:text-4xl">
                Coordinated research, risk, and execution.
              </h1>
            </div>
          </div>

          <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-400 sm:text-base">
            The typography log has been removed. The page now uses compact
            status panels and a reusable approval popup for a more polished
            operational UI.
          </p>

          <div className="mt-6 grid gap-4 md:grid-cols-3">
            <div className="rounded-3xl border border-cyan-400/15 bg-cyan-400/5 p-5">
              <p className="text-xs uppercase tracking-[0.22em] text-cyan-300/80">
                Network
              </p>
              <p className="mt-2 text-2xl font-semibold text-slate-50">
                Online
              </p>
              <p className="mt-2 text-sm text-slate-400">
                Prepared for live decision routing.
              </p>
            </div>
            <div className="rounded-3xl border border-emerald-400/15 bg-emerald-400/5 p-5">
              <p className="text-xs uppercase tracking-[0.22em] text-emerald-300/80">
                Risk posture
              </p>
              <p className="mt-2 text-2xl font-semibold text-slate-50">Low</p>
              <p className="mt-2 text-sm text-slate-400">
                Guardrails active before broadcast.
              </p>
            </div>
            <div className="rounded-3xl border border-amber-400/15 bg-amber-400/5 p-5">
              <p className="text-xs uppercase tracking-[0.22em] text-amber-300/80">
                Signature
              </p>
              <p className="mt-2 text-2xl font-semibold text-slate-50">
                Pending
              </p>
              <p className="mt-2 text-sm text-slate-400">
                Approval proceeds via popup only.
              </p>
            </div>
          </div>
        </motion.section>

        <div className="mt-6 grid gap-4 xl:grid-cols-4">
          <AgentCard
            title="Scout Agent"
            subtitle="Signals and liquidity discovery"
            status="Active"
            accent="#22d3ee"
            icon={<Radar className="h-5 w-5" />}
          >
            {scout.map((item) => (
              <div
                key={item.title}
                className="rounded-2xl border border-white/10 bg-white/[0.03] p-4"
              >
                <p className="text-xs font-medium uppercase tracking-[0.2em] text-slate-500">
                  {item.title}
                </p>
                <p className="mt-2 text-sm leading-6 text-slate-300">
                  {item.body}
                </p>
              </div>
            ))}
          </AgentCard>

          <AgentCard
            title="Risk Analyst"
            subtitle="Exposure control and drawdown checks"
            status="Green"
            accent="#34d399"
            icon={<ShieldCheck className="h-5 w-5" />}
          >
            {risk.map((item) => (
              <div
                key={item.title}
                className="rounded-2xl border border-white/10 bg-white/[0.03] p-4"
              >
                <p className="text-xs font-medium uppercase tracking-[0.2em] text-slate-500">
                  {item.title}
                </p>
                <p className="mt-2 text-sm leading-6 text-slate-300">
                  {item.body}
                </p>
              </div>
            ))}
          </AgentCard>

          <AgentCard
            title="Strategist"
            subtitle="Route selection and approval"
            status="Queued"
            accent="#818cf8"
            icon={<Sparkles className="h-5 w-5" />}
          >
            {strategist.map((item) => (
              <div
                key={item.title}
                className="rounded-2xl border border-white/10 bg-white/[0.03] p-4"
              >
                <p className="text-xs font-medium uppercase tracking-[0.2em] text-slate-500">
                  {item.title}
                </p>
                <p className="mt-2 text-sm leading-6 text-slate-300">
                  {item.body}
                </p>
              </div>
            ))}
          </AgentCard>

          <AgentCard
            title="Executor"
            subtitle="Builds and broadcasts the transaction"
            status="Ready"
            accent="#f472b6"
            icon={<Cpu className="h-5 w-5" />}
          >
            {executor.map((item) => (
              <div
                key={item.title}
                className="rounded-2xl border border-white/10 bg-white/[0.03] p-4"
              >
                <p className="text-xs font-medium uppercase tracking-[0.2em] text-slate-500">
                  {item.title}
                </p>
                <p className="mt-2 text-sm leading-6 text-slate-300">
                  {item.body}
                </p>
              </div>
            ))}
          </AgentCard>
        </div>

        <div className="mt-6 grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
          <GlassShell className="p-6">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-[11px] font-medium uppercase tracking-[0.24em] text-slate-500">
                  Execution overview
                </p>
                <h2 className="mt-2 text-xl font-semibold text-slate-100">
                  Compact system status
                </h2>
              </div>
              <div className="rounded-full border border-emerald-400/15 bg-emerald-400/10 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.2em] text-emerald-300">
                Ready
              </div>
            </div>

            <div className="mt-5 space-y-3">
              {[
                ["Scout", "Opportunity set built from current protocol depth."],
                ["Risk", "Allocation remains inside tolerance bands."],
                ["Strategy", "Route locked and awaiting signature only."],
                ["Execution", "Broadcast disabled until approval completes."],
              ].map(([title, body]) => (
                <div
                  key={title}
                  className="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4"
                >
                  <div className="mt-1 h-2.5 w-2.5 rounded-full bg-cyan-300" />
                  <div>
                    <p className="text-sm font-medium text-slate-100">
                      {title}
                    </p>
                    <p className="mt-1 text-sm leading-6 text-slate-400">
                      {body}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </GlassShell>

          <GlassShell className="p-6">
            <div className="flex items-center gap-3">
              <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3 text-amber-300">
                <Gauge className="h-5 w-5" />
              </div>
              <div>
                <p className="text-[11px] font-medium uppercase tracking-[0.24em] text-amber-300/80">
                  Approval workflow
                </p>
                <h2 className="mt-2 text-xl font-semibold text-slate-100">
                  Reusable popup component
                </h2>
              </div>
            </div>

            <p className="mt-4 text-sm leading-7 text-slate-400">
              The old alert banner and inline button have been removed. Approval
              now happens through a modal component that you can reuse anywhere
              in the app.
            </p>

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                <p className="text-[11px] uppercase tracking-[0.2em] text-slate-500">
                  Entry control
                </p>
                <p className="mt-2 text-sm font-medium text-slate-100">
                  Protected
                </p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                <p className="text-[11px] uppercase tracking-[0.2em] text-slate-500">
                  Reuse
                </p>
                <p className="mt-2 text-sm font-medium text-slate-100">
                  Global modal
                </p>
              </div>
            </div>
          </GlassShell>
        </div>
      </main>
    </div>
  );
}

export default function Home() {
  const [page, setPage] = useState<Page>("vault");
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [networkName, setNetworkName] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [walletOpen, setWalletOpen] = useState(false);
  const [walletError, setWalletError] = useState<string | null>(null);
  const [pendingRoute, setPendingRoute] = useState<Page | null>(null);
  const [approvalOpen, setApprovalOpen] = useState(false);

  const requiredChainId = process.env.NEXT_PUBLIC_REQUIRED_CHAIN_ID
    ? Number(process.env.NEXT_PUBLIC_REQUIRED_CHAIN_ID)
    : null;

  const closeWalletModal = useCallback(() => {
    setWalletOpen(false);
    setWalletError(null);
    setConnecting(false);
  }, []);

  const connectWallet = useCallback(async () => {
    try {
      setWalletError(null);
      setConnecting(true);

      if (typeof window === "undefined" || !window.ethereum) {
        throw new Error(
          "No injected wallet provider found. Install MetaMask or another EIP-1193 wallet.",
        );
      }

      const provider = new BrowserProvider(window.ethereum as any, "any");
      const accounts = await provider.send("eth_requestAccounts", []);

      if (!Array.isArray(accounts) || accounts.length === 0) {
        throw new Error("Wallet connection was not approved.");
      }

      const signer = await provider.getSigner();
      const address = getAddress(await signer.getAddress());

      if (!isAddress(address)) {
        throw new Error("The wallet returned an invalid address.");
      }

      const network = await provider.getNetwork();
      if (
        requiredChainId !== null &&
        Number(network.chainId) !== requiredChainId
      ) {
        throw new Error(
          `Please switch to chain ID ${requiredChainId} before continuing.`,
        );
      }

      setWalletAddress(address);
      setNetworkName(formatChain(network.chainId));
      setConnected(true);
      setWalletOpen(false);

      if (pendingRoute) {
        setPage(pendingRoute);
        setPendingRoute(null);
      }
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Wallet connection failed.";
      setWalletError(message);
      setConnected(false);
    } finally {
      setConnecting(false);
    }
  }, [pendingRoute, requiredChainId]);

  const openSwarm = useCallback(() => {
    if (!connected) {
      setPendingRoute("swarm");
      setWalletOpen(true);
      return;
    }
    setPage("swarm");
  }, [connected]);

  const requestApproval = useCallback(() => {
    setApprovalOpen(true);
  }, []);

  const approve = useCallback(() => {
    setApprovalOpen(false);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined" || !window.ethereum) return;

    const handleAccountsChanged = (accounts: string[]) => {
      if (!accounts || accounts.length === 0) {
        setConnected(false);
        setWalletAddress(null);
        setPage("vault");
        setWalletOpen(true);
        return;
      }

      const nextAddress = getAddress(accounts[0]);
      setWalletAddress(nextAddress);
      setConnected(true);
    };

    const handleChainChanged = () => {
      setNetworkName(null);
      setConnected(false);
      setPage("vault");
      setPendingRoute(null);
      setWalletOpen(true);
    };

    window.ethereum.on?.("accountsChanged", handleAccountsChanged);
    window.ethereum.on?.("chainChanged", handleChainChanged);

    return () => {
      window.ethereum?.removeListener?.(
        "accountsChanged",
        handleAccountsChanged,
      );
      window.ethereum?.removeListener?.("chainChanged", handleChainChanged);
    };
  }, []);

  return (
    <>
      <WalletConnectModal
        open={walletOpen}
        loading={connecting}
        error={walletError}
        onConnect={connectWallet}
        onClose={closeWalletModal}
        connectedAddress={walletAddress}
        networkName={networkName}
      />

      <ApprovalModal
        open={approvalOpen}
        onClose={() => setApprovalOpen(false)}
        onApprove={approve}
        walletAddress={walletAddress}
        networkName={networkName}
      />

      {page === "vault" ? (
        <VaultDashboard
          walletAddress={walletAddress}
          networkName={networkName}
          onConnectWallet={() => {
            setPendingRoute(null);
            setWalletOpen(true);
          }}
          onOpenSwarm={openSwarm}
          connected={connected}
          connecting={connecting}
        />
      ) : (
        <SwarmHub
          walletAddress={walletAddress}
          networkName={networkName}
          onBack={() => setPage("vault")}
          onRequestApproval={requestApproval}
        />
      )}
    </>
  );
}
