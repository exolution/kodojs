/**
 * Created by godsong on 15-9-21.
 */
//@Path(/test/**:p)
exports.index=function(p,ReadyStream){
    console.log(p);
    ReadyStream.setHeader('A',123);
    ReadyStream.write('123');
    ReadyStream.setHeader('A',1234);
    ReadyStream._writing=true;
    setTimeout(function(){
        ReadyStream.write('1234');
        ReadyStream._writing=false;
        ReadyStream.setHeader('C',12354);
        ReadyStream.doWriting();
    },2000);
    ReadyStream.syncWrite('aaa');

};