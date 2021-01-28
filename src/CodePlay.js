import extract from './func/extract';
import CONFIG from './config';

/**
 * A class for playing recorded code
 */
export class CodePlay {
  /**
   * constructor - Initialize a instance for playing recorded code.
   *
   * @param  {object} editor  CodeMirror instance
   * @param  {object} options Options for player
   */
  constructor(editor, options) {
    this.realTime = 0;
    this.operations = [];
    this.editor = editor;
    this.timer = null;
    this.currentOperation = null;
    if (options) {
      this.maxDelay = options.maxDelay || CONFIG.maxDelayBetweenOperations;
      this.autoplay = options.autoplay || false;
      this.speed = options.speed || 1;
      this.extraActivityHandler = options.extraActivityHandler || null;
    }
  }

  /**
   * setMaxDelay - set the maximum delay between operations.
   *
   * @param  {number} maxDelay In coming operations
   */
  setMaxDelay(maxDelay) {
    if (maxDelay) {
      this.maxDelay = maxDelay;
    }
  }

  /**
   * setAutoplay - set autoplay option.
   *
   * @param  {number} autoplay Value to be set in autoplay option
   */
  setAutoplay(autoplay) {
    if (autoplay) {
      this.autoplay = autoplay;
    }
  }

  /**
   * setSpeed - set playing speed of player.
   *
   * @param  {number} speed playing speed.
   */
  setSpeed(speed) {
    if (speed) {
      this.speed = speed;
    }
  }

  /**
   * setExtraActivityHandler - Set handler for playing extra activity.
   *
   * @param  {function} extraActivityHandler the function for extra activity.
   */
  setExtraActivityHandler(extraActivityHandler) {
    if (extraActivityHandler) {
      this.extraActivityHandler = extraActivityHandler;
    }
  }

  /**
   * addOperation - Original `addOperations` function with a wrong name.
   *
   * @param  {array} operations Incoming operations
   * @deprecated Will be removed after > 1.0.0
   */
  addOperation(operations) {
    console.warn('Deprecated: addOperation() => addOperations() + play()');
    this.addOperations(operations);
    this.play();
  }

  /**
   * addOperations - Parse and add incoming operations into operation queue.
   *
   * @param  {array} operations Incoming operations
   */
  addOperations(operations) {
    const parsedOperations = this.parseOperations(operations);
    this.operations = this.operations.concat(parsedOperations);
    if (this.autoplay) {
      this.play();
    }
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
   * play - Focus on editor and play changes.
   */
  play() {
    this.editor.focus();
    this.playChanges();
  }

  /**
   * pause - Pause code replay.
   */
  pause() {
    if (this.currentOperation !== null) {
      this.operations.unshift(this.currentOperation);
      clearTimeout(this.timer);
    }
  }

  /**
   * playChanges - Helper function to recursively play changes
   */
  playChanges() {
    const operations = this.operations;
    if (operations.length > 0) {
      this.currentOperation = operations.shift();
      const currentOperation = this.currentOperation;
      const currentOperationDelay = this.getOperationDelay(currentOperation);
      this.timer = setTimeout(() => {
        this.playChange(this.editor, currentOperation);
        this.realTime = currentOperation.t;
        this.playChanges();
        if (this.operations.length === 0) {
          this.currentOperation = null;
        }
      }, currentOperationDelay / this.speed);
    }
  }

  /**
   * getOperationDelay - Get how much delay the operation should have
   *
   * @param  {object} currentOperation  Current operation to be played
   * @return {number}                   Length of delay before the operation
   */
  getOperationDelay(currentOperation) {
    const realOperationDelay = currentOperation.t - this.realTime;
    if (realOperationDelay > this.maxDelay && this.maxDelay > 0) {
      return this.maxDelay;
    }
    return realOperationDelay;
  }

  /**
   * playChange - Replay current recorded operation given.
   *
   * @param  {object} editor            Codemirror instance
   * @param  {object} currentOperation  Current operation to replay
   */
  playChange(editor, currentOperation) {
    for (let i = 0; i < currentOperation.o.length; i++) { // 对每一个光标
      if (this.playExtraActivity(currentOperation)) {
        break;
      }
      const insertContent = this.insertionText(currentOperation.o[i]);
      let insertPos = currentOperation.o[i].i;

      if (typeof(insertPos[0]) === 'number') {
        insertPos = [insertPos, insertPos];
      }
      if (!this.isAutoIndent(currentOperation.o[i])) {
        if (currentOperation.o[0].a !== '\n\n') {
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
      }

      if (currentOperation.type === 'content') {
        editor.replaceRange(
            insertContent,
            {line: insertPos[0][0], ch: insertPos[0][1]},
            {line: insertPos[1][0], ch: insertPos[1][1]},
        );
      }
    }
  }

  /**
   * playExtraActivity - Replay current recorded operation given.
   *
   * @param  {object} currentOperation  Current operation to replay
   * @return {boolean}                  True if extra activity played
   */
  playExtraActivity(currentOperation) {
    if (currentOperation.type === 'extra') {
      if (this.extraActivityHandler) {
        this.extraActivityHandler(currentOperation.o[0].activity);
      } else {
        console.warn('extraActivityHandler is required in player');
      }
      return true;
    }
    return false;
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
   * @return {array}            Operation with type property classified
   */
  classifyOperation(operation) {
    operation.type = 'content';
    if (operation.o[0].o === 'o' || operation.o[0].o === 'l') {
      operation.type = 'cursor';
    } else if (operation.o[0].o === 'e') {
      operation.type = 'extra';
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
    for (let operation of operations) {
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
