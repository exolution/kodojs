/**
 * Created by godsong on 15-5-4.
 */
var Transform = require('stream').Transform;
var Readable = require('stream').Readable;
var Utils = require('./Utils');
var Fs = require('fs');
var Http = require('http');
var EventEmitter = require('events').EventEmitter;
var rawPipe=Readable.prototype.pipe;
var slice=Array.prototype.slice;

// A sync simple readable stream
// Use for default source stream of ReadyStream
function BufferStream(value, encoding, config) {
    Readable.call(this, config);
}
Utils.inherits(BufferStream, Readable);
BufferStream.prototype._read = function(n) {
};
//A transform stream as avatar of HttpServerResponse
//A extended pipe() you can pipe to a function as stream resolver(wrap by a Transform Stream)
//Piped stream while linked in readystream
function ReadyStream(response, config) {
    if(!(this instanceof ReadyStream)) {
        return new ReadyStream();
    }

    //it's a transform stream
    Transform.call(this);
    this._transform = function(chunk, encoding, next) {
        this.push(chunk);
        next();
    };
    //stream link
    // because readystream need to tranfered between filters
    // so piped always linked to itself
    this.currentStream = this;

    //save the HttpServerResponse
    this._response = response;
    //just pipe to response once
    this._responsed = false;
    //hack for response's "finished" property
    this.finished = false;
    Object.defineProperties(this, {
        'statusCode' : {
            enumerable : true,
            set        : function(v) {
                response.statusCode = v;
            },
            get        : function() {
                return response.statusCode;
            }
        },
        '_headers'   : {
            enumerable : true,
            set        : function(v) {
                response._headers = v;
            },
            get        : function() {
                return response._headers;
            }
        }
    })
}
Utils.inherits(ReadyStream, Transform);


ReadyStream.prototype.response = function() {
    this.pipe(this._response);
};
ReadyStream.prototype.join=function(files){
    if(!(files instanceof Array)) {
        files=slice.call(arguments);
    }
    sequence(files,this);

};
//扩展的pipe
//可以把流pipe到一个函数里 这个函数左右流的加工函数（实际上这个函数会被封装成transform stream）
//buffered变量为true时 会buffer所有的流数据 一次性调用这个加工函数
// 否则 可能会调用多次（流本身就不是一次性写完的）
ReadyStream.prototype.pipe = function(dest, buffered) {
    if(typeof dest === 'function') {
        var transform = new Transform();
        transform._transform = dest;
        if(buffered) {
            var bufferList = [], encoding;
            transform._transform = function(chunk, encoding, next) {
                bufferList.push(chunk);
                next();
            }
            transform._flush = function(done) {
                dest.call(transform, Buffer.concat(bufferList), encoding, done);
                bufferList = null;
            }
        }
        else {
            transform._transform = dest;
        }
        rawPipe.call(this.currentStream,transform);
        this.currentStream = transform;
    }
    else {
        if(dest instanceof Http.ServerResponse) {

            if(!this._responsed) {
                rawPipe.call(this.currentStream,dest);
                this._responsed = true;
            }
            else {
                return this;
            }
        }
        else {
            rawPipe.call(this.currentStream,dest);
        }
        if(dest.readable) {
            this.currentStream = dest;
        }

    }
    return this;
};
ReadyStream.prototype.writeHead = function(code, reason, headers) {
    this._response.writeHead(code, reason, headers);
};
ReadyStream.prototype.setHeader = function(name, value) {
    this._response.setHeader(name, value);
};
ReadyStream.prototype.getHeader = function(name) {
    return this._response.getHeader(name);
};
ReadyStream.prototype.removeHeader=function(field){
    this._response.removeHeader(field);
};
module.exports = ReadyStream;

/*var rs = new ReadyStream(process.stdout);
var s1 = fs.createReadStream('./1.txt', {highWaterMark : 4});
var s2=fs.createReadStream('./2.txt');
rs.bindSource(s1);
rs.bindSource(s2);
rs.pipe(function(chunk, encoding, done) {
    console.log(111,chunk.toString());
    this.push('before ');
    this.push(chunk);
    this.push(' after')
    done();
}, true)
var out=fs.createWriteStream('out.txt');
rs.pipe(out);
rs.response();
out.on('finish',function(){
    console.log('finish')
})
rs.source.on('finish',function(){
    console.log('rs finish');
})
rs.source.on('end',function(){
    console.log('rs end');
})*/
function sequence(files,dest){
    var file=files.shift();
    var stream=Fs.createReadStream(file);
    if(files.length>0){
        stream.pipe(dest,{end:false});
        stream.on('end',function(){
            sequence(files,dest);
        })
    }
    else{
        stream.pipe(dest);
    }
}
/*
var input=Fs.readFileSync('in.txt');
var rs=new ReadyStream();
rs.pipe(Fs.createWriteStream('out.txt'));
rs.write(input);*/
