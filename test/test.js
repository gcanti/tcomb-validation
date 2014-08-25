"use strict";

var assert = require('assert');
var v = require('../index');
var React = require('react');
var sinon = require('sinon');

var t = v.t;
var validate = v.validate;

var Str = t.Str;
var Num = t.Num;
var Err = t.Err;
var Arr = t.Arr;
var Nil = t.Nil;
var Obj = t.Obj;
var list = t.list;
var maybe = t.maybe;
var union = t.union;
var enums = t.enums;
var subtype = t.subtype;
var struct = t.struct;
var tuple = t.tuple;

//
// setup
//

var ok = function (x) { assert.strictEqual(true, x); };
var ko = function (x) { assert.strictEqual(false, x); };
var eq = assert.strictEqual; 
var throwsWithMessage = function (f, message) {
    assert['throws'](f, function (err) {
        ok(err instanceof Error);
        eq(err.message, message);
        return true;
    });
};
var doesNotThrow = assert.doesNotThrow;

// seems like assert.deepEqual doesn't handle Error objects
var eqv = function (a, b, message) {
  assert.deepEqual(a, b, message);
  if (Nil.is(a.errors)) {
    eq(b.errors, null, message);
  } else {
    ok(Arr.is(a.errors), message);
    ok(Arr.is(b.errors), message);
    eq(a.errors.length, b.errors.length, message);
    a.errors.forEach(function (e, i) {
      ok(Err.is(e), message);
      ok(Err.is(b.errors[i]), message);
      assert.deepEqual(e.message, b.errors[i].message, message);
    });
  }
}; 

function error(message, path) {
  var err = new Error(message);
  err.path = path;
  return err;
}

function validation(message, path) {
  return new v.Validation({errors: [error(message, path)]});
}

//
// models
//

var Description = maybe(Str);

var URL = t.subtype(Str, function (s) { return s.indexOf('http://') === 0; }, 'URL');

var Shippings = list(Str, 'Shippings');

var Category = enums.of('audio video', 'Category');

var Positive = subtype(t.Num, function (n) { return n >= 0; }, 'Positive');

var ForeignPrice = struct({ 
  currency: Str, 
  amount:   Positive 
}, 'ForeignPrice');

var Price = union([Positive, ForeignPrice], 'Price');
Price.dispatch = function (value) {
  if (Num.is(value)) {
    return Positive;
  } else if (Obj.is(value)) {
    return ForeignPrice;
  }
};

var Dimension = tuple([Num, Num]);

var Product = struct({
  name:       Str,                  
  desc:       Description,
  home:       URL,
  shippings:  Shippings,       
  category:   Category,         
  price:      Price,
  dim:        Dimension
}, 'Product');

//
// utils
//

describe('formatError', function () {

  var formatError = v.formatError;
  
  it('should handle no params', function () {
    eq(formatError('a'), 'a');
  });
  it('should handle the params', function () {
    eq(formatError(':greetings', {greetings: 'hello'}), 'hello');
  });
});

describe('toXPath', function () {

  var toXPath = v.toXPath;
  
  it('should format an array to xpath', function () {
    eq(toXPath(), 'value');
    eq(toXPath([]), 'value');
    eq(toXPath(['x']), 'x');
    eq(toXPath([1]), '[1]');
    eq(toXPath(['x', 1]), 'x[1]');
    eq(toXPath([1, 'x']), '[1]/x');
    eq(toXPath(['x', 'y', 1]), 'x/y[1]');
  });
});

//
// primitives
//

describe('validate', function () {

  var validate = v.validate;

  describe('primitives', function () {
    it('should validate', function () {
      eqv(validate('a', Str), v.Ok);
      eqv(validate(1, Str), validation('value is `1`, should be a `Str`', []));
    });
    it('should handle `path` argument', function () {
      eqv(validate(1, Str, {path: ['model']}), validation('model is `1`, should be a `Str`', ['model']));
    });
    it('should handle `message` argument', function () {
      eqv(validate(1, Str, {messages: 'mymessage'}), validation('mymessage', []));
      eqv(validate(1, Str, {path: ['model'], messages: ':xpath mymessage'}), validation('model mymessage', ['model']));
    });
  });

  describe('enums', function () {
    it('should validate', function () {
      eqv(validate('audio', Category), v.Ok);
      eqv(validate(1, Category), validation('value is `1`, should be a `Category`', []));
    });
    it('should handle `path` argument', function () {
      eqv(validate(1, Category, {path: ['model']}), validation('model is `1`, should be a `Category`', ['model']));
    });
    it('should handle `message` argument', function () {
      eqv(validate(1, Category, {messages: 'mymessage'}), validation('mymessage', []));
      eqv(validate(1, Category, {path: ['model'], messages: ':xpath mymessage'}), validation('model mymessage', ['model']));
    });
  });

  describe('list', function () {
    it('should validate', function () {
      eqv(validate(['a'], Shippings), v.Ok);
      eqv(validate(1, Shippings), validation('value is `1`, should be an `Arr`', []));
      eqv(validate([1], Shippings), validation('[0] is `1`, should be a `Str`', [0]));
    });
    it('should handle `path` argument', function () {
      eqv(validate(1, Shippings, {path: ['model']}), validation('model is `1`, should be an `Arr`', ['model']));
      eqv(validate([1], Shippings, {path: ['model']}), validation('model[0] is `1`, should be a `Str`', ['model', 0]));
    });
    it('should handle `message` argument', function () {
      eqv(validate(1, Shippings, {messages: 'mymessage'}), validation('mymessage', []));
      eqv(validate([1], Shippings, {messages: 'mymessage'}), validation('mymessage', [0]));
      eqv(validate(1, Shippings, {path: ['model'], messages: ':xpath mymessage'}), validation('model mymessage', ['model']));
      eqv(validate([1], Shippings, {path: ['model'], messages: ':xpath mymessage'}), validation('model[0] mymessage', ['model', 0]));
      eqv(validate(1, Shippings, {messages: {':input': 'should be a list'}}), validation('should be a list', []));
      eqv(validate([1], Shippings, {messages: {':input': 'should be a list'}}), validation('[0] is `1`, should be a `Str`', [0]));
      eqv(validate([1], Shippings, {messages: {':type': 'should be a string'}}), validation('should be a string', [0]));
      eqv(validate([1], Shippings, {messages: {':type': ':xpath should be a string'}}), validation('[0] should be a string', [0]));
    });
  });

  describe('maybe', function () {
    it('should validate', function () {
      eqv(validate(null, Description), v.Ok);
      eqv(validate('a', Description), v.Ok);
      eqv(validate(1, Description), validation('value is `1`, should be a `Str`', []));
    });
    it('should handle `path` argument', function () {
      eqv(validate(1, Description, {path: ['model']}), validation('model is `1`, should be a `Str`', ['model']));
    });
    it('should handle `message` argument', function () {
      eqv(validate(1, Description, {messages: 'mymessage'}), validation('mymessage', []));
      eqv(validate(1, Description, {path: ['model'], messages: ':xpath mymessage'}), validation('model mymessage', ['model']));
    });
  });

  describe('struct', function () {

    var Point = struct({
      x: Num,
      y: Num
    });

    it('should validate', function () {
      eqv(validate({x: 0, y: 0}, Point), v.Ok);
      eqv(validate(null, Point), validation('value is `null`, should be an `Obj`', []));
      eqv(validate({x: 0}, Point), validation('y is `undefined`, should be a `Num`', ['y']));
      eqv(validate({x: 0, y: 'a'}, Point), validation('y is `"a"`, should be a `Num`', ['y']));
    });
    it('should handle `path` argument', function () {
      eqv(validate(1, Point, {path: ['model']}), validation('model is `1`, should be an `Obj`', ['model']));
    });
    it('should handle `message` argument', function () {
      eqv(validate(1, Point, {messages: 'mymessage'}), validation('mymessage', []));
      eqv(validate({x: 0}, Point, {messages: 'mymessage'}), validation('mymessage', ['y']));
      eqv(validate(1, Point, {path: ['model'], messages: ':xpath mymessage'}), validation('model mymessage', ['model']));
      eqv(validate({x: 0}, Point, {path: ['model'], messages: ':xpath mymessage'}), validation('model/y mymessage', ['model', 'y']));
      eqv(validate(1, Point, {messages: {':input': 'should be an obj'}}), validation('should be an obj', []));
      eqv(validate({x: 0, y: 'a'}, Point, {messages: {'y': 'y should be an obj'}}), validation('y should be an obj', ['y']));
    });
  });

  describe('subtype', function () {
    it('should validate', function () {
      eqv(validate('http://gcanti.github.io', URL), v.Ok);
      eqv(validate(1, URL), validation('value is `1`, should be a `Str`', []));
      eqv(validate('a', URL), validation('value is `"a"`, should be truthy for the predicate', []));
    });
    it('should handle `path` argument', function () {
      eqv(validate(1, URL, {path: ['model']}), validation('model is `1`, should be a `Str`', ['model']));
    });
    it('should handle `message` argument', function () {
      eqv(validate(1, URL, {messages: 'mymessage'}), validation('mymessage', []));
      eqv(validate(1, URL, {path: ['model'], messages: ':xpath mymessage'}), validation('model mymessage', ['model']));
      eqv(validate(1, URL, {messages: {':type': 'should be a string'}}), validation('should be a string', []));
      eqv(validate('a', URL, {messages: {':predicate': 'should be a URL'}}), validation('should be a URL', []));
    });
  });

  describe('tuple', function () {
    it('should validate', function () {
      eqv(validate([1, 2], Dimension), v.Ok);
      eqv(validate(1, Dimension), validation('value is `1`, should be an `Arr` of length `2`', []));
      eqv(validate([1], Dimension), validation('value is `[1]`, should be an `Arr` of length `2`', []));
      eqv(validate([1, 2, 3], Dimension), validation('value is `[1,2,3]`, should be an `Arr` of length `2`', []));
      eqv(validate([1, 'a'], Dimension), validation('[1] is `"a"`, should be a `Num`', [1]));
    });
    it('should handle `path` argument', function () {
      eqv(validate(1, Dimension, {path: ['model']}), validation('model is `1`, should be an `Arr` of length `2`', ['model']));
    });
    it('should handle `message` argument', function () {
      eqv(validate(1, Dimension, {messages: 'mymessage'}), validation('mymessage', []));
      eqv(validate(1, Dimension, {path: ['model'], messages: ':xpath mymessage'}), validation('model mymessage', ['model']));
      eqv(validate(1, Dimension, {messages: {':input': 'should be an array'}}), validation('should be an array', []));
      eqv(validate([1], Dimension, {messages: {':input': 'should be an array'}}), validation('should be an array', []));
      eqv(validate([1, 'a'], Dimension, {messages: {'1': 'should be a number'}}), validation('should be a number', [1]));
    });
  });

  describe('union', function () {
    it('should validate', function () { 
      eqv(validate(1, Price), v.Ok);
      eqv(validate({currency: 'EUR', amount: 100}, Price), {errors: null});
      eqv(validate('a', Price), validation('value is `"a"`, should be a `Price`', []));
      eqv(validate({}, Price), {errors: [
        error('currency is `undefined`, should be a `Str`', ['currency']),
        error('amount is `undefined`, should be a `Num`', ['amount'])
      ]});
    });
    it('should handle `path` argument', function () {
      eqv(validate('a', Price, {path: ['model']}), validation('model is `"a"`, should be a `Price`', ['model']));
    });
    it('should handle `message` argument', function () {
      eqv(validate('a', Price, {messages: 'mymessage'}), validation('mymessage', []));
      eqv(validate('a', Price, {path: ['model'], messages: ':xpath mymessage'}), validation('model mymessage', ['model']));
      eqv(validate('a', Price, {messages: {':dispatch': 'should be a Price'}}), validation('should be a Price', []));
    });
  });

  describe('use cases', function () {

    var product = {
        name: 'iPod',
        desc: 'Engineered for maximum funness.', 
        home: 'http://www.apple.com/ipod/', 
        shippings: ['Same Day', 'Next Businness Day'], 
        category: 'audio', 
        price: {currency: 'EUR', amount: 100}, 
        dim: [2.4, 4.2] 
    };

    var getPatch = function (patch) {
      return t.mixin(t.mixin({}, product), patch, true);
    };

    describe('custom messages', function () {

      var p;
      var messages = {
        ':input':  'product should be an object',
        name:       'name should be a string',                  
        desc:       'desc should be an optional string',
        home:       {':type': 'home should be a string', ':predicate': 'home should be an URL'},
        shippings:  {':input': 'shippings should be a list of strings', ':type': 'every element of shippings should be a string'},       
        category:   'category should be a valid enum',         
        price:      {':dispatch': 'price should be expressed in dollars or in another currency', 0: 'price should be a positive number', 1: {':struct': 'price should be an object', currency: 'currency should be a currency', amount: 'amount should be a positive number'}},
        dim:        {':input': 'dim should be an array of length 2', 0: 'dim.width should be a number', 1: 'dim.height should be a number'}
      };

      it('should return custom messages', function () {
        p = getPatch({name: null});
        eqv(validate(p, Product, {messages: messages}), validation('name should be a string', ['name']));
        p = getPatch({desc: 1});
        eqv(validate(p, Product, {messages: messages}), validation('desc should be an optional string', ['desc']));
        p = getPatch({home: 1});
        eqv(validate(p, Product, {messages: messages}), validation('home should be a string', ['home']));
        p = getPatch({home: 'a'});
        eqv(validate(p, Product, {messages: messages}), validation('home should be an URL', ['home']));
        p = getPatch({shippings: 1});
        eqv(validate(p, Product, {messages: messages}), validation('shippings should be a list of strings', ['shippings']));
        p = getPatch({shippings: [1]});
        eqv(validate(p, Product, {messages: messages}), validation('every element of shippings should be a string', ['shippings', 0]));
        p = getPatch({category: 1});
        eqv(validate(p, Product, {messages: messages}), validation('category should be a valid enum', ['category']));
        p = getPatch({price: 'a'});
        eqv(validate(p, Product, {messages: messages}), validation('price should be expressed in dollars or in another currency', ['price']));
        p = getPatch({price: -1});
        eqv(validate(p, Product, {messages: messages}), validation('price should be a positive number', ['price']));
        p = getPatch({dim: -1});
        eqv(validate(p, Product, {messages: messages}), validation('dim should be an array of length 2', ['dim']));
        p = getPatch({dim: []});
        eqv(validate(p, Product, {messages: messages}), validation('dim should be an array of length 2', ['dim']));
        p = getPatch({dim: [1]});
        eqv(validate(p, Product, {messages: messages}), validation('dim should be an array of length 2', ['dim']));
        p = getPatch({dim: [1, 2, 3]});
        eqv(validate(p, Product, {messages: messages}), validation('dim should be an array of length 2', ['dim']));
        p = getPatch({dim: [1, 'a']});
        eqv(validate(p, Product, {messages: messages}), validation('dim.height should be a number', ['dim', 1]));
      });
    });

    describe('form validation', function () {

      var p;
      var messages = {
        "name": "name",
        "desc": "desc",
        "home": "home",
        "shippings": "shippings",
        "category": "category",
        "price": "price",
        "dim": "dim"
      };

      it('should return the name of the prop', function () {
        p = getPatch({name: null});
        eqv(validate(p, Product, {messages: messages}), validation('name', ['name']));
        p = getPatch({desc: 1});
        eqv(validate(p, Product, {messages: messages}), validation('desc', ['desc']));
        p = getPatch({home: 1});
        eqv(validate(p, Product, {messages: messages}), validation('home', ['home']));
        p = getPatch({home: 'a'});
        eqv(validate(p, Product, {messages: messages}), validation('home', ['home']));
        p = getPatch({shippings: 1});
        eqv(validate(p, Product, {messages: messages}), validation('shippings', ['shippings']));
        p = getPatch({shippings: [1]});
        eqv(validate(p, Product, {messages: messages}), validation('shippings', ['shippings', 0]));
        p = getPatch({category: 1});
        eqv(validate(p, Product, {messages: messages}), validation('category', ['category']));
        p = getPatch({price: 'a'});
        eqv(validate(p, Product, {messages: messages}), validation('price', ['price']));
        p = getPatch({price: -1});
        eqv(validate(p, Product, {messages: messages}), validation('price', ['price']));
        p = getPatch({dim: -1});
        eqv(validate(p, Product, {messages: messages}), validation('dim', ['dim']));
        p = getPatch({dim: []});
        eqv(validate(p, Product, {messages: messages}), validation('dim', ['dim']));
        p = getPatch({dim: [1]});
        eqv(validate(p, Product, {messages: messages}), validation('dim', ['dim']));
        p = getPatch({dim: [1, 2, 3]});
        eqv(validate(p, Product, {messages: messages}), validation('dim', ['dim']));
        p = getPatch({dim: [1, 'a']});
        eqv(validate(p, Product, {messages: messages}), validation('dim', ['dim', 1]));
      });
    });

    describe('React propTypes', function () {

      function toPropTypes(Struct) {
        var propTypes = {};
        var props = Struct.meta.props;
        Object.keys(props).sort().forEach(function (k) {
          propTypes[k] = function (values, name, component) {
            var T = props[name];
            var value = values[name];
            return validate(value, T, {path: ['product', k]}).firstError();
          }
        });
        return propTypes;
      }

      var p = {desc: 1};

      var ProductComponent = React.createClass({
        displayName: 'ProductComponent',
        propTypes: toPropTypes(Product),
        render: function () {
          return React.DOM.div();
        }
      });

      it('should call console.warn when there is an error', function () {
        var spy = sinon.spy();
        var warn = console.warn;
        console.warn = spy;
        React.renderComponentToString(ProductComponent(p));

        var calls = [
          spy.getCall(0).args[0],
          spy.getCall(1).args[0],
          spy.getCall(2).args[0],
          spy.getCall(3).args[0],
          spy.getCall(4).args[0],
          spy.getCall(5).args[0],
          spy.getCall(6).args[0]
        ].sort();

        eq(calls[0], 'Warning: product/category is `undefined`, should be a `Category`');
        eq(calls[1], 'Warning: product/desc is `1`, should be a `Str`');
        eq(calls[2], 'Warning: product/dim is `undefined`, should be an `Arr` of length `2`');
        eq(calls[3], 'Warning: product/home is `undefined`, should be a `Str`');
        eq(calls[4], 'Warning: product/name is `undefined`, should be a `Str`');
        eq(calls[5], 'Warning: product/price is `undefined`, should be a `Price`');
        eq(calls[6], 'Warning: product/shippings is `undefined`, should be an `Arr`');

        console.warn = warn;
      });

    });

  });

});



