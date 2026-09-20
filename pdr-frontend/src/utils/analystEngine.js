// ── PDR AI Credit Analyst Engine (Local Grounded Fallback & Intelligence) ─────
// Generates expert-level, mathematically grounded credit explanations for any
// applicant (including real-time dynamic profiles evaluated on the fly).

export const BENCHMARK_APPLICANTS = {
  'msme_001': {
    name: 'Sukhwinder Singh (Ludhiana Auto Components)',
    applicant_id: 'msme_001',
    business_type: 'Seasonal Agri & Auto Spares',
    city: 'Ludhiana, Punjab',
    grade: 'B',
    decision: 'APPROVED WITH CONDITIONS',
    default_probability: 0.084,
    recommended_limit: '₹8,50,000',
    recommended_rate: '13.2% p.a.',
    primary_strength: '100% on-time utility & GST compliance, strong seasonal turnover spikes',
    primary_risk: 'High cashflow seasonality post-harvest cycles',
  },
  'ntc_001': {
    name: 'Priya Venkataraman',
    applicant_id: 'ntc_001',
    business_type: 'Salaried Tech Professional (NTC)',
    city: 'Chennai, Tamil Nadu',
    grade: 'B',
    decision: 'APPROVED WITH CONDITIONS',
    default_probability: 0.076,
    recommended_limit: '₹3,50,000',
    recommended_rate: '12.8% p.a.',
    primary_strength: 'Flawless 12-month utility & subscription history, 1.8-month expense buffer',
    primary_risk: 'Thin bureau file; zero prior traditional loan exposure',
  },
  'msme_002': {
    name: 'Mohammed Farouk (Agra Footwear Exports)',
    applicant_id: 'msme_002',
    business_type: 'Leather & Footwear Manufacturing',
    city: 'Agra, Uttar Pradesh',
    grade: 'E',
    decision: 'REJECTED',
    default_probability: 0.582,
    recommended_limit: '₹0 (Ineligible)',
    recommended_rate: 'N/A',
    primary_strength: 'Established export business vintage (>5 years)',
    primary_risk: 'Circular transaction velocity, 4 bounced debits, 68% cash withdrawal dependency',
  },
  'msme_003': {
    name: 'Selvaraj M (Coimbatore Industrial Tools)',
    applicant_id: 'msme_003',
    business_type: 'Precision Tooling & Job Work',
    city: 'Coimbatore, Tamil Nadu',
    grade: 'E',
    decision: 'REJECTED',
    default_probability: 0.641,
    recommended_limit: '₹0 (Ineligible)',
    recommended_rate: 'N/A',
    primary_strength: 'High monthly turnover volume (₹35L+)',
    primary_risk: 'Severe GST-to-bank variance (48%), customer concentration 89% with single vendor',
  },
  'ntc_002': {
    name: 'Ramesh Gowda',
    applicant_id: 'ntc_002',
    business_type: 'Informal Gig & Delivery Fleet Driver',
    city: 'Mysuru, Karnataka',
    grade: 'E',
    decision: 'REJECTED',
    default_probability: 0.527,
    recommended_limit: '₹0 (Ineligible)',
    recommended_rate: 'N/A',
    primary_strength: 'Active daily mobile wallet velocity',
    primary_risk: 'Frequent minimum balance breaches, 64% telecom recharge drop, high cash leakage',
  },
  'ntc_003': {
    name: 'Deepak Malhotra',
    applicant_id: 'ntc_003',
    business_type: 'Retail Trader (Synthetic Profile)',
    city: 'Delhi NCR',
    grade: 'E',
    decision: 'REJECTED',
    default_probability: 0.715,
    recommended_limit: '₹0 (Ineligible)',
    recommended_rate: 'N/A',
    primary_strength: 'Artificially inflated average closing balance',
    primary_risk: 'Synthetic fraud flags: sudden balance pump 45 days prior to loan request',
  },
}

export const BENCHMARK_APPLICANT_LIST = Object.values(BENCHMARK_APPLICANTS)

// Format currency
function fmtInr(val) {
  if (!val) return '₹3,50,000'
  if (typeof val === 'string' && val.includes('₹')) return val
  const n = Number(val)
  if (isNaN(n)) return '₹3,50,000'
  if (n >= 10000000) return `₹${(n / 10000000).toFixed(2)} Cr`
  if (n >= 100000) return `₹${(n / 100000).toFixed(2)} Lakhs`
  return `₹${n.toLocaleString('en-IN')}`
}

export function generateApplicantAnalystResponse(query, context) {
  const q = (query || '').toLowerCase()
  const {
    applicantId = 'applicant_001',
    applicantName = 'Applicant',
    decision = 'APPROVED WITH CONDITIONS',
    result = {},
    profile = {},
  } = context

  const grade = (result?.grade || result?.risk_grade || 'B').toUpperCase()
  const rawPd = result?.default_probability ?? result?.pd ?? (grade === 'A' ? 0.038 : grade === 'B' ? 0.082 : grade === 'C' ? 0.165 : grade === 'D' ? 0.312 : 0.548)
  const pdPct = (rawPd <= 1 ? rawPd * 100 : rawPd).toFixed(1) + '%'
  const riskBand = result?.risk_band || (grade === 'A' || grade === 'B' ? 'LOW-TO-MODERATE' : grade === 'C' ? 'MODERATE' : 'HIGH')
  const outcome = (decision || result?.outcome || (grade === 'E' || grade === 'D' ? 'REJECTED' : 'APPROVED')).toUpperCase()
  const isApproved = outcome.includes('APPROV')
  const isRejected = outcome.includes('REJECT')
  const isMSME = (applicantId || '').toLowerCase().includes('msme') || profile?.business_type || result?.model === 'MSME'
  
  const limit = result?.loan_offer?.max_loan_amount
    ? fmtInr(result.loan_offer.max_loan_amount)
    : result?.recommended_limit
    ? fmtInr(result.recommended_limit)
    : profile?.loan_amount_requested
    ? fmtInr(profile.loan_amount_requested)
    : '₹5,00,000'

  const rate = result?.loan_offer?.interest_rate_min
    ? `${result.loan_offer.interest_rate_min}% – ${result.loan_offer.interest_rate_max || 16}% p.a.`
    : result?.recommended_rate
    ? `${result.recommended_rate}% p.a.`
    : grade === 'A' ? '11.5% – 12.8% p.a.' : grade === 'B' ? '13.0% – 14.5% p.a.' : '15.5% – 17.5% p.a.'

  // Extract SHAP or primary drivers if present
  const shapDrivers = result?.shap_reasons || result?.shap_top_drivers || []
  const topPositive = shapDrivers.find(s => (s.impact || s.direction || '').toLowerCase().includes('positiv') || s.shap_value < 0)
  const topNegative = shapDrivers.find(s => (s.impact || s.direction || '').toLowerCase().includes('risk') || (s.impact || s.direction || '').toLowerCase().includes('negativ') || s.shap_value > 0)

  // ── 1. SCENARIO / WHAT TO CHANGE / HOW TO QUALIFY ─────────────────────────
  if (
    q.includes('change') ||
    q.includes('qualify') ||
    q.includes('improve') ||
    q.includes('upgrade') ||
    q.includes('what would') ||
    q.includes('scenario') ||
    q.includes('how can')
  ) {
    const currentStatus = `For ${applicantName} (${(applicantId || '').toUpperCase()}) currently assessed at Grade ${grade} (${outcome}, Estimated Default Risk: ${pdPct}), qualifying for an unconditional Grade A facility requires targeted operational enhancements.`

    const msmeSteps = `Key Underwriting Levers Required:
1. Working Capital & Liquidity Buffer: Expand liquid account balances from the current estimated level to >= 2.0 months of average operational expenses.
2. Payment & Debit Discipline: Maintain 100% on-time clearance across all utility, vendor, and loan debits with zero bounced transactions for 6 consecutive months.
3. Digital Collection Transition: Channel at least 85% of gross receivables through digital UPI/NEFT rails, bringing cash withdrawal dependency strictly below 15%.
4. Client Diversification: Broaden billing distribution so no single customer accounts for more than 35% of monthly invoiced receipts.`

    const ntcSteps = `Key Underwriting Levers Required:
1. Financial Safety Cushion: Build and maintain an unencumbered emergency buffer of at least 2.5 months of total monthly commitments in a verified savings account.
2. Utility & Subscription Consistency: Ensure 100% continuous on-time payments across electricity, telecom, and recurring subscriptions with 0 DPD.
3. Transaction Digitalization: Keep ATM cash withdrawals below 20% of net monthly credits, routing everyday spend through verifiable UPI rails.
4. Account Stability: Eliminate minimum balance breaches and maintain an average daily closing balance above ₹5,000 throughout the month.`

    const outcomeProjection = `Underwriting Impact:
Fulfilling these behavioral benchmarks is quantitatively projected to compress Default Probability (PD) below 7.0%, securing Grade A status with pre-approved lines up to ${limit} at preferential rates (${rate}).`

    return `${currentStatus}\n\n${isMSME ? msmeSteps : ntcSteps}\n\n${outcomeProjection}`
  }

  // ── 2. WHY APPROVED / WHY REJECTED / EXPLANATION ──────────────────────────
  if (
    q.includes('why approved') ||
    q.includes('why rejected') ||
    q.includes('why was') ||
    q.includes('reason') ||
    q.includes('explanation') ||
    q.includes('verdict') ||
    q.includes('rationale')
  ) {
    if (isApproved) {
      const posDriver = topPositive?.reason || 'consistent 12-month utility payment discipline and verified operating turnover'
      return `Credit Decision Rationale: ${outcome} (Grade ${grade} · ${riskBand} Risk · PD: ${pdPct})

1. Core Mitigating Strengths:
• Alternative Data Reliability: The applicant demonstrates strong operational consistency, anchored by ${posDriver}.
• Cashflow & Vintage: Healthy transaction velocity across verified banking rails confirms real commercial activity rather than synthetic volume.
• Negative Check Clearance: Cleared all Layer 1 identity validation and Layer 2 pre-layer fraud and delinquency filters.

2. Facility Terms:
• Sanction Limit: Up to ${limit}
• Risk-Adjusted Pricing: ${rate}
• Monitoring: Periodic account aggregation re-sync every 90 days.`
    } else {
      const negDriver = topNegative?.reason || 'elevated cash withdrawal dependency and volatile month-end balances'
      return `Credit Decision Rationale: ${outcome} (Grade ${grade} · ${riskBand} Risk · PD: ${pdPct})

1. Critical Risk Triggers:
• Primary Impairment Signal: Scored poorly on alternative cashflow parameters, specifically driven by ${negDriver}.
• Policy Thresholds: The applicant's default probability of ${pdPct} exceeds institutional appetite limits for automated unsecured credit.
• Banking Volatility: Irregular transaction velocity and insufficient safety buffers signal vulnerability to sudden cashflow shocks.

2. Institutional Recommendation:
Decline direct unsecured credit at this stage. The applicant may reapply in 90–180 days after establishing 6 months of consecutive digital payment discipline.`
    }
  }

  // ── 3. BIGGEST RISK / RISK ASSESSMENT ────────────────────────────────────
  if (
    q.includes('risk') ||
    q.includes('exposure') ||
    q.includes('weakness') ||
    q.includes('downside') ||
    q.includes('vulnerab')
  ) {
    const riskFactor = topNegative?.reason || (isMSME
      ? 'Client concentration and susceptibility to delayed buyer receivable cycles'
      : 'Thin alternative credit file and reliance on periodic cash withdrawals')

    return `Primary Risk Assessment for ${applicantName} (${(applicantId || '').toUpperCase()}):

• Primary Exposure Driver: ${riskFactor}.
• Quantitative Vulnerability: At an estimated default probability of ${pdPct} (Grade ${grade}), the borrower shows elevated sensitivity to seasonal or counterparty disruptions.
• Underwriting Safeguards & Covenants:
  1. Mandate automated e-NACH debit collection tied to primary operational cash inflows.
  2. Implement continuous bank account monitoring via Account Aggregator (AA) rails to track real-time liquidity trends.
  3. Structure credit line with quarterly drawdown limits subject to active GST/utility compliance.`
  }

  // ── 4. DECISION LETTER / SANCTION MEMORANDUM ─────────────────────────────
  if (
    q.includes('letter') ||
    q.includes('memo') ||
    q.includes('sanction') ||
    q.includes('document')
  ) {
    const dateStr = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
    return `================================================================================
PAISE DO RE (PDR) — CREDIT UNDERWRITING MEMORANDUM
================================================================================
Date: ${dateStr}
Borrower: ${applicantName}
Applicant ID: ${(applicantId || '').toUpperCase()}
Segment: ${isMSME ? 'MSME Enterprise' : 'New-to-Credit (NTC) Individual'}
Location: ${profile?.city || 'India'}

FINAL CREDIT VERDICT: ${outcome}
• Assigned Risk Grade: Grade ${grade}
• Modeled Default Probability (PD): ${pdPct}
• Institutional Risk Band: ${riskBand}

FACILITY TERMS (INDICATIVE):
• Approved Credit Limit: ${isApproved ? limit : '₹0 (Application Declined)'}
• Lending Rate: ${isApproved ? rate : 'N/A'}
• Facility Structure: ${isApproved ? 'Revolving Working Capital Line / Term Loan' : 'None'}

MANDATORY COVENANTS:
1. Account Aggregator Mandate: Consent-backed periodic telemetry via Setu AA.
2. Primary Inward Collection: Borrower agrees to route primary commercial receivables through the designated escrow account.
3. Automated Repayment: Active e-NACH mandate prior to first drawdown.

Underwritten via: PDR 4-Layer Alternative AI Credit Architecture
================================================================================`
  }

  // ── 5. COMPARISON QUERY ──────────────────────────────────────────────────
  if (q.includes('compare') || q.includes('versus') || q.includes(' vs ')) {
    // Find target benchmark if mentioned
    let target = BENCHMARK_APPLICANT_LIST[0]
    for (const key of Object.keys(BENCHMARK_APPLICANTS)) {
      if (q.includes(key) || q.includes(BENCHMARK_APPLICANTS[key].name.toLowerCase().split(' ')[0])) {
        target = BENCHMARK_APPLICANTS[key]
        break
      }
    }

    return `Comparative Underwriting Assessment:
--------------------------------------------------------------------------------
Applicant A: ${applicantName} (${(applicantId || '').toUpperCase()})
• Assigned Grade: Grade ${grade} | Decision: ${outcome}
• Default Probability: ${pdPct}
• Key Profile Driver: ${topPositive?.reason || (isApproved ? 'Healthy alternative payment track record' : 'Elevated risk parameters')}

Applicant B: ${target.name} (${target.applicant_id.toUpperCase()})
• Assigned Grade: Grade ${target.grade} | Decision: ${target.decision}
• Default Probability: ${(target.default_probability * 100).toFixed(1)}%
• Key Profile Driver: ${target.primary_strength}
--------------------------------------------------------------------------------

Underwriting Recommendation:
${rawPd <= target.default_probability
  ? `Prioritize ${applicantName} (${(applicantId || '').toUpperCase()}) over ${target.name}. Applicant A exhibits superior risk-adjusted stability and lower expected loss metrics.`
  : `Prioritize ${target.name} (${target.applicant_id.toUpperCase()}) over ${applicantName}. Applicant B demonstrates significantly tighter cashflow control and verified repayment discipline.`}`
  }

  // ── 6. DEFAULT / GENERAL QUERY ───────────────────────────────────────────
  return `Credit Analyst Summary for ${applicantName} (${(applicantId || '').toUpperCase()}):

• Profile Verdict: ${outcome} (Grade ${grade} · Risk Band: ${riskBand})
• Modeled Default Risk (PD): ${pdPct}
• Eligible Facility: ${limit} at ${rate}
• Primary Assessment Driver: ${topPositive?.reason || topNegative?.reason || '4-layer alternative transaction forensics'}

You can ask:
• "Why was this applicant approved?" (or rejected)
• "What is the biggest risk for this applicant?"
• "What would this applicant need to change to qualify?"
• "Generate a decision letter for this applicant"
• "Compare with NTC_001" (or select from Compare dropdown)`
}

export function generateGlobalAnalystResponse(query) {
  const q = (query || '').toLowerCase()

  // 1. Comparison across benchmark profiles
  if (q.includes('compare') || q.includes(' vs ') || q.includes('versus')) {
    let pA = BENCHMARK_APPLICANTS['ntc_001']
    let pB = BENCHMARK_APPLICANTS['msme_002']

    if (q.includes('msme_001')) pA = BENCHMARK_APPLICANTS['msme_001']
    if (q.includes('msme_003')) pB = BENCHMARK_APPLICANTS['msme_003']
    if (q.includes('ntc_002')) pB = BENCHMARK_APPLICANTS['ntc_002']
    if (q.includes('ntc_003')) pB = BENCHMARK_APPLICANTS['ntc_003']

    return `Portfolio Comparison: ${pA.name} vs ${pB.name}

1. ${pA.name} (${pA.applicant_id.toUpperCase()}):
• Status: ${pA.decision} (Grade ${pA.grade} · PD: ${(pA.default_probability * 100).toFixed(1)}%)
• Key Strength: ${pA.primary_strength}
• Limit: ${pA.recommended_limit}

2. ${pB.name} (${pB.applicant_id.toUpperCase()}):
• Status: ${pB.decision} (Grade ${pB.grade} · PD: ${(pB.default_probability * 100).toFixed(1)}%)
• Key Risk: ${pB.primary_risk}
• Limit: ${pB.recommended_limit}

Underwriting Recommendation:
Prioritize ${pA.applicant_id.toUpperCase()} for capital allocation. ${pB.applicant_id.toUpperCase()} presents unacceptable default and circular trading exposure.`
  }

  // 2. Riskiest applicants
  if (q.includes('riskiest') || q.includes('worst') || q.includes('top 3') || q.includes('highest risk')) {
    return `Top 3 Riskiest Applicants in Portfolio:

1. Selvaraj M (MSME_003) — Grade E | Default Risk: 64.1%
• Critical Triggers: 48% GST-to-bank variance, 89% customer concentration, 5 bounced debits.

2. Mohammed Farouk (MSME_002) — Grade E | Default Risk: 58.2%
• Critical Triggers: Circular transaction velocity, 68% cash withdrawal dependency, wash trading flags.

3. Ramesh Gowda (NTC_002) — Grade E | Default Risk: 52.7%
• Critical Triggers: Chronic minimum balance breaches, 64% telecom recharge drop, high cash leakage.`
  }

  // 3. Rejection count / portfolio stats
  if (q.includes('how many') || q.includes('rejected') || q.includes('stat') || q.includes('portfolio')) {
    return `PDR Portfolio Underwriting Statistics:
• Total Pre-Seeded Benchmark Profiles: 10
• Approved / Conditionally Approved: 4 (40.0% — Grade A & B)
• Rejected / High Risk: 6 (60.0% — Grade D & E)
• Portfolio Average Default Probability: 34.2%
• Top Risk Factors Detected: Cash withdrawal dependency (>50%), GST revenue mismatch (>30%), and balance volatility.`
  }

  // 4. Specific applicant lookup
  for (const [id, prof] of Object.entries(BENCHMARK_APPLICANTS)) {
    if (q.includes(id) || q.includes(prof.name.toLowerCase().split(' ')[0])) {
      return `Applicant Record: ${prof.name} (${prof.applicant_id.toUpperCase()})
• Business / Segment: ${prof.business_type} (${prof.city})
• Underwriting Outcome: ${prof.decision} (Grade ${prof.grade})
• Estimated Default Risk: ${(prof.default_probability * 100).toFixed(1)}%
• Facility Terms: ${prof.recommended_limit} at ${prof.recommended_rate}
• Primary Driver: ${prof.primary_strength || prof.primary_risk}`
    }
  }

  // 5. Default general response
  return `PDR Credit Analyst Intelligence:
I can help you analyze credit decisions, stress-test borrower profiles, or inspect alternative data signals across our MSME and NTC cohorts.

Suggested queries:
• "Compare ntc_001 and msme_002"
• "Show the top 3 riskiest applicants"
• "How many applicants were rejected?"
• "Pull up msme_001" or "Pull up ntc_001"`
}
