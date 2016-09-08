

var fs = require('fs');
var readline = require('readline');
var google = require('googleapis');
var googleAuth = require('google-auth-library');
var async = require('async');

// If modifying these scopes, delete your previously saved credentials
// at ~/.credentials/classroom-nodejs-quickstart.json
var SCOPES = ['https://www.googleapis.com/auth/classroom.courses.readonly', 'https://www.googleapis.com/auth/classroom.coursework.students.readonly', 'https://www.googleapis.com/auth/classroom.coursework.me.readonly'];
var TOKEN_DIR = (process.env.HOME || process.env.HOMEPATH ||
    process.env.USERPROFILE) + '/.credentials/';
var TOKEN_PATH = TOKEN_DIR + 'classroom-nodejs-quickstart.json';

// Load client secrets from a local file.
fs.readFile('client_secret.json', function processClientSecrets(err, content) {
  if (err) {
    console.log('Error loading client secret file: ' + err);
    return;
  }
  // Authorize a client with the loaded credentials, then call the
  // Classroom API.
  authorize(JSON.parse(content), listCourses);
});

/**
 * Create an OAuth2 client with the given credentials, and then execute the
 * given callback function.
 *
 * @param {Object} credentials The authorization client credentials.
 * @param {function} callback The callback to call with the authorized client.
 */
function authorize(credentials, callback) {
  var clientSecret = credentials.web.client_secret;
  var clientId = credentials.web.client_id;
  var redirectUrl = 'http://google.com';
  var auth = new googleAuth();
  var oauth2Client = new auth.OAuth2(clientId, clientSecret, redirectUrl);

  // Check if we have previously stored a token.
  fs.readFile(TOKEN_PATH, function(err, token) {
    if (err) {
      getNewToken(oauth2Client, callback);
    } else {
      oauth2Client.credentials = JSON.parse(token);
      callback(oauth2Client);
    }
  });
}

/**
 * Get and store new token after prompting for user authorization, and then
 * execute the given callback with the authorized OAuth2 client.
 *
 * @param {google.auth.OAuth2} oauth2Client The OAuth2 client to get token for.
 * @param {getEventsCallback} callback The callback to call with the authorized
 *     client.
 */
function getNewToken(oauth2Client, callback) {
  var authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES
  });
  console.log('Authorize this app by visiting this url: ', authUrl);
  var rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  rl.question('Enter the code from that page here: ', function(code) {
    rl.close();
    oauth2Client.getToken(code, function(err, token) {
      if (err) {
        console.log('Error while trying to retrieve access token', err);
        return;
      }
      oauth2Client.credentials = token;
      storeToken(token);
      callback(oauth2Client);
    });
  });
}

/**
 * Store token to disk be used in later program executions.
 *
 * @param {Object} token The token to store to disk.
 */
function storeToken(token) {
  try {
    fs.mkdirSync(TOKEN_DIR);
  } catch (err) {
    if (err.code != 'EEXIST') {
      throw err;
    }
  }
  fs.writeFile(TOKEN_PATH, JSON.stringify(token));
  console.log('Token stored to ' + TOKEN_PATH);
}

/**
 * Lists the first 10 courses the user has access to.
 *
 * @param {google.auth.OAuth2} auth An authorized OAuth2 client.
 */
function listCourses(auth) {
  var classroom = google.classroom('v1');
  classroom.courses.list({
    auth: auth,
    pageSize: 10
  }, function(err, response) {
    if (err) {
      console.error('The API returned an error: ' + err);
      return;
    }
    var courses = response.courses;
    if (!courses || courses.length == 0) {
      console.log('No courses found.');
    } else {
      console.log('Courses:');
      async.eachOfSeries(courses, function (v, i, cb) {
        console.log('    ', v.name + ' (' + v.id + ')' + ':');
        classroom.courses.courseWork.list({
          courseId: v.id,
          auth: auth
        }, function (err, res) {
          console.log('        ' + res.courseWork.map(formatWork).join('\n        '));
          cb(err);
        })
      }, function (err) {
        if (err) {
          console.error('Error:');
          console.error('    ' + err.message);
          process.exit(1);
        }
        console.log('Done!');
        process.exit(0);
      })
    }
  });
}
function formatWork(work) {
  var output = work.title + ' ('+ work.id +')' + (work.description ? ': ' + work.description.slice(0, 20) + (work.description.length > 20 ? '...' : '.') : '') + ':';
  output += '\n            ' + ' Type: ' + formatEnum(work.workType);
  if (work.dueDate) {
    output += '\n            ' + ' Due Data: ' + formatDate(work.dueDate);
  }
  output += '\n            ' + work.materials.map(formatMaterial).join('\n             ');
  return output;
}
function formatMaterial(material) {
  var key = Object.keys(material)[0];
  if (typeof formatMaterial[key] !== 'function') {
    return key;
  }
  return formatMaterial[key](material[key]);
}
formatMaterial.driveFile = function (file) {
  var output = 'Drive File: ' + file.driveFile.title + ' (' + file.driveFile.id + '):';
  output += '\n               ' + 'Shared Via: ' + formatEnum(file.shareMode);
  output += '\n               ' + 'URL: ' + file.driveFile.alternateLink;
  return output;
}
formatMaterial.youtubeVideo = function (file) {
  var output = 'YouTube Video: ' + file.title + ' (' + file.id + '):';
  output += '\n               ' + 'URL: ' + file.alternateLink;
  return output;
}
formatMaterial.link = function (file) {
  var output = 'Link: ' + file.title+ ':';
  output += '\n               ' + 'URL: ' + file.url;
  return output;
}
function formatEnum(enm) {
  return enm.slice(0, 1) + enm.slice(1).toLowerCase().replace(/_/g, ' ');
}
function formatDate(date) {
  return (date.year ? date.year + '-': '') + date.month + '-' + date.day;
}
