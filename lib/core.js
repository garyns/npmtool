/**
 * NPMTOOL core
 *
 * This file is responsible for identifying node modules running commands against
 * them and reporting the results back to the console.
 */
 /* eslint-disable no-console, no-process-exit */

'use strict';

var spawn = require('child_process').spawn;
var fs = require('fs');
var path = require('path');
var glob = require('glob');
var colors = require('colours'); // eslint-disable-line
var async = require('async');
var ProgressBar = require('progress');
var root = process.cwd();


// Icons for console status reporting.
var EXPMARK = '\u26A0'.yellow; // http://www.fileformat.info/info/unicode/char/26a0/index.htm
var TICK = '\u2714'.green; // https://en.wikipedia.org/wiki/Check_mark
var CROSS = '\u2716'.red; // https://en.wikipedia.org/wiki/X_mark

var debugLog = false; // For development - show console debuggig information.
var pattern = '*'; // Default glob. Config may update.
var config = {}; // Passed in from cli.js.


/**
 * Main entry point - find modules and run command(s) on them.
 * @param {Object}   cfg        JSON Configuration.
 * @param {Array}   commandSet  Array of commands to run.
 * @param {Function} cb         cb(err)
 */
exports.go = function(cfg, commandSet, cb) {

    if (arguments.length === 2) {
        cb = commandSet;
    }

    config = cfg;

    // Commands run sequentially.
    async.waterfall([

        function(done) {

            //
            // Identify NPM modules for which commands will be ran against.
            //

            getPackages(function(err, packages) {
                done(err, packages);
            });

        },

        function(packages, done) {

            //
            // Run commands on npm modules.
            //

            runCommands(packages, commandSet, function(err, packages) {
                done(err, packages);
            });
        }

    ], function(err, packages) {

        //
        // Complete.
        //

        if (packages) {

            //
            // Print output summary to console.
            //

            packages.forEach(function(p) {
                dumpPackageSummary(p);
            });
        }


        var inError = packagesInError(packages);
        var inWarning = packagesInWarning(packages);

        if (err || inWarning || inError) {

            console.log(); // New line

            if (inWarning) {
                console.log('Completed with warnings.'.yellow.bold);
            }

            if (inError) {
                console.log('Completed with errors.'.red.bold);
            }

            console.log();  // New line

            cb(err);
            return;

        } else {

            console.log('\nCompleted successfully.\n'.green);
            cb(null);
            return;

        }

    });

}; // go()


/**
 * Given a command set name, get the individual commands that make up the set.
 * @param {Object} config JSON Config.
 * @param {String} name   Command set name.
 * @return {Array} Individual commands or null if name not resolvable in config.
 */
exports.resolveCommandSet = function(config, name) {

    var commandSet = getConfig(config, 'commands', name);

    return commandSet ? commandSet.run : null;
};


/**
 * Load npmtool configuration from file.
 * @param {String}   file config file name.
 * @param {Function} cb   cb(err, configJSON)
 */
exports.loadConfig = function(file, cb) {

    var fileNorm = path.normalize(root + '/' + file);

    try {

        var cfg = require(fileNorm);

        debug('Config file ' + file + ' loaded.');

        cb(null, cfg);
        return;

    } catch (err) {

        if (err.code === 'MODULE_NOT_FOUND') {

            console.log(('\nNo ' + file + ' found. You\'ll need a ' + file + ' to fine-tune npmtool.\n').red.bold);
            cb('Config file not found ' + fileNorm, null);
            return;

        } else {

            cb(err.message, null);
            return;

        }
    }

}; // loadConfig()


/**
 * Run commands on modules. Each object in the packages array will have it's
 * properties updated with command results.
 * @param {Array}   packages    array of package meta data for identified modules.
 * @param {String}   commandSet Command set name. It's commands will be ran on modules.
 * @param {Function} cb         cb(err, packages with results added)
 * @return {[type]}   [description]
 */
function runCommands(packages, commandSet, cb) {

    if (commandSet) {

        var callArray = [];

        // For each command, set up a function() to be queued and ran via async.series()
        commandSet.forEach(function(command) {

            var name = command;

            var parts = command.split(' ');
            var cmd = parts.shift();
            var args = parts;

            // Ignore any command prefixed with a #.
            if (cmd.indexOf('#') !== 0) {

                var f = function(done) {

                    // Run all commands on packages.
                    runAll(packages, name, cmd, args, function(err) {
                        done(err);
                    });

                }; // f()

                // Add funcion to queue.
                callArray.push(f);
            }
        });

        // Run commands on packaes in series.
        async.series(callArray,
          function(err) {
              cb(err, packages);
          });

    } else {

        // Nothing to do. Just return packages unchanged.
        cb(null, packages);
        return;

    }


} // runCommands()


/**
 * Identify target npm modules/packages that we will run commands against.
 * @param {Function} cb cb(err, packages)
 */
function getPackages(cb) {

    async.waterfall([

        function(done) {

            //
            // Find folders matching pattern.
            //

            if (config.pattern) {
                pattern = config.pattern;
            }

            // Get modules folder candidates based on config pattern.
            glob(pattern, {}, function (err, folders) {
                done(err, folders);
            });

        },

        function(folders, done) {

            //
            // Filter folders with a package.json file.
            //

            var packageFiles = [];

            for (var f in folders) {

                var file = path.normalize(folders[f] + '/package.json');

                file = root + '/' + file;

                var hasPackageJson = fileExists(file);

                if (hasPackageJson) {
                    packageFiles.push(file);
                }
            }

            console.log('Found ' + packageFiles.length + ' modules matching ' + pattern);
            done(null, packageFiles);
        },

        function(packageFiles, done) {

            //
            // Read package.json data.
            //

            var packages = [];
            var inError = false;
            var c = 0;

            packageFiles.forEach(function(file) {

                readPackage(file, function(err, p) {

                    if (err) {
                        inError = true;
                    }

                    if (p) {
                        // Add annotated package object to array.
                        // When we intreact with modules we'll pull
                        // and store data to this object.
                        packages.push(p);
                    }

                    if (++c === packageFiles.length) {
                        // Callback when all modules processed.
                        done(inError ? true : null, packages);
                        return;
                    }
                });

            });

        },

        function(packages, done) {

            //
            // For each package, work out the git branch (if it's a git repo)
            //

            var c = 0;

            packages.forEach(function(p) {

                getGitBranch(p, function(branch) {

                    p.branch = branch;

                    if (++c === packages.length) {
                        done(null, packages);
                        return;
                    }

                });
            });
        },

        function(packages, done) {

            //
            // Resolve local dependencies (inc devDependencies)
            //

            debug('Resolving local dependencies for ' + packages.length + ' Node modules.');
            resolveLocalDependencies(packages);
            done(null, packages);

        }

    ], function (err, packages) {

        //
        // We now have an array of package objects.
        //

        cb(err, packages);
    });

} // getPackages()


/**
 * Post running commands, were any errors reported?
 * @param {Array} packages packages.
 * @return {Boolean} true if one or more packages have command errors.
 */
function packagesInError(packages) {

    for (var i in packages) {
        var p = packages[i];

        if (p.errors.length > 0) {
            return true;
        }

    }

    return false;

} // packagesInError()

/**
 * Print the package information and command results
 * the the console. This is the FINAL report to the user of npmtool.
 * @param {Object} p our package object
 */
function packagesInWarning(packages) {

    for (var i in packages) {
        var p = packages[i];

        if (p.warnings.length > 0) {
            return true;
        }

    }

    return false;

} // packagesInWarning()


/**
 * Print package command results to console. For a package, this is the
 * final 'report' shown to the user.
 * @param {Object} p package object.
 */
function dumpPackageSummary(p) {

    // Package name (originaly from it's package.json)
    var s = p.name;

    // Package version (originaly from it's package.json)
    if (p.version) {
        s += '@' + p.version;
    }

    // Git branch (if git repo)
    if (p.branch) {
        s += '#' + coloriseBranch(p.branch);
    }

    // Print which physical folder is package in.
    s += (' (' + p.relFolder + ')').grey;

    console.log(); // new line
    console.log(s);

    //
    // Report command excution results for package.
    //

    p.messages.forEach(function(m) {
        console.log('  ' + TICK + ' ' + m.grey);
    });

    p.warnings.forEach(function(m) {
        console.log('  ' + EXPMARK + ' ' + m.yellow.bold);
    });

    p.errors.forEach(function(e) {
        console.log('  ' + CROSS + ' ' + e.red.bold);
    });

} // dumpPackageSummary()


/**
 * Get a value from the configuration given a property path,
 * Eg: getConfig(config, "branches", "master", "color") to return the value at
 * "branches.master.color"
 * @param {Object} obj Configuration object.
 * @param {Array} arguements (implied)
 * @return {Varient} value for object.
 */
function getConfig(obj /*, arguements*/) {

    for (var i = 1; i < arguments.length; i++) {

        if (!obj.hasOwnProperty(arguments[i])) {
            return null;
        }

        obj = obj[arguments[i]];
    }
    return obj;
}


/**
 * Run a command against all packages (and show progress bar on console).
 * @param {Array}   packages package objects.
 * @param {String}  name     friendly command name
 * @param {String}  cmd      command to run
 * @param {Varient}  args    command arguements (string, array, function:array)
 * @param {Function} cb      cb() on completing.
 */
function runAll(packages, name, cmd, args, cb) {

    // Progress bar for console progress reporting.
    var bar = new ProgressBar(':bar :percent ' + name, { total: packages.length });

    //bar.tick();
    var callArray = [];

    packages.forEach(function(p) {

        // Function for queue and run via async.series().
        var f = function(finished) {

            // Skip command run if package is to be ignored.
            if (p.ignore) {
                bar.tick();
                finished(null, packages);
                return;
            }

            //
            // Process args.
            // Resolve 'args' into array. Args could be a string,
            // Array or a function that returns an array.
            //
            var args2 = [];

            if (typeof args === 'string') {

                args2.push(args);

            } else if (typeof args === 'function') {

                args2 = args(p);

                if (args2 === null) {
                    bar.tick();
                    finished(null, packages);
                    return;
                }

            } else if (Array.isArray(args)) {

                args2 = args;

            }

            //
            // Process cmd to be run.
            // 'cmd' might be a global shell command, an internal npmtool command (from cmd folder)
            // or an external execuitable file (.js, .sh, etc).
            //
            var cmd2 = cmd;
            var fn = runShell; // shell command (default)

            if (isNpmToolScript(cmd2)) {

                // An internal npmtool command (from cmd folder)
                // Eg: linkdeps, get-status, ...
                fn = runNpmToolScript;

            } else if (isLocalScript(root + '/' + cmd2)) {

                // A custom/local javascript command (.js) that implements
                // the expected run() command.
                cmd2 = root + '/' + cmd2;
                fn = runLocalScript;

            } else if (fileExists(root + '/' + cmd2)) {

                // External execuitable shell command or script.
                // Will be ran by spawning a process.
                cmd2 = root + '/' + cmd2;

            }

            //
            // Run command. (Dynamic function as variable)
            //
            fn(p, cmd2, args2, function(err, summary) {

                if (typeof err === 'string') {

                    // If error, add to package's error array for later reporting.

                    var msg = path.basename(cmd2) + ' ' + args2.join(' ') + ' (' + err + ')';

                    p.errors.push(msg.replace('  ', ' '));

                } else {

                    var msg2 = path.basename(cmd2) + ' ' + args2.join(' ');

                    if (summary) {

                        if (typeof summary !== 'string') {
                            summary = JSON.stringify(summary);
                        }

                        msg2 += ' (' + summary + ')';
                    }

                    msg2 = msg2.replace('  ', ' ');

                    if (err && typeof err === 'number') {

                        switch (err) {
                            case 0: // Success
                                p.messages.push(msg2);
                                break;

                            case 1: // Warning
                                p.warnings.push(msg2);
                                break;

                            default: // 2+
                                p.errors.push(msg2);
                                break;

                        }

                    } else {
                        // Success
                        p.messages.push(msg2.replace('  ', ' '));
                    }
                }

                bar.tick(); // Increment progress bar.

                finished(null, packages);
                return;
            });

        }; //f

        callArray.push(f);
    });

    //
    // Run all commands in series.
    //
    async.series(
        callArray,
        function() {
            cb();
        });

} // runAll()


/**
 * Check if command is an internal command (ie a js file in the cmd folder.)
 * @param {String} cmd command name
 * @return {Boolean} true if cmd is an internal command.
 */
function isNpmToolScript(cmd) {

    try {
        require('../cmd/' + cmd.toLowerCase());
        return true;
    } catch (err) {
        return false;
    }

}


/**
 * Check if command is a .js file that implements our run() command.
 * @param {String} cmd command name
 * @return {Boolean} true if cmd is a javascript command with .run()
 */
function isLocalScript(cmd) {

    try {
        var s = require(cmd);

        return s.run ? true : false;
    } catch (err) {
        return false;
    }

}


/**
 * Run internal npmtool command.
 * @param {Object} pkg package object.
 * @param {String} script script in cmd folder to call .run() on.
 * @param {String} args command arguments.
 * @param {Function} cb cb(err, pkg)
 */
function runNpmToolScript(pkg, script, args, cb) {
    var params = getConfig(config, 'params', path.basename(script)) || {};

    script = '../cmd/' + script.toLowerCase();

    runScript(pkg, script, params, args, cb);
}

/**
 * Run local npmtool script that has a .run() method.
 * @param {Object} pkg package object.
 * @param {String} script script in cmd folder to call .run() on.
 * @param {String} args command arguments.
 * @param {Function} cb cb(err, pkg)
 */
function runLocalScript(pkg, script, args, cb) {

    //script = root + '/' + script;
    var params = getConfig(config, 'params', path.basename(script)) || {};

    runScript(pkg, script, params, args, cb);
}

/**
 * Run javascript command.
 * @param {Object} pkg package object.
 * @param {String} script script in cmd folder to call .run() on.
 * @param {String} args command arguments.
 * @param {Function} cb cb(err, pkg)
 */
function runScript(pkg, script, params, args, cb) {

    var s = require(script);

    if (!s.run) {

        cb('No .run() found in script');
        return;

    } else {

        s.run(pkg, args, runShell, params, cb);
        return;

    }
}

/**
 * Run shell command.
 * @param {Object} pkg package object.
 * @param {String} cmd shell command or script.
 * @param {String} args command arguments.
 * @param {Function} cb cb(err, pkg)
 */
function runShell(pkg, cmd, args, cb) {

    if (!args) {
        args = [];
    } else if (!Array.isArray(args)) {
        args = [args];
    }

    var folder = pkg.folder;

    // Switch to module folder to run command.
    process.chdir(folder);

    var cbCalled = false; // To prevent double callback based on command outcome.
    var cmdpcs = spawn(cmd, args);

    var output = '';

    cmdpcs.stdout.on('data', function(data) {
        output += 'OUT ' + data + '\n';
        debug(data);
    });

    cmdpcs.stderr.on('data', function(data) {
        output += 'ERR ' + data + '\n';
        debug(data);
    });

    cmdpcs.on('close', function(code) {
        var err = (code === 0 ? null : 'exit code ' + code);

        if (!cbCalled) {
            cb(err, null);
            return;
        }
    });

    cmdpcs.on('error', function(err) {

        cbCalled = true;

        if (err.code === 'ENOENT') {
            cb('command not found ' + cmd, output);
            return;
        } else {
            cb(err.message, output);
            return;

        }
    });

}

/**
 * For reporting coloruse the name of a GIT branch based on
 * configuration.
 * @param {String} branch name of GIT branch.
 * @return {String} branch name with colorizing escape codes added.
 */
function coloriseBranch(branch) {

    var color = getConfig(config, 'branches', branch, 'color');

    if (!color) {
        return branch.grey;
    }

    var stmt = 'branch.' + color + '.bold';

    return eval(stmt);

}

/**
 * Helper function to check if a file exists.
 * @param {String} f file
 * @return {Boolean} true if file exists, else false.
 */
function fileExists(f) {

    try {

        fs.statSync(f);

        return true;

    } catch (err) {

        return false;

    }

}


/**
 * Read npm module's package.json, parse and create our internal package
 * object model.
 * @param {String}   file a package.json file path.
 * @param {Function} cb   cb(err, package);
 */
function readPackage(file, cb) {

    // Npmtool's internal package model that gets passed around to functions.
    var p = {
        file: file,     // package.json path
        version: null,  // verson from package.json
        folder: path.dirname(file), // folder of package.json
        relFolder: './' + path.basename(path.dirname(file)), // package.json folder relative to npmtool.conf
        name: path.basename(path.dirname(file)), // proxy name until package.json read.
        branch: null, // GIT branch if GIT repo.
        deps: [], // Module Dependencies
        localDeps: [],  // Module Dev Dependencies
        messages: [],   // Successful command run messages.
        errors: [],     // Errored command run messages.
        warnings: []    // Warning command run messages.
    };

    var pkg = null;

    try {

        //
        // Load package.json and fill out our package model.
        //

        pkg = require(file);

        //p.messages.push('package.json parsable');
        p.name = pkg.name;
        p.version = pkg.version || null;
        p.ignore = pkg.npmtool === undefined ? false : !pkg.npmtool; // Absence of nodemon -> false (don't ignore)

        if (p.ignore) {
            p.warnings.push('Skipping. package.json has a falsy npmtool property');
        }

    } catch (err) {

        p.errors.push('package.json (' + err.message + ')');
        cb(err, p);
        return;

    }

    //
    // Combine an dedupe all module dependencies for easy reference.
    //

    var prjDeps = pkg.dependencies ? Object.keys(pkg.dependencies) : [];
    var devDeps = pkg.devDependencies ? Object.keys(pkg.devDependencies) : [];
    var allDeps = prjDeps.concat(devDeps);

    p.deps = allDeps.filter(function(item, pos, self) {
        return self.indexOf(item) == pos;
    });

    cb(null, p);
}


/**
 * Resolve the GIT branch name for a module.
 * @param {String}   pkg package object.
 * @param {Function} cb   cb(err, branch name or null)
 */
function getGitBranch(pkg, cb) {

    try {
        fs.statSync(pkg.folder + '/.git');

        debug('Checking for ' + pkg.folder + '/.git: Found');

        var simpleGit = require('simple-git')( pkg.folder );

        simpleGit.branch(function(err, branchSummary) {
            cb(branchSummary.current);
        });

    } catch (e) {

        // Not a git repo.
        debug('Checking for ' + pkg.folder + '/.git: Not Found');

        cb(null);
        return;

    }
}


/**
 * Transverse all modules and resolve their intra-package dependencies.
 * We can use this later via the internal command 'linkdeps' to create
 * npm links between our modules.
 * @param {Array} packages packages.
 */
function resolveLocalDependencies(packages) {

    packages.forEach(function(p1) {

        packages.forEach(function(p2) {

            if (p2.deps.indexOf(p1.name) !== -1) {
                // p2 depends on p1.
                p2.localDeps.push(p1.name);
            }

        });
    });

}


/**
 * Debug output (when developing and flag debugLog is truthy)
 * @param {String} s debug log this string.
 */
function debug(s) {
    if (debugLog) {
        console.log('[DEBUG] ' + s);
    }
}
