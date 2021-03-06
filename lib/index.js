// Generated by CoffeeScript 1.8.0
var ALI_IMG_CMD, Cnt, HTTP_PREFIX, IS_JAVA_INSTALLED, JAR_ENTRY_POINT, JAR_SET_PATH, OSS_BUKET_PATH, OssClint, START_AT, ZXIN_PATH, assert, debuglog, decode, generateRandomFilename, init, ossEasy, path, readResultFromStdout, url, _;

require('shelljs/global');

_ = require('underscore');

debuglog = require("debug")("zxing-oss-enhanced");

path = require('path');

ossEasy = require("oss-easy");

url = require('url');

assert = require("assert");

IS_JAVA_INSTALLED = which('java');

START_AT = Date.now().toString(36);

ZXIN_PATH = path.join(__dirname, "..", "zxing");

JAR_SET_PATH = "" + (path.join(ZXIN_PATH, 'javase-3.3.0.jar')) + ":" + (path.join(ZXIN_PATH, 'jcommander-1.27.jar')) + ":" + (path.join(ZXIN_PATH, 'core-3.3.0.jar'));

JAR_ENTRY_POINT = "com.google.zxing.client.j2se.CommandLineRunner";

OssClint = null;

OSS_BUKET_PATH = '';

HTTP_PREFIX = '';

ALI_IMG_CMD = "@500w_800h_100d.png";

init = function(options) {
  var ossOptions;
  assert(options, "missing options");
  assert(options.ossKey, "missing options.ossKey");
  assert(options.ossSecret, "missing options.ossSecret");
  assert(options.ossBucket, "missing options.ossBucket ");
  assert(options.ossPath, "missing options.ossPath");
  assert(options.httpPrefix, "missing options.httpPrefix");
  ossOptions = {
    accessKeyId: options.ossKey,
    accessKeySecret: options.ossSecret,
    bucket: options.ossBucket
  };
  OssClint = new ossEasy(ossOptions);
  OSS_BUKET_PATH = options.ossPath;
  HTTP_PREFIX = options.httpPrefix;
  debuglog('init ok');
};

Cnt = 0;

generateRandomFilename = function(basename) {
  return "" + (Date.now().toString(36)) + "_" + START_AT + "_" + (++Cnt) + (basename || '');
};

readResultFromStdout = function(stdout) {
  var i, line, lines, _i, _len;
  lines = stdout.split("\n");
  for (i = _i = 0, _len = lines.length; _i < _len; i = ++_i) {
    line = lines[i];
    if (line.indexOf('Raw result:') >= 0) {
      return lines[i + 1];
    }
  }
};

decode = function(uri, callback) {
  var cmd;
  if (!_.isFunction(callback)) {
    debuglog('[decode] callback isnt a function. cancel');
    return;
  }
  if (!IS_JAVA_INSTALLED) {
    callback('java is not installed');
    return;
  }
  uri = String(uri || '').trim();
  if (!uri) {
    callback("invalid uri:" + uri);
    return;
  }
  cmd = "java -cp " + JAR_SET_PATH + " " + JAR_ENTRY_POINT + " " + uri;
  debuglog("[decode] cmd to be exec:" + cmd);
  exec(cmd, {
    silent: true
  }, function(code, stdout, stderr) {
    var errorCache, filename, qrcode, remoteFilePath;
    debuglog("[parse result] code:" + code + ", stdout:" + stdout + ", stderr:" + stderr);
    if (code) {
      errorCache = "ERROR: code:" + code + ", err:" + stderr;
    } else {
      qrcode = readResultFromStdout(stdout);
    }
    if (errorCache != null) {
      return callback(errorCache);
    }
    if (qrcode != null) {
      return callback(null, qrcode);
    }
    if (OssClint == null) {
      debuglog("no oss client inited. cancel attemps");
      return callback();
    }
    debuglog("TRY OSS IMG OPTMIZATION");
    filename = generateRandomFilename() + path.extname(uri);
    remoteFilePath = path.join(OSS_BUKET_PATH, filename);
    OssClint.uploadFile(uri, remoteFilePath, function(err) {
      var optimizedImgUrl;
      if (err != null) {
        return callback(err);
      }
      optimizedImgUrl = HTTP_PREFIX + path.join(OSS_BUKET_PATH, "" + filename + ALI_IMG_CMD);
      cmd = "java -cp " + JAR_SET_PATH + " " + JAR_ENTRY_POINT + " " + optimizedImgUrl + " --try_harder";
      debuglog("[decode] attemp 2 cmd to be exec:" + cmd);
      return exec(cmd, {
        silent: true
      }, function(code, stdout, stderr) {
        debuglog("[parse result] attemp 2 code:" + code + ", stdout:" + stdout + ", stderr:" + stderr);
        if (code) {
          errorCache = "ERROR: code:" + code + ", err:" + stderr;
        } else {
          qrcode = readResultFromStdout(stdout);
        }
        return callback(errorCache, qrcode);
      });
    });
  });
};

module.exports = {
  init: init,
  decode: decode
};
