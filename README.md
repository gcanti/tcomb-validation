% tcomb-validation

![tcomb logo](http://gcanti.github.io/resources/tcomb/logo.png)

A brand new **general purpose** validation library for JavaScript

# Playground

Try the [playground online](https://gcanti.github.io/resources/tcomb-validation/playground/playground.html)

# Overview

**Features**

- concise yet expressive syntax
- validates native types, subtypes, objects, lists and tuples, enums, unions, dicts
- validates structures with arbitrary level of nesting
- detailed informations on failed validations
- lightweight alternative to JSON Schema (4K gzipped bundled with [tcomb](https://github.com/gcanti/tcomb))
- easy integration with React (`propTypes`) and Backbone (`validate` implementation)
- output messages are fully customizable
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
- [Advanced usage and use cases](#advanced-usage-and-use-cases)
  - [Form validation](#form-validation)
  - [JSON schema](#json-schema)
  - [An alternative syntax for React propTypes](#an-alternative-syntax-for-react-proptypes)
  - [Full debugging support for React components](#full-debugging-support-for-react-components)
  - [Backbone validation](#backbone-validation)
  - [Full debugging support for Backbone models](#full-debugging-support-for-backbone-models)
- [Api reference](#api-reference)

# Basic usage

*If you don't know how to define types with tcomb you may want to take a look at its [README](https://github.com/gcanti/tcomb/blob/master/README.md) file.*

The main function is `validate`:

```js
validate(value, spec) -> Result
```

- `value` the value to validate
- `spec` a type defined with the [tcomb](https://github.com/gcanti/tcomb) library

returns a `Result` object containing the result of the validation

Example

```js
var Tcomb = require('tcomb-validation');
var validate = Tcomb.addons.validation.validate;
var Str = Tcomb.Str; // a string type

validate(1, Str).isValid();   // => false
validate('a', Str).isValid(); // => true
```

You can inspect the result to quickly identify what's wrong:

```js
var result = validate(1, Str);
result.isValid();     // => false
result.firstError();  // => new Error('value is `1`, should be a `Str`')

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

// in order to make it work, we must implement the #dispath method
CssLineHeight.dispatch = function (x) {
  if (Num.is(x)) { return Num; }
  else if (Str.is(x)) { return Str; }
};

validate(null, CssLineHeight).isValid();    // => false
validate(1.4, CssLineHeight).isValid();     // => true
validate('1.2em', CssLineHeight).isValid(); // => true
```

## Dicts

```js
// a dictionary of numbers
var Warranty = dict(Num);

validate(null, Warranty).isValid();             // => false
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
var result = validate(formValues, SignInInfo);
result.isValid();     // => false
result.firstError();  // => new Error('username is `null`, should be a `Str`')
```

You can customize the output to return your messages or simply the names of the invalid props for further processing:

```js
var result = validate(formValues, SignInInfo, {messages: ':path'});
result.firstError(); // => new Error('username')

// display invalid fields to the user
result.errors.forEach(function (err) {
  $('#' + err.message).parent().addClass('has-error'); // Bootstrap 3
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

**Note**: A feature missing in standard JSON Schema is the powerful [subtype](#subtypes) syntax.

## An alternative syntax for React propTypes

**UPDATE**: since the last release of this library, I wrote a separate project to maximize the control 
over React components, see [here](https://github.com/gcanti/tcomb-react).

You can also use this library as an alternative syntax for the React.js `propTypes`, taking advantage of its expressive syntax:

```js
// define the component props
var MyProps = struct({
  foo: Num,
  bar: subtype(Str, function (s) { return s.length <= 3; }, 'Bar')
});

// a simple component
var MyComponent = React.createClass({

  propTypes: toPropTypes(MyProps), // <--- !

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
*You can find the `toPropTypes` function [here](https://github.com/gcanti/tcomb-react)*

## Full debugging support for React components

**UPDATE**: since the last release of this library, I wrote a separate project to maximize the control 
over React components, see [here](https://github.com/gcanti/tcomb-react).

A complete alternative to `propTypes` is adding this simple snippet to your `render` methods to obtain a full debugging support:

```js
//
// if bad props are passed, the debugger kicks in
//
// define the component props
var MyProps = struct({
  foo: Num,
  bar: subtype(Str, function (s) { return s.length <= 3; }, 'Bar'),
  children: Any
});

var MyComponent = React.createClass({
  render: function () {
    this.props = MyProps(this.props); // <--- !
    return (
      <div>
        <div>Foo is: {this.props.foo}</div>
        <div>Bar is: {this.props.bar}</div>
      </div>
    );
  }    
});
```

## Backbone validation

```js
// attributes definition
var Attrs = struct({
  x: Num,
  y: Num
});

var options = {validate: true};

var Model = Backbone.Model.extend({
  validate: function (attrs, options) {
    return validate(attrs, Attrs).errors;
  }
});

// first validation (OK)
var model = new Model({x: 1, y: 2}, options);
console.log(model.attributes); // => { x: 1, y: 2 }

// second validation (KO)
model.set({x: 'a'}, options);  // bad attribute
console.log(model.attributes); // => { x: 1, y: 2 } attributes are unchanged
```

## Full debugging support for Backbone models

To obtain a full debugging support simply modify the `validate` method:

```js
//
// if bad attributes are passed, the debugger kicks in
//

var Model = Backbone.Model.extend({
  validate: function (attrs, options) {
    Attrs(attrs); // <--- !
  }
});

// bad call
var model = new Model({x: 1, y: 'a'}, options);
```

# Api reference

## Result

`Result` is a struct containing an `errors` prop which is:

- a list of `Error` if validation fails 
- or `null` if succeded.

```js
// the definition of `Result`
var Result = struct({
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

## validate(value, type, [opts]) -> Result

- `value` the value to validate
- `type` a type defined with the tcomb library
- `opts` options hash

### opts.messages

Customizes the error messages:

```js
var Point = struct({
  x: Num, 
  y: Num
});

var myMessages = {
  x: 'x should be a number',
  y: 'y should be a number'
};

var result = validate({x: 'a'}, Point, {messages: myMessages}); 
console.log(result.errors);

// outputs
[
  new Error('x should be a number'),
  new Error('y should be a number')
]
```

**Placeholders**

In your custom messages, you can use the following placeholders:

- `:path`: the path of the offending value
- `:jsonpath`: the path of the offending value in [JSON Path](http://goessner.net/articles/JsonPath/) format 
- `:actual`: the actual offending value
- `:expected`: the type of the expected value

```js
myMessages = {
  x: ':jsonpath = :actual instead of a :expected',
  y: ':jsonpath = :actual instead of a :expected'
};

var result = validate({x: 'a'}, Point, {messages: myMessages}); 
console.log(result.errors);

// outputs
[
  new Error('["x"] = "a" instead of a Num'),
  new Error('["y"] = undefined instead of a Num')
]
```

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
