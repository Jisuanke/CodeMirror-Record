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

let flushTimer = null;

const flushToPlayer = function() {
  const recordedOperations = codeRecorder.getRecords();
  codePlayer.addOperation(recordedOperations);
};

recordCodeMirror.on('changes', function() {
  clearTimeout(flushTimer);
  flushTimer = setTimeout(flushToPlayer, 3000);
});

recordCodeMirror.setValue('var tes;\nlet a = "\\n\\nLOL";');
