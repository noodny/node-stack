var PROXY_PORT = 80,
    bouncy = require('bouncy'),
    http = require('http'),
    ecstatic = require('ecstatic'),
    EventEmitter = require('events').EventEmitter;

var Stack = function(config) {
    this.config = this.defaults(config);
};

Stack.prototype = Object.create(EventEmitter.prototype);

Stack.prototype.defaults = function(config) {
    return config;
};

Stack.prototype.initialize = function() {
    this.startStatic();
    this.startProxy();
};

Stack.prototype.startStatic = function() {
    var config = this.config.static;

    this.emit('log', 'Starting up http server, serving ' + config.root + ' on port: ' + config.port);

    var httpListener = ecstatic({
        root: config.root,
        baseDir: '/',
        cache: 31536000,
        showDir: false,
        autoIndex: true,
        humanReadable: true,
        si: false,
        defaultExt: 'html',
        gzip: true,
        handleError: true
    });

    http.createServer(function(req, res) {
        if(!req.headers.host) {
            var headers = '';
            for(var key in req.headers) {
                headers += '\t' + key + ': ' + req.headers[key] + ';\n';
            }
            this.emit('error', 'Missing host header for request url: ' + req.url + ' headers:\n' + headers);
        }

        var fragments, dir, host = req.headers.host.replace('www.', '');

        if(typeof config.routes[host] !== 'undefined') {
            dir = config.routes[host];
        } else {
            fragments = host.split('.');
            dir = '';

            for (var i = fragments.length - 2; i >= 0; i--) {
                dir += '/' + fragments[i];
            }
        }

        this.emit('log', 'Request url: ' + host + req.url + ' - serving static: ' + config.root + dir + req.url);

        req.url = dir + req.url;

        return httpListener(req, res);
    }.bind(this)).listen(config.port);
};

Stack.prototype.startProxy = function() {
    var config = this.config.proxy,
        staticPort = this.config.static.port;

    this.emit('log', 'Starting up proxy server on port: ' + config.port || PROXY_PORT);

    var proxy = bouncy(function(req, res, bounce) {
        var host = req.headers.host,
            port = config.routes[host];

        if(port) {
            this.emit('log', 'Request url: ' + host + req.url + ' - proxy to port: ' + port);
            bounce(port);
        } else {
            bounce(staticPort);
        }
    }.bind(this));

    proxy.listen(config.port || PROXY_PORT);
};

module.exports = Stack;
