'use client';
import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { supabase } from '../../lib/supabase';

interface CoupleStat {
  id: string;
  name: string;
  chestNumber: number;
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

// Helper to extract numeric chest number ("Chest No 2" -> 2)
function extractChestNumber(name: string): number {
  const match = name.match(/\d+/);
  return match ? parseInt(match[0], 10) : 999;
}

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
      const { data: couples } = await supabase.from('couples').select('*');
      const { data: votes } = await supabase.from('votes').select('*');

      if (couples && votes) {
        setTotalVotes(votes.length);

        const calculated: CoupleStat[] = couples.map((c) => {
          const cVotes = votes.filter((v: any) => v.couple_id === c.id);
          const count = cVotes.length;
          const chestNumber = extractChestNumber(c.name);

          if (count === 0) {
            return {
              id: c.id,
              name: c.name,
              chestNumber,
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
            chestNumber,
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

  // Primary sort by Score descending; Tie-break by Chest Number ascending (1, 2, 3...)
  const sortedStats = [...stats].sort((a, b) => {
    const scoreDiff = (b[activeCriterion.key] as number) - (a[activeCriterion.key] as number);
    if (scoreDiff !== 0) return scoreDiff;
    return a.chestNumber - b.chestNumber;
  });

  // Top 5 Leaders for the main arena view
  const topFive = sortedStats.slice(0, 5);

  return (
    <main className="h-screen w-screen bg-[#050811] text-white flex flex-col justify-between overflow-hidden select-none p-4 lg:p-8 font-sans">
      
      {/* Top Header */}
      <header className="flex-none border-b border-slate-800/80 pb-3">
        <div className="flex justify-between items-center text-[11px] font-semibold uppercase tracking-wider text-amber-500 mb-1.5">
          <div className="flex items-center gap-2.5">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
            </span>
            <span className="font-mono text-slate-300 font-bold tracking-widest">BMKA PONNONAM 2026 • ARENA</span>
          </div>

          <div className="flex items-center gap-1.5 bg-slate-900 border border-slate-800 px-2 py-1 rounded-xl shadow-inner">
            {CRITERIA.map((c, i) => (
              <button
                key={c.key}
                onClick={() => {
                  switchSlide(i);
                  setIsPaused(true);
                }}
                className={`text-[10px] px-2.5 py-0.5 rounded-lg font-bold transition ${
                  i === currentSlideIndex
                    ? 'bg-amber-500 text-black shadow-md shadow-amber-500/20 scale-105'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {i === 0 ? 'Main' : `C${i}`}
              </button>
            ))}

            <div className="h-3 w-[1px] bg-slate-700 mx-1"></div>

            <button
              onClick={() => setIsPaused(!isPaused)}
              className="text-[10px] px-2 py-0.5 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 font-mono"
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
        <div className={`text-center transition-all duration-300 transform ${isTransitioning ? 'opacity-0 -translate-y-1' : 'opacity-100 translate-y-0'}`}>
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black text-amber-400 tracking-wide leading-tight">
            {activeCriterion.titleMl}
          </h1>
          <p className="text-sm sm:text-base font-semibold text-slate-300 flex items-center justify-center gap-2 mt-1">
            <span>{activeCriterion.title}</span>
            <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-slate-800 text-amber-400 border border-slate-700 font-mono font-bold">
              Max {activeCriterion.maxScore} Pts
            </span>
          </p>
        </div>
      </header>

      {/* Full-Height Bar Arena (Clean Zero-Scroll Layout) */}
      <section className={`flex-1 flex flex-col justify-center my-4 transition-all duration-300 ease-out transform ${
        isTransitioning ? 'opacity-0 scale-98' : 'opacity-100 scale-100'
      }`}>
        <div className="relative w-full max-w-6xl mx-auto h-[480px] lg:h-[540px] bg-slate-900/40 rounded-3xl border border-slate-800/80 px-8 py-6 flex flex-col justify-end shadow-2xl backdrop-blur-md">
          
          {/* Subtle Horizontal Score Guides */}
          <div className="absolute inset-0 px-8 py-6 flex flex-col justify-between pointer-events-none opacity-15">
            <div className="border-b border-dashed border-slate-400 w-full flex justify-end text-xs text-slate-300 font-mono font-bold">{activeCriterion.maxScore} pts</div>
            <div className="border-b border-dashed border-slate-400 w-full flex justify-end text-xs text-slate-300 font-mono">{(activeCriterion.maxScore * 0.75).toFixed(0)} pts</div>
            <div className="border-b border-dashed border-slate-400 w-full flex justify-end text-xs text-slate-300 font-mono">{(activeCriterion.maxScore * 0.5).toFixed(0)} pts</div>
            <div className="border-b border-dashed border-slate-400 w-full flex justify-end text-xs text-slate-300 font-mono">{(activeCriterion.maxScore * 0.25).toFixed(0)} pts</div>
            <div className="border-b border-slate-600 w-full"></div>
          </div>

          {/* Rising Stage Bars with Proper Natural Sorting (#1 Chest No 1, #2 Chest No 2...) */}
          <div className="relative z-10 flex justify-center items-end gap-6 sm:gap-12 h-full pt-4">
            {topFive.map((c, index) => {
              const score = c[activeCriterion.key] as number;
              const heightPercent = Math.max((score / activeCriterion.maxScore) * 100, 6);

              return (
                <div key={c.id} className="flex flex-col items-center h-full justify-end min-w-[100px] sm:min-w-[130px] group">
                  
                  {/* Floating Rank & Score Tag */}
                  <div className="mb-2 text-center transition-all duration-300 group-hover:-translate-y-1">
                    {index === 0 && (
                      <span className="text-2xl block animate-bounce mb-1 drop-shadow-[0_4px_10px_rgba(245,158,11,0.6)]">
                        👑
                      </span>
                    )}
                    <div className={`font-mono font-black text-2xl lg:text-3xl tracking-tight ${activeCriterion.accentColor}`}>
                      {score}
                    </div>
                    <span className="text-xs uppercase font-mono font-bold px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                      #{index + 1}
                    </span>
                  </div>
                  
                  {/* Vertical Animated Bar Pillar */}
                  <div className="w-16 sm:w-24 bg-slate-900/90 rounded-2xl p-1 flex flex-col justify-end h-full border border-slate-700/60 shadow-inner">
                    <div
                      className={`w-full rounded-xl transition-all duration-1000 shadow-xl bg-gradient-to-t ${activeCriterion.gradient}`}
                      style={{ height: `${heightPercent}%` }}
                    />
                  </div>

                  {/* Contestant Name Label */}
                  <div className="mt-3 text-center w-full">
                    <div className="text-sm sm:text-base font-extrabold text-white truncate">
                      {c.name}
                    </div>
                    <span className="text-[11px] text-slate-400 font-mono">
                      Overall: {c.avgTotal}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Broadcast Footer */}
      <footer className="flex-none flex justify-between items-center text-[10px] text-slate-500 font-mono pt-2 border-t border-slate-800/40">
        <span>Bedford Marston Kerala Association • Official Stage Console</span>
        <span>Auto-Rotation: Main (15s) • Criteria (5s) • Press <strong>F11</strong> for Fullscreen</span>
      </footer>
    </main>
  );
}

export default function ProjectorPage() {
  return (
    <Suspense fallback={<div className="h-screen w-screen bg-[#050811] text-white flex items-center justify-center font-mono text-sm">Launching Stage Arena...</div>}>
      <ProjectorContent />
    </Suspense>
  );
}
