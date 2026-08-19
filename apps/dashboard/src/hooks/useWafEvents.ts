import { useEffect, useRef, useState, useCallback } from 'react';
import axios from 'axios';
import { WsEvent, Decision } from '../types';

const WS_URL = import.meta.env.VITE_WS_URL ?? (
  typeof window !== 'undefined' && window.location.protocol === 'https:'
    ? `wss://${window.location.host}/events`
    : `ws://${window.location.hostname}:3001/events`
);
const RECONNECT_DELAY_MS = 3000;
const MAX_EVENTS = 200;

export function useWafEvents() {
  const [events, setEvents] = useState<WsEvent[]>([]);
  const [connected, setConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout>>();

  // Load initial audit events from database so the audit log is never empty on load
  const loadInitialEvents = useCallback(async () => {
    try {
      const res = await axios.get('/api/audit/events?limit=100');
      if (res.data?.events) {
        const mapped: WsEvent[] = res.data.events.map((tc: any) => ({
          type: tc.decision as Decision,
          payload: {
            id: tc.id,
            agentId: tc.agentId,
            sessionId: tc.sessionId,
            tool: tc.tool,
            sanitizedParams: tc.parameters ?? {},
            riskScore: tc.riskScore ?? 0,
            decision: tc.decision as Decision,
            shadowMode: tc.shadowMode ?? false,
            reason: tc.reason ?? undefined,
            rulesEvaluated: tc.rulesEvaluated ?? [],
            matchedRules: tc.matchedRules ?? [],
            latencyMs: tc.latencyMs ?? 0,
            createdAt: tc.createdAt,
          },
        }));
        setEvents(mapped);
      }
    } catch (err) {
      console.warn('[Audit] Could not load initial events', err);
    }
  }, []);

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    try {
      const ws = new WebSocket(WS_URL);
      wsRef.current = ws;

      ws.onopen = () => {
        setConnected(true);
        console.log('[WS] Connected to AegisWAF event stream');
      };

      ws.onmessage = (msg) => {
        try {
          const event = JSON.parse(msg.data) as WsEvent;
          if ((event as any).type === 'CONNECTED') return; // welcome ping

          setEvents((prev) => [event, ...prev].slice(0, MAX_EVENTS));
        } catch (e) {
          console.error('[WS] Failed to parse event', e);
        }
      };

      ws.onclose = () => {
        setConnected(false);
        console.log('[WS] Disconnected — reconnecting in 3s...');
        reconnectTimer.current = setTimeout(connect, RECONNECT_DELAY_MS);
      };

      ws.onerror = () => {
        ws.close();
      };
    } catch (err) {
      console.error('[WS] Connection failed', err);
      reconnectTimer.current = setTimeout(connect, RECONNECT_DELAY_MS);
    }
  }, []);

  useEffect(() => {
    loadInitialEvents();
    connect();
    return () => {
      clearTimeout(reconnectTimer.current);
      wsRef.current?.close();
    };
  }, [loadInitialEvents, connect]);

  const clearEvents = useCallback(() => setEvents([]), []);
  const refreshEvents = useCallback(() => loadInitialEvents(), [loadInitialEvents]);

  return { events, connected, clearEvents, refreshEvents };
}
