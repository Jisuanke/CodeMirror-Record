/**
 * export default - Extract compressed input operation
 *
 * @param  {object} op  A specified compressed input operation
 * @param  {number} i   Operation index
 * @return {object}     Extracted input operation
 */
export default function(op, i) {
  const startTime = op.t[0];
  const durationPerOperation = (op.t[1] - op.t[0]) / (op.l - 1);

  const insertion = {t: null, o: []};
  // Set operation time
  insertion.t = Math.floor(startTime + i * durationPerOperation);
  if (i === op.l - 1) {
    insertion.t = op.t[1];
  }

  insertion.cursorOnly = false;

  const cursorsPos = []; // for each cursor
  for (let j = 0; j < op.o.length; j++) {
    cursorsPos.push(op.o[j].i);
    insertion.o.push({a: null, i: null});
  }

  for (let j = 0; j < op.o.length; j++) { // for each cursor
    insertion.o[j].a = op.o[j].a[i];
    insertion.o[j].i = [cursorsPos[j][0], cursorsPos[j][1]];
    if (insertion.o[j].a !== '\n') {
      cursorsPos[j][1]++;
    } else {
      cursorsPos[j][0]++;
      cursorsPos[j][1] = 0;
    }
  }
  return insertion;
}
