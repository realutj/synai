import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TaskPlanner } from '../dist/planner/index.js';

test('createPlan assigns default ids and pending status', () => {
  const planner = new TaskPlanner();
  const plan = planner.createPlan([{ title: 'Write tests' }, { title: 'Ship it' }]);
  assert.equal(plan.length, 2);
  assert.equal(plan[0].id, 'task_1');
  assert.equal(plan[0].status, 'pending');
  assert.equal(plan[1].id, 'task_2');
});

test('updateTask matches by exact id even when a title would also fuzzy-match', () => {
  const planner = new TaskPlanner();
  planner.createPlan([
    { id: 'task_1', title: 'Add tests' },
    { id: 'task_2', title: 'Add tests for auth' },
  ]);

  const result = planner.updateTask('task_1', 'in_progress');
  assert.equal(result.success, true);
  assert.equal(result.task.id, 'task_1');
  assert.equal(result.task.status, 'in_progress');

  // task_2 must be untouched
  const plan = planner.getPlan();
  const task2 = plan.find((t) => t.id === 'task_2');
  assert.equal(task2.status, 'pending');
});

test('updateTask refuses an ambiguous fuzzy title match rather than guessing', () => {
  const planner = new TaskPlanner();
  planner.createPlan([
    { id: 't1', title: 'Add tests' },
    { id: 't2', title: 'Add tests for auth' },
  ]);

  // "add tests" substring-matches BOTH titles and isn't any task's exact id —
  // must fail closed instead of silently picking one.
  const result = planner.updateTask('add tests', 'completed');
  assert.equal(result.success, false);
  const plan = planner.getPlan();
  assert.ok(plan.every((t) => t.status === 'pending'), 'no task should have been mutated');
});

test('updateTask still resolves an unambiguous fuzzy title match', () => {
  const planner = new TaskPlanner();
  planner.createPlan([{ id: 't1', title: 'Refactor the auth module' }]);
  const result = planner.updateTask('refactor', 'completed');
  assert.equal(result.success, true);
  assert.equal(result.task.id, 't1');
});

test('updateTask rejects an invalid/hallucinated status instead of writing it onto the task', () => {
  const planner = new TaskPlanner();
  planner.createPlan([{ id: 't1', title: 'Do the thing' }]);
  const result = planner.updateTask('t1', 'Done');
  assert.equal(result.success, false);
  assert.match(result.error, /Invalid status/);
  const plan = planner.getPlan();
  assert.equal(plan[0].status, 'pending', 'task status must be untouched by the rejected update');
});

test('getSummary computes counts and percent complete', () => {
  const planner = new TaskPlanner();
  planner.createPlan([{ id: 'a', title: 'A' }, { id: 'b', title: 'B' }, { id: 'c', title: 'C' }, { id: 'd', title: 'D' }]);
  planner.updateTask('a', 'completed');
  planner.updateTask('b', 'in_progress');

  const summary = planner.getSummary();
  assert.equal(summary.total, 4);
  assert.equal(summary.completed, 1);
  assert.equal(summary.inProgress, 1);
  assert.equal(summary.pending, 2);
  assert.equal(summary.percent, 25);
});
