const bind = require('./utils/bind.js');
const minify = require('./utils/minify.js');

const compress = {};
compress.input = require('./func/compress/input.js');
compress.delete = require('./func/compress/delete.js');
compress.compose = require('./func/compress/compose.js');

class CodeRecord {
  constructor(editor) {
    this.initTime = +new Date;
    this.acceptableMinDelay = 1200; // 小于这个数字表示绝对是连续行为，大于这个数字需要通过连续行为间隔平均数判断是否是可以视为同类的匀速行为
    this.lastChangeTime = +new Date;
    this.lastCursorActivityTime = +new Date;
    this.operations = {
      cursorActivities: [],
      changes: []
    };
    this.compressedOperations = {
      cursorActivities: [],
      changes: []
    };
    this.editor = editor;
    this.changesListener = bind(this.changesListener, this);
    this.cursorActivityListener = bind(this.cursorActivityListener, this);
  }

  listen() {
    this.editor.on('changes', this.changesListener);
    this.editor.on('cursorActivity', this.cursorActivityListener);
  }

  printOperations() {
    console.log(this.operations);
    this.compressOperations();
    //console.log(this.compressedOperations.changes);
    console.log(JSON.stringify(minify(this.compressedOperations.changes)));
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
    this.operations.changes.push({
      startTime: this.getOperationRelativeTime(), // time
      endTime: this.getOperationRelativeTime(), // time
      delayDuration: this.getLastChangePause(), // duration
      ops: changes,
      combo: 1 // combo count
    });
  }

  cursorActivityListener(editor) {
    this.operations.cursorActivities.push({
      t: this.getOperationRelativeTime(), // time
      d: this.getLastCursorActivityPause(), // duration
      o: editor.listSelections(),
      c: 1 // combo count
    });
  }

  compressOperations() {
    let changes = this.operations.changes;
    changes = compress.input(changes);
    changes = compress.delete(changes);
    changes = compress.compose(changes);
    this.compressedOperations.changes = changes;
  }
}
module.exports = CodeRecord;