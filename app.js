var express = require('express');
var fs = require('fs');
var github = require('octonode');
var matter = require('gray-matter');
var sha1 = require('sha1');


var TOKEN;
fs.readFile('token.txt', 'utf8', function(err, data) {
  TOKEN = data.trim();
});


var b64decode = function(content) {
  var buffer = new Buffer(content, 'base64');
  return buffer.toString('ascii');
};


var app = express();


app.get('/', function (req, res) {
  var client = github.client(TOKEN);

  var repo = client.repo('jeremydw/hhkaffee.com');
  var path = 'content/pages/index.md';
  var commitMessage = 'Updated via editor prototype.';

  repo.contents(path, 'master', function(err, body, headers, foo) {
    var b64content = body['content'];
    var content = b64decode(b64content);
    var hash = body['sha'];
    var obj = matter(content);

    // Update 'foo' with random value.
    var value = parseInt((Math.random() * 100000));
    obj.data['foo'] = value;

    var text = matter.stringify(obj.content, obj.data);
    var resp = repo.updateContents(
        path, commitMessage, text, hash, 'master', function(err, body, headers) {
      res.send('Saved!');
    });
  });
});


app.listen(3000, function () {
  console.log('Listening on port 3000');
});
