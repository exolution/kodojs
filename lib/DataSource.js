/**
 * Created by godsong on 15-3-6.
 */
var Http = require('http');
var Url = require('url');
var Promise = require('./Promise');
var Utils = require('util');
var Model = require('./Model');


function DataSource() {
}
DataSource.prototype.bindModel = function(model, deepCopy) {
    deepCopy = deepCopy === undefined ? true : deepCopy;
    var modelMeta = Model[model];
    modelMeta.dataSource = this;
    this.promise = this.promise.then(function(data) {
        Model.loadData(model, data, deepCopy);
        modelMeta.done = true;
        modelMeta.callback && modelMeta.callback(model);
        return model;
    })
};
DataSource.prototype.fetchData = function(callback) {
    this.promise.then(callback);
};
var HttpSource = exports.HttpSource = function(url, request, resolver) {
    var urlObj = Url.parse(url);
    var p = new Promise();
    delete request.headers['accept-encoding'];
    this.request = Http.request({
        host    : urlObj.hostname,
        method  : 'get',
        path    : urlObj.path,
        port    : urlObj.port || 80,
        headers : request.headers
    }, function(res) {
        var body = '';
        res.on('data', function(chunk) {
            body += chunk;
        });
        res.on('end', function() {
            if(res.statusCode == 200) {

                try {
                    var result = JSON.parse(body)
                } catch(e) {
                    result = body;
                }
                resolver && (result = resolver(result));
                p.resolve(result);
            }
            else {
                p.reject(res.statusCode);
            }
        });
    });
    this.promise = p;
    this.request.on('error', function(err) {
        var e = new Error('Connect Error for request for ' + url);
        e.name = 'Http Request Error';
        p.reject(e);
    });
    this.request.end();
    return p;
};

Utils.inherits(HttpSource, DataSource);