/**
 * Created by godsong on 15-4-24.
 */
var ServeStatic = require('../lib/ServeStatic');
var Path = require('path');
var Fs = require('fs');
var serveStatic = ServeStatic(Path.resolve(K.projectPath, K.Config('#.assetsDir')));
//@name($StaticFile$)
exports.filter = function*(request, response, next, invokeContext) {
    debug('find staticFile');
    var ext = Path.extname(request.parsedUrl.pathname);
    if(ext == '.js') {
        invokeContext.readyStream.setHeader('Content-Type', 'text/javascript;charset=UTF-8');
    }
    invokeContext.readyStream.path=request.parsedUrl.pathname;

    invokeContext.readyStream._writing=true;

    serveStatic(request, invokeContext.readyStream, function(err) {
        invokeContext.readyStream._response._headers = undefined;
        invokeContext.readyStream.statusCode = err ? err.status : 404;
        invokeContext.readyStream.end(err ? err.msg : 'Not Found');
        invokeContext.readyStream.doWriting();
        context = null;
    });
    invokeContext.readyStream.syncWrite('A');

    invokeContext.readyStream.writeFile(__dirname+'/MainFilter.js');
    invokeContext.readyStream.syncWrite('B');


};