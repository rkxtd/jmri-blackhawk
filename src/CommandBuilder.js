'use strict'

var commands = require('./commands');

function CommandBuilder() {}


CommandBuilder.prototype.fillTemplate = function (command, data){
  data = data || {};
  if (command[command.length-1] === 's') {
      command = command.slice(0, -1);
  }
  return  commands[command].replace(/%\w+%/g, function(tag) {
    if (data[tag.toLowerCase().replace(/%/g,'')]) {
        return data[tag.toLowerCase().replace(/%/g,'')].toString() || tag;
    }
  });
};

module.exports = CommandBuilder;
