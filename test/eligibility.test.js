import assert from 'assert';
import { filterEligiblePopups } from '../dist/popup-manager.esm.js';

console.log('Running Client-Side Schedule Eligibility Tests...\n');

let testsPassed = 0;

function runTest(name, fn) {
  try {
    fn();
    console.log(`✓ [PASS] ${name}`);
    testsPassed++;
  } catch (err) {
    console.error(`✗ [FAIL] ${name}`);
    console.error(err);
    process.exit(1);
  }
}

// Reference anchor time: 2026-06-15T12:00:00.000Z
const FIXED_NOW = new Date('2026-06-15T12:00:00.000Z');

function createPopup(id, start_time, end_time, title = `Popup ${id}`) {
  return {
    id,
    title,
    content: '<p>Content</p>',
    position: 'center',
    start_time,
    end_time,
  };
}

// 1. No schedule is eligible (null start_time and null end_time)
runTest('1. No schedule is eligible (null start and null end)', () => {
  const popups = [createPopup(1, null, null)];
  const result = filterEligiblePopups(popups, FIXED_NOW);
  assert.strictEqual(result.length, 1);
  assert.strictEqual(result[0].id, 1);
});

// 2. Past start with no end is eligible
runTest('2. Past start with no end is eligible', () => {
  const popups = [createPopup(2, '2026-01-01T00:00:00.000Z', null)];
  const result = filterEligiblePopups(popups, FIXED_NOW);
  assert.strictEqual(result.length, 1);
  assert.strictEqual(result[0].id, 2);
});

// 3. Future start is excluded
runTest('3. Future start is excluded', () => {
  const popups = [createPopup(3, '2026-07-01T00:00:00.000Z', null)];
  const result = filterEligiblePopups(popups, FIXED_NOW);
  assert.strictEqual(result.length, 0);
});

// 4. Future end with no start is eligible
runTest('4. Future end with no start is eligible', () => {
  const popups = [createPopup(4, null, '2026-08-01T00:00:00.000Z')];
  const result = filterEligiblePopups(popups, FIXED_NOW);
  assert.strictEqual(result.length, 1);
  assert.strictEqual(result[0].id, 4);
});

// 5. Past end is excluded
runTest('5. Past end is excluded', () => {
  const popups = [createPopup(5, null, '2026-05-01T00:00:00.000Z')];
  const result = filterEligiblePopups(popups, FIXED_NOW);
  assert.strictEqual(result.length, 0);
});

// 6. Current time within a valid schedule is eligible
runTest('6. Current time within a valid schedule is eligible', () => {
  const popups = [
    createPopup(6, '2026-06-01T00:00:00.000Z', '2026-06-30T23:59:59.000Z'),
  ];
  const result = filterEligiblePopups(popups, FIXED_NOW);
  assert.strictEqual(result.length, 1);
  assert.strictEqual(result[0].id, 6);
});

// 7. start_time === now is eligible (inclusive boundary)
runTest('7. start_time === now is eligible (inclusive boundary)', () => {
  const popups = [
    createPopup(7, '2026-06-15T12:00:00.000Z', '2026-06-30T23:59:59.000Z'),
  ];
  const result = filterEligiblePopups(popups, FIXED_NOW);
  assert.strictEqual(result.length, 1);
  assert.strictEqual(result[0].id, 7);
});

// 8. end_time === now is eligible (inclusive boundary)
runTest('8. end_time === now is eligible (inclusive boundary)', () => {
  const popups = [
    createPopup(8, '2026-06-01T00:00:00.000Z', '2026-06-15T12:00:00.000Z'),
  ];
  const result = filterEligiblePopups(popups, FIXED_NOW);
  assert.strictEqual(result.length, 1);
  assert.strictEqual(result[0].id, 8);
});

// 9. Invalid start timestamp is excluded
runTest('9. Invalid start timestamp is excluded', () => {
  const popups = [
    createPopup(9, 'not-a-valid-date-string', '2026-06-30T23:59:59.000Z'),
  ];
  const result = filterEligiblePopups(popups, FIXED_NOW);
  assert.strictEqual(result.length, 0);
});

// 10. Invalid end timestamp is excluded
runTest('10. Invalid end timestamp is excluded', () => {
  const popups = [
    createPopup(10, '2026-06-01T00:00:00.000Z', 'malformed-timestamp'),
  ];
  const result = filterEligiblePopups(popups, FIXED_NOW);
  assert.strictEqual(result.length, 0);
});

// 11. Start later than end is excluded
runTest('11. Start later than end is excluded', () => {
  const popups = [
    createPopup(11, '2026-07-01T00:00:00.000Z', '2026-06-01T00:00:00.000Z'),
  ];
  const result = filterEligiblePopups(popups, FIXED_NOW);
  assert.strictEqual(result.length, 0);
});

// 12. Input array and objects are not mutated
runTest('12. Input array and objects are not mutated', () => {
  const popup = createPopup(12, '2026-06-01T00:00:00.000Z', '2026-06-30T00:00:00.000Z');
  const inputList = [popup];
  const snapshotJson = JSON.stringify(inputList);

  const result = filterEligiblePopups(inputList, FIXED_NOW);
  assert.strictEqual(result.length, 1);
  assert.notStrictEqual(result, inputList, 'Result must be a new array');
  assert.strictEqual(JSON.stringify(inputList), snapshotJson, 'Input must not be mutated');
});

// 13. A single captured comparison time is applied consistently
runTest('13. A single captured comparison time is applied consistently', () => {
  const now = new Date('2026-06-15T12:00:00.000Z');
  const popups = [
    createPopup(1, '2026-06-15T12:00:00.000Z', null), // start === now -> eligible
    createPopup(2, null, '2026-06-15T12:00:00.000Z'), // end === now -> eligible
    createPopup(3, '2026-06-15T12:00:00.001Z', null), // start in future by 1ms -> excluded
    createPopup(4, null, '2026-06-15T11:59:59.999Z'), // end in past by 1ms -> excluded
  ];

  const result = filterEligiblePopups(popups, now);
  assert.strictEqual(result.length, 2);
  assert.strictEqual(result[0].id, 1);
  assert.strictEqual(result[1].id, 2);
});

console.log(`\nAll ${testsPassed} eligibility tests passed successfully!`);
