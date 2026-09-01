"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import { ArrowUpRight, Check, Loader2 } from "lucide-react";
import { COST_LABELS, type ScoredQuest } from "@/lib/quests/daily";
import { useSounds } from "@/hooks/useSounds";

/**
 * The social quest, which cannot be a plain link like the others: it has to
 * take a link back and prove who wrote it.
 *
 * X's free oEmbed endpoint tells us the author, the words and the date of any
 * public post, but not who is claiming it. So the account is bound to the
 * wallet once, with a sign-up post carrying a code only this wallet was shown.
 * After that a daily post only has to come from that account, and people can
 * write whatever they like.
 */
export default function SocialQuestCard({
  quest,
  address,
  onVerified,
}: {
  quest: ScoredQuest;
  address: string | null;
  onVerified: () => void;
}) {
  const [handle, setHandle] = useState<string | null>(null);
  const [signupUrl, setSignupUrl] = useState<string | null>(null);
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const play = useSounds();

  useEffect(() => {
    if (!address) {
      setHandle(null);
      setSignupUrl(null);
      return;
    }
    let live = true;
    setLoading(true);
    fetch(`/api/quests/social?address=${address}`)
      .then((res) => res.json())
      .then((json) => {
        if (!live) return;
        setHandle(json.handle ?? null);
        setSignupUrl(json.signupUrl ?? null);
      })
      .catch(() => {})
      .finally(() => live && setLoading(false));
    return () => {
      live = false;
    };
  }, [address]);

  const submit = useCallback(async () => {
    if (!address || !url.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/quests/social", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address, url }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        play("error");
        setError(json.error ?? "Could not check that post.");
        return;
      }
      if (json.linked) setHandle(json.linked);
      setUrl("");
      onVerified();
    } catch {
      play("error");
      setError("Could not reach the checker. Try again.");
    } finally {
      setBusy(false);
    }
  }, [address, url, onVerified, play]);

  const linked = Boolean(handle);

  return (
    <div
      className={`rv-card p-4 transition-colors sm:p-5 ${quest.done ? "border-gold/40" : ""}`}
    >
      <div className="flex items-center gap-4 sm:gap-5">
        <span
          className={`relative h-14 w-14 shrink-0 overflow-hidden rounded-xl border sm:h-16 sm:w-16 ${
            quest.done ? "border-gold/50" : "border-border"
          }`}
        >
          <Image src={quest.art} alt="" fill sizes="64px" className="object-cover" />
          {quest.done && (
            <span className="absolute inset-0 flex items-center justify-center bg-[#07080c]/70">
              <Check className="h-7 w-7 text-gold" strokeWidth={3} />
            </span>
          )}
        </span>

        <div className="min-w-0 flex-1">
          <div className="mono flex flex-wrap items-center gap-x-2 text-[10px] font-bold uppercase tracking-[0.14em] text-muted-3">
            <span>{quest.gameLabel}</span>
            <span aria-hidden>·</span>
            <span className="text-diamond">{COST_LABELS[quest.cost]}</span>
            {linked && (
              <>
                <span aria-hidden>·</span>
                <span className="text-accent">@{handle}</span>
              </>
            )}
          </div>
          <div className="mt-0.5 font-semibold">{quest.title}</div>
          <p className="mt-0.5 text-[13px] text-muted-1">{quest.task}</p>
        </div>

        <div className="shrink-0 text-right">
          <div
            className={`mono text-lg font-bold leading-none sm:text-xl ${
              quest.done ? "text-gold" : "text-muted-2"
            }`}
          >
            +{quest.points}
          </div>
          <div className="mono mt-1 text-[10px] uppercase tracking-[0.12em] text-muted-3">
            {quest.done ? "done" : "points"}
          </div>
        </div>
      </div>

      {!quest.done && address && (
        <div className="mt-4 border-t border-border-soft pt-4">
          <p className="text-[13px] text-muted-1">
            {loading
              ? "Checking your X account…"
              : linked
                ? "Post about the Ronkeverse today, then paste the link."
                : "Post the sign-up line once to connect your X account. It carries a code only your wallet was shown, so nobody else can claim it."}
          </p>

          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
            <input
              value={url}
              onChange={(event) => setUrl(event.target.value)}
              onKeyDown={(event) => event.key === "Enter" && submit()}
              placeholder="https://x.com/you/status/…"
              spellCheck={false}
              aria-label="Link to your post"
              className="mono min-w-0 flex-1 rounded-xl border border-border bg-card-2 px-3 py-2.5 text-[13px] outline-none transition-colors placeholder:text-muted-3 focus:border-accent/60"
            />
            <div className="flex gap-2">
              <a
                href={(linked ? quest.href : signupUrl) ?? quest.href}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => play("click")}
                className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-xl border border-border-strong px-3 py-2.5 text-[13px] font-medium text-muted-1 transition-colors hover:border-accent hover:text-accent"
              >
                {linked ? "Open X" : "Write the post"}
                <ArrowUpRight className="h-3.5 w-3.5" />
              </a>
              <button
                onClick={submit}
                disabled={busy || !url.trim()}
                className="inline-flex items-center gap-2 whitespace-nowrap rounded-xl bg-accent px-4 py-2.5 text-[13px] font-semibold text-[#06121a] transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                {busy ? "Checking" : linked ? "Check post" : "Connect X"}
              </button>
            </div>
          </div>

          {error && <p className="mono mt-2 text-[12px] text-burn">{error}</p>}
        </div>
      )}

      {!quest.done && !address && (
        <p className="mt-3 border-t border-border-soft pt-3 text-[13px] text-muted-2">
          Connect a wallet to link your X account.
        </p>
      )}
    </div>
  );
}
