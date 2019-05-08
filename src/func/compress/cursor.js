const CONFIG = require('../../config.js');

function isContinueCursorMove(firstChange, secondChange, direction = 1) {
  if (firstChange.crs.length !== secondChange.crs.length) {
    return false;
  } else if (secondChange.delayDuration >= CONFIG.acceptableMinCursorMoveDelay) {
    return false;
  } else {
    for (let i = 0; i < secondChange.crs.length; i++) {
      if (firstChange.crs[i].anchor.line !== firstChange.crs[i].head.line ||
          firstChange.crs[i].anchor.ch !== firstChange.crs[i].head.ch) {
        return false;
      } else if (firstChange.crs[i].anchor.ch + direction !== secondChange.crs[i].anchor.ch) { // For new line
        return false;
      } else if (firstChange.crs[i].anchor.line !== secondChange.crs[i].anchor.line) { // For new line
        return false;
      }
    }
  }
  return true;
}

function compressContinuousCursorMove(operations, direction = 1) {
  let newOperations = [];
  while(operations.length > 0) {
    let operation = operations.pop(); // Obtain the latest operation
    if ('crs' in operation) {
      while(operations.length > 0) {
        let lastOperation = operations.pop();
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

function convertCursorMoveFormat(operations) {
  for (let i = 0; i < operations.length; i++) {
    if (('crs' in operations[i])) {
      operations[i].ops = []
      for (let j = 0; j < operations[i].crs.length; j++) {
        operations[i].ops.push({
          from: operations[i].crs[j].anchor,
          to: operations[i].crs[j].head,
          origin: '+move',
          text: [''],
          removed: ['']
        })
      }
      delete operations[i].crs;
    }
  }
  return operations;
}

module.exports = function(operations) {
  operations = compressContinuousCursorMove(operations, 1);
  operations = compressContinuousCursorMove(operations, -1);
  operations = convertCursorMoveFormat(operations)
  return operations;
}