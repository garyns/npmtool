# npmtool

A tool to bulk manage multiple in-development npm modules.

If your project contains more than a few npm modules that are in active development, managing these at the local developer level can become time consuming and sometime a headache.

Here are a few ways npmtool can help

* **npm link** dependant modules. It will resolve intra module dependencies and link them all for you.
* **npm test** multiple modules and report a simple summary
* Run any npm script against multiple modules and report a summary
* Run any executable script against a range of modules.
* Check for definable regex matches in package.json (to help prevent you from checking in adhoc test scripts or catch development branches in dependencies for example)

## Quick Start

```
npm -g install npmtool
```

#### Folder Structure

Npmtool requires all your npm modules to be in a common folder. `npmtool.json` contains the configuration (more on that later). For example, lets say logging, dbservices utils, and users are all npm modules, and server-app is the main app which uses these modules.

Lets also assume that

* **logging** has a module dependency on utils.
* **dbservices** has a dependency on logging.
* **users** has dependencies on utils, dbservices and logging.
* **server-app** depends on all the modules.

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
2. Resolve module dependencies and link them.

##### Dependency Resolution

When resolving module dependencies `npmtool` inspects the package.json dependencies and devDependencies properties for all modules in the folder, and matches them against a package.json with a corresponding name property.

##### More than just Linking

Linking modules was the original motivation for creating `npmtool`, however you can use `npmtool` to execute any npm or external command against a set of modules. Lets look at the configuration file `npmtool.json` next to see some examples.


### Configuration - npmtool.json

Here is a details example of `npmtool.json` (yes, comments are ok in the file!)

```
todo
```

## Writing Your Own Custom Scripts.
