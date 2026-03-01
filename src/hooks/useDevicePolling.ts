import { useCallback, useEffect, useRef, useState } from "react";
import type { CurrentContext, ContextEntry, QuickStat } from "../types";
import {
  fetchCurrentContext,
  fetchQuickStats,
  fetchTimeline,
  fetchAlerts,
} from "../data/api";
import { POLL_CONTEXT_MS, POLL_TIMELINE_MS } from "../config";
import { mockCurrentContext, mockQuickStats, mockTimeline } from "../data/mockContext";

export function useDeviceContext() {
  const [context, setContext] = useState<CurrentContext>(mockCurrentContext);
  const [stats, setStats] = useState<QuickStat[]>(mockQuickStats);
  const [connected, setConnected] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval>>();

  const poll = useCallback(async () => {
    try {
      const [ctx, qs] = await Promise.all([
        fetchCurrentContext(),
        fetchQuickStats(),
      ]);
      setContext(ctx);
      setStats(qs);
      setConnected(true);
    } catch {
      setConnected(false);
    }
  }, []);

  useEffect(() => {
    poll();
    intervalRef.current = setInterval(poll, POLL_CONTEXT_MS);
    return () => clearInterval(intervalRef.current);
  }, [poll]);

  return { context, stats, connected, refresh: poll };
}

export function useDeviceTimeline() {
  const [timeline, setTimeline] = useState<ContextEntry[]>(mockTimeline);
  const [connected, setConnected] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval>>();

  const poll = useCallback(async () => {
    try {
      const entries = await fetchTimeline();
      if (entries.length > 0) setTimeline(entries);
      setConnected(true);
    } catch {
      setConnected(false);
    }
  }, []);

  useEffect(() => {
    poll();
    intervalRef.current = setInterval(poll, POLL_TIMELINE_MS);
    return () => clearInterval(intervalRef.current);
  }, [poll]);

  return { timeline, connected, refresh: poll };
}

const SUPPRESSED_PATTERNS = [
  "vision unavailable",
  "all providers failed",
  "rate_limit",
  "rate limit",
  "backing off",
  "llm_router",
  "tool_error",
];

function isTechnicalNoise(msg: string): boolean {
  const lower = msg.toLowerCase();
  return SUPPRESSED_PATTERNS.some((p) => lower.includes(p));
}

export function useDeviceAlerts(onAlert?: (msg: string, severity: string) => void) {
  const lastAlertRef = useRef<string>("");

  const poll = useCallback(async () => {
    try {
      const alerts = await fetchAlerts();
      if (alerts.length === 0) return;
      const latest = alerts[alerts.length - 1];
      const key = latest.timestamp + latest.event_type;
      if (key !== lastAlertRef.current) {
        lastAlertRef.current = key;
        const sev = latest.severity ?? "warning";
        const time = new Date(latest.timestamp).toLocaleTimeString([], {
          hour: "numeric",
          minute: "2-digit",
        });

        const rawMsg =
          latest.data?.message ?? latest.data?.detail ?? "";
        if (isTechnicalNoise(rawMsg)) return;

        if (latest.event_type === "family_alert") {
          onAlert?.(rawMsg || "Family alert received", sev);
        } else if (latest.event_type === "fall_detected" || latest.event_type === "critical_event") {
          onAlert?.(`Fall detected at ${time}`, "critical");
        } else if (sev === "critical" || sev === "warning") {
          onAlert?.(
            rawMsg || `Alert: ${latest.event_type.replace(/_/g, " ")}`,
            sev,
          );
        }
      }
    } catch {
      // device offline
    }
  }, [onAlert]);

  useEffect(() => {
    poll();
    const id = setInterval(poll, 3000);
    return () => clearInterval(id);
  }, [poll]);
}
