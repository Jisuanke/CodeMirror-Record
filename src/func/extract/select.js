function extractToPostions(toPos) {
  let toPositions = [];
  for (let i = 0; i < toPos.length; i++) {
    for (let j = 0; j < toPos[i][1].length; j++) {
      if (typeof(toPos[i][1][j]) === 'number') {
        toPositions.push([toPos[i][0], toPos[i][1][j]]);
      } else {
        let direction = toPos[i][1][j][0] < toPos[i][1][j][1] ? 1 : -1;
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

module.exports = function(operation, i) {
  let startTime = operation.t[0];
  let durationPerOperation = (operation.t[1] - operation.t[0]) / (operation.l - 1);

  let selection = {t: null, o: []};
  // Set operation time
  selection.t = Math.floor(startTime + i * durationPerOperation);
  if (i === operation.l - 1) {
    selection.t = operation.t[1];
  }

  selection.cursorOnly = true;

  let cursorsPos = [] // for each cursor
  for (let j = 0; j < operation.o.length; j++) {
    cursorsPos.push(operation.o[j].i);
    selection.o.push({ i: null });
  }

  for (let j = 0; j < operation.o.length; j++) { // for each cursor

    let fromPos = [
      operation.o[j].i[0],
      operation.o[j].i[1]
    ];
    let toPostions = extractToPostions(operation.o[j].s);
    let toPos = [
      toPostions[i][0],
      toPostions[i][1]
    ];

    selection.o[j].i = [fromPos, toPos];
  }
  return selection;
}