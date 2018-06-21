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


app.post('/:owner/:name/tree/:branch/:filePath(*)', function(req, res) {
  var client = github.client(TOKEN);
  var repoName = req.params.owner + '/' + req.params.name
  var branch = req.params.branch;
  var path = req.params.filePath;
  var repo = client.repo(repoName);

  var commitMessage = req.body.commitMessage || 'Updated via editor prototype.';
  var sha = req.body.sha;
  var yamlAsText = req.body.yamlAsText;
  var markdownAsText = req.body.markdownAsText;
  var tempMatter = matter('---\n' + yamlAsText + '\n---\n');
  var contentToWrite = matter.stringify(markdownAsText, tempMatter.data);

  console.log('Saving...');
  repo.updateContents(
      path, commitMessage, contentToWrite, sha, branch, function(err, body, headers) {
    repo.contents(path, branch, function(err, body, headers, foo) {

      // TODO: Pull this out so the code isn't repeated.
      fs.readFile('templates/app.html', 'utf-8', function(error, templateContent) {
        var b64content = body['content'];
        var content = b64decode(b64content);
        var sha = body['sha'];
        var obj = matter(content, {excerpt: true});
        var params = {
          repoName: repoName,
          status: 'Saved',
          sha: sha,
          branch: branch,
          dataAsText: JSON.stringify(obj.data),
          path: path,
          matter: obj
        };
        var template = handlebars.compile(templateContent);
        var html = template(params);
        res.send(html);
      });

    });
  });
});


app.get('/:owner/:name/tree/:branch/:filePath(*)', function(req, res) {
  var client = github.client(TOKEN);
  var repoName = req.params.owner + '/' + req.params.name
  var branch = req.params.branch;
  var path = req.params.filePath;
  var repo = client.repo(repoName);

  repo.contents(path, branch, function(err, body, headers, foo) {

    // TODO: Pull this out so the code isn't repeated.
    fs.readFile('templates/app.html', 'utf-8', function(error, templateContent) {
      var b64content = body['content'];
      var content = b64decode(b64content);
      var sha = body['sha'];
      // TODO: This doesn't work for YAML-only files. For YAML files disregard
      // the frontmatter parser.
      var obj = matter(content, {excerpt: true});
      var params = {
        repoName: repoName,
        sha: sha,
        branch: branch,
        dataAsText: JSON.stringify(obj.data),
        path: path,
        matter: obj
      };
      var template = handlebars.compile(templateContent);
      var html = template(params);
      res.send(html);
    });

  });
});


app.listen(3000, function () {
  console.log('Listening on port 3000');
});
