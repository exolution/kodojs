var Fs = require('fs');
var Path = require('path');
var URL = require('url');
var Utils = require('./Utils');
var Promise = require('./Promise');
var Model = {};
var Annotation = require('./Annotation');
var _serviceContext = {};
var projectPath = Path.dirname(require.main.filename);
var re_generator = /^function\s*\*/;
var re_argsResolver = /^function[^(]*\(\s*([^)]*)\s*\)/;
var slice = Array.prototype.slice;
function isGenerator(method) {
    return re_generator.test(method.toString());
}
function _assemblyService(file, modelMap) {
    var serviceModule = require(file);
    var serviceName = Utils.lowerCaseFirst(Path.basename(file, '.js'));
    if(typeof serviceModule === 'function') {
        serviceWrapper = wrapService(serviceModule, null, modelMap);
        serviceWrapper._name_ = serviceName;

    }
    else {
        var serviceWrapper = new Service(serviceName);
        for(var name in serviceModule) {
            if(serviceModule.hasOwnProperty(name)) {
                var api = serviceModule[name];
                if(typeof api === 'function') {
                    serviceWrapper[name] = wrapService(api, serviceWrapper, modelMap);
                }
                else {
                    serviceWrapper[name] = api;
                }
            }
        }
    }
    return serviceWrapper;
}
function init(config) {
    var serviceDir = Path.resolve(projectPath, config.serviceDir || 'service');
    var files = Utils.getAllJsFiles(serviceDir);
    files.forEach(function(file) {
        var service = _assemblyService(file);
        _serviceContext[service._name_] = service;

    });
}

function wrapService(method, base, modelMap) {
    var paramList = re_argsResolver.exec(method.toString())[1].split(',');
    var paramInfo = [];
    for(var i = 0; i < paramList.length; i++) {
        var param = paramList[i].trim();
        if(param[0] === '$') {
            var modelName = Utils.lowerCaseFirst(param.slice(1));
            paramInfo.push({model : (modelMap && modelMap[modelName]) || Model.getModel(modelName), idx : i});
        }
    }
    if(isGenerator(method)) {
        return function() {
            var p = new Promise();
            var args = slice.call(arguments);
            paramInfo.forEach(function(param) {
                args.splice(param.idx, 0, param.model);
            });

            Utils._executeAsyncFunction(method, base, args, p);
            return p;
        }
    }
    else{
        return function(){
            var args = slice.call(arguments);
            paramInfo.forEach(function(param) {
                args.splice(param.idx, 0, param.model);
            });
            return method.apply(base,args);
        }
    }
}
function Service(name) {
    this._name_ = name;
}
exports.init = init;
exports.getService = function(name) {
    return _serviceContext[name];
};
exports._yell=function(){
    console.info(_serviceContext);
};
exports.runTestCase = function(testCase, dataBaseConfig) {
    var promise = new Promise();
    var e = new Error();
    var stack = e.stack.split('\n');
    var callerFilePath = stack[2].match(/\((\/[^\)]+)\)$/)[1].split(':')[0];
    if(require.main.filename != callerFilePath) {
        //console.log('none immediate run,ignore this test case:[' + testCase.name + '] \nat:' + callerFilePath);
        return promise;
    }
    var annotationMap = Annotation(callerFilePath);
    var testCaseAnnotation = annotationMap.extract(testCase.name);
    var loadModel = testCaseAnnotation['loadmodel'];
    if(!loadModel) {
        throw new  Error('Must provide the annotation @LoadModel');
    }
    var splits = loadModel.split('/');
    var files = splits.pop().split(',').map(function(filePath) {
        var path = Path.resolve(splits.join('/'), filePath);
        if(!/\.js/.test(path)) {
            path += '.js';
        }
        return path;
    });
    var connector = testCaseAnnotation['database'] || dataBaseConfig;
    Model.loadModels(files, connector).then(function(modelMap) {
        var service = _assemblyService(callerFilePath, modelMap.models);
        Utils._executeAsyncFunction(testCase, null, [service], promise);
        promise.finally(function() {
            modelMap.db.close();
        });
        promise.catch( function(err) {
            process.nextTick(function(){
                throw err;
            })
            //console.error(err.stack);
        })
    });
    return promise;

};