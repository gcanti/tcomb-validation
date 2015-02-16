$(function () {

'use strict';

var t = require('../index');
var React = require('react');
var v = t.validate;

//
// utils
//

function repo(name, title) {
  title = title || name;
  return <a href="https://github.com/gcanti/{name}">{title}</a>
}

//
// setup
//

// if true, open the debugger when a failure occurs
var isDebuggerEnabled = false;

// override default fail behaviour of tcomb https://github.com/gcanti/tcomb
t.fail = function (message) {
  if (isDebuggerEnabled) {
    debugger;
  }
  throw new Error(message);
};

var scripts = {
  primitives: {
    label: 'Primitives (Native JavaScript types)'
  },
  subtypes: {
    label: '`subtype` combinator (Subtypes)'
  },
  objects: {
    label: '`struct` combinator (Classes)'
  },
  lists: {
    label: '`list` combinator (Lists)'
  },
  tuples: {
    label: '`tuple` combinator (Tuples)'
  },
  enums: {
    label: '`enums` combinator (Enums)'
  },
  unions: {
    label: '`union` combinator (Unions)'
  },
  dict: {
    label: '`dict` combinator (Dictionaries)'
  },
  nested: {
    label: 'Validating nested structures'
  },
  form: {
    label: 'Form validation'
  },
  jsonschema: {
    label: 'an alternative syntax for JSON Schema'
  }
};

var examples = {};
var options = [];
Object.keys(scripts).forEach(function (id) {
  examples[id] = $('#' + id).text();
  options.push(<option key={id} value={id}>{scripts[id].label}</option>);
});
var defaultExample = 'primitives';

//
// makes all types global
//

[
  'Nil',
  'Str',
  'Num',
  'Bool',
  'Func',
  'Re',
  'Dat',
  'maybe',
  'struct',
  'union',
  'subtype',
  'list',
  'tuple',
  'enums',
  'dict'
]
.forEach(function (name) {
  window[name] = t[name];
});

var results = [];
window.validate = function (value, type, opts) {
  var result = v(value, type, opts);
  console.log(result);
  results.push(result);
  return result;
};

//
// components
//

var Header = React.createClass({
  render: function () {
    return (
      <div className="row header">
        <div className="col-md-6">
          <h1>{repo('tcomb-validation')} playground</h1>
          <p className="text-muted">A JavaScript validation library based on type combinators</p>
          <br/>
          <p>
            Concise yet expressive syntax, full debugging support.
          </p>
        </div>
        <div className="col-md-6">
          <div className="text-right repo-link">
              <p>My <a href="/">blog</a></p>
          </div>
        </div>
      </div>
    );
  }
});

var Footer = React.createClass({
  render: function () {
    return (
      <div className="row text-muted">
        <div className="col-md-1">
          <strong>Credits:</strong>
        </div>
        <div className="col-md-11">
          <ul>
            <li>{repo('tcomb-validation')} <i>"General purpose validation library for JavaScript"</i></li>
            <li>{repo('tcomb')} <i>"Pragmatic runtime type checking for JavaScript "</i></li>
            <li><a href="http://facebook.github.io/react/index.html">React.js</a></li>
          </ul>
        </div>
      </div>
    );
  }
});

var Example = React.createClass({
  onChange: function () {
    var value = this.refs.example.getDOMNode().value;
    this.props.onChange(value);
  },
  render: function () {
    return (
      <select className="form-control" ref="example" defaultValue={this.props.name} onChange={this.onChange}>
        {options}
      </select>
    );
  }
});

var Validation = React.createClass({
  render: function () {
    var results = this.props.results;
    var validation;
    if (results instanceof Error) {
      validation = (
        <div className="alert alert-danger">
          {results.message}
        </div>
      );
    } else {
      validation = results.map(function (result, i) {
        if (result.isValid()) {
          return (
            <div className="alert alert-success" key={i}>
              ok
            </div>
          );
        } else {
          return result.errors.map(function (e, i) {
            return (
              <div className="alert alert-danger" key={i}>
                {e.message}
              </div>
            );
          });
        }
      });
    }
    return (
      <div>{validation}</div>
    );
  }
});

var CodeMirrorComponent = React.createClass({

    updateCode: function(){
      this.cm.setValue(this.props.code);
    },

    codeChanged: function(cm){
      // set a flag so this doesn't cause a cm.setValue
      this.userChangedCode = true;
      this.props.onChange && this.props.onChange(cm.getValue());
    },

    // standard lifecycle methods
    componentDidMount: function() {
      // bind CodeMirror
      this.cm = CodeMirror(this.getDOMNode(), {
        mode: 'javascript',
        lineNumbers: false,
        lineWrapping: true,
        smartIndent: false  // javascript mode does bad things with jsx indents
      });
      this.updateCode();
      this.cm.on("change", this.codeChanged);
    },

    componentDidUpdate: function(){
      this.updateCode();
    },

    componentWillUnmount: function(){
      this.cm.off("change", this.codeChanged);
    },

    render: function() {
      return (<div />);
    },

    shouldComponentUpdate: function(nextProps){
      if (this.userChangedCode) {
        this.userChangedCode = false;
        return false;
      }
      return nextProps.code !== this.props.code;
    }
});

var Main = React.createClass({
  getInitialState: function () {
    return {
      code: examples[defaultExample],
      name: defaultExample
    };
  },
  eval: function (code) {
    results = [];
    try {
      var js = JSXTransformer.transform(code).code;
      return eval(js);
    } catch (e) {
      return e;
    }
  },
  onExampleChange: function (name) {
    var code = examples[name];
    isDebuggerEnabled = !!scripts[name].debug;
    this.setState({code: code, name: name});
  },
  onCodeChange: function (code) {
    this.setState({code: code, name: this.state.name});
  },
  render: function () {
    var code = this.state.code;
    var err = this.eval(code);
    return (
      <div className="container">
        <Header/>
        <div className="row">
          <div className="col-md-6">
            <p className="lead">Choose a code example, or write your own</p>
            <Example name={this.state.name} onChange={this.onExampleChange}/>
            <p className="text-muted">Open up the console for a complete debugging experience..</p>
            <CodeMirrorComponent code={this.state.code} onChange={this.onCodeChange}/>
          </div>
          <div className="col-md-6">
            { this.state.name === 'form' ?
              <div>
                <p className="lead">Form</p>
                <form id="myform" role="form" method="post">
                  <div className="form-group">
                    <input type="text" id="username" placeholder="Username" className="form-control"/>
                  </div>
                  <div className="form-group">
                    <input type="password" id="password" placeholder="Password" className="form-control"/>
                  </div>
                  <button className="btn btn-primary btn-block">Sign in</button>
                </form>
              </div>
              :
              <div>
                <p className="lead">Validation result</p>
                <Validation results={err instanceof Error ? err : results}/>
              </div>
            }
          </div>
        </div>
        <hr/>
        <Footer/>
      </div>
    );
  }
});

//
// run
//

var main = React.render(React.createFactory(Main)(null), document.getElementById('app'));


});

