"use strict";

var url = require("url"),
    util = require("util");

var lockingCache = require("locking-cache"),
    tilelive = require("tilelive");

// defined outside enableCaching so that a single, shared cache will be used
// (this requires that keys be namespaced appropriately)
var lockedGetTile = lockingCache({
  max: 10 * 1024 * 1024, // TODO 10MB, should be configurable
  length: function(val) {
    return (val[1] || "").length;
  },
  maxAge: 6 * 3600e3 // 6 hours
});

var enableCaching = function(uri, source) {
  uri = url.parse(uri);

  var rawGetTile = source.getTile;

  source.getTile = lockedGetTile(function(z, x, y, lock) {
    var key = util.format("%s/%d/%d/%d", url.format(uri), z, x, y);

    return lock(key, function(unlock) {
      // .call is used so that getTile is correctly bound
      return rawGetTile.call(source, z, x, y, unlock);
    });
  }).bind(source);

  return source;
};

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
        source = enableCaching(uri, source);
      }

      return unlock(err, source);
    });
  });
});

module.exports = cache;
