"use strict";

var assert = require('assert');
var v = require('../index');
var React = require('react');
var sinon = require('sinon');

var t = v.t;
var validate = v.validate;
var toPropTypes = v.toPropTypes;

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

function error(message, path, actual, expected) {
  var err = new Error(message);
  err.path = path;
  err.actual = actual;
  err.expected = expected;
  return err;
}

function validation(message, path, actual, expected) {
  return new v.Validation({errors: [error(message, path, actual, expected)]});
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
// primitives
//

describe('validate', function () {

  var validate = v.validate;

  describe('primitives', function () {
    it('should validate', function () {
      eqv(validate('a', Str), v.Ok);
      eqv(validate(1, Str), validation('value is `1`, should be a `Str`', [], 1, 'Str'));
    });
    it('should handle `messages` option', function () {
      eqv(validate(1, Str, {messages: 'mymessage'}), validation('mymessage', [], 1, 'Str'));
    });
  });

  describe('enums', function () {
    it('should validate', function () {
      eqv(validate('audio', Category), v.Ok);
      eqv(validate(1, Category), validation('value is `1`, should be a `Category`', [], 1, 'Category'));
    });
    it('should handle `messages` option', function () {
      eqv(validate(1, Category, {messages: 'mymessage'}), validation('mymessage', [], 1, 'Category'));
    });
  });

  describe('list', function () {
    it('should validate', function () {
      eqv(validate(['a'], Shippings), v.Ok);
      eqv(validate(1, Shippings), validation('value is `1`, should be a `Arr`', [], 1, 'Arr'));
      eqv(validate([1], Shippings), validation('[0] is `1`, should be a `Str`', [0], 1, 'Str'));
    });
    it('should handle `messages` option', function () {
      eqv(validate(1, Shippings, {messages: 'mymessage'}), validation('mymessage', [], 1, 'Arr'));
      eqv(validate([1], Shippings, {messages: 'mymessage'}), validation('mymessage', [0], 1, 'Str'));
      eqv(validate(1, Shippings, {messages: {':input': 'should be a list'}}), validation('should be a list', [], 1, 'Arr'));
      eqv(validate([1], Shippings, {messages: {':type': 'should be a string'}}), validation('should be a string', [0], 1, 'Str'));
    });
  });

  describe('maybe', function () {
    it('should validate', function () {
      eqv(validate(null, Description), v.Ok);
      eqv(validate('a', Description), v.Ok);
      eqv(validate(1, Description), validation('value is `1`, should be a `Str`', [], 1, 'Str'));
    });
    it('should handle `messages` option', function () {
      eqv(validate(1, Description, {messages: 'mymessage'}), validation('mymessage', [], 1, 'Str'));
    });
  });

  describe('struct', function () {

    var Point = struct({
      x: Num,
      y: Num
    });

    it('should validate', function () {
      eqv(validate({x: 0, y: 0}, Point), v.Ok);
      eqv(validate(null, Point), validation('value is `null`, should be an `Obj`', [], null, 'Obj'));
      eqv(validate({x: 0}, Point), validation('["y"] is `undefined`, should be a `Num`', ['y'], undefined, 'Num'));
      eqv(validate({x: 0, y: 'a'}, Point), validation('["y"] is `"a"`, should be a `Num`', ['y'], 'a', 'Num'));
    });
    it('should handle `messages` option', function () {
      eqv(validate(1, Point, {messages: 'mymessage'}), validation('mymessage', [], 1, 'Obj'));
      eqv(validate({x: 0}, Point, {messages: 'mymessage'}), validation('mymessage', ['y'], undefined, 'Num'));
      eqv(validate(1, Point, {messages: {':input': 'should be an obj'}}), validation('should be an obj', [], 1, 'Obj'));
      eqv(validate({x: 0, y: 'a'}, Point, {messages: {'y': 'y should be an obj'}}), validation('y should be an obj', ['y'], 'a', 'Num'));
    });
  });

  describe('subtype', function () {
    it('should validate', function () {
      eqv(validate('http://gcanti.github.io', URL), v.Ok);
      eqv(validate(1, URL), validation('value is `1`, should be a `Str`', [], 1, 'Str'));
      eqv(validate('a', URL), validation('value is `"a"`, should be a `URL`', [], 'a', 'URL'));
    });
    it('should handle `messages` option', function () {
      eqv(validate(1, URL, {messages: 'mymessage'}), validation('mymessage', [], 1, 'Str'));
      eqv(validate(1, URL, {messages: {':type': 'should be a string'}}), validation('should be a string', [], 1, 'Str'));
      eqv(validate('a', URL, {messages: {':predicate': 'should be a URL'}}), validation('should be a URL', [], 'a', 'URL'));
    });
  });

  describe('tuple', function () {
    it('should validate', function () {
      eqv(validate([1, 2], Dimension), v.Ok);
      eqv(validate(1, Dimension), validation('value is `1`, should be a `Arr of length 2`', [], 1, 'Arr of length 2'));
      eqv(validate([1], Dimension), validation('value is `[1]`, should be a `Arr of length 2`', [], [1], 'Arr of length 2'));
      eqv(validate([1, 2, 3], Dimension), validation('value is `[1,2,3]`, should be a `Arr of length 2`', [], [1, 2, 3], 'Arr of length 2'));
      eqv(validate([1, 'a'], Dimension), validation('[1] is `"a"`, should be a `Num`', [1], 'a', 'Num'));
    });
    it('should handle `messages` option', function () {
      eqv(validate(1, Dimension, {messages: 'mymessage'}), validation('mymessage', [], 1, 'Arr of length 2'));
      eqv(validate(1, Dimension, {messages: {':input': 'should be an array'}}), validation('should be an array', [], 1, 'Arr of length 2'));
      eqv(validate([1], Dimension, {messages: {':input': 'should be an array'}}), validation('should be an array', [], [1], 'Arr of length 2'));
      eqv(validate([1, 'a'], Dimension, {messages: {'1': 'should be a number'}}), validation('should be a number', [1], 'a', 'Num'));
    });
  });

  describe('union', function () {
    it('should validate', function () { 
      eqv(validate(1, Price), v.Ok);
      eqv(validate({currency: 'EUR', amount: 100}, Price), v.Ok);
      eqv(validate('a', Price), validation('value is `"a"`, should be a `Price`', [], 'a', 'Price'));
      eqv(validate({}, Price), {errors: [
        error('["currency"] is `undefined`, should be a `Str`', ['currency'], undefined, 'Str'),
        error('["amount"] is `undefined`, should be a `Num`', ['amount'], undefined, 'Num')
      ]});
    });
    it('should handle `messages` option', function () {
      eqv(validate('a', Price, {messages: 'mymessage'}), validation('mymessage', [], 'a', 'Price'));
      eqv(validate('a', Price, {messages: {':dispatch': 'should be a Price'}}), validation('should be a Price', [], 'a', 'Price'));
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
        eqv(validate(p, Product, {messages: messages}), validation('name should be a string', ['name'], null, 'Str'));
        p = getPatch({desc: 1});
        eqv(validate(p, Product, {messages: messages}), validation('desc should be an optional string', ['desc'], 1, 'Str'));
        p = getPatch({home: 1});
        eqv(validate(p, Product, {messages: messages}), validation('home should be a string', ['home'], 1, 'Str'));
        p = getPatch({home: 'a'});
        eqv(validate(p, Product, {messages: messages}), validation('home should be an URL', ['home'], 'a', 'URL'));
        p = getPatch({shippings: 1});
        eqv(validate(p, Product, {messages: messages}), validation('shippings should be a list of strings', ['shippings'], 1, 'Arr'));
        p = getPatch({shippings: [1]});
        eqv(validate(p, Product, {messages: messages}), validation('every element of shippings should be a string', ['shippings', 0], 1, 'Str'));
        p = getPatch({category: 1});
        eqv(validate(p, Product, {messages: messages}), validation('category should be a valid enum', ['category'], 1, 'Category'));
        p = getPatch({price: 'a'});
        eqv(validate(p, Product, {messages: messages}), validation('price should be expressed in dollars or in another currency', ['price'], 'a', 'Price'));
        p = getPatch({price: -1});
        eqv(validate(p, Product, {messages: messages}), validation('price should be a positive number', ['price'], -1, 'Positive'));
        p = getPatch({dim: -1});
        eqv(validate(p, Product, {messages: messages}), validation('dim should be an array of length 2', ['dim'], -1, 'Arr of length 2'));
        p = getPatch({dim: []});
        eqv(validate(p, Product, {messages: messages}), validation('dim should be an array of length 2', ['dim'], [], 'Arr of length 2'));
        p = getPatch({dim: [1]});
        eqv(validate(p, Product, {messages: messages}), validation('dim should be an array of length 2', ['dim'], [1], 'Arr of length 2'));
        p = getPatch({dim: [1, 2, 3]});
        eqv(validate(p, Product, {messages: messages}), validation('dim should be an array of length 2', ['dim'], [1, 2, 3], 'Arr of length 2'));
        p = getPatch({dim: [1, 'a']});
        eqv(validate(p, Product, {messages: messages}), validation('dim.height should be a number', ['dim', 1], 'a', 'Num'));
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
        eqv(validate(p, Product, {messages: messages}), validation('name', ['name'], null, 'Str'));
        p = getPatch({desc: 1});
        eqv(validate(p, Product, {messages: messages}), validation('desc', ['desc'], 1, 'Str'));
        p = getPatch({home: 1});
        eqv(validate(p, Product, {messages: messages}), validation('home', ['home'], 1, 'Str'));
        p = getPatch({home: 'a'});
        eqv(validate(p, Product, {messages: messages}), validation('home', ['home'], 'a', 'URL'));
        p = getPatch({shippings: 1});
        eqv(validate(p, Product, {messages: messages}), validation('shippings', ['shippings'], 1, 'Arr'));
        p = getPatch({shippings: [1]});
        eqv(validate(p, Product, {messages: messages}), validation('shippings', ['shippings', 0], 1, 'Str'));
        p = getPatch({category: 1});
        eqv(validate(p, Product, {messages: messages}), validation('category', ['category'], 1, 'Category'));
        p = getPatch({price: 'a'});
        eqv(validate(p, Product, {messages: messages}), validation('price', ['price'], 'a', 'Price'));
        p = getPatch({price: -1});
        eqv(validate(p, Product, {messages: messages}), validation('price', ['price'], -1, 'Positive'));
        p = getPatch({dim: -1});
        eqv(validate(p, Product, {messages: messages}), validation('dim', ['dim'], -1, 'Arr of length 2'));
        p = getPatch({dim: []});
        eqv(validate(p, Product, {messages: messages}), validation('dim', ['dim'], [], 'Arr of length 2'));
        p = getPatch({dim: [1]});
        eqv(validate(p, Product, {messages: messages}), validation('dim', ['dim'], [1], 'Arr of length 2'));
        p = getPatch({dim: [1, 2, 3]});
        eqv(validate(p, Product, {messages: messages}), validation('dim', ['dim'], [1, 2, 3], 'Arr of length 2'));
        p = getPatch({dim: [1, 'a']});
        eqv(validate(p, Product, {messages: messages}), validation('dim', ['dim', 1], 'a', 'Num'));
      });
    });

    describe('React propTypes', function () {

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

        eq(calls[0], 'Warning: this.props.category of value `undefined` supplied to `ProductComponent`, expected a `Category`');
        eq(calls[1], 'Warning: this.props.desc of value `1` supplied to `ProductComponent`, expected a `Str`');
        eq(calls[2], 'Warning: this.props.dim of value `undefined` supplied to `ProductComponent`, expected a `Arr of length 2`');
        eq(calls[3], 'Warning: this.props.home of value `undefined` supplied to `ProductComponent`, expected a `Str`');
        eq(calls[4], 'Warning: this.props.name of value `undefined` supplied to `ProductComponent`, expected a `Str`');
        eq(calls[5], 'Warning: this.props.price of value `undefined` supplied to `ProductComponent`, expected a `Price`');
        eq(calls[6], 'Warning: this.props.shippings of value `undefined` supplied to `ProductComponent`, expected a `Arr`');

        console.warn = warn;
      });

    });

  });

});

// define the component props
var MyProps = struct({
  foo: Num,
  bar: subtype(Str, function (s) { return s.length <= 3; }, 'Bar')
});

// component definition
var MyComponent = React.createClass({
  propTypes: toPropTypes(MyProps), // <- here!
  render: function () {
    return (
      React.DOM.div()
    );
  }    
});

// try to use bad props
var props = {
  "foo": "this is a string, not a number", 
  "bar": "this is a string too long"
};

// rendering
React.renderComponentToString(MyComponent(props));

