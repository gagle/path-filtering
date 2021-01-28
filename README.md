# check-path-changes

GitHub Action that checks if paths have changed.

## Event types

This action automatically takes the base and head refs from the `pull_request` and `push` events. If you need to support any other event, then the `baseRef` and the `headRef` inputs need to be specified.

<br/>

- **baseRef**: _string_ | optional

  Base ref. Used when this action is used from a workflow for events different from `pull_request` and `push`.

- **headRef**: _string_ | optional

  Head ref. Used when this action is used from a workflow for events different from `pull_request` and `push`.

## Inputs

- **paths**: _string_

  YAML-formatted string where each entry is the **path_id** that contains a list of path patterns.

## Outputs

- **\<path_id\>**: _string_

  Whether or not the paths from the input with the same id have changed. Values: `'true'` or `'false'`.

<br/>

## Usage

For a `pull_request` or `push` events.

```yaml
jobs:
  pre-run:
    runs-on: ubuntu-latest

    steps:
      - uses: gagle/check-path-changes@v1.0.0
        id: check-path-changes
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        with:
          paths: |
            json:
              - dir1/**/*.json
              - dir2/**/*.json
            assets:
              - src/assets/**

    outputs:
      changed-json: ${{ steps.check-path-changes.outputs.json }}
      changed-assets: ${{ steps.check-path-changes.outputs.assets }}
```

<br/>
