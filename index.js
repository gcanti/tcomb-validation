'use strict';

var t = require('tcomb');

var Any = t.Any;
var Nil = t.Nil;
var Bool = t.Bool;
var Err = t.Err;
var Str = t.Str;
var Num = t.Num;
var Arr = t.Arr;
var Obj = t.Obj;
var Func = t.Func;

var struct = t.struct;
var maybe = t.maybe;
var list = t.list;

var isType = t.isType;
var assert = t.assert;
var getName = t.getName;
var format = t.format;
var mixin = t.mixin;

//
// Validation model
//

var Validation = struct({
  errors: maybe(list(Err))
}, 'Validation');

Validation.prototype.isValid = function() {
  return !(this.errors && this.errors.length);
};

Validation.prototype.firstError = function() {
  return this.isValid() ? null : this.errors[0];
};

// cache ok result
var Ok = new Validation({errors: null});

//
// utils
//

function toJSONPath(path) {
  return path.map(function (prop) {
    return '[' + JSON.stringify(prop) + ']';
  }).join('');
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
  return new Validation({errors: [err]});
}

// TODO: optimize
function formatError(message, params) {
  for (var param in params) {
    if (params.hasOwnProperty(param)) {
      message = message.replace(new RegExp('\s?:' + param + '\s?', 'gim'), params[param]);
    }
  }
  return message;
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

function validatePrimitive(value, type, opts) {
  assert(isType(type) && type.meta.kind in {any: 1, primitive: 1, enums: 1});
  assert(maybe(Str).is(opts.messages));

  if (!type.is(value)) {
    var message = opts.messages || ':jsonpath is `:actual`, should be a `:expected`';
    return ko(message, {path: opts.path, actual: value, expected: type});
  }

  return Ok;
}

function validateStruct(value, type, opts) {
  assert(isType(type) && type.meta.kind === 'struct');

  var isValid = Obj.is(value);

  if (!isValid) {
    var message = getMessage(opts.messages, ':input', ':jsonpath is `:actual`, should be an `:expected`');
    return ko(message, {path: opts.path, actual: value, expected: Obj});
  }

  var errors = [];
  var props = type.meta.props;
  for (var k in props) {
    if (props.hasOwnProperty(k)) {
      var validation = validate(value[k], props[k], {path: opts.path.concat([k]), messages: getMessage(opts.messages, k)});
      if (!validation.isValid()) {
        isValid = false;
        errors = errors.concat(validation.errors);
      }
    }
  }

  if (!isValid) {
    return new Validation({errors: errors});
  }

  return Ok;
}

function validateMaybe(value, type, opts) {
  assert(isType(type) && type.meta.kind === 'maybe');

  if (!Nil.is(value)) {
    return validate(value, type.meta.type, opts);
  }

  return Ok;
}

function validateSubtype(value, type, opts) {
  assert(isType(type) && type.meta.kind === 'subtype');

  var validation = validate(value, type.meta.type, {path: opts.path, messages: getMessage(opts.messages, ':type')});
  if (!validation.isValid()) {
    return validation;
  }

  var predicate = type.meta.predicate;
  if (!predicate(value)) {
    var message = getMessage(opts.messages, ':predicate', ':jsonpath is `:actual`, should be a `:expected`');
    return ko(message, {path: opts.path, actual: value, expected: type});
  }

  return Ok;
}

function validateList(value, type, opts) {
  assert(isType(type) && type.meta.kind === 'list');

  var isValid = Arr.is(value);

  if (!isValid) {
    var message = getMessage(opts.messages, ':input', ':jsonpath is `:actual`, should be a `:expected`');
    return ko(message, {path: opts.path, actual: value, expected: Arr});
  }

  var errors = [];
  for (var i = 0, len = value.length ; i < len ; i++ ) {
    var validation = validate(value[i], type.meta.type, {path: opts.path.concat([i]), messages: getMessage(opts.messages, ':type')});
    if (!validation.isValid()) {
      isValid = false;
      errors = errors.concat(validation.errors);
    }
  }

  if (!isValid) {
    return new Validation({errors: errors});
  }

  return Ok;
}

function validateUnion(value, type, opts) {
  assert(isType(type) && type.meta.kind === 'union');
  assert(Func.is(type.dispatch), 'unimplemented %s.dispatch()', getName(type));

  var ctor = type.dispatch(value);

  if (!Func.is(ctor)) {
    var message = getMessage(opts.messages, ':dispatch', ':jsonpath is `:actual`, should be a `:expected`');
    return ko(message, {path: opts.path, actual: value, expected: type});
  }

  var i = type.meta.types.indexOf(ctor);
  var validation = validate(value, ctor, {path: opts.path, messages: getMessage(opts.messages, i)});
  if (!validation.isValid()) {
    return validation;
  }

  return Ok;
}

function validateTuple(value, type, opts) {
  assert(isType(type) && type.meta.kind === 'tuple');

  var types = type.meta.types;
  var len = types.length;
  var isValid = Arr.is(value) && value.length === len;

  if (!isValid) {
    var message = getMessage(opts.messages, ':input', ':jsonpath is `:actual`, should be a `:expected`');
    return ko(message, {path: opts.path, actual: value, expected: type});
  }

  var errors = [];
  for (var i = 0 ; i < len ; i++ ) {
    var validation = validate(value[i], types[i], {path: opts.path.concat([i]), messages: getMessage(opts.messages, i)});
    if (!validation.isValid()) {
      isValid = false;
      errors = errors.concat(validation.errors);
    }
  }

  if (!isValid) {
    return new Validation({errors: errors});
  }

  return Ok;
}

var kinds = '`any`, `primitive`, `enums`, `struct`, `maybe`, `list`, `subtype`, `union`, `tuple`';

function validate(value, type, opts) {
  opts = opts || {};
  assert(isType(type), 'Invalid argument `type` of value `%j` supplied to `validate`, expected a type', type);
  assert(maybe(Arr).is(opts.path), 'Invalid argument `opts.path` of value `%j` supplied to `validate`, expected an `Arr`', opts.path);

  opts.path = opts.path || [];

  var kind = type.meta.kind;
  switch (kind) {
    case 'any' :
    case 'primitive' :
    case 'enums' :
      return validatePrimitive(value, type, opts);
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
    default :
      t.fail('Invalid kind `%s` supplied to `validate`, expected one of ' + kinds, kind);
  }
}

t.addons = t.addons || {};
t.addons.validation = {
  Ok: Ok,
  Validation: Validation,
  validate: validate
};

module.exports = t;