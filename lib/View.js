/**
 * Created by godsong on 15-3-5.
 */
var Promise = require('./Promise');
var Model = require('./Model');
var Utils = require('./Utils');
var Parser = require('./XParser');
var View = module.exports = function View(name/*,model...*/) {
    this.name = name;
    var promiseList = [];
    for(var i = 1; i < arguments.length; i++) {
        var model = Model[arguments[i]];
        if(model.dataSource) {
            promiseList.push(model.dataSource.promise);
        }
        else {
            promiseList.push(arguments[i]);
        }
    }
    this.promise = Promise.when.apply(Promise, promiseList);
};
View.prototype.render = function(request, response) {
    var view = this;
    this.promise.then(function() {
        var data, dataMap = {};
        for(var i = 0; i < arguments.length; i++) {
            var modelMeta = Model[arguments[i]];
            dataMap[modelMeta.name] = modelMeta.model;
        }
        if(arguments.length == 1) {
            data = arguments[0];
        }
        else {
            data = dataMap;
        }
        view.data = data;
        view.dataMap = dataMap;
        if(view.name.charAt(0) === '@') {
            _contentHandler[view.name] && _contentHandler[view.name].call(view, request, response);
        }
        else {
            console.time(1);
            Utils.localGet(view.name, request.headers, function(err, html) {
                if(err) {
                    response.writeHead(err, {
                        'Content-Type' : 'text/html'
                    });
                    response.end(html);
                }
                else {
                    var targetHtml = Parser.render(html, dataMap);
                    console.timeEnd(1);
                    response.end(targetHtml);
                }
            })
        }
    })
};
var _contentHandler = {};
_contentHandler['@json'] = function(request, response) {
    response.writeHead(200, {
        'Content-Type' : 'text/json;charset=utf-8'
    });
    response.end(JSON.stringify(this.data));
};
_contentHandler['@html'] = function(request, response) {
    response.writeHead(200, {
        'Content-Type' : 'text/html'
    });
    response.end(JSON.stringify(this.data));
};

