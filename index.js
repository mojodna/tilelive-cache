"use strict";

var LRU = require("lru-cache"),
    tilelive = require("tilelive");

var sourceCache = LRU({
  max: 5, // TODO arbitrary
  dispose: function(key, source) {
    source.close();
  }
});

var sourceLocks = LRU({
  maxAge: 5000 // effectively the load() timeout
});

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

    console.log("%d waiting request(s).", waiting.length);

    // unlock
    sourceLocks.del(uri);

    if (!err) {
      sourceCache.set(uri, source);
    }

    waiting.forEach(function(cb) {
      return setImmediate(cb, err, source);
    });
  });
};

module.exports = cache;
