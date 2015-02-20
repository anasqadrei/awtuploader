var fs = require('fs');

var SOURCE_DIR = '../music_here';
var UPLOADER_USER_ID = 9;   //ya lail ya ain

function uploadFile(filePath, cb){
  //[artist name]-[song title]-[genre]-[album]-[description]-[year]-[filename].ext
  var fileElements = filePath.match(/(.+)(\/\[)(.+)(\]-\[)(.+)(\]-\[)(.*)(\]-\[)(.*)(\]-\[)(.*)(\]-\[)(.*)(\]-\[)(.+)(\])(\.mp3)$/);
  var args = {
    file: filePath,
    songTitle: fileElements[5],
    artistName: fileElements[3],
    desc: fileElements[11],
    userId: UPLOADER_USER_ID
  }
  //album
  if (fileElements[9]) {
    args.desc += '. ' + fileElements[9];
  }
  //genre
  if (fileElements[7]) {
    args.desc += ' #' + fileElements[7];    //check if # align with arabic
  }
  //year
  if (fileElements[13]) {
    args.desc += ' #' + fileElements[13];   //check if # align with arabic
  }

  console.log(args);
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
          uploadFile(SOURCE_DIR + '/' + file, function(){
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
