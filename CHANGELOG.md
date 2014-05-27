# Changes

## v0.2.1 - 5/27/14

* Depend on the correct version of `locking-cache`

## v0.2.0 - 5/22/14

* Include callback properties in cache keys
* Don't re-wrap sources that have already been cache-enabled

## v0.1.2 - 5/22/14

* Use `JSON.stringify()` everywhere.

## v0.1.1 - 5/22/14

* Upgrade `locking-cache` to 0.1.2
* Make the source cache size configurable via `options.sources` (and default it
  to 6).
* Fix `dispose()` implementation to match `locking-cache`'s behavior.
* Use `JSON.stringify()` to generate keys, as `url.format()` drops unrecognized
  / overloaded properties.

## v0.1.0 - 4/28/14

* Initial released version
