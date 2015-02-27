var fs = require('fs');
var ffmpeg = require('fluent-ffmpeg');
var MongoClient = require('mongodb').MongoClient;
var DB;
var SOURCE_DIR = '../music_here';
var UPLOADER_USER_ID = 9;   //ya lail ya ain

function getMaxId(collection, cb){
  DB.collection(collection).findOne({}, { _id: true }, { sort: [[ '_id', -1 ]] }, function(err, doc){
    if (err) {
      return cb(err);
    }
    else {
      return cb(null, doc._id + 1);
    }
  });
}

function findOrInsertArtist(name, cb){
  DB.collection('artists').findOne({ name: name }, { _id: true }, function(err, doc){
    if (err) {
      return cb(err);
    }
    else {
      if (doc) {
        return cb(null, doc._id);
      }
      else {
        getMaxId('artists', function(err, newId){
          if (err) {
            return cb(err);
          }
          else {
            var date = new Date();
            DB.collection('artists').insert({ _id: newId, name: name, createdDate: date.toISOString(), commentsCount: 0 }, function(err, doc){
              if (err) {
                return cb(err);
              }
              else {
                return cb(null, doc[0]._id);
              }
            });
          }
        });
      }
    }
  });
}

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
    findOrInsertArtist(args.artistName, function(err, artistId){
      if (err) {
        console.log(err);
        return cb(err);
      }
      else {
        console.log(artistId);

        //insert song

        return cb();
      }
    });
  });
}

function uploadFile(filePath, cb){
  console.log(filePath);
  //[artist name]-[song title]-[genre]-[album]-[description]-[year]-[filename].ext
  var fileElements = filePath.match(/(.+)(\/\[)(.+)(\]-\[)(.+)(\]-\[)(.*)(\]-\[)(.*)(\]-\[)(.*)(\]-\[)(.*)(\]-\[)(.+)(\])(\.mp3)$/);
  var args = {
    file: filePath,
    songTitle: fileElements[5],
    artistName: fileElements[3].replace('+', ' ').trim(),
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
MongoClient.connect('mongodb://anas:anas1234@localhost:27017/awtphase2', function(err, db) {
  if(err) {
    throw err;
  }
  else {
    DB = db;
    listFiles(function(){
      db.close();
      console.log('done');
    });
  }
});
