'use client';
import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { supabase } from '../../lib/supabase';

export default function Admin() {
  const [pin, setPin] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [couples, setCouples] = useState<any[]>([]);
  const [votes, setVotes] = useState<any[]>([]);
  const [newCoupleName, setNewCoupleName] = useState('');
  const [adding, setAdding] = useState(false);
  const [statusMsg, setStatusMsg] = useState('Checking database connection...');

  const correctPin = '2026';

  const fetchData = async () => {
    setStatusMsg('Loading contestants...');
    try {
      const { data: cData, error: cErr } = await supabase
        .from('couples')
        .select('*')
        .order('name', { ascending: true });

      const { data: vData, error: vErr } = await supabase
        .from('votes')
        .select('*');

      if (cErr) {
        setStatusMsg('Database query error: ' + cErr.message);
        alert('Database error: ' + cErr.message);
        return;
      }

      setCouples(cData || []);
      setVotes(vData || []);
      setStatusMsg(`Connected: ${cData?.length || 0} couples loaded`);
    } catch (err: any) {
      setStatusMsg('Network failure: ' + err.message);
      alert('Network failure: ' + err.message);
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      fetchData();
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
    if (!newCoupleName.trim()) {
      alert('Please enter a contestant name');
      return;
    }

    setAdding(true);
    setStatusMsg('Inserting contestant into database...');

    try {
      const { data, error } = await supabase
        .from('couples')
        .insert([{ name: newCoupleName.trim() }])
        .select();

      setAdding(false);

      if (error) {
        alert('Insert error: ' + error.message);
        setStatusMsg('Insert error: ' + error.message);
        return;
      }

      alert('Contestant added successfully!');
      setNewCoupleName('');
      fetchData();
    } catch (err: any) {
      setAdding(false);
      alert('Connection error: ' + err.message);
      setStatusMsg('Connection error: ' + err.message);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to remove this contestant?')) return;
    try {
      const { error } = await supabase.from('couples').delete().eq('id', id);
      if (error) {
        alert('Delete failed: ' + error.message);
        return;
      }
      fetchData();
    } catch (err: any) {
      alert('Delete error: ' + err.message);
    }
  };

  const handleResetVotes = async () => {
    if (!confirm('Permanently reset all votes?')) return;
    try {
      const { error } = await supabase.from('votes').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      if (error) {
        alert('Reset failed: ' + error.message);
        return;
      }
      alert('All votes cleared!');
      fetchData();
    } catch (err: any) {
      alert('Reset error: ' + err.message);
    }
  };

  const stats = couples.map((c) => {
    const cVotes = votes.filter((v) => v.couple_id === c.id);
    const count = cVotes.length;
    if (count === 0) {
      return { id: c.id, name: c.name, count: 0, avg: 0, outfit: 0, essence: 0, walk: 0, chem: 0, conf: 0 };
    }
    const sumTotal = cVotes.reduce((a, b) => a + b.total, 0);
    const sumOutfit = cVotes.reduce((a, b) => a + b.outfit, 0);
    const sumEssence = cVotes.reduce((a, b) => a + b.essence, 0);
    const sumWalk = cVotes.reduce((a, b) => a + b.walk, 0);
    const sumChem = cVotes.reduce((a, b) => a + b.chemistry, 0);
    const sumConf = cVotes.reduce((a, b) => a + b.confidence, 0);

    return {
      id: c.id,
      name: c.name,
      count,
      avg: parseFloat((sumTotal / count).toFixed(1)),
      outfit: parseFloat((sumOutfit / count).toFixed(1)),
      essence: parseFloat((sumEssence / count).toFixed(1)),
      walk: parseFloat((sumWalk / count).toFixed(1)),
      chem: parseFloat((sumChem / count).toFixed(1)),
      conf: parseFloat((sumConf / count).toFixed(1))
    };
  }).sort((a, b) => b.avg - a.avg);

  if (!isAuthenticated) {
    return (
      <main className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
        <form onSubmit={handleLogin} className="bg-slate-800 p-8 rounded-2xl shadow-2xl max-w-sm w-full border border-slate-700 text-white text-center">
          <div className="text-3xl mb-2">🔒</div>
          <h2 className="text-xl font-bold mb-1">Restricted Access</h2>
          <p className="text-xs text-slate-400 mb-6">Enter PIN to access Admin Dashboard</p>
          <input
            type="password"
            placeholder="••••••••"
            value={pin}
            autoFocus
            onChange={(e) => setPin(e.target.value)}
            className="w-full p-3 bg-slate-700 border border-slate-600 rounded-xl mb-4 text-center text-xl tracking-widest text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
          />
          <button type="submit" className="w-full bg-orange-600 hover:bg-orange-700 font-bold py-3 rounded-xl transition">
            Unlock Dashboard
          </button>
          <div className="mt-4">
            <Link href="/" className="text-xs text-slate-400 hover:underline">← Back to Voting Screen</Link>
          </div>
        </form>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-900 text-white p-4 sm:p-8">
      <div className="max-w-5xl mx-auto space-y-6">
        
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-800 pb-4">
          <div>
            <h1 className="text-2xl font-black text-amber-500">BMKA 2026 - Live Leaderboard</h1>
            <p className="text-xs text-slate-400">Audience Poll Results & Contestant Management</p>
            <span className="inline-block mt-1 text-[11px] px-2.5 py-0.5 rounded bg-slate-800 text-emerald-400 font-mono border border-slate-700">
              {statusMsg}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={fetchData} className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg text-xs font-semibold">
              🔄 Refresh
            </button>
            <button onClick={handleResetVotes} className="px-3.5 py-2 bg-red-950/40 border border-red-800 text-red-300 hover:bg-red-900/60 rounded-lg text-xs font-semibold">
              ⚠️ Reset Votes
            </button>
            <Link href="/" className="px-3.5 py-2 bg-orange-600 hover:bg-orange-700 rounded-lg text-xs font-semibold">
              Poll Screen
            </Link>
          </div>
        </div>

        {/* Live Leaderboard Bars */}
        <div className="bg-slate-800/80 p-6 rounded-2xl border border-slate-700 space-y-5">
          <h2 className="text-lg font-bold text-slate-100 flex items-center justify-between">
            <span>📊 Live Ranking (Average Score / 100)</span>
            <span className="text-xs text-slate-400 font-normal">Total Votes: {votes.length}</span>
          </h2>

          <div className="space-y-4">
            {stats.map((c, index) => (
              <div key={c.id} className="space-y-1.5">
                <div className="flex justify-between text-sm">
                  <span className="font-semibold flex items-center gap-2">
                    <span className="text-xs px-2 py-0.5 rounded bg-slate-700 text-amber-400 font-mono">#{index + 1}</span>
                    {c.name}
                    <span className="text-xs text-slate-400 font-normal">({c.count} votes)</span>
                  </span>
                  <span className="font-bold text-amber-400">{c.avg} / 100</span>
                </div>
                <div className="w-full bg-slate-700 h-4 rounded-full overflow-hidden">
                  <div 
                    className="bg-gradient-to-r from-amber-500 to-orange-500 h-full transition-all duration-500 rounded-full"
                    style={{ width: `${Math.min(c.avg, 100)}%` }}
                  />
                </div>
                <div className="flex flex-wrap gap-2 text-[11px] text-slate-400">
                  <span>Outfit: <b className="text-slate-200">{c.outfit}/25</b></span>
                  <span>Essence: <b className="text-slate-200">{c.essence}/20</b></span>
                  <span>Walk: <b className="text-slate-200">{c.walk}/20</b></span>
                  <span>Chemistry: <b className="text-slate-200">{c.chem}/20</b></span>
                  <span>Impact: <b className="text-slate-200">{c.conf}/15</b></span>
                </div>
              </div>
            ))}
            {couples.length === 0 && (
              <p className="text-sm text-slate-400 italic">No contestants loaded. Add a couple below.</p>
            )}
          </div>
        </div>

        {/* Manage Contestants */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-slate-800/80 p-6 rounded-2xl border border-slate-700">
            <h2 className="text-base font-bold mb-3">➕ Add Contestant</h2>
            <form onSubmit={handleAddCouple} className="flex gap-2">
              <input
                type="text"
                placeholder="Couple Name (e.g. Rahul & Anjali)"
                value={newCoupleName}
                onChange={(e) => setNewCoupleName(e.target.value)}
                className="flex-1 p-2.5 bg-slate-700 border border-slate-600 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
              <button 
                type="submit" 
                disabled={adding}
                className="bg-emerald-600 hover:bg-emerald-500 px-4 py-2.5 rounded-lg text-sm font-bold disabled:opacity-50"
              >
                {adding ? 'Adding...' : 'Add'}
              </button>
            </form>
          </div>

          <div className="bg-slate-800/80 p-6 rounded-2xl border border-slate-700">
            <h2 className="text-base font-bold mb-3">👥 Contestants List ({couples.length})</h2>
            <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
              {couples.map((c) => (
                <div key={c.id} className="flex justify-between items-center p-2.5 rounded-lg bg-slate-700/50 border border-slate-600 text-sm">
                  <span>{c.name}</span>
                  <button onClick={() => handleDelete(c.id)} className="text-red-400 hover:text-red-300 text-xs px-2.5 py-1 bg-red-950/40 rounded border border-red-800">
                    Remove
                  </button>
                </div>
              ))}
              {couples.length === 0 && (
                <p className="text-xs text-slate-400 italic">No contestants in list.</p>
              )}
            </div>
          </div>
        </div>

      </div>
    </main>
  );
}
