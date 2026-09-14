'use client';
import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { supabase } from '../../lib/supabase';

interface CoupleStat {
  id: string;
  name: string;
  count: number;
  avgTotal: number;
  avgOutfit: number;
  avgEssence: number;
  avgWalk: number;
  avgChemistry: number;
  avgConfidence: number;
}

function ProjectorContent() {
  const searchParams = useSearchParams();
  const secretKey = searchParams.get('key');
  const [stats, setStats] = useState<CoupleStat[]>([]);
  const [totalVotes, setTotalVotes] = useState(0);
  const [lastUpdated, setLastUpdated] = useState<string>('');

  // Secret passcode required in URL query (?key=bmka2026screen)
  const isAuthorized = secretKey === 'bmka2026screen';

  const fetchScores = async () => {
    try {
      const { data: couples } = await supabase.from('couples').select('*').order('name');
      const { data: votes } = await supabase.from('votes').select('*');

      if (couples && votes) {
        setTotalVotes(votes.length);

        const calculated: CoupleStat[] = couples.map((c) => {
          const cVotes = votes.filter((v: any) => v.couple_id === c.id);
          const count = cVotes.length;
          if (count === 0) {
            return {
              id: c.id,
              name: c.name,
              count: 0,
              avgTotal: 0,
              avgOutfit: 0,
              avgEssence: 0,
              avgWalk: 0,
              avgChemistry: 0,
              avgConfidence: 0
            };
          }
          const sumTotal = cVotes.reduce((a: number, b: any) => a + b.total, 0);
          const sumOutfit = cVotes.reduce((a: number, b: any) => a + b.outfit, 0);
          const sumEssence = cVotes.reduce((a: number, b: any) => a + b.essence, 0);
          const sumWalk = cVotes.reduce((a: number, b: any) => a + b.walk, 0);
          const sumChem = cVotes.reduce((a: number, b: any) => a + b.chemistry, 0);
          const sumConf = cVotes.reduce((a: number, b: any) => a + b.confidence, 0);

          return {
            id: c.id,
            name: c.name,
            count,
            avgTotal: parseFloat((sumTotal / count).toFixed(1)),
            avgOutfit: parseFloat((sumOutfit / count).toFixed(1)),
            avgEssence: parseFloat((sumEssence / count).toFixed(1)),
            avgWalk: parseFloat((sumWalk / count).toFixed(1)),
            avgChemistry: parseFloat((sumChem / count).toFixed(1)),
            avgConfidence: parseFloat((sumConf / count).toFixed(1))
          };
        }).sort((a, b) => b.avgTotal - a.avgTotal);

        setStats(calculated);
        setLastUpdated(new Date().toLocaleTimeString());
      }
    } catch (err) {
      console.error('Error fetching live scores:', err);
    }
  };

  useEffect(() => {
    if (!isAuthorized) return;
    fetchScores();
    // Auto-refresh scores every 3 seconds for live big-screen animation
    const interval = setInterval(fetchScores, 3000);
    return () => clearInterval(interval);
  }, [isAuthorized]);

  if (!isAuthorized) {
    return (
      <main className="min-h-screen bg-black flex items-center justify-center text-zinc-600 font-mono text-sm">
        404 | Screen Not Found
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 text-white p-8 lg:p-12 flex flex-col justify-between overflow-x-hidden">
      
      {/* Header Banner */}
      <div className="text-center space-y-2 border-b border-slate-800/80 pb-6">
        <div className="flex justify-between items-center px-4 text-sm font-semibold tracking-widest uppercase text-amber-500">
          <span className="flex items-center gap-2">
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
            </span>
            Live Audience Voting
          </span>
          <span className="text-slate-400 font-mono">Total Votes: <strong className="text-white text-base">{totalVotes}</strong></span>
          <span className="text-slate-400 font-mono">Updated: {lastUpdated || 'Loading...'}</span>
        </div>

        <h1 className="text-4xl lg:text-5xl font-black bg-gradient-to-r from-amber-400 via-orange-500 to-amber-200 bg-clip-text text-transparent">
          കേരള തനിമ താരദമ്പതികൾ 2026
        </h1>
        <p className="text-base text-slate-300 font-light">
          BMKA Ponnonam Celebrations • Official Audience Scoreboard
        </p>
      </div>

      {/* Leaderboard Cards */}
      <div className="max-w-6xl w-full mx-auto my-8 space-y-5">
        {stats.map((c, index) => (
          <div 
            key={c.id} 
            className={`p-5 rounded-2xl border transition-all duration-700 ${
              index === 0 
                ? 'bg-gradient-to-r from-amber-950/40 via-slate-900/90 to-slate-900 border-amber-500/70 shadow-2xl shadow-amber-500/10 scale-[1.01]' 
                : index === 1 
                ? 'bg-slate-900/90 border-slate-700' 
                : 'bg-slate-900/60 border-slate-800'
            }`}
          >
            <div className="flex justify-between items-center mb-3">
              <div className="flex items-center gap-4">
                <span className={`w-10 h-10 flex items-center justify-center rounded-xl font-black text-lg ${
                  index === 0 ? 'bg-amber-500 text-slate-950 shadow-lg shadow-amber-500/40' :
                  index === 1 ? 'bg-slate-300 text-slate-950' :
                  index === 2 ? 'bg-amber-800 text-white' :
                  'bg-slate-800 text-slate-400'
                }`}>
                  #{index + 1}
                </span>
                <div>
                  <h2 className="text-2xl font-black tracking-wide text-white flex items-center gap-3">
                    {c.name}
                    {index === 0 && <span className="text-sm px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/40 font-medium">Leader</span>}
                  </h2>
                  <p className="text-xs text-slate-400 font-mono">{c.count} audience submissions</p>
                </div>
              </div>
              
              <div className="text-right">
                <div className="text-3xl font-black text-amber-400 tracking-tight font-mono">
                  {c.avgTotal} <span className="text-sm font-normal text-slate-400">/ 100</span>
                </div>
              </div>
            </div>

            {/* Visual Animated Score Bar */}
            <div className="w-full bg-slate-800/90 h-6 rounded-full overflow-hidden p-0.5 border border-slate-700/50">
              <div 
                className={`h-full rounded-full transition-all duration-1000 ${
                  index === 0 
                    ? 'bg-gradient-to-r from-amber-500 via-orange-500 to-amber-300' 
                    : 'bg-gradient-to-r from-orange-600 to-amber-500'
                }`}
                style={{ width: `${Math.min(c.avgTotal, 100)}%` }}
              />
            </div>

            {/* Breakdown Indicators */}
            <div className="grid grid-cols-5 gap-2 mt-3 text-center text-xs font-medium text-slate-400">
              <div className="bg-slate-800/40 py-1.5 px-2 rounded-lg border border-slate-800">
                Outfit: <span className="text-slate-200 font-bold">{c.avgOutfit}/25</span>
              </div>
              <div className="bg-slate-800/40 py-1.5 px-2 rounded-lg border border-slate-800">
                Essence: <span className="text-slate-200 font-bold">{c.avgEssence}/20</span>
              </div>
              <div className="bg-slate-800/40 py-1.5 px-2 rounded-lg border border-slate-800">
                Walk: <span className="text-slate-200 font-bold">{c.avgWalk}/20</span>
              </div>
              <div className="bg-slate-800/40 py-1.5 px-2 rounded-lg border border-slate-800">
                Chemistry: <span className="text-slate-200 font-bold">{c.avgChemistry}/20</span>
              </div>
              <div className="bg-slate-800/40 py-1.5 px-2 rounded-lg border border-slate-800">
                Impact: <span className="text-slate-200 font-bold">{c.avgConfidence}/15</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Footer Branding */}
      <footer className="text-center text-xs text-slate-500 border-t border-slate-800/60 pt-4 font-mono">
        Bedford Marston Kerala Association • Live Results Console
      </footer>
    </main>
  );
}

export default function ProjectorPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-950 text-white flex items-center justify-center">Loading live projector...</div>}>
      <ProjectorContent />
    </Suspense>
  );
}
