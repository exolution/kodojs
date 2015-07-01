/**
 * Created by godsong on 15-4-2.
 */
var Utils = require('./Utils');
function _mapping(token) {
    var map = {};
    var splits = token.split(',');
    for(var i = 0; i < splits.length; i++) {
        map[splits[i]] = true;
    }
    return map;

}

function _propertyLocate(src, path, create) {
    var splits = path.split('.'), cur = src;
    for(var i = 0; i < splits.length; i++) {
        var prop = splits[i];
        if(prop) {
            if(cur) {
                if(typeof cur == 'object' && !cur[prop] && create) {
                    cur[prop] = {};
                }
                cur = cur[prop];
            }
            else break;
        }
    }
    return cur;
}

var DataAdapter = module.exports = function DataAdapter(adapter, selector) {

    if(typeof adapter == 'string' && arguments.length == 1) {
        selector = adapter;
        adapter = null;
    }
    if(!selector) {
        selector = '*';
    }
    this.others = -1;
    var idx = selector.indexOf('//');
    if(idx != -1) {
        this.path = selector.substring(0, idx);
        selector = selector.slice(idx + 2);
    }
    if(selector == '*') {
        this.others = 1;
    }
    else if(selector == '^') {
        this.others = 0;
    }
    else if(selector.charAt(0) == '^') {
        this.reduce = _mapping(selector.slice(1));
    }
    else {
        this.map = _mapping(selector);
    }
    this.adapter = adapter;
    this.keys = {};
    for(var k in adapter) {
        if(adapter.hasOwnProperty(k)) {
            this.keys[k] = true;
        }
    }
}


DataAdapter.prototype = {
    apply : function(dest, src, deep) {
        var self = false, fn;
        if(!dest) {
            dest = src;
            self = true;
        }
        if(this.path) {
            src = _propertyLocate(src, this.path);
        }

        /*if(core.typeOf(src)!='array'){
         src=[src];
         }

         for(var i=0;i<src.length;i++){
         var srcObj=src[i];
         var keys=clone(this.keys);*/
        var srcObj = src;
        for(var key in srcObj) {

            if(srcObj.hasOwnProperty(key)) {
                if(this.adapter && (fn = this.adapter[key])) {

                    if(typeof fn == 'function') {
                        dest[key] = fn.call(dest, srcObj, key);
                    }
                    else if(typeof fn == 'string') {
                        if(fn == '*') {
                            dest[key] = srcObj;
                        }
                        else if(deep) {
                            dest[key] = Utils.clone({}, _propertyLocate(srcObj, fn), true);
                        }
                        else {
                            dest[key] = _propertyLocate(srcObj, fn);
                        }
                    }


                    else {
                        fn = fn instanceof String ? fn.valueOf() : fn;
                        dest[key] = fn;
                    }
                    delete this.keys[key];
                }
                else if(this.others !== 0 && !self) {

                    if(this.others == 1 || (this.reduce && !this.reduce[key]) || (this.map && this.map[key])) {
                        if(deep) {
                            dest[key] = Utils.clone({}, srcObj[key], true);
                        }
                        else {
                            dest[key] = srcObj[key];
                        }

                    }

                }
            }
        }
        for(key in this.keys) {
            if(this.keys.hasOwnProperty(key)) {
                fn = this.adapter[key];
                if(typeof fn == 'function') {
                    dest[key] = fn.call(dest, srcObj, key)
                }
                else if(typeof fn == 'string') {
                    if(fn == '*') {
                        dest[key] = srcObj;
                    }
                    else if(deep) {
                        dest[key] = Utils.clone({}, _propertyLocate(srcObj, fn), true);
                    }
                    else {
                        dest[key] = _propertyLocate(srcObj, fn);
                    }

                }
                else {
                    dest[key] = fn;
                }
            }
        }
        //}
        return dest;
    }

};
DataAdapter.setup = function(dest, map, src) {
    map = map.split(/,| /);
    for(var i = 0; i < map.length; i++) {
        var res = map[i].split('|'), def = null;
        if(res[1]) {
            def = JSON.parse(res[1]);
        }
        if(src) {
            dest[res[0]] = src[res[0]] || def;
        }
        else {
            dest[res[0]] = def;
        }
    }
    return dest;
};


