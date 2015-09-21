/**
 * Created by godsong on 15-4-8.
 */
var Fs = require('fs');
var Utils = require('./Utils');
var Path = require('path');

var _configuration = {};
var _slice = Array.prototype.slice;
var _projectPath=Path.dirname(require.main.filename);
var defaultConfig = {
    actionDir   : 'action',
    serviceDir  : 'service',
    modelDir    : 'model',
    assetsDir   : 'assets',
    staticDir   : 'static_cache',
    configDir   : 'config',
    filterDir   : 'filter',
    viewDir     : 'view',
    projectPath:_projectPath
};


var Config=module.exports = function(name, prop) {
    var path = [];
    for(var i = 0; i < arguments.length; i++) {
        path = path.concat(arguments[i].split('.'));
    }
    return _seekPath(_configuration, path);

};



Config.loadConfig = function(path) {
    if(/\.js$/.test(path)) {
        var fileList = [path];
    }
    else {
        fileList = Utils.getAllFiles(path, 'js|json')
    }
    fileList.forEach(function(fileName) {
        try {
            var file = Fs.readFileSync(fileName);
        } catch(e) {
            return;
        }
        var name = Path.basename(fileName, Path.extname(fileName)).toLowerCase();
        _configuration[name] = eval('(' + file.toString().replace(/^[^{]*|;*\s*$/g, '') + ')');
        /*Object.defineProperty(Config, name, {
            get        : function() {
                return _configuration[name];
            },
            enumerable : true
        })*/

    });
};

Config.set = function(name, value) {
    _configuration[name] = value;
    /*if(!Config.hasOwnProperty(name)) {
        Object.defineProperty(Config, name, {
            get        : function() {
                return _configuration[name];
            },
            enumerable : true
        });
    }*/
};

Config.init = function(config) {
    var configDir = config && config.configDir || defaultConfig.configDir;
    var mainConfigName = Path.basename(config && config.mainConfig || 'server', '.js');
    Config.loadConfig(Path.join(_projectPath, configDir));
    var mainConfig = Utils.merge(defaultConfig, config, Config(mainConfigName));
    Config.set('server', mainConfig);
    return mainConfig;
};

function _seekPath(target, path) {
    var cur = target;
    for(var i = 0; i < path.length && cur != undefined; i++) {
        var prop=i==0?path[i].toLowerCase():path[i];
        cur = cur[prop];
    }
    return cur;
}