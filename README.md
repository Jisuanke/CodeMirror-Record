![CodeMirror-Record](https://repository-images.githubusercontent.com/185612280/91c64600-d0e5-11ea-8ed4-7fbaff9271a8)

It is a project for recording and playing back activities in the CodeMirror editor and the surrounding environment. You can try this project on the [online demo page](http://codemirror-record.haoranyu.com/demo/).

## Local Demo

After cloning this repository, follow the steps below to run the local demo in the directory.

1. Solve dependencies by running `npm install`.
2. Use `npm run build` to build the project.
3. Use `npm run serve` to start a node server that hosts the local demo of the project.
4. If a page is not automatically loaded in your browser you could visit  `http://localhost:8080/demo/` manually in your browser.
5. Coding in the editor on the left. All changes will be recorded and synced. Then you can play the records in the editor on the right.

## API

The project provides APIs for code recording and playback organized in the Recorder and Player sections.

### Recorder

#### Initialize a recorder

We can pass a CodeMirror instance `recordCodeMirror` into the constructor `CodeRecord` as a parameter to create an instance of `CodeRecorder`. By calling the `listen` function, we can start listening the operations in the CodeMirror editor indicated by `recordCodeMirror`.

```javascript
// recordCodeMirror is a CodeMirror instance.
const codeRecorder = new CodeRecord(recordCodeMirror);
codeRecorder.listen();
```

#### Record extra activities

The function `recordExtraActivity` can be used to record any activity that is not happened in the CodeMirror editor. The parameter can be anything that can be played by the `extraActivityHandler` function in the player.

```javascript
// moreActivities is some external value we would like to record
codeRecorder.recordExtraActivity(moreActivities);
```

#### Get record result string

After a series of operations inside and outside the editor, an array describing all operations can be obtained by calling `getRecords`.

```js
let records = '';
records = codeRecorder.getRecords();
```

### Player

#### Initialize a player

We can pass a CodeMirror instance `playCodeMirror` into the constructor `CodePlay` as a parameter to create an instance of `CodePlayer`.

```javascript
// playCodeMirror is a CodeMirror instance.
const codePlayer = new CodePlay(playCodeMirror);
```

You may add an object of extra setting options as the second parameter of `CodePlay` constructor. The supported options are as follows.

| Option Name | Meaning | Default |
| --- | --- | --- |
| maxDelay | The maximum pause supported by the player (in millisecond). The pause with time length longer than the value of this option will be replaced with this value. Only non-negative values will be adopted. | `-1` |
| autoplay | The player will play recorded operations immediately after being added to the recorder if the value of this option is `true`. | `false` |
| autofocus | The editor will be focused whenever recorded operations play if the value of this option is `true`. | `false` |
| speed | The multiples of playing speed in the player that decides how fast the player playback the operations. | `1` |
| extraActivityHandler | The callback function for dealing with extra activities recorded. When it is `null`, the recorded extra activities will be skipped. | `null` |
| extraActivityReverter | The callback function for reverting extra activities recorded. When it is `null`, the recorded extra activities will be skipped reverting. | `null` |

##### Example

The following options make the player automatically play added records without calling the `play` function. And the maximum delay before each operation will be no longer than 3000ms. The operations will be played back at 0.8 times speed.

```javascript
// playCodeMirror is a CodeMirror instance.
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

Add `records` array of operation objects provided by `codeRecorder`.

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
let seekTime = 10102;
codePlayer.seek(seekTime);
```

##### Get player status

Get the status of the player. If there is any recorded operation being played, the value is `PLAY`. Otherwise, the value is `PAUSE`.

```javascript
let seekTime = 10102;
codePlayer.seek(seekTime);
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
  - "r": The description of continuous deletion. Possible types: `List of Integer List`.
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
