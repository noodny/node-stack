var PROXY_PORT = 80,
    pmx = require('pmx').init(),
    bouncy = require('bouncy'),
    http = require('http'),
    ecstatic = require('ecstatic');

var Stack = function(config) {
    config = this.defaults(config);
    this.startStatic(config.static);
    this.startProxy(config.proxy, config.static.port);
};

Stack.prototype = {
    defaults: function(config) {
        return config;
    },
    startStatic: function(config) {
        console.log('Starting up http server, serving ' + config.root + ' on port: ' + config.port);

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
            var fragments, dir, host = req.headers.host.replace('www.', '');

            if(typeof config.routes[host] !== 'undefined') {
                dir = config.routes[host];
            } else {
                fragments = host.split('.');
                dir = "";

                for (var i = fragments.length - 2; i >= 0; i--) {
                    dir += "/" + fragments[i];
                }
            }

            console.log((new Date()).toUTCString() + ": Request from host: " + host + " url: " + req.url + " - serving: " + dir + req.url);

            req.url = dir + req.url;

            return httpListener(req, res);
        }).listen(config.port);
    },
    startProxy: function(config, staticPort) {
        console.log('Starting up proxy server on port: ' + config.port || PROXY_PORT);
        var proxy = bouncy(function(req, res, bounce) {
            var host = req.headers.host,
                port = config.routes[host];

            if(port) {
                console.log((new Date()).toUTCString() + ": Request from host: " + host + " url: " + req.url + " - proxy to port: " + port);
                bounce(port);
            } else {
                console.log((new Date()).toUTCString() + ": Request from host: " + host + " url: " + req.url + " - proxy to static server");
                bounce(staticPort);
            }
        });

        proxy.listen(config.port || PROXY_PORT);
    }
};

module.exports = Stack;
