const CONFIG = require('../../config.js');

function isContinueInput(firstChange, secondChange) { // 判断是否可以被视为连续输入
  if (firstChange.ops.length !== secondChange.ops.length) {
    return false;
  } else if (secondChange.delayDuration >= CONFIG.acceptableMinDelay) {
    return false;
  } else {
    for (let i = 0; i < secondChange.ops.length; i++) {
      if (secondChange.ops[i].from.line !== secondChange.ops[i].to.line ||
          firstChange.ops[i].from.line !== firstChange.ops[i].to.line ||
          secondChange.ops[i].from.ch !== secondChange.ops[i].to.ch ||
          firstChange.ops[i].from.ch !== firstChange.ops[i].to.ch) {
        return false;
      } else if (firstChange.ops[i].from.ch + 1 !== secondChange.ops[i].from.ch && // 同行的下一个字符
        !(firstChange.ops[i].from.line + 1 === secondChange.ops[i].from.line && secondChange.ops[i].from.ch === 0)) { // 换行的情况
        return false;
      }
    }
  }
  return true;
}

function compressOperationsTexts(change) {
  for (let i = 0; i < change.ops.length; i++) {
    let compressedTexts = '';
    for (let j = 0; j < change.ops[i].text.length; j++) {
      if (change.ops[i].text[j] !== '') {
        compressedTexts += change.ops[i].text[j];
      } else if (j + 1 < change.ops[i].text.length &&
                change.ops[i].text[j + 1] === ''){
        compressedTexts += '\n';
        j++;
      }
    }
    change.ops[i].textw = compressedTexts;
  }
  return change;
}

function compressContinuousInput(changes) { // 对连续输入进行压缩
  let newChanges = [];
  while(changes.length > 0) {
    let change = changes.pop(); // 拿出最新的一条
    if (change.ops[0].origin === '+input') {
      while(changes.length > 0) {
        let lastChange = changes.pop();
        if (lastChange.ops[0].origin === '+input' &&
        isContinueInput(lastChange, change)) {
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
      change = compressOperationsTexts(change);
      newChanges.unshift(change);
    } else {
      newChanges.unshift(change);
    }
  }
  return newChanges;
}

module.exports = function(changes) {
  return compressContinuousInput(changes);
}