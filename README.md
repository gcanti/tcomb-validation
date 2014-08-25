% tcomb-validation

General purpose validation library for JavaScript.

You can validate all the types provided by [tcomb](https://github.com/gcanti/tcomb): native types, structs, unions, enums, maybe, tuples, subtypes, lists. The syntax is the same of tcomb: concise yet expressive, output messages are fully customizable and you can validate structures with arbitrary level of nesting, making it ideal for validating input both on the client (UI) and on the server (JSON api).

# Basic usage

The main exported function is:

```javascript
validate(value, spec, [opts]) -> maybe(list(Err))
```

- `value` the value to validate
- `spec` a type defined with the tcomb library
- `opts` options hash, see Api section for details

Returns: 

- a list of `Error` if validation fails 
- or `null` if succeded.

Example

```javascript
var t = require('tcomb');

// validating a string
validate(1, t.Str); // => new Error('value is `1`, should be a `Str`')

// validating an object
// with two numerical props
var Point = t.struct({
  x: t.Num, 
  y: t.Num
});
validate(null, Point); // => new Error('value is `null`, should be an `Obj`')
validate({x: 0}, Point); // => new Error('y is `undefined`, should be a `Num`')
validate({x: 0, y: 'a'}, Point); // => new Error('y is `"a"`, should be a `Num`)

// validating an array
// (width x height)
var Dimension = tuple([Num, Num]); 
validate([1, 2, 3], Dimension); // => new Error('value is `[1,2,3]`, should be an `Arr` of length `2`')
validate([1, 'a'], Dimension); // => new Error('[1] is `"a"`, should be a `Num`')
```


# Advanced usage and use cases

This library is conceived to be general purpose, here some use case:

## Form validation

Let's design the model for a sign up form. 

*If you don't know how to define types with tcomb you may want to take a look at the [README.md](https://github.com/gcanti/tcomb) of the project.*


```javascript
// a username is a string with at least 3 chars
var Username = subtype(Str, function (s) {
  return s.length >= 3;
});

// a password is a string with at least 6 chars
var Password = subtype(Str, function (s) {
  return s.length >= 6;
});

// an email is a string that contains '@' :)
var Email = subtype(Str, function (s) {
  return s.indexOf('@') !== -1;
});

// sign up info (Reddit-like)
var User = struct({
  username: Username, // required
  password: Password, // required
  email: maybe(Email) // optional, can be `null`
});
```

Here the code to validate the signup form

```javascript
var formValues = {
  username: $('#username').val().trim() || null,
  password: $('#password').val().trim() || null,
  email: $('#email').val().trim() || null
};

validate(formValues, User);

// if formValues = {password: 'password', email: 'a'}
// the returned value will be
[
  new Error('username is `undefined`, should be a `Str`'),
  new Error('email is `"a"`, should be truthy for the predicate')
]
```

You can customize the output to return your messages or maybe simply the names of the invalid props for further processing (i.e. feedback to the user that something went wrong).

```javascript
var result = validate(values, User, {messages: ':xpath'});

// the returned value is
[
  new Error('username'),
  new Error('email')
]
```

## JSON schema

If you don't want to use a JSON Schema validator or it's not applicable, you can use this lightweight library in a snap. Here the JSON Schema example of [http://jsonschemalint.com/](http://jsonschemalint.com/)

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

and the equivalent `tcomb-validation` definition:

```javascript
var Schema = struct({
  foo: Num,
  bar: enums.of('a b c', 'MyEnum')
});
```

the validation:

```javascript
var doc = {
  "foo": "this is a string, not a number", 
  "bar": "this is a string that isn't allowed"
}
validate(doc, Schema);

// the returned value is
[
  new Error('foo is `"this is a string, not a number"`, should be a `Num`'),
  new Error('bar is `"this is a string that isn\'t allowed"`, should be a `MyEnum`')
]
```

## React propTypes

You can also use this library as an alternative syntax for the React.js `propTypes`, taking advantage of its expressive and powerful syntax:

```javascript
var MyComponentProps = struct({
  foo: Num,
  bar: subtype(Str, function (s) { return s.length <= 3; })
});

var MyComponent = React.createClass({
  propTypes: toPropTypes(MyComponentProps), // <- here!
  render: function () {
    return (
      <div>
        <div>Foo is: {this.props.foo}</div>
        <div>Bar is: {this.props.bar}</div>
      </div>
    );
  }    
});

var props = new MyComponentProps({
  "foo": "this is a string, not a number", 
  "bar": "this is a string too long"
});
React.renderComponentToString(MyComponent(props));

// print to the console:
// => Warning: foo is `"this is a string, not a number"`, should be a `Num`
// => Warning: bar is `"this is a string too long"`, should be truthy for the predicate
```

where `toPropTypes` is a general helper function accepting a struct:

```javascript
// helper function: transforms a tcomb struct
// in React.js propTypes
function toPropTypes(Struct) {
  var propTypes = {};
  var props = Struct.meta.props;
  Object.keys(props).forEach(function (k) {
    propTypes[k] = function (values, name, component) {
      var T = props[name];
      var value = values[name];
      return validate(value, T, {path: ['product', k]}).firstError();
    }
  });
  return propTypes;
}
```

# Api

## Validation

Here the definition of this type:

```javascript
var Validation = maybe(list(Err));
```

### #isValid()

Returns true if there are no errors.

### #firstError()

Returns the first error or `null` if validation succeded.

## validate(value, type, [opts]) -> Validation

- `value` the value to validate
- `type` a type defined with the tcomb library
- `opts` options hash

### opts.messages

You can fully customize the error messages. Let's define a complex model for a `Product`:

```javascript
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
```
Now you can specify a custom message for all `path` of the model:

```javascript
var messages = {
  ':input':  'product should be an object',
  name:       'name should be a string',                  
  desc:       'desc should be an optional string',
  home:       {
    ':type': 'home should be a string', 
    ':predicate': 'home should be an URL'
  },
  shippings:  {
    ':input': 'shippings should be a list of strings', 
    ':type': 'every element of shippings should be a string'
  },       
  category:   'category should be a valid enum',         
  price:      {
    ':dispatch': 'price should be expressed in dollars or in another currency', 
    0: 'price should be a positive number', 
    1: {
      ':struct': 'price should be an object', 
      currency: 'currency should be a currency', 
      amount: 'amount should be a positive number'
    }
  },
  dim:        {
    ':input': 'dim should be an array of length 2', 
    0: 'dim.width should be a number', 
    1: 'dim.height should be a number'
  }
};
```

and then call `validate` with your custom messages:

```javascript
validate(data, Product, {messages: messages});
```

the library will use your messages instead of the default ones.

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
