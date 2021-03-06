# npmtool

A tool to bulk manage multiple in-development npm modules.

If your project contains more than a few npm modules that are in active development, managing these at the local developer level can become time consuming and sometimes a headache.

Here are a few ways npmtool can help

* **npm link** dependant modules. It will resolve intra module dependencies and link them all for you
* **npm test** multiple modules and report a simple summary
* Run any npm script against multiple modules and report a summary
* Run any executable script against a range of modules
* Check for definable regex matches in package.json (to help prevent you from checking in ad-hoc test scripts or catch development branches in dependencies, for example)

## Quick Start

`npmtool` requires node version 4.0.0+

```
npm -g install npmtool
```

```
npmtool [commandset] [commandset] ...
```

#### Folder Structure

Npmtool requires all your npm modules to be in a common folder. `npmtool.json` contains the configuration (more on that later).

For example, lets say we have modules called *logging*, *dbservices*, *utils*, and *users*, with *server-app* being our main app that uses these modules.

Lets also assume that

* **logging** has a module dependency on utils
* **dbservices** has a dependency on logging
* **users** has dependencies on utils, dbservices and logging
* **server-app** depends on all the modules

```
+- logging
+- dbservices
+- utils
+- users
+- server-app
+- npmtool.json
```

##### Classic Approach to Linking

Using npm alone, you would need to do something like this -

```
cd logging
npm link
cd ../dbservices
npm link
cd ../utils
npm link
cd ../users
npm link
cd ../logging
npm link utils
cd ../dbservices
npm link logging
cd ../users
npm link utils logging dbservices
cd ../server-app
npm link utils dbservices logging users
```

##### Npmtool Approach to Linking

With `npmtool`, this is the approach:

```
npmtool link
```

`npmtool link` will

1. Perform a `npm link` on each module
2. Resolve module dependencies and link them for you

![npmtool link example](assets/npmlink.gif)

##### Dependency Resolution

When resolving module dependencies `npmtool` inspects the package.json dependencies and devDependencies properties for all modules in the base folder, and matches them against a package.json with a corresponding name property.

##### More than just Linking

Linking modules was the original motivation for creating `npmtool`, however you can use `npmtool` to execute any npm or external command against a set of modules. Lets look at the configuration file `npmtool.json` next to see some examples.


### Configuration - npmtool.json

Here is a detailed example of `npmtool.json`. It needs to reside in the base folder with your modules.

```
{
    "pattern": "*",

    "commands": {

        "test": {
            "description": "Run 'npm test' on each module.",
            "run": [
                "git-status"
                "package-nogrep .git#|xtest"
                "npm test",
                "npm run lint"
            ]
        },

        "install": {
            "description": "For each module, remove node_module folder and run 'npm install'.",
            "run": [
                "rm -fr node_modules",
                "npm install"
            ]
        },

        "link": {
            "description": "'npm link' modules, then link dependencies.",
            "run": [
                "npm link",
                "linkdeps"
            ]
        }
    },

    "params" : {

        "git-status": {
            "warnings": false
        },

        "package-nogrep": {
            "warnings": false
        }

    },    

    "branches": {

        "master": {
            "color": "red"
        },

        "develop": {
            "color": "green"
        }
    }
}
```

##### Options

* **pattern** - a glob pattern used to filter module folders. * for all folders, noting that only folders with a package.json are used.
* **commands** - command sets. For example `npmtool test` will run `git-status`, `package-nogrep`, `npm test` and then `npm run lint`.
* **params** - Global configuration settings for internal commands. See _Internal npmtool Commands_ below.
* **branches** - If you are using git, you can colorise the branch names reported by `npmtool`.


### Configuration - package.json

##### Skip / Ignore a Module

To have npmtool skip a module add the property `"npmtool":false` to the module's package.json. Npmtool will still include the module in it's output, but will not run commands on the module.

```
// package.json
{
  "name": "my-module",
  "version": "1.0.0",
  "npmtool": false,   <--- Tell npmtool to skip this module.
  ...
```

### Internal npmtool Commands

`npmtool` include the follow internal / in-build commands.

##### linkdeps

Transverses all modules in the base folder to resolve module dependencies. It then performs an `npm link` to link dependant modules.

See above npmtool.json sample for an example.

**IMPORTANT:** If you are linking module packages that are **not published** to a registry, the first execution of an _npm link_ and thus _linkdeps_ will exist with a failure (exit code 1). This is due to a 404 status being returned by the registry. A second execution of _npm link_ / _linkdeps_ should exit successfully.

##### package-nogrep

Performs an inverse grep on `package.json` files, and fails if any of the patterns match. Created to help prevent checking in ad-hoc test scripts or catch development branches in dependencies, for example)

package-nogrep takes a single argument which is the regex to match.

By default package-nogrep reports a test failure as an error. To report test failures as warnings, set a param. See above npmtool.json sample for a full example.

```
"params" : {

    "package-nogrep": {
        "warnings": true
    }

},
```

```
// This will report an error if package.json contains the string .git# or xtest
package-nogrep .git#|xtest
```
See above npmtool.json sample for an example.

##### git-status

Checks each module folder, and if it's a GIT repo reports the status.

Default statuses reported and success/error states are:

* Ok (Success)
* Ahead  (Error)
* Behind (Error)
* Modified (Error)
* NotAdded (Error)
* Conflict (Error)
* Created (Error)
* Deleted (Error)
* Renamed (Error)

If you only want to test and error on certain statuses, pass them as arguments to git-status. Prefix with ! to ignore a status test.

In this example we are only testing for a defined number of statuses.

```
"run": [
    "git-status Modified Created Deleted Renamed"
    ...
```

In this example we test for all statuses except NotAdded.

```
"run": [
    "git-status !NotAdded"
    ...
```

By default git-status reports a test failure as an error. To report test failures as warnings, set a param. See above npmtool.json sample for a full example.

```
"params" : {

    "git-status": {
        "warnings": true
    }

},
```

## Using and Creating Your Own Scripts / Commands

Any executable script or command can be used. It's exit value determines if `npmtool` reports a success or failure.

A relative script or command is resolved relative to the folder where you run `npmtool`.

* `npmtool` reports success for exit code 0
* `npmtool` reports failure for exit code != 0


##### Custom Commands

You can create either a shell executable script, or create a JavaScript file with a .run() function.

Here is an execuitable script (remember to chmod u+x).

Lets call is `echotest1.sh` in the same folder as `npmtool.json`.

```
#!/bin/bash
# ./echotest1.sh

echo "I'm an executable file!"

exit 0 # 0 === success.
```

Here is a JavaScript command. See the [cmd folder for examples](cmd/), including the `linkdeps` and `package-nogrep` internal commands.

Lets call is `echotest2.js` in the same folder as `npmtool.json`.

```
// ./echotest2.js
exports.run = function(pkg, args, shell, params, callback) {

    var output = {
        args: args,
        params: params
    };

    // output will be printed on npmtool output.

    // Two ways to use callback()
    // 1. callback(error:String, summary); // If error is not null this is reported as an error, else summary is reported as success.
    // 2. callback(status:Integer, summary); // status 0 = Success, 1 = Warning, 2 = Error. summary is reported as status type.    
    callback(null, output);
};
```

Note that if you need more configuration that can be passed in as a string arg, you can use the "params" section of `npmtool.json`. This **only** applies to the .run() version of commands.

```
{
    "pattern": "*",

    "commands": {

        "echotest": {
            "run":[
              "echotest1.sh arg1 arg2",
              "echotest2 arg1 arg2",
           ]
       },

    },

    "params" : {

        "echotest2": {
            "param1": "value1",
            "param2": "value2"
        },

    },
}
```

This example's `echotest` command will result in output like the following.

```
dbservices (./dbservices)
 ✔ echotest1.sh arg1 arg2
 ✔ echotest2 arg1 arg2 ({"args":["arg1","arg2"],"params":{"param1":"value1","param2":"value2"}})
```

Some observations:

* The .js command can output a summary - text in () - , where as the .sh script (or any non .js script) will not, and only indicates a success (exit 0) or failure (exit != 0).
* Note the stringified JSON output of `echotest2` to see how args and params are handled.
* For .js commands, the .js extension is optional in the `commands` / `run` array.


`echotest1.sh` and `echotest2.js` and the `echotest` command set are include in the [example](example) folder.

### Please Send On Your Custom JavaScript Commands

If you create an awesome command, please send it on to me.


## Change log

#### 1.3.0
* Dependencies updated due to security vulnerability.

#### 1.2.3
* Improved debugging support
* Scoped tests
* Readme update

#### 1.2.2
* Support for warning statuses
* Added git-status internal command
* cmd/echo.js example comments updated to illustrate reporting a success, error or warning

#### 1.2.1
* Bug fix with progress bar

#### 1.2.0
* Support for ignoring a module by adding npmtool: false to package.json
* New npmtool.json structure

#### 1.1.0
* Maintenance release.
* Support for 'command sets' in npmtool.json

#### 1.0.1
* Initial Release
