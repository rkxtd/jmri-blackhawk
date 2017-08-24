var mqtt = require('mqtt');
var config = require('./config');
var client  = mqtt.connect(config.mqttUrl);
var CommandBuilder = require('./src/CommandBuilder');
var JMRIService = require('./src/JMRIService');
var commandBuilder = new CommandBuilder();

var database = {
    devices: {},
    boards: {}
};

var state = {
    blocks: {},
    cars: {},
    layoutBlocks: {},
    locations: {},
    reporters: {},
    routes: {},
    signalHeads: {},
    signalMasts: {},
    lights: {},
    sensors: {},
    trains: {},
    turnouts: {}
};
if (process.env.JMRI_ENABLED) {
    var jmri = new JMRIService(commandBuilder, state, function(message) {
        var responseObject = JSON.parse(message);

        if (responseObject.type === 'turnout') {
            sendDeviceCommand(responseObject.data.name, responseObject.data.state === 2 ? 'open' : 'close')
        }
    });
}


setInterval(updateBoardsStatus, 10000);
setInterval(ping, 5000);

client.on('message', function (topic, message) {
    var time = new Date();
    var chunks = topic.toString().split('/');

    switch(Array.isArray(chunks) ? chunks[0] : topic.toString()) {
        case 'boards':
            processBoardsMessages(message, time);
            break;
        case 'sensors':
            processSensorsMessages(message, time, Array.isArray(chunks) ? chunks[1] : null);
            break;
        case 'trains':
            processTrainsMessages(message, time);
            break;
        default:
            console.log('[' + time + '] UNDEFINED TOPIC: [' + topic.toString() + '] ' + message.toString());
            break;
    }

});

client.on('connect', function () {
    client.subscribe('boards');
    client.subscribe('sensors');
    client.subscribe('trains');
    client.publish('boards', 'REGISTER');
});

function ping() {
    client.publish('boards', 'PING');
}

function processBoardsMessages(message, time) {
    var command = message.toString().split('::');

    if (Array.isArray(command) && command.length >= 2) {
        switch(command[0]) {
            case 'REGISTER':
                registerBoard(command, time);
                break;
            case 'PONG':
                pongBoard(command, time);
                break;
        }
    }
}

function processTrainsMessages(message, time) {
    var command = message.toString().split('::');
    var train = parseInt(command[0], 10);
    var forward = command[1] === 'FWD';
    var speed = parseInt(command[2], 10) / 100;

    jmri.sendCommand('throttle', {
        'throttle': train,
        'forward': forward,
        'speed': speed
    })
}

function processSensorsMessages(message, time, board) {
    var command = message.toString().split('::');

    if (Array.isArray(command) && command.length === 2) {
        if (!database.boards[board].devices[command[0]]) {
            database.boards[board].devices[command[0]] = prepareDeviceObject(command[0]);
        }

        database.boards[board].devices[command[0]].status = command[1];
        database.boards[board].devices[command[0]].received = time;
    }
    console.log('MESSAGE: ', message.toString());
}

function updateBoardsStatus() {
    var timestamp = new Date().getTime();

    Object.keys(database.boards).forEach(function(board) {
        if(timestamp - database.boards[board].lastResponse.getTime() > config.boardTTL) {
            database.boards[board].status = 'offline';
        }
    });

    printBoardsStatus();
}

function printBoardsStatus() {
    var timestamp = new Date().getTime();
    printLine();
    console.log('| Board\t\t| Status\t| Last Pong\t\t| Diff\t| Restart\t| Devices\t|');
    printLine();
    Object.keys(database.boards).forEach(function(board) {
        var diff = Math.floor((timestamp - database.boards[board].lastResponse.getTime()) / 1000);
        diff = diff < 10 ? diff.toString() + '\t' : diff;
        console.log('| ' + board + '\t| '
            + database.boards[board].status + '\t| '
            + database.boards[board].lastResponse.getTime() + '\t| '
            + diff + '\t| '
            + database.boards[board].reconnectCount + '\t\t\t| '
            + Object.keys(database.boards[board].devices).length + '\t\t\t|');
        printDevicesStatus(board);
    });
    printLine();

}

function printLine() {
    console.log('+' + Array(72).join("-") + '+');
}
function printDevicesStatus(board) {
    console.log(database.boards[board].devices);
}

function registerBoard(command, time) {
    var devicesToRegister = command.splice(2) || [];
    var backupedDevices = {};

    if(!database.boards[command[1]]) {
        database.boards[command[1]] = {};
        database.boards[command[1]].registered = 0;
        database.boards[command[1]].reconnectCount = -1;
        client.subscribe('sensors/' + command[1]);
        console.log('Added new board: [' + command[1] + ']. Subscribed for topic: ', 'sensors/' + command[1]);
    } else {
        backupedDevices = database.boards[command[1]].devices;
    }
    var board = database.boards[command[1]];
    board.devices = {};
    board.status = 'online';
    board.lastResponse = time;
    board.reconnectCount++;

    devicesToRegister.forEach(function(device) {
        board.devices[device] = backupedDevices[device] || prepareDeviceObject(device);
        client.publish('sensors/' + command[1], device + '::' + board.devices[device].status);
    });
}

function sendDeviceCommand(device, command) {
    Object.keys(database.boards).forEach(function(board) {
        if (database.boards[board].devices[device]) {
            client.publish('sensors/' + board, device + '::' + command);
        }
    });
}

function pongBoard(command, time) {
    if(database.boards[command[1]]) {
        database.boards[command[1]].status = 'online';
        database.boards[command[1]].lastResponse = time;
    } else {
        console.error('NO Board registered: ', command[1]);
    }
}

/**
 * T - Routes <open | close>
 * S - Semaphores <g | y | r | yb | yyb | w>
 * C - Readers <TBD>
 */
function prepareDeviceObject(device) {
    var prefix = device.substr(0, 2);

    var response = {
        status: null,
        received: null
    };

    if (device[0] === 'I' || prefix === 'IT') {
        response.status = 'open';
    }

    if (device[0] === 'S' || prefix === 'IS') {
        response.status = 'active';
    }

    return response;
}