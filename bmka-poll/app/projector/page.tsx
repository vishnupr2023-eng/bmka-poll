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
  const [winnerActive, setWinnerActive] = useState(false);

  const isAuthorized = secretKey === 'bmka2026screen';

  const fetchScores = async () => {
    try {
      const { data: couples } = await supabase.from('couples').select('*');
      const { data: votes } = await supabase.from('votes').select('*');
      const { data: winData } = await supabase.from('app_settings').select('value').eq('key', 'winner_announcement').single();

      if (winData?.value?.active !== undefined) {
        setWinnerActive(winData.value.active);
      }

      if (couples && votes) {
        setTotalVotes(votes.length);

        const calculated: CoupleStat[] = couples.map((c) => {
          const cVotes = votes.filter((v: any) => v.couple_id === c.id);
          const count = cVotes.length;
          const chestNum = extractChestNumber(c.name);

          if (count === 0) {
            return {
              id: c.id,
              name: c.name,
              chestNumber: chestNum,
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
            chestNumber: chestNum,
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
    const interval = setInterval(fetchScores, 2500);
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
    if (isPaused || winnerActive) return;

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
  }, [isPaused, currentSlideIndex, winnerActive]);

  if (!isAuthorized) {
    return (
      <main className="h-screen w-screen bg-black flex items-center justify-center text-zinc-600 font-mono text-sm">
        404 | Screen Not Found
      </main>
    );
  }

  const activeCriterion = CRITERIA[currentSlideIndex];

  // Natural numeric order with score as primary sort
  const sortedStats = [...stats].sort((a, b) => {
    const scoreDiff = (b[activeCriterion.key] as number) - (a[activeCriterion.key] as number);
    if (scoreDiff !== 0) return scoreDiff;
    return a.chestNumber - b.chestNumber;
  });

  const overallSorted = [...stats].sort((a, b) => {
    const scoreDiff = b.avgTotal - a.avgTotal;
    if (scoreDiff !== 0) return scoreDiff;
    return a.chestNumber - b.chestNumber;
  });

  const winner1 = overallSorted[0];
  const winner2 = overallSorted[1];
  const winner3 = overallSorted[2];

  return (
    <main className="h-screen w-screen bg-[#040711] text-white flex flex-col justify-between overflow-hidden select-none p-4 lg:p-6 font-sans relative">
      
      {/* ================= WINNER ANNOUNCEMENT MODAL OVERLAY ================= */}
      {winnerActive && winner1 && (
        <div className="absolute inset-0 z-50 bg-[#030611]/95 backdrop-blur-xl flex flex-col justify-between p-8 text-center animate-fadeIn">
          {/* Confetti & Fireworks Glow Effect */}
          <div className="absolute inset-0 pointer-events-none overflow-hidden">
            <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-amber-500/15 rounded-full blur-3xl animate-pulse"></div>
            <div className="absolute top-1/3 right-1/4 w-96 h-96 bg-yellow-400/15 rounded-full blur-3xl animate-pulse delay-700"></div>
          </div>

          <div className="relative z-10 pt-2">
            <span className="text-xs uppercase tracking-widest font-mono text-amber-400 bg-amber-500/10 px-4 py-1.5 rounded-full border border-amber-500/30">
              BMKA Kerala Thanima 2026 • Official Championship Result
            </span>
            <h1 className="text-4xl lg:text-6xl font-black bg-gradient-to-r from-yellow-200 via-amber-400 to-orange-400 bg-clip-text text-transparent mt-3">
              വിജയികൾ / The Champions
            </h1>
          </div>

          {/* 3-Tier Podium */}
          <div className="relative z-10 max-w-5xl mx-auto w-full grid grid-cols-3 gap-6 items-end my-auto pt-6">
            
            {/* 2nd Place */}
            {winner2 && (
              <div className="flex flex-col items-center">
                <span className="text-3xl mb-1">🥈</span>
                <span className="text-xs font-mono font-bold text-slate-300 uppercase">1st Runner Up</span>
                <div className="text-2xl font-black text-white mt-1 truncate max-w-[200px]">{winner2.name}</div>
                <div className="text-xl font-mono font-black text-slate-300 mt-1">{winner2.avgTotal} pts</div>
                <div className="w-full bg-gradient-to-t from-slate-800 to-slate-600 rounded-2xl h-44 mt-3 border border-slate-500/40 shadow-xl flex items-center justify-center">
                  <span className="text-4xl font-black font-mono text-slate-400">#2</span>
                </div>
              </div>
            )}

            {/* 1st Place (Champion) */}
            <div className="flex flex-col items-center scale-110">
              <span className="text-5xl animate-bounce mb-1">👑</span>
              <span className="text-xs font-mono font-black tracking-widest text-amber-300 uppercase bg-amber-500/20 px-3 py-0.5 rounded-full border border-amber-400/40">
                Grand Champion
              </span>
              <div className="text-3xl lg:text-4xl font-black text-yellow-300 mt-1 truncate max-w-[260px] drop-shadow-[0_4px_15px_rgba(245,158,11,0.6)]">
                {winner1.name}
              </div>
              <div className="text-2xl font-mono font-black text-amber-400 mt-1">{winner1.avgTotal} / 100</div>
              <div className="w-full bg-gradient-to-t from-amber-700 via-amber-500 to-yellow-300 rounded-2xl h-60 mt-3 border border-yellow-300/60 shadow-2xl shadow-amber-500/40 flex items-center justify-center">
                <span className="text-6xl font-black font-mono text-slate-950">#1</span>
              </div>
            </div>

            {/* 3rd Place */}
            {winner3 && (
              <div className="flex flex-col items-center">
                <span className="text-3xl mb-1">🥉</span>
                <span className="text-xs font-mono font-bold text-amber-500 uppercase">2nd Runner Up</span>
                <div className="text-2xl font-black text-white mt-1 truncate max-w-[200px]">{winner3.name}</div>
                <div className="text-xl font-mono font-black text-amber-400 mt-1">{winner3.avgTotal} pts</div>
                <div className="w-full bg-gradient-to-t from-amber-950 to-amber-800 rounded-2xl h-36 mt-3 border border-amber-700/40 shadow-xl flex items-center justify-center">
                  <span className="text-4xl font-black font-mono text-amber-600">#3</span>
                </div>
              </div>
            )}
          </div>

          <div className="relative z-10 text-xs font-mono text-slate-400">
            Bedford Marston Kerala Association • Congratulations to all participants!
          </div>
        </div>
      )}

      {/* ================= NORMAL LIVE STAGE ROTATION ================= */}
      
      {/* Top Header */}
      <header className="flex-none border-b border-slate-800/80 pb-2">
        <div className="flex justify-between items-center text-xs font-semibold uppercase tracking-wider text-amber-500 mb-1">
          <div className="flex items-center gap-2.5">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
            </span>
            <span className="font-mono text-slate-300 font-bold tracking-widest">BMKA PONNONAM 2026 • ARENA</span>
          </div>

          <div className="flex items-center gap-1.5 bg-slate-900 border border-slate-800 px-2.5 py-1 rounded-xl">
            {CRITERIA.map((c, i) => (
              <button
                key={c.key}
                onClick={() => {
                  switchSlide(i);
                  setIsPaused(true);
                }}
                className={`text-[10px] px-2.5 py-0.5 rounded font-bold transition ${
                  i === currentSlideIndex
                    ? 'bg-amber-500 text-black shadow'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {i === 0 ? 'Main' : `C${i}`}
              </button>
            ))}

            <div className="h-3 w-[1px] bg-slate-700 mx-1"></div>

            <button
              onClick={() => setIsPaused(!isPaused)}
              className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700 font-mono"
            >
              {isPaused ? '▶' : '⏸'}
            </button>

            {!isPaused && (
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/30">
                ⏱ {secondsRemaining}s
              </span>
            )}
          </div>

          <div className="flex items-center gap-4 text-slate-400 font-mono text-xs">
            <span>Votes: <strong className="text-white font-bold">{totalVotes}</strong></span>
            <span>Sync: <span className="text-slate-200">{lastUpdated || '...'}</span></span>
          </div>
        </div>

        {/* Malayalam & English Title */}
        <div className={`text-center transition-all duration-300 ${isTransitioning ? 'opacity-0 -translate-y-1' : 'opacity-100 translate-y-0'}`}>
          <h1 className="text-3xl sm:text-4xl font-black text-amber-400 tracking-wide leading-tight">
            {activeCriterion.titleMl}
          </h1>
          <p className="text-sm font-semibold text-slate-300 flex items-center justify-center gap-2 mt-0.5">
            <span>{activeCriterion.title}</span>
            <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-slate-800 text-amber-400 border border-slate-700 font-mono font-bold">
              Max {activeCriterion.maxScore} Pts
            </span>
          </p>
        </div>
      </header>

      {/* Main Full-Stage Arena: Accommodates ALL Contestants in One Screen Without Scrolling */}
      <section className={`flex-1 flex flex-col justify-center my-2 transition-all duration-300 ${
        isTransitioning ? 'opacity-0 scale-98' : 'opacity-100 scale-100'
      }`}>
        <div className="relative w-full h-[520px] bg-slate-900/40 rounded-3xl border border-slate-800/80 px-4 py-4 flex flex-col justify-end shadow-2xl">
          
          {/* Score Guidelines */}
          <div className="absolute inset-0 px-6 py-5 flex flex-col justify-between pointer-events-none opacity-15">
            <div className="border-b border-dashed border-slate-400 w-full flex justify-end text-[10px] text-slate-300 font-mono font-bold">{activeCriterion.maxScore} pts</div>
            <div className="border-b border-dashed border-slate-400 w-full flex justify-end text-[10px] text-slate-300 font-mono font-bold">{(activeCriterion.maxScore * 0.75).toFixed(0)} pts</div>
            <div className="border-b border-dashed border-slate-400 w-full flex justify-end text-[10px] text-slate-300 font-mono font-bold">{(activeCriterion.maxScore * 0.5).toFixed(0)} pts</div>
            <div className="border-b border-dashed border-slate-400 w-full flex justify-end text-[10px] text-slate-300 font-mono font-bold">{(activeCriterion.maxScore * 0.25).toFixed(0)} pts</div>
            <div className="border-b border-slate-600 w-full"></div>
          </div>

          {/* Dynamic 25-Contestant Unified Grid Bars */}
          <div className="relative z-10 flex justify-between items-end gap-1 sm:gap-2 h-full pt-8">
            {sortedStats.map((c, index) => {
              const score = c[activeCriterion.key] as number;
              const heightPercent = Math.max((score / activeCriterion.maxScore) * 100, 4);

              return (
                <div key={c.id} className="flex-1 flex flex-col items-center h-full justify-end group min-w-0">
                  
                  {/* Floating Header (Crown positioned absolute so it NEVER shrinks the first bar) */}
                  <div className="relative flex flex-col items-center mb-1.5 h-12 justify-end w-full">
                    {index === 0 && (
                      <span className="absolute -top-5 text-base sm:text-lg animate-bounce drop-shadow-[0_2px_8px_rgba(245,158,11,0.6)]">
                        👑
                      </span>
                    )}
                    <span className={`font-mono font-black text-xs sm:text-sm lg:text-base leading-none ${activeCriterion.accentColor}`}>
                      {score}
                    </span>
                    <span className="text-[9px] font-mono font-bold px-1 rounded-full bg-slate-800 text-slate-300 border border-slate-700 mt-1">
                      #{index + 1}
                    </span>
                  </div>
                  
                  {/* Vertical Bar (All 25 bars share identical container height) */}
                  <div className="w-full max-w-[42px] bg-slate-900/90 rounded-xl p-0.5 flex flex-col justify-end h-[360px] border border-slate-800/80 shadow-inner">
                    <div
                      className={`w-full rounded-lg transition-all duration-1000 bg-gradient-to-t ${activeCriterion.gradient}`}
                      style={{ height: `${heightPercent}%` }}
                    />
                  </div>

                  {/* Contestant Name Label */}
                  <div className="mt-2 text-center w-full">
                    <div className="text-[10px] sm:text-xs font-bold text-slate-200 truncate w-full" title={c.name}>
                      {c.name.replace(/Chest No\s*/i, '#')}
                    </div>
                    <div className="text-[8px] font-mono text-slate-400 mt-0.5 hidden sm:block">
                      T:{c.avgTotal}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Broadcast Footer */}
      <footer className="flex-none flex justify-between items-center text-xs text-slate-500 font-mono pt-2 border-t border-slate-800/40">
        <span>Bedford Marston Kerala Association • Official Scrutiny Console</span>
        <span>Auto-Rotation: Main (15s) • Criteria (5s) • Press <strong>F11</strong> for Fullscreen</span>
      </footer>
    </main>
  );
}

export default function ProjectorPage() {
  return (
    <Suspense fallback={<div className="h-screen w-screen bg-[#040711] text-white flex items-center justify-center font-mono text-sm">Launching Stage Arena...</div>}>
      <ProjectorContent />
    </Suspense>
  );
}
