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

interface CriterionConfig {
  key: keyof CoupleStat;
  title: string;
  titleMl: string;
  maxScore: number;
  gradient: string;
  accentColor: string;
  durationSeconds: number; // 15s for main page, 5s for attribute pages
}

const CRITERIA: CriterionConfig[] = [
  {
    key: 'avgTotal',
    title: 'Overall Championship Leaderboard',
    titleMl: 'ആകെ സ്കോർ ലീഡർബോർഡ്',
    maxScore: 100,
    gradient: 'from-amber-600 via-orange-500 to-amber-300',
    accentColor: 'text-amber-400',
    durationSeconds: 15
  },
  {
    key: 'avgOutfit',
    title: 'Outfit & Presentation',
    titleMl: 'വേഷവിധാനം',
    maxScore: 25,
    gradient: 'from-pink-600 via-rose-500 to-rose-300',
    accentColor: 'text-rose-400',
    durationSeconds: 5
  },
  {
    key: 'avgEssence',
    title: 'Kerala Ethnic Essence',
    titleMl: 'കേരളത്തനിമ',
    maxScore: 20,
    gradient: 'from-emerald-600 via-teal-500 to-emerald-300',
    accentColor: 'text-emerald-400',
    durationSeconds: 5
  },
  {
    key: 'avgWalk',
    title: 'Walk & Stage Presence',
    titleMl: 'വേദിയിലെ നടനവും പ്രൗഢിയും',
    maxScore: 20,
    gradient: 'from-blue-600 via-indigo-500 to-cyan-300',
    accentColor: 'text-cyan-400',
    durationSeconds: 5
  },
  {
    key: 'avgChemistry',
    title: 'Togetherness & Chemistry',
    titleMl: 'ഒരുമയും പൊരുത്തവും',
    maxScore: 20,
    gradient: 'from-purple-600 via-fuchsia-500 to-pink-300',
    accentColor: 'text-fuchsia-400',
    durationSeconds: 5
  },
  {
    key: 'avgConfidence',
    title: 'Confidence & Impact',
    titleMl: 'ആത്മവിശ്വാസവും പ്രകടനവും',
    maxScore: 15,
    gradient: 'from-amber-500 via-yellow-400 to-lime-300',
    accentColor: 'text-yellow-400',
    durationSeconds: 5
  }
];

function ProjectorContent() {
  const searchParams = useSearchParams();
  const secretKey = searchParams.get('key');
  const [stats, setStats] = useState<CoupleStat[]>([]);
  const [totalVotes, setTotalVotes] = useState(0);
  const [lastUpdated, setLastUpdated] = useState<string>('');
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [secondsRemaining, setSecondsRemaining] = useState(15);

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
        });

        setStats(calculated);
        setLastUpdated(new Date().toLocaleTimeString());
      }
    } catch (err) {
      console.error('Error fetching scores:', err);
    }
  };

  // Background real-time score refresh every 3 seconds
  useEffect(() => {
    if (!isAuthorized) return;
    fetchScores();
    const interval = setInterval(fetchScores, 3000);
    return () => clearInterval(interval);
  }, [isAuthorized]);

  // Synchronized countdown and dynamic slide timer
  useEffect(() => {
    if (isPaused) return;

    const timer = setInterval(() => {
      setSecondsRemaining((prev) => {
        if (prev <= 1) {
          const nextIndex = (currentSlideIndex + 1) % CRITERIA.length;
          setCurrentSlideIndex(nextIndex);
          return CRITERIA[nextIndex].durationSeconds;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isPaused, currentSlideIndex]);

  if (!isAuthorized) {
    return (
      <main className="min-h-screen bg-black flex items-center justify-center text-zinc-600 font-mono text-sm">
        404 | Screen Not Found
      </main>
    );
  }

  const activeCriterion = CRITERIA[currentSlideIndex];

  // Dynamically sort candidates according to currently viewed criterion
  const sortedStats = [...stats].sort((a, b) => {
    return (b[activeCriterion.key] as number) - (a[activeCriterion.key] as number);
  });

  return (
    <main className="min-h-screen bg-[#070a12] text-white p-6 lg:p-10 flex flex-col justify-between select-none">
      
      {/* Top Banner */}
      <header className="border-b border-slate-800/80 pb-4">
        <div className="flex justify-between items-center text-xs font-semibold tracking-widest uppercase text-amber-500 mb-2">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-600"></span>
            </span>
            <span>Live Audience Scoreboard</span>
          </div>

          {/* Category Badges with Countdown Indicator */}
          <div className="flex items-center gap-1.5 overflow-hidden">
            {CRITERIA.map((c, i) => (
              <button
                key={c.key}
                onClick={() => {
                  setCurrentSlideIndex(i);
                  setSecondsRemaining(c.durationSeconds);
                  setIsPaused(true);
                }}
                className={`text-[10px] px-2 py-0.5 rounded transition ${
                  i === currentSlideIndex
                    ? 'bg-amber-500 text-black font-bold shadow-lg shadow-amber-500/30'
                    : 'bg-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                {i === 0 ? 'Overall' : `C${i}`}
              </button>
            ))}

            <button
              onClick={() => setIsPaused(!isPaused)}
              className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-300 ml-2 border border-slate-700 font-mono"
            >
              {isPaused ? '▶ Play' : '⏸ Pause'}
            </button>

            {!isPaused && (
              <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-slate-800 text-amber-300 border border-slate-700 ml-1">
                ⏱ {secondsRemaining}s
              </span>
            )}
          </div>

          <div className="flex items-center gap-4 text-slate-400 font-mono">
            <span>Votes Cast: <strong className="text-white text-sm">{totalVotes}</strong></span>
            <span>Sync: {lastUpdated || '...'}</span>
          </div>
        </div>

        {/* Current Active Category Title */}
        <div className="text-center pt-2 transition-all duration-500">
          <h1 className="text-2xl lg:text-4xl font-black text-amber-400 tracking-wide">
            {activeCriterion.titleMl}
          </h1>
          <p className="text-base lg:text-xl font-bold text-slate-200 mt-0.5 flex items-center justify-center gap-2">
            <span>{activeCriterion.title}</span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-amber-400 border border-slate-700 font-mono">
              Max {activeCriterion.maxScore} pts
            </span>
          </p>
        </div>
      </header>

      {/* Main Dynamic Bar Graph Stage */}
      <section className="flex-1 my-6 flex flex-col justify-end">
        <div className="relative w-full max-w-7xl mx-auto h-[460px] bg-slate-900/30 rounded-3xl border border-slate-800/80 p-6 flex flex-col justify-end shadow-2xl">
          
          {/* Background Score Guides */}
          <div className="absolute inset-0 px-6 py-8 flex flex-col justify-between pointer-events-none opacity-20">
            <div className="border-b border-dashed border-slate-500 w-full flex justify-end text-[10px] text-slate-400 font-mono">
              {activeCriterion.maxScore} pts
            </div>
            <div className="border-b border-dashed border-slate-500 w-full flex justify-end text-[10px] text-slate-400 font-mono">
              {(activeCriterion.maxScore * 0.75).toFixed(0)} pts
            </div>
            <div className="border-b border-dashed border-slate-500 w-full flex justify-end text-[10px] text-slate-400 font-mono">
              {(activeCriterion.maxScore * 0.5).toFixed(0)} pts
            </div>
            <div className="border-b border-dashed border-slate-500 w-full flex justify-end text-[10px] text-slate-400 font-mono">
              {(activeCriterion.maxScore * 0.25).toFixed(0)} pts
            </div>
            <div className="border-b border-slate-500 w-full"></div>
          </div>

          {/* Bar Chart Columns */}
          <div className="relative z-10 grid grid-flow-col auto-cols-fr gap-4 sm:gap-6 items-end h-full pt-10">
            {sortedStats.map((c, index) => {
              const score = c[activeCriterion.key] as number;
              const heightPercent = Math.max((score / activeCriterion.maxScore) * 100, 4);

              return (
                <div key={c.id} className="flex flex-col items-center h-full justify-end group">
                  {/* Floating Rank & Score Tag */}
                  <div className="mb-2 text-center transition-all duration-500">
                    {index === 0 && (
                      <span className="text-xl inline-block animate-bounce mb-0.5">👑</span>
                    )}
                    <div className={`text-xl sm:text-2xl font-black font-mono tracking-tight ${activeCriterion.accentColor}`}>
                      {score}
                    </div>
                    <span className="text-[10px] uppercase font-bold text-slate-400">
                      Rank #{index + 1}
                    </span>
                  </div>

                  {/* Vertical Animated Rising Bar */}
                  <div className="w-full max-w-[85px] bg-slate-800/60 rounded-2xl p-1 flex flex-col justify-end h-full border border-slate-700/40">
                    <div
                      className={`w-full rounded-xl transition-all duration-1000 shadow-xl bg-gradient-to-t ${activeCriterion.gradient}`}
                      style={{ height: `${heightPercent}%` }}
                    />
                  </div>

                  {/* Contestant Name Label */}
                  <div className="mt-3 text-center w-full truncate">
                    <p className="font-extrabold text-sm sm:text-base text-slate-100 truncate">
                      {c.name}
                    </p>
                    <span className="text-[11px] text-slate-400 font-mono">
                      Overall: {c.avgTotal}/100
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* All-in-One Multi-Attribute Score Cards Below Chart */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3 max-w-7xl mx-auto w-full mt-5">
          {sortedStats.map((c, i) => (
            <div 
              key={c.id} 
              className={`border rounded-xl p-3 text-center transition-all duration-500 ${
                i === 0 
                  ? 'bg-slate-900/90 border-amber-500/60 shadow-lg shadow-amber-500/10' 
                  : 'bg-slate-900/60 border-slate-800/90'
              }`}
            >
              <div className="font-black text-slate-100 text-xs sm:text-sm truncate mb-2">
                #{i + 1} {c.name}
              </div>
              <div className="space-y-1 text-[10px] text-slate-400 font-mono">
                <div className="flex justify-between">
                  <span>Outfit (25):</span>
                  <strong className="text-rose-300">{c.avgOutfit}</strong>
                </div>
                <div className="flex justify-between">
                  <span>Essence (20):</span>
                  <strong className="text-emerald-300">{c.avgEssence}</strong>
                </div>
                <div className="flex justify-between">
                  <span>Walk (20):</span>
                  <strong className="text-cyan-300">{c.avgWalk}</strong>
                </div>
                <div className="flex justify-between">
                  <span>Chem (20):</span>
                  <strong className="text-fuchsia-300">{c.avgChemistry}</strong>
                </div>
                <div className="flex justify-between">
                  <span>Impact (15):</span>
                  <strong className="text-yellow-300">{c.avgConfidence}</strong>
                </div>
                <div className="flex justify-between pt-1 border-t border-slate-800 text-amber-400 font-bold">
                  <span>Total (100):</span>
                  <span>{c.avgTotal}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Footer Controls & Information */}
      <footer className="flex flex-col sm:flex-row justify-between items-center text-[11px] text-slate-500 font-mono pt-3 border-t border-slate-800/40">
        <div>
          Bedford Marston Kerala Association • Kerala Thanima 2026
        </div>
        <div className="flex items-center gap-4 mt-2 sm:mt-0">
          <span>Timing: Main page <strong>15s</strong> • Criteria pages <strong>5s</strong></span>
          <span>Press <strong>F11</strong> for Fullscreen</span>
        </div>
      </footer>
    </main>
  );
}

export default function ProjectorPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#070a12] text-white flex items-center justify-center font-mono text-sm">Initializing Stage Display...</div>}>
      <ProjectorContent />
    </Suspense>
  );
}
