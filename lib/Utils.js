/**
 * Created by godsong on 15-3-5.
 */
var util = require('util');
var Http = require('http');
var Url = require('url');
var Path = require('path');
var Fs = require('fs');
var _ArrayProto = [];
var Promise = require('./Promise');
var Utils = module.exports;
var QueryString = require('querystring');
var projectPath = Path.dirname(require.main.filename);
var crypto = require('crypto');
var slice = Array.prototype.slice;
Utils.__proto__ = util;
Utils.clone = function clone(dest, src, deep) {
    if(Utils.isArray(src)) {
        if(!Utils.isArray(dest)) {
            dest.__proto__ = _ArrayProto;
        }
        for(var i = 0; i < src.length; i++) {
            var obj = src[i];
            if(deep && typeof obj === 'object'&&obj) {
                if(Utils.isArray(obj)){
                    dest.push(clone([], obj, deep));
                }
                else{
                    dest.push(clone({}, obj, deep));
                }

            }
            else {
                dest.push(obj);
            }
        }
    }
    else {
        for(var key in src) {
            if(src.hasOwnProperty(key)) {
                obj = src[key];
                if(deep && typeof obj === 'object'&&obj) {
                    if(Utils.isArray(obj)){
                        dest[key] = clone([], obj, deep);
                    }
                    else{
                        dest[key] = clone({}, obj, deep);
                    }
                }
                else {
                    dest[key] = obj;
                }
            }
        }
    }
    return dest;
};
Utils.merge = function merge(a, b) {
    var dest = {};
    for(var i = 0; i < arguments.length; i++) {
        if(typeof arguments[i] === 'object') {
            for(var k in arguments[i]) {
                if(arguments[i].hasOwnProperty(k)) {
                    dest[k] = arguments[i][k];
                }
            }
        }
    }
    return dest;
};

Utils.localGet = function(url, headers) {
    var urlObj = Url.parse(url);
    headers = Utils.clone({}, headers, true);
    var p = new Promise();
    var req = Http.request({
        host    : urlObj.hostname,
        method  : 'get',
        path    : urlObj.path,
        port    : urlObj.port || 80,
        headers : headers
    }, function(res) {
        var body = '';
        res.on('data', function(chunk) {
            body += chunk.toString();
        });
        res.on('end', function() {
            if(res.statusCode == 200) {
                p.resolve(body);
            }
            else {
                p.reject('request "'+url+'":'+res.statusCode);
            }
        });
    });

    req.on('error', function(err) {
        var e = new Error('Connect Error for request for ' + url);
        e.realError=err;
        e.name = 'Http Request Error';
        p.reject(e);
    });
    req.end();
    return p;
};
Utils.lowerCaseFirst = function(s) {
    return s[0].toLowerCase() + s.slice(1);
};
Utils.getAllJsFiles = function(dir) {
    return this.getAllFiles(dir, 'js', /^\./);
};
Utils.getAllFiles = function getAllFile(dir, ext, exclude) {
    var result = [];
    exclude = exclude || /^$/;
    if(ext) {
        var re_ext = new RegExp('^\\.(' + ext + ')$');
    }
    else {
        re_ext = /.*/;
    }
    try {
        var files = Fs.readdirSync(dir);
    }
    catch(e) {
        files = [];
    }
    for(var i = 0; i < files.length; i++) {
        var extname = Path.extname(files[i]);
        if(exclude.test(files[i])) {
            continue;
        }
        if(extname === '' && Fs.statSync((Path.join(dir, files[i]))).isDirectory()) {
            result.push.apply(result, getAllFile(Path.join(dir, files[i])));
        }
        else if(re_ext.test(extname)) {
            result.push(Path.join(dir, files[i]));
        }
    }
    return result;
};

Utils._dealAsyncGenerator = function dealAsyncGenerator(generator, state, promise) {
    //执行generator
    if(state.done) {//所有的yield完成
        promise.resolve(state.value);//抛出结果
        return true;
    }
    else {
        //1.其中一个yield 且yield抛出的是一个promise 那么promise的onFulfilled里执行next
        if(state.value && state.value.then) {
            var resolveError = function(reason) {
                promise.reject(reason);
            };
            state.value.then(function then(data) {
                //等待上个yield出来的promise完成时 恢复执行代码至下一个yield
                var nextState = generator.next(data);
                dealAsyncGenerator(generator, nextState, promise)
            }, resolveError).catch(resolveError);
        }
        //2.其中一个yield 且yield抛出的是一个函数 先执行该函数在做后续处理
        else if(typeof state.value === 'function') {
            try {
                var ret = state.value();
            } catch(err) {
                return promise.reject(err);
            }
            if(ret && ret.then) {
                resolveError = function(reason) {
                    promise.reject(reason);
                };
                ret.then(function then(data) {
                    //等待上个yield出来的promise完成时 恢复执行代码至下一个yield
                    var nextState = generator.next(data);
                    dealAsyncGenerator(generator, nextState, promise)
                }, resolveError).catch(resolveError);
            }
            else {
                try {
                    var nextState = generator.next(ret);
                } catch(err) {
                    return promise.reject(err);
                }
                dealAsyncGenerator(generator, nextState, promise)
            }
        }
        //3.其中一个yield 且yield抛出的是一个generator 那么创建一个新的promise 并执行这个generator
        //相当于该generator抛出一个promise，后续处理如上面分支1
        else if(state.value&&state.value.toString() === '[object Generator]'){
            var childPromise=new Promise();
            try {
                var next = state.value.next();
            } catch(e) {
                return promise.reject(e);
            }
            dealAsyncGenerator(state.value, next, childPromise);
            resolveError = function(reason) {
                promise.reject(reason);
            };
            childPromise.then(function(data){
                var nextState = generator.next(data);
                dealAsyncGenerator(generator, nextState, promise)
            },resolveError).catch(resolveError);
        }
        //其中一个yield 且yield抛出普通值 立即恢复执行代码至下一个yield
        else {
            try {
                nextState = generator.next(state.value);
            } catch(err) {
                return promise.reject(err);
            }
            dealAsyncGenerator(generator, nextState, promise)
        }
    }
};
//执行目标函数
//该函数可以是包含yield的generator
//也可以是返回Promise的异步函数
//也可以是普通函数
//但无论什么函数执行完成后都会返回一个Promise
Utils._executeAsyncFunction = function executeAsyncFunction(fn, thisArgs, args, afterPromise) {
    try {
        var ret = fn.apply(thisArgs, args);//执行目标函数
    } catch(e) {
        return afterPromise.reject(e);
    }
    if(ret && ret.toString() === '[object Generator]') {//如果返回generator
        try {
            var next = ret.next();
        } catch(e) {
            return afterPromise.reject(e);
        }
        Utils._dealAsyncGenerator(ret, next, afterPromise);
    }
    else if(ret instanceof Promise) {//如果返回promise
        ret.then(function(value) {
            afterPromise.resolve(value);
        }, function(reason) {
            afterPromise.reject(reason);
        });
    }
    else {//如果返回普通值
        afterPromise.resolve(ret);
    }
};
//对上述函数的封装
Utils.executeAsyncFunction=function(fn,thisArgs){
    var promise=new Promise();
    Utils._executeAsyncFunction(fn,thisArgs,slice.call(arguments,2),promise);
    return promise;
}
Utils.mkdirSync = function mkdirSync(path) {
    var parentDir = Path.join(path, '..');
    if(Fs.existsSync(parentDir)) {
        Fs.mkdirSync(path);
    }
    else {
        mkdirSync(parentDir);
        Fs.mkdirSync(path);
    }
};
var re_needEscape = /\^|\$|\*|\.|\?|\+|\\|\{|\}|\(|\)|\[|\]|\|/;
var Encoder = Utils.Encoder = function Encoder(charset, escape, short) {
    this.charset = escape + '' + charset;
    this.escape = escape;
    this.shortly = short !== false ? 1 : 2;
    this.prefix = short !== false ? '' : '0';
    if(charset.length > 9 && this.shortly == 1) {
        throw new Error('The length of [charset] must not more than 9 unless the [short] be set to false')
    }
    this.encodeRE = new RegExp(this.charset.split('').map(function(c) {
        return re_needEscape.test(c) ? '\\' + c : c;
    }).join('|'), 'g');
    this.decodeRE = new RegExp(this.escape.replace(re_needEscape, '\\$&') + '(\\d{' + this.shortly + '})', 'g');
};
Encoder.prototype = {
    decode : function(str) {
        return str.replace(this.decodeRE, function(m, idx) {
            return this.charset[+idx];
        }.bind(this));
    },
    encode : function(str) {
        return str.replace(this.encodeRE, function(m) {
            var idx = this.charset.indexOf(m);
            return this.escape + (idx > 9 ? idx : this.prefix + idx);
        }.bind(this))
    }
};
Utils.FileNameEncoder = new Utils.Encoder('\\/:*?"<>|', '※');
global.sleep = function(time) {
    var p = new Promise();
    setTimeout(function() {
        p.resolve();
    }, time);
    return p;
};
function noop() {
}
//执行 调用栈
Utils.resolveInvokeChain = function resolveInvokeChain(request, response, invokeContext, invokeChain, currentIndex, errHandler) {
    var currentInvoker = invokeContext.currentInvoker = invokeChain[currentIndex];
    if(currentInvoker.isAction) {
        var ret = currentInvoker.run(request, response, invokeContext);
    }
    else {
        ret = currentInvoker.run(request, response, function() {
            return currentIndex + 1 < invokeChain.length ?
                   resolveInvokeChain(request, response, invokeContext, invokeChain, currentIndex + 1, errHandler) :
                   null;
        }, invokeContext);
    }
    return ret.catch(errHandler);
};

Utils.getJSON = function(url, data, resolver) {
    var urlObj = Url.parse(url);
    var p = new Promise();
    var dataStr = QueryString.stringify(data)
    var request = Http.request({
        host    : urlObj.hostname,
        method  : 'post',
        path    : urlObj.path,
        port    : urlObj.port || 80,
        headers : {
            "Content-Type"   : 'application/x-www-form-urlencoded',
            "Content-Length" : dataStr.length
        }
    }, function(res) {
        var body = '';
        res.on('data', function(chunk) {
            body += chunk;
        });
        res.on('end', function() {
            if(res.statusCode == 200) {

                try {
                    var result = JSON.parse(body)
                } catch(e) {
                    result = body;
                }
                resolver && (result = resolver(result));
                p.resolve(result);
            }
            else {
                //p.reject(res.statusCode);
                p.resolve(body);
                //console.log(body);
            }
        });
    });
    this.promise = p;
    request.on('error', function(err) {
        var e = new Error('Connect Error for request for ' + url);
        e.name = 'Http Request Error';
        p.reject(e);
    });
    request.write(dataStr + "\n");
    request.end();
    return p;
};
Utils.typeOf = function(obj) {
    return Object.prototype.toString.call(obj).split(' ')[1].slice(0, -1).toLowerCase();
};

Utils.encode = function(text) {
    var cipher = crypto.createCipher('aes-256-cbc', 'hitour10086');
    var crypted = cipher.update(text, 'utf8', 'hex')
    crypted += cipher.final('hex');
    return crypted;
};
Utils.decode = function(code) {
    var decipher = crypto.createDecipher('aes-256-cbc', 'hitour10086');
    try {
        var dec = decipher.update(code, 'hex', 'utf8');
        dec += decipher.final('utf8');
    } catch(e) {
        console.error('decode error:' + code);
        dec = '';
    }
    return dec;
};
Utils.locator = function(path) {
    return Path.join(projectPath, path);
};
Utils.cookie = {
    add : function(name, value, time, path, httpOnly) {
        var cookie = name + '=' + value;
        var now = new Date();
        now.setTime(now.getTime() + time * 1000);
        cookie += ';Expires=' + now.toGMTString();
        cookie += ';Path=' + path || '/';
        if(httpOnly) {
            cookie += ';HttpOnly'
        }
        return cookie;
    },
    del : function(name, path) {
        return name + '=; Path=' + (path || '/') + ';Expires=Thu, 01 Jan 1970 00:00:01 GMT';
    }
};
Utils.post = function(url, data) {
    var urlObj = Url.parse(url);
    if(data) {
        data = new Buffer(JSON.stringify(data));
        var headers = {
            "Content-Type"   : 'application/json;charset=UTF-8',
            "Content-Length" : data.length
        }
    }
    else {
        headers = {
            "Content-Length" : 0
        }
    }

    var p = new Promise();
    var req = Http.request({
        host    : urlObj.hostname,
        method  : 'post',
        path    : urlObj.path,
        port    : urlObj.port || 80,
        headers : headers
    }, function(res) {
        var body = '';
        res.on('data', function(chunk) {
            body += chunk.toString();
        });
        res.on('end', function() {
            if(res.statusCode == 200) {
                p.resolve(body);
            }
            else {
                if(res.statusCode==500){
                    console.warn('500 Error:',url,data);
                }
                p.reject(res.statusCode);
            }
        });
    });

    req.on('error', function(err) {
        var e = new Error('Connect Error for request for ' + url);
        e.name = 'Http Request Error';
        p.reject(e);
    });
    if(data != null)req.write(data);
    req.end();
    return p;
};
Utils.yieldable = function(func, thisArgs, argsA, argsB, argsC) {
    if(typeof func !== 'function') {
        return func;
    }
    var promise = new Promise();

    function callback(err, data) {
        if(err) {
            return promise.reject(err);
        }
        promise.resolve(data);
    }

    switch(arguments.length) {

        case 2:
            func.call(thisArgs, callback);
            break;
        case 3:
            func.call(thisArgs, argsA, callback);
            break;
        case 4:
            func.call(thisArgs, argsA, argsB, callback);
            break;
        default :
            var args = slice.call(arguments, 2);
            args.push(callback);
            func.apply(thisArgs, args);
            break;
    }
    return promise;
};

Utils.wrapGenerator = function(func, thisArgs) {
    var defaultArgs = slice.call(arguments, 2);
    return function() {
        var promise = new Promise();
        var args = defaultArgs.concat(slice.call(arguments));
        Utils._executeAsyncFunction(func, thisArgs, args, promise);
        return promise;
    }
};
var s_space = '                          ';
Utils.formatSql = function(sql) {
    var loc = /LEFT JOIN|WHERE/ig;
    var from = /from/i;
    var select = /select/i;
    sql = sql.trim();
    sql = sql.split(/,\s*(?=.*FROM)/ig).join(',\n       ')
        .split(/(?=\b(?:WHERE|LEFT JOIN|GROUP BY|LIMIT|ORDER BY)\b)/ig).join('\n')
    return sql.split('\n').map(function(line) {
        line = line.trimRight();
        if(from.test(line) && !select.test(line)) {
            line = line.replace(/(?=FROM)/i, '\n');
        }
        if(line.length >= 100) {
            var indent = (loc.exec(line), loc.lastIndex);
            loc.lastIndex = 0;

            return line.split(/(?= ON | AND | OR )/gi).join('\n' + s_space.slice(-indent));
        }
        else return line;
    }).join('\n')

};