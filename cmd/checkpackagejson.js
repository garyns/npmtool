'use strict';

var grepit = require('grepit');



exports.run = function(pkg, args, shell, params, callback) {

    if (!params.nogrep) {
        callback(null, 'param nogrep not found in .npmtools.json');
        return;
    }

    var result = grepit(params.nogrep, pkg.file);

    if (result.length > 0) {
        callback('Grep matched ' + params.nogrep, null);
        return;
    } else {
        callback(null, null);
        return;
    }
};
