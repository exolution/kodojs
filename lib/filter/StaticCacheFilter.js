/**
 * Created by godsong on 15-4-24.
 */
var Staticizer = require('../Staticizer');
exports.filter = function*(request, response, next, context) {
    var action = context.actionInstance.action;
    if(action.meta.cache&&!context.disableActionCache) {//fixme mobile判断属于个性化
        var hasStaticFile = yield Staticizer.tryStatic(request, context.readyStream, context.routeInfo, action)
        if(!hasStaticFile) {
            if(action.staticizeStatus[request.parsedUrl.path] != -1) {
                action.staticizeStatus[request.parsedUrl.path] = 1;
            }
            yield next;
            if(action.staticizeStatus[request.parsedUrl.path] == 1) {
                action.staticizeStatus[request.parsedUrl.path] = -1;//正在静态化中 锁定状态
                    Staticizer.staticize(request.parsedUrl, action, context.readyStream);
            }
        }
        else {
        }
    }
    else {
        yield next;
    }
};