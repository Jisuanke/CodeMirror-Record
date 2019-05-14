import { CodeRecord, CodePlay } from '../src';

/**
 * Listen on codemirror recording
 */
let recordCodeMirror = CodeMirror.fromTextArea(document.getElementById('editor-record'), {
  mode: "javascript"
});

let codeRecorder = new CodeRecord(recordCodeMirror);

codeRecorder.listen();

document.getElementById('record').onclick = function() {
  console.log(codeRecorder.getRecords());
}

/**
 * Listen on codemirror playing
 */
let playCodeMirror = CodeMirror.fromTextArea(document.getElementById('editor-play'), {
  readOnly: true,
  mode: "javascript"
});

let codePlayer = new CodePlay(playCodeMirror);

codePlayer.listen();

recordCodeMirror.setValue('var tes;\nlet a = "\\n\\nLOL";')
setInterval(() => {
  let recordedOperations = codeRecorder.getRecords()
  codePlayer.addOperation(recordedOperations)
}, 3000);
