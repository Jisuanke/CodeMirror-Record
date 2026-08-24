![CodeMirror-Record](https://repository-images.githubusercontent.com/185612280/91c64600-d0e5-11ea-8ed4-7fbaff9271a8)

CodeMirror Record records and replays text changes, selections, timing, and
surrounding application activities. Version 2 is the current stable line for
CodeMirror 6. Existing CodeMirror 5 applications remain supported on version 1.

Try the CodeMirror 6 workflow in the [online demo](https://codemirror-record.haoranyu.com/demo/),
or follow the [CM5 to CM6 migration runbook](./docs/MIGRATING.md).

## Choose an editor version

| Editor runtime | Package line | Status | Install |
| --- | --- | --- | --- |
| CodeMirror 6 | `codemirror-record@2` | Current stable/default line; npm tags `latest` and `cm6` | `npm install codemirror-record@^2 @codemirror/state@^6 @codemirror/view@^6` |
| CodeMirror 5 | `codemirror-record@1` | Maintained on `v1`; npm tag `cm5` | `npm install codemirror-record@^1 codemirror@^5` |

The package major selects the editor interface; it does **not** select a new
recording format. Both lines use the established v1 JSON wire contract.

## Install CodeMirror 6

```sh
npm install codemirror-record@^2 @codemirror/state@^6 @codemirror/view@^6
```

The CodeMirror packages are peer dependencies. Keep one resolved copy of each
package to avoid extension identity conflicts in CodeMirror 6.

## Compatibility and CodeMirror 5

Version 2 preserves the v1.1.6 `CodeRecord` / `CodePlay` public surface; the
intentional breaking change is that constructors receive a CodeMirror 6
`EditorView` instead of a CodeMirror 5 instance. The serialized recording string
remains directly interoperable in both directions.

The release gate runs real recorders and players from every published v1.x
release against the packaged v2 artifacts. It covers compressed and equal-time
operations, multiline and multi-cursor changes, directed selections, timing,
seeking, origins, and external activities. Read the reproducible policy in
[RELEASING.md](./docs/RELEASING.md) and the compression decision in
[COMPRESSION.md](./docs/COMPRESSION.md).

Do not migrate or rewrite stored recording JSON. Pass the exact string to
`CodePlay.addOperations()`. Historical recordings are replayed as encoded; an
ambiguous operation already duplicated by an old recorder cannot be guessed
away safely.

The maintained v1.1.8 and v2.0.0 runtimes also share a small set of bug fixes,
without changing method names or the wire format: seeking to zero and rapid
replacement seeks restore their original speed/state; backward seeking restores
selections; a seek to the duration emits one `end`; terminal playback enters
`PAUSE` (emitting `pause`) before listeners receive `end`; and paste capture
does not mutate a non-cursor predecessor. Equal-time compressed groups with a
scalar timestamp also expand at that timestamp in both players; published
v0.3.1 through v1.1.7 readers produced invalid timing for that shape, while
maintained writers use `[time, time]` for new compressed equal-time groups.
Code that asserted v1.1.6's accidental `PLAY` status inside an `end` listener
should update that assertion. Historical ungrouped records with interval
`t: [start, end]` and no `l` are treated as one operation at `end`;
published v0.3.1 through v1.1.7 players exposed a non-numeric duration for that
shape when it was terminal, while v1.1.8 and v2 normalize it without rewriting
stored bytes.

CodeMirror 5 users can stay on `codemirror-record@^1` or the `cm5` tag. Its
[maintenance README](https://github.com/Jisuanke/CodeMirror-Record/tree/v1#readme)
and [CM5 API reference](https://github.com/Jisuanke/CodeMirror-Record/tree/v1#api)
remain available. Applications that intentionally host both editor generations
can use npm aliases; see the
[maintainer release policy](./docs/RELEASING.md#applications-that-host-both-editors).

## Local Demo

After cloning this repository, use Node.js 24 LTS and follow the steps below to run the local demo in the directory.

1. Solve dependencies by running `npm install`.
2. Use `npm run build` to build the project.
3. Use `npm run serve` to start a node server that hosts the local demo of the project.
4. If a page is not automatically loaded in your browser you could visit  `http://localhost:8080/demo/` manually in your browser.
5. Edit in the recorder, capture its JSON payload, load that payload into the player, and replay the timeline.

## API

The package has the same two named exports as v1:

```javascript
import {EditorState} from '@codemirror/state';
import {EditorView} from '@codemirror/view';
import {CodePlay, CodeRecord} from 'codemirror-record';

const recordCodeMirror = new EditorView({
  parent: document.querySelector('#record-editor'),
  state: EditorState.create({doc: ''}),
});

const playCodeMirror = new EditorView({
  parent: document.querySelector('#play-editor'),
  state: EditorState.create({doc: ''}),
});
```

### Recorder

#### Initialize a recorder

Pass an `EditorView` to `CodeRecord`, then call `listen`. Calling `listen` more than once is safe.

```javascript
// recordCodeMirror is a CodeMirror 6 EditorView.
const codeRecorder = new CodeRecord(recordCodeMirror);
codeRecorder.listen();
```

#### Record extra activities

The function `recordExtraActivity` can be used to record JSON-serializable activity that happens outside the CodeMirror editor. The player can handle the value with `extraActivityHandler`.

```javascript
// moreActivities is some external value we would like to record
codeRecorder.recordExtraActivity(moreActivities);
```

#### Get record result string

After a series of operations inside and outside the editor, call `getRecords` to obtain a serialized JSON string. The call drains the current batch; later calls return only newly recorded operations.

```js
let records = '';
records = codeRecorder.getRecords();
```

### Player

#### Initialize a player

Pass another CodeMirror 6 `EditorView` to `CodePlay`.

The player enables CodeMirror's multiple-selection facet when it is absent, so
legacy multi-cursor recordings also replay correctly on a default
`EditorState`.

```javascript
// playCodeMirror is a CodeMirror 6 EditorView.
const codePlayer = new CodePlay(playCodeMirror);
```

You may add an object of extra setting options as the second parameter of `CodePlay` constructor. The supported options are as follows.

| Option Name | Meaning | Default |
| --- | --- | --- |
| maxDelay | The maximum pause supported by the player (in milliseconds). Longer pauses are replaced by this value. A value of `0` disables the limit. | `0` |
| autoplay | The player will play recorded operations immediately after being added to the player if the value of this option is `true`. | `false` |
| autofocus | The editor will be focused whenever recorded operations play if the value of this option is `true`. | `false` |
| speed | The multiples of playing speed in the player that decides how fast the player playback the operations. | `1` |
| extraActivityHandler | The callback function for dealing with extra activities recorded. When it is `null`, the recorded extra activities will be skipped. | `null` |
| extraActivityReverter | The callback function for reverting extra activities recorded. When it is `null`, the recorded extra activities will be skipped reverting. | `null` |

##### Example

The following options make the player automatically play added records without calling the `play` function. And the maximum delay before each operation will be no longer than 3000ms. The operations will be played back at 0.8 times speed.

```javascript
// playCodeMirror is a CodeMirror 6 EditorView.
const codePlayer = new CodePlay(playCodeMirror, {
  maxDelay: 3000,
  autoplay: true,
  autofocus: true,
  speed: 0.8,
  extraActivityHandler: (activityRecorded) => {
    console.log(activityRecorded);
  },
  extraActivityReverter: (activityRecorded) => {
    console.log(activityRecorded);
  }
});
```

#### Player methods

##### Set options after initialization

You can change the value of player options after initialization. The value of options, including `maxDelay`, `autoplay`, `autofocus`, `speed`, `extraActivityHandler` and `extraActivityReverter`, can be changed by calling the following functions.

```javascript
codePlayer.setMaxDelay(3000);
codePlayer.setAutoplay(true);
codePlayer.setAutofocus(true);
codePlayer.setSpeed(2.5);
codePlayer.setExtraActivityHandler((activityRecorded) => {
  console.log(activityRecorded);
});
codePlayer.setExtraActivityReverter((activityRecorded) => {
  console.log(activityRecorded);
});
```

##### Clear and re-initialize the player instance

Clear all operations and status on the player instance.

```javascript
codePlayer.clear();
```

All options set will not be changed.

##### Add recorded operations

Add the serialized `records` string provided by `codeRecorder` or by a v1 recorder.

```javascript
codePlayer.addOperations(records);
```

##### Play added operations

Focus on the player editor and play the added operations.

```javascript
codePlayer.play();
```

You can also call `play` to resume playing after `pause` is called.

##### Pause

Pause the operations being played in the player editor.

```javascript
codePlayer.pause();
```

##### Seek

Seek to a given time position on the timeline of the player (in millisecond).

```javascript
const seekTime = 10102;
codePlayer.seek(seekTime);
```

##### Get player status

Get the status of the player. If there is any recorded operation being played, the value is `PLAY`. Otherwise, the value is `PAUSE`.

```javascript
const status = codePlayer.getStatus();
```

##### Get current time position

Get the current time position on the timeline of the player (in millisecond).

```javascript
codePlayer.getCurrentTime();
```

##### Get duration

Get the total time duration of recorded operations, in milliseconds.

```javascript
codePlayer.getDuration();
```

#### Player events

You may listen to player events or remove listeners as you wish using `on` and `off`. The following events are supported:

| Event | Explanation |
| --- | --- |
| play | The player starts to play operations |
| pause | The player pauses/stops playing |
| seek | `seek` method is called |
| end | All the operations played |
| clear | `clear` method is called |

> _We currently don't emit any parameters in the events. If you have any related needs, please submit an issue and let us know_

##### Example

```javascript
codePlayer.on('play', () => {
  console.log('play event triggered');
});

codePlayer.on('pause', () => {
  console.log('pause event triggered');
});

codePlayer.on('seek', () => {
  console.log('seek event triggered');
});

codePlayer.on('end', () => {
  console.log('end event triggered');
});

codePlayer.on('clear', () => {
  console.log('clear event triggered');
});
```

## Data Explanation

Each manipulation of operations is saved as an object.

#### General Format

The record of data is a list of objects corresponding to operations. Each of the object has the following format:

- "t": The relative time description of operations. Possible types: `Integer | Integer List`.
  - `Integer`: The relative time of this operation.
  - `Integer List`: The length of list is 2. The first item is the relative starting time and the second is the relative finish time.
- "l": The number of continuous operations combined in record. For example, multiple insertion, deletion or cursor movements.
- "o": The description of operations at positions. Each operation is described in detail as follows:
  - "i": Cursor position or part of selection. Possible types: `Integer List | List of Integer List`.
    - `Intger List`: The length of list is 2. The first item is the line number and the second is the position of character within the line.
    - `List of Integer List`: It is composed of two list with length two. The first and second lists illustrate the head and tail positions of a selection. Both of them are list of a line number followed by a position of character within the line.
  - "a": The content for insertion. Possible types: `String | String List | List of String List`.
    - `String`: The content to be inserted or replaced on given position of cursor or part of selected string.
    - `String List` / `List of String List`: The content to be inserted or replaced on circumstance of multiple lines insertion or replacement.
  - "d": The description of continuous deletion. Possible types: `List of Integer List`.
    - `List of Integer List`: It is composed of one or more lists with length two. For each list, the first item is the number of characters deleted at once, and the second is the number of such deletions. For example, `[[1,11], [2,3]]` correspond to 11 times of deletion of 1 character each time followed by 3 times of deletion of 2 characters each time.
  - "s": It describes the tail position of selection. The value of it is a list consisting of items with format `[line, [ch]]` or `[line, [ch1, ch2]]`. `line` is the line number which the tail position of selection holds. `ch` indicates the positions within the line for tail position of selection. `ch1, ch2` illustrates the movement of tail position from `ch1` position to `ch2` position within the line. For instance, `[[4, [5,6]], [5,[6]]]` shows that the tail position is firstly at line 4, char 5 and then moves to line 4, char 6 and then to line 5, char 6. (You may find the head position of selection with the data described in `"i"`)
  - "o": The type of operation. The type is `String` and you can find the mapping between the value and its meaning according to the following table.

#### How to judge whether the operations are continuous?

- Time lag between operations, of the types which affect the text (insertion, deletion, input with IME, etc), is less than 1200ms.
- Time lag between cursor activities, including cursor movements and selections of
text, is less than 800ms.
- Operations, of the types which affect the text (insertion, deletion, input with IME, etc) with uniform speed (±600ms / operation lag).
- Cursor activities with uniform speed (±400ms / activity lag).

#### What are the meanings of abbreviations of operations?

| Abbreviation | Full Name | Meaning |
| --- | --- | --- |
| c | *compose | Input with IME |
| d | +delete | Deletion |
| i | +input | Insertion |
| k | markText | Mark on Text |
| l | select | Selection of Text |
| m | *mouse | Mouse Activities |
| n | *rename | Rename |
| o | +move | Cursor Movement |
| p | paste | Paste Text |
| r | drag | Drag Text |
| s | setValue | Initialize Text |
| x | cut | Cut Text |
| e | extra | Extra External Activity |
