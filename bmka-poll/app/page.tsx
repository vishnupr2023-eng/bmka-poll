'use client';
import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { supabase } from '../lib/supabase';

interface Couple {
  id: string;
  name: string;
}

export default function Home() {
  const [couples, setCouples] = useState<Couple[]>([]);
  const [selectedCouple, setSelectedCouple] = useState<string>('');
  const [ratings, setRatings] = useState({
    outfit: 0,
    essence: 0,
    walk: 0,
    chemistry: 0,
    confidence: 0
  });
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [submitted, setSubmitted] = useState<boolean>(false);

  useEffect(() => {
    async function loadCouples() {
      const { data } = await supabase.from('couples').select('id, name').order('name', { ascending: true });
      if (data) setCouples(data);
    }
    loadCouples();
  }, []);

  const handleRatingChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setRatings({
      ...ratings,
      [e.target.name]: parseInt(e.target.value) || 0
    });
  };

  const totalScore = ratings.outfit + ratings.essence + ratings.walk + ratings.chemistry + ratings.confidence;

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selectedCouple) {
      alert('Please select a couple to rate.');
      return;
    }

    setSubmitting(true);
    const { error } = await supabase.from('votes').insert([
      {
        couple_id: selectedCouple,
        outfit: ratings.outfit,
        essence: ratings.essence,
        walk: ratings.walk,
        chemistry: ratings.chemistry,
        confidence: ratings.confidence,
        total: totalScore
      }
    ]);
    setSubmitting(false);

    if (error) {
      alert('Error submitting vote: ' + error.message);
      return;
    }

    setSubmitted(true);
  };

  if (submitted) {
    return (
      <main className="min-h-screen bg-orange-50 flex items-center justify-center p-4">
        <div className="bg-white p-8 rounded-2xl shadow-xl text-center max-w-md w-full border border-orange-100">
          <h2 className="text-2xl font-bold text-green-700 mb-2">നന്ദി! / Thank You!</h2>
          <p className="text-gray-700">Your score for BMKA Kerala Thanima 2026 has been successfully recorded.</p>
          <button 
            onClick={() => {
              setSubmitted(false);
              setSelectedCouple('');
              setRatings({ outfit: 0, essence: 0, walk: 0, chemistry: 0, confidence: 0 });
            }}
            className="mt-6 bg-orange-600 text-white px-6 py-2.5 rounded-full font-bold hover:bg-orange-700 transition shadow"
          >
            Vote for Another Couple
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-orange-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-xl mx-auto bg-white rounded-2xl shadow-xl overflow-hidden border border-orange-200">
        
        <div className="bg-gradient-to-r from-orange-600 via-amber-600 to-red-700 px-6 py-6 text-center text-white">
          <div className="flex justify-between items-center text-xs uppercase tracking-wider mb-2 opacity-90">
            <span>BMKA Ponnonam 2026</span>
            <Link href="/admin" className="underline hover:text-orange-200">Admin</Link>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold mb-1">കേരള തനിമ</h1>
          <h2 className="text-lg font-semibold">താരദമ്പതികൾ 2026 - Audience Poll</h2>
          <p className="text-xs opacity-90 mt-1">A Celebration of Kerala Culture, Style & Togetherness</p>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          <div>
            <label className="block text-sm font-bold text-gray-800 mb-2">Select Couple / മത്സരാർത്ഥികൾ</label>
            <select 
              value={selectedCouple} 
              onChange={(e) => setSelectedCouple(e.target.value)}
              className="w-full border border-gray-300 p-3 rounded-xl focus:ring-2 focus:ring-orange-500 text-gray-900 bg-white"
              required
            >
              <option value="">-- Choose Couple --</option>
              {couples.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          <div className="space-y-5 bg-orange-50/60 p-4 rounded-xl border border-orange-100">
            <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider">Judgement Criteria</h3>
            
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs font-semibold text-gray-700">
                <span>വേഷവിധാനം (Outfit & Presentation)</span>
                <span className="text-orange-700 font-bold">{ratings.outfit} / 25</span>
              </div>
              <input type="range" name="outfit" min="0" max="25" value={ratings.outfit} onChange={handleRatingChange} className="w-full accent-orange-600" />
            </div>

            <div className="space-y-1.5">
              <div className="flex justify-between text-xs font-semibold text-gray-700">
                <span>കേരളത്തനിമ (Kerala Ethnic Essence)</span>
                <span className="text-orange-700 font-bold">{ratings.essence} / 20</span>
              </div>
              <input type="range" name="essence" min="0" max="20" value={ratings.essence} onChange={handleRatingChange} className="w-full accent-orange-600" />
            </div>

            <div className="space-y-1.5">
              <div className="flex justify-between text-xs font-semibold text-gray-700">
                <span>വേദിയിലെ നടനവും (Walk & Stage Presence)</span>
                <span className="text-orange-700 font-bold">{ratings.walk} / 20</span>
              </div>
              <input type="range" name="walk" min="0" max="20" value={ratings.walk} onChange={handleRatingChange} className="w-full accent-orange-600" />
            </div>

            <div className="space-y-1.5">
              <div className="flex justify-between text-xs font-semibold text-gray-700">
                <span>ഒരുമയും പൊരുത്തവും (Togetherness & Chemistry)</span>
                <span className="text-orange-700 font-bold">{ratings.chemistry} / 20</span>
              </div>
              <input type="range" name="chemistry" min="0" max="20" value={ratings.chemistry} onChange={handleRatingChange} className="w-full accent-orange-600" />
            </div>

            <div className="space-y-1.5">
              <div className="flex justify-between text-xs font-semibold text-gray-700">
                <span>ആത്മവിശ്വാസവും പ്രകടനവും (Confidence & Impact)</span>
                <span className="text-orange-700 font-bold">{ratings.confidence} / 15</span>
              </div>
              <input type="range" name="confidence" min="0" max="15" value={ratings.confidence} onChange={handleRatingChange} className="w-full accent-orange-600" />
            </div>
          </div>

          <div className="bg-amber-100/80 p-4 rounded-xl flex justify-between items-center text-base font-bold text-amber-950 border border-amber-200">
            <span>Total Score / ആകെ സ്കോർ:</span>
            <span className="text-xl text-orange-700">{totalScore} / 100</span>
          </div>

          <button 
            type="submit" 
            disabled={submitting}
            className="w-full bg-emerald-700 hover:bg-emerald-800 text-white font-bold py-3.5 rounded-xl shadow transition duration-200 disabled:opacity-50"
          >
            {submitting ? 'Submitting...' : 'Submit Rating / രേഖപ്പെടുത്തുക'}
          </button>
        </form>
      </div>
    </main>
  );
}
