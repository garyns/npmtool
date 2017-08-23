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
    //     callback(err|status, output);
    // });

    var output = {
        args: args,
        params: params
    };

    // Two ways to use callback()
    // 1. callback(error:String, summary); // If error is not null this is reported as an error, else summary is reported as success.
    // 2. callback(status:Integer, summary); // status 0 = Success, 1 = Warning, 2 = Error. summary is reported as status type.

    callback(null, output);
};
