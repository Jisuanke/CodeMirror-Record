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

function minifyTime(timeInterval) {
  if (timeInterval[0] === timeInterval[1]) {
    return timeInterval[0];
  } else {
    return timeInterval;
  }
}

module.exports = function(changes) {
  let minifiedChanges = [];

  while(changes.length > 0) {
    let change = changes.pop(); // 拿出最新的一条

    for (let i = 0; i < change.ops.length; i++) {
      change.ops[i].i = getInterval(change.ops[i]);
      change.ops[i].a = change.ops[i].text;
      change.ops[i].d = change.ops[i].removed;
      change.ops[i].o = originMap.encode(change.ops[i].origin);

      if (change.ops[i].a.length === 1 &&
          change.ops[i].a[0] === '') {
        delete change.ops[i].a;
      }

      if (change.ops[i].d.length === 1 &&
          change.ops[i].d[0] === '') {
        delete change.ops[i].d;
      }

      if (change.combo === 1) {
        delete change.ops[i].d
      }

      delete change.ops[i].removed;
      delete change.ops[i].text;
      delete change.ops[i].from;
      delete change.ops[i].origin;
      delete change.ops[i].to;
    }

    change.t = this.minifyTime([change.startTime, change.endTime]);
    change.l = change.combo
    change.o = change.ops

    if (change.l === 1) {
      delete change.l;
    }

    delete change.ops;
    delete change.delayDuration;
    delete change.combo;
    delete change.startTime;
    delete change.endTime;

    minifiedChanges.unshift(change);
  }
  return minifiedChanges;
};