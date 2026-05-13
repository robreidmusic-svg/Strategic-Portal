import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { cn } from '../lib/utils';
import { LogIn, UserPlus, Loader2, Shield, ArrowRight, RefreshCw } from 'lucide-react';
import { motion } from 'framer-motion';
import { reconnectFirestore } from '../firebase';

export function Login() {
  const { login } = useApp();
  const [isNewUser, setIsNewUser] = useState(false);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleReconnect = async () => {
    setIsResetting(true);
    await reconnectFirestore();
    setTimeout(() => {
      setIsResetting(false);
      setError(null);
    }, 1000);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await login(firstName, lastName, password, isNewUser);
    } catch (err: any) {
      setError(err.message || 'An error occurred during authentication.');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F9FAFB] flex items-center justify-center p-6 font-sans">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="max-w-md w-full bg-white rounded-[40px] shadow-2xl p-10 border border-white panel-3d"
      >
        <div className="flex items-center gap-4 mb-10">
          <div className="w-16 h-16 bg-[#282828] rounded-[24px] flex items-center justify-center shadow-lg transform -rotate-3">
            <Shield className="text-[#F29023]" size={32} />
          </div>
          <div>
            <h1 className="text-2xl font-bold uppercase tracking-tight text-[#111827] leading-none">Strategic Portal</h1>
            <p className="text-[11px] text-[#6B7280] font-bold uppercase tracking-[0.2em] mt-2">Personnel Authentication</p>
          </div>
        </div>

        <div className="flex glass-3d p-1.5 rounded-full mb-8">
          <button
            onClick={() => { setIsNewUser(false); setError(null); }}
            className={cn(
              "flex-1 py-3.5 text-[11px] font-bold uppercase tracking-widest transition-all rounded-full",
              !isNewUser 
                ? "btn-3d bg-white text-[#282828]" 
                : "text-[#6B7280] hover:text-[#282828] hover:bg-white/50"
            )}
          >
            Sign In
          </button>
          <button
            onClick={() => { setIsNewUser(true); setError(null); }}
            className={cn(
              "flex-1 py-3.5 text-[11px] font-bold uppercase tracking-widest transition-all rounded-full",
              isNewUser 
                ? "btn-3d bg-white text-[#282828]" 
                : "text-[#6B7280] hover:text-[#282828] hover:bg-white/50"
            )}
          >
            Onboarding
          </button>
        </div>

        <div className="bg-[#E0E5FF] px-5 py-2 rounded-full border border-[#8B5CF6]/10 mb-8 inline-block">
          <p className="text-[9px] text-[#8B5CF6] uppercase tracking-widest font-bold">
            Whitelist Security Check Active
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-8">
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-[11px] uppercase font-bold tracking-widest text-[#6B7280] ml-1">First Name</label>
                <input
                  type="text"
                  required
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="Rob"
                  className="w-full bg-gray-50/50 border border-gray-100 focus:border-[#8B5CF6]/30 focus:bg-white rounded-2xl p-4 text-[15px] font-bold focus:outline-none transition-all placeholder:text-gray-300 shadow-inner"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[11px] uppercase font-bold tracking-widest text-[#6B7280] ml-1">Last Name</label>
                <input
                  type="text"
                  required
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder="Reid"
                  className="w-full bg-gray-50/50 border border-gray-100 focus:border-[#8B5CF6]/30 focus:bg-white rounded-2xl p-4 text-[15px] font-bold focus:outline-none transition-all placeholder:text-gray-300 shadow-inner"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[11px] uppercase font-bold tracking-widest text-[#6B7280] ml-1">
                {isNewUser ? 'Create Secure Code (6+ chars)' : 'Access Code'}
              </label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••"
                className="w-full bg-gray-50/50 border border-gray-100 focus:border-[#8B5CF6]/30 focus:bg-white rounded-2xl p-4 text-[15px] font-bold focus:outline-none transition-all shadow-inner"
              />
            </div>
          </div>

          {error && (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-rose-50 border border-rose-100 p-6 rounded-[24px] relative overflow-hidden"
            >
              <div className="flex items-start gap-4">
                <div className="w-8 h-8 bg-rose-600 rounded-full flex-shrink-0 flex items-center justify-center mt-0.5 shadow-lg shadow-rose-200">
                  <span className="text-white font-bold text-sm">!</span>
                </div>
                <div className="flex-1">
                  <h3 className="text-[10px] font-bold uppercase tracking-widest text-rose-600 mb-1">Access Refused</h3>
                  <p className="text-[12px] text-rose-900 uppercase font-bold leading-relaxed">{error}</p>
                  {error.includes('auth/') && (
                    <div className="mt-4 pt-3 border-t border-rose-200/30 space-y-3">
                      {error.includes('network-request-failed') && (
                        <button
                          type="button"
                          onClick={handleReconnect}
                          disabled={isResetting}
                          className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-rose-600 hover:text-rose-800 transition-colors"
                        >
                          <RefreshCw size={12} className={cn(isResetting && "animate-spin")} />
                          {isResetting ? "Resetting Core..." : "Reset Cloud Connection"}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="btn-3d w-full bg-[#282828] hover:bg-[#8B5CF6] text-white font-bold py-5 rounded-full flex items-center justify-center gap-4 transition-all uppercase tracking-[0.2em] text-[11px] disabled:opacity-50"
          >
            {loading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <>
                {isNewUser ? 'Initialize Protocol' : 'Enter Portal'}
                <ArrowRight size={18} />
              </>
            )}
          </button>
        </form>

        <div className="mt-12 pt-8 border-t border-gray-50">
          <p className="text-[10px] text-[#6B7280] leading-relaxed uppercase tracking-widest text-center opacity-40">
            Secure Access Terminal // Strategic Team <br/>
            zayo europe // Authorized Only
          </p>
        </div>
      </motion.div>
    </div>
  );
}
