/* global describe,it */
var assert = require('assert');
var t = require('../index');

var Str = t.Str;
var Num = t.Num;
var validate = t.validate;
var ValidationResult = t.ValidationResult;

function failure(actual, expected, path, message, value) {
  var err = {
    message: message,
    actual: actual,
    expected: expected,
    path: path
  };
  return new ValidationResult({errors: [err], value: value});
}

function success(value) {
  return new ValidationResult({value: value, errors: []});
}

//
// setup
//

var ok = function (x) { assert.strictEqual(true, x); };
var eq = assert.deepEqual;

describe('validate()', function () {

  var Point = t.struct({
    x: Num,
    y: Num
  }, 'Point');

  it('irriducible', function () {
    eq(validate('a', Str), success('a'));
    eq(validate(1, Num), success(1));
    eq(validate(true, t.Bool), success(true));
    eq(validate(/a/, t.Re), success(/a/));
    var d = new Date();
    eq(validate(d, t.Dat), success(d));
    ok(validate(function () {}, t.Func).isValid());
    eq(validate(1, Str), failure(1, Str, [], '/ is 1 should be a String', 1));
  });

  it('enums', function () {
    var Country = t.enums.of('IT US', 'Country');
    eq(validate('IT', Country), success('IT'));
    eq(validate(1, Country), failure(1, Country, [], '/ is 1 should be a Country', 1));
  });

  it('struct', function () {
    eq(validate({x: 0, y: 0}, Point), success({x: 0, y: 0}));
    ok(validate({x: 0, y: 0}, Point).value instanceof Point);
    eq(validate({x: 0, y: 'a'}, Point), failure('a', Num, ['y'], '/y is "a" should be a Number', {x: 0, y: 'a'}));
    eq(validate(new Point({x: 0, y: 0}), Point), success({x: 0, y: 0}));
  });

  it('list', function () {
    var Tags = t.list(Str, 'Tags');
    eq(validate(['a'], Tags), success(['a']));
    eq(validate(1, Tags), failure(1, Tags, [], '/ is 1 should be a Tags', 1));
    eq(validate([1], Tags), failure(1, Str, [0], '/0 is 1 should be a String', [1]));
    var Points = t.list(Point);
    eq(validate([{x: 0, y: 0}], Points), success([{x: 0, y: 0}]));
    ok(validate([{x: 0, y: 0}], Points).value[0] instanceof Point);
  });

  it('subtype', function () {
    var URL = t.subtype(Str, function (s) { return s.indexOf('http://') === 0; }, 'URL');
    eq(validate('http://gcanti.github.io', URL), success('http://gcanti.github.io'));
    eq(validate(1, URL), failure(1, Str, [], '/ is 1 should be a String', 1));
    eq(validate('a', URL), failure('a', URL, [], '/ is "a" should be a URL', 'a'));
    var PointQ1 = t.subtype(Point, function (p) {
      return p.x >= 0 && p.y >= 0;
    });
    eq(validate({x: 0, y: 0}, PointQ1), success({x: 0, y: 0}));
    ok(validate({x: 0, y: 0}, PointQ1).value instanceof Point);
  });

  it('maybe', function () {
    var Maybe = t.maybe(Str, 'Maybe');
    eq(validate(null, Maybe), success(null));
    eq(validate('a', Maybe), success('a'));
    eq(validate(1, Maybe), failure(1, Str, [], '/ is 1 should be a String', 1));
    eq(validate(null, t.maybe(Point)), success(null));
    eq(validate({x: 0, y: 0}, Point), success({x: 0, y: 0}));
    ok(validate({x: 0, y: 0}, Point).value instanceof Point);
  });

  it('tuple', function () {
    var Tuple = t.tuple([Str, Num], 'Tuple');
    eq(validate(1, Tuple), failure(1, Tuple, [], '/ is 1 should be a Tuple', 1));
    eq(validate(['a', 1], Tuple), success(['a', 1]));
    eq(validate(['a', 1, 2], Tuple), failure(['a', 1, 2], Tuple, [], '/ is ["a",1,2] should be a Tuple', ['a', 1, 2]));
    eq(validate(['a'], Tuple), failure(undefined, Num, [1], '/1 is undefined should be a Number', ['a', undefined]));
    eq(validate(['a', 'b'], Tuple), failure('b', Num, [1], '/1 is "b" should be a Number', ['a', 'b']));
    Tuple = t.tuple([Str, Point], 'Tuple');
    eq(validate(['a', {x: 0, y: 0}], Tuple), success(['a', {x: 0, y: 0}]));
    ok(validate(['a', {x: 0, y: 0}], Tuple).value[1] instanceof Point);
    eq(validate(['a', 'b'], Tuple), failure('b', Point, [1], '/1 is "b" should be a Point', ['a', 'b']));
  });

  it('dict', function () {
    var Key = t.subtype(Str, function (k) {
      return k.length >= 2;
    }, 'Key');
    var Value = t.subtype(Num, function (n) {
      return n >= 0;
    }, 'Value');
    var Dict = t.dict(Key, Value, 'Dict');
    eq(validate({}, Dict), success({}));
    eq(validate({aa: 1, bb: 2}, Dict), success({aa: 1, bb: 2}));
    eq(validate(1, Dict), failure(1, Dict, [], '/ is 1 should be a Dict', 1));
    eq(validate({a: 1}, Dict), failure('a', Key, ['a'], '/a is "a" should be a Key', {a: 1}));
    eq(validate({aa: -1}, Dict), failure(-1, Value, ['aa'], '/aa is -1 should be a Value', {aa: -1}));
    Dict = t.dict(Key, Point, 'Dict');
    eq(validate({aa: {x: 0, y: 0}}, Dict), success({aa: {x: 0, y: 0}}));
    ok(validate({aa: {x: 0, y: 0}}, Dict).value.aa instanceof Point);
    eq(validate({a: {x: 0, y: 0}}, Dict), failure('a', Key, ['a'], '/a is "a" should be a Key', {a: {x: 0, y: 0}}));
    ok(validate({a: {x: 0, y: 0}}, Dict).value.a instanceof Point);
    eq(validate({aa: {x: 0, y: 'a'}}, Dict), failure('a', Num, ['aa', 'y'], '/aa/y is "a" should be a Number', {aa: {x: 0, y: 'a'}}));
    Dict = t.dict(Str, Str);
    eq(validate({a: 'a', b: 0}, Dict), failure(0, Str, ['b'], '/b is 0 should be a String', {a: 'a', b: 0}));
  });

  it('union', function () {
    var Union = t.union([Str, Num], 'Union');
    eq(validate(1, Union), success(1));
    eq(validate('a', Union), success('a'));
    eq(validate(true, Union), failure(true, Union, [], '/ is true should be a Union', true));
  });

  it('optional path param', function () {
    eq(validate(1, Str, ['prefix']), failure(1, Str, ['prefix'], '/prefix is 1 should be a String', 1));
  });

  it('ES6 classes', function () {
    function Class(a) {
      this.a = a;
    }

    var c = new Class('a');

    eq(validate(c, Class), success(c));
    eq(validate(1, Class), failure(1, Class, [], '/ is 1 should be a Class', 1));
  });

  it('intersection', function () {
    var Min = t.subtype(t.String, function (s) { return s.length > 2; }, 'Min');
    var Max = t.subtype(t.String, function (s) { return s.length < 5; }, 'Max');
    var MinMax = t.intersection([Min, Max], 'MinMax');

    eq(validate(1, MinMax), {
      errors: [
        {
          message: '/ is 1 should be a String',
          actual: 1,
          expected: Str,
          path: []
        },
        {
          message: '/ is 1 should be a String',
          actual: 1,
          expected: Str,
          path: []
        }
      ],
      value: 1
    });

    eq(validate('aa', MinMax), {
      errors: [
        {
          message: '/ is "aa" should be a Min',
          actual: 'aa',
          expected: Min,
          path: []
        }
      ],
      value: 'aa'
    });

    eq(validate('aaaaa', MinMax), {
      errors: [
        {
          message: '/ is "aaaaa" should be a Max',
          actual: 'aaaaa',
          expected: Max,
          path: []
        }
      ],
      value: 'aaaaa'
    });

    eq(validate('aaa', MinMax), {
      errors: [],
      value: 'aaa'
    });

    eq(validate({name: 'aa'}, t.struct({name: MinMax})), {
      errors: [
        {
          message: '/name is "aa" should be a Min',
          actual: 'aa',
          expected: Min,
          path: ['name']
        }
      ],
      value: {name: 'aa'}
    });

  });

});
