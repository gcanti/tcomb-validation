"use strict";

var assert = require('assert');
var v = require('../index');
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

// it seems that assert.deepEqual doesn't handle Error objects
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
      eq(e.message, b.errors[i].message, message);
    });
  }
}; 

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
  amount:   Positive // refinement
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

//
// primitives
//

describe('validate', function () {

  var validate = v.validate;

  describe('primitives', function () {
    it('should validate', function () {
      eqv(validate('a', Str), {isValid: true, value: 'a', errors: null});
      eqv(validate(1, Str), {isValid: false, value: 1, errors: [new Error('root is `1`, should be a `Str`')]});
    });
    it('should handle `path` argument', function () {
      eqv(validate(1, Str, 'path'), {isValid: false, value: 1, errors: [new Error('path is `1`, should be a `Str`')]});
    });
    it('should handle `message` argument', function () {
      eqv(validate(1, Str, null, 'mymessage'), {isValid: false, value: 1, errors: [new Error('mymessage')]});
      eqv(validate(1, Str, 'path', ':path mymessage'), {isValid: false, value: 1, errors: [new Error('path mymessage')]});
    });
  });

  describe('enums', function () {
    it('should validate', function () {
      eqv(validate('audio', Category), {isValid: true, value: 'audio', errors: null});
      eqv(validate(1, Category), {isValid: false, value: 1, errors: [new Error('root is `1`, should be a `Category`')]});
    });
    it('should handle `path` argument', function () {
      eqv(validate(1, Category, 'path'), {isValid: false, value: 1, errors: [new Error('path is `1`, should be a `Category`')]});
    });
    it('should handle `message` argument', function () {
      eqv(validate(1, Category, null, 'mymessage'), {isValid: false, value: 1, errors: [new Error('mymessage')]});
      eqv(validate(1, Category, 'path', ':path mymessage'), {isValid: false, value: 1, errors: [new Error('path mymessage')]});
    });
  });

  describe('list', function () {
    it('should validate', function () {
      eqv(validate(['a'], Shippings), {isValid: true, value: ['a'], errors: null});
      eqv(validate(1, Shippings), {isValid: false, value: 1, errors: [new Error('root is `1`, should be an `Arr`')]});
      eqv(validate([1], Shippings), {isValid: false, value: [1], errors: [new Error('root[0] is `1`, should be a `Str`')]});
    });
    it('should handle `path` argument', function () {
      eqv(validate(1, Shippings, 'path'), {isValid: false, value: 1, errors: [new Error('path is `1`, should be an `Arr`')]});
      eqv(validate([1], Shippings, 'path'), {isValid: false, value: [1], errors: [new Error('path[0] is `1`, should be a `Str`')]});
    });
    it('should handle `message` argument', function () {
      eqv(validate(1, Shippings, null, 'mymessage'), {isValid: false, value: 1, errors: [new Error('mymessage')]});
      eqv(validate([1], Shippings, 'path', ':path mymessage'), {isValid: false, value: [1], errors: [new Error('path[0] mymessage')]});
    });
  });

  describe('maybe', function () {
    it('should validate', function () {
      eqv(validate(null, Description), {isValid: true, value: null, errors: null});
      eqv(validate('a', Description), {isValid: true, value: 'a', errors: null});
      eqv(validate(1, Description), {isValid: false, value: 1, errors: [new Error('root is `1`, should be a `Str`')]});
    });
    it('should handle `path` argument', function () {
      eqv(validate(1, Description, 'path'), {isValid: false, value: 1, errors: [new Error('path is `1`, should be a `Str`')]});
    });
    it('should handle `message` argument', function () {
      eqv(validate(1, Description, null, 'mymessage'), {isValid: false, value: 1, errors: [new Error('mymessage')]});
      eqv(validate(1, Description, 'path', ':path mymessage'), {isValid: false, value: 1, errors: [new Error('path mymessage')]});
    });
  });

  describe('struct', function () {

    var Point = struct({
      x: Num,
      y: Num
    });

    it('should validate', function () {
      eqv(validate({x: 0, y: 0}, Point), {isValid: true, value: {x: 0, y: 0}, errors: null});
      eqv(validate(null, Point), {isValid: false, value: null, errors: [new Error('root is `null`, should be an `Obj`')]});
      eqv(validate({x: 0}, Point), {isValid: false, value: {x: 0}, errors: [new Error('root["y"] is `undefined`, should be a `Num`')]});
    });
    it('should handle `path` argument', function () {
      eqv(validate(1, Point, 'path'), {isValid: false, value: 1, errors: [new Error('path is `1`, should be an `Obj`')]});
    });
    it('should handle `message` argument', function () {
      eqv(validate(1, Point, null, 'mymessage'), {isValid: false, value: 1, errors: [new Error('mymessage')]});
      eqv(validate(1, Point, 'path', ':path mymessage'), {isValid: false, value: 1, errors: [new Error('path mymessage')]});
      eqv(validate({x: 0}, Point, 'path', ':path mymessage'), {isValid: false, value: {x: 0}, errors: [new Error('path["y"] mymessage')]});
    });
  });

  describe('subtype', function () {
    it('should validate', function () {
      eqv(validate('http://gcanti.github.io', URL), {isValid: true, value: 'http://gcanti.github.io', errors: null});
      eqv(validate(1, URL), {isValid: false, value: 1, errors: [new Error('root is `1`, should be a `Str`')]});
    });
    it('should handle `path` argument', function () {
      eqv(validate(1, URL, 'path'), {isValid: false, value: 1, errors: [new Error('path is `1`, should be a `Str`')]});
    });
    it('should handle `message` argument', function () {
      eqv(validate(1, URL, null, 'mymessage'), {isValid: false, value: 1, errors: [new Error('mymessage')]});
      eqv(validate(1, URL, 'path', ':path mymessage'), {isValid: false, value: 1, errors: [new Error('path mymessage')]});
    });
  });

  describe('tuple', function () {
    it('should validate', function () {
      eqv(validate([1, 2], Dimension), {isValid: true, value: [1, 2], errors: null});
      eqv(validate(1, Dimension), {isValid: false, value: 1, errors: [new Error('root is `1`, should be an `Arr` of length `2`')]});
      eqv(validate([1], Dimension), {isValid: false, value: [1], errors: [new Error('root is `[1]`, should be an `Arr` of length `2`')]});
      eqv(validate([1, 2, 3], Dimension), {isValid: false, value: [1, 2, 3], errors: [new Error('root is `[1,2,3]`, should be an `Arr` of length `2`')]});
      eqv(validate([1, 'a'], Dimension), {isValid: false, value: [1, 'a'], errors: [new Error('root[1] is `"a"`, should be a `Num`')]});
    });
    it('should handle `path` argument', function () {
      eqv(validate(1, Dimension, 'path'), {isValid: false, value: 1, errors: [new Error('path is `1`, should be an `Arr` of length `2`')]});
    });
    it('should handle `message` argument', function () {
      eqv(validate(1, Dimension, null, 'mymessage'), {isValid: false, value: 1, errors: [new Error('mymessage')]});
      eqv(validate(1, Dimension, 'path', ':path mymessage'), {isValid: false, value: 1, errors: [new Error('path mymessage')]});
    });
  });

  describe('union', function () {
    it('should validate', function () {
      eqv(validate(1, Price), {isValid: true, value: 1, errors: null});
      eqv(validate({currency: 'EUR', amount: 100}, Price), {isValid: true, value: {currency: 'EUR', amount: 100}, errors: null});
      eqv(validate('a', Price), {isValid: false, value: 'a', errors: [new Error('root is `"a"`, should be a `Price`')]});
      eqv(validate({}, Price), {isValid: false, value: {}, errors: [
        new Error('root["currency"] is `undefined`, should be a `Str`'),
        new Error('root["amount"] is `undefined`, should be a `Num`'),
      ]});
    });
    it('should handle `path` argument', function () {
      eqv(validate('a', Price, 'path'), {isValid: false, value: 'a', errors: [new Error('path is `"a"`, should be a `Price`')]});
    });
    it('should handle `message` argument', function () {
      eqv(validate('a', Price, null, 'mymessage'), {isValid: false, value: 'a', errors: [new Error('mymessage')]});
      eqv(validate('a', Price, 'path', ':path mymessage'), {isValid: false, value: 'a', errors: [new Error('path mymessage')]});
    });
  });

});

/*

var p = {
    // required string
    name: 'iPod',

    // optional string
    desc: 'Engineered for maximum funness.', 
    
    // a URL
    home: 'http://www.apple.com/ipod/', 
    
    // a list of shipping methods
    shippings: ['Same Day', 'Next Businness Day'], 
    
    // one of 'audio', 'video'
    category: 'audio', 
    
    // a number (dollars) or an object (another currency)
    price: {currency: 'EUR', amount: 100}, 
    
    // dimensions (width x height)
    dim: [2.4, 1, 3] 
};

var messages = {
  ':struct':  'product should be an object',
  name:       'name should be a string',                  
  desc:       'desc should be a string',
  home:       {':type': 'home should be a string', ':predicate': 'home should be an URL'},
  shippings:  {':list': 'shippings should be an array', ':type': 'should be a string'},       
  category:   'category should be a valid enum',         
  price:      {':dispatch': 'price should be expressed in dollars or in another currency', 0: 'price should be a number', 1: {':struct': 'price should be an object', currency: 'currency should be a currency', amount: 'amount should be a positive number'}},
  dim:        {':tuple': 'dim should be an array of length 2', 0: 'dim.width should be a number', 1: 'dim.height should be a number'}
};

var formMessages = {
  "name": "name",
  "desc": "desc",
  "home": "home",
  "shippings": "shippings",
  "category": "category",
  "price": "price",
  "dim": "dim"
};

//console.log(validate(p, Product, 'product', messages));
//console.log(validate(p, Product, 'product'));
//console.log(validate(p, Product, 'product', formMessages));



*/