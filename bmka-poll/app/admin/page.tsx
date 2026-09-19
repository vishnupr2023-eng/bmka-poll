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
    setStatusMsg('Refreshing stats...');
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

      if (couplesData) {
        const sorted = [...couplesData].sort((a, b) => extractChestNumber(a.name) - extractChestNumber(b.name));
        setCouples(sorted);
      }
      if (votesData) {
        setVotes(votesData);
        const tokens = new Set(votesData.map((v) => v.voter_token).filter(Boolean));
        setUniqueVotersCount(tokens.size);
      }
      if (activeData) setActiveUsersNow(activeData.length);
      if (geoData?.value) setGeoConfig(geoData.value);
      if (winData?.value?.active !== undefined) setWinnerActive(winData.value.active);

      setStatusMsg(`Connected: ${couplesData?.length || 0} contestants • ${activeData?.length || 0} online`);
    } catch (err: any) {
      setStatusMsg('Error: ' + err.message);
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      fetchData();
      const interval = setInterval(fetchData, 5000);
      return () => clearInterval(interval);
    }
  }, [isAuthenticated]);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (pin === correctPin) {
      setIsAuthenticated(true);
    } else {
      alert('Invalid Passcode. Access denied.');
      setPin('');
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
    if (nextState && !confirm('This will pause the slideshow on the projector and trigger the WINNER ANNOUNCEMENT stage. Proceed?')) {
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

  const handleSaveGeo = async () => {
    setGeoSaving(true);
    const { error } = await supabase
      .from('app_settings')
      .upsert([{ key: 'geo_fence', value: geoConfig }]);
    setGeoSaving(false);

    if (error) {
      alert('Failed to save Geo-Lock: ' + error.message);
    } else {
      alert(`Geo-Lock saved (${geoConfig.enabled ? 'ACTIVE' : 'DISABLED'})!`);
    }
  };

  const handleDetectCurrentLocation = () => {
    if (!navigator.geolocation) {
      alert('Geolocation not supported on this device.');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGeoConfig((prev) => ({
          ...prev,
          lat: parseFloat(pos.coords.latitude.toFixed(6)),
          lng: parseFloat(pos.coords.longitude.toFixed(6))
        }));
        alert(`Location pinned: ${pos.coords.latitude.toFixed(5)}, ${pos.coords.longitude.toFixed(5)}`);
      },
      (err) => alert('GPS error: ' + err.message),
      { enableHighAccuracy: true }
    );
  };

  if (!isAuthenticated) {
    return (
      <main className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
        <form onSubmit={handleLogin} className="bg-slate-900 p-8 rounded-2xl shadow-2xl max-w-sm w-full border border-slate-800 text-white text-center">
          <div className="text-3xl mb-2">🔒</div>
          <h2 className="text-xl font-bold mb-1">BMKA Admin Console</h2>
          <p className="text-xs text-slate-400 mb-6">Enter secure password to continue</p>
          <input
            type="password"
            placeholder="••••••••••••"
            value={pin}
            autoFocus
            onChange={(e) => setPin(e.target.value)}
            className="w-full p-3 bg-slate-800 border border-slate-700 rounded-xl mb-4 text-center text-lg tracking-widest text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
          />
          <button type="submit" className="w-full bg-orange-600 hover:bg-orange-700 font-bold py-3 rounded-xl transition shadow">
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
            <p className="text-xs text-slate-400">Contestant Management, Winner Announcement & Geo-Lock</p>
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
            <Link href="/" className="px-3.5 py-2 bg-orange-600 hover:bg-orange-700 rounded-lg text-xs font-semibold">
              Poll Screen
            </Link>
          </div>
        </div>

        {/* WINNER ANNOUNCEMENT STAGE BANNER */}
        <div className={`p-5 rounded-2xl border transition-all flex flex-col sm:flex-row justify-between items-center gap-4 ${
          winnerActive
            ? 'bg-gradient-to-r from-amber-950/80 via-yellow-950/60 to-slate-900 border-amber-500 shadow-xl shadow-amber-500/20'
            : 'bg-slate-900/90 border-slate-800'
        }`}>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xl">🏆</span>
              <h2 className="text-base font-bold text-white">Stage Winner Announcement</h2>
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-mono font-bold ${
                winnerActive ? 'bg-amber-500 text-black animate-pulse' : 'bg-slate-800 text-slate-400'
              }`}>
                {winnerActive ? 'LIVE ON PROJECTOR' : 'Standby'}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Pauses criteria auto-rotation and reveals the Top 3 Champions with fireworks on the big screen.
            </p>
          </div>

          <button
            onClick={handleToggleWinner}
            disabled={winnerToggling}
            className={`px-5 py-2.5 rounded-xl font-extrabold text-xs transition tracking-wider uppercase shadow-lg ${
              winnerActive
                ? 'bg-red-600 hover:bg-red-500 text-white'
                : 'bg-gradient-to-r from-amber-500 to-yellow-400 hover:from-amber-400 hover:to-yellow-300 text-slate-950'
            }`}
          >
            {winnerActive ? '⏹ Close Winner Screen' : '🎉 Announce Winner Now'}
          </button>
        </div>

        {/* Analytics Badges */}
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
            <span className="text-[10px] text-slate-500 mt-1 block">Active on page</span>
          </div>

          <div className="bg-slate-900/90 p-4 rounded-xl border border-slate-800">
            <span className="text-[10px] text-slate-400 font-mono uppercase tracking-wider block">Total Voters</span>
            <div className="text-2xl font-black text-amber-400 font-mono mt-1">
              {uniqueVotersCount}
            </div>
            <span className="text-[10px] text-slate-500 mt-1 block">Unique audience members</span>
          </div>

          <div className="bg-slate-900/90 p-4 rounded-xl border border-slate-800">
            <span className="text-[10px] text-slate-400 font-mono uppercase tracking-wider block">Total Ballots Cast</span>
            <div className="text-2xl font-black text-white font-mono mt-1">
              {votes.length}
            </div>
            <span className="text-[10px] text-slate-500 mt-1 block">Submitted couple votes</span>
          </div>

          <div className="bg-slate-900/90 p-4 rounded-xl border border-slate-800">
            <span className="text-[10px] text-slate-400 font-mono uppercase tracking-wider block">Contestants</span>
            <div className="text-2xl font-black text-cyan-400 font-mono mt-1">
              {couples.length}
            </div>
            <span className="text-[10px] text-slate-500 mt-1 block">Registered in roster</span>
          </div>
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
                placeholder="e.g. Chest No 26: Name"
                value={newCoupleName}
                onChange={(e) => setNewCoupleName(e.target.value)}
                className="w-full p-2.5 bg-slate-800 border border-slate-700 rounded-lg text-xs text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
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

        {/* Geo-Lock Venue Control */}
        <div className="bg-slate-900/90 p-5 rounded-2xl border border-slate-800 space-y-4">
          <div className="flex justify-between items-center border-b border-slate-800 pb-3">
            <div>
              <h2 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                <span>📍 Venue Geo-Lock Control</span>
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-mono ${
                  geoConfig.enabled ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40' : 'bg-slate-800 text-slate-400'
                }`}>
                  {geoConfig.enabled ? 'Active' : 'Disabled'}
                </span>
              </h2>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Restricts voting so only people inside the hall can submit scores.
              </p>
            </div>

            <button
              onClick={() => setGeoConfig({ ...geoConfig, enabled: !geoConfig.enabled })}
              className={`text-xs px-4 py-2 rounded-xl font-bold transition ${
                geoConfig.enabled ? 'bg-emerald-600 hover:bg-emerald-500 text-white' : 'bg-slate-800 text-slate-300'
              }`}
            >
              {geoConfig.enabled ? 'Enabled ✓' : 'Enable Geo-Lock'}
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-[11px] text-slate-400 font-mono mb-1">Latitude</label>
              <input
                type="number"
                step="any"
                value={geoConfig.lat}
                onChange={(e) => setGeoConfig({ ...geoConfig, lat: parseFloat(e.target.value) || 0 })}
                className="w-full p-2 bg-slate-800 border border-slate-700 rounded-lg text-xs font-mono text-white"
              />
            </div>
            <div>
              <label className="block text-[11px] text-slate-400 font-mono mb-1">Longitude</label>
              <input
                type="number"
                step="any"
                value={geoConfig.lng}
                onChange={(e) => setGeoConfig({ ...geoConfig, lng: parseFloat(e.target.value) || 0 })}
                className="w-full p-2 bg-slate-800 border border-slate-700 rounded-lg text-xs font-mono text-white"
              />
            </div>
            <div>
              <label className="block text-[11px] text-slate-400 font-mono mb-1">Radius</label>
              <select
                value={geoConfig.radius_meters}
                onChange={(e) => setGeoConfig({ ...geoConfig, radius_meters: parseInt(e.target.value) || 500 })}
                className="w-full p-2 bg-slate-800 border border-slate-700 rounded-lg text-xs font-mono text-white"
              >
                <option value={200}>200m (Single Hall)</option>
                <option value={500}>500m (Hall + Parking)</option>
                <option value={1000}>1,000m (1 KM Vicinity)</option>
              </select>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
            <button
              onClick={handleDetectCurrentLocation}
              type="button"
              className="text-xs bg-slate-800 hover:bg-slate-700 px-3 py-2 rounded-lg border border-slate-700 font-mono"
            >
              📍 Use My Current Location
            </button>
            <button
              onClick={handleSaveGeo}
              disabled={geoSaving}
              type="button"
              className="text-xs bg-amber-600 hover:bg-amber-500 font-bold px-5 py-2 rounded-lg shadow disabled:opacity-50"
            >
              {geoSaving ? 'Saving...' : 'Save Geo-Lock'}
            </button>
          </div>
        </div>

      </div>
    </main>
  );
}
