const CONFIG = require('../../config.js');

function isContinueDelete(firstChange, secondChange) {
  if (firstChange.ops.length !== secondChange.ops.length) {
    return false;
  } else if (secondChange.delayDuration >= CONFIG.acceptableMinOperationDelay) {
    return false;
  } else {
    for (let i = 0; i < secondChange.ops.length; i++) {
      if (firstChange.ops[i].from.ch !== secondChange.ops[i].to.ch ||
          firstChange.ops[i].from.line !== secondChange.ops[i].to.line) {
        return false;
      }
    }
  }
  return true;
}

function compressOperationsRemovals(change) {
  // 这里对已经压缩合并过的删除行为进行一下进一步和压缩表示，
  // 将部分操作变为计数，而不再存它的内容（因为不需要存，我们可以算出来）
  // https://git.jisuan.ren/haoranyu/codemirror-record/issues/2
  if (change.combo === 1) return change; // Non-compressed removel
  for (let i = 0; i < change.ops.length; i++) {
    let resultArray = [];
    let countStack = [];
    while (change.ops[i].removed.length > 0) {
      let head = change.ops[i].removed.shift();
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
          [head[1].line, head[1].ch]
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

function compressContinuousDelete(changes) {
  let newChanges = [];
  while(changes.length > 0) {
    let change = changes.pop();
    if (change.ops[0].origin === '+delete') {
      while(changes.length > 0) {
        let lastChange = changes.pop();
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
              lastChange.ops[i].removed = [[lastChange.ops[i].from, lastChange.ops[i].to]];
            }

            // Combine changes and change the end time
            change.ops[i].removed = change.ops[i].removed.concat(lastChange.ops[i].removed);
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

module.exports = function(changes) {
  return compressContinuousDelete(changes);
}