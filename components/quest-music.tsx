"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Volume2, VolumeX } from "lucide-react";

/**
 * Page music.
 *
 * Browsers refuse to start audio without a gesture, so this cannot simply
 * autoplay: it tries, and when that is blocked it arms a one-shot listener and
 * starts on the visitor's first click or keypress instead. The choice is
 * remembered, so someone who mutes it once is not asked again.
 *
 * The file is only fetched when it is actually going to play — a background
 * loop should cost nothing to anyone who never turns it on.
 *
 * The <audio> is a real node in the tree rather than `new Audio()`: Chrome
 * aborts play() on a detached element with "the media was removed from the
 * document", which fails silently and looks exactly like a blocked autoplay.
 */

const STORAGE_KEY = "ronke-quests-music";
const TRACK = "/rs.mp3";
const VOLUME = 0.35;
const FADE_MS = 900;

export default function QuestMusic() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const fadeRef = useRef<number | null>(null);
  const [playing, setPlaying] = useState(false);
  /** Null until the stored preference is read, so the button never flickers. */
  const [wanted, setWanted] = useState<boolean | null>(null);

  /** Ramps volume so the loop does not slam in at full level. */
  const fadeTo = useCallback((target: number) => {
    const element = audioRef.current;
    if (!element) return;
    if (fadeRef.current) window.clearInterval(fadeRef.current);

    const from = element.volume;
    const started = performance.now();
    fadeRef.current = window.setInterval(() => {
      const t = Math.min(1, (performance.now() - started) / FADE_MS);
      element.volume = from + (target - from) * t;
      if (t >= 1) {
        if (fadeRef.current) window.clearInterval(fadeRef.current);
        fadeRef.current = null;
        if (target === 0) element.pause();
      }
    }, 40);
  }, []);

  const start = useCallback(async () => {
    const element = audioRef.current;
    if (!element) return false;
    element.volume = 0;
    try {
      await element.play();
      fadeTo(VOLUME);
      setPlaying(true);
      return true;
    } catch {
      // Blocked until a gesture — the listener below picks it up.
      return false;
    }
  }, [fadeTo]);

  useEffect(() => {
    let stored: string | null = null;
    try {
      stored = window.localStorage.getItem(STORAGE_KEY);
    } catch {
      // Storage refused; treat as no preference.
    }
    setWanted(stored !== "off");
  }, []);

  // Try immediately, then fall back to the first gesture on the page.
  useEffect(() => {
    if (wanted !== true) return;
    let cancelled = false;

    const arm = () => {
      const onGesture = () => {
        void start();
        document.removeEventListener("pointerdown", onGesture);
        document.removeEventListener("keydown", onGesture);
      };
      document.addEventListener("pointerdown", onGesture, { once: true });
      document.addEventListener("keydown", onGesture, { once: true });
      return () => {
        document.removeEventListener("pointerdown", onGesture);
        document.removeEventListener("keydown", onGesture);
      };
    };

    let disarm: (() => void) | undefined;
    void start().then((ok) => {
      if (!ok && !cancelled) disarm = arm();
    });

    return () => {
      cancelled = true;
      disarm?.();
    };
  }, [wanted, start]);

  useEffect(
    () => () => {
      if (fadeRef.current) window.clearInterval(fadeRef.current);
      audioRef.current?.pause();
    },
    []
  );

  const toggle = () => {
    const next = !playing;
    try {
      window.localStorage.setItem(STORAGE_KEY, next ? "on" : "off");
    } catch {
      // Not being able to remember it is not a reason to refuse the toggle.
    }
    setWanted(next);

    if (next) {
      void start();
    } else {
      fadeTo(0);
      setPlaying(false);
    }
  };

  // One tree, always. Returning a different shape before the preference loads
  // would remount the <audio> and restart whatever was playing.
  return (
    <>
      <audio ref={audioRef} src={TRACK} loop preload="none" playsInline />

      {wanted !== null && (
      <button
        onClick={toggle}
      aria-pressed={playing}
      aria-label={playing ? "Mute the music" : "Play the music"}
      title={playing ? "Mute" : "Play music"}
        className="fixed bottom-5 right-5 z-50 inline-flex items-center gap-2 rounded-full border border-border bg-card/90 px-3.5 py-2.5 backdrop-blur transition-colors hover:border-accent/50"
      >
        {playing ? (
          <Volume2 className="h-4 w-4 text-accent" strokeWidth={2} />
        ) : (
          <VolumeX className="h-4 w-4 text-muted-2" strokeWidth={2} />
        )}

        {/* A small equaliser so it reads as "sound is on" at a glance. */}
        <span className="flex h-3.5 items-end gap-[2px]" aria-hidden>
          {[0, 1, 2].map((bar) => (
            <span
              key={bar}
              className={playing ? "eq-bar" : ""}
              style={{
                width: 2,
                height: playing ? undefined : 3,
                background: playing ? "var(--accent)" : "var(--muted-3)",
                borderRadius: 1,
                animationDelay: `${bar * 0.16}s`,
              }}
            />
          ))}
        </span>
      </button>
      )}
    </>
  );
}
