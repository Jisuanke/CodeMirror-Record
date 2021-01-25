![CodeMirror-Record](https://repository-images.githubusercontent.com/185612280/91c64600-d0e5-11ea-8ed4-7fbaff9271a8)

A project for coding activities recording and playback in CodeMirror editor. You may experience the project on the [online demo page](http://codemirror-record.haoranyu.com/demo/).

## Local Demo

Just follow the steps.

1. Solve dependencies by `npm install`.
2. Run `npm run build` to build and `npm run serve` to start a node server.
3. If a page is not automatically opened in your browser you could visit  `http://localhost:8080/demo/` manually in your browser.
4. Coding in the first editor. Every change will be recorded and synced, by playing the records, to the second editor.

## API

### Recorder

#### Initialize a recorder

```javascript
// cm is a CodeMirror instance.
const codeRecorder = new CodeRecord(cm);
codeRecorder.listen();
```

#### Record extra activities

```javascript
// moreActivities is some external value we would like to record
codeRecorder.recordExtraActivity(moreActivities);
```

#### Get record result string

```js
let records = '';
records = codeRecorder.getRecords();
```

### Player

#### Initialize a player

```javascript
// cm is a CodeMirror instance.
const codePlayer = new CodePlay(playCodeMirror);
```

You may add extra setting parameters as the second argument of CodePlay constructor. Supporting setting parameters are as follows.

| Parameters | Meaning | Default |
| --- | --- | --- |
| maxDelay | The maximum pause that is supported in player (in millisecond). The pause with length longer than this setting will be replaced with this one. Only non-negative values will be adopted. | `-1` |
| autoplay | When it is set to true the recorded operations will be automatically played immediately after added. | `false` |
| speed | Playing speed in player which decides how fast operations are played back. | `1` |
| extraActivityHandler | The callback function for dealing with extra activities recorded. When it is `null`, the recorded extra activities will be skipped. | `null` |

##### Example

The following settings make player automatically play added records without calling `play` function. And the maximum delay before each operation will be no longer than 3000ms. The operations will be played back at 0.8 times speed.

```javascript
// cm is a CodeMirror instance.
const codePlayer = new CodePlay(playCodeMirror, {
  maxDelay: 3000,
  autoplay: true,
  speed: 0.8,
  extraActivityHandler: (activityRecorded) => {
    console.log(activityRecorded);
  }
});
```

#### Set options dynamically

You can change the value of maxDelay and autoplay by calling the following functions.

```javascript
codePlayer.setMaxDelay(3000);
codePlayer.setAutoplay(true);
codePlayer.setSpeed(2.5);
codePlayer.setExtraActivityHandler((activityRecorded) => {
  console.log(activityRecorded);
});
```

#### Add recorded operations

Add `records` object provided by codeRecorder.

```javascript
codePlayer.addOperations(records);
```


#### Play added operations

Focus on editor and play changes.

```javascript
codePlayer.play();
```

You can also call `play` to resume playing after `pause` is called.

#### Pause

Pause playing operations.

```javascript
codePlayer.pause();
```

## Data Explanation

Each manipulation of coding activities is saved as an object.

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

#### How to judge the operations are continuous?

- Time lag between operations, of the types which affect the text (insertion, deletion, input with IME, etc), is less than 1200ms.
- Time lag between cursor activities, including cursor movements and selections of
text, is less than 800ms.
- Operations, of the types which affect the text (insertion, deletion, input with IME, etc) with uniform speed (±600ms / operation lag).
- Cursor activities with uniform speed (±400ms / activity lag).

#### What are the meanings of abbreviations for operations?

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
