'use client';
import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

interface LiveSession {
  current_couple_id: string | null;
  timer_duration: number;
  started_at: string | null;
  status: 'idle' | 'voting' | 'completed';
}

function getDistanceMeters(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371e3;
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;
  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export default function Home() {
  const [voterToken, setVoterToken] = useState<string>('');
  const [session, setSession] = useState<LiveSession>({
    current_couple_id: null,
    timer_duration: 60,
    started_at: null,
    status: 'idle'
  });
  const [currentCoupleName, setCurrentCoupleName] = useState<string>('');
  const [hasVotedCurrent, setHasVotedCurrent] = useState<boolean>(false);
  const [myVoteRecord, setMyVoteRecord] = useState<any>(null);

  const [ratings, setRatings] = useState({
    outfit: 18,
    essence: 14,
    walk: 14,
    chemistry: 14,
    confidence: 10
  });

  const [submitting, setSubmitting] = useState<boolean>(false);
  const [statusFeedback, setStatusFeedback] = useState<string>('');
  const [geoBlocked, setGeoBlocked] = useState<boolean>(false);
  const [geoChecking, setGeoChecking] = useState<boolean>(true);
  const [timeLeft, setTimeLeft] = useState<number>(60);

  // Initialize voter identity
  useEffect(() => {
    let token = localStorage.getItem('bmka_voter_token');
    if (!token) {
      token = 'voter_' + Math.random().toString(36).substring(2, 11) + '_' + Date.now();
      localStorage.setItem('bmka_voter_token', token);
    }
    setVoterToken(token);
  }, []);

  // Send presence heartbeat
  useEffect(() => {
    if (!voterToken) return;
    const heartbeat = async () => {
      await supabase.from('active_sessions').upsert([
        { session_id: voterToken, last_seen: new Date().toISOString() }
      ]);
    };
    heartbeat();
    const interval = setInterval(heartbeat, 15000);
    return () => clearInterval(interval);
  }, [voterToken]);

  // Geo check
  useEffect(() => {
    async function verifyLocation() {
      setGeoChecking(true);
      const { data } = await supabase.from('app_settings').select('value').eq('key', 'geo_fence').single();
      const geoConfig = data?.value;

      if (!geoConfig || !geoConfig.enabled) {
        setGeoBlocked(false);
        setGeoChecking(false);
        return;
      }

      if (!navigator.geolocation) {
        setGeoBlocked(true);
        setGeoChecking(false);
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const dist = getDistanceMeters(pos.coords.latitude, pos.coords.longitude, geoConfig.lat, geoConfig.lng);
          setGeoBlocked(dist > geoConfig.radius_meters);
          setGeoChecking(false);
        },
        () => {
          setGeoBlocked(true);
          setGeoChecking(false);
        },
        { enableHighAccuracy: true, timeout: 10000 }
      );
    }
    verifyLocation();
  }, []);

  // Poll current live session every 2 seconds
  const fetchSession = async () => {
    const { data } = await supabase
      .from('app_settings')
      .select('value')
      .eq('key', 'live_contestant_session')
      .single();

    if (data?.value) {
      const live: LiveSession = data.value;
      setSession(live);

      if (live.current_couple_id) {
        const { data: cData } = await supabase
          .from('couples')
          .select('name')
          .eq('id', live.current_couple_id)
          .single();
        if (cData) setCurrentCoupleName(cData.name);

        // Check if this voter already voted for this couple
        if (voterToken) {
          const { data: vData } = await supabase
            .from('votes')
            .select('*')
            .eq('couple_id', live.current_couple_id)
            .eq('voter_token', voterToken)
            .maybeSingle();

          if (vData) {
            setHasVotedCurrent(true);
            setMyVoteRecord(vData);
            setRatings({
              outfit: vData.outfit,
              essence: vData.essence,
              walk: vData.walk,
              chemistry: vData.chemistry,
              confidence: vData.confidence
            });
          } else {
            setHasVotedCurrent(false);
            setMyVoteRecord(null);
          }
        }
      }
    }
  };

  useEffect(() => {
    if (voterToken) {
      fetchSession();
      const interval = setInterval(fetchSession, 2000);
      return () => clearInterval(interval);
    }
  }, [voterToken]);

  // Sync remaining seconds on phone
  useEffect(() => {
    if (session.status !== 'voting' || !session.started_at) {
      setTimeLeft(0);
      return;
    }
    const timer = setInterval(() => {
      const elapsed = Math.floor((Date.now() - new Date(session.started_at!).getTime()) / 1000);
      const rem = Math.max(session.timer_duration - elapsed, 0);
      setTimeLeft(rem);
    }, 500);
    return () => clearInterval(timer);
  }, [session]);

  const handleRatingChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setRatings({
      ...ratings,
      [e.target.name]: parseInt(e.target.value) || 0
    });
  };

  const totalScore = ratings.outfit + ratings.essence + ratings.walk + ratings.chemistry + ratings.confidence;
  const isVotingOpen = session.status === 'voting' && timeLeft > 0 && !hasVotedCurrent;

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!session.current_couple_id || !isVotingOpen) return;

    setSubmitting(true);
    const votePayload = {
      voter_token: voterToken,
      couple_id: session.current_couple_id,
      outfit: ratings.outfit,
      essence: ratings.essence,
      walk: ratings.walk,
      chemistry: ratings.chemistry,
      confidence: ratings.confidence,
      total: totalScore
    };

    const { error } = await supabase.from('votes').insert([votePayload]);
    setSubmitting(false);

    if (error) {
      alert('Failed to submit vote: ' + error.message);
      return;
    }

    setHasVotedCurrent(true);
    setMyVoteRecord(votePayload);
    setStatusFeedback('✓ Vote submitted and permanently locked!');
  };

  if (geoChecking) {
    return (
      <main className="min-h-screen bg-slate-900 flex items-center justify-center p-4 text-white text-center font-sans">
        <div className="space-y-3">
          <div className="animate-spin text-3xl">📍</div>
          <p className="text-sm font-mono text-slate-300">Checking venue location...</p>
        </div>
      </main>
    );
  }

  if (geoBlocked) {
    return (
      <main className="min-h-screen bg-slate-950 flex items-center justify-center p-6 text-white text-center font-sans">
        <div className="max-w-md w-full bg-slate-900 p-8 rounded-3xl border border-red-800/60 shadow-2xl space-y-4">
          <div className="text-4xl">📍🚫</div>
          <h2 className="text-xl font-bold text-red-400">Restricted to Event Venue</h2>
          <p className="text-xs text-slate-300">
            Voting for <strong>BMKA Kerala Thanima 2026</strong> is only accessible inside the hall.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-orange-50/50 py-6 px-3 sm:px-6 lg:px-8 font-sans">
      <div className="max-w-xl mx-auto space-y-4">
        
        {/* Header Banner */}
        <header className="bg-gradient-to-r from-orange-600 via-amber-600 to-red-700 rounded-2xl shadow-lg p-5 text-white text-center">
          <div className="text-[10px] uppercase tracking-wider mb-1 opacity-90 font-mono">
            BMKA PONNONAM 2026
          </div>
          <h1 className="text-2xl sm:text-3xl font-black">കേരള തനിമ 2026</h1>
          <p className="text-xs opacity-90 mt-1">Live Audience Voting Portal</p>
        </header>

        {/* Current Contestant On Stage Card */}
        <div className="bg-white rounded-2xl p-5 shadow-md border-2 border-orange-200 text-center space-y-2">
          <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-orange-600 bg-orange-100 px-3 py-1 rounded-full">
            Contestant On Stage
          </span>
          <h2 className="text-2xl font-black text-gray-900">
            {currentCoupleName || 'Waiting for next contestant...'}
          </h2>

          {/* Voting Window Countdown Tag */}
          <div className="pt-2">
            {session.status === 'voting' && timeLeft > 0 ? (
              <div className="inline-flex items-center gap-2 bg-amber-100 border border-amber-300 px-4 py-1.5 rounded-full text-amber-900 font-mono text-xs font-black animate-pulse">
                <span>⏱ Voting Ends in: <strong>{timeLeft}s</strong></span>
              </div>
            ) : hasVotedCurrent ? (
              <div className="inline-block bg-slate-100 border border-slate-300 px-4 py-1.5 rounded-full text-slate-700 font-mono text-xs font-bold">
                🔒 Vote Submitted ({myVoteRecord?.total} pts)
              </div>
            ) : (
              <div className="inline-block bg-red-100 border border-red-300 px-4 py-1.5 rounded-full text-red-800 font-mono text-xs font-bold">
                ⛔ Voting is Currently Closed
              </div>
            )}
          </div>
        </div>

        {/* Scoring Form (Only enabled when voting is open) */}
        <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-md p-5 border border-orange-100 space-y-5">
          {statusFeedback && (
            <div className="p-3 bg-emerald-100 border border-emerald-300 text-emerald-900 rounded-xl text-xs font-bold text-center">
              {statusFeedback}
            </div>
          )}

          <div className={`space-y-4 bg-orange-50/40 p-3.5 rounded-xl border border-orange-100 ${!isVotingOpen ? 'opacity-50 pointer-events-none' : ''}`}>
            {/* 1. Outfit */}
            <div className="space-y-1">
              <div className="flex justify-between text-xs font-bold text-gray-800">
                <span>വേഷവിധാനം (Outfit & Presentation)</span>
                <span className="text-orange-600 font-mono">{ratings.outfit} / 25</span>
              </div>
              <input
                type="range"
                name="outfit"
                min="0"
                max="25"
                disabled={!isVotingOpen}
                value={ratings.outfit}
                onChange={handleRatingChange}
                className="w-full accent-orange-600 h-2 bg-gray-200 rounded-lg cursor-pointer"
              />
            </div>

            {/* 2. Ethnic Essence */}
            <div className="space-y-1">
              <div className="flex justify-between text-xs font-bold text-gray-800">
                <span>കേരളത്തനിമ (Kerala Ethnic Essence)</span>
                <span className="text-orange-600 font-mono">{ratings.essence} / 20</span>
              </div>
              <input
                type="range"
                name="essence"
                min="0"
                max="20"
                disabled={!isVotingOpen}
                value={ratings.essence}
                onChange={handleRatingChange}
                className="w-full accent-orange-600 h-2 bg-gray-200 rounded-lg cursor-pointer"
              />
            </div>

            {/* 3. Walk */}
            <div className="space-y-1">
              <div className="flex justify-between text-xs font-bold text-gray-800">
                <span>വേദിയിലെ നടനവും (Walk & Stage Presence)</span>
                <span className="text-orange-600 font-mono">{ratings.walk} / 20</span>
              </div>
              <input
                type="range"
                name="walk"
                min="0"
                max="20"
                disabled={!isVotingOpen}
                value={ratings.walk}
                onChange={handleRatingChange}
                className="w-full accent-orange-600 h-2 bg-gray-200 rounded-lg cursor-pointer"
              />
            </div>

            {/* 4. Chemistry */}
            <div className="space-y-1">
              <div className="flex justify-between text-xs font-bold text-gray-800">
                <span>ഒരുമയും പൊരുത്തവും (Togetherness & Chemistry)</span>
                <span className="text-orange-600 font-mono">{ratings.chemistry} / 20</span>
              </div>
              <input
                type="range"
                name="chemistry"
                min="0"
                max="20"
                disabled={!isVotingOpen}
                value={ratings.chemistry}
                onChange={handleRatingChange}
                className="w-full accent-orange-600 h-2 bg-gray-200 rounded-lg cursor-pointer"
              />
            </div>

            {/* 5. Confidence */}
            <div className="space-y-1">
              <div className="flex justify-between text-xs font-bold text-gray-800">
                <span>ആത്മവിശ്വാസവും പ്രകടനവും (Confidence & Impact)</span>
                <span className="text-orange-600 font-mono">{ratings.confidence} / 15</span>
              </div>
              <input
                type="range"
                name="confidence"
                min="0"
                max="15"
                disabled={!isVotingOpen}
                value={ratings.confidence}
                onChange={handleRatingChange}
                className="w-full accent-orange-600 h-2 bg-gray-200 rounded-lg cursor-pointer"
              />
            </div>
          </div>

          <div className="bg-amber-100/70 p-3.5 rounded-xl flex justify-between items-center text-sm font-bold text-amber-950 border border-amber-200">
            <span>Total Score / ആകെ സ്കോർ:</span>
            <span className="text-xl text-orange-700 font-mono">{totalScore} / 100</span>
          </div>

          {hasVotedCurrent ? (
            <div className="w-full bg-slate-100 text-slate-500 font-bold py-3.5 rounded-xl text-center border border-slate-200 text-xs font-mono">
              🔒 You have already voted for {currentCoupleName}
            </div>
          ) : session.status !== 'voting' || timeLeft <= 0 ? (
            <div className="w-full bg-slate-100 text-slate-400 font-bold py-3.5 rounded-xl text-center border border-slate-200 text-xs font-mono">
              ⛔ Voting is closed for this contestant
            </div>
          ) : (
            <button
              type="submit"
              disabled={submitting}
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-black py-3.5 rounded-xl shadow-md transition text-sm tracking-wide"
            >
              {submitting ? 'Submitting...' : 'Submit & Lock Vote / സമർപ്പിക്കുക'}
            </button>
          )}
        </form>

        <footer className="text-center text-[11px] text-gray-500 font-mono pt-2">
          Bedford Marston Kerala Association • Kerala Thanima 2026
        </footer>
      </div>
    </main>
  );
}
