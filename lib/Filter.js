var Path = require('path');
var Utils = require('./Utils');
var Fs = require('fs');
var Config = require('./Config');
var Annotation = require('./Annotation');
var Promise = require('./Promise');
var _filterContext = {};
var _filterPhase = {
    beforeDispatch : [],
    doDispatch     : null,
    afterDispatch  : [],
    beforeOutput   : [],
    doOutput       : null,
    afterOutput    : []
};
function init(config) {
    _filterContext = {};
    var filterDir = Path.resolve(config.projectPath, config.filterDir);
    exports.load(filterDir);


}
function Filter(name, handler, annotation) {
    this.name = name;
    this.handler = handler;
    //disable when filter debug and config not debug;
    this.disabled = !Config('server.debug') && annotation.debug || Config('server.debug') && annotation.release;
    this.annotation = annotation;
}
Filter.prototype.run = function(request, response, next, invokeContext) {
    var p = new Promise();
    var instance = new FilterInstance(request, response);
    Utils._executeAsyncFunction(this.handler, instance, [request, response, next, invokeContext], p);
    return p;
};
function FilterInstance(request, response) {
    this.request = request;
    this.response = response;

}
FilterInstance.prototype.redirect = function(url) {
    this.response.writeHead(302, {location : url});
    this.response.end();
};
var phaseDetector = /^(before|after|do)(.)/;
function camelCase(str) {
    return str.replace(phaseDetector, function(m, a, b) {
        return a + b.toUpperCase();
    })
}
exports.load = function(filterDir) {
    var files = Utils.getAllJsFiles(filterDir);
    files.forEach(function(file) {
        var filterModule = require(file);
        var annotationMap = Annotation(file);
        var annotation = annotationMap.extract('exports.filter');
        var filterName = annotation.name || Utils.lowerCaseFirst(Path.basename(file, '.js').replace(/Filter$/i, ''));
        if(filterModule.filter) {
            var filter = new Filter(filterName, filterModule.filter, annotation);
            for(var key in annotation) {
                if(annotation.hasOwnProperty(key) && phaseDetector.test(key)) {
                    var k = camelCase(key);
                    if(Array.isArray(_filterPhase[k])) {
                        _filterPhase[k].push(filter);

                    }
                    else {
                        _filterPhase[k] = filter;
                    }
                    return;
                }
            }
            _filterContext[filterName] = filter;
        }
    });

};
exports.buildFilterChain = function() {
    var filterChain = [];
    filterChain = filterChain.concat(_filterPhase.beforeDispatch);
    if(_filterPhase.doDispatch) {
        filterChain.push(_filterPhase.doDispatch);
    }
    filterChain = filterChain.concat(_filterPhase.afterDispatch);
    filterChain = filterChain.concat(_filterPhase.beforeOutput);
    if(_filterPhase.doOutput) {
        filterChain.push(_filterPhase.doOutput);
    }
    filterChain = filterChain.concat(_filterPhase.afterOutput);
    return filterChain;

};
exports.init = init;
exports.getFilter = exports.get = function(name) {
    return _filterContext[name];
};
exports._yell = function() {
    console.info(_filterContext);
};
exports.createFilter = function(filterHandler) {
    return new Filter('AnonymousFilter', filterHandler);
};