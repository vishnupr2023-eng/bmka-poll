'use client';
import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { supabase } from '../../lib/supabase';

interface Couple {
  id: string;
  name: string;
}

interface EventProfile {
  org_name: string;
  event_name: string;
  sub_title: string;
  default_timer_seconds: number;
}

interface AdminUser {
  id: string;
  name: string;
  passcode: string;
  role: string;
}

interface ProjectorControl {
  display_mode: 'live' | 'all';
  active_criterion: string;
  auto_rotate: boolean;
  rotation_speed_seconds: number;
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
  const [passcode, setPasscode] = useState('');
  const [currentAdmin, setCurrentAdmin] = useState<AdminUser | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [activeTab, setActiveTab] = useState<'stage' | 'event' | 'projector' | 'admins' | 'contestants'>('stage');

  // Core Data
  const [couples, setCouples] = useState<Couple[]>([]);
  const [votes, setVotes] = useState<any[]>([]);
  const [uniqueVotersCount, setUniqueVotersCount] = useState(0);
  const [activeUsersNow, setActiveUsersNow] = useState(0);

  // Dynamic Event Profile
  const [eventProfile, setEventProfile] = useState<EventProfile>({
    org_name: 'Bedford Marston Kerala Association',
    event_name: 'Kerala Thanima 2026',
    sub_title: 'Official Audience Voting Portal',
    default_timer_seconds: 60
  });
  const [savingProfile, setSavingProfile] = useState(false);

  // Projector Controller State
  const [projControl, setProjControl] = useState<ProjectorControl>({
    display_mode: 'live',
    active_criterion: 'total',
    auto_rotate: true,
    rotation_speed_seconds: 10
  });

  // Live Stage Session
  const [liveSession, setLiveSession] = useState<LiveSession>({
    current_couple_id: null,
    timer_duration: 60,
    started_at: null,
    status: 'idle'
  });
  const [selectedContestantId, setSelectedContestantId] = useState<string>('');
  const [customRoundSeconds, setCustomRoundSeconds] = useState<number>(60);

  // Admins List
  const [adminList, setAdminList] = useState<AdminUser[]>([]);
  const [newAdminName, setNewAdminName] = useState('');
  const [newAdminPasscode, setNewAdminPasscode] = useState('');

  // Contestant Editing
  const [newCoupleName, setNewCoupleName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');

  // Winner Announcement
  const [winnerActive, setWinnerActive] = useState(false);
  const [copyFeedback, setCopyFeedback] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passcode.trim()) return;

    // First check default master passcode
    if (passcode.trim() === 'Bmka2026@@') {
      setCurrentAdmin({
        id: 'master-admin',
        name: 'Master Admin',
        passcode: 'Bmka2026@@',
        role: 'superadmin'
      });
      setIsAuthenticated(true);
      return;
    }

    // Check database authorized admins
    const { data: user } = await supabase
      .from('admin_users')
      .select('*')
      .eq('passcode', passcode.trim())
      .maybeSingle();

    if (user) {
      setCurrentAdmin(user);
      setIsAuthenticated(true);
    } else {
      alert('Access Denied: Invalid admin passcode');
      setPasscode('');
    }
  };

  const fetchGlobalData = async () => {
    try {
      // 1. Fetch Event Profile
      const { data: profile } = await supabase.from('event_profile').select('*').eq('id', 'primary_event').maybeSingle();
      if (profile) {
        setEventProfile({
          org_name: profile.org_name || 'Bedford Marston Kerala Association',
          event_name: profile.event_name || 'Kerala Thanima 2026',
          sub_title: profile.sub_title || 'Official Audience Voting Portal',
          default_timer_seconds: profile.default_timer_seconds || 60
        });
      }

      // 2. Fetch Projector Control Settings
      const { data: projData } = await supabase.from('app_settings').select('value').eq('key', 'projector_control').maybeSingle();
      if (projData?.value) {
        setProjControl(projData.value);
      }

      // 3. Fetch Active Admins
      const { data: admins } = await supabase.from('admin_users').select('*').order('created_at', { ascending: true });
      if (admins) setAdminList(admins);

      // 4. Fetch Couples & Votes
      const { data: couplesData } = await supabase.from('couples').select('*');
      const { data: votesData } = await supabase.from('votes').select('*');

      if (couplesData) {
        const sorted = [...couplesData].sort((a, b) => extractChestNumber(a.name) - extractChestNumber(b.name));
        setCouples(sorted);
        if (!selectedContestantId && sorted.length > 0) {
          setSelectedContestantId(sorted[0].id);
        }
      }

      if (votesData) {
        setVotes(votesData);
        const tokens = new Set(votesData.map((v) => v.voter_token).filter(Boolean));
        setUniqueVotersCount(tokens.size);
      }

      // 5. Active Live Sessions
      const fortyFiveSecondsAgo = new Date(Date.now() - 45000).toISOString();
      const { data: activeData } = await supabase.from('active_sessions').select('session_id').gte('last_seen', fortyFiveSecondsAgo);
      if (activeData) setActiveUsersNow(activeData.length);

      // 6. Stage Live Session
      const { data: sessionData } = await supabase.from('app_settings').select('value').eq('key', 'live_contestant_session').maybeSingle();
      if (sessionData?.value) setLiveSession(sessionData.value);

      // 7. Winner state
      const { data: winData } = await supabase.from('app_settings').select('value').eq('key', 'winner_announcement').maybeSingle();
      if (winData?.value?.active !== undefined) setWinnerActive(winData.value.active);

    } catch (err: any) {
      console.error(err);
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      fetchGlobalData();
      const interval = setInterval(fetchGlobalData, 4000);
      return () => clearInterval(interval);
    }
  }, [isAuthenticated]);

  // Save Event Profile
  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingProfile(true);
    const { error } = await supabase.from('event_profile').upsert([{
      id: 'primary_event',
      org_name: eventProfile.org_name,
      event_name: eventProfile.event_name,
      sub_title: eventProfile.sub_title,
      default_timer_seconds: Number(eventProfile.default_timer_seconds)
    }], { onConflict: 'id' });
    setSavingProfile(false);

    if (error) {
      alert('Failed to save profile: ' + error.message);
    } else {
      alert('Organization & Event Profile successfully updated globally!');
    }
  };

  // Remote Projector Controller
  const handleUpdateProjectorControl = async (partial: Partial<ProjectorControl>) => {
    const updated = { ...projControl, ...partial };
    setProjControl(updated);
    await supabase.from('app_settings').upsert([
      { key: 'projector_control', value: updated }
    ], { onConflict: 'key' });
  };

  // Live Stage Round Controller
  const handleStartVotingRound = async () => {
    if (!selectedContestantId) {
      alert('Please choose a contestant first');
      return;
    }

    const duration = customRoundSeconds || eventProfile.default_timer_seconds || 60;
    const newSession: LiveSession = {
      current_couple_id: selectedContestantId,
      timer_duration: duration,
      started_at: new Date().toISOString(),
      status: 'voting'
    };

    handleUpdateProjectorControl({ display_mode: 'live' });

    await supabase.from('app_settings').upsert([
      { key: 'live_contestant_session', value: newSession }
    ], { onConflict: 'key' });

    setLiveSession(newSession);
  };

  const handleStopVotingEarly = async () => {
    const updated: LiveSession = { ...liveSession, status: 'completed' };
    await supabase.from('app_settings').upsert([
      { key: 'live_contestant_session', value: updated }
    ], { onConflict: 'key' });
    setLiveSession(updated);
  };

  const handleResetStage = async () => {
    const reset: LiveSession = {
      current_couple_id: null,
      timer_duration: eventProfile.default_timer_seconds,
      started_at: null,
      status: 'idle'
    };
    await supabase.from('app_settings').upsert([
      { key: 'live_contestant_session', value: reset }
    ], { onConflict: 'key' });
    setLiveSession(reset);
  };

  // Add / Delete Admin Users
  const handleAddAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAdminName.trim() || !newAdminPasscode.trim()) return;

    const { error } = await supabase.from('admin_users').insert([{
      name: newAdminName.trim(),
      passcode: newAdminPasscode.trim(),
      role: 'admin'
    }]);

    if (error) {
      alert('Failed to add admin: ' + error.message);
    } else {
      setNewAdminName('');
      setNewAdminPasscode('');
      fetchGlobalData();
      alert('New admin user created!');
    }
  };

  const handleDeleteAdmin = async (id: string, name: string) => {
    if (!confirm(`Delete admin access for ${name}?`)) return;
    await supabase.from('admin_users').delete().eq('id', id);
    fetchGlobalData();
  };

  // Contestant Roster Handlers
  const handleAddCouple = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCoupleName.trim()) return;
    await supabase.from('couples').insert([{ name: newCoupleName.trim() }]);
    setNewCoupleName('');
    fetchGlobalData();
  };

  const handleSaveRename = async (id: string) => {
    if (!editingName.trim()) return;
    await supabase.from('couples').update({ name: editingName.trim() }).eq('id', id);
    setEditingId(null);
    fetchGlobalData();
  };

  const handleDeleteCouple = async (id: string, name: string) => {
    if (!confirm(`Delete contestant ${name}?`)) return;
    await supabase.from('couples').delete().eq('id', id);
    fetchGlobalData();
  };

  const handleToggleWinner = async () => {
    const nextState = !winnerActive;
    if (nextState && !confirm('Announce winners on stage screen?')) return;
    await supabase.from('app_settings').upsert([
      { key: 'winner_announcement', value: { active: nextState } }
    ], { onConflict: 'key' });
    setWinnerActive(nextState);
  };

  const handleCopyLink = (path: string, label: string) => {
    navigator.clipboard.writeText(`${window.location.origin}${path}`);
    setCopyFeedback(`Copied ${label} Link!`);
    setTimeout(() => setCopyFeedback(''), 3000);
  };

  if (!isAuthenticated) {
    return (
      <main className="min-h-screen bg-slate-950 flex items-center justify-center p-4 font-sans">
        <form onSubmit={handleLogin} className="bg-slate-900 p-8 rounded-3xl shadow-2xl max-w-sm w-full border border-slate-800 text-white text-center">
          <div className="text-4xl mb-3">⚙️</div>
          <h2 className="text-xl font-bold mb-1">Universal Voting Management</h2>
          <p className="text-xs text-slate-400 mb-6">Enter administrative passcode to continue</p>
          <input
            type="password"
            placeholder="••••••••••••"
            value={passcode}
            autoFocus
            onChange={(e) => setPasscode(e.target.value)}
            className="w-full p-3.5 bg-slate-800 border border-slate-700 rounded-xl mb-4 text-center text-lg tracking-widest text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
          />
          <button type="submit" className="w-full bg-amber-500 hover:bg-amber-400 font-bold py-3.5 rounded-xl transition text-slate-950">
            Authenticate & Open Console
          </button>
        </form>
      </main>
    );
  }

  const currentOnStage = couples.find((c) => c.id === liveSession.current_couple_id);

  return (
    <main className="min-h-screen bg-slate-950 text-white p-4 sm:p-8 font-sans">
      <div className="max-w-6xl mx-auto space-y-6">
        
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-800 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-black text-amber-400">{eventProfile.org_name}</h1>
              <span className="text-[10px] bg-slate-800 px-2.5 py-0.5 rounded-full font-mono text-slate-300">
                {currentAdmin?.name} ({currentAdmin?.role})
              </span>
            </div>
            <p className="text-xs text-slate-400">{eventProfile.event_name} • Universal Stage Console</p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleToggleWinner}
              className={`text-xs px-3.5 py-2 rounded-xl font-bold uppercase tracking-wider transition ${
                winnerActive ? 'bg-red-600 hover:bg-red-500' : 'bg-gradient-to-r from-amber-500 to-yellow-400 text-slate-950'
              }`}
            >
              {winnerActive ? '⏹ Close Winner Podium' : '🏆 Announce Winner'}
            </button>
            <button
              onClick={() => setIsAuthenticated(false)}
              className="text-xs px-3 py-2 bg-slate-800 hover:bg-slate-700 rounded-xl border border-slate-700 text-slate-300"
            >
              Logout
            </button>
          </div>
        </div>

        {/* Global Directory Bar */}
        <div className="bg-slate-900/90 border border-slate-800 p-3.5 rounded-2xl flex flex-wrap justify-between items-center gap-3 text-xs">
          <div className="flex items-center gap-2">
            <span className="font-mono text-amber-400 font-bold">Direct Access Links:</span>
            {copyFeedback && <span className="text-emerald-400 font-bold animate-pulse">{copyFeedback}</span>}
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => handleCopyLink('/', 'Voter')} className="px-3 py-1 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg text-slate-200">
              📋 Copy Voter Portal
            </button>
            <button onClick={() => handleCopyLink('/projector?key=bmka2026screen', 'Projector')} className="px-3 py-1 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg text-slate-200">
              📋 Copy Big Screen Link
            </button>
            <Link href="/" target="_blank" className="px-3 py-1 bg-orange-600/80 hover:bg-orange-600 rounded-lg text-white font-bold">
              Open Voter App ↗
            </Link>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-slate-800 gap-2 overflow-x-auto pb-1">
          {[
            { key: 'stage', label: '🎤 Stage Live Control' },
            { key: 'projector', label: '🖥️ Projector Screen Orchestrator' },
            { key: 'event', label: '⚙️ Branding & Event Settings' },
            { key: 'contestants', label: `👥 Contestants (${couples.length})` },
            { key: 'admins', label: `🔑 Admins (${adminList.length})` }
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as any)}
              className={`px-4 py-2.5 text-xs font-bold rounded-t-xl transition whitespace-nowrap ${
                activeTab === tab.key
                  ? 'bg-slate-800 text-amber-400 border-t-2 border-amber-500'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* TAB 1: STAGE LIVE CONTROLLER */}
        {activeTab === 'stage' && (
          <div className="space-y-6">
            <div className="bg-gradient-to-r from-amber-950/60 via-slate-900 to-slate-900 border-2 border-amber-500/70 p-6 rounded-3xl space-y-5">
              <div className="flex justify-between items-center border-b border-slate-800 pb-3">
                <h2 className="text-base font-black flex items-center gap-2">
                  <span>🎤 Live Stage Round Manager</span>
                </h2>
                <span className={`text-xs px-3 py-1 rounded-full font-mono font-bold uppercase ${
                  liveSession.status === 'voting' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500' : 'bg-slate-800 text-slate-400'
                }`}>
                  {liveSession.status === 'voting' ? '🟢 Round Active' : '⚪ Standby'}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">Select Stage Contestant:</label>
                  <select
                    value={selectedContestantId}
                    onChange={(e) => setSelectedContestantId(e.target.value)}
                    className="w-full p-3 bg-slate-800 border border-slate-700 rounded-xl text-sm font-bold text-amber-400"
                  >
                    {couples.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">Voting Window Duration (Seconds):</label>
                  <select
                    value={customRoundSeconds}
                    onChange={(e) => setCustomRoundSeconds(Number(e.target.value))}
                    className="w-full p-3 bg-slate-800 border border-slate-700 rounded-xl text-sm font-bold text-white"
                  >
                    <option value={30}>30 Seconds (Fast Round)</option>
                    <option value={45}>45 Seconds</option>
                    <option value={60}>60 Seconds (Standard)</option>
                    <option value={90}>90 Seconds (Extended)</option>
                    <option value={120}>120 Seconds (2 Minutes)</option>
                    <option value={180}>180 Seconds (3 Minutes)</option>
                  </select>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={handleStartVotingRound}
                    disabled={liveSession.status === 'voting'}
                    className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs rounded-xl transition disabled:opacity-40"
                  >
                    ▶ Launch Round
                  </button>
                  <button
                    onClick={handleStopVotingEarly}
                    disabled={liveSession.status !== 'voting'}
                    className="px-4 py-3 bg-red-600 hover:bg-red-500 text-white font-black text-xs rounded-xl transition disabled:opacity-40"
                  >
                    ⏹ Stop Early
                  </button>
                  <button
                    onClick={handleResetStage}
                    className="px-3 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs rounded-xl border border-slate-700"
                  >
                    ↺ Reset
                  </button>
                </div>
              </div>

              <div className="p-3 bg-slate-950/80 rounded-xl border border-slate-800 text-xs font-mono flex justify-between">
                <span>Active on Stage: <strong className="text-amber-400 font-sans">{currentOnStage?.name || 'Waiting for next couple...'}</strong></span>
                <span>Active Online Spectators: <strong className="text-emerald-400">{activeUsersNow}</strong></span>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: PROJECTOR SCREEN ORCHESTRATOR */}
        {activeTab === 'projector' && (
          <div className="bg-slate-900/90 border border-slate-800 p-6 rounded-3xl space-y-6">
            <div>
              <h2 className="text-base font-black text-white">🖥️ Remote Big Screen Display Management</h2>
              <p className="text-xs text-slate-400">Control what the event projector displays in real time without touching the stage laptop</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="p-4 rounded-2xl bg-slate-800/80 border border-slate-700 space-y-3">
                <span className="text-xs font-bold text-slate-300 block uppercase tracking-wider">Primary Screen Mode:</span>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleUpdateProjectorControl({ display_mode: 'live' })}
                    className={`flex-1 py-3 rounded-xl text-xs font-bold transition ${
                      projControl.display_mode === 'live' ? 'bg-amber-500 text-black font-extrabold' : 'bg-slate-700 text-slate-300'
                    }`}
                  >
                    🎯 Single Contestant (60s Timer)
                  </button>
                  <button
                    onClick={() => handleUpdateProjectorControl({ display_mode: 'all' })}
                    className={`flex-1 py-3 rounded-xl text-xs font-bold transition ${
                      projControl.display_mode === 'all' ? 'bg-amber-500 text-black font-extrabold' : 'bg-slate-700 text-slate-300'
                    }`}
                  >
                    📊 All Contestants Overview
                  </button>
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-slate-800/80 border border-slate-700 space-y-3">
                <span className="text-xs font-bold text-slate-300 block uppercase tracking-wider">All-Contestant Category Focus:</span>
                <div className="flex gap-2">
                  <select
                    value={projControl.active_criterion}
                    onChange={(e) => handleUpdateProjectorControl({ active_criterion: e.target.value })}
                    className="flex-1 p-2.5 bg-slate-700 border border-slate-600 rounded-xl text-xs text-white"
                  >
                    <option value="total">Overall Championship Leaderboard</option>
                    <option value="outfit">Outfit & Presentation (25 pts)</option>
                    <option value="essence">Kerala Ethnic Essence (20 pts)</option>
                    <option value="walk">Walk & Stage Presence (20 pts)</option>
                    <option value="chemistry">Togetherness & Chemistry (20 pts)</option>
                    <option value="confidence">Confidence & Impact (15 pts)</option>
                  </select>
                  <button
                    onClick={() => handleUpdateProjectorControl({ auto_rotate: !projControl.auto_rotate })}
                    className={`px-3 py-2 rounded-xl text-xs font-bold font-mono ${
                      projControl.auto_rotate ? 'bg-emerald-600 text-white' : 'bg-slate-700 text-slate-400'
                    }`}
                  >
                    {projControl.auto_rotate ? 'Auto-Rotate ON' : 'Rotation PAUSED'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: BRANDING & EVENT SETTINGS */}
        {activeTab === 'event' && (
          <form onSubmit={handleSaveProfile} className="bg-slate-900/90 border border-slate-800 p-6 rounded-3xl space-y-4">
            <h2 className="text-base font-black text-white">⚙️ Global Organisation & Event Profile</h2>
            <p className="text-xs text-slate-400">Changes here apply across mobile voting screens, screen titles, and broadcast cards</p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">Organisation / Host Association Name:</label>
                <input
                  type="text"
                  value={eventProfile.org_name}
                  onChange={(e) => setEventProfile({ ...eventProfile, org_name: e.target.value })}
                  className="w-full p-3 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white"
                  placeholder="e.g., Bedford Marston Kerala Association"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">Event Competition Title:</label>
                <input
                  type="text"
                  value={eventProfile.event_name}
                  onChange={(e) => setEventProfile({ ...eventProfile, event_name: e.target.value })}
                  className="w-full p-3 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white"
                  placeholder="e.g., Kerala Thanima 2026"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">Sub-heading / Tagline:</label>
                <input
                  type="text"
                  value={eventProfile.sub_title}
                  onChange={(e) => setEventProfile({ ...eventProfile, sub_title: e.target.value })}
                  className="w-full p-3 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white"
                  placeholder="e.g., Live Audience Voting Portal"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">Default Voting Window (Seconds):</label>
                <input
                  type="number"
                  value={eventProfile.default_timer_seconds}
                  onChange={(e) => setEventProfile({ ...eventProfile, default_timer_seconds: parseInt(e.target.value) || 60 })}
                  className="w-full p-3 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={savingProfile}
              className="px-6 py-3 bg-amber-500 hover:bg-amber-400 font-bold text-xs text-slate-950 rounded-xl shadow transition"
            >
              {savingProfile ? 'Saving...' : 'Save Global Profile'}
            </button>
          </form>
        )}

        {/* TAB 4: CONTESTANTS */}
        {activeTab === 'contestants' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="bg-slate-900/90 border border-slate-800 p-5 rounded-2xl space-y-3">
              <h3 className="text-sm font-bold">Add Contestant</h3>
              <form onSubmit={handleAddCouple} className="space-y-2">
                <input
                  type="text"
                  placeholder="e.g. Chest No 26: Rahul & Maya"
                  value={newCoupleName}
                  onChange={(e) => setNewCoupleName(e.target.value)}
                  className="w-full p-2.5 bg-slate-800 border border-slate-700 rounded-lg text-xs text-white"
                />
                <button type="submit" className="w-full py-2 bg-emerald-600 font-bold rounded-lg text-xs">
                  Add Contestant
                </button>
              </form>
            </div>

            <div className="lg:col-span-2 bg-slate-900/90 border border-slate-800 p-5 rounded-2xl">
              <h3 className="text-sm font-bold mb-3">Roster ({couples.length})</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-80 overflow-y-auto">
                {couples.map((c) => (
                  <div key={c.id} className="p-2 bg-slate-800 rounded-lg flex justify-between items-center text-xs">
                    {editingId === c.id ? (
                      <div className="flex gap-1 w-full">
                        <input
                          type="text"
                          value={editingName}
                          onChange={(e) => setEditingName(e.target.value)}
                          className="flex-1 p-1 bg-slate-700 rounded text-xs"
                        />
                        <button onClick={() => handleSaveRename(c.id)} className="px-2 bg-emerald-600 rounded text-[10px]">Save</button>
                        <button onClick={() => setEditingId(null)} className="px-2 bg-slate-700 rounded text-[10px]">✕</button>
                      </div>
                    ) : (
                      <>
                        <span className="truncate">{c.name}</span>
                        <div className="flex gap-1">
                          <button onClick={() => { setEditingId(c.id); setEditingName(c.name); }} className="text-[10px] px-1.5 py-0.5 bg-slate-700 rounded text-amber-300">✏️</button>
                          <button onClick={() => handleDeleteCouple(c.id, c.name)} className="text-[10px] px-1.5 py-0.5 bg-red-950 text-red-300 rounded">✕</button>
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* TAB 5: ADMIN PASSCODES */}
        {activeTab === 'admins' && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            <div className="bg-slate-900/90 border border-slate-800 p-5 rounded-2xl space-y-3">
              <h3 className="text-sm font-bold">Create New Admin User</h3>
              <form onSubmit={handleAddAdmin} className="space-y-3">
                <input
                  type="text"
                  placeholder="Admin Name (e.g., Coordinator 1)"
                  value={newAdminName}
                  onChange={(e) => setNewAdminName(e.target.value)}
                  className="w-full p-2.5 bg-slate-800 border border-slate-700 rounded-lg text-xs text-white"
                />
                <input
                  type="text"
                  placeholder="Secure Passcode"
                  value={newAdminPasscode}
                  onChange={(e) => setNewAdminPasscode(e.target.value)}
                  className="w-full p-2.5 bg-slate-800 border border-slate-700 rounded-lg text-xs text-white font-mono"
                />
                <button type="submit" className="w-full py-2 bg-amber-500 font-bold text-slate-950 rounded-lg text-xs">
                  Authorize Admin
                </button>
              </form>
            </div>

            <div className="sm:col-span-2 bg-slate-900/90 border border-slate-800 p-5 rounded-2xl">
              <h3 className="text-sm font-bold mb-3">Authorized Admins</h3>
              <div className="space-y-2">
                {adminList.map((adm) => (
                  <div key={adm.id} className="p-3 bg-slate-800 rounded-xl flex justify-between items-center text-xs">
                    <div>
                      <span className="font-bold text-white">{adm.name}</span>
                      <span className="ml-2 font-mono text-slate-400">Passcode: ••••••••</span>
                    </div>
                    {adminList.length > 1 && (
                      <button onClick={() => handleDeleteAdmin(adm.id, adm.name)} className="text-[10px] px-2 py-1 bg-red-950 text-red-300 rounded border border-red-800">
                        Revoke Access
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

      </div>
    </main>
  );
}
