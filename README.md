# npmtool

A tool to bulk manage multiple in-development npm modules.

If your project contains more than a few npm modules that are in active development, managing these at the local developer level can become time consuming and sometime a headache.

Here are a few ways npmtool can help

Npm link modules. It will resolve intra module dependencies and link them all for you.
Npm test multiple modules and report a simple summary
Run any npm script against multiple modules and report a summary
Run any executable script against a range of modules.
Check for definable regex matches in package.json (to help prevent you from checking in adhoc test scripts or catch development branches in dependencies for example)

QuickStart.

Folder structure.
Npm tool requires all your modules to be in a common folder. For example


Npmtool requires a npmtool.json file. Here is a basic one. There's a detailed example later on.


Writing your own custom scripts.
