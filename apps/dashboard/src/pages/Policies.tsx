import React, { useState } from 'react';
import { Shield, Play, Pause, AlertTriangle, CheckCircle, RefreshCw, Layers, Terminal, Send, XCircle } from 'lucide-react';
import axios from 'axios';

export default function Policies() {
  const [shadowMode, setShadowMode] = useState(false);
  const [testTool, setTestTool] = useState('search_customer');
  const [testParamKey, setTestParamKey] = useState('query');
  const [testParamValue, setTestParamValue] = useState("' OR '1'='1");
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<any>(null);

  const runPolicyTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await axios.post(
        '/api/waf/evaluate',
        {
          tool: testTool,
          parameters: { [testParamKey]: testParamValue },
          sessionId: 'sess-demo-001',
          customerId: 'C101',
          requestId: crypto.randomUUID(),
        },
        {
          headers: { Authorization: 'Bearer cs-agent-key-dev-001' },
          validateStatus: () => true,
        }
      );
      setTestResult(res.data);
    } catch (e: any) {
      alert(`Policy test error: ${e.message}`);
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Shield className="text-indigo-400" size={24} />
            Policy Engine & Security Rules
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Active runtime guardrails, rate limit budgets, parameter blocklists, and sequence dependencies.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-900 border border-white/10 text-xs">
            <span className="text-slate-400">Policy:</span>
            <span className="font-mono text-indigo-300 font-semibold">default.yaml (v5)</span>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-950/40 border border-emerald-500/30 text-xs text-emerald-400 font-semibold">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            Mode: {shadowMode ? 'SHADOW (AUDIT ONLY)' : 'ENFORCING'}
          </div>
        </div>
      </div>

      {/* Interactive Policy Tester Box */}
      <div className="console-panel p-5 space-y-4 border border-indigo-500/30 bg-gradient-to-r from-indigo-950/30 via-slate-900 to-slate-900">
        <div className="flex items-center justify-between border-b border-white/5 pb-3">
          <div className="flex items-center gap-2">
            <Terminal size={18} className="text-indigo-400" />
            <h3 className="text-sm font-bold text-white">Live Policy Rule Tester</h3>
            <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300">Interactive</span>
          </div>
          <p className="text-[11px] text-slate-400">Test parameters against compiled regex signatures & scope constraints</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="space-y-1">
            <label className="text-[11px] text-slate-300 font-semibold">Target Tool:</label>
            <select
              value={testTool}
              onChange={(e) => setTestTool(e.target.value)}
              className="w-full bg-black/50 border border-white/10 rounded px-2.5 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-indigo-500"
            >
              <option value="search_customer">search_customer</option>
              <option value="get_customer">get_customer</option>
              <option value="update_customer">update_customer</option>
              <option value="transfer_money">transfer_money</option>
              <option value="delete_customer">delete_customer</option>
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-[11px] text-slate-300 font-semibold">Parameter Key:</label>
            <input
              type="text"
              value={testParamKey}
              onChange={(e) => setTestParamKey(e.target.value)}
              className="w-full bg-black/50 border border-white/10 rounded px-2.5 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-indigo-500"
              placeholder="e.g. query, customer_id"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[11px] text-slate-300 font-semibold">Parameter Payload / String:</label>
            <input
              type="text"
              value={testParamValue}
              onChange={(e) => setTestParamValue(e.target.value)}
              className="w-full bg-black/50 border border-white/10 rounded px-2.5 py-1.5 text-xs text-amber-300 font-mono focus:outline-none focus:border-indigo-500"
              placeholder="e.g. ' OR '1'='1"
            />
          </div>
        </div>

        <div className="flex items-center justify-between gap-4 pt-1">
          <button
            onClick={runPolicyTest}
            disabled={testing}
            className="py-2 px-4 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs flex items-center gap-1.5 transition shadow-lg shadow-indigo-600/30 disabled:opacity-50"
          >
            {testing ? <RefreshCw size={13} className="animate-spin" /> : <Send size={13} />}
            {testing ? 'Evaluating...' : 'TEST POLICY SIGNATURE'}
          </button>

          {testResult && (
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-mono font-bold ${
              testResult.decision === 'ALLOW'
                ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-300'
                : testResult.decision === 'BLOCK'
                ? 'bg-red-950/40 border-red-500/40 text-red-300'
                : 'bg-amber-950/40 border-amber-500/40 text-amber-300'
            }`}>
              {testResult.decision === 'ALLOW' ? <CheckCircle size={14} /> : <XCircle size={14} />}
              <span>Verdict: {testResult.decision} (Risk: {testResult.riskScore}/100)</span>
              {testResult.reason && <span className="text-[10px] opacity-80 truncate max-w-md">— {testResult.reason}</span>}
            </div>
          )}
        </div>
      </div>

      {/* Grid of 4 Core Policy Modules */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Module 1: Rate Limiting */}
        <div className="console-panel p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-orange-400" />
              1. Redis Sliding-Window Rate Limits
            </h2>
            <span className="text-[11px] font-mono text-slate-500">Per-Agent Budget</span>
          </div>
          <div className="space-y-2 text-xs font-mono">
            <div className="flex justify-between p-2 rounded bg-white/5 border border-white/5">
              <span className="text-slate-300">get_customer</span>
              <span className="text-orange-400 font-semibold">20 req / 60s</span>
            </div>
            <div className="flex justify-between p-2 rounded bg-white/5 border border-white/5">
              <span className="text-slate-300">search_customer</span>
              <span className="text-orange-400 font-semibold">30 req / 60s</span>
            </div>
            <div className="flex justify-between p-2 rounded bg-white/5 border border-white/5">
              <span className="text-slate-300">update_customer</span>
              <span className="text-orange-400 font-semibold">10 req / 60s</span>
            </div>
            <div className="flex justify-between p-2 rounded bg-white/5 border border-white/5">
              <span className="text-slate-300">delete_customer</span>
              <span className="text-orange-400 font-semibold">2 req / 60s</span>
            </div>
            <div className="flex justify-between p-2 rounded bg-white/5 border border-white/5">
              <span className="text-slate-300">transfer_money</span>
              <span className="text-orange-400 font-semibold">5 req / 3600s</span>
            </div>
          </div>
        </div>

        {/* Module 2: Parameter Blocklists */}
        <div className="console-panel p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-red-400" />
              2. Parameter Threat Blocklists
            </h2>
            <span className="text-[11px] font-mono text-slate-500">Regex Signatures</span>
          </div>
          <p className="text-xs text-slate-400">
            Enforces max parameter length (1000 chars), max amount limits, and blocks OWASP threat strings:
          </p>
          <div className="flex flex-wrap gap-1.5 text-xs font-mono">
            {["' OR '1'='1", "'; --", 'DROP', 'DELETE *', 'TRUNCATE', '../', '<script', 'UNION SELECT', 'rm -rf', '/etc/passwd', 'exec(', 'eval('].map((s) => (
              <span key={s} className="px-2 py-0.5 rounded bg-red-950/40 border border-red-500/30 text-red-400">
                {s}
              </span>
            ))}
          </div>
        </div>

        {/* Module 3: Data Scope & Tenant Isolation */}
        <div className="console-panel p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-indigo-400" />
              3. Data Scope & Tenant Isolation
            </h2>
            <span className="text-[11px] font-mono text-slate-500">BOLA Defense</span>
          </div>
          <p className="text-xs text-slate-400">
            Session Binding strategy: Any tool call attempting to query or modify data outside the authenticated session scope is strictly blocked with a risk score penalty.
          </p>
          <div className="p-2 rounded bg-white/5 border border-white/5 font-mono text-[11px] text-slate-300 flex justify-between">
            <span>Scoped Parameter Keys:</span>
            <span className="text-indigo-400">customer_id, customerId</span>
          </div>
        </div>

        {/* Module 4: Sequence Rules & Risk Weights */}
        <div className="console-panel p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
              4. Sequence State Graph & Risk Weights
            </h2>
            <span className="text-[11px] font-mono text-slate-500">Prerequisite Checks</span>
          </div>
          <div className="space-y-2 text-xs">
            <div className="p-2 rounded bg-white/5 border border-white/5 flex justify-between items-center">
              <span className="text-slate-300 font-mono">update_customer</span>
              <span className="text-slate-400">Requires prior: <code className="text-emerald-400">get_customer</code></span>
            </div>
            <div className="p-2 rounded bg-white/5 border border-white/5 flex justify-between items-center">
              <span className="text-slate-300 font-mono">delete_customer</span>
              <span className="text-slate-400">Requires prior: <code className="text-emerald-400">get_customer</code></span>
            </div>
            <div className="p-2 rounded bg-white/5 border border-white/5 flex justify-between items-center">
              <span className="text-slate-300 font-mono">transfer_money</span>
              <span className="text-slate-400">Requires prior: <code className="text-emerald-400">get_customer</code></span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
