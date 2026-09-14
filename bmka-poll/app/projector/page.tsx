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
      console.error('Error fetching scores:', err);
    }
  };

  useEffect(() => {
    if (!isAuthorized) return;
    fetchScores();
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
    <main className="min-h-screen bg-[#070b14] text-white p-6 lg:p-10 flex flex-col justify-between select-none">
      {/* Top Event Banner */}
      <header className="border-b border-slate-800 pb-4">
        <div className="flex justify-between items-center text-xs font-semibold tracking-widest uppercase text-amber-500 mb-2">
          <span className="flex items-center gap-2">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-600"></span>
            </span>
            Audience Live Poll
          </span>
          <span className="font-mono text-slate-400">Total Submissions: <strong className="text-white text-sm">{totalVotes}</strong></span>
          <span className="font-mono text-slate-400">Live Sync: {lastUpdated || 'Connecting...'}</span>
        </div>

        <div className="text-center">
          <h1 className="text-3xl lg:text-5xl font-black bg-gradient-to-r from-amber-300 via-orange-400 to-amber-100 bg-clip-text text-transparent">
            കേരള തനിമ താരദമ്പതികൾ 2026
          </h1>
          <p className="text-sm text-slate-400 font-light mt-1">
            BMKA Ponnonam Celebrations • Official Live Scoreboard
          </p>
        </div>
      </header>

      {/* Vertical Bar Chart Stage */}
      <section className="flex-1 my-6 flex flex-col justify-end">
        <div className="relative w-full max-w-7xl mx-auto h-[480px] bg-slate-900/40 rounded-3xl border border-slate-800/80 p-6 flex flex-col justify-end">
          
          {/* Background Grid Lines */}
          <div className="absolute inset-0 px-6 py-8 flex flex-col justify-between pointer-events-none opacity-20">
            <div className="border-b border-dashed border-slate-500 w-full flex justify-end text-[10px] text-slate-400">100 pts</div>
            <div className="border-b border-dashed border-slate-500 w-full flex justify-end text-[10px] text-slate-400">75 pts</div>
            <div className="border-b border-dashed border-slate-500 w-full flex justify-end text-[10px] text-slate-400">50 pts</div>
            <div className="border-b border-dashed border-slate-500 w-full flex justify-end text-[10px] text-slate-400">25 pts</div>
            <div className="border-b border-slate-500 w-full"></div>
          </div>

          {/* Bar Chart Columns */}
          <div className="relative z-10 grid grid-flow-col auto-cols-fr gap-4 sm:gap-6 items-end h-full pt-10">
            {stats.map((c, index) => {
              const heightPercent = Math.max(c.avgTotal, 4);

              return (
                <div key={c.id} className="flex flex-col items-center h-full justify-end group">
                  {/* Floating Rank & Score Tag */}
                  <div className="mb-2 text-center transition-transform duration-500 group-hover:-translate-y-1">
                    {index === 0 && (
                      <span className="text-xl inline-block animate-bounce mb-1">👑</span>
                    )}
                    <div className="text-xl sm:text-2xl font-black text-amber-400 font-mono tracking-tight">
                      {c.avgTotal}
                    </div>
                    <span className="text-[10px] uppercase font-bold text-slate-400">
                      #{index + 1}
                    </span>
                  </div>

                  {/* Vertical Rising Bar */}
                  <div className="w-full max-w-[80px] bg-slate-800/60 rounded-2xl p-1 flex flex-col justify-end h-full">
                    <div
                      className={`w-full rounded-xl transition-all duration-1000 shadow-xl ${
                        index === 0
                          ? 'bg-gradient-to-t from-amber-600 via-orange-500 to-amber-300 shadow-orange-500/30'
                          : index === 1
                          ? 'bg-gradient-to-t from-slate-600 via-slate-400 to-slate-200 shadow-slate-400/20'
                          : index === 2
                          ? 'bg-gradient-to-t from-amber-900 via-amber-700 to-orange-400 shadow-amber-700/20'
                          : 'bg-gradient-to-t from-slate-700 to-slate-500'
                      }`}
                      style={{ height: `${heightPercent}%` }}
                    />
                  </div>

                  {/* Contestant Name Label */}
                  <div className="mt-3 text-center w-full truncate">
                    <p className="font-bold text-sm sm:text-base text-slate-100 truncate">
                      {c.name}
                    </p>
                    <span className="text-[11px] text-slate-400 font-mono">
                      {c.count} votes
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Detailed Breakdown Panels Below Chart */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3 max-w-7xl mx-auto w-full mt-4">
          {stats.map((c, i) => (
            <div key={c.id} className="bg-slate-900/80 border border-slate-800 rounded-xl p-2.5 text-center text-[11px]">
              <div className="font-bold text-slate-200 truncate mb-1">
                #{i + 1} {c.name}
              </div>
              <div className="grid grid-cols-2 gap-1 text-slate-400 text-[10px]">
                <span>Outfit: <b className="text-white">{c.avgOutfit}</b></span>
                <span>Essence: <b className="text-white">{c.avgEssence}</b></span>
                <span>Walk: <b className="text-white">{c.avgWalk}</b></span>
                <span>Chem: <b className="text-white">{c.avgChemistry}</b></span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="text-center text-[11px] text-slate-600 font-mono pt-2 border-t border-slate-800/40">
        Bedford Marston Kerala Association • Press F11 for Full Screen Display
      </footer>
    </main>
  );
}

export default function ProjectorPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#070b14] text-white flex items-center justify-center font-mono text-sm">Launching Projector Arena...</div>}>
      <ProjectorContent />
    </Suspense>
  );
}
