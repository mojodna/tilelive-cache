"use strict";

var url = require("url"),
    util = require("util");

var lockingCache = require("locking-cache");

var enableCaching = function(uri, source, locker) {
  if (typeof(uri) === "string") {
    uri = url.parse(uri, true);
  }

  var _getTile = source.getTile;

  source.getTile = locker(function(z, x, y, lock) {
    var key = util.format("getTile:%s/%d/%d/%d", url.format(uri), z, x, y);

    return lock(key, function(unlock) {
      // .call is used so that getTile is correctly bound
      return _getTile.call(source, z, x, y, unlock);
    });
  }).bind(source);

  var _getGrid = source.getGrid;

  source.getGrid = locker(function(z, x, y, lock) {
    var key = util.format("getGrid:%s/%d/%d/%d", url.format(uri), z, x, y);

    return lock(key, function(unlock) {
      // .call is used so that getGrid is correctly bound
      return _getGrid.call(source, z, x, y, unlock);
    });
  }).bind(source);

  var _getInfo = source.getInfo;

  source.getInfo = locker(function(lock) {
    var key = util.format("getInfo:%s", url.format(uri));

    return lock(key, function(unlock) {
      // .call is used so that getInfo is correctly bound
      return _getInfo.call(source, unlock);
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
