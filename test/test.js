"use strict";

var assert = require('assert');
var t = require('../index');
var React = require('react');
var Backbone = require('Backbone');
var sinon = require('sinon');

var validate = t.validate;
var Ok = validate.Ok;
var Result = validate.Result;

var Str = t.Str;
var Num = t.Num;
var Err = t.Err;
var Arr = t.Arr;
var Nil = t.Nil;
var Obj = t.Obj;
var Func = t.Func;
var Re = t.Re;
var Dat = t.Dat;
var list = t.list;
var maybe = t.maybe;
var union = t.union;
var enums = t.enums;
var subtype = t.subtype;
var struct = t.struct;
var tuple = t.tuple;
var dict = t.dict;
var mixin = t.util.mixin;

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

function result(message, path, actual, expected) {
  return new Result({errors: [error(message, path, actual, expected)]});
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

var Size = tuple([Num, Num], 'Size');

debugger
var Warranty = dict(Str, Num, 'Warranty');

var Product = struct({
  name:       Str,                  
  desc:       Description,
  home:       URL,
  shippings:  Shippings,       
  category:   Category,         
  price:      Price,
  size:       Size,
  warranty:   Warranty
}, 'Product');

//
// primitives
//

describe('validate', function () {

  describe('primitives', function () {
    it('should validate', function () {
      eqv(validate('a', Str), Ok);
      eqv(validate(1, Str), result('value is `1`, should be a `Str`', [], 1, Str));
      eqv(validate(1, Func), result('value is `1`, should be a `Func`', [], 1, Func));
      eqv(validate(function () {}, Func), Ok);
      eqv(validate(1, Re), result('value is `1`, should be a `Re`', [], 1, Re));
      eqv(validate(/^a/, Re), Ok);
      eqv(validate(1, Dat), result('value is `1`, should be a `Dat`', [], 1, Dat));
      eqv(validate(new Date(), Dat), Ok);
    });
    it('should handle `messages` option', function () {
      eqv(validate(1, Str, {messages: 'mymessage'}), result('mymessage', [], 1, Str));
    });
  });

  describe('enums', function () {
    it('should validate', function () {
      eqv(validate('audio', Category), Ok);
      eqv(validate(1, Category), result('value is `1`, should be a `Category`', [], 1, Category));
    });
    it('should handle `messages` option', function () {
      eqv(validate(1, Category, {messages: 'mymessage'}), result('mymessage', [], 1, Category));
    });
  });

  describe('list', function () {
    it('should validate', function () {
      eqv(validate(['a'], Shippings), Ok);
      eqv(validate(1, Shippings), result('value is `1`, should be a `Arr`', [], 1, Arr));
      eqv(validate([1], Shippings), result('[0] is `1`, should be a `Str`', [0], 1, Str));
    });
    it('should handle `messages` option', function () {
      eqv(validate(1, Shippings, {messages: 'mymessage'}), result('mymessage', [], 1, Arr));
      eqv(validate([1], Shippings, {messages: 'mymessage'}), result('mymessage', [0], 1, Str));
      eqv(validate(1, Shippings, {messages: {':input': 'should be a list'}}), result('should be a list', [], 1, Arr));
      eqv(validate([1], Shippings, {messages: {':type': 'should be a string'}}), result('should be a string', [0], 1, Str));
    });
  });

  describe('maybe', function () {
    it('should validate', function () {
      eqv(validate(null, Description), Ok);
      eqv(validate('a', Description), Ok);
      eqv(validate(1, Description), result('value is `1`, should be a `Str`', [], 1, Str));
    });
    it('should handle `messages` option', function () {
      eqv(validate(1, Description, {messages: 'mymessage'}), result('mymessage', [], 1, Str));
    });
  });

  describe('struct', function () {

    var Point = struct({
      x: Num,
      y: Num
    });

    it('should validate', function () {
      eqv(validate({x: 0, y: 0}, Point), Ok);
      eqv(validate(null, Point), result('value is `null`, should be an `Obj`', [], null, Obj));
      eqv(validate({x: 0}, Point), result('["y"] is `undefined`, should be a `Num`', ['y'], undefined, Num));
      eqv(validate({x: 0, y: 'a'}, Point), result('["y"] is `"a"`, should be a `Num`', ['y'], 'a', Num));
    });
    it('should handle `messages` option', function () {
      eqv(validate(1, Point, {messages: 'mymessage'}), result('mymessage', [], 1, Obj));
      eqv(validate({x: 0}, Point, {messages: 'mymessage'}), result('mymessage', ['y'], undefined, Num));
      eqv(validate(1, Point, {messages: {':input': 'should be an obj'}}), result('should be an obj', [], 1, Obj));
      eqv(validate({x: 0, y: 'a'}, Point, {messages: {'y': 'y should be an obj'}}), result('y should be an obj', ['y'], 'a', Num));
    });
  });

  describe('subtype', function () {
    it('should validate', function () {
      eqv(validate('http://gcanti.github.io', URL), Ok);
      eqv(validate(1, URL), result('value is `1`, should be a `Str`', [], 1, Str));
      eqv(validate('a', URL), result('value is `"a"`, should be a `URL`', [], 'a', URL));
    });
    it('should handle `messages` option', function () {
      eqv(validate(1, URL, {messages: 'mymessage'}), result('mymessage', [], 1, Str));
      eqv(validate(1, URL, {messages: {':type': 'should be a string'}}), result('should be a string', [], 1, Str));
      eqv(validate('a', URL, {messages: {':predicate': 'should be a URL'}}), result('should be a URL', [], 'a', URL));
    });
  });

  describe('tuple', function () {
    it('should validate', function () {
      eqv(validate([1, 2], Size), Ok);
      eqv(validate(1, Size), result('value is `1`, should be a `Size`', [], 1, Size));
      eqv(validate([1], Size), result('value is `[1]`, should be a `Size`', [], [1], Size));
      eqv(validate([1, 2, 3], Size), result('value is `[1,2,3]`, should be a `Size`', [], [1, 2, 3], Size));
      eqv(validate([1, 'a'], Size), result('[1] is `"a"`, should be a `Num`', [1], 'a', Num));
    });
    it('should handle `messages` option', function () {
      eqv(validate(1, Size, {messages: 'mymessage'}), result('mymessage', [], 1, Size));
      eqv(validate(1, Size, {messages: {':input': 'should be an array'}}), result('should be an array', [], 1, Size));
      eqv(validate([1], Size, {messages: {':input': 'should be an array'}}), result('should be an array', [], [1], Size));
      eqv(validate([1, 'a'], Size, {messages: {'1': 'should be a number'}}), result('should be a number', [1], 'a', Num));
    });
  });

  describe('union', function () {
    it('should validate', function () { 
      eqv(validate(1, Price), Ok);
      eqv(validate({currency: 'EUR', amount: 100}, Price), Ok);
      eqv(validate('a', Price), result('value is `"a"`, should be a `Price`', [], 'a', Price));
      eqv(validate({}, Price), {errors: [
        error('["currency"] is `undefined`, should be a `Str`', ['currency'], undefined, Str),
        error('["amount"] is `undefined`, should be a `Num`', ['amount'], undefined, Num)
      ]});
    });
    it('should handle `messages` option', function () {
      eqv(validate('a', Price, {messages: 'mymessage'}), result('mymessage', [], 'a', Price));
      eqv(validate('a', Price, {messages: {':dispatch': 'should be a Price'}}), result('should be a Price', [], 'a', Price));
    });
  });

  describe('dict', function () {
    it('should validate', function () {
      eqv(validate({x: 1}, Warranty), Ok);
      eqv(validate(1, Warranty), result('value is `1`, should be a `Obj`', [], 1, Obj));
      eqv(validate({x: 'a'}, Warranty), result('["x"] is `"a"`, should be a `Num`', ['x'], 'a', Num));
    });
    it('should handle `messages` option', function () {
      eqv(validate(1, Warranty, {messages: 'mymessage'}), result('mymessage', [], 1, Obj));
      eqv(validate({x: 'a'}, Warranty, {messages: 'mymessage'}), result('mymessage', ['x'], 'a', Num));
      eqv(validate(1, Warranty, {messages: {':input': 'should be a list'}}), result('should be a list', [], 1, Obj));
      eqv(validate({x: 'a'}, Warranty, {messages: {':codomain': 'should be a string'}}), result('should be a string', ['x'], 'a', Num));
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
        size: [2.4, 4.2],
        warranty: {
          US: 2,
          IT: 1
        }
    };

    var getPatch = function (patch) {
      return mixin(mixin({}, product), patch, true);
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
        size:        {':input': 'size should be an array of length 2', 0: 'size.width should be a number', 1: 'size.height should be a number'},
        warranty:  {':input': 'warranty should be a dict of numbers', ':codomain': 'every element of warranty should be a number'},       
      };

      it('should return custom messages', function () {
        p = getPatch({name: null});
        eqv(validate(p, Product, {messages: messages}), result('name should be a string', ['name'], null, Str));
        p = getPatch({desc: 1});
        eqv(validate(p, Product, {messages: messages}), result('desc should be an optional string', ['desc'], 1, Str));
        p = getPatch({home: 1});
        eqv(validate(p, Product, {messages: messages}), result('home should be a string', ['home'], 1, Str));
        p = getPatch({home: 'a'});
        eqv(validate(p, Product, {messages: messages}), result('home should be an URL', ['home'], 'a', URL));
        p = getPatch({shippings: 1});
        eqv(validate(p, Product, {messages: messages}), result('shippings should be a list of strings', ['shippings'], 1, Arr));
        p = getPatch({shippings: [1]});
        eqv(validate(p, Product, {messages: messages}), result('every element of shippings should be a string', ['shippings', 0], 1, Str));
        p = getPatch({category: 1});
        eqv(validate(p, Product, {messages: messages}), result('category should be a valid enum', ['category'], 1, Category));
        p = getPatch({price: 'a'});
        eqv(validate(p, Product, {messages: messages}), result('price should be expressed in dollars or in another currency', ['price'], 'a', Price));
        p = getPatch({price: -1});
        eqv(validate(p, Product, {messages: messages}), result('price should be a positive number', ['price'], -1, Positive));
        p = getPatch({size: -1});
        eqv(validate(p, Product, {messages: messages}), result('size should be an array of length 2', ['size'], -1, Size));
        p = getPatch({size: []});
        eqv(validate(p, Product, {messages: messages}), result('size should be an array of length 2', ['size'], [], Size));
        p = getPatch({size: [1]});
        eqv(validate(p, Product, {messages: messages}), result('size should be an array of length 2', ['size'], [1], Size));
        p = getPatch({size: [1, 2, 3]});
        eqv(validate(p, Product, {messages: messages}), result('size should be an array of length 2', ['size'], [1, 2, 3], Size));
        p = getPatch({size: [1, 'a']});
        eqv(validate(p, Product, {messages: messages}), result('size.height should be a number', ['size', 1], 'a', Num));
        p = getPatch({warranty: 1});
        eqv(validate(p, Product, {messages: messages}), result('warranty should be a dict of numbers', ['warranty'], 1, Obj));
        p = getPatch({warranty: {US: 'a'}});
        eqv(validate(p, Product, {messages: messages}), result('every element of warranty should be a number', ['warranty', 'US'], 'a', Num));
      });
    });

    describe('form validation', function () {

      var p;
      var messages = ':path';

      it('should return the name of the prop', function () {
        p = getPatch({name: null});
        eqv(validate(p, Product, {messages: messages}), result('name', ['name'], null, Str));
        p = getPatch({desc: 1});
        eqv(validate(p, Product, {messages: messages}), result('desc', ['desc'], 1, Str));
        p = getPatch({home: 1});
        eqv(validate(p, Product, {messages: messages}), result('home', ['home'], 1, Str));
        p = getPatch({home: 'a'});
        eqv(validate(p, Product, {messages: messages}), result('home', ['home'], 'a', URL));
        p = getPatch({shippings: 1});
        eqv(validate(p, Product, {messages: messages}), result('shippings', ['shippings'], 1, Arr));
        p = getPatch({shippings: [1]});
        eqv(validate(p, Product, {messages: messages}), result('shippings.0', ['shippings', 0], 1, Str));
        p = getPatch({category: 1});
        eqv(validate(p, Product, {messages: messages}), result('category', ['category'], 1, Category));
        p = getPatch({price: 'a'});
        eqv(validate(p, Product, {messages: messages}), result('price', ['price'], 'a', Price));
        p = getPatch({price: -1});
        eqv(validate(p, Product, {messages: messages}), result('price', ['price'], -1, Positive));
        p = getPatch({size: -1});
        eqv(validate(p, Product, {messages: messages}), result('size', ['size'], -1, Size));
        p = getPatch({size: []});
        eqv(validate(p, Product, {messages: messages}), result('size', ['size'], [], Size));
        p = getPatch({size: [1]});
        eqv(validate(p, Product, {messages: messages}), result('size', ['size'], [1], Size));
        p = getPatch({size: [1, 2, 3]});
        eqv(validate(p, Product, {messages: messages}), result('size', ['size'], [1, 2, 3], Size));
        p = getPatch({size: [1, 'a']});
        eqv(validate(p, Product, {messages: messages}), result('size.1', ['size', 1], 'a', Num));
        p = getPatch({warranty: 1});
        eqv(validate(p, Product, {messages: messages}), result('warranty', ['warranty'], 1, Obj));
        p = getPatch({warranty: {US: 'a'}});
        eqv(validate(p, Product, {messages: messages}), result('warranty.US', ['warranty', 'US'], 'a', Num));
      });
    });

    describe('React propTypes', function () {

      function toPropTypes(Struct) {
        
        var propTypes = {};
        var props = Struct.meta.props;
        
        Object.keys(props).forEach(function (k) {
          // React custom prop validator
          // see http://facebook.github.io/react/docs/reusable-components.html
          propTypes[k] = function (values, name, component) {
            var opts = {
              path: ['this.props.' + name], 
              messages: ':path of value `:actual` supplied to `' + component + '`, expected a `:expected`'
            };
            return validate(values[name], props[name], opts).firstError();
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
          spy.getCall(6).args[0],
          spy.getCall(7).args[0]
        ].sort();

        eq(calls[0], 'Warning: this.props.category of value `undefined` supplied to `ProductComponent`, expected a `Category`');
        eq(calls[1], 'Warning: this.props.desc of value `1` supplied to `ProductComponent`, expected a `Str`');
        eq(calls[2], 'Warning: this.props.home of value `undefined` supplied to `ProductComponent`, expected a `Str`');
        eq(calls[3], 'Warning: this.props.name of value `undefined` supplied to `ProductComponent`, expected a `Str`');
        eq(calls[4], 'Warning: this.props.price of value `undefined` supplied to `ProductComponent`, expected a `Price`');
        eq(calls[5], 'Warning: this.props.shippings of value `undefined` supplied to `ProductComponent`, expected a `Arr`');
        eq(calls[6], 'Warning: this.props.size of value `undefined` supplied to `ProductComponent`, expected a `Size`');
        eq(calls[7], 'Warning: this.props.warranty of value `undefined` supplied to `ProductComponent`, expected a `Obj`');

        console.warn = warn;
      });

    });

    describe('Backbone validation', function () {
      var options = {validate: true};
      var Attrs = struct({
        x: Num,
        y: Num
      });
      var Model = Backbone.Model.extend({
        validate: function (attrs, options) {
          return validate(attrs, Attrs).errors;
        }
      });
      var model = new Model({x: 1, y: 2}, options);
      it('should avoid bad attributes', function () {
        model.set({x: 'a'}, options);
        assert.deepEqual(model.attributes, {x: 1, y: 2});
      });
    });

  });

});
