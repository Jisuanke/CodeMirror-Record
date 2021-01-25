import originMap from './origin';

/**
 * getInterval - compress interval object to array
 *
 * @param  {object} operation description
 * @return {array}           description
 */
function getInterval(operation) {
  if (operation.from.line === operation.to.line &&
      operation.from.ch === operation.to.ch) {
    return [operation.from.line, operation.from.ch];
  } else {
    return [
      [operation.from.line, operation.from.ch],
      [operation.to.line, operation.to.ch],
    ];
  }
}

/**
 * minifyTime - Remove duplication of identical startTime and endTime
 *
 * @param  {array} timeInterval Time interval of an operation
 * @return {array|number}       Minify to single number if startTime is endTime
 */
function minifyTime(timeInterval) {
  if (timeInterval[0] === timeInterval[1]) {
    return timeInterval[0];
  } else {
    return timeInterval;
  }
}

/**
 * export default - Minify operations by abbreviate keys and objects -> arrays
 *
 * @param  {array} operations Original operations
 * @return {array}            Minified operations
 */
export default function(operations) {
  const minifiedOperations = [];

  while (operations.length > 0) {
    const operation = operations.pop(); // Obtain the latest operation

    for (let i = 0; i < operation.ops.length; i++) {
      operation.ops[i].o = originMap.encode(operation.ops[i].origin);
      if (operation.ops[i].origin !== 'extra') {
        operation.ops[i].i = getInterval(operation.ops[i]);
        operation.ops[i].a = operation.ops[i].text;
        operation.ops[i].d = operation.ops[i].removed;

        if (operation.ops[i].a.length === 1 &&
            operation.ops[i].a[0] === '') {
          delete operation.ops[i].a;
        }

        if (operation.ops[i].d.length === 1 &&
            operation.ops[i].d[0] === '') {
          delete operation.ops[i].d;
        }

        if ('select' in operation.ops[i]) {
          operation.ops[i].s = operation.ops[i].select;
          delete operation.ops[i].select;
        }
      }
      if (operation.combo === 1) {
        delete operation.ops[i].d;
      }

      delete operation.ops[i].removed;
      delete operation.ops[i].text;
      delete operation.ops[i].from;
      delete operation.ops[i].origin;
      delete operation.ops[i].to;
    }

    operation.t = minifyTime([operation.startTime, operation.endTime]);
    operation.l = operation.combo;
    operation.o = operation.ops;

    if (operation.l === 1) {
      delete operation.l;
    }

    delete operation.ops;
    delete operation.delayDuration;
    delete operation.combo;
    delete operation.startTime;
    delete operation.endTime;

    minifiedOperations.unshift(operation);
  }
  return minifiedOperations;
}
