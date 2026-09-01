"use client";

import { useCallback, useEffect, useRef } from "react";

/**
 * Page sound effects.
 *
 * Shares the music toggle's preference rather than adding a second control —
 * one switch for "does this page make noise" is what people expect, and two
 * would mean explaining the difference.
 *
 * Every slot is optional: a name whose file is not there yet simply does
 * nothing, so cues can be wired before the audio exists. A failure is retried
 * a couple of times before the slot is given up on, because a dev server
 * restarting mid-session should not silence a sound for good.
 */

export type SoundName = "questComplete" | "sweep" | "click" | "error" | "connect";

const FILES: Record<SoundName, string> = {
  questComplete: "/sfx/quest-complete.mp3",
  sweep: "/sfx/sweep.mp3",
  click: "/sfx/click.mp3",
  error: "/sfx/error.mp3",
  connect: "/sfx/connect.mp3",
};

/** Kept well under the music so a cue lands without startling anyone. */
const LEVELS: Record<SoundName, number> = {
  questComplete: 0.5,
  sweep: 0.55,
  click: 0.18,
  error: 0.3,
  connect: 0.35,
};

const STORAGE_KEY = "ronke-quests-music";

export function soundEnabled(): boolean {
  try {
    return window.localStorage.getItem(STORAGE_KEY) !== "off";
  } catch {
    return true;
  }
}

export function useSounds() {
  const cache = useRef(new Map<SoundName, HTMLAudioElement>());
  const failures = useRef(new Map<SoundName, number>());

  useEffect(() => {
    const pool = cache.current;
    return () => {
      pool.forEach((element) => element.pause());
      pool.clear();
    };
  }, []);

  return useCallback((name: SoundName) => {
    if (typeof window === "undefined" || !soundEnabled()) return;
    if ((failures.current.get(name) ?? 0) >= 3) return;

    let element = cache.current.get(name);
    if (!element) {
      element = new Audio(FILES[name]);
      element.preload = "auto";
      element.addEventListener(
        "error",
        () => {
          failures.current.set(name, (failures.current.get(name) ?? 0) + 1);
          // Drop the broken element so the next attempt starts a fresh load
          // rather than replaying a element stuck in an error state.
          cache.current.delete(name);
        },
        { once: true }
      );
      cache.current.set(name, element);
    }

    element.volume = LEVELS[name];
    try {
      element.currentTime = 0;
    } catch {
      // Not seekable yet; playing from wherever it is beats not playing.
    }
    // Overlapping cues are fine; a rejected play just means no sound.
    void element.play().catch(() => {});
  }, []);
}
