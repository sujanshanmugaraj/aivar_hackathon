import React, { useState, useMemo } from 'react';
import { Trash2, RefreshCw, Filter, Search, ChevronDown, ChevronRight, Eye } from 'lucide-react';
import { format } from 'date-fns';
import { WsEvent, Decision } from '../types';

const DECISION_BADGE: Record<string, string> = {
  ALLOW: 'badge-allow',
  BLOCK: 'badge-block',
  RATE_LIMIT: 'badge-ratelimit',
  HITL: 'badge-hitl',
  SHADOW_BLOCK: 'badge-shadow',
};

const DECISION_ICONS: Record<string, string> = {
  ALLOW: '✅',
  BLOCK: '🚫',
  RATE_LIMIT: '⏱',
  HITL: '⚠️',
  SHADOW_BLOCK: '👻',
};

export default function Events({
  events,
  onClear,
  onRefresh,
}: {
  events: WsEvent[];
  onClear: () => void;
  onRefresh?: () => void;
}) {
  const [filterDecision, setFilterDecision] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const filteredEvents = useMemo(() => {
    return events.filter((e) => {
      if (filterDecision !== 'ALL' && e.type !== filterDecision) return false;
      if (searchQuery.trim() !== '') {
        const q = searchQuery.toLowerCase();
        const tool = e.payload.tool?.toLowerCase() ?? '';
        const reason = e.payload.reason?.toLowerCase() ?? '';
        const agent = e.payload.agentId?.toLowerCase() ?? '';
        if (!tool.includes(q) && !reason.includes(q) && !agent.includes(q)) return false;
      }
      return true;
    });
  }, [events, filterDecision, searchQuery]);

  return (
    <div className="p-6 space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-white">Audit Log & Interception Stream</h1>
            <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
              Real-time Ingestion
            </span>
          </div>
          <p className="text-slate-400 text-xs mt-1">
            Displaying latest {events.length} security audit events from live demo & synthetic benchmark stream.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {onRefresh && (
            <button
              onClick={onRefresh}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-xs text-slate-300 transition"
              title="Refresh from Database"
            >
              <RefreshCw size={13} /> Refresh
            </button>
          )}
          <button
            onClick={onClear}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-950/40 hover:bg-red-900/60 border border-red-500/20 text-xs text-red-300 transition"
          >
            <Trash2 size={13} /> Clear
          </button>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-white/5 rounded-xl border border-white/10">
        <div className="flex items-center gap-2">
          <Filter size={14} className="text-slate-400" />
          <span className="text-xs text-slate-400 mr-1">Filter:</span>
          {['ALL', 'ALLOW', 'BLOCK', 'RATE_LIMIT', 'HITL'].map((d) => (
            <button
              key={d}
              onClick={() => setFilterDecision(d)}
              className={`px-2.5 py-1 rounded text-xs font-medium transition ${
                filterDecision === d
                  ? 'bg-aegis-600 text-white'
                  : 'bg-white/5 text-slate-400 hover:bg-white/10 hover:text-slate-200'
              }`}
            >
              {d.replace('_', ' ')}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 bg-black/30 px-3 py-1.5 rounded-lg border border-white/10 w-full sm:w-64">
          <Search size={14} className="text-slate-400" />
          <input
            type="text"
            placeholder="Search tool, agent, reason..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="bg-transparent border-none outline-none text-xs text-white placeholder:text-slate-500 w-full"
          />
        </div>
      </div>

      {/* Table */}
      {filteredEvents.length === 0 ? (
        <div className="card-glow p-12 text-center">
          <RefreshCw size={32} className="text-slate-600 mx-auto mb-3" />
          <p className="text-slate-400">No events matching filters.</p>
          <code className="text-xs text-slate-500 mt-2 block">Run: pnpm test:attack or click Refresh</code>
        </div>
      ) : (
        <div className="card-glow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10 text-left bg-white/5">
                  <th className="w-8 px-3 py-3"></th>
                  <th className="px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Decision</th>
                  <th className="px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Tool</th>
                  <th className="px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Agent ID</th>
                  <th className="px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Risk Score</th>
                  <th className="px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Violation / Reason</th>
                  <th className="px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Latency</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filteredEvents.map((e, i) => {
                  const eventId = e.payload.id || `ev-${i}`;
                  const isExpanded = expandedId === eventId;
                  return (
                    <React.Fragment key={eventId}>
                      <tr
                        onClick={() => setExpandedId(isExpanded ? null : eventId)}
                        className="hover:bg-white/5 transition-colors cursor-pointer"
                      >
                        <td className="px-3 py-3 text-slate-500">
                          {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                        </td>
                        <td className="px-4 py-3">
                          <span className={DECISION_BADGE[e.type] ?? 'badge'}>
                            {DECISION_ICONS[e.type]} {e.type.replace('_', ' ')}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-mono text-xs text-slate-200 font-semibold">{e.payload.tool}</td>
                        <td className="px-4 py-3 text-xs text-slate-400 font-mono">{e.payload.agentId || 'agent-customer-support-01'}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="w-14 bg-white/10 rounded-full h-1.5">
                              <div
                                className={`h-1.5 rounded-full ${
                                  (e.payload.riskScore ?? 0) > 80 ? 'bg-red-400' :
                                  (e.payload.riskScore ?? 0) > 40 ? 'bg-amber-400' : 'bg-emerald-400'
                                }`}
                                style={{ width: `${Math.min(100, e.payload.riskScore ?? 0)}%` }}
                              />
                            </div>
                            <span className="text-xs text-slate-300 font-mono">{e.payload.riskScore}/100</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-400 max-w-xs truncate">
                          {e.payload.reason || e.payload.matchedRules?.join(', ') || 'Policy rules passed'}
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-500 font-mono">{e.payload.latencyMs}ms</td>
                      </tr>

                      {/* Expanded Parameter Details */}
                      {isExpanded && (
                        <tr className="bg-black/40">
                          <td colSpan={7} className="p-4 border-t border-b border-white/10">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                              <div>
                                <p className="font-semibold text-slate-300 mb-1">Sanitized Intercepted Parameters:</p>
                                <pre className="bg-black/60 p-3 rounded-lg border border-white/10 text-emerald-400 font-mono overflow-x-auto">
                                  {JSON.stringify(e.payload.sanitizedParams ?? {}, null, 2)}
                                </pre>
                              </div>
                              <div className="space-y-2">
                                <p className="font-semibold text-slate-300">Policy Evaluation Details:</p>
                                <p className="text-slate-400"><strong className="text-slate-300">Rules Evaluated:</strong> {e.payload.rulesEvaluated?.join(', ') || 'All Active Rules'}</p>
                                <p className="text-slate-400"><strong className="text-slate-300">Matched Violations:</strong> {e.payload.matchedRules?.join(', ') || 'None'}</p>
                                <p className="text-slate-400"><strong className="text-slate-300">Session ID:</strong> <span className="font-mono text-slate-300">{e.payload.sessionId || 'sess-demo-001'}</span></p>
                                <p className="text-slate-400"><strong className="text-slate-300">Timestamp:</strong> {e.payload.createdAt ? format(new Date(e.payload.createdAt), 'yyyy-MM-dd HH:mm:ss') : 'Just now'}</p>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
