"use strict";

var url = require("url"),
    util = require("util");

var lockingCache = require("locking-cache");

var enableCaching = function(uri, source, locker) {
  uri = url.parse(uri);

  var rawGetTile = source.getTile;

  source.getTile = locker(function(z, x, y, lock) {
    var key = util.format("%s/%d/%d/%d", url.format(uri), z, x, y);

    return lock(key, function(unlock) {
      // .call is used so that getTile is correctly bound
      return rawGetTile.call(source, z, x, y, unlock);
    });
  }).bind(source);

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
    max: 5, // TODO arbitrary, should be configurable
    dispose: function(key, source) {
      source.close();
    }
  });

  cache.load = lockedLoad(function(uri, lock) {
    var key = url.format(uri);

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
