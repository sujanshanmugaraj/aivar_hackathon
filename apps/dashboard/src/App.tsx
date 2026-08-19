import React, { useState } from 'react';
import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom';
import { Shield, Activity, FileText, AlertTriangle, Settings, Bot, Sliders, Play, Terminal, Menu, X } from 'lucide-react';
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
  isOpen,
  onClose,
}: {
  connected: boolean;
  onRunDemo: () => void;
  demoRunning: boolean;
  isOpen: boolean;
  onClose: () => void;
}) {
  return (
    <>
      {/* Mobile Backdrop Overlay */}
      {isOpen && (
        <div
          onClick={onClose}
          className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm lg:hidden transition-opacity"
        />
      )}

      {/* Sidebar Container */}
      <aside
        className={`fixed lg:static top-0 left-0 bottom-0 z-50 w-64 min-h-screen border-r border-white/10 bg-[#0e131f] flex flex-col p-4 shrink-0 transition-transform duration-300 ease-in-out ${
          isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        {/* Brand Header */}
        <div className="flex items-center justify-between px-2 py-3 mb-3 border-b border-white/5 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-indigo-600 rounded-lg flex items-center justify-center shadow-lg shadow-indigo-600/30">
              <Shield size={20} className="text-white" />
            </div>
            <div>
              <p className="font-bold text-white text-sm tracking-wide">AegisWAF</p>
              <p className="text-[10px] uppercase font-mono tracking-wider text-indigo-400 font-semibold">Agent Control Plane</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-white lg:hidden rounded-lg hover:bg-white/5"
          >
            <X size={20} />
          </button>
        </div>

        {/* Demo Action Button in Sidebar */}
        <button
          onClick={() => {
            onRunDemo();
            onClose();
          }}
          disabled={demoRunning}
          className={`mb-4 w-full flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg text-xs font-bold transition shadow-sm ${
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
        <div className="space-y-1">
          <NavLink to="/" end onClick={onClose} className={({ isActive }) => `nav-btn ${isActive ? 'active' : ''}`}>
            <Activity size={16} /> Overview
          </NavLink>
          <NavLink to="/playground" onClick={onClose} className={({ isActive }) => `nav-btn ${isActive ? 'active' : ''}`}>
            <Terminal size={16} /> Agent Playground
          </NavLink>
          <NavLink to="/agents" onClick={onClose} className={({ isActive }) => `nav-btn ${isActive ? 'active' : ''}`}>
            <Bot size={16} /> Governed Agents
          </NavLink>
          <NavLink to="/policies" onClick={onClose} className={({ isActive }) => `nav-btn ${isActive ? 'active' : ''}`}>
            <Sliders size={16} /> Policy Engine
          </NavLink>
          <NavLink to="/events" onClick={onClose} className={({ isActive }) => `nav-btn ${isActive ? 'active' : ''}`}>
            <FileText size={16} /> Audit Log
          </NavLink>
          <NavLink to="/hitl" onClick={onClose} className={({ isActive }) => `nav-btn ${isActive ? 'active' : ''}`}>
            <AlertTriangle size={16} /> HITL Queue
          </NavLink>
        </div>

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
      </aside>
    </>
  );
}

export default function App() {
  const { events, connected, clearEvents, refreshEvents } = useWafEvents();
  const [demoRunning, setDemoRunning] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const handleRunDemo = async () => {
    setDemoRunning(true);
    try {
      await axios.post('/api/system/run-demo', {});
      setTimeout(() => {
        refreshEvents();
        setDemoRunning(false);
      }, 3000);
    } catch {
      setDemoRunning(false);
    }
  };

  return (
    <BrowserRouter>
      <div className="flex min-h-screen bg-[#0b0f17] text-slate-100 flex-col lg:flex-row overflow-x-hidden">
        {/* Mobile Top Navbar */}
        <header className="lg:hidden flex items-center justify-between px-4 py-3 bg-[#0e131f] border-b border-white/10 sticky top-0 z-30">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 bg-indigo-600 rounded-md flex items-center justify-center">
              <Shield size={16} className="text-white" />
            </div>
            <div>
              <p className="font-bold text-white text-xs tracking-wide">AegisWAF</p>
              <p className="text-[9px] uppercase font-mono text-indigo-400 font-semibold">Mobile Console</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleRunDemo}
              disabled={demoRunning}
              className="px-2.5 py-1 text-[10px] font-bold rounded bg-indigo-600 text-white flex items-center gap-1 active:scale-95"
            >
              <Play size={10} className={demoRunning ? 'animate-spin' : 'fill-white'} />
              {demoRunning ? '...' : 'Demo'}
            </button>
            <button
              onClick={() => setMobileNavOpen(true)}
              className="p-1.5 text-slate-300 hover:text-white rounded-lg bg-white/5 border border-white/10"
              aria-label="Open Navigation Menu"
            >
              <Menu size={18} />
            </button>
          </div>
        </header>

        {/* Sidebar Component with responsive overlay */}
        <Sidebar
          connected={connected}
          onRunDemo={handleRunDemo}
          demoRunning={demoRunning}
          isOpen={mobileNavOpen}
          onClose={() => setMobileNavOpen(false)}
        />

        {/* Main Content Area */}
        <main className="flex-1 overflow-x-hidden p-3 sm:p-6 bg-[#0b0f17] w-full max-w-full">
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
