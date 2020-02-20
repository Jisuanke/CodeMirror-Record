import {CodeRecord, CodePlay} from '../src';

/**
 * Listen on codemirror recording
 */
const recordCodeMirror = CodeMirror.fromTextArea(
    document.getElementById('editor-record'), {
      mode: 'javascript',
      autoCloseBrackets: true,
    }
);

const codeRecorder = new CodeRecord(recordCodeMirror);

let record = '';

codeRecorder.listen();

document.getElementById('record').onclick = function() {
  record = codeRecorder.getRecords();
  console.log(JSON.parse(record));
};

document.getElementById('play').onclick = function() {
  codePlayer.addOperation(record);
};

/**
 * Listen on codemirror playing
 */
const playCodeMirror = CodeMirror.fromTextArea(
    document.getElementById('editor-play'), {
      readOnly: true,
      mode: 'javascript',
      autoCloseBrackets: true,
    }
);

const codePlayer = new CodePlay(playCodeMirror);

// let flushTimer = null;

// recordCodeMirror.on('changes', function() {
//   clearTimeout(flushTimer);
//   flushTimer = setTimeout(flushToPlayer, 3000);
// });

recordCodeMirror.setValue('var tes;\nlet a = "\\n\\nLOL";');
