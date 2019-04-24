const bind = require('./bind.js');
class CodeRecord {
  constructor(editor) {
    this.initTime = +new Date
    this.acceptableMinDelay = 1200 // 小于这个数字表示绝对是连续行为，大于这个数字需要通过连续行为间隔平均数判断是否是可以视为同类的匀速行为
    this.lastChangeTime = +new Date
    this.lastCursorActivityTime = +new Date
    this.operations = {
      cursorActivities: [],
      changes: []
    }
    this.compressedOperations = {
      cursorActivities: [],
      changes: []
    }
    this.editor = editor
    this.changesListener = bind(this.changesListener, this);
    this.cursorActivityListener = bind(this.cursorActivityListener, this);
  }

  printOperations() {
    console.log(this.operations)
    this.compressOperations()
    console.log(this.compressedOperations)
  }

  getOperationRelativeTime() {
    let currentTime = +new Date
    return currentTime - this.initTime
  }

  getLastChangePause() {
    let currentTime = +new Date
    let lastChangePause = currentTime - this.lastChangeTime
    this.lastChangeTime = currentTime

    return lastChangePause
  }

  getLastCursorActivityPause() {
    let currentTime = +new Date
    let lastCursorActivityPause = currentTime - this.lastCursorActivityTime
    this.lastCursorActivityTime = currentTime

    return lastCursorActivityPause
  }

  listen() {
    this.editor.on('changes', this.changesListener)
    this.editor.on('cursorActivity', this.cursorActivityListener)
  }

  changesListener(editor, changes) {
    this.operations.changes.push({
      t: this.getOperationRelativeTime(), // time
      d: this.getLastChangePause(), // duration
      o: changes
    })
  }

  cursorActivityListener(editor) {
    this.operations.cursorActivities.push({
      t: this.getOperationRelativeTime(), // time
      d: this.getLastCursorActivityPause(), // duration
      o: editor.listSelections()
    })
  }

  compressOperations() {
    this.compressedOperations = this.operations
  }
}
module.exports = CodeRecord