var fs = require('fs');
var ffmpeg = require('fluent-ffmpeg');

var SOURCE_DIR = '../music_here';
var UPLOADER_USER_ID = 9;   //ya lail ya ain

function readMetadata(args, cb){
  ffmpeg.ffprobe(args.file, function(err, metadata){
    if (err){
      console.log(err);
      return cb(err);
    }
    else {

      //validate file (audio and mp3)
      var validFile = false;
      var metadataIndex = -1;
      if (metadata.streams && metadata.format) {
        for (var i = 0; i < metadata.streams.length; i++) {
          if (metadata.streams[i].codec_type === 'audio' && metadata.streams[i].codec_name === 'mp3') {
            metadataIndex = i;
            validFile = true;
            break;
          }
        }
      }
      if (!validFile) {
        console.log('Invalid File');
        return cb(new Error('Invalid File!'))
      }
    }


    //find hashtags in the desc
    var hashtags = args.desc.match(/#\S+/g);
    for (var i = 0; hashtags && i < hashtags.length; i++) {
      hashtags[i] = hashtags[i].replace(/#/g, '');
    }
    console.log(hashtags);

    //insert artist

    //insert song

    return cb();
  });
}

function uploadFile(filePath, cb){
  console.log(filePath);
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
  //console.log(args);

  return readMetadata(args, function(){
    return cb();
  });
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
