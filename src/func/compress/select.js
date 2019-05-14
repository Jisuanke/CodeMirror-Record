import CONFIG from '../../config';

function isContinueSelect(firstChange, secondChange) {
  if (firstChange.crs.length !== secondChange.crs.length) {
    return false;
  } else {
    for (let i = 0; i < secondChange.crs.length; i++) {
      if (secondChange.crs[i].anchor.line === secondChange.crs[i].head.line &&
          secondChange.crs[i].anchor.ch === secondChange.crs[i].head.ch) {
        return false;
      } else if (firstChange.crs[i].anchor.line !== secondChange.crs[i].anchor.line ||
        firstChange.crs[i].anchor.ch !== secondChange.crs[i].anchor.ch) {
        return false;
      }
    }
  }
  return true;
}

function compressSelectionHeads(heads) {
  let resultArray = [];
  let currentLine = -1;
  while (heads.length > 0) {
    let head = heads.shift();
    if (currentLine !== head.line) {
      resultArray.push([head.line]);
      currentLine = head.line;
    }
    resultArray[resultArray.length - 1].push(head.ch);
  }
  for (let i = 0; i < resultArray.length; i++) {
    let chsInterval = resultArray[i].slice(1);
    chsInterval = convertChsToInterval(chsInterval);
    chsInterval = convertChsToInterval(chsInterval, -1);
    resultArray[i] = [resultArray[i][0], chsInterval];
  }
  return resultArray;
}

function convertChsToInterval(chs, direction = 1) {
  let resultArray = [];
  while(chs.length > 0) {
    let current = chs.shift();
    if (typeof(current) !== 'number') {
      resultArray.push(current);
    } else if (resultArray.length === 0 ||
               Array.isArray(resultArray[resultArray.length - 1])) {
      resultArray.push({ from: current, to: current });
    } else if ('to' in resultArray[resultArray.length - 1]) {
      if (resultArray[resultArray.length - 1].to + direction !== current) {
        resultArray.push({ from: current, to: current });
      } else {
        resultArray[resultArray.length - 1].to = current;
      }
    }
  }
  for (let i = 0; i < resultArray.length; i++) {
    if ('to' in resultArray[i]) {
      if (resultArray[i].from === resultArray[i].to) {
        resultArray[i] = resultArray[i].from;
      } else {
        resultArray[i] = [resultArray[i].from, resultArray[i].to];
      }
    }
  }
  return resultArray;
}

function compressContinuousSelect(operations, direction = 1) {
  let newOperations = [];
  while(operations.length > 0) {
    let operation = operations.pop(); // Obtain the latest operation
    if ('crs' in operation) {
      while(operations.length > 0) {
        let lastOperation = operations.pop();
        if (('crs' in lastOperation) &&
        isContinueSelect(lastOperation, operation)) {
          operation.startTime = lastOperation.startTime;
          operation.delayDuration = lastOperation.delayDuration;
          operation.combo += 1;
          for (let i = 0; i < operation.crs.length; i++) {
            if (!('heads' in operation.crs[i])) {
              operation.crs[i].heads = [lastOperation.crs[i].head, operation.crs[i].head]
            } else {
              operation.crs[i].heads.unshift(lastOperation.crs[i].head)
            }
          }
        } else {
          operations.push(lastOperation);
          break;
        }
      }
      newOperations.unshift(operation);
    } else {
      newOperations.unshift(operation);
    }
  }
  return newOperations;
}

function convertSelectFormat(operations) {
  for (let i = 0; i < operations.length; i++) {
    if (('crs' in operations[i]) && operations[i].combo > 1) {
      operations[i].ops = []
      for (let j = 0; j < operations[i].crs.length; j++) {
        operations[i].ops.push({
          from: operations[i].crs[j].anchor,
          to: operations[i].crs[j].anchor,
          origin: 'select',
          text: [''],
          removed: [''],
          select: compressSelectionHeads(operations[i].crs[j].heads) // 这里需要做进一步的数据压缩
        })
      }
      delete operations[i].crs;
    }
  }
  return operations;
}

export default function(operations) {
  operations = compressContinuousSelect(operations);
  operations = convertSelectFormat(operations)
  return operations;
}
