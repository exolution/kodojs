var Path = require('path');
var Utils = require('./Utils');
var Fs = require('fs');
var Config = require('./Config');
var Orm = {};
var Service = require('./Service');
var Annotation = require('./Annotation');
var Promise = require('./Promise');
var _modelContext = {};
var projectPath = Path.dirname(require.main.filename);
var slice = Array.prototype.slice;


function init(config) {
    _modelContext = {};
    var modelDir = Path.resolve(projectPath, config.modelDir);
    var files = Utils.getAllJsFiles(modelDir);
    files.forEach(function(file) {
        var annotationMap = Annotation(file);
        var model = _assemblyModel(file, annotationMap);

        _modelContext[model.name] = model;
    });
    if(files.length > 0) {
        return connect();
    }
    else {
        var p = new Promise();
        p.resolve();
        return p;
    }
}
function loadModels(files, connector) {
    var promise = new Promise();
    var models = {};
    Orm.connect(connector, function(err, db) {
        if(err) {
            throw err;
        }
        files.forEach(function(file) {
            var annotationMap = Annotation(file);
            var model = _assemblyModel(file, annotationMap);
            model._model = db.define(model.tableName, model.modelDescriptor);
            model.db = db;
            models[model.name] = model;
        });
        promise.resolve({models : models, db : db});
    });
    return promise;
}

function Model(name, tableName) {
    this.name = name;
    this.tableName = tableName;
    this.meta = {};
}
Model.prototype.get = function(id) {
    var promise = new Promise();
    this._model.get(id, function(err, result) {
        if(err) {
            promise.reject(err);
        }
        else {
            promise.resolve(result);
        }
    });
    return promise;
}
Model.prototype.save = function(model) {
    var promise = new Promise();
    var Model = this._model;
    Model.create(model, function(err, items) {
        if(err) {
            return promise.reject(err);
        }
        var promises = [];
        if(!(items instanceof Array)) {
            items = [items];
        }
        items.forEach(function(m) {
            var p = new Promise();
            m.save(function(err) {
                console.log(arguments)
                debug(m);
                if(err) {
                    return p.reject(err);
                }
                p.resolve(m);
            });
            promises.push(p);
        });
        Promise.all(promises).join(promise);
    });
    return promise;
}
Model.prototype.execQuery = function(sql) {
    var promise = new Promise();

    this.db.driver.execQuery(sql, function(err, data) {
        if(err) {
            throw err;
        }
        promise.resolve(data);
    })
    return promise;
}
Model.prototype.find = function(condition, limits) {
    var promise = new Promise();
    var args=slice.call(arguments);
    args.push(function(err, results) {
        if(err) {
            promise.reject(err);
        }
        else {
            promise.resolve(results);
        }
        promise = null;

    });
    this._model.find.apply(this._model,args);
    return promise;
};
function wrapper(fn) {
    return function() {
        var promise = new Promise();
        var args = slice.call(arguments);
        var thisModel = this;
        Utils._executeAsyncFunction(fn, thisModel, args, promise);
        return promise;
    }
}

exports.init = init;
exports.loadModels = loadModels;
var _db;
var connect = exports.connect = function(connector) {
    var p = new Promise();
    connector = connector || Config.get('database');
    if(!connector) {
        p.resolve();
        return p;
    }
    Orm.connect(connector, function(err, db) {
        if(err) {
            throw err;
        }
        for(var k in _modelContext) {
            if(_modelContext.hasOwnProperty(k)) {
                var model = _modelContext[k];
                model._model = db.define(model.tableName, model.modelDescriptor);
                model.db = db;
            }
        }

        p.resolve();
        _db = db;
    });
    return p;
};
function ModelInstance() {

}
exports.getModel = function(name) {
    return _modelContext[Utils.lowerCaseFirst(name)];
};
exports.runTestCase = function(testCase, dataBaseConfig) {
    var promise = new Promise();
    var e = new Error();
    var stack = e.stack.split('\n');
    var callerFilePath = stack[2].match(/\((\/[^\)]+)\)$/)[1].split(':')[0];
    if(require.main.filename != callerFilePath) {
        //console.log('none immediate run,ignore this test case:['+testCase.name+'] \nat:'+callerFilePath);
        return promise;
    }
    var annotationMap = Annotation(callerFilePath);
    var testCaseAnnotation = annotationMap.extract(testCase.name);
    var connector = testCaseAnnotation['database'] || dataBaseConfig;

    Orm.connect(connector, function(err, db) {
        if(err) {
            throw err;
        }
        var model = _assemblyModel(callerFilePath, annotationMap);
        model._model = db.define(model.tableName, model.modelDescriptor);
        model.db=db;
        promise.finally(function() {
            console.info('release');
            db.close();
        });
        Utils._executeAsyncFunction(testCase, db, [model], promise);
    });

    return promise.catch(function(e){
        process.nextTick(function(){
            throw e;
        })
    });

};


function _assemblyModel(fileName, annotationMap) {
    var modelMeta = require(fileName);
    var modelAnnotation = annotationMap.extract('module.exports');
    var modelName = Utils.lowerCaseFirst(Path.basename(fileName, '.js'));
    var tableName = modelAnnotation['tablename'] || modelName;
    var model = new Model(modelName, tableName);
    var modelDescriptor = {};
    for(var prop in modelMeta) {
        if(modelMeta.hasOwnProperty(prop)) {
            var meta = modelMeta[prop];
            if(typeof meta === 'function') {
                model[prop] = wrapper(meta, model, prop);
            }
            else if(typeof meta === 'string') {
                var propertyAnnotation = annotationMap.extract(prop);
                modelDescriptor[prop] = _resolveProperty(meta, propertyAnnotation, modelName);
            }
        }
    }
    model.modelDescriptor = modelDescriptor;
    return model;
}
function _resolveProperty(propertyInfo, annotation, modelName) {
    var match = propertyInfo.match(/^(text|integer|number|boolean|date|datetime|object|binary)(?:\((\d+)\))?$/)
    var meta;
    if(match) {
        if(match[1] === 'datetime') {
            meta = {
                type : 'date',
                time : true
            }

        } else {
            meta = {
                type : match[1]
            }
        }
        if(match[2]) {
            if(match[1] === 'text') {
                meta.size = match[2];
            }
            else if(match[1] === 'number') {
                if(/2|4|8/.test(match[2])) {
                    meta.size = match[2];
                }
                else {
                    meta.size = 4;
                }
            }
            else if(match[1] === 'number') {
                if(/4|8/.test(match[2])) {
                    meta.size = match[2];
                }
                else {
                    console.warn('Unsupport size for ' + match[1] + ' auto change to 4');
                    meta.size = 4;
                }
            }
            else if(match[1] === 'integer') {
                if(/2|4|8/.test(match[2])) {
                    meta.size = match[2];
                }
                else {
                    console.warn('Unsupport size for ' + match[1] + ' auto change to 4');
                    meta.size = 4;
                }
            }
        }

    }
    else {
        throw new Error('Unsupport type[' + propertyInfo + '] of Model:' + modelName);
    }
    if(annotation['pk']) {
        meta.key = true;
    }
    return meta;
}
exports.execQuery = function(sql, connector) {
    var promise = new Promise();
    if(_db) {
        _db.driver.execQuery(sql, function(err, data) {
            if(err) {
                debug(sql)
                throw err;
            }
            promise.resolve(data);
        })
        return promise;
    }
    Orm.connect(connector, function(err, db) {
        if(err) {
            throw err;
        }

        db.driver.execQuery(sql, function(err, data) {
            if(err) {
                throw err;
            }
            promise.resolve(data);
        })
    });
    return promise;

}
function convertDataType(type) {
    var m = /([a-zA-Z]+)(\(\d+\))?/.exec(type);
    switch(m[1]) {
        case 'varchar':
            return "'text" + (m[2] || '') + "'";
        case 'int':
            return "'integer'";
        case 'date':
            return "'date'";
        case 'datetime':
        case 'timestamp':
            return "'datetime'";
    }
}
exports.generateModels = function(tableNames, connector) {
    var map = tableNames.map(function(e) {
        return e.split('=>');
    })
    Orm.connect(connector, function(err, db) {
        var promises = [];
        map.forEach(function(e) {
            promises.push(createModel(e[0], e[1], db,connector));
        })
        Promise.all(promises).then(function() {
            db.close();
        })
    })
}
function createModel(tableName, filename, db,connector) {
    var promise = new Promise();
    var code = '//@TableName(' + tableName + ')\nmodule.exports={\n';
    db.driver.execQuery('describe ' + tableName + ';', function(err, data) {
        if(err) {
            throw err;
        }
        data.forEach(function(field, i) {
            if(i != 0) {
                code += ',\n';
            }
            if(field.Key == 'PRI') {
                code += '    //@PK\n'
            }

            code += '    ' + field.Field + " : " + convertDataType(field.Type);

        })
        code += '\n};';
        code+='\n\n\
/*=======test case========*/\n\
function *testCase(model){\n\
\n\
}\n\
require(\'servex\').Model.runTestCase(testCase,'+JSON.stringify(connector,null,4)+
');';
    Fs.writeFileSync('./' + filename + '.js', code);
        promise.resolve(true);
    })
    return promise;
}

exports._yell = function() {
    console.info(_modelContext);
}