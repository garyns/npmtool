/**
 * NPMTOOL cli entrypoint
 *
 * This file bootstraps npmtool in terms of checking command line
 * parameters, config file and displaying help.
 *
 * Tested Node Version 4 - 8.
 *
 * eslint-disable no-console, no-process-exit
 */

'use strict';

var colors = require('colours'); // eslint-disable-line
var path = require('path');
var pad = require('pad');
var core = require('./lib/core');

// Names of command set from config file to run.
var commandSetNames = process.argv.length > 2 ? process.argv.splice(2) : ['default'];

// Expected config file name. See README.md for a sample.
var CONFIG_FILE = './npmtool.json';


// Load configuration.
core.loadConfig(CONFIG_FILE, function(err, cfg) {

    if (err) {
        console.log(err.red.bold);
        process.exit(1);
    }

    if (cfg) {
        config = cfg;
    }

    // Command sets that will be ran.
    var commandSet = [];

    // For each command set check that is exists in config or show error.
    for (var i in commandSetNames) {

        var name = commandSetNames[i];

        var set = core.resolveCommandSet(config, name);

        if (set) {

            commandSet = commandSet.concat(set);

        } else {

            // Found a non-existing command set name.
            console.log(('Command set with name \'' + name + '\' not found in ' + CONFIG_FILE + '.\n').red.bold);
            commandSet = []; // zero so that help is shown.
            break;

        }

        // Dedupe command sets.
        commandSet = commandSet.filter(function(item, pos, self) {
            return self.indexOf(item) == pos;
        });

    }

    // No command sets specified. Show help, available commmand sets and exit.
    if (commandSet.length === 0) {

        var pkgMeta = require('./package.json');

        // Print user help message
        console.log(path.basename(process.argv[1]) + ' ' + pkgMeta.version + '\n');
        console.log('Usage ' + path.basename(process.argv[1]) + ' [command_set] [command_set]...\n');
        console.log('Available commands sets are:');

        // Print avaliable command sets that are in the config file.
        for (var csName in config.commands) {

            var description = config.commands[csName].description ? ' - ' + config.commands[csName].description : '';

            console.log('  ' + pad(csName, 15).bold + description);

        }

        console.log(); // new line.
        process.exit(1);

    } else {

        // We have valid command sets, proceed and run the commands.

        core.go(config, commandSet, function(err) {
            process.exit(err ? 1 : 0);
        });

    }

}); // loadConfig()
