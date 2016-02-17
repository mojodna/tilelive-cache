# tilelive-cache

I am a caching wrapper for
[`tilelive.js`](https://github.com/mapbox/tilelive.js). I cache both sources
and data produced by their respective `getTile()` functions.

## Usage

```javascript
var tilelive = require("tilelive"),
    cache = require("tilelive-cache")(tilelive, {
      size: 10,      // 10MB cache (the default)
      sources: 6     // cache a maximum of 6 sources (the default); you may
                     // need to change this if you're using lots of
                     // composed sources
    });

// ...

// initializes or loads a tilelive-mapnik source
cache.load("mapnik://./stylesheet.xml", function(err, source) {
  // ...

  // generates or loads a tile from the cache
  return source.getTile(12, 1213, 1491, function(err, data, headers) {
    // ...
  });
});
```

To warm the cache, call `load()` without a callback:

```javascript
cache.load("mapnik://./stylesheet.xml");
```
