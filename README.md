# npmtool

A tool to bulk manage multiple in-development npm modules.

If your project contains more than a few npm modules that are in active development, managing these at the local developer level can become time consuming and sometime a headache.

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

Using npm alone, you would need to do something link this -

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
                "linkDeps"
            ]
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
* **commands** - command sets. For example `npmtool test` will run `npm test` and then `npm run lint`.
* **branches** - If you are using git, you can colorise the branch names reported by `npmtool`.

### Internal npmtool Commands

`npmtool` include the follow internal / in-build commands.

##### linkdeps

Transverses all modules in the base folder to resolve module dependencies. It then performa an `npm link` to link dependant modules.

##### package-nogrep

Performs an inverse grep on `package.json` files, and fails if any of the patterns match. Created to help prevent checking in ad-hoc test scripts or catch development branches in dependencies, for example)

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
#! /bin/bash
# ./echotest1.sh

echo "I'm an execuitable file!"

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
