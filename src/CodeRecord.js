const bind = require('./utils/bind.js');
const minify = require('./utils/minify.js');

const compress = {};
compress.input = require('./func/compress/input.js');
compress.delete = require('./func/compress/delete.js');
compress.compose = require('./func/compress/compose.js');
compress.cursor = require('./func/compress/cursor.js');
compress.select = require('./func/compress/select.js');

class CodeRecord {
  constructor(editor) {
    this.initTime = +new Date;
    this.lastChangeTime = +new Date;
    this.lastCursorActivityTime = +new Date;
    this.operations = [];
    this.editor = editor;
    this.changesListener = bind(this.changesListener, this);
    this.cursorActivityListener = bind(this.cursorActivityListener, this);
  }

  listen() {
    this.editor.on('changes', this.changesListener);
    this.editor.on('cursorActivity', this.cursorActivityListener);
  }

  getRecords() {
    this.removeRedundantCursorOperations();
    this.compressCursorOperations();
    this.compressChanges();
    return JSON.stringify(minify(this.operations));
  }

  /**
   * PRIVATE METHODS
   */
  getOperationRelativeTime() {
    let currentTime = +new Date;
    return currentTime - this.initTime;
  }

  getLastChangePause() {
    let currentTime = +new Date;
    let lastChangePause = currentTime - this.lastChangeTime;
    this.lastChangeTime = currentTime;

    return lastChangePause;
  }

  getLastCursorActivityPause() {
    let currentTime = +new Date;
    let lastCursorActivityPause = currentTime - this.lastCursorActivityTime;
    this.lastCursorActivityTime = currentTime;

    return lastCursorActivityPause;
  }

  changesListener(editor, changes) {
    this.operations.push({
      startTime: this.getOperationRelativeTime(),
      endTime: this.getOperationRelativeTime(),
      delayDuration: this.getLastChangePause(),
      ops: changes,
      combo: 1
    });
  }

  cursorActivityListener(editor) {
    this.operations.push({
      startTime: this.getOperationRelativeTime(),
      endTime: this.getOperationRelativeTime(),
      delayDuration: this.getLastCursorActivityPause(),
      crs: editor.listSelections(),
      combo: 1
    });
  }

  removeRedundantCursorOperations() {
    let operations = this.operations;
    let newOperations = [];
    for (let i = 0; i < operations.length; i++) {
      if (!(i < operations.length - 1 && 'ops' in operations[i + 1]) ||
          'ops' in operations[i]) {
        newOperations.push(operations[i])
      }
    }
    this.operations = newOperations;
  }

  compressCursorOperations() {
    let operations = this.operations;
    operations = compress.select(operations);
    operations = compress.cursor(operations);
    this.operations = operations;
  }

  compressChanges() {
    let operations = this.operations;
    operations = compress.input(operations);
    operations = compress.delete(operations);
    operations = compress.compose(operations);
    this.operations = operations;
  }
}
module.exports = CodeRecord;