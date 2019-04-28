const originMap = require('./origin.js');

function getInterval(operation) {
  if (operation.from.line === operation.to.line &&
      operation.from.ch === operation.to.ch) {
    return [operation.from.line, operation.from.ch];
  } else {
    return [
      [operation.from.line, operation.from.ch],
      [operation.to.line, operation.to.ch]
    ];
  }
}

module.exports = function(changes) {
  let minifiedChanges = [];

  while(changes.length > 0) {
    let change = changes.pop(); // 拿出最新的一条

    for (let i = 0; i < change.ops.length; i++) {
      change.ops[i].i = getInterval(change.ops[i]);
      change.ops[i].r = change.ops[i].removed;
      change.ops[i].a = change.ops[i].text;
      change.ops[i].o = originMap.encode(change.ops[i].origin);
      delete change.ops[i].removed;
      delete change.ops[i].text;
      delete change.ops[i].from;
      delete change.ops[i].origin;
      delete change.ops[i].to;
    }

    change.t = [change.startTime, change.endTime]
    change.l = change.combo
    change.o = change.ops

    delete change.ops;
    delete change.delayDuration;
    delete change.combo;
    delete change.startTime;
    delete change.endTime;

    minifiedChanges.unshift(change);
  }
  return minifiedChanges;
};