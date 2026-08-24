# Compression decision

Status: accepted for the stable CodeMirror 6 v2.0.0 release.

Decision: retain the existing v1 wire-format compression behind the recorder's
serialization seam. CodeMirror 6 integration remains transaction-native, while
`getRecords()` continues to emit compressed records that CodeMirror 5-era
players understand.

## Evidence

Run the reproducible benchmark from the repository root:

```sh
npm run build
node scripts/benchmark-compression.mjs
```

The benchmark imports `codemirror-record` through the package's public ESM
`exports` entry, so it exercises the built `dist/index.mjs` artifact. It uses
real CodeMirror 6 `EditorView` instances attached to jsdom and only calls the
public `CodeRecord` and `CodePlay` interfaces.

The stable v2.0.0 implementation produces these deterministic results:

| Scenario | Logical operations | Wire operations, compressed/uncompressed | UTF-8 bytes, compressed/uncompressed | Byte ratio | Bytes saved |
| --- | ---: | ---: | ---: | ---: | ---: |
| Typing | 33 | 1 / 33 | 89 / 1,472 | 6.0% | 94.0% |
| Deletion | 24 | 1 / 24 | 72 / 1,101 | 6.5% | 93.5% |
| Cursor and selection | 24 | 6 / 24 | 327 / 1,002 | 32.6% | 67.4% |
| Mixed editing | 18 | 6 / 18 | 376 / 791 | 47.5% | 52.5% |
| **Total** | **99** | **14 / 99** | **864 / 4,366** | **19.8%** | **80.2%** |

The compressed corpus is 3,502 bytes smaller and uses 85 fewer top-level wire
operations. These are compact JSON byte counts before transport compression;
they are not estimates of gzip size, browser memory, or CPU cost.

## Method

Each scenario is recorded twice with the same initial document, transactions,
20 ms timestamp intervals, and final selection:

1. The compressed run records the whole scenario and calls `getRecords()` once.
2. The control run calls `getRecords()` after every logical editor transaction.
   Because that method drains pending operations, parsing and concatenating the
   returned arrays prevents compression across transactions while preserving a
   valid v1 wire-format subset. The script asserts that every control operation
   has a scalar `t` and no compressed `l` field.

Both serialized outputs are then loaded into a fresh editor through public
`CodePlay`, played to their duration, and compared with the recorded editor.
The comparison covers document text, every selection range, and `mainIndex`.
Any mismatch exits nonzero.

The script also exits nonzero when:

- any scenario stops reducing both bytes and top-level wire operations; or
- the aggregate compressed-to-control byte ratio exceeds 40%.

The measured ratio is 19.8%. The 40% ceiling leaves headroom for safe codec
changes while still expressing the decision criterion: the legacy codec must
save at least 60% on this fixed corpus to justify its maintenance cost.

## Tradeoff and scope

Removing the compressor would reduce implementation surface. It would also
give up the established v1 representation and, on this corpus, increase stored
or transmitted JSON from 864 to 4,366 bytes. Keeping the codec therefore has
two concrete benefits: preserving the cross-generation wire contract and a
material size reduction on representative continuous editing.

The benchmark deliberately covers repeat typing, backward deletion, cursor
movement, growing selection, paste, and mixed editing. It does not claim that
these four scenarios model every workload, measure compression CPU time, or by
themselves prove CodeMirror 5 interoperability. Cross-version playback belongs
to the separate CM5/CM6 compatibility matrix; this benchmark answers only the
size-versus-complexity decision in issue #49.
