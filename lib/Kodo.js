/**
 * Kodo.js
 * Copyright(c) 2015-2015 exolution
 * MIT Licensed
 */
console.time('Kodo Startup! \nelapsed');

/*强迫症是怎样炼成的*/
var Fs = require('fs');
var URL = require('url');
var Config = require('./Config');
var Router = require('./Router');
var Promise = require('./Promise');
var BodyParser = require('body-parser');
var InvokeContext = require('./InvokeContext');
var ReadyStream = require('./ReadyStream');
var Component = require('./Component');
var Request = require('./Request');
var Service = require('./Service');
var express = require('express');
var Filter = require('./Filter');
var Action = require('./Action');
var Logger = require('./Logger');
var Utils = require('./Utils');
var Path = require('path');

/*尼玛 缺两个 要死了*/


var _requestUUID = 0;
var _kodo;//Kodo 是单例的
function Kodo(config) {
    if(_kodo) {
        return _kodo;
    }
    else {
        if(!(this instanceof Kodo)) {
            return new Kodo();
        }
        this.filterChain = [];//server-level filter chain
        this.config = Config.init(config);

        Filter.init(this.config);
        Action.init(this.config);
        Router.init(this.config);
        Service.init(this.config);
        _kodo = this;
        this.loadComponent(require('./components/core'));
    }
}
Kodo.prototype.start = function(onStart) {

    var application = express();
    var kodo = this;
    this.buildFilterChain();
    application.use(BodyParser.urlencoded({extended : false}));
    // parse application/json
    application.use(BodyParser.json());
    if(typeof onStart == 'number') {
        application.use(function mainMiddleware(request, response, next) {
            Run(kodo, request, response);
        });
        application.listen(onStart);
        console.timeEnd('Kodo Startup! \nelapsed')
    }
    else {
        Utils.executeAsyncFunction(onStart, this, application).then(function() {
            application.use(function mainMiddleware(request, response, next) {
                Run(kodo, request, response);
            });
            application.listen(onStart);
            console.timeEnd('Kodo Startup! \nelapsed')
        });

    }

    return application;
};

function Run(kodo, request, response, next) {
    request = new Request(request);
    //instantiate the global filter chain
    var filterChain = kodo.filterChain.concat();
    var invokeContext = new InvokeContext(request, response, filterChain);
    invokeContext.readyStream.setHeader('X-Powered-By', 'Kodo');
    request._requestUUID = _requestUUID++;

    Utils.resolveInvokeChain(request, response, invokeContext, filterChain, 0, function(err) {
        console.error('Uncaught Error:\n' + err.stack);
        response.writeHead(500);
        response.write('Uncaught Error\n');
        response.write(err.stack);
        response.end();
        invokeContext = null;
        return false;
    }).then(function() {
        invokeContext.readyStream.response();
        invokeContext.readyStream.end();
        invokeContext = null;
    });
}
var i = 0;


Kodo.prototype.loadComponent = function(component) {
    new Component(this).loadComponent(component);
};
Kodo.prototype.buildFilterChain = function() {
    this.filterChain = Filter.buildFilterChain();
};


var Namespace = {
    name  : null,
    scope : {},
    apply : function(ns) {
        if(this.name) {
            delete global[this.name];
        }
        this.name = ns;
        global[ns] = this.scope;
    }


};
Kodo.setNamespace = function(ns) {
    Namespace.apply(ns);
};
Kodo.bindToNamespace = function(name, target) {
    Object.defineProperty(Namespace.scope, name, {
        get        : function() {
            return target;
        },
        enumerable : false
    });
};
//for IDE High lighter
global.K = {
    Action  : 0,
    Service : 0,
    Filter  : 0,
    Router  : 0,
    Promise : 0,
    Config  : 0

};

Kodo.setNamespace('K');
Kodo.bindToNamespace('Utils', Utils);
Kodo.bindToNamespace('Promise', Promise);
Kodo.bindToNamespace('Config', Config);
Kodo.bindToNamespace('Service', Service);
Kodo.bindToNamespace('Action', Action);
Kodo.bindToNamespace('Filter', Filter);
Kodo.bindToNamespace('ReadyStream', ReadyStream);
Kodo.bindToNamespace('Router', Router);
Kodo.bindToNamespace('projectPath', Path.dirname(require.main.filename));

module.exports = Kodo;