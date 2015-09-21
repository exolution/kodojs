var Fs = require('fs');
var re_searcher = /(\/\/@\w+(?:\([^\n\r]*\))?\s*[\r\n]+\s*)(?=(?:.|\s)*?(?:(?:var\s+)?([$a-zA-Z_][\w$.]*)\s*(?:=|:)|function(?:\s+|\s*\*\s*)([$a-zA-Z_][\w$]*)))/g;
var re_ano = /\/\/@(\w+)(?:\(([^\n\r]*)\))?\s*[\r\n]+\s*/g;
var re_findExports = /(?:var\s+)?([$a-zA-Z_][$\w]*)\s*=\s*exports\s*[\n|\r|;]/g;
module.exports = function parse(filePath) {
    var str = Fs.readFileSync(filePath).toString();
    var annotationMap = new AnnotationMap();
    var match, alias;
    while(match = re_findExports.exec(str)) {//find alias of exports
        alias = match[1];
    }
    while(match = re_searcher.exec(str)) {
        var anoMatch, mode;
        var target = ((mode = 2), match[2]) || ((mode = 3), match[3]);
        if(target.indexOf('.') != -1 && alias) {
            target = target.replace(alias, 'exports');
        }
        var annotation = annotationMap[target] || (annotationMap[target] = new Annotation(mode));
        while(anoMatch = re_ano.exec(match[1])) {
            annotation.add(anoMatch[1].toLowerCase(), anoMatch[2]);
        }
    }
    return annotationMap;
};
function AnnotationMap(name){
}

AnnotationMap.prototype.extract=function(name){
    return this[name] ? this[name].extract() : {};
}
function Annotation(mode) {
    this.group = {};
    this.mode = mode;
}
var re_string = /('|")([^\1]+)\1/g, re_deString = /^\s*('|")([^\1]+)\1\s*$/g;
Annotation.prototype.add = function(name, args) {
    var argList = [];
    if(args) {
        args = args.replace(re_string, function(m, a, b) {
            return a + encodeURIComponent(b) + a;
        }).split(',');
        args.forEach(function(arg) {
            argList.push(arg.replace(re_deString, function(m, a, b) {
                return decodeURIComponent(b);
            }));
        });
    }
    this.group[name] = {
        name : name,
        args : argList
    }
};

Annotation.prototype.extract = function() {//抽取所有的annotation 信息组成注解对象的Meta信息
    var meta = {};
    for(var name in this.group) {
        if(this.group.hasOwnProperty(name)) {
            if(AnnotationResolver[name]) {
                var args = this.group[name].args.concat();
                AnnotationResolver[name].apply(meta, args);
            }
            else {
                args = this.group[name].args;
                if(args.length == 0) {
                    meta[name] = true;
                }
                else if(args.length == 1) {
                    meta[name] = args[0];
                }
                else {
                    meta[name] = args;
                }
            }
        }
    }
    return meta;
};
var AnnotationResolver=exports.AnnotationResolver={

};
AnnotationResolver['path'] = function(pathInfo, weight, potent) {
    this.path = pathInfo;
    this.pathWeight = +weight;
    this.potent = potent == 'true';
};
AnnotationResolver['filter'] = function() {
    this.filterList = Array.prototype.slice.call(arguments);
};