# simple-blob-check

Warn when large image or binary files are added in a pull request.

## Usage

```yaml
name: Simple Blob Check
on:
  pull_request:

permissions:
  contents: read
  pull-requests: write

jobs:
  simple-blob-check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: dmytropaduchak/simple-blob-check@v0.1.0
        with:
          github-token: ${{ secrets.GITHUB_TOKEN }}
```

## Inputs

| Input | Default | Description |
| --- | --- | --- |
| `github-token` | `${{ github.token }}` | Token for PR API + sticky comment |
| `fail-on` | `none` | `none` / `medium` / `high` |

## Develop

```bash
npm install && npm run build
```
