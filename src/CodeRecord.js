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

  isContinueInput(firstChange, secondChange) { // 判断是否可以被视为连续输入
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
        } else if (firstChange.ops[i].from.ch + 1 !== secondChange.ops[i].from.ch && // 同行的下一个字符
          !(firstChange.ops[i].from.line + 1 === secondChange.ops[i].from.line && secondChange.ops[i].from.ch === 0)) { // 换行的情况
          return false;
        }
      }
    }
    return true;
  }

  compressContinuousInput(changes) { // 对连续输入进行压缩
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


  isContinueDelete(firstChange, secondChange) { // 判断是否可以被视为连续删除
    if (firstChange.ops.length !== secondChange.ops.length) {
      return false;
    } else if (secondChange.beforeDuration >= this.acceptableMinDelay) {
      return false;
    } else {
      for (let i = 0; i < secondChange.ops.length; i++) {
        if (firstChange.ops[i].from.ch !== secondChange.ops[i].to.ch ||
            firstChange.ops[i].from.line !== secondChange.ops[i].to.line) {
          return false;
        }
      }
    }
    return true;
  }

  transferContinuousDeleteContentsToCounts(change) {
    // 这里对已经压缩合并过的删除行为进行一下进一步和压缩表示，
    // 将部分操作变为计数，而不再存它的内容（因为不需要存，我们可以算出来）
    // https://git.jisuan.ren/haoranyu/codemirror-record/issues/2
    if (change.combo === 1) return change; // 不是被压缩合并的情况无需处理
    for (let i = 0; i < change.ops.length; i++) {
      let resultArray = []
      let countStack = []
      while (change.ops[i].removed.length > 0) {
        let head = change.ops[i].removed.shift()
        if (typeof(head) === 'string') {
          if (countStack.length === 0) {
            countStack.push(head)
          } else {
            if (countStack[0].length === head.length) {
              countStack.push(head)
            } else {
              resultArray.push([countStack[0].length, countStack.length])
              countStack = []
              countStack.push(head)
            }
          }
        } else {
          if (countStack.length > 0) {
            resultArray.push([countStack[0].length, countStack.length])
            countStack = []
          }
          resultArray.push([
            [head[0].line, head[0].ch],
            [head[1].line, head[1].ch]
          ])
        }
      }
      if (countStack.length > 0) {
        resultArray.push([countStack[0].length, countStack.length])
      }
      change.ops[i].removed = resultArray
    }
    return change;
  }

  compressContinuousDelete(changes) { // 对连续删除进行压缩
    let newChanges = [];
    while(changes.length > 0) {
      let change = changes.pop();
      if (change.ops[0].origin === '+delete') {
        while(changes.length > 0) {
          let lastChange = changes.pop();
          if (lastChange.ops[0].origin === '+delete' &&
          this.isContinueDelete(lastChange, change)) {
            change.startTime = lastChange.startTime;
            change.beforeDuration = lastChange.beforeDuration;
            for (let i = 0; i < change.ops.length; i++) {

              // 下面两个 if 对跨多行的删除行为进行打包
              if (change.combo === 1 && change.ops[i].removed.length > 1) {
                change.ops[i].removed = [[change.ops[i].from, change.ops[i].to]]
              }
              if (lastChange.ops[i].removed.length > 1) {
                lastChange.ops[i].removed = [[lastChange.ops[i].from, lastChange.ops[i].to]]
              }

              // 合并区间并修改区间结束时间为合并后的区间结束时间
              change.ops[i].removed = change.ops[i].removed.concat(lastChange.ops[i].removed);
              change.ops[i].to = lastChange.ops[i].to;
            }
            change.combo += 1;
          } else {
            changes.push(lastChange);
            break;
          }
        }
        change = this.transferContinuousDeleteContentsToCounts(change)
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