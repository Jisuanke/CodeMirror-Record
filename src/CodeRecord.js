import minify from './utils/minify';
import compress from './func/compress';

/**
 * A class for code recording
 */
export class CodeRecord {
  /**
   * constructor - Initialize a instance for recording coding operations.
   *
   * @param  {object} editor CodeMirror instance
   */
  constructor(editor) {
    this.initTime = +new Date;
    this.lastChangeTime = +new Date;
    this.lastCursorActivityTime = +new Date;
    this.operations = [];
    this.editor = editor;
    this.changesListener = this.changesListener.bind(this);
    this.cursorActivityListener = this.cursorActivityListener.bind(this);
    this.swapDocListener = this.swapDocListener.bind(this);
  }

  /**
   * recordExtraActivity
   * @param {object} activity
   **/
  recordExtraActivity(activity) {
    const changes = [{
      origin: 'extra',
      activity: activity,
    }];

    this.operations.push({
      startTime: this.getOperationRelativeTime(),
      endTime: this.getOperationRelativeTime(),
      ops: changes,
    });
  }

  /**
   * listen - Listen on both content change and cursor activities.
   */
  listen() {
    this.editor.on('changes', this.changesListener);
    this.editor.on('swapDoc', this.swapDocListener);
    this.editor.on('cursorActivity', this.cursorActivityListener);
  }

  /**
   * getRecords - Get unrecorded changes
   *
   * @return {string}  Changes to be recorded in JSON format
   */
  getRecords() {
    this.removeRedundantCursorOperations();
    this.compressCursorOperations();
    this.compressChanges();
    return JSON.stringify(minify(this.operations));
  }


  /**
   * getOperationRelativeTime - Compute relative point of time of a change.
   *
   * @return {number}  Point of time relative to creation of recorder instance
   */
  getOperationRelativeTime() {
    const currentTime = +new Date;
    return currentTime - this.initTime;
  }

  /**
   * getLastChangePause - Get delay of time since last content change.
   *
   * @return {number}  Delay delay of time since last content change.
   */
  getLastChangePause() {
    const currentTime = +new Date;
    const lastChangePause = currentTime - this.lastChangeTime;
    this.lastChangeTime = currentTime;

    return lastChangePause;
  }

  /**
   * getLastCursorActivityPause - Get delay of time since last cursor operation.
   *
   * @return {number}  Delay of time since last cursor operation
   */
  getLastCursorActivityPause() {
    const currentTime = +new Date;
    const lastCursorActivityPause = currentTime - this.lastCursorActivityTime;
    this.lastCursorActivityTime = currentTime;

    return lastCursorActivityPause;
  }

  /**
   * changesListener - Listener to content changes.
   *
   * @param  {object} editor  CodeMirror instance
   * @param  {array}  changes Changes of content provided with CodeMirror format
   */
  changesListener(editor, changes) {
    this.operations.push({
      startTime: this.getOperationRelativeTime(),
      endTime: this.getOperationRelativeTime(),
      delayDuration: this.getLastChangePause(),
      ops: changes,
      combo: 1,
    });
  }

  /**
   * swapDocListener - Listener to a special set of value by swapDoc event.
   *
   * @todo
   * @param  {object} editor  CodeMirror instance after swapDoc call
   * @param  {array}  oldDoc  Original CodeMirror Doc instance to be replaced
   */
  swapDocListener(editor, oldDoc) {
    const changes = [{
      from: {line: 0, ch: 0},
      to: {
        line: oldDoc.lastLine(),
        ch: oldDoc.getLine(oldDoc.lastLine()).length,
      },
      origin: 'setValue',
      removed: oldDoc.getValue().split('\n'),
      text: editor.getValue().split('\n'),
    }];

    this.operations.push({
      startTime: this.getOperationRelativeTime(),
      endTime: this.getOperationRelativeTime(),
      delayDuration: this.getLastChangePause(),
      ops: changes,
      combo: 1,
    });
  }

  /**
   * cursorActivityListener - Listener to cursor changes.
   *
   * @param  {object} editor CodeMirror instance
   */
  cursorActivityListener(editor) {
    this.operations.push({
      startTime: this.getOperationRelativeTime(),
      endTime: this.getOperationRelativeTime(),
      delayDuration: this.getLastCursorActivityPause(),
      crs: editor.listSelections(),
      combo: 1,
    });
  }

  /**
   * isPasteOperation - Judge whether an operation involve paste.
   *
   * @param  {object} operation Operation to be judged
   * @return {boolean}          True if the operation is paste
   */
  isPasteOperation(operation) {
    for (let i = 0; i < operation.ops.length; i++) {
      if (operation.ops[i].origin === 'paste') {
        return true;
      }
    }
    return false;
  }

  /**
   * removeRedundantCursorOperations - Remove cursor
   * operations that can be inferred from content operations.
   */
  removeRedundantCursorOperations() {
    const operations = this.operations;
    const newOperations = [];
    for (let i = 0; i < operations.length; i++) {
      if ('ops' in operations[i]) {
        newOperations.push(operations[i]);
        // Following `if` statement is to preserve selection after paste
        if (i > 0 && this.isPasteOperation(operations[i])) {
          operations[i - 1].startTime = operations[i].startTime + 1;
          operations[i - 1].endTime = operations[i].endTime + 1;
          newOperations.push(operations[i - 1]);
        }
      } else if (!(i < operations.length - 1 && 'ops' in operations[i + 1])) {
        newOperations.push(operations[i]);
      }
    }
    this.operations = newOperations;
  }

  /**
   * compressCursorOperations - Compress cursor operations to minimize cost.
   */
  compressCursorOperations() {
    let operations = this.operations;
    operations = compress.select(operations);
    operations = compress.cursor(operations);
    this.operations = operations;
  }

  /**
   * compressChanges - Compress content operations to minimize cost.
   */
  compressChanges() {
    let operations = this.operations;
    operations = compress.input(operations);
    operations = compress.remove(operations);
    operations = compress.compose(operations);
    this.operations = operations;
  }
}
