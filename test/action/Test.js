/**
 * Created by godsong on 15-9-21.
 */
//@Path(/test/**:p)
exports.index=function(p,ReadyStream){
    console.log(p);
    ReadyStream.write('123');
    ReadyStream.end();
}