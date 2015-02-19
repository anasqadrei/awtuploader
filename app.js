var fs = require('fs');

var SOURCE_DIR = '../music_here';

function uploadFile(filename, cb){
  console.log(filename);
  return cb();
}

function processFile(file, filesList, cb){
  if (file) {
    fs.stat(SOURCE_DIR + '/' + file, function(err, stats){
      if (err) {
        console.log(err);
        throw err;
      }
      else {
        if (stats.isFile()) {
          uploadFile(file, function(){
            return processFile(filesList.shift(), filesList, function(){
              return cb();
            });
          });
        }
        else {
          return cb();
        }
      }
    });
  }
  else {
    return cb();
  }
}

function listFiles(cb){
  fs.readdir(SOURCE_DIR, function(err, files){
    if (err) {
      console.log(err);
      throw err;
    }
    else {
      processFile(files.shift(), files, function(){
        return cb();
      });
    }
  });
}

console.log('starting ...');

listFiles(function(){
  console.log('done');
});
