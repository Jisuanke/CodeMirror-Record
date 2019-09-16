import extract from './func/extract';

/**
 * A class for playing recorded code
 */
export class CodePlay {
  /**
   * constructor - Initialize a instance for playing recorded code.
   *
   * @param  {object} editor Codemirror instance
   */
  constructor(editor) {
    this.timer = 0;
    this.operations = [];
    this.editor = editor;
  }

  /**
   * addOperation - Parse and add in coming operations into operation queue.
   *
   * @param  {array} operations In coming operations
   */
  addOperation(operations) {
    const parsedOperations = this.parseOperations(operations);
    this.operations = this.operations.concat(parsedOperations);
    this.playChanges();
  }

  /**
   * isAutoIndent - Judge whether operation is automatic indentation adjustment
   *
   * @param  {object} operationOp Operation at specific cursor
   * @return {boolean}            True if is automatic indentation adjustment
   */
  isAutoIndent(operationOp) {
    return operationOp.o === 'i' && operationOp.a === '';
  }

  /**
   * playChanges - Get existing records in operation queue and replay them.
   */
  playChanges() {
    this.editor.focus();
    const operations = this.operations;
    if (operations.length > 0) {
      this.timer = operations[0].t;
      while (operations.length > 0) {
        const currentOperation = operations.shift();
        setTimeout(() => {
          this.playChange(this.editor, currentOperation);
        }, currentOperation.t - this.timer);
      }
    }
  }

  /**
   * playChange - Replay current recorded operation given.
   *
   * @param  {object} editor            Codemirror instance
   * @param  {object} currentOperation  Current operation to replay
   */
  playChange(editor, currentOperation) {
    for (let i = 0; i < currentOperation.o.length; i++) {
      const insertContent = this.insertionText(currentOperation.o[i]);
      let insertPos = currentOperation.o[i].i;

      if (typeof(insertPos[0]) === 'number') {
        insertPos = [insertPos, insertPos];
      }
      if (!this.isAutoIndent(currentOperation.o[i])) {
        if (i === 0) {
          editor.setSelection(
              {line: insertPos[0][0], ch: insertPos[0][1]},
              {line: insertPos[1][0], ch: insertPos[1][1]},
          );
        } else {
          editor.addSelection(
              {line: insertPos[0][0], ch: insertPos[0][1]},
              {line: insertPos[1][0], ch: insertPos[1][1]},
          );
        }
      }

      if (!currentOperation.cursorOnly) {
        editor.replaceRange(
            insertContent,
            {line: insertPos[0][0], ch: insertPos[0][1]},
            {line: insertPos[1][0], ch: insertPos[1][1]},
        );
      }
    }
  }

  /**
   * insertionText - Preprocess text for insertion.
   *
   * @param  {object} cursorOperation   Operation of one given cursor
   * @return {string}                   Text to be inserted at cursor position
   */
  insertionText(cursorOperation) {
    let insertContent = '';
    if (typeof(cursorOperation.a) === 'string') {
      insertContent = cursorOperation.a;
    } else if ('a' in cursorOperation) {
      insertContent = cursorOperation.a.join('\n');
    }
    return insertContent;
  }

  /**
   * classifyOperation - Classify whether the operation is cursor only.
   *
   * @param  {array} operation  Operation to be classified
   * @return {array}            Operation with cursorOnly property classified
   */
  classifyOperation(operation) {
    operation.cursorOnly = false;
    if (operation.o[0].o === 'o' || operation.o[0].o === 'l') {
      operation.cursorOnly = true;
    }
    return operation;
  }

  /**
   * parseOperations - Parse and extract operations.
   *
   * @param  {array} operations Operation to be parsed
   * @return {array}            Extracted operations
   */
  parseOperations(operations) {
    operations = JSON.parse(operations);
    const extractedOperations = [];
    for (const operation of operations) {
      operation = this.classifyOperation(operation);
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
