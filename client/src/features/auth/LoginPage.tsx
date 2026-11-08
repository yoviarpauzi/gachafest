import { Link } from "@tanstack/react-router";
import { GoldWaves } from "../../components/GoldWaves";
import { Wordmark } from "../../components/Wordmark";
import { LoginCard } from "./LoginCard";

export function LoginPage() {
  return (
    <div className="relative flex min-h-dvh flex-col overflow-hidden bg-black-950">
      <GoldWaves className="absolute top-22.5 left-1/2 -translate-x-1/2" />

      <header className="relative flex items-center justify-between gap-4 px-4 py-6 md:px-24">
        <Wordmark />
        <Link
          to="/"
          className="rounded-full px-6 py-3 font-display text-button-md text-ink outline-offset-2 focus-visible:outline-2 focus-visible:outline-gold-300"
        >
          Back to event page
        </Link>
      </header>

      <main className="relative flex flex-1 items-center justify-center px-4 py-8">
        <LoginCard />
      </main>

      <footer className="relative px-4 py-6 text-center text-body-sm text-gold-muted md:px-24">
        © 2026 Gachafest
      </footer>
    </div>
  );
}
