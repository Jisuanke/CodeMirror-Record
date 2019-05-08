module.exports = function(operation, i) {
  let startTime = operation.t[0];
  let durationPerOperation = (operation.t[1] - operation.t[0]) / (operation.l - 1);

  let cursor = {t: null, o: []};
  // Set operation time
  cursor.t = Math.floor(startTime + i * durationPerOperation);
  if (i === operation.l - 1) {
    cursor.t = operation.t[1];
  }

  cursor.cursorOnly = true;

  let cursorsPos = [] // for each cursor
  for (let j = 0; j < operation.o.length; j++) {
    cursorsPos.push(operation.o[j].i);
    cursor.o.push({ i: null });
  }

  for (let j = 0; j < operation.o.length; j++) { // for each cursor
    let posLine = cursorsPos[j][0][0];
    let posCh = cursorsPos[j][0][1] + (cursorsPos[j][1][1] - cursorsPos[j][0][1]) / (operation.l - 1) * i;
    cursor.o[j].i = [posLine, posCh];
  }
  return cursor;
}