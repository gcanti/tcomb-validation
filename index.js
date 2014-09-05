(function (root, factory) {
  'use strict';
  if (typeof define === 'function' && define.amd) {
    define(['tcomb'], factory);
  } else if (typeof exports === 'object') {
    module.exports = factory(require('tcomb'));
  } else {
    root.t = factory(root.t);
  }
}(this, function (t) {

  'use strict';

  var Nil = t.Nil;
  var Err = t.Err;
  var Str = t.Str;
  var Arr = t.Arr;
  var Obj = t.Obj;
  var Func = t.Func;

  var struct = t.struct;
  var maybe = t.maybe;
  var list = t.list;

  var isType = t.util.isType;
  var assert = t.assert;
  var getName = t.util.getName;
  var mixin = t.util.mixin;

  //
  // Result model
  //

  var Result = struct({
    errors: maybe(list(Err))
  }, 'Result');

  Result.prototype.isValid = function() {
    return !(this.errors && this.errors.length);
  };

  Result.prototype.firstError = function() {
    return this.isValid() ? null : this.errors[0];
  };

  // cache ok result
  var Ok = new Result({errors: null});

  //
  // utils
  //

  function toJSONPath(path) {
    return path.map(function (prop) {
      return '[' + JSON.stringify(prop) + ']';
    }).join('');
  }

  function formatError(message, params) {
    for (var param in params) {
      if (params.hasOwnProperty(param)) {
        message = message.replace(new RegExp(':' + param, 'gim'), params[param]);
      }
    }
    return message;
  }

  function ko(message, params) {
    var values = {
      path: params.path.join('.') || 'value',
      jsonpath: toJSONPath(params.path) || 'value',
      actual: JSON.stringify(params.actual),
      expected: getName(params.expected)
    };
    var err = new Error(formatError(message, values));
    mixin(err, params);
    return new Result({errors: [err]});
  }

  function getMessage(messages, key, defaultMessage) {
    if (Obj.is(messages) && messages.hasOwnProperty(key)) {
      return messages[key];
    } else if (Str.is(messages)) {
      return messages;
    }
    return defaultMessage;
  }

  //
  // validation functions
  // one for each kind expect for `any`, `primitive`, `enums` 
  // which are handled the same way
  //

  function validateIrriducible(value, type, opts) {

    if (!type.is(value)) {
      var message = opts.messages || ':jsonpath is `:actual`, should be a `:expected`';
      return ko(message, {path: opts.path, actual: value, expected: type});
    }

    return Ok;
  }

  function validateStruct(value, type, opts) {

    var isValid = Obj.is(value);

    if (!isValid) {
      var message = getMessage(opts.messages, ':input', ':jsonpath is `:actual`, should be an `:expected`');
      return ko(message, {path: opts.path, actual: value, expected: Obj});
    }

    var errors = [];
    var props = type.meta.props;
    for (var k in props) {
      if (props.hasOwnProperty(k)) {
        var result = _validate(value[k], props[k], {path: opts.path.concat([k]), messages: getMessage(opts.messages, k)});
        if (!result.isValid()) {
          isValid = false;
          errors = errors.concat(result.errors);
        }
      }
    }

    if (!isValid) {
      return new Result({errors: errors});
    }

    return Ok;
  }

  function validateMaybe(value, type, opts) {
    assert(isType(type) && type.meta.kind === 'maybe');

    if (!Nil.is(value)) {
      return _validate(value, type.meta.type, opts);
    }

    return Ok;
  }

  function validateSubtype(value, type, opts) {

    var result = _validate(value, type.meta.type, {path: opts.path, messages: getMessage(opts.messages, ':type')});
    if (!result.isValid()) {
      return result;
    }

    var predicate = type.meta.predicate;
    if (!predicate(value)) {
      var message = getMessage(opts.messages, ':predicate', ':jsonpath is `:actual`, should be a `:expected`');
      return ko(message, {path: opts.path, actual: value, expected: type});
    }

    return Ok;
  }

  function validateList(value, type, opts) {

    var isValid = Arr.is(value);

    if (!isValid) {
      var message = getMessage(opts.messages, ':input', ':jsonpath is `:actual`, should be a `:expected`');
      return ko(message, {path: opts.path, actual: value, expected: Arr});
    }

    var errors = [];
    for (var i = 0, len = value.length ; i < len ; i++ ) {
      var result = _validate(value[i], type.meta.type, {path: opts.path.concat([i]), messages: getMessage(opts.messages, ':type')});
      if (!result.isValid()) {
        isValid = false;
        errors = errors.concat(result.errors);
      }
    }

    if (!isValid) {
      return new Result({errors: errors});
    }

    return Ok;
  }

  function validateUnion(value, type, opts) {

    assert(Func.is(type.dispatch), 'unimplemented %s.dispatch()', getName(type));
    var ctor = type.dispatch(value);

    if (!Func.is(ctor)) {
      var message = getMessage(opts.messages, ':dispatch', ':jsonpath is `:actual`, should be a `:expected`');
      return ko(message, {path: opts.path, actual: value, expected: type});
    }

    var i = type.meta.types.indexOf(ctor);
    var result = _validate(value, ctor, {path: opts.path, messages: getMessage(opts.messages, i)});
    if (!result.isValid()) {
      return result;
    }

    return Ok;
  }

  function validateTuple(value, type, opts) {

    var types = type.meta.types;
    var len = types.length;
    var isValid = Arr.is(value) && value.length === len;

    if (!isValid) {
      var message = getMessage(opts.messages, ':input', ':jsonpath is `:actual`, should be a `:expected`');
      return ko(message, {path: opts.path, actual: value, expected: type});
    }

    var errors = [];
    for (var i = 0 ; i < len ; i++ ) {
      var result = _validate(value[i], types[i], {path: opts.path.concat([i]), messages: getMessage(opts.messages, i)});
      if (!result.isValid()) {
        isValid = false;
        errors = errors.concat(result.errors);
      }
    }

    if (!isValid) {
      return new Result({errors: errors});
    }

    return Ok;
  }

  function validateDict(value, type, opts) {

    var isValid = Obj.is(value);

    if (!isValid) {
      var message = getMessage(opts.messages, ':input', ':jsonpath is `:actual`, should be a `:expected`');
      return ko(message, {path: opts.path, actual: value, expected: Obj});
    }

    var errors = [];
    for (var k in value) {
      if (value.hasOwnProperty(k)) {
        var result = _validate(value[k], type.meta.type, {path: opts.path.concat([k]), messages: getMessage(opts.messages, ':type')});
        if (!result.isValid()) {
          isValid = false;
          errors = errors.concat(result.errors);
        }
      }
    }

    if (!isValid) {
      return new Result({errors: errors});
    }

    return Ok;
  }

  function _validate(value, type, opts) {
    var kind = t.util.getKind(type);
    switch (kind) {
      case 'irriducible' :
      case 'enums' :
        return validateIrriducible(value, type, opts);
      case 'struct' :
        return validateStruct(value, type, opts);
      case 'maybe' :
        return validateMaybe(value, type, opts);
      case 'list' :
        return validateList(value, type, opts);
      case 'subtype' :
        return validateSubtype(value, type, opts);
      case 'union' :
        return validateUnion(value, type, opts);
      case 'tuple' :
        return validateTuple(value, type, opts);
      case 'dict' :
        return validateDict(value, type, opts);
      default :
        t.fail('Invalid kind');
    }
  }

  function validate(value, type, opts) {
    opts = opts || {};
    assert(isType(type), 'Invalid argument `type` of value `%j` supplied to `validate`, expected a type', type);
    assert(maybe(Arr).is(opts.path), 'Invalid argument `opts.path` of value `%j` supplied to `validate`, expected an `Arr`', opts.path);

    opts.path = opts.path || [];

    return _validate(value, type, opts);
  }

  // exports
  validate.Ok = Ok;
  validate.Result = Result;
  t.validate = validate;

  return t;

}));
