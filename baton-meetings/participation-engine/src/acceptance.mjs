/**
 * A fail-closed acceptance gate. A human reviewer must verify live evidence.
 * These metadata checks are NOT independent attestation of real meeting activity.
 * Keep raw recordings, meeting links, IDs, and people out of GitHub.
 */
export const REQUIRED_PLATFORMS = Object.freeze(['zoom', 'google_meet', 'teams']);
const METHODS = new Set(['edge','chrome','recall','desktop','telephone']);
const VALID_EVIDENCE = /^[a-z0-9][a-z0-9_.:-]{9,127}$/i;

export function evaluateThreePlatformAcceptance(candidate) {
  const verdicts = {};
  for (const platform of REQUIRED_PLATFORMS) {
    const p = candidate?.platforms?.[platform];
    const gaps = [];
    if (p?.mode !== 'live-owner-authorized') gaps.push('LIVE_TEST_NOT_PROVEN');
    if (p?.recordingConsentVerified !== true) gaps.push('CONSENT_UNVERIFIED');
    if (!METHODS.has(p?.route)) gaps.push('ROUTE_UNVERIFIED');
    if (p?.joinedVerified !== true) gaps.push('ADMISSION_UNVERIFIED');
    if (p?.hostObservedParticipant !== true) gaps.push('HOST_VIEW_UNVERIFIED');
    if (p?.audioReceivedVerified !== true) gaps.push('AUDIO_UNVERIFIED');
    if (!Number.isFinite(p?.sessionSeconds) || p.sessionSeconds < 60) gaps.push('DURATION_TOO_SHORT');
    const date = p?.verifiedAt;
    if (typeof date !== 'string' || Number.isNaN(Date.parse(date))) gaps.push('TIMESTAMP_MISSING');
    if (!Array.isArray(p?.evidenceIds) || p.evidenceIds.length < 2 ||
        p.evidenceIds.some(e => typeof e !== 'string' || !VALID_EVIDENCE.test(e))) gaps.push('PROVENANCE_MISSING');
    verdicts[platform] = { accepted: gaps.length === 0, gaps };
  }
  return {
    productionReady: REQUIRED_PLATFORMS.every(p => verdicts[p].accepted),
    platforms: verdicts,
    note: 'Evidence metadata is not independent proof. Independent human or service-side review is mandatory.',
  };
}
