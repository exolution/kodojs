/**
 * Created by godsong on 15-4-24.
 */
var Fs = require('fs');
var Path = require('path');

//@doOutput
exports.filter = function *(request, response, next, invokeContext) {
    yield next;
    if(invokeContext.actionInstance) {
        if(invokeContext.actionInstance.view) {
            var viewPath = Path.join(K.projectPath, K.Config('#.viewDir'), invokeContext.actionInstance.view + '.html');
            invokeContext.readyStream.writeFile(viewPath);
            invokeContext.readyStream.statusCode = 200;
            invokeContext.readyStream.setHeader('content-type' , 'text/html;charset=utf-8');
            if(invokeContext.actionInstance.templateEngine||invokeContext.actionInstance.templateEngine===undefined&&K.Config('server.templateEngine')) {
                templateEngine=invokeContext.actionInstance.templateEngine||K.Config('#.templateEngine');
                invokeContext.readyStream.pipe(function(chunk, encoding, done) {
                    try {
                        this.push(templateEngine.compile(chunk.toString())(invokeContext.actionInstance.renderData || {}));
                    } catch(e) {
                        console.error(e);
                        this.push(chunk.toString());
                    }
                    done();
                }, true);
            }

        }
        else {
            resolveReturnValue(invokeContext);
        }

    }
};

function resolveReturnValue(invokeContext){
    if(typeof invokeContext.actionInstance.returnValue === 'string') {
        invokeContext.readyStream.statusCode = 200;
        invokeContext.readyStream.setHeader('content-type' , 'text/html;charset=utf-8');
        invokeContext.readyStream.syncWrite(invokeContext.actionInstance.returnValue);

    }
    else if(typeof invokeContext.actionInstance.returnValue === 'number') {
        invokeContext.readyStream.statusCode = invokeContext.actionInstance.returnValue;
        invokeContext.readyStream.setHeader('content-type' , 'text/html;charset=utf-8');
    }
    else if(invokeContext.actionInstance.returnValue instanceof K.Promise){
        invokeContext.actionInstance.returnValue.then(function(ret){
            invokeContext.actionInstance.returnValue=ret;
            resolveReturnValue(invokeContext);
        });
    }
    else if(typeof invokeContext.actionInstance.returnValue === 'object') {
        if(invokeContext.actionInstance.returnValue.constructor === Object ||
           invokeContext.actionInstance.returnValue.constructor === Array) {
            invokeContext.readyStream.statusCode = 200;
            invokeContext.readyStream.setHeader('content-type' , 'application/json;charset=utf-8');
            invokeContext.readyStream.syncWrite(JSON.stringify(invokeContext.actionInstance.returnValue))
        }
    }


}
