% tcomb-validation

General purpose validation library for JavaScript.

You can validate all the types provided by [tcomb](https://github.com/gcanti/tcomb) making it ideal for input 
validation on both the client and the server.

**Features**

- the syntax is concise yet expressive
- validates native types, structs, unions, enums, maybe, tuples, subtypes, lists
- validates structures with arbitrary level of nesting
- precise informations on the failed validations
- output messages are fully customizable
- reuse your domain model written with tcomb

**Contents**

- [Basic usage](#basic-usage)
  - [Validating primitives](#validating-primitives)
  - [Subtypes](#subtypes)
  - [Validating objects](#validating-objects)
  - [Validating arrays](#validating-arrays)
  - [Validating nested structures](#validating-nested-structures)
- [Advanced usage and use cases](#advanced-usage-and-use-cases)
  - [Form validation](#form-validation)
  - [JSON schema](#json-schema)
  - [An alternative syntax for React propTypes](#an-alternative-syntax-for-react-proptypes)
  - [Backbone validation](#backbone-validation)
- [Api](api)

*If you don't know how to define types with tcomb you may want to take a look at its [README.md](https://github.com/gcanti/tcomb) file.*

# Basic usage

```js
validate(value, spec) -> Validation
```

- `value` the value to validate
- `spec` a type defined with the tcomb library

Returns a `Validation` object containing the result of the validation

```js
var library = require('tcomb-validation');
var t = library.t; // re-exported tcomb library
var validate = library.validate;

validate(1, t.Str).isValid();   // => false
validate('a', t.Str).isValid(); // => true
```

You can inspect the result to quickly identify what's wrong:

```js
var result = validate(1, t.Str);
result.isValid();     // => false
result.firstError();  // => new Error('value is `1`, should be a `Str`')

// result.errors to see all errors
```

## Validating primitives

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

// you can also validate functions, dates and regexps
```

## Subtypes

You can express more fine-grained contraints with the `subtype` syntax:

```js
// a predicate is a function with signature (x) -> Bool
var predicate = function (x) { return x >= 0; };

// a positive number
var Positive = subtype(Num, predicate);

validate(-1, Positive).isValid(); // => false
validate(1, Positive).isValid();  // => true
```

## Validating objects

```js
// this is an object with two numerical properties
var Point = struct({
  x: Num, 
  y: Num
});

validate(null, Point).isValid();            // => false
validate({x: 0}, Point).isValid();          // => false, y is missing
validate({x: 0, y: 'a'}, Point).isValid();  // => false, y is not a number
validate({x: 0, y: 0}, Point).isValid();    // => true

```

## Validating arrays

**Lists**

```js
// this is a list of strings
var Words = list(Str);

validate(null, Words).isValid();                  // => false
validate(['hello', 1], Words).isValid();          // => false, [1] is not a string
validate(['hello', 'world'], Words).isValid();    // => true
```

**Tuples**

```js
// this is a tuple (width x height)
var Dimensions = tuple([Num, Num]);

validate([1], Dimensions).isValid();      // => false
validate([1, 'a'], Dimensions).isValid(); // => false
validate([1, 2], Dimensions).isValid();   // => true
```

## Validating nested structures

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
validate(mypost, Post).firstError();  // => new Error('tags[1] is `1`, should be a `Str`')
```

# Advanced usage and use cases

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
validate(formValues, SignInInfo).isValid(); // => false

// the returned error will be: new Error('username is `undefined`, should be a `Str`')
```

You can customize the output to return your messages or simply the names of the invalid props for further processing:

```js
var result = validate(formValues, SignInInfo, {messages: 'xpath'});

// the returned error will be: new Error('username')

// display invalid fields to the user
result.errors.forEach(function (err) {
  $('#' + err.message).addClass('has-error');
});
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
  new Error('foo is `"this is a string, not a number"`, should be a `Num`'),
  new Error('bar is `"this is a string that isn\'t allowed"`, should be a `enums`')
]
```

## An alternative syntax for React propTypes

You can also use this library as an alternative syntax for the React.js `propTypes`, taking advantage of its expressive syntax:

```js
// define the component props
var MyProps = struct({
  foo: Num,
  bar: subtype(Str, function (s) { return s.length <= 3; }, 'Bar')
});

// component definition
var MyComponent = React.createClass({

  propTypes: library.toPropTypes(MyProps), // <---

  render: function () {
    return (
      <div>
        <div>Foo is: {this.props.foo}</div>
        <div>Bar is: {this.props.bar}</div>
      </div>
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

// prints to console:
// => Warning: this.props.foo of value `"this is a string, not a number"` supplied to `undefined`, expected a `Num`
// => Warning: Warning: this.props.bar of value `"this is a string too long"` supplied to `undefined`, expected a `Bar`
```

## Backbone validation

TODO

# Api

## Validation

`Validation` is a struct containing an `errors` prop which is:

- a list of `Error` if validation fails 
- or `null` if succeded.

```js
var Validation = struct({
  errors: maybe(list(Err))
});
```

### #isValid()

Returns true if there are no errors.

```js
validate('a', Str).isValid(); // => true
```  

### #firstError()

Returns the first error or `null` if validation succeded.

```js
validate(1, Str).firstError(); // => new Error('value is `1`, should be a `Str`')
```  

## validate(value, type, [opts]) -> Validation

- `value` the value to validate
- `type` a type defined with the tcomb library
- `opts` options hash

### opts.messages

TODO

# Tests

Run `mocha` in the project root.

# License (MIT)

The MIT License (MIT)

Copyright (c) 2014 Giulio Canti

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
