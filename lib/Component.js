/**
 * Created by godsong on 15-7-20.
 */

'use strict';


var Fs=require('fs');
var Path=require('path');
var Filter=require('./Filter');
function Component(kodo){
    this.kodo=kodo;
    /*this.kodo=kodo;
    this.name=name;
    var path;
    for(var i=0;i<require.main.paths.length;i++){
        var p=Path.join(require.main.paths[i],name);
        if(Fs.existsSync(p)){
            path=p;
            break;
        }
    }
    if(path){
        console.log(path);
    }
    else {
        throw new Error('Can not fon')
    }
*/

}
Component.prototype.loadFilters=function(path){
    Filter.load(path);
};
Component.prototype.loadAction=function(){

};
Component.prototype.loadComponent=function(setup){
    setup.call(this);
    this.kodo.buildFilterChain();
};
module.exports=Component;