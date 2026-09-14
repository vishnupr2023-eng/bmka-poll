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
  glowColor: string;
  durationSeconds: number;
}

const CRITERIA: CriterionConfig[] = [
  {
    key: 'avgTotal',
    title: 'Overall Championship Leaderboard',
    titleMl: 'ആകെ സ്കോർ ലീഡർബോർഡ്',
    maxScore: 100,
    gradient: 'from-amber-600 via-amber-500 to-yellow-300',
    accentColor: 'text-amber-400',
    glowColor: 'shadow-amber-500/20',
    durationSeconds: 15
  },
  {
    key: 'avgOutfit',
    title: 'Outfit & Presentation',
    titleMl: 'വേഷവിധാനം',
    maxScore: 25,
    gradient: 'from-rose-600 via-pink-500 to-rose-300',
    accentColor: 'text-rose-400',
    glowColor: 'shadow-rose-500/20',
    durationSeconds: 5
  },
  {
    key: 'avgEssence',
    title: 'Kerala Ethnic Essence',
    titleMl: 'കേരളത്തനിമ',
    maxScore: 20,
    gradient: 'from-emerald-600 via-teal-400 to-emerald-200',
    accentColor: 'text-emerald-400',
    glowColor: 'shadow-emerald-500/20',
    durationSeconds: 5
  },
  {
    key: 'avgWalk',
    title: 'Walk & Stage Presence',
    titleMl: 'വേദിയിലെ നടനവും പ്രൗഢിയും',
    maxScore: 20,
    gradient: 'from-blue-600 via-cyan-500 to-sky-300',
    accentColor: 'text-cyan-400',
    glowColor: 'shadow-cyan-500/20',
    durationSeconds: 5
  },
  {
    key: 'avgChemistry',
    title: 'Togetherness & Chemistry',
    titleMl: 'ഒരുമയും പൊരുത്തവും',
    maxScore: 20,
    gradient: 'from-purple-600 via-fuchsia-500 to-pink-300',
    accentColor: 'text-fuchsia-400',
    glowColor: 'shadow-fuchsia-500/20',
    durationSeconds: 5
  },
  {
    key: 'avgConfidence',
    title: 'Confidence & Impact',
    titleMl: 'ആത്മവിശ്വാസവും പ്രകടനവും',
    maxScore: 15,
    gradient: 'from-amber-500 via-yellow-400 to-lime-300',
    accentColor: 'text-yellow-400',
    glowColor: 'shadow-yellow-500/20',
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
  const [isTransitioning, setIsTransitioning] = useState(false);

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

  useEffect(() => {
    if (!isAuthorized) return;
    fetchScores();
    const interval = setInterval(fetchScores, 3000);
    return () => clearInterval(interval);
  }, [isAuthorized]);

  const switchSlide = (nextIndex: number) => {
    setIsTransitioning(true);
    setTimeout(() => {
      setCurrentSlideIndex(nextIndex);
      setSecondsRemaining(CRITERIA[nextIndex].durationSeconds);
      setIsTransitioning(false);
    }, 350);
  };

  useEffect(() => {
    if (isPaused) return;

    const timer = setInterval(() => {
      setSecondsRemaining((prev) => {
        if (prev <= 1) {
          const nextIndex = (currentSlideIndex + 1) % CRITERIA.length;
          switchSlide(nextIndex);
          return CRITERIA[nextIndex].durationSeconds;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isPaused, currentSlideIndex]);

  if (!isAuthorized) {
    return (
      <main className="h-screen w-screen bg-black flex items-center justify-center text-zinc-600 font-mono text-sm">
        404 | Screen Not Found
      </main>
    );
  }

  const activeCriterion = CRITERIA[currentSlideIndex];

  const sortedStats = [...stats].sort((a, b) => {
    return (b[activeCriterion.key] as number) - (a[activeCriterion.key] as number);
  });

  const topFive = sortedStats.slice(0, 5);

  return (
    <main className="h-screen w-screen bg-[#06080e] text-white flex flex-col justify-between overflow-hidden select-none p-4 lg:p-6 font-sans">
      
      {/* Top Header Bar */}
      <header className="flex-none border-b border-slate-800/80 pb-3">
        <div className="flex justify-between items-center text-[11px] font-semibold tracking-wider uppercase text-amber-500 mb-1.5">
          <div className="flex items-center gap-2.5">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
            </span>
            <span className="tracking-widest font-mono text-slate-300 font-bold">BMKA PONNONAM 2026 • LIVE ARENA</span>
          </div>

          {/* Slide Controller Badges */}
          <div className="flex items-center gap-1.5 bg-slate-900/90 border border-slate-800 px-2 py-1 rounded-xl shadow-inner">
            {CRITERIA.map((c, i) => (
              <button
                key={c.key}
                onClick={() => {
                  switchSlide(i);
                  setIsPaused(true);
                }}
                className={`text-[10px] px-2.5 py-0.5 rounded-lg font-bold transition-all ${
                  i === currentSlideIndex
                    ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-black shadow-md shadow-amber-500/20 scale-105'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {i === 0 ? 'Leaderboard' : `C${i}`}
              </button>
            ))}

            <div className="h-3 w-[1px] bg-slate-700 mx-1"></div>

            <button
              onClick={() => setIsPaused(!isPaused)}
              className="text-[10px] px-2 py-0.5 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-mono transition"
            >
              {isPaused ? '▶ Play' : '⏸ Pause'}
            </button>

            {!isPaused && (
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-400 border border-amber-500/30">
                ⏱ {secondsRemaining}s
              </span>
            )}
          </div>

          <div className="flex items-center gap-4 text-slate-400 font-mono text-[11px]">
            <span>Audience Votes: <strong className="text-white font-bold">{totalVotes}</strong></span>
            <span>Sync: <span className="text-slate-200">{lastUpdated || '...'}</span></span>
          </div>
        </div>

        {/* Malayalam & English Category Heading */}
        <div className={`text-center transition-all duration-300 transform ${isTransitioning ? 'opacity-0 -translate-y-2' : 'opacity-100 translate-y-0'}`}>
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black bg-gradient-to-r from-amber-200 via-amber-400 to-orange-400 bg-clip-text text-transparent tracking-wide">
            {activeCriterion.titleMl}
          </h1>
          <p className="text-xs sm:text-sm font-semibold text-slate-300 flex items-center justify-center gap-2 mt-0.5">
            <span>{activeCriterion.title}</span>
            <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-slate-800 text-amber-400 border border-slate-700 font-mono font-bold">
              Scale: 0 – {activeCriterion.maxScore} Pts
            </span>
          </p>
        </div>
      </header>

      {/* Center Showcase: Vertical Bar Chart Arena */}
      <section className={`flex-1 flex flex-col justify-center my-3 transition-all duration-300 ease-out transform ${
        isTransitioning ? 'opacity-0 scale-95' : 'opacity-100 scale-100'
      }`}>
        <div className="relative w-full max-w-6xl mx-auto h-[260px] lg:h-[300px] bg-gradient-to-b from-slate-900/60 to-slate-950/80 rounded-3xl border border-slate-800/80 px-8 py-4 flex flex-col justify-end shadow-2xl backdrop-blur-md">
          
          {/* Subtle Grid Guidelines */}
          <div className="absolute inset-0 px-8 py-5 flex flex-col justify-between pointer-events-none opacity-15">
            <div className="border-b border-dashed border-slate-400 w-full flex justify-end text-[10px] text-slate-300 font-mono font-bold">{activeCriterion.maxScore} pts</div>
            <div className="border-b border-dashed border-slate-400 w-full flex justify-end text-[10px] text-slate-300 font-mono">{(activeCriterion.maxScore * 0.75).toFixed(0)} pts</div>
            <div className="border-b border-dashed border-slate-400 w-full flex justify-end text-[10px] text-slate-300 font-mono">{(activeCriterion.maxScore * 0.5).toFixed(0)} pts</div>
            <div className="border-b border-dashed border-slate-400 w-full flex justify-end text-[10px] text-slate-300 font-mono">{(activeCriterion.maxScore * 0.25).toFixed(0)} pts</div>
            <div className="border-b border-slate-600 w-full"></div>
          </div>

          {/* Dynamic Rising Bars (Displays All Active Contestants or Top 5) */}
          <div className="relative z-10 flex justify-center items-end gap-6 sm:gap-10 h-full pt-4">
            {topFive.map((c, index) => {
              const score = c[activeCriterion.key] as number;
              const heightPercent = Math.max((score / activeCriterion.maxScore) * 100, 8);

              return (
                <div key={c.id} className="flex flex-col items-center h-full justify-end group min-w-[90px] sm:min-w-[110px]">
                  
                  {/* Floating Crown & Score Badge */}
                  <div className="mb-2 text-center transition-all duration-300 group-hover:-translate-y-1">
                    {index === 0 && (
                      <span className="text-xl block animate-bounce mb-0.5 drop-shadow-[0_4px_10px_rgba(245,158,11,0.5)]">
                        👑
                      </span>
                    )}
                    <div className={`font-mono font-black text-xl lg:text-2xl tracking-tight ${activeCriterion.accentColor}`}>
                      {score}
                    </div>
                    <span className={`text-[10px] uppercase font-mono font-bold px-2 py-0.5 rounded-full ${
                      index === 0 ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40' :
                      index === 1 ? 'bg-slate-500/20 text-slate-200 border border-slate-500/40' :
                      index === 2 ? 'bg-amber-800/20 text-amber-500 border border-amber-800/40' :
                      'bg-slate-800 text-slate-400'
                    }`}>
                      #{index + 1}
                    </span>
                  </div>
                  
                  {/* 3D Vertical Bar Pillar */}
                  <div className="w-16 sm:w-20 bg-slate-900/90 rounded-2xl p-1 flex flex-col justify-end h-full border border-slate-700/60 shadow-inner">
                    <div
                      className={`w-full rounded-xl transition-all duration-1000 shadow-lg bg-gradient-to-t ${activeCriterion.gradient} ${activeCriterion.glowColor}`}
                      style={{ height: `${heightPercent}%` }}
                    />
                  </div>

                  {/* Contestant Name */}
                  <div className="mt-2 text-center w-full">
                    <div className="text-xs sm:text-sm font-extrabold text-white truncate max-w-[120px]">
                      {c.name}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Bottom Showcase: Professional Compact Contestant Deck */}
      <section className="flex-none max-w-6xl w-full mx-auto pb-1">
        <div className="flex items-center justify-between mb-2 px-1">
          <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
            <span>📋 Complete Roster ({sortedStats.length} Contestants)</span>
          </span>
          <span className="text-[10px] font-mono text-slate-500">
            Scores: Outfit (25) • Essence (20) • Walk (20) • Chem (20) • Impact (15)
          </span>
        </div>

        {/* Compact, Clean Scoreboard Badges (Adapts elegantly from 2 to 25 contestants) */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2 max-h-[160px] overflow-hidden">
          {sortedStats.map((c, idx) => {
            const currentVal = c[activeCriterion.key] as number;
            const isFirst = idx === 0;

            return (
              <div
                key={c.id}
                className={`flex flex-col justify-between p-2 rounded-xl border transition-all duration-300 ${
                  isFirst
                    ? 'bg-gradient-to-r from-amber-950/40 via-slate-900 to-slate-900 border-amber-500/80 shadow-md shadow-amber-500/10'
                    : idx < 3
                    ? 'bg-slate-900/90 border-slate-700/90'
                    : 'bg-slate-900/60 border-slate-800/80'
                }`}
              >
                {/* Header: Rank + Name + Current Category Score */}
                <div className="flex items-center justify-between gap-1 mb-1">
                  <div className="flex items-center gap-1.5 truncate">
                    <span className={`text-[10px] font-mono font-bold px-1.5 py-0.2 rounded ${
                      idx === 0 ? 'bg-amber-500 text-black' :
                      idx === 1 ? 'bg-slate-300 text-black' :
                      idx === 2 ? 'bg-amber-800 text-white' :
                      'bg-slate-800 text-slate-400'
                    }`}>
                      #{idx + 1}
                    </span>
                    <span className="text-xs font-black text-slate-100 truncate">
                      {c.name}
                    </span>
                  </div>
                  
                  <span className={`text-xs font-mono font-black ${isFirst ? 'text-amber-400' : 'text-slate-200'}`}>
                    {currentVal}
                  </span>
                </div>

                {/* Footer: Compact Category Summary */}
                <div className="flex justify-between items-center text-[9px] text-slate-400 font-mono border-t border-slate-800/70 pt-1">
                  <span>O: <b className="text-slate-200">{c.avgOutfit}</b></span>
                  <span>E: <b className="text-slate-200">{c.avgEssence}</b></span>
                  <span>W: <b className="text-slate-200">{c.avgWalk}</b></span>
                  <span>C: <b className="text-slate-200">{c.avgChemistry}</b></span>
                  <span>I: <b className="text-slate-200">{c.avgConfidence}</b></span>
                  <span className="text-amber-400 font-bold ml-1">Total: {c.avgTotal}</span>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Broadcast Footer */}
      <footer className="flex-none flex justify-between items-center text-[10px] text-slate-500 font-mono pt-2 border-t border-slate-800/40">
        <span>Bedford Marston Kerala Association • Official Scrutiny Console</span>
        <span>Auto-Rotation: Main (15s) • Criteria (5s) • Press <strong>F11</strong> for Fullscreen</span>
      </footer>
    </main>
  );
}

export default function ProjectorPage() {
  return (
    <Suspense fallback={<div className="h-screen w-screen bg-[#06080e] text-white flex items-center justify-center font-mono text-sm">Launching Stage Presentation Arena...</div>}>
      <ProjectorContent />
    </Suspense>
  );
}
