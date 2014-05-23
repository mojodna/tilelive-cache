"use strict";

var url = require("url"),
    util = require("util");

var lockingCache = require("locking-cache");

var enableCaching = function(uri, source, locker) {
  if (source._cached) {
    // already cached

    return source;
  }

  if (typeof(uri) === "string") {
    uri = url.parse(uri, true);
  }

  var makeKey = function(name, context) {
    // collect properties attached to the callback
    var properties = {};

    Object.keys(context.callback).forEach(function(k) {
      properties[k] = context.callback[k];
    });

    var key = util.format("%s:%j@%j", name, uri, properties);

    // glue on any additional arguments using their JSON representation
    key += Array.prototype.slice.call(arguments, 2).map(JSON.stringify).join(",");

    return key;
  };

  var _getTile = source.getTile;

  source.getTile = locker(function(z, x, y, lock) {
    return lock(makeKey("getTile", this, z, x, y), function(unlock) {
      // .call is used so that getTile is correctly bound
      return _getTile.call(source, z, x, y, unlock);
    });
  }).bind(source);

  var _getGrid = source.getGrid;

  source.getGrid = locker(function(z, x, y, lock) {
    return lock(makeKey("getGrid", this, z, x, y), function(unlock) {
      // .call is used so that getGrid is correctly bound
      return _getGrid.call(source, z, x, y, unlock);
    });
  }).bind(source);

  var _getInfo = source.getInfo;

  source.getInfo = locker(function(lock) {
    return lock(makeKey("getInfo", this), function(unlock) {
      // .call is used so that getInfo is correctly bound
      return _getInfo.call(source, unlock);
    });
  }).bind(source);

  // TODO watch for collisions
  // http://raganwald.com/2014/04/10/mixins-forwarding-delegation.html may have
  // some ideas on how to prevent this
  source._cached = true;

  return source;
};

module.exports = function(tilelive, options) {
  options = options || {};

  // defined outside enableCaching so that a single, shared cache will be used
  // (this requires that keys be namespaced appropriately)
  var locker = lockingCache({
    max: 1024 * 1024 * (options.size || 10), // convert to MB
    length: function(val) {
      return val[0] ? val[0].length : 1;
    },
    maxAge: 6 * 3600e3 // 6 hours
  });

  var cache = Object.create(tilelive);

  var lockedLoad = lockingCache({
    max: options.sources || 6,
    dispose: function(key, values) {
      // the source will always be the first value since it's the first
      // argument to unlock()
      values[0].close(function() {});
    }
  });

  cache.load = lockedLoad(function(uri, lock) {
    var key = JSON.stringify(uri);

    return lock(key, function(unlock) {
      return tilelive.load(uri, function(err, source) {
        if (!err) {
          source = enableCaching(uri, source, locker);
        }

        return unlock(err, source);
      });
    });
  });

  return cache;
};
