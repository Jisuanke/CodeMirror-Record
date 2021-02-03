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
    this.operations = [];
    this.playedOperations = [];
    this.editor = editor;
    this.cachedValue = null;
    this.status = 'PAUSE';
    this.timer = null;
    this.currentOperation = null;
    this.duration = 0;
    this.currentTime = 0;
    this.seekTime = null;
    this.speedBeforeSeeking = null;
    if (options) {
      this.maxDelay = options.maxDelay || CONFIG.maxDelayBetweenOperations;
      this.autoplay = options.autoplay || false;
      this.speed = options.speed || 1;
      this.extraActivityHandler = options.extraActivityHandler || null;
      this.extraActivityReverter = options.extraActivityReverter || null;
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
   * setExtraActivityReverter - Set reverter for reverting extra activity.
   *
   * @param  {function} extraActivityReverter the function reverting.
   */
  setExtraActivityReverter(extraActivityReverter) {
    if (extraActivityReverter) {
      this.extraActivityReverter = extraActivityReverter;
    }
  }

  /**
   * addOperation - Original `addOperations` function with a wrong name.
   *
   * @param  {array} operations Incoming operations
   * @deprecated Will be removed when version >= 1.0.0
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

    this.duration = parsedOperations[parsedOperations.length - 1].t;
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
    if (this.status !== 'PLAY') {
      this.editor.focus();
      this.playChanges();
    }
  }

  /**
   * pause - Pause code replay.
   */
  pause() {
    if (this.status !== 'PAUSE') {
      this.status = 'PAUSE';
      if (this.currentOperation !== null) {
        clearTimeout(this.timer);
      }
    }
  }

  /**
   * getCurrentTime - Get current time in player in milliseconds
   * @return {number} The current time of progress in player
   */
  getCurrentTime() {
    return this.currentTime;
  }

  /**
   * getDuration - Get duration of loaded records in player
   * @return {number} The duration of loaded records of progress in player
   */
  getDuration() {
    return this.duration;
  }

  /**
   * seek - Seek to a position on player.
   * @param {number} seekTime The time to be seeked on player
   */
  seek(seekTime) {
    this.speedBeforeSeeking = this.speed;
    this.speed = 0;
    this.seekTime = seekTime;
    this.pause();
    this.editor.focus();
    if (this.currentTime < this.seekTime) {
      this.playChanges();
    } else if (this.currentTime > this.seekTime) {
      this.revertChanges();
    }
  }

  /**
   * stopSeek - Stop seeking.
   */
  stopSeek() {
    this.pause();
    if (this.speedBeforeSeeking !== null) {
      this.speed = this.speedBeforeSeeking;
    }
    this.seekTime = null;
  }

  /**
   * playChanges - Helper function to recursively play changes
   */
  playChanges() {
    const operations = this.operations;
    if (operations.length > 0) {
      this.status = 'PLAY';
      this.currentOperation = operations[0];
      const currentOperation = this.currentOperation;
      const currentOperationDelay = this.getOperationDelay(currentOperation);
      if (this.seekTime && currentOperation.t > this.seekTime) {
        this.stopSeek();
        return;
      }
      this.timer = setTimeout(() => {
        this.currentTime = currentOperation.t;
        this.operations.shift();
        this.playChange(this.editor, currentOperation);
        if (this.operations.length === 0) {
          this.currentOperation = null;
          this.stopSeek();
        }
      }, (this.speed === 0) ? 0 : currentOperationDelay / this.speed);
    }
  }

  /**
   * getOperationDelay - Get how much delay the operation should have
   *
   * @param  {object} currentOperation  Current operation to be played
   * @return {number}                   Length of delay before the operation
   */
  getOperationDelay(currentOperation) {
    const realOperationDelay = currentOperation.t - this.currentTime;
    if (realOperationDelay > this.maxDelay && this.maxDelay > 0) {
      return this.maxDelay;
    }
    return realOperationDelay;
  }

  /**
   * playChange - Replay current recorded operation given.
   *
   * @param  {object} editor            CodeMirror instance
   * @param  {object} currentOperation  Current operation to replay
   */
  playChange(editor, currentOperation) {
    const valueBeforeChange = editor.getValue();
    if (this.cachedValue === null || this.cachedValue !== valueBeforeChange) {
      this.cachedValue = valueBeforeChange;
      currentOperation.revertValue = valueBeforeChange;
    }

    for (let i = 0; i < currentOperation.o.length; i++) {
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
    this.playedOperations.unshift(currentOperation);
    this.playChanges();
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
   * revertChanges - Helper function to recursively play changes
   */
  revertChanges() {
    const playedOperations = this.playedOperations;
    if (playedOperations.length > 0) {
      this.currentOperation = playedOperations[0];
      this.revertChange(this.editor, this.currentOperation);
    } else {
      this.currentTime = 0;
      this.stopSeek();
      return;
    }
  }

  /**
   * revertChange - Revert current operation given
   *
   * @param  {object} editor            CodeMirror instance
   * @param  {object} currentOperation  Current operation to replay
   */
  revertChange(editor, currentOperation) {
    this.currentTime = currentOperation.t;
    if (this.seekTime && this.currentTime <= this.seekTime) {
      this.stopSeek();
      return;
    }
    if (currentOperation.revertValue !== undefined) {
      editor.setValue(currentOperation.revertValue);
    }
    this.revertExtraActivity(currentOperation);
    this.playedOperations.shift();
    this.operations.unshift(currentOperation);
    this.revertChanges();
  }

  /**
   * revertExtraActivity - Revert current recorded operation given.
   *
   * @param  {object} currentOperation  Current operation to revert
   * @return {boolean}                  True if extra activity reverted
   */
  revertExtraActivity(currentOperation) {
    if (currentOperation.type === 'extra') {
      if (this.extraActivityReverter) {
        this.extraActivityReverter(currentOperation.o[0].activity);
      } else {
        console.warn('extraActivityReverter is required in player');
      }
      return true;
    }
    return false;
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
