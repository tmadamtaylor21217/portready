# portready

Zero-dependency CLI that waits until TCP ports accept connections — for CI
scripts and docker-compose flows that need a database or service to be up
before proceeding.

```sh
portready 5432 -t 30 && npm run migrate
portready 6379,5432 -q || echo "services did not come up" >&2; exit 1
```

## Install

No npm install needed if you keep the file around:

```sh
curl -fsSLO https://raw.githubusercontent.com/tmadamtaylor21217/portready/main/bin/portready.mjs
chmod +x portready.mjs
```

Or clone and link:

```sh
git clone https://github.com/tmadamtaylor21217/portready.git
cd portready && npm link
```

## Options

```
  -h, --host <host>     host to probe (default 127.0.0.1)
  -t, --timeout <sec>   give up after this many seconds (default 30; 0 = forever)
  -i, --interval <ms>   delay between probes (default 500; grows to 2s backoff)
  -q, --quiet           no progress output, exit code only
      --help            usage
```

Exit codes: `0` all ports ready · `1` timeout or bad usage.

## Why

A one-file alternative to pulling in a dependency tree for the most common
CI step there is: "wait for the database". Probes plain TCP connects, backs
off gently, and stays quiet unless you want progress on stderr.

## Test

```sh
npm test
```

MIT license.
