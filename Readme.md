Example
=======

    var https = require('https-proxied');

    var options = {
        host: 'encrypted.google.com',
        port: 443,
        path: '/',
        proxy: {
            host: 'my-proxy-server.com',
            port: 3128,
            login: 'proxyuser:proxypass'
        }
    };

    var req = https.get(options, function(res) {
        console.log(res.statusCode);
    });
    req.end();