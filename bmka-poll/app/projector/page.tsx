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
  durationSeconds: number;
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
    }, 400);
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
    <main className="h-screen w-screen bg-[#06090f] text-white flex flex-col justify-between overflow-hidden select-none p-3 lg:p-5">
      
      {/* Top Header & Ticker */}
      <header className="flex-none border-b border-slate-800/80 pb-2">
        <div className="flex justify-between items-center text-[10px] sm:text-xs font-semibold tracking-widest uppercase text-amber-500 mb-1">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-600"></span>
            </span>
            <span>BMKA Ponnonam 2026 • Live Projector Arena</span>
          </div>

          <div className="flex items-center gap-1.5">
            {CRITERIA.map((c, i) => (
              <button
                key={c.key}
                onClick={() => {
                  switchSlide(i);
                  setIsPaused(true);
                }}
                className={`text-[9px] px-1.5 py-0.5 rounded transition ${
                  i === currentSlideIndex
                    ? 'bg-amber-500 text-black font-bold shadow'
                    : 'bg-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                {i === 0 ? 'Main' : `C${i}`}
              </button>
            ))}

            <button
              onClick={() => setIsPaused(!isPaused)}
              className="text-[9px] px-2 py-0.5 rounded bg-slate-800 text-slate-300 ml-1 border border-slate-700 font-mono"
            >
              {isPaused ? '▶ Play' : '⏸ Pause'}
            </button>

            {!isPaused && (
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-amber-300 border border-slate-700">
                ⏱ {secondsRemaining}s
              </span>
            )}
          </div>

          <div className="flex items-center gap-3 text-slate-400 font-mono text-[10px]">
            <span>Votes: <strong className="text-white">{totalVotes}</strong></span>
            <span>Sync: {lastUpdated || '...'}</span>
          </div>
        </div>

        {/* Animated Banner Header */}
        <div className={`text-center transition-all duration-300 transform ${isTransitioning ? 'opacity-0 -translate-y-2' : 'opacity-100 translate-y-0'}`}>
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-black text-amber-400 tracking-wide leading-tight">
            {activeCriterion.titleMl}
          </h1>
          <p className="text-xs sm:text-sm font-bold text-slate-300 flex items-center justify-center gap-2">
            <span>{activeCriterion.title}</span>
            <span className="text-[10px] px-2 py-0.2 rounded-full bg-slate-800 text-amber-400 border border-slate-700 font-mono">
              Max {activeCriterion.maxScore} Pts
            </span>
          </p>
        </div>
      </header>

      {/* Main Container with Screen Transition Animation */}
      <div className={`flex-1 flex flex-col justify-between my-2 overflow-hidden transition-all duration-400 ease-out transform ${
        isTransitioning ? 'opacity-0 scale-95 translate-y-3' : 'opacity-100 scale-100 translate-y-0'
      }`}>
        
        {/* Top Section: Top 5 Visual Bar Chart Showcase */}
        <div className="flex-none h-[180px] lg:h-[210px] bg-slate-900/40 rounded-2xl border border-slate-800/80 px-4 py-2 flex flex-col justify-end relative shadow-xl">
          <div className="absolute top-2 left-4 text-[10px] uppercase font-bold tracking-wider text-slate-400 font-mono">
            👑 Top 5 Leaders ({activeCriterion.title})
          </div>

          <div className="grid grid-cols-5 gap-3 items-end h-full pt-6">
            {topFive.map((c, index) => {
              const score = c[activeCriterion.key] as number;
              const heightPercent = Math.max((score / activeCriterion.maxScore) * 100, 8);

              return (
                <div key={c.id} className="flex flex-col items-center h-full justify-end">
                  <div className="text-center mb-1">
                    {index === 0 && <span className="text-sm block animate-bounce">👑</span>}
                    <span className={`font-mono font-black text-sm lg:text-base ${activeCriterion.accentColor}`}>
                      {score}
                    </span>
                  </div>
                  
                  <div className="w-full max-w-[65px] bg-slate-800/80 rounded-xl p-0.5 flex flex-col justify-end h-full">
                    <div
                      className={`w-full rounded-lg transition-all duration-700 bg-gradient-to-t ${activeCriterion.gradient} shadow-md`}
                      style={{ height: `${heightPercent}%` }}
                    />
                  </div>

                  <div className="mt-1 text-center w-full truncate">
                    <div className="text-[11px] lg:text-xs font-bold text-slate-100 truncate">
                      #{index + 1} {c.name}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Bottom Section: Compact Matrix for ALL Contestants (Fits up to 25 contestants) */}
        <div className="flex-1 mt-2 flex flex-col justify-center">
          <div className="grid grid-cols-5 gap-1.5 h-full auto-rows-fr">
            {sortedStats.map((c, idx) => {
              const currentVal = c[activeCriterion.key] as number;
              const isLead = idx === 0;

              return (
                <div
                  key={c.id}
                  className={`flex flex-col justify-between px-2 py-1 rounded-lg border transition-all duration-300 ${
                    isLead
                      ? 'bg-amber-950/30 border-amber-500/70 shadow-sm shadow-amber-500/10'
                      : idx < 3
                      ? 'bg-slate-900/90 border-slate-700/80'
                      : 'bg-slate-900/50 border-slate-800/80'
                  }`}
                >
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] font-mono text-slate-400 font-bold">
                      #{idx + 1}
                    </span>
                    <span className={`text-xs font-mono font-black ${isLead ? 'text-amber-400' : 'text-slate-200'}`}>
                      {currentVal}
                    </span>
                  </div>

                  <div className="text-[11px] font-bold text-white truncate my-0.5">
                    {c.name}
                  </div>

                  <div className="flex justify-between text-[8px] text-slate-400 font-mono border-t border-slate-800/60 pt-0.5">
                    <span>O:{c.avgOutfit}</span>
                    <span>E:{c.avgEssence}</span>
                    <span>W:{c.avgWalk}</span>
                    <span>C:{c.avgChemistry}</span>
                    <span>I:{c.avgConfidence}</span>
                    <span className="text-amber-400 font-bold">T:{c.avgTotal}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

      </div>

      {/* Footer Branding Bar */}
      <footer className="flex-none flex justify-between items-center text-[10px] text-slate-500 font-mono pt-1 border-t border-slate-800/40">
        <span>Bedford Marston Kerala Association • Kerala Thanima 2026</span>
        <span>Main Score: 15s • Criteria: 5s • Press F11 for Full Screen</span>
      </footer>
    </main>
  );
}

export default function ProjectorPage() {
  return (
    <Suspense fallback={<div className="h-screen w-screen bg-[#06090f] text-white flex items-center justify-center font-mono text-sm">Launching Projector Arena...</div>}>
      <ProjectorContent />
    </Suspense>
  );
}
