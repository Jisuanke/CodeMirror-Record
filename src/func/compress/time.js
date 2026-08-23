/**
 * Test whether combining two operations produces an interval timestamp that
 * every published v1 player can expand when `l` is greater than one.
 *
 * @param {object} firstOperation Earlier operation or compressed group
 * @param {object} secondOperation Later operation or compressed group
 * @return {boolean} Whether the combined timestamp is expandable by v1
 */
export function hasLegacyExpandableTimeRange(
    firstOperation,
    secondOperation,
) {
  return firstOperation.startTime !== secondOperation.endTime;
}
