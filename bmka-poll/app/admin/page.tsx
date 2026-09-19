'use client';
import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { supabase } from '../../lib/supabase';

interface Couple {
  id: string;
  name: string;
}

interface GeoConfig {
  enabled: boolean;
  lat: number;
  lng: number;
  radius_meters: number;
}

interface LiveSession {
  current_couple_id: string | null;
  timer_duration: number;
  started_at: string | null;
  status: 'idle' | 'voting' | 'completed';
}

function extractChestNumber(name: string): number {
  const match = name.match(/\d+/);
  return match ? parseInt(match[0], 10) : 999;
}

export default function Admin() {
  const [pin, setPin] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [couples, setCouples] = useState<Couple[]>([]);
  const [votes, setVotes] = useState<any[]>([]);
  const [uniqueVotersCount, setUniqueVotersCount] = useState(0);
  const [activeUsersNow, setActiveUsersNow] = useState(0);

  const [newCoupleName, setNewCoupleName] = useState('');
  const [adding, setAdding] = useState(false);
  const [statusMsg, setStatusMsg] = useState('Connecting...');

  // Stage display mode state ('live' | 'all')
  const [projectorMode, setProjectorMode] = useState<'live' | 'all'>('live');
  const [modeUpdating, setModeUpdating] = useState(false);

  // Live stage session state
  const [liveSession, setLiveSession] = useState<LiveSession>({
    current_couple_id: null,
    timer_duration: 60,
    started_at: null,
    status: 'idle'
  });
  const [selectedContestantId, setSelectedContestantId] = useState<string>('');
  const [sessionUpdating, setSessionUpdating] = useState(false);

  // Editing state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');

  // Winner announcement state
  const [winnerActive, setWinnerActive] = useState(false);
  const [winnerToggling, setWinnerToggling] = useState(false);

  // Geo config
  const [geoConfig, setGeoConfig] = useState<GeoConfig>({
    enabled: false,
    lat: 52.13597,
    lng: -0.46665,
    radius_meters: 500
  });
  const [geoSaving, setGeoSaving] = useState(false);

  const correctPin = 'Bmka2026@@';

  const fetchData = async () => {
    setStatusMsg('Syncing stage stats...');
    try {
      const { data: couplesData } = await supabase.from('couples').select('*');
      const { data: votesData } = await supabase.from('votes').select('*');
      
      const fortyFiveSecondsAgo = new Date(Date.now() - 45000).toISOString();
      const { data: activeData } = await supabase
        .from('active_sessions')
        .select('session_id')
        .gte('last_seen', fortyFiveSecondsAgo);

      const { data: geoData } = await supabase
        .from('app_settings')
        .select('value')
        .eq('key', 'geo_fence')
        .single();

      const { data: winData } = await supabase
        .from('app_settings')
        .select('value')
        .eq('key', 'winner_announcement')
        .single();

      const { data: sessionData } = await supabase
        .from('app_settings')
        .select('value')
        .eq('key', 'live_contestant_session')
        .single();

      const { data: modeData } = await supabase
        .from('app_settings')
        .select('value')
        .eq('key', 'projector_display_mode')
        .single();

      if (couplesData) {
        const sorted = [...couplesData].sort((a, b) => extractChestNumber(a.name) - extractChestNumber(b.name));
        setCouples(sorted);
        if (!selectedContestantId && sorted.length > 0) {
          setSelectedContestantId(sessionData?.value?.current_couple_id || sorted[0].id);
        }
      }
      if (votesData) {
        setVotes(votesData);
        const tokens = new Set(votesData.map((v) => v.voter_token).filter(Boolean));
        setUniqueVotersCount(tokens.size);
      }
      if (activeData) setActiveUsersNow(activeData.length);
      if (geoData?.value) setGeoConfig(geoData.value);
      if (winData?.value?.active !== undefined) setWinnerActive(winData.value.active);
      if (modeData?.value?.mode) setProjectorMode(modeData.value.mode);

      if (sessionData?.value) {
        setLiveSession(sessionData.value);
        if (sessionData.value.current_couple_id) {
          setSelectedContestantId(sessionData.value.current_couple_id);
        }
      }

      setStatusMsg(`Connected: ${couplesData?.length || 0} contestants • ${activeData?.length || 0} online`);
    } catch (err: any) {
      setStatusMsg('Error: ' + err.message);
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      fetchData();
      const interval = setInterval(fetchData, 4000);
      return () => clearInterval(interval);
    }
  }, [isAuthenticated]);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (pin === correctPin) {
      setIsAuthenticated(true);
    } else {
      alert('Invalid Passcode.');
      setPin('');
    }
  };

  const handleSwitchProjectorMode = async (mode: 'live' | 'all') => {
    setModeUpdating(true);
    const { error } = await supabase
      .from('app_settings')
      .upsert([{ key: 'projector_display_mode', value: { mode } }]);
    setModeUpdating(false);

    if (error) {
      alert('Failed to switch projector screen: ' + error.message);
    } else {
      setProjectorMode(mode);
    }
  };

  const handleStartVotingSession = async () => {
    if (!selectedContestantId) {
      alert('Please select a contestant first');
      return;
    }

    setSessionUpdating(true);
    const newSession: LiveSession = {
      current_couple_id: selectedContestantId,
      timer_duration: 60,
      started_at: new Date().toISOString(),
      status: 'voting'
    };

    // Auto set screen to live single view when voting starts
    await supabase.from('app_settings').upsert([{ key: 'projector_display_mode', value: { mode: 'live' } }]);
    setProjectorMode('live');

    const { error } = await supabase
      .from('app_settings')
      .upsert([{ key: 'live_contestant_session', value: newSession }]);
    setSessionUpdating(false);

    if (error) {
      alert('Failed to start session: ' + error.message);
    } else {
      setLiveSession(newSession);
    }
  };

  const handleEndVotingSession = async () => {
    setSessionUpdating(true);
    const updated: LiveSession = {
      ...liveSession,
      status: 'completed'
    };

    const { error } = await supabase
      .from('app_settings')
      .upsert([{ key: 'live_contestant_session', value: updated }]);
    setSessionUpdating(false);

    if (error) {
      alert('Failed to stop session: ' + error.message);
    } else {
      setLiveSession(updated);
    }
  };

  const handleResetStageSession = async () => {
    setSessionUpdating(true);
    const reset: LiveSession = {
      current_couple_id: selectedContestantId,
      timer_duration: 60,
      started_at: null,
      status: 'idle'
    };

    const { error } = await supabase
      .from('app_settings')
      .upsert([{ key: 'live_contestant_session', value: reset }]);
    setSessionUpdating(false);

    if (error) {
      alert('Failed to reset: ' + error.message);
    } else {
      setLiveSession(reset);
    }
  };

  const handleAddCouple = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCoupleName.trim()) return;

    setAdding(true);
    const { error } = await supabase.from('couples').insert([{ name: newCoupleName.trim() }]);
    setAdding(false);

    if (error) {
      alert('Error adding: ' + error.message);
      return;
    }

    setNewCoupleName('');
    fetchData();
  };

  const handleStartRename = (couple: Couple) => {
    setEditingId(couple.id);
    setEditingName(couple.name);
  };

  const handleSaveRename = async (id: string) => {
    if (!editingName.trim()) return;
    const { error } = await supabase.from('couples').update({ name: editingName.trim() }).eq('id', id);
    if (error) {
      alert('Rename failed: ' + error.message);
    } else {
      setEditingId(null);
      fetchData();
    }
  };

  const handleDeleteCouple = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete ${name}?`)) return;
    await supabase.from('couples').delete().eq('id', id);
    fetchData();
  };

  const handleToggleWinner = async () => {
    const nextState = !winnerActive;
    if (nextState && !confirm('Trigger WINNER ANNOUNCEMENT stage on the projector?')) {
      return;
    }
    setWinnerToggling(true);
    const { error } = await supabase
      .from('app_settings')
      .upsert([{ key: 'winner_announcement', value: { active: nextState } }]);
    setWinnerToggling(false);

    if (error) {
      alert('Failed to update stage: ' + error.message);
    } else {
      setWinnerActive(nextState);
    }
  };

  const handleResetVotes = async () => {
    if (!confirm('DANGER: Permanently wipe ALL votes for all contestants?')) return;
    await supabase.from('votes').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    alert('All votes have been cleared.');
    fetchData();
  };

  const currentOnStage = couples.find((c) => c.id === liveSession.current_couple_id);
  const currentOnStageVotes = votes.filter((v) => v.couple_id === liveSession.current_couple_id);

  if (!isAuthenticated) {
    return (
      <main className="min-h-screen bg-slate-950 flex items-center justify-center p-4 font-sans">
        <form onSubmit={handleLogin} className="bg-slate-900 p-8 rounded-2xl shadow-2xl max-w-sm w-full border border-slate-800 text-white text-center">
          <div className="text-3xl mb-2">🔒</div>
          <h2 className="text-xl font-bold mb-1">BMKA Admin Console</h2>
          <p className="text-xs text-slate-400 mb-6">Enter secure passcode to continue</p>
          <input
            type="password"
            placeholder="••••••••••••"
            value={pin}
            autoFocus
            onChange={(e) => setPin(e.target.value)}
            className="w-full p-3 bg-slate-800 border border-slate-700 rounded-xl mb-4 text-center text-lg tracking-widest text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
          />
          <button type="submit" className="w-full bg-amber-600 hover:bg-amber-500 font-bold py-3 rounded-xl transition shadow text-slate-950">
            Unlock Console
          </button>
        </form>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 text-white p-4 sm:p-8 font-sans">
      <div className="max-w-6xl mx-auto space-y-6">
        
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-800 pb-4">
          <div>
            <h1 className="text-2xl font-black text-amber-500">BMKA 2026 Admin Dashboard</h1>
            <p className="text-xs text-slate-400">Live Stage Controller & Real-Time Scrutiny</p>
            <span className="inline-block mt-1 text-[11px] px-2.5 py-0.5 rounded bg-slate-900 text-emerald-400 font-mono border border-slate-800">
              {statusMsg}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={fetchData} className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg text-xs font-semibold">
              🔄 Refresh
            </button>
            <button onClick={handleResetVotes} className="px-3.5 py-2 bg-red-950/40 border border-red-800 text-red-300 hover:bg-red-900/60 rounded-lg text-xs font-semibold">
              ⚠️ Reset All Votes
            </button>
            <Link href="/" className="px-3.5 py-2 bg-amber-600 hover:bg-amber-500 text-slate-950 font-bold rounded-lg text-xs">
              Audience Poll
            </Link>
          </div>
        </div>

        {/* ================= PROJECTOR SCREEN MASTER VIEW SWITCHER ================= */}
        <div className="bg-slate-900/90 border border-slate-800 p-4 rounded-2xl flex flex-col sm:flex-row justify-between items-center gap-3 shadow-lg">
          <div>
            <span className="text-[10px] font-mono uppercase text-amber-400 font-bold block">Projector Big Screen Display Mode</span>
            <p className="text-xs text-slate-300">Choose what the stage screen shows right now</p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => handleSwitchProjectorMode('live')}
              disabled={modeUpdating}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                projectorMode === 'live'
                  ? 'bg-amber-500 text-black shadow-md shadow-amber-500/20'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              <span>🎯 Live Stage (60s Timer)</span>
            </button>

            <button
              onClick={() => handleSwitchProjectorMode('all')}
              disabled={modeUpdating}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                projectorMode === 'all'
                  ? 'bg-amber-500 text-black shadow-md shadow-amber-500/20'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              <span>📊 All Contestants Details</span>
            </button>
          </div>
        </div>

        {/* ================= STAGE LIVE CONTROLLER ================= */}
        <div className="bg-gradient-to-r from-amber-950/60 via-slate-900 to-slate-900 border-2 border-amber-500/70 p-6 rounded-3xl shadow-2xl space-y-5">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 border-b border-slate-800 pb-3">
            <div className="flex items-center gap-3">
              <span className="text-2xl">🎤</span>
              <div>
                <h2 className="text-lg font-black text-white">Live Contestant Stage Controller</h2>
                <p className="text-xs text-slate-400">Spectators can only vote for the contestant currently on stage</p>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <span className={`text-xs px-3 py-1 rounded-full font-mono font-black uppercase ${
                liveSession.status === 'voting'
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/50 animate-pulse'
                  : liveSession.status === 'completed'
                  ? 'bg-red-500/20 text-red-400 border border-red-500/50'
                  : 'bg-slate-800 text-slate-400'
              }`}>
                {liveSession.status === 'voting' ? '🟢 Voting Open (60s)' : liveSession.status === 'completed' ? '🔴 Voting Closed' : '⚪ Stage Idle'}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-center">
            {/* 1. Pick Contestant */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-300 uppercase tracking-wider block">
                1. Select Contestant Taking the Stage:
              </label>
              <select
                value={selectedContestantId}
                disabled={liveSession.status === 'voting'}
                onChange={(e) => setSelectedContestantId(e.target.value)}
                className="w-full p-3 bg-slate-800 border border-slate-700 rounded-xl text-sm font-bold text-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-500 disabled:opacity-50"
              >
                {couples.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            {/* 2. Live Controls */}
            <div className="lg:col-span-2 flex flex-wrap items-center gap-3">
              <button
                onClick={handleStartVotingSession}
                disabled={sessionUpdating || liveSession.status === 'voting'}
                className="flex-1 min-w-[200px] py-3.5 bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white font-black text-sm rounded-xl shadow-lg transition disabled:opacity-40"
              >
                ▶ Start 60s Live Voting
              </button>

              <button
                onClick={handleEndVotingSession}
                disabled={sessionUpdating || liveSession.status !== 'voting'}
                className="px-5 py-3.5 bg-red-600 hover:bg-red-500 text-white font-black text-sm rounded-xl shadow transition disabled:opacity-40"
              >
                ⏹ Close Voting Early
              </button>

              <button
                onClick={handleResetStageSession}
                disabled={sessionUpdating}
                className="px-4 py-3.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs rounded-xl border border-slate-700 transition"
              >
                ↺ Reset
              </button>
            </div>
          </div>

          <div className="bg-slate-950/80 p-3.5 rounded-xl border border-slate-800/80 flex flex-wrap justify-between items-center text-xs font-mono">
            <div>
              <span className="text-slate-500">Currently Active: </span>
              <strong className="text-amber-400 text-sm font-sans">{currentOnStage?.name || 'None'}</strong>
            </div>
            <div>
              <span className="text-slate-500">Ballots Cast in this Round: </span>
              <strong className="text-white text-sm">{currentOnStageVotes.length}</strong>
            </div>
          </div>
        </div>

        {/* Live Audience Analytics Badges */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="bg-slate-900/90 p-4 rounded-xl border border-slate-800">
            <span className="text-[10px] text-slate-400 font-mono uppercase tracking-wider block">Live Online Now</span>
            <div className="text-2xl font-black text-emerald-400 font-mono flex items-center gap-2 mt-1">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
              </span>
              {activeUsersNow}
            </div>
            <span className="text-[10px] text-slate-500 mt-1 block">Active spectators</span>
          </div>

          <div className="bg-slate-900/90 p-4 rounded-xl border border-slate-800">
            <span className="text-[10px] text-slate-400 font-mono uppercase tracking-wider block">Total Voters</span>
            <div className="text-2xl font-black text-amber-400 font-mono mt-1">
              {uniqueVotersCount}
            </div>
            <span className="text-[10px] text-slate-500 mt-1 block">Unique devices voted</span>
          </div>

          <div className="bg-slate-900/90 p-4 rounded-xl border border-slate-800">
            <span className="text-[10px] text-slate-400 font-mono uppercase tracking-wider block">Total Ballots Cast</span>
            <div className="text-2xl font-black text-white font-mono mt-1">
              {votes.length}
            </div>
            <span className="text-[10px] text-slate-500 mt-1 block">All contestants combined</span>
          </div>

          <div className="bg-slate-900/90 p-4 rounded-xl border border-slate-800">
            <span className="text-[10px] text-slate-400 font-mono uppercase tracking-wider block">Contestants</span>
            <div className="text-2xl font-black text-cyan-400 font-mono mt-1">
              {couples.length}
            </div>
            <span className="text-[10px] text-slate-500 mt-1 block">In competition roster</span>
          </div>
        </div>

        {/* Winner Announcement Toggle */}
        <div className={`p-5 rounded-2xl border transition-all flex flex-col sm:flex-row justify-between items-center gap-4 ${
          winnerActive
            ? 'bg-gradient-to-r from-amber-950/80 via-yellow-950/60 to-slate-900 border-amber-500 shadow-xl shadow-amber-500/20'
            : 'bg-slate-900/90 border-slate-800'
        }`}>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xl">🏆</span>
              <h2 className="text-base font-bold text-white">Grand Championship Announcement</h2>
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-mono font-bold ${
                winnerActive ? 'bg-amber-500 text-black animate-pulse' : 'bg-slate-800 text-slate-400'
              }`}>
                {winnerActive ? 'LIVE ON STAGE' : 'Standby'}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Pauses all voting and reveals the Top 3 Champions with fireworks on the big screen.
            </p>
          </div>

          <button
            onClick={handleToggleWinner}
            disabled={winnerToggling}
            className={`px-5 py-2.5 rounded-xl font-extrabold text-xs transition tracking-wider uppercase shadow-lg ${
              winnerActive
                ? 'bg-red-600 hover:bg-red-500 text-white'
                : 'bg-gradient-to-r from-amber-500 to-yellow-400 text-slate-950 hover:from-amber-400 hover:to-yellow-300'
            }`}
          >
            {winnerActive ? '⏹ Close Winner Screen' : '🎉 Announce Winner Now'}
          </button>
        </div>

        {/* Contestants Management (Add, Rename, Delete) */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="bg-slate-900/90 p-5 rounded-2xl border border-slate-800 space-y-4">
            <h2 className="text-sm font-bold flex items-center gap-2">
              <span>➕ Add Contestant</span>
            </h2>
            <form onSubmit={handleAddCouple} className="space-y-3">
              <input
                type="text"
                placeholder="e.g. Chest No 26"
                value={newCoupleName}
                onChange={(e) => setNewCoupleName(e.target.value)}
                className="w-full p-2.5 bg-slate-800 border border-slate-700 rounded-lg text-xs text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
              <button
                type="submit"
                disabled={adding}
                className="w-full bg-emerald-600 hover:bg-emerald-500 py-2.5 rounded-lg text-xs font-bold transition disabled:opacity-50"
              >
                {adding ? 'Adding...' : 'Add Contestant'}
              </button>
            </form>
          </div>

          <div className="lg:col-span-2 bg-slate-900/90 p-5 rounded-2xl border border-slate-800">
            <div className="flex justify-between items-center mb-3">
              <h2 className="text-sm font-bold">👥 Roster & Rename ({couples.length})</h2>
              <span className="text-[10px] text-slate-400 font-mono">Tap ✏️ to rename contestant</span>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-80 overflow-y-auto pr-1">
              {couples.map((c) => (
                <div key={c.id} className="flex justify-between items-center p-2 rounded-lg bg-slate-800/80 border border-slate-700 text-xs">
                  {editingId === c.id ? (
                    <div className="flex items-center gap-1.5 w-full">
                      <input
                        type="text"
                        value={editingName}
                        onChange={(e) => setEditingName(e.target.value)}
                        className="flex-1 p-1 bg-slate-700 border border-amber-500 rounded text-xs text-white"
                        autoFocus
                      />
                      <button
                        onClick={() => handleSaveRename(c.id)}
                        className="px-2 py-1 bg-emerald-600 rounded text-[10px] font-bold"
                      >
                        Save
                      </button>
                      <button
                        onClick={() => setEditingId(null)}
                        className="px-2 py-1 bg-slate-700 rounded text-[10px]"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <>
                      <span className="truncate font-medium flex-1">{c.name}</span>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleStartRename(c)}
                          className="text-amber-400 hover:text-amber-300 text-[10px] px-2 py-0.5 rounded bg-slate-700 hover:bg-slate-600 border border-slate-600"
                        >
                          ✏️ Rename
                        </button>
                        <button
                          onClick={() => handleDeleteCouple(c.id, c.name)}
                          className="text-red-400 hover:text-red-300 text-[10px] px-1.5 py-0.5 rounded bg-red-950/40 border border-red-800/60"
                        >
                          ✕
                        </button>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

      </div>
    </main>
  );
}
