'use strict';

exports.run = function(pkg, args, shell, params, callback) {

    var echo = {
        args: args,
        params: params
    };

    callback(null, echo);

};
