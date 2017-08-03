/* eslint-disable no-console, no-process-exit */

'use strict';

var spawn = require('child_process').spawn;
var fs = require('fs');
var path = require('path');
var glob = require('glob');
var colors = require('colours'); // eslint-disable-line
var async = require('async');
var ProgressBar = require('progress');
var pattern = '*';
var root = process.cwd();
var config = {};
var debugLog = false;
var TICK = '\u2714'.green; // https://en.wikipedia.org/wiki/Check_mark
var CROSS = '\u2716'.red.bold; // https://en.wikipedia.org/wiki/X_mark

exports.go = function(cfg, commandSet, cb) {

    if (arguments.length === 2) {
        cb = commandSet;
    }

    config = cfg;

    async.waterfall([

        function(done) {

            getPackages(function(err, packages) {
                done(err, packages);
            });

        },

        function(packages, done) {
            runCommands(packages, commandSet, function(err, packages) {
                done(err, packages);
            });
        }

    ], function(err, packages) {

        //
        // Complete.
        //

        if (packages) {
            packages.forEach(function(p) {
                dumpPackageSummary(p);
            });
        }

        if (err || packagesInError(packages)) {
            console.log('\nCompleted with errors.\n'.red.bold);
            cb(err);
            return;

        } else {
            console.log('\nCompleted successfully.\n'.green);
            cb(null);
            return;
        }

    });

};


exports.resolveCommandSet = function(config, name) {

    var commandSet = getConfig(config, 'commands', name);

    return commandSet ? commandSet.run : null;
};


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


function runCommands(packages, commandSet, cb) {

    if (commandSet) {

        var callArray = [];

        commandSet.forEach(function(command) {

            var name = command;

            var parts = command.split(' ');
            var cmd = parts.shift();
            var args = parts;

            if (cmd.indexOf('#') !== 0) {

                var f = function(done) {

                    runAll(packages, name, cmd, args, function(err) {
                        done(err);
                    });

                }; // f()

                callArray.push(f);
            }
        });

        async.series(callArray,
          function(err) {
              cb(err, packages);
          });

    } else {
        cb(null, packages);
        return;
    }


} // runCommands()


function getPackages(cb) {

    async.waterfall([

        function(done) {

            //
            // Find folders matching pattern.
            //

            if (config.pattern) {
                pattern = config.pattern;
            }

            glob(pattern, {}, function (err, folders) {
                //console.log('Found ' + files.length + ' module candicates matching ' + ptn);

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
                        packages.push(p);
                    }

                    if (++c === packageFiles.length) {
                        done(inError ? true : null, packages);
                        return;
                    }
                });

            });

        },

        function(packages, done) {

            var c = 0;

            packages.forEach(function(p) {

                getGitBranch(p.folder, function(currentBranch) {

                    p.branch = currentBranch;

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


function isDefaultConfigFile(file) {
    return file.indexOf('npmtool.json') !== -1;
}


function packagesInError(packages) {

    for (var i in packages) {
        var p = packages[i];

        if (p.errors.length > 0) {
            return true;
        }

    }

    return false;

} // packagesInError()


function dumpPackageSummary(p) {

    var s = p.name;

    if (p.version) {
        s += '@' + p.version;
    }

    if (p.branch) {
        s += '#' + coloriseBranch(p.branch);
    }

    s += (' (' + p.relFolder + ')').grey;

    console.log();
    console.log(s);

    p.messages.forEach(function(m) {
        console.log('  ' + TICK + ' ' + m.grey);
    });

    p.errors.forEach(function(e) {
        console.log('  ' + CROSS + ' ' + e.red.bold);
    });

} // dumpPackageSummary()



function getConfig(obj) {

    for (var i = 1; i < arguments.length; i++) {

        if (!obj.hasOwnProperty(arguments[i])) {
            return null;
        }

        obj = obj[arguments[i]];
    }
    return obj;
}


function runAll(packages, name, cmd, args, cb) {

    var bar = new ProgressBar(':bar :percent ' + name, { total: packages.length + 1 });

    bar.tick();
    var callArray = [];

    packages.forEach(function(p) {

        var f = function(finished) {

            if (p.ignore) {
                finished(null, packages);
                return;
            }

            var args2 = [];

            if (typeof args === 'string') {

                args2.push(args);

            } else if (typeof args === 'function') {

                args2 = args(p);

                if (args2 === null) {
                    finished(null, packages);
                    return;
                }

            } else if (Array.isArray(args)) {

                args2 = args;

            }

            var cmd2 = cmd;
            var fn = runShell; // shell command

            if (isNpmToolScript(cmd2)) {

                fn = runNpmToolScript;

            } else if (isLocalScript(root + '/' + cmd2)) {

                cmd2 = root + '/' + cmd2;
                fn = runLocalScript;

            } else if (fileExists(root + '/' + cmd2)) {

                cmd2 = root + '/' + cmd2;

            }

            fn(p, cmd2, args2, function(err, summary) {

                if (err) {

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

                    p.messages.push(msg2.replace('  ', ' '));
                }

                bar.tick();

                finished(null, packages);
                return;
            });

        }; //f

        callArray.push(f);
    });

    async.series(
        callArray,
        function() {
            cb();
        });

} // runAll()


function isNpmToolScript(cmd) {

    try {
        require('../cmd/' + cmd.toLowerCase());
        return true;
    } catch (err) {
        return false;
    }

}


function isLocalScript(cmd) {

    try {
        var s = require(cmd);

        return s.run ? true : false;
    } catch (err) {
        return false;
    }

}


function runNpmToolScript(pkg, script, args, cb) {
    var params = getConfig(config, 'params', path.basename(script)) || {};

    script = '../cmd/' + script.toLowerCase();

    runScript(pkg, script, params, args, cb);
}


function runLocalScript(pkg, script, args, cb) {

    //script = root + '/' + script;
    var params = getConfig(config, 'params', path.basename(script)) || {};

    runScript(pkg, script, params, args, cb);
}


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


function runShell(pkg, cmd, args, cb) {

    if (!args) {
        args = [];
    } else if (!Array.isArray(args)) {
        args = [args];
    }

    var folder = pkg.folder;

    process.chdir(folder);

    var cbCalled = false;
    var ls = spawn(cmd, args);

    var output = '';

    ls.stdout.on('data', function(data) {
        output += 'OUT ' + data + '\n';
        debug(data);
    });

    ls.stderr.on('data', function(data) {
        output += 'ERR ' + data + '\n';
        debug(data);
    });

    ls.on('close', function(code) {
        var err = (code === 0 ? null : 'exit code ' + code);

        if (!cbCalled) {
            cb(err, null);
            return;
        }
    });

    ls.on('error', function(err) {

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


function coloriseBranch(branch) {

    var color = getConfig(config, 'branches', branch, 'color');

    if (!color) {
        return branch.grey;
    }

    var stmt = 'branch.' + color + '.bold';

    return eval(stmt);

}

function fileExists(f) {

    try {

        fs.statSync(f);

        return true;

    } catch (err) {

        return false;

    }

}


function readPackage(file, cb) {

    var p = {
        file: file,
        version: null,
        folder: path.dirname(file),
        relFolder: './' + path.basename(path.dirname(file)),
        name: path.basename(path.dirname(file)), // proxy name until package.json read.
        branch: null,
        deps: [],
        localDeps: [], // see calDependencies()
        messages: [],
        errors: []
    };

    var pkg = null;

    try {

        pkg = require(file);
        p.messages.push('package.json parsable');
        p.version = pkg.version || null;
        p.ignore = pkg.npmtool === undefined ? false : !pkg.npmtool; // Absence of nodemon -> false (don't ignore)

        if (p.ignore) {
            p.messages.push('Skipping. package.json has npmtool == false');
        }

    } catch (err) {

        p.errors.push('package.json (' + err.message + ')');
        cb(err, p);
        return;

    }

    p.name = pkg.name;

    var prjDeps = pkg.dependencies ? Object.keys(pkg.dependencies) : [];
    var devDeps = pkg.devDependencies ? Object.keys(pkg.devDependencies) : [];
    var allDeps = prjDeps.concat(devDeps);

    p.deps = allDeps.filter(function(item, pos, self) {
        return self.indexOf(item) == pos;
    });

    cb(null, p);
}


function getGitBranch(path, cb) {

    try {
        fs.statSync(path + '/.git');

        debug('Checking for ' + path + '/.git: Found');

        var simpleGit = require('simple-git')( path );

        simpleGit.branch(function(err, branchSummary) {
            cb(branchSummary.current);
        });

    } catch (e) {

        // Not a git repo.
        debug('Checking for ' + path + '/.git: Not Found');

        cb(null);
        return;

    }
}


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


function debug(s) {
    if (debugLog) {
        console.log('[DEBUG] ' + s);
    }
}
