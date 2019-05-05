function isContinueCompose(firstChange, secondChange) {
  if (firstChange.ops.length !== secondChange.ops.length) {
    return false;
  } else {
    for (let i = 0; i < secondChange.ops.length; i++) {
      if (secondChange.ops[i].from.line !== secondChange.ops[i].to.line ||
          firstChange.ops[i].from.line !== firstChange.ops[i].to.line ||
          secondChange.ops[i].from.ch !== secondChange.ops[i].to.ch ||
          firstChange.ops[i].from.ch !== firstChange.ops[i].to.ch) {
        return false;
      } else if (firstChange.ops[i].from.ch + firstChange.ops[i].text[0].length !== secondChange.ops[i].from.ch) {
        return false;
      }
    }
  }

  return true;
}

function compressContinuousCompose(changes) {
  let newChanges = [];
  while(changes.length > 0) {
    let change = changes.pop(); // Obtain the latest change
    if (change.ops[0].origin === '*compose') {
      while(changes.length > 0) {
        let lastChange = changes.pop();
        if (lastChange.ops[0].origin === '*compose' &&
        isContinueCompose(lastChange, change)) {
          change.startTime = lastChange.startTime;
          change.delayDuration = lastChange.delayDuration;
          change.combo += 1;
          for (let i = 0; i < change.ops.length; i++) {
            change.ops[i].from = lastChange.ops[i].from;
            change.ops[i].to = lastChange.ops[i].to;
            change.ops[i].text = lastChange.ops[i].text.concat(change.ops[i].text);
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

module.exports = function(changes) {
  return compressContinuousCompose(changes);
}