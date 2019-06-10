import {CodeRecord, CodePlay} from '../src';

/**
 * Listen on codemirror recording
 */
const recordCodeMirror = CodeMirror.fromTextArea(
    document.getElementById('editor-record'), {
      mode: 'javascript',
    }
);

const codeRecorder = new CodeRecord(recordCodeMirror);

codeRecorder.listen();

document.getElementById('record').onclick = function() {
  console.log(codeRecorder.getRecords());
};

/**
 * Listen on codemirror playing
 */
const playCodeMirror = CodeMirror.fromTextArea(
    document.getElementById('editor-play'), {
      readOnly: true,
      mode: 'javascript',
    }
);

const codePlayer = new CodePlay(playCodeMirror);

recordCodeMirror.setValue('var tes;\nlet a = "\\n\\nLOL";');
setInterval(() => {
  const recordedOperations = codeRecorder.getRecords();
  codePlayer.addOperation(recordedOperations);
}, 3000);
