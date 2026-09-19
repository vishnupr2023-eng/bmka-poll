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
    gradient: 'from-amber-600 via-amber-500 to-yellow-300',
    accentColor: 'text-amber-400',
    durationSeconds: 15
  },
  {
    key: 'avgOutfit',
    title: 'Outfit & Presentation',
    titleMl: 'വേഷവിധാനം',
    maxScore: 25,
    gradient: 'from-rose-600 via-pink-500 to-rose-300',
    accentColor: 'text-rose-400',
    durationSeconds: 5
  },
  {
    key: 'avgEssence',
    title: 'Kerala Ethnic Essence',
    titleMl: 'കേരളത്തനിമ',
    maxScore: 20,
    gradient: 'from-emerald-600 via-teal-400 to-emerald-200',
    accentColor: 'text-emerald-400',
    durationSeconds: 5
  },
  {
    key: 'avgWalk',
    title: 'Walk & Stage Presence',
    titleMl: 'വേദിയിലെ നടനവും പ്രൗഢിയും',
    maxScore: 20,
    gradient: 'from-blue-600 via-cyan-500 to-sky-300',
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
    }, 280);
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
    <main className="h-screen w-screen bg-[#050811] text-white flex flex-col justify-between overflow-hidden select-none p-3 lg:p-4 font-sans">
      
      {/* Top Header */}
      <header className="flex-none border-b border-slate-800/80 pb-2">
        <div className="flex justify-between items-center text-[10px] font-semibold uppercase tracking-wider text-amber-500 mb-1">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span className="font-mono text-slate-300 font-bold tracking-widest">BMKA PONNONAM 2026 • ARENA</span>
          </div>

          <div className="flex items-center gap-1 bg-slate-900 border border-slate-800 px-2 py-0.5 rounded-lg">
            {CRITERIA.map((c, i) => (
              <button
                key={c.key}
                onClick={() => {
                  switchSlide(i);
                  setIsPaused(true);
                }}
                className={`text-[9px] px-2 py-0.5 rounded font-bold transition ${
                  i === currentSlideIndex
                    ? 'bg-amber-500 text-black shadow'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {i === 0 ? 'Main' : `C${i}`}
              </button>
            ))}

            <div className="h-2.5 w-[1px] bg-slate-700 mx-1"></div>

            <button
              onClick={() => setIsPaused(!isPaused)}
              className="text-[9px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700 font-mono"
            >
              {isPaused ? '▶' : '⏸'}
            </button>

            {!isPaused && (
              <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/30">
                ⏱ {secondsRemaining}s
              </span>
            )}
          </div>

          <div className="flex items-center gap-3 text-slate-400 font-mono text-[10px]">
            <span>Votes: <strong className="text-white font-bold">{totalVotes}</strong></span>
            <span>Sync: <span className="text-slate-200">{lastUpdated || '...'}</span></span>
          </div>
        </div>

        {/* Malayalam Title */}
        <div className={`text-center transition-all duration-300 ${isTransitioning ? 'opacity-0 -translate-y-1' : 'opacity-100 translate-y-0'}`}>
          <h1 className="text-xl sm:text-2xl font-black text-amber-400 tracking-wide leading-tight">
            {activeCriterion.titleMl}
          </h1>
          <p className="text-[11px] sm:text-xs font-semibold text-slate-300 flex items-center justify-center gap-2">
            <span>{activeCriterion.title}</span>
            <span className="text-[9px] px-2 py-0.2 rounded-full bg-slate-800 text-amber-400 border border-slate-700 font-mono font-bold">
              Max {activeCriterion.maxScore} Pts
            </span>
          </p>
        </div>
      </header>

      {/* Top 5 Rising Podium Bar Arena */}
      <section className={`flex-none h-[170px] lg:h-[190px] w-full max-w-6xl mx-auto my-1 transition-all duration-300 ${
        isTransitioning ? 'opacity-0 scale-98' : 'opacity-100 scale-100'
      }`}>
        <div className="relative w-full h-full bg-slate-900/40 rounded-2xl border border-slate-800/80 px-6 py-2 flex flex-col justify-end shadow-xl">
          
          <div className="absolute inset-0 px-6 py-3 flex flex-col justify-between pointer-events-none opacity-15">
            <div className="border-b border-dashed border-slate-400 w-full flex justify-end text-[9px] text-slate-300 font-mono">{activeCriterion.maxScore} pts</div>
            <div className="border-b border-dashed border-slate-400 w-full flex justify-end text-[9px] text-slate-300 font-mono">{(activeCriterion.maxScore * 0.5).toFixed(0)} pts</div>
            <div className="border-b border-slate-600 w-full"></div>
          </div>

          <div className="relative z-10 flex justify-center items-end gap-6 sm:gap-10 h-full pt-2">
            {topFive.map((c, index) => {
              const score = c[activeCriterion.key] as number;
              const heightPercent = Math.max((score / activeCriterion.maxScore) * 100, 8);

              return (
                <div key={c.id} className="flex flex-col items-center h-full justify-end min-w-[80px]">
                  <div className="mb-1 text-center">
                    {index === 0 && <span className="text-sm block animate-bounce mb-0.5">👑</span>}
                    <div className={`font-mono font-black text-sm lg:text-base ${activeCriterion.accentColor}`}>
                      {score}
                    </div>
                    <span className="text-[9px] uppercase font-mono font-bold px-1.5 py-0.2 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                      #{index + 1}
                    </span>
                  </div>
                  
                  <div className="w-12 sm:w-16 bg-slate-900/90 rounded-xl p-0.5 flex flex-col justify-end h-full border border-slate-700/60 shadow-inner">
                    <div
                      className={`w-full rounded-lg transition-all duration-700 bg-gradient-to-t ${activeCriterion.gradient}`}
                      style={{ height: `${heightPercent}%` }}
                    />
                  </div>

                  <div className="mt-1 text-center w-full">
                    <div className="text-[11px] font-extrabold text-white truncate max-w-[100px]">
                      {c.name}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Complete 25 Contestant Matrix (5 Columns x 5 Rows = Zero Scroll) */}
      <section className="flex-1 w-full max-w-6xl mx-auto flex flex-col justify-between my-1">
        <div className="flex items-center justify-between px-1 mb-1">
          <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400">
            Official Roster ({sortedStats.length} Contestants)
          </span>
          <span className="text-[9px] font-mono text-slate-500">
            O (25) • E (20) • W (20) • C (20) • I (15)
          </span>
        </div>

        <div className="grid grid-cols-5 gap-1.5 h-[calc(100%-20px)]">
          {sortedStats.map((c, idx) => {
            const currentVal = c[activeCriterion.key] as number;

            return (
              <div
                key={c.id}
                className="flex flex-col justify-between px-2 py-1 rounded-lg border border-slate-800 bg-slate-900/80 shadow-sm"
              >
                <div className="flex items-center justify-between gap-1">
                  <div className="flex items-center gap-1 truncate">
                    <span className="text-[9px] font-mono font-bold px-1 rounded bg-slate-800 text-amber-400 border border-slate-700">
                      #{idx + 1}
                    </span>
                    <span className="text-[10px] font-bold text-slate-100 truncate">
                      {c.name}
                    </span>
                  </div>
                  
                  <span className="text-[11px] font-mono font-black text-amber-400">
                    {currentVal}
                  </span>
                </div>

                <div className="flex justify-between items-center text-[8px] text-slate-400 font-mono border-t border-slate-800/80 pt-0.5 mt-0.5">
                  <span>O:{c.avgOutfit}</span>
                  <span>E:{c.avgEssence}</span>
                  <span>W:{c.avgWalk}</span>
                  <span>C:{c.avgChemistry}</span>
                  <span>I:{c.avgConfidence}</span>
                  <span className="text-amber-300 font-bold">T:{c.avgTotal}</span>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Broadcast Footer */}
      <footer className="flex-none flex justify-between items-center text-[9px] text-slate-500 font-mono pt-1 border-t border-slate-800/40">
        <span>Bedford Marston Kerala Association • Official Scrutiny Console</span>
        <span>Auto-Rotation: Main (15s) • Criteria (5s) • Press <strong>F11</strong> for Fullscreen</span>
      </footer>
    </main>
  );
}

export default function ProjectorPage() {
  return (
    <Suspense fallback={<div className="h-screen w-screen bg-[#050811] text-white flex items-center justify-center font-mono text-sm">Launching Stage Presentation Arena...</div>}>
      <ProjectorContent />
    </Suspense>
  );
}
