import React, { useState, useCallback, useRef } from 'react';
import axios from 'axios';
import {
  Send, Bot, Shield, CheckCircle, XCircle, AlertTriangle, Clock,
  ArrowRight, ShieldCheck, RefreshCw, Zap, Sparkles, Terminal, Layers, User,
  CheckCheck, Ban, Database, Cpu, Brain, ChevronRight
} from 'lucide-react';

interface PlaygroundResult {
  decision: 'ALLOW' | 'BLOCK' | 'HITL' | 'RATE_LIMIT' | 'SHADOW_BLOCK';
  riskScore: number;
  reason?: string;
  tool: string;
  parameters: Record<string, unknown>;
  latencyMs: number;
  timestamp: string;
  requestId: string;
  hitlId?: string;
  executionResult?: any;
}

const PRESET_PROMPTS = [
  {
    label: '🟢 1. Safe CRM Request (ALLOW)',
    prompt: 'Get customer C101 profile',
    agent: 'agent-customer-support-01',
    tool: 'get_customer',
    params: { customer_id: 'C101' },
    desc: 'Normal CRM profile lookup within authenticated session boundary',
  },
  {
    label: '🔴 2. SQL Injection Attack (BLOCK)',
    prompt: "Search customer matching ' OR 1=1 --",
    agent: 'agent-customer-support-01',
    tool: 'search_customer',
    params: { query: "' OR 1=1 --" },
    desc: 'Malicious SQL boolean tautology injection attempting table dump',
  },
  {
    label: '🔴 3. BOLA Cross-Tenant Violation (BLOCK)',
    prompt: 'Access confidential profile for customer C999',
    agent: 'agent-customer-support-01',
    tool: 'get_customer',
    params: { customer_id: 'C999' },
    desc: 'Broken Object Level Authorization (OWASP LLM02) across tenant boundary',
  },
  {
    label: '🟡 4. High-Risk Wire Transfer (HITL)',
    prompt: 'Transfer ₹25,000 to Acme Corp',
    agent: 'agent-finance-01',
    tool: 'transfer_money',
    params: { to: 'Acme Corp', amount: 25000 },
    desc: 'Sensitive financial transaction requiring compliance officer approval',
  },
  {
    label: '⏱ 5. Rapid Rate-Limit Burst (THROTTLE)',
    prompt: 'Delete customer records rapidly',
    agent: 'agent-customer-support-01',
    tool: 'delete_customer',
    params: { customer_id: 'C101' },
    desc: 'Burst exceeding strict sliding-window quota (2 calls / 60s)',
  },
];

interface NlpIntent {
  agentId: string;
  tool: string;
  parameters: Record<string, unknown>;
  confidence: number;
  intent: string;
  reasoning: string;
}

export default function AgentPlayground() {
  const [selectedAgent, setSelectedAgent] = useState('agent-customer-support-01');
  const [promptText, setPromptText] = useState('Get customer C101 profile');
  const [selectedTool, setSelectedTool] = useState('get_customer');
  const [paramsJson, setParamsJson] = useState('{\n  "customer_id": "C101"\n}');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<PlaygroundResult | null>(null);
  const [hitlResolving, setHitlResolving] = useState<string | null>(null);
  const [nlpParsing, setNlpParsing] = useState(false);
  const [nlpIntent, setNlpIntent] = useState<NlpIntent | null>(null);
  const nlpTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const parseNlpIntent = useCallback(async (text: string) => {
    if (!text.trim() || text.length < 5) return;
    setNlpParsing(true);
    setNlpIntent(null);
    try {
      const res = await axios.post('/api/system/nlp-parse', { prompt: text });
      const intent: NlpIntent = res.data;
      setNlpIntent(intent);
      // Auto-fill tool + params + agent from parsed intent
      setSelectedAgent(intent.agentId);
      setSelectedTool(intent.tool);
      setParamsJson(JSON.stringify(intent.parameters, null, 2));
    } catch {
      // Silently ignore — user can still manually select
    } finally {
      setNlpParsing(false);
    }
  }, []);

  const handlePromptChange = (text: string) => {
    setPromptText(text);
    setNlpIntent(null);
    if (nlpTimer.current) clearTimeout(nlpTimer.current);
    // Debounce 600ms after user stops typing
    nlpTimer.current = setTimeout(() => parseNlpIntent(text), 600);
  };

  const applyPreset = (preset: typeof PRESET_PROMPTS[0]) => {
    setPromptText(preset.prompt);
    setSelectedAgent(preset.agent);
    setSelectedTool(preset.tool);
    setParamsJson(JSON.stringify(preset.params, null, 2));
    setNlpIntent(null);
    setResult(null);
  };

  const handleSend = async () => {
    setLoading(true);
    setResult(null);

    let parsedParams = {};
    try {
      parsedParams = JSON.parse(paramsJson);
    } catch {
      alert('Invalid JSON parameters structure');
      setLoading(false);
      return;
    }

    try {
      const apiKey = selectedAgent === 'agent-finance-01' ? 'finance-agent-key-dev-001' : 'cs-agent-key-dev-001';
      const requestId = crypto.randomUUID();

      // Step 1: Pre-evaluate through WAF Gateway
      const evalRes = await axios.post(
        '/api/waf/evaluate',
        {
          tool: selectedTool,
          parameters: parsedParams,
          sessionId: 'sess-demo-001',
          customerId: 'C101',
          requestId,
        },
        {
          headers: { Authorization: `Bearer ${apiKey}` },
          validateStatus: () => true,
        }
      );

      const decision = evalRes.data.decision;
      const riskScore = evalRes.data.riskScore ?? 0;
      const reason = evalRes.data.reason;
      const latencyMs = evalRes.data.latencyMs ?? 6;

      let executionResult = null;
      let hitlId = undefined;

      // Step 2: If ALLOW, execute tool; If HITL, locate created review item
      if (decision === 'ALLOW') {
        const execRes = await axios.post(
          '/api/waf/execute',
          { requestId, tool: selectedTool, parameters: parsedParams },
          { headers: { Authorization: `Bearer ${apiKey}` }, validateStatus: () => true }
        );
        executionResult = execRes.data.result;
      } else if (decision === 'HITL') {
        try {
          const qRes = await axios.get('/api/hitl/queue?status=PENDING');
          const item = qRes.data.queue?.find((q: any) => q.toolCallId === requestId);
          if (item) hitlId = item.id;
        } catch {
          // ignore
        }
      }

      setResult({
        decision,
        riskScore,
        reason,
        tool: selectedTool,
        parameters: parsedParams,
        latencyMs,
        timestamp: new Date().toLocaleTimeString(),
        requestId,
        hitlId,
        executionResult,
      });
    } catch (e: any) {
      alert(`Simulation error: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleInlineHitlResolve = async (action: 'approve' | 'reject') => {
    if (!result?.hitlId) return;
    setHitlResolving(action);
    try {
      await axios.post(
        `/api/hitl/${result.hitlId}/${action}`,
        { note: `Reviewed directly in Agent Playground: ${action.toUpperCase()}` },
        { headers: { Authorization: 'Bearer sec-officer-key-dev-001' } }
      );

      if (action === 'approve') {
        // Execute tool now that it is authorized
        const apiKey = selectedAgent === 'agent-finance-01' ? 'finance-agent-key-dev-001' : 'cs-agent-key-dev-001';
        const execRes = await axios.post(
          '/api/waf/execute',
          { requestId: result.requestId, tool: result.tool, parameters: result.parameters },
          { headers: { Authorization: `Bearer ${apiKey}` }, validateStatus: () => true }
        );

        setResult((prev) => prev ? ({
          ...prev,
          decision: 'ALLOW',
          reason: 'Authorized & Approved by Compliance Officer',
          executionResult: execRes.data.result,
        }) : null);
      } else {
        setResult((prev) => prev ? ({
          ...prev,
          decision: 'BLOCK',
          reason: 'Rejected by Human Compliance Officer',
        }) : null);
      }
    } catch (e: any) {
      alert(`HITL Resolution failed: ${e.message}`);
    } finally {
      setHitlResolving(null);
    }
  };

  return (
    <div className="p-3 sm:p-6 space-y-4 sm:space-y-6 max-w-full overflow-x-hidden">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              <Terminal className="text-indigo-400" size={24} />
              AI Agent Interactive Playground
            </h1>
            <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
              Live End-to-End Testbed
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Experience the complete journey: <span className="text-slate-200 font-semibold">User Request → AI Agent Tool Selection → AegisWAF 7-Layer Interception → Execution Result</span>
          </p>
        </div>
      </div>

      {/* Preset Scenarios */}
      <div className="space-y-2">
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Quick Demo Scenarios (1-Click Presets):</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {PRESET_PROMPTS.map((p, idx) => (
            <button
              key={idx}
              onClick={() => applyPreset(p)}
              className="console-panel p-3 text-left hover:border-indigo-500/50 hover:bg-white/[0.03] transition space-y-1 group"
            >
              <div className="text-xs font-bold text-slate-200 group-hover:text-indigo-300 flex items-center justify-between">
                <span>{p.label}</span>
                <ArrowRight size={12} className="opacity-0 group-hover:opacity-100 transition text-indigo-400" />
              </div>
              <p className="text-[11px] text-slate-400 font-mono truncate">{p.prompt}</p>
              <p className="text-[10px] text-slate-500 leading-tight line-clamp-2">{p.desc}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Interactive Playground Main Area */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: User Input & Agent Invocation */}
        <div className="lg:col-span-5 console-panel p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-white/5 pb-3">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <User size={16} className="text-indigo-400" />
              1. End-User Natural Language Prompt
            </h3>
            <select
              value={selectedAgent}
              onChange={(e) => setSelectedAgent(e.target.value)}
              className="bg-black/50 border border-white/10 text-xs text-slate-300 rounded px-2.5 py-1 font-mono focus:outline-none focus:border-indigo-500"
            >
              <option value="agent-customer-support-01">customer-support-agent</option>
              <option value="agent-finance-01">finance-agent</option>
            </select>
          </div>

          {/* Natural Language Prompt Input */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300 flex items-center gap-2">
              User Request:
              {nlpParsing && (
                <span className="flex items-center gap-1 text-indigo-400 text-[10px] font-normal animate-pulse">
                  <Brain size={11} /> AI parsing intent...
                </span>
              )}
              {nlpIntent && !nlpParsing && (
                <span className="flex items-center gap-1 text-emerald-400 text-[10px] font-normal">
                  <CheckCircle size={11} /> Intent detected ({Math.round(nlpIntent.confidence * 100)}% confidence)
                </span>
              )}
            </label>
            <input
              type="text"
              value={promptText}
              onChange={(e) => handlePromptChange(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !loading && handleSend()}
              className="w-full bg-black/40 border border-white/10 rounded-lg px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
              placeholder="e.g. Transfer $5,000 to John  |  Search users where name is ' OR 1=1  |  Get profile for C999"
            />
            {/* NLP Reasoning Box */}
            {nlpIntent && !nlpParsing && (
              <div className="bg-indigo-950/50 border border-indigo-500/30 rounded-lg p-2.5 space-y-1">
                <p className="text-[10px] font-bold text-indigo-300 uppercase tracking-wider flex items-center gap-1">
                  <Brain size={10} /> Agent Intent Reasoning
                </p>
                <p className="text-[11px] text-slate-300">{nlpIntent.reasoning}</p>
                <div className="flex items-center gap-3 text-[10px] font-mono">
                  <span className="text-slate-500">intent:</span>
                  <span className="text-indigo-300">{nlpIntent.intent}</span>
                  <span className="text-slate-500">agent:</span>
                  <span className="text-amber-300">{nlpIntent.agentId.split('-')[1]}-agent</span>
                  <span className="text-slate-500">tool:</span>
                  <span className="text-emerald-300">{nlpIntent.tool}</span>
                </div>
              </div>
            )}
          </div>

          <div className="border-t border-white/5 pt-3 space-y-3">
            <h4 className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
              <Bot size={15} className="text-indigo-400" />
              2. Agent Intent Reasoning & Tool Selection
              {nlpIntent && <span className="text-[10px] font-normal text-emerald-400/80 ml-1">(auto-filled from NLP)</span>}
            </h4>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-[11px] text-slate-400">Selected Tool:</label>
                <select
                  value={selectedTool}
                  onChange={(e) => setSelectedTool(e.target.value)}
                  className="w-full bg-black/40 border border-white/10 rounded px-2.5 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-indigo-500"
                >
                  <option value="get_customer">get_customer</option>
                  <option value="search_customer">search_customer</option>
                  <option value="update_customer">update_customer</option>
                  <option value="transfer_money">transfer_money</option>
                  <option value="delete_customer">delete_customer</option>
                  <option value="send_email">send_email</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] text-slate-400">Session Tenant Scope:</label>
                <div className="bg-black/30 border border-white/5 rounded px-2.5 py-1.5 text-xs text-emerald-400 font-mono flex items-center justify-between">
                  <span>C101</span>
                  <span className="text-[10px] text-slate-500">BOUND</span>
                </div>
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[11px] text-slate-400 flex items-center gap-1.5">
                Tool Parameters (JSON):
                {nlpIntent && <span className="text-indigo-400/70 text-[10px]">(auto-extracted)</span>}
              </label>
              <textarea
                rows={4}
                value={paramsJson}
                onChange={(e) => setParamsJson(e.target.value)}
                className="w-full bg-black/60 border border-white/10 rounded-lg p-2.5 text-xs font-mono text-amber-300 focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          <button
            onClick={handleSend}
            disabled={loading || nlpParsing}
            className="w-full py-2.5 px-4 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs flex items-center justify-center gap-2 transition shadow-lg shadow-indigo-600/30 disabled:opacity-50 active:scale-95"
          >
            {loading ? <RefreshCw size={14} className="animate-spin" /> : nlpParsing ? <Brain size={14} className="animate-pulse" /> : <Send size={14} />}
            {loading ? 'Evaluating 7-Layer Defense...' : nlpParsing ? 'Parsing Intent...' : 'SEND REQUEST TO AGENT & WAF'}
          </button>
        </div>

        {/* Right Column: Execution Flow Visualization & Verdict */}
        <div className="lg:col-span-7 console-panel p-5 space-y-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-white/5 pb-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Layers size={18} className="text-indigo-400" />
                3. End-to-End Pipeline & Security Evaluation
              </h3>
              {result && (
                <span className="text-[11px] font-mono text-slate-400">
                  ⚡ Interception Latency: {result.latencyMs}ms
                </span>
              )}
            </div>

            {/* Visual Architecture Flowchart Bar */}
            <div className="py-3 px-4 my-2 bg-black/40 rounded-xl border border-white/5 flex items-center justify-between text-[11px] font-mono overflow-x-auto gap-2">
              <span className="text-slate-400 flex items-center gap-1">
                <User size={12} /> User
              </span>
              <ArrowRight size={12} className="text-slate-600 shrink-0" />
              <span className="text-indigo-300 flex items-center gap-1">
                <Bot size={12} /> Agent
              </span>
              <ArrowRight size={12} className="text-slate-600 shrink-0" />
              <span className="text-amber-300 font-bold flex items-center gap-1">
                <Shield size={12} /> AegisWAF (7-Layers)
              </span>
              <ArrowRight size={12} className="text-slate-600 shrink-0" />
              <span className={`font-bold flex items-center gap-1 ${
                !result
                  ? 'text-slate-500'
                  : result.decision === 'ALLOW'
                  ? 'text-emerald-400'
                  : result.decision === 'BLOCK'
                  ? 'text-red-400'
                  : result.decision === 'HITL'
                  ? 'text-amber-400'
                  : 'text-orange-400'
              }`}>
                {result ? result.decision : 'Verdict'}
              </span>
              <ArrowRight size={12} className="text-slate-600 shrink-0" />
              <span className="text-slate-400 flex items-center gap-1">
                <Database size={12} /> Tool / DB
              </span>
            </div>

            {!result ? (
              <div className="py-14 text-center space-y-2">
                <ShieldCheck size={44} className="text-slate-600 mx-auto animate-pulse" />
                <p className="text-slate-300 font-semibold text-sm">Pipeline Ready for Invocations</p>
                <p className="text-slate-500 text-xs">Select any scenario preset above or type a custom prompt to observe live interception.</p>
              </div>
            ) : (
              <div className="space-y-4 pt-1">
                {/* Decision Banner */}
                <div className={`p-4 rounded-xl border flex items-center justify-between ${
                  result.decision === 'ALLOW'
                    ? 'bg-emerald-950/30 border-emerald-500/40 text-emerald-300'
                    : result.decision === 'BLOCK'
                    ? 'bg-red-950/30 border-red-500/40 text-red-300'
                    : result.decision === 'HITL'
                    ? 'bg-amber-950/30 border-amber-500/40 text-amber-300'
                    : 'bg-orange-950/30 border-orange-500/40 text-orange-300'
                }`}>
                  <div className="flex items-center gap-3">
                    {result.decision === 'ALLOW' && <CheckCircle size={32} className="text-emerald-400" />}
                    {result.decision === 'BLOCK' && <XCircle size={32} className="text-red-400" />}
                    {result.decision === 'HITL' && <AlertTriangle size={32} className="text-amber-400 animate-bounce" />}
                    {result.decision === 'RATE_LIMIT' && <Clock size={32} className="text-orange-400" />}
                    <div>
                      <p className="text-[10px] uppercase font-bold tracking-wider opacity-80">WAF Final Verdict</p>
                      <h4 className="text-xl font-black tracking-wide">{result.decision}</h4>
                      <p className="text-xs opacity-90">{result.tool} ({selectedAgent})</p>
                    </div>
                  </div>

                  <div className="text-right">
                    <p className="text-[10px] uppercase font-bold tracking-wider opacity-80">Composite Risk</p>
                    <p className="text-2xl font-black font-mono">{result.riskScore}/100</p>
                    <span className="text-[10px] font-semibold opacity-75">
                      {result.riskScore <= 50 ? 'LOW RISK' : result.riskScore <= 90 ? 'ELEVATED RISK' : 'CRITICAL THREAT'}
                    </span>
                  </div>
                </div>

                {/* 7-Layer Checklist Inspection */}
                <div className="p-3 bg-black/40 rounded-xl border border-white/5 space-y-2">
                  <p className="text-[11px] font-bold text-slate-300 uppercase tracking-wider">7-Layer Security Checklist:</p>
                  <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                    <div className="flex items-center gap-1.5 text-emerald-400">
                      <CheckCircle size={13} /> Layer 1: Agent Auth & Nonce
                    </div>
                    <div className={`flex items-center gap-1.5 ${result.decision === 'RATE_LIMIT' ? 'text-orange-400 font-bold' : 'text-emerald-400'}`}>
                      {result.decision === 'RATE_LIMIT' ? <XCircle size={13} /> : <CheckCircle size={13} />} Layer 2: Redis Rate Limits
                    </div>
                    <div className={`flex items-center gap-1.5 ${result.reason?.includes('pattern') || result.reason?.includes('length') ? 'text-red-400 font-bold' : 'text-emerald-400'}`}>
                      {result.reason?.includes('pattern') || result.reason?.includes('length') ? <XCircle size={13} /> : <CheckCircle size={13} />} Layer 3: Parameter Threat Guard
                    </div>
                    <div className={`flex items-center gap-1.5 ${result.reason?.includes('scope') ? 'text-red-400 font-bold' : 'text-emerald-400'}`}>
                      {result.reason?.includes('scope') ? <XCircle size={13} /> : <CheckCircle size={13} />} Layer 4: BOLA Tenant Boundary
                    </div>
                    <div className={`flex items-center gap-1.5 ${result.reason?.includes('sequence') || result.reason?.includes('requires') ? 'text-red-400 font-bold' : 'text-emerald-400'}`}>
                      {result.reason?.includes('sequence') || result.reason?.includes('requires') ? <XCircle size={13} /> : <CheckCircle size={13} />} Layer 5: Sequence State Graph
                    </div>
                    <div className="flex items-center gap-1.5 text-emerald-400">
                      <CheckCircle size={13} /> Layer 6: Weighted Risk Engine
                    </div>
                  </div>
                </div>

                {/* Enforcement Reason Details */}
                {result.reason && (
                  <div className="p-3 bg-black/60 rounded-lg border border-white/5 space-y-1">
                    <p className="text-[11px] font-semibold text-slate-400">Reason / Policy Match:</p>
                    <p className="text-xs text-amber-200 font-mono">{result.reason}</p>
                  </div>
                )}

                {/* HITL Inline Action Panel */}
                {result.decision === 'HITL' && (
                  <div className="p-4 bg-amber-950/20 border border-amber-500/30 rounded-xl space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="text-amber-400" size={18} />
                        <div>
                          <p className="text-xs font-bold text-amber-300">Human-in-the-Loop Approval Required</p>
                          <p className="text-[11px] text-slate-400">Operation paused in compliance queue ({result.tool} ₹25,000)</p>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 pt-1">
                      <button
                        onClick={() => handleInlineHitlResolve('approve')}
                        disabled={hitlResolving !== null}
                        className="flex-1 py-2 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition disabled:opacity-50"
                      >
                        <CheckCheck size={14} /> {hitlResolving === 'approve' ? 'Authorizing...' : 'APPROVE & GRANT'}
                      </button>
                      <button
                        onClick={() => handleInlineHitlResolve('reject')}
                        disabled={hitlResolving !== null}
                        className="flex-1 py-2 px-3 rounded-lg bg-red-600 hover:bg-red-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition disabled:opacity-50"
                      >
                        <Ban size={14} /> {hitlResolving === 'reject' ? 'Rejecting...' : 'REJECT & BLOCK'}
                      </button>
                    </div>
                  </div>
                )}

                {/* Execution Result */}
                {result.decision === 'BLOCK' && (
                  <div className="p-3 bg-red-950/20 border border-red-500/20 rounded-lg text-xs font-mono text-red-300 flex items-center gap-2">
                    <Ban size={15} /> Upstream Tool Execution Status: <strong>NOT EXECUTED (Terminated by WAF)</strong>
                  </div>
                )}

                {result.executionResult && (
                  <div className="p-3 bg-black/60 rounded-lg border border-emerald-500/20 space-y-1.5">
                    <p className="text-[11px] font-semibold text-emerald-400 flex items-center gap-1">
                      <CheckCircle size={12} /> Downstream Backend Tool Execution Response:
                    </p>
                    <pre className="text-[11px] font-mono text-slate-300 overflow-x-auto p-2 bg-black/40 rounded border border-white/5">
                      {JSON.stringify(result.executionResult, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="pt-3 border-t border-white/5 text-[11px] text-slate-500 font-mono flex items-center justify-between">
            <span>AegisWAF Protocol PS-5.1</span>
            <span>Zero-Trust Runtime Gate</span>
          </div>
        </div>
      </div>
    </div>
  );
}
