/**
 * export default - Extract compressed compose operation
 *
 * @param  {object} op  A specified compose operation
 * @param  {number} i   Operation index
 * @return {object}     Extracted compose operation
 */
export default function(op, i) {
  const startTime = op.t[0];
  const durationPerOperation = (op.t[1] - op.t[0]) / (op.l - 1);

  const composition = {t: null, o: []};
  // Set operation time
  composition.t = Math.floor(startTime + i * durationPerOperation);
  if (i === op.l - 1) {
    composition.t = op.t[1];
  }

  const cursorsPos = []; // for each cursor
  for (let j = 0; j < op.o.length; j++) {
    cursorsPos.push(op.o[j].i);
    composition.o.push({a: null, i: null});
  }

  for (let j = 0; j < op.o.length; j++) { // for each cursor
    composition.o[j].a = op.o[j].a[i];
    composition.o[j].i = [cursorsPos[j][0], cursorsPos[j][1]];
    cursorsPos[j][1] += op.o[j].a[i].length;
  }
  return composition;
}
