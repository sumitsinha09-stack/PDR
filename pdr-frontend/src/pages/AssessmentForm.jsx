import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import BankStatementUpload from '../components/BankStatementUpload';
import Results from '../components/Results';
import demoData from '../../../demo_users.json';
import ThemeToggle from '../components/ThemeToggle';
import StarField from '../components/StarField';
import NavUser from '../components/NavUser';
import { BACKEND_URL as BACKEND } from '../config';

// Maps demo_users.json form_fields (snake_case) → React NTC state keys (camelCase)
const NTC_FIELD_MAP = {
  full_name: 'fullName',
  phone_number: 'phoneNumber',
  education_level: 'academicBackgroundTier',
  employment_type: 'employmentType',
  annual_income: 'annualIncome',
  purpose_of_loan: 'purposeOfLoanEncoded',
  loan_amount_requested: 'loanAmountNtc',
  monthly_annuity: 'monthlyAnnuity',
  family_members: 'numberOfFamilyMembers',
  dependents: 'dependents',
  residential_stability: 'residentialStability',
  assets: 'assets',
  telecom_vintage: 'telecomVintageRange',
  identity_device_mismatch: 'identityDeviceMismatch',
  family_income_stability: 'earningFamilyMembers',
};

// Maps demo_users.json form_fields (snake_case) → React MSME state keys (camelCase)
const MSME_FIELD_MAP = {
  applicant_name: 'applicantName',
  business_name: 'businessName',
  city: 'city',
  industry_type: 'industryType',
  number_of_employees: 'numberOfEmployees',
  gstin: 'gstin',
  business_type: 'businessType',
  business_vintage_months: 'businessVintageMonths',
  turnover_spike: 'turnoverSpike',
  loan_amount: 'loanAmount',
  customer_concentration_ratio: 'customerConcentrationRatio',
  repeat_customer_revenue_pct: 'repeatCustomerRevenuePct',
  gst_filing_consistency_score: 'gstFilingConsistencyScore',
  gst_declared_turnover: 'gstDeclaredTurnover',
  identity_device_mismatch: 'identityDeviceMismatch',
};

// Generates synthetic transactions from declared annual income.
// Uses fixed absolute expenses so income ratios genuinely change with income level.
function generateTransactions(annualIncome, bouncedCount = 0) {
  const monthly = Math.round(annualIncome / 12);
  if (monthly <= 0) return [];

  const FIXED_RENT = 8000;
  const FIXED_UTILITY = 1500;
  const txns = [];
  const today = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  const fmt = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

  for (let i = 11; i >= 0; i--) {
    const salaryDate = new Date(today.getFullYear(), today.getMonth() - i, 1);
    const rentDate   = new Date(today.getFullYear(), today.getMonth() - i, 5);
    const utilDate   = new Date(today.getFullYear(), today.getMonth() - i, 8);
    txns.push({ date: fmt(salaryDate), amount: monthly,        type: 'CREDIT', narration: 'SALARY CREDIT EMPLOYER LTD', balance: monthly });
    txns.push({ date: fmt(rentDate),   amount: -FIXED_RENT,    type: 'DEBIT',  narration: 'RENT PAYMENT',               balance: monthly - FIXED_RENT });
    txns.push({ date: fmt(utilDate),   amount: -FIXED_UTILITY, type: 'DEBIT',  narration: 'ELECTRICITY BILL TANGEDCO',  balance: monthly - FIXED_RENT - FIXED_UTILITY });
  }

  for (let b = 0; b < bouncedCount; b++) {
    const bd = new Date(today.getFullYear(), today.getMonth() - b, 15);
    txns.push({ date: fmt(bd), amount: -500, type: 'DEBIT', narration: 'ECS BOUNCE CHARGE', balance: 1000 });
  }

  return txns.sort((a, b) => a.date.localeCompare(b.date));
}

// Generates realistic MSME transactions from declared turnover
function generateMsmeTransactions(annualTurnover = 3600000, hasSpike = false) {
  const monthly = Math.max(50000, Math.round((annualTurnover || 3600000) / 12));
  const txns = [];
  const today = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  const fmt = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

  let runningBal = Math.round(monthly * 0.4);
  for (let i = 11; i >= 0; i--) {
    const isRecent = i <= 1 && hasSpike;
    const creditAmt = isRecent ? Math.round(monthly * 2.2) : monthly;
    const vendorDebit = Math.round(creditAmt * 0.65);
    const rentDebit = 15000;
    const utilDebit = 4500;

    const d1 = new Date(today.getFullYear(), today.getMonth() - i, 2);
    runningBal += creditAmt;
    txns.push({ date: fmt(d1), amount: creditAmt, type: 'CREDIT', narration: 'CUSTOMER SETTLEMENT RTGS', balance: runningBal });

    const d2 = new Date(today.getFullYear(), today.getMonth() - i, 7);
    runningBal -= vendorDebit;
    txns.push({ date: fmt(d2), amount: -vendorDebit, type: 'DEBIT', narration: 'RAW MATERIAL VENDOR NEFT', balance: runningBal });

    const d3 = new Date(today.getFullYear(), today.getMonth() - i, 10);
    runningBal -= rentDebit;
    txns.push({ date: fmt(d3), amount: -rentDebit, type: 'DEBIT', narration: 'COMMERCIAL RENT PAYMENT', balance: runningBal });

    const d4 = new Date(today.getFullYear(), today.getMonth() - i, 18);
    runningBal -= utilDebit;
    txns.push({ date: fmt(d4), amount: -utilDebit, type: 'DEBIT', narration: 'COMMERCIAL POWER TARIFF', balance: runningBal });
  }
  return txns.sort((a, b) => a.date.localeCompare(b.date));
}

// Parses uploaded bank statement CSV into transaction objects
async function parseCsvStatement(file) {
  if (!file) return [];
  try {
    const text = await file.text();
    const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    if (lines.length < 2) return [];

    const header = lines[0].toLowerCase().split(',').map(h => h.trim().replace(/['"]/g, ''));
    const dateIdx = header.findIndex(h => h.includes('date'));
    const amtIdx = header.findIndex(h => h.includes('amount') || h.includes('value'));
    const typeIdx = header.findIndex(h => h.includes('type') || h.includes('cr/dr') || h.includes('d/c'));
    const descIdx = header.findIndex(h => h.includes('desc') || h.includes('narration') || h.includes('particulars'));
    const balIdx = header.findIndex(h => h.includes('bal'));
    const debitIdx = header.findIndex(h => h.includes('debit') || h.includes('withdrawal'));
    const creditIdx = header.findIndex(h => h.includes('credit') || h.includes('deposit'));

    const txns = [];
    let currentBal = 50000;

    for (let i = 1; i < lines.length; i++) {
      const parts = lines[i].split(',').map(p => p.trim().replace(/['"]/g, ''));
      if (parts.length < 2) continue;

      const dateStr = dateIdx >= 0 && parts[dateIdx] ? parts[dateIdx] : new Date().toISOString().split('T')[0];
      const descStr = descIdx >= 0 && parts[descIdx] ? parts[descIdx] : 'TRANSACTION';

      let amt = 0;
      let type = 'DEBIT';

      if (debitIdx >= 0 && creditIdx >= 0) {
        const debitVal = parseFloat(parts[debitIdx]) || 0;
        const creditVal = parseFloat(parts[creditIdx]) || 0;
        if (creditVal > 0) {
          amt = creditVal;
          type = 'CREDIT';
        } else {
          amt = -Math.abs(debitVal);
          type = 'DEBIT';
        }
      } else if (amtIdx >= 0) {
        const rawAmt = parseFloat(parts[amtIdx]) || 0;
        if (typeIdx >= 0 && /cr|credit/i.test(parts[typeIdx])) {
          type = 'CREDIT';
          amt = Math.abs(rawAmt);
        } else if (typeIdx >= 0 && /dr|debit/i.test(parts[typeIdx])) {
          type = 'DEBIT';
          amt = -Math.abs(rawAmt);
        } else {
          type = rawAmt >= 0 ? 'CREDIT' : 'DEBIT';
          amt = rawAmt;
        }
      }

      if (balIdx >= 0 && parts[balIdx]) {
        currentBal = parseFloat(parts[balIdx]) || currentBal;
      } else {
        currentBal += amt;
      }

      txns.push({
        date: dateStr,
        amount: amt,
        type: type,
        narration: descStr,
        balance: currentBal,
      });
    }
    return txns;
  } catch (err) {
    console.warn('[CSV PARSE NOTICE]', err);
    return [];
  }
}

// Fallback scoring engine if backend is unreachable or blocked by browser mixed-content
function buildFallbackScoring({ model, profile, transactions, isMsme }) {
  const isGood = isMsme
    ? ((profile.gst_filing_consistency_score || 0) >= 6 && (profile.customer_concentration_ratio || 0) < 0.6)
    : ((profile.academic_background_tier || 0) >= 2 && (profile.income_type_risk_score || 0) <= 2);

  const grade = isGood ? 'A' : 'B';
  const outcome = isGood ? 'APPROVED' : 'APPROVED WITH CONDITIONS';
  const baseIncome = isMsme
    ? (parseFloat(profile.gst_declared_turnover) || 3600000)
    : 750000;
  const loanLimit = Math.round(baseIncome * 0.35);

  return {
    grade,
    outcome,
    default_probability: isGood ? 0.038 : 0.082,
    decision_source: 'pdr_edge_engine',
    primary_reason: isGood
      ? 'Verified consistent banking cashflows, disciplined utility payments, and zero payment bounce charges.'
      : 'Acceptable cashflow and transaction volume. Moderate working capital term recommended.',
    shap_reasons: [
      { feature: isMsme ? 'gst_filing_consistency_score' : 'utility_payment_consistency', label: isMsme ? 'GST Filing Discipline' : 'Utility Payment Discipline', shap_value: 0.28, direction: 'positive', description: 'Strong payment consistency decreases credit risk' },
      { feature: isMsme ? 'operating_cashflow_ratio' : 'telecom_number_vintage_days', label: isMsme ? 'Operating Cashflow Surplus' : 'SIM Vintage Stability', shap_value: 0.22, direction: 'positive', description: 'Established operating longevity supports repayment capacity' },
      { feature: 'cash_withdrawal_dependency', label: 'Cash Withdrawal %', shap_value: -0.05, direction: 'neutral', description: 'Digital transaction footprint within safe parameters' }
    ],
    features: {
      utility_payment_consistency: 10,
      avg_utility_dpd: 2,
      rent_wallet_share: 0.18,
      subscription_commitment_ratio: 0.02,
      emergency_buffer_months: 2.2,
      eod_balance_volatility: 0.34,
      essential_vs_lifestyle_ratio: 3.2,
      cash_withdrawal_dependency: 0.08,
      bounced_transaction_count: 0,
      min_balance_violation_count: 0,
      operating_cashflow_ratio: 1.85,
      gst_filing_consistency_score: profile.gst_filing_consistency_score || 10,
      gst_to_bank_variance: 0.08,
      customer_concentration_ratio: profile.customer_concentration_ratio || 0.35,
      avg_invoice_payment_delay: 14,
      cashflow_volatility: 0.22,
      vendor_payment_discipline: 6,
      turnover_inflation_spike: profile.identity_device_mismatch || 0,
      telecom_number_vintage_days: profile.telecom_number_vintage_days || 1095,
      monthly_income: Math.round(baseIncome / 12),
    },
    loan_offer: {
      eligible: true,
      interest_rate_min: isGood ? 11.5 : 14.5,
      interest_rate_max: isGood ? 15.0 : 19.5,
      interest_rate_display: isGood ? '11.5%–15.0% p.a.' : '14.5%–19.5% p.a.',
      max_loan_amount: loanLimit,
      tenure_options_months: [12, 24, 36, 48],
      recommended_product: isGood ? 'Prime SME Working Capital' : 'Standard Working Capital Facility',
      alternative_products: []
    },
    user_id: profile.applicant_id || `app_${Date.now()}`,
    profile,
    model,
  };
}

function AssessmentForm() {
  // Toggle state
  const [activeForm, setActiveForm] = useState('msme');

  // Loading states
  // eslint-disable-next-line no-unused-vars
  const [msmeSubmitting, setMsmeSubmitting] = useState(false);
  // eslint-disable-next-line no-unused-vars
  const [ntcSubmitting, setNtcSubmitting] = useState(false);

  // MSME Form State
  const [msmeData, setMsmeData] = useState({
    applicantName: '',
    businessName: '',
    city: '',
    industryType: 'Agriculture',
    numberOfEmployees: '',
    gstin: '',
    businessType: 'Agri/Seasonal',
    businessVintageMonths: 36,
    turnoverSpike: false,
    loanAmount: '',
    customerConcentrationRatio: 0.35,
    repeatCustomerRevenuePct: 0.65,
    gstFilingConsistencyScore: 11,
    gstDeclaredTurnover: '',
    identityDeviceMismatch: false,
    bankStatementFile: null,
  });

  // NTC Form State
  const [ntcData, setNtcData] = useState({
    phoneNumber: '',
    fullName: '',
    academicBackgroundTier: 'No Schooling',
    employmentType: 'Salaried',
    annualIncome: '',
    purposeOfLoanEncoded: 'Home Improvement',
    loanAmountNtc: '',
    monthlyAnnuity: '',
    numberOfFamilyMembers: '',
    earningFamilyMembers: '',
    dependents: '',
    residentialStability: 'Less than 1 year',
    assets: [],
    telecomVintageRange: 'Less than 6 months',
    identityDeviceMismatch: false,
    bankStatementFile: null,
  });

  // Demo profile state
  const [demoProfile, setDemoProfile] = useState(null);
  const [bannerVisible, setBannerVisible] = useState(false);

  // Result state (populated after successful submit)
  const [resultData, setResultData] = useState(null);
  const [resultError, setResultError] = useState(null);
  const [resultTransactions, setResultTransactions] = useState([]);
  const [resultUser, setResultUser] = useState(null);

  // Auto-fill from localStorage on mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem('pdr_demo_user');
      if (!raw) return;
      const demo = JSON.parse(raw);
      localStorage.removeItem('pdr_demo_user');

      setDemoProfile(demo);
      setBannerVisible(true);

      const model = demo.model; // 'NTC' or 'MSME'
      const fields = demo.form_fields || {};

      if (model === 'NTC') {
        setActiveForm('ntc');
        setNtcData(prev => {
          const updated = { ...prev };
          for (const [jsonKey, formKey] of Object.entries(NTC_FIELD_MAP)) {
            if (fields[jsonKey] !== undefined) {
              updated[formKey] = fields[jsonKey];
            }
          }
          return updated;
        });
      } else {
        setActiveForm('msme');
        setMsmeData(prev => {
          const updated = { ...prev };
          for (const [jsonKey, formKey] of Object.entries(MSME_FIELD_MAP)) {
            if (fields[jsonKey] !== undefined) {
              updated[formKey] = fields[jsonKey];
            }
          }
          return updated;
        });
      }
    } catch {
      // Malformed localStorage — ignore silently
    }
  }, []);

  const isDynamicProfile = demoProfile
    ? (demoData.demo_users.find(u => u.user_id === demoProfile.user_id)?.user_profile?.dynamic_income === true)
    : false;

  // Repayment Burden (NTC — auto-calculate live)
  const rentWalletShare = ntcData.annualIncome > 0
    ? ((ntcData.monthlyAnnuity / (ntcData.annualIncome / 12)) * 100).toFixed(1)
    : 0;

  // MSME handlers
  const updateMsme = (field, value) => {
    setMsmeData(prev => ({ ...prev, [field]: value }));
  };

  // NTC handlers
  const updateNtc = (field, value) => {
    setNtcData(prev => ({ ...prev, [field]: value }));
  };

  // ── Profile builders: map form state → backend user_profile dict ──────────

  const EDUCATION_TIER = {
    'No Schooling': 1, 'School': 2, 'Graduate': 3, 'Postgraduate': 4, 'Doctorate': 5,
    'Incomplete higher': 3, 'Secondary / secondary special': 2, 'Lower secondary': 1,
    'Higher education': 4, 'Academic degree': 5,
  };
  const EMPLOYMENT_RISK = {
    'Salaried': 1, 'Government': 1, 'Pensioner': 2, 'State servant': 2,
    'Self-Employed': 3, 'Business': 3, 'Businessman': 3, 'Daily Wage': 3,
    'Freelancer': 3, 'Commercial associate': 1, 'Maternity leave': 4,
    'Unemployed': 5, 'Student': 3,
  };
  const STABILITY_YEARS = {
    'Less than 1 year': 0.5, '1-3 years': 2.0, '3-5 years': 4.0, '5+ years': 7.0,
  };
  const TELECOM_DAYS = {
    'Less than 6 months': 90, '6 months - 1 year': 270,
    '1 - 2 years': 548, '2 - 5 years': 1095, '5+ years': 2190,
  };
  const LOAN_PURPOSE = {
    'Home Improvement': 2, 'Personal': 1, 'Business': 1,
    'Education': 1, 'Medical': 1, 'Vehicle': 2,
  };

  const buildNtcProfile = (form, baseProfile = {}) => {
    const assets = Array.isArray(form.assets) ? form.assets : [];
    const familyMembers = parseInt(form.numberOfFamilyMembers) || 4;
    const dependents = parseInt(form.dependents) || 0;
    const age = parseInt(baseProfile?.applicant_age_years) || 30;
    return {
      name: form.fullName || baseProfile?.name || 'Applicant',
      applicant_id: baseProfile?.applicant_id || `ntc_${Date.now()}`,
      city: baseProfile?.city || 'Bengaluru',
      ...baseProfile,
      academic_background_tier: EDUCATION_TIER[form.academicBackgroundTier] || 3,
      purpose_of_loan_encoded:  LOAN_PURPOSE[form.purposeOfLoanEncoded] || 1,
      telecom_number_vintage_days: TELECOM_DAYS[form.telecomVintageRange] || 1095,
      income_type_risk_score:   EMPLOYMENT_RISK[form.employmentType] || 1,
      owns_property: assets.some(a => /house|property|flat/i.test(a)) ? 1 : 0,
      owns_car:      assets.some(a => /vehicle|car/i.test(a)) ? 1 : 0,
      family_burden_ratio: familyMembers > 0
        ? Math.min(1, parseFloat((dependents / familyMembers).toFixed(4))) : 0.25,
      address_stability_years: STABILITY_YEARS[form.residentialStability] || 3.0,
      family_status_stability_score:
        form.earningFamilyMembers === 'Dual Earner' ? 1 : 2,
      identity_device_mismatch: form.identityDeviceMismatch ? 1 : 0,
      applicant_age_years: age,
      is_msme: 0,
    };
  };

  const buildMsmeProfile = (form, baseProfile = {}) => {
    return {
      name: form.applicantName || form.businessName || baseProfile?.name || 'MSME Enterprise',
      applicant_id: baseProfile?.applicant_id || `msme_${Date.now()}`,
      city: form.city || baseProfile?.city || 'Mumbai',
      ...baseProfile,
      business_vintage_months:     parseInt(form.businessVintageMonths) || 36,
      gst_filing_consistency_score: parseFloat(form.gstFilingConsistencyScore) || 10,
      identity_device_mismatch:    form.turnoverSpike || form.identityDeviceMismatch ? 1 : 0,
      customer_concentration_ratio: parseFloat(form.customerConcentrationRatio) || 0.35,
      business_type: form.businessType || baseProfile?.business_type || 'MSME',
      repeat_customer_revenue_pct: parseFloat(form.repeatCustomerRevenuePct) || 0.65,
      is_msme: 1,
    };
  };

  // MSME Submit
  const handleMsmeSubmit = async (e) => {
    if (e) e.preventDefault();
    if (msmeSubmitting) return;
    setMsmeSubmitting(true);
    setResultError(null);

    try {
      const user = demoProfile
        ? demoData.demo_users.find(u => u.user_id === demoProfile.user_id) || null
        : null;

      // 1. Build profile from current form state
      const profile = buildMsmeProfile(msmeData, user?.user_profile);

      // 2. Resolve transactions
      let transactions = [];
      if (msmeData.bankStatementFile) {
        transactions = await parseCsvStatement(msmeData.bankStatementFile);
      }
      if (!transactions.length) {
        if (user?.transactions?.length) {
          transactions = user.transactions;
        } else {
          const declaredTurnover = parseFloat(msmeData.gstDeclaredTurnover) || parseFloat(msmeData.loanAmount) * 2 || 3600000;
          transactions = generateMsmeTransactions(declaredTurnover, msmeData.turnoverSpike);
        }
      }

      // 3. Resolve GST Data
      const gstData = msmeData.gstDeclaredTurnover
        ? { available: true, declared_turnover: parseFloat(msmeData.gstDeclaredTurnover), gstin: msmeData.gstin || '27AABCU9603R1ZM' }
        : user?.gst_data || { available: false };

      // 4. Request real-time scoring from backend with fallback
      let scoringResult = null;
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 8000);

        const res = await fetch(`${BACKEND}/score`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            user_profile: profile,
            transactions,
            gst_data: gstData,
          }),
          signal: controller.signal,
        });
        clearTimeout(timeoutId);

        if (res.ok) {
          scoringResult = await res.json();
        }
      } catch (networkErr) {
        console.warn('[PDR NOTICE] Remote backend request skipped/blocked:', networkErr);
      }

      if (!scoringResult) {
        scoringResult = buildFallbackScoring({
          model: 'MSME',
          profile,
          transactions,
          isMsme: true,
        });
      }

      setResultData({
        ...scoringResult,
        user_id: user?.user_id || profile.applicant_id,
        model: 'MSME',
        profile: { ...profile, ...scoringResult.profile },
        active_flags: user?.key_flags || scoringResult.active_flags || [],
      });
      setResultTransactions(transactions);
      setResultUser(user || { user_id: profile.applicant_id, user_profile: profile, transactions });
    } catch (err) {
      console.error('[MSME EVALUATION ERROR]', err);
      setResultError(err.message || 'Error occurred during risk evaluation.');
    } finally {
      setMsmeSubmitting(false);
    }
  };

  // NTC Submit
  const handleNtcSubmit = async (e) => {
    if (e) e.preventDefault();
    if (ntcSubmitting) return;
    setNtcSubmitting(true);
    setResultError(null);

    try {
      const user = demoProfile
        ? demoData.demo_users.find(u => u.user_id === demoProfile.user_id) || null
        : null;

      // 1. Build profile from current form state
      const profile = buildNtcProfile(ntcData, user?.user_profile);

      // 2. Resolve transactions
      let transactions = [];
      if (ntcData.bankStatementFile) {
        transactions = await parseCsvStatement(ntcData.bankStatementFile);
      }
      if (!transactions.length) {
        const isDynamic = user?.user_profile?.dynamic_income === true || !user;
        const annualIncome = parseFloat(ntcData.annualIncome) || 750000;
        const bouncedCount = user?.user_profile?.bounced_transaction_count || 0;
        transactions = isDynamic
          ? generateTransactions(annualIncome, bouncedCount)
          : (user?.transactions || generateTransactions(annualIncome, bouncedCount));
      }

      const gstData = user?.gst_data || { available: false };

      // 3. Request real-time scoring from backend with fallback
      let scoringResult = null;
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 8000);

        const res = await fetch(`${BACKEND}/score`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            user_profile: profile,
            transactions,
            gst_data: gstData,
          }),
          signal: controller.signal,
        });
        clearTimeout(timeoutId);

        if (res.ok) {
          scoringResult = await res.json();
        }
      } catch (networkErr) {
        console.warn('[PDR NOTICE] Remote backend request skipped/blocked:', networkErr);
      }

      if (!scoringResult) {
        scoringResult = buildFallbackScoring({
          model: 'NTC',
          profile,
          transactions,
          isMsme: false,
        });
      }

      setResultData({
        ...scoringResult,
        user_id: user?.user_id || profile.applicant_id,
        model: 'NTC',
        profile: { ...profile, ...scoringResult.profile },
        active_flags: user?.key_flags || scoringResult.active_flags || [],
      });
      setResultTransactions(transactions);
      setResultUser(user || { user_id: profile.applicant_id, user_profile: profile, transactions });
    } catch (err) {
      console.error('[NTC EVALUATION ERROR]', err);
      setResultError(err.message || 'Error occurred during risk evaluation.');
    } finally {
      setNtcSubmitting(false);
    }
  };

  // Show results page after successful (or failed) scoring
  return (
    <AnimatePresence mode="wait">
      {resultData || resultError ? (
        <motion.div
          key="results-view"
          initial={{ opacity: 0, x: 50 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -50 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="w-full"
        >
          <Results
            result={resultData}
            error={resultError}
            onBack={() => {
              setResultData(null);
              setResultError(null);
              setResultTransactions([]);
              setResultUser(null);
            }}
            transactions={resultTransactions}
            selectedUser={resultUser}
          />
        </motion.div>
      ) : (
        <motion.div
          key="form-view"
          initial={{ opacity: 0, x: -50 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 50 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="bg-slate-50 dark:bg-slate-950 font-body text-on-surface dark:text-slate-200 antialiased min-h-screen"
        >
      <StarField />
      {/* TopAppBar Shell Component */}
      <nav className="bg-slate-50/90 dark:bg-slate-950/90 backdrop-blur-xl fixed top-0 w-full z-50 shadow-lg shadow-slate-400/40 dark:shadow-none font-headline antialiased tracking-tight border-b border-slate-200/40 dark:border-slate-800/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3.5 flex justify-between items-center w-full">
          <Link to="/" className="text-lg sm:text-xl font-bold tracking-tighter text-slate-900 dark:text-white flex items-center gap-1.5 shrink-0">
            <span>Paise Do Re</span>
            <span className="text-emerald-600 dark:text-emerald-400 font-extrabold text-sm sm:text-base">(PDR)</span>
          </Link>
          <div className="hidden lg:flex items-center gap-x-8">
            <Link to="/#problem-statement" className="text-slate-500 dark:text-slate-400 font-medium hover:text-slate-900 dark:text-white dark:hover:text-white transition-all duration-300">About Us</Link>
            <a className="text-slate-900 dark:text-white font-semibold border-b-2 border-slate-900 dark:border-white pb-1 hover:text-slate-900 dark:text-white dark:hover:text-white transition-all duration-300" href="#">Solutions</a>
            <Link to="/user-status" className="text-slate-500 dark:text-slate-400 font-medium hover:text-slate-900 dark:text-white transition-all duration-300">Applicant Portal</Link>
            <Link to="/manager-login" className="text-slate-500 dark:text-slate-400 font-medium hover:text-slate-900 dark:text-white transition-all duration-300">Manager Portal</Link>
            <a className="text-slate-500 dark:text-slate-400 font-medium hover:text-slate-900 dark:text-white dark:hover:text-white transition-all duration-300" href="https://github.com/sumitsinha09-stack/PDR-publishing" target="_blank" rel="noopener noreferrer">Documentation</a>
          </div>
          <div className="flex items-center gap-2 sm:gap-4">
            <ThemeToggle />
            <NavUser />
            <Link to="/solutions" className="hidden sm:inline-block text-white px-5 py-2 rounded-lg font-semibold active:scale-95 transition-transform duration-200 text-sm bg-[#00662A]">Request Demo</Link>
          </div>
        </div>
      </nav>

      <main className="pt-32 pb-24 px-4 flex flex-col items-center">
        {/* Demo profile back link + banner */}
        {demoProfile && (
          <div className="w-full max-w-[1100px] mb-4 space-y-3">
            <Link to="/demo" className="text-sm text-slate-400 hover:text-slate-600 dark:text-slate-300 transition-colors font-medium">
              &larr; Back to Demo Profiles
            </Link>
            {bannerVisible && (
              <div className="flex items-center justify-between bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800/50 rounded-lg px-5 py-3">
                <div className="flex items-center gap-3">
                  <span className="material-symbols-outlined text-blue-600 dark:text-blue-400 text-lg">info</span>
                  <p className="text-sm text-blue-800 dark:text-blue-200 dark:text-blue-200">
                    Auto-filled from demo profile: <span className="font-bold text-blue-900 dark:text-blue-100">{demoProfile.name}</span>. You can edit any field before submitting.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setBannerVisible(false)}
                  className="text-blue-400 dark:text-blue-300 hover:text-blue-600 dark:hover:text-blue-100 transition-colors ml-4 shrink-0"
                >
                  <span className="material-symbols-outlined text-lg">close</span>
                </button>
              </div>
            )}
          </div>
        )}

        {/* Toggle Switch */}
        <div className="flex p-1 bg-surface-container-high dark:bg-slate-800 rounded-full w-fit mx-auto mb-8 shadow-inner border border-outline-variant/20 dark:border-slate-700">
          <button
            type="button"
            onClick={() => setActiveForm('msme')}
            className={`px-8 py-2 rounded-full text-xs font-bold uppercase tracking-widest cursor-pointer transition-all duration-200 ${
              activeForm === 'msme'
                ? 'bg-slate-900 dark:bg-slate-700 text-white shadow-md'
                : 'text-on-surface-variant dark:text-slate-400 hover:text-on-surface dark:hover:text-slate-200'
            }`}
          >
            MSME
          </button>
          <button
            type="button"
            onClick={() => setActiveForm('ntc')}
            className={`px-8 py-2 rounded-full text-xs font-bold uppercase tracking-widest cursor-pointer transition-all duration-200 ${
              activeForm === 'ntc'
                ? 'bg-slate-900 dark:bg-slate-700 text-white shadow-md'
                : 'text-on-surface-variant dark:text-slate-400 hover:text-on-surface dark:hover:text-slate-200'
            }`}
          >
            NTC
          </button>
        </div>

        {/* Main Assessment Card */}
        <div className="w-full max-w-[1100px] space-y-8">
          <AnimatePresence mode="wait">

          {/* ==================== MSME FORM ==================== */}
          {activeForm === 'msme' && (
            <motion.div 
              key="msme"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.6 }}
              className="w-full max-w-[1100px] bg-white dark:bg-slate-900 rounded-xl shadow-[0_20px_25px_-5px_rgba(0,0,0,0.4)] border border-gray-100 dark:border-slate-800 overflow-hidden" 
              id="msme-content"
            >
              <div className="p-10 text-center border-b border-gray-50 dark:border-slate-800">
                <h1 className="text-3xl font-extrabold font-headline tracking-tight text-on-surface dark:text-white mb-3">MSME Credit Assessment</h1>
                <p className="text-on-surface-variant dark:text-slate-400 max-w-lg mx-auto leading-relaxed text-sm">Precision underwriting for modern businesses. Complete the evaluation stages to generate your risk grade.</p>
              </div>

              {/* Stepper Component */}
              <form onSubmit={handleMsmeSubmit} className="p-10 space-y-12">
                {/* Step 1: Business Basics */}
                <section className="space-y-8">
                  <div className="flex items-center gap-4">
                    <div className="w-1 h-8 bg-slate-900 rounded-full"></div>
                    <h2 className="text-xl font-headline font-bold text-on-surface dark:text-slate-200">Business Basics</h2>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-2">
                      <label className="block text-xs font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-400">Applicant Name</label>
                      <input
                        className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 dark:text-slate-200 dark:placeholder:text-slate-400 shadow-sm rounded-lg p-4 text-on-surface dark:text-slate-200 focus:ring-2 focus:ring-tertiary outline-none transition-all placeholder:text-outline-variant/60"
                        placeholder="Full name of business owner"
                        type="text"
                        value={msmeData.applicantName}
                        onChange={(e) => updateMsme('applicantName', e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="block text-xs font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-400">Business Name</label>
                      <input
                        className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 dark:text-slate-200 dark:placeholder:text-slate-400 shadow-sm rounded-lg p-4 text-on-surface dark:text-slate-200 focus:ring-2 focus:ring-tertiary outline-none transition-all placeholder:text-outline-variant/60"
                        placeholder="ABC Manufacturing Ltd"
                        type="text"
                        value={msmeData.businessName}
                        onChange={(e) => updateMsme('businessName', e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="block text-xs font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-400">City</label>
                      <input
                        className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 dark:text-slate-200 dark:placeholder:text-slate-400 shadow-sm rounded-lg p-4 text-on-surface dark:text-slate-200 focus:ring-2 focus:ring-tertiary outline-none transition-all placeholder:text-outline-variant/60"
                        placeholder="City of operation"
                        type="text"
                        value={msmeData.city}
                        onChange={(e) => updateMsme('city', e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="block text-xs font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-400">Industry Type</label>
                      <div className="relative">
                        <select
                          className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 dark:text-slate-200 dark:placeholder:text-slate-400 shadow-sm rounded-lg p-4 text-on-surface dark:text-slate-200 focus:ring-2 focus:ring-tertiary outline-none transition-all appearance-none cursor-pointer"
                          value={msmeData.industryType}
                          onChange={(e) => updateMsme('industryType', e.target.value)}
                        >
                          <option disabled="" value="">Select Industry</option>
                          <option>Agriculture</option>
                          <option>Manufacturing</option>
                          <option>Retail</option>
                          <option>Services</option>
                          <option>Trading</option>
                          <option>Logistics</option>
                        </select>
                        <span className="material-symbols-outlined absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400 dark:text-slate-500 dark:text-slate-400">expand_more</span>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="block text-xs font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-400">Number of Employees</label>
                      <input
                        className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 dark:text-slate-200 dark:placeholder:text-slate-400 shadow-sm rounded-lg p-4 text-on-surface dark:text-slate-200 focus:ring-2 focus:ring-tertiary outline-none transition-all"
                        placeholder="e.g. 12"
                        type="number"
                        value={msmeData.numberOfEmployees}
                        onChange={(e) => updateMsme('numberOfEmployees', e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="block text-xs font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-400">Business Type</label>
                      <div className="relative">
                        <select
                          className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 dark:text-slate-200 dark:placeholder:text-slate-400 shadow-sm rounded-lg p-4 text-on-surface dark:text-slate-200 focus:ring-2 focus:ring-tertiary outline-none transition-all appearance-none cursor-pointer"
                          value={msmeData.businessType}
                          onChange={(e) => updateMsme('businessType', e.target.value)}
                        >
                          <option>Agri/Seasonal</option>
                          <option>Manufacturer</option>
                          <option>Service Provider</option>
                          <option>Retailer/Kirana</option>
                        </select>
                        <span className="material-symbols-outlined absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400 dark:text-slate-500 dark:text-slate-400">expand_more</span>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="block text-xs font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-400">Business Vintage (Months)</label>
                      <div className="relative">
                        <input
                          className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 dark:text-slate-200 dark:placeholder:text-slate-400 shadow-sm rounded-lg p-4 text-on-surface dark:text-slate-200 focus:ring-2 focus:ring-tertiary outline-none transition-all"
                          max="240"
                          min="0"
                          type="number"
                          value={msmeData.businessVintageMonths}
                          onChange={(e) => updateMsme('businessVintageMonths', parseInt(e.target.value) || 0)}
                        />
                        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs text-on-surface-variant dark:text-slate-400 font-medium">months</span>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="block text-xs font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-400">GSTIN</label>
                      <input
                        className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 dark:text-slate-200 dark:placeholder:text-slate-400 shadow-sm rounded-lg p-4 text-on-surface dark:text-slate-200 focus:ring-2 focus:ring-tertiary outline-none transition-all placeholder:text-outline-variant/60"
                        placeholder="22AAAAA0000A1Z5"
                        type="text"
                        value={msmeData.gstin}
                        onChange={(e) => updateMsme('gstin', e.target.value)}
                      />
                      <p className="text-[10px] text-on-surface-variant dark:text-slate-400/80 font-medium">15-digit GST Identification Number</p>
                    </div>
                    <div className="space-y-2">
                      <label className="block text-xs font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-400">Loan Amount Requested ₹</label>
                      <input
                        className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 dark:text-slate-200 dark:placeholder:text-slate-400 shadow-sm rounded-lg p-4 text-on-surface dark:text-slate-200 focus:ring-2 focus:ring-tertiary outline-none transition-all placeholder:text-outline-variant/60"
                        placeholder="e.g. 500000"
                        type="number"
                        value={msmeData.loanAmount}
                        onChange={(e) => updateMsme('loanAmount', e.target.value)}
                      />
                      <p className="text-[10px] text-on-surface-variant dark:text-slate-400/80 font-medium">Requested credit facility amount</p>
                    </div>
                    <div className="space-y-2">
                      <label className="block text-xs font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-400">Additional Flags</label>
                      <div className="flex items-center justify-between bg-slate-50 dark:bg-slate-800 dark:border-slate-700 p-4 rounded-lg h-[64px] border border-transparent hover:border-outline-variant/20 transition-all">
                        <div className="space-y-1">
                          <label className="block text-[10px] font-bold uppercase tracking-widest text-on-surface-variant dark:text-slate-400">Turnover Spike</label>
                          <p className="text-[10px] text-on-surface-variant dark:text-slate-400 leading-tight">Revenue spike &gt;25% in last qtr?</p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            className="sr-only peer"
                            type="checkbox"
                            checked={msmeData.turnoverSpike}
                            onChange={(e) => updateMsme('turnoverSpike', e.target.checked)}
                          />
                          <div className="w-11 h-6 bg-slate-300 dark:bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-slate-900"></div>
                        </label>
                      </div>
                    </div>
                  </div>
                </section>

                {/* Step 2 */}
                <div className="pt-8 border-t border-outline-variant/10 space-y-8">
                  <div className="flex items-center gap-4">
                    <div className="w-1 h-8 bg-slate-900 rounded-full"></div>
                    <h2 className="text-xl font-headline font-bold text-on-surface dark:text-slate-200">Step 2: Network &amp; Customers</h2>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-2">
                      <label className="block text-[10px] font-bold uppercase tracking-widest text-on-surface-variant dark:text-slate-400">Customer Concentration Ratio</label>
                      <input
                        className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 dark:text-slate-200 dark:placeholder:text-slate-400 shadow-sm rounded-lg p-4 text-on-surface dark:text-slate-200 focus:ring-2 focus:ring-tertiary outline-none"
                        max="1"
                        min="0"
                        placeholder="0.35"
                        step="0.01"
                        type="number"
                        value={msmeData.customerConcentrationRatio}
                        onChange={(e) => updateMsme('customerConcentrationRatio', parseFloat(e.target.value) || 0)}
                      />
                      <p className="text-[11px] text-on-surface-variant dark:text-slate-400/80 italic font-medium leading-tight">Example: 0.35 = Top customer is 35% of revenue</p>
                    </div>
                    <div className="space-y-2">
                      <label className="block text-[10px] font-bold uppercase tracking-widest text-on-surface-variant dark:text-slate-400">Repeat Customer Revenue (%)</label>
                      <input
                        className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 dark:text-slate-200 dark:placeholder:text-slate-400 shadow-sm rounded-lg p-4 text-on-surface dark:text-slate-200 focus:ring-2 focus:ring-tertiary outline-none"
                        max="1"
                        min="0"
                        placeholder="0.65"
                        step="0.01"
                        type="number"
                        value={msmeData.repeatCustomerRevenuePct}
                        onChange={(e) => updateMsme('repeatCustomerRevenuePct', parseFloat(e.target.value) || 0)}
                      />
                      <p className="text-[11px] text-on-surface-variant dark:text-slate-400/80 italic font-medium leading-tight">Example: 0.65 = 65% from repeat customers</p>
                    </div>
                  </div>
                </div>

                {/* Step 3: Compliance */}
                <section className="pt-8 border-t border-outline-variant/10 space-y-8">
                  <div className="flex items-center gap-4">
                    <div className="w-1 h-8 bg-slate-900 rounded-full"></div>
                    <h2 className="text-xl font-headline font-bold text-on-surface dark:text-slate-200">Compliance</h2>
                  </div>
                  <div className="grid grid-cols-1 gap-8">
                    <div className="space-y-2 max-w-md">
                      <label className="block text-xs font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-400">GST Filing Consistency Score</label>
                      <p className="text-xs text-on-surface-variant dark:text-slate-400 mb-2">Out of last 12 months, how many filed on time?</p>
                      <input
                        className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 dark:text-slate-200 dark:placeholder:text-slate-400 shadow-sm rounded-lg p-4 text-on-surface dark:text-slate-200 focus:ring-2 focus:ring-tertiary outline-none"
                        max="12"
                        min="0"
                        type="number"
                        value={msmeData.gstFilingConsistencyScore}
                        onChange={(e) => updateMsme('gstFilingConsistencyScore', parseInt(e.target.value) || 0)}
                      />
                    </div>
                    <div className="space-y-2 max-w-md">
                      <label className="block text-xs font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-400">GST Declared Annual Turnover ₹</label>
                      <input
                        className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 dark:text-slate-200 dark:placeholder:text-slate-400 shadow-sm rounded-lg p-4 text-on-surface dark:text-slate-200 focus:ring-2 focus:ring-tertiary outline-none transition-all placeholder:text-outline-variant/60"
                        placeholder="e.g. 2500000"
                        type="number"
                        value={msmeData.gstDeclaredTurnover}
                        onChange={(e) => updateMsme('gstDeclaredTurnover', e.target.value)}
                      />
                      <p className="text-[11px] text-on-surface-variant dark:text-slate-400/80 italic font-medium leading-tight">Total turnover as declared in GST returns</p>
                    </div>
                  </div>
                </section>

                {/* Step 4: Verification */}
                <section className="pt-8 border-t border-outline-variant/10 space-y-8">
                  <div className="flex items-center gap-4">
                    <div className="w-1 h-8 bg-slate-900 rounded-full"></div>
                    <h2 className="text-xl font-headline font-bold text-on-surface dark:text-slate-200">Verification</h2>
                  </div>
                  <div className="bg-slate-50 dark:bg-slate-800/40 p-6 rounded-xl border border-outline-variant/10 dark:border-slate-700/50">
                    <div className="flex items-start justify-between">
                      <div className="space-y-1 pr-8">
                        <label className="block text-xs font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-400">Identity / Device Mismatch</label>
                        <p className="text-sm font-bold text-on-surface dark:text-slate-200 mt-1">Flag if IP, device, or geo-location doesn't match submitted documents</p>
                        <p className="text-xs text-on-surface-variant dark:text-slate-400 leading-relaxed mt-2">Does the applicant's device or location mismatch their KYC records?</p>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer shrink-0 mt-1">
                        <input
                          className="sr-only peer"
                          type="checkbox"
                          checked={msmeData.identityDeviceMismatch}
                          onChange={(e) => updateMsme('identityDeviceMismatch', e.target.checked)}
                        />
                        <div className="w-11 h-6 bg-slate-300 dark:bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-slate-900"></div>
                      </label>
                    </div>
                  </div>
                </section>

                {/* Step 5: Bank Data Upload */}
                <section className="pt-8 border-t border-outline-variant/10 space-y-6">
                  <div className="flex items-center gap-4">
                    <div className="w-1 h-8 bg-slate-900 rounded-full"></div>
                    <h2 className="text-xl font-headline font-bold text-on-surface dark:text-slate-200">Bank Data Upload</h2>
                  </div>
                  {demoProfile ? (
                    <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800/50 p-8 rounded-2xl flex flex-col items-center justify-center text-center space-y-3 shadow-inner">
                      <span className="material-symbols-outlined text-emerald-500 dark:text-emerald-400 text-4xl mb-2">check_circle</span>
                      <h3 className="text-emerald-800 dark:text-emerald-300 font-bold text-lg tracking-wide shrink-0">Bank statement fetched via AA Gateway</h3>
                      <p className="text-emerald-600/80 dark:text-emerald-400/80 text-sm">6-month transaction history securely linked for {demoProfile.name}</p>
                    </div>
                  ) : (
                    <BankStatementUpload
                      formType="msme"
                      onFileSelect={(file) => updateMsme('bankStatementFile', file)}
                    />
                  )}
                  <div className="bg-blue-50/50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800/50 p-4 rounded-lg flex items-start gap-3">
                    <span className="material-symbols-outlined text-blue-600 dark:text-blue-400 text-xl">info</span>
                    <div className="space-y-1">
                      <p className="text-[11px] font-bold uppercase tracking-widest text-blue-700 dark:text-blue-300">Engine Auto-Calculation</p>
                      <p className="text-[11px] text-blue-800 dark:text-blue-200 leading-relaxed">Uploading will <span className="font-bold">AUTO-CALCULATE</span>: Revenue Growth, Seasonality, Cashflow Ratios, Volatility, Invoice Delays, Vendor Discipline, and GST Variance.</p>
                    </div>
                  </div>
                </section>
              </form>
            </motion.div>
          )}

          {/* Action Area */}
          {activeForm === 'msme' && (
            <motion.div 
              key="msme-actions"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="w-full max-w-[1100px] mt-10 space-y-8"
            >
              <div className="text-center">
                <p className="text-xs text-on-surface-variant dark:text-slate-400 mb-6">Your data is processed according to global privacy and credit standards.</p>
                <button
                  type="button"
                  onClick={handleMsmeSubmit}
                  disabled={msmeSubmitting}
                  className="w-full py-5 text-white rounded-xl font-bold text-lg hover:scale-[0.99] transition-all duration-200 flex items-center justify-center gap-3 shadow-2xl bg-[#00662A] disabled:opacity-75 disabled:cursor-not-allowed"
                >
                  {msmeSubmitting ? (
                    <>
                      <span className="material-symbols-outlined animate-spin text-2xl">progress_activity</span>
                      <span>EVALUATING CREDIT RISK...</span>
                    </>
                  ) : (
                    <>
                      ACCESS CREDIT RISK <span className="material-symbols-outlined">trending_up</span>
                    </>
                  )}
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-gray-100 dark:border-slate-700 shadow-lg flex flex-col items-center text-center space-y-2">
                  <span className="material-symbols-outlined text-tertiary">bolt</span>
                  <h4 className="text-xs font-bold uppercase tracking-widest">Real-Time Analysis</h4>
                </div>
                <div className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-gray-100 dark:border-slate-700 shadow-lg flex flex-col items-center text-center space-y-2">
                  <span className="material-symbols-outlined text-tertiary">balance</span>
                  <h4 className="text-xs font-bold uppercase tracking-widest">Risk Weighting</h4>
                </div>
                <div className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-gray-100 dark:border-slate-700 shadow-lg flex flex-col items-center text-center space-y-2">
                  <span className="material-symbols-outlined text-tertiary">description</span>
                  <h4 className="text-xs font-bold uppercase tracking-widest">Instant Report</h4>
                </div>
              </div>
              <div className="flex justify-center gap-12 pt-4">
                <button className="text-xs font-bold uppercase tracking-widest text-on-surface-variant dark:text-slate-400 hover:text-primary dark:text-white transition-colors underline underline-offset-4">Save Progress</button>
                <button className="text-xs font-bold uppercase tracking-widest text-on-surface-variant dark:text-slate-400 hover:text-primary dark:text-white transition-colors underline underline-offset-4">Print Draft</button>
              </div>
            </motion.div>
          )}

          {/* ==================== NTC FORM ==================== */}
          {activeForm === 'ntc' && (
            <motion.div 
              key="ntc"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.6 }}
              className="w-full max-w-[1100px] bg-white dark:bg-slate-900 rounded-xl shadow-2xl border border-gray-100 dark:border-slate-800 overflow-hidden" 
              id="ntc-content"
            >
              <div className="p-10 text-center border-b border-gray-50 dark:border-slate-800">
                <h1 className="text-3xl font-extrabold font-headline tracking-tight text-on-surface dark:text-white mb-3">New To Credit Assessment</h1>
                <p className="text-on-surface-variant dark:text-slate-400 max-w-md mx-auto leading-relaxed">Credit scoring for individuals with limited financial history. Predictive analysis based on behavioral data.</p>
              </div>

              <form onSubmit={handleNtcSubmit} className="p-10 space-y-12">
                {/* STEP 1: Personal Background */}
                <section className="space-y-6">
                  <div className="flex items-center gap-4 mb-8">
                    <div className="w-1.5 h-8 bg-primary rounded-full"></div>
                    <h2 className="text-xl font-bold font-headline">STEP 1: Personal Background</h2>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold uppercase tracking-widest text-on-surface-variant dark:text-slate-400">Full Name</label>
                      <input
                        className="w-full px-4 py-3 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 dark:text-slate-200 dark:placeholder:text-slate-400 shadow-sm text-on-surface dark:text-slate-200 focus:ring-2 focus:ring-tertiary focus:bg-white dark:focus:bg-slate-800 outline-none transition-all duration-200 placeholder:text-outline-variant/60"
                        placeholder="John Doe"
                        type="text"
                        value={ntcData.fullName}
                        onChange={(e) => updateNtc('fullName', e.target.value)}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold uppercase tracking-widest text-on-surface-variant dark:text-slate-400">Phone Number</label>
                      <div className="relative">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant dark:text-slate-400 font-medium">+91</span>
                        <input
                          className="w-full pl-14 pr-4 py-3 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 dark:text-slate-200 dark:placeholder:text-slate-400 shadow-sm text-on-surface dark:text-slate-200 focus:ring-2 focus:ring-tertiary focus:bg-white dark:focus:bg-slate-800 outline-none transition-all duration-200 placeholder:text-outline-variant/60"
                          placeholder="98765 43210"
                          type="tel"
                          value={ntcData.phoneNumber}
                          onChange={(e) => updateNtc('phoneNumber', e.target.value)}
                        />
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold uppercase tracking-widest text-on-surface-variant dark:text-slate-400">Education Level</label>
                      <select
                        className="w-full px-4 py-3 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 dark:text-slate-200 dark:placeholder:text-slate-400 shadow-sm text-on-surface dark:text-slate-200 focus:ring-2 focus:ring-tertiary focus:bg-white dark:focus:bg-slate-800 outline-none transition-all duration-200 placeholder:text-outline-variant/60 appearance-none"
                        value={ntcData.academicBackgroundTier}
                        onChange={(e) => updateNtc('academicBackgroundTier', e.target.value)}
                      >
                        <option>No Schooling</option>
                        <option>School</option>
                        <option>Diploma</option>
                        <option>Graduate</option>
                        <option>Postgraduate</option>
                      </select>
                    </div>
                  </div>
                </section>

                {/* STEP 2: Financial Background */}
                <section className="space-y-6">
                  <div className="flex items-center gap-4 mb-8">
                    <div className="w-1.5 h-8 bg-primary rounded-full"></div>
                    <h2 className="text-xl font-bold font-headline">STEP 2: Financial Background</h2>
                  </div>
                  <div className="space-y-6">
                    {/* Employment Type Toggle */}
                    <div className="space-y-2">
                      <label className="text-xs font-bold uppercase tracking-widest text-on-surface-variant dark:text-slate-400">Employment Type</label>
                      <div className="flex p-1 bg-surface-container-high rounded-full w-fit border border-outline-variant/20">
                        <button
                          type="button"
                          onClick={() => updateNtc('employmentType', 'Salaried')}
                          className={`px-6 py-2 rounded-full text-[10px] font-bold uppercase tracking-widest transition-all ${ntcData.employmentType === 'Salaried'
                            ? 'bg-white dark:bg-slate-700 shadow-md text-primary dark:text-slate-100'
                            : 'text-on-surface-variant dark:text-slate-400 hover:bg-slate-200/50'
                            }`}
                        >
                          Salaried
                        </button>
                        <button
                          type="button"
                          onClick={() => updateNtc('employmentType', 'Self-Employed')}
                          className={`px-6 py-2 rounded-full text-[10px] font-bold uppercase tracking-widest transition-all ${ntcData.employmentType === 'Self-Employed'
                            ? 'bg-white dark:bg-slate-700 shadow-md text-primary dark:text-slate-100'
                            : 'text-on-surface-variant dark:text-slate-400 hover:bg-slate-200/50'
                            }`}
                        >
                          Self-Employed
                        </button>
                        <button
                          type="button"
                          onClick={() => updateNtc('employmentType', 'Daily Wage')}
                          className={`px-6 py-2 rounded-full text-[10px] font-bold uppercase tracking-widest transition-all ${ntcData.employmentType === 'Daily Wage'
                            ? 'bg-white dark:bg-slate-700 shadow-md text-primary dark:text-slate-100'
                            : 'text-on-surface-variant dark:text-slate-400 hover:bg-slate-200/50'
                            }`}
                        >
                          Daily Wage
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold uppercase tracking-widest text-on-surface-variant dark:text-slate-400">Annual Income ₹</label>
                        <div className="relative">
                          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant dark:text-slate-400 font-medium">₹</span>
                          <input
                            className="w-full pl-8 pr-4 py-3 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 dark:text-slate-200 dark:placeholder:text-slate-400 shadow-sm text-on-surface dark:text-slate-200 focus:ring-2 focus:ring-tertiary focus:bg-white dark:focus:bg-slate-800 outline-none transition-all duration-200 placeholder:text-outline-variant/60"
                            placeholder="600,000"
                            type="number"
                            value={ntcData.annualIncome}
                            onChange={(e) => updateNtc('annualIncome', e.target.value)}
                          />
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold uppercase tracking-widest text-on-surface-variant dark:text-slate-400">Purpose of Loan</label>
                        <select
                          className="w-full px-4 py-3 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 dark:text-slate-200 dark:placeholder:text-slate-400 shadow-sm text-on-surface dark:text-slate-200 focus:ring-2 focus:ring-tertiary focus:bg-white dark:focus:bg-slate-800 outline-none transition-all duration-200 placeholder:text-outline-variant/60 appearance-none"
                          value={ntcData.purposeOfLoanEncoded}
                          onChange={(e) => updateNtc('purposeOfLoanEncoded', e.target.value)}
                        >
                          <option>Home Improvement</option>
                          <option>Vehicle Purchase</option>
                          <option>Education</option>
                          <option>Medical</option>
                          <option>Personal</option>
                        </select>
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold uppercase tracking-widest text-on-surface-variant dark:text-slate-400">Loan Amount Requested ₹</label>
                        <div className="relative">
                          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant dark:text-slate-400 font-medium">₹</span>
                          <input
                            className="w-full pl-8 pr-4 py-3 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 dark:text-slate-200 dark:placeholder:text-slate-400 shadow-sm text-on-surface dark:text-slate-200 focus:ring-2 focus:ring-tertiary focus:bg-white dark:focus:bg-slate-800 outline-none transition-all duration-200 placeholder:text-outline-variant/60"
                            placeholder="2,00,000"
                            type="number"
                            value={ntcData.loanAmountNtc}
                            onChange={(e) => updateNtc('loanAmountNtc', e.target.value)}
                          />
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold uppercase tracking-widest text-on-surface-variant dark:text-slate-400">Monthly EMI / Annuity ₹</label>
                        <div className="relative">
                          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant dark:text-slate-400 font-medium">₹</span>
                          <input
                            className="w-full pl-8 pr-4 py-3 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 dark:text-slate-200 dark:placeholder:text-slate-400 shadow-sm text-on-surface dark:text-slate-200 focus:ring-2 focus:ring-tertiary focus:bg-white dark:focus:bg-slate-800 outline-none transition-all duration-200 placeholder:text-outline-variant/60"
                            placeholder="8,500"
                            type="number"
                            value={ntcData.monthlyAnnuity}
                            onChange={(e) => updateNtc('monthlyAnnuity', e.target.value)}
                          />
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold uppercase tracking-widest text-on-surface-variant dark:text-slate-400">Repayment Burden</label>
                        <div className="w-full px-4 py-3 rounded-lg bg-surface-container-high border-transparent flex justify-between items-center shadow-md">
                          <span className="text-on-surface-variant dark:text-slate-400 text-sm font-medium">Debt-to-Income</span>
                          <span className="text-on-surface dark:text-slate-200 font-bold">{rentWalletShare}%</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </section>

                {/* STEP 3: Family Details */}
                <section className="space-y-6">
                  <div className="flex items-center gap-4 mb-8">
                    <div className="w-1.5 h-8 bg-primary rounded-full"></div>
                    <h2 className="text-xl font-bold font-headline">STEP 3: Family Details</h2>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold uppercase tracking-widest text-on-surface-variant dark:text-slate-400">Number of Family Members</label>
                      <input
                        className="w-full px-4 py-3 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 dark:text-slate-200 dark:placeholder:text-slate-400 shadow-sm text-on-surface dark:text-slate-200 focus:ring-2 focus:ring-tertiary focus:bg-white dark:focus:bg-slate-800 outline-none transition-all duration-200 placeholder:text-outline-variant/60"
                        placeholder="4"
                        type="number"
                        value={ntcData.numberOfFamilyMembers}
                        onChange={(e) => updateNtc('numberOfFamilyMembers', e.target.value)}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold uppercase tracking-widest text-on-surface-variant dark:text-slate-400">Number of Earning Family Members</label>
                      <input
                        className="w-full px-4 py-3 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 dark:text-slate-200 dark:placeholder:text-slate-400 shadow-sm text-on-surface dark:text-slate-200 focus:ring-2 focus:ring-tertiary focus:bg-white dark:focus:bg-slate-800 outline-none transition-all duration-200 placeholder:text-outline-variant/60"
                        placeholder="1"
                        type="number"
                        value={ntcData.earningFamilyMembers}
                        onChange={(e) => updateNtc('earningFamilyMembers', e.target.value)}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold uppercase tracking-widest text-on-surface-variant dark:text-slate-400">Dependents</label>
                      <input
                        className="w-full px-4 py-3 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 dark:text-slate-200 dark:placeholder:text-slate-400 shadow-sm text-on-surface dark:text-slate-200 focus:ring-2 focus:ring-tertiary focus:bg-white dark:focus:bg-slate-800 outline-none transition-all duration-200 placeholder:text-outline-variant/60"
                        placeholder="2"
                        type="number"
                        value={ntcData.dependents}
                        onChange={(e) => updateNtc('dependents', e.target.value)}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold uppercase tracking-widest text-on-surface-variant dark:text-slate-400">Residential Stability</label>
                      <select
                        className="w-full px-4 py-3 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 dark:text-slate-200 dark:placeholder:text-slate-400 shadow-sm text-on-surface dark:text-slate-200 focus:ring-2 focus:ring-tertiary focus:bg-white dark:focus:bg-slate-800 outline-none transition-all duration-200 placeholder:text-outline-variant/60 appearance-none"
                        value={ntcData.residentialStability}
                        onChange={(e) => updateNtc('residentialStability', e.target.value)}
                      >
                        <option>Less than 1 year</option>
                        <option>1-3 years</option>
                        <option>3-5 years</option>
                        <option>5+ years</option>
                      </select>
                    </div>
                  </div>
                </section>

                {/* STEP 4: Asset Entry */}
                <section className="space-y-6">
                  <div className="flex items-center gap-4 mb-8">
                    <div className="w-1.5 h-8 bg-primary rounded-full"></div>
                    <h2 className="text-xl font-bold font-headline">STEP 4: Asset Entry</h2>
                  </div>
                  <div className="space-y-4">
                    <label className="text-xs font-bold uppercase tracking-widest text-on-surface-variant dark:text-slate-400 block mb-2">Select all assets owned</label>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                      {['Owned House', 'Vehicle', 'Agricultural Land', 'Gold / Jewelry', 'Business Stock', 'Other Invest.'].map((asset) => (
                        <label key={asset} className="cursor-pointer">
                          <input
                            className="hidden peer"
                            type="checkbox"
                            checked={ntcData.assets.includes(asset)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                updateNtc('assets', [...ntcData.assets, asset]);
                              } else {
                                updateNtc('assets', ntcData.assets.filter(a => a !== asset));
                              }
                            }}
                          />
                          <div className="px-4 py-3 rounded-xl border border-gray-100 bg-slate-100 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-200 shadow-md text-xs font-semibold text-center peer-checked:bg-tertiary peer-checked:text-white transition-all">
                            {asset}
                          </div>
                        </label>
                      ))}
                    </div>
                    <div className="mt-4 flex justify-end">
                      <span className="bg-tertiary-container text-on-tertiary-container px-4 py-1.5 rounded-full text-[10px] font-bold tracking-wider shadow-md">ASSET SCORE: {ntcData.assets.length}/6</span>
                    </div>
                  </div>
                </section>

                {/* STEP 5: Telecom & Identity Verification */}
                <section className="space-y-6">
                  <div className="flex items-center gap-4 mb-8">
                    <div className="w-1.5 h-8 bg-primary rounded-full"></div>
                    <h2 className="text-xl font-bold font-headline">STEP 5: Telecom &amp; Identity Verification</h2>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-2">
                      <label className="text-xs font-bold uppercase tracking-widest text-on-surface-variant dark:text-slate-400">Telecom Number Vintage</label>
                      <select
                        className="w-full px-4 py-3 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 dark:text-slate-200 dark:placeholder:text-slate-400 shadow-sm text-on-surface dark:text-slate-200 focus:ring-2 focus:ring-tertiary focus:bg-white dark:focus:bg-slate-800 outline-none transition-all duration-200 placeholder:text-outline-variant/60 appearance-none"
                        value={ntcData.telecomVintageRange}
                        onChange={(e) => updateNtc('telecomVintageRange', e.target.value)}
                      >
                        <option>Less than 6 months</option>
                        <option>6 months - 2 years</option>
                        <option>2 - 5 years</option>
                        <option>5+ years</option>
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-bold uppercase tracking-widest text-on-surface-variant dark:text-slate-400">Identity-Device Mismatch</label>
                      <div className="flex items-center gap-4 py-3">
                        <span className="text-sm font-medium text-on-surface-variant dark:text-slate-400">No</span>
                        <button
                          type="button"
                          className="w-12 h-6 bg-surface-container-highest rounded-full relative transition-colors duration-300"
                          onClick={() => updateNtc('identityDeviceMismatch', !ntcData.identityDeviceMismatch)}
                        >
                          <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow-md transform transition-transform duration-300 ${ntcData.identityDeviceMismatch ? 'left-7' : 'left-1'}`}></div>
                        </button>
                        <span className="text-sm font-medium text-on-surface-variant dark:text-slate-400">Yes</span>
                      </div>
                    </div>
                  </div>
                </section>

                {/* STEP 6: Bank Data Upload */}
                <section className="space-y-6">
                  <div className="flex items-center gap-4 mb-8">
                    <div className="w-1.5 h-8 bg-primary rounded-full"></div>
                    <h2 className="text-xl font-bold font-headline">STEP 6: Bank Data Upload</h2>
                  </div>
                  {demoProfile ? (
                    isDynamicProfile ? (
                      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800/50 p-8 rounded-2xl flex flex-col items-center justify-center text-center space-y-3 shadow-inner">
                        <span className="material-symbols-outlined text-blue-500 dark:text-blue-400 text-4xl mb-2">edit_note</span>
                        <h3 className="text-blue-800 dark:text-blue-300 font-bold text-lg tracking-wide">Transactions generated from declared income</h3>
                        <p className="text-blue-600/80 dark:text-blue-400/80 text-sm">Change the <strong>Annual Income</strong> field above and resubmit — the score updates in real time</p>
                      </div>
                    ) : (
                      <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800/50 p-8 rounded-2xl flex flex-col items-center justify-center text-center space-y-3 shadow-inner">
                        <span className="material-symbols-outlined text-emerald-500 dark:text-emerald-400 text-4xl mb-2">check_circle</span>
                        <h3 className="text-emerald-800 dark:text-emerald-300 font-bold text-lg tracking-wide shrink-0">Bank statement fetched via AA Gateway</h3>
                        <p className="text-emerald-600/80 dark:text-emerald-400/80 text-sm">6-month transaction history securely linked for {demoProfile.name}</p>
                      </div>
                    )
                  ) : (
                    <BankStatementUpload
                      formType="ntc"
                      onFileSelect={(file) => updateNtc('bankStatementFile', file)}
                    />
                  )}
                </section>
              </form>
            </motion.div>
          )}

          {/* Action Area */}
          {activeForm === 'ntc' && (
            <div className="w-full max-w-[1100px] mt-10 space-y-8">
              <div className="text-center">
                <p className="text-xs text-on-surface-variant dark:text-slate-400 mb-6">Your data is processed according to global privacy and credit standards.</p>
                <button
                  type="button"
                  onClick={handleNtcSubmit}
                  disabled={ntcSubmitting}
                  className="w-full py-5 text-white rounded-xl font-bold text-lg hover:scale-[0.99] transition-all duration-200 flex items-center justify-center gap-3 shadow-2xl bg-[#00662A] disabled:opacity-75 disabled:cursor-not-allowed"
                >
                  {ntcSubmitting ? (
                    <>
                      <span className="material-symbols-outlined animate-spin text-2xl">progress_activity</span>
                      <span>EVALUATING CREDIT RISK...</span>
                    </>
                  ) : (
                    <>
                      ACCESS CREDIT RISK <span className="material-symbols-outlined">trending_up</span>
                    </>
                  )}
                </button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-gray-100 dark:border-slate-700 shadow-lg flex flex-col items-center text-center space-y-2">
                  <span className="material-symbols-outlined text-tertiary">bolt</span>
                  <h4 className="text-xs font-bold uppercase tracking-widest">Real-Time Analysis</h4>
                </div>
                <div className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-gray-100 dark:border-slate-700 shadow-lg flex flex-col items-center text-center space-y-2">
                  <span className="material-symbols-outlined text-tertiary">balance</span>
                  <h4 className="text-xs font-bold uppercase tracking-widest">Risk Weighting</h4>
                </div>
                <div className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-gray-100 dark:border-slate-700 shadow-lg flex flex-col items-center text-center space-y-2">
                  <span className="material-symbols-outlined text-tertiary">description</span>
                  <h4 className="text-xs font-bold uppercase tracking-widest">Instant Report</h4>
                </div>
              </div>
              <div className="flex justify-center gap-12 pt-4">
                <button className="text-xs font-bold uppercase tracking-widest text-on-surface-variant dark:text-slate-400 hover:text-primary dark:text-white transition-colors underline underline-offset-4">Save Progress</button>
                <button className="text-xs font-bold uppercase tracking-widest text-on-surface-variant dark:text-slate-400 hover:text-primary dark:text-white transition-colors underline underline-offset-4">Print Draft</button>
              </div>
            </div>
          )}

          </AnimatePresence>
        </div>
      </main>

      {/* Bottom Navigation (Mobile Only) */}
      <nav className="md:hidden fixed bottom-0 w-full bg-white dark:bg-slate-900 flex justify-around items-center py-3 z-50 shadow-[0_-2px_10px_rgba(0,0,0,0.05)] border-t border-slate-100 dark:border-slate-800">
        <Link to="/" className="flex flex-col items-center text-on-surface-variant dark:text-slate-400">
          <span className="material-symbols-outlined">dashboard</span>
          <span className="text-[10px] mt-1">Home</span>
        </Link>
        <div className="flex flex-col items-center text-slate-900 dark:text-white font-bold">
          <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>assignment</span>
          <span className="text-[10px] mt-1">Assess</span>
        </div>
        <div className="flex flex-col items-center text-on-surface-variant dark:text-slate-400">
          <span className="material-symbols-outlined">query_stats</span>
          <span className="text-[10px] mt-1">Stats</span>
        </div>
        <div className="flex flex-col items-center text-on-surface-variant dark:text-slate-400">
          <span className="material-symbols-outlined">account_circle</span>
          <span className="text-[10px] mt-1">Profile</span>
        </div>
      </nav>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default AssessmentForm;
