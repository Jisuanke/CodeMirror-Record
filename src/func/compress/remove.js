import CONFIG from '../../config';

let longDelayCount = 0;
let longDelayAverage = 0;

/**
 * combineLongDelayDelete - Test whether long delay combine happens
 *
 * @param  {object} firstChange   The first (previous) operation
 * @param  {object} secondChange  The second (later) operation
 * @return {boolean}              Judge long combine happens
 */
function combineLongDelayDelete(firstChange, secondChange) {
  const minOperationDelay = CONFIG.acceptableMinOperationDelay;
  if (firstChange.delayDuration >= minOperationDelay &&
    isLongDelayDelete(secondChange)) {
    longDelayAverage = (longDelayAverage * longDelayCount
      + secondChange.delayDuration) / (longDelayCount + 1);
    longDelayCount++;
    return true;
  }
  longDelayCount = 0;
  longDelayAverage = 0;
  return false;
}

/**
 * isLongDelayInput - Test whether it is a long delay delete operation
 *
 * @param  {object} secondChange  The second (later) operation
 * @return {boolean}              Judge whether are long delay delete
 */
function isLongDelayDelete(secondChange) {
  const halfOperationDelay = CONFIG.acceptableMinOperationDelay / 2;
  const delayDuration = secondChange.delayDuration;
  if (longDelayCount !== 0) {
    if (delayDuration >= longDelayAverage + halfOperationDelay) {
      return false;
    } else if (delayDuration <= longDelayAverage - halfOperationDelay) {
      return false;
    }
  }
  return true;
}

/**
 * areDeletePositionsContinue - Whether all positions of delete are continue
 *
 * @param  {object} firstChange   The first (previous) operation
 * @param  {object} secondChange  The second (later) operation
 * @return {boolean}              Judge on continuity of all positions of delete
 */
function areDeletePositionsContinue(firstChange, secondChange) {
  for (let i = 0; i < secondChange.ops.length; i++) {
    const firstOp = firstChange.ops[i];
    const secondOp = secondChange.ops[i];
    if (firstOp.from.ch !== secondOp.to.ch ||
      firstOp.from.line !== secondOp.to.line) {
      return false;
    }
  }
  return true;
}

/**
 * isContinueDelete - Whether two delete operations are treated continues
 *
 * @param  {object} firstChange  The first (previous) operation
 * @param  {object} secondChange The second (later) operation
 * @return {boolean}             Judge result whether operations are continues
 */
function isContinueDelete(firstChange, secondChange) {
  const minOperationDelay = CONFIG.acceptableMinOperationDelay;

  if (firstChange.ops.length !== secondChange.ops.length) {
    return false; // Number of cursors differs
  } else if (secondChange.delayDuration >= minOperationDelay) {
    if (!combineLongDelayDelete(firstChange, secondChange)) {
      return false;
    }
  } else if (firstChange.delayDuration >= minOperationDelay) {
    return false; // Short and long continue differs
  }

  if (!areDeletePositionsContinue(firstChange, secondChange)) {
    return false;
  }
  return true;
}

/**
 * compressOperationsRemovals - Compress text that need to be inserted
 *
 * @param  {object} change A specified delete operation
 * @return {object}        An delete operation of compress representation
 */
function compressOperationsRemovals(change) {
  // 这里对已经压缩合并过的删除行为进行一下进一步和压缩表示，
  // 将部分操作变为计数，而不再存它的内容（因为不需要存，我们可以算出来）
  // https://git.jisuan.ren/haoranyu/codemirror-record/issues/2
  if (change.combo === 1) return change; // Non-compressed removal
  for (let i = 0; i < change.ops.length; i++) {
    const resultArray = [];
    let countStack = [];
    while (change.ops[i].removed.length > 0) {
      const head = change.ops[i].removed.shift();
      if (typeof(head) === 'string') {
        if (countStack.length === 0) {
          countStack.push(head);
        } else {
          if (countStack[0].length === head.length) {
            countStack.push(head);
          } else {
            resultArray.push([countStack[0].length, countStack.length]);
            countStack = [];
            countStack.push(head);
          }
        }
      } else {
        if (countStack.length > 0) {
          resultArray.push([countStack[0].length, countStack.length]);
          countStack = [];
        }
        resultArray.push([
          [head[0].line, head[0].ch],
          [head[1].line, head[1].ch],
        ]);
      }
    }
    if (countStack.length > 0) {
      resultArray.push([countStack[0].length, countStack.length]);
    }
    change.ops[i].removed = resultArray;
  }
  return change;
}

/**
 * compressContinuousDelete - Compress delete operations to one if continues
 *
 * @param  {array} changes Uncompressed operations of changes
 * @return {array}         Compressed operations of changes
 */
function compressContinuousDelete(changes) {
  const newChanges = [];
  while (changes.length > 0) {
    let change = changes.pop();
    if (change.ops[0].origin === '+delete') {
      while (changes.length > 0) {
        const lastChange = changes.pop();
        if (lastChange.ops[0].origin === '+delete' &&
        isContinueDelete(lastChange, change)) {
          change.startTime = lastChange.startTime;
          change.delayDuration = lastChange.delayDuration;
          for (let i = 0; i < change.ops.length; i++) {
            // The two following two loops compress deletions of multiple lines
            if (change.combo === 1 && change.ops[i].removed.length > 1) {
              change.ops[i].removed = [[change.ops[i].from, change.ops[i].to]];
            }
            if (lastChange.ops[i].removed.length > 1) {
              lastChange.ops[i].removed = [
                [lastChange.ops[i].from, lastChange.ops[i].to],
              ];
            }

            // Combine changes and change the end time
            change.ops[i].removed =
              change.ops[i].removed.concat(lastChange.ops[i].removed);
            change.ops[i].to = lastChange.ops[i].to;
          }
          change.combo += 1;
        } else {
          changes.push(lastChange);
          break;
        }
      }
      change = compressOperationsRemovals(change);
      newChanges.unshift(change);
    } else {
      newChanges.unshift(change);
    }
  }
  return newChanges;
}

/**
 * export default - Compress delete operations to one if continues
 *
 * @param  {array} changes Uncompressed operations of changes
 * @return {array}         Compressed operations of changes
 */
export default function(changes) {
  return compressContinuousDelete(changes);
}
