'use client';
import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { supabase } from '../lib/supabase';

interface Couple {
  id: string;
  name: string;
}

interface SubmittedVote {
  couple_id: string;
  outfit: number;
  essence: number;
  walk: number;
  chemistry: number;
  confidence: number;
  total: number;
}

// Haversine distance formula in meters
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
  const [couples, setCouples] = useState<Couple[]>([]);
  const [voterToken, setVoterToken] = useState<string>('');
  const [myVotes, setMyVotes] = useState<Record<string, SubmittedVote>>({});
  const [selectedCoupleId, setSelectedCoupleId] = useState<string>('');
  
  const [ratings, setRatings] = useState({
    outfit: 18,
    essence: 14,
    walk: 14,
    chemistry: 14,
    confidence: 10
  });

  const [submitting, setSubmitting] = useState<boolean>(false);
  const [statusFeedback, setStatusFeedback] = useState<string>('');

  // Geo-fence status
  const [geoBlocked, setGeoBlocked] = useState<boolean>(false);
  const [geoChecking, setGeoChecking] = useState<boolean>(true);
  const [geoDistance, setGeoDistance] = useState<number | null>(null);

  // 1. Initialize persistent device voter ID
  useEffect(() => {
    let token = localStorage.getItem('bmka_voter_token');
    if (!token) {
      token = 'voter_' + Math.random().toString(36).substring(2, 11) + '_' + Date.now();
      localStorage.setItem('bmka_voter_token', token);
    }
    setVoterToken(token);
  }, []);

  // 2. Real-time active presence heartbeat (every 15s)
  useEffect(() => {
    if (!voterToken) return;
    const sendHeartbeat = async () => {
      await supabase.from('active_sessions').upsert([
        { session_id: voterToken, last_seen: new Date().toISOString() }
      ]);
    };
    sendHeartbeat();
    const interval = setInterval(sendHeartbeat, 15000);
    return () => clearInterval(interval);
  }, [voterToken]);

  // 3. Check Geo-Fence Permissions
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
        (position) => {
          const dist = getDistanceMeters(
            position.coords.latitude,
            position.coords.longitude,
            geoConfig.lat,
            geoConfig.lng
          );
          setGeoDistance(Math.round(dist));
          if (dist > geoConfig.radius_meters) {
            setGeoBlocked(true);
          } else {
            setGeoBlocked(false);
          }
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

  // 4. Fetch Couples and Existing Votes
  const loadData = async (token: string) => {
    const { data: couplesData } = await supabase
      .from('couples')
      .select('id, name')
      .order('name', { ascending: true });

    if (couplesData && couplesData.length > 0) {
      setCouples(couplesData);
      if (!selectedCoupleId) {
        setSelectedCoupleId(couplesData[0].id);
      }
    }

    if (token) {
      const { data: existingVotes } = await supabase
        .from('votes')
        .select('*')
        .eq('voter_token', token);

      if (existingVotes) {
        const mapped: Record<string, SubmittedVote> = {};
        existingVotes.forEach((v: any) => {
          mapped[v.couple_id] = v;
        });
        setMyVotes(mapped);
      }
    }
  };

  useEffect(() => {
    if (voterToken) {
      loadData(voterToken);
    }
  }, [voterToken]);

  // Populate form based on selected couple
  useEffect(() => {
    if (selectedCoupleId && myVotes[selectedCoupleId]) {
      const prior = myVotes[selectedCoupleId];
      setRatings({
        outfit: prior.outfit,
        essence: prior.essence,
        walk: prior.walk,
        chemistry: prior.chemistry,
        confidence: prior.confidence
      });
    } else {
      setRatings({
        outfit: 18,
        essence: 14,
        walk: 14,
        chemistry: 14,
        confidence: 10
      });
    }
    setStatusFeedback('');
  }, [selectedCoupleId, myVotes]);

  const handleRatingChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setRatings({
      ...ratings,
      [e.target.name]: parseInt(e.target.value) || 0
    });
  };

  const totalScore = ratings.outfit + ratings.essence + ratings.walk + ratings.chemistry + ratings.confidence;
  const currentCouple = couples.find((c) => c.id === selectedCoupleId);
  const isAlreadyLocked = Boolean(selectedCoupleId && myVotes[selectedCoupleId]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selectedCoupleId) {
      alert('Please select a contestant to rate.');
      return;
    }

    if (isAlreadyLocked) {
      alert('Your vote for this couple has already been submitted and is locked.');
      return;
    }

    setSubmitting(true);
    setStatusFeedback('');

    const votePayload = {
      voter_token: voterToken,
      couple_id: selectedCoupleId,
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
      alert('Failed to record score: ' + error.message);
      return;
    }

    setMyVotes((prev) => ({
      ...prev,
      [selectedCoupleId]: votePayload
    }));

    setStatusFeedback(`✓ Vote permanently submitted & locked for ${currentCouple?.name || 'contestant'}!`);

    // Auto-advance to next unvoted contestant
    const unrated = couples.find((c) => c.id !== selectedCoupleId && !myVotes[c.id]);
    if (unrated) {
      setTimeout(() => {
        setSelectedCoupleId(unrated.id);
        setStatusFeedback('');
      }, 1500);
    }
  };

  const ratedCount = Object.keys(myVotes).length;

  // Geo-Lock Blocked View
  if (geoChecking) {
    return (
      <main className="min-h-screen bg-slate-900 flex items-center justify-center p-4 text-white text-center">
        <div className="space-y-3">
          <div className="animate-spin text-3xl">📍</div>
          <p className="text-sm font-mono text-slate-300">Verifying venue access location...</p>
        </div>
      </main>
    );
  }

  if (geoBlocked) {
    return (
      <main className="min-h-screen bg-slate-950 flex items-center justify-center p-6 text-white text-center">
        <div className="max-w-md w-full bg-slate-900 p-8 rounded-3xl border border-red-800/60 shadow-2xl space-y-4">
          <div className="text-4xl">📍🚫</div>
          <h2 className="text-xl font-bold text-red-400">Voting Geographically Restricted</h2>
          <p className="text-xs text-slate-300 leading-relaxed">
            Voting for <strong>BMKA Kerala Thanima 2026</strong> is strictly restricted to audience members inside the event hall.
          </p>
          {geoDistance !== null && (
            <p className="text-[11px] font-mono text-slate-400 bg-slate-800 p-2 rounded-lg">
              Current distance to venue: ~{(geoDistance / 1000).toFixed(2)} km
            </p>
          )}
          <p className="text-[11px] text-slate-500">
            Please make sure device location / GPS permissions are enabled in your mobile browser.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-xs font-bold rounded-xl border border-slate-700 transition"
          >
            Retry Location Check
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-orange-50/50 py-6 px-3 sm:px-6 lg:px-8 font-sans">
      <div className="max-w-xl mx-auto space-y-4">
        
        {/* Header Banner */}
        <header className="bg-gradient-to-r from-orange-600 via-amber-600 to-red-700 rounded-2xl shadow-lg p-5 text-white text-center">
          <div className="flex justify-between items-center text-[10px] uppercase tracking-wider mb-2 opacity-90 font-mono">
            <span>BMKA Ponnonam 2026</span>
            <span className="bg-black/20 px-2.5 py-0.5 rounded-full font-bold">
              Completed: {ratedCount} / {couples.length}
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black">കേരള തനിമ</h1>
          <h2 className="text-base font-bold opacity-95">താരദമ്പതികൾ 2026 • Audience Scoring</h2>
          <p className="text-xs opacity-85 mt-1">
            Rate each couple as they appear. Once submitted, your vote is locked.
          </p>
        </header>

        {/* Contestant Selection Grid */}
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-orange-100">
          <div className="flex justify-between items-center mb-2">
            <span className="text-xs font-bold text-gray-700 uppercase tracking-wider">
              Contestant Roster:
            </span>
            <span className="text-[10px] font-mono text-gray-500">
              {couples.length - ratedCount} remaining
            </span>
          </div>
          
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-48 overflow-y-auto pr-1">
            {couples.map((c, idx) => {
              const locked = Boolean(myVotes[c.id]);
              const isSelected = selectedCoupleId === c.id;

              return (
                <button
                  type="button"
                  key={c.id}
                  onClick={() => setSelectedCoupleId(c.id)}
                  className={`flex flex-col text-left p-2.5 rounded-xl border text-xs transition-all ${
                    isSelected
                      ? 'border-orange-500 bg-orange-500/10 ring-2 ring-orange-500 shadow-sm'
                      : locked
                      ? 'border-slate-200 bg-slate-100/90 text-slate-600'
                      : 'border-orange-200 bg-white hover:bg-orange-50/50 text-gray-800'
                  }`}
                >
                  <div className="flex justify-between items-center w-full">
                    <span className="font-mono text-[10px] text-gray-400 font-bold">
                      #{idx + 1}
                    </span>
                    {locked && (
                      <span className="text-[9px] px-1.5 py-0.2 rounded bg-slate-700 text-white font-bold">
                        🔒 {myVotes[c.id].total} pts
                      </span>
                    )}
                  </div>
                  <span className="font-bold truncate mt-1 text-gray-900">
                    {c.name}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Live Rating Form */}
        <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-md p-5 border border-orange-100 space-y-5">
          <div className="flex justify-between items-center border-b pb-3">
            <div>
              <span className="text-xs text-orange-600 font-bold uppercase tracking-wider block">
                Selected Contestant
              </span>
              <h3 className="text-lg font-black text-gray-900">
                {currentCouple ? currentCouple.name : 'Select Contestant'}
              </h3>
            </div>
            {isAlreadyLocked && (
              <span className="text-xs px-2.5 py-1 rounded-full bg-slate-200 text-slate-700 font-bold border border-slate-300 flex items-center gap-1">
                🔒 Vote Locked
              </span>
            )}
          </div>

          {/* Feedback message banner */}
          {statusFeedback && (
            <div className="p-3 bg-emerald-100 border border-emerald-300 text-emerald-900 rounded-xl text-xs font-bold text-center animate-pulse">
              {statusFeedback}
            </div>
          )}

          {/* 5 Criteria Sliders */}
          <div className={`space-y-4 bg-orange-50/40 p-3.5 rounded-xl border border-orange-100 ${isAlreadyLocked ? 'opacity-60 pointer-events-none' : ''}`}>
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
                disabled={isAlreadyLocked}
                value={ratings.outfit}
                onChange={handleRatingChange}
                className="w-full accent-orange-600 h-2 bg-gray-200 rounded-lg cursor-pointer disabled:cursor-not-allowed"
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
                disabled={isAlreadyLocked}
                value={ratings.essence}
                onChange={handleRatingChange}
                className="w-full accent-orange-600 h-2 bg-gray-200 rounded-lg cursor-pointer disabled:cursor-not-allowed"
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
                disabled={isAlreadyLocked}
                value={ratings.walk}
                onChange={handleRatingChange}
                className="w-full accent-orange-600 h-2 bg-gray-200 rounded-lg cursor-pointer disabled:cursor-not-allowed"
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
                disabled={isAlreadyLocked}
                value={ratings.chemistry}
                onChange={handleRatingChange}
                className="w-full accent-orange-600 h-2 bg-gray-200 rounded-lg cursor-pointer disabled:cursor-not-allowed"
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
                disabled={isAlreadyLocked}
                value={ratings.confidence}
                onChange={handleRatingChange}
                className="w-full accent-orange-600 h-2 bg-gray-200 rounded-lg cursor-pointer disabled:cursor-not-allowed"
              />
            </div>
          </div>

          {/* Total Score Display */}
          <div className="bg-amber-100/70 p-3.5 rounded-xl flex justify-between items-center text-sm font-bold text-amber-950 border border-amber-200">
            <span>Total Score / ആകെ സ്കോർ:</span>
            <span className="text-xl text-orange-700 font-mono">{totalScore} / 100</span>
          </div>

          {/* Submit / Locked Button */}
          {isAlreadyLocked ? (
            <div className="w-full bg-slate-100 text-slate-500 font-bold py-3.5 rounded-xl text-center border border-slate-200 text-xs font-mono">
              🔒 Score Locked for this contestant ({myVotes[selectedCoupleId].total} / 100)
            </div>
          ) : (
            <button
              type="submit"
              disabled={submitting || !selectedCoupleId}
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-black py-3.5 rounded-xl shadow-md transition disabled:opacity-50 text-sm tracking-wide"
            >
              {submitting ? 'Submitting & Locking...' : 'Submit & Lock Score / സമർപ്പിക്കുക'}
            </button>
          )}
        </form>

        {/* Footer */}
        <footer className="text-center text-[11px] text-gray-500 font-mono pt-2">
          Bedford Marston Kerala Association • Kerala Thanima 2026
        </footer>
      </div>
    </main>
  );
}
