const bind = require('./utils/bind.js');
const minify = require('./utils/minify.js');

const extract = {};
extract.input = require('./func/extract/input.js');
extract.delete = require('./func/extract/delete.js');
extract.compose = require('./func/extract/compose.js');

class CodePlay {
  constructor(editor) {
    this.timer = 0;
    this.operations = {
      changes: []
    };
    this.operationsProxy = null;
    this.editor = editor;
  }

  addOperation(operations) {
    let parsedOperations = this.parseOpertaions(operations);
    this.operationsProxy.changes = this.operations.changes.concat(parsedOperations);
    this.playNewChanges();
  }

  listen() {
    const handler = {
      set(target, key, value) {
        target[key] = value;
        return true;
      }
    };
    this.operationsProxy = new Proxy(this.operations, handler);
  }

  /**
   * PRIVATE METHODS
   */

  playNewChanges() {
    let operations = this.operations.changes;
    if (operations.length > 0) {
      this.timer = operations[0].t;
      while (operations.length > 0) {
        let currentOperation = operations.shift();
        setTimeout(() => {
          this.playChange(this.editor, currentOperation);
        }, currentOperation.t - this.timer);
      }
    }
  }

  playChange(editor, currentOperation) {
     for (let i = 0; i < currentOperation.o.length; i++) {
       let insertContent = this.insertionText(currentOperation.o[i]);
       let insertPos = currentOperation.o[i].i;

       if (typeof(insertPos[0]) === 'number') {
         insertPos = [insertPos, insertPos];
       }
       editor.setSelection(
         { line: insertPos[0][0], ch: insertPos[0][1] },
         { line: insertPos[1][0], ch: insertPos[1][1] }
       );
       editor.replaceRange(
         insertContent,
         { line: insertPos[0][0], ch: insertPos[0][1] },
         { line: insertPos[1][0], ch: insertPos[1][1] }
       );
     }
  }

  insertionText(operationCursor) {
    let insertContent = '';
    if (typeof(operationCursor.a) === 'string') {
      insertContent = operationCursor.a;
    } else if ('a' in operationCursor) {
      insertContent = operationCursor.a.join('\n');
    }
    return insertContent;
  }

  parseOpertaions(operations) {
    operations = JSON.parse(operations);
    let extractedOperations = [];
    for (let operation of operations) {
      if ('l' in operation) {
        for (let i = 0; i < operation.l; i++) {
          if (operation.o[0].o === 'i') {
            extractedOperations.push(extract.input(operation, i));
          } else if (operation.o[0].o === 'c') {
            extractedOperations.push(extract.compose(operation, i));
          } else if (operation.o[0].o === 'd') {
            extractedOperations.push(extract.delete(operation, i));
          }
        }
      } else {
        extractedOperations.push(operation);
      }
    }
    return extractedOperations;
  }
}
module.exports = CodePlay;