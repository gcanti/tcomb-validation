/* global describe,it */
var assert = require('assert');
var t = require('../index');

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

describe('validate(value, type, [options])', function () {

  var Point = t.struct({
    x: t.Number,
    y: t.Number
  }, 'Point');

  var PointInterface = t.inter({
    x: t.Number,
    y: t.Number
  }, 'PointInterface');

  it('irriducible', function () {
    eq(validate('a', t.String), success('a'));
    eq(validate(1, t.Number), success(1));
    eq(validate(true, t.Bool), success(true));
    eq(validate(/a/, t.Re), success(/a/));
    var d = new Date();
    eq(validate(d, t.Dat), success(d));
    ok(validate(function () {}, t.Func).isValid());
    eq(validate(1, t.String), failure(1, t.String, [], 'Invalid value 1 supplied to String', 1));
  });

  it('enums', function () {
    var Country = t.enums.of('IT US', 'Country');
    eq(validate('IT', Country), success('IT'));
    eq(validate(1, Country), failure(1, Country, [], 'Invalid value 1 supplied to Country', 1));
  });

  it('struct', function () {
    eq(validate({x: 0, y: 0}, Point), success({x: 0, y: 0}));
    ok(validate({x: 0, y: 0}, Point).value instanceof Point);
    eq(validate({x: 0, y: 'a'}, Point), failure('a', t.Number, ['y'], 'Invalid value "a" supplied to /y: Number', {x: 0, y: 'a'}));
    eq(validate(new Point({x: 0, y: 0}), Point), success({x: 0, y: 0}));
  });

  it('struct default props', function () {
    var DefaultPoint = t.struct({
      x: t.Number,
      y: t.Number
    }, { defaultProps: { x: 0 } });
    eq(validate({y: 0}, DefaultPoint), success({x: 0, y: 0}));
    eq(validate({x: 1, y: 0}, DefaultPoint), success({x: 1, y: 0}));
    ok(validate({y: 0}, DefaultPoint).value instanceof DefaultPoint);
    eq(validate({y: 'a'}, DefaultPoint), failure('a', t.Number, ['y'], 'Invalid value "a" supplied to /y: Number', {x: 0, y: 'a'}));
    eq(validate({x: 1, y: 'a'}, DefaultPoint), failure('a', t.Number, ['y'], 'Invalid value "a" supplied to /y: Number', {x: 1, y: 'a'}));
    eq(validate(new DefaultPoint({y: 0}), Point), success({x: 0, y: 0}));
  });

  it('interface', function () {
    eq(validate({x: 0, y: 0}, PointInterface), success({x: 0, y: 0}));
    eq(validate({x: 0, y: 0, z: 0}, PointInterface), success({x: 0, y: 0}));
    eq(validate({x: 0, y: 'a'}, PointInterface), failure('a', t.Number, ['y'], 'Invalid value "a" supplied to /y: Number', {x: 0, y: 'a'}));
    eq(validate({x: 0}, PointInterface), failure(undefined, t.Number, ['y'], 'Invalid value undefined supplied to /y: Number', {x: 0, y: undefined}));
    eq(validate(PointInterface({x: 0, y: 0}), PointInterface), success({x: 0, y: 0}));
    // prototype
    var Serializable = t.inter({
      serialize: t.Function
    }, 'Serializable');
    function SerializableImpl() {}
    SerializableImpl.prototype.serialize = function () {};
    eq(validate(new SerializableImpl(), Serializable), success({ serialize: SerializableImpl.prototype.serialize }));
    eq(validate({}, Serializable), failure(undefined, t.Function, ['serialize'], 'Invalid value undefined supplied to /serialize: Function', { serialize: undefined }));
  });

  it('list', function () {
    var Tags = t.list(t.String, 'Tags');
    eq(validate(['a'], Tags), success(['a']));
    eq(validate(1, Tags), failure(1, Tags, [], 'Invalid value 1 supplied to Tags', 1));
    eq(validate([1], Tags), failure(1, t.String, [0], 'Invalid value 1 supplied to /0: String', [1]));
    var Points = t.list(Point);
    eq(validate([{x: 0, y: 0}], Points), success([{x: 0, y: 0}]));
    ok(validate([{x: 0, y: 0}], Points).value[0] instanceof Point);
  });

  it('refinement', function () {
    var URL = t.refinement(t.String, function (s) { return s.indexOf('http://') === 0; }, 'URL');
    eq(validate('http://gcanti.github.io', URL), success('http://gcanti.github.io'));
    eq(validate(1, URL), failure(1, t.String, [], 'Invalid value 1 supplied to String', 1));
    eq(validate('a', URL), failure('a', URL, [], 'Invalid value "a" supplied to URL', 'a'));
    var PointQ1 = t.refinement(Point, function (p) {
      return p.x >= 0 && p.y >= 0;
    });
    eq(validate({x: 0, y: 0}, PointQ1), success({x: 0, y: 0}));
    ok(validate({x: 0, y: 0}, PointQ1).value instanceof Point);
  });

  it('maybe', function () {
    var Maybe = t.maybe(t.String, 'Maybe');
    eq(validate(null, Maybe), success(null));
    eq(validate('a', Maybe), success('a'));
    eq(validate(1, Maybe), failure(1, t.String, [], 'Invalid value 1 supplied to String', 1));
    eq(validate(null, t.maybe(Point)), success(null));
    eq(validate({x: 0, y: 0}, Point), success({x: 0, y: 0}));
    ok(validate({x: 0, y: 0}, Point).value instanceof Point);
  });

  it('tuple', function () {
    var Tuple = t.tuple([t.String, t.Number], 'Tuple');
    eq(validate(1, Tuple), failure(1, Tuple, [], 'Invalid value 1 supplied to Tuple', 1));
    eq(validate(['a', 1], Tuple), success(['a', 1]));
    eq(validate(['a', 1, 2], Tuple), failure(['a', 1, 2], Tuple, [], 'Invalid value [\n  \"a\",\n  1,\n  2\n] supplied to Tuple', ['a', 1, 2]));
    eq(validate(['a'], Tuple), failure(undefined, t.Number, [1], 'Invalid value undefined supplied to /1: Number', ['a', undefined]));
    eq(validate(['a', 'b'], Tuple), failure('b', t.Number, [1], 'Invalid value "b" supplied to /1: Number', ['a', 'b']));
    Tuple = t.tuple([t.String, Point], 'Tuple');
    eq(validate(['a', {x: 0, y: 0}], Tuple), success(['a', {x: 0, y: 0}]));
    ok(validate(['a', {x: 0, y: 0}], Tuple).value[1] instanceof Point);
    eq(validate(['a', 'b'], Tuple), failure('b', Point, [1], 'Invalid value "b" supplied to /1: Point', ['a', 'b']));
  });

  it('dict', function () {
    var Key = t.refinement(t.String, function (k) {
      return k.length >= 2;
    }, 'Key');
    var Value = t.refinement(t.Number, function (n) {
      return n >= 0;
    }, 'Value');
    var Dict = t.dict(Key, Value, 'Dict');
    eq(validate({}, Dict), success({}));
    eq(validate({aa: 1, bb: 2}, Dict), success({aa: 1, bb: 2}));
    eq(validate(1, Dict), failure(1, Dict, [], 'Invalid value 1 supplied to Dict', 1));
    eq(validate({a: 1}, Dict), failure('a', Key, ['a'], 'Invalid value "a" supplied to /a: Key', {a: 1}));
    eq(validate({aa: -1}, Dict), failure(-1, Value, ['aa'], 'Invalid value -1 supplied to /aa: Value', {aa: -1}));
    Dict = t.dict(Key, Point, 'Dict');
    eq(validate({aa: {x: 0, y: 0}}, Dict), success({aa: {x: 0, y: 0}}));
    ok(validate({aa: {x: 0, y: 0}}, Dict).value.aa instanceof Point);
    eq(validate({a: {x: 0, y: 0}}, Dict), failure('a', Key, ['a'], 'Invalid value "a" supplied to /a: Key', {a: {x: 0, y: 0}}));
    ok(validate({a: {x: 0, y: 0}}, Dict).value.a instanceof Point);
    eq(validate({aa: {x: 0, y: 'a'}}, Dict), failure('a', t.Number, ['aa', 'y'], 'Invalid value "a" supplied to /aa/y: Number', {aa: {x: 0, y: 'a'}}));
    Dict = t.dict(t.String, t.String);
    eq(validate({a: 'a', b: 0}, Dict), failure(0, t.String, ['b'], 'Invalid value 0 supplied to /b: String', {a: 'a', b: 0}));
  });

  it('union', function () {
    var Union = t.union([t.String, t.Number], 'Union');
    eq(validate(1, Union), success(1));
    eq(validate('a', Union), success('a'));
    eq(validate(true, Union), failure(true, Union, [], 'Invalid value true supplied to Union', true));
  });

  it('ES6 classes', function () {
    function Class(a) {
      this.a = a;
    }

    var c = new Class('a');

    eq(validate(c, Class), success(c));
    eq(validate(1, Class), failure(1, Class, [], 'Invalid value 1 supplied to Class', 1));
  });

  it('intersection', function () {
    var Min = t.refinement(t.String, function (s) { return s.length > 2; }, 'Min');
    var Max = t.refinement(t.String, function (s) { return s.length < 5; }, 'Max');
    var MinMax = t.intersection([Min, Max], 'MinMax');

    eq(validate(1, MinMax), {
      errors: [
        {
          message: 'Invalid value 1 supplied to String',
          actual: 1,
          expected: t.String,
          path: []
        },
        {
          message: 'Invalid value 1 supplied to String',
          actual: 1,
          expected: t.String,
          path: []
        }
      ],
      value: 1
    });

    eq(validate('aa', MinMax), {
      errors: [
        {
          message: 'Invalid value "aa" supplied to Min',
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
          message: 'Invalid value "aaaaa" supplied to Max',
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
          message: 'Invalid value "aa" supplied to /name: Min',
          actual: 'aa',
          expected: Min,
          path: ['name']
        }
      ],
      value: {name: 'aa'}
    });

    var StructIntersection = t.intersection([t.struct({string: Min}), t.struct({string: Max})], 'StructIntersection');

    eq(validate({string: 'Test'}, StructIntersection), {
      errors: [
        {
          message: 'Invalid value {\n  \"string\": \"Test\"\n} supplied to StructIntersection',
          actual: {string: 'Test'},
          expected: StructIntersection,
          path: []
        }
      ],
      value: {string: 'Test'}
    });

  });

  describe('options argument', function () {

    it('should handle a path key', function () {
      eq(validate(1, t.String, ['prefix']), failure(1, t.String, ['prefix'], 'Invalid value 1 supplied to /prefix: String', 1));
    });

    it('should handle a context key', function () {
      var context = {a: 1};
      var ShortString = t.refinement(t.String, function (s) { return s.length < 3; });
      ShortString.getValidationErrorMessage = function (value, path, ctx) {
        assert.strictEqual(ctx, context);
        return 'mymessage' + ctx.a;
      };
      eq(validate('abc', ShortString, {context: context}).firstError().message, 'mymessage1');
      assert.deepEqual(validate('abc', ShortString, {context: context, path: ['a']}).firstError().path, ['a']);
    });

    it('should handle a strict boolean', function () {
      eq(validate({x: 0, y: 0}, Point, {strict: true}), success({x: 0, y: 0}));
      eq(validate({x: 0, y: 0, z: 0}, Point, {strict: true}), failure(0, t.Nil, ['z'], 'Invalid value 0 supplied to /z: Nil', {x: 0, y: 0}));
      eq(validate({x: 0, y: 0, z: null}, Point, {strict: true}), failure(null, t.Nil, ['z'], 'Invalid value null supplied to /z: Nil', {x: 0, y: 0}));
      eq(validate({x: 0, y: 0, z: undefined}, Point, {strict: true}), failure(undefined, t.Nil, ['z'], 'Invalid value undefined supplied to /z: Nil', {x: 0, y: 0}));
      eq(validate({x: 0, y: 0, z: 0}, PointInterface, {strict: true}), failure(0, t.Nil, ['z'], 'Invalid value 0 supplied to /z: Nil', {x: 0, y: 0}));
    });

    it('should handle a strict boolean with nested structures', function () {
      var InnerType = t.struct({point: Point});
      var List = t.list(InnerType);
      var T = t.refinement(List, function (x) {
        return x.length >= 2;
      });
      eq(validate([{point: {x: 0, y: 0}}, {point: {x: 0, y: 0}}], T, {strict: true}), success([{point: {x: 0, y: 0}}, {point: {x: 0, y: 0}}]));
      eq(validate([{point: {x: 0, y: 0, z: 0}}, {point: {x: 0, y: 0}}], T, {strict: true}), failure(0, t.Nil, [0, 'point', 'z'], 'Invalid value 0 supplied to /0/point/z: Nil', [{point: {x: 0, y: 0}}, {point: {x: 0, y: 0}}]));
    });

  });

  it('should handle a strict struct', function () {
    var StrictStruct = t.struct({
      name: t.String
    }, { name: 'StrictStruct', strict: true });
    eq(validate({name: 'Giulio'}, StrictStruct), success({name: 'Giulio'}));
    eq(validate({name: 'Giulio', a: 1}, StrictStruct), failure(1, t.Nil, ['a'], 'Invalid value 1 supplied to /a: Nil', {name: 'Giulio'}));
  });

  it('should handle a strict interface', function () {
    var StrictInterface = t.inter({
      name: t.String
    }, { name: 'StrictStruct', strict: true });
    eq(validate({name: 'Giulio'}, StrictInterface), success({name: 'Giulio'}));
    eq(validate({name: 'Giulio', a: 1}, StrictInterface), failure(1, t.Nil, ['a'], 'Invalid value 1 supplied to /a: Nil', {name: 'Giulio'}));
  });

});

describe('getValidationErrorMessage(value, context)', function () {

  var MyString = t.irreducible('MyIrreducible', function (x) {
    return typeof x === 'string' && x.length > 1;
  });
  MyString.getValidationErrorMessage = function (value) {
    if (!MyString.is(value)) {
      return 'Invalid string';
    }
  };

  var ShortString = t.refinement(t.String, function (s) {
    return s.length < 3;
  });
  ShortString.getValidationErrorMessage = function (value) {
    if (!ShortString.is(value)) {
      return 'Too long my friend';
    }
  };

  it('should handle custom validation error messages on irreducibles', function () {
    eq(validate(1, MyString), failure(1, MyString, [], 'Invalid string', 1));
  });

  it('should handle custom validation error messages on subtypes', function () {
    ShortString.getValidationErrorMessage = function (value) {
      if (!ShortString.is(value)) {
        return 'Too long my friend';
      }
    };
    eq(validate('aaa', ShortString), failure('aaa', ShortString, [], 'Too long my friend', 'aaa'));
  });

  it('should handle custom validation error messages on intersections', function () {
    var Intersection = t.intersection([MyString, ShortString]);
    eq(validate('', Intersection), failure('', MyString, [], 'Invalid string', ''));
    eq(validate('aaa', Intersection), failure('aaa', ShortString, [], 'Too long my friend', 'aaa'));
  });

});

