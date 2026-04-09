# Release Workflow

- For fixes that change published package behavior, generated app output, or runtime behavior used by consumers, treat the task as incomplete until the npm package state and GitHub repo state are aligned.
- Unless the user explicitly opts out, complete those fixes by:
  - bumping package versions as needed
  - validating the packaged artifact with a local smoke test when the change affects runtime or publishing
  - publishing the affected npm packages
  - committing and pushing the matching source changes to GitHub
- If `create-vorzelajs` is changed, make sure the generated app dependency points to an actually published `vorzelajs` version.
- If credentials, 2FA, permissions, or registry access block npm publish or GitHub push, stop at the blocker and report exactly what failed.
- Do not leave temporary tarballs or copied prepack artifacts checked into the repository.
- also push to github the commit that updates the version number in `package.json` and `CHANGELOG.md` (if applicable) to ensure that the repository state reflects the published package state.