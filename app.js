var express = require('express');
var fs = require('fs');
var github = require('octonode');
var handlebars = require('handlebars');
var bodyParser = require('body-parser');
var matter = require('gray-matter');
var sha1 = require('sha1');
var Defer = require('./js/utility/defer')
var yaml = require('js-yaml')


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


// Load a path and config, then render it.
var loadEditor = (client, repoName, branch, path, res) => {
  const repo = client.repo(repoName);
  if (repoName != 'jeremydw/growsdk.org') {
    throw new Error('Forbidden.');
  }

  const promises = [];
  const mainDocDefer = new Defer()
  promises.push(mainDocDefer.promise)

  repo.contents(path, branch, function(err, body, headers, foo) {
    mainDocDefer.resolve(body)
  });

  const pathParts = path.split('/')
  // Ignore the normal filename.
  pathParts.pop()

  const configFiles = []
  while (pathParts.length) {
    configFiles.push(`/${pathParts.join('/')}/_editor.yaml`)
    pathParts.pop()
  }
  configFiles.push('/_editor.yaml')

  for (const configPath of configFiles) {
    ((promises, configPath) => {
      const configDocDefer = new Defer()
      promises.push(configDocDefer.promise)

      repo.contents(configPath, branch, function(err, body, headers, foo) {
        if (err) {
          if (err.statusCode != 404) {
            console.error(err);
          }
          configDocDefer.resolve(null);
        } else {
          configDocDefer.resolve(body);
        }
      });
    })(promises, configPath);
  }

  Promise.all(promises).then((results) => {
    const mainDoc = results[0]
    const configDocs = results.slice(1)

    let configStr = '';
    while (configDocs.length) {
      const configDoc = configDocs.pop()
      if (configDoc) {
        const b64content = configDoc['content'];
        const configObj = yaml.safeLoad(b64decode(b64content));
        configStr = JSON.stringify(configObj, null, 2);
      }
    }

    fs.readFile('templates/app.html', 'utf-8', function(error, templateContent) {
      var b64content = mainDoc['content'];
      var content = b64decode(b64content);
      var sha = mainDoc['sha'];
      var params = {
        repoName: repoName,
        config: configStr,
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
  })
};

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
    loadEditor(client, repoName, branch, path, res);
  });
});


app.get('/:owner/:name/blob/:branch/:filePath(*)', function(req, res) {
  var client = github.client(TOKEN);
  var repoName = req.params.owner + '/' + req.params.name;
  var branch = req.params.branch;
  var path = req.params.filePath;

  loadEditor(client, repoName, branch, path, res);
});


const PORT = process.env.PORT || 3000;
app.listen(PORT, function () {
  console.log(`App listening on port ${PORT}`);
  console.log('Press Ctrl+C to quit.');
});
