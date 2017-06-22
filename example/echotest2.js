'use strict';

exports.run = function(pkg, args, shell, params, callback) {

    var output = {
        args: args,
        params: params
    };

    // output will be printed on npmtool output.
    callback(null, output);
};
