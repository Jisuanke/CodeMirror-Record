# CodeMirror Record

A project for recording coding activities in CodeMirror editor.

## API

## Data Explanation

Each manipulation of coding activities is saved as an object.

#### General Format

For discrete manipulations, the formats are as follows.

```js
{
  "t":[14,14], // Relative start and end time of the manipulation
  "o": [ // Each item correspond to one cursor
    "i": [[1,7],[1,15]], // Start and end position of selection denoted by line number and position in the line. The end position (with the outer brackets) is omitted if the start and end position is the same.
    "a": ["string"], // Inserted Contents, one each insertion.
    "o": "s" // Type
  ]
}
```

Continuous insertions, deletions and compositions are the manipulations most frequently happens. Hence they are compressed. The formats are almost the same but also with miner difference.

```js
{
  "t":[14,14],
  "l": 13, // The number of compressed manipulations
  "o": [
    "i": [[1,7],[1,15]],
    "a": ["string"],
    "r": [ // The length of this array equals to the value of l.
      [[0,8], [1,2]], // Case1: denote deletion across lines
      [1, 9], // Case2: deletion in a line. the example means a deletion of 1 character for 9 times.
    ], //
    "o": "s"
  ]
}
```

#### Final Step

All activities related objects are finally squash into an array and stringified.  