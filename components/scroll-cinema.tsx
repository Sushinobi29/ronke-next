"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import type { MotionValue } from "motion/react";
import { motion, useScroll, useTransform, useReducedMotion } from "motion/react";

// The Ronke film IS the hero: the page opens pinned on a full-viewport film
// with the RONKEVERSE title as its opening overlay. Three renderings:
//
//  1. Desktop (fine pointer, wide): true scroll-scrubbing - one continuous
//     24s film encoded all-intra (keyint=1) so any frame seeks instantly.
//     The scrollbar IS the playhead; scrolling up plays it backward.
//  2. Touch / small screens: the film's four acts as small looping mp4s,
//     crossfaded by scroll-driven opacity only (currentTime scrubbing during
//     native scroll is the known jank path on Android).
//  3. prefers-reduced-motion / data-saver / SSR: title, posters and text.
//
// The film is built from real collection art; swapping in an AI-generated cut
// is a single file replacement in /public/film as long as the four 6s act
// timings hold.

const BUY_URL =
  "https://app.roninchain.com/swap?outputCurrency=0xf988F63Bf26c3Ed3fBf39922149E3E7B1e5c27Cb&inputCurrency=RON";
const COLLECTION_URL = "https://marketplace.roninchain.com/collections/ronkeverse";

const CHAPTERS = [
  {
    // Act 1 carries the title card instead of a chapter text.
    id: "title",
    title: null,
    text: null,
    video: "/film/chapter1.mp4",
    poster: "/film/poster1.jpg",
  },
  {
    id: "collection",
    title: "6,969 strong.",
    text: "Every Ronkeverse NFT is hand-drawn chaos. No two monkes alike, all of them blue.",
    video: "/film/chapter2.mp4",
    poster: "/film/poster2.jpg",
  },
  {
    id: "play",
    title: "The games feed the fire.",
    text: "Coinflip, Mines, rice farming. Revenue from every wager routes back into the ecosystem.",
    video: "/film/chapter3.mp4",
    poster: "/film/poster3.jpg",
  },
  {
    id: "burn",
    title: "Supply only goes down.",
    text: "Buybacks burn. RONKESTR burns. What reaches the dead address never comes back.",
    video: "/film/chapter4.mp4",
    poster: "/film/poster4.jpg",
    cta: true,
  },
] as const;

const N = CHAPTERS.length;

// Film timeline - must match the Venice-generated continuous cut in
// /public/film/ronke-film.mp4: act1 idle 0-5.04, travel, grid pan 10.08-16.08,
// travel, casino 21.13-26.17, travel, bonfire 31.21-36.25. One take, no cuts.
const FILM = { total: 36.25, src: "/film/ronke-film.mp4" };
const FILM_TEXT_SEC = [
  [0, 0, 3.6, 4.9], // title card: on from the start, gone before the pull-back
  [10.6, 11.6, 15.0, 16.0],
  [21.6, 22.6, 25.2, 26.1],
  [31.7, 32.7, 35.3, 36.25],
];
// Active-chapter switches at the midpoints of the three camera travels.
const FILM_BOUNDS = [7.56 / 36.25, 18.6 / 36.25, 28.69 / 36.25];

const filmWindow = (i: number) => FILM_TEXT_SEC[i].map((t) => t / FILM.total);

const chapterWindow = (i: number) => {
  const ws = i / N;
  const we = (i + 1) / N;
  return [
    ws + 0.015,
    Math.min(ws + 0.09, we - 0.02),
    Math.max(we - 0.09, ws + 0.02),
    we - 0.015,
  ];
};

// Title card fades with the first act in both scrub and chapter mode.
const titleWindow = (scrub: boolean) =>
  scrub ? filmWindow(0) : [0, 0, chapterWindow(0)[2], chapterWindow(0)[3]];

function Scrim() {
  return (
    <div
      aria-hidden
      className="absolute inset-0"
      style={{
        background:
          "linear-gradient(90deg, rgba(7,8,12,0.82) 0%, rgba(7,8,12,0.42) 45%, rgba(7,8,12,0.12) 100%), linear-gradient(180deg, rgba(7,8,12,0.4) 0%, transparent 30%, transparent 70%, rgba(7,8,12,0.55) 100%)",
      }}
    />
  );
}

function useFadeWindow(
  progress: MotionValue<number>,
  w: number[],
  edge: "first" | "last" | "middle"
) {
  const [inA, inB, outA, outB] = w;
  const opacity = useTransform(
    progress,
    edge === "first"
      ? [0, outA, outB]
      : edge === "last"
        ? [inA, inB, 1]
        : [inA, inB, outA, outB],
    edge === "first" ? [1, 1, 0] : edge === "last" ? [0, 1, 1] : [0, 1, 1, 0]
  );
  // Fully-faded overlays must not intercept clicks meant for ones below.
  const visibility = useTransform(opacity, (v) =>
    v > 0.03 ? ("visible" as const) : ("hidden" as const)
  );
  return { opacity, visibility };
}

function TitleCard({
  progress,
  window: w,
}: {
  progress: MotionValue<number>;
  window: number[];
}) {
  const { opacity, visibility } = useFadeWindow(progress, w, "first");
  const y = useTransform(progress, [w[2], w[3]], [0, -36]);

  return (
    <motion.div
      className="absolute inset-0 flex flex-col justify-center px-6 sm:px-12 lg:px-20"
      style={{ opacity, visibility, y }}
    >
      <h1 className="text-6xl font-semibold leading-none tracking-tight sm:text-7xl lg:text-8xl">
        RONKE
        <span className="rv-gradient-text">VERSE</span>
      </h1>
      <p className="mt-6 max-w-md text-lg leading-relaxed text-foreground/85">
        The Blue Monke empire on Ronin. Two tokens, 6,969 NFTs, and a supply
        that only burns down.
      </p>
      <div className="mt-9 flex flex-wrap items-center gap-4">
        <a
          href={BUY_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-2xl bg-accent px-7 py-3.5 text-sm font-semibold text-accent-foreground transition-transform active:scale-[0.98]"
          style={{ boxShadow: "0 8px 30px rgba(39,185,252,0.32)" }}
        >
          Buy $RONKE
        </a>
        <a
          href={COLLECTION_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="rv-hover rounded-2xl border border-border bg-card/80 px-7 py-3.5 text-sm font-semibold text-foreground"
        >
          Explore the collection
        </a>
      </div>
    </motion.div>
  );
}

function TextBlock({
  chapter,
  index,
  progress,
  window: w,
}: {
  chapter: (typeof CHAPTERS)[number];
  index: number;
  progress: MotionValue<number>;
  window: number[];
}) {
  const { opacity, visibility } = useFadeWindow(
    progress,
    w,
    index === N - 1 ? "last" : "middle"
  );
  const y = useTransform(progress, [w[0], w[1], w[2], w[3]], [42, 0, 0, -36]);

  return (
    <motion.div
      className="absolute inset-0 flex max-w-2xl flex-col justify-center px-6 sm:px-12 lg:px-20"
      style={{ opacity, visibility, y }}
    >
      <h2 className="text-4xl font-semibold leading-none tracking-tight sm:text-5xl lg:text-6xl">
        {chapter.title}
      </h2>
      <p className="mt-5 max-w-md text-base leading-relaxed text-foreground/85 sm:text-lg">
        {chapter.text}
      </p>
      {"cta" in chapter && chapter.cta && (
        <div className="mt-8">
          <a
            href="#burnonomics"
            className="inline-block rounded-2xl bg-accent px-6 py-3 text-sm font-semibold text-accent-foreground transition-transform active:scale-[0.98]"
            style={{ boxShadow: "0 8px 30px rgba(39,185,252,0.32)" }}
          >
            See the burn
          </a>
        </div>
      )}
    </motion.div>
  );
}

function ChapterVideo({
  chapter,
  index,
  progress,
  near,
  videoRef,
}: {
  chapter: (typeof CHAPTERS)[number];
  index: number;
  progress: MotionValue<number>;
  near: boolean;
  videoRef: (el: HTMLVideoElement | null) => void;
}) {
  const F = 0.045;
  const start = index / N;
  const end = (index + 1) / N;
  const opacity = useTransform(
    progress,
    index === 0
      ? [0, end - F, end + F]
      : index === N - 1
        ? [start - F, start + F, 1]
        : [start - F, start + F, end - F, end + F],
    index === 0 ? [1, 1, 0] : index === N - 1 ? [0, 1, 1] : [0, 1, 1, 0]
  );
  return (
    <motion.div className="absolute inset-0" style={{ opacity }}>
      <video
        ref={videoRef}
        src={near ? chapter.video : undefined}
        poster={chapter.poster}
        muted
        loop
        playsInline
        preload={near ? (index === 0 ? "auto" : "metadata") : "none"}
        aria-hidden
        className="h-full w-full object-cover"
      />
      <Scrim />
    </motion.div>
  );
}

function StaticFilm() {
  return (
    <section id="film" className="border-b border-border">
      <div className="relative flex min-h-[100dvh] items-center overflow-hidden">
        <Image
          src="/film/poster1.jpg"
          alt=""
          fill
          priority
          sizes="100vw"
          className="object-cover"
        />
        <Scrim />
        <div className="relative mx-auto w-full max-w-6xl px-4 pb-16 pt-24 sm:px-6">
          <h1 className="text-6xl font-semibold leading-none tracking-tight sm:text-7xl lg:text-8xl">
            RONKE
            <span className="rv-gradient-text">VERSE</span>
          </h1>
          <p className="mt-6 max-w-md text-lg leading-relaxed text-foreground/85">
            The Blue Monke empire on Ronin. Two tokens, 6,969 NFTs, and a
            supply that only burns down.
          </p>
          <div className="mt-9 flex flex-wrap items-center gap-4">
            <a
              href={BUY_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-2xl bg-accent px-7 py-3.5 text-sm font-semibold text-accent-foreground"
              style={{ boxShadow: "0 8px 30px rgba(39,185,252,0.32)" }}
            >
              Buy $RONKE
            </a>
            <a
              href={COLLECTION_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="rv-hover rounded-2xl border border-border bg-card/80 px-7 py-3.5 text-sm font-semibold text-foreground"
            >
              Explore the collection
            </a>
          </div>
        </div>
      </div>
      <div className="mx-auto max-w-6xl px-4 py-24 sm:px-6">
        <div className="grid gap-8 sm:grid-cols-3">
          {CHAPTERS.slice(1).map((c) => (
            <figure key={c.id} className="m-0">
              <Image
                src={c.poster}
                alt=""
                width={960}
                height={540}
                className="w-full rounded-2xl border border-border"
              />
              <figcaption className="mt-4">
                <div className="font-semibold">{c.title}</div>
                <p className="mt-1 text-sm leading-relaxed text-muted-1">
                  {c.text}
                </p>
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}

export default function ScrollCinema() {
  const [mounted, setMounted] = useState(false);
  const reduced = useReducedMotion();

  // Data-saver / very slow connections get the static layout.
  const [lite] = useState(() => {
    if (typeof navigator === "undefined") return false;
    const c = (
      navigator as Navigator & {
        connection?: { saveData?: boolean; effectiveType?: string };
      }
    ).connection;
    return Boolean(c && (c.saveData || /(^|-)2g$/.test(c.effectiveType || "")));
  });

  useEffect(() => setMounted(true), []);

  if (!mounted || reduced || lite) {
    // SSR / first paint / reduced-motion / data-saver: static tier. The live
    // tiers mount as a separate child so its useScroll initializes with the
    // pinned track actually present in the tree (a null-ref useScroll never
    // re-measures and progress sticks at 0).
    return <StaticFilm />;
  }
  return <CinemaLive />;
}

function CinemaLive() {
  const trackRef = useRef<HTMLElement | null>(null);
  const filmRef = useRef<HTMLVideoElement | null>(null);
  const chapterVideoRefs = useRef<(HTMLVideoElement | null)[]>(
    CHAPTERS.map(() => null)
  );
  const progressRef = useRef(0);
  const smoothRef = useRef(0);
  const [active, setActive] = useState(0);
  const reduced = useReducedMotion();
  // The hero film loads immediately - it IS the page opening.
  const near = true;

  // Scrub only where it works: precise pointers on wide screens.
  const [scrub] = useState(
    () =>
      typeof window !== "undefined" &&
      window.matchMedia("(pointer: fine)").matches &&
      window.innerWidth >= 900
  );

  const { scrollYProgress } = useScroll({
    target: trackRef,
    offset: ["start start", "end end"],
  });

  // Scrub tier: pull the whole all-intra film into memory and play it from a
  // blob URL. Every seek then lands instantly with zero network stalls - the
  // property scroll-scrubbing depends on. Falls back to streaming the file
  // directly if the fetch fails.
  const [filmSrc, setFilmSrc] = useState<string | null>(null);
  useEffect(() => {
    if (!scrub) return;
    let objectUrl: string | null = null;
    const ctrl = new AbortController();
    fetch(FILM.src, { signal: ctrl.signal })
      .then((r) => (r.ok ? r.blob() : Promise.reject(r.status)))
      .then((blob) => {
        objectUrl = URL.createObjectURL(blob);
        setFilmSrc(objectUrl);
      })
      .catch(() => {
        if (!ctrl.signal.aborted) setFilmSrc(FILM.src);
      });
    return () => {
      ctrl.abort();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [scrub]);

  useEffect(() => {
    if (reduced) return;
    const unsub = scrollYProgress.on("change", (p) => {
      progressRef.current = p;
      const idx = scrub
        ? FILM_BOUNDS.filter((b) => p >= b).length
        : Math.min(N - 1, Math.max(0, Math.floor(p * N)));
      setActive((prev) => (prev === idx ? prev : idx));
    });
    return unsub;
  }, [scrollYProgress, reduced, scrub]);

  // Scrub loop: ease the playhead toward the scroll target every frame.
  // The film is all-intra (keyint=1), so seeks land instantly on any frame.
  useEffect(() => {
    if (!scrub || reduced) return;
    let raf: number;
    const tick = () => {
      const v = filmRef.current;
      if (v && v.duration && !Number.isNaN(v.duration)) {
        const target = progressRef.current * (v.duration - 0.05);
        smoothRef.current += (target - smoothRef.current) * 0.14;
        if (Math.abs(v.currentTime - smoothRef.current) > 0.02) {
          try {
            v.currentTime = smoothRef.current;
          } catch {
            /* not seekable yet */
          }
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [scrub, reduced]);

  // Touch mode: only the active chapter's loop plays.
  useEffect(() => {
    if (scrub || reduced) return;
    chapterVideoRefs.current.forEach((v, i) => {
      if (!v) return;
      if (i === active) {
        const p = v.play();
        if (p?.catch) p.catch(() => {});
      } else if (!v.paused) {
        v.pause();
      }
    });
  }, [active, scrub, reduced]);

  return (
    <section
      id="film"
      ref={trackRef}
      className="relative bg-[#020306]"
      style={{ height: scrub ? "900vh" : `${N * 120}vh` }}
      aria-label="Ronkeverse, the film"
    >
      <div className="sticky top-0 h-[100dvh] overflow-hidden border-b border-border">
        {scrub ? (
          <div className="absolute inset-0">
            <video
              ref={filmRef}
              src={filmSrc ?? undefined}
              poster={CHAPTERS[0].poster}
              muted
              playsInline
              preload="auto"
              aria-hidden
              className="h-full w-full object-cover"
            />
            <Scrim />
          </div>
        ) : (
          CHAPTERS.map((c, i) => (
            <ChapterVideo
              key={c.id}
              chapter={c}
              index={i}
              progress={scrollYProgress}
              near={near}
              videoRef={(el) => {
                chapterVideoRefs.current[i] = el;
              }}
            />
          ))
        )}

        <div className="absolute inset-0 z-[2]">
          <TitleCard progress={scrollYProgress} window={titleWindow(scrub)} />
          {CHAPTERS.map((c, i) =>
            i === 0 ? null : (
              <TextBlock
                key={c.id}
                chapter={c}
                index={i}
                progress={scrollYProgress}
                window={scrub ? filmWindow(i) : chapterWindow(i)}
              />
            )
          )}
        </div>
      </div>
    </section>
  );
}
