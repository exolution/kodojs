/**
 * Created by godsong on 15-4-24.
 */
var ServeStatic = require('serve-static');
var Config = require('../ConfigTool').Config;
var Promise = require('../Promise');
var Path = require('path');
var ReadyStream = require('../ReadyStream');
var Fs = require('fs');
var serveStatic = ServeStatic(Path.resolve(Config.server.projectPath, Config.server.assetsDir))
exports.filter = function*(request, response, next, context) {
    debug('find staticFile');
    var ext = Path.extname(request.parsedUrl.pathname);
    if(ext == '.js') {
        context.readyStream.setHeader('Content-Type', 'text/javascript;charset=UTF-8');
    }
    context.readyStream.path=request.parsedUrl.pathname;
    serveStatic(request, context.readyStream, function(err) {
        context.readyStream._response._headers = undefined;
        context.readyStream.statusCode = err ? err.status : 404;
        context.readyStream.end(err ? err.msg : 'Not Found');
        context = null;
    });

};