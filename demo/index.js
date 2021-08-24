import {CodeRecord, CodePlay} from '../src';

/**
 * Listen on CodeMirror recording
 */
const recordCodeMirror = CodeMirror.fromTextArea(
    document.getElementById('editor-record'), {
      mode: 'javascript',
      autoCloseBrackets: true,
    },
);

const codeRecorder = new CodeRecord(recordCodeMirror);
let records = '';

codeRecorder.listen();

document.getElementById('get-records').onclick = function() {
  records = codeRecorder.getRecords();
  console.log(JSON.parse(records));
};

document.getElementById('add-operations').onclick = function() {
  if (records !== '') {
    console.log('operations added');
    codePlayer.addOperations(records);
    records = '';
  } else {
    console.log('no operation to be added');
  }
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

const progressBar = document.getElementById('progress-bar');
const progressBarSlider = document.getElementById('progress-bar-slider');
const progressBarWidth = progressBar.offsetWidth;

setInterval(() => {
  const currentTime = codePlayer.getCurrentTime();
  const duration = codePlayer.getDuration();
  const playedProgress = progressBarWidth * (currentTime / duration);
  if (currentTime >= 0) {
    progressBarSlider.style.left = playedProgress + 'px';
  }
}, 100);

progressBar.onclick = function({
  offsetX: playedProgress,
}) {
  const percentage = playedProgress / progressBarWidth;
  const seekToTime = percentage * codePlayer.getDuration();
  progressBarSlider.style.left = playedProgress + 'px';
  console.log('seek to: ', seekToTime);
  codePlayer.seek(seekToTime);
};

/**
 * Listen on CodeMirror playing
 */
const playCodeMirror = CodeMirror.fromTextArea(
    document.getElementById('editor-play'), {
      readOnly: true,
      mode: 'javascript',
      autoCloseBrackets: true,
    },
);

const codePlayer = new CodePlay(playCodeMirror, {
  maxPause: 3000,
  extraActivityHandler: (extraOperation) => {
    console.log(extraOperation);
  },
});

codePlayer.on('play', () => {
  console.log('play event triggered');
});

codePlayer.on('pause', () => {
  console.log('pause event triggered');
});

codePlayer.on('seek', () => {
  console.log('seek event triggered');
});

codePlayer.on('stop', () => {
  console.log('stop event triggered');
});

recordCodeMirror.setValue('// This is a demo.\n// Write you code here:');
