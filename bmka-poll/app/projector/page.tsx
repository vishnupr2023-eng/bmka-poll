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

interface CriterionDisplay {
  label: string;
  labelMl: string;
  key: string;
  max: number;
  gradient: string;
  color: string;
}

const CRITERIA: CriterionDisplay[] = [
  { label: 'Outfit & Presentation', labelMl: 'വേഷവിധാനം', key: 'outfit', max: 25, gradient: 'from-rose-600 via-pink-500 to-rose-300', color: 'text-rose-400' },
  { label: 'Ethnic Essence', labelMl: 'കേരളത്തനിമ', key: 'essence', max: 20, gradient: 'from-emerald-600 via-teal-400 to-emerald-200', color: 'text-emerald-400' },
  { label: 'Walk & Presence', labelMl: 'നടനം & പ്രൗഢി', key: 'walk', max: 20, gradient: 'from-cyan-600 via-sky-500 to-blue-300', color: 'text-cyan-400' },
  { label: 'Chemistry', labelMl: 'ഒരുമ & പൊരുത്തം', key: 'chemistry', max: 20, gradient: 'from-purple-600 via-fuchsia-500 to-pink-300', color: 'text-fuchsia-400' },
  { label: 'Confidence & Impact', labelMl: 'ആത്മവിശ്വാസം', key: 'confidence', max: 15, gradient: 'from-yellow-600 via-amber-500 to-yellow-300', color: 'text-yellow-400' },
  { label: 'Total Score', labelMl: 'ആകെ സ്കോർ', key: 'total', max: 100, gradient: 'from-amber-600 via-orange-500 to-amber-300', color: 'text-amber-400' },
];

function ProjectorContent() {
  const searchParams = useSearchParams();
  const secretKey = searchParams.get('key');
  const isAuthorized = secretKey === 'bmka2026screen';

  const [session, setSession] = useState<LiveSession>({
    current_couple_id: null,
    timer_duration: 60,
    started_at: null,
    status: 'idle'
  });
  const [currentCoupleName, setCurrentCoupleName] = useState<string>('Standby');
  const [coupleVotes, setCoupleVotes] = useState<any[]>([]);
  const [winnerActive, setWinnerActive] = useState(false);
  const [winnersList, setWinnersList] = useState<any[]>([]);
  const [timeLeft, setTimeLeft] = useState<number>(60);

  // 1. Sync live session and votes every 1.5 seconds for instant bar animation
  const fetchLiveData = async () => {
    try {
      const { data: sessionData } = await supabase
        .from('app_settings')
        .select('value')
        .eq('key', 'live_contestant_session')
        .single();

      const { data: winData } = await supabase
        .from('app_settings')
        .select('value')
        .eq('key', 'winner_announcement')
        .single();

      if (winData?.value?.active !== undefined) {
        setWinnerActive(winData.value.active);
      }

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

      // Fetch top 3 for winner screen
      const { data: allCouples } = await supabase.from('couples').select('*');
      const { data: allVotes } = await supabase.from('votes').select('*');
      if (allCouples && allVotes) {
        const calculated = allCouples.map((c) => {
          const cV = allVotes.filter((v: any) => v.couple_id === c.id);
          const count = cV.length;
          const avgTotal = count === 0 ? 0 : parseFloat((cV.reduce((a: number, b: any) => a + b.total, 0) / count).toFixed(1));
          return { id: c.id, name: c.name, avgTotal, count };
        }).sort((a, b) => b.avgTotal - a.avgTotal);
        setWinnersList(calculated);
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    if (!isAuthorized) return;
    fetchLiveData();
    const interval = setInterval(fetchLiveData, 1500);
    return () => clearInterval(interval);
  }, [isAuthorized]);

  // 2. High-precision 60-second animated timer calculation
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

      // Auto-mark session completed in database when clock hits 0
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

  if (!isAuthorized) {
    return (
      <main className="h-screen w-screen bg-black flex items-center justify-center text-zinc-600 font-mono text-sm">
        404 | Screen Not Found
      </main>
    );
  }

  // Calculate live criterion averages
  const voteCount = coupleVotes.length;
  const getAvg = (key: string) => {
    if (voteCount === 0) return 0;
    const sum = coupleVotes.reduce((acc, curr) => acc + (curr[key] || 0), 0);
    return parseFloat((sum / voteCount).toFixed(1));
  };

  const timerFraction = timeLeft / (session.timer_duration || 60);
  const strokeDashoffset = 440 - 440 * timerFraction;

  return (
    <main className="h-screen w-screen bg-[#03060f] text-white flex flex-col justify-between overflow-hidden select-none p-5 lg:p-7 font-sans relative">
      
      {/* WINNER OVERLAY IF ACTIVATED */}
      {winnerActive && winnersList.length > 0 && (
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
            {winnersList[1] && (
              <div className="flex flex-col items-center">
                <span className="text-3xl mb-1">🥈</span>
                <span className="text-xs font-mono font-bold text-slate-300 uppercase">1st Runner Up</span>
                <div className="text-2xl font-black text-white mt-1 truncate max-w-[200px]">{winnersList[1].name}</div>
                <div className="text-xl font-mono font-black text-slate-300 mt-1">{winnersList[1].avgTotal} pts</div>
                <div className="w-full bg-gradient-to-t from-slate-800 to-slate-600 rounded-2xl h-44 mt-3 border border-slate-500/40 shadow-xl flex items-center justify-center">
                  <span className="text-4xl font-black font-mono text-slate-400">#2</span>
                </div>
              </div>
            )}

            {winnersList[0] && (
              <div className="flex flex-col items-center scale-110">
                <span className="text-5xl animate-bounce mb-1">👑</span>
                <span className="text-xs font-mono font-black tracking-widest text-amber-300 uppercase bg-amber-500/20 px-3 py-0.5 rounded-full border border-amber-400/40">
                  Grand Champion
                </span>
                <div className="text-3xl lg:text-4xl font-black text-yellow-300 mt-1 truncate max-w-[260px] drop-shadow-[0_4px_15px_rgba(245,158,11,0.6)]">
                  {winnersList[0].name}
                </div>
                <div className="text-2xl font-mono font-black text-amber-400 mt-1">{winnersList[0].avgTotal} / 100</div>
                <div className="w-full bg-gradient-to-t from-amber-700 via-amber-500 to-yellow-300 rounded-2xl h-60 mt-3 border border-yellow-300/60 shadow-2xl shadow-amber-500/40 flex items-center justify-center">
                  <span className="text-6xl font-black font-mono text-slate-950">#1</span>
                </div>
              </div>
            )}

            {winnersList[2] && (
              <div className="flex flex-col items-center">
                <span className="text-3xl mb-1">🥉</span>
                <span className="text-xs font-mono font-bold text-amber-500 uppercase">2nd Runner Up</span>
                <div className="text-2xl font-black text-white mt-1 truncate max-w-[200px]">{winnersList[2].name}</div>
                <div className="text-xl font-mono font-black text-amber-400 mt-1">{winnersList[2].avgTotal} pts</div>
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

      {/* TOP HEADER */}
      <header className="flex-none border-b border-slate-800/80 pb-3 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <span className="relative flex h-3 w-3">
            <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${session.status === 'voting' ? 'bg-emerald-400' : 'bg-amber-400'} opacity-75`}></span>
            <span className={`relative inline-flex rounded-full h-3 w-3 ${session.status === 'voting' ? 'bg-emerald-500' : 'bg-amber-500'}`}></span>
          </span>
          <span className="text-xs font-mono font-black text-amber-500 tracking-widest uppercase">
            BMKA PONNONAM 2026 • LIVE AUDIENCE SCORING
          </span>
        </div>

        <div className="text-center">
          <h1 className="text-2xl lg:text-3xl font-black bg-gradient-to-r from-yellow-200 via-amber-400 to-orange-400 bg-clip-text text-transparent">
            {currentCoupleName}
          </h1>
          <span className="text-[11px] font-mono text-slate-400">Current Contestant on Stage</span>
        </div>

        <div className="flex items-center gap-3 bg-slate-900 border border-slate-800 px-4 py-2 rounded-2xl shadow-inner">
          <div className="text-right font-mono">
            <div className="text-xs text-slate-400 uppercase">Live Ballots Received</div>
            <div className="text-xl lg:text-2xl font-black text-emerald-400 animate-pulse">
              {voteCount} <span className="text-xs font-normal text-slate-400">votes</span>
            </div>
          </div>
        </div>
      </header>

      {/* MAIN BODY: LEFT QUARTER (GOLD TIMER) + RIGHT 3/4 (CATEGORY SCORE ARENA) */}
      <div className="flex-1 flex gap-6 my-4 items-stretch overflow-hidden">
        
        {/* ================= LEFT QUARTER: BIG GOLD ANIMATED 60S TIMER ================= */}
        <div className="w-[28%] bg-gradient-to-b from-slate-900/90 via-slate-950 to-slate-900/90 rounded-3xl border-2 border-amber-500/60 p-6 flex flex-col justify-between items-center shadow-2xl relative">
          
          <div className="text-center">
            <span className="text-xs font-mono font-extrabold uppercase tracking-widest text-amber-400 bg-amber-500/10 px-3 py-1 rounded-full border border-amber-500/30">
              Official Voting Window
            </span>
          </div>

          {/* Circular Gold Animated Countdown */}
          <div className="relative w-56 h-56 lg:w-64 lg:h-64 flex items-center justify-center my-auto">
            <svg className="w-full h-full transform -rotate-90" viewBox="0 0 160 160">
              {/* Background Ring */}
              <circle
                cx="80"
                cy="80"
                r="70"
                stroke="currentColor"
                strokeWidth="8"
                className="text-slate-800"
                fill="transparent"
              />
              {/* Animated Progress Ring */}
              <circle
                cx="80"
                cy="80"
                r="70"
                stroke="currentColor"
                strokeWidth="10"
                strokeDasharray="440"
                strokeDashoffset={strokeDashoffset}
                strokeLinecap="round"
                className={`transition-all duration-300 ${
                  timeLeft <= 10 ? 'text-red-500' : 'text-amber-400'
                }`}
                fill="transparent"
                style={{
                  filter: timeLeft <= 10 
                    ? 'drop-shadow(0 0 12px rgba(239, 68, 68, 0.8))' 
                    : 'drop-shadow(0 0 15px rgba(245, 158, 11, 0.8))'
                }}
              />
            </svg>

            {/* Inner Clock Text */}
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
              <span className={`text-6xl lg:text-7xl font-black font-mono tracking-tighter ${
                timeLeft <= 10 ? 'text-red-500 animate-ping' : 'text-yellow-300 drop-shadow-[0_2px_15px_rgba(245,158,11,0.7)]'
              }`}>
                {timeLeft}
              </span>
              <span className="text-xs font-mono font-bold uppercase tracking-widest text-slate-400 mt-1">
                Seconds
              </span>
            </div>
          </div>

          {/* Status Badge below timer */}
          <div className="w-full text-center">
            {session.status === 'voting' ? (
              <div className="p-3 bg-emerald-950/40 border border-emerald-600/60 rounded-2xl text-emerald-300 text-xs font-bold animate-pulse">
                🟢 Live Voting Open • Submit on Phone
              </div>
            ) : session.status === 'completed' ? (
              <div className="p-3 bg-red-950/60 border border-red-600/80 rounded-2xl text-red-300 text-xs font-black tracking-wider uppercase">
                🔒 Voting Closed • Final Results
              </div>
            ) : (
              <div className="p-3 bg-slate-800 rounded-2xl text-slate-400 text-xs font-mono">
                ⏳ Waiting for Admin to Start
              </div>
            )}
          </div>
        </div>

        {/* ================= RIGHT 3/4: LIVE CATEGORY RISING BARS ================= */}
        <div className="flex-1 bg-slate-900/40 rounded-3xl border border-slate-800/80 p-6 flex flex-col justify-between shadow-2xl relative">
          
          <div className="flex justify-between items-center border-b border-slate-800/80 pb-3">
            <div>
              <h2 className="text-lg font-black text-white">Live Audience Scoreboard</h2>
              <p className="text-xs text-slate-400 font-mono">Real-time category breakdown as audience rates</p>
            </div>
            <div className="text-right">
              <span className="text-xs text-slate-400 font-mono">Cumulative Average</span>
              <div className="text-2xl font-black font-mono text-amber-400">
                {getAvg('total')} <span className="text-sm font-normal text-slate-400">/ 100</span>
              </div>
            </div>
          </div>

          {/* Rising Vertical Bars for the 6 Attributes */}
          <div className="flex-1 flex justify-between items-end gap-5 pt-8 pb-3 px-4">
            {CRITERIA.map((criterion) => {
              const currentScore = getAvg(criterion.key);
              const heightPercent = Math.max((currentScore / criterion.max) * 100, 6);

              return (
                <div key={criterion.key} className="flex-1 flex flex-col items-center h-full justify-end group">
                  
                  {/* Floating Live Score */}
                  <div className="mb-2 text-center">
                    <div className={`font-mono font-black text-xl lg:text-2xl tracking-tight ${criterion.color}`}>
                      {currentScore}
                    </div>
                    <span className="text-[10px] font-mono text-slate-400 uppercase font-bold">
                      /{criterion.max} pts
                    </span>
                  </div>

                  {/* Vertical Pillar */}
                  <div className="w-full max-w-[65px] bg-slate-900/90 rounded-2xl p-1 flex flex-col justify-end h-[340px] border border-slate-700/60 shadow-inner">
                    <div
                      className={`w-full rounded-xl transition-all duration-700 bg-gradient-to-t ${criterion.gradient} shadow-lg`}
                      style={{ height: `${heightPercent}%` }}
                    />
                  </div>

                  {/* Malayalam & English Criterion Label */}
                  <div className="mt-3 text-center w-full">
                    <div className="text-xs lg:text-sm font-black text-amber-300 truncate">
                      {criterion.labelMl}
                    </div>
                    <div className="text-[10px] font-medium text-slate-300 truncate">
                      {criterion.label}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Quick Guidance Tag */}
          <div className="border-t border-slate-800/80 pt-2 flex justify-between text-[11px] font-mono text-slate-500">
            <span>Scores update dynamically as audience submits rating</span>
            <span>Scale: Outfit (25) • Essence (20) • Walk (20) • Chem (20) • Impact (15)</span>
          </div>
        </div>

      </div>

      {/* Broadcast Footer */}
      <footer className="flex-none flex justify-between items-center text-xs text-slate-500 font-mono pt-2 border-t border-slate-800/40">
        <span>Bedford Marston Kerala Association • Official Live Contestant Arena</span>
        <span>Press <strong>F11</strong> for Stage Fullscreen Mode</span>
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
