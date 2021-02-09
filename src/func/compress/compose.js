/**
 * isContinueCompose - Whether two compose operations are treated continues
 *
 * @param  {object} firstChange  The first (previous) operation
 * @param  {object} secondChange The second (later) operation
 * @return {boolean}             Judge result whether operations are continues
 */
function isContinueCompose(firstChange, secondChange) {
  if (firstChange.ops.length !== secondChange.ops.length) {
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
        firstOp.from.ch + firstOp.text[0].length !== secondOp.from.ch) {
        return false;
      }
    }
  }
  return true;
}

/**
 * compressContinuousCompose - Compress compose operations to one if continues
 *
 * @param  {array} changes Uncompressed operations of changes
 * @return {array}         Compressed operations of changes
 */
function compressContinuousCompose(changes) {
  const newChanges = [];
  while (changes.length > 0) {
    const change = changes.pop(); // Obtain the latest change
    if (change.ops[0].origin === '*compose') {
      while (changes.length > 0) {
        const lastChange = changes.pop();
        if (lastChange.ops[0].origin === '*compose' &&
        isContinueCompose(lastChange, change)) {
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
  return compressContinuousCompose(changes);
}
