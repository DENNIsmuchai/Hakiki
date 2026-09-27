import { Wordmark } from "../components/Wordmark";
import { useAuth } from "../lib/authContext";
import { supabase, isSupabaseConfigured } from "../lib/supabase";

export function Navbar({ className = "" }) {
  const { session } = useAuth();

  return (
    <header
      className={`
        sticky top-0 z-40 bg-paper/80 backdrop-blur-md border-b-2 border-ink/10
        ${className}
      `}
    >
      <div className="max-w-6xl mx-auto flex items-center justify-between px-5 py-4">
        <a href="/seller" className="no-underline">
          <Wordmark />
        </a>
        <nav className="font-mono text-sm flex items-center gap-6">
          <a
            className="no-underline text-ink hover:text-yellow-text transition-colors duration-150"
            href="/seller"
          >
            Dashboard
          </a>
          <a
            className="no-underline text-ink hover:text-yellow-text transition-colors duration-150"
            href="/seller/new"
          >
            New
          </a>
          {isSupabaseConfigured && session && (
            <button
              type="button"
              onClick={() => supabase.auth.signOut().then(() => { window.location.href = "/auth"; })}
              className="text-ink/60 hover:text-danger transition-colors duration-150"
            >
              Sign out
            </button>
          )}
        </nav>
      </div>
    </header>
  );
}
