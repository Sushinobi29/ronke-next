"use client";

import Image from "next/image";
import { ArrowUpRight } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";

const CARDS = {
  casino: {
    title: "Ronke Casino",
    text: "Coinflip and Mines, wagered in $RONKE or monkes. A biweekly leaderboard pays the top hundred, including the biggest loser.",
    href: "https://games.ronkeverse.com",
    linkLabel: "Play now",
  },
  vote: {
    title: "Ronke Vote",
    text: "Seasonal votes settled on Ronin. Climb the top-voter board and earn PoD rewards.",
    href: "https://ronke-vote.netlify.app",
    linkLabel: "Vote",
  },
};

export default function PlaySection() {
  const reduced = useReducedMotion();

  return (
    <div className="mx-auto max-w-6xl px-4 py-24 sm:px-6">
      <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
        Play, farm, vote.
      </h2>
      <p className="mt-3 max-w-lg text-muted-1">
        Every game routes revenue back into buybacks and burns.
      </p>

      <motion.div
        className="mt-10 grid gap-4 md:grid-cols-2"
        initial={reduced ? false : { opacity: 0, y: 24 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.2 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
      >
        <a
          href={CARDS.casino.href}
          target="_blank"
          rel="noopener noreferrer"
          className="rv-card rv-hover group overflow-hidden md:col-span-2"
        >
          <div className="grid md:grid-cols-2">
            <div className="relative min-h-56 overflow-hidden bg-[#0a0d16]">
              <Image
                src="/casino-card.webp"
                alt="Ronke holding cards at a casino table"
                fill
                sizes="(min-width: 768px) 50vw, 100vw"
                className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
              />
            </div>
            <div className="flex flex-col justify-center p-8">
              <div className="text-xl font-semibold">{CARDS.casino.title}</div>
              <p className="mt-3 max-w-sm text-sm leading-relaxed text-muted-1">
                {CARDS.casino.text}
              </p>
              <span className="mt-5 inline-flex items-center gap-1 text-sm font-semibold text-accent">
                {CARDS.casino.linkLabel}
                <ArrowUpRight className="h-4 w-4" strokeWidth={2} />
              </span>
            </div>
          </div>
        </a>

        <div className="rv-card relative min-h-64 overflow-hidden">
          <Image
            src="/rrf2.webp"
            alt="Ronke as a rice farmer in a paddy field at sunset"
            fill
            sizes="(min-width: 768px) 50vw, 100vw"
            className="object-cover"
          />
          <div
            aria-hidden
            className="absolute inset-0"
            style={{
              background:
                "linear-gradient(180deg, rgba(7,8,12,0.15) 0%, rgba(7,8,12,0.72) 100%)",
            }}
          />
          <div className="absolute inset-x-0 bottom-0 p-8">
            <span className="mono inline-block rounded-full border border-diamond/40 bg-card-2/80 px-3 py-1 text-xs font-bold text-diamond">
              Coming soon
            </span>
            <div className="mt-3 text-xl font-semibold">
              Ronke Rice Farmer 2.0
            </div>
            <p className="mt-1 max-w-xs text-sm leading-relaxed text-foreground/80">
              The farm is being replanted. New fields, new yields, same monke.
            </p>
          </div>
        </div>

        <a
          href={CARDS.vote.href}
          target="_blank"
          rel="noopener noreferrer"
          className="rv-card rv-hover group relative min-h-64 overflow-hidden"
        >
          <Image
            src="/vote-card.webp"
            alt="Ronke dropping a glowing ballot into a ballot box"
            fill
            sizes="(min-width: 768px) 50vw, 100vw"
            className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
          />
          <div
            aria-hidden
            className="absolute inset-0"
            style={{
              background:
                "linear-gradient(180deg, rgba(7,8,12,0.15) 0%, rgba(7,8,12,0.72) 100%)",
            }}
          />
          <div className="absolute inset-x-0 bottom-0 p-8">
            <div className="text-xl font-semibold">{CARDS.vote.title}</div>
            <p className="mt-1 max-w-xs text-sm leading-relaxed text-foreground/80">
              {CARDS.vote.text}
            </p>
            <span className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-accent">
              {CARDS.vote.linkLabel}
              <ArrowUpRight className="h-4 w-4" strokeWidth={2} />
            </span>
          </div>
        </a>
      </motion.div>
    </div>
  );
}
