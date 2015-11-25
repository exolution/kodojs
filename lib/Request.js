/*!
 * Request封装 大部分属性和方法从express的request移植过来
 */

'use strict';


/**
 * Module dependencies.
 * @private
 */
var Class = require('xclass');
var accepts = require('accepts');
var isIP = require('net').isIP;
var typeis = require('type-is');
var http = require('http');
var proxyaddr = require('proxy-addr');
var URL=require('url');
var re_trimEnd = /\?$/;
/**
 * Request prototype.
 */
var HttpRequest=module.exports= Class({
    Extends:http.IncomingMessage,
    constructor : function(request) {
        request.__proto__ = this;
        var url = request.url.replace(re_trimEnd, '');
        var parsedUrl = URL.parse(url, true);
        // dispose the session url rewrite
        var splits = parsedUrl.pathname.split(';');
        parsedUrl.pathname = splits[0];
        parsedUrl.param = splits.slice(1).join('');
        //detect mobile request
        var ua = request.headers['user-agent'];
        if(/nokia|sony|ericsson|mot|samsung|htc|sgh|lg|sharp|sie-|philips|panasonic|alcatel|lenovo|iphone|ipod|blackberry|meizu|android|netfront|symbian|ucweb|windowsce|palm|operamini|operamobi|openwave|nexusone|cldc|midp|wap|mobile/i.test(ua)) {
            request.isMobile = true;
        }
        request.cookie = parseCookie(request.headers['cookie']);
        request.parsedUrl = parsedUrl;
        console.log(request.__proto__)

        defineProperty(request, 'protocol', function protocol() {
            var proto = this.connection.encrypted
                ? 'https'
                : 'http';

            // Note: X-Forwarded-Proto is normally only ever a
            //       single value, but this is to be safe.
            proto = this.header('X-Forwarded-Proto') || proto;
            return proto.split(/\s*,\s*/)[0];
        });

        /**
         * Short-hand for:
         *
         *    req.protocol == 'https'
         *
         * @return {Boolean}
         * @public
         */

        defineProperty(request, 'secure', function secure() {
            return this.protocol === 'https';
        });

        /**
         * Return the remote address from the trusted proxy.
         *
         * The is the remote address on the socket unless
         * "trust proxy" is set.
         *
         * @return {String}
         * @public
         */

        defineProperty(request, 'ip', function ip() {
            return proxyaddr(this, trust);
        });

        /**
         * When "trust proxy" is set, trusted proxy addresses + client.
         *
         * For example if the value were "client, proxy1, proxy2"
         * you would receive the array `["client", "proxy1", "proxy2"]`
         * where "proxy2" is the furthest down-stream and "proxy1" and
         * "proxy2" were trusted.
         *
         * @return {Array}
         * @public
         */

        defineProperty(request, 'ips', function ips() {
            var addrs = proxyaddr.all(this, trust);
            return addrs.slice(1).reverse();
        });
        defineProperty(this, 'xhr', function xhr() {
            var val = this.header('X-Requested-With') || '';
            return val.toLowerCase() === 'xmlhttprequest';
        });

        return request;
    },


    /**
     * Return request header.
     *
     * The `Referrer` header field is special-cased,
     * both `Referrer` and `Referer` are interchangeable.
     *
     * Examples:
     *
     *     req.get('Content-Type');
     *     // => "text/plain"
     *
     *     req.get('content-type');
     *     // => "text/plain"
     *
     *     req.get('Something');
     *     // => undefined
     *
     * Aliased as `req.header()`.
     *
     * @param {String} name
     * @return {String}
     * @public
     */

    header : function header(name) {
        var lc = name.toLowerCase();
        switch(lc) {
            case 'referer':
            case 'referrer':
                return this.headers.referrer
                       || this.headers.referer;
            default:
                return this.headers[lc];
        }
    },

    /**
     * To do: update docs.
     *
     * Check if the given `type(s)` is acceptable, returning
     * the best match when true, otherwise `undefined`, in which
     * case you should respond with 406 "Not Acceptable".
     *
     * The `type` value may be a single MIME type string
     * such as "application/json", an extension name
     * such as "json", a comma-delimited list such as "json, html, text/plain",
     * an argument list such as `"json", "html", "text/plain"`,
     * or an array `["json", "html", "text/plain"]`. When a list
     * or array is given, the _best_ match, if any is returned.
     *
     * Examples:
     *
     *     // Accept: text/html
     *     req.accepts('html');
     *     // => "html"
     *
     *     // Accept: text/*, application/json
     *     req.accepts('html');
     *     // => "html"
     *     req.accepts('text/html');
     *     // => "text/html"
     *     req.accepts('json, text');
     *     // => "json"
     *     req.accepts('application/json');
     *     // => "application/json"
     *
     *     // Accept: text/*, application/json
     *     req.accepts('image/png');
     *     req.accepts('png');
     *     // => undefined
     *
     *     // Accept: text/*;q=.5, application/json
     *     req.accepts(['html', 'json']);
     *     req.accepts('html', 'json');
     *     req.accepts('html, json');
     *     // => "json"
     *
     * @param {String|Array} type(s)
     * @return {String|Array|Boolean}
     * @public
     */

    accepts          : function() {
        var accept = accepts(this);
        return accept.types.apply(accept, arguments);
    },
    /**
     * Check if the given `encoding`s are accepted.
     *
     * @param {String} ...encoding
     * @return {String|Array}
     * @public
     */

    acceptsEncodings : function() {
        var accept = accepts(this);
        return accept.encodings.apply(accept, arguments);
    },

    /**
     * Check if the given `charset`s are acceptable,
     * otherwise you should respond with 406 "Not Acceptable".
     *
     * @param {String} ...charset
     * @return {String|Array}
     * @public
     */

    acceptsCharsets : function() {
        var accept = accepts(this);
        return accept.charsets.apply(accept, arguments);
    },


    /**
     * Check if the given `lang`s are acceptable,
     * otherwise you should respond with 406 "Not Acceptable".
     *
     * @param {String} ...lang
     * @return {String|Array}
     * @public
     */

    acceptsLanguages : function() {
        var accept = accepts(this);
        return accept.languages.apply(accept, arguments);
    },


    /**
     * Parse Range header field,
     * capping to the given `size`.
     *
     * Unspecified ranges such as "0-" require
     * knowledge of your resource length. In
     * the case of a byte range this is of course
     * the total number of bytes. If the Range
     * header field is not given `null` is returned,
     * `-1` when unsatisfiable, `-2` when syntactically invalid.
     *
     * NOTE: remember that ranges are inclusive, so
     * for example "Range: users=0-3" should respond
     * with 4 users when available, not 3.
     *
     * @param {Number} size
     * @return {Array}
     * @public
     */

    range : function(size) {
        var range = this.header('Range');
        if(!range) return;
        return parseRange(size, range);
    },


    /**
     * Check if the incoming request contains the "Content-Type"
     * header field, and it contains the give mime `type`.
     *
     * Examples:
     *
     *      // With Content-Type: text/html; charset=utf-8
     *      req.is('html');
     *      req.is('text/html');
     *      req.is('text/*');
     *      // => true
     *
     *      // When Content-Type is application/json
     *      req.is('json');
     *      req.is('application/json');
     *      req.is('application/*');
     *      // => true
     *
     *      req.is('html');
     *      // => false
     *
     * @param {String|Array} types...
     * @return {String|false|null}
     * @public
     */

    is : function is(types) {
        var arr = types;

        // support flattened arguments
        if(!Array.isArray(types)) {
            arr = new Array(arguments.length);
            for(var i = 0; i < arr.length; i++) {
                arr[i] = arguments[i];
            }
        }

        return typeis(this, arr);
    },


});


function defineProperty(obj, name, getter) {
    obj[name]=getter.call(obj);
    
}

function parseRange(size, str) {
    var valid = true;
    var i = str.indexOf('=');

    if(-1 == i) return -2;

    var arr = str.slice(i + 1).split(',').map(function(range) {
        var range = range.split('-')
            , start = parseInt(range[0], 10)
            , end = parseInt(range[1], 10);

        // -nnn
        if(isNaN(start)) {
            start = size - end;
            end = size - 1;
            // nnn-
        } else if(isNaN(end)) {
            end = size - 1;
        }

        // limit last-byte-pos to current length
        if(end > size - 1) end = size - 1;

        // invalid
        if(isNaN(start)
           || isNaN(end)
           || start > end
           || start < 0) valid = false;

        return {
            start : start,
            end   : end
        };
    });

    arr.type = str.slice(0, i);

    return valid ? arr : -1;
};
function parseCookie(cookieStr) {
    var cookie = {};
    if(cookieStr) {
        cookieStr.split(';').forEach(function(e) {
            var splits = e.split('=');
            cookie[splits[0].trim()] = splits[1];
        });
    }
    return cookie;
}
