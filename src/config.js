export default {
  acceptableMinOperationDelay: 1200,
  // Actions with delay less than this value(ms) will be treated as continuous.
  acceptableMinCursorMoveDelay: 800,
  // Actions with delay less than this value(ms) will be treated as continuous.
  maxDelayBetweenOperations: 0,
  // Max delay that will be used to replace too long pause between operations.
  // Only positive value will be effective.
};
