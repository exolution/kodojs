/**
 * Created by godsong on 15-9-22.
 */
exports.string=function(){
    return 'abc';
};
exports.object=function(){
    return {
        key:'123'
    }
};
exports.render=function(){
    this.render('view');
};