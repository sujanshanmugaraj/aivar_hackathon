import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { AlertTriangle, CheckCircle, XCircle, RefreshCw, ShieldAlert, CheckCheck, Trash2, Clock } from 'lucide-react';
import { HitlRequest } from '../types';

export default function HitlQueue() {
  const [queue, setQueue] = useState<HitlRequest[]>([]);
  const [statusFilter, setStatusFilter] = useState<'PENDING' | 'APPROVED' | 'REJECTED' | 'EXPIRED' | 'ALL'>('PENDING');
  const [pendingCount, setPendingCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [resolving, setResolving] = useState<string | null>(null);

  const fetchQueue = async () => {
    try {
      const res = await axios.get(`/api/hitl/queue?status=${statusFilter}`);
      setQueue(res.data.queue ?? []);
      setPendingCount(res.data.pendingCount ?? 0);
    } catch {
      setQueue([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQueue();
    const interval = setInterval(fetchQueue, 3000);
    return () => clearInterval(interval);
  }, [statusFilter]);

  const resolve = async (id: string, action: 'approve' | 'reject') => {
    setResolving(id);
    try {
      await axios.post(
        `/api/hitl/${id}/${action}`,
        { note: `Manually ${action}d from Dashboard` },
        { headers: { Authorization: 'Bearer sec-officer-key-dev-001' } }
      );
      await fetchQueue();
    } catch (e) {
      console.error(e);
    } finally {
      setResolving(null);
    }
  };

  const clearAll = async (action: 'APPROVE' | 'REJECT') => {
    setLoading(true);
    try {
      await axios.post(
        '/api/hitl/clear-all',
        { action },
        { headers: { Authorization: 'Bearer sec-officer-key-dev-001' } }
      );
      await fetchQueue();
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <ShieldAlert className="text-amber-400" size={24} />
            Human-in-the-Loop (HITL) Governance Queue
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Autonomous agent operations requiring compliance authorization ({pendingCount} pending, 60s auto-expiry TTL)
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {pendingCount > 0 && (
            <>
              <button
                onClick={() => clearAll('APPROVE')}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-950/50 hover:bg-emerald-900/60 border border-emerald-500/30 text-xs text-emerald-300 transition"
              >
                <CheckCheck size={13} /> Approve All Pending
              </button>
              <button
                onClick={() => clearAll('REJECT')}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-950/50 hover:bg-red-900/60 border border-red-500/30 text-xs text-red-300 transition"
              >
                <Trash2 size={13} /> Reject All
              </button>
            </>
          )}
          <button
            onClick={() => { setLoading(true); fetchQueue(); }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-xs text-slate-300 transition"
          >
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} /> Refresh
          </button>
        </div>
      </div>

      {/* Filter Tabs: Pending vs Resolved History vs Expired */}
      <div className="flex items-center gap-2 border-b border-white/5 pb-3 flex-wrap">
        {(['PENDING', 'APPROVED', 'REJECTED', 'EXPIRED', 'ALL'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => { setStatusFilter(tab); setLoading(true); }}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
              statusFilter === tab
                ? 'bg-indigo-600/30 border border-indigo-500/40 text-white'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            {tab === 'PENDING' && `Pending Authorization (${pendingCount})`}
            {tab === 'APPROVED' && 'Approved History'}
            {tab === 'REJECTED' && 'Rejected History'}
            {tab === 'EXPIRED' && 'Expired (Timed Out)'}
            {tab === 'ALL' && 'All HITL Audit Records'}
          </button>
        ))}
      </div>

      {/* List Content */}
      {loading && queue.length === 0 ? (
        <div className="console-panel p-8 text-center text-slate-400 text-xs">Loading queue records...</div>
      ) : queue.length === 0 ? (
        <div className="console-panel p-12 text-center space-y-2">
          <CheckCircle size={36} className="text-emerald-500 mx-auto mb-2" />
          <p className="text-slate-200 font-semibold text-sm">
            {statusFilter === 'PENDING' ? 'No Pending Reviews in Queue' : 'No records found for this filter'}
          </p>
          <p className="text-slate-500 text-xs">
            {statusFilter === 'PENDING'
              ? 'All high-risk autonomous agent operations have been reviewed or timed out. Trigger one by typing: Transfer 25000 to Acme Corp'
              : 'Switch tabs above to view pending items or audit records.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {queue.map((item) => {
            const isPending = item.status === 'PENDING';
            const isApproved = item.status === 'APPROVED';
            const isExpired = item.status === 'EXPIRED';

            return (
              <div
                key={item.id}
                className={`console-panel p-4 border-l-4 ${
                  isPending
                    ? 'border-amber-500 bg-amber-950/10'
                    : isApproved
                    ? 'border-emerald-500 bg-emerald-950/10'
                    : isExpired
                    ? 'border-slate-500 bg-slate-900/40'
                    : 'border-red-500 bg-red-950/10'
                }`}
              >
                <div className="flex flex-col md:flex-row items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded ${
                        isPending
                          ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                          : isApproved
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                          : isExpired
                          ? 'bg-slate-500/20 text-slate-300 border border-slate-500/30'
                          : 'bg-red-500/20 text-red-300 border border-red-500/30'
                      }`}>
                        {item.status}
                      </span>
                      <span className="font-mono font-bold text-white text-sm">{item.tool}</span>
                      <span className="text-xs font-mono font-bold text-amber-300 bg-black/40 px-2 py-0.5 rounded border border-white/5">
                        Risk: {item.riskScore}/100
                      </span>
                    </div>

                    <p className="text-xs text-slate-400">
                      Agent: <span className="text-slate-200 font-mono font-semibold">{item.agent?.name ?? item.agentId}</span>
                    </p>

                    <div className="mt-2.5">
                      <p className="text-[11px] text-slate-400 font-semibold mb-1">Intercepted Parameters:</p>
                      <pre className="p-2.5 bg-black/60 rounded-lg border border-white/5 font-mono text-[11px] text-amber-200 overflow-x-auto">
                        {JSON.stringify(item.parameters, null, 2)}
                      </pre>
                    </div>

                    <div className="flex items-center gap-4 text-[10px] text-slate-500 font-mono mt-2">
                      <span>Created: {new Date(item.createdAt).toLocaleString()}</span>
                      {item.resolvedAt && (
                        <span>
                          {isExpired ? 'Timed Out' : 'Resolved'}: {new Date(item.resolvedAt).toLocaleString()} ({item.reviewedBy})
                        </span>
                      )}
                    </div>
                  </div>

                  {isPending && (
                    <div className="flex flex-row md:flex-col gap-2 shrink-0 w-full md:w-auto">
                      <button
                        onClick={() => resolve(item.id, 'approve')}
                        disabled={resolving === item.id}
                        className="flex-1 md:flex-initial flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs transition disabled:opacity-50"
                      >
                        <CheckCircle size={14} /> Approve & Grant
                      </button>
                      <button
                        onClick={() => resolve(item.id, 'reject')}
                        disabled={resolving === item.id}
                        className="flex-1 md:flex-initial flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-white font-semibold text-xs transition disabled:opacity-50"
                      >
                        <XCircle size={14} /> Reject & Block
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
