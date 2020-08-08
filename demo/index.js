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

let records = '';

codeRecorder.listen();

document.getElementById('get-records').onclick = function() {
  records = codeRecorder.getRecords();
  console.log(JSON.parse(records));
};

document.getElementById('add-operations').onclick = function() {
  console.log('operations added');
  codePlayer.addOperations(records);
};

document.getElementById('play').onclick = function() {
  console.log('start playing');
  codePlayer.play();
};

document.getElementById('pause').onclick = function() {
  console.log('pause playing');
  codePlayer.pause();
};

document.getElementById('speed').onchange = function() {
  const speed = document.getElementById('speed').value;
  console.log('change speed to', speed);
  codePlayer.setSpeed(speed);
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

const codePlayer = new CodePlay(playCodeMirror, {
  maxPause: 3000,
});

recordCodeMirror.setValue('var tes;\nlet a = "\\n\\nLOL";');
