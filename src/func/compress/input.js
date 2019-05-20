import CONFIG from '../../config';

/**
 * isContinueInput - Whether two input operations are treated continues
 *
 * @param  {object} firstChange  The first (previous) operation
 * @param  {object} secondChange The second (later) operation
 * @return {boolean}             Judege result whether operations are continues
 */
function isContinueInput(firstChange, secondChange) {
  if (firstChange.ops.length !== secondChange.ops.length) {
    return false;
  } else if (secondChange.delayDuration >= CONFIG.acceptableMinOperationDelay) {
    return false;
  } else {
    for (let i = 0; i < secondChange.ops.length; i++) {
      const firstOp = firstChange.ops[i];
      const secondOp = secondChange.ops[i];
      if (secondOp.from.line !== secondOp.to.line ||
          firstOp.from.line !== firstOp.to.line ||
          secondOp.from.ch !== secondOp.to.ch ||
          firstOp.from.ch !== firstOp.to.ch) {
        return false;
      } else if (
        firstOp.from.ch + 1 !== secondOp.from.ch &&
        !(firstOp.from.line + 1 === secondOp.from.line &&
        secondOp.from.ch === 0)) { // For new line
        return false;
      }
    }
  }
  return true;
}

/**
 * compressOperationsTexts - Compress text that need to be inserted
 *
 * @param  {object} change A specified input operation
 * @return {object}        An input operation with insertion text compressed
 */
function compressOperationsTexts(change) {
  for (let i = 0; i < change.ops.length; i++) {
    let compressedTexts = '';
    for (let j = 0; j < change.ops[i].text.length; j++) {
      if (change.ops[i].text[j] !== '') {
        compressedTexts += change.ops[i].text[j];
      } else if (j + 1 < change.ops[i].text.length &&
                change.ops[i].text[j + 1] === '') {
        compressedTexts += '\n';
        j++;
      }
    }
    change.ops[i].text = compressedTexts;
  }
  return change;
}

/**
 * compressContinuousInput - Compress input operations to one if continues
 *
 * @param  {array} changes Uncompressed operations of changes
 * @return {array}         Compressed operations of changes
 */
function compressContinuousInput(changes) {
  const newChanges = [];
  while (changes.length > 0) {
    let change = changes.pop(); // Obtain the latest change
    if (change.ops[0].origin === '+input') {
      while (changes.length > 0) {
        const lastChange = changes.pop();
        if (lastChange.ops[0].origin === '+input' &&
        isContinueInput(lastChange, change)) {
          change.startTime = lastChange.startTime;
          change.delayDuration = lastChange.delayDuration;
          change.combo += 1;
          for (let i = 0; i < change.ops.length; i++) {
            change.ops[i].from = lastChange.ops[i].from;
            change.ops[i].to = lastChange.ops[i].to;
            change.ops[i].text =
              lastChange.ops[i].text.concat(change.ops[i].text);
          }
        } else {
          changes.push(lastChange);
          break;
        }
      }
      change = compressOperationsTexts(change);
      newChanges.unshift(change);
    } else {
      newChanges.unshift(change);
    }
  }
  return newChanges;
}

/**
 * export default - Compress compose operations to one if continues
 *
 * @param  {array} changes Uncompressed operations of changes
 * @return {array}         Compressed operations of changes
 */
export default function(changes) {
  return compressContinuousInput(changes);
}
