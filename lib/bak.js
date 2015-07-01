var Path = require('path');
var Utils=require('./Utils');
var Fs=require('fs');
var Config=require('./Config');
var Orm = require('orm');
var View = require('./View');
var Service=require('./Service');
var Annotation=require('./Annotation');
var Promise=require('./Promise');
var _modelContext={};
var _projectPath=Path.dirname(require.main.filename);
var _slice=Array.prototype.slice;
var _db={};
function init(config){
    _modelContext={};
    var modelDir = Path.resolve(_projectPath, config.modelDir||'model');
    var files = Utils.getAllFiles(modelDir);
    files.forEach(function(file){
        var modelMeta=require(file);
        var annotationMap=Annotation(file);
        var annotation=annotationMap['module.exports'].extract();
        var modelName=Path.basename(file,'.js');
        var tableName=annotation['tablename']||modelName;
        var model=new Model(modelName,tableName);
        _modelContext[modelName]=model;
        for(var prop in modelMeta){
            if(modelMeta.hasOwnProperty(prop)){
                var meta=modelMeta[prop];
                if(typeof meta==='function'){
                    model[prop]=wrapper(meta,model,prop);
                }
                else if(typeof meta==='string'){
                    var match=meta.match(/^(text|integer|number|boolean|date|datetime|object|binary)(?:\((\d+)\))?$/)
                    if(match){
                        if(match[1]==='datetime'){
                            model.meta[prop]={
                                type:'date',
                                time:true
                            }

                        }else{
                            model.meta[prop]={
                                type:match[1]
                            }
                        }
                        if(match[2]){
                            if(match[1]==='text'){
                                model.meta[prop].size=match[2];
                            }
                            else if(match[1]==='number'){
                                if(/2|4|8/.test(match[2])){
                                    model.meta[prop].size=match[2];
                                }
                                else{
                                    model.meta[prop].size=4;
                                }
                            }
                            else if(match[1]==='number'){
                                if(/4|8/.test(match[2])){
                                    model.meta[prop].size=match[2];
                                }
                                else{
                                    console.warn('Unsupport size for '+match[1]+' auto change to 4');
                                    model.meta[prop].size=4;
                                }
                            }
                            else if(match[1]==='integer'){
                                if(/2|4|8/.test(match[2])){
                                    model.meta[prop].size=match[2];
                                }
                                else{
                                    console.warn('Unsupport size for '+match[1]+' auto change to 4');
                                    model.meta[prop].size=4;
                                }
                            }
                        }

                    }
                    else{
                        throw new Error('Unsupport type['+meta+'] of Model:'+modelName);
                    }
                }
                var anno=annotationMap[prop]?annotationMap[prop].extract():{};
                if(anno['pk']){
                    model.meta[prop].key=true;
                }

            }
        }

    })
}

function Model(name,tableName){
    this.name=name;
    this.tableName=tableName;
    this.meta={};
}
Model.prototype.find=function(condition,limits){
    var promise=new Promise();
    this._model.find(condition,function(err,results){
        if(err){
            promise.reject(err);
        }
        else{
            promise.resolve(results);
        }
        promise=null;

    });
    return promise;
};
var list=[];
function wrapper(fn){
    return function(){
        var promise=new Promise();
        var args=_slice.call(arguments);
        var modelInstance=this;
        if(!modelInstance._db) {
            promise.finally(function(){

                var db=modelInstance._db;
                promise=null;
                delete modelInstance._model;
                delete modelInstance._db;
                modelInstance=null;
                db.close();
                list.splice(list.indexOf(db),1);
                //最终promise完成时 释放db

            });
            Orm.connect(Config.get('database'), function(err, db) {
                if(err) {
                    promise.reject(err);
                }
                else {
                    modelInstance._db=db;
                    modelInstance._model=db.define(modelInstance.tableName, modelInstance.meta);
                    Utils.executeAsyncGeneratorFunc(fn,modelInstance,args,promise);
                }
                promise=null;
            })
        }
        else{
            Utils.executeAsyncGeneratorFunc(fn,modelInstance,args,promise);
        }
        return promise;

    }
}

exports.init=init;
function ModelInstance(){

}
exports.getModel=function(name){
    var modelInstance=new ModelInstance();
    modelInstance.__proto__=_modelContext[name];
    return modelInstance;
};