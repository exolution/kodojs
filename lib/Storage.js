/**
 * Created by godsong on 15-4-8.
 */
var Promise = require('./Promise');
var Fs = require('fs');
var Memcached = require('memcached');
var _memStorage;
try {
    var buffer = Fs.readFileSync('./.memstorage.json');
    _memStorage = JSON.parse(buffer.toString());
} catch(e) {
    _memStorage = {};
}

var Storage = module.exports = function Storage(type, location, config) {
    if(type == Storage.Memcache) {
        return new MemcachedStorage(location, config);
    }
    else if(type == Storage.Memory) {
        return MemoryStorage;
    }
};
Storage.Memcache = 1;
Storage.Memory = 2;


var MemoryStorage = {
    get  : function(key) {
        if(arguments.length > 1) {
            var data = {};
            for(var i = 0; i < arguments.length; i++) {
                var k = arguments[i];
                data[k] = _memStorage[k];
            }
            return data;
        }
        else {
            return _memStorage[key];
        }

    },
    set  : function(key, value) {
        _memStorage[key] = value;
    },
    del  : function(key) {
        _memStorage[key] = null;
    },
    save : function() {
        fs.writeFile('./memstorage.json', JSON.stringify(_memStorage));
    }
};
function MemcachedStorage(location, config) {
    this.client = new Memcached(location, config);
}
var _slice = Array.prototype.slice;
MemcachedStorage.__proto__ = Memcached.prototype;
MemcachedStorage.prototype.get = function(key) {
    var p = new Promise();
    if(arguments.length > 1) {
        this.client.getMulti(_slice.call(arguments), function(err, data) {
            if(err) {
                p.reject(err);
            }
            else {
                p.resolve(data)
            }
        });
    }
    else {
        this.client.get(key, function(err, data) {
            if(err) {
                p.reject(err);
            }
            else {
                p.resolve(data)
            }
        });
    }

    return p;
};
MemcachedStorage.prototype.set = function(key, value, lifetime) {
    var p = new Promise();
    this.client.set(key, value, lifetime || 2592000, function(err) {
        if(err) {
            p.reject(err);
        }
        else {
            p.resolve();
        }
    });

    return p;
};
MemcachedStorage.prototype.del = function(key) {
    var p = new Promise();
    this.client.del(key, function(err) {
        if(err) return p.reject(err);
        p.resolve();
    });
    return p;
};

