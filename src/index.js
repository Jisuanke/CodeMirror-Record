const CodeRecord = require('./CodeRecord.js');
const CodePlay = require('./CodePlay.js');

/**
 * Listen on codemirror recording
 */
let recordCodeMirror = CodeMirror.fromTextArea(document.getElementById('editor-record'), {
  mode: "javascript"
});

let codeRecorder = new CodeRecord(recordCodeMirror)

codeRecorder.listen()

document.getElementById('record').onclick = function() {
  console.log(codeRecorder.getRecord())
}

/**
 * Listen on codemirror playing
 */
let playCodeMirror = CodeMirror.fromTextArea(document.getElementById('editor-play'), {
  mode: "javascript"
});

let codePlayer = new CodePlay(playCodeMirror)

codePlayer.listen()

recordCodeMirror.setValue('var tes;\\nvar tes;')
setInterval(() => {
  let recordedOperations = codeRecorder.getRecord()
  console.log(recordedOperations)
  codePlayer.addOperation(recordedOperations)
}, 3000)