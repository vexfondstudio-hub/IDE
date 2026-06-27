import { useCallback, useEffect, useState } from "react";
import {
  AuthProfile,
  getGithubProfile,
  githubSignIn,
  googleSignIn,
  initAuth,
  logout,
} from "../lib/auth";

export function useAuth() {
  const [user, setUser] = useState<AuthProfile | null>(() => getGithubProfile());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = initAuth(
      (profile) => {
        setUser(profile);
        setLoading(false);
        setError(null);
      },
      () => {
        setUser(null);
        setLoading(false);
      },
    );
    return () => unsubscribe();
  }, []);

  const signInGoogle = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const profile = await googleSignIn();
      if (profile) setUser(profile);
      return profile;
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Ошибка входа через Google";
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const signInGithub = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const profile = await githubSignIn();
      if (profile) setUser(profile);
      return profile;
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Ошибка входа через GitHub";
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const signOut = useCallback(async () => {
    setLoading(true);
    await logout();
    setUser(null);
    setLoading(false);
  }, []);

  return {
    user,
    loading,
    error,
    signInGoogle,
    signInGithub,
    signOut,
    isLoggedIn: Boolean(user),
  };
}
