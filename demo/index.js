import {CodeRecord, CodePlay} from '../src';

const initialCode = [
  'function greet(name) {',
  "  return 'Hello, ' + name + '!';",
  '}',
  '',
  "greet('developer');",
].join('\n');

const elements = {
  capture: document.getElementById('capture-records'),
  copy: document.getElementById('copy-payload'),
  eventLog: document.getElementById('event-log'),
  load: document.getElementById('load-operations'),
  operationCount: document.getElementById('operation-count'),
  pause: document.getElementById('pause'),
  payloadOutput: document.getElementById('payload-output'),
  payloadSize: document.getElementById('payload-size'),
  play: document.getElementById('play'),
  playerState: document.getElementById('player-state'),
  progress: document.getElementById('playback-progress'),
  progressTime: document.getElementById('playback-time'),
  recorderHint: document.getElementById('recorder-hint'),
  recorderState: document.getElementById('recorder-state'),
  replay: document.getElementById('replay'),
  reset: document.getElementById('reset-demo'),
  sampleEdit: document.getElementById('sample-edit'),
  speed: document.getElementById('speed'),
  transferNote: document.getElementById('transfer-note'),
};

const flowSteps = Array.from(document.querySelectorAll('[data-flow-step]'));

const recordCodeMirror = CodeMirror.fromTextArea(
    document.getElementById('editor-record'),
    {
      autoCloseBrackets: true,
      lineNumbers: true,
      mode: 'javascript',
    },
);

const playCodeMirror = CodeMirror.fromTextArea(
    document.getElementById('editor-play'),
    {
      lineNumbers: true,
      mode: 'javascript',
      readOnly: true,
    },
);

recordCodeMirror.setValue(initialCode);
playCodeMirror.setValue(initialCode);
recordCodeMirror.getInputField().setAttribute(
    'aria-label',
    'Recording editor. Edit this code to record a session.',
);
recordCodeMirror.getInputField().setAttribute('id', 'recording-editor-input');
recordCodeMirror.getInputField().setAttribute('name', 'recording-editor');
playCodeMirror.getInputField().setAttribute(
    'aria-label',
    'Playback editor. This read-only editor shows the replay.',
);
playCodeMirror.getInputField().setAttribute('id', 'playback-editor-input');
playCodeMirror.getInputField().setAttribute('name', 'playback-editor');

const codeRecorder = new CodeRecord(recordCodeMirror);
const codePlayer = new CodePlay(playCodeMirror, {
  maxDelay: 3000,
  speed: 1,
  extraActivityHandler: (activity) => {
    logEvent('extra', 'Played custom activity: ' + JSON.stringify(activity));
  },
});

let sessionPayload = [];
let loadedPayload = '';
let hasEnded = false;
let isScrubbing = false;
let pendingSeekTarget = null;

/**
 * Format milliseconds as a compact player timestamp.
 *
 * @param {number} milliseconds Time to format.
 * @return {string} A minutes:seconds timestamp.
 */
function formatTime(milliseconds) {
  const safeTime = Math.max(0, Number(milliseconds) || 0);
  const totalTenths = Math.round(safeTime / 100);
  const minutes = Math.floor(totalTenths / 600);
  const seconds = ((totalTenths % 600) / 10).toFixed(1).padStart(4, '0');
  return minutes + ':' + seconds;
}

/**
 * Format a payload byte count for display.
 *
 * @param {number} bytes Number of bytes.
 * @return {string} Human-readable size.
 */
function formatBytes(bytes) {
  if (bytes < 1024) {
    return bytes + ' B';
  }
  return (bytes / 1024).toFixed(1) + ' KB';
}

/**
 * Add a concise runtime event to the visible log.
 *
 * @param {string} eventName Event label.
 * @param {string} message Event description.
 */
function logEvent(eventName, message) {
  const item = document.createElement('li');
  const eventLabel = document.createElement('span');
  const description = document.createElement('span');

  eventLabel.className = 'event-name';
  eventLabel.textContent = eventName;
  description.textContent = message;
  item.append(eventLabel, description);
  elements.eventLog.prepend(item);

  while (elements.eventLog.children.length > 5) {
    elements.eventLog.lastElementChild.remove();
  }
}

/**
 * Reflect the current stage in the four-step workflow.
 *
 * @param {number|null} activeStep One-based active step, or null.
 * @param {number} completedThrough Last completed step.
 */
function updateFlow(activeStep, completedThrough) {
  flowSteps.forEach((step) => {
    const stepNumber = Number(step.dataset.flowStep);
    step.classList.toggle('is-complete', stepNumber <= completedThrough);
    step.classList.toggle('is-active', stepNumber === activeStep);
    if (stepNumber === activeStep) {
      step.setAttribute('aria-current', 'step');
    } else {
      step.removeAttribute('aria-current');
    }
  });
}

/**
 * Update the player status badge.
 *
 * @param {string} label Status text.
 * @param {string} stateClass Optional state class.
 */
function setPlayerState(label, stateClass) {
  elements.playerState.textContent = label;
  elements.playerState.className = 'state-badge';
  if (stateClass) {
    elements.playerState.classList.add(stateClass);
  }
}

/**
 * Update both the native range and its readable time label.
 *
 * @param {number} currentTime Current player time in milliseconds.
 */
function updateTimeline(currentTime) {
  const duration = codePlayer.getDuration();
  const clampedTime = Math.min(Math.max(0, currentTime), duration);
  if (!isScrubbing) {
    elements.progress.value = String(Math.round(clampedTime));
  }
  elements.progressTime.value =
    formatTime(clampedTime) + ' / ' + formatTime(duration);
  elements.progress.setAttribute(
      'aria-valuetext',
      formatTime(clampedTime) + ' of ' + formatTime(duration),
  );
}

/**
 * Reset the player to the shared baseline and load a recording.
 *
 * @param {string} payload Serialized operations.
 * @param {boolean} announce Whether to add a load event.
 */
function preparePlayer(payload, announce) {
  pendingSeekTarget = null;
  codePlayer.clear();
  playCodeMirror.setValue(initialCode);
  codePlayer.addOperations(payload);
  loadedPayload = payload;
  hasEnded = false;

  const duration = codePlayer.getDuration();
  elements.progress.max = String(Math.max(1, Math.ceil(duration)));
  elements.progress.value = '0';
  elements.play.disabled = false;
  elements.pause.disabled = true;
  elements.replay.disabled = false;
  elements.speed.disabled = false;
  elements.progress.disabled = false;
  elements.load.disabled = true;
  setPlayerState('Ready', 'state-ready');
  updateTimeline(0);
  updateFlow(4, 3);

  if (announce) {
    logEvent(
        'load',
        sessionPayload.length + ' JSON entries loaded into CodePlay.',
    );
  }
}

/**
 * Move the player to a timeline position, including the zero-time boundary.
 *
 * @param {number} requestedTime Target time in milliseconds.
 */
function seekPlayer(requestedTime) {
  if (!loadedPayload) {
    return;
  }

  const duration = codePlayer.getDuration();
  const targetTime = Math.min(Math.max(0, requestedTime), duration);
  const wasPlaying = codePlayer.getStatus() === 'PLAY';
  isScrubbing = false;
  hasEnded = false;
  elements.play.disabled = false;
  elements.pause.disabled = true;

  if (targetTime <= 0) {
    preparePlayer(loadedPayload, false);
    logEvent('seek', 'Timeline returned to 0:00.0.');
    if (wasPlaying) {
      codePlayer.play();
    }
    return;
  }

  pendingSeekTarget = targetTime;
  if (targetTime >= duration && wasPlaying) {
    codePlayer.pause();
  }
  elements.progress.value = String(Math.round(targetTime));
  updateTimeline(targetTime);
  codePlayer.seek(targetTime);
}

codeRecorder.listen();

/**
 * Mark editor activity as ready for the next capture batch.
 */
function markRecorderPending() {
  elements.capture.disabled = false;
  elements.load.disabled = true;
  elements.recorderHint.textContent =
    'New activity is queued. Capture it when the edit is ready.';
  elements.transferNote.textContent =
    'Pending recorder activity has not been serialized yet.';
  updateFlow(2, 1);
}

recordCodeMirror.on('changes', markRecorderPending);
recordCodeMirror.on('cursorActivity', markRecorderPending);

elements.sampleEdit.addEventListener('click', () => {
  const lastLine = recordCodeMirror.lastLine();
  const insertionPoint = {
    line: lastLine,
    ch: recordCodeMirror.getLine(lastLine).length,
  };
  recordCodeMirror.replaceRange(
      '\n\nconst player = new CodePlay(replayEditor, {speed: 1});',
      insertionPoint,
  );
  recordCodeMirror.focus();
  elements.sampleEdit.disabled = true;
  elements.sampleEdit.textContent = 'Sample inserted';
});

elements.capture.addEventListener('click', () => {
  const batch = JSON.parse(codeRecorder.getRecords());
  if (batch.length === 0) {
    elements.capture.disabled = true;
    elements.transferNote.textContent = 'There are no pending edits to capture.';
    return;
  }

  // getRecords() drains the recorder, so every batch contains only new activity.
  sessionPayload = sessionPayload.concat(batch);
  const serializedPayload = JSON.stringify(sessionPayload);
  elements.payloadOutput.textContent = JSON.stringify(sessionPayload, null, 2);
  elements.operationCount.textContent = String(sessionPayload.length);
  elements.payloadSize.textContent = formatBytes(
      new Blob([serializedPayload]).size,
  );
  elements.capture.disabled = true;
  elements.copy.disabled = false;
  elements.load.disabled = false;
  elements.recorderHint.textContent =
    'Batch captured. Further edits can be appended to this session.';
  elements.transferNote.textContent =
    batch.length + ' new entries captured. Load the JSON into the player.';
  updateFlow(3, 2);
  logEvent(
      'capture',
      batch.length + ' new entries serialized by CodeRecord.getRecords().',
  );
});

elements.copy.addEventListener('click', async () => {
  if (!navigator.clipboard) {
    elements.transferNote.textContent =
      'Clipboard access is unavailable. Select the JSON to copy it manually.';
    return;
  }

  try {
    await navigator.clipboard.writeText(
        JSON.stringify(sessionPayload, null, 2),
    );
    elements.copy.textContent = 'Copied';
    elements.transferNote.textContent = 'The recording JSON is on your clipboard.';
    window.setTimeout(() => {
      elements.copy.textContent = 'Copy JSON';
    }, 1800);
  } catch (error) {
    elements.transferNote.textContent =
      'Copy failed. Select the JSON to copy it manually.';
    console.warn('Unable to copy recording JSON', error);
  }
});

elements.load.addEventListener('click', () => {
  if (sessionPayload.length === 0) {
    return;
  }

  const payload = JSON.stringify(sessionPayload);
  preparePlayer(payload, true);
  elements.transferNote.textContent =
    'Payload loaded. The player is ready to replay the timeline.';
});

elements.play.addEventListener('click', () => {
  if (!loadedPayload) {
    return;
  }
  if (hasEnded) {
    preparePlayer(loadedPayload, false);
  }
  hasEnded = false;
  codePlayer.play();
});

elements.pause.addEventListener('click', () => {
  codePlayer.pause();
});

elements.replay.addEventListener('click', () => {
  if (!loadedPayload) {
    return;
  }
  preparePlayer(loadedPayload, false);
  logEvent('replay', 'Timeline reset to the shared starting document.');
  codePlayer.play();
});

elements.speed.addEventListener('change', () => {
  const speed = Number(elements.speed.value);
  codePlayer.setSpeed(speed);
  logEvent('speed', 'Playback speed changed to ' + speed + '×.');
});

elements.progress.addEventListener('pointerdown', () => {
  isScrubbing = true;
});

elements.progress.addEventListener('input', () => {
  const previewTime = Number(elements.progress.value);
  elements.progressTime.value =
    formatTime(previewTime) + ' / ' + formatTime(codePlayer.getDuration());
  elements.progress.setAttribute(
      'aria-valuetext',
      formatTime(previewTime) + ' of ' +
      formatTime(codePlayer.getDuration()),
  );
});

elements.progress.addEventListener('change', () => {
  seekPlayer(Number(elements.progress.value));
});

elements.progress.addEventListener('keydown', (event) => {
  const duration = codePlayer.getDuration();
  const currentTime = Number(elements.progress.value);
  const step = Math.max(1, Math.round(duration / 20));
  let targetTime = null;

  if (event.key === 'Home') {
    targetTime = 0;
  } else if (event.key === 'End') {
    targetTime = duration;
  } else if (event.key === 'ArrowLeft' || event.key === 'ArrowDown') {
    targetTime = currentTime - step;
  } else if (event.key === 'ArrowRight' || event.key === 'ArrowUp') {
    targetTime = currentTime + step;
  }

  if (targetTime !== null) {
    event.preventDefault();
    seekPlayer(targetTime);
  }
});

elements.progress.addEventListener('blur', () => {
  isScrubbing = false;
});

elements.reset.addEventListener('click', () => {
  window.location.reload();
});

codePlayer.on('play', () => {
  pendingSeekTarget = null;
  hasEnded = false;
  setPlayerState('Playing', 'state-playing');
  elements.play.disabled = true;
  elements.pause.disabled = false;
  updateFlow(4, 3);
  logEvent('play', 'CodePlay started applying queued operations.');
});

codePlayer.on('pause', () => {
  elements.pause.disabled = true;
  if (!hasEnded && pendingSeekTarget === null) {
    setPlayerState('Paused', '');
    elements.play.disabled = false;
    logEvent('pause', 'Playback paused at ' +
      formatTime(codePlayer.getCurrentTime()) + '.');
  }
});

codePlayer.on('seek', () => {
  setPlayerState('Seeking', 'state-playing');
  logEvent(
      'seek',
      'Moving to ' + formatTime(Number(elements.progress.value)) + '.',
  );
});

codePlayer.on('end', () => {
  pendingSeekTarget = null;
  hasEnded = true;
  setPlayerState('Complete', 'state-complete');
  elements.play.disabled = true;
  elements.pause.disabled = true;
  elements.replay.disabled = false;
  updateTimeline(codePlayer.getDuration());
  updateFlow(null, 4);
  logEvent('end', 'Replay complete. All loaded operations were applied.');
});

codePlayer.on('clear', () => {
  logEvent('clear', 'The previous player queue was cleared.');
});

/**
 * Keep the native timeline synchronized while preserving user scrubbing.
 */
function refreshPlayerTime() {
  const currentTime = codePlayer.getCurrentTime();
  if (
    pendingSeekTarget !== null &&
    codePlayer.getStatus() === 'PAUSE' &&
    Math.abs(currentTime - pendingSeekTarget) <= 5
  ) {
    pendingSeekTarget = null;
    setPlayerState('Paused', '');
    elements.play.disabled = false;
    elements.pause.disabled = true;
  }
  if (loadedPayload && !isScrubbing && !hasEnded) {
    updateTimeline(currentTime);
  }
  window.requestAnimationFrame(refreshPlayerTime);
}

updateFlow(1, 0);
refreshPlayerTime();
