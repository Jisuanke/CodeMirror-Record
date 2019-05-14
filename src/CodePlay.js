import extract from './func/extract';

export class CodePlay {
  constructor(editor) {
    this.timer = 0;
    this.operations = [];
    this.proxy = null;
    this.editor = editor;
  }

  addOperation(operations) {
    let parsedOperations = this.parseOpertaions(operations);
    this.proxy.operations = this.operations.concat(parsedOperations);
    this.playNewChanges();
  }

  listen() {
    const handler = {
      set(target, key, value) {
        target[key] = value;
        return true;
      }
    };
    this.proxy = new Proxy(this, handler);
  }

  /**
   * PRIVATE METHODS
   */

  playNewChanges() {
    this.editor.focus();
    let operations = this.operations;
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

       if (!currentOperation.cursorOnly) {
         editor.replaceRange(
           insertContent,
           { line: insertPos[0][0], ch: insertPos[0][1] },
           { line: insertPos[1][0], ch: insertPos[1][1] }
         );
       }
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
            extractedOperations.push(extract.remove(operation, i));
          } else if (operation.o[0].o === 'o') {
            extractedOperations.push(extract.cursor(operation, i));
          } else if (operation.o[0].o === 'l') {
            extractedOperations.push(extract.select(operation, i));
          }
        }
      } else {
        extractedOperations.push(operation);
      }
    }
    return extractedOperations;
  }
}
