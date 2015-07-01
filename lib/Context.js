/**
 * Created by godsong on 15-6-9.
 */


var ReadyStream=require('./ReadyStream');
var InvokeContext=module.exports=function InvokeContext(request,response,invokeChain){
    this._request=request;
    this._response=response;
    this.readyStream=new ReadyStream(response);
    this.invokeChain=invokeChain;
};