'use strict';

var grepit = require('grepit');



exports.run = function(pkg, args, shell, params, callback) {

    var failReportingMode = 2; // How to report failed tests. 1 = Warning, 2 = Error

    if (params.warnings) {
        failReportingMode = 1;
    }

    var result = grepit(args.join('|'), pkg.file);

    if (result.length > 0) {
        callback(failReportingMode, 'Grep matched ' + args.join('|'));
        return;
    } else {
        callback(null, null);
        return;
    }
};
