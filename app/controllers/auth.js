var User = require('../models').User;
var jwt = require('jsonwebtoken');
var env = process.env.NODE_ENV || 'development';
var config = require('../../config/config')[env];

exports.authenticate = function (req, res) {
  var username = req.param('username');
  var password = req.param('password');

  User
    .findOne({
      username: username
    })
    .exec(function (err, user) {
      if (!user) {
        return res.send(403, {error: '用户不存在'});
      }

      if (user.auth(password)) {
        user = user.toObject();
        user = {
          _id: user._id,
          username: user.username
        };
        var token = jwt.sign(user, config.sessionSecret, {
          expiresInMinutes: 60*5
        });

        return res.send(200, {
          user: user,
          token: token
        });
      } else {
        return res.send(403, {error: '用户名或密码错误'});
      }
    });
};

exports.register = function (req, res) {
  var username = req.param('username');
  var password = req.param('password');

  User
    .findOne({
      username: username
    })
    .exec(function (err, user) {
      if (user) {
        return res.send(403, {error: '该用户已存在'});
      }

      user = new User({
        username: username,
        password: password
      });

      user.save(function (err, user) {
        user = user.toObject();
        delete user.passwordHash;
        var token = jwt.sign(user, config.sessionSecret, {
          expiresInMinutes: 60*5
        });

        return res.send(200, {
          user: user,
          token: token
        });
      });
    });
};
