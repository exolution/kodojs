/**
 * Created by godsong on 15-4-30.
 */
/**
 * Created by godsong on 15-4-23.
 */
var Router = require('../Router');
var Action = require('../Action');
var Filter = require('../Filter');
var Model = require('../Model');
var Staticizer = require('../Staticizer');
var Service = require('../Service');
var Config = require('../Config');
var Utils = require('../Utils');
var URL = require('url');
var Fs = require('fs');
var Path = require('path');
var Promise=require('../Promise');
exports.filter = function *main(request, response, next, context) {
    var parsedUrl = request.parsedUrl;
    debug('+++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++',false);
    debug(request.method + ':' + request.url,false);

    var match = Router.matchAction(parsedUrl.pathname, request.method);
    if(match) {
        context.routeInfo = match.routeInfo;
        if(match.router.maybeStaticFile(parsedUrl.pathname)) {
            var filename = Path.join(Config.server.assetsDir, parsedUrl.pathname);
            debug('but this request path like a static file!',false);
            var hasFile = yield tryFile(filename);
            if(!hasFile) {
                debug('tryfile[' + filename + ']:Not found! run action!',false)
                context.actionInstance = match.router.action.newInstance(request, response,context);
                context.invokeChain.push.apply(context.invokeChain, match.router.action.invokeChain);
                return yield next;
            }
            else {
                debug('tryfile[' + filename + ']:find! static file first!',false);
                context.invokeChain.push(Filter.getFilter('$staticFile'));
                return yield next;
            }

        }
        else {
            context.actionInstance = match.router.action.newInstance(request, response,context);
            context.invokeChain.push.apply(context.invokeChain, match.router.action.invokeChain);
            yield next;

        }
    }
    else {
        context.invokeChain.push(Filter.getFilter('$staticFile'));
        yield next;


    }
};


function tryFile(filename) {
    var p = new Promise();
    Fs.stat(filename, function(err, stat) {
        if(err && err.code === 'ENOENT' || !stat.isFile()) {
            p.resolve(false);
        }
        else {
            p.resolve(true);
        }
    });
    return p;
}