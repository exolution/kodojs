/**
 * Created by godsong on 15-4-30.
 */
/**
 * Main Dispatcher
 * 用于匹配路由找到对应的action 加入请求处理执行链的末端
 * 如果没命中路由 则选择静态文件filter加入到请求执行链的末端
 */
var Fs = require('fs');
var Path = require('path');

//@doDispatch
exports.filter = function *main(request, response, next, invokeContext) {
    var parsedUrl = request.parsedUrl;
    debug('+++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++', false);
    debug(request.method + ':' + request.url, false);
    var match = K.Router.matchAction(parsedUrl.pathname, request.method);
    if(match) {
        //把routeParams保存在invokerContext的params里 用于action的注入
        invokeContext.addParam(match.routeParams);
        //静态文件策略 static file strategy
        if(match.router.maybeStaticFile(parsedUrl.pathname)) {
            var filename = Path.join(K.Config('server.assetsDir'), parsedUrl.pathname);
            debug('but this request path like a static file!', false);
            var hasFile = yield _tryFile(filename);
            if(!hasFile) {
                debug('tryfile[' + filename + ']:Not found! run action!', false)
                //创建action实例
                //create action instance
                invokeContext.instantiateAction(match.router.action);
                invokeContext.addInvoker(match.router.action.invokeChain);
                return yield next;
            }
            else {
                debug('tryfile[' + filename + ']:find! static file first!', false);
                invokeContext.addInvoker(K.Filter.get('$StaticFile$'));
                return yield next;
            }

        }
        else {
            invokeContext.instantiateAction(match.router.action);
            invokeContext.addInvoker(match.router.action.invokeChain);
            yield next;

        }
    }
    else {
        invokeContext.addInvoker(K.Filter.get('$StaticFile$'));
        yield next;


    }
};

//异步测试文件是否存在
function _tryFile(filename) {
    var p = new K.Promise();
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