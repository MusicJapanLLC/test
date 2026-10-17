import { createHash } from 'node:crypto';
import { appendFile, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';

const VERIFIED_PROOFS = new Set(['PROVIDER_BOT_IN_CALL', 'IN_CALL_LEAVE_CONTROL', 'HOST_CONFIRMED_ATTENDANCE']);
const STOP_STATES = new Set(['HOST_DENIED', 'POLICY_BLOCKED', 'WAITING_ADMISSION', 'REQUIRES_HUMAN', 'LAUNCHED_UNVERIFIED', 'UNCERTAIN']);
const RETRY_STATES = new Set(['FAILED', 'UNAVAILABLE', 'ROUTE_AUTH_MISSING']);

export class ParticipationError extends Error {
  constructor(code) { super(code); this.name = 'ParticipationError'; this.code = code; }
}

export function parseMeetingUrl(value) {
  if (typeof value !== 'string' || value.length < 15 || value.length > 4096) throw new ParticipationError('INVALID_URL');
  let u;
  try { u = new URL(value); } catch { throw new ParticipationError('INVALID_URL'); }
  if (u.protocol !== 'https:' || u.username || u.password || u.port || u.hash) throw new ParticipationError('INVALID_URL');
  const host = u.hostname.toLowerCase();
  let platform;
  if (host === 'zoom.us' || host.endsWith('.zoom.us') || host === 'zoomgov.com' || host.endsWith('.zoomgov.com')) platform = 'zoom';
  else if (host === 'meet.google.com') platform = 'google_meet';
  else if (host === 'teams.microsoft.com' || host === 'teams.live.com' || host.endsWith('.teams.microsoft.com')) platform = 'teams';
  else throw new ParticipationError('UNSUPPORTED_PLATFORM');
  if (u.pathname === '/' || u.pathname === '') throw new ParticipationError('INVALID_MEETING_PATH');
  return {
    platform,
    meetingUrl: u.toString(),
    meetingHash: createHash('sha256').update(u.toString()).digest('hex').slice(0, 20),
  };
}

export function isVerifiedJoin(outcome) {
  return outcome?.state === 'JOINED' &&
    VERIFIED_PROOFS.has(outcome?.proof?.type) &&
    typeof outcome?.proof?.observedAt === 'string';
}

export function defaultRoutes(platform) {
  if (!['zoom','google_meet','teams'].includes(platform)) return [];
  return ['browser', 'recall', 'desktop'];
}

export function createAuditWriter(filePath) {
  return async (event) => {
    await mkdir(dirname(filePath), { recursive: true });
    const safe = {
      at: event.at,
      meetingHash: event.meetingHash,
      platform: event.platform,
      route: event.route ?? null,
      phase: event.phase,
      code: event.code ?? null,
      proofType: event.proofType ?? null,
    };
    await appendFile(filePath, JSON.stringify(safe) + '\n', { encoding: 'utf8', mode: 0o600 });
  };
}

export class ParticipationEngine {
  constructor({ adapters, audit = async () => {}, now = () => new Date() } = {}) {
    this.adapters = adapters || {};
    this.audit = audit;
    this.now = now;
    this.active = new Set();
  }
  async join(request) {
    const m = parseMeetingUrl(request?.meetingUrl);
    if (request?.authorized !== true || request?.recordingConsentConfirmed !== true || request?.live !== true)
      throw new ParticipationError('EXPLICIT_AUTHORIZATION_AND_CONSENT_REQUIRED');
    if (this.active.has(m.meetingHash)) throw new ParticipationError('MEETING_ALREADY_IN_PROGRESS');
    const opts = {
      platform: m.platform,
      meetingUrl: m.meetingUrl,
      meetingHash: m.meetingHash,
      allowBillable: request.allowBillable === true,
      joinTimeoutMs: Math.min(Math.max(Number(request.joinTimeoutMs) || 90000, 5000), 600000),
      browserProfile: request.browserProfile || null,
      browserChannel: request.browserChannel || 'msedge',
      displayName: request.displayName || 'Music Japan AI (notetaker)',
    };
    const routes = request.routes || defaultRoutes(m.platform);
    if (!Array.isArray(routes) || routes.length === 0 || routes.length > 5 || new Set(routes).size !== routes.length)
      throw new ParticipationError('INVALID_ROUTE_PLAN');
    const history = [];
    this.active.add(m.meetingHash);
    const emit = async (phase, route = null, code = null, proofType = null) =>
      this.audit({ at: this.now().toISOString(), meetingHash: m.meetingHash, platform: m.platform, phase, route, code, proofType });
    try {
      await emit('START');
      for (const route of routes) {
        const adapter = this.adapters[route];
        if (!adapter) {
          history.push({ route, state: 'UNAVAILABLE', code: 'ADAPTER_NOT_REGISTERED' });
          await emit('ROUTE_RESULT', route, 'ADAPTER_NOT_REGISTERED');
          continue;
        }
        let result;
        try {
          if (typeof adapter.probe === 'function') {
            const probe = await adapter.probe(opts);
            if (!probe?.available) {
              result = { state: 'UNAVAILABLE', code: probe?.code || 'ROUTE_NOT_READY' };
            }
          }
          if (!result) result = await adapter.join(opts);
        } catch (error) {
          result = { state: 'FAILED', code: error instanceof ParticipationError ? error.code : 'ROUTE_EXCEPTION' };
        }
        const state = result?.state || 'UNCERTAIN';
        const code = /^[A-Z0-9_]{1,80}$/.test(result?.code || '') ? result.code : state;
        const entry = { route, state, code, proofType: result?.proof?.type || null };
        history.push(entry);
        await emit('ROUTE_RESULT', route, code, entry.proofType);
        if (isVerifiedJoin(result)) {
          await emit('JOIN_CONFIRMED', route, code, entry.proofType);
          return { status: 'JOINED_VERIFIED', meetingHash: m.meetingHash, platform: m.platform, route, proof: result.proof, history };
        }
        if (state === 'JOINED' || STOP_STATES.has(state) || !RETRY_STATES.has(state)) {
          await emit('STOP_SAFELY', route, state);
          return { status: state === 'JOINED' ? 'JOIN_UNVERIFIED' : state, meetingHash: m.meetingHash, platform: m.platform, route, history };
        }
      }
      await emit('EXHAUSTED');
      return { status: 'NO_JOIN_ROUTE_AVAILABLE', meetingHash: m.meetingHash, platform: m.platform, history };
    } finally {
      this.active.delete(m.meetingHash);
    }
  }
}
