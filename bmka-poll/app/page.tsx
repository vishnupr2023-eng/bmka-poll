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

export default function Home() {
  const [couples, setCouples] = useState<Couple[]>([]);
  const [voterToken, setVoterToken] = useState<string>('');
  const [myVotes, setMyVotes] = useState<Record<string, SubmittedVote>>({});
  const [selectedCoupleId, setSelectedCoupleId] = useState<string>('');
  
  const [ratings, setRatings] = useState({
    outfit: 15,
    essence: 12,
    walk: 12,
    chemistry: 12,
    confidence: 10
  });

  const [submitting, setSubmitting] = useState<boolean>(false);
  const [statusFeedback, setStatusFeedback] = useState<string>('');

  // 1. Initialize persistent device token
  useEffect(() => {
    let token = localStorage.getItem('bmka_voter_token');
    if (!token) {
      token = 'voter_' + Math.random().toString(36).substring(2, 11) + '_' + Date.now();
      localStorage.setItem('bmka_voter_token', token);
    }
    setVoterToken(token);
  }, []);

  // 2. Fetch all registered couples and existing votes submitted by this voter
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

  // When a spectator selects a couple, prefill with their previous score if they already rated them
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
      // Default initial score values for a new rating
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
  const isAlreadyRated = Boolean(selectedCoupleId && myVotes[selectedCoupleId]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selectedCoupleId) {
      alert('Please select a contestant to rate.');
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

    const { error } = await supabase
      .from('votes')
      .upsert([votePayload], { onConflict: 'voter_token,couple_id' });

    setSubmitting(false);

    if (error) {
      alert('Failed to record score: ' + error.message);
      return;
    }

    // Save to local voter state
    setMyVotes((prev) => ({
      ...prev,
      [selectedCoupleId]: votePayload
    }));

    setStatusFeedback(`✓ Score recorded for ${currentCouple?.name || 'contestant'}!`);

    // Auto-advance to the next unrated contestant if available
    const unrated = couples.find((c) => c.id !== selectedCoupleId && !myVotes[c.id]);
    if (unrated) {
      setTimeout(() => {
        setSelectedCoupleId(unrated.id);
        setStatusFeedback('');
      }, 1400);
    }
  };

  const ratedCount = Object.keys(myVotes).length;

  return (
    <main className="min-h-screen bg-orange-50/50 py-6 px-3 sm:px-6 lg:px-8 font-sans">
      <div className="max-w-xl mx-auto space-y-4">
        
        {/* Header Banner */}
        <header className="bg-gradient-to-r from-orange-600 via-amber-600 to-red-700 rounded-2xl shadow-lg p-5 text-white text-center">
          <div className="flex justify-between items-center text-[10px] uppercase tracking-wider mb-2 opacity-90 font-mono">
            <span>BMKA Ponnonam 2026</span>
            <span className="bg-black/20 px-2 py-0.5 rounded-full">
              Rated: {ratedCount} / {couples.length}
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black">കേരള തനിമ</h1>
          <h2 className="text-base font-bold opacity-95">താരദമ്പതികൾ 2026 • Live Audience Voting</h2>
          <p className="text-xs opacity-85 mt-1">
            Rate each couple as they take the stage
          </p>
        </header>

        {/* Contestant Selector Grid */}
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-orange-100">
          <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">
            Select Contestant on Stage ({ratedCount}/{couples.length} Completed):
          </label>
          
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-48 overflow-y-auto pr-1">
            {couples.map((c, idx) => {
              const rated = Boolean(myVotes[c.id]);
              const isSelected = selectedCoupleId === c.id;

              return (
                <button
                  type="button"
                  key={c.id}
                  onClick={() => setSelectedCoupleId(c.id)}
                  className={`flex flex-col text-left p-2.5 rounded-xl border text-xs transition-all ${
                    isSelected
                      ? 'border-orange-500 bg-orange-500/10 ring-2 ring-orange-500 shadow-sm'
                      : rated
                      ? 'border-emerald-300 bg-emerald-50/60 text-gray-800'
                      : 'border-gray-200 bg-gray-50 hover:bg-white text-gray-700'
                  }`}
                >
                  <div className="flex justify-between items-center w-full">
                    <span className="font-mono text-[10px] text-gray-500 font-bold">
                      #{idx + 1}
                    </span>
                    {rated && (
                      <span className="text-[9px] px-1.5 py-0.2 rounded bg-emerald-600 text-white font-bold">
                        ✓ {myVotes[c.id].total} pts
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
                Currently Rating
              </span>
              <h3 className="text-lg font-black text-gray-900">
                {currentCouple ? currentCouple.name : 'Select Contestant'}
              </h3>
            </div>
            {isAlreadyRated && (
              <span className="text-xs px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 font-semibold border border-emerald-200">
                Update Vote
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
          <div className="space-y-4 bg-orange-50/40 p-3.5 rounded-xl border border-orange-100">
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
                value={ratings.confidence}
                onChange={handleRatingChange}
                className="w-full accent-orange-600 h-2 bg-gray-200 rounded-lg cursor-pointer"
              />
            </div>
          </div>

          {/* Total Score Display */}
          <div className="bg-amber-100/70 p-3.5 rounded-xl flex justify-between items-center text-sm font-bold text-amber-950 border border-amber-200">
            <span>Total Score / ആകെ സ്കോർ:</span>
            <span className="text-xl text-orange-700 font-mono">{totalScore} / 100</span>
          </div>

          {/* Submit / Next Button */}
          <button
            type="submit"
            disabled={submitting || !selectedCoupleId}
            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-black py-3.5 rounded-xl shadow-md transition disabled:opacity-50 text-sm tracking-wide"
          >
            {submitting
              ? 'Recording Score...'
              : isAlreadyRated
              ? 'Update Score / സ്കോർ പുതുക്കുക'
              : 'Submit Score & Rate Next / സമർപ്പിക്കുക'}
          </button>
        </form>

        {/* Footer */}
        <footer className="text-center text-[11px] text-gray-500 font-mono pt-2">
          Bedford Marston Kerala Association • Kerala Thanima 2026
        </footer>
      </div>
    </main>
  );
}
