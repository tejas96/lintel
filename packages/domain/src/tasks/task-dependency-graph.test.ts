import { describe, expect, it } from 'vitest';
import {
  downstreamTasks,
  topologicalTaskOrder,
  unmetPrerequisites,
  wouldCreateDependencyCycle,
} from './task-dependency-graph';

// measure → layout → render → present
const edges = [
  { taskId: 'layout', dependsOnTaskId: 'measure' },
  { taskId: 'render', dependsOnTaskId: 'layout' },
  { taskId: 'present', dependsOnTaskId: 'render' },
];

describe('task dependency graph', () => {
  it('detects direct and indirect cycles', () => {
    expect(
      wouldCreateDependencyCycle(edges, { taskId: 'measure', dependsOnTaskId: 'present' }),
    ).toBe(true);
    expect(wouldCreateDependencyCycle(edges, { taskId: 'layout', dependsOnTaskId: 'layout' })).toBe(
      true,
    );
    expect(
      wouldCreateDependencyCycle(edges, { taskId: 'present', dependsOnTaskId: 'measure' }),
    ).toBe(false);
  });

  it('lists unfinished prerequisites only', () => {
    const finished = new Set(['measure']);
    expect(unmetPrerequisites('layout', edges, (id) => finished.has(id))).toEqual([]);
    expect(unmetPrerequisites('render', edges, (id) => finished.has(id))).toEqual(['layout']);
  });

  it('finds all downstream work', () => {
    expect(downstreamTasks('layout', edges).sort()).toEqual(['present', 'render']);
  });

  it('orders prerequisites first and refuses cyclic graphs', () => {
    expect(topologicalTaskOrder(['present', 'render', 'layout', 'measure'], edges)).toEqual([
      'measure',
      'layout',
      'render',
      'present',
    ]);
    const cyclic = [...edges, { taskId: 'measure', dependsOnTaskId: 'present' }];
    expect(topologicalTaskOrder(['measure', 'layout', 'render', 'present'], cyclic)).toBeNull();
  });
});
