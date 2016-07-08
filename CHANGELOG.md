# Changes

## v0.7.0 - 7/8/16

* Respect `max-age` in `Cache-Control` header.

## v0.6.5 - 3/15/16

* Prevent lock leakage when cache entries already exist.

## v0.6.4 - 3/11/16

* Pass upstream errors forward and skip the cache
* Rely on `TileStream`'s (`tilelive-streaming`) error handler to prevent non-
  fatal errors from bubbling up and terminating Node.

## v0.6.3 - 2/22/16

* Attach an error handler to prevent `getTile` failures from terminating Node.

## v0.6.2 - 2/17/16

* Flip `setImmediate` queuing of source closure so that sources are removed as
  early as possible.

## v0.6.1 - 2/16/16

* Upgrade to `tilelive-streaming@0.6.1` with improved handling of empty tiles.

## v0.6.0 - 2/16/16

* Remove `close()`d sources from the cache.
* Eliminate `closeDelay` as removal of closed sources addresses the same issue
  more cleanly.

## v0.5.2 - 2/16/16

* Fix cache handling for items w/o `.length` (@petrsloup)

## v0.5.1 - 7/22/15

* Update `tilelive-streaming` to v0.5.1

## v0.5.0 - 7/21/15

* `tilelive-streaming`-powered proactive metatile caching.

## v0.4.5 - 5/9/15

* Don't modify URLs; `?cache=true` was previously being appended. It will
  continue to be respected if provided.

## v0.4.4 - 4/1/15

* Reduce the size of the repeated URI sub-key to limit memory pressure.

## v0.4.3 - 3/31/15

* Hash cache keys to avoid excessive memory use (notable when `uri.xml` is
  present)

## v0.4.2 - 10/14/14

* Default `uri.query.cache` to `true`

## v0.4.1 - 8/6/14

* Fully normalize URIs so string and object forms match.
* Handle `options` better (especially when keys are present with `undefined`
  values).

## v0.4.0 - 8/1/14

* Add `options.closeDelay`

## v0.3.0 - 7/28/14

* Don't cache when source URIs contain `?cache=false`

## v0.2.2 - 7/28/14

* Allow cache size to be set to `0`
* Handle sources without `{getGrid,getTile,getInfo}` methods

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
