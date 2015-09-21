/**
 * Created by godsong on 15-4-24.
 */
var Fs = require('fs');
var Config = require('../Config');
var Promise = require('../Promise');
var Path = require('path');
var ReadyStream = require('../ReadyStream');

function resolveReturnValue(context){
    if(typeof context.actionInstance.returnValue === 'string') {
        context.readyStream.statusCode = 200;
        context.readyStream.setHeader('content-type' , 'text/html;charset=utf-8');
        context.readyStream.write(context.actionInstance.returnValue);
        context.readyStream.end();

    }
    else if(typeof context.actionInstance.returnValue === 'number') {
        context.readyStream.statusCode = context.actionInstance.returnValue;
        context.readyStream.setHeader('content-type' , 'text/html;charset=utf-8');
        context.readyStream.end();
    }
    else if(typeof context.actionInstance.returnValue === 'object') {
        if(context.actionInstance.returnValue.constructor === Object ||
           context.actionInstance.returnValue.constructor === Array) {
            context.readyStream.statusCode = 200;
            context.readyStream.setHeader('content-type' , 'application/json;charset=utf-8');
            context.readyStream.write(JSON.stringify(context.actionInstance.returnValue))
            context.readyStream.end();
        }
    }
    else if(context.actionInstance.returnValue instanceof Promise){
        context.actionInstance.returnValue.then(function(ret){
            context.actionInstance.returnValue=ret;
            resolveReturnValue(context);
        });
    }

}
exports.filter = function *(request, response, next, context) {
    yield next;
    if(context.actionInstance) {
        if(context.actionInstance.view) {
            var viewPath = Path.join(Config('server.projectPath'), Config('server.viewDir'), context.actionInstance.view +
                                                                                                     '.html');
            Fs.createReadStream(viewPath).pipe(context.readyStream);
            context.readyStream.statusCode = 200;
            context.readyStream.setHeader('content-type' , 'text/html;charset=utf-8');
            if(context.actionInstance.templateEngine||context.actionInstance.templateEngine===undefined&&Config('server.templateEngine')) {
                templateEngine=context.actionInstance.templateEngine||Config('server.templateEngine');
                context.readyStream.pipe(function(chunk, encoding, done) {
                    try {
                        this.push(templateEngine.compile(chunk.toString())(context.actionInstance.renderData || {}));
                    } catch(e) {
                        console.error(e);
                        this.push(chunk.toString());
                    }
                    done();
                }, true);
            }

        }
        else {
            resolveReturnValue(context);
        }

    }
};
