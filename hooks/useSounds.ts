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
 * nothing, so cues can be wired before the audio exists.
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
  const missing = useRef(new Set<SoundName>());

  useEffect(() => {
    const pool = cache.current;
    return () => {
      pool.forEach((element) => element.pause());
      pool.clear();
    };
  }, []);

  return useCallback((name: SoundName) => {
    if (typeof window === "undefined" || !soundEnabled() || missing.current.has(name)) return;

    let element = cache.current.get(name);
    if (!element) {
      element = new Audio(FILES[name]);
      element.preload = "auto";
      // A slot with no file yet should stay silent rather than retry forever.
      element.addEventListener("error", () => missing.current.add(name), { once: true });
      cache.current.set(name, element);
    }

    element.volume = LEVELS[name];
    element.currentTime = 0;
    // Overlapping cues are fine; a rejected play just means no sound.
    void element.play().catch(() => {});
  }, []);
}
