#!/usr/bin/env node

var ArgumentParser = require('argparse').ArgumentParser;
var argsParser = new ArgumentParser({
  version: '1.0.0',
  addHelp: true,
  description: 'Extract i18n.t translation strings from DHIS2 frontend apps'
});

argsParser.addArgument(['-p', '--path'], {
  dest: 'path',
  defaultValue: './src/',
  help: 'directory path to recurse and extract i18n.t translation strings'
});

argsParser.addArgument(['-o', '--output'], {
  dest: 'output',
  defaultValue: './i18n/',
  help: 'destination path for en.pot file.'
});

var args = argsParser.parseArgs();

var fs = require('fs');
var path = require('path');
var { walk } = require('./helpers');

try {
  var dirPath = path.normalize(args.path);
  var stat = fs.lstatSync(dirPath);

  if (!stat.isDirectory()) {
    console.error(dirPath, 'is not a directory.');
    process.exit(1);
  }
} catch (e) {
  console.error(dirPath, 'does not exist.');
  process.exit(1);
}

console.log('\n> reading:', dirPath);
var files = walk(dirPath);
if (files.length === 0) {
  console.log(dirPath, 'has no strings to translate.');
  process.exit(1);
}

var Parser = require('i18next-scanner').Parser;
var parser = new Parser({
  keepRemoved: false,
  keySeparator: false,
  sort: true
});

console.log('> parsing:', files.length, 'files');
for (var filePath of files) {
  var contents = fs.readFileSync(filePath, 'utf8');
  parser.parseFuncFromString(contents).get();
}

var parsed = parser.get();
var en = {};

Object.keys(parsed.en.translation).forEach(str => (en[str] = ''));

var { i18nextToPot, gettextToI18next } = require('i18next-conv');
var targetPath = path.join(args.output, 'en.pot');

var checkExisting = true;
if (!fs.existsSync(args.output)) {
  (checkExisting = false), fs.mkdirSync(args.output);
  fs.closeSync(fs.openSync(targetPath, 'w'));
}

if (checkExisting) {
  // validate, diff translation keys b/w en.pot vs now
  gettextToI18next('en', fs.readFileSync(targetPath, 'utf8')).then(json => {
    var msgIds = Object.keys(en);
    var newMsgIds = Object.keys(JSON.parse(json));

    if (arrayEqual(newMsgIds, msgIds)) {
      console.log('> no i18n updates found.');
      console.log('> complete\n');
      process.exit(0);
    } else {
      write(en);
    }
  });
} else {
  write(en);
}

function write(en) {
  console.log(
    '> writing:',
    Object.keys(en).length,
    'language strings to',
    targetPath
  );
  i18nextToPot('en', JSON.stringify(en)).then(result => {
    fs.writeFileSync(targetPath, result + "\n");
    console.log('> complete\n');
    process.exit(0);
  });
}

// src from component/array-equal
function arrayEqual(arr1, arr2) {
  var length = arr1.length;
  if (length !== arr2.length) return false;
  for (var i = 0; i < length; i++) if (arr1[i] !== arr2[i]) return false;
  return true;
}
