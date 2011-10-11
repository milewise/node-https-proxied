var vows = require('vows'),
    assert = require('assert'),
    child = require('child_process'),
    https = require('../lib/https-proxied');

var proxy = null;

vows.describe('Proxy HTTPS using CONNECT method')
    .addBatch({
        'when starting the proxy server': {
            topic: function() {
                var self = this;
                proxy = child.spawn('python', ['test/PythonProxy.py']);
                proxy.stdout.on('data', function(data) { self.callback(null, data.toString()) });
                proxy.stderr.on('data', function(data) { self.callback(new Error(data.toString())) });
                proxy.on('exit', function() { self.callback(new Error('Proxy server exited'))});
            },
            'the server should start': function(data) {
                assert.match(data, /Serving on localhost:\d+/);         
                proxy.stdout.removeAllListeners('data')
                proxy.stderr.removeAllListeners('data')
                proxy.removeAllListeners('exit')
            }
        }
    })
    .addBatch({
        'when connecting via the proxy server': {
            topic: function() {
                var self = this;
                var options = {
                    host: 'encrypted.google.com',
                    port: 443,
                    path: '/',
                    proxy: 'http://user:pass@localhost:9817'
                };
                var req = https.get(options, function(res) {
                    self.callback(null, res.statusCode)
                    res.on('error', self.callback);
                });
                req.end();
                req.on('error', this.callback);
            },
            'we get a response back': function(status) {
                assert.equal(status, 200);
            }
        }
    })
    .addBatch({
        'when stopping the proxy server': {
            topic: function() {
                proxy.kill();
                return true;
            },
            'server stops correctly': function(ok) {
                assert.isTrue(ok);
            }
        }
    })
    .export(module);