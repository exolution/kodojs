/**
 * Created by godsong on 15-3-21.
 */
var Fs = require('fs');
var Path = require('path');
var URL = require('url');
var Action = require('./Action');
var Utils = require('./Utils');
var Staticizer = require('./Staticizer');
var re_pathResolver = /(?:\[([a-zA-Z|]*?)\])?(?:(~|#|\/)(.*))?/,
    re_escape = /([.()])/g,
    re_wildcard = /(\*\*|\*|%%|%)(?::(\w+))?/g,
    re_fuzzy = /(\*|%)+(:\w+)?\/?$/,
    wildcardReplacer = function(m) {
        if(m === '*') {
            return '[^/]*';
        }
        else if(m === '**') {
            return '.*';
        }
        else if(m === '%') {
            return '[^/]+';
        }
        else if(m === '%%') {
            return '(?:.+/.+)+';
        }

    };
var _routeTable = [];
var assetsDir;
function init(config) {
    assetsDir = config.assetsDir;
    var actionContext = Action.getAction();
    for(var actionName in actionContext) {
        if(actionContext.hasOwnProperty(actionName)) {
            var action = actionContext[actionName];
            if(!action.meta['internal']) {//内部action 不走路由
                _routeTable.push(new Router(action, actionName))
            }
        }
    }
    /*files.forEach(function(file) {
     var annotation=Annotation(actionDir + '/' + file);
     var actionHandler = require(actionDir + '/' + file);
     var actionName = Path.basename(file, '.js');
     console.log(Utils.inspect(annotation,{depth:5}));
     for(var method in actionHandler) {
     if(actionHandler.hasOwnProperty(method) && method.charAt(0) !== '@'&&typeof actionHandler[method]==='function') {
     var pathInfo = annotation.get('exports.'+method,'Path',0)||actionHandler['@' + method];

     }
     }
     });*/
    _routeTable.sort(function(a, b) {
        return b.weight - a.weight;
    });
    /*console.log('========================================================\n');
     console.log(_routeTable);
     console.log('========================================================\n\n');*/
}
function Router(action, actionName) {
    var pathInfo = action.meta.path;

    var defaultPathInfo = '/' + actionName + '/**:routeParams';
    defaultPathInfo = defaultPathInfo.replace(/\/([A-Z])/g, function(m, a) {//首字母小写
        return '/' + a.toLowerCase();
    });
    this.action = action;
    this.pathInfo = pathInfo;
    action.staticPath = action.staticPath ||
                        (pathInfo || defaultPathInfo).replace(re_wildcard, '{$2}').replace(/\/$/, '');
    //pathWeight由 @Path指定的权重 potent 由@Path参数指定的是否为强权主义（指无视当前request path下存在静态文件）
    resolvePathInfo.call(this, pathInfo, action.meta.pathWeight, action.meta.potent, defaultPathInfo);

}
function resolvePathInfo(pathInfo, pathWeight, potent, defaultPathInfo) {
    var namedMap = [];
    var match = re_pathResolver.exec(pathInfo);
    if(!match[0]) {
        match = re_pathResolver.exec(defaultPathInfo);
        if(pathInfo !== undefined) {
            throw new Error('Can not resolve [' + this.action.name + ']\'s route info:' + pathInfo +
                            '. Use default config already!');
        }
    }
    if(match[1]) {
        this.method = new RegExp(match[1]);
    }
    else {
        this.method = /.+/;
    }
    if(!match[2]) {//仅仅配置了Method
        match = re_pathResolver.exec(defaultPathInfo);
    }
    if(match[2] == '~') {//使用正则来匹配路径 但权重（优先级）最低
        match[3] = match[3].replace(/(\((?!\?:|\?<))|(\(\?<(\w+)>)/g, function(m, a, b, c) {
            if(a) {
                namedMap.push('');
                return a;
            }
            else if(b) {
                namedMap.push(c);
                return '(';
            }
        });
        this.namedMap = namedMap;
        this.matcher = new RegExp(match[3]);
        this.weight = -10000;
        this.fuzzy = true;
    }
    else {
        this.fuzzy = re_fuzzy.test(match[3]);//判断是否是以通配符结尾
        var pathSplits = match[3].split('/');
        var weight = 0, builder = ['^'];
        pathSplits.forEach(function(path, idx) {

            if(path === '') {//以'/'结尾 则这个/可忽略
                builder.push('?');
                return;
            }
            var exp = path.replace(re_escape, '\\$1').replace(re_wildcard, function(m, a, b) {
                var replacer;
                if(a === '*') {
                    replacer = '[^/]*';
                }
                else if(a === '**') {
                    replacer = '.*';
                }
                else if(a === '%') {
                    replacer = '[^/]+';
                }
                else if(a === '%%') {
                    replacer = '(?:.+/.+)+';
                }
                if(b) {
                    replacer = '(' + replacer + ')';
                    namedMap.push(b);
                }
                return replacer;
            });

            path = path.replace(/:\w+/g, '');
            if(path === '**' || path === '*') {
                if(idx == pathSplits.length - 1) {
                    if(builder.length > 0) {
                        builder[builder.length - 1] += '(?:';
                        exp = '|$)' + exp;
                    }
                    else {
                        exp = '?' + exp;
                    }

                }

            }
            else if(path === '%' || path === '%%') {

            }
            else if(path.indexOf('*') != -1 || path.indexOf('%') != -1) {
                weight += idx + 1;
            }
            else {
                weight += (idx + 1) * 2;
            }
            builder.push(exp);
        });
        this.matcher = new RegExp(builder.join('/') + '$');
        if(match[3] === '') {
            this.weight = 1;
        }
        else {
            this.weight = weight;
        }

        this.namedMap = namedMap;
    }
    if(!isNaN(pathWeight)) {
        this.weight = pathWeight;
    }
    if(potent) {
        this.fuzzy = false;
    }
}
Router.prototype.match = function(url, method) {
    //disabled or internal action not take part in route match
    if(this.action.disabled||this.action.meta.internal){
        return false;
    }
    if(this.method.test(method)) {
        var match = this.matcher.exec(url);
        if(match) {
            var routeInfo = {};
            for(var i = 1; i < match.length; i++) {
                routeInfo[this.namedMap[i - 1]] = match[i];
            }
            return routeInfo;
        }
        else {
            return false;
        }
    }
    else {
        return false;
    }
};

var re_staticFile = /\.[a-zA-Z0-9]+$/;
Router.prototype.maybeStaticFile = function(pathname) {
    return this.fuzzy && re_staticFile.test(pathname);
};
var re_trimEnd = /\?$/;
exports.init = init;
exports.matchAction = function(pathName, method) {
    for(var i = 0; i < _routeTable.length; i++) {
        var router = _routeTable[i];
        var routeInfo = router.match(pathName, method || 'GET');
        if(routeInfo) {
            return {router : router, routeInfo : routeInfo};
        }
    }
    return null;
};
exports._yell=function(){
    console.info(_routeTable);
}