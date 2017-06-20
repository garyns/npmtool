/* eslint-disable no-console, no-process-exit */

'use strict';

var colors = require('colours'); // eslint-disable-line
var path = require('path');
var core = require('./lib/core');

var commandSetNames = process.argv.length > 2 ? process.argv.splice(2) : ['default'];

// set loadConfig()
var config = {
    pattern: '*',

    commands: {

        test: [
            'npm test'
        ],

        link: [
            'npm link',
            'linkDeps'
        ]
    },

    params: { },

    branches: {
        master: { color: 'red' },
        develop: { color: 'yellow' }
    }
};

const CONFIG_FILE = './npmtool.json';

core.loadConfig(CONFIG_FILE, function(err, cfg) {

    if (err) {
        console.log(err.red.bold);
        process.exit(1);
    }

    if (cfg) {
        config = cfg;
    }

    var commandSet = [];

    for (var i in commandSetNames) {
        var name = commandSetNames[i];

        var set = core.resolveCommandSet(config, name);

        if (set) {
            commandSet = commandSet.concat(set);
        } else {
            console.log(('Command set with name \'' + name + '\' not found in ' + CONFIG_FILE + '.\n').red.bold);
            commandSet = []; // zero so that help is shown.
            break;
        }

        // dedupe.
        commandSet = commandSet.filter(function(item, pos, self) {
            return self.indexOf(item) == pos;
        });

    }

    if (commandSet.length === 0) {

        console.log('Usage ' + path.basename(process.argv[1]) + ' [command_set] [command_set]...\n');

        console.log('Available commands sets are:');

        for (var csName in config.commands) {
            console.log('  ' + csName);

        }

        console.log();
        process.exit(1);

    } else {

        core.go(config, commandSet, function(err) {
            process.exit(err ? 1 : 0);
        });

    }
});
