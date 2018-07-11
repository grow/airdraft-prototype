var express = require('express');
var fs = require('fs');
var github = require('octonode');
var handlebars = require('handlebars');
var bodyParser = require('body-parser');
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
app.use(bodyParser.urlencoded({extended: false}));
app.use(bodyParser.json());
app.use(express.static('dist'));


app.post('/:owner/:name/blob/:branch/:filePath(*)', function(req, res) {
  var client = github.client(TOKEN);
  var repoName = req.params.owner + '/' + req.params.name
  var branch = req.params.branch;
  var path = req.params.filePath;
  var repo = client.repo(repoName);

  if (req.params.owner != 'jeremydw' || req.params.name != 'growsdk.org') {
    throw new Error('Forbidden.');
  }

  var commitMessage = req.body.commitMessage || 'Updated via editor prototype.';
  var sha = req.body.sha;

  // Handle markdown with frontmatter.
  if (req.body.markdownAsText) {
    var yamlAsText = req.body.yamlAsText;
    var markdownAsText = req.body.markdownAsText;
    var tempMatter = matter('---\n' + yamlAsText + '\n---\n');
    var contentToWrite = matter.stringify(markdownAsText, tempMatter.data);
  } else {
  // Handle yaml only.
    var contentToWrite = req.body.yamlAsText;
  }

  console.log('Saving -> ' + repoName + '/' + branch + '/' + path);
  repo.updateContents(
      path, commitMessage, contentToWrite, sha, branch, function(err, body, headers) {
    repo.contents(path, branch, function(err, body, headers, foo) {

      // TODO: Pull this out so the code isn't repeated.
      fs.readFile('templates/app.html', 'utf-8', function(error, templateContent) {
        var b64content = body['content'];
        var content = b64decode(b64content);
        var sha = body['sha'];
        var params = {
          repoName: repoName,
          sha: sha,
          status: 'Saved',
          branch: branch,
          path: path
        };
        if (path.endsWith('.md')) {
          var obj = matter(content, {excerpt: true});
          params.yamlAsText = obj.matter;
          params.markdownAsText = obj.content;
        } else {
          params.yamlAsText = content;
        }
        var template = handlebars.compile(templateContent);
        var html = template(params);
        res.send(html);
      });

    });
  });
});


app.get('/:owner/:name/blob/:branch/:filePath(*)', function(req, res) {
  var client = github.client(TOKEN);
  var repoName = req.params.owner + '/' + req.params.name
  var branch = req.params.branch;
  var path = req.params.filePath;
  var repo = client.repo(repoName);

  if (req.params.owner != 'jeremydw' || req.params.name != 'growsdk.org') {
    throw new Error('Forbidden.');
  }

  repo.contents(path, branch, function(err, body, headers, foo) {

    // TODO: Pull this out so the code isn't repeated.
    fs.readFile('templates/app.html', 'utf-8', function(error, templateContent) {
      var b64content = body['content'];
      var content = b64decode(b64content);
      var sha = body['sha'];
      var params = {
        repoName: repoName,
        sha: sha,
        branch: branch,
        path: path
      };
      if (path.endsWith('.md')) {
        var obj = matter(content, {excerpt: true});
        params.yamlAsText = obj.matter;
        params.markdownAsText = obj.content;
      } else {
        params.yamlAsText = content;
      }
      var template = handlebars.compile(templateContent);
      var html = template(params);
      res.send(html);
    });

  });
});


const PORT = process.env.PORT || 3000;
app.listen(PORT, function () {
  console.log(`App listening on port ${PORT}`);
  console.log('Press Ctrl+C to quit.');
});
