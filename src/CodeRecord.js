import minify from './utils/minify';
import compress from './func/compress';
import {normalizeInsertedText} from './func/compress/input';
import {
  assertEditorView,
  getEditorRuntimeTypes,
  playbackUserEvent,
} from './codemirror6';

/**
 * Convert a CodeMirror 6 document offset to a legacy wire-format position.
 *
 * @param {object} doc CodeMirror 6 text document
 * @param {number} position Document offset
 * @return {object} Legacy line and character position
 */
function positionToCodeMirror5(doc, position) {
  const line = doc.lineAt(position);
  return {line: line.number - 1, ch: position - line.from};
}

/**
 * Convert CodeMirror 6 selection ranges to the legacy wire-format shape.
 *
 * @param {object} selection CodeMirror 6 selection
 * @param {object} doc Document containing the selection
 * @return {array} Legacy selection ranges
 */
function selectionToCodeMirror5(selection, doc) {
  const ranges = selection.ranges.map((range) => ({
    anchor: positionToCodeMirror5(doc, range.anchor),
    head: positionToCodeMirror5(doc, range.head),
  }));
  if (selection.mainIndex !== ranges.length - 1) {
    const [mainRange] = ranges.splice(selection.mainIndex, 1);
    ranges.push(mainRange);
  }
  return ranges;
}

/**
 * Test whether playback can infer an explicit selection from document changes.
 *
 * @param {object} selection CodeMirror 6 selection after a transaction
 * @param {array} cursorOffsets Cursor offsets produced by replaying the changes
 * @return {boolean} Whether a separate cursor record would be redundant
 */
function selectionMatchesChangeCursors(selection, cursorOffsets) {
  if (selection.ranges.length !== cursorOffsets.length ||
      selection.mainIndex !== 0) {
    return false;
  }
  return selection.ranges.every((range, index) =>
    range.anchor === cursorOffsets[index] &&
    range.head === cursorOffsets[index],
  );
}

/**
 * Map a CodeMirror 6 user event to a legacy v1 change origin.
 *
 * @param {object} transaction CodeMirror 6 transaction
 * @param {number} from Start offset in the old document
 * @param {number} to End offset in the old document
 * @param {number} insertedLength Length inserted into the new document
 * @return {string} CodeMirror 5 change origin
 */
function transactionOrigin(transaction, from, to, insertedLength) {
  const {constructor: Transaction} = transaction;
  if (transaction.isUserEvent('input.type.compose')) {
    return '*compose';
  }
  if (transaction.isUserEvent('input.paste')) {
    return 'paste';
  }
  if (transaction.isUserEvent('input.drop') ||
      transaction.isUserEvent('move.drop')) {
    return 'drag';
  }
  if (transaction.isUserEvent('delete.cut')) {
    return 'cut';
  }
  if (transaction.isUserEvent('delete')) {
    return '+delete';
  }
  if (transaction.annotation(Transaction.userEvent) === undefined) {
    if (from === 0 && to === transaction.startState.doc.length) {
      return 'setValue';
    }
    return from !== to && insertedLength === 0 ? '+delete' : '+input';
  }
  return '+input';
}

/**
 * Convert one CM6 change set to the sequential legacy segments used on wire.
 *
 * Changes are emitted in descending old-document order so applying them in
 * wire order cannot shift the coordinates of a later segment.
 *
 * @param {object} transaction CodeMirror 6 transaction
 * @return {object} Legacy changes and the resulting cursor offsets
 */
function legacyChangesFrom(transaction) {
  const cursorOffsets = [];
  const changes = [];
  transaction.changes.iterChanges(
      (fromA, toA, fromB, toB, inserted) => {
        cursorOffsets.push(toB);
        changes.unshift({
          from: positionToCodeMirror5(transaction.startState.doc, fromA),
          to: positionToCodeMirror5(transaction.startState.doc, toA),
          origin: transactionOrigin(
              transaction,
              fromA,
              toA,
              inserted.length,
          ),
          removed: transaction.startState.doc
              .sliceString(fromA, toA)
              .split('\n'),
          text: inserted.toString().split('\n'),
        });
      },
      true,
  );
  return {changes, cursorOffsets};
}

/**
 * A class for code recording
 */
export class CodeRecord {
  /**
   * constructor - Initialize a instance for recording coding operations.
   *
   * @param {EditorView} editor CodeMirror 6 editor view
   */
  constructor(editor) {
    assertEditorView(editor);
    const currentTime = +new Date;
    this.initTime = currentTime;
    this.lastChangeTime = currentTime;
    this.lastSelectionTime = currentTime;
    this.operations = [];
    this.view = editor;
    this.viewUpdateListener = this.viewUpdateListener.bind(this);
  }

  /**
   * recordExtraActivity
   * @param {object} activity
   **/
  recordExtraActivity(activity) {
    const relativeTime = this.getOperationRelativeTime();
    const changes = [{
      origin: 'extra',
      activity: activity,
    }];

    this.operations.push({
      startTime: relativeTime,
      endTime: relativeTime,
      ops: changes,
    });
  }

  /**
   * Install the transaction-native CodeMirror 6 update listener.
   */
  listen() {
    const {
      EditorView,
      StateEffect,
    } = getEditorRuntimeTypes(this.view);
    const listenerExtension = EditorView.updateListener.of(
        this.viewUpdateListener,
    );
    if (this.view.state.facet(EditorView.updateListener)
        .includes(this.viewUpdateListener)) {
      return;
    }
    this.view.dispatch({
      effects: StateEffect.appendConfig.of(
          listenerExtension,
      ),
    });
  }

  /**
   * Translate CodeMirror 6 transactions into the existing record format.
   *
   * @param {object} update CodeMirror 6 ViewUpdate
   */
  viewUpdateListener(update) {
    for (const transaction of update.transactions) {
      if (transaction.isUserEvent(playbackUserEvent)) {
        continue;
      }
      const transactionTime = transaction.annotation(
          transaction.constructor.time,
      );
      const currentTime = transactionTime === undefined ?
        +new Date : transactionTime;
      let cursorOffsets = [];
      let suppressesLegacySelection = false;
      if (transaction.docChanged) {
        const converted = legacyChangesFrom(transaction);
        cursorOffsets = converted.cursorOffsets;
        const firstChange = converted.changes[0];
        suppressesLegacySelection =
          (firstChange.origin === '+input' &&
            normalizeInsertedText(firstChange.text) === '\n\n') ||
          converted.changes.some((change) =>
            change.origin === '+input' &&
            normalizeInsertedText(change.text) === '',
          );
        this.recordChanges(converted.changes, currentTime);
      }
      const selectionChangedWithoutContent =
        !transaction.docChanged && transaction.selection !== undefined;
      const contentDidNotInferSelection = transaction.docChanged &&
        (suppressesLegacySelection || !selectionMatchesChangeCursors(
            transaction.newSelection,
            cursorOffsets,
        ));
      if (selectionChangedWithoutContent || contentDidNotInferSelection) {
        this.recordSelection(
            transaction.newSelection,
            transaction.newDoc,
            currentTime,
        );
      }
    }
  }

  /**
   * getRecords - Get unrecorded changes
   *
   * @return {string}  Changes to be recorded in JSON format
   */
  getRecords() {
    this.compressCursorOperations();
    this.compressChanges();
    return JSON.stringify(minify(this.operations));
  }


  /**
   * getOperationRelativeTime - Compute relative point of time of a change.
   *
   * @param {number} currentTime Absolute timestamp to convert
   * @return {number} Point of time relative to creation of recorder instance
   */
  getOperationRelativeTime(currentTime = +new Date) {
    return currentTime - this.initTime;
  }

  /**
   * getLastChangePause - Get delay of time since last content change.
   *
   * @param {number} currentTime Absolute timestamp of the content change
   * @return {number} Delay delay of time since last content change.
   */
  getLastChangePause(currentTime = +new Date) {
    const lastChangePause = currentTime - this.lastChangeTime;
    this.lastChangeTime = currentTime;

    return lastChangePause;
  }

  /**
   * Get the delay since the previous recorded selection transaction.
   *
   * @param {number} currentTime Absolute timestamp of the selection change
   * @return {number} Delay since the previous selection change
   */
  getLastSelectionPause(currentTime = +new Date) {
    const lastSelectionPause = currentTime - this.lastSelectionTime;
    this.lastSelectionTime = currentTime;

    return lastSelectionPause;
  }

  /**
   * Record document changes already converted at the CM6/codec seam.
   *
   * @param  {array} changes Changes using the legacy codec shape
   * @param  {number} currentTime Absolute timestamp of the content change
   */
  recordChanges(changes, currentTime = +new Date) {
    const relativeTime = this.getOperationRelativeTime(currentTime);
    this.operations.push({
      startTime: relativeTime,
      endTime: relativeTime,
      delayDuration: this.getLastChangePause(currentTime),
      ops: changes,
      combo: 1,
    });
  }

  /**
   * Record a CM6 selection using the legacy wire-format position shape.
   *
   * @param {object} selection CodeMirror 6 editor selection
   * @param {object} doc Document containing the selection
   * @param {number} currentTime Absolute timestamp of the selection change
   */
  recordSelection(selection, doc, currentTime = +new Date) {
    this.operations.push({
      startTime: this.getOperationRelativeTime(currentTime),
      endTime: this.getOperationRelativeTime(currentTime),
      delayDuration: this.getLastSelectionPause(currentTime),
      crs: selectionToCodeMirror5(selection, doc),
      combo: 1,
    });
  }

  /**
   * compressCursorOperations - Compress cursor operations to minimize cost.
   */
  compressCursorOperations() {
    let operations = this.operations;
    operations = compress.select(operations);
    operations = compress.cursor(operations);
    this.operations = operations;
  }

  /**
   * compressChanges - Compress content operations to minimize cost.
   */
  compressChanges() {
    const compressedOperations = [];
    let segment = [];
    const compressSegment = (operations) => {
      operations = compress.input(operations);
      operations = compress.remove(operations);
      return compress.compose(operations);
    };

    for (const operation of this.operations) {
      const firstOrigin = operation.ops[0].origin;
      const hasMixedOrigins = operation.ops.some(
          (change) => change.origin !== firstOrigin,
      );
      if (hasMixedOrigins) {
        compressedOperations.push(...compressSegment(segment));
        segment = [];
        const normalizedOperation = {
          ...operation,
          ops: operation.ops.map((change) => change.origin === '+input' ? {
            ...change,
            text: normalizeInsertedText(change.text),
          } : change),
        };
        compressedOperations.push(normalizedOperation);
      } else {
        segment.push(operation);
      }
    }
    compressedOperations.push(...compressSegment(segment));
    this.operations = compressedOperations;
  }
}
