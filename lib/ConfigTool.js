/**
 * Created by godsong on 15-4-8.
 */
var Fs = require('fs');
var Utils = require('./Utils');
var Path = require('path');





var _configuration = {};
var projectPath = Path.dirname(require.main.filename);
var defaultConfig = {
    actionDir   : 'action',
    serviceDir  : 'service',
    modelDir    : 'model',
    assetsDir   : 'assets',
    staticDir   : 'static_cache',
    configDir   : 'config',
    filterDir   : 'filter',
    viewDir     : 'view',
    projectPath : projectPath
};
//这个Config是为了暴露给用户 使用方便
var Config=function(name,prop){
    name=name.toLowerCase();
    if(prop){
        return _configuration[name]?_configuration[name][prop]:undefined;
    }
    return _configuration[name];
};

exports.loadConfig = function(path) {
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
        Object.defineProperty(Config,name,{
            get:function(){
                return _configuration[name];
            },
            enumerable:true
        })

    });
};

exports.set = function(name, value) {
    _configuration[name] = value;
    if(!Config.hasOwnProperty(name)) {
        Object.defineProperty(Config, name, {
            get        : function() {
                return _configuration[name];
            },
            enumerable : true
        });
    }
};

exports.init=function(config){
    var configDir = config && config.configDir || defaultConfig.configDir;
    var mainConfigName = Path.basename(config && config.mainConfig || 'server', '.js');
    exports.loadConfig(Path.join(projectPath, configDir));
    var mainConfig=Utils.merge(defaultConfig, config, Config[mainConfigName]);
    exports.set('server', mainConfig);
    return mainConfig;
};
//Config.Config
exports.Config=Config;