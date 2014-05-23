# Changes

## v0.1.1 - 5/22/14

* Make the source cache size configurable via `options.sources` (and default it
  to 6).
* Fix `dispose()` implementation to match `locking-cache`'s behavior.
* Use `JSON.stringify()` to generate keys, as `url.format()` drops unrecognized
  / overloaded properties.

## v0.1.0 - 4/28/14

* Initial released version
