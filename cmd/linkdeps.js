'use strict';

exports.run = function(pkg, args, shell, params, callback) {

    if (pkg.localDeps.length === 0) {
        callback(null, 'No local dependencies');
        return;
    }

    var args2 = ['link'].concat(pkg.localDeps);

    shell(pkg, 'npm', args2, function(err) {
        callback(err, 'npm ' + args2.join(' '));
    });

};
