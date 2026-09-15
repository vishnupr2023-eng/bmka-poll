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

  // Geo-fence state
  const [geoConfig, setGeoConfig] = useState<GeoConfig>({
    enabled: false,
    lat: 52.13597,
    lng: -0.46665,
    radius_meters: 500
  });
  const [geoSaving, setGeoSaving] = useState(false);

  const correctPin = '2026';

  const fetchData = async () => {
    setStatusMsg('Refreshing stats...');
    try {
      const { data: couplesData } = await supabase.from('couples').select('*').order('name');
      const { data: votesData } = await supabase.from('votes').select('*');
      
      // Calculate active users online in last 45 seconds
      const fortyFiveSecondsAgo = new Date(Date.now() - 45000).toISOString();
      const { data: activeData } = await supabase
        .from('active_sessions')
        .select('session_id')
        .gte('last_seen', fortyFiveSecondsAgo);

      // Fetch geo-fence config
      const { data: settingData } = await supabase
        .from('app_settings')
        .select('value')
        .eq('key', 'geo_fence')
        .single();

      if (couplesData) setCouples(couplesData);
      if (votesData) {
        setVotes(votesData);
        // Count distinct voter tokens
        const tokens = new Set(votesData.map((v) => v.voter_token).filter(Boolean));
        setUniqueVotersCount(tokens.size);
      }
      if (activeData) {
        setActiveUsersNow(activeData.length);
      }
      if (settingData?.value) {
        setGeoConfig(settingData.value);
      }

      setStatusMsg(`Connected: ${couplesData?.length || 0} couples • ${activeData?.length || 0} online`);
    } catch (err: any) {
      setStatusMsg('Error: ' + err.message);
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      fetchData();
      const interval = setInterval(fetchData, 6000);
      return () => clearInterval(interval);
    }
  }, [isAuthenticated]);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (pin === correctPin) {
      setIsAuthenticated(true);
    } else {
      alert('Invalid PIN');
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

  const handleDeleteCouple = async (id: string) => {
    if (!confirm('Delete this contestant?')) return;
    await supabase.from('couples').delete().eq('id', id);
    fetchData();
  };

  const handleResetVotes = async () => {
    if (!confirm('DANGER: Permanently wipe ALL votes?')) return;
    await supabase.from('votes').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    alert('Votes reset.');
    fetchData();
  };

  // Geo-Fence Handlers
  const handleSaveGeo = async () => {
    setGeoSaving(true);
    const { error } = await supabase
      .from('app_settings')
      .upsert([{ key: 'geo_fence', value: geoConfig }]);
    setGeoSaving(false);

    if (error) {
      alert('Failed to save Geo-Lock: ' + error.message);
    } else {
      alert(`Geo-Lock settings updated successfully (${geoConfig.enabled ? 'ENABLED' : 'DISABLED'})!`);
    }
  };

  const handleDetectCurrentLocation = () => {
    if (!navigator.geolocation) {
      alert('Geolocation not supported on this browser.');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGeoConfig((prev) => ({
          ...prev,
          lat: parseFloat(pos.coords.latitude.toFixed(6)),
          lng: parseFloat(pos.coords.longitude.toFixed(6))
        }));
        alert(`Location acquired: ${pos.coords.latitude.toFixed(5)}, ${pos.coords.longitude.toFixed(5)}`);
      },
      (err) => {
        alert('Could not get GPS location: ' + err.message);
      },
      { enableHighAccuracy: true }
    );
  };

  if (!isAuthenticated) {
    return (
      <main className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
        <form onSubmit={handleLogin} className="bg-slate-800 p-8 rounded-2xl shadow-2xl max-w-sm w-full border border-slate-700 text-white text-center">
          <div className="text-3xl mb-2">🔒</div>
          <h2 className="text-xl font-bold mb-1">BMKA Admin Access</h2>
          <p className="text-xs text-slate-400 mb-6">Enter PIN to access controls</p>
          <input
            type="password"
            placeholder="••••••••"
            value={pin}
            autoFocus
            onChange={(e) => setPin(e.target.value)}
            className="w-full p-3 bg-slate-700 border border-slate-600 rounded-xl mb-4 text-center text-xl tracking-widest text-white focus:outline-none"
          />
          <button type="submit" className="w-full bg-orange-600 hover:bg-orange-700 font-bold py-3 rounded-xl transition">
            Unlock Dashboard
          </button>
        </form>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-900 text-white p-4 sm:p-8">
      <div className="max-w-5xl mx-auto space-y-6">
        
        {/* Header Bar */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-800 pb-4">
          <div>
            <h1 className="text-2xl font-black text-amber-500">BMKA 2026 Admin Dashboard</h1>
            <p className="text-xs text-slate-400">Contestants, Live Analytics & Hall Geofence</p>
            <span className="inline-block mt-1 text-[11px] px-2.5 py-0.5 rounded bg-slate-800 text-emerald-400 font-mono border border-slate-700">
              {statusMsg}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={fetchData} className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg text-xs font-semibold">
              🔄 Refresh
            </button>
            <button onClick={handleResetVotes} className="px-3 py-1.5 bg-red-950/40 border border-red-800 text-red-300 hover:bg-red-900/60 rounded-lg text-xs font-semibold">
              ⚠️ Reset Votes
            </button>
            <Link href="/" className="px-3 py-1.5 bg-orange-600 hover:bg-orange-700 rounded-lg text-xs font-semibold">
              Poll Screen
            </Link>
          </div>
        </div>

        {/* Live Audience Analytics Badges */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="bg-slate-800/80 p-4 rounded-xl border border-slate-700">
            <span className="text-[10px] text-slate-400 font-mono uppercase tracking-wider block">Live Online Now</span>
            <div className="text-2xl font-black text-emerald-400 font-mono flex items-center gap-2 mt-1">
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
              </span>
              {activeUsersNow}
            </div>
            <span className="text-[10px] text-slate-500 mt-1 block">Active on page</span>
          </div>

          <div className="bg-slate-800/80 p-4 rounded-xl border border-slate-700">
            <span className="text-[10px] text-slate-400 font-mono uppercase tracking-wider block">Total Voters</span>
            <div className="text-2xl font-black text-amber-400 font-mono mt-1">
              {uniqueVotersCount}
            </div>
            <span className="text-[10px] text-slate-500 mt-1 block">Unique audience members</span>
          </div>

          <div className="bg-slate-800/80 p-4 rounded-xl border border-slate-700">
            <span className="text-[10px] text-slate-400 font-mono uppercase tracking-wider block">Total Ballots Cast</span>
            <div className="text-2xl font-black text-white font-mono mt-1">
              {votes.length}
            </div>
            <span className="text-[10px] text-slate-500 mt-1 block">Locked scoring entries</span>
          </div>

          <div className="bg-slate-800/80 p-4 rounded-xl border border-slate-700">
            <span className="text-[10px] text-slate-400 font-mono uppercase tracking-wider block">Geo-Lock Status</span>
            <div className={`text-2xl font-black font-mono mt-1 ${geoConfig.enabled ? 'text-emerald-400' : 'text-slate-400'}`}>
              {geoConfig.enabled ? 'ON' : 'OFF'}
            </div>
            <span className="text-[10px] text-slate-500 mt-1 block">Venue proximity check</span>
          </div>
        </div>

        {/* Geo-Fencing Configuration Panel */}
        <div className="bg-slate-800/90 p-5 rounded-2xl border border-slate-700 space-y-4">
          <div className="flex justify-between items-center border-b border-slate-700 pb-3">
            <div>
              <h2 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                <span>📍 Venue Geo-Lock Control</span>
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-mono ${
                  geoConfig.enabled ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40' : 'bg-slate-700 text-slate-400'
                }`}>
                  {geoConfig.enabled ? 'Active Restriction' : 'Disabled'}
                </span>
              </h2>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Restricts voting so only people physically inside or near the event hall can vote.
              </p>
            </div>

            <button
              onClick={() => setGeoConfig({ ...geoConfig, enabled: !geoConfig.enabled })}
              className={`text-xs px-4 py-2 rounded-xl font-bold transition ${
                geoConfig.enabled
                  ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                  : 'bg-slate-700 hover:bg-slate-600 text-slate-300'
              }`}
            >
              {geoConfig.enabled ? 'Enabled ✓' : 'Enable Geo-Lock'}
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-[11px] text-slate-400 font-mono mb-1">Venue Latitude</label>
              <input
                type="number"
                step="any"
                value={geoConfig.lat}
                onChange={(e) => setGeoConfig({ ...geoConfig, lat: parseFloat(e.target.value) || 0 })}
                className="w-full p-2 bg-slate-700 border border-slate-600 rounded-lg text-xs font-mono text-white"
              />
            </div>

            <div>
              <label className="block text-[11px] text-slate-400 font-mono mb-1">Venue Longitude</label>
              <input
                type="number"
                step="any"
                value={geoConfig.lng}
                onChange={(e) => setGeoConfig({ ...geoConfig, lng: parseFloat(e.target.value) || 0 })}
                className="w-full p-2 bg-slate-700 border border-slate-600 rounded-lg text-xs font-mono text-white"
              />
            </div>

            <div>
              <label className="block text-[11px] text-slate-400 font-mono mb-1">Allowed Radius (Meters)</label>
              <select
                value={geoConfig.radius_meters}
                onChange={(e) => setGeoConfig({ ...geoConfig, radius_meters: parseInt(e.target.value) || 500 })}
                className="w-full p-2 bg-slate-700 border border-slate-600 rounded-lg text-xs font-mono text-white"
              >
                <option value={200}>200 Meters (Single Hall)</option>
                <option value={500}>500 Meters (Hall + Parking)</option>
                <option value={1000}>1,000 Meters (1 KM Neighborhood)</option>
                <option value={2500}>2,500 Meters (2.5 KM Local Area)</option>
              </select>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
            <button
              onClick={handleDetectCurrentLocation}
              type="button"
              className="text-xs bg-slate-700 hover:bg-slate-600 px-3 py-2 rounded-lg border border-slate-600 font-mono"
            >
              📍 Set to My Current GPS Location
            </button>

            <button
              onClick={handleSaveGeo}
              disabled={geoSaving}
              type="button"
              className="text-xs bg-amber-600 hover:bg-amber-500 font-bold px-5 py-2 rounded-lg shadow disabled:opacity-50"
            >
              {geoSaving ? 'Saving...' : 'Save Geo-Lock Settings'}
            </button>
          </div>
        </div>

        {/* Manage Contestants Section */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-slate-800/80 p-5 rounded-2xl border border-slate-700">
            <h2 className="text-sm font-bold mb-3">➕ Add Contestant</h2>
            <form onSubmit={handleAddCouple} className="flex gap-2">
              <input
                type="text"
                placeholder="Couple Name (e.g. Rahul & Anjali)"
                value={newCoupleName}
                onChange={(e) => setNewCoupleName(e.target.value)}
                className="flex-1 p-2.5 bg-slate-700 border border-slate-600 rounded-lg text-xs text-white focus:outline-none"
              />
              <button
                type="submit"
                disabled={adding}
                className="bg-emerald-600 hover:bg-emerald-500 px-4 py-2.5 rounded-lg text-xs font-bold disabled:opacity-50"
              >
                {adding ? 'Adding...' : 'Add'}
              </button>
            </form>
          </div>

          <div className="bg-slate-800/80 p-5 rounded-2xl border border-slate-700">
            <h2 className="text-sm font-bold mb-3">👥 Contestants Roster ({couples.length})</h2>
            <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
              {couples.map((c) => (
                <div key={c.id} className="flex justify-between items-center p-2 rounded-lg bg-slate-700/50 border border-slate-600 text-xs">
                  <span>{c.name}</span>
                  <button onClick={() => handleDeleteCouple(c.id)} className="text-red-400 hover:text-red-300 text-[10px] px-2 py-0.5 bg-red-950/40 rounded border border-red-800">
                    Remove
                  </button>
                </div>
              ))}
              {couples.length === 0 && (
                <p className="text-xs text-slate-400 italic">No contestants yet.</p>
              )}
            </div>
          </div>
        </div>

      </div>
    </main>
  );
}
