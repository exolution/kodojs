var Path = require('path');
var Utils = require('./Utils');
var Fs = require('fs');
var Config = require('./Config');
var Annotation = require('./Annotation');
var Promise = require('./Promise');
var _filterContext = {};
function init(config) {
    _filterContext = {};
    var filterDir = Path.resolve(config.projectPath, config.filterDir);
    var files = Utils.getAllJsFiles(filterDir);
    var globalFilters = Utils.getAllJsFiles(Path.resolve(__dirname, './filter'));
    files.forEach(function(file) {
        var filterModule = require(file);
        var annotationMap = Annotation(file);
        var annotation = annotationMap.extract('exports.filter');
        var filterName = Utils.lowerCaseFirst(Path.basename(file, '.js').replace(/Filter$/i, ''));
        if(filterModule.filter) {
            _filterContext[filterName] = new Filter(filterName, filterModule.filter, annotation);
        }
    });
    globalFilters.forEach(function(file) {
        var filterModule = require(file);
        if(!filterModule.filter)return;
        var annotationMap = Annotation(file);
        var annotation = annotationMap.extract('exports.filter');
        var filterName = Utils.lowerCaseFirst(Path.basename(file, '.js').replace(/Filter$/i, ''));
        if(filterModule.filter) {
            _filterContext['$' + filterName] = new Filter(filterName, filterModule.filter, annotation);
        }

    });


}
function Filter(name, handler, annotation) {
    this.name = name;
    this.handler = handler;
    //disable when filter debug and config not debug;
    this.disabled=!Config.server.debug&&annotation.debug||Config.server.debug&&annotation.release;
    this.annotation=annotation;
}
Filter.prototype.run = function(request, response, next, invokeContext) {
    var p = new Promise();
    var instance=new FilterInstance(request,response);
    Utils.executeAsyncGeneratorFunc(this.handler, instance, [request, response, next, invokeContext], p);
    return p;
};
function FilterInstance(request,response){
    this.request=request;
    this.response=response;

}
FilterInstance.prototype.redirect=function(url){
    this.response.writeHead(302, {location : url});
    this.response.end();
};


exports.init = init;
exports.getFilter = function(name) {
    return _filterContext[name];
};
exports._yell=function(){
    console.info(_filterContext);
};
exports.createFilter = function(filterHandler) {
    return new Filter('AnonymousFilter', filterHandler);
};