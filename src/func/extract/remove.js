/**
 * export default - Extract compressed remove operation
 *
 * @param  {object} op  A specified compressed remove operation
 * @param  {number} i   Operation index
 * @return {object}     Extracted remove operation
 */
export default function(op, i) {
  const startTime = op.t[0];
  const durationPerOperation = (op.t[1] - op.t[0]) / (op.l - 1);

  const deletion = {t: null, o: [], type: 'content'};
  // Set operation time
  deletion.t = Math.floor(startTime + i * durationPerOperation);
  if (i === op.l - 1) {
    deletion.t = op.t[1];
  }

  const cursorsPos = []; // for each cursor
  for (let j = 0; j < op.o.length; j++) {
    cursorsPos.push(op.o[j].i[1]);
    deletion.o.push({i: null});
  }

  for (let j = 0; j < op.o.length; j++) {
    const currentDeletion = op.o[j].d.pop();

    if (typeof(currentDeletion[0]) === 'number') {
      deletion.o[j].i = [
        [
          cursorsPos[j][0],
          cursorsPos[j][1] - currentDeletion[0],
        ],
        [
          cursorsPos[j][0],
          cursorsPos[j][1],
        ],
      ];
      cursorsPos[j][1] -= currentDeletion[0];

      if (currentDeletion[1] - 1 > 0) {
        op.o[j].d.push([currentDeletion[0], currentDeletion[1] - 1]);
      }
    } else {
      deletion.o[j].i = [
        [
          currentDeletion[0][0], currentDeletion[0][1],
        ],
        [
          currentDeletion[1][0], currentDeletion[1][1],
        ],
      ];
      op.o[j].i[1] = [
        currentDeletion[0][0],
        currentDeletion[0][1],
      ];
    }
  }
  return deletion;
}
