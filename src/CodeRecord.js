const bind = require('./utils/bind.js');
const minify = require('./utils/minify.js');
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

  printOperations() {
    console.log(this.operations);
    this.compressOperations()
    console.log(this.compressedOperations.changes);
    //console.log(minify(this.compressedOperations.changes));
  }

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

  listen() {
    this.editor.on('changes', this.changesListener);
    this.editor.on('cursorActivity', this.cursorActivityListener);
  }

  changesListener(editor, changes) {
    this.operations.changes.push({
      startTime: this.getOperationRelativeTime(), // time
      endTime: this.getOperationRelativeTime(), // time
      beforeDuration: this.getLastChangePause(), // duration
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
    changes = this.compressContinuousInput(changes);
    changes = this.compressContinuousDelete(changes);
    changes = this.compressContinuousCompose(changes);
    this.compressedOperations.changes = changes;
  }

  isContinueInput(firstChange, secondChange) {
    if (firstChange.ops.length !== secondChange.ops.length) {
      return false;
    } else if (secondChange.beforeDuration >= this.acceptableMinDelay) {
      return false;
    } else {
      for (let i = 0; i < secondChange.ops.length; i++) {
        if (secondChange.ops[i].from.line !== secondChange.ops[i].to.line ||
            firstChange.ops[i].from.line !== firstChange.ops[i].to.line ||
            secondChange.ops[i].from.ch !== secondChange.ops[i].to.ch ||
            firstChange.ops[i].from.ch !== firstChange.ops[i].to.ch) {
          return false;
        } else if (firstChange.ops[i].from.ch + 1 !== secondChange.ops[i].from.ch) {
          return false;
        }
      }
    }
    return true;
  }

  compressContinuousInput(changes) {
    let newChanges = [];
    while(changes.length > 0) {
      let change = changes.pop(); // 拿出最新的一条
      if (change.ops[0].origin === '+input') {
        while(changes.length > 0) {
          let lastChange = changes.pop();
          if (lastChange.ops[0].origin === '+input' &&
          this.isContinueInput(lastChange, change)) {
            change.startTime = lastChange.startTime;
            change.beforeDuration = lastChange.beforeDuration;
            change.combo += 1;
            for (let i = 0; i < change.ops.length; i++) {
              change.ops[i].from = lastChange.ops[i].from;
              change.ops[i].to = lastChange.ops[i].to;
              change.ops[i].text = lastChange.ops[i].text.concat(change.ops[i].text);
            }
          } else {
            changes.push(lastChange);
            break;
          }
        }
        newChanges.unshift(change);
      } else {
        newChanges.unshift(change);
      }
    }
    return newChanges;
  }


  isContinueDelete(firstChange, secondChange) {
    if (firstChange.ops.length !== secondChange.ops.length) {
      return false;
    } else if (secondChange.beforeDuration >= this.acceptableMinDelay) {
      return false;
    } else {
      for (let i = 0; i < secondChange.ops.length; i++) {
        if (secondChange.ops[i].from.line !== secondChange.ops[i].to.line ||
            firstChange.ops[i].from.line !== firstChange.ops[i].to.line) {
          return false;
        } else if (firstChange.ops[i].from.ch !== secondChange.ops[i].to.ch) {
          return false;
        }
      }
    }

    return true;
  }

  compressContinuousDelete(changes) {
    let newChanges = [];
    while(changes.length > 0) {
      let change = changes.pop(); // 拿出最新的一条
      if (change.ops[0].origin === '+delete') {
        while(changes.length > 0) {
          let lastChange = changes.pop();
          if (lastChange.ops[0].origin === '+delete' &&
          this.isContinueDelete(lastChange, change)) {
            change.startTime = lastChange.startTime;
            change.beforeDuration = lastChange.beforeDuration;
            change.combo += 1;
            for (let i = 0; i < change.ops.length; i++) {
              change.ops[i].to = lastChange.ops[i].to;
              change.ops[i].removed = change.ops[i].removed.concat(lastChange.ops[i].removed);
            }
          } else {
            changes.push(lastChange);
            break;
          }
        }
        newChanges.unshift(change);
      } else {
        newChanges.unshift(change);
      }
    }
    return newChanges;
  }


  isContinueCompose(firstChange, secondChange) {
    if (firstChange.ops.length !== secondChange.ops.length) {
      return false;
    } else {
      for (let i = 0; i < secondChange.ops.length; i++) {
        if (secondChange.ops[i].from.line !== secondChange.ops[i].to.line ||
            firstChange.ops[i].from.line !== firstChange.ops[i].to.line ||
            secondChange.ops[i].from.ch !== secondChange.ops[i].to.ch ||
            firstChange.ops[i].from.ch !== firstChange.ops[i].to.ch) {
          return false;
        } else if (firstChange.ops[i].from.ch + firstChange.ops[i].text[0].length !== secondChange.ops[i].from.ch) {
          return false;
        }
      }
    }

    return true;
  }

  compressContinuousCompose(changes) {
    let newChanges = [];
    while(changes.length > 0) {
      let change = changes.pop(); // 拿出最新的一条
      if (change.ops[0].origin === '*compose') {
        while(changes.length > 0) {
          let lastChange = changes.pop();
          if (lastChange.ops[0].origin === '*compose' &&
          this.isContinueCompose(lastChange, change)) {
            change.startTime = lastChange.startTime;
            change.beforeDuration = lastChange.beforeDuration;
            change.combo += 1;
            for (let i = 0; i < change.ops.length; i++) {
              change.ops[i].from = lastChange.ops[i].from;
              change.ops[i].to = lastChange.ops[i].to;
              change.ops[i].text = lastChange.ops[i].text.concat(change.ops[i].text);
            }
          } else {
            changes.push(lastChange);
            break;
          }
        }
        newChanges.unshift(change);
      } else {
        newChanges.unshift(change);
      }
    }
    return newChanges;
  }
}
module.exports = CodeRecord;