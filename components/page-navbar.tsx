"use client";

import Image from "next/image";
import Link from "next/link";

const NAV_ITEMS = [
  { href: "/", label: "HOME" },
  { href: "/score", label: "SCORE" },
  { href: "/gallery", label: "GALLERY" },
  { href: "/passport", label: "PASSPORT" },
];

export default function PageNavbar() {
  return (
    <nav className="fixed top-0 left-0 right-0 z-50">
      <div
        className="border-b border-border"
        style={{
          backdropFilter: "blur(14px)",
          WebkitBackdropFilter: "blur(14px)",
          background: "rgba(7,8,12,0.72)",
        }}
      >
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="flex h-16 items-center justify-between">
            <Link href="/" className="flex items-center gap-3">
              <Image
                src="/ronke-logo.webp"
                alt=""
                width={36}
                height={36}
                className="rounded-full"
              />
              <span className="hidden text-sm font-semibold tracking-[0.14em] sm:inline">
                RONKE<span className="text-accent">VERSE</span>
              </span>
            </Link>

            <div className="flex items-center gap-6">
              {NAV_ITEMS.map((item) => (
                <a
                  key={item.href}
                  href={item.href}
                  className="text-[13px] font-medium tracking-wide text-muted-1 transition-colors hover:text-foreground"
                >
                  {item.label}
                </a>
              ))}
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
}
