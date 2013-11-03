"use strict";

var url = require("url"),
    util = require("util");

var LRU = require("lru-cache"),
    tilelive = require("tilelive");

var sourceCache = LRU({
  max: 5, // TODO arbitrary
  dispose: function(key, source) {
    source.close();
  }
});

var tileCache = LRU({
  max: 10 * 1024 * 1024, // 10MB
  length: function(val) {
    return val.data.length;
  },
  maxAge: 6 * 3600e3 // 6 hours
});

// NOTE: don't set a maxAge, otherwise the list of waiting callbacks will get
// reset and they'll never be called.
var sourceLocks = LRU(),
    tileLocks = LRU();

var cacheify = function(uri, source) {
  uri = url.parse(uri);

  var rawGetTile = source.getTile;

  source.getTile = function(z, x, y, callback) {
    var key = util.format("%s/%d/%d/%d", url.format(uri), z, x, y);

    console.log(key);

    var locks;
    if ((locks = tileLocks.get(key))) {
      console.log("%s locked", key);
      locks.push(callback);
      tileLocks.set(key, locks);
      return;
    }

    var tile;
    if ((tile = tileCache.get(key))) {
      // cache hit!
      return setImmediate(callback, null, tile.data, tile.headers);
    }

    // lock
    tileLocks.set(key, [callback]);

    console.log("fetching %s", key);
    return rawGetTile.call(source, z, x, y, function(err, data, headers) {
      // get the list of callbacks to notify
      var waiting = tileLocks.get(key);

      if (waiting.length > 1) {
        console.log("%d waiting tile request(s).", waiting.length - 1);
      }

      // unlock
      tileLocks.del(key);

      if (!err) {
        tileCache.set(key, {
          data: data,
          headers: headers
        });
      }

      waiting.forEach(function(cb) {
        return setImmediate(cb, err, data, headers);
      });
    });
  };

  return source;
};

var cache = Object.create(tilelive);

cache.load = function(uri, callback) {
  var locks;
  if ((locks = sourceLocks.get(uri))) {
    // update the list of callbacks waiting for a source
    // this is preferable to repeatedly using setImmediate and retrying
    locks.push(callback);
    sourceLocks.set(uri, locks);
    return;
  }

  var source;
  if ((source = sourceCache.get(uri))) {
    // cache hit!
    return setImmediate(callback, null, sourceCache.get(uri));
  }

  // lock
  sourceLocks.set(uri, [callback]);

  console.log("loading %s", uri);
  return tilelive.load(uri, function(err, source) {
    // get the list of callbacks to notify
    var waiting = sourceLocks.get(uri);

    if (waiting.length > 1) {
      console.log("%d waiting request(s).", waiting.length - 1);
    }

    // unlock
    sourceLocks.del(uri);

    console.log("cacheifying %s", uri);
    source = cacheify(uri, source);

    if (!err) {
      sourceCache.set(uri, source);
    }

    waiting.forEach(function(cb) {
      return setImmediate(cb, err, source);
    });
  });
};

module.exports = cache;
