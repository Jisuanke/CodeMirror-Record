module.exports = function(operation, i) {
  let startTime = operation.t[0];
  let durationPerOperation = (operation.t[1] - operation.t[0]) / (operation.l - 1);

  let insertion = {t: null, o: []};
  // Set operation time
  insertion.t = Math.floor(startTime + i * durationPerOperation);
  if (i === operation.l - 1) {
    insertion.t = operation.t[1];
  }

  let cursorsPos = [] // for each cursor
  for (let j = 0; j < operation.o.length; j++) {
    cursorsPos.push(operation.o[j].i);
    insertion.o.push({a: null, i: null});
  }

  for (let j = 0; j < operation.o.length; j++) { // for each cursor
    insertion.o[j].a = operation.o[j].a[i];
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