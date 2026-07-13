import { describe, it, expect } from 'vitest';
import {
  countsForLeaderboard,
  computeRecallRate,
  daysToRecall,
  timeToRecallBucket,
  RECALL_RATE_MIN_JOBS,
} from './qc-recalls';

// REGRESSION GUARD (iron rule): the QC sync now writes recalls for ALL business units
// into sd_recalls_caused. The leaderboard must still count ONLY service-BU recalls.
// countsForLeaderboard() is the single source of that predicate; the leaderboard query
// uses the equivalent `.or('is_service_bu.is.null,is_service_bu.eq.true')` filter.
// If this test breaks, the leaderboard "recalls caused" number has drifted.
describe('countsForLeaderboard (leaderboard blast-radius guard)', () => {
  it('counts service-BU recalls', () => {
    expect(countsForLeaderboard({ is_service_bu: true })).toBe(true);
  });
  it('counts legacy rows (null = pre-QC, all were service-BU)', () => {
    expect(countsForLeaderboard({ is_service_bu: null })).toBe(true);
  });
  it('EXCLUDES non-service (install/plumbing) recalls — these must NOT change the leaderboard', () => {
    expect(countsForLeaderboard({ is_service_bu: false })).toBe(false);
  });
  it('a mixed all-BU set reduces to exactly the service + legacy rows', () => {
    const rows = [
      { is_service_bu: true },
      { is_service_bu: false }, // install — excluded
      { is_service_bu: null },  // legacy service — included
      { is_service_bu: false }, // plumbing — excluded
    ];
    expect(rows.filter(countsForLeaderboard).length).toBe(2);
  });
});

describe('computeRecallRate', () => {
  it('returns recalls / completed when above threshold', () => {
    expect(computeRecallRate(2, 20)).toBeCloseTo(0.1);
  });
  it('returns null below the min-jobs threshold (avoids small-sample noise)', () => {
    expect(computeRecallRate(1, RECALL_RATE_MIN_JOBS - 1)).toBeNull();
  });
  it('returns null on zero completed jobs (no divide-by-zero / fake 0%)', () => {
    expect(computeRecallRate(0, 0)).toBeNull();
  });
  it('exactly at the threshold computes a rate', () => {
    expect(computeRecallRate(1, RECALL_RATE_MIN_JOBS)).toBeCloseTo(1 / RECALL_RATE_MIN_JOBS);
  });
});

describe('daysToRecall', () => {
  it('computes whole days between original completion and recall creation', () => {
    expect(daysToRecall('2026-01-01', '2026-01-15')).toBe(14);
  });
  it('returns null when the original completion date is unknown', () => {
    expect(daysToRecall(null, '2026-01-15')).toBeNull();
  });
  it('treats a negative span (data anomaly) as unknown', () => {
    expect(daysToRecall('2026-02-01', '2026-01-01')).toBeNull();
  });
});

describe('timeToRecallBucket', () => {
  it('buckets correctly', () => {
    expect(timeToRecallBucket(3)).toBe('≤7d');
    expect(timeToRecallBucket(20)).toBe('8–30d');
    expect(timeToRecallBucket(60)).toBe('31–90d');
    expect(timeToRecallBucket(200)).toBe('90d+');
    expect(timeToRecallBucket(null)).toBe('unknown');
  });
});
