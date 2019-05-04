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
       let insertContent = '';
       if (typeof(currentOperation.o[i].a) === 'string') {
         insertContent = currentOperation.o[i].a
       } else if (currentOperation.o[i].hasOwnProperty('a')) {
         insertContent = currentOperation.o[i].a.join('\n');
       }

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

  parseOpertaions(operations) {
    operations = JSON.parse(operations);
    let extractedOperations = [];
    for (let operation of operations) {
      if ('l' in operation) {
        if (operation.o[0].o === 'i') {
          for (let i = 0; i < operation.l; i++) {
            let insertion = extract.input(operation, i);
            extractedOperations.push(insertion);
          }
        } else if (operation.o[0].o === 'c') {
          for (let i = 0; i < operation.l; i++) {
            let composition = extract.compose(operation, i);
            extractedOperations.push(composition);
          }
        } else if (operation.o[0].o === 'd') {
          for (let i = 0; i < operation.l; i++) {
            let deletion = extract.delete(operation, i);
            extractedOperations.push(deletion);
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