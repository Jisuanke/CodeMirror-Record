# Versioned GitHub Pages operations

CodeMirror Record publishes one GitHub Pages site assembled from two immutable
Git revisions. GitHub supports one Pages site per repository, so `main` owns
the deployment while the CodeMirror 5 pages are mounted below `/v1/`.

This document is the operational authority for Pages. The package release
procedure in [RELEASING.md](./RELEASING.md) verifies the same deployment but
does not define a second Pages source.

## Public route contract

| Route | Generation | Source |
| --- | --- | --- |
| `/` | CodeMirror 6 homepage | the deployed `main` revision |
| `/demo/` | CodeMirror 6 demo | the deployed `main` revision |
| `/migration/` | CM5-to-CM6 migration guide | the deployed `main` revision |
| `/v1/` | CodeMirror 5 homepage | the pinned `v1` revision |
| `/v1/demo/` | CodeMirror 5 demo | the pinned `v1` revision |

Every homepage and demo keeps its counterpart-generation link in a contextual
version notice inside the hero, outside the header. Demo headers link back to
the homepage for their generation.

## Source pin and generated provenance

`.github/pages-sources.json` is the reviewed source manifest. Its v1 commit
must be a full lowercase 40-character Git object ID and an ancestor of the
current remote `v1` branch. The branch name documents ownership; the commit,
not the moving branch tip, selects the deployed files.

The assembler writes `site-build.json` into the artifact with this stable
contract:

```json
{
  "schemaVersion": 1,
  "sources": {
    "main": {"commit": "<full main commit>"},
    "v1": {"branch": "v1", "commit": "<full v1 commit>"}
  },
  "routes": ["/", "/demo/", "/migration/", "/v1/", "/v1/demo/"]
}
```

The file has deterministic key and route ordering, ends with one newline, and
contains no build timestamp. It is both a human-readable audit record and the
machine-readable proof used by release verification.

### Updating the v1 site

1. Merge the homepage or demo change through a pull request targeting `v1`.
2. Read the exact new remote head with
   `git ls-remote origin refs/heads/v1`. Review that commit before copying it.
3. From current `main`, open a separate pull request that changes only the v1
   commit in `.github/pages-sources.json` plus any intentionally related main
   site changes.
4. Download and review the versioned Pages artifact produced by that pull
   request. Its name starts with `versioned-pages-review-`.
5. Merge only after the complete Node test matrix and Pages smoke test pass.

Never point the manifest at a tag name, short object ID, pull-request ref, or a
floating branch. Never move `v1` backward to change the published site; roll
the manifest pin backward through a reviewed `main` pull request instead.

## Build and deployment boundary

The `CI` workflow is the only production Pages publisher.

1. The existing Node 20, 22, and 24 test matrix completes first.
2. The Pages job checks out the exact workflow revision as the main source.
3. It reads the reviewed manifest, checks out that exact v1 object, fetches
   `refs/remotes/origin/v1`, and proves the pin is reachable from it.
4. With `pages: read`, the official Pages configuration action reads the
   repository's metadata without enabling or changing the publishing source.
5. Dependencies are installed and the browser bundle is built only in the
   main checkout. No package script or other executable from v1 is run.
6. The assembler copies a fixed allowlist of regular, single-linked static
   files into a fresh artifact, mounts v1 below `/v1/`, and adds `.nojekyll`
   and `site-build.json`.
7. An offline browser smoke test blocks external assets, loads all five routes,
   and exercises recording and playback in both real editor generations. The
   functional demos therefore cannot depend on a third-party CDN.
8. Pull requests receive a review artifact. A push or manual run on `main`
   receives the reserved `github-pages` artifact and can enter deployment.
9. The `deploy-pages` job uses only `contents: read`, `pages: write`, and
   `id-token: write`, the protected `github-pages` environment, and a
   non-cancelling deployment concurrency group. It reads the current `main`
   ref and skips deployment, without turning the superseded run red, if its
   artifact belongs to an older commit.

The exact Git pins, source allowlists, regular-file checks, and timestamp-free
provenance make identical source revisions produce identical site contents.
The v1 checkout has no credentials and is treated strictly as untrusted static
input. The custom domain remains a repository Pages setting; a `CNAME` file is
not copied from either source tree.

## One-time legacy-to-Actions cutover

Do this only when the workflow and source-manifest pull request is approved,
every pull-request check has passed, and it is ready to merge immediately.
GitHub requires Actions publishing to be enabled before `deploy-pages` runs;
switching only after merge would make the first `main` deployment fail and
would leave a red workflow on the protected branch.

The homepage intentionally presents v2 as the stable default, so the public
npm release is a hard prerequisite rather than a documentation follow-up. From
an authenticated release terminal, prove all three public-registry selectors
before changing Pages or merging the site pull request:

```sh
PUBLIC_NPM_REGISTRY=https://registry.npmjs.org/
test "$(npm view codemirror-record@2.0.0 version \
  --registry "$PUBLIC_NPM_REGISTRY")" = 2.0.0
test "$(npm view codemirror-record@cm6 version \
  --registry "$PUBLIC_NPM_REGISTRY")" = 2.0.0
test "$(npm view codemirror-record@latest version \
  --registry "$PUBLIC_NPM_REGISTRY")" = 2.0.0
```

If any assertion fails, leave the legacy Pages source and this pull request
unchanged. Complete the stable release gate in `RELEASING.md` first; do not
publish release-candidate wording or expose an install command that npm cannot
yet satisfy.

Immediately before the one-time source switch, prove that protected `main` has
not advanced beyond the exact registry-verified package commit and that the
immutable tag names the same object. This equality is a pre-cutover boundary,
not a permanent post-release invariant: the approved site PR intentionally
advances `main`, while `v2.0.0` remains on the package commit.

```sh
git fetch origin tag v2.0.0
PAGES_RELEASE_COMMIT=$(git rev-parse 'v2.0.0^{commit}')
test "$PAGES_RELEASE_COMMIT" = 68a8d680d27606d604aa4585ca7fc65d1fedb944
test "$(git ls-remote origin 'refs/tags/v2.0.0^{}' | cut -f1)" = \
  "$PAGES_RELEASE_COMMIT"
test "$(git ls-remote origin refs/heads/main | cut -f1)" = \
  "$PAGES_RELEASE_COMMIT"
```

1. Record the current Pages response, especially `cname`, HTTPS enforcement,
   and source, with `gh api repos/Jisuanke/CodeMirror-Record/pages`.
2. Confirm the `github-pages` environment permits deployments only from
   `main`. Inspect the approved review artifact and confirm every PR job passed.
3. Change the repository Pages build type from `legacy` to `workflow`. Do not
   edit or clear the custom-domain setting during this operation.
4. Immediately merge the approved pull request. Wait for its `main` push run's
   complete matrix, assembly, smoke-test, and deployment jobs to succeed.
5. Confirm the Pages API now reports `build_type` as `workflow`, the custom
   domain and HTTPS-enforcement value are unchanged, and `site-build.json`
   names the exact deployed main and pinned v1 commits.
6. Fetch all five public routes over the custom HTTPS origin. Follow the
   contextual version links in both directions and run the capture/load/play
   flow in both demos.

With GitHub CLI, record and verify the unchanged settings around step 3:

```sh
PAGES_BEFORE=$(gh api repos/Jisuanke/CodeMirror-Record/pages)
PAGES_CNAME_BEFORE=$(printf '%s' "$PAGES_BEFORE" | jq -r '.cname // ""')
PAGES_HTTPS_BEFORE=$(printf '%s' "$PAGES_BEFORE" | jq -r .https_enforced)

gh api --method PUT \
  repos/Jisuanke/CodeMirror-Record/pages \
  -f build_type=workflow

PAGES_AFTER=$(gh api repos/Jisuanke/CodeMirror-Record/pages)
test "$(printf '%s' "$PAGES_AFTER" | jq -r .build_type)" = workflow
test "$(printf '%s' "$PAGES_AFTER" | jq -r '.cname // ""')" = \
  "$PAGES_CNAME_BEFORE"
test "$(printf '%s' "$PAGES_AFTER" | jq -r .https_enforced)" = \
  "$PAGES_HTTPS_BEFORE"
```

This repository setting must not be changed from a pull-request workflow. It
is a one-time maintainer operation at the controlled merge boundary. If the
pull request cannot be merged immediately, restore the recorded legacy setting.
If the first deployment fails, diagnose or roll back the setting using the
recorded configuration rather than changing branch history.

## Routine deployment verification

For every production deployment:

- require a successful `deploy-pages` job from `CI` on the exact current
  `main` commit;
- download that run's `github-pages` artifact and inspect `site-build.json`;
- prove its main commit equals the workflow head and its v1 commit equals the
  reviewed manifest pin;
- compare the published HTML, CSS, JavaScript, and JSON byte-for-byte with the
  downloaded artifact; and
- exercise `/`, `/demo/`, `/migration/`, `/v1/`, and `/v1/demo/` over the
  custom domain.

A 200 response alone is insufficient: a previous successful deployment can
continue serving after a newer workflow failure.

## Rollback

Prefer a normal reviewed rollback on `main`:

- For a bad main page or assembler change, revert the responsible pull request
  on a short-lived branch and merge the revert after the complete CI gate.
- For a bad v1 page, change the manifest back to the last known-good full v1
  commit through a `main` pull request. Do not reset or force-push `v1`.
- For a transient GitHub deployment failure with unchanged inputs, re-run the
  failed `CI` workflow at the same `main` commit.

After deployment, repeat the provenance, byte, route, and real-demo checks.
Do not move release tags, force-push either permanent branch, manually upload a
directory, or deploy an artifact assembled outside `CI`.

Changing Pages back to the recorded legacy `main:/` source is an emergency
infrastructure rollback only. It restores the unassembled CM6 root but cannot
serve the versioned `/v1/` site. If the first deployment fails, restore it with
the exact recorded source while leaving `cname` and `https_enforced` omitted so
GitHub preserves them:

```sh
gh api --method PUT \
  repos/Jisuanke/CodeMirror-Record/pages \
  --input - <<'JSON'
{
  "build_type": "legacy",
  "source": {"branch": "main", "path": "/"}
}
JSON
```

Verify the custom-domain and HTTPS values against `PAGES_BEFORE`, record why
the rollback was necessary, and return to the Actions workflow through the
complete cutover checklist above.
