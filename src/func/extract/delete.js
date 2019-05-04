module.exports = function(operation, i) {
  let startTime = operation.t[0];
  let durationPerOperation = (operation.t[1] - operation.t[0]) / (operation.l - 1);

  let deletion = {t: null, o: []};
  // Set operation time
  deletion.t = Math.floor(startTime + i * durationPerOperation);
  if (i === operation.l - 1) {
    deletion.t = operation.t[1];
  }

  let cursorsPos = [] // for each cursor
  for (let j = 0; j < operation.o.length; j++) {
    cursorsPos.push(operation.o[j].i[1]);
    deletion.o.push({i: null});
  }

  for (let j = 0; j < operation.o.length; j++) {
    let currentDeletion = operation.o[j].d.pop();

    if (typeof(currentDeletion[0]) === 'number') {
      deletion.o[j].i = [
        [
          cursorsPos[j][0],
          cursorsPos[j][1] - currentDeletion[0]
        ],
        [
          cursorsPos[j][0],
          cursorsPos[j][1]
        ]
      ];
      cursorsPos[j][1] -= currentDeletion[0];

      if (currentDeletion[1] - 1 > 0) {
        operation.o[j].d.push([currentDeletion[0], currentDeletion[1] - 1]);
      }

    } else {
      deletion.o[j].i = [
        [
          currentDeletion[0][0], currentDeletion[0][1]
        ],
        [
          currentDeletion[1][0], currentDeletion[1][1]
        ]
      ];
      operation.o[j].i[1] = [
        currentDeletion[0][0],
        currentDeletion[0][1]
      ];
    }
  }
  return deletion;
}