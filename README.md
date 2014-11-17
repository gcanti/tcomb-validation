A general purpose JavaScript validation library based on type combinators

# Playground

Try the [playground online](https://gcanti.github.io/resources/tcomb-validation/playground/playground.html)

# Overview

**Features**

- concise yet expressive syntax
- validates native types, subtypes, objects, lists and tuples, enums, unions, dicts
- validates structures with arbitrary level of nesting
- detailed informations on failed validations
- lightweight alternative to JSON Schema
- reuse your domain model written with [tcomb](https://github.com/gcanti/tcomb)

**Contents**

- [Basic usage](#basic-usage)
  - [Primitives](#primitives)
  - [Subtypes](#subtypes)
  - [Objects](#objects)
  - [Lists and tuples](#lists-and-tuples)
  - [Enums](#enums)
  - [Unions](#unions)
  - [Dicts](#dicts)
  - [Nested structures](#nested-structures)
- [Use cases](#use-cases)
  - [Form validation](#form-validation)
  - [JSON schema](#json-schema)
- [Api reference](#api-reference)

# Basic usage

*If you don't know how to define types with tcomb you may want to take a look at its [README](https://github.com/gcanti/tcomb/blob/master/README.md) file.*

The main function is `validate`:

```js
validate(value, type) -> ValidationResult
```

- `value` the value to validate
- `type` a type defined with the [tcomb](https://github.com/gcanti/tcomb) library

returns a `ValidationResult` object containing the result of the validation

Example

```js
var t = require('tcomb-validation');
var validate = t.validate;
var Str = t.Str; // a string type

validate(1, Str).isValid();   // => false
validate('a', Str).isValid(); // => true
```

You can inspect the result to quickly identify what's wrong:

```js
var result = validate(1, Str);
result.isValid();     // => false
result.firstError();  // => 'value is `1`, should be a `Str`'

// see `result.errors` to inspect all errors
```

## Primitives

```js
// null and undefined
validate('a', Nil).isValid();       // => false
validate(null, Nil).isValid();      // => true
validate(undefined, Nil).isValid(); // => true

// strings
validate(1, Str).isValid();   // => false
validate('a', Str).isValid(); // => true

// numbers
validate('a', Num).isValid(); // => false
validate(1, Num).isValid();   // => true

// booleans
validate(1, Bool).isValid();    // => false
validate(true, Bool).isValid(); // => true

// optional values
validate(null, maybe(Str)).isValid(); // => true
validate('a', maybe(Str)).isValid();  // => true
validate(1, maybe(Str)).isValid();    // => false

// functions
validate(1, Func).isValid();              // => false
validate(function () {}, Func).isValid(); // => true

// dates
validate(1, Dat).isValid();           // => false
validate(new Date(), Dat).isValid();  // => true

// regexps
validate(1, Re).isValid();    // => false
validate(/^a/, Re).isValid(); // => true
```

## Subtypes

You can express more fine-grained contraints with the `subtype` syntax:

```js
// a predicate is a function with signature: (x) -> boolean
var predicate = function (x) { return x >= 0; };

// a positive number
var Positive = subtype(Num, predicate);

validate(-1, Positive).isValid(); // => false
validate(1, Positive).isValid();  // => true
```

## Objects

```js
// an object with two numerical properties
var Point = struct({
  x: Num,
  y: Num
});

validate(null, Point).isValid();            // => false
validate({x: 0}, Point).isValid();          // => false, y is missing
validate({x: 0, y: 'a'}, Point).isValid();  // => false, y is not a number
validate({x: 0, y: 0}, Point).isValid();    // => true

```

## Lists and tuples

**Lists**

```js
// a list of strings
var Words = list(Str);

validate(null, Words).isValid();                  // => false
validate(['hello', 1], Words).isValid();          // => false, [1] is not a string
validate(['hello', 'world'], Words).isValid();    // => true
```

**Tuples**

```js
// a tuple (width x height)
var Size = tuple([Positive, Positive]);

validate([1], Size).isValid();      // => false, height missing
validate([1, -1], Size).isValid();  // => false, bad height
validate([1, 2], Size).isValid();   // => true
```

## Enums

```js
var CssTextAlign = enums.of('left right center justify');

validate('bottom', CssTextAlign).isValid(); // => false
validate('left', CssTextAlign).isValid();   // => true
```

## Unions

```js
var CssLineHeight = union([Num, Str]);

validate(null, CssLineHeight).isValid();    // => false
validate(1.4, CssLineHeight).isValid();     // => true
validate('1.2em', CssLineHeight).isValid(); // => true
```

## Dicts

```js
// a dictionary of numbers
var Country = enums.of('IT, US', 'Country');
var Warranty = dict(Country, Num);

validate(null, Warranty).isValid();             // => false
validate({a: 2}, Warranty).isValid();           // => false, ['a'] is not a Country
validate({US: 2, IT: 'a'}, Warranty).isValid(); // => false, ['IT'] is not a number
validate({US: 2, IT: 1}, Warranty).isValid();   // => true
```

## Nested structures

You can validate structures with arbitrary level of nesting:

```js
var Post = struct({
  title: Str,
  content: Str,
  tags: Words
});

var mypost = {
  title: 'Awesome!',
  content: 'You can validate structures with arbitrary level of nesting',
  tags: ['validation', 1] // <-- ouch!
};

validate(mypost, Post).isValid();     // => false
validate(mypost, Post).firstError();  // => 'tags[1] is `1`, should be a `Str`'
```

# Use cases

## Form validation

Let's design the process for a simple sign in form:

```js
var SignInInfo = struct({
  username: Str,
  password: Str
});

// retrieves values from the UI
var formValues = {
  username: $('#username').val().trim() || null,
  password: $('#password').val().trim() || null
};

// if formValues = {username: null, password: 'password'}
var result = validate(formValues, SignInInfo);
result.isValid();     // => false
result.firstError();  // => 'username is `null`, should be a `Str`'
```

## JSON schema

If you don't want to use a JSON Schema validator or it's not applicable, you can just use this lightweight library in a snap. This is the JSON Schema example of [http://jsonschemalint.com/](http://jsonschemalint.com/)

```json
{
  "type": "object",
  "properties": {
    "foo": {
      "type": "number"
    },
    "bar": {
      "type": "string",
      "enum": [
        "a",
        "b",
        "c"
      ]
    }
  }
}
```

and the equivalent `tcomb-validation` counterpart:

```js
var Schema = struct({
  foo: Num,
  bar: enums.of('a b c')
});
```

let's validate the example JSON:

```js
var json = {
  "foo": "this is a string, not a number",
  "bar": "this is a string that isn't allowed"
};

validate(json, Schema).isValid(); // => false

// the returned errors are:
[
  'foo is `"this is a string, not a number"`, should be a `Num`',
  'bar is `"this is a string that isn\'t allowed"`, should be a `enums`'
]
```

**Note**: A feature missing in standard JSON Schema is the powerful [subtype](#subtypes) syntax.

# Api reference

## ValidationResult

`ValidationResult` represents the result of a validation. It containes the following fields:

- `errors`: a list of `ValidationError` if validation fails
- `value`: an instance of `type` if validation succeded

```js
// the definition of `ValidationResult`
var ValidationResult = struct({
  errors: list(ValidationError),
  value: Any
}, 'ValidationResult');

// the definition of `ValidationError`
var ValidationError = struct({
  message: Str,                     // a default message for developers
  actual: Any,                      // the actual value being validated
  expected: t.Type,                 // the type expected
  path: list(t.union([Str, t.Num])) // the path of the value
}, 'ValidationError');
```

### #isValid()

Returns true if there are no errors.

```js
validate('a', Str).isValid(); // => true
```

### #firstError()

Returns the first error or `null` if validation succeded.

```js
validate(1, Str).firstError(); // => 'value is `1`, should be a `Str`'
```

## validate(value, type) -> ValidationResult

- `value` the value to validate
- `type` a type defined with the tcomb library

# Tests

Run `npm test`

# License

The MIT License (MIT)
