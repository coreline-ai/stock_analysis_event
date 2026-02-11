"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

type ToastType = "info" | "success" | "error";

export interface ToastMessage {
  id: number;
  type: ToastType;
  message: string;
}

interface DashboardContextValue {
  token: string;
  setToken: (value: string) => void;
  refreshKey: number;
  requestRefresh: () => void;
  authRequired: boolean;
  setAuthRequired: (value: boolean) => void;
  pushToast: (message: string, type?: ToastType) => void;
  removeToast: (id: number) => void;
  toasts: ToastMessage[];
}

const TOKEN_KEY = "api_token";
const LEGACY_TOKEN_KEY = "mahoraga_api_token";

const DashboardContext = createContext<DashboardContextValue | null>(null);

export function DashboardProvider({ children }: { children: React.ReactNode }) {
  const [token, setTokenState] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [authRequired, setAuthRequired] = useState(false);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  useEffect(() => {
    const stored = window.sessionStorage.getItem(TOKEN_KEY) ?? window.sessionStorage.getItem(LEGACY_TOKEN_KEY);
    if (stored) setTokenState(stored);
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (!loaded) return;
    if (!token) {
      window.sessionStorage.removeItem(TOKEN_KEY);
      window.sessionStorage.removeItem(LEGACY_TOKEN_KEY);
      return;
    }
    window.sessionStorage.setItem(TOKEN_KEY, token);
    window.sessionStorage.setItem(LEGACY_TOKEN_KEY, token);
  }, [loaded, token]);

  const setToken = useCallback((value: string) => {
    setTokenState(value.trim());
  }, []);

  const requestRefresh = useCallback(() => {
    setRefreshKey((prev) => prev + 1);
  }, []);

  const pushToast = useCallback((message: string, type: ToastType = "info") => {
    const id = Date.now() + Math.floor(Math.random() * 1000);
    setToasts((prev) => [...prev, { id, type, message }]);
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3600);
  }, []);

  const removeToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const value = useMemo<DashboardContextValue>(
    () => ({
      token,
      setToken,
      refreshKey,
      requestRefresh,
      authRequired,
      setAuthRequired,
      pushToast,
      removeToast,
      toasts
    }),
    [token, setToken, refreshKey, requestRefresh, authRequired, pushToast, removeToast, toasts]
  );

  return <DashboardContext.Provider value={value}>{children}</DashboardContext.Provider>;
}

export function useDashboardContext(): DashboardContextValue {
  const ctx = useContext(DashboardContext);
  if (!ctx) throw new Error("DashboardContext missing");
  return ctx;
}
