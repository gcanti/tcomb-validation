'use strict';

var t = require('tcomb');

var Any = t.Any;
var Nil = t.Nil;
var Bool = t.Bool;
var Err = t.Err;
var Str = t.Str;
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

function ko(message, path) {
  return new Validation({
    errors: [
      new Error(formatError(message, {path: path}))
    ]
  });
}

// TODO: optimize
function formatError(message, params) {
  params = params || {};
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

function validatePrimitive(value, type, path, message) {
  assert(isType(type) && type.meta.kind in {any: 1, primitive: 1, enums: 1});
  assert(maybe(Str).is(message));

  path = path || 'root';
  
  if (!type.is(value)) {
    message = message || format(':path is `%j`, should be a `%s`', value, getName(type));
    return ko(message, path);
  }
  return Ok;
}

function validateStruct(value, type, path, messages) {
  assert(isType(type) && type.meta.kind === 'struct');

  path = path || 'root';

  var isValid = Obj.is(value);

  if (!isValid) {
    var message = getMessage(messages, ':struct', format(':path is `%j`, should be an `Obj`', value));
    return ko(message, path);
  }

  var errors = [];
  var props = type.meta.props;
  for (var k in props) {
    if (props.hasOwnProperty(k)) {
      var validation = validate(value[k], props[k], path + '[' + JSON.stringify(k) + ']', getMessage(messages, k));
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

function validateMaybe(value, type, path, messages) {
  assert(isType(type) && type.meta.kind === 'maybe');

  if (!Nil.is(value)) {
    return validate(value, type.meta.type, path, messages);
  }

  return Ok;
}

function validateSubtype(value, type, path, messages) {
  assert(isType(type) && type.meta.kind === 'subtype');

  path = path || 'root';

  var validation = validate(value, type.meta.type, path, getMessage(messages, ':type'));
  if (!validation.isValid()) {
    return validation;
  }

  var predicate = type.meta.predicate;
  if (!predicate(value)) {
    var message = getMessage(messages, ':predicate', format(':path is `%j`, should be truthy for the predicate`', value));
    return ko(message, path);
  }

  return Ok;
}

function validateList(value, type, path, messages) {
  assert(isType(type) && type.meta.kind === 'list');

  path = path || 'root';

  var isValid = Arr.is(value);

  if (!isValid) {
    var message = getMessage(messages, ':list', format(':path is `%j`, should be an `Arr`', value));
    return ko(message, path);
  }

  var errors = [];
  for (var i = 0, len = value.length ; i < len ; i++ ) {
    var validation = validate(value[i], type.meta.type, path + '[' + i + ']', getMessage(messages, ':type'));
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

function validateUnion(value, type, path, messages) {
  assert(isType(type) && type.meta.kind === 'union');
  assert(Func.is(type.dispatch), 'unimplemented %s.dispatch()', getName(type));

  path = path || 'root';

  var ctor = type.dispatch(value);

  if (!Func.is(ctor)) {
    var message = getMessage(messages, ':dispatch', format(':path is `%j`, should be a `%s`', value, getName(type)));
    return ko(message, path);
  }

  var validation = validate(value, ctor, path, messages);
  if (!validation.isValid()) {
    return validation;
  }

  return Ok;
}

function validateTuple(value, type, path, messages) {
  assert(isType(type) && type.meta.kind === 'tuple');

  path = path || 'root';

  var types = type.meta.types;
  var len = types.length;
  var isValid = Arr.is(value) && value.length === len;

  if (!isValid) {
    var message = getMessage(messages, ':tuple', format(':path is `%j`, should be an `Arr` of length `%s`', value, len));
    return ko(message, path);
  }

  var errors = [];
  for (var i = 0 ; i < len ; i++ ) {
    var validation = validate(value[i], types[i], path + '[' + i + ']', getMessage(messages, i));
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

function validate(value, type, path, messages) {
  assert(isType(type), 'Invalid argument `type` of value `%j` supplied to `validate`, expected a type', type);
  assert(maybe(Str).is(path), 'Invalid argument `path` of value `%j` supplied to `validate`, expected a `Str`', path);

  var kind = type.meta.kind;
  switch (kind) {
    case 'any' :
    case 'primitive' :
    case 'enums' :
      return validatePrimitive(value, type, path, messages);
    case 'struct' :
      return validateStruct(value, type, path, messages);
    case 'maybe' :
      return validateMaybe(value, type, path, messages);
    case 'list' :
      return validateList(value, type, path, messages);
    case 'subtype' :
      return validateSubtype(value, type, path, messages);
    case 'union' :
      return validateUnion(value, type, path, messages);
    case 'tuple' :
      return validateTuple(value, type, path, messages);
    default :
      t.fail('Invalid kind `%s` supplied to `validate`, expected an handled kind', kind);
  }
}

module.exports = {

  // export tcomb for convenience
  t: t,

  // utils
  Validation: Validation,
  formatError: formatError,

  validate: validate

};