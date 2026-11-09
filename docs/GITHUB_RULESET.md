# GitHub branch protection setup

This configuration is hosted in GitHub and cannot be committed as a normal repository file.

1. Open repository **Settings → Rules → Rulesets → New ruleset → New branch ruleset**.
2. Target `main`; add `develop` as a separate target if desired.
3. Enable **Require a pull request before merging**.
4. Enable **Require status checks to pass** and select the `test-and-build` job after its first successful workflow run.
5. Block force pushes and deletion.
6. Save the ruleset.

Create a PR from the migration branch into `develop`; once CI passes and review is complete, merge it. After Part B and Part C, use a PR from `develop` into `main` for release.
