/**
 * Created by godsong on 15-7-20.
 */
var Fs=require('fs');
var Path=require('path');
function Component(name,kodo){
    this.kodo=kodo;
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


}
Component.prototype.loadFilter=function(path){

};
Component.prototype.loadAction=function(){

};
module.exports=Component;