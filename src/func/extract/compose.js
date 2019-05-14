export default function(operation, i) {
  let startTime = operation.t[0];
  let durationPerOperation = (operation.t[1] - operation.t[0]) / (operation.l - 1);

  let composition = {t: null, o: []};
  // Set operation time
  composition.t = Math.floor(startTime + i * durationPerOperation);
  if (i === operation.l - 1) {
    composition.t = operation.t[1];
  }

  composition.cursorOnly = false;

  let cursorsPos = [] // for each cursor
  for (let j = 0; j < operation.o.length; j++) {
    cursorsPos.push(operation.o[j].i);
    composition.o.push({a: null, i: null});
  }

  for (let j = 0; j < operation.o.length; j++) { // for each cursor
    composition.o[j].a = operation.o[j].a[i];
    composition.o[j].i = [cursorsPos[j][0], cursorsPos[j][1]];
    cursorsPos[j][1] += operation.o[j].a[i].length;
  }
  return composition;
}
