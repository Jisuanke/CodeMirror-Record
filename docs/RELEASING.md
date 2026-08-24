# Releasing CodeMirror Record

## Package and branch decision

CodeMirror Record remains one npm package: `codemirror-record`.

- Package `1.x` is the maintained CodeMirror 5 adapter.
- Package `2.x` is the current CodeMirror 6 adapter and the default install.
- Both majors use the established v1 JSON recording contract. Package v2 is
  not a wire-format v2.

The editor integration changed enough to require a package major, but a second
package name would split discovery, documentation, issues, and the shared data
contract. Existing `^1` ranges never cross into v2, so CM5 applications remain
safe without changing their lockfiles.

| Branch | Purpose | Git tags |
| --- | --- | --- |
| `main` | Default branch; active CodeMirror 6 / package v2 line | `v2.*` |
| `v1` | CodeMirror 5 maintenance line | `v1.*` |

CM5 fixes target `v1`. Wire-reader and security fixes that affect both
majors must be forward-ported to `main`. Never merge v2 runtime code into the
maintenance branch.

The immutable `v1.1.8` artifact and tag point to commit `ee6cf90`. The `v1`
branch intentionally has later documentation/test-only commits that record the
final branch names and compatibility range. Release checks therefore treat the
tag commit and the maintenance branch head as separate identities; the tag
must never be moved.

## npm dist-tags

| Dist-tag | Meaning |
| --- | --- |
| `latest` | Default stable install; current CodeMirror 6 release |
| `cm6` | Latest stable `2.x` release, permanently |
| `cm5` | Latest maintained `1.x` release, permanently |
| `next` | Optional future prerelease only; not part of the 2.0.0 launch |

Never publish a CM5 release without `--tag cm5`. A plain `npm publish` from
`v1` would incorrectly move `latest` back to CodeMirror 5.

## Release invariants and terminal setup

The CM5 prerequisites were published in order as
`codemirror-record@1.1.7` and `codemirror-record@1.1.8`. The remaining stable
launch publishes `codemirror-record@2.0.0` for CM6. Phase 1 is an idempotent
audit/recovery gate for those immutable CM5 releases: it verifies v1.1.7 and
can publish v1.1.8 only if that exact artifact is unexpectedly still absent.
The repository and site branch cutover is already complete; the later phases
assert that it has not drifted from the verified release commit.

Run all release phases in the same terminal so the retained artifact paths and
commit IDs remain exported. Every phase is fail-fast. Do not paste selected
lines from a phase after a failure; diagnose it and repeat the complete phase.
The public npm registry is pinned explicitly so a private `.npmrc`, proxy, or
alternate default registry cannot become the release authority.

```sh
set -euo pipefail

export PUBLIC_NPM_REGISTRY=https://registry.npmjs.org/
export PACKAGE_NAME=codemirror-record
export REPOSITORY=Jisuanke/CodeMirror-Record
export V1_VERSION=1.1.8
export V1_PREVIOUS_VERSION=1.1.6
export V1_PREVIOUS_CM5_VERSION=1.1.7
export V2_VERSION=2.0.0
export V2_BRANCH=main
export EXPECTED_V1_RELEASE_COMMIT=ee6cf90fa6533247c780001511496bf557b47f88
export EXPECTED_V1_PREVIOUS_CM5_RELEASE_COMMIT=84d7e90405ed96db3a963bc489fb3e00124848f1
export EXPECTED_V1_BRANCH_COMMIT=45f0d71ec072b54f2d6ce0524eac58bf045630eb
export EXPECTED_V1_PREVIOUS_CM5_INTEGRITY=sha512-if1hp4NyH7+Lpwx79PNrYfa2WA4IxrL15dJ83pDWhLdx/wXCfPvh6hF4RzLuAltDaJc/13A82KbaeKJi0n8Nsw==
export EXPECTED_V1_INTEGRITY=sha512-2WCdbc2le6Rolih7q4pfJltvLECXYx/N7DoS/tZbozOdvLI+/opAhwJQtYtfyaEWpSC/HYfyCYV3PIwcbO0HoA==
export RELEASE_WORKSPACE
RELEASE_WORKSPACE=$(mktemp -d "${TMPDIR:-/tmp}/codemirror-record-release.XXXXXX")
export V1_ARTIFACT_DIR="$RELEASE_WORKSPACE/v$V1_VERSION"
export V2_ARTIFACT_DIR="$RELEASE_WORKSPACE/v$V2_VERSION"
mkdir -p "$V1_ARTIFACT_DIR" "$V2_ARTIFACT_DIR"

test "$PUBLIC_NPM_REGISTRY" = https://registry.npmjs.org/
export CODEMIRROR_NPM_REGISTRY_FLAG="--@codemirror:registry=$PUBLIC_NPM_REGISTRY"
test "$CODEMIRROR_NPM_REGISTRY_FLAG" = \
  --@codemirror:registry=https://registry.npmjs.org/
npm_public() {
  command npm "$@" \
    --registry "$PUBLIC_NPM_REGISTRY" \
    "$CODEMIRROR_NPM_REGISTRY_FLAG"
}
npx_public() {
  command npx \
    --registry "$PUBLIC_NPM_REGISTRY" \
    "$CODEMIRROR_NPM_REGISTRY_FLAG" \
    "$@"
}
verify_public_lockfile() {
  node --input-type=module - "$1" "$PUBLIC_NPM_REGISTRY" <<'NODE'
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
const [, , lockfilePath, registry] = process.argv;
const lockfile = JSON.parse(readFileSync(resolve(lockfilePath), 'utf8'));
for (const [packagePath, metadata] of Object.entries(lockfile.packages ?? {})) {
  if (
    metadata.resolved !== undefined &&
    !metadata.resolved.startsWith(registry) &&
    !metadata.resolved.startsWith('file:')
  ) {
    throw new Error(`${packagePath} resolved outside ${registry}: ${metadata.resolved}`);
  }
}
NODE
}
verify_stable_github_release() {
  local release_json
  release_json=$(gh release view "$1" \
    --repo "$REPOSITORY" \
    --json tagName,isDraft,isPrerelease)
  test "$(printf '%s' "$release_json" | jq -r .tagName)" = "$1"
  test "$(printf '%s' "$release_json" | jq -r .isDraft)" = false
  test "$(printf '%s' "$release_json" | jq -r .isPrerelease)" = false
}
test "$(gh repo view "$REPOSITORY" --json nameWithOwner --jq .nameWithOwner)" = "$REPOSITORY"
test "$(npm_public whoami)" = haoran_yu
test "$(gh api user --jq .login)" = haoranyu
printf 'Retained release artifacts: %s\n' "$RELEASE_WORKSPACE"
```

The `*.tgz` files retained under `RELEASE_WORKSPACE` are the only files that may
be passed to `npm publish`. Publishing a directory or repacking after a gate is
forbidden. npm web/2FA authorization is completed only when the corresponding
publish or dist-tag command requests it. A v1 publish, a v2 publish, and the
`latest` dist-tag promotion may each require separate authorization.

## Stable 2.0.0 launch order

### Phase 1: audit the published CM5 prerequisites

First prove that the exact v1.1.7 tag artifact is already immutable on npm and
has a stable GitHub Release. Build from the tag in an isolated archive, then
compare that tarball byte-for-byte with a fresh public-registry download. This
step never republishes v1.1.7.

```sh
set -euo pipefail

test "${PUBLIC_NPM_REGISTRY:?}" = https://registry.npmjs.org/
test "${V1_PREVIOUS_CM5_VERSION:?}" = 1.1.7
test -n "${EXPECTED_V1_PREVIOUS_CM5_RELEASE_COMMIT:?}"
test -n "${EXPECTED_V1_PREVIOUS_CM5_INTEGRITY:?}"

git fetch --prune origin --tags
V1_PREVIOUS_CM5_RELEASE_COMMIT=$(git rev-parse \
  "v$V1_PREVIOUS_CM5_VERSION^{commit}")
test "$V1_PREVIOUS_CM5_RELEASE_COMMIT" = \
  "$EXPECTED_V1_PREVIOUS_CM5_RELEASE_COMMIT"
test "$(git ls-remote origin \
  "refs/tags/v$V1_PREVIOUS_CM5_VERSION^{}" | cut -f1)" = \
  "$V1_PREVIOUS_CM5_RELEASE_COMMIT"
verify_stable_github_release "v$V1_PREVIOUS_CM5_VERSION"

V1_PREVIOUS_CM5_SOURCE_DIR="$RELEASE_WORKSPACE/v$V1_PREVIOUS_CM5_VERSION-source"
V1_PREVIOUS_CM5_PACK_DIR="$RELEASE_WORKSPACE/v$V1_PREVIOUS_CM5_VERSION-pack"
V1_PREVIOUS_CM5_REGISTRY_DIR="$RELEASE_WORKSPACE/v$V1_PREVIOUS_CM5_VERSION-registry"
mkdir -p "$V1_PREVIOUS_CM5_SOURCE_DIR" "$V1_PREVIOUS_CM5_PACK_DIR" \
  "$V1_PREVIOUS_CM5_REGISTRY_DIR"
git archive "$V1_PREVIOUS_CM5_RELEASE_COMMIT" | \
  tar -x -C "$V1_PREVIOUS_CM5_SOURCE_DIR"
(
  cd "$V1_PREVIOUS_CM5_SOURCE_DIR"
  npm_public ci
  verify_public_lockfile package-lock.json
  npm_config_tag=cm5 node scripts/require-publish-tag.cjs
  npm_public test
  npm pack --json --pack-destination "$V1_PREVIOUS_CM5_PACK_DIR" \
    --registry "$PUBLIC_NPM_REGISTRY" \
    "$CODEMIRROR_NPM_REGISTRY_FLAG" >"$V1_PREVIOUS_CM5_PACK_DIR/pack.json"
)
V1_PREVIOUS_CM5_TAG_TARBALL="$V1_PREVIOUS_CM5_PACK_DIR/$(node -e \
  "process.stdout.write(JSON.parse(require('node:fs').readFileSync(process.argv[1], 'utf8'))[0].filename)" \
  "$V1_PREVIOUS_CM5_PACK_DIR/pack.json")"
test "$(node -e \
  "process.stdout.write(JSON.parse(require('node:fs').readFileSync(process.argv[1], 'utf8'))[0].integrity)" \
  "$V1_PREVIOUS_CM5_PACK_DIR/pack.json")" = \
  "$EXPECTED_V1_PREVIOUS_CM5_INTEGRITY"

npm pack "$PACKAGE_NAME@$V1_PREVIOUS_CM5_VERSION" \
  --json \
  --pack-destination "$V1_PREVIOUS_CM5_REGISTRY_DIR" \
  --registry "$PUBLIC_NPM_REGISTRY" \
  "$CODEMIRROR_NPM_REGISTRY_FLAG" \
  >"$V1_PREVIOUS_CM5_REGISTRY_DIR/pack.json"
V1_PREVIOUS_CM5_REGISTRY_TARBALL="$V1_PREVIOUS_CM5_REGISTRY_DIR/$(node -e \
  "process.stdout.write(JSON.parse(require('node:fs').readFileSync(process.argv[1], 'utf8'))[0].filename)" \
  "$V1_PREVIOUS_CM5_REGISTRY_DIR/pack.json")"
test "$(node -e \
  "process.stdout.write(JSON.parse(require('node:fs').readFileSync(process.argv[1], 'utf8'))[0].integrity)" \
  "$V1_PREVIOUS_CM5_REGISTRY_DIR/pack.json")" = \
  "$EXPECTED_V1_PREVIOUS_CM5_INTEGRITY"
cmp "$V1_PREVIOUS_CM5_TAG_TARBALL" \
  "$V1_PREVIOUS_CM5_REGISTRY_TARBALL"
test "$(npm_public view "$PACKAGE_NAME@$V1_PREVIOUS_CM5_VERSION" version)" = \
  "$V1_PREVIOUS_CM5_VERSION"
```

Now test, pack, and idempotently verify or publish the maintained v1.1.8 CM5
release.

The release artifact is built from the immutable `v1.1.8` tag commit, while the
current `v1` branch includes the later branch-name documentation/CI commit.
This phase asserts both identities and their ancestry before detaching at the
tag commit. It executes the publish guard and complete test gate explicitly
before packing because publishing an already-created tarball must not be
assumed to run `prepublishOnly`.

```sh
set -euo pipefail

test "${PUBLIC_NPM_REGISTRY:?}" = https://registry.npmjs.org/
test "${PACKAGE_NAME:?}" = codemirror-record
test "${V1_VERSION:?}" = 1.1.8
test "${V1_PREVIOUS_VERSION:?}" = 1.1.6
test "${V1_PREVIOUS_CM5_VERSION:?}" = 1.1.7
test -d "${V1_ARTIFACT_DIR:?}"

git fetch --prune origin --tags
git switch v1
git pull --ff-only origin v1
export V1_RELEASE_COMMIT
V1_RELEASE_COMMIT=$(git rev-parse "v$V1_VERSION^{commit}")
test "$V1_RELEASE_COMMIT" = "${EXPECTED_V1_RELEASE_COMMIT:?}"
export V1_BRANCH_COMMIT
V1_BRANCH_COMMIT=$(git rev-parse HEAD)
test "$V1_BRANCH_COMMIT" = "${EXPECTED_V1_BRANCH_COMMIT:?}"
test "$(git ls-remote origin refs/heads/v1 | cut -f1)" = "$V1_BRANCH_COMMIT"
test "$(git ls-remote origin "refs/tags/v$V1_VERSION^{}" | cut -f1)" = \
  "$V1_RELEASE_COMMIT"
git merge-base --is-ancestor "$V1_RELEASE_COMMIT" "$V1_BRANCH_COMMIT"

git switch --detach "$V1_RELEASE_COMMIT"
test -z "$(git branch --show-current)"
test "$(node -p "require('./package.json').name")" = "$PACKAGE_NAME"
test "$(node -p "require('./package.json').version")" = "$V1_VERSION"

npm_public ci
verify_public_lockfile package-lock.json
npm_config_tag=cm5 node scripts/require-publish-tag.cjs
npm_public test
npm_public audit --omit=dev
npm_public pack --dry-run --json >/dev/null
test -z "$(git status --porcelain)"
test "$(git rev-parse HEAD)" = "$V1_RELEASE_COMMIT"

V1_RUN_ID=$(gh run list \
  --repo "$REPOSITORY" \
  --workflow ci.yml \
  --event push \
  --commit "$V1_RELEASE_COMMIT" \
  --limit 1 \
  --json databaseId \
  --jq '.[0].databaseId // empty')
test -n "$V1_RUN_ID"
gh run watch "$V1_RUN_ID" --repo "$REPOSITORY" --exit-status

test "$(git rev-parse "v$V1_VERSION^{commit}")" = "$V1_RELEASE_COMMIT"

export V1_PACK_JSON="$V1_ARTIFACT_DIR/pack.json"
npm pack \
  --json \
  --pack-destination "$V1_ARTIFACT_DIR" \
  --registry "$PUBLIC_NPM_REGISTRY" \
  "$CODEMIRROR_NPM_REGISTRY_FLAG" >"$V1_PACK_JSON"
test "$(node -e "process.stdout.write(JSON.parse(require('node:fs').readFileSync(process.argv[1], 'utf8'))[0].name)" "$V1_PACK_JSON")" = "$PACKAGE_NAME"
test "$(node -e "process.stdout.write(JSON.parse(require('node:fs').readFileSync(process.argv[1], 'utf8'))[0].version)" "$V1_PACK_JSON")" = "$V1_VERSION"
export V1_TARBALL
V1_TARBALL="$V1_ARTIFACT_DIR/$(node -e "process.stdout.write(JSON.parse(require('node:fs').readFileSync(process.argv[1], 'utf8'))[0].filename)" "$V1_PACK_JSON")"
export V1_EXPECTED_INTEGRITY
V1_EXPECTED_INTEGRITY=$(node -e "process.stdout.write(JSON.parse(require('node:fs').readFileSync(process.argv[1], 'utf8'))[0].integrity)" "$V1_PACK_JSON")
V1_HASHED_INTEGRITY=$(node -e "const fs=require('node:fs');const crypto=require('node:crypto');process.stdout.write('sha512-'+crypto.createHash('sha512').update(fs.readFileSync(process.argv[1])).digest('base64'))" "$V1_TARBALL")
test -f "$V1_TARBALL"
test -n "$V1_EXPECTED_INTEGRITY"
test "$V1_HASHED_INTEGRITY" = "$V1_EXPECTED_INTEGRITY"
test "$V1_EXPECTED_INTEGRITY" = "${EXPECTED_V1_INTEGRITY:?}"
test -z "$(git status --porcelain)"
printf 'v1 retained artifact: %s\nv1 SRI: %s\n' "$V1_TARBALL" "$V1_EXPECTED_INTEGRITY"
```

If the exact `V1_RUN_ID` lookup is empty, repeat only the complete lookup/watch
portion; do not substitute the branch's latest run.

Before making v1.1.8 immutable on npm, run its retained local tarball through
the provisional v2 forward-compatibility and capability-gated reverse matrix.
The checked corpus honestly records
`source.kind = retained-release-tarball`, the package name/version, and this
exact SRI; it never claims that an unpublished artifact came from npm. The
local package override is identity-checked and independently hashed against
`LEGACY_EXPECTED_INTEGRITY`.

```sh
set -euo pipefail

test "${PUBLIC_NPM_REGISTRY:?}" = https://registry.npmjs.org/
test -f "${V1_TARBALL:?}"
test -n "${V1_EXPECTED_INTEGRITY:?}"
test "$(git rev-parse "v$V1_VERSION^{commit}")" = "${V1_RELEASE_COMMIT:?}"

git switch "$V2_BRANCH"
test "$(git branch --show-current)" = "$V2_BRANCH"
git pull --ff-only origin "$V2_BRANCH"
test "$(node -p "require('./package.json').name")" = "$PACKAGE_NAME"
test "$(node -p "require('./package.json').version")" = "$V2_VERSION"
test -z "$(git status --porcelain)"
npm_public ci
verify_public_lockfile package-lock.json
npx_public --yes playwright install --with-deps chromium
LEGACY_PACKAGE_SPEC="$V1_TARBALL" \
LEGACY_EXPECTED_INTEGRITY="$V1_EXPECTED_INTEGRITY" \
npm_public run test:compat
test -z "$(git status --porcelain)"

git switch v1
test "$(git branch --show-current)" = v1
test "$(git rev-parse HEAD)" = "$V1_BRANCH_COMMIT"
test "$(git ls-remote origin refs/heads/v1 | cut -f1)" = "$V1_BRANCH_COMMIT"
test "$(git rev-parse "v$V1_VERSION^{commit}")" = "$V1_RELEASE_COMMIT"
git merge-base --is-ancestor "$V1_RELEASE_COMMIT" "$V1_BRANCH_COMMIT"
test -z "$(git status --porcelain)"
```

Publish the retained tarball in an interactive terminal. The phase establishes
the immutable Git tag first, re-hashes the file immediately before upload,
verifies the registry metadata and bytes, proves that `latest` did not move,
and only then creates the stable GitHub Release. Until v2.0.0 exists, GitHub
may present v1.1.8 as the repository's Latest release even though npm `latest`
must remain on v1.1.6. Phase 6 explicitly replaces that temporary GitHub state
with v2.0.0.

```sh
set -euo pipefail

test "${PUBLIC_NPM_REGISTRY:?}" = https://registry.npmjs.org/
test "${PACKAGE_NAME:?}" = codemirror-record
test "${V1_VERSION:?}" = 1.1.8
test -f "${V1_TARBALL:?}"
test -n "${V1_EXPECTED_INTEGRITY:?}"
test "$(git branch --show-current)" = v1
test "$(node -p "require('./package.json').name")" = "$PACKAGE_NAME"
test "$(node -p "require('./package.json').version")" = "$V1_VERSION"
test "$(git rev-parse HEAD)" = "${V1_BRANCH_COMMIT:?}"
test "$(git ls-remote origin refs/heads/v1 | cut -f1)" = "$V1_BRANCH_COMMIT"
test "$(git rev-parse "v$V1_VERSION^{commit}")" = "$V1_RELEASE_COMMIT"
git merge-base --is-ancestor "$V1_RELEASE_COMMIT" "$V1_BRANCH_COMMIT"
test -z "$(git status --porcelain)"
test "$(node -e "const fs=require('node:fs');const crypto=require('node:crypto');process.stdout.write('sha512-'+crypto.createHash('sha512').update(fs.readFileSync(process.argv[1])).digest('base64'))" "$V1_TARBALL")" = "$V1_EXPECTED_INTEGRITY"
test "$V1_EXPECTED_INTEGRITY" = "${EXPECTED_V1_INTEGRITY:?}"
test "$(npm_public view "$PACKAGE_NAME@latest" version)" = "$V1_PREVIOUS_VERSION"

V1_REMOTE_TAG_COMMIT=$(git ls-remote origin "refs/tags/v$V1_VERSION^{}" | cut -f1)
if test -n "$V1_REMOTE_TAG_COMMIT"; then
  test "$V1_REMOTE_TAG_COMMIT" = "$V1_RELEASE_COMMIT"
else
  git push origin "refs/tags/v$V1_VERSION:refs/tags/v$V1_VERSION"
fi
test "$(git ls-remote origin "refs/tags/v$V1_VERSION^{}" | cut -f1)" = "$V1_RELEASE_COMMIT"

V1_VIEW_ERROR="$RELEASE_WORKSPACE/v1-view.stderr"
if V1_PUBLISHED_METADATA=$(npm_public view \
  "$PACKAGE_NAME@$V1_VERSION" name version dist.integrity --json \
  2>"$V1_VIEW_ERROR"); then
  test "$(printf '%s' "$V1_PUBLISHED_METADATA" | jq -r .name)" = "$PACKAGE_NAME"
  test "$(printf '%s' "$V1_PUBLISHED_METADATA" | jq -r .version)" = "$V1_VERSION"
  test "$(printf '%s' "$V1_PUBLISHED_METADATA" | jq -r '."dist.integrity"')" = "$V1_EXPECTED_INTEGRITY"
else
  grep -Fq E404 "$V1_VIEW_ERROR"
  npm_public publish "$V1_TARBALL" --tag cm5
fi
test "$(npm_public view "$PACKAGE_NAME@$V1_VERSION" version)" = "$V1_VERSION"
test "$(npm_public view "$PACKAGE_NAME@$V1_VERSION" dist.integrity)" = "$V1_EXPECTED_INTEGRITY"

CM5_VERSION=$(npm_public view "$PACKAGE_NAME" dist-tags.cm5)
case "$CM5_VERSION" in
  "$V1_VERSION") ;;
  "$V1_PREVIOUS_VERSION"|"$V1_PREVIOUS_CM5_VERSION"|"")
    npm_public dist-tag add "$PACKAGE_NAME@$V1_VERSION" cm5
    ;;
  *)
    printf 'Refusing to replace unexpected cm5 dist-tag %s\n' "$CM5_VERSION" >&2
    exit 1
    ;;
esac
test "$(npm_public view "$PACKAGE_NAME@cm5" version)" = "$V1_VERSION"
test "$(npm_public view "$PACKAGE_NAME@latest" version)" = "$V1_PREVIOUS_VERSION"

export V1_REGISTRY_DIR
V1_REGISTRY_DIR=$(mktemp -d "$RELEASE_WORKSPACE/v1-registry.XXXXXX")
V1_REGISTRY_PACK_JSON="$V1_REGISTRY_DIR/pack.json"
npm pack "$PACKAGE_NAME@$V1_VERSION" \
  --json \
  --pack-destination "$V1_REGISTRY_DIR" \
  --registry "$PUBLIC_NPM_REGISTRY" \
  "$CODEMIRROR_NPM_REGISTRY_FLAG" >"$V1_REGISTRY_PACK_JSON"
test "$(node -e "process.stdout.write(JSON.parse(require('node:fs').readFileSync(process.argv[1], 'utf8'))[0].name)" "$V1_REGISTRY_PACK_JSON")" = "$PACKAGE_NAME"
test "$(node -e "process.stdout.write(JSON.parse(require('node:fs').readFileSync(process.argv[1], 'utf8'))[0].version)" "$V1_REGISTRY_PACK_JSON")" = "$V1_VERSION"
test "$(node -e "process.stdout.write(JSON.parse(require('node:fs').readFileSync(process.argv[1], 'utf8'))[0].integrity)" "$V1_REGISTRY_PACK_JSON")" = "$V1_EXPECTED_INTEGRITY"
export V1_REGISTRY_TARBALL
V1_REGISTRY_TARBALL="$V1_REGISTRY_DIR/$(node -e "process.stdout.write(JSON.parse(require('node:fs').readFileSync(process.argv[1], 'utf8'))[0].filename)" "$V1_REGISTRY_PACK_JSON")"
test "$(node -e "const fs=require('node:fs');const crypto=require('node:crypto');process.stdout.write('sha512-'+crypto.createHash('sha512').update(fs.readFileSync(process.argv[1])).digest('base64'))" "$V1_REGISTRY_TARBALL")" = "$V1_EXPECTED_INTEGRITY"
cmp "$V1_TARBALL" "$V1_REGISTRY_TARBALL"

test "$(git ls-remote origin "refs/tags/v$V1_VERSION^{}" | cut -f1)" = "$V1_RELEASE_COMMIT"
if gh release view "v$V1_VERSION" --repo "$REPOSITORY" >/dev/null 2>&1; then
  verify_stable_github_release "v$V1_VERSION"
else
  gh release create "v$V1_VERSION" \
    --repo "$REPOSITORY" \
    --verify-tag \
    --latest=false \
    --generate-notes
fi
verify_stable_github_release "v$V1_VERSION"
GITHUB_LATEST_TAG=$(gh api \
  "repos/$REPOSITORY/releases/latest" --jq .tag_name)
case "$GITHUB_LATEST_TAG" in
  "v$V1_VERSION"|"v$V2_VERSION") ;;
  *)
    printf 'Unexpected GitHub Latest release %s\n' "$GITHUB_LATEST_TAG" >&2
    exit 1
    ;;
esac
```

### Phase 2: prove the registry CM5 artifact and freeze the v2 candidate

Switch back to the CM6 `main` branch. First run the exact downloaded v1
tarball through the forward-compatibility and capability-gated reverse harness.
`LEGACY_EXPECTED_INTEGRITY`
is mandatory whenever `LEGACY_PACKAGE_SPEC` is present; the harness verifies
the package identity, version, npm SRI, and an independent SHA-512 of the exact
bytes before installing them.

Regenerate the v1.1.8 canonical corpus from the exact registry spec, not the
local source tree. The printed corpus must record
`source.kind = npm-registry`, the exact package spec, and the verified SRI.
Regenerate v1.1.7 by the same route and compare both candidates with their
committed registry-backed fixtures.

```sh
set -euo pipefail

test "${PUBLIC_NPM_REGISTRY:?}" = https://registry.npmjs.org/
test -f "${V1_REGISTRY_TARBALL:?}"
test -n "${V1_EXPECTED_INTEGRITY:?}"

git switch "$V2_BRANCH"
test "$(git branch --show-current)" = "$V2_BRANCH"
git pull --ff-only origin "$V2_BRANCH"
test "$(node -p "require('./package.json').name")" = "$PACKAGE_NAME"
test "$(node -p "require('./package.json').version")" = "$V2_VERSION"
npm_public ci
verify_public_lockfile package-lock.json
npx_public --yes playwright install --with-deps chromium

LEGACY_PACKAGE_SPEC="$V1_REGISTRY_TARBALL" \
LEGACY_EXPECTED_INTEGRITY="$V1_EXPECTED_INTEGRITY" \
npm_public run test:compat

export V1_CORPUS_CANDIDATE="$RELEASE_WORKSPACE/legacy-v$V1_VERSION-golden.json"
LEGACY_PACKAGE_SPEC="$PACKAGE_NAME@$V1_VERSION" \
LEGACY_EXPECTED_INTEGRITY="$V1_EXPECTED_INTEGRITY" \
node scripts/test-peer-compatibility.mjs \
  "--legacy-version=$V1_VERSION" \
  "--print-legacy-golden=$V1_VERSION" >"$V1_CORPUS_CANDIDATE"
node -e "JSON.parse(require('node:fs').readFileSync(process.argv[1], 'utf8'))" "$V1_CORPUS_CANDIDATE"
test "$(node -e "process.stdout.write(JSON.parse(require('node:fs').readFileSync(process.argv[1], 'utf8')).generator.source.kind)" "$V1_CORPUS_CANDIDATE")" = npm-registry
test "$(node -e "process.stdout.write(JSON.parse(require('node:fs').readFileSync(process.argv[1], 'utf8')).generator.source.spec)" "$V1_CORPUS_CANDIDATE")" = "$PACKAGE_NAME@$V1_VERSION"
test "$(node -e "process.stdout.write(JSON.parse(require('node:fs').readFileSync(process.argv[1], 'utf8')).generator.source.integrity)" "$V1_CORPUS_CANDIDATE")" = "$V1_EXPECTED_INTEGRITY"
if ! cmp -s "$V1_CORPUS_CANDIDATE" "scripts/fixtures/legacy-v$V1_VERSION-golden.json"; then
  cp "$V1_CORPUS_CANDIDATE" "scripts/fixtures/legacy-v$V1_VERSION-golden.json"
fi
V1_CORPUS_SHA256=$(node -e "const fs=require('node:fs');const crypto=require('node:crypto');process.stdout.write(crypto.createHash('sha256').update(fs.readFileSync(process.argv[1])).digest('hex'))" "scripts/fixtures/legacy-v$V1_VERSION-golden.json")
printf 'Pin this v1 corpus SHA-256 in test/legacy-golden-corpus.test.js: %s\n' "$V1_CORPUS_SHA256"

V1_PREVIOUS_CM5_CORPUS_CANDIDATE="$RELEASE_WORKSPACE/legacy-v$V1_PREVIOUS_CM5_VERSION-golden.json"
LEGACY_PACKAGE_SPEC="$PACKAGE_NAME@$V1_PREVIOUS_CM5_VERSION" \
LEGACY_EXPECTED_INTEGRITY="$EXPECTED_V1_PREVIOUS_CM5_INTEGRITY" \
LEGACY_CANDIDATE_VERSION="$V1_PREVIOUS_CM5_VERSION" \
node scripts/test-peer-compatibility.mjs \
  "--legacy-version=$V1_PREVIOUS_CM5_VERSION" \
  "--print-legacy-golden=$V1_PREVIOUS_CM5_VERSION" \
  >"$V1_PREVIOUS_CM5_CORPUS_CANDIDATE"
node -e "JSON.parse(require('node:fs').readFileSync(process.argv[1], 'utf8'))" \
  "$V1_PREVIOUS_CM5_CORPUS_CANDIDATE"
cmp "$V1_PREVIOUS_CM5_CORPUS_CANDIDATE" \
  "scripts/fixtures/legacy-v$V1_PREVIOUS_CM5_VERSION-golden.json"
V1_PREVIOUS_CM5_CORPUS_SHA256=$(node -e "const fs=require('node:fs');const crypto=require('node:crypto');process.stdout.write(crypto.createHash('sha256').update(fs.readFileSync(process.argv[1])).digest('hex'))" "$V1_PREVIOUS_CM5_CORPUS_CANDIDATE")
printf 'Verified v1.1.7 corpus SHA-256: %s\n' \
  "$V1_PREVIOUS_CM5_CORPUS_SHA256"
node scripts/fixtures/legacy-interoperability.mjs --verify-registry-integrity-only
```

Review the corpus diff and verify the exact v1.1.7 and v1.1.8 registry SHA-256
and SRI pins in `test/legacy-golden-corpus.test.js`. Both entries in
`scripts/fixtures/release-artifacts.json` must now name `npm-registry`
provenance. The postpublication commit includes those registry-backed corpora
and artifact metadata with the migration material, release documentation, and
tests. Never commit a fixture that claims npm-registry provenance before its
registry artifact has been downloaded and byte-verified.

At the reviewed clean commit, remove every candidate override in the same
shell, assert that it is absent, and run both the default registry-backed
compatibility command and the complete gate. This prevents a prior environment
assignment from silently substituting a local tarball.

```sh
set -euo pipefail

test "${PUBLIC_NPM_REGISTRY:?}" = https://registry.npmjs.org/
test "$(git branch --show-current)" = "$V2_BRANCH"
test "$(node -p "require('./package.json').name")" = "$PACKAGE_NAME"
test "$(node -p "require('./package.json').version")" = "$V2_VERSION"
test -z "$(git status --porcelain)"

unset LEGACY_PACKAGE_SPEC
unset LEGACY_EXPECTED_INTEGRITY
unset LEGACY_CANDIDATE_VERSION
unset V2_PACKAGE_SPEC
unset V2_EXPECTED_INTEGRITY
test "${LEGACY_PACKAGE_SPEC+x}" != x
test "${LEGACY_EXPECTED_INTEGRITY+x}" != x
test "${LEGACY_CANDIDATE_VERSION+x}" != x
test "${V2_PACKAGE_SPEC+x}" != x
test "${V2_EXPECTED_INTEGRITY+x}" != x

npm_public run test:compat
npm_public run test:all
npm_public run test:coverage
npm_public audit --omit=dev
npm_public pack --dry-run --json >/dev/null
test -z "$(git status --porcelain)"

export RELEASE_COMMIT
RELEASE_COMMIT=$(git rev-parse HEAD)
git push origin "HEAD:refs/heads/$V2_BRANCH"
V2_REMOTE_COMMIT=$(git ls-remote origin "refs/heads/$V2_BRANCH" | cut -f1)
test -n "$V2_REMOTE_COMMIT"
test "$V2_REMOTE_COMMIT" = "$RELEASE_COMMIT"

RUN_ID=$(gh run list \
  --repo "$REPOSITORY" \
  --workflow ci.yml \
  --event push \
  --commit "$RELEASE_COMMIT" \
  --limit 1 \
  --json databaseId \
  --jq '.[0].databaseId // empty')
test -n "$RUN_ID"
gh run watch "$RUN_ID" --repo "$REPOSITORY" --exit-status
test "$(git rev-parse HEAD)" = "$RELEASE_COMMIT"
test "$(git ls-remote origin "refs/heads/$V2_BRANCH" | cut -f1)" = "$RELEASE_COMMIT"
test -z "$(git status --porcelain)"
```

As with v1, if GitHub has not indexed the push yet, repeat the exact commit
lookup rather than accepting another run.

### Phase 3: run prepublish gates and pack the exact v2 commit once

Repeat the local prepublish guard, full tests, coverage, audit, and package
review immediately before creating the retained artifact. Then exercise that
exact local `.tgz` through the clean-install compatibility matrix by setting
`V2_PACKAGE_SPEC` to its absolute path and pinning `V2_EXPECTED_INTEGRITY`.

```sh
set -euo pipefail

test "${PUBLIC_NPM_REGISTRY:?}" = https://registry.npmjs.org/
test "$(git branch --show-current)" = "$V2_BRANCH"
test "$(node -p "require('./package.json').name")" = "$PACKAGE_NAME"
test "$(node -p "require('./package.json').version")" = "$V2_VERSION"
test "$(git rev-parse HEAD)" = "${RELEASE_COMMIT:?}"
test "$(git ls-remote origin "refs/heads/$V2_BRANCH" | cut -f1)" = "$RELEASE_COMMIT"
test -z "$(git status --porcelain)"

unset LEGACY_PACKAGE_SPEC
unset LEGACY_EXPECTED_INTEGRITY
unset LEGACY_CANDIDATE_VERSION
unset V2_PACKAGE_SPEC
unset V2_EXPECTED_INTEGRITY
test "${LEGACY_PACKAGE_SPEC+x}" != x
test "${LEGACY_EXPECTED_INTEGRITY+x}" != x
test "${LEGACY_CANDIDATE_VERSION+x}" != x
test "${V2_PACKAGE_SPEC+x}" != x
test "${V2_EXPECTED_INTEGRITY+x}" != x

npm_config_tag=cm6 node scripts/require-publish-tag.cjs
npm_public run test:all
npm_public run test:coverage
npm_public audit --omit=dev
npm_public pack --dry-run --json >/dev/null
test -z "$(git status --porcelain)"

export V2_PACK_JSON="$V2_ARTIFACT_DIR/pack.json"
npm pack \
  --json \
  --pack-destination "$V2_ARTIFACT_DIR" \
  --registry "$PUBLIC_NPM_REGISTRY" \
  "$CODEMIRROR_NPM_REGISTRY_FLAG" >"$V2_PACK_JSON"
test "$(node -e "process.stdout.write(JSON.parse(require('node:fs').readFileSync(process.argv[1], 'utf8'))[0].name)" "$V2_PACK_JSON")" = "$PACKAGE_NAME"
test "$(node -e "process.stdout.write(JSON.parse(require('node:fs').readFileSync(process.argv[1], 'utf8'))[0].version)" "$V2_PACK_JSON")" = "$V2_VERSION"
export V2_TARBALL
V2_TARBALL="$V2_ARTIFACT_DIR/$(node -e "process.stdout.write(JSON.parse(require('node:fs').readFileSync(process.argv[1], 'utf8'))[0].filename)" "$V2_PACK_JSON")"
export V2_EXPECTED_INTEGRITY
V2_EXPECTED_INTEGRITY=$(node -e "process.stdout.write(JSON.parse(require('node:fs').readFileSync(process.argv[1], 'utf8'))[0].integrity)" "$V2_PACK_JSON")
V2_HASHED_INTEGRITY=$(node -e "const fs=require('node:fs');const crypto=require('node:crypto');process.stdout.write('sha512-'+crypto.createHash('sha512').update(fs.readFileSync(process.argv[1])).digest('base64'))" "$V2_TARBALL")
test -f "$V2_TARBALL"
test -n "$V2_EXPECTED_INTEGRITY"
test "$V2_HASHED_INTEGRITY" = "$V2_EXPECTED_INTEGRITY"

V2_PACKAGE_SPEC="$V2_TARBALL" \
V2_EXPECTED_INTEGRITY="$V2_EXPECTED_INTEGRITY" \
npm_public run test:compat
test -z "$(git status --porcelain)"

if git show-ref --verify --quiet "refs/tags/v$V2_VERSION"; then
  test "$(git rev-parse "v$V2_VERSION^{commit}")" = "$RELEASE_COMMIT"
else
  git tag -a "v$V2_VERSION" -m "CodeMirror Record $V2_VERSION"
fi
test "$(git rev-parse HEAD)" = "$RELEASE_COMMIT"
test "$(git rev-parse "v$V2_VERSION^{commit}")" = "$RELEASE_COMMIT"
test "$(git ls-remote origin "refs/heads/$V2_BRANCH" | cut -f1)" = "$RELEASE_COMMIT"
printf 'v2 retained artifact: %s\nv2 SRI: %s\n' "$V2_TARBALL" "$V2_EXPECTED_INTEGRITY"
```

### Phase 4: publish v2 under `cm6`, verify it, then promote `latest`

Publish the retained `.tgz`, not the repository directory. The remote Git tag
is established first as immutable provenance. The registry copy is downloaded,
independently hashed, and compared byte-for-byte with the retained artifact.
The full clean-install matrix then runs in exact registry-artifact mode before
`latest` moves.

```sh
set -euo pipefail

test "${PUBLIC_NPM_REGISTRY:?}" = https://registry.npmjs.org/
test "${PACKAGE_NAME:?}" = codemirror-record
test "${V2_VERSION:?}" = 2.0.0
test -f "${V2_TARBALL:?}"
test -n "${V2_EXPECTED_INTEGRITY:?}"
test "$(git branch --show-current)" = "$V2_BRANCH"
test "$(node -p "require('./package.json').name")" = "$PACKAGE_NAME"
test "$(node -p "require('./package.json').version")" = "$V2_VERSION"
test "$(git rev-parse HEAD)" = "${RELEASE_COMMIT:?}"
test "$(git rev-parse "v$V2_VERSION^{commit}")" = "$RELEASE_COMMIT"
test "$(git ls-remote origin "refs/heads/$V2_BRANCH" | cut -f1)" = "$RELEASE_COMMIT"
test -z "$(git status --porcelain)"
test "$(node -e "const fs=require('node:fs');const crypto=require('node:crypto');process.stdout.write('sha512-'+crypto.createHash('sha512').update(fs.readFileSync(process.argv[1])).digest('base64'))" "$V2_TARBALL")" = "$V2_EXPECTED_INTEGRITY"

V2_REMOTE_TAG_COMMIT=$(git ls-remote origin "refs/tags/v$V2_VERSION^{}" | cut -f1)
if test -n "$V2_REMOTE_TAG_COMMIT"; then
  test "$V2_REMOTE_TAG_COMMIT" = "$RELEASE_COMMIT"
else
  git push origin "refs/tags/v$V2_VERSION:refs/tags/v$V2_VERSION"
fi
test "$(git ls-remote origin "refs/tags/v$V2_VERSION^{}" | cut -f1)" = "$RELEASE_COMMIT"

V2_VIEW_ERROR="$RELEASE_WORKSPACE/v2-view.stderr"
if V2_PUBLISHED_METADATA=$(npm_public view \
  "$PACKAGE_NAME@$V2_VERSION" name version dist.integrity --json \
  2>"$V2_VIEW_ERROR"); then
  test "$(printf '%s' "$V2_PUBLISHED_METADATA" | jq -r .name)" = "$PACKAGE_NAME"
  test "$(printf '%s' "$V2_PUBLISHED_METADATA" | jq -r .version)" = "$V2_VERSION"
  test "$(printf '%s' "$V2_PUBLISHED_METADATA" | jq -r '."dist.integrity"')" = "$V2_EXPECTED_INTEGRITY"
else
  grep -Fq E404 "$V2_VIEW_ERROR"
  npm_public publish "$V2_TARBALL" --tag cm6
fi
test "$(npm_public view "$PACKAGE_NAME@$V2_VERSION" version)" = "$V2_VERSION"
test "$(npm_public view "$PACKAGE_NAME@$V2_VERSION" dist.integrity)" = "$V2_EXPECTED_INTEGRITY"

CM6_VERSION=$(npm_public view "$PACKAGE_NAME" dist-tags.cm6)
case "$CM6_VERSION" in
  "$V2_VERSION") ;;
  "")
    npm_public dist-tag add "$PACKAGE_NAME@$V2_VERSION" cm6
    ;;
  *)
    printf 'Refusing to replace unexpected cm6 dist-tag %s\n' "$CM6_VERSION" >&2
    exit 1
    ;;
esac
test "$(npm_public view "$PACKAGE_NAME@cm6" version)" = "$V2_VERSION"

export V2_REGISTRY_DIR
V2_REGISTRY_DIR=$(mktemp -d "$RELEASE_WORKSPACE/v2-registry.XXXXXX")
V2_REGISTRY_PACK_JSON="$V2_REGISTRY_DIR/pack.json"
npm pack "$PACKAGE_NAME@$V2_VERSION" \
  --json \
  --pack-destination "$V2_REGISTRY_DIR" \
  --registry "$PUBLIC_NPM_REGISTRY" \
  "$CODEMIRROR_NPM_REGISTRY_FLAG" >"$V2_REGISTRY_PACK_JSON"
test "$(node -e "process.stdout.write(JSON.parse(require('node:fs').readFileSync(process.argv[1], 'utf8'))[0].name)" "$V2_REGISTRY_PACK_JSON")" = "$PACKAGE_NAME"
test "$(node -e "process.stdout.write(JSON.parse(require('node:fs').readFileSync(process.argv[1], 'utf8'))[0].version)" "$V2_REGISTRY_PACK_JSON")" = "$V2_VERSION"
test "$(node -e "process.stdout.write(JSON.parse(require('node:fs').readFileSync(process.argv[1], 'utf8'))[0].integrity)" "$V2_REGISTRY_PACK_JSON")" = "$V2_EXPECTED_INTEGRITY"
export V2_REGISTRY_TARBALL
V2_REGISTRY_TARBALL="$V2_REGISTRY_DIR/$(node -e "process.stdout.write(JSON.parse(require('node:fs').readFileSync(process.argv[1], 'utf8'))[0].filename)" "$V2_REGISTRY_PACK_JSON")"
test "$(node -e "const fs=require('node:fs');const crypto=require('node:crypto');process.stdout.write('sha512-'+crypto.createHash('sha512').update(fs.readFileSync(process.argv[1])).digest('base64'))" "$V2_REGISTRY_TARBALL")" = "$V2_EXPECTED_INTEGRITY"
cmp "$V2_TARBALL" "$V2_REGISTRY_TARBALL"

V2_PACKAGE_SPEC="$PACKAGE_NAME@$V2_VERSION" \
V2_EXPECTED_INTEGRITY="$V2_EXPECTED_INTEGRITY" \
npm_public run test:compat
test -z "$(git status --porcelain)"

test "$(git ls-remote origin "refs/tags/v$V2_VERSION^{}" | cut -f1)" = "$RELEASE_COMMIT"
test "$(npm_public view "$PACKAGE_NAME@cm5" version)" = "$V1_VERSION"
LATEST_VERSION=$(npm_public view "$PACKAGE_NAME@latest" version)
case "$LATEST_VERSION" in
  "$V2_VERSION") ;;
  "$V1_PREVIOUS_VERSION")
    npm_public dist-tag add "$PACKAGE_NAME@$V2_VERSION" latest
    ;;
  *)
    printf 'Refusing to replace unexpected latest dist-tag %s\n' "$LATEST_VERSION" >&2
    exit 1
    ;;
esac
test "$(npm_public view "$PACKAGE_NAME@cm6" version)" = "$V2_VERSION"
test "$(npm_public view "$PACKAGE_NAME@latest" version)" = "$V2_VERSION"
test "$(npm_public view "$PACKAGE_NAME@$V2_VERSION" dist.integrity)" = "$V2_EXPECTED_INTEGRITY"
```

Publishing with `--tag cm6` creates the permanent CM6 tag. Do not perform a
redundant second `cm6` registry write. Moving `latest` is a distinct protected
operation and may request fresh npm authorization.

Expected permanent install paths are `codemirror-record@^2` with
`@codemirror/state@^6` and `@codemirror/view@^6` for CM6, and
`codemirror-record@^1` with `codemirror@^5` for CM5.

### Phase 5: verify `main` and Pages byte-for-byte

Only the exact tagged and registry-verified commit may remain on `main`. The
local branch, remote branch, and peeled local tag must all equal
`RELEASE_COMMIT`; ancestry alone is insufficient.

```sh
set -euo pipefail

test "${PUBLIC_NPM_REGISTRY:?}" = https://registry.npmjs.org/
test "$(npm_public view "$PACKAGE_NAME@cm5" version)" = "$V1_VERSION"
test "$(npm_public view "$PACKAGE_NAME@cm6" version)" = "$V2_VERSION"
test "$(npm_public view "$PACKAGE_NAME@latest" version)" = "$V2_VERSION"
test "$(npm_public view "$PACKAGE_NAME@$V1_VERSION" dist.integrity)" = "$V1_EXPECTED_INTEGRITY"
test "$(git ls-remote origin refs/heads/v1 | cut -f1)" = "$V1_BRANCH_COMMIT"
test "$(git ls-remote origin "refs/tags/v$V1_VERSION^{}" | cut -f1)" = "$V1_RELEASE_COMMIT"
verify_stable_github_release "v$V1_VERSION"

test "${V2_BRANCH:?}" = main
git fetch origin "$V2_BRANCH"
git switch "$V2_BRANCH"
git pull --ff-only origin "$V2_BRANCH"
test "$(git rev-parse HEAD)" = "$RELEASE_COMMIT"
export MAIN_COMMIT
MAIN_COMMIT=$(git ls-remote origin refs/heads/main | cut -f1)
test "$MAIN_COMMIT" = "$RELEASE_COMMIT"
test "$(git rev-parse HEAD)" = "$RELEASE_COMMIT"
test "$(git rev-parse "v$V2_VERSION^{commit}")" = "$RELEASE_COMMIT"
test "$(git ls-remote origin "refs/heads/$V2_BRANCH" | cut -f1)" = "$RELEASE_COMMIT"
test -z "$(git status --porcelain)"
```

The repository default branch must be `main`, and Pages must publish from
`main:/`. These are assertions, not assumptions. Wait for the Pages build
whose source commit is exactly `MAIN_COMMIT`; then compare each public route
with the corresponding raw GitHub file at that immutable commit. A successful
HTTP response with stale or transformed bytes fails the release.

```sh
set -euo pipefail

test "${MAIN_COMMIT:?}" = "${RELEASE_COMMIT:?}"
test "$(gh repo view "$REPOSITORY" --json defaultBranchRef --jq .defaultBranchRef.name)" = main
PAGES_CONFIGURATION=$(gh api "repos/$REPOSITORY/pages")
test "$(printf '%s' "$PAGES_CONFIGURATION" | jq -r .source.branch)" = main
test "$(printf '%s' "$PAGES_CONFIGURATION" | jq -r .source.path)" = /
PAGES_COMMIT=$(gh api "repos/$REPOSITORY/pages/builds/latest" --jq .commit)
PAGES_STATUS=$(gh api "repos/$REPOSITORY/pages/builds/latest" --jq .status)
test "$PAGES_COMMIT" = "$MAIN_COMMIT"
test "$PAGES_STATUS" = built

PAGES_CHECK_DIR=$(mktemp -d "$RELEASE_WORKSPACE/pages.XXXXXX")
RAW_ORIGIN="https://raw.githubusercontent.com/$REPOSITORY/$MAIN_COMMIT"
SITE_ORIGIN=https://codemirror-record.haoranyu.com

PAGES_ASSET_COUNT=0
while IFS= read -r ASSET; do
  case "$ASSET" in
    *.html|*.json|*.js|*.css) ;;
    *) continue ;;
  esac
  mkdir -p \
    "$PAGES_CHECK_DIR/raw/$(dirname "$ASSET")" \
    "$PAGES_CHECK_DIR/public/$(dirname "$ASSET")"
  curl --fail-with-body --location --retry 3 --retry-all-errors \
    "$RAW_ORIGIN/$ASSET" --output "$PAGES_CHECK_DIR/raw/$ASSET"
  curl --fail-with-body --location --retry 3 --retry-all-errors \
    "$SITE_ORIGIN/$ASSET" --output "$PAGES_CHECK_DIR/public/$ASSET"
  cmp "$PAGES_CHECK_DIR/raw/$ASSET" "$PAGES_CHECK_DIR/public/$ASSET"
  PAGES_ASSET_COUNT=$((PAGES_ASSET_COUNT + 1))
done < <(git ls-tree -r --name-only "$MAIN_COMMIT")
test "$PAGES_ASSET_COUNT" -gt 0

grep -Fq 'CodeMirror 6 · stable v2' "$PAGES_CHECK_DIR/public/index.html"
grep -Fq 'class="nav-home" href="../">Home</a>' "$PAGES_CHECK_DIR/public/demo/index.html"
grep -Fq 'Migration runbook / schema 1' "$PAGES_CHECK_DIR/public/migration/index.html"

SITE_ORIGIN="$SITE_ORIGIN" node --input-type=module <<'NODE'
import assert from 'node:assert/strict';
import {chromium} from 'playwright';

const browser = await chromium.launch({headless: true});
const errors = [];
try {
  for (const route of ['/', '/migration/', '/demo/']) {
    const page = await browser.newPage();
    page.on('pageerror', (error) => errors.push(`${route}: ${error.message}`));
    const response = await page.goto(`${process.env.SITE_ORIGIN}${route}`, {
      waitUntil: 'networkidle',
    });
    assert.ok(response?.ok(), `${route} returned ${response?.status()}`);
    if (route === '/demo/') {
      assert.equal(await page.locator('.cm-editor').count(), 2);
      assert.equal(
          await page.locator('a.nav-home').evaluate((link) => link.href),
          `${process.env.SITE_ORIGIN}/`,
      );
      await page.locator('#sample-edit').click();
      assert.equal(await page.locator('#capture-records').isEnabled(), true);
    }
    await page.close();
  }
} finally {
  await browser.close();
}
assert.deepEqual(errors, []);
NODE
```

If Pages reports `building`, a previous commit, or different bytes, wait for
the exact deployment and repeat the complete Pages phase. Do not proceed on a
marker-only check.

### Phase 6: create the final GitHub release and protect permanent branches

The following phase creates minimal protection when needed, applies it to
administrators, and forbids force-pushes and deletion on both permanent
branches. If a rule already exists, it is never overwritten: its required
safety fields must already be enabled. Required reviews and status-check
contexts can be added separately after their exact repository policy and
context names are agreed.

```sh
set -euo pipefail

test "${MAIN_COMMIT:?}" = "${RELEASE_COMMIT:?}"
test "$(git branch --show-current)" = main
test "$(git rev-parse HEAD)" = "$RELEASE_COMMIT"
test "$(git ls-remote origin refs/heads/main | cut -f1)" = "$RELEASE_COMMIT"
test "$(git ls-remote origin "refs/tags/v$V2_VERSION^{}" | cut -f1)" = "$RELEASE_COMMIT"
test "$(git ls-remote origin refs/heads/v1 | cut -f1)" = "$V1_BRANCH_COMMIT"
test "$(git ls-remote origin "refs/tags/v$V1_VERSION^{}" | cut -f1)" = "$V1_RELEASE_COMMIT"
test "$(gh repo view "$REPOSITORY" --json defaultBranchRef --jq .defaultBranchRef.name)" = main
test "$(gh api "repos/$REPOSITORY/pages" --jq .source.branch)" = main
test "$(gh api "repos/$REPOSITORY/pages" --jq .source.path)" = /
test "$(npm_public view "$PACKAGE_NAME@cm5" version)" = "$V1_VERSION"
test "$(npm_public view "$PACKAGE_NAME@cm6" version)" = "$V2_VERSION"
test "$(npm_public view "$PACKAGE_NAME@latest" version)" = "$V2_VERSION"
test "$(npm_public view "$PACKAGE_NAME@$V1_VERSION" dist.integrity)" = "$V1_EXPECTED_INTEGRITY"
test "$(npm_public view "$PACKAGE_NAME@$V2_VERSION" dist.integrity)" = "$V2_EXPECTED_INTEGRITY"
verify_stable_github_release "v$V1_VERSION"

if gh release view "v$V2_VERSION" --repo "$REPOSITORY" >/dev/null 2>&1; then
  verify_stable_github_release "v$V2_VERSION"
else
  gh release create "v$V2_VERSION" \
    --repo "$REPOSITORY" \
    --verify-tag \
    --latest \
    --generate-notes
fi
verify_stable_github_release "v$V2_VERSION"
test "$(gh api "repos/$REPOSITORY/releases/latest" --jq .tag_name)" = "v$V2_VERSION"

for BRANCH in main v1; do
  ENCODED_BRANCH=$(node -e "process.stdout.write(encodeURIComponent(process.argv[1]))" "$BRANCH")
  PROTECTION_ERROR="$RELEASE_WORKSPACE/protection-${ENCODED_BRANCH}.stderr"
  if EXISTING_PROTECTION=$(gh api "repos/$REPOSITORY/branches/$ENCODED_BRANCH/protection" 2>"$PROTECTION_ERROR"); then
    test "$(printf '%s' "$EXISTING_PROTECTION" | jq -r .enforce_admins.enabled)" = true
    test "$(printf '%s' "$EXISTING_PROTECTION" | jq -r .allow_force_pushes.enabled)" = false
    test "$(printf '%s' "$EXISTING_PROTECTION" | jq -r .allow_deletions.enabled)" = false
    continue
  fi
  grep -Fq 'Branch not protected' "$PROTECTION_ERROR"
  gh api \
    --method PUT \
    -H 'Accept: application/vnd.github+json' \
    -H 'X-GitHub-Api-Version: 2022-11-28' \
    "repos/$REPOSITORY/branches/$ENCODED_BRANCH/protection" \
    --input - >/dev/null <<'JSON'
{
  "required_status_checks": null,
  "enforce_admins": true,
  "required_pull_request_reviews": null,
  "restrictions": null,
  "allow_force_pushes": false,
  "allow_deletions": false
}
JSON
done

for BRANCH in main v1; do
  ENCODED_BRANCH=$(node -e "process.stdout.write(encodeURIComponent(process.argv[1]))" "$BRANCH")
  PROTECTION=$(gh api "repos/$REPOSITORY/branches/$ENCODED_BRANCH/protection")
  test "$(printf '%s' "$PROTECTION" | jq -r .enforce_admins.enabled)" = true
  test "$(printf '%s' "$PROTECTION" | jq -r .allow_force_pushes.enabled)" = false
  test "$(printf '%s' "$PROTECTION" | jq -r .allow_deletions.enabled)" = false
done

test "$(git ls-remote origin refs/heads/main | cut -f1)" = "$RELEASE_COMMIT"
test "$(git ls-remote origin "refs/tags/v$V2_VERSION^{}" | cut -f1)" = "$RELEASE_COMMIT"
test "$(git ls-remote origin refs/heads/v1 | cut -f1)" = "$V1_BRANCH_COMMIT"
test "$(git ls-remote origin "refs/tags/v$V1_VERSION^{}" | cut -f1)" = "$V1_RELEASE_COMMIT"
test "$(npm_public view "$PACKAGE_NAME@$V1_VERSION" dist.integrity)" = "$V1_EXPECTED_INTEGRITY"
verify_stable_github_release "v$V1_VERSION"
verify_stable_github_release "v$V2_VERSION"
test "$(gh api "repos/$REPOSITORY/releases/latest" --jq .tag_name)" = "v$V2_VERSION"

test "$(git ls-remote origin refs/heads/main | cut -f1)" = "$RELEASE_COMMIT"
test "$(git ls-remote origin refs/heads/v1 | cut -f1)" = "$V1_BRANCH_COMMIT"
test "$(git ls-remote origin "refs/tags/v$V1_VERSION^{}" | cut -f1)" = "$V1_RELEASE_COMMIT"
test "$(git ls-remote origin "refs/tags/v$V2_VERSION^{}" | cut -f1)" = "$RELEASE_COMMIT"
test "$(npm_public view "$PACKAGE_NAME@$V1_VERSION" dist.integrity)" = "$V1_EXPECTED_INTEGRITY"
verify_stable_github_release "v$V1_VERSION"
verify_stable_github_release "v$V2_VERSION"
test "$(gh api "repos/$REPOSITORY/releases/latest" --jq .tag_name)" = "v$V2_VERSION"
REMOTE_BRANCHES=$(git ls-remote --heads origin | sed 's#.*refs/heads/##' | LC_ALL=C sort)
test "$REMOTE_BRANCHES" = "$(printf 'main\nv1')"
LOCAL_BRANCHES=$(git for-each-ref --format='%(refname:short)' refs/heads | LC_ALL=C sort)
test "$LOCAL_BRANCHES" = "$(printf 'main\nv1')"
```

After launch, `main` and `v1` are the only permanent local and remote branch
names. Release tags preserve the immutable package history.

## Compatibility release gate

Stable v2 preserves the v1.1.6 public recorder/player surface where it is
meaningful for an `EditorView`, and both maintained majors preserve the v1
recording contract in both directions.

The executable gate:

1. Hashes and tests the exact v2 release tarball, including CommonJS, ESM, and
   browser artifacts.
2. Installs the declared minimum CM6 core packages, their current releases,
   and the `codemirror@6` umbrella package, while rejecting duplicate CM6 core
   installations.
3. Proves that v2 accepts real writer payloads from every public CM5-era
   release, v0.3.1-v1.1.8. In the reverse direction it proves the complete v2
   wire contract against every package-major-v1 reader, v1.0.0-v1.1.8. The
   v0.x reverse rows are explicitly best-effort and capability-gated: they use
   only the player APIs and wire features that release actually supported
   (`listen`/`addOperation` or `addOperations`/`play`; no pre-v0.6 extras, and
   no uncompressed directed selections in v0.3.1-v0.3.2).
4. Regenerates one canonical corpus with every historical recorder, compares
   the resulting wire objects with the common v1.1.6 + CM5 5.65.21 baseline,
   and locks exact v1.1.5, v1.1.7, and maintained v1.1.8 corpus bytes by
   SHA-256 and SRI. Before publication, v1.1.8 provenance names the retained
   tarball; after the exact registry download it is regenerated once with
   npm-registry provenance.
5. Compares document text, ordered directed selections, primary selection,
   duration, expanded operation timestamps, external activity calls, and
   forward/backward seeking at logical operation boundaries.

The matrix covers input, deletion, composition, cursor and selection
compression; equal-time operations; multiline, variable-width, Unicode, and
multi-cursor edits; mixed-origin transactions; paste, drop, cut, set-value and
legacy origins; JSON-serializable external activities; pause/resume, seek zero,
and terminal player state. It also exercises mixed CommonJS/ESM CodeMirror
entry points. Playback suppression uses the host transaction's native
`Transaction.userEvent` value so duplicated conditional-export module
identities cannot re-record playback.

This distinction is part of the release claim: package-major v1 is the stable
CM5 interoperability boundary. Historical v0.x writers remain forward-readable
by v2, while v2-to-v0.x playback is compatibility-tested only within each old
reader's actual capabilities. The release does not claim that missing v0.x
features can be retrofitted into immutable readers.

Public-surface compatibility means the same methods, options, and event names;
it does not preserve immutable v1 runtime bugs. Both v1.1.8 and v2.0.0 make
terminal state `PAUSE` (and emit `pause`) before `end`, repair zero/backward
seeking, and prevent paste capture from mutating a non-cursor predecessor. They
retain the original playback state across replacement seeks and emit exactly
one `end` when active playback seeks to the duration. Equal-time compressed
groups with scalar timestamps expand every logical operation at that timestamp.

There are two separately classified immutable timing-reader defects across
every published old player from v0.3.1 through v1.1.7:

- An ungrouped record can contain `t: [start, end]` without `l`. The old reader
  keeps that array as one operation time/duration instead of using `end`.
- A compressed record can contain scalar `t` with `l > 1`, as equal-millisecond
  old recorder output did. The old extractors index that scalar as `t[0]` and
  `t[1]`, producing invalid or undefined operation times, duration, and seek.

The v2 reader accepts both unchanged payload shapes and normalizes their
logical times. The maintained v1.1.8 reader does the same. Its writer emits a
scalar end time for ungrouped intervals and `[t, t]` for equal-time compressed
groups, so new v1.1.8 and v2 recordings play in either maintained player. The
gate proves the real legacy producer paths and records each immutable reader's
faulty timing result as a narrow exception; it does not reproduce either
corruption in v2.

Compatibility cannot infer intent that an old lossy encoder did not store. An
already duplicated ambiguous operation is replayed as encoded; v1.1.8 fixes
future production rather than teaching v2 to guess at historical data.

## Compression decision

The v2 recorder remains transaction-native at the CM6 boundary and retains the
isolated v1 compressor at serialization. The deterministic public-interface
benchmark records and replays both compressed and uncompressed v1-compatible
payloads and enforces a size regression ceiling.

```sh
set -euo pipefail
PUBLIC_NPM_REGISTRY=https://registry.npmjs.org/
CODEMIRROR_NPM_REGISTRY_FLAG="--@codemirror:registry=$PUBLIC_NPM_REGISTRY"
npm run benchmark:compression \
  --registry "$PUBLIC_NPM_REGISTRY" \
  "$CODEMIRROR_NPM_REGISTRY_FLAG"
```

The method, fixed scenarios, exact result, and decision are documented in
[COMPRESSION.md](./COMPRESSION.md).

## Browser and site gate

`npm run test:browser` builds the production ESM artifact and a dedicated
fixture, starts an ephemeral loopback server, and drives the pinned Playwright
Chromium in headless mode. The fixture imports that freshly built artifact,
creates the two editors, and exposes their public recording/playback state; it
does not dispatch editing transactions on the test's behalf. The smoke test
uses Chromium's trusted keyboard, clipboard, native drag/drop, and CDP IME
paths, captures through `getRecords()`, loads through `addOperations()`, calls
`play()`, and requires exact document and ordered directed multi-selection
equality at the end.

```sh
set -euo pipefail
PUBLIC_NPM_REGISTRY=https://registry.npmjs.org/
CODEMIRROR_NPM_REGISTRY_FLAG="--@codemirror:registry=$PUBLIC_NPM_REGISTRY"
npx \
  --registry "$PUBLIC_NPM_REGISTRY" \
  "$CODEMIRROR_NPM_REGISTRY_FLAG" \
  playwright install --with-deps chromium
npm run test:browser \
  --registry "$PUBLIC_NPM_REGISTRY" \
  "$CODEMIRROR_NPM_REGISTRY_FLAG"
```

The automated browser gate covers:

- typed input delivered by real keyboard events;
- a backward selection and two selections created and extended by keyboard;
- trusted paste, cut, and external native drag/drop events;
- trusted IME composition start/update and CM6 `input.type.compose` records;
- every corresponding legacy wire origin and a multi-change input record;
- capture, load, play, terminal `PAUSE`, and exact replay.

Before promotion, also serve the built repository and manually verify the
broader site controls and presentation:

- no console errors or missing local assets;
- homepage, demo, and migration page at desktop and 320 CSS pixels;
- pause, replay, seek, speed, reset, and clipboard-copy demo controls;
- the demo header's Home and Migration links;
- every advertised npm command and branch link.

The canonical agent-readable migration source is
[MIGRATING.md](./MIGRATING.md); `/migration/` is its public rendered companion.

## Later maintenance releases

There is no abbreviated maintenance-release recipe. Every patch release repeats
the same fail-fast guarantees with a fresh `RELEASE_WORKSPACE`, retained
tarball, independent SHA-512, exact CI commit, registry download, clean-install
matrix, peeled Git tag, and exact dist-tag assertions. The six launch phases
above are deliberately pinned to v1.1.8, v2.0.0, and their current branch
commits; do not reuse them by changing only a version variable. Prepare and
review a version-specific runbook before each later release.

For a CM5 maintenance release:

- prepare and review the versioned candidate on `v1`;
- pin the new version, branch commit, tag commit, and artifact integrity in the
  version-specific runbook, and keep `--tag cm5`;
- repeat the exact registry smoke and corpus-provenance guarantees from this
  launch;
- extend the exact-version matrix and pinned corpus when the release changes
  recording or reading behavior;
- create a non-latest `v1.*` GitHub Release;
- assert that `cm5` moved to the new version while `cm6` and `latest` remain on
  the verified v2 release; and
- assert the existing `v1` protection rather than replacing it.

For a CM6 maintenance release:

- prepare a uniquely named, short-lived release branch from protected `main`;
- make the version-specific runbook pin that branch, its exact reviewed commit,
  the new version, and both retained-artifact and registry integrities;
- repeat the local retained-tarball and registry-exact compatibility guarantees
  against the current exact `cm5` release;
- move `cm6`, verify it, then move `latest` to the same immutable artifact;
- fast-forward protected `main` to the exact tagged commit and repeat every
  Pages byte comparison;
- assert the existing permanent branch protections; and
- delete the short-lived remote and local release branch only after all registry,
  GitHub Release, `main`, Pages, and protection checks pass.

Never unpublish a bad immutable release. Move every affected dist-tag back to
the last known-good immutable version (`latest` and `cm6` for v2, or `cm5` for
v1), verify those exact values against the public registry, publish a fixed
patch through the complete workflow, and document the incident.

## Applications that host both editors

Most applications should install one major. An application that deliberately
embeds CM5 and CM6 can use npm aliases:

```sh
set -euo pipefail
PUBLIC_NPM_REGISTRY=https://registry.npmjs.org/
CODEMIRROR_NPM_REGISTRY_FLAG="--@codemirror:registry=$PUBLIC_NPM_REGISTRY"
npm install \
  cm-record-v1@npm:codemirror-record@^1 \
  cm-record-v2@npm:codemirror-record@^2 \
  codemirror@^5 \
  @codemirror/state@^6 \
  @codemirror/view@^6 \
  --registry "$PUBLIC_NPM_REGISTRY" \
  "$CODEMIRROR_NPM_REGISTRY_FLAG"
```

```js
import {CodeRecord as CodeRecord5} from 'cm-record-v1';
import {CodeRecord as CodeRecord6} from 'cm-record-v2';
```

Keep the adapters explicit. Do not add runtime editor-generation detection to
either package line.
