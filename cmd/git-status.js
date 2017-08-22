'use strict';

var fs = require('fs');

exports.run = function(pkg, args, shell, params, callback) {

    // var statusToIgnore = [];
    var success = null;
    var error = null;

    try {
        fs.statSync(pkg.folder + '/.git');

    } catch (err) {
        callback(null, 'Not a GIT Repo');
        return;
    }

    var simpleGit = require('simple-git')( pkg.folder );

    simpleGit.status(function(err, status) {

        if (err) {
            callback('Not a GIT Repo');
            return;
        }

        if (!status) {
            callback('Status Not Available');
            return;
        }

        // if (args.length > 0) {
        //
        //     for (var i in args) {
        //         var a = args[i];
        //         var b = a.toLowerCase().replace(/\s*/, '');
        //
        //         statusToIgnore.push(b);
        //     }
        // }

        var gitFlags = [];

        if (status.ahead) {
            gitFlags.push('Ahead');
        }

        if (status.behind) {
            gitFlags.push('Behind');
        }
        if (status.not_added.length > 0) {
            gitFlags.push('Not Added');
        }

        if (status.conflicted.length > 0) {
            gitFlags.push('Conflict');
        }

        if (status.created.length > 0) {
            gitFlags.push('Created');
        }

        if (status.deleted.length > 0) {
            gitFlags.push('Deleted');
        }

        if (status.modified.length > 0) {
            gitFlags.push('Modified');
        }

        if (status.renamed.length > 0) {
            gitFlags.push('Renamed');
        }

        if (gitFlags.length > 0) {
            error = gitFlags.join(', ');
        } else {
            success = 'Ok';
        }

        // output will be printed on npmtool output.
        callback(error, success);
    });

};
