var Character = require('../models').Character;
var Source = require('../models').Source;
var utils = require('./utils');
var async = require('async');

var env = process.env.NODE_ENV || 'development';
var config = require('../../config/config')[env];
var perPage = config.perPage;

exports.checkCharacter = function (req, res) {
  var name = req.query.name;
  var alias = req.query.alias || [''];
  var sourceId = req.query.sourceId;

  if (typeof alias === 'string') {
    alias = Array(alias);
  }

  Character
    .findOne({
      sourceId: sourceId,
      $or: [
        {name: name},
        {alias: {
          $in: alias
        }}
      ]
    })
    .exec(function (err, character) {
      if (character) {
        return res.send({exist: true});
      } else {
        return res.send({exist: false});
      }
    });
};

exports.getCharacters = function (req, res) {
  var page = req.query.page || 1;
  var limit = req.query.perPage || perPage;

  Character.paginate({}, page, limit, function (err, pageCount, characters, total) {

    var results = {
      pageCount: pageCount,
      objects: characters,
      total: total 
    }

    return res.send(results);
  });
};

exports.postCharacter = function (req, res) {
  var obj = {
    name: req.param('name'),
    alias: req.param('alias'),
    info: req.param('info'),
    sourceId: req.param('sourceId'),
    contributorId: req.user._id,
    avatar: req.param('avatar')
  };

  var character = new Character(obj);
  character.save(function (err, character) {
    return res.send(character);
  });
};

exports.getCharacterById = function (req, res) {
  var characterId = req.params.characterId;

  if (req.query.with_source) {
    async.waterfall([
      function (callback) {
        Character
          .findById(characterId)
          .lean()
          .exec(function (err, character) {
            callback(null, character);
          });
      },
      function (character, callback) {
        Source
          .findById(character.sourceId)
          .lean()
          .exec(function (err, source) {
            callback(null, character, source);
          });
      }
    ], function (err, character, source) {
      delete character.sourceId;
      delete character.contributorId;
      character.source = source;
      return res.send(character);
    });
  } else {
    Character
      .findById(characterId)
      .lean()
      .exec(function (err, character) {
        delete character.sourceId;
        delete character.contributorId;
        return res.send(character);
      });
  }
};

exports.putCharacterById = function (req, res) {
  var characterId = req.params.characterId;
  var obj = {
    name: req.param('name'),
    alias: req.param('alias') || [],
    info: req.param('info') || '',
    sourceId: req.param('sourceId'),
    avatar: req.param('avatar') || ''
  };

  Character
    .findByIdAndUpdate(characterId, obj, function (err, character) {
      return res.send(character);
    });
};

exports.getCharactersByKeyword = function (req, res) {
  var keyword = req.query.kw;
  var page = req.query.page || 1;
  var size = req.query.perPage || perPage;

  Character.search({
    sort: [
      {
        quotesCount: {
          order: 'desc'
        }
      },
      '_score'
    ],
    query: {
      multi_match: {
        query: keyword,
        fields: ['name', 'alias']
      }
    },
    fields: [],
    from: (page - 1) * size,
    size: size
  }, function (err, _results) {
    var output = [];
    var total = _results.hits.total;
    var results = _results.hits.hits;

    if (results.length > 0) {

      var ids = results.map(function (r) { return r._id; });

      if (req.query.with_source === true) {

        async.waterfall([

          // query characters by ids
          function (callback) {
            Character
              .find({
                _id: {
                  $in: ids
                }
              })
              .lean()
              .exec(function (err, characters) {
                callback(null, characters);
              });
          },

          // query sources by characters' sourceId
          function (characters, callback) {

            if (characters.length > 0) {
              var charactersWithSource = [];
              async.eachSeries(characters, function (character, callback) {
                Source
                  .findById(character.sourceId)
                  .lean()
                  .exec(function (err, source) {
                    delete character.sourceId;
                    character.source = source;
                    charactersWithSource.push(character);
                    callback();
                  });
              }, function (err) {
                callback(null, charactersWithSource);
              });

            } else {
              callback(null, []);
            }
          }
        ], function (err, characters) {
          characters.forEach(function (character) {
            delete character.contributorId;
          });

          return res.send({
            total: total,
            perPage: perPage,
            objects: characters
          });

        });

      } else {

        Character
          .find({
            _id: {
              $in: ids
            }
          })
          .lean()
          .exec(function (err, characters) {
            characters.forEach(function (character) {
              delete character.sourceId;
              delete character.contributorId;
            });

            return res.send({
              total: total,
              perPage: perPage,
              objects: characters 
            });

          });
      }
    // no search result
    } else {

      return res.send({
        total: total,
        perPage: perPage,
        objects: []
      });

    }
  });
};

exports.getCharactersBySourceId = function (req, res) {
  var sourceId = req.params.sourceId;
  var page = req.query.page || 1;
  var limit = req.query.perPage || perPage;

  Character.paginate({sourceId: sourceId}, page, limit, function (err, pageCount, characters, total) {

    var results = {
      pageCount: pageCount,
      objects: characters,
      total: total 
    }

    return res.send(results);
  });

};

exports.getCharactersByUserId = function (req, res) {
  var userId = req.user._id;
  var page = req.query.page || 1;
  var size = req.query.perPage || perPage;

  Character.search({
    sort: [
      {
        createdAt: {
          order: 'desc'
        }
      }
    ],
    query: {
      term: {
        contributorId: userId
      }
    },
    fields: [],
    from: (page - 1) * size,
    size: size
  }, function (err, _results) {
    var output = [];
    var total = _results.hits.total;
    var results = _results.hits.hits;

    if (results.length > 0) {
      var ids = results.map(function (r) { return r._id; });
      Character
        .find({
          _id: {
            $in: ids
          }
        })
        .sort({
          createdAt: -1
        })
        .exec(function (err, characters) {

          return res.send({
            total: total,
            perPage: perPage,
            objects: characters
          });

        });
    } else {

      return res.send({
        total: total,
        perPage: perPage,
        objects: [] 
      });

    }

  });

};
