var fs = require('fs');
var ffmpeg = require('fluent-ffmpeg');
var aws = require('aws-sdk');
var MongoClient = require('mongodb').MongoClient;
var DB;
var SOURCE_DIR = '../music_here';
var UPLOADER_USER_ID = 9;   //ya lail ya ain
var FILE_SUFFIX = '.new.mp3';

aws.config = new aws.Config({
  accessKeyId: process.env.AWS_USER_ACCESS_KEY,
  secretAccessKey: process.env.AWS_USER_SECRET_ACCESS_KEY
});

var s3 = new aws.S3();

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

    //insert artist
    findOrInsertArtist(args.artistName, function(err, artistId){
      if (err) {
        console.log(err);
        return cb(err);
      }
      else {
        //modify file metadata
        ffmpeg(args.file)
        .outputOptions('-codec copy')
        .outputOptions('-metadata', 'title=' + args.songTitle)
        .outputOptions('-metadata', 'artist=' + args.artistName)
        .outputOptions('-metadata', 'comment=' + args.desc)        //doesn't update metadata!
        .outputOptions('-metadata', 'genre=أوتاريكا')
        .save(args.file + FILE_SUFFIX)
        .on('error', function(err, stdout, stderr) {
          return cb(err);
        })
        .on('end', function() {
          //insert song
          getMaxId('songs', function(err, newId){
            if (err) {
              return cb(err);
            }
            else {
              var date = new Date();
              var newSong = {
                _id: newId,
                title: args.songTitle,
                artist: artistId,
                desc: args.desc,
                tags: hashtags,
                uploader: UPLOADER_USER_ID,
                fileSize: metadata.format.size,
                duration: metadata.streams[metadataIndex].duration.toFixed(3) * 1000,
                fileType: metadata.streams[metadataIndex].codec_name.trim().toUpperCase(),
                sampleRate: metadata.streams[metadataIndex].sample_rate,
                bitrate: metadata.streams[metadataIndex].bit_rate,
                createdDate: date.toISOString(),
                commentsCount: 0,
                playsCount: 0,
                listenersCount: 0,
                downloadsCount: 0,
                likesCount: 0,
                dislikesCount: 0
              };

              DB.collection('songs').insert(newSong, function(err, doc){
                if (err) {
                  return cb(err);
                }
                else {
                  //upload to S3
                  var stream = fs.createReadStream(args.file + FILE_SUFFIX);
                  var params = {
                    Bucket: process.env.AWS_S3_BUCKET_MUSIC,
                    Key: 'songs/original/' + Math.floor(newId/1000) + '/' + newId + '.mp3',
                    Body: stream,
                    ContentType: 'audio/mp3',
                  };
                  s3.putObject(params, function(err, data) {
                    if (err){
                      return cb(err);
                    }
                    else{
                      //delete the newly created file by ffmpeg
                      fs.unlink(args.file + FILE_SUFFIX, function(err){
                        if(err){
                          console.log(err);
                          return cb(err);
                        }
                        else {
                          //update statistcs
                          DB.collection('artists').update({ _id: artistId }, { $inc: { songsCount: 1 } }, { w: 0 });
                          DB.collection('usersong').update({ user: UPLOADER_USER_ID, song: newId }, { $set: { upload: true } }, { upsert: true, w: 0 });

                          //final return
                          return cb();
                        }
                      });
                    }
                  });
                }
              });
            }
          });
        });
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
    songTitle: fileElements[5].replace(/(;|#|&|@|:|=|`|>|<|%|~|\"|\'|\/|\\|\||\{|\}|\(|\)|\[|\]|\+|\*|\$|\?|\^)/g, ' ').trim(),
    artistName: fileElements[3].replace(/(;|#|&|@|:|=|`|>|<|%|~|\"|\'|\/|\\|\||\{|\}|\(|\)|\[|\]|\+|\*|\$|\?|\^)/g, ' ').trim(),
    desc: fileElements[11],
    userId: UPLOADER_USER_ID
  }
  //album
  if (fileElements[9]) {
    args.desc += '. ' + fileElements[9];
  }
  //genre
  if (fileElements[7]) {
    args.desc += ' #' + fileElements[7].replace(/\s/g, '_');
  }
  //year
  if (fileElements[13]) {
    args.desc += ' #' + fileElements[13].replace(/\s/g, '_');
  }
  //song title and artist
  args.desc += ' #' + args.songTitle.replace(/\s/g, '_') + ' #' + args.artistName.replace(/\s/g, '_');

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
MongoClient.connect(process.env.MONGOHQ_URL, function(err, db) {
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
