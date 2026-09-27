import { useState } from "react";
import { useNavigate, Navigate } from "react-router-dom";
import { supabase, isSupabaseConfigured } from "../lib/supabase";
import { useAuth } from "../lib/authContext";
import { Card } from "../components/Card";
import { Button } from "../components/Button";
import { Wordmark } from "../components/Wordmark";

const inputBase =
  "w-full border-2 border-ink rounded-xl px-4 py-3 font-body bg-paper text-ink placeholder:text-ink-muted/50 focus:outline-none focus:border-yellow-deep focus:ring-2 focus:ring-yellow-light transition-all duration-150";

export default function Auth() {
  const navigate = useNavigate();
  const { session } = useAuth();

  const [mode, setMode] = useState("signin"); // "signin" | "signup"
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const [info, setInfo] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  // Local/demo mode has no auth to sign in to — send straight to the dashboard.
  if (!isSupabaseConfigured) return <Navigate to="/seller" replace />;
  if (session) return <Navigate to="/seller" replace />;

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setSubmitting(true);
    try {
      if (mode === "signin") {
        const { error: err } = await supabase.auth.signInWithPassword({ email, password });
        if (err) throw err;
        navigate("/seller");
      } else {
        const { error: err } = await supabase.auth.signUp({ email, password });
        if (err) throw err;
        setInfo("Account created. Check your email if confirmation is required, then sign in.");
        setMode("signin");
      }
    } catch (err) {
      setError(err?.message || "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-5">
      <div className="w-full max-w-sm">
        <div className="flex justify-center mb-8">
          <Wordmark />
        </div>
        <Card className="p-6 md:p-8">
          <h1 className="font-display text-3xl tracking-wide mb-1">
            {mode === "signin" ? "Seller sign in" : "Create seller account"}
          </h1>
          <p className="font-body text-ink-muted text-sm mb-6">
            {mode === "signin"
              ? "Manage your Hakiki transactions."
              : "Start creating verified payment links."}
          </p>

          {error && (
            <div className="border-2 border-danger bg-danger-light text-danger font-body text-sm rounded-xl p-3 mb-4">
              {error}
            </div>
          )}
          {info && (
            <div className="border-2 border-ink/10 bg-ink-soft/30 text-ink font-body text-sm rounded-xl p-3 mb-4">
              {info}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <input
              type="email"
              required
              autoComplete="email"
              className={inputBase}
              placeholder="you@business.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <input
              type="password"
              required
              minLength={6}
              autoComplete={mode === "signin" ? "current-password" : "new-password"}
              className={inputBase}
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <Button type="submit" variant="primary" size="lg" className="w-full" disabled={submitting}>
              {submitting ? "Please wait…" : mode === "signin" ? "Sign in" : "Create account"}
            </Button>
          </form>

          <button
            type="button"
            onClick={() => {
              setMode(mode === "signin" ? "signup" : "signin");
              setError(null);
              setInfo(null);
            }}
            className="mt-5 font-mono text-sm text-yellow-deep hover:underline w-full text-center"
          >
            {mode === "signin" ? "Need an account? Sign up" : "Already have an account? Sign in"}
          </button>
        </Card>
      </div>
    </div>
  );
}
