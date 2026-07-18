"use client";

import Image from "next/image";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

const NAV_ITEMS = [
  { id: "film", label: "FILM" },
  { id: "score", label: "SCORE" },
  { id: "charts", label: "ECOSYSTEM" },
  { id: "ronin-strategy", label: "RONKESTR" },
  { id: "burnonomics", label: "BURNONOMICS" },
  { id: "ronke-casino", label: "PLAY" },
];

const EXTERNAL_ITEMS = [
  { href: "/gallery", label: "GALLERY" },
  { href: "/passport", label: "PASSPORT" },
];

export default function Navbar() {
  const pathname = usePathname();
  const [activeSection, setActiveSection] = useState("");
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    const sections = NAV_ITEMS.map((item) =>
      document.getElementById(item.id)
    ).filter((el): el is HTMLElement => el !== null);
    if (sections.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) setActiveSection(entry.target.id);
        }
      },
      // A slim band near the top of the viewport decides the active section.
      { rootMargin: "-20% 0px -70% 0px" }
    );
    sections.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  const scrollToSection = (sectionId: string) => {
    document
      .getElementById(sectionId)
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
    setIsMobileMenuOpen(false);
  };

  // Sub-pages (/score, /gallery, /passport) render their own PageNavbar;
  // this scroll-spy bar only makes sense on the landing page.
  if (pathname !== "/") return null;

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
            <a
              href="#top"
              onClick={(e) => {
                e.preventDefault();
                window.scrollTo({ top: 0, behavior: "smooth" });
              }}
              className="flex items-center gap-3"
              aria-label="Ronkeverse home"
            >
              <Image
                src="/ronke-logo.webp"
                alt=""
                width={36}
                height={36}
                className="rounded-full"
              />
              <span className="text-sm font-semibold tracking-[0.14em]">
                RONKE<span className="text-accent">VERSE</span>
              </span>
            </a>

            <div className="hidden items-center gap-6 lg:flex">
              {NAV_ITEMS.map((item) => (
                <button
                  key={item.id}
                  onClick={() => scrollToSection(item.id)}
                  className={`text-[13px] font-medium tracking-wide transition-colors ${
                    activeSection === item.id
                      ? "text-accent"
                      : "text-muted-1 hover:text-foreground"
                  }`}
                >
                  {item.label}
                </button>
              ))}
              <div className="h-5 w-px bg-border" />
              {EXTERNAL_ITEMS.map((item) => (
                <a
                  key={item.href}
                  href={item.href}
                  className="text-[13px] font-medium tracking-wide text-muted-1 transition-colors hover:text-foreground"
                >
                  {item.label}
                </a>
              ))}
            </div>

            <div className="lg:hidden">
              <button
                onClick={() => setIsMobileMenuOpen((open) => !open)}
                className="p-2 text-foreground"
                aria-label="Toggle menu"
                aria-expanded={isMobileMenuOpen}
              >
                <svg
                  className="h-6 w-6"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  {isMobileMenuOpen ? (
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  ) : (
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M4 6h16M4 12h16M4 18h16"
                    />
                  )}
                </svg>
              </button>
            </div>
          </div>

          <div
            className={`lg:hidden transition-all duration-300 ease-out ${
              isMobileMenuOpen
                ? "max-h-96 pb-4 opacity-100"
                : "max-h-0 overflow-hidden opacity-0"
            }`}
          >
            <div className="space-y-1 pt-2">
              {NAV_ITEMS.map((item) => (
                <button
                  key={item.id}
                  onClick={() => scrollToSection(item.id)}
                  className={`block w-full rounded-md px-3 py-2 text-left text-sm font-medium ${
                    activeSection === item.id
                      ? "bg-accent/10 text-accent"
                      : "text-muted-1 hover:bg-card hover:text-foreground"
                  }`}
                >
                  {item.label}
                </button>
              ))}
              <div className="my-2 border-t border-border" />
              {EXTERNAL_ITEMS.map((item) => (
                <a
                  key={item.href}
                  href={item.href}
                  className="block rounded-md px-3 py-2 text-sm font-medium text-muted-1 hover:bg-card hover:text-foreground"
                  onClick={() => setIsMobileMenuOpen(false)}
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
