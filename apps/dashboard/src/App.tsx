import React, { useState } from 'react';
import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom';
import { Shield, Activity, FileText, AlertTriangle, Settings, Bot, Sliders, Play, Terminal } from 'lucide-react';
import axios from 'axios';
import { useWafEvents } from './hooks/useWafEvents';
import Overview from './pages/Overview';
import Events from './pages/Events';
import HitlQueue from './pages/HitlQueue';
import Policies from './pages/Policies';
import Agents from './pages/Agents';
import Playground from './pages/Playground';

function Sidebar({
  connected,
  onRunDemo,
  demoRunning,
}: {
  connected: boolean;
  onRunDemo: () => void;
  demoRunning: boolean;
}) {
  return (
    <div className="w-60 min-h-screen border-r border-white/5 bg-[#0e131f] flex flex-col p-4 gap-1 shrink-0">
      {/* Brand Header */}
      <div className="flex items-center gap-3 px-2 py-3 mb-3 border-b border-white/5 pb-4">
        <div className="w-9 h-9 bg-indigo-600 rounded-lg flex items-center justify-center shadow-lg shadow-indigo-600/30">
          <Shield size={20} className="text-white" />
        </div>
        <div>
          <p className="font-bold text-white text-sm tracking-wide">AegisWAF</p>
          <p className="text-[10px] uppercase font-mono tracking-wider text-indigo-400 font-semibold">Agent Control Plane</p>
        </div>
      </div>

      {/* Demo Action Button in Sidebar */}
      <button
        onClick={onRunDemo}
        disabled={demoRunning}
        className={`mb-4 w-full flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-bold transition shadow-sm ${
          demoRunning
            ? 'bg-indigo-600/40 text-indigo-300 cursor-not-allowed'
            : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-600/20 active:scale-95'
        }`}
      >
        <Play size={13} className={demoRunning ? 'animate-spin' : 'fill-white'} />
        {demoRunning ? 'Simulating...' : '▶ RUN SECURITY DEMO'}
      </button>

      {/* Primary Navigation */}
      <p className="px-2 text-[10px] uppercase font-bold text-slate-500 tracking-wider mb-1">Navigation</p>

      <NavLink to="/" end className={({ isActive }) => `nav-btn ${isActive ? 'active' : ''}`}>
        <Activity size={16} /> Overview
      </NavLink>
      <NavLink to="/playground" className={({ isActive }) => `nav-btn ${isActive ? 'active' : ''}`}>
        <Terminal size={16} /> Agent Playground
      </NavLink>
      <NavLink to="/agents" className={({ isActive }) => `nav-btn ${isActive ? 'active' : ''}`}>
        <Bot size={16} /> Governed Agents
      </NavLink>
      <NavLink to="/policies" className={({ isActive }) => `nav-btn ${isActive ? 'active' : ''}`}>
        <Sliders size={16} /> Policy Engine
      </NavLink>
      <NavLink to="/events" className={({ isActive }) => `nav-btn ${isActive ? 'active' : ''}`}>
        <FileText size={16} /> Audit Log
      </NavLink>
      <NavLink to="/hitl" className={({ isActive }) => `nav-btn ${isActive ? 'active' : ''}`}>
        <AlertTriangle size={16} /> HITL Queue
      </NavLink>

      {/* System Status in Footer */}
      <div className="mt-auto pt-4 border-t border-white/5 space-y-2">
        <div className="flex items-center justify-between text-xs px-2">
          <span className="text-slate-500 text-[11px]">System Status</span>
          <span className="text-[11px] font-semibold text-emerald-400 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            OPERATIONAL
          </span>
        </div>
        <div className="flex items-center justify-between text-xs px-2">
          <span className="text-slate-500 text-[11px]">Event Stream</span>
          <span className={`text-[11px] font-mono font-medium ${connected ? 'text-indigo-400' : 'text-amber-400'}`}>
            {connected ? 'LIVE WS' : 'RECONNECTING'}
          </span>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const { events, connected, clearEvents, refreshEvents } = useWafEvents();
  const [demoRunning, setDemoRunning] = useState(false);

  const handleRunDemo = async () => {
    setDemoRunning(true);
    try {
      await axios.post('/api/system/run-demo');
      setTimeout(() => {
        refreshEvents();
        setDemoRunning(false);
      }, 4000);
    } catch {
      setDemoRunning(false);
    }
  };

  return (
    <BrowserRouter>
      <div className="flex min-h-screen bg-[#0b0f17]">
        <Sidebar connected={connected} onRunDemo={handleRunDemo} demoRunning={demoRunning} />
        <main className="flex-1 overflow-auto bg-[#0b0f17]">
          <Routes>
            <Route path="/" element={<Overview events={events} onRunDemo={handleRunDemo} demoRunning={demoRunning} />} />
            <Route path="/playground" element={<Playground />} />
            <Route path="/agents" element={<Agents />} />
            <Route path="/policies" element={<Policies />} />
            <Route path="/events" element={<Events events={events} onClear={clearEvents} onRefresh={refreshEvents} />} />
            <Route path="/hitl" element={<HitlQueue />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}
