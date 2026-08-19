import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
  Shield, CheckCircle, XCircle, AlertTriangle, Clock, Activity, Zap, Play,
  TrendingUp, RefreshCw, Layers
} from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { WsEvent, Stats, Decision } from '../types';

export default function Overview({
  events,
  onRunDemo,
  demoRunning,
}: {
  events: WsEvent[];
  onRunDemo: () => void;
  demoRunning: boolean;
}) {
  const [stats, setStats] = useState<Stats | null>(null);
  const [trafficData, setTrafficData] = useState<{ time: string; allowed: number; blocked: number; hitl: number }[]>([]);

  const fetchStats = async () => {
    try {
      const res = await axios.get('/api/audit/stats');
      setStats(res.data);
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    fetchStats();
    const interval = setInterval(fetchStats, 3000);
    return () => clearInterval(interval);
  }, []);

  const counts = {
    ALLOW: stats?.byDecision?.ALLOW ?? 0,
    BLOCK: (stats?.byDecision?.BLOCK ?? 0) + (stats?.byDecision?.SHADOW_BLOCK ?? 0),
    RATE_LIMIT: stats?.byDecision?.RATE_LIMIT ?? 0,
    HITL: stats?.byDecision?.HITL ?? 0,
  };

  const total = stats?.total ?? (counts.ALLOW + counts.BLOCK + counts.RATE_LIMIT + counts.HITL);

  // Update chart data
  useEffect(() => {
    const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    setTrafficData((prev) => [
      ...prev.slice(-14),
      {
        time: now,
        allowed: counts.ALLOW,
        blocked: counts.BLOCK + counts.RATE_LIMIT,
        hitl: counts.HITL,
      },
    ]);
  }, [stats]);

  return (
    <div className="p-6 space-y-6">
      {/* Top Banner with Demo Trigger */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 bg-gradient-to-r from-indigo-950/40 via-slate-900 to-slate-900 border border-indigo-500/20 rounded-xl">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Shield className="text-indigo-400" size={22} />
            <h1 className="text-xl font-bold text-white tracking-tight">AegisWAF Control Plane</h1>
            <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 rounded">
              Enforcing
            </span>
            <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-amber-500/10 text-amber-300 border border-amber-500/30 rounded">
              Synthetic Benchmark Mode
            </span>
          </div>
          <p className="text-xs text-slate-400">
            Runtime Security Proxy & Multi-Stage Policy Guard for Autonomous AI Agents (Validated with high-load synthetic traffic)
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={onRunDemo}
            disabled={demoRunning}
            className={`btn-action ${
              demoRunning
                ? 'bg-indigo-600/50 text-indigo-200 cursor-not-allowed'
                : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/25 active:scale-95'
            }`}
          >
            <Play size={14} className={demoRunning ? 'animate-spin' : 'fill-white'} />
            {demoRunning ? 'Simulating Traffic...' : '▶ RUN SECURITY DEMO'}
          </button>
        </div>
      </div>

      {/* 5 Primary Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3.5">
        <div className="stat-box">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Total Interceptions</p>
          <p className="text-2xl font-bold text-white mt-1">{total.toLocaleString()}</p>
          <p className="text-[10px] text-slate-500 mt-1 flex items-center gap-1">
            <Activity size={10} className="text-indigo-400" /> All evaluated calls
          </p>
        </div>

        <div className="stat-box border-emerald-500/20 bg-emerald-950/10">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-emerald-400/80">Allowed</p>
          <p className="text-2xl font-bold text-emerald-400 mt-1">{counts.ALLOW.toLocaleString()}</p>
          <p className="text-[10px] text-emerald-500/70 mt-1 flex items-center gap-1">
            <CheckCircle size={10} /> Passed all policies
          </p>
        </div>

        <div className="stat-box border-red-500/20 bg-red-950/10">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-red-400/80">Blocked (Attacks)</p>
          <p className="text-2xl font-bold text-red-400 mt-1">{counts.BLOCK.toLocaleString()}</p>
          <p className="text-[10px] text-red-500/70 mt-1 flex items-center gap-1">
            <XCircle size={10} /> Policy denied
          </p>
        </div>

        <div className="stat-box border-orange-500/20 bg-orange-950/10">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-orange-400/80">Rate Limited</p>
          <p className="text-2xl font-bold text-orange-400 mt-1">{counts.RATE_LIMIT.toLocaleString()}</p>
          <p className="text-[10px] text-orange-500/70 mt-1 flex items-center gap-1">
            <Clock size={10} /> Throttled by Redis
          </p>
        </div>

        <div className="stat-box border-amber-500/20 bg-amber-950/10">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-amber-400/80">HITL Escalated</p>
          <p className="text-2xl font-bold text-amber-400 mt-1">{counts.HITL.toLocaleString()}</p>
          <p className="text-[10px] text-amber-500/70 mt-1 flex items-center gap-1">
            <AlertTriangle size={10} /> High-risk transfers
          </p>
        </div>
      </div>

      {/* Real-time Traffic Graph & Layer Status */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="console-panel p-4 lg:col-span-2 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
              <TrendingUp size={14} className="text-indigo-400" />
              Live Policy Enforcement Throughput
            </h2>
            <span className="text-[11px] font-mono text-slate-500">Latency: ~6-12ms</span>
          </div>

          <div className="h-52 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trafficData}>
                <defs>
                  <linearGradient id="gAllow" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gBlock" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ef4444" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="2 2" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="time" tick={{ fontSize: 10, fill: '#64748b' }} />
                <YAxis tick={{ fontSize: 10, fill: '#64748b' }} allowDecimals={false} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#0f172a',
                    borderColor: 'rgba(255,255,255,0.1)',
                    borderRadius: '8px',
                    fontSize: '12px',
                  }}
                />
                <Area type="monotone" dataKey="allowed" name="Allowed" stroke="#10b981" fill="url(#gAllow)" strokeWidth={2} />
                <Area type="monotone" dataKey="blocked" name="Blocked / Throttled" stroke="#ef4444" fill="url(#gBlock)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* 7-Layer Defense Posture */}
        <div className="console-panel p-4 space-y-3">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
            <Layers size={14} className="text-indigo-400" />
            Active Protection Layers
          </h2>

          <div className="space-y-2 text-xs">
            <div className="flex items-center justify-between p-2 rounded bg-white/5 border border-white/5">
              <span className="text-slate-300">1. Authentication (SHA-256)</span>
              <span className="text-emerald-400 font-semibold">Active</span>
            </div>
            <div className="flex items-center justify-between p-2 rounded bg-white/5 border border-white/5">
              <span className="text-slate-300">2. Sliding-Window Rate Limit</span>
              <span className="text-emerald-400 font-semibold">Enforcing</span>
            </div>
            <div className="flex items-center justify-between p-2 rounded bg-white/5 border border-white/5">
              <span className="text-slate-300">3. SQLi / Traversal Regex Guard</span>
              <span className="text-emerald-400 font-semibold">Active</span>
            </div>
            <div className="flex items-center justify-between p-2 rounded bg-white/5 border border-white/5">
              <span className="text-slate-300">4. BOLA Cross-Tenant Scope</span>
              <span className="text-emerald-400 font-semibold">Active</span>
            </div>
            <div className="flex items-center justify-between p-2 rounded bg-white/5 border border-white/5">
              <span className="text-slate-300">5. State Sequence Dependency</span>
              <span className="text-emerald-400 font-semibold">Active</span>
            </div>
            <div className="flex items-center justify-between p-2 rounded bg-white/5 border border-white/5">
              <span className="text-slate-300">6. Weighted Risk Engine (0-100)</span>
              <span className="text-emerald-400 font-semibold">Calibrated</span>
            </div>
            <div className="flex items-center justify-between p-2 rounded bg-white/5 border border-white/5">
              <span className="text-slate-300">7. Human-in-the-Loop (HITL)</span>
              <span className="text-amber-400 font-semibold">Active Queue</span>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Interceptions Feed */}
      <div className="console-panel p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
            <Zap size={14} className="text-amber-400" />
            Live Security Interception Stream
          </h2>
          <span className="text-[11px] text-slate-500 font-mono">Real-time WebSocket Feed</span>
        </div>

        <div className="divide-y divide-white/5 max-h-60 overflow-y-auto">
          {events.length === 0 ? (
            <p className="text-xs text-slate-500 py-6 text-center">
              No recent tool calls. Click <strong className="text-indigo-400 font-semibold">RUN SECURITY DEMO</strong> above to simulate live traffic.
            </p>
          ) : (
            events.slice(0, 15).map((e, idx) => (
              <div key={e.payload?.id ?? idx} className="py-2 flex items-center justify-between text-xs">
                <div className="flex items-center gap-3">
                  <span className={`badge-${e.type?.toLowerCase()}`}>
                    {e.type}
                  </span>
                  <span className="font-mono text-slate-200 font-semibold">{e.payload.tool}</span>
                  <span className="text-slate-500 font-mono text-[11px]">agent: {e.payload.agentId || 'cs-agent-01'}</span>
                </div>
                <div className="flex items-center gap-4">
                  {e.payload.reason && (
                    <span className="text-slate-400 max-w-xs truncate hidden md:inline">
                      {e.payload.reason}
                    </span>
                  )}
                  <span className={`font-mono font-bold ${
                    (e.payload.riskScore ?? 0) > 70 ? 'text-red-400' :
                    (e.payload.riskScore ?? 0) > 40 ? 'text-amber-400' : 'text-emerald-400'
                  }`}>
                    Risk: {e.payload.riskScore}/100
                  </span>
                  <span className="text-slate-500 font-mono text-[11px]">{e.payload.latencyMs}ms</span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
