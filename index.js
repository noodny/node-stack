var PROXY_PORT = 80,
    bouncy = require('bouncy'),
    http = require('http'),
    ecstatic = require('ecstatic'),
    EventEmitter = require('events').EventEmitter;

var Stack = function(config) {
    config = this.defaults(config);
    this.startStatic(config.static);
    this.startProxy(config.proxy, config.static.port);
};

Stack.prototype = Object.create(EventEmitter.prototype);

Stack.prototype.defaults = function(config) {
    return config;
};

Stack.prototype.startStatic = function(config) {
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
            req.headers.forEach(function(value, key) {
                headers += '\t' + key + ': ' + value + ';\n';
            });
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

        this.emit('log', 'Request url: ' + host + req.url + ' - serving: ' + config.root + dir + req.url);

        req.url = dir + req.url;

        return httpListener(req, res);
    }.bind(this)).listen(config.port);
};

Stack.prototype.startProxy = function(config, staticPort) {
    this.emit('log', 'Starting up proxy server on port: ' + config.port || PROXY_PORT);

    var proxy = bouncy(function(req, res, bounce) {
        var host = req.headers.host,
            port = config.routes[host];

        if(port) {
            this.emit('log', 'Request url: ' + host + req.url + ' - proxy to port: ' + port);
            bounce(port);
        } else {
            this.emit('log', 'Request url: ' + host + req.url + ' - proxy to static server');
            bounce(staticPort);
        }
    }.bind(this));

    proxy.listen(config.port || PROXY_PORT);
};

module.exports = Stack;
