/**
 * export default - Extract cursor movement
 *
 * @param  {object} op  A specified cursor movement record
 * @param  {number} i   Operation index
 * @return {object}     Extracted cursor movement operation
 */
export default function(op, i) {
  const startTime = op.t[0];
  const durationPerOperation = (op.t[1] - op.t[0]) / (op.l - 1);

  const cursor = {t: null, o: [], type: 'cursor'};
  // Set operation time
  cursor.t = Math.floor(startTime + i * durationPerOperation);
  if (i === op.l - 1) {
    cursor.t = op.t[1];
  }

  const cursorsPos = []; // for each cursor
  for (let j = 0; j < op.o.length; j++) {
    cursorsPos.push(op.o[j].i);
    cursor.o.push({i: null});
  }

  for (let j = 0; j < op.o.length; j++) { // for each cursor
    const posLine = cursorsPos[j][0][0];
    const posCh = cursorsPos[j][0][1] +
      (cursorsPos[j][1][1] - cursorsPos[j][0][1]) / (op.l - 1) * i;
    cursor.o[j].i = [posLine, posCh];
  }
  return cursor;
}
