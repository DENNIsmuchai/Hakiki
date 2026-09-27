import { createContext, useContext, useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { supabase, isSupabaseConfigured } from "./supabase";

const AuthContext = createContext({ session: null, loading: false });

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(isSupabaseConfigured);

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) {
      setLoading(false);
      return;
    }
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  return <AuthContext.Provider value={{ session, loading }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}

// Gates the /seller* routes. When Supabase isn't configured, the whole app
// runs in local/mock mode (mirrors the pattern used throughout services/) and
// every route stays open — this guard only matters for a real deployment.
export function RequireAuth({ children }) {
  const { session, loading } = useAuth();
  if (!isSupabaseConfigured) return children;
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center font-mono text-sm text-navy-400">
        Loading…
      </div>
    );
  }
  if (!session) return <Navigate to="/auth" replace />;
  return children;
}
