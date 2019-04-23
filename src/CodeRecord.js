class CodeRecord {
  constructor(editor) {
    console.log('constructor')
    this.editor = editor
  }
  listen() {
    console.log('listen start')
    this.editor.on('cursorActivity', this.cursorActivityListener)
  }
  cursorActivityListener(editor) {
    console.log(editor.doc.history)
  }
}
module.exports = CodeRecord