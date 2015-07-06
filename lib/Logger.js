/**
 * Created by godsong on 15-7-1.
 */
var slice = Array.prototype.slice;
var re_isSQL = /^\s*SELECT .+?FROM/i;
var Config=require('./ConfigTool').Config;
global.debug = function debug() {
    var len=arguments.length;
    if(typeof arguments[len-1] ==='boolean'){
        var showPos=arguments[arguments.length-1];
        len=-1;
    }
    if(!Config.server || Config.server.log||Config.server.debug) {
        var args = slice.call(arguments,0,len).map(function(e) {
            if(Utils.typeOf(e) == 'object') {
                return Utils.clone({}, e);
            }
            else if(Utils.typeOf(e) == 'array') {
                return e.map(function(item) {
                    if(Utils.typeOf(item) == 'object') {
                        return Utils.clone({}, item);
                    }
                    else{
                        return item;
                    }
                });
            }
            else if(typeof e === 'string' && re_isSQL.test(e)) {
                return Utils.formatSql(e);
            }
            else {
                return e;
            }
        });

        console.log.apply(console, args);
        if(showPos) {
            var stack = new Error().stack.split('\n')[2];
            var m = stack.match(/\(.+\)/);
            console.log('--' + m[0].replace(projectPath, ''))
        }
    }
};
global.debug.trace = function() {
    if(!Config.server || Config.server.debug) {
        var args = slice.call(arguments);
        console.trace.apply(console, args);
    }
};