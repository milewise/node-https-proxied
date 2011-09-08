var tls = require('tls');
var net = require('net');
var crypto = require('crypto');
var http = require('http');
var inherits = require('util').inherits;

var agents = {};
var parsers = http.parsers;

function Agent(options) {
  http.Agent.call(this, options);
}
inherits(Agent, http.Agent);

Agent.prototype.defaultPort = 443;

Agent.prototype._getConnection = function(host, port, cb) {
  var s;

  cb = cb || function() {};

  if (this.options.proxy) {
    s = clearTextSocket(host, port, this.options, cb);
  }  
  else {
    s = tls.connect(port, host, this.options, cb);        
  }

  return s;
};

var Connection = process.binding('crypto').Connection

function clearTextSocket(host, port, options, cb) {
  var sslcontext = crypto.createCredentials({});
  var pair = tls.createSecurePair(sslcontext, false);
  var cleartext = pair.cleartext;

  // this is a necessary hack
  pair.ssl = null;
  pair._doneFlag = true;

  var socket = encryptedSocket(host, port, options, function() {
    pair.encrypted.pipe(socket);
    socket.pipe(pair.encrypted);
    pair.fd = socket.fd;    
    pair.ssl = new Connection(sslcontext.context, false, false, false);
    pair.ssl.start();
    pair._doneFlag = false;
    pair.cycle();      
    pair.on('secure', function() {
      if (cb) cb();        
    });      
  });

  function onerror(e) {
    if (cleartext._controlReleased) {
      cleartext.emit('error', e);
    }
  }

  function onclose() {
    socket.removeListener('error', onerror);
    socket.removeListener('close', onclose);
    socket.removeListener('timeout', ontimeout);
  }

  function ontimeout() {
    cleartext.emit('timeout');
  }

  socket.on('error', onerror);
  socket.on('close', onclose);
  socket.on('timeout', ontimeout);

  cleartext._controlReleased = true;
  return cleartext;
}

function encryptedSocket(host, port, options, cb) {
  var connectHeaders = {
    'Proxy-Connection': 'keep-alive',
    'Host': host
  };
  var proxy = options.proxy;

  if (proxy.login) {
    connectHeaders['Proxy-Authorization'] = 'Basic ' + new Buffer(proxy.login).toString('base64');
  }

  var response = '';

  var socket = net.createConnection(proxy.port || 3128, proxy.host || '127.0.0.1');
  var parser = parsers.alloc(parser);
  parser.reinitialize('response');
  parser.socket = socket;
  parser.incoming = null;
  
  socket.on('connect', function() {
    var headers = [];
    headers.push('CONNECT '+host+':'+port+' HTTP/1.1')    
    for (var key in connectHeaders) {
      headers.push([key, ': ', connectHeaders[key]].join(''));
    }
    socket.write(headers.join('\n')+'\n\n');      
  });

  socket.ondata = function(data, start, end) {
    var ret = parser.execute(data, start, end - start);
    if (ret instanceof Error) {
      socket.destroy(ret);
    }
  }

  parser.onIncoming = function(res) {
    if (res.statusCode != 200) {
      socket.destroy(new Error('CONNECT did not return status 200'));
    }
    else {
      socket.ondata = null;
      socket.removeAllListeners('close');
      parsers.free(parser);
      if (cb) cb();        
    }
  }

  socket.on('close', function() { 
    parsers.free(parser);
  })

  return socket;
}

function getAgent(options) {
  if (!options.port) options.port = 443;

  var id = options.host + ':' + options.port;
  var agent = agents[id];

  if (!agent) {
    agent = agents[id] = new Agent(options);
  }

  return agent;
}
exports.getAgent = getAgent;
exports.Agent = Agent;

exports.request = function(options, cb) {
  if (options.agent === undefined) {
    options.agent = getAgent(options);
  } else if (options.agent === false) {
    options.agent = new Agent(options);
  }
  return http._requestFromAgent(options, cb);
};


exports.get = function(options, cb) {
  options.method = 'GET';
  var req = exports.request(options, cb);
  req.end();
  return req;
};
