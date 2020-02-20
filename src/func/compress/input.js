import CONFIG from '../../config';

let longDelayCount = 0;
let longDelayAverage = 0;

/**
 * combineLongDelayInput - Test whether long delay combine happends
 *
 * @param  {object} firstChange   The first (previous) operation
 * @param  {object} secondChange  The second (later) operation
 * @return {boolean}              Judege long combine happends
 */
function combineLongDelayInput(firstChange, secondChange) {
  const minOperationDelay = CONFIG.acceptableMinOperationDelay;
  if (firstChange.delayDuration >= minOperationDelay &&
    isLongDelayInput(secondChange)) {
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
 * isLongDelayInput - Test whether it is a long delay input operation
 *
 * @param  {object} secondChange  The second (later) operation
 * @return {boolean}              Judege whether are long delay input
 */
function isLongDelayInput(secondChange) {
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
 * areInputPositionsContinue - Test whether all input positions are continue
 *
 * @param  {object} firstChange   The first (previous) operation
 * @param  {object} secondChange  The second (later) operation
 * @return {boolean}              Judege on all input positions continuity
 */
function areInputPositionsContinue(firstChange, secondChange) {
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
  return true;
}

/**
 * isContinueInput - Whether two input operations are treated continues
 *
 * @param  {object} firstChange  The first (previous) operation
 * @param  {object} secondChange The second (later) operation
 * @return {boolean}             Judege result whether operations are continues
 */
function isContinueInput(firstChange, secondChange) {
  const minOperationDelay = CONFIG.acceptableMinOperationDelay;

  if (firstChange.ops.length !== secondChange.ops.length) {
    return false; // Number of cursors differs
  } else if (secondChange.delayDuration >= minOperationDelay) {
    if (!combineLongDelayInput(firstChange, secondChange)) {
      return false;
    }
  } else if (firstChange.delayDuration >= minOperationDelay) {
    return false; // Short and long continue differs
  }
  if (!areInputPositionsContinue(firstChange, secondChange)) {
    return false;
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
      }
    }
    change.ops[i].text = compressedTexts;
  }
  return change;
}

/**
 * hasAutoClosePair - Whether input operation has auto close pair
 *
 * @param  {object} change A specified input operation
 * @return {boolean} Judege result whether operations has auto close pair
 */
function hasAutoClosePair(change) {
  const closePairs = ['()', '[]', '{}', '\'\'', '""'];
  for (let i = 0; i < change.ops.length; i++) {
    for (let j = 0; j < change.ops[i].text.length; j++) {
      if (closePairs.indexOf(change.ops[i].text[j]) >= 0) {
        return true;
      }
    }
  }
  return false;
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
    if (!hasAutoClosePair(change) && change.ops[0].origin === '+input') {
      while (changes.length > 0) {
        const lastChange = changes.pop();
        if (!hasAutoClosePair(lastChange) &&
        lastChange.ops[0].origin === '+input' &&
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
