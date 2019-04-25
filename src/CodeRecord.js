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
    // console.log(this.compressedOperations)
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
      startTime: this.getOperationRelativeTime(), // time
      endTime: this.getOperationRelativeTime(), // time
      beforeDuration: this.getLastChangePause(), // duration
      o: changes,
      combo: 1 // combo count
    })
  }

  cursorActivityListener(editor) {
    this.operations.cursorActivities.push({
      t: this.getOperationRelativeTime(), // time
      d: this.getLastCursorActivityPause(), // duration
      o: editor.listSelections(),
      c: 1 // combo count
    })
  }

  compressOperations() {
    let changes = this.operations.changes
    changes = this.compressContinuousInput(changes)
    changes = this.compressContinuousDelete(changes)
    console.log(changes)
  }

  isContinueInput(firstChange, secondChange) {
    if (firstChange.o.length !== secondChange.o.length) {
      return false;
    } else if (secondChange.beforeDuration >= this.acceptableMinDelay) {
      return false;
    } else {
      for (let i = 0; i < secondChange.o.length; i++) {
        if (secondChange.o[i].from.line !== secondChange.o[i].to.line ||
            firstChange.o[i].from.line !== firstChange.o[i].to.line ||
            secondChange.o[i].from.ch !== secondChange.o[i].to.ch ||
            firstChange.o[i].from.ch !== firstChange.o[i].to.ch) {
          return false;
        } else if (firstChange.o[i].from.ch + 1 !== secondChange.o[i].from.ch) {
          return false;
        }
      }
    }

    return true;
  }

  compressContinuousInput(changes) {
    let newChanges = []
    while(changes.length > 0) {
      let change = changes.pop() // 拿出最新的一条
      if (change.o[0].origin === '+input') {
        while(changes.length > 0) {
          let lastChange = changes.pop()
          if (lastChange.o[0].origin === '+input' &&
          this.isContinueInput(lastChange, change)) {
            change.startTime = lastChange.startTime
            change.beforeDuration = lastChange.beforeDuration
            change.combo += 1
            for (let i = 0; i < change.o.length; i++) {
              change.o[i].from = lastChange.o[i].from
              change.o[i].to = lastChange.o[i].to
              change.o[i].text = lastChange.o[i].text.concat(change.o[i].text)
            }
          } else {
            changes.push(lastChange)
            break;
          }
        }
        newChanges.unshift(change)
      } else {
        newChanges.unshift(change)
      }
    }
    return newChanges
  }


  isContinueDelete(firstChange, secondChange) {
    if (firstChange.o.length !== secondChange.o.length) {
      return false;
    } else if (secondChange.beforeDuration >= this.acceptableMinDelay) {
      return false;
    } else {
      for (let i = 0; i < secondChange.o.length; i++) {
        if (secondChange.o[i].from.line !== secondChange.o[i].to.line ||
            firstChange.o[i].from.line !== firstChange.o[i].to.line) {
          return false;
        } else if (firstChange.o[i].from.ch !== secondChange.o[i].to.ch) {
          return false;
        }
      }
    }

    return true;
  }

  compressContinuousDelete(changes) {
    let newChanges = []
    while(changes.length > 0) {
      let change = changes.pop() // 拿出最新的一条
      if (change.o[0].origin === '+delete') {
        while(changes.length > 0) {
          let lastChange = changes.pop()
          if (lastChange.o[0].origin === '+delete' &&
          this.isContinueDelete(lastChange, change)) {
            change.startTime = lastChange.startTime
            change.beforeDuration = lastChange.beforeDuration
            change.combo += 1
            for (let i = 0; i < change.o.length; i++) {
              change.o[i].to = lastChange.o[i].to
              change.o[i].removed = change.o[i].removed.concat(lastChange.o[i].removed)
            }
          } else {
            // console.info(lastChange, change, 'cannot merge')
            changes.push(lastChange)
            break;
          }
        }
        newChanges.unshift(change)
      } else {
        newChanges.unshift(change)
      }
    }
    return newChanges
  }
}
module.exports = CodeRecord