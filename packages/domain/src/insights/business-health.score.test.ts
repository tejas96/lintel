import { describe, expect, it } from 'vitest';
import { type BusinessHealthInputs, scoreBusinessHealth } from './business-health.score';

const calm: BusinessHealthInputs = {
  activeProjects: 10,
  projectsOffTrack: 0,
  projectsAtRisk: 0,
  openTasks: 60,
  overdueTasks: 0,
  blockedTasks: 0,
  staleDecisions: 0,
  peopleInView: 8,
  overloadedPeople: 0,
};

describe('business health score', () => {
  it('is 100 and healthy when nothing needs attention', () => {
    const result = scoreBusinessHealth(calm);
    expect(result).toMatchObject({ score: 100, band: 'healthy', formula: 'health-v1' });
    expect(result.contributors).toEqual([]);
    expect(result.components.every((part) => part.penalty === 0)).toBe(true);
  });

  it('subtracts each documented penalty and names the three biggest contributors', () => {
    const result = scoreBusinessHealth({
      ...calm,
      projectsOffTrack: 1,
      projectsAtRisk: 2, // (1 + 1) / 10 = 0.2 → 30 × 0.2 / 0.5 = 12
      overdueTasks: 6, // 6 / 60 = 0.1 → 25 × 0.1 / 0.2 = 12.5
      blockedTasks: 3, // 3 / 60 = 0.05 → 15 × 0.05 / 0.1 = 7.5
      staleDecisions: 2, // 15 × 2 / 5 = 6
      overloadedPeople: 1, // 1 / 8 = 0.125 → 15 × 0.125 / 0.25 = 7.5
    });
    expect(result.components.map((part) => [part.key, part.penalty])).toEqual([
      ['delivery_risk', 12],
      ['overdue_work', 12.5],
      ['blocked_work', 7.5],
      ['decisions_waiting', 6],
      ['capacity_strain', 7.5],
    ]);
    // 100 − 45.5 = 54.5, rounded to 55.
    expect(result).toMatchObject({ score: 55, band: 'at_risk' });
    expect(result.contributors.map((part) => part.key)).toEqual([
      'overdue_work',
      'delivery_risk',
      'blocked_work',
    ]);
    expect(result.contributors[0]?.summary).toBe('6 open tasks are overdue, of 60.');
  });

  it('caps every part at its weight and never goes below zero', () => {
    const result = scoreBusinessHealth({
      activeProjects: 2,
      projectsOffTrack: 2,
      projectsAtRisk: 0,
      openTasks: 10,
      overdueTasks: 10,
      blockedTasks: 10,
      staleDecisions: 40,
      peopleInView: 1,
      overloadedPeople: 1,
    });
    expect(result.components.map((part) => part.penalty)).toEqual([30, 25, 15, 15, 15]);
    expect(result).toMatchObject({ score: 0, band: 'critical' });
  });

  it('treats an empty studio as healthy instead of dividing by zero', () => {
    const result = scoreBusinessHealth({
      ...calm,
      activeProjects: 0,
      openTasks: 0,
      peopleInView: 0,
    });
    expect(result.score).toBe(100);
  });

  it('uses the bands at 80, 60 and 40', () => {
    const bandWith = (overdueTasks: number, blockedTasks = 0, staleDecisions = 0) =>
      scoreBusinessHealth({ ...calm, overdueTasks, blockedTasks, staleDecisions, openTasks: 100 });
    expect(bandWith(8)).toMatchObject({ score: 90, band: 'healthy' });
    expect(bandWith(20)).toMatchObject({ score: 75, band: 'watch' });
    expect(bandWith(20, 10)).toMatchObject({ score: 60, band: 'watch' });
    expect(bandWith(20, 10, 1)).toMatchObject({ score: 57, band: 'at_risk' });
  });
});
