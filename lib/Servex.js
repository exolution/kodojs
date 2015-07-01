/**
 * Servex.js
 * Copyright(c) 2015-2015 exolution
 * MIT Licensed
 */
console.time('Servex Startup! \nelapsed');

/*强迫症是怎样炼成的*/
var Fs = require('fs');
var URL = require('url');
var Http = require('http');
var Model = require('./Model');
var Router = require('./Router');
var Promise = require('./Promise');
var BodyParse = require('body-parser');
var Staticizer = require('./Staticizer');
var ReadyStream = require('./ReadyStream');
var ServiceMgr = require('./Service');
var ActionEx = require('./Action');
var Filters = require('./Filter');
var Config = require('./Config');
var Utils = require('./Utils');
var Path = require('path');
var EventEmitter=require('events').EventEmitter;
/*尼玛 缺两个 要死了*/


var projectPath = Path.dirname(require.main.filename);
var defaultConfig = {
    actionDir   : 'action',
    serviceDir  : 'service',
    modelDir    : 'model',
    assetsDir   : 'assets',
    staticDir   : 'static_cache',
    configDir   : 'config',
    filterDir   : 'filter',
    viewDir     : 'view',
    projectPath : projectPath
};

var requestUUID=0;
var Servex = module.exports = function Servex(config) {
    if(!(this instanceof Servex)) {
        return new Servex(config);
    }
    this.filterChain = [];
    var configDir = config && config.configDir || defaultConfig.configDir;
    var mainConfig = Path.basename(config && config.mainConfig || 'server', '.js');

    Config.loadConfig(Path.join(projectPath, configDir));
    this.config = Utils.merge(defaultConfig, config, Config[mainConfig])
    Config.set('server', this.config);

    this.promise = Model.init(this.config);//没办法 链接数据库是异步的
    Filters.init(this.config);
    ActionEx.init(this.config);
    Router.init(this.config);
    ServiceMgr.init(this.config);
    Staticizer.init(ActionEx.getAction());
    //use the default filter
    this.use('$main');
};
Utils.inherits(Servex,EventEmitter);
Servex.prototype.use = function(filterName) {
    if(typeof filterName === 'string') {
        var filter = Filters.getFilter(filterName)
    }
    else if(typeof filterName === 'function') {
        filter = Filters.createFilter(filterName);
    }
    else {
        throw new Error('The arguments of Servex.use must be a string or function');
    }
    this.filterChain.push(filter);
};
var re_trimEnd = /\?$/;
var i = 0;

Servex.prototype.start = function(application, port) {

    var servex = this;
    // parse application/x-www-form-urlencoded
    application.use(BodyParse.urlencoded({extended : false}));
    // parse application/json
    application.use(BodyParse.json());
    //main entrance
    application.use(function(request, response, next) {
        resolveRequest(request);
        //instantiate the global filter chain
        var filterChain = servex.filterChain.concat();
        var invokeContext = {
            invokeChain : filterChain,
            readyStream : new ReadyStream(response)
        };
        request._requestUUID=requestUUID++;
        Utils.resolveInvokeChain(request, response, invokeContext, filterChain, 0, function(err) {
            console.error('Uncaught Error:\n' + err.stack);
            response.writeHead(500);
            response.write('Uncaught Error\n');
            response.write(err.stack);
            response.end();
            invokeContext = null;
            return false;
        }).then(function() {
            invokeContext.readyStream.setHeader('X-Powered-By', 'ServeX');
            invokeContext.readyStream.response();
            invokeContext = null;
        });
    });


    this.promise.then(function() {
        port=port||80;
        var httpServer=application.listen(port);
        servex.emit('start',httpServer);
        console.timeEnd('Servex Startup! \nelapsed');
    });
    this.promise = null;
    return application;

};

Servex.prototype.setTemplateEngine=function(templateEngine){
    this.config.templateEngine=templateEngine;
}
function resolveRequest(request) {
    //trim the trailer single '?'
    var url = request.url.replace(re_trimEnd, '');
    var parsedUrl = URL.parse(url, true);
    // dispose the session url rewrite
    var splits = parsedUrl.pathname.split(';');
    parsedUrl.pathname = splits[0];
    parsedUrl.param = splits.slice(1).join('');
    //detect mobile request
    var ua = request.headers['user-agent'];
    if(/nokia|sony|ericsson|mot|samsung|htc|sgh|lg|sharp|sie-|philips|panasonic|alcatel|lenovo|iphone|ipod|blackberry|meizu|android|netfront|symbian|ucweb|windowsce|palm|operamini|operamobi|openwave|nexusone|cldc|midp|wap|mobile/i.test(ua)) {
        request.isMobile = true;
    }
    request.cookie = parseCookie(request.headers['cookie']);
    request.parsedUrl = parsedUrl;
}
function parseCookie(cookieStr) {
    var cookie = {};
    if(cookieStr) {
        cookieStr.split(';').forEach(function(e) {
            var splits = e.split('=');
            cookie[splits[0].trim()] = splits[1];
        });
    }
    return cookie;
}

function yell() {
    for(var i = 0; i < arguments.length; i++) {
        console.info(arguments[i].name)
        arguments[i]._yell();
    }
}

