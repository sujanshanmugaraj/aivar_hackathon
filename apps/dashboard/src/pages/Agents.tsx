import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Bot, RefreshCw, Layers } from 'lucide-react';

interface AgentInfo {
  id: string;
  name: string;
  role: string;
  description: string;
  status: string;
  totalRequests: number;
  totalLifetimeRequests?: number;
  recentRequests?: number;
  allowed: number;
  blocked: number;
  hitl: number;
  avgRiskScore: number;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  lastActivity: string;
}

export default function Agents() {
  const [agents, setAgents] = useState<AgentInfo[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAgents = async () => {
    try {
      setLoading(true);
      const res = await axios.get('/api/agents');
      if (res.data?.agents) {
        setAgents(res.data.agents);
      }
    } catch (err) {
      console.error('Failed to load agents', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAgents();
  }, []);

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              <Bot className="text-indigo-400" size={24} />
              Governed Autonomous Agents
            </h1>
            <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
              Active Security Guardrails
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Registered LLM agents operating under AegisWAF real-time policy and compliance inspection.
          </p>
        </div>

        <button
          onClick={fetchAgents}
          disabled={loading}
          className="btn-action bg-slate-800 hover:bg-slate-700 text-slate-200 border border-white/10"
        >
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
          Refresh Registry
        </button>
      </div>

      {/* Agents Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {agents.map((agent) => (
          <div key={agent.id} className="console-panel p-5 space-y-4 hover:border-indigo-500/40 transition">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
                  <Bot size={18} />
                </div>
                <div>
                  <h3 className="font-bold text-white text-sm">{agent.name}</h3>
                  <p className="text-[11px] text-slate-500 font-mono">{agent.id}</p>
                </div>
              </div>
              <span className="flex items-center gap-1 text-[11px] font-semibold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                ACTIVE
              </span>
            </div>

            <p className="text-xs text-slate-400 line-clamp-2">
              {agent.description || 'Autonomous agent performing enterprise operations.'}
            </p>

            <div className="grid grid-cols-3 gap-2 p-2.5 rounded-lg bg-black/40 border border-white/5 text-center text-xs">
              <div>
                <p className="text-[10px] text-slate-500 uppercase font-semibold">Lifetime Total</p>
                <p className="font-bold text-white mt-0.5">{agent.totalRequests.toLocaleString()}</p>
              </div>
              <div>
                <p className="text-[10px] text-emerald-400/80 uppercase font-semibold">Recent Allowed</p>
                <p className="font-bold text-emerald-400 mt-0.5">{agent.allowed}</p>
              </div>
              <div>
                <p className="text-[10px] text-red-400/80 uppercase font-semibold">Recent Denied</p>
                <p className="font-bold text-red-400 mt-0.5">{agent.blocked}</p>
              </div>
            </div>

            <div className="flex items-center justify-between text-xs pt-1 border-t border-white/5">
              <div className="flex items-center gap-1.5">
                <span className="text-slate-400">Risk Level:</span>
                <span className={`font-bold px-2 py-0.5 rounded text-[10px] ${
                  agent.riskLevel === 'HIGH'
                    ? 'bg-red-500/20 text-red-300'
                    : agent.riskLevel === 'MEDIUM'
                    ? 'bg-amber-500/20 text-amber-300'
                    : 'bg-emerald-500/20 text-emerald-300'
                }`}>
                  {agent.riskLevel} ({agent.avgRiskScore}/100)
                </span>
              </div>
              <span className="text-[10px] text-slate-500 font-mono">
                {new Date(agent.lastActivity).toLocaleTimeString()}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
