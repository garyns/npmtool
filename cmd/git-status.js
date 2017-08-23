'use strict';

var fs = require('fs');

exports.run = function(pkg, args, shell, params, callback) {

    var failReportingMode = 2; // How to report failed tests. 1 = Warning, 2 = Error
    var statusToInclude = [];
    var statusToExclude = [];
    var summary = null;

    if (params.warnings) {
        failReportingMode = 1;
    }

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

        if (args.length > 0) {

            for (var i in args) {
                var a = args[i];
                var b = a.toLowerCase().replace(/\s*/, '');

                if (b[0] === '!') {
                    statusToExclude.push(b.substring(1, b.length)); // Strip leading !
                } else {
                    statusToInclude.push(b);
                }

            }
        }

        var gitFlags = [];

        if (includeStatus('ahead') && status.ahead) {
            gitFlags.push('Ahead');
        }

        if (includeStatus('behind') && status.behind) {
            gitFlags.push('Behind');
        }
        if (includeStatus('notadded') && status.not_added.length > 0) {
            gitFlags.push('NotAdded');
        }

        if (includeStatus('conflict') && status.conflicted.length > 0) {
            gitFlags.push('Conflict');
        }

        if (includeStatus('created') && status.created.length > 0) {
            gitFlags.push('Created');
        }

        if (includeStatus('deleted') && status.deleted.length > 0) {
            gitFlags.push('Deleted');
        }

        if (includeStatus('modified') && status.modified.length > 0) {
            gitFlags.push('Modified');
        }

        if (includeStatus('renamed') && status.renamed.length > 0) {
            gitFlags.push('Renamed');
        }

        if (gitFlags.length > 0) {
            summary = gitFlags.join(', ');
            callback(failReportingMode, summary);
            return;

        } else {
            callback(0, 'Ok');
            return;
        }

    });


    function includeStatus(status) {
        var include = testInclude(status) && !testExclude(status);

        //console.log('Include ' + status, include);
        return include;
    }

    function testInclude(status) {

        if (statusToInclude.length === 0) {
            return true;
        }

        return statusToInclude.indexOf(status) !== -1;
    }

    function testExclude(status) {
        return statusToExclude.indexOf(status) !== -1;
    }

};
