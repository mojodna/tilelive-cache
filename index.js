"use strict";

var crypto = require("crypto"),
    stream = require("stream"),
    url = require("url"),
    util = require("util");

var clone = require("clone"),
    enableStreaming = require("tilelive-streaming"),
    lockingCache = require("locking-cache");

var CacheCollector = function(locker, makeKey) {
  stream.Transform.call(this);

  var chunks = [],
      headers = {},
      tile;

  this.on("pipe", function(src) {
    tile = src;
  });

  this.setHeader = function(header, value) {
    headers[header] = value;
  };

  this._transform = function(chunk, encoding, callback) {
    chunks.push(chunk);

    return callback();
  };

  this._flush = function(callback) {
    // assemble the tile data
    var buf = Buffer.concat(chunks);

    var key = makeKey("getTile", tile.context, tile.z, tile.x, tile.y),
        waiting = locker.locks.get(key) || [],
        args = [null, buf, headers],
        data = args.slice(1);

    // populate the cache
    locker.cache.set(key, data);

    // unlock the target
    locker.locks.del(key);

    // notify any pending callbacks
    waiting.forEach(function(cb) {
      return setImmediate(function() {
        return cb.apply(null, args);
      });
    });

    // flush complete
    return callback();
  };
};

util.inherits(CacheCollector, stream.Transform);

var getContextCallbackProperties = function(context) {
  // collect properties attached to the callback
  var properties = {};

  Object.keys(context.callback).forEach(function(k) {
    properties[k] = context.callback[k];
  });

  return properties;
};

module.exports = function(tilelive, options) {
  tilelive = enableStreaming(tilelive);

  options = options || {};
  options.size = "size" in options && options.size !== undefined ? options.size : 10;
  options.sources = (options.sources | 0) || 6;

  // defined outside enableCaching so that a single, shared cache will be used
  // (this requires that keys be namespaced appropriately)
  var locker = lockingCache({
    max: 1024 * 1024 * options.size, // convert to MB
    length: function(val) {
      return (val[0] && val[0].length) ? val[0].length : 1;
    },
    maxAge: 6 * 3600e3 // 6 hours
  });

  var cache = Object.create(tilelive);

  var lockedLoad = lockingCache({
    max: options.sources,
    dispose: function(key, values) {
      // the source will always be the first value since it's the first
      // argument to unlock()
      setImmediate(function() {
        // queue it to avoid infinite recursion (since `close()` will remove it
        // from the cache)
        values[0].close();
      });
    }
  });

  var enableCaching = function(source, sourceKey) {
    // TODO use ES6 Symbols to prevent collisions
    if (source._cached) {
      // already cached

      return source;
    }

    var makeKey = function(name, properties) {
      properties = properties || {};

      var key = util.format("%s:%s@%j", name, sourceKey, properties);

      // glue on any additional arguments using their JSON representation
      key += Array.prototype.slice.call(arguments, 2).map(JSON.stringify).join(",");

      var sha1 = crypto.createHash("sha1");
      sha1.update(key);
      return sha1.digest("hex");
    };

    if (source.getTile) {
      var _getTile = source.getTile.bind(source);

      source.getTile = locker(function(z, x, y, lock) {
        var properties = getContextCallbackProperties(this);

        // lock neighboring tiles when metatiling (if the source is streamable)
        if (source.pipe && source.metatile && source.metatile > 1) {
          // TODO extract this (also used in tilelive-streaming)
          // get neighboring tiles within the same metatile
          var dx = x % source.metatile,
              dy = y % source.metatile,
              metaX = x - dx,
              metaY = y - dy;

          for (var ix = metaX; ix < metaX + source.metatile; ix++) {
            for (var iy = metaY; iy < metaY + source.metatile; iy++) {
              // ignore the current tile
              if (!(ix === x && iy === y)) {
                var key = makeKey("getTile", properties, z, ix, iy);

                if (!locker.locks.get(key)) {
                  // lock it with an empty list of callbacks (nothing to notify)
                  locker.locks.set(key, []);
                }
              }
            }
          }
        }

        return lock(makeKey("getTile", properties, z, x, y), function(unlock) {
          return _getTile(z, x, y, unlock);
        });
      }).bind(source);
    }

    if (source.getGrid) {
      var _getGrid = source.getGrid.bind(source);

      source.getGrid = locker(function(z, x, y, lock) {
        return lock(makeKey("getGrid", getContextCallbackProperties(this), z, x, y), function(unlock) {
          return _getGrid(z, x, y, unlock);
        });
      }).bind(source);
    }

    if (source.getInfo) {
      var _getInfo = source.getInfo.bind(source);

      source.getInfo = locker(function(lock) {
        return lock(makeKey("getInfo", getContextCallbackProperties(this)), function(unlock) {
          return _getInfo(unlock);
        });
      }).bind(source);
    }

    var _close = function(callback) {
      return callback();
    };

    if (source.close) {
      _close = source.close.bind(source);
    }

    source.close = function(callback) {
      callback = callback || function() {};

      // remove this from the source cache
      if (lockedLoad.cache.has(sourceKey)) {
        lockedLoad.cache.del(sourceKey);
      }

      return _close(callback);
    }

    var target = new stream.Writable({
      objectMode: true,
      highWaterMark: 16 // arbitrary backlog sizing
    });

    target._write = function(tile, _, callback) {
      tile.on("error", function(err) {
        console.warn("Error reading %d/%d/%d:", tile.z, tile.x, tile.y, err.stack);
      });

      tile.pipe(new CacheCollector(locker, makeKey).on("finish", callback));
    };

    source.pipe(target);

    source._cached = true;

    return source;
  };

  cache.load = lockedLoad(function(uri, lock) {
    if (typeof uri === "string") {
      uri = url.parse(uri, true);
    } else {
      uri = clone(uri);
    }

    uri.query = uri.query || {};
    var useCache = true;

    try {
      useCache = "cache" in uri.query ? JSON.parse(uri.query.cache) : useCache;
    } catch (err) {
      console.warn(err.stack);
    }

    var key = crypto.createHash("sha1").update(JSON.stringify(uri)).digest("hex");

    return lock(key, function(unlock) {
      return tilelive.load(uri, function(err, source) {
        if (!err &&
            options.size > 0 &&
            useCache) {
          source = enableCaching(source, key);
        }

        return unlock(err, source);
      });
    });
  });

  return cache;
};
