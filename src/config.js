export default {
  acceptableMinOperationDelay: 1200,
  // Actions with delay less than this value(ms) will be treated as continuous.
  acceptableMinCursorMoveDelay: 800,
  // Actions with delay less than this value(ms) will be treated as continuous.
  maxPauseBetweenOperations: 0,
  // Max pause that will be used to replace too long pause between operations.
  // Only positive value will be effective.
};
