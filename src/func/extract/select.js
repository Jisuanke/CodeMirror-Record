/**
 * extractToPostions - Extract compressed selection "to positions"
 *
 * @param  {array} toPos The description of compressed selection "to positions"
 * @return {array}       Extracted selection "to positions" array
 */
function extractToPostions(toPos) {
  const toPositions = [];
  for (let i = 0; i < toPos.length; i++) {
    for (let j = 0; j < toPos[i][1].length; j++) {
      if (typeof(toPos[i][1][j]) === 'number') {
        toPositions.push([toPos[i][0], toPos[i][1][j]]);
      } else {
        const direction = toPos[i][1][j][0] < toPos[i][1][j][1] ? 1 : -1;
        let ch = toPos[i][1][j][0];
        toPositions.push([toPos[i][0], ch]);
        while (ch !== toPos[i][1][j][1]) {
          ch += direction;
          toPositions.push([toPos[i][0], ch]);
        }
      }
    }
  }
  return toPositions;
}

/**
 * export default - Extract selection operation
 *
 * @param  {object} op  A specified selection operation
 * @param  {number} i   Operation index
 * @return {object}     Extracted selection operation
 */
export default function(op, i) {
  const startTime = op.t[0];
  const durationPerOperation = (op.t[1] - op.t[0]) / (op.l - 1);

  const selection = {t: null, o: []};
  // Set operation time
  selection.t = Math.floor(startTime + i * durationPerOperation);
  if (i === op.l - 1) {
    selection.t = op.t[1];
  }

  const cursorsPos = []; // for each cursor
  for (let j = 0; j < op.o.length; j++) {
    cursorsPos.push(op.o[j].i);
    selection.o.push({i: null});
  }

  for (let j = 0; j < op.o.length; j++) { // for each cursor
    const fromPos = [
      op.o[j].i[0],
      op.o[j].i[1],
    ];
    const toPostions = extractToPostions(op.o[j].s);
    const toPos = [
      toPostions[i][0],
      toPostions[i][1],
    ];

    selection.o[j].i = [fromPos, toPos];
  }
  return selection;
}
