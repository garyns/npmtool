'use strict';

/**
 * Internal npmtool command script.
 * @param {String}   pkg      The name of the node module that script is running on.
 * @param {String}   args     Command arguments (after command name in command.run attribute from npmtool.json)
 * @param {Shell}    shell    Execute a shell command.
 * @param {Params}   params   Parameter variables from npmtool.json
 * @param {Function} callback callback(err, result) - err if non-null will report a failure. Result is printed as the command summary in the npmtool output.
 * @return {[type]}   [description]
 */
exports.run = function(pkg, args, shell, params, callback) {

    // shell parameter. See cmd/linkdeps.js for an example.
    // @param pkg package name.
    // @param cmd shell command / script / process to run.
    // @param args arguements string or array.
    // @param callback(error message or null, output)
    // shell(pkg, cmd, args, function(err, output) {
    //     callback(err, output);
    // });

    var output = {
        args: args,
        params: params
    };

    // output will be printed on npmtool output.
    callback(null, output);
};
