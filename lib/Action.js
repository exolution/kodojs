'use strict';
/**
 * Created by godsong on 14-8-27.
 */
var Fs = require('fs');
var Path = require('path');
var Utils = require('./Utils');
var Filter = require('./Filter');
var Promise = require('./Promise');
var Service = require('./Service');
var Annotation = require('./Annotation');
var Config = require('./Config');
var re_argsResolver = /^function[^(]*\(\s*([^)]*)\s*\)/;
var _actionContext = {};
var _projectPath = Path.dirname(require.main.filename);
var _errorHandlerAction;

function init(config) {
    _errorHandlerAction = null;
    _actionContext = {};
    var actionDir = Path.resolve(_projectPath, config.actionDir || 'action');
    var internalFiles = Utils.getAllJsFiles(Path.resolve(__dirname, '../manage/action'));
    var files = Utils.getAllJsFiles(actionDir).concat(internalFiles);
    files.forEach(function(file) {
        var annotationMap = Annotation(file);
        var actionModule = require(file);
        var actionNamespace = Path.relative(actionDir, Path.dirname(file)).toLowerCase();
        actionNamespace = (actionNamespace ? actionNamespace + '/' : actionNamespace) +
                          Utils.lowerCaseFirst(Path.basename(file, '.js'));
        actionNamespace = actionNamespace.replace(/.*?\/node_modules\/servex\/manage\/action\/(.*)/, '$$internal/$1');
        if(typeof actionModule==='function'){
            var meta = annotationMap.extract('module.exports');
            _actionContext[actionNamespace]=new Action(actionNamespace, actionModule, meta);
            if(meta['errorhandler']) {
                _errorHandlerAction = _actionContext[actionNamespace];
            }
        }
        else {
            for(var actionName in actionModule) {
                if(actionModule.hasOwnProperty(actionName) && actionName.charAt(0) !== '@' &&
                   typeof actionModule[actionName] === 'function') {
                    meta = annotationMap.extract('exports.' + actionName);

                    _actionContext[actionNamespace + '/' + actionName] = new Action(actionNamespace + '/' +
                                                                                    actionName, actionModule[actionName], meta);
                    if(meta['errorhandler']) {
                        _errorHandlerAction = _actionContext[actionNamespace + '/' + actionName];
                    }
                }
            }
        }
    });
}

var Action = module.exports = function(name, handler, meta) {
    this.name = name;
    this.isAction = true;
    this.handler = handler;
    this.meta = meta;
    //disable when action debug and config not debug;
    this.disabled=!Config('Server.debug')&&meta.debug;
    this.getInvokeChain();
    this.staticizeStatus = {};//静态化状态 0不需要静态化 1需要静态化 -1 正在静态化中
    this.paramList = re_argsResolver.exec(handler.toString())[1].split(',');
};
function createObjByPath(root, path, value) {
    var parts = path.split('.');
    var cur = root;
    for(var i = 0; i < parts.length - 1; i++) {
        if(!cur[parts[i]]) {
            cur[parts[i]] = {}
        }
        else if(typeof cur[parts[i]] != 'object') {
            return;
        }
        cur = cur[parts[i]];
    }
    cur[parts[parts.length - 1]] = value;
    return cur;
}
function assemblyQuery(query) {
    var context = {};
    for(var key in query) {
        if(query.hasOwnProperty(key)) {
            if(key.indexOf('.') != -1) {
                createObjByPath(context, key, query[key])
            }
        }
    }
    for(var k in context) {
        if(context.hasOwnProperty(k) && !query.hasOwnProperty(k)) {
            query[k] = context[k];
        }
    }

}
var initArguments = function(request, response, invokeContext, actionContext) {//依赖注入
    var parsedUrl = request.parsedUrl;
    var error = invokeContext.error;
    var query=request.query;
    var argumentList = [];
    assemblyQuery(query);
    this.paramList.forEach(function(param) {
        param = param.trim();
        if(!param) return;
        if(param === 'Request') {
            argumentList.push(request);
        }
        else if(param === 'Response') {
            argumentList.push(response);
        }
        else if(param === 'Session') {
            argumentList.push(request.session);
        }
        else if(param==='ReadyStream'){
            argumentList.push(invokeContext.readyStream);
        }
        else if(param === 'Error') {
            argumentList.push(error);
        }
        else if(param.charAt(0) == '$') {
            try {
                argumentList.push(Service.getService(Utils.lowerCaseFirst(param.slice(1))));
            } catch(e) {
                console.warn('initArguments error:', e);
            }

        }
        else if(param.charAt(0) === '_') {
            param = param.slice(1);
            argumentList.push(selectValue(param, query,request.body));
        }
        else {
            argumentList.push(selectValue(param, invokeContext.params, query,request.body ,actionContext));
        }

    });
    return argumentList;
};
function selectValue(name) {
    for(var i = 1; i < arguments.length; i++) {
        if(arguments[i][name] !== undefined) {
            return arguments[i][name];
        }
    }
}
/**
 * Action实例 基于每次请求都要创建个action实例用于保存一些基于该请求上下文信息，
 * 同时保存所有的前任action（forward 引起的action跳转）并保存他们的context
 */
function ActionInstance(action, request, response,prevActionInstance) {
    this.request = request;
    this.response = response;
    this.action = action;
    this.context = prevActionInstance?prevActionInstance.context:{};
    this.prevActionInstances=prevActionInstance?[prevActionInstance].concat(prevActionInstance.prevActionInstances):[];
    this.cookies='';

}
ActionInstance.prototype = {
    addContext:function(key,value){
        if(typeof key ==='object'&&arguments.length==1){
            for(var k in key){
                if(key.hasOwnProperty(k)){
                    this.context[k]=key[k];
                }
            }
        }
        else{
            this.context[key]=value;
        }
    },
    forward      : function(actionFullName, data) {
        this.forwardAction = actionFullName;
        this.forwardData = data;
    },
    setTemplateEngine:function(templateEngine){
        this.templateEngine=templateEngine;
    },
    redirect     : function(url) {
        this.response.writeHead(302, {location : url});
        this.response.end();
    },
    render       : function(view, data) {
        this.view = view;
        this.renderData = data;
    },
    disableCache : function() {
        this.response.setHeader('Cache-Control', 'no-cache');
        this.response.setHeader('max-age', '0')
    },
    setCookie:function(name,value,expires,path,httpOnly){
        var setcookie=this.response.getHeader('set-cookie');
        var cookie=Utils.cookie.add(name,value,expires,path,httpOnly);
        if(!setcookie){
            setcookie=cookie
        }
        else if(typeof setcookie=='string'){
            setcookie=[setcookie,cookie];
        }
        else if(setcookie instanceof Array){
            setcookie.push(cookie);
        }
        this.response.setHeader('set-cookie',setcookie);
    },
    removeCookie:function(name,path){
        var setcookie=this.response.getHeader('set-cookie');
        var cookie=Utils.cookie.del(name,path);
        if(!setcookie){
            setcookie=cookie
        }
        else if(setcookie=='string'){
            setcookie=[setcookie,cookie];
        }
        else if(setcookie instanceof Array){
            setcookie.push(cookie);
        }
        this.response.setHeader('set-cookie',setcookie);
    }
};
Action.prototype.newInstance = function(request, response, prevActionInstance) {
    return new ActionInstance(this, request, response,prevActionInstance);
};
Action.prototype.run = function(request, response, invokeContext) {
    var promise = new Promise();
    var instance = invokeContext.actionInstance;
    var argumentList = initArguments.call(this, request, response, invokeContext, instance.context);

    function resolveError(err) {//deal error
        console.error('Resolve Error', err.stack ? err.stack : err);
        invokeContext.error = err;
        if(_errorHandlerAction) {
            _errorHandlerAction.run(request, response, invokeContext)
        }
        else {
            response.writeHead(500);
            response.end('Internal Server Error 500\n' + err.stack ? err.stack : err);
        }
        return false;
    }

    var next = promise.then(function(ret) {//deal render
        if(instance.forwardAction) {
            var forwardAction = Action.getAction(instance.forwardAction);
            if(forwardAction) {

                invokeContext.actionInstance = forwardAction.newInstance(request, response, invokeContext);
                invokeContext.actionInstance.context = Utils.merge(instance.context, instance.forwardData);
                return forwardAction.run(request, response, invokeContext);
            }
            else {
                var e = new Error('Can not find action:' + instance.forwardAction);
                e.name = 'Forward Action Error';
                resolveError(e);
            }
        }
        invokeContext.actionInstance.returnValue = ret;
        return ret;
    }, resolveError);
    Utils._executeAsyncFunction(this.handler, instance, argumentList, promise);
    return next;


};
Action.prototype.getInvokeChain = function() {
    var list,invokeList=[],self=this;
    if(this.meta.filterList) {
        if(this.meta.filterList.indexOf('$')!=-1){
            list=this.meta.filterList;
        }
        else{
            if(this.meta.filteroverride){
                list=this.meta.filterList;
            }
            else{
                list=['$'].concat(this.meta.filterList);
            }
        }

    }
    else{
        list=['$'];
    }
    list.forEach(function(filterName){
        if(filterName==='$'){
            if(self.meta.cache) {
                invokeList.push(Filter.getFilter('$staticCache'));
            }
            //invokeList.push(Filter.getFilter('$render'))
        }
        else{
            var filter = Filter.getFilter(filterName);
            if(filter.disabled) {
                return;
            }
            if(!filter) {
                throw new Error('Can not find filter:', filterName);
            }
            invokeList.push(filter);
        }
    });
    invokeList.push(this);
    this.invokeChain=invokeList;


};

Action.init = init;
Action.getAction = function(name) {
    if(name !== undefined) {
        name = name.split('/').map(function(sep, idx, target) {
            if(idx < target.length - 2) {
                return sep.toLowerCase();
            }
            else if(idx == target.length - 2) {
                return Utils.lowerCaseFirst(sep);
            }
            else return sep;
        }).join('/');
        return _actionContext[name];
    }
    else {
        return _actionContext;
    }

};

Action._yell=function(){
    console.info(_actionContext);
}
var Staticizer = require('./Staticizer');