'use strict'
var config = require('../config');
var WebSocketClient = require('websocket').client;
var Promise = require("bluebird");
var request = require('request');

var connectHandler = function(connection) {
    var self = this;

    connection.on('error', function(error) {
        console.log("Connection Error: " + error.toString());
        self.onError(error);
    });

    connection.on('close', function() {
        console.log('echo-protocol Connection Closed');
        self.onClose();
    });

    connection.on('message', function(message) {
        if (message.type === 'utf8') {
            var responseObject = JSON.parse(message.utf8Data);

            if(responseObject.type !== 'pong') {
                console.log("Received: '" + message.utf8Data + "'");
            }

            self.onMessage(message.utf8Data);
        }
    });

    self.connection = connection;
    self.init();
};

function JMRIService(commandBuilder, state, onMessage, onError, onClose) {
  var self = this;

  self.onMessage = onMessage || function() {};
  self.onError = onError || function() {};
  self.onClose = onClose || function() {};

  self.onMessage.bind(this);
  self.onError.bind(this);
  self.onClose.bind(this);

  self.commandBuilder = commandBuilder;
  self.state = state;
  var server = new WebSocketClient();
  server.on('connect', connectHandler.bind(self));
  server.on('connectFailed', function (error) {
              console.log('Connect Error: ' + error.toString());
            }
            );
  server.connect('ws://' + config.jmriHost + ':' + config.jmriPort + '/json/');
  this.server = server;
}




JMRIService.prototype.send = function (message) {
  var self = this;
  var reqObj = JSON.parse(message);
  if (reqObj.type !== 'ping')
    console.log('Sent: ' + message);

  return new Promise(function (resolve, reject) {
      if (self.connection.connected) {
        self.connection.sendUTF(message);
        resolve();
      }
    }).delay(1000);
};

JMRIService.prototype.init = function () {
  var self = this;

  setInterval(self.beat.bind(self), 1000);

    console.log('Initialization of JMRI interface started');
    console.log('Gathering resources from JMRI JSON Server');
    Object.keys(self.state).forEach(function(key) {
        console.log('Loading [' + key + '] resources ...');
        request('http://' + config.jmriHost + ':' + config.jmriPort + '/json/' + key, function (error, response, body) {
            var response = JSON.parse(body);

            if (Array.isArray(response)) {
                response.forEach(function(element) {
                    self.state[key][element.data.name] = {
                        userName: element.data.userName,
                        state: element.data.state
                    }
                });
            }

            console.log(key + ': Done');
        });
    });

    setTimeout(function() {
        Object.keys(self.state).forEach(function(type) {
            Object.keys(self.state[type]).forEach(function(element) {
                self.send('{"type": "' + type +'", "data":{"name":"' + element + '"}}');
            });
        });
    }, 5000);
};

JMRIService.prototype.beat = function () {
  var self = this;

  self.send(self.commandBuilder.fillTemplate('ping'))
};

JMRIService.prototype.sendCommand = function (command, params) {
    var self = this;

    self.send(self.commandBuilder.fillTemplate(command, params))
};

module.exports = JMRIService;
