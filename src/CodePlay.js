import extract from './func/extract';
import CONFIG from './config';
import Events from 'events';
import _cloneDeep from 'lodash.clonedeep';

/**
 * A class for playing recorded code
 */
export class CodePlay extends Events {
  /**
   * constructor - Initialize a instance for playing recorded code.
   *
   * @param  {object} editor  CodeMirror instance
   * @param  {object} options Options for player
   */
  constructor(editor, options) {
    super();
    this.editor = editor;
    this.initialize();
    if (options) {
      this.maxDelay = options.maxDelay || CONFIG.maxDelayBetweenOperations;
      this.autoplay = options.autoplay || false;
      this.autofocus = options.autofocus || false;
      this.speed = options.speed || 1;
      this.extraActivityHandler = options.extraActivityHandler || null;
      this.extraActivityReverter = options.extraActivityReverter || null;
    }
  }

  /**
   * initialize - Initialize the instance to default values
   */
  initialize() {
    this.operations = [];
    this.playedOperations = [];
    this.status = 'PAUSE';
    clearTimeout(this.timer);
    this.timer = null;
    this.currentOperation = null;
    this.duration = 0;
    this.lastOperationTime = 0;
    this.lastPlayTime = 0;
    this.seekTime = null;
    this.playedTimeBeforeOperation = 0;
    this.playedTimeBeforePause = 0;
    this.speedBeforeSeeking = null;
    this.statusBeforeSeeking = null;
  }

  /**
   * setOption - Function for setting the option
   * @param  {function} setOptionCallback Callback function for setting a option
   */
  setOption(setOptionCallback) {
    const statusBeforeSetOption = this.status;
    if (statusBeforeSetOption === 'PLAY') {
      this.pause();
    }
    setOptionCallback();
    if (statusBeforeSetOption === 'PLAY') {
      this.play();
    }
  }

  /**
   * setMaxDelay - Set the maximum delay between operations.
   *
   * @param  {number} maxDelay In coming operations
   */
  setMaxDelay(maxDelay) {
    this.setOption(() => {
      if (maxDelay) {
        this.maxDelay = maxDelay;
      }
    });
  }

  /**
   * setAutoplay - Set autoplay option.
   *
   * @param  {number} autoplay Value to be set in autoplay option
   */
  setAutoplay(autoplay) {
    this.setOption(() => {
      if (autoplay) {
        this.autoplay = autoplay;
      }
    });
  }

  /**
   * setAutofocus - Set autofocus option.
   *
   * @param  {number} autofocus Value to be set in autofocus option
   */
  setAutofocus(autofocus) {
    this.setOption(() => {
      if (autofocus) {
        this.autofocus = autofocus;
      }
    });
  }

  /**
   * setSpeed - Set playing speed of player.
   *
   * @param  {number} speed playing speed.
   */
  setSpeed(speed) {
    this.setOption(() => {
      if (speed) {
        this.speed = speed;
      }
    });
  }

  /**
   * setExtraActivityHandler - Set handler for playing extra activity.
   *
   * @param  {function} extraActivityHandler the function for extra activity.
   */
  setExtraActivityHandler(extraActivityHandler) {
    this.setOption(() => {
      if (extraActivityHandler) {
        this.extraActivityHandler = extraActivityHandler;
      }
    });
  }

  /**
   * setExtraActivityReverter - Set reverter for reverting extra activity.
   *
   * @param  {function} extraActivityReverter the function reverting.
   */
  setExtraActivityReverter(extraActivityReverter) {
    this.setOption(() => {
      if (extraActivityReverter) {
        this.extraActivityReverter = extraActivityReverter;
      }
    });
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
   * clear - Clear all operations and status on the player instance.
   */
  clear() {
    this.emit('clear');
    this.initialize();
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
      if (this.autofocus) {
        this.editor.focus();
      }
      this.emit('play');
      this.playChanges();
    }
  }

  /**
   * pause - Pause code replay.
   */
  pause() {
    if (this.status !== 'PAUSE') {
      this.status = 'PAUSE';
      this.emit('pause');
      this.playedTimeBeforePause =
        (new Date().getTime() - this.lastPlayTime) * this.speed;
      this.playedTimeBeforeOperation += this.playedTimeBeforePause;
      if (this.currentOperation !== null) {
        clearTimeout(this.timer);
        this.currentOperation = null;
      }
    }
  }

  /**
   * getStatus - Get play or pause status in the player
   * @return {string} The status of player (PLAY | PAUSE)
   */
  getStatus() {
    return this.status;
  }

  /**
   * getCurrentTime - Get current time in player in milliseconds
   * @return {number} The current time of progress in player
   */
  getCurrentTime() {
    const currentTime = this.lastOperationTime + this.playedTimeBeforeOperation;
    if (this.status === 'PLAY') {
      const timeAfterLastPlay =
        (new Date().getTime() - this.lastPlayTime) * this.speed;
      return currentTime + timeAfterLastPlay;
    }
    return currentTime;
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
    this.emit('seek');
    const isAlreadySeeking = this.seekTime !== null;
    if (!isAlreadySeeking) {
      this.speedBeforeSeeking = this.speed;
      this.statusBeforeSeeking = this.status;
    }
    this.pause();
    this.speed = 0;
    this.seekTime = Math.min(Math.max(seekTime, 0), this.duration);
    if (this.autofocus) {
      this.editor.focus();
    }
    if (this.lastOperationTime < this.seekTime) {
      this.playChanges();
    } else if (this.lastOperationTime > this.seekTime) {
      this.revertChanges();
    } else {
      this.stopSeek();
    }
  }

  /**
   * stopSeek - Stop seeking.
   */
  stopSeek() {
    this.pause();
    if (this.seekTime !== null) {
      const statusBeforeSeeking = this.statusBeforeSeeking;
      this.playedTimeBeforeOperation = this.seekTime - this.lastOperationTime;
      if (this.speedBeforeSeeking !== null) {
        this.speed = this.speedBeforeSeeking;
      }
      this.seekTime = null;
      this.speedBeforeSeeking = null;
      this.statusBeforeSeeking = null;
      if (statusBeforeSeeking === 'PLAY' && this.operations.length > 0) {
        this.play();
      }
    }
  }

  /**
   * playChanges - Helper function to recursively play changes
   */
  playChanges() {
    this.lastPlayTime = new Date().getTime();
    const operations = this.operations;
    if (operations.length > 0) {
      this.status = 'PLAY';
      this.currentOperation = operations[0];
      const currentOperation = this.currentOperation;
      const currentOperationDelay = this.getOperationDelay(currentOperation);
      if (this.seekTime !== null && currentOperation.t > this.seekTime) {
        this.stopSeek();
        return;
      }
      this.timer = setTimeout(() => {
        this.lastOperationTime = currentOperation.t;
        this.operations.shift();
        this.playChange(this.editor, currentOperation);
        if (this.operations.length === 0) {
          this.currentOperation = null;
          this.stopSeek();
        }
      }, (this.speed === 0) ? 0 : currentOperationDelay / this.speed);
    } else {
      this.pause();
      this.emit('end');
    }
  }

  /**
   * getOperationDelay - Get how much delay the operation should have
   *
   * @param  {object} currentOperation  Current operation to be played
   * @return {number}                   Length of delay before the operation
   */
  getOperationDelay(currentOperation) {
    const operationDelay = currentOperation.t - this.lastOperationTime;
    const realOperationDelay = operationDelay - this.playedTimeBeforeOperation;
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
    this.playedTimeBeforeOperation = 0;
    const selections = _cloneDeep(editor.listSelections());
    const primaryAnchor = editor.getCursor('anchor');
    const primaryHead = editor.getCursor('head');
    const primaryIndex = selections.findIndex((selection) =>
      this.positionsEqual(selection.anchor, primaryAnchor) &&
      this.positionsEqual(selection.head, primaryHead),
    );
    currentOperation.revertState = {
      value: editor.getValue(),
      selections,
      primaryIndex: primaryIndex < 0 ? 0 : primaryIndex,
    };

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
   * positionsEqual - Compare two CodeMirror positions by public coordinates.
   *
   * @param {object} firstPosition First CodeMirror position
   * @param {object} secondPosition Second CodeMirror position
   * @return {boolean} Whether both positions identify the same coordinate
   */
  positionsEqual(firstPosition, secondPosition) {
    return firstPosition.line === secondPosition.line &&
      firstPosition.ch === secondPosition.ch;
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
      this.lastOperationTime = 0;
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
    this.lastOperationTime = currentOperation.t;
    if (this.seekTime !== null && this.lastOperationTime <= this.seekTime) {
      this.stopSeek();
      return;
    }
    if (currentOperation.revertState !== undefined) {
      const revertState = currentOperation.revertState;
      editor.operation(() => {
        if (editor.getValue() !== revertState.value) {
          editor.setValue(revertState.value);
        }
        editor.setSelections(
            _cloneDeep(revertState.selections),
            revertState.primaryIndex,
        );
      });
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
        if (!Array.isArray(operation.t)) {
          operation.t = [operation.t, operation.t];
        }
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
        // A v1 recorder could sample two adjacent milliseconds for one
        // ungrouped operation. Schedule that operation at its interval end.
        if (Array.isArray(operation.t)) {
          operation.t = operation.t[1];
        }
        extractedOperations.push(operation);
      }
    }
    return extractedOperations;
  }
}
