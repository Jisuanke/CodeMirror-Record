import CONFIG from '../../config';

/**
 * isContinueCursorMove - Whether two cursor moves are treated continues
 *
 * @param  {object} firstChange   The first (previous) operation
 * @param  {object} secondChange  The second (later) operation
 * @param  {number} direction = 1 The direction of current cursor movement
 * @return {boolean}              Judege result whether moves are continues
 */
function isContinueCursorMove(firstChange, secondChange, direction = 1) {
  if (firstChange.crs.length !== secondChange.crs.length) {
    return false;
  } else if (
    secondChange.delayDuration >= CONFIG.acceptableMinCursorMoveDelay) {
    return false;
  } else {
    for (let i = 0; i < secondChange.crs.length; i++) {
      const firstCh = firstChange.crs[i];
      const secondCh = secondChange.crs[i];
      if (firstCh.anchor.line !== firstCh.head.line ||
          firstCh.anchor.ch !== firstCh.head.ch) {
        return false;
      } else if (
        firstChange.crs[i].anchor.ch + direction !== secondCh.anchor.ch) {
        return false;
      } else if (firstChange.crs[i].anchor.line !== secondCh.anchor.line) {
        return false;
      }
    }
  }
  return true;
}

/**
 * compressContinuousCursorMove - Compress cursor moves to one if continues
 *
 * @param  {array}  operations      Uncompressed operations of changes
 * @param  {number} direction = 1   The direction of current cursor movement
 * @return {array}                  Compressed operations of changes
 */
function compressContinuousCursorMove(operations, direction = 1) {
  const newOperations = [];
  while (operations.length > 0) {
    const operation = operations.pop(); // Obtain the latest operation
    if ('crs' in operation) {
      while (operations.length > 0) {
        const lastOperation = operations.pop();
        if (('crs' in lastOperation) &&
        isContinueCursorMove(lastOperation, operation, direction)) {
          operation.startTime = lastOperation.startTime;
          operation.delayDuration = lastOperation.delayDuration;
          operation.combo += 1;
          for (let i = 0; i < operation.crs.length; i++) {
            operation.crs[i].anchor = lastOperation.crs[i].anchor;
          }
        } else {
          operations.push(lastOperation);
          break;
        }
      }
      newOperations.unshift(operation);
    } else {
      newOperations.unshift(operation);
    }
  }
  return newOperations;
}

/**
 * convertCursorMoveFormat - Convert cursor move records to standard operations
 *
 * @param  {array} operations Cursor move records
 * @return {array}            Cursor move records with standard format
 */
function convertCursorMoveFormat(operations) {
  for (let i = 0; i < operations.length; i++) {
    if (('crs' in operations[i])) {
      operations[i].ops = [];
      for (let j = 0; j < operations[i].crs.length; j++) {
        operations[i].ops.push({
          from: operations[i].crs[j].anchor,
          to: operations[i].crs[j].head,
          origin: '+move',
          text: [''],
          removed: [''],
        });
      }
      delete operations[i].crs;
    }
  }
  return operations;
}

/**
 * export default - Compress cursor moves to one if continues
 *
 * @param  {array} operations Uncompressed operations of cursor moves
 * @return {array}            Compressed operations of cursor moves
 */
export default function(operations) {
  operations = compressContinuousCursorMove(operations, 1);
  operations = compressContinuousCursorMove(operations, -1);
  operations = convertCursorMoveFormat(operations);
  return operations;
}
