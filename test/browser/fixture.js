import {EditorSelection, EditorState, Transaction} from '@codemirror/state';
import {basicSetup, EditorView} from 'codemirror';

import {CodePlay, CodeRecord} from '../../dist/index.mjs';

const initialDocument = 'seed seed\ncut-me\nanchor';
const browserEvents = [];
const transactionEvents = [];

function selectionJSON(selection) {
  return {
    mainIndex: selection.mainIndex,
    ranges: selection.ranges.map((range) => ({
      anchor: range.anchor,
      head: range.head,
    })),
  };
}

const recorderView = new EditorView({
  parent: document.getElementById('record-editor'),
  state: EditorState.create({
    doc: initialDocument,
    extensions: [
      basicSetup,
      EditorState.allowMultipleSelections.of(true),
      EditorView.updateListener.of((update) => {
        for (const transaction of update.transactions) {
          const userEvent = transaction.annotation(Transaction.userEvent);
          if (userEvent !== undefined) {
            transactionEvents.push(userEvent);
          }
        }
      }),
    ],
  }),
});

const playerView = new EditorView({
  parent: document.getElementById('play-editor'),
  state: EditorState.create({
    doc: initialDocument,
    extensions: [
      basicSetup,
      EditorState.allowMultipleSelections.of(true),
      EditorState.readOnly.of(true),
      EditorView.editable.of(false),
    ],
  }),
});

const recorder = new CodeRecord(recorderView);
recorder.listen();

for (const type of [
  'beforeinput',
  'compositionend',
  'compositionstart',
  'compositionupdate',
  'cut',
  'drop',
  'input',
  'keydown',
  'paste',
]) {
  recorderView.contentDOM.addEventListener(type, (event) => {
    browserEvents.push({
      data: typeof event.data === 'string' ? event.data : null,
      inputType: typeof event.inputType === 'string' ? event.inputType : null,
      isComposing: event.isComposing === true,
      isTrusted: event.isTrusted,
      key: typeof event.key === 'string' ? event.key : null,
      type: event.type,
    });
  }, true);
}

document.getElementById('drag-source').addEventListener('dragstart', (event) => {
  event.dataTransfer.setData('text/plain', 'DROP');
  event.dataTransfer.effectAllowed = 'copy';
});

window.browserSmoke = {
  capture() {
    return recorder.getRecords();
  },

  coordinatesAt(position) {
    const rectangle = recorderView.coordsAtPos(position);
    return {
      x: rectangle.left + 1,
      y: (rectangle.top + rectangle.bottom) / 2,
    };
  },

  eventEvidence() {
    return {
      browserEvents: [...browserEvents],
      transactionEvents: [...transactionEvents],
    };
  },

  recordingState() {
    return {
      document: recorderView.state.doc.toString(),
      selection: selectionJSON(recorderView.state.selection),
    };
  },

  async umdRoundTrip() {
    const umdRecordHost = document.createElement('div');
    const umdPlayHost = document.createElement('div');
    document.body.append(umdRecordHost, umdPlayHost);
    const umdInitialDocument = 'alpha\nbeta';
    const umdRecordView = new EditorView({
      parent: umdRecordHost,
      state: EditorState.create({
        doc: umdInitialDocument,
        extensions: [EditorState.allowMultipleSelections.of(true)],
      }),
    });
    const umdPlayView = new EditorView({
      parent: umdPlayHost,
      state: EditorState.create({doc: umdInitialDocument}),
    });

    try {
      const umdRecorder = new window.CodeRecord(umdRecordView);
      umdRecorder.listen();
      const insertion = '\nUMD';
      const finalLength = umdInitialDocument.length + insertion.length;
      umdRecordView.dispatch({
        changes: {
          from: umdInitialDocument.length,
          insert: insertion,
        },
        selection: EditorSelection.create([
          EditorSelection.range(2, 0),
          EditorSelection.range(finalLength, finalLength - 3),
        ], 0),
        annotations: Transaction.userEvent.of('input.type'),
      });
      const source = {
        document: umdRecordView.state.doc.toString(),
        selection: selectionJSON(umdRecordView.state.selection),
      };
      const payload = umdRecorder.getRecords();
      const umdPlayer = new window.CodePlay(umdPlayView, {
        maxDelay: 1,
        speed: 100,
      });
      umdPlayer.addOperations(payload);
      await new Promise((resolve, reject) => {
        const timeout = window.setTimeout(
            () => reject(new Error('UMD playback did not finish within 5 seconds')),
            5000,
        );
        umdPlayer.once('end', () => {
          window.clearTimeout(timeout);
          resolve();
        });
        umdPlayer.play();
      });

      return {
        exports: {
          CodePlay: typeof window.CodePlay,
          CodeRecord: typeof window.CodeRecord,
        },
        payload: JSON.parse(payload),
        replayed: {
          document: umdPlayView.state.doc.toString(),
          selection: selectionJSON(umdPlayView.state.selection),
          status: umdPlayer.getStatus(),
        },
        source,
      };
    } finally {
      umdRecordView.destroy();
      umdPlayView.destroy();
      umdRecordHost.remove();
      umdPlayHost.remove();
    }
  },

  async play(payload) {
    const player = new CodePlay(playerView, {maxDelay: 1, speed: 100});
    player.addOperations(payload);
    await new Promise((resolve, reject) => {
      const timeout = window.setTimeout(
          () => reject(new Error('Playback did not finish within 5 seconds')),
          5000,
      );
      player.once('end', () => {
        window.clearTimeout(timeout);
        resolve();
      });
      player.play();
    });
    return {
      document: playerView.state.doc.toString(),
      selection: selectionJSON(playerView.state.selection),
      status: player.getStatus(),
    };
  },
};

const crossGenerationInitialDocument = 'abc\ndef';

function withControlledClock(callback) {
  const RealDate = window.Date;
  const initialTime = RealDate.parse('2026-01-01T00:00:00Z');
  let currentTime = initialTime;

  class ControlledDate extends RealDate {
    constructor(...arguments_) {
      if (arguments_.length === 0) {
        super(currentTime);
      } else {
        super(...arguments_);
      }
    }

    static now() {
      return currentTime;
    }
  }

  window.Date = ControlledDate;
  try {
    return callback((relativeTime, action) => {
      currentTime = initialTime + relativeTime;
      return action();
    });
  } finally {
    window.Date = RealDate;
  }
}

function createCrossGenerationView() {
  const host = document.createElement('div');
  host.dataset.browserFixture = 'cross-generation';
  document.body.append(host);
  const view = new EditorView({
    parent: host,
    state: EditorState.create({
      doc: crossGenerationInitialDocument,
      extensions: [EditorState.allowMultipleSelections.of(true)],
    }),
  });
  return {host, view};
}

function playCrossGenerationPayload(Player, payload) {
  const {host, view} = createCrossGenerationView();
  const activities = [];
  const player = new Player(view, {
    extraActivityHandler(activity) {
      activities.push(activity);
    },
    maxDelay: 1,
    speed: 100,
  });
  player.addOperations(payload);

  return new Promise((resolve, reject) => {
    const timeout = window.setTimeout(() => {
      view.destroy();
      host.remove();
      reject(new Error(
          'Cross-generation CM6 playback did not finish within 5 seconds',
      ));
    }, 5000);
    player.once('end', () => {
      window.clearTimeout(timeout);
      const result = {
        activities,
        document: view.state.doc.toString(),
        duration: player.getDuration(),
        payload,
        selection: selectionJSON(view.state.selection),
      };
      player.pause();
      view.destroy();
      host.remove();
      resolve(result);
    });
    player.play();
  });
}

window.browserCrossGeneration = {
  capture() {
    const Recorder = window.CodeRecord;
    if (typeof Recorder !== 'function') {
      throw new TypeError('The packed v2 CodeRecord export is unavailable');
    }
    const {host, view} = createCrossGenerationView();
    try {
      return withControlledClock((at) => {
        const recorder = new Recorder(view);
        recorder.listen();
        at(10, () => view.dispatch({
          annotations: Transaction.userEvent.of('input.type'),
          changes: {from: 0, insert: 'X'},
          selection: EditorSelection.cursor(1),
        }));
        at(20, () => view.dispatch({
          annotations: Transaction.userEvent.of('input.type'),
          changes: {from: 1, insert: 'Y'},
          selection: EditorSelection.cursor(2),
        }));
        at(30, () => view.dispatch({
          annotations: Transaction.userEvent.of('delete.backward'),
          changes: {from: 4, to: 5, insert: ''},
          selection: EditorSelection.cursor(4),
        }));
        at(40, () => recorder.recordExtraActivity({
          kind: 'golden',
          value: 1,
        }));
        at(50, () => view.dispatch({
          selection: EditorSelection.create([
            EditorSelection.range(3, 0),
            EditorSelection.range(8, 5),
          ], 1),
        }));
        return {
          document: view.state.doc.toString(),
          payload: recorder.getRecords(),
          selection: selectionJSON(view.state.selection),
        };
      });
    } finally {
      view.destroy();
      host.remove();
    }
  },

  play(payload) {
    if (typeof payload !== 'string') {
      throw new TypeError('Cross-generation payload must remain a string');
    }
    const Player = window.CodePlay;
    if (typeof Player !== 'function') {
      throw new TypeError('The packed v2 CodePlay export is unavailable');
    }
    return playCrossGenerationPayload(Player, payload);
  },
};

window.browserSmokeReady = true;
