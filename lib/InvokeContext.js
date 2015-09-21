/**
 * Created by godsong on 15-9-21.
 */

var Utils=require('./Utils');
var ReadyStream=require('./ReadyStream');
//调用链（执行链）的上下文
function InvokeContext(request, response, invokeChain) {
    this.request = request;
    this.response = response;
    this.invokeChain = invokeChain;
    //对整个处理请求过程的数据的封装流 可以看做一个可读写的response
    this.readyStream = new ReadyStream(response);
    //执行链的参数 用于后续action的依赖注入
    this.params = {};

}

//在当前的调用链 加入新的调用过程 （invoker这个单词用的可能不对 因为加入的不是调用者而是被调用者 但个人比较喜欢 就是这么任性）
InvokeContext.prototype.addInvoker = function(invoker) {

    if(Array.isArray(invoker)) {
        if(invoker.length > 0) {
            this.invokeChain.push.apply(this.invokeChain, invoker);
        }
        else {
            console.trace('add an empty invoker');
        }
    }
    else if(invoker) {
        if(typeof invoker.run === 'function') {
            this.invokeChain.push(invoker);
        }
        else {
            console.trace('the added invoker must has a run method:', invoker);
        }
    }
    else {
        console.trace('add an empty invoker');
    }
};
//实例化action action一般作为调用链的末端
InvokeContext.prototype.instantiateAction = function(Action) {
    this.actionInstance = Action.newInstance(this.request, this.response, this.actionInstance);
};
InvokeContext.prototype.addParam = function(key, value) {
    if(arguments.length === 2) {
        this.params[key] = value;
    }
    else if(arguments.length === 1 && typeof key === 'object') {
        Utils.clone(this.params,key);
    }
};
module.exports=InvokeContext;