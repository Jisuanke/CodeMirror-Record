import type {EditorView} from '@codemirror/view';

export type CodePlayEvent = 'play' | 'pause' | 'seek' | 'end' | 'clear';

export interface CodePlayOptions {
  maxDelay?: number;
  autoplay?: boolean;
  autofocus?: boolean;
  speed?: number;
  extraActivityHandler?: ((activity: unknown) => void) | null;
  extraActivityReverter?: ((activity: unknown) => void) | null;
}

export class CodeRecord {
  constructor(editor: EditorView);
  listen(): void;
  recordExtraActivity(activity: unknown): void;
  getRecords(): string;
}

export class CodePlay {
  constructor(editor: EditorView, options?: CodePlayOptions);
  setMaxDelay(maxDelay: number): void;
  setAutoplay(autoplay: boolean): void;
  setAutofocus(autofocus: boolean): void;
  setSpeed(speed: number): void;
  setExtraActivityHandler(
    extraActivityHandler: ((activity: unknown) => void) | null,
  ): void;
  setExtraActivityReverter(
    extraActivityReverter: ((activity: unknown) => void) | null,
  ): void;
  addOperations(operations: string): void;
  clear(): void;
  play(): void;
  pause(): void;
  seek(seekTime: number): void;
  getStatus(): 'PLAY' | 'PAUSE';
  getCurrentTime(): number;
  getDuration(): number;
  on(event: CodePlayEvent, listener: () => void): this;
  off(event: CodePlayEvent, listener: () => void): this;
  once(event: CodePlayEvent, listener: () => void): this;
}
