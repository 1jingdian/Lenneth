var Source = require('../models').Source;
var utils = require('./utils');
var async = require('async');

exports.checkSource = function (req, res) {
  var name = req.query.name;
  var alias = req.query.alias || [''];

  if (typeof alias === 'string') {
    alias = Array(alias);
  }

  Source
    .findOne({
      $or: [
        {name: name},
        {alias: {
          $in: alias
        }}
      ]
    })
    .exec(function (err, source) {
      if (source) {
        return res.send({exist: true});
      } else {
        return res.send({exist: false});
      }
    });
};

exports.getSources = function (req, res) {
  Source
    .find()
    .limit(20)
    .exec(function (err, sources) {
      return res.send(sources);
    });
};

exports.postSource = function (req, res) {
  var obj = {
    name: req.param('name'),
    alias: req.param('alias'),
    info: req.param('info')
  };

  var source = new Source(obj);
  source.save(function (err, source) {
    return res.send(source);
  });
};

exports.getSourceById = function (req, res) {
  var sourceId = req.params.sourceId;

  Source
    .findById(sourceId, function (err, user) {
      return res.send(user);
    });
};

exports.putSourceById = function (req, res) {
  var sourceId = req.params.sourceId;
  var obj = {
    name: req.param('name'),
    alias: req.param('alias'),
    info: req.param('info')
  };

  Source
    .findByIdAndUpdate(sourceId, obj, function (err, source) {
      return res.send(source);
    });
};

exports.getSourcesByKeyword = function (req, res) {
  var keyword = req.query.kw;
  var regexpKeyword = new RegExp('.*' + keyword + '.*');

  Source.search({
    query: keyword
  }, function (err, _results) {
    var output = [];
    var results = _results.hits.hits;

    if (results.length > 0) {
      async.eachSeries(results, function (result, callback) {
        Source.findById(result._id, function (err, source) {
          output.push(source);
          callback();
        });
      }, function (err) {
        console.log('finished');
        return res.send(output);
      });
    }

  });
};

exports.getSourcesByUserId = function (req, res) {
  var userId = req.user._id;
  var paginationId = req.query.paginationId;

  var options = {
    targetCriteria: {
      contributorId: userId
    },
    nextPageCriteria: {
      contributorId: userId,
      _id: {
        $gt: paginationId
      }
    },
    prevPageCriteria: {
      contributorId: userId,
      _id: {
        $lt: paginationId
      }
    },
    otherPageCriteria: {
      contributorId: userId,
      _id: {
        $gte: paginationId
      }
    }
  };

  return utils.paging(req, res, Source, options);
};
