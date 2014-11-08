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

  var Any = t.Any;
  var Obj = t.Obj;
  var Str = t.Str;
  var Arr = t.Arr;
  var struct = t.struct;
  var list = t.list;
  var format = t.util.format;

  //
  // domain model
  //

  var ValidationError = struct({
    message: Str,
    actual: Any,
    expected: t.Type,
    path: list(t.union([Str, t.Num]))
  }, 'ValidationError');

  function getDefaultMessage(actual, expected, path) {
    return format('%s is `%j` should be a `%s`', '/' + path.join('/'), actual, t.util.getName(expected));
  }

  ValidationError.of = function (actual, expected, path) {
    return new ValidationError({
      message: getDefaultMessage(actual, expected, path),
      actual: actual,
      expected: expected,
      path: path
    });
  };

  var ValidationResult = struct({
    errors: list(ValidationError),
    value: Any
  }, 'Result');

  ValidationResult.prototype.isValid = function() {
    return !(this.errors.length);
  };

  ValidationResult.prototype.toString = function() {
    return this.isValid() ?
      format('[ValidationResult, true, %j]', this.value) :
      format('[ValidationResult, false, (%s)]', this.errors.map(function (err) {
        return err.message;
      }).join(', '));
  };

  //
  // validate
  //

  function _validate(x, type, path) {
    var kind = t.util.getKind(type);
    return validators[kind](x, type, path);
  }

  function validate(x, type) {
    return new ValidationResult(_validate(x, type, []));
  }

  var validators = {};

  // irriducibles, enums, subtypes
  validators.irriducible = 
  validators.enums = function (x, type, path) {
    return {
      value: x,
      errors: type.is(x) ? [] : [ValidationError.of(x, type, path)]
    };
  };

  validators.list = function (x, type, path) {

    // x should be an array
    if (!Arr.is(x)) {
      return {value: x, errors: [ValidationError.of(x, type, path)]};
    }

    var ret = {value: [], errors: []};
    // every item should be of type `type.meta.type`
    for (var i = 0, len = x.length ; i < len ; i++ ) {
      var item = _validate(x[i], type.meta.type, path.concat(i));
      ret.value[i] = item.value;
      ret.errors = ret.errors.concat(item.errors);
    }
    return ret;
  };

  validators.subtype = function (x, type, path) {

    // should be a valid inner type
    var ret = _validate(x, type.meta.type, path);
    if (ret.errors.length) {
      return ret;
    }

    // should satisfy the predicate
    if (!type.meta.predicate(ret.value)) {
      ret.errors = [ValidationError.of(x, type, path)];
    }

    return ret;

  };

  validators.maybe = function (x, type, path) {
    return t.Nil.is(x) ?
      {value: null, errors: []} :
      _validate(x, type.meta.type, path);
  };

  validators.struct = function (x, type, path) {

    // x should be an object
    if (!Obj.is(x)) {
      return {value: x, errors: [ValidationError.of(x, type, path)]};
    }

    var ret = {value: {}, errors: []};
    var props = type.meta.props;
    // every item should be of type `props[name]`
    for (var name in props) {
      if (props.hasOwnProperty(name)) {
        var prop = _validate(x[name], props[name], path.concat(name));
        ret.value[name] = prop.value;
        ret.errors = ret.errors.concat(prop.errors);
      }
    }
    if (!ret.errors.length) {
      ret.value = new type(ret.value);
    }
    return ret;    
  };

  validators.tuple = function (x, type, path) {

    var types = type.meta.types;
    var len = types.length;

    // x should be an array of `len` items
    if (!Arr.is(x) || x.length > len) {
      return {value: x, errors: [ValidationError.of(x, type, path)]};
    }

    var ret = {value: [], errors: []};
    // every item should be of type `types[i]`
    for (var i = 0 ; i < len ; i++ ) {
      var item = _validate(x[i], types[i], path.concat(i));
      ret.value[i] = item.value;
      ret.errors = ret.errors.concat(item.errors);
    }
    return ret;
  };

  validators.dict = function (x, type, path) {

    // x should be an object
    if (!Obj.is(x)) {
      return {value: x, errors: [ValidationError.of(x, type, path)]};
    }

    var ret = {value: {}, errors: []};
    // every key should be of type `domain`
    // every value should be of type `codomain`
    for (var k in x) {
      if (x.hasOwnProperty(k)) {
        path = path.concat(k);
        var key = _validate(k, type.meta.domain, path);
        var item = _validate(x[k], type.meta.codomain, path);
        ret.value[k] = item.value;
        ret.errors = ret.errors.concat(key.errors, item.errors);
      }
    }
    return ret;
  };

  validators.union = function (x, type, path) {
    var ctor = type.dispatch(x);
    return t.Func.is(ctor)?
      _validate(x, ctor, path.concat(type.meta.types.indexOf(ctor))) :
      {value: x, errors: [ValidationError.of(x, type, path)]};
  };

  // exports
  t.util.mixin(t, {
    ValidationError: ValidationError,
    ValidationResult: ValidationResult,
    validate: validate
  });

  return t;

}));
