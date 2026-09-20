import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Shield, ArrowRight, Lock, Mail, Zap, AlertCircle, Check, KeyRound } from 'lucide-react';
import { signInWithPopup } from 'firebase/auth';
import { auth, googleProvider } from '../firebase';
import { useAuth } from '../components/AuthContext';
import StarField from '../components/StarField';

export default function ManagerPortal() {
  const [error, setError] = useState('');
  const [infoNotice, setInfoNotice] = useState('');
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState('demo'); // 'demo' | 'email' | 'google'
  
  // Email / Password states
  const [email, setEmail] = useState('officer@pdr.ai');
  const [password, setPassword] = useState('pdr2025');
  const [showPassword, setShowPassword] = useState(false);

  const navigate = useNavigate();
  const { loginLocal } = useAuth();

  const handleInstantDemoLogin = (roleName = 'Senior Loan Officer') => {
    setError('');
    loginLocal({
      email: 'officer@pdr.ai',
      role: 'Loan Officer',
      name: `Rajesh Kumar (${roleName})`,
      photo: null,
    });
    navigate('/manager-dashboard');
  };

  const handleEmailLogin = (e) => {
    e.preventDefault();
    setError('');
    if (!email.trim() || !password.trim()) {
      setError('Please provide both email and password.');
      return;
    }

    setLoading(true);
    setTimeout(() => {
      // Allow officer demo credentials or any authorized loan officer email
      const cleanEmail = email.trim().toLowerCase();
      if ((cleanEmail === 'officer@pdr.ai' && password === 'pdr2025') || 
          cleanEmail.includes('officer') || 
          cleanEmail.includes('manager') || 
          cleanEmail.includes('analyst')) {
        loginLocal({
          email: cleanEmail,
          role: 'Loan Officer',
          name: cleanEmail.split('@')[0].toUpperCase(),
        });
        navigate('/manager-dashboard');
      } else {
        // Also check localStorage registered users
        const registered = JSON.parse(localStorage.getItem('pdr_registered_users') || '[]');
        const found = registered.find(u => u.email === cleanEmail && u.password === password);
        if (found) {
          loginLocal({
            email: found.email,
            role: found.role || 'Loan Officer',
            name: found.name || 'Loan Officer',
          });
          navigate('/manager-dashboard');
        } else {
          // Still permit login for demonstration purposes or show error
          if (password === 'pdr2025' || password === 'demo123') {
            loginLocal({
              email: cleanEmail,
              role: 'Loan Officer',
              name: cleanEmail.split('@')[0],
            });
            navigate('/manager-dashboard');
          } else {
            setError('Invalid credentials. Use officer@pdr.ai / pdr2025 or click Instant Access.');
          }
        }
      }
      setLoading(false);
    }, 400);
  };

  const handleGoogleLogin = async () => {
    try {
      setLoading(true);
      setError('');
      setInfoNotice('');

      const result = await signInWithPopup(auth, googleProvider);
      if (result.user) {
        loginLocal({
          email: result.user.email,
          role: 'Loan Officer',
          name: result.user.displayName || result.user.email,
          photo: result.user.photoURL,
        });
        navigate('/manager-dashboard');
      }
    } catch (err) {
      console.warn("Firebase Google login error:", err);
      const code = err?.code || '';

      if (code === 'auth/unauthorized-domain') {
        setError('Firebase domain restriction: This domain is not whitelisted in Firebase Console.');
        setInfoNotice('You can use Instant Demo Access or Email Login below to enter immediately.');
      } else if (code === 'auth/popup-blocked') {
        setError('Pop-up window was blocked by your browser.');
        setInfoNotice('Please enable pop-ups or continue with Instant Demo Access.');
      } else if (code === 'auth/popup-closed-by-user') {
        setError('Google sign-in popup was closed before completing.');
      } else {
        setError(err.message || 'Authentication failed. Please try again.');
        setInfoNotice('You can always use Instant Demo Access without third-party OAuth.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-4 overflow-hidden text-slate-900 dark:text-white transition-colors duration-200">
      <div className="dark:block hidden">
        <StarField />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="relative z-10 w-full max-w-lg p-6 sm:p-8 bg-white/95 dark:bg-slate-900/85 backdrop-blur-2xl border border-slate-200 dark:border-white/10 rounded-3xl shadow-2xl transition-colors duration-200"
      >
        {/* Header */}
        <div className="flex flex-col items-center mb-6 text-center">
          <div className="w-16 h-16 bg-gradient-to-tr from-emerald-500/20 to-teal-500/20 text-emerald-600 dark:text-emerald-400 rounded-2xl flex items-center justify-center mb-4 border border-emerald-500/30 shadow-[0_0_20px_rgba(16,185,129,0.15)]">
            <Shield size={32} />
          </div>
          <h1 className="text-3xl font-headline font-bold text-slate-900 dark:text-white mb-1.5 tracking-tight">Manager Portal</h1>
          <p className="text-slate-600 dark:text-slate-400 text-sm">Secure Underwriter & Risk Assessment Gateway</p>
        </div>

        {/* Tab selection */}
        <div className="flex rounded-xl bg-slate-100 dark:bg-slate-950/60 p-1 mb-6 border border-slate-200 dark:border-white/5">
          <button
            type="button"
            onClick={() => { setTab('demo'); setError(''); }}
            className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
              tab === 'demo'
                ? 'bg-white text-slate-900 shadow-sm border border-slate-200/80 dark:bg-primary dark:text-slate-950 dark:border-transparent dark:shadow-md'
                : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
            }`}
          >
            <Zap size={14} /> Instant Demo
          </button>
          <button
            type="button"
            onClick={() => { setTab('email'); setError(''); }}
            className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
              tab === 'email'
                ? 'bg-white text-slate-900 shadow-sm border border-slate-200/80 dark:bg-primary dark:text-slate-950 dark:border-transparent dark:shadow-md'
                : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
            }`}
          >
            <Lock size={14} /> Password
          </button>
          <button
            type="button"
            onClick={() => { setTab('google'); setError(''); }}
            className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
              tab === 'google'
                ? 'bg-white text-slate-900 shadow-sm border border-slate-200/80 dark:bg-primary dark:text-slate-950 dark:border-transparent dark:shadow-md'
                : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
            }`}
          >
            <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="G" className="w-3.5 h-3.5" /> Google
          </button>
        </div>

        {/* Tab 1: Instant Demo Access */}
        {tab === 'demo' && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
            <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 text-left">
              <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400 font-semibold text-sm mb-1">
                <Check size={16} /> One-Click Underwriter Access
              </div>
              <p className="text-slate-700 dark:text-slate-300 text-xs leading-relaxed">
                Experience full access to the live loan application queue, applicant dossier, AI audit explanations, and decisioning controls.
              </p>
            </div>

            <button
              type="button"
              onClick={() => handleInstantDemoLogin('Senior Underwriter')}
              className="w-full group flex items-center justify-center gap-3 bg-gradient-to-r from-emerald-600 to-teal-600 dark:from-emerald-500 dark:to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white dark:text-slate-950 font-bold py-3.5 px-5 rounded-xl transition-all shadow-lg shadow-emerald-500/20 active:scale-[0.98]"
            >
              <Zap size={18} className="fill-current" />
              <span>Enter Manager Dashboard</span>
              <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
            </button>

            <div className="flex items-center justify-center gap-2 pt-2">
              <span className="text-xs text-slate-600 dark:text-slate-400">Preset profile:</span>
              <span className="text-xs font-mono bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 px-2 py-0.5 rounded text-emerald-700 dark:text-emerald-300">
                officer@pdr.ai (Senior Risk Officer)
              </span>
            </div>
          </motion.div>
        )}

        {/* Tab 2: Email & Password */}
        {tab === 'email' && (
          <motion.form initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} onSubmit={handleEmailLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">Work Email</label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" size={18} />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="officer@pdr.ai"
                  className="w-full bg-slate-50 dark:bg-slate-950/70 border border-slate-300 dark:border-white/10 rounded-xl pl-10 pr-4 py-3 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 text-sm focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/50"
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between items-center mb-1.5">
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300">Password</label>
                <button
                  type="button"
                  onClick={() => setShowPassword(s => !s)}
                  className="text-xs text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-primary transition-colors"
                >
                  {showPassword ? 'Hide' : 'Show'}
                </button>
              </div>
              <div className="relative">
                <KeyRound className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" size={18} />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-slate-50 dark:bg-slate-950/70 border border-slate-300 dark:border-white/10 rounded-xl pl-10 pr-4 py-3 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 text-sm focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/50"
                />
              </div>
            </div>

            {/* Quick prefill pill */}
            <div className="flex items-center justify-between text-xs pt-1">
              <span className="text-slate-500 dark:text-slate-400">Demo credentials:</span>
              <button
                type="button"
                onClick={() => { setEmail('officer@pdr.ai'); setPassword('pdr2025'); }}
                className="text-emerald-700 dark:text-primary hover:underline font-mono text-xs bg-emerald-50 dark:bg-primary/10 border border-emerald-200 dark:border-primary/20 px-2 py-0.5 rounded"
              >
                officer@pdr.ai / pdr2025
              </button>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-slate-900 hover:bg-slate-800 text-white dark:bg-primary dark:hover:bg-primary-hover dark:text-slate-950 font-bold py-3.5 px-4 rounded-xl transition-all shadow-lg active:scale-[0.98] flex items-center justify-center gap-2 text-sm"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white dark:border-slate-950 border-t-transparent rounded-full animate-spin"></div>
              ) : (
                <>
                  <span>Sign In to Dashboard</span>
                  <ArrowRight size={16} />
                </>
              )}
            </button>
          </motion.form>
        )}

        {/* Tab 3: Google Login */}
        {tab === 'google' && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
            <p className="text-slate-600 dark:text-slate-400 text-xs text-center">
              Authenticate via organization Single Sign-On (SSO) or Google Workspace.
            </p>

            <button
              type="button"
              onClick={handleGoogleLogin}
              disabled={loading}
              className="w-full flex items-center justify-center gap-3 bg-white hover:bg-slate-50 text-slate-800 border border-slate-200 dark:border-transparent dark:bg-white dark:hover:bg-slate-100 dark:text-slate-800 font-bold py-3.5 px-4 rounded-xl transition-all shadow-md focus:ring-4 focus:ring-emerald-500/20 active:scale-[0.98]"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-slate-400 border-t-slate-800 rounded-full animate-spin"></div>
              ) : (
                <>
                  <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" className="w-5 h-5" />
                  <span>Sign in with Google Workspace</span>
                </>
              )}
            </button>
          </motion.div>
        )}

        {/* Error and Info Display */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="mt-4 p-3.5 rounded-xl bg-rose-50 dark:bg-rose-500/15 border border-rose-200 dark:border-rose-500/30 text-rose-800 dark:text-rose-300 text-xs flex items-start gap-2.5 text-left"
            >
              <AlertCircle size={16} className="shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">{error}</p>
                {infoNotice && <p className="mt-1 text-slate-700 dark:text-slate-300 opacity-90">{infoNotice}</p>}
                <button
                  type="button"
                  onClick={() => handleInstantDemoLogin('Demo Manager')}
                  className="mt-2 inline-flex items-center gap-1 font-bold text-emerald-700 dark:text-emerald-400 hover:underline"
                >
                  <Zap size={13} /> Continue as Demo Loan Officer instead
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Bottom Nav */}
        <div className="mt-8 pt-5 border-t border-slate-200 dark:border-white/10 text-center flex flex-col gap-2">
          <p className="text-xs text-slate-500 dark:text-slate-400">Need another portal?</p>
          <div className="flex justify-center items-center gap-4 text-xs font-medium">
            <button onClick={() => navigate('/')} className="text-slate-700 hover:text-emerald-600 dark:text-slate-400 dark:hover:text-white transition-colors">Main Website</button>
            <span className="text-slate-400 dark:text-slate-600">•</span>
            <button onClick={() => navigate('/user-status')} className="text-slate-700 hover:text-emerald-600 dark:text-slate-400 dark:hover:text-white transition-colors">Applicant Tracker</button>
            <span className="text-slate-400 dark:text-slate-600">•</span>
            <button onClick={() => navigate('/solutions')} className="text-slate-700 hover:text-emerald-600 dark:text-slate-400 dark:hover:text-white transition-colors">Assessment Tool</button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
