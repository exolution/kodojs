/**
 * Created by godsong on 15-4-9.
 */
var Staticizer = require('../../lib/Staticizer');
var Router = require('../../lib/Router');
var Url = require('url');
var Http = require('http');
var Utils = require('../../lib/Utils');
var Config = require('../../lib/ConfigTool').Config;
var Action = require('../../lib/Action');
var Promise=require('../../lib/Promise');
var count=0;
var noop=function(){};
//@Path(/servex-manager/test)
exports.test=function*(Request){
    var list=[];
    for(var i=0;i<100;i++){
        //list.push('/hinode/servex-manager/abc/'+i);
        list.push('/Thailand')
    }
    console.time(1);
    var data=yield massRequest('http://localhost',list,10);
    console.timeEnd(1);
    console.log(data);

    return 'ok';
};

//@Path(/servex-manager/abc/*:id)
exports.test2=function(id){
    console.log(count++,'-',id);
    return id;
};

//@Path(/servex-manager/cache/refresh/**:actionName)
exports.updateStatic = function*(actionName, Request) {
    var updateList = yield Staticizer.refresh(actionName, Request.query.uri);
    var host = Config.server.host || 'http://127.0.0.1';
    var removeErr=0;

    updateList=updateList.filter(function(result){
        if(result instanceof Error) {
            console.log('Remove static cache Error:',result);
            removeErr++;
            return false;
        }else if(typeof result==='string'){
            return true;
        }
        return false;
    });

    var errNum=yield massRequest(host,updateList,20);
    return '更新缓存完成:\n更新缓存数:'+updateList.length+'\n删除缓存失败数:'+removeErr+'\n重建缓存失败数:'+errNum;
};
//@Path(/servex-manager/cache/enable/**:actionName)
exports.enableStatic = function(actionName) {
    var action = Action.getAction(actionName);
    if(action) {
        action.meta.cache = true;
        return 'The Action[' + actionName + '] cache has been enabled!';
    }
    return 'Can not find the Action[' + actionName + '],just try full name.';
};
//@Path(/servex-manager/cache/disable/**:actionName)
exports.disableStatic = function(actionName) {
    var action = Action.getAction(actionName);
    if(action) {
        action.meta.cache = false;
        return 'The Action[' + actionName + '] cache has been disabled!';
    }
    return 'Can not find the Action[' + actionName + '],just try full name.';
};


function massRequest(host,list,limit){
    var p=Promise();
    host=host||'http://localhost';
    p.errNum=0;
    update(host,list,0,limit||list.length,p);
    return p;
}
function update(host,list,idx,limit,afterPromise){
    if(idx>=list.length){
        afterPromise.resolve(afterPromise.errNum);
        return;
    }
    var promises=[];
    list.slice(idx,idx+limit).forEach(function(url,i){
        var p=Promise();
        url = Url.parse(host + Utils.FileNameEncoder.decode(url.replace(/.html$/, '')));
        var req=Http.request({
            host   : url.hostname,
            method : 'get',
            path   : url.path,
            port   : url.port
        }, function(res){
            p.resolve(true);
            res.on('data',noop);//必须这样
            p=null;
        });
        req.on('error',function(){
            p.resolve(false);
            p=null;
            afterPromise.errNum++;

        }).end();
        promises.push(p);

    });
    Promise.all(promises).then(function(){
        update(host,list,idx+limit,limit,afterPromise);
    });
    promises=null;

}