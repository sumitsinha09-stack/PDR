import { useState, useEffect } from 'react';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Search, Loader2, User as UserIcon, Clock, CheckCircle, XCircle, 
  ArrowLeft, MessageSquare, LogOut, ShieldCheck, Zap, AlertCircle, FileText, Sparkles 
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { signInWithPopup, signOut, onAuthStateChanged } from 'firebase/auth';
import { auth, googleProvider } from '../firebase';
import { useAuth } from '../components/AuthContext';
import StarField from '../components/StarField';
import { BACKEND_URL } from '../config';

const DEMO_APPLICANTS = [
  { id: 'ntc_001', name: 'Priya Venkataraman', badge: 'NTC • Approved', color: 'emerald' },
  { id: 'msme_001', name: 'Sukhwinder Singh', badge: 'MSME • Approved', color: 'emerald' },
  { id: 'ntc_002', name: 'Ramesh Gowda', badge: 'NTC • Rejected', color: 'rose' },
  { id: 'msme_002', name: 'Mohammed Farouk', badge: 'MSME • Rejected', color: 'rose' },
  { id: 'ntc_003', name: 'Deepak Malhotra', badge: 'NTC • Review', color: 'amber' },
];

export default function UserStatus() {
  const { user: contextUser, loginLocal, logout: contextLogout } = useAuth();
  const [applicantId, setApplicantId] = useState('ntc_001');
  const [statusData, setStatusData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [googleLoading, setGoogleLoading] = useState(false);
  const [authNotice, setAuthNotice] = useState('');
  
  const navigate = useNavigate();

  // On initial mount, optionally fetch default applicant if requested
  useEffect(() => {
    // If applicantId exists initially, we can auto-check or leave ready
  }, []);

  const handleInstantDemoApplicant = (demo = DEMO_APPLICANTS[0]) => {
    setError('');
    setAuthNotice('');
    loginLocal({
      email: 'applicant@pdr.ai',
      role: 'Loan Applicant',
      name: demo.name,
      photo: null,
      applicantId: demo.id,
    });
    setApplicantId(demo.id);
    fetchStatus(demo.id);
  };

  const handleGoogleLogin = async () => {
    try {
      setGoogleLoading(true);
      setError('');
      setAuthNotice('');
      const result = await signInWithPopup(auth, googleProvider);
      if (result.user) {
        loginLocal({
          email: result.user.email,
          role: 'Loan Applicant',
          name: result.user.displayName || result.user.email,
          photo: result.user.photoURL,
        });
      }
    } catch (err) {
      console.warn("Applicant Google login error:", err);
      const code = err?.code || '';
      if (code === 'auth/unauthorized-domain') {
        setAuthNotice('Google OAuth domain restriction active. You can still search your application status directly below or use Demo Applicant access.');
      } else if (code === 'auth/popup-blocked') {
        setAuthNotice('Pop-up window blocked by browser. You can still track your application directly below.');
      } else if (code === 'auth/popup-closed-by-user') {
        setAuthNotice('Google sign-in popup was closed.');
      } else {
        setAuthNotice('Google authentication unavailable. Direct Application Tracking is active below.');
      }
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await contextLogout();
      setStatusData(null);
    } catch (err) {
      console.error("Logout failed", err);
    }
  };

  const fetchStatus = async (idToFetch) => {
    const target = (idToFetch || applicantId).trim();
    if (!target) {
      setError('Please enter an Applicant ID.');
      return;
    }

    setLoading(true);
    setError('');
    setStatusData(null);

    try {
      const res = await axios.get(`${BACKEND_URL}/api/user/status/${target}`);
      setStatusData(res.data);
    } catch (err) {
      const msg = err.response?.data?.detail || 'Applicant ID not found or server is temporarily unreachable.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const checkStatus = (e) => {
    e.preventDefault();
    fetchStatus();
  };

  const getStatusIcon = (outcome) => {
    if (!outcome) return <Clock className="text-amber-400" size={48} />;
    const normalized = outcome.toLowerCase();
    if (normalized.includes('approve')) return <CheckCircle className="text-emerald-400" size={48} />;
    if (normalized.includes('reject')) return <XCircle className="text-rose-400" size={48} />;
    return <Clock className="text-amber-400" size={48} />;
  };

  const getStatusColor = (outcome) => {
    if (!outcome) return 'border-amber-500/30 bg-amber-500/5 text-amber-400';
    const normalized = outcome.toLowerCase();
    if (normalized.includes('approve')) return 'border-emerald-500/40 bg-emerald-950/20 text-emerald-400';
    if (normalized.includes('reject')) return 'border-rose-500/40 bg-rose-950/20 text-rose-400';
    return 'border-amber-500/30 bg-amber-500/5 text-amber-400';
  };

  return (
    <div className="relative min-h-screen bg-slate-950 flex flex-col items-center justify-start p-4 md:p-8 overflow-x-hidden text-slate-100">
      <StarField />

      {/* Top Navbar */}
      <div className="w-full max-w-4xl flex items-center justify-between mb-8 z-20">
        <button
          onClick={() => navigate('/')}
          className="px-4 py-2 text-slate-400 hover:text-white bg-slate-900/60 hover:bg-slate-800 border border-white/10 rounded-xl transition-all flex items-center gap-2 text-sm"
        >
          <ArrowLeft size={16} /> Home
        </button>

        <div className="flex items-center gap-3">
          {contextUser ? (
            <div className="flex items-center gap-3 bg-slate-900/70 border border-white/10 px-3.5 py-1.5 rounded-full">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              <span className="text-xs text-slate-300 font-medium">
                {contextUser.name || contextUser.email}
              </span>
              <button
                onClick={handleLogout}
                className="text-slate-400 hover:text-rose-400 transition-colors ml-2 p-1"
                title="Sign out"
              >
                <LogOut size={15} />
              </button>
            </div>
          ) : (
            <button
              onClick={() => handleInstantDemoApplicant()}
              className="text-xs font-semibold px-3 py-1.5 rounded-full bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 transition-all flex items-center gap-1.5"
            >
              <Zap size={13} /> Demo Applicant Login
            </button>
          )}
        </div>
      </div>

      {/* Main Container */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-2xl z-10 space-y-6"
      >
        {/* Title Header */}
        <div className="text-center">
          <div className="w-16 h-16 bg-gradient-to-br from-emerald-500/20 to-primary/20 text-emerald-400 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-emerald-500/30 shadow-[0_0_25px_rgba(16,185,129,0.2)]">
            <UserIcon size={32} />
          </div>
          <h1 className="text-3xl md:text-4xl font-headline font-bold text-white mb-2 tracking-tight">
            Applicant Loan Status
          </h1>
          <p className="text-slate-400 text-sm md:text-base max-w-lg mx-auto">
            Track real-time underwriting decisions, PDR behavioral credit grades, and underwriter remarks.
          </p>
        </div>

        {/* Auth Notice if Google failed or info */}
        {authNotice && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-3.5 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-200 text-xs flex items-center gap-2"
          >
            <AlertCircle size={16} className="shrink-0" />
            <span className="flex-1">{authNotice}</span>
          </motion.div>
        )}

        {/* Quick Identity Box & Search Box */}
        <div className="bg-surface/80 dark:bg-slate-900/80 backdrop-blur-xl border border-white/10 rounded-3xl p-6 md:p-8 shadow-2xl">
          
          {/* Tracker Form */}
          <form onSubmit={checkStatus} className="space-y-4">
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300">
              Enter Applicant ID or Loan Reference
            </label>
            <div className="relative flex flex-col sm:flex-row gap-2 sm:gap-0 shadow-lg">
              <input
                type="text"
                value={applicantId}
                onChange={(e) => setApplicantId(e.target.value)}
                placeholder="e.g. ntc_001, msme_001, ntc_002..."
                className="w-full bg-slate-950/80 border border-white/15 sm:border-r-0 rounded-xl sm:rounded-r-none sm:rounded-l-2xl py-3.5 pl-5 pr-4 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/40 font-mono transition-all"
              />
              <button
                type="submit"
                disabled={loading}
                className="bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-bold px-7 py-3.5 rounded-xl sm:rounded-l-none sm:rounded-r-2xl transition-all flex items-center justify-center gap-2 min-w-[140px] text-sm shadow-md active:scale-95"
              >
                {loading ? <Loader2 className="animate-spin" size={18} /> : (
                  <>
                    <span>Track Status</span>
                    <Search size={16} />
                  </>
                )}
              </button>
            </div>

            {error && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-rose-300 text-xs p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-center flex items-center justify-center gap-2"
              >
                <AlertCircle size={15} />
                <span>{error}</span>
              </motion.div>
            )}
          </form>

          {/* Quick Demo Applicants Picker */}
          <div className="mt-6 pt-5 border-t border-white/10">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs text-slate-400 flex items-center gap-1.5 font-medium">
                <Sparkles size={14} className="text-emerald-400" />
                Quick Select Sample Applicants:
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              {DEMO_APPLICANTS.map((demo) => (
                <button
                  key={demo.id}
                  type="button"
                  onClick={() => {
                    setApplicantId(demo.id);
                    fetchStatus(demo.id);
                  }}
                  className={`text-xs px-3 py-1.5 rounded-lg border transition-all flex items-center gap-1.5 ${
                    applicantId === demo.id
                      ? 'bg-primary/20 border-primary text-primary font-semibold'
                      : 'bg-white/5 hover:bg-white/10 border-white/10 text-slate-300'
                  }`}
                >
                  <span className="font-mono font-bold">{demo.id}</span>
                  <span className="opacity-70">({demo.name.split(' ')[0]})</span>
                  <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                    demo.color === 'emerald' ? 'bg-emerald-500/20 text-emerald-300' :
                    demo.color === 'rose' ? 'bg-rose-500/20 text-rose-300' : 'bg-amber-500/20 text-amber-300'
                  }`}>
                    {demo.badge.split(' • ')[1]}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Optional Sign-in methods bar */}
          {!contextUser && (
            <div className="mt-6 pt-5 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-400">
              <span>Want to link your Google identity?</span>
              <div className="flex gap-2 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={handleGoogleLogin}
                  disabled={googleLoading}
                  className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-white/10 hover:bg-white/15 text-white border border-white/15 px-3 py-2 rounded-xl transition-all"
                >
                  {googleLoading ? <Loader2 className="animate-spin" size={14} /> : (
                    <>
                      <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" className="w-3.5 h-3.5" />
                      <span>Sign in with Google</span>
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => handleInstantDemoApplicant()}
                  className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/30 px-3 py-2 rounded-xl transition-all font-semibold"
                >
                  <Zap size={14} />
                  <span>Demo Login</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Application Status Dossier Card */}
        <AnimatePresence mode="wait">
          {statusData && (
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96 }}
              className={`p-6 md:p-8 rounded-3xl border backdrop-blur-xl shadow-[0_0_50px_rgba(0,0,0,0.6)] ${getStatusColor(statusData.outcome)}`}
            >
              <div className="flex flex-col items-center text-center">
                <div className="mb-3 drop-shadow-[0_0_15px_rgba(255,255,255,0.2)]">
                  {getStatusIcon(statusData.outcome)}
                </div>

                <span className="text-xs font-bold tracking-widest uppercase mb-1 opacity-80">
                  Loan Decision
                </span>
                <p className="text-2xl md:text-3xl font-black mb-6 tracking-tight text-white drop-shadow-md">
                  {statusData.outcome || 'PENDING / MANUAL REVIEW'}
                </p>

                {/* Key Metrics Grid */}
                <div className="w-full space-y-3 text-left bg-slate-950/60 p-5 md:p-6 rounded-2xl border border-white/10">
                  <div className="flex justify-between items-center border-b border-white/5 pb-2.5">
                    <span className="text-xs text-slate-400">Applicant Reference</span>
                    <span className="font-mono text-sm font-bold text-white">{statusData.applicant_id}</span>
                  </div>
                  <div className="flex justify-between items-center border-b border-white/5 pb-2.5">
                    <span className="text-xs text-slate-400">Applicant Name</span>
                    <span className="text-sm font-semibold text-white">{statusData.name || 'N/A'}</span>
                  </div>
                  <div className="flex justify-between items-center border-b border-white/5 pb-2.5">
                    <span className="text-xs text-slate-400">PDR Credit Grade</span>
                    <span className="text-base font-black px-2.5 py-0.5 rounded bg-primary/20 text-primary border border-primary/30">
                      Grade {statusData.grade}
                    </span>
                  </div>
                  {statusData.default_probability !== undefined && (
                    <div className="flex justify-between items-center border-b border-white/5 pb-2.5">
                      <span className="text-xs text-slate-400">Estimated Default Probability</span>
                      <span className="font-mono text-sm font-bold text-white">
                        {(statusData.default_probability * 100).toFixed(1)}%
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-slate-400">Last Evaluation Timestamp</span>
                    <span className="font-mono text-xs text-slate-300">
                      {statusData.score_date ? new Date(statusData.score_date).toLocaleString() : 'Recent'}
                    </span>
                  </div>
                </div>

                {/* Primary Evaluation Rationale */}
                {statusData.primary_reason && (
                  <div className="w-full mt-4 p-4 bg-white/5 border border-white/10 rounded-2xl text-left">
                    <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                      <FileText size={14} className="text-primary" /> Algorithmic Basis
                    </h4>
                    <p className="text-xs text-slate-200 leading-relaxed">{statusData.primary_reason}</p>
                  </div>
                )}

                {/* Manager Officer Remarks */}
                {statusData.manager_remarks && (
                  <div className="w-full mt-3 p-4 bg-indigo-500/10 border border-indigo-500/30 rounded-2xl text-left">
                    <h4 className="text-indigo-300 font-semibold text-xs mb-1.5 flex items-center gap-1.5">
                      <MessageSquare size={14} /> Underwriting Officer Remarks
                    </h4>
                    <p className="text-white italic text-xs leading-relaxed">
                      &ldquo;{statusData.manager_remarks}&rdquo;
                    </p>
                  </div>
                )}

              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Footer Navigation */}
        <div className="text-center pt-4">
          <div className="flex justify-center items-center gap-4 text-xs text-slate-400">
            <button onClick={() => navigate('/')} className="hover:text-white transition-colors">Main Website</button>
            <span>•</span>
            <button onClick={() => navigate('/manager-login')} className="hover:text-white transition-colors text-primary font-medium">
              Loan Officer Portal
            </button>
            <span>•</span>
            <button onClick={() => navigate('/solutions')} className="hover:text-white transition-colors">
              Risk Assessment
            </button>
          </div>
        </div>

      </motion.div>
    </div>
  );
}
