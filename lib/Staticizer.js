/**
 * Created by godsong on 15-4-8.
 */
var Config = require('./Config');
var Fs = require('fs');
var Send = require('send');
var Path = require('path');
var Action = require('./Action');
var Promise = require('./Promise');
var Utils = require('./Utils');
var Url = require('url');
//fixme 优化缓存策略 目前是以URL包括参数作为文件名进行缓存 如果参数不同（特别是加上无意义的参数）也会认为是两个请求 会分别请求
exports.tryStatic = function(request, response, routeInfo, action, next) {
    var p = new Promise();
    var fileName = resolveStaticFilePath(action, request.parsedUrl.path);
    var stream = Send(request, fileName, {root : '/'});
    stream.on('error', function() {
        p.resolve(false);
    });
    stream.on('file', function() {
        p.resolve(true);
    });
    stream.pipe(response);
    return p;
};
exports.staticize = function(parsedUrl, action, readyStream) {
    var fileName = resolveStaticFilePath(action, parsedUrl.path);
    var outStream=Fs.createWriteStream(fileName);
    readyStream.pipe(outStream);
    outStream.on('finish',function(){
        console.info('写入缓存:');
        delete action.staticizeStatus[parsedUrl.path];
    })
};

exports.refresh = function(action, uri) {
    var promise = new Promise();
    if(typeof action === 'string') {
        action = Action.getAction(action);
    }
    var staticPath = Path.join(Config.server.projectPath, Config.server.staticDir, action.name);


    if(action) {
        if(uri) {
            var fileName = resolveStaticFilePath(action, uri);
            Fs.unlink(fileName, function(err) {
                if(err) {
                    //console.error(err);
                    //promise.resolve(err);
                    promise.resolve([uri]);
                }
                else {
                    promise.resolve([uri]);
                }
            });
        }
        else {
            var promises = [];
            Fs.readdir(staticPath, function(err, fileList) {
                if(err) {
                    return promise.reject(err);
                }
                fileList.forEach(function(file) {
                    if(Path.extname(file) != '.html') {
                        return;
                    }
                    var p = new Promise();
                    Fs.unlink(Path.join(staticPath, file), function(err) {
                        if(err) {
                            console.error(err.stack);
                            err.fileName = file;
                            p.resolve(err);
                        }
                        else {
                            p.resolve(file);
                        }
                    });
                    promises.push(p);
                });
                Promise.all(promises).join(promise);
            });
            return promise;
        }


    }
    else {
        promise.resolve(false);
    }
    return promise;
};
exports.init = function(actionContext) {
    for(var actionName in actionContext) {
        var staticPath = Path.join(Config.server.projectPath, Config.server.staticDir);
        if(!Fs.existsSync(staticPath)) {
            console.info('make static cache dir:', staticPath);
            Utils.mkdirSync(staticPath);
        }
        if(actionContext.hasOwnProperty(actionName)) {
            var action = actionContext[actionName];
            if(action.meta.cache) {
                var actionStaticPath = Path.join(staticPath, action.name);
                if(!Fs.existsSync(actionStaticPath)) {
                    console.info('make dir for action cache:', actionStaticPath);
                    Utils.mkdirSync(actionStaticPath);
                }
            }
        }
    }
};


function resolveStaticFilePath(action, uri) {


    return Path.join(Config.server.projectPath, Config.server.staticDir, action.name, Utils.FileNameEncoder.encode(Url.parse(uri).path) +
                                                                                                    '.html');
}
