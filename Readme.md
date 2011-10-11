Example
=======

    var https = require('https-proxied');

    var options = {
        host: 'encrypted.google.com',
        port: 443,
        path: '/',
        proxy: 'http://user:pass@my-proxy-server.com:3128'
    };

    var req = https.get(options, function(res) {
        console.log(res.statusCode);
    });
    req.end();