var PROXY_PORT = 80,
    bouncy = require('bouncy'),
    http = require('http'),
    static = require('node-static'),
    EventEmitter = require('events').EventEmitter,
    pkg = require('./package.json'),
    fs = require('fs');

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

    var server = new static.Server(config.root, {
        cache: 3600,
        serverInfo: pkg.name + '/' + pkg.version,
        gzip: true
    });

    http.createServer(function (req, res) {
        var fragments, dir, host = '';

        if(!req.headers.host) {
            var headers = '';
            for(var key in req.headers) {
                headers += '\t' + key + ': ' + req.headers[key] + ';\n';
            }
            this.emit('error', 'Missing host header for request url: ' + req.url + ' headers:\n' + headers);
        } else {
            host = req.headers.host.replace('www.', '');
        }

        if(typeof config.routes[host] !== 'undefined') {
            dir = config.routes[host];
        } else {
            fragments = host.split('.');
            dir = '';

            for (var i = fragments.length - 2; i >= 0; i--) {
                dir += '/' + fragments[i];
            }
        }

        req.url = dir + req.url;

        req.addListener('end', function () {
            server.serve(req, res, function (err, result) {
                if (err) {
                    this.emit('log', 'Request url: ' + host + req.url + ' - serving static: ' + config.root + dir + req.url);

                    if(err.status === 404) {
                        var errorPage = dir.length ? dir + '/404.html' : '/404.html';
                        try {
                            fs.openSync(config.root + errorPage, 'r');
                            server.serveFile(errorPage, 404, {}, req, res);
                        } catch(e) {
                            res.writeHead(err.status, err.headers);
                            res.end();
                        }
                    } else {
                        res.writeHead(err.status, err.headers);
                        res.end();
                    }
                } else {
                    this.emit('log', 'Request url: ' + host + req.url + ' - serving static: ' + config.root + dir + req.url);
                }
            });
        }).resume();
    }).listen(config.port);
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
