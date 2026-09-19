'use client';
import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { supabase } from '../../lib/supabase';

interface LiveSession {
  current_couple_id: string | null;
  timer_duration: number;
  started_at: string | null;
  status: 'idle' | 'voting' | 'completed';
}

interface CriterionConfig {
  key: string;
  title: string;
  titleMl: string;
  maxScore: number;
  gradient: string;
  accentColor: string;
  durationSeconds: number;
}

const CRITERIA: CriterionConfig[] = [
  {
    key: 'total',
    title: 'Overall Championship Leaderboard',
    titleMl: 'ആകെ സ്കോർ ലീഡർബോർഡ്',
    maxScore: 100,
    gradient: 'from-amber-600 via-amber-500 to-yellow-300',
    accentColor: 'text-amber-400',
    durationSeconds: 15
  },
  {
    key: 'outfit',
    title: 'Outfit & Presentation',
    titleMl: 'വേഷവിധാനം',
    maxScore: 25,
    gradient: 'from-rose-600 via-pink-500 to-rose-300',
    accentColor: 'text-rose-400',
    durationSeconds: 5
  },
  {
    key: 'essence',
    title: 'Kerala Ethnic Essence',
    titleMl: 'കേരളത്തനിമ',
    maxScore: 20,
    gradient: 'from-emerald-600 via-teal-400 to-emerald-200',
    accentColor: 'text-emerald-400',
    durationSeconds: 5
  },
  {
    key: 'walk',
    title: 'Walk & Stage Presence',
    titleMl: 'വേദിയിലെ നടനവും പ്രൗഢിയും',
    maxScore: 20,
    gradient: 'from-blue-600 via-cyan-500 to-sky-300',
    accentColor: 'text-cyan-400',
    durationSeconds: 5
  },
  {
    key: 'chemistry',
    title: 'Togetherness & Chemistry',
    titleMl: 'ഒരുമയും പൊരുത്തവും',
    maxScore: 20,
    gradient: 'from-purple-600 via-fuchsia-500 to-pink-300',
    accentColor: 'text-fuchsia-400',
    durationSeconds: 5
  },
  {
    key: 'confidence',
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
  const isAuthorized = secretKey === 'bmka2026screen';

  const [displayMode, setDisplayMode] = useState<'live' | 'all'>('live');
  const [session, setSession] = useState<LiveSession>({
    current_couple_id: null,
    timer_duration: 60,
    started_at: null,
    status: 'idle'
  });
  const [currentCoupleName, setCurrentCoupleName] = useState<string>('Standby');
  const [coupleVotes, setCoupleVotes] = useState<any[]>([]);
  const [allCouplesData, setAllCouplesData] = useState<any[]>([]);
  const [winnerActive, setWinnerActive] = useState(false);
  const [timeLeft, setTimeLeft] = useState<number>(60);
  const [totalBallots, setTotalBallots] = useState<number>(0);

  // Cycling criteria for "All Contestants" mode
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
  const [slideSecondsRemaining, setSlideSecondsRemaining] = useState(15);
  const [isTransitioning, setIsTransitioning] = useState(false);

  const fetchStageData = async () => {
    try {
      const { data: modeData } = await supabase
        .from('app_settings')
        .select('value')
        .eq('key', 'projector_display_mode')
        .single();
      if (modeData?.value?.mode) {
        setDisplayMode(modeData.value.mode);
      }

      const { data: winData } = await supabase
        .from('app_settings')
        .select('value')
        .eq('key', 'winner_announcement')
        .single();
      if (winData?.value?.active !== undefined) {
        setWinnerActive(winData.value.active);
      }

      const { data: sessionData } = await supabase
        .from('app_settings')
        .select('value')
        .eq('key', 'live_contestant_session')
        .single();

      if (sessionData?.value) {
        const curSession: LiveSession = sessionData.value;
        setSession(curSession);

        if (curSession.current_couple_id) {
          const { data: cData } = await supabase
            .from('couples')
            .select('name')
            .eq('id', curSession.current_couple_id)
            .single();

          if (cData) setCurrentCoupleName(cData.name);

          const { data: vData } = await supabase
            .from('votes')
            .select('*')
            .eq('couple_id', curSession.current_couple_id);

          setCoupleVotes(vData || []);
        }
      }

      const { data: allCouples } = await supabase.from('couples').select('*');
      const { data: allVotes } = await supabase.from('votes').select('*');

      if (allCouples && allVotes) {
        setTotalBallots(allVotes.length);
        const calculated = allCouples.map((c) => {
          const cV = allVotes.filter((v: any) => v.couple_id === c.id);
          const count = cV.length;
          const chestNum = extractChestNumber(c.name);

          if (count === 0) {
            return {
              id: c.id,
              name: c.name,
              chestNumber: chestNum,
              count: 0,
              outfit: 0,
              essence: 0,
              walk: 0,
              chemistry: 0,
              confidence: 0,
              total: 0
            };
          }

          const sumTotal = cV.reduce((a: number, b: any) => a + b.total, 0);
          const sumOutfit = cV.reduce((a: number, b: any) => a + b.outfit, 0);
          const sumEssence = cV.reduce((a: number, b: any) => a + b.essence, 0);
          const sumWalk = cV.reduce((a: number, b: any) => a + b.walk, 0);
          const sumChem = cV.reduce((a: number, b: any) => a + b.chemistry, 0);
          const sumConf = cV.reduce((a: number, b: any) => a + b.confidence, 0);

          return {
            id: c.id,
            name: c.name,
            chestNumber: chestNum,
            count,
            total: parseFloat((sumTotal / count).toFixed(1)),
            outfit: parseFloat((sumOutfit / count).toFixed(1)),
            essence: parseFloat((sumEssence / count).toFixed(1)),
            walk: parseFloat((sumWalk / count).toFixed(1)),
            chemistry: parseFloat((sumChem / count).toFixed(1)),
            confidence: parseFloat((sumConf / count).toFixed(1))
          };
        });

        setAllCouplesData(calculated);
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    if (!isAuthorized) return;
    fetchStageData();
    const interval = setInterval(fetchStageData, 1500);
    return () => clearInterval(interval);
  }, [isAuthorized]);

  // Live single-contestant countdown timer
  useEffect(() => {
    if (session.status !== 'voting' || !session.started_at) {
      if (session.status === 'completed') setTimeLeft(0);
      else setTimeLeft(session.timer_duration);
      return;
    }

    const timer = setInterval(() => {
      const startMs = new Date(session.started_at!).getTime();
      const nowMs = Date.now();
      const elapsedSec = Math.floor((nowMs - startMs) / 1000);
      const remaining = Math.max(session.timer_duration - elapsedSec, 0);

      setTimeLeft(remaining);

      if (remaining === 0 && session.status === 'voting') {
        supabase.from('app_settings').upsert([
          {
            key: 'live_contestant_session',
            value: { ...session, status: 'completed' }
          }
        ]).then(() => {});
      }
    }, 250);

    return () => clearInterval(timer);
  }, [session]);

  // Slideshow auto-rotation for "All Contestants" mode (15s main, 5s criteria)
  const switchSlide = (nextIndex: number) => {
    setIsTransitioning(true);
    setTimeout(() => {
      setCurrentSlideIndex(nextIndex);
      setSlideSecondsRemaining(CRITERIA[nextIndex].durationSeconds);
      setIsTransitioning(false);
    }, 280);
  };

  useEffect(() => {
    if (displayMode !== 'all' || winnerActive) return;

    const timer = setInterval(() => {
      setSlideSecondsRemaining((prev) => {
        if (prev <= 1) {
          const nextIndex = (currentSlideIndex + 1) % CRITERIA.length;
          switchSlide(nextIndex);
          return CRITERIA[nextIndex].durationSeconds;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [displayMode, currentSlideIndex, winnerActive]);

  if (!isAuthorized) {
    return (
      <main className="h-screen w-screen bg-black flex items-center justify-center text-zinc-600 font-mono text-sm">
        404 | Screen Not Found
      </main>
    );
  }

  // Active criterion in "All Contestants" mode
  const activeCriterion = CRITERIA[currentSlideIndex];

  // Natural numeric sort by active criterion score (chest number tie-breaker)
  const sortedAllData = [...allCouplesData].sort((a, b) => {
    const diff = (b[activeCriterion.key] as number) - (a[activeCriterion.key] as number);
    if (diff !== 0) return diff;
    return a.chestNumber - b.chestNumber;
  });

  // Top 3 champions for Winner Announcement
  const championshipLeaderboard = [...allCouplesData].sort((a, b) => {
    const diff = b.total - a.total;
    if (diff !== 0) return diff;
    return a.chestNumber - b.chestNumber;
  });

  const voteCount = coupleVotes.length;
  const getSingleAvg = (key: string) => {
    if (voteCount === 0) return 0;
    const sum = coupleVotes.reduce((acc, curr) => acc + (curr[key] || 0), 0);
    return parseFloat((sum / voteCount).toFixed(1));
  };

  const timerFraction = timeLeft / (session.timer_duration || 60);
  const strokeDashoffset = 440 - 440 * timerFraction;

  return (
    <main className="h-screen w-screen bg-[#03060f] text-white flex flex-col justify-between overflow-hidden select-none p-4 lg:p-6 font-sans relative">
      
      {/* ================= WINNER OVERLAY ================= */}
      {winnerActive && championshipLeaderboard.length > 0 && (
        <div className="absolute inset-0 z-50 bg-[#02050e]/95 backdrop-blur-xl flex flex-col justify-between p-8 text-center animate-fadeIn">
          <div className="relative z-10 pt-2">
            <span className="text-xs uppercase tracking-widest font-mono text-amber-400 bg-amber-500/10 px-4 py-1.5 rounded-full border border-amber-500/30">
              BMKA Kerala Thanima 2026 • Official Championship Result
            </span>
            <h1 className="text-4xl lg:text-6xl font-black bg-gradient-to-r from-yellow-200 via-amber-400 to-orange-400 bg-clip-text text-transparent mt-3">
              വിജയികൾ / The Champions
            </h1>
          </div>

          <div className="relative z-10 max-w-5xl mx-auto w-full grid grid-cols-3 gap-6 items-end my-auto pt-6">
            {championshipLeaderboard[1] && (
              <div className="flex flex-col items-center">
                <span className="text-3xl mb-1">🥈</span>
                <span className="text-xs font-mono font-bold text-slate-300 uppercase">1st Runner Up</span>
                <div className="text-2xl font-black text-white mt-1 truncate max-w-[200px]">{championshipLeaderboard[1].name}</div>
                <div className="text-xl font-mono font-black text-slate-300 mt-1">{championshipLeaderboard[1].total} pts</div>
                <div className="w-full bg-gradient-to-t from-slate-800 to-slate-600 rounded-2xl h-44 mt-3 border border-slate-500/40 shadow-xl flex items-center justify-center">
                  <span className="text-4xl font-black font-mono text-slate-400">#2</span>
                </div>
              </div>
            )}

            {championshipLeaderboard[0] && (
              <div className="flex flex-col items-center scale-110">
                <span className="text-5xl animate-bounce mb-1">👑</span>
                <span className="text-xs font-mono font-black tracking-widest text-amber-300 uppercase bg-amber-500/20 px-3 py-0.5 rounded-full border border-amber-400/40">
                  Grand Champion
                </span>
                <div className="text-3xl lg:text-4xl font-black text-yellow-300 mt-1 truncate max-w-[260px] drop-shadow-[0_4px_15px_rgba(245,158,11,0.6)]">
                  {championshipLeaderboard[0].name}
                </div>
                <div className="text-2xl font-mono font-black text-amber-400 mt-1">{championshipLeaderboard[0].total} / 100</div>
                <div className="w-full bg-gradient-to-t from-amber-700 via-amber-500 to-yellow-300 rounded-2xl h-60 mt-3 border border-yellow-300/60 shadow-2xl shadow-amber-500/40 flex items-center justify-center">
                  <span className="text-6xl font-black font-mono text-slate-950">#1</span>
                </div>
              </div>
            )}

            {championshipLeaderboard[2] && (
              <div className="flex flex-col items-center">
                <span className="text-3xl mb-1">🥉</span>
                <span className="text-xs font-mono font-bold text-amber-500 uppercase">2nd Runner Up</span>
                <div className="text-2xl font-black text-white mt-1 truncate max-w-[200px]">{championshipLeaderboard[2].name}</div>
                <div className="text-xl font-mono font-black text-amber-400 mt-1">{championshipLeaderboard[2].total} pts</div>
                <div className="w-full bg-gradient-to-t from-amber-950 to-amber-800 rounded-2xl h-36 mt-3 border border-amber-700/40 shadow-xl flex items-center justify-center">
                  <span className="text-4xl font-black font-mono text-amber-600">#3</span>
                </div>
              </div>
            )}
          </div>

          <div className="relative z-10 text-xs font-mono text-slate-400">
            Bedford Marston Kerala Association • Grand Finale
          </div>
        </div>
      )}

      {/* ================= TOP STAGE HEADER ================= */}
      <header className="flex-none border-b border-slate-800/80 pb-2.5 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <span className="relative flex h-3 w-3">
            <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${session.status === 'voting' ? 'bg-emerald-400' : 'bg-amber-400'} opacity-75`}></span>
            <span className={`relative inline-flex rounded-full h-3 w-3 ${session.status === 'voting' ? 'bg-emerald-500' : 'bg-amber-500'}`}></span>
          </span>
          <span className="text-xs font-mono font-black text-amber-500 tracking-widest uppercase">
            BMKA PONNONAM 2026 • ARENA
          </span>
        </div>

        {/* Center Title in Header */}
        <div className="text-center">
          {displayMode === 'live' ? (
            <div>
              <span className="text-[10px] font-mono text-amber-500 uppercase tracking-wider block">Live Stage Contestant</span>
              <h1 className="text-xl sm:text-2xl font-black text-white">{currentCoupleName}</h1>
            </div>
          ) : (
            <div className={`transition-all duration-300 ${isTransitioning ? 'opacity-0 -translate-y-1' : 'opacity-100 translate-y-0'}`}>
              <h1 className="text-2xl sm:text-3xl font-black text-amber-400 tracking-wide leading-tight">
                {activeCriterion.titleMl}
              </h1>
              <p className="text-xs sm:text-sm font-semibold text-slate-300 flex items-center justify-center gap-2">
                <span>{activeCriterion.title}</span>
                <span className="text-[10px] px-2 py-0.2 rounded-full bg-slate-800 text-amber-400 border border-slate-700 font-mono font-bold">
                  Scale: 0 – {activeCriterion.maxScore} Pts
                </span>
                <span className="text-[10px] font-mono text-amber-300/80">⏱ {slideSecondsRemaining}s</span>
              </p>
            </div>
          )}
        </div>

        <div className="flex items-center gap-3 bg-slate-900 border border-slate-800 px-3.5 py-1.5 rounded-xl">
          <div className="text-right font-mono text-[11px]">
            <span className="text-slate-400">Total Ballots Cast: </span>
            <strong className="text-emerald-400 text-sm">{totalBallots}</strong>
          </div>
        </div>
      </header>

      {/* ================= VIEW 1: LIVE SINGLE CONTESTANT WITH GOLD TIMER ================= */}
      {displayMode === 'live' && (
        <div className="flex-1 flex gap-6 my-3 items-stretch overflow-hidden">
          
          {/* Left Quarter: 60s Gold Animated Timer */}
          <div className="w-[28%] bg-gradient-to-b from-slate-900/90 via-slate-950 to-slate-900/90 rounded-3xl border-2 border-amber-500/60 p-5 flex flex-col justify-between items-center shadow-2xl relative">
            <div className="text-center">
              <span className="text-[11px] font-mono font-extrabold uppercase tracking-widest text-amber-400 bg-amber-500/10 px-3 py-0.5 rounded-full border border-amber-500/30">
                Official Voting Window
              </span>
            </div>

            <div className="relative w-52 h-52 lg:w-60 lg:h-60 flex items-center justify-center my-auto">
              <svg className="w-full h-full transform -rotate-90" viewBox="0 0 160 160">
                <circle cx="80" cy="80" r="70" stroke="currentColor" strokeWidth="8" className="text-slate-800" fill="transparent" />
                <circle
                  cx="80"
                  cy="80"
                  r="70"
                  stroke="currentColor"
                  strokeWidth="10"
                  strokeDasharray="440"
                  strokeDashoffset={strokeDashoffset}
                  strokeLinecap="round"
                  className={`transition-all duration-300 ${timeLeft <= 10 ? 'text-red-500' : 'text-amber-400'}`}
                  fill="transparent"
                  style={{
                    filter: timeLeft <= 10 
                      ? 'drop-shadow(0 0 12px rgba(239, 68, 68, 0.8))' 
                      : 'drop-shadow(0 0 15px rgba(245, 158, 11, 0.8))'
                  }}
                />
              </svg>

              <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                <span className={`text-6xl font-black font-mono tracking-tighter ${
                  timeLeft <= 10 ? 'text-red-500 animate-ping' : 'text-yellow-300 drop-shadow-[0_2px_15px_rgba(245,158,11,0.7)]'
                }`}>
                  {timeLeft}
                </span>
                <span className="text-[11px] font-mono font-bold uppercase tracking-widest text-slate-400 mt-1">
                  Seconds
                </span>
              </div>
            </div>

            <div className="w-full text-center">
              {session.status === 'voting' ? (
                <div className="p-2.5 bg-emerald-950/40 border border-emerald-600/60 rounded-2xl text-emerald-300 text-xs font-bold animate-pulse">
                  🟢 Live Voting Open • Submit on Phone
                </div>
              ) : session.status === 'completed' ? (
                <div className="p-2.5 bg-red-950/60 border border-red-600/80 rounded-2xl text-red-300 text-xs font-black tracking-wider uppercase">
                  🔒 Voting Closed • Final Scores
                </div>
              ) : (
                <div className="p-2.5 bg-slate-800 rounded-2xl text-slate-400 text-xs font-mono">
                  ⏳ Waiting for Admin to Start
                </div>
              )}
            </div>
          </div>

          {/* Right 3/4: Current Contestant Scores Arena */}
          <div className="flex-1 bg-slate-900/40 rounded-3xl border border-slate-800/80 p-5 flex flex-col justify-between shadow-2xl relative">
            <div className="flex justify-between items-center border-b border-slate-800/80 pb-2.5">
              <div>
                <span className="text-[10px] font-mono text-amber-500 uppercase tracking-wider block">Currently Performing</span>
                <h2 className="text-2xl font-black text-white">{currentCoupleName}</h2>
              </div>
              <div className="text-right">
                <span className="text-[10px] text-slate-400 font-mono">Cumulative Average</span>
                <div className="text-2xl font-black font-mono text-amber-400">
                  {getSingleAvg('total')} <span className="text-xs font-normal text-slate-400">/ 100</span>
                </div>
              </div>
            </div>

            <div className="flex-1 flex justify-between items-end gap-5 pt-6 pb-2 px-3">
              {CRITERIA.map((criterion) => {
                const currentScore = getSingleAvg(criterion.key);
                const heightPercent = Math.max((currentScore / criterion.maxScore) * 100, 6);

                return (
                  <div key={criterion.key} className="flex-1 flex flex-col items-center h-full justify-end group">
                    <div className="mb-2 text-center">
                      <div className={`font-mono font-black text-lg lg:text-2xl ${criterion.accentColor}`}>
                        {currentScore}
                      </div>
                      <span className="text-[9px] font-mono text-slate-400 uppercase font-bold">
                        /{criterion.maxScore} pts
                      </span>
                    </div>

                    <div className="w-full max-w-[65px] bg-slate-900/90 rounded-2xl p-1 flex flex-col justify-end h-[310px] border border-slate-700/60 shadow-inner">
                      <div
                        className={`w-full rounded-xl transition-all duration-700 bg-gradient-to-t ${criterion.gradient} shadow-lg`}
                        style={{ height: `${heightPercent}%` }}
                      />
                    </div>

                    <div className="mt-2 text-center w-full">
                      <div className="text-xs lg:text-sm font-black text-amber-300 truncate">
                        {criterion.titleMl}
                      </div>
                      <div className="text-[10px] font-medium text-slate-300 truncate">
                        {criterion.title}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="border-t border-slate-800/80 pt-2 flex justify-between text-[10px] font-mono text-slate-500">
              <span>Votes received for this contestant: <strong className="text-white">{voteCount}</strong></span>
              <span>Outfit (25) • Essence (20) • Walk (20) • Chem (20) • Impact (15)</span>
            </div>
          </div>

        </div>
      )}

      {/* ================= VIEW 2: ALL CONTESTANTS (NO ROSTER GRID - PURE VERTICAL BAR CHART ARENA) ================= */}
      {displayMode === 'all' && (
        <section className={`flex-1 flex flex-col justify-center my-3 transition-all duration-300 ${
          isTransitioning ? 'opacity-0 scale-98' : 'opacity-100 scale-100'
        }`}>
          <div className="relative w-full h-[540px] bg-slate-900/40 rounded-3xl border border-slate-800/80 px-6 py-5 flex flex-col justify-end shadow-2xl">
            
            {/* Background Score Guideline Marks */}
            <div className="absolute inset-0 px-8 py-5 flex flex-col justify-between pointer-events-none opacity-15">
              <div className="border-b border-dashed border-slate-400 w-full flex justify-end text-[10px] text-slate-300 font-mono font-bold">{activeCriterion.maxScore} pts</div>
              <div className="border-b border-dashed border-slate-400 w-full flex justify-end text-[10px] text-slate-300 font-mono font-bold">{(activeCriterion.maxScore * 0.75).toFixed(0)} pts</div>
              <div className="border-b border-dashed border-slate-400 w-full flex justify-end text-[10px] text-slate-300 font-mono font-bold">{(activeCriterion.maxScore * 0.5).toFixed(0)} pts</div>
              <div className="border-b border-dashed border-slate-400 w-full flex justify-end text-[10px] text-slate-300 font-mono font-bold">{(activeCriterion.maxScore * 0.25).toFixed(0)} pts</div>
              <div className="border-b border-slate-600 w-full"></div>
            </div>

            {/* Dynamic Unified Bar Arena for ALL Contestants in One Screen (No Roster) */}
            <div className="relative z-10 flex justify-between items-end gap-1 sm:gap-2 h-full pt-10">
              {sortedAllData.map((c, index) => {
                const score = c[activeCriterion.key] as number;
                const heightPercent = Math.max((score / activeCriterion.maxScore) * 100, 4);

                return (
                  <div key={c.id} className="flex-1 flex flex-col items-center h-full justify-end group min-w-0">
                    
                    {/* Floating Header: Crown is ABSOLUTE, so bar container height is 100% UNIFORM */}
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
                    
                    {/* Vertical Bar: All containers share identical height */}
                    <div className="w-full max-w-[42px] bg-slate-900/90 rounded-xl p-0.5 flex flex-col justify-end h-[370px] border border-slate-800/80 shadow-inner">
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
                        Overall: {c.total}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* Broadcast Footer */}
      <footer className="flex-none flex justify-between items-center text-[10px] text-slate-500 font-mono pt-2 border-t border-slate-800/40">
        <span>Bedford Marston Kerala Association • Official Scrutiny Console</span>
        <span>Controlled via Admin Console • Press <strong>F11</strong> for Stage Fullscreen</span>
      </footer>
    </main>
  );
}

export default function ProjectorPage() {
  return (
    <Suspense fallback={<div className="h-screen w-screen bg-[#03060f] text-white flex items-center justify-center font-mono text-sm">Launching Live Arena...</div>}>
      <ProjectorContent />
    </Suspense>
  );
}
